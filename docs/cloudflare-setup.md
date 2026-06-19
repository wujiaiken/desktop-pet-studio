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

前端需要设置环境变量：

```text
NEXT_PUBLIC_PET_API_BASE=https://你的-worker-域名
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
orders/<orderId>/package/pet_package.zip
```

## 3. Worker

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

## 4. 当前 MVP 验证

Worker 部署后可以先验证半条链路：

```text
/upload 创建订单
→ 上传照片到 R2
→ 点击生成，订单进入 queued
→ 页面轮询状态
```

这时还不会真正调用 AutoDL。等我们导出 ComfyUI API workflow 后，再配置：

```text
GENERATOR_WEBHOOK_URL=https://你的外部生成worker/jobs
GENERATOR_SHARED_SECRET=一段长随机密钥
```

然后由外部生成 worker 负责：

```text
拉取 R2 原图
→ 调 AutoDL ComfyUI
→ 打包 pet_package.zip
→ 上传给 Worker 的 /api/worker/orders/:orderId/artifacts
→ Worker 写入 R2 并把订单置为 ready
```
