# Cloudflare 部署步骤

## 1. Pages

当前 Pages 项目：

```text
desktop-pet-studio
```

线上域名：

```text
https://desktop-pet-studio-exu.pages.dev
```

当前生产主链路中，前端和 API 都走 Pages 域名。前端需要设置环境变量：

```text
NEXT_PUBLIC_PET_API_BASE=https://desktop-pet-studio-exu.pages.dev
```

本地开发可复制：

```text
.env.example -> .env.local
```

## 2. R2

创建 bucket：

```text
desktop-pet-assets
```

存储路径约定：

```text
orders/<orderId>/order.json
orders/<orderId>/source/*.jpg
orders/<orderId>/preview.png
orders/<orderId>/package/manifest.json
orders/<orderId>/package/pet_package.zip
```

## 3. Worker

当前生产 API 入口是 Pages Functions `/api/*`。项目根目录的 `functions/api/[[path]].js` 会复用 `worker/src/index.js`，所以客户页面请求的是：

```text
https://desktop-pet-studio-exu.pages.dev/api/*
```

Pages 配置需要绑定同一个 R2 bucket，并设置生成器地址：

```toml
name = "desktop-pet-studio"
pages_build_output_dir = "out"
compatibility_date = "2026-06-19"

[[r2_buckets]]
binding = "PET_ASSETS"
bucket_name = "desktop-pet-assets"

[vars]
ALLOWED_ORIGINS = "https://desktop-pet-studio-exu.pages.dev,http://localhost:3000"
GENERATOR_WEBHOOK_URL = "http://81.68.126.249:8791/jobs"
NEXT_PUBLIC_PET_API_BASE = "https://desktop-pet-studio-exu.pages.dev"
```

独立 Worker 仍可部署作为备用或调试入口：

```bash
cd worker
copy wrangler.toml.example wrangler.toml
npx wrangler deploy
```

需要绑定：

```toml
[[r2_buckets]]
binding = "PET_ASSETS"
bucket_name = "desktop-pet-assets"
```

但 `workers.dev` 曾在腾讯云链路上超时，因此当前生产主入口不依赖独立 Worker 域名。

## 4. 当前生产验证

当前已经跑通的真实链路：

```text
/upload 创建订单
→ 上传照片到 R2
→ 点击生成，Pages Functions 投递到腾讯云 /jobs
→ 腾讯云生成器自动开 AutoDL 应用实例
→ 腾讯云调用 ZEALMAN/ComfyUI API 工作流 desktop_pet_base_angles_v1
→ 腾讯云下载 8 张输出图并打包 pet_package.zip
→ 腾讯云生成器上传 preview.png、manifest.json、pet_package.zip
→ 页面轮询到 ready
→ 客户从 Pages 域名下载 zip
→ 空闲 120 秒后 AutoDL 自动关机
```

当前腾讯云生成器负责：

```text
接收 /jobs
→ 通过私有接口拉取订单和原图
→ 调 AutoDL App API 开机
→ 等待 6008 Control Panel 和 6006 ComfyUI ready
→ 调 ZEALMAN 工作流 API
→ 打包 pet_package.zip
→ 上传给 Worker 的 /api/worker/orders/:orderId/artifacts
→ Worker 写入 R2 并把订单置为 ready
→ 空闲后调 AutoDL App API 关机
```

## 5. 关键坑点

- 当前生产 API base 必须是 `https://desktop-pet-studio-exu.pages.dev`，不要使用 `workers.dev`。
- Pages Functions 需要复用 `worker/src/index.js`，并绑定同一个 `desktop-pet-assets` R2 bucket。
- 腾讯云生成器回调 Pages 时要带 `GENERATOR_SHARED_SECRET` Bearer 鉴权。
- Python 生成器请求 Cloudflare Pages 需要稳定 `User-Agent`，否则可能被 Cloudflare 1010/403 拦截。
- AutoDL/ComfyUI 产物必须回传 R2，不能把 AutoDL `/output/*` 作为客户下载链接。
