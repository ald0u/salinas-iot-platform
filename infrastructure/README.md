# Infraestructura (AWS CDK)

Infraestructura como código de la plataforma IoT, escrita con **AWS CDK** (TypeScript).
Define los mismos componentes que el proyecto ejecuta en local, pero en sus servicios AWS:

- **DynamoDB** — tabla `IoTData` con single-table design, índice `GSI1` y TTL.
- **AWS IoT Core** — una *Topic Rule* que escucha `dt/devices/+/telemetry` y enruta a la Lambda.
- **Lambda de ingesta** — persiste la lectura, evalúa umbrales y notifica (la lógica real vive en el backend).
- **API Gateway** — REST frente al backend.
- **S3 + CloudFront** — hospedaje del frontend Angular (con fallback SPA a `index.html`).

## Estructura

```
infrastructure/
├── bin/app.ts                  punto de entrada de la app CDK
├── lib/salinas-iot-stack.ts    definición del stack
├── cdk.json                    configuración de CDK
└── tsconfig.json
```

## Uso

```bash
cd infrastructure
npm install

npm run build     # compila el TypeScript
npm run synth     # genera la plantilla CloudFormation (no requiere cuenta AWS)
npm run diff      # compara contra lo desplegado
npm run deploy    # despliega en AWS (requiere credenciales)
```

> `npm run synth` funciona **sin cuenta de AWS**: solo sintetiza la plantilla, útil para validar
> la infraestructura. `deploy` sí requiere credenciales y `cdk bootstrap` en la cuenta destino.
