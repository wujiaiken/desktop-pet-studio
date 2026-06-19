import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createPackageZip } from "./zip.js";

const MOCK_PREVIEW_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

export async function processJob(job, config) {
  const headers = authHeaders(config.sharedSecret);
  const orderId = job.orderId;

  await postJson(job.callbackUrl, { status: "generating" }, headers);

  const jobInfo = await getJson(job.jobUrl, headers);
  const order = jobInfo.order;
  const workdir = await mkdtemp(path.join(tmpdir(), `desktop-pet-${orderId}-`));

  try {
    const sourceFiles = [];
    for (const source of order.sourceImages) {
      const filePath = path.join(workdir, `source-${source.index}.bin`);
      const response = await fetch(source.url, { headers });
      if (!response.ok) {
        throw new Error(`Failed to download source ${source.index}: ${response.status}`);
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      await writeFile(filePath, bytes);
      sourceFiles.push(filePath);
    }

    await postJson(order.callbackUrl, { status: "packaging" }, headers);

    const previewPath = await buildMockPreview(workdir);
    const manifest = {
      version: 1,
      orderId,
      productTier: order.productTier,
      species: order.species,
      petName: order.petName,
      generatedAt: new Date().toISOString(),
      mode: "mock",
      assets: {
        preview: "preview.png",
        images: ["images/base_pet.png"],
      },
      notes: "Mock package. Replace generator/src/worker.js with ComfyUI calls for real production generation.",
    };

    const packagePath = path.join(workdir, "pet_package.zip");
    await createPackageZip(packagePath, {
      manifest,
      previewPath,
      sourceFiles,
    });

    await uploadArtifacts(order.artifactsUrl, packagePath, previewPath, manifest, headers);
  } catch (error) {
    await postJson(
      job.callbackUrl,
      {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      },
      headers,
    );
    throw error;
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

async function buildMockPreview(workdir) {
  const previewPath = path.join(workdir, "preview.png");
  await writeFile(previewPath, Buffer.from(MOCK_PREVIEW_PNG_BASE64, "base64"));
  return previewPath;
}

async function uploadArtifacts(artifactsUrl, packagePath, previewPath, manifest, headers) {
  const form = new FormData();
  form.append(
    "package",
    new Blob([await readFile(packagePath)], { type: "application/zip" }),
    "pet_package.zip",
  );
  form.append(
    "preview",
    new Blob([await readFile(previewPath)], { type: "image/png" }),
    "preview.png",
  );
  form.append(
    "manifest",
    new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" }),
    "manifest.json",
  );

  const response = await fetch(artifactsUrl, {
    method: "POST",
    headers,
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload artifacts: ${response.status} ${await response.text()}`);
  }
}

async function getJson(url, headers) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function postJson(url, body, headers) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...headers,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`POST ${url} failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

function authHeaders(secret) {
  return secret ? { authorization: `Bearer ${secret}` } : {};
}
