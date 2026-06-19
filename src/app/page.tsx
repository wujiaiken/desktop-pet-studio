"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRight,
  Cat,
  Download,
  HeartHandshake,
  MessageCircleHeart,
  PawPrint,
  Play,
  Sparkles,
} from "lucide-react";

import { BorderBeam } from "@/components/ui/border-beam";
import { buttonVariants } from "@/components/ui/button";
import { GridPattern } from "@/components/ui/grid-pattern";
import { cn } from "@/lib/utils";

const heroBadges = ["会走路", "会舔爪子", "会伸懒腰", "会在桌面睡着"];

const actionCards = [
  {
    title: "慢悠悠走路",
    description: "像平时巡逻一样，从屏幕一角走到另一角，工作时抬头就能看见它。",
    src: "/demo/walk.webm",
    accent: "from-[#f6d9b8] to-[#efe1d2]",
  },
  {
    title: "坐下舔爪子",
    description: "安静坐下来整理自己，细小动作很治愈，不会打扰你专注。",
    src: "/demo/groom.webm",
    accent: "from-[#efd9c7] to-[#e8e1d8]",
  },
  {
    title: "起身伸懒腰",
    description: "偶尔伸个懒腰，像真的猫咪刚睡醒，给桌面一点刚刚好的生气。",
    src: "/demo/stretch.webm",
    accent: "from-[#f0dcc2] to-[#e6ddd4]",
  },
  {
    title: "趴着发呆睡觉",
    description: "忙完以后它会自己歇一会儿，让你的电脑桌面多一点陪伴感。",
    src: "/demo/sleep.webm",
    accent: "from-[#e6ddd4] to-[#f3e8d8]",
  },
];

const steps = [
  {
    icon: MessageCircleHeart,
    title: "上传猫咪照片",
    description: "在线上传正面、侧面和你最喜欢的一张照片，系统会保存到订单里。",
  },
  {
    icon: Sparkles,
    title: "制作专属形象",
    description: "根据花色、体型和神态，做成更像你家猫咪的桌面形象。",
  },
  {
    icon: Play,
    title: "预览动作效果",
    description: "先看走路、舔爪子、伸懒腰、睡觉这些核心动作是否像它。",
  },
  {
    icon: Download,
    title: "下载安装到电脑",
    description: "资源包完成后下载安装到电脑客户端，让它每天在桌面上陪你工作。",
  },
];

const contactNotes = [
  "上传时附上猫咪照片和一句性格描述，效果会更贴近。",
  "适合做自己的桌面陪伴，也适合送给养猫的朋友。",
  "目前优先支持 Windows 桌面版本，后续动作会持续更新。",
];

function SectionReveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  description: string;
  align?: "center" | "left";
}) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-2xl flex-col gap-4",
        align === "center" ? "items-center text-center" : "items-start text-left",
      )}
    >
      <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/75 px-4 py-1.5 text-xs font-medium tracking-[0.24em] text-[#8c7764] uppercase shadow-[0_10px_30px_rgba(94,72,46,0.06)] backdrop-blur">
        <PawPrint className="size-3.5" />
        {eyebrow}
      </div>
      <h2 className="text-3xl font-semibold tracking-tight text-[#4f4033] sm:text-4xl">
        {title}
      </h2>
      <p className="max-w-xl text-base leading-8 text-[#786959] sm:text-lg">
        {description}
      </p>
    </div>
  );
}

