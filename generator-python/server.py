import base64
import json
import mimetypes
import os
import tempfile
import threading
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urljoin


MOCK_PREVIEW_PNG_BASE64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
)


def load_env():
    env_path = Path(__file__).with_name(".env")
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


load_env()

PORT = int(os.environ.get("PORT", "8789"))
SHARED_SECRET = os.environ.get("GENERATOR_SHARED_SECRET", "")
GENERATOR_MODE = os.environ.get("GENERATOR_MODE", "mock").strip().lower()

AUTODL_API_BASE = os.environ.get("AUTODL_API_BASE", "https://www.autodl.art").rstrip("/")
AUTODL_TOKEN = os.environ.get("AUTODL_TOKEN", "")
AUTODL_INSTANCE_UUID = os.environ.get("AUTODL_INSTANCE_UUID", "")
AUTODL_PANEL_BASE = os.environ.get("AUTODL_PANEL_BASE", "").rstrip("/")
AUTODL_WORKFLOW_ID = os.environ.get("AUTODL_WORKFLOW_ID", "desktop_pet_base_angles_v1")
AUTODL_INPUT_IMAGE_KEY = os.environ.get("AUTODL_INPUT_IMAGE_KEY", "25:image")
AUTODL_START_COMFY = os.environ.get("AUTODL_START_COMFY", "0").strip().lower() in {"1", "true", "yes"}
AUTODL_POWER_MANAGEMENT = os.environ.get("AUTODL_POWER_MANAGEMENT", "1").strip().lower() not in {"0", "false", "no"}
AUTODL_WAIT_TIMEOUT_SECONDS = int(os.environ.get("AUTODL_WAIT_TIMEOUT_SECONDS", "900"))
AUTODL_RESULT_TIMEOUT_SECONDS = int(os.environ.get("AUTODL_RESULT_TIMEOUT_SECONDS", "1800"))
AUTODL_POLL_SECONDS = float(os.environ.get("AUTODL_POLL_SECONDS", "3"))
AUTODL_IDLE_SHUTDOWN_SECONDS = int(os.environ.get("AUTODL_IDLE_SHUTDOWN_SECONDS", "600"))

jobs_lock = threading.Lock()
active_jobs = 0
shutdown_timer = None


class Handler(BaseHTTPRequestHandler):
    server_version = "DesktopPetPythonGenerator/0.1"

    def do_GET(self):
        if self.path == "/health":
            return self.send_json(200, {"ok": True})
        if self.path.startswith("/debug/fetch"):
            return self.debug_fetch()
        return self.send_json(404, {"ok": False, "error": "not_found"})

    def do_POST(self):
        if self.path != "/jobs":
            return self.send_json(404, {"ok": False, "error": "not_found"})

        if not self.authorized():
            return self.send_json(401, {"ok": False, "error": "unauthorized"})

        try:
            length = int(self.headers.get("content-length", "0"))
            body = self.rfile.read(length).decode("utf-8")
            job = json.loads(body or "{}")
        except Exception:
            return self.send_json(400, {"ok": False, "error": "invalid_json"})

        if not job.get("orderId") or not job.get("jobUrl"):
            return self.send_json(400, {"ok": False, "error": "missing_job_payload"})

        threading.Thread(target=process_job, args=(job,), daemon=True).start()
        return self.send_json(202, {"ok": True, "accepted": True, "orderId": job["orderId"]})

    def authorized(self):
        if not SHARED_SECRET:
            return True
        header = self.headers.get("authorization", "")
        return header == f"Bearer {SHARED_SECRET}"

    def debug_fetch(self):
        if not self.authorized():
            return self.send_json(401, {"ok": False, "error": "unauthorized"})

        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        url = params.get("url", [""])[0]
        if not url:
            return self.send_json(400, {"ok": False, "error": "missing_url"})

        try:
            request = urllib.request.Request(url, headers=auth_headers())
            with urllib.request.urlopen(request, timeout=20) as response:
                body = response.read(1000).decode("utf-8", errors="replace")
                return self.send_json(
                    200,
                    {
                        "ok": True,
                        "status": response.status,
                        "body": body,
                    },
                )
        except Exception as error:
            return self.send_json(
                200,
                {
                    "ok": False,
                    "error": str(error),
                    "type": type(error).__name__,
                },
            )

    def send_json(self, status, payload):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        print(f"{time.strftime('%Y-%m-%d %H:%M:%S')} {self.address_string()} {fmt % args}", flush=True)


