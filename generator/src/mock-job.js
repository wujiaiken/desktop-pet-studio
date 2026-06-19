import { readConfig, requireConfigValue } from "./config.js";
import { processJob } from "./worker.js";

const config = readConfig();
const orderId = process.argv[2];

requireConfigValue(config.workerApiBase, "WORKER_API_BASE");

if (!orderId) {
  console.error("Usage: npm run mock-job -- <orderId>");
  process.exit(1);
}

await processJob(
  {
    orderId,
    jobUrl: `${config.workerApiBase}/api/worker/orders/${orderId}/job`,
    callbackUrl: `${config.workerApiBase}/api/worker/orders/${orderId}/callback`,
    artifactsUrl: `${config.workerApiBase}/api/worker/orders/${orderId}/artifacts`,
  },
  config,
);

console.log(`mock package uploaded for ${orderId}`);
