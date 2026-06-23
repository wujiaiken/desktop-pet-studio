# Desktop Pet Python Generator

This is a dependency-free Python generator bridge for the Tencent Cloud lightweight server.

Use it when the server has Python but does not have Node.js or Git.

It exposes:

```text
GET  /health
POST /jobs
```

The production flow is:

```text
Cloudflare Pages Functions -> POST /jobs
Python generator -> fetch private order/source images
Python generator -> power on AutoDL app instance when needed
Python generator -> call ZEALMAN/ComfyUI workflow API
Python generator -> download output images and build pet_package.zip
Python generator -> upload artifacts to Pages/R2
Python generator -> power off AutoDL after an idle timeout
```

It now supports two modes:

- `GENERATOR_MODE=mock`: create a tiny placeholder package, useful for smoke tests.
- `GENERATOR_MODE=autodl`: run a registered AutoDL/ZEALMAN ComfyUI workflow, package the image outputs, and upload them back to Pages/R2.

## Environment

Create `.env` beside `server.py`:

```text
PORT=8791
GENERATOR_SHARED_SECRET=replace-with-a-long-random-token
```

AutoDL mode:

```text
GENERATOR_MODE=autodl
AUTODL_PANEL_BASE=https://uu1056908-7817332b4012.westd.seetacloud.com:8443
AUTODL_WORKFLOW_ID=desktop_pet_base_angles_v1
AUTODL_INPUT_IMAGE_KEY=25:image
AUTODL_START_COMFY=1

# Required only when the generator should power the AutoDL app instance on/off.
AUTODL_TOKEN=replace-with-autodl-developer-token
AUTODL_INSTANCE_UUID=pro-7817332b4012
AUTODL_POWER_MANAGEMENT=1
AUTODL_IDLE_SHUTDOWN_SECONDS=120
```

When `AUTODL_POWER_MANAGEMENT=0`, the generator assumes the AutoDL instance and the control panel are already running.

## Production Notes

- Tencent Cloud listens on `PORT=8791` in production.
- AutoDL internal port `6008` is the ZEALMAN Control Panel; internal port `6006` is ComfyUI.
- The registered API workflow is `desktop_pet_base_angles_v1`.
- The pet source image input key is `25:image`.
- The generator waits for the workflow list to contain `desktop_pet_base_angles_v1` before submitting a prompt.
- Cold start can return transient `5xx` from `/api/workflow/generate`; the generator retries before failing the order.
- Only formal `/output/*` images are packaged. Temporary preview images are ignored.
- Never commit `GENERATOR_SHARED_SECRET` or `AUTODL_TOKEN`.

## Run

```powershell
python server.py
```

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8791/health
```