def process_job(job):
    global active_jobs
    order_id = job["orderId"]
    headers = auth_headers()
    workdir = Path(tempfile.mkdtemp(prefix=f"desktop-pet-{order_id}-"))

    mark_job_started()

    try:
        post_json(job["callbackUrl"], {"status": "generating"}, headers)
        if GENERATOR_MODE == "autodl":
            package_path, preview_path, manifest = build_autodl_package(job, workdir, headers)
        else:
            package_path, preview_path, manifest = build_mock_package(job, workdir)

        post_json(job["callbackUrl"], {"status": "packaging"}, headers)
        upload_artifacts(job["artifactsUrl"], package_path, preview_path, manifest, headers)
        print(f"job_ready {order_id}", flush=True)
    except Exception as error:
        print(f"job_failed {order_id} {error}", flush=True)
        traceback.print_exc()
        try:
            post_json(job["callbackUrl"], {"status": "failed", "error": str(error)}, headers)
        except Exception:
            traceback.print_exc()
    finally:
        cleanup(workdir)
        mark_job_finished()


def build_mock_package(job, workdir):
    order_id = job["orderId"]
    preview_path = workdir / "preview.png"
    preview_path.write_bytes(base64.b64decode(MOCK_PREVIEW_PNG_BASE64))

    manifest = {
        "version": 1,
        "orderId": order_id,
        "productTier": job.get("productTier"),
        "species": job.get("species"),
        "petName": "",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "mode": "python-mock",
        "assets": {
            "preview": "preview.png",
            "images": ["images/base_pet.png"],
        },
        "notes": "Python mock package. Set GENERATOR_MODE=autodl to run the AutoDL ComfyUI workflow.",
    }

    package_path = workdir / "pet_package.zip"
    create_package(package_path, manifest, preview_path, [], [])
    return package_path, preview_path, manifest


def build_autodl_package(job, workdir, headers):
    require_autodl_config()

    order_id = job["orderId"]
    ensure_autodl_ready()

    job_detail = get_json(job["jobUrl"], headers)
    source_images = ((job_detail.get("order") or {}).get("sourceImages")) or []
    if not source_images:
        raise RuntimeError("order_has_no_source_images")

    source_paths = download_source_images(source_images, workdir, headers)
    source_data_url = image_to_data_url(source_paths[0])
    prompt_id = submit_autodl_workflow(source_data_url, order_id)
    results = wait_for_autodl_result(prompt_id)
    generated_paths = download_autodl_results(results, workdir)

    if not generated_paths:
        raise RuntimeError("autodl_workflow_returned_no_images")

    preview_path = generated_paths[0]
    image_entries = [f"images/{path.name}" for path in generated_paths]
    source_entries = [f"source/source-{index}{path.suffix or '.bin'}" for index, path in enumerate(source_paths)]
    manifest = {
        "version": 1,
        "orderId": order_id,
        "productTier": job.get("productTier"),
        "species": job.get("species"),
        "petName": "",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "mode": "autodl-comfyui",
        "autodl": {
            "workflowId": AUTODL_WORKFLOW_ID,
            "promptId": prompt_id,
            "panelBase": AUTODL_PANEL_BASE,
        },
        "assets": {
            "preview": "preview.png",
            "images": image_entries,
            "source": source_entries,
        },
        "results": [
            {
                "type": item.get("type"),
                "url": item.get("url"),
                "filename": item.get("filename") or (item.get("raw") or {}).get("filename"),
            }
            for item in results
        ],
    }

    package_path = workdir / "pet_package.zip"
    create_package(package_path, manifest, preview_path, source_paths, generated_paths)
    return package_path, preview_path, manifest


