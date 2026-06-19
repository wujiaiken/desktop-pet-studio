# 桌宠交付链路

## 结论

AutoDL 只做生成，不做长期下载站。

```text
客户上传照片
→ Cloudflare Worker 创建订单并保存照片到 R2
→ 外部生成 worker 调用 AutoDL ComfyUI
→ ComfyUI 输出透明图/视频
→ 外部生成 worker 打包 pet_package.zip
→ zip 上传到 R2
→ AutoDL 清理临时文件并关机
→ 客户从 Worker/R2 稳定下载
→ 客户端导入资源包
```

## 为什么不直接给 AutoDL 下载链接

- AutoDL 关机后链接不可用。
- 访问域名和端口不适合作为长期交付入口。
- 客户下载会占用算力实例运行时间。
- 订单归档、售后重下、权限控制都应放在业务侧。

## Cloudflare 分工

- Pages：展示、下单、上传、进度、下载页面。
- Worker：订单 API、上传 API、状态 API、下载 API。
- R2：客户原图、预览图、最终资源包。

## 资源包格式 MVP

图片版：

```text
pet_package.zip
  manifest.json
  images/
    base_pet.png
    sit.png
    lie.png
    left.png
    right.png
  preview.png
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

