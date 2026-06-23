# 桌宠交付链路

## 结论

AutoDL 只做生成，不做长期下载站。

当前已经跑通的生产主链路是：

```text
客户上传照片
→ Cloudflare Pages 展示页面并调用同域 /api/*
→ Cloudflare Pages Functions 复用 worker/src/index.js 创建订单并保存照片到 R2
→ Pages Functions 把任务投递到腾讯云生成器 /jobs
→ 腾讯云 Python 生成器按需开 AutoDL 应用实例
→ 腾讯云调用 ZEALMAN Control Panel 的 ComfyUI API 工作流
→ 腾讯云下载 8 张输出图并打包 pet_package.zip
→ 生成器回调 Pages 私有接口并上传产物到 R2
→ Pages Functions 写入 R2
→ 客户从 Pages 域名稳定下载
→ 空闲 120 秒后腾讯云自动关闭 AutoDL 实例
→ 客户端导入资源包
```

独立 Worker 仍可部署，但 `workers.dev` 因链路超时不作为当前生产主入口。当前已由腾讯云生成器驱动 AutoDL / ComfyUI。

## 为什么不直接给 AutoDL 下载链接

- AutoDL 关机后链接不可用。
- 访问域名和端口不适合作为长期交付入口。
- 客户下载会占用算力实例运行时间。
- 订单归档、售后重下、权限控制都应放在业务侧。

## Cloudflare 分工

- Pages：展示、下单、上传、进度、下载页面。
- Pages Functions `/api/*`：当前生产 API 入口，复用 Worker API 代码。
- Worker API 代码：订单 API、上传 API、状态 API、下载 API、生成器私有接口。
- R2：客户原图、预览图、最终资源包。

## 生成侧分工

- 腾讯云轻量服务器：常驻调度层，公网入口 `http://81.68.126.249:8791/jobs`。
- AutoDL 应用实例：按需开关机，实例 ID `pro-7817332b4012`，镜像 `zealman-ComfyUI v8.84`。
- ZEALMAN Control Panel：内部端口 `6008`，外部域名端口 `8443`，提供工作流 API。
- ComfyUI：内部端口 `6006`，外部域名端口 `8443`，生产只通过 API 调用，不需要打开调试画布。
- 当前 API 工作流：`desktop_pet_base_angles_v1`，图片输入字段 `25:image`。
- 当前省钱策略：有订单再开机，空闲 `120` 秒自动关机。

## 资源包格式 MVP

图片版：

```text
pet_package.zip
  manifest.json
  preview.png
  images/
    base_front_full_body_*.png
    front_closeup_identity_*.png
    right_45_full_body_*.png
    right_side_full_body_*.png
    sitting_front_full_body_*.png
    lying_side_full_body_*.png
    left_45_full_body_*.png
    left_side_full_body_*.png
  source/
    source-0.png
```

视频版：

```text
pet_package.zip
  manifest.json
  videos/
    idle.webm
    walk.webm
    lie.webm
  images/
    base_pet.png
    preview.png
```

## 订单状态

```text
created
photos_uploaded
queued
generating
packaging
ready
failed
```

竞品体验里的一个问题是失败后会把多个动作一起打回。我们的生成 worker 应该按动作分任务保存结果：

```text
base_image
keyframe_idle
keyframe_walk
keyframe_lie
video_idle
video_walk
video_lie
package
```

哪个动作失败，只重试哪个动作。

## 生成器接口

生成器接到 `POST /jobs` 后，不直接访问 R2，而是通过 Pages `/api/*` 暴露的私有接口工作：

```text
GET  /api/worker/orders/<orderId>/job
GET  /api/worker/orders/<orderId>/source/<index>
POST /api/worker/orders/<orderId>/callback
POST /api/worker/orders/<orderId>/artifacts
```

这些接口可以用 `GENERATOR_SHARED_SECRET` 做 Bearer 鉴权。

## 生产注意事项

- 客户只从 Pages/R2 下载资源包，不直接访问 AutoDL 输出链接。
- AutoDL 输出链接和 `prompt_id` 都不是长期凭证，生成完成后必须立即下载并上传 R2。
- 腾讯云生成器需要同时配置 `GENERATOR_SHARED_SECRET` 和 `AUTODL_TOKEN`，但这两个值不能写入仓库文档。
- 冷启动时要等待 `6008` 面板和 `desktop_pet_base_angles_v1` 工作流 ready，再提交生成；遇到 5xx 要重试。
- `workers.dev` 链路不稳定，生产不要把 Worker API base 或生成器回调配到 `*.workers.dev`。