def get_json(url, headers):
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def post_json(url, payload, headers):
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={**headers, "content-type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def post_json_timeout(url, payload, headers, timeout=60):
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={**headers, "content-type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def download(url, output_path, headers):
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=120) as response:
        output_path.write_bytes(response.read())


def download_source(url, output_path, headers):
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=120) as response:
        data = response.read()
        content_type = response.headers.get("content-type", "")
    suffix = extension_from_content_type(content_type) or output_path.suffix or ".bin"
    final_path = output_path.with_suffix(suffix)
    final_path.write_bytes(data)
    return final_path


def download_bytes(url, headers=None, timeout=120):
    request = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def create_package(package_path, manifest, preview_path, source_files, generated_files=None):
    generated_files = generated_files or []
    with zipfile.ZipFile(package_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps(manifest, indent=2))
        archive.write(preview_path, "preview.png")
        if generated_files:
            for generated_path in generated_files:
                archive.write(generated_path, f"images/{generated_path.name}")
        else:
            archive.write(preview_path, "images/base_pet.png")
        for index, source_path in enumerate(source_files):
            suffix = source_path.suffix or ".bin"
            archive.write(source_path, f"source/source-{index}{suffix}")


def require_autodl_config():
    missing = []
    if not AUTODL_PANEL_BASE:
        missing.append("AUTODL_PANEL_BASE")
    if not AUTODL_WORKFLOW_ID:
        missing.append("AUTODL_WORKFLOW_ID")
    if not AUTODL_INPUT_IMAGE_KEY:
        missing.append("AUTODL_INPUT_IMAGE_KEY")
    if AUTODL_POWER_MANAGEMENT and not AUTODL_TOKEN:
        missing.append("AUTODL_TOKEN")
    if AUTODL_POWER_MANAGEMENT and not AUTODL_INSTANCE_UUID:
        missing.append("AUTODL_INSTANCE_UUID")
    if missing:
        raise RuntimeError(f"missing_autodl_config: {', '.join(missing)}")


def ensure_autodl_ready():
    if AUTODL_POWER_MANAGEMENT:
        power_on_autodl()

    wait_for_panel()

    if AUTODL_START_COMFY:
        start_comfy()

    wait_for_comfy()


def power_on_autodl():
    url = f"{AUTODL_API_BASE}/api/v1/adl_dev/dev/instance/pro/power_on"
    payload = {"instance_uuid": AUTODL_INSTANCE_UUID, "payload": "gpu"}
    headers = autodl_api_headers()
    try:
        data = post_json_timeout(url, payload, headers, timeout=60)
        print(f"autodl_power_on {AUTODL_INSTANCE_UUID} {compact_json(data)}", flush=True)
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        if error.code not in {400, 409}:
            raise RuntimeError(f"autodl_power_on_failed_http_{error.code}: {body}") from error
        print(f"autodl_power_on_nonfatal_http_{error.code} {body}", flush=True)


def power_off_autodl():
    if not (AUTODL_POWER_MANAGEMENT and AUTODL_TOKEN and AUTODL_INSTANCE_UUID):
        return
    url = f"{AUTODL_API_BASE}/api/v1/adl_dev/dev/instance/pro/power_off"
    payload = {"instance_uuid": AUTODL_INSTANCE_UUID}
    try:
        data = post_json_timeout(url, payload, autodl_api_headers(), timeout=60)
        print(f"autodl_power_off {AUTODL_INSTANCE_UUID} {compact_json(data)}", flush=True)
    except Exception as error:
        print(f"autodl_power_off_failed {error}", flush=True)


def autodl_api_headers():
    return {
        "authorization": AUTODL_TOKEN,
        "user-agent": "DesktopPetGenerator/0.1",
    }


def wait_for_panel():
    deadline = time.time() + AUTODL_WAIT_TIMEOUT_SECONDS
    last_error = None
    while time.time() < deadline:
        try:
            data = get_json(f"{AUTODL_PANEL_BASE}/api/workflow/list", panel_headers())
            workflows = data.get("workflows") or []
            workflow_ids = {item.get("id") for item in workflows}
            if data.get("success") and AUTODL_WORKFLOW_ID in workflow_ids:
                return data
        except Exception as error:
            last_error = error
        time.sleep(5)
    raise RuntimeError(f"autodl_panel_not_ready_or_workflow_missing: {last_error}")