function DemoWindow() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 28, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
      className="relative w-full max-w-[620px]"
    >
      <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(255,255,255,0.2)_44%,_transparent_70%)]" />
      <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[#f6eee4]/95 shadow-[0_25px_80px_rgba(111,84,52,0.18)] backdrop-blur">
        <BorderBeam
          duration={10}
          size={180}
          className="from-transparent via-[#f3cfa3] to-transparent"
        />
        <div className="flex items-center justify-between border-b border-[#ead9c8] px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-[#f1b498]" />
            <span className="size-2.5 rounded-full bg-[#ecd08a]" />
            <span className="size-2.5 rounded-full bg-[#b8cf9c]" />
          </div>
          <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-[#8b7762] shadow-sm">
            Desktop Preview
          </div>
        </div>

        <div className="relative min-h-[320px] overflow-hidden bg-[linear-gradient(180deg,#f8f3ec_0%,#f4ede2_52%,#efe5d8_100%)] p-5 sm:min-h-[420px] sm:p-8">
          <GridPattern
            width={34}
            height={34}
            x={-1}
            y={-1}
            className="absolute inset-0 h-full w-full fill-[#cdb79b]/20 stroke-[#dbcab7]/40 [mask-image:radial-gradient(circle_at_center,white,transparent_80%)]"
          />

          <div className="relative z-10 flex h-full flex-col justify-between gap-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/80 bg-white/75 p-4 shadow-[0_16px_36px_rgba(102,78,52,0.08)]">
                <p className="text-xs uppercase tracking-[0.22em] text-[#9d866f]">
                  Today&apos;s mood
                </p>
                <p className="mt-2 text-lg font-semibold text-[#5a4a3a]">陪你上班</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/65 p-4 shadow-[0_16px_36px_rgba(102,78,52,0.06)] sm:col-span-2">
                <p className="text-xs uppercase tracking-[0.22em] text-[#9d866f]">
                  Motion set
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {heroBadges.map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full bg-[#f3e3d2] px-3 py-1 text-sm text-[#735e4a]"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="relative flex-1 rounded-[1.75rem] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.7),rgba(255,255,255,0.35))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_18px_45px_rgba(125,98,69,0.08)] sm:p-6">
              <div className="absolute inset-x-8 bottom-8 h-9 rounded-full bg-[#dccab5]/55 blur-2xl" />
              <div className="absolute right-6 top-6 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-[0_12px_24px_rgba(121,93,64,0.09)]">
                <p className="text-xs uppercase tracking-[0.2em] text-[#9b846d]">
                  定制状态
                </p>
                <p className="mt-2 text-sm font-medium text-[#5a4a3a]">
                  形象已完成，等待安装
                </p>
              </div>
              <motion.video
                autoPlay
                muted
                loop
                playsInline
                className="relative z-10 mx-auto h-[190px] w-full max-w-[360px] object-contain drop-shadow-[0_20px_30px_rgba(82,58,33,0.18)] sm:mt-6 sm:h-[250px] sm:max-w-[420px]"
                src="/demo/walk.webm"
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ActionCard({
  title,
  description,
  src,
  accent,
  index,
}: {
  title: string;
  description: string;
  src: string;
  accent: string;
  index: number;
}) {
  return (
    <SectionReveal delay={index * 0.08}>
      <article className="group relative overflow-hidden rounded-[2rem] border border-white/75 bg-white/80 p-4 shadow-[0_18px_60px_rgba(96,72,46,0.09)] backdrop-blur transition-transform duration-300 hover:-translate-y-1 sm:p-5">
        <div
          className={cn(
            "absolute inset-x-5 top-5 h-24 rounded-full bg-gradient-to-r opacity-75 blur-3xl",
            accent,
          )}
        />
        <div className="relative rounded-[1.6rem] border border-white/80 bg-[linear-gradient(180deg,#fbf7f2_0%,#f3ebdf_100%)] p-4">
          <video
            autoPlay
            muted
            loop
            playsInline
            className="mx-auto h-52 w-full object-contain drop-shadow-[0_18px_24px_rgba(84,61,38,0.16)]"
            src={src}
          />
        </div>
        <div className="relative mt-5 space-y-3 px-1 pb-1">
          <h3 className="text-xl font-semibold text-[#514130]">{title}</h3>
          <p className="text-sm leading-7 text-[#7c6a57]">{description}</p>
        </div>
      </article>
    </SectionReveal>
  );
}

export default function Home() {
  return (
    <main className="relative overflow-hidden bg-[linear-gradient(180deg,#fffaf4_0%,#f7f1e8_42%,#f4ede4_100%)] text-[#4b3d30]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,238,214,0.95),rgba(255,238,214,0.28)_40%,transparent_72%)] blur-3xl" />
        <div className="absolute right-[-8rem] top-[28rem] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,rgba(237,223,206,0.9),rgba(237,223,206,0.18)_55%,transparent_72%)] blur-3xl" />
      </div>

      <section className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-5 pb-16 pt-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between rounded-full border border-white/65 bg-white/70 px-4 py-3 shadow-[0_12px_30px_rgba(95,73,49,0.06)] backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-[#f3ddc4] text-[#6a533d] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
              <Cat className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#5a4735]">桌面猫咪定制</p>
              <p className="text-xs text-[#8f7b67]">把你家猫咪装进电脑桌面</p>
            </div>
          </div>
          <Link
            href="/upload"
            className={cn(
              buttonVariants({ size: "lg" }),
              "rounded-full bg-[#5e4a39] px-5 text-[#fff9f2] shadow-[0_12px_24px_rgba(94,74,57,0.18)] hover:bg-[#4f3e2f]",
            )}
          >
            上传定制
          </Link>
        </header>

        <div className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:py-16">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/78 px-4 py-2 text-sm text-[#8b7764] shadow-[0_10px_24px_rgba(97,73,47,0.06)] backdrop-blur"
            >
              <Sparkles className="size-4" />
              把真实猫咪做成桌面电子宠物
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
              className="mt-6 text-4xl font-semibold tracking-tight text-[#4d3e31] sm:text-5xl lg:text-[4.2rem] lg:leading-[1.05]"
            >
              把你家猫咪，
              <br />
              装进电脑桌面
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.16 }}
              className="mt-6 max-w-xl text-lg leading-9 text-[#786756]"
            >
              会走路、会坐下舔爪子、会伸懒腰，也会在你的桌面上安静睡着。
              <br />
              发来猫咪照片，我们帮你做成专属的桌面电子宠物。
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.24 }}
              className="mt-8 flex flex-col gap-3 sm:flex-row"
            >
              <Link
                href="/upload"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-12 rounded-full bg-[#5a4736] px-6 text-base text-[#fff9f3] shadow-[0_18px_30px_rgba(90,71,54,0.18)] hover:bg-[#4f3f31]",
                )}
              >
                定制我的猫咪
                <ArrowRight className="size-4" />
              </Link>
              <a
                href="#actions"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-12 rounded-full border-[#ddccb8] bg-white/75 px-6 text-base text-[#5c4a39] shadow-[0_12px_24px_rgba(99,77,52,0.06)] hover:bg-white",
                )}
              >
                查看动作效果
                <Play className="size-4" />
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.32 }}
              className="mt-10 grid gap-4 sm:grid-cols-3"
            >
              {[
                ["更像你家猫", "根据花色和神态制作"],
                ["动作持续更新", "走路、舔爪子、睡觉等"],
                ["安装很简单", "预览满意后下载安装到电脑"],
              ].map(([title, desc]) => (
                <div
                  key={title}
                  className="rounded-[1.5rem] border border-white/75 bg-white/70 p-4 shadow-[0_14px_32px_rgba(100,76,50,0.06)] backdrop-blur"
                >
                  <p className="text-base font-semibold text-[#574533]">{title}</p>
                  <p className="mt-2 text-sm leading-7 text-[#8a7762]">{desc}</p>
                </div>
              ))}
            </motion.div>
          </div>

          <DemoWindow />
        </div>
      </section>

      <section id="actions" className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
        <SectionReveal>
          <SectionHeader
            eyebrow="动作展示"
            title="不是静态贴图，而是会在你桌面上慢慢活起来"
            description="第一版先把最让人有陪伴感的动作做好，让它看起来像真的在桌面陪你，而不是一个普通挂件。"
          />
        </SectionReveal>

        <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {actionCards.map((card, index) => (
            <ActionCard key={card.title} index={index} {...card} />
          ))}
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
        <SectionReveal>
          <SectionHeader
            eyebrow="定制流程"
            title="从照片到安装，流程尽量做得简单轻松"
            description="你不用会建模，也不用折腾复杂设置。把猫咪照片发过来，我们会把定制过程压缩成很顺手的几步。"
          />
        </SectionReveal>

        <div className="mt-14 grid gap-5 lg:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <SectionReveal key={step.title} delay={index * 0.06}>
                <div className="relative h-full overflow-hidden rounded-[2rem] border border-white/75 bg-white/78 p-6 shadow-[0_18px_48px_rgba(96,72,46,0.08)] backdrop-blur">
                  <div className="absolute right-4 top-4 text-5xl font-semibold text-[#efe4d6]">
                    0{index + 1}
                  </div>
                  <div className="relative flex size-12 items-center justify-center rounded-2xl bg-[#f3e1cf] text-[#6c5641] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="relative mt-6 text-xl font-semibold text-[#50402f]">
                    {step.title}
                  </h3>
                  <p className="relative mt-3 text-sm leading-7 text-[#7d6b59]">
                    {step.description}
                  </p>
                </div>
              </SectionReveal>
            );
          })}
        </div>
      </section>

      <section id="contact" className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
        <SectionReveal>
          <div className="relative overflow-hidden rounded-[2.25rem] border border-white/80 bg-[linear-gradient(135deg,rgba(255,251,246,0.92),rgba(247,238,228,0.92))] p-7 shadow-[0_24px_80px_rgba(99,76,49,0.1)] sm:p-10 lg:p-12">
            <div className="absolute -right-12 top-0 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(244,219,190,0.95),rgba(244,219,190,0.12)_62%,transparent_72%)] blur-2xl" />
            <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-4 py-2 text-sm text-[#8b7764] shadow-[0_10px_24px_rgba(97,73,47,0.06)]">
                  <HeartHandshake className="size-4" />
                  在线定制
                </div>
                <h2 className="mt-6 text-3xl font-semibold tracking-tight text-[#4d3f31] sm:text-4xl">
                  想把你家猫咪做成桌面陪伴，
                  <br />
                  先上传照片开始生成
                </h2>
                <p className="mt-5 max-w-xl text-base leading-8 text-[#786858] sm:text-lg">
                  把猫咪照片、名字和想保留的性格特点填好，比如“爱发呆”“有点傲娇”“总爱伸懒腰”，后端会进入生成队列并输出桌宠资源包。
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/upload"
                    className={cn(
                      buttonVariants({ size: "lg" }),
                      "h-12 rounded-full bg-[#5a4736] px-6 text-base text-[#fff9f3] shadow-[0_16px_30px_rgba(90,71,54,0.18)] hover:bg-[#4f3f31]",
                    )}
                  >
                    上传照片定制
                    <ArrowRight className="size-4" />
                  </Link>
                  <a
                    href="#top"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "lg" }),
                      "h-12 rounded-full border-[#ddccb8] bg-white/80 px-6 text-base text-[#5c4a39] hover:bg-white",
                    )}
                  >
                    回到顶部
                  </a>
                </div>
              </div>

              <div className="relative rounded-[2rem] border border-white/85 bg-white/78 p-6 shadow-[0_18px_48px_rgba(98,74,48,0.08)]">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-[#f3dfcb] text-[#6b5340]">
                    <Cat className="size-5" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-[#554331]">填写建议</p>
                    <p className="text-sm text-[#8c7966]">更快进入制作和预览流程</p>
                  </div>
                </div>

                <div className="mt-6 rounded-[1.6rem] bg-[#f8f1e8] p-5 text-sm leading-8 text-[#6e5b48]">
                  <p>猫咪名字：雪球</p>
                  <p>性格特点：黏人、爱伸懒腰、坐着会舔爪子</p>
                  <p>照片建议：正面全身、侧面全身、最像它的一张生活照。</p>
                </div>

                <div className="mt-6 space-y-3">
                  {contactNotes.map((note) => (
                    <div
                      key={note}
                      className="flex items-start gap-3 rounded-2xl border border-[#eadbca] bg-[#fffaf5] px-4 py-3"
                    >
                      <span className="mt-1 size-2 rounded-full bg-[#d2b28f]" />
                      <p className="text-sm leading-7 text-[#7a6856]">{note}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </SectionReveal>
      </section>

      <footer className="relative border-t border-white/70 bg-white/50">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-[#887561] sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-[#f0dcc7] text-[#67513f]">
              <Cat className="size-4.5" />
            </div>
            <p>桌面猫咪定制</p>
          </div>
          <p>把喜欢的猫咪做成每天都能陪你的桌面电子宠物。</p>
        </div>
      </footer>
    </main>
  );
}
