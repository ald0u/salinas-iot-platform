#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { SalinasIotStack } from '../lib/salinas-iot-stack';

const app = new App();

new SalinasIotStack(app, 'SalinasIotStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  description: 'Plataforma de monitoreo IoT — Grupo Salinas DC',
});

app.synth();
