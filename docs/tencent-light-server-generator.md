# 腾讯云轻量服务器 generator 部署与运维

## 当前服务器情况

当前生产 generator 部署在腾讯云轻量服务器：

```text
系统：Ubuntu 24.04
公网 IP：81.68.126.249
登录用户：ubuntu
generator 目录：/opt/desktop-pet-generator-py
systemd 服务：desktop-pet-generator
公网入口：http://81.68.126.249:8791/jobs
健康检查：http://81.68.126.249:8791/health
```

同一台服务器上还有原有 license/admin 服务：

```text
http://81.68.126.249:5000/admin/login
```

`5000` 已被原有服务占用，桌宠 generator 固定使用 `8791`。

## 当前生产职责

```text
Cloudflare Pages /api/*
  -> POST http://81.68.126.249:8791/jobs
腾讯云 Python generator
  -> 回调 Pages 私有接口更新 generating
  -> 拉取订单和原图
  -> 调 AutoDL App API 开机
  -> 等 ZEALMAN 6008 和 ComfyUI 6006 ready
  -> 调用 API 工作流 desktop_pet_base_angles_v1
  -> 下载 /output/desktop_pet/*.png
  -> 打包 pet_package.zip
  -> 上传 artifacts 到 Pages/R2
  -> 空闲 120 秒后调 AutoDL App API 关机
```

腾讯云只做调度和打包，不跑模型，不长期存储客户下载文件。

## 关键端口和域名

```text
腾讯云 generator: 81.68.126.249:8791
license/admin:     81.68.126.249:5000
Pages/API:         https://desktop-pet-studio-exu.pages.dev
AutoDL API:        https://www.autodl.art
ZEALMAN 6008:      https://uu1056908-7817332b4012.westd.seetacloud.com:8443
ComfyUI 6006:      https://u1056908-7817332b4012.westd.seetacloud.com:8443
```

AutoDL 应用实例：

```text
instance_uuid=pro-7817332b4012
image=zealman-ComfyUI
version=v8.84
GPU=RTX 5090 x1
workflow_id=desktop_pet_base_angles_v1
input key=25:image
```

## 环境变量

`/opt/desktop-pet-generator-py/.env` 当前生产要点：

```text
PORT=8791
GENERATOR_MODE=autodl
AUTODL_API_BASE=https://www.autodl.art
AUTODL_PANEL_BASE=https://uu1056908-7817332b4012.westd.seetacloud.com:8443
AUTODL_WORKFLOW_ID=desktop_pet_base_angles_v1
AUTODL_INPUT_IMAGE_KEY=25:image
AUTODL_INSTANCE_UUID=pro-7817332b4012
AUTODL_POWER_MANAGEMENT=1
AUTODL_START_COMFY=1
AUTODL_IDLE_SHUTDOWN_SECONDS=120
```

不要写入仓库或文档：

```text
GENERATOR_SHARED_SECRET
AUTODL_TOKEN
```

## 常用运维命令

服务状态：

```bash
systemctl is-active desktop-pet-generator
systemctl status desktop-pet-generator --no-pager
```

查看日志：

```bash
journalctl -u desktop-pet-generator -n 100 --no-pager
journalctl -u desktop-pet-generator -f
```

重启服务：

```bash
sudo systemctl restart desktop-pet-generator
```

健康检查：

```bash
curl http://127.0.0.1:8791/health
```

## 当前已验证订单

冷启动自动开关机测试已跑通：

```text
orderId=ord_beac6757d8ff842596ab
prompt_id=d8a17049-4d3f-4898-b402-a53114ab6549
结果：ready
zip：manifest.json + preview.png + 8 张身份图 + source/source-0.png
自动开机：Success
自动关机：Success
```

## 重要坑点

- `workers.dev` 曾在腾讯云和本机访问超时，生产回调和 API base 都必须走 Pages 域名。
- Cloudflare 曾对 Python 默认请求返回 1010/403，生成器必须带稳定 `User-Agent: DesktopPetGenerator/0.1`。
- AutoDL 无法直接访问 Pages 私有原图 URL，生成器必须先用 Bearer 从 Pages 下载原图，再把图片作为 base64 data URL 传给 ZEALMAN 工作流 API。
- ComfyUI 普通工作流 JSON 不能直接作为 ZEALMAN API。必须在 ComfyUI 里“导出 (API)”后，导入 6008 的“API生成”列表。
- 冷启动时 6008 能访问不代表 workflow 可提交。生成器需要等待 `/api/workflow/list` 中出现 `desktop_pet_base_angles_v1`，并对 `POST /api/workflow/generate` 的 5xx 做重试。
- `prompt_id` 和 AutoDL `/output/*` 不是长期交付凭证。生成器必须立即下载产物并上传 R2。
- ZEALMAN result 会返回正式输出图和 temp 预览图，生产包只收 `/output/` 或 `raw.type=output` 的正式图。
- 生产省钱策略是空闲 120 秒关机；下一单会重新开机，客户等待冷启动时间。

## Cloudflare 配置关联

Pages `wrangler.toml` 需要保持：

```toml
[vars]
GENERATOR_WEBHOOK_URL = "http://81.68.126.249:8791/jobs"
NEXT_PUBLIC_PET_API_BASE = "https://desktop-pet-studio-exu.pages.dev"
```

腾讯云安全组/轻量防火墙需要放通：

```text
TCP 8791
```
