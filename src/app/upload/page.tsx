"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  PawPrint,
  Play,
  Upload,
} from "lucide-react";

import {
  createOrder,
  getDownloadUrl,
  getOrder,
  startGeneration,
  uploadOrderPhotos,
  type PetOrder,
  type ProductTier,
} from "@/lib/pet-api";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const tierOptions: Array<{
  id: ProductTier;
  name: string;
  price: string;
  summary: string;
}> = [
  {
    id: "starter_29",
    name: "轻量形象包",
    price: "29.9",
    summary: "标准主形象、基础动作和桌面运行包，适合快速交付。",
  },
  {
    id: "deluxe_69",
    name: "主形象动作包",
    price: "69.9",
    summary: "增加坐姿、趴姿、睡觉等动作资产，适合更完整的桌宠。",
  },
];

const statusLabels: Record<string, string> = {
  created: "订单已创建",
  photos_uploaded: "照片已上传",
  queued: "已进入生成队列",
  generating: "正在生成形象",
  packaging: "正在打包资源",
  ready: "资源包已完成",
  failed: "生成失败",
};

export default function UploadPage() {
  const [tier, setTier] = useState<ProductTier>("starter_29");
  const [petName, setPetName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [order, setOrder] = useState<PetOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => files.length > 0 && !busy, [busy, files.length]);

  useEffect(() => {
    if (!order || ["ready", "failed"].includes(order.status)) {
      return;
    }

    const timer = window.setInterval(async () => {
      try {
        const nextOrder = await getOrder(order.orderId);
        setOrder(nextOrder);
      } catch {
        // Keep the current state; the next poll can recover.
      }
    }, 4000);

    return () => window.clearInterval(timer);
  }, [order]);

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("正在创建订单...");

    try {
      const created = await createOrder({
        productTier: tier,
        customerName,
        petName,
        species: "cat",
        notes,
      });
      setOrder(created);

      setMessage("正在上传照片...");
      const uploaded = await uploadOrderPhotos(created.orderId, files);
      setOrder(uploaded);

      setMessage("正在提交生成任务...");
      const queued = await startGeneration(created.orderId);
      setOrder(queued);
      setMessage("任务已提交。页面会自动刷新生成状态。");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
      setMessage("");
    } finally {
      setBusy(false);
    }
  }

  function handleFileChange(value: FileList | null) {
    const nextFiles = Array.from(value || [])
      .filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type))
      .slice(0, 6);
    setFiles(nextFiles);
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fffaf4_0%,#f5eee4_100%)] px-5 py-6 text-[#4b3d30] sm:px-8 lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex items-center justify-between rounded-full border border-white/70 bg-white/70 px-4 py-3 shadow-[0_12px_30px_rgba(95,73,49,0.06)] backdrop-blur sm:px-6">
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "rounded-full border-[#ddccb8] bg-white/80 px-5 text-[#5c4a39]",
            )}
          >
            <ArrowLeft className="size-4" />
            返回首页
          </Link>
          <div className="flex items-center gap-2 text-sm font-medium text-[#705c48]">
            <PawPrint className="size-4" />
            宠物照片上传
          </div>
        </header>

        <section className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium tracking-[0.22em] text-[#927a62] uppercase">
                Create pet package
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#4d3e31] sm:text-5xl">
                上传照片，生成你的桌宠资源包
              </h1>
              <p className="mt-5 max-w-xl text-base leading-8 text-[#786756]">
                先上传清晰照片，系统会生成标准形象、透明素材和最终资源包。资源包完成后，下载安装到客户端即可导入。
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-white/75 bg-white/75 p-5 shadow-[0_16px_40px_rgba(96,72,46,0.08)]">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-1 size-5 text-[#6f8b65]" />
                <div>
                  <h2 className="font-semibold text-[#554331]">照片建议</h2>
                  <p className="mt-2 text-sm leading-7 text-[#7d6b59]">
                    优先上传正面或 3/4 侧面全身照。毛色、脸部、尾巴越清楚，标准形象越稳定。
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/80 bg-white/78 p-5 shadow-[0_24px_70px_rgba(96,72,46,0.1)] backdrop-blur sm:p-7">
            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium text-[#5b4937]">选择套餐</label>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {tierOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setTier(option.id)}
                      className={cn(
                        "min-h-32 rounded-[1.25rem] border p-4 text-left transition",
                        tier === option.id
                          ? "border-[#8d7156] bg-[#fff7ee] shadow-[0_14px_30px_rgba(93,70,48,0.1)]"
                          : "border-[#eadbca] bg-white/70 hover:bg-white",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-[#4f3f30]">{option.name}</span>
                        <span className="rounded-full bg-[#f0ddc8] px-3 py-1 text-sm text-[#684f39]">
                          ¥{option.price}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[#7d6b59]">{option.summary}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#5b4937]">宠物名字</span>
                  <input
                    value={petName}
                    onChange={(event) => setPetName(event.target.value)}
                    placeholder="比如：雪球"
                    className="h-12 w-full rounded-2xl border border-[#dfcdbb] bg-white/80 px-4 text-sm outline-none transition focus:border-[#8d7156]"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#5b4937]">联系人</span>
                  <input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="方便识别订单"
                    className="h-12 w-full rounded-2xl border border-[#dfcdbb] bg-white/80 px-4 text-sm outline-none transition focus:border-[#8d7156]"
                  />
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-sm font-medium text-[#5b4937]">性格或保留特征</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="比如：蓝眼睛、鼻梁白色、平时爱趴着发呆"
                  className="min-h-24 w-full resize-none rounded-2xl border border-[#dfcdbb] bg-white/80 px-4 py-3 text-sm leading-7 outline-none transition focus:border-[#8d7156]"
                />
              </label>

              <div>
                <label
                  htmlFor="pet-photos"
                  className="flex min-h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-[1.5rem] border border-dashed border-[#d8c2aa] bg-[#fff9f2] px-5 py-7 text-center transition hover:bg-white"
                >
                  <Upload className="size-8 text-[#7a6049]" />
                  <div>
                    <p className="font-medium text-[#554331]">选择宠物照片</p>
                    <p className="mt-1 text-sm text-[#826f5a]">支持 JPG、PNG、WEBP，最多 6 张</p>
                  </div>
                </label>
                <input
                  id="pet-photos"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  className="sr-only"
                  onChange={(event) => handleFileChange(event.target.files)}
                />
                {files.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {files.map((file) => (
                      <span
                        key={`${file.name}-${file.size}`}
                        className="rounded-full bg-[#f0dfcd] px-3 py-1 text-xs text-[#6d5743]"
                      >
                        {file.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleSubmit}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-12 w-full rounded-full bg-[#5a4736] text-base text-[#fff9f3] shadow-[0_16px_30px_rgba(90,71,54,0.18)] hover:bg-[#4f3f31]",
                )}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                提交生成
              </button>

              {(message || error || order) && (
                <div className="rounded-[1.25rem] border border-[#eadbca] bg-[#fffaf5] p-4">
                  {message && <p className="text-sm text-[#6d5743]">{message}</p>}
                  {error && <p className="text-sm text-red-700">{error}</p>}
                  {order && (
                    <div className="mt-3 space-y-2 text-sm text-[#6d5743]">
                      <p>订单号：{order.orderId}</p>
                      <p>当前状态：{statusLabels[order.status] ?? order.status}</p>
                      <p>已上传照片：{order.photoCount} 张</p>
                      {order.status === "ready" && (
                        <a
                          href={getDownloadUrl(order.orderId)}
                          className={cn(
                            buttonVariants({ size: "lg" }),
                            "mt-3 rounded-full bg-[#5a4736] px-5 text-[#fff9f3] hover:bg-[#4f3f31]",
                          )}
                        >
                          <Download className="size-4" />
                          下载资源包
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

