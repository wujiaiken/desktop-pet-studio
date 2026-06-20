# Desktop Pet Generator

This service is the bridge between Cloudflare Worker/R2 and AutoDL ComfyUI.

It accepts generation jobs from:

```text
POST /jobs
```

Then it:

```text
fetches order metadata
downloads customer source images
runs generation or mock packaging
uploads preview/package artifacts back to the Worker
updates order status
```

## Local Run

```powershell
copy .env.example .env
npm install
npm start
```

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8789/health
```

## Required Environment

```text
PORT=8789
WORKER_API_BASE=https://desktop-pet-studio-api.tikogafar76.workers.dev
GENERATOR_SHARED_SECRET=replace-with-a-long-random-token
```

When ComfyUI is ready:

```text
COMFYUI_BASE_URL=http://127.0.0.1:8188
COMFYUI_WORKFLOW_PATH=./workflows/desktop-pet-api.json
```

## Manual Mock Job

For an order already created/uploaded in the website:

```powershell
npm run mock-job -- ord_xxx
```

This creates a mock `pet_package.zip` and uploads it through the Worker private artifact endpoint.

## Windows Service

For the Tencent Cloud Windows lightweight server, see:

```text
docs/tencent-light-server-generator.md
```

Use port `8789`. Do not use `5000`, because the existing license/auth API is already listening there.

## Production Shape

```text
Cloudflare Worker -> Tencent generator -> AutoDL ComfyUI
                                      -> Cloudflare Worker/R2
```

AutoDL is for GPU generation only. Customer downloads should come from Cloudflare/R2.
