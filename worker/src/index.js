const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
};

const ORDER_STATUS = {
  CREATED: "created",
  PHOTOS_UPLOADED: "photos_uploaded",
  QUEUED: "queued",
  GENERATING: "generating",
  PACKAGING: "packaging",
  READY: "ready",
  FAILED: "failed",
};

const worker = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return corsResponse(request, env, null, { status: 204 });
    }

    try {
      const url = new URL(request.url);
      const route = matchRoute(url.pathname);

      if (!route) {
        return json(request, env, { ok: false, error: "not_found" }, 404);
      }

      if (route.name === "createOrder" && request.method === "POST") {
        return createOrder(request, env);
      }

      if (route.name === "getOrder" && request.method === "GET") {
        return getOrder(request, env, route.params.orderId);
      }

      if (route.name === "uploadPhoto" && request.method === "POST") {
        return uploadPhoto(request, env, route.params.orderId);
      }

      if (route.name === "generate" && request.method === "POST") {
        return generate(request, env, route.params.orderId);
      }

      if (route.name === "download" && request.method === "GET") {
        return downloadPackage(request, env, route.params.orderId);
      }

      if (route.name === "workerCallback" && request.method === "POST") {
        return workerCallback(request, env, route.params.orderId);
      }

      if (route.name === "workerJob" && request.method === "GET") {
        return workerJob(request, env, route.params.orderId);
      }

      if (route.name === "workerSource" && request.method === "GET") {
        return workerSource(request, env, route.params.orderId, route.params.index);
      }

      if (route.name === "workerArtifacts" && request.method === "POST") {
        return workerArtifacts(request, env, route.params.orderId);
      }

      return json(request, env, { ok: false, error: "method_not_allowed" }, 405);
    } catch (error) {
      return json(
        request,
        env,
        {
          ok: false,
          error: "internal_error",
          message: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
};

export default worker;

function matchRoute(pathname) {
  if (pathname === "/api/orders") {
    return { name: "createOrder", params: {} };
  }

  let match = pathname.match(/^\/api\/orders\/([^/]+)$/);
  if (match) {
    return { name: "getOrder", params: { orderId: match[1] } };
  }

  match = pathname.match(/^\/api\/orders\/([^/]+)\/photos$/);
  if (match) {
    return { name: "uploadPhoto", params: { orderId: match[1] } };
  }

  match = pathname.match(/^\/api\/orders\/([^/]+)\/generate$/);
  if (match) {
    return { name: "generate", params: { orderId: match[1] } };
  }

  match = pathname.match(/^\/api\/orders\/([^/]+)\/download$/);
  if (match) {
    return { name: "download", params: { orderId: match[1] } };
  }

  match = pathname.match(/^\/api\/worker\/orders\/([^/]+)\/callback$/);
  if (match) {
    return { name: "workerCallback", params: { orderId: match[1] } };
  }

  match = pathname.match(/^\/api\/worker\/orders\/([^/]+)\/job$/);
  if (match) {
    return { name: "workerJob", params: { orderId: match[1] } };
  }

  match = pathname.match(/^\/api\/worker\/orders\/([^/]+)\/source\/(\d+)$/);
  if (match) {
    return { name: "workerSource", params: { orderId: match[1], index: Number(match[2]) } };
  }

  match = pathname.match(/^\/api\/worker\/orders\/([^/]+)\/artifacts$/);
  if (match) {
    return { name: "workerArtifacts", params: { orderId: match[1] } };
  }

  return null;
}

async function createOrder(request, env) {
  const body = await readJson(request);
  const now = new Date().toISOString();
  const orderId = createId("ord");
  const productTier = body.productTier === "deluxe_69" ? "deluxe_69" : "starter_29";

  const order = {
    version: 1,
    orderId,
    status: ORDER_STATUS.CREATED,
    productTier,
    customerName: normalizeString(body.customerName, 80),
    petName: normalizeString(body.petName, 80),
    species: body.species === "dog" ? "dog" : "cat",
    notes: normalizeString(body.notes, 600),
    photoKeys: [],
    previewKey: null,
    packageKey: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };

  await putOrder(env, order);
  return json(request, env, { ok: true, order });
}

async function getOrder(request, env, orderId) {
  const order = await requireOrder(env, orderId);
  return json(request, env, {
    ok: true,
    order: publicOrder(order),
  });
}

async function uploadPhoto(request, env, orderId) {
  const order = await requireOrder(env, orderId);
  const contentType = request.headers.get("content-type") || "";

  if (isAllowedImageType(contentType)) {
    const extension = extensionFromContentType(contentType);
    const key = `orders/${orderId}/source/${createId("photo")}${extension}`;
    await env.PET_ASSETS.put(key, await request.arrayBuffer(), {
      httpMetadata: {
        contentType,
      },
      customMetadata: {
        originalName: normalizeString(request.headers.get("x-file-name") || "photo", 120),
        orderId,
      },
    });

    order.photoKeys = [...order.photoKeys, key];
    order.status = ORDER_STATUS.PHOTOS_UPLOADED;
    order.updatedAt = new Date().toISOString();
    await putOrder(env, order);

    return json(request, env, {
      ok: true,
      order: publicOrder(order),
      uploaded: [key],
    });
  }

  if (!contentType.includes("multipart/form-data")) {
    return json(request, env, { ok: false, error: "expected_multipart_form_data" }, 400);
  }

  const form = await request.formData();
  const files = form.getAll("photos").filter(isFileLike);

  if (!files.length) {
    const single = form.get("photo");
    if (isFileLike(single)) {
      files.push(single);
    }
  }

  if (!files.length) {
    return json(request, env, { ok: false, error: "missing_photo" }, 400);
  }

  const uploaded = [];
  for (const file of files.slice(0, 6)) {
    if (!isAllowedImage(file)) {
      return json(request, env, { ok: false, error: "unsupported_image_type" }, 400);
    }

    const extension = extensionFromFile(file);
    const key = `orders/${orderId}/source/${createId("photo")}${extension}`;
    await env.PET_ASSETS.put(key, await file.arrayBuffer(), {
      httpMetadata: {
        contentType: file.type || "application/octet-stream",
      },
      customMetadata: {
        originalName: file.name || "photo",
        orderId,
      },
    });
    uploaded.push(key);
  }

  order.photoKeys = [...order.photoKeys, ...uploaded];
  order.status = ORDER_STATUS.PHOTOS_UPLOADED;
  order.updatedAt = new Date().toISOString();
  await putOrder(env, order);

  return json(request, env, {
    ok: true,
    order: publicOrder(order),
    uploaded,
  });
}

async function generate(request, env, orderId) {
  const order = await requireOrder(env, orderId);

  if (!order.photoKeys.length) {
    return json(request, env, { ok: false, error: "missing_uploaded_photos" }, 409);
  }

  order.status = ORDER_STATUS.QUEUED;
  order.error = null;
  order.updatedAt = new Date().toISOString();
  await putOrder(env, order);

  if (env.GENERATOR_WEBHOOK_URL) {
    const origin = new URL(request.url).origin;
    const jobUrl = new URL(`/api/worker/orders/${orderId}/job`, origin).toString();
    const callbackUrl = new URL(`/api/worker/orders/${orderId}/callback`, origin).toString();
    const artifactsUrl = new URL(`/api/worker/orders/${orderId}/artifacts`, origin).toString();

    await fetch(env.GENERATOR_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(env.GENERATOR_SHARED_SECRET
          ? { authorization: `Bearer ${env.GENERATOR_SHARED_SECRET}` }
          : {}),
      },
      body: JSON.stringify({
        orderId,
        productTier: order.productTier,
        species: order.species,
        photoKeys: order.photoKeys,
        jobUrl,
        callbackUrl,
        artifactsUrl,
      }),
    });
  }

  return json(request, env, {
    ok: true,
    order: publicOrder(order),
    next: env.GENERATOR_WEBHOOK_URL
      ? "generator_webhook_dispatched"
      : "configure_GENERATOR_WEBHOOK_URL_to_start_real_generation",
  });
}

