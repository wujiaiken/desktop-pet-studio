# Desktop Pet Studio API Worker

This Worker is the thin API layer between the Cloudflare Pages site, R2 storage, and the external AutoDL/ComfyUI generation worker.

## Runtime Roles

- Cloudflare Pages: customer-facing website.
- Cloudflare Worker: creates orders, receives uploaded photos, exposes status and download endpoints.
- Cloudflare R2: stores uploaded customer photos, order metadata, previews, and final `pet_package.zip`.
- External generator: VPS or AutoDL-side worker that calls ComfyUI, packages results, uploads the zip to R2, and calls back.

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

## MVP Flow

1. Frontend calls `POST /api/orders`.
2. Frontend uploads one or more images to `POST /api/orders/:orderId/photos`.
3. Frontend calls `POST /api/orders/:orderId/generate`.
4. Worker marks the order as `queued`.
5. If `GENERATOR_WEBHOOK_URL` is configured, Worker forwards the job to the external generator.
6. External generator fetches job data from `GET /api/worker/orders/:orderId/job`.
7. External generator downloads source images from `GET /api/worker/orders/:orderId/source/:index`.
8. External generator runs AutoDL ComfyUI, builds `pet_package.zip`, then uploads artifacts to `POST /api/worker/orders/:orderId/artifacts`.
9. If the generator only wants to update progress or failure status, it calls:

```json
{
  "status": "ready",
  "packageKey": "orders/ord_xxx/package/pet_package.zip",
  "previewKey": "orders/ord_xxx/preview.png"
}
```

10. Customer downloads from `GET /api/orders/:orderId/download`.

## Deploy Notes

1. Create an R2 bucket named `desktop-pet-assets`.
2. Copy `wrangler.toml.example` to `wrangler.toml`.
3. Set `ALLOWED_ORIGINS` to the Pages domain and local dev domain.
4. Deploy with Wrangler.

```bash
cd worker
npx wrangler deploy
```

For the first MVP, `GENERATOR_WEBHOOK_URL` can stay empty. The API will still accept orders and uploads, but generation will stay queued until the external generator is added.

Set `GENERATOR_SHARED_SECRET` in both the Worker and generator when the dispatcher is reachable from the public internet.
