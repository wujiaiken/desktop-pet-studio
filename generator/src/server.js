import express from "express";
import { readConfig, requireConfigValue } from "./config.js";
import { processJob } from "./worker.js";

const config = readConfig();
const app = express();

app.use(express.json({ limit: "2mb" }));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/jobs", async (req, res) => {
  const authResponse = authorize(req, config.sharedSecret);
  if (authResponse) {
    return res.status(authResponse.status).json(authResponse.body);
  }

  const job = req.body || {};
  if (!job.orderId || !job.jobUrl) {
    return res.status(400).json({ ok: false, error: "missing_job_payload" });
  }

  res.status(202).json({ ok: true, accepted: true, orderId: job.orderId });

  processJob(job, config).catch((error) => {
    console.error("job_failed", {
      orderId: job.orderId,
      message: error instanceof Error ? error.message : String(error),
    });
  });
});

requireConfigValue(config.workerApiBase, "WORKER_API_BASE");

app.listen(config.port, () => {
  console.log(`desktop-pet-generator listening on :${config.port}`);
});

function authorize(req, expected) {
  if (!expected) {
    return null;
  }

  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (token === expected) {
    return null;
  }

  return { status: 401, body: { ok: false, error: "unauthorized" } };
}