def start_comfy():
    try:
        data = post_json_timeout(f"{AUTODL_PANEL_BASE}/api/comfy/start", {}, panel_headers(), timeout=60)
        print(f"autodl_comfy_start {compact_json(data)}", flush=True)
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        if error.code not in {400, 409}:
            raise RuntimeError(f"autodl_comfy_start_failed_http_{error.code}: {body}") from error
        print(f"autodl_comfy_start_nonfatal_http_{error.code} {body}", flush=True)


def wait_for_comfy():
    deadline = time.time() + AUTODL_WAIT_TIMEOUT_SECONDS
    last_error = None
    status_urls = [
        f"{AUTODL_PANEL_BASE}/api/comfy/status",
        f"{AUTODL_PANEL_BASE}/api/comfy/proxy/system_stats",
        f"{AUTODL_PANEL_BASE}/system_stats",
    ]
    while time.time() < deadline:
        for url in status_urls:
            try:
                data = get_json(url, panel_headers())
                if data:
                    return data
            except Exception as error:
                last_error = error
        time.sleep(5)
    raise RuntimeError(f"autodl_comfy_not_ready: {last_error}")


def download_source_images(source_images, workdir, headers):
    paths = []
    for source in source_images:
        index = source.get("index", len(paths))
        url = source.get("url")
        if not url:
            continue
        path = workdir / f"source-{index}{guess_extension(url)}"
        paths.append(download_source(url, path, headers))
    return paths


def image_to_data_url(path):
    content_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{content_type};base64,{data}"


def submit_autodl_workflow(image_data_url, order_id):
    payload = {
        "workflow_id": AUTODL_WORKFLOW_ID,
        "input_values": {
            AUTODL_INPUT_IMAGE_KEY: image_data_url,
        },
        "client_id": f"desktop-pet-{order_id}",
    }
    url = f"{AUTODL_PANEL_BASE}/api/workflow/generate"
    deadline = time.time() + min(AUTODL_WAIT_TIMEOUT_SECONDS, 600)
    attempt = 0
    last_error = None

    while time.time() < deadline:
        attempt += 1
        try:
            data = post_json_timeout(url, payload, panel_headers(), timeout=120)
            if data.get("success") and data.get("prompt_id"):
                print(f"autodl_prompt {order_id} {data['prompt_id']} attempt={attempt}", flush=True)
                return data["prompt_id"]
            last_error = f"response={compact_json(data)}"
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            last_error = f"http_{error.code}: {body[:1000]}"
            if error.code < 500:
                raise RuntimeError(f"autodl_workflow_submit_failed: {last_error}") from error
        except Exception as error:
            last_error = f"{type(error).__name__}: {error}"

        print(f"autodl_submit_retry {order_id} attempt={attempt} error={last_error}", flush=True)
        time.sleep(10)

    raise RuntimeError(f"autodl_workflow_submit_timeout: {last_error}")


def wait_for_autodl_result(prompt_id):
    deadline = time.time() + AUTODL_RESULT_TIMEOUT_SECONDS
    last_data = None
    while time.time() < deadline:
        data = get_json(
            f"{AUTODL_PANEL_BASE}/api/workflow/result?prompt_id={urllib.parse.quote(prompt_id)}",
            panel_headers(),
        )
        last_data = data
        if data.get("success") and data.get("pending") is False:
            return [
                item
                for item in data.get("results", [])
                if item.get("type") == "image"
                and item.get("url")
                and ((item.get("raw") or {}).get("type") == "output" or item.get("url", "").startswith("/output/"))
            ]
        if data.get("success") is False:
            raise RuntimeError(f"autodl_workflow_result_failed: {compact_json(data)}")
        time.sleep(AUTODL_POLL_SECONDS)
    raise RuntimeError(f"autodl_workflow_timeout: {compact_json(last_data)}")


