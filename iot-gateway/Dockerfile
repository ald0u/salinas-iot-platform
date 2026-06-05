# Imagen de producción del IoT Gateway (simulador)
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["npm", "run", "start"]