async function downloadPackage(request, env, orderId) {
  const order = await requireOrder(env, orderId);

  if (order.status !== ORDER_STATUS.READY || !order.packageKey) {
    return json(request, env, { ok: false, error: "package_not_ready" }, 409);
  }

  const object = await env.PET_ASSETS.get(order.packageKey);
  if (!object) {
    return json(request, env, { ok: false, error: "package_missing" }, 404);
  }

  return corsResponse(
    request,
    env,
    object.body,
    {
      status: 200,
      headers: {
        "content-type": object.httpMetadata?.contentType || "application/zip",
        "content-disposition": `attachment; filename="${order.orderId}.pet-package.zip"`,
        "cache-control": "private, max-age=60",
      },
    },
  );
}

async function workerCallback(request, env, orderId) {
  const authResponse = authorizeGenerator(request, env);
  if (authResponse) return authResponse;

  const order = await requireOrder(env, orderId);
  const body = await readJson(request);
  const now = new Date().toISOString();

  if (body.status === ORDER_STATUS.FAILED) {
    order.status = ORDER_STATUS.FAILED;
    order.error = normalizeString(body.error || "generation_failed", 500);
  } else if (body.status === ORDER_STATUS.GENERATING || body.status === ORDER_STATUS.PACKAGING) {
    order.status = body.status;
  } else if (body.status === ORDER_STATUS.READY) {
    if (!body.packageKey) {
      return json(request, env, { ok: false, error: "missing_package_key" }, 400);
    }
    order.status = ORDER_STATUS.READY;
    order.packageKey = body.packageKey;
    order.previewKey = body.previewKey || order.previewKey;
    order.error = null;
  } else {
    return json(request, env, { ok: false, error: "unsupported_status" }, 400);
  }

  order.updatedAt = now;
  await putOrder(env, order);
  return json(request, env, { ok: true, order: publicOrder(order) });
}

