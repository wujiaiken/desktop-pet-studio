# 腾讯云轻量服务器部署 generator

## 当前服务器情况

巡检到的这台轻量应用服务器：

```text
系统：Windows Server 2022 DataCenter 64bit CN
公网 IP：81.68.126.249
配置：2 核 / 2GB / 40GB
公网带宽：4Mbps
当前已有服务：Python 进程监听 5000 端口
现有目录：C:\license-server、C:\server_auth_api.py、C:\nssm
```

这说明 `5000` 很可能是原量化交易序列号认证 API，桌宠项目不要占用这个端口。

## 这台服务器适合做什么

适合：

```text
Cloudflare Worker
  -> POST /jobs
腾讯云轻量服务器 generator
  -> 拉取订单和原图
  -> 调用 AutoDL/ComfyUI
  -> 接收生成结果并打包
  -> 上传 pet_package.zip 到 Cloudflare Worker/R2
```

不适合：

```text
直接跑 ComfyUI 生图
直接跑视频生成
长期存放客户下载文件
```

原因是这台机器没有 GPU，内存也只有 2GB。它应该只做调度和中转。

## 推荐端口

generator 默认端口：

```text
8789
```

不要使用：

```text
5000
```

因为 `5000` 已经被现有 Python 服务占用。

## 部署目录建议

建议把 generator 单独放到：

```text
C:\desktop-pet-generator
```

不要放进：

```text
C:\license-server
```

这样不会影响原来的量化认证服务。

## 服务器需要的环境变量

在 `C:\desktop-pet-generator\.env` 中配置：

```text
PORT=8789
WORKER_API_BASE=https://desktop-pet-studio-api.tikogafar76.workers.dev
GENERATOR_SHARED_SECRET=换成一段很长的随机密钥

# 后续 AutoDL/ComfyUI 开机后再填
COMFYUI_BASE_URL=
COMFYUI_WORKFLOW_PATH=
```

`GENERATOR_SHARED_SECRET` 必须和 Cloudflare Worker 里的同名变量一致。

## 手动启动测试

进入目录：

```powershell
cd C:\desktop-pet-generator
npm install
npm start
```

健康检查：

```powershell
Invoke-RestMethod http://127.0.0.1:8789/health
```

期望返回：

```json
{ "ok": true }
```

## 注册成 Windows 服务

服务器已有 `C:\nssm`，可以继续用 NSSM 管理服务。先确认 `nssm.exe` 位置：

```powershell
Get-ChildItem C:\nssm -Recurse -Filter nssm.exe
```

假设路径是：

```text
C:\nssm\nssm.exe
```

注册服务：

```powershell
C:\nssm\nssm.exe install desktop-pet-generator
```

弹窗里填写：

```text
Path: C:\Program Files\nodejs\node.exe
Startup directory: C:\desktop-pet-generator
Arguments: src\server.js
```

然后启动：

```powershell
C:\nssm\nssm.exe start desktop-pet-generator
```

查看状态：

```powershell
C:\nssm\nssm.exe status desktop-pet-generator
```

## Cloudflare Worker 需要配置

Worker 里设置：

```text
GENERATOR_WEBHOOK_URL=http://81.68.126.249:8789/jobs
GENERATOR_SHARED_SECRET=和服务器 .env 一样的密钥
```

更推荐后续给腾讯云服务器绑定域名和 HTTPS，例如：

```text
https://generator.your-domain.com/jobs
```

## 防火墙

腾讯云安全组/轻量防火墙需要放通：

```text
TCP 8789
```

Windows 防火墙也要允许 Node.js 或 8789 端口入站。

如果暂时不想暴露公网，可以先不配置 Worker 的 `GENERATOR_WEBHOOK_URL`，用手动命令测试：

```powershell
npm run mock-job -- ord_xxx
```

## 最终生产建议

第一阶段可以用这台腾讯云做 generator，成本最低。

稳定后再升级为：

```text
Cloudflare Pages + Worker + R2
腾讯云轻量服务器：常驻 generator 调度服务
AutoDL：按需开 GPU，运行 ComfyUI
```

AutoDL 生成完成后，generator 把 zip 拉回并上传 R2。客户永远从 Cloudflare 下载，不直接从 AutoDL 下载。
