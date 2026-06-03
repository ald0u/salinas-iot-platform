import axios from "axios";

const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
const publishIntervalMs = Number(process.env.PUBLISH_INTERVAL_MS || 5000);

const run = async () => {
  try {
    const response = await axios.get(`${backendUrl}/health`);
    console.log("Gateway connected to backend:", response.data);
  } catch (error) {
    console.error(
      "Gateway could not reach backend:",
      error instanceof Error ? error.message : String(error)
    );
  }
};

void run();
setInterval(() => {
  void run();
}, publishIntervalMs);