async function workerJob(request, env, orderId) {
  const authResponse = authorizeGenerator(request, env);
  if (authResponse) return authResponse;

  const order = await requireOrder(env, orderId);
  const origin = new URL(request.url).origin;

  return json(request, env, {
    ok: true,
    order: {
      ...publicOrder(order),
      customerName: order.customerName,
      notes: order.notes,
      sourceImages: order.photoKeys.map((key, index) => ({
        index,
        key,
        url: new URL(`/api/worker/orders/${orderId}/source/${index}`, origin).toString(),
      })),
      callbackUrl: new URL(`/api/worker/orders/${orderId}/callback`, origin).toString(),
      artifactsUrl: new URL(`/api/worker/orders/${orderId}/artifacts`, origin).toString(),
    },
  });
}

async function workerSource(request, env, orderId, index) {
  const authResponse = authorizeGenerator(request, env);
  if (authResponse) return authResponse;

  const order = await requireOrder(env, orderId);
  const key = order.photoKeys[index];

  if (!key) {
    return json(request, env, { ok: false, error: "source_not_found" }, 404);
  }

  const object = await env.PET_ASSETS.get(key);
  if (!object) {
    return json(request, env, { ok: false, error: "source_missing" }, 404);
  }

  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType || "application/octet-stream",
      "cache-control": "private, max-age=60",
    },
  });
}

