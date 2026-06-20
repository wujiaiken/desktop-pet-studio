# Desktop Pet Python Generator

This is a dependency-free Python bridge for the Tencent Cloud Windows lightweight server.

Use it when the server has Python but does not have Node.js or Git.

It exposes:

```text
GET  /health
POST /jobs
```

The flow is the same as the Node generator:

```text
Cloudflare Worker -> POST /jobs
Python generator -> fetch order/source images
Python generator -> create a mock pet_package.zip
Python generator -> upload artifacts to Worker/R2
```

It is a bridge scaffold. Replace the mock package generation with real AutoDL/ComfyUI calls later.

## Environment

Create `.env` beside `server.py`:

```text
PORT=8789
WORKER_API_BASE=https://desktop-pet-studio-api.tikogafar76.workers.dev
GENERATOR_SHARED_SECRET=replace-with-a-long-random-token
```

## Run

```powershell
python server.py
```

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8789/health
```
