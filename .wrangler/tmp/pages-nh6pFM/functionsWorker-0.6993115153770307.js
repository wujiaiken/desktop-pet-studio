var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../worker/src/index.js
import { connect } from "cloudflare:sockets";
var JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8"
};
var ORDER_STATUS = {
  CREATED: "created",
  PHOTOS_UPLOADED: "photos_uploaded",
  QUEUED: "queued",
  GENERATING: "generating",
  PACKAGING: "packaging",
  READY: "ready",
  FAILED: "failed"
};
var worker = {
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
          message: error instanceof Error ? error.message : String(error)
        },
        500
      );
    }
  }
};
var src_default = worker;
function matchRoute(pathname) {
  if (pathname === "/api/orders") {
    return { name: "createOrder", params: {} };
  }
  let match2 = pathname.match(/^\/api\/orders\/([^/]+)$/);
  if (match2) {
    return { name: "getOrder", params: { orderId: match2[1] } };
  }
  match2 = pathname.match(/^\/api\/orders\/([^/]+)\/photos$/);
  if (match2) {
    return { name: "uploadPhoto", params: { orderId: match2[1] } };
  }
  match2 = pathname.match(/^\/api\/orders\/([^/]+)\/generate$/);
  if (match2) {
    return { name: "generate", params: { orderId: match2[1] } };
  }
  match2 = pathname.match(/^\/api\/orders\/([^/]+)\/download$/);
  if (match2) {
    return { name: "download", params: { orderId: match2[1] } };
  }
  match2 = pathname.match(/^\/api\/worker\/orders\/([^/]+)\/callback$/);
  if (match2) {
    return { name: "workerCallback", params: { orderId: match2[1] } };
  }
  match2 = pathname.match(/^\/api\/worker\/orders\/([^/]+)\/job$/);
  if (match2) {
    return { name: "workerJob", params: { orderId: match2[1] } };
  }
  match2 = pathname.match(/^\/api\/worker\/orders\/([^/]+)\/source\/(\d+)$/);
  if (match2) {
    return { name: "workerSource", params: { orderId: match2[1], index: Number(match2[2]) } };
  }
  match2 = pathname.match(/^\/api\/worker\/orders\/([^/]+)\/artifacts$/);
  if (match2) {
    return { name: "workerArtifacts", params: { orderId: match2[1] } };
  }
  return null;
}
__name(matchRoute, "matchRoute");
async function createOrder(request, env) {
  const body = await readJson(request);
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
    updatedAt: now
  };
  await putOrder(env, order);
  return json(request, env, { ok: true, order });
}
__name(createOrder, "createOrder");
async function getOrder(request, env, orderId) {
  const order = await requireOrder(env, orderId);
  return json(request, env, {
    ok: true,
    order: publicOrder(order)
  });
}
__name(getOrder, "getOrder");
async function uploadPhoto(request, env, orderId) {
  const order = await requireOrder(env, orderId);
  const contentType = request.headers.get("content-type") || "";
  if (isAllowedImageType(contentType)) {
    const extension = extensionFromContentType(contentType);
    const key = `orders/${orderId}/source/${createId("photo")}${extension}`;
    await env.PET_ASSETS.put(key, await request.arrayBuffer(), {
      httpMetadata: {
        contentType
      },
      customMetadata: {
        originalName: normalizeString(request.headers.get("x-file-name") || "photo", 120),
        orderId
      }
    });
    order.photoKeys = [...order.photoKeys, key];
    order.status = ORDER_STATUS.PHOTOS_UPLOADED;
    order.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await putOrder(env, order);
    return json(request, env, {
      ok: true,
      order: publicOrder(order),
      uploaded: [key]
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
        contentType: file.type || "application/octet-stream"
      },
      customMetadata: {
        originalName: file.name || "photo",
        orderId
      }
    });
    uploaded.push(key);
  }
  order.photoKeys = [...order.photoKeys, ...uploaded];
  order.status = ORDER_STATUS.PHOTOS_UPLOADED;
  order.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  await putOrder(env, order);
  return json(request, env, {
    ok: true,
    order: publicOrder(order),
    uploaded
  });
}
__name(uploadPhoto, "uploadPhoto");
async function generate(request, env, orderId) {
  const order = await requireOrder(env, orderId);
  if (!order.photoKeys.length) {
    return json(request, env, { ok: false, error: "missing_uploaded_photos" }, 409);
  }
  order.status = ORDER_STATUS.QUEUED;
  order.error = null;
  order.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  await putOrder(env, order);
  if (env.GENERATOR_WEBHOOK_URL) {
    const origin = new URL(request.url).origin;
    const jobUrl = new URL(`/api/worker/orders/${orderId}/job`, origin).toString();
    const callbackUrl = new URL(`/api/worker/orders/${orderId}/callback`, origin).toString();
    const artifactsUrl = new URL(`/api/worker/orders/${orderId}/artifacts`, origin).toString();
    const webhookResponse = await dispatchGeneratorWebhook(env, {
      orderId,
      productTier: order.productTier,
      species: order.species,
      photoKeys: order.photoKeys,
      jobUrl,
      callbackUrl,
      artifactsUrl
    });
    if (!webhookResponse.ok) {
      const errorText = normalizeString(await webhookResponse.text(), 500);
      order.status = ORDER_STATUS.FAILED;
      order.error = normalizeString(
        `generator_webhook_http_${webhookResponse.status}${errorText ? `: ${errorText}` : ""}`,
        500
      );
      order.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      await putOrder(env, order);
      return json(request, env, {
        ok: false,
        error: "generator_webhook_failed",
        webhookStatus: webhookResponse.status,
        webhookBody: errorText,
        order: publicOrder(order)
      }, 502);
    }
  }
  return json(request, env, {
    ok: true,
    order: publicOrder(order),
    next: env.GENERATOR_WEBHOOK_URL ? "generator_webhook_dispatched" : "configure_GENERATOR_WEBHOOK_URL_to_start_real_generation"
  });
}
__name(generate, "generate");
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
        "cache-control": "private, max-age=60"
      }
    }
  );
}
__name(downloadPackage, "downloadPackage");
async function workerCallback(request, env, orderId) {
  const authResponse = authorizeGenerator(request, env);
  if (authResponse) return authResponse;
  const order = await requireOrder(env, orderId);
  const body = await readJson(request);
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
__name(workerCallback, "workerCallback");
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
        url: new URL(`/api/worker/orders/${orderId}/source/${index}`, origin).toString()
      })),
      callbackUrl: new URL(`/api/worker/orders/${orderId}/callback`, origin).toString(),
      artifactsUrl: new URL(`/api/worker/orders/${orderId}/artifacts`, origin).toString()
    }
  });
}
__name(workerJob, "workerJob");
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
      "cache-control": "private, max-age=60"
    }
  });
}
__name(workerSource, "workerSource");
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
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (!isFileLike(packageFile)) {
    return json(request, env, { ok: false, error: "missing_package" }, 400);
  }
  const packageKey = `orders/${orderId}/package/pet_package.zip`;
  await env.PET_ASSETS.put(packageKey, await packageFile.arrayBuffer(), {
    httpMetadata: {
      contentType: packageFile.type || "application/zip"
    },
    customMetadata: {
      orderId,
      artifact: "package"
    }
  });
  if (isFileLike(previewFile)) {
    order.previewKey = `orders/${orderId}/preview.png`;
    await env.PET_ASSETS.put(order.previewKey, await previewFile.arrayBuffer(), {
      httpMetadata: {
        contentType: previewFile.type || "image/png"
      },
      customMetadata: {
        orderId,
        artifact: "preview"
      }
    });
  }
  if (isFileLike(manifestFile)) {
    await env.PET_ASSETS.put(`orders/${orderId}/package/manifest.json`, await manifestFile.arrayBuffer(), {
      httpMetadata: {
        contentType: manifestFile.type || "application/json; charset=utf-8"
      },
      customMetadata: {
        orderId,
        artifact: "manifest"
      }
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
    previewKey: order.previewKey
  });
}
__name(workerArtifacts, "workerArtifacts");
async function requireOrder(env, orderId) {
  const object = await env.PET_ASSETS.get(orderKey(orderId));
  if (!object) {
    const error = new Error("order_not_found");
    error.status = 404;
    throw error;
  }
  return object.json();
}
__name(requireOrder, "requireOrder");
async function putOrder(env, order) {
  await env.PET_ASSETS.put(orderKey(order.orderId), JSON.stringify(order, null, 2), {
    httpMetadata: {
      contentType: "application/json; charset=utf-8"
    }
  });
}
__name(putOrder, "putOrder");
function orderKey(orderId) {
  return `orders/${orderId}/order.json`;
}
__name(orderKey, "orderKey");
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
    updatedAt: order.updatedAt
  };
}
__name(publicOrder, "publicOrder");
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
__name(readJson, "readJson");
function normalizeString(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, maxLength);
}
__name(normalizeString, "normalizeString");
async function dispatchGeneratorWebhook(env, payload) {
  const target = new URL(env.GENERATOR_WEBHOOK_URL);
  const body = JSON.stringify(payload);
  const headers = {
    host: target.host,
    "content-type": "application/json",
    "content-length": new TextEncoder().encode(body).length.toString(),
    connection: "close",
    ...env.GENERATOR_SHARED_SECRET ? { authorization: `Bearer ${env.GENERATOR_SHARED_SECRET}` } : {}
  };
  if (target.protocol === "http:" && isIpHostname(target.hostname)) {
    return httpOverTcp(target, body, headers);
  }
  return fetch(target.toString(), {
    method: "POST",
    headers,
    body
  });
}
__name(dispatchGeneratorWebhook, "dispatchGeneratorWebhook");
async function httpOverTcp(target, body, headers) {
  const socket = connect({
    hostname: target.hostname,
    port: target.port ? Number(target.port) : 80
  });
  const encoder = new TextEncoder();
  const writer = socket.writable.getWriter();
  const headerLines = Object.entries(headers).map(([key, value]) => `${key}: ${value}`).join("\r\n");
  const requestText = `POST ${target.pathname}${target.search} HTTP/1.1\r
${headerLines}\r
\r
` + body;
  await writer.write(encoder.encode(requestText));
  await writer.close();
  const reader = socket.readable.getReader();
  const chunks = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
  } finally {
    reader.releaseLock();
    socket.close();
  }
  const responseText = new TextDecoder().decode(concatChunks(chunks));
  const splitIndex = responseText.indexOf("\r\n\r\n");
  const rawHead = splitIndex >= 0 ? responseText.slice(0, splitIndex) : responseText;
  const rawBody = splitIndex >= 0 ? responseText.slice(splitIndex + 4) : "";
  const [statusLine = "", ...rawHeaderLines] = rawHead.split("\r\n");
  const statusMatch = statusLine.match(/^HTTP\/\d+(?:\.\d+)?\s+(\d+)\s*(.*)$/i);
  const responseHeaders = new Headers();
  for (const line of rawHeaderLines) {
    const index = line.indexOf(":");
    if (index <= 0) continue;
    responseHeaders.append(line.slice(0, index).trim(), line.slice(index + 1).trim());
  }
  return new Response(rawBody, {
    status: statusMatch ? Number(statusMatch[1]) : 520,
    statusText: statusMatch?.[2] || "",
    headers: responseHeaders
  });
}
__name(httpOverTcp, "httpOverTcp");
function concatChunks(chunks) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}
__name(concatChunks, "concatChunks");
function isIpHostname(hostname) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
}
__name(isIpHostname, "isIpHostname");
function isAllowedImage(file) {
  return isAllowedImageType(file.type);
}
__name(isAllowedImage, "isAllowedImage");
function isFileLike(value) {
  return value && typeof value === "object" && typeof value.stream === "function" && typeof value.name === "string";
}
__name(isFileLike, "isFileLike");
function extensionFromFile(file) {
  return extensionFromContentType(file.type);
}
__name(extensionFromFile, "extensionFromFile");
function isAllowedImageType(type) {
  return ["image/jpeg", "image/png", "image/webp"].includes(type.split(";")[0].trim());
}
__name(isAllowedImageType, "isAllowedImageType");
function extensionFromContentType(type) {
  const cleanType = type.split(";")[0].trim();
  if (cleanType === "image/png") return ".png";
  if (cleanType === "image/webp") return ".webp";
  return ".jpg";
}
__name(extensionFromContentType, "extensionFromContentType");
function createId(prefix) {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const value = [...bytes].map((item) => item.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${value}`;
}
__name(createId, "createId");
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
__name(authorizeGenerator, "authorizeGenerator");
function json(request, env, payload, status = 200) {
  return corsResponse(request, env, JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS
  });
}
__name(json, "json");
function corsResponse(request, env, body, init = {}) {
  const headers = new Headers(init.headers || {});
  const origin = request.headers.get("origin") || "";
  const allowedOrigins = String(env.ALLOWED_ORIGINS || "").split(",").map((item) => item.trim()).filter(Boolean);
  if (allowedOrigins.includes(origin)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("vary", "Origin");
  }
  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set("access-control-allow-headers", "content-type,authorization,x-file-name");
  return new Response(body, {
    ...init,
    headers
  });
}
__name(corsResponse, "corsResponse");

// api/[[path]].js
function onRequest(context) {
  return src_default.fetch(context.request, context.env, context);
}
__name(onRequest, "onRequest");

// ../.wrangler/tmp/pages-nh6pFM/functionsRoutes-0.2313775683605941.mjs
var routes = [
  {
    routePath: "/api/:path*",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest]
  }
];

// C:/Users/Administrator/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// C:/Users/Administrator/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