def download_autodl_results(results, workdir):
    output_dir = workdir / "autodl-output"
    output_dir.mkdir(exist_ok=True)
    paths = []
    for index, item in enumerate(results):
        url = item.get("url")
        if not url:
            continue
        full_url = urljoin(f"{AUTODL_PANEL_BASE}/", url)
        raw = item.get("raw") or {}
        filename = item.get("filename") or raw.get("filename") or f"result-{index}.png"
        safe_name = safe_filename(filename, f"result-{index}.png")
        if not Path(safe_name).suffix:
            safe_name = f"{safe_name}.png"
        path = output_dir / safe_name
        path.write_bytes(download_bytes(full_url, panel_headers(), timeout=180))
        paths.append(path)
    return paths


def panel_headers():
    return {"user-agent": "DesktopPetGenerator/0.1"}


def safe_filename(value, fallback):
    keep = []
    for char in str(value):
        if char.isalnum() or char in {"-", "_", "."}:
            keep.append(char)
        else:
            keep.append("_")
    name = "".join(keep).strip("._")
    return name or fallback


def compact_json(value):
    try:
        return json.dumps(value, ensure_ascii=True, separators=(",", ":"))[:1000]
    except Exception:
        return str(value)[:1000]


def mark_job_started():
    global active_jobs, shutdown_timer
    with jobs_lock:
        active_jobs += 1
        if shutdown_timer:
            shutdown_timer.cancel()
            shutdown_timer = None


def mark_job_finished():
    global active_jobs, shutdown_timer
    with jobs_lock:
        active_jobs = max(0, active_jobs - 1)
        if active_jobs == 0 and GENERATOR_MODE == "autodl" and AUTODL_IDLE_SHUTDOWN_SECONDS >= 0:
            shutdown_timer = threading.Timer(AUTODL_IDLE_SHUTDOWN_SECONDS, shutdown_if_idle)
            shutdown_timer.daemon = True
            shutdown_timer.start()


def shutdown_if_idle():
    global shutdown_timer
    with jobs_lock:
        if active_jobs != 0:
            return
        shutdown_timer = None
    power_off_autodl()


def upload_artifacts(artifacts_url, package_path, preview_path, manifest, headers):
    boundary = f"----DesktopPet{uuid.uuid4().hex}"
    parts = [
        file_part("package", "pet_package.zip", "application/zip", package_path.read_bytes(), boundary),
        file_part("preview", "preview.png", "image/png", preview_path.read_bytes(), boundary),
        file_part(
            "manifest",
            "manifest.json",
            "application/json; charset=utf-8",
            json.dumps(manifest, indent=2).encode("utf-8"),
            boundary,
        ),
        f"--{boundary}--\r\n".encode("utf-8"),
    ]
    body = b"".join(parts)
    request = urllib.request.Request(
        artifacts_url,
        data=body,
        headers={
            **headers,
            "content-type": f"multipart/form-data; boundary={boundary}",
            "content-length": str(len(body)),
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.loads(response.read().decode("utf-8"))


def file_part(name, filename, content_type, data, boundary):
    head = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'
        f"Content-Type: {content_type}\r\n\r\n"
    ).encode("utf-8")
    return head + data + b"\r\n"


def auth_headers():
    headers = {"user-agent": "DesktopPetGenerator/0.1"}
    if not SHARED_SECRET:
        return headers
    return {**headers, "authorization": f"Bearer {SHARED_SECRET}"}


def guess_extension(url):
    path = urllib.parse.urlparse(url).path
    ext = Path(path).suffix.lower()
    if ext in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bin"}:
        return ext
    guessed = mimetypes.guess_extension(mimetypes.guess_type(path)[0] or "")
    return guessed or ".bin"


def extension_from_content_type(content_type):
    clean_type = content_type.split(";")[0].strip().lower()
    if clean_type == "image/png":
        return ".png"
    if clean_type == "image/jpeg":
        return ".jpg"
    if clean_type == "image/webp":
        return ".webp"
    return mimetypes.guess_extension(clean_type) or ""


def cleanup(path):
    for child in sorted(path.rglob("*"), reverse=True):
        if child.is_file():
            child.unlink(missing_ok=True)
        elif child.is_dir():
            child.rmdir()
    path.rmdir()


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"desktop-pet-python-generator listening on :{PORT}")
    server.serve_forever()
