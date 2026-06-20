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
    order_id = job["orderId"]
    headers = auth_headers()
    workdir = Path(tempfile.mkdtemp(prefix=f"desktop-pet-{order_id}-"))

    try:
        post_json(job["callbackUrl"], {"status": "generating"}, headers)
        order = {
            "orderId": order_id,
            "productTier": job.get("productTier"),
            "species": job.get("species"),
            "petName": "",
            "callbackUrl": job["callbackUrl"],
            "artifactsUrl": job["artifactsUrl"],
        }
        source_files = []

        post_json(job["callbackUrl"], {"status": "packaging"}, headers)

        preview_path = workdir / "preview.png"
        preview_path.write_bytes(base64.b64decode(MOCK_PREVIEW_PNG_BASE64))

        manifest = {
            "version": 1,
            "orderId": order_id,
            "productTier": order.get("productTier"),
            "species": order.get("species"),
            "petName": order.get("petName"),
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "mode": "python-mock",
            "assets": {
                "preview": "preview.png",
                "images": ["images/base_pet.png"],
            },
            "notes": "Python mock package. Replace process_job with ComfyUI calls for production generation.",
        }

        package_path = workdir / "pet_package.zip"
        create_package(package_path, manifest, preview_path, source_files)
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


def download(url, output_path, headers):
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=120) as response:
        output_path.write_bytes(response.read())


def create_package(package_path, manifest, preview_path, source_files):
    with zipfile.ZipFile(package_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps(manifest, indent=2))
        archive.write(preview_path, "preview.png")
        archive.write(preview_path, "images/base_pet.png")
        for index, source_path in enumerate(source_files):
            suffix = source_path.suffix or ".bin"
            archive.write(source_path, f"source/source-{index}{suffix}")


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
    if not SHARED_SECRET:
        return {}
    return {"authorization": f"Bearer {SHARED_SECRET}"}


def guess_extension(url):
    path = urllib.parse.urlparse(url).path
    ext = Path(path).suffix.lower()
    if ext in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bin"}:
        return ext
    guessed = mimetypes.guess_extension(mimetypes.guess_type(path)[0] or "")
    return guessed or ".bin"


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
