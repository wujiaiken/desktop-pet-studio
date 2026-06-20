import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function readConfig() {
  loadDotEnv();

  return {
    port: Number(process.env.PORT || 8789),
    sharedSecret: process.env.GENERATOR_SHARED_SECRET || "",
    workerApiBase: trimTrailingSlash(process.env.WORKER_API_BASE || ""),
    comfyuiBaseUrl: trimTrailingSlash(process.env.COMFYUI_BASE_URL || ""),
    comfyuiWorkflowPath: process.env.COMFYUI_WORKFLOW_PATH || "",
  };
}

export function requireConfigValue(value, name) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = unquoteEnvValue(trimmed.slice(equalsIndex + 1).trim());
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function unquoteEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
