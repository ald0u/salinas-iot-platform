import { initializeTable } from "./dynamodb.js";

initializeTable()
  .then(() => {
    console.log("Tabla inicializada");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error inicializando tabla", error);
    process.exit(1);
  });