async function workerArtifacts(request, env, orderId) {
  const authResponse = authorizeGenerator(request, env);
  if (authResponse) return authResponse;

  const order = await requireOrder(env, orderId);
  const contentType = request.headers.get("content-type") || "";

  if (!contentType.includes("multipart/form-data")) {
    return json(request, env, { ok: false, error: "expected_multipart_form_data" }, 400);
  }

  const form = await request.formData();
  const packageFile = form.get("package");
  const previewFile = form.get("preview");
  const manifestFile = form.get("manifest");
  const now = new Date().toISOString();

  if (!isFileLike(packageFile)) {
    return json(request, env, { ok: false, error: "missing_package" }, 400);
  }

  const packageKey = `orders/${orderId}/package/pet_package.zip`;
  await env.PET_ASSETS.put(packageKey, await packageFile.arrayBuffer(), {
    httpMetadata: {
      contentType: packageFile.type || "application/zip",
    },
    customMetadata: {
      orderId,
      artifact: "package",
    },
  });

  if (isFileLike(previewFile)) {
    order.previewKey = `orders/${orderId}/preview.png`;
    await env.PET_ASSETS.put(order.previewKey, await previewFile.arrayBuffer(), {
      httpMetadata: {
        contentType: previewFile.type || "image/png",
      },
      customMetadata: {
        orderId,
        artifact: "preview",
      },
    });
  }

  if (isFileLike(manifestFile)) {
    await env.PET_ASSETS.put(`orders/${orderId}/package/manifest.json`, await manifestFile.arrayBuffer(), {
      httpMetadata: {
        contentType: manifestFile.type || "application/json; charset=utf-8",
      },
      customMetadata: {
        orderId,
        artifact: "manifest",
      },
    });
  }

  order.status = ORDER_STATUS.READY;
  order.packageKey = packageKey;
  order.error = null;
  order.updatedAt = now;
  await putOrder(env, order);

  return json(request, env, {
    ok: true,
    order: publicOrder(order),
    packageKey,
    previewKey: order.previewKey,
  });
}

async function requireOrder(env, orderId) {
  const object = await env.PET_ASSETS.get(orderKey(orderId));
  if (!object) {
    const error = new Error("order_not_found");
    error.status = 404;
    throw error;
  }
  return object.json();
}

async function putOrder(env, order) {
  await env.PET_ASSETS.put(orderKey(order.orderId), JSON.stringify(order, null, 2), {
    httpMetadata: {
      contentType: "application/json; charset=utf-8",
    },
  });
}

function orderKey(orderId) {
  return `orders/${orderId}/order.json`;
}

function publicOrder(order) {
  return {
    orderId: order.orderId,
    status: order.status,
    productTier: order.productTier,
    petName: order.petName,
    species: order.species,
    photoCount: order.photoKeys.length,
    hasPreview: Boolean(order.previewKey),
    hasPackage: Boolean(order.packageKey),
    error: order.error,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

async function readJson(request) {
  if (!request.body) {
    return {};
  }
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return {};
  }
  return request.json();
}

function normalizeString(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, maxLength);
}

function isAllowedImage(file) {
  return isAllowedImageType(file.type);
}

function isFileLike(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.stream === "function" &&
    typeof value.name === "string"
  );
}

function extensionFromFile(file) {
  return extensionFromContentType(file.type);
}

function isAllowedImageType(type) {
  return ["image/jpeg", "image/png", "image/webp"].includes(type.split(";")[0].trim());
}

function extensionFromContentType(type) {
  const cleanType = type.split(";")[0].trim();
  if (cleanType === "image/png") return ".png";
  if (cleanType === "image/webp") return ".webp";
  return ".jpg";
}

function createId(prefix) {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const value = [...bytes].map((item) => item.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${value}`;
}

function authorizeGenerator(request, env) {
  const expected = env.GENERATOR_SHARED_SECRET;
  if (!expected) {
    return null;
  }

  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (token === expected) {
    return null;
  }

  return json(request, env, { ok: false, error: "unauthorized" }, 401);
}

function json(request, env, payload, status = 200) {
  return corsResponse(request, env, JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

function corsResponse(request, env, body, init = {}) {
  const headers = new Headers(init.headers || {});
  const origin = request.headers.get("origin") || "";
  const allowedOrigins = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (allowedOrigins.includes(origin)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("vary", "Origin");
  }

  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set("access-control-allow-headers", "content-type,authorization");

  return new Response(body, {
    ...init,
    headers,
  });
}
