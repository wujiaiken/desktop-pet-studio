export function readConfig() {
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
