# Desktop Pet Studio API Worker

This directory contains the shared API implementation for Desktop Pet Studio.

In the current production flow, the public API entrypoint is Cloudflare Pages
Functions at:

```text
https://desktop-pet-studio-exu.pages.dev/api/*
```

The Pages Function in `functions/api/[[path]].js` reuses `worker/src/index.js`.
A standalone Cloudflare Worker can still be deployed for backup or debugging,
but `*.workers.dev` is not the production path because Tencent Cloud and the
local network both hit timeouts against that domain chain.

## Runtime Roles

- Cloudflare Pages: customer-facing website plus `/api/*` Pages Functions.
- `worker/src/index.js`: shared API code for orders, uploads, status, downloads, and generator-private callbacks.
- Cloudflare R2: stores uploaded customer photos, order metadata, previews, and final `pet_package.zip`.
- Tencent Cloud generator: public dispatcher at `http://81.68.126.249:8791/jobs`.
- AutoDL / ZEALMAN / ComfyUI: GPU generation layer started on demand by the Tencent generator.

## Endpoints

```text
POST /api/orders
POST /api/orders/:orderId/photos
POST /api/orders/:orderId/generate
GET  /api/orders/:orderId
GET  /api/orders/:orderId/download
POST /api/worker/orders/:orderId/callback
GET  /api/worker/orders/:orderId/job
GET  /api/worker/orders/:orderId/source/:index
POST /api/worker/orders/:orderId/artifacts
```

Generator-private endpoints must use the shared `GENERATOR_SHARED_SECRET` Bearer
token.

## Production Flow

1. Frontend calls `POST /api/orders`.
2. Frontend uploads one or more images to `POST /api/orders/:orderId/photos`.
3. Frontend calls `POST /api/orders/:orderId/generate`.
4. Pages Functions mark the order as `queued` in R2.
5. Pages Functions forward the job to `http://81.68.126.249:8791/jobs`.
6. Tencent Cloud generator fetches job data from `GET /api/worker/orders/:orderId/job`.
7. Tencent Cloud generator downloads source images from `GET /api/worker/orders/:orderId/source/:index`.
8. Tencent Cloud generator powers on the AutoDL app instance if needed.
9. Tencent Cloud generator waits for ZEALMAN Control Panel `6008` and ComfyUI `6006`.
10. Tencent Cloud generator submits workflow `desktop_pet_base_angles_v1` with input key `25:image`.
11. Tencent Cloud generator downloads formal `/output/*` images, builds `pet_package.zip`, then uploads artifacts to `POST /api/worker/orders/:orderId/artifacts`.
12. Customer downloads from `GET /api/orders/:orderId/download`.
13. After 120 seconds idle, Tencent Cloud generator powers off the AutoDL app instance.

Current production constants:

```text
Pages/API: https://desktop-pet-studio-exu.pages.dev
R2 bucket: desktop-pet-assets
Tencent generator: http://81.68.126.249:8791/jobs
AutoDL instance: pro-7817332b4012
ZEALMAN Control Panel: 6008, external 8443
ComfyUI: 6006, external 8443
Workflow ID: desktop_pet_base_angles_v1
Input image key: 25:image
Idle shutdown: 120 seconds
```

## Deploy Notes

1. Create an R2 bucket named `desktop-pet-assets`.
2. Copy `wrangler.toml.example` to `wrangler.toml`.
3. Set `ALLOWED_ORIGINS` to the Pages domain and local dev domain.
4. Deploy with Wrangler.

```bash
cd worker
npx wrangler deploy
```

Current production Pages configuration uses:

```text
NEXT_PUBLIC_PET_API_BASE=https://desktop-pet-studio-exu.pages.dev
GENERATOR_WEBHOOK_URL=http://81.68.126.249:8791/jobs
```

For a standalone Worker deployment, keep the same R2 binding and shared secret,
but do not use the `workers.dev` URL as the production API base.

Set `GENERATOR_SHARED_SECRET` in both the Worker and generator when the dispatcher is reachable from the public internet.

## Pitfalls

- Do not expose `GENERATOR_SHARED_SECRET` or `AUTODL_TOKEN` in docs or commits.
- Do not return AutoDL `/output/*` URLs to customers as long-term downloads; copy artifacts into R2 immediately.
- ZEALMAN workflow JSON must be exported in ComfyUI API format and imported into the `6008` API generation list.
- Cold starts may make `/api/workflow/generate` return transient `5xx`; the generator retries after the workflow list contains `desktop_pet_base_angles_v1`.
- ZEALMAN result payloads can include temp preview images. Production packaging keeps only formal `/output/*` or `raw.type=output` images.
