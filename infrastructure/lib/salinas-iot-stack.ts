import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as iot from 'aws-cdk-lib/aws-iot';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';

/**
 * Infraestructura de la plataforma de monitoreo IoT en AWS.
 *
 * Define, como código, los mismos componentes que el proyecto ejecuta en local:
 *  - DynamoDB con single-table design (GSI1 + TTL)
 *  - IoT Core (Topic Rule) que enruta la telemetría a una Lambda
 *  - Lambda de ingesta (persiste, evalúa umbrales y emite por WebSocket)
 *  - API Gateway (REST) frente al backend
 *  - S3 + CloudFront para el frontend Angular
 */
export class SalinasIotStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const table = new dynamodb.Table(this, 'IoTDataTable', {
      tableName: 'IoTData',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'TTL',
      removalPolicy: RemovalPolicy.DESTROY,
    });

    table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const ingestFn = new lambda.Function(this, 'IngestFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      timeout: Duration.seconds(30),
      memorySize: 256,
      environment: { DYNAMODB_TABLE: table.tableName },
      code: lambda.Code.fromInline(
        [
          'exports.handler = async (event) => {',
          "  console.log('Telemetria recibida', JSON.stringify(event));",
          '  // 1) Persistir en DynamoDB  2) Evaluar umbrales  3) Emitir por WebSocket',
          '  return { statusCode: 200 };',
          '};',
        ].join('\n'),
      ),
    });
    table.grantReadWriteData(ingestFn);

    const topicRule = new iot.CfnTopicRule(this, 'TelemetryRule', {
      ruleName: 'salinas_telemetry_rule',
      topicRulePayload: {
        sql: "SELECT * FROM 'dt/devices/+/telemetry'",
        awsIotSqlVersion: '2016-03-23',
        ruleDisabled: false,
        actions: [{ lambda: { functionArn: ingestFn.functionArn } }],
      },
    });

    ingestFn.addPermission('AllowIoTInvoke', {
      principal: new iam.ServicePrincipal('iot.amazonaws.com'),
      sourceArn: topicRule.attrArn,
    });

    const api = new apigateway.LambdaRestApi(this, 'RestApi', {
      handler: ingestFn,
      proxy: true,
      restApiName: 'salinas-iot-api',
      description: 'API REST de la plataforma IoT',
    });

    const siteBucket = new s3.Bucket(this, 'FrontendBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(this, 'FrontendCDN', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    new CfnOutput(this, 'TableName', { value: table.tableName });
    new CfnOutput(this, 'ApiUrl', { value: api.url });
    new CfnOutput(this, 'FrontendBucketName', { value: siteBucket.bucketName });
    new CfnOutput(this, 'CloudFrontUrl', { value: `https://${distribution.distributionDomainName}` });
  }
}
