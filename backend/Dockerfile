# Imagen de producción del backend
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "until npm run db:init; do echo 'esperando a DynamoDB...'; sleep 2; done && (npm run db:seed || true) && npm run start"]
