"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Globe2,
  LockKeyhole,
  Mail,
  PackageCheck,
  Radar,
  ShieldCheck,
  TrendingUp
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { LanguageProvider, useLanguage } from "@/components/LanguageProvider";
import type { Language } from "@/lib/types";

const loginCopy = {
  zh: {
    eyebrow: "经营管理系统",
    titleMain: "Coupang ERP",
    titleAccent: "经营控制台",
    subtitle: "把库存、利润、补货、新品开发和客诉洞察集中到一个清晰的经营入口。",
    metricProfit: "30日利润",
    metricHealth: "健康SKU",
    metricRisk: "风险预警",
    previewTitle: "今日经营概览",
    chartLabel: "利润趋势",
    signalRestock: "补货优先级",
    signalProduct: "新品开发",
    signalIssue: "客诉洞察",
    online: "实时",
    loginSubtitle: "登录后进入经营管理后台",
    secure: "安全访问",
    enterTitle: "进入系统",
    enterText: "查看库存风险、利润趋势、待办执行、新品开发和客诉问题。",
    encrypted: "加密",
    cloud: "云端",
    realtime: "实时",
    processing: "处理中"
  },
  ko: {
    eyebrow: "운영 관리 시스템",
    titleMain: "Coupang ERP",
    titleAccent: "운영 콘솔",
    subtitle: "재고, 이익, 발주, 신상품 개발, 고객 이슈를 하나의 명확한 운영 입구로 모읍니다.",
    metricProfit: "30일 이익",
    metricHealth: "건강 SKU",
    metricRisk: "위험 알림",
    previewTitle: "오늘 운영 현황",
    chartLabel: "이익 추세",
    signalRestock: "발주 우선순위",
    signalProduct: "신상품 개발",
    signalIssue: "고객 이슈",
    online: "실시간",
    loginSubtitle: "로그인 후 운영 관리 화면으로 이동",
    secure: "보안 접속",
    enterTitle: "시스템 접속",
    enterText: "재고 위험, 이익 추세, 업무 실행, 신상품 개발, 고객 이슈를 확인합니다.",
    encrypted: "암호화",
    cloud: "클라우드",
    realtime: "실시간",
    processing: "처리 중"
  }
} as const;

export default function LoginPage() {
  return (
    <LanguageProvider>
      <LoginForm />
    </LanguageProvider>
  );
}

function LoginForm() {
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const copy = loginCopy[language];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(mode: "signin" | "signup") {
    setBusy(true);
    setMessage("");
    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    router.replace("/dashboard");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#eef2ec] text-ink">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(23,72,63,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(23,72,63,0.055)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(42,128,103,0.16),transparent_26rem),radial-gradient(circle_at_82%_20%,rgba(188,167,122,0.20),transparent_28rem),linear-gradient(135deg,#f9faf5_0%,#edf2ec_48%,#e7eee8_100%)]" />

      <section className="relative mx-auto grid min-h-screen w-full max-w-7xl items-center gap-10 px-5 py-8 lg:grid-cols-[1.04fr_0.96fr] lg:px-8">
        <div className="mx-auto w-full max-w-[760px] lg:mx-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#17483f]/16 bg-white/78 px-3 py-1.5 text-xs font-bold tracking-[0.12em] text-[#17483f] shadow-[0_12px_30px_rgba(23,33,29,0.06)] backdrop-blur-xl">
            <ShieldCheck className="h-3.5 w-3.5" />
            {copy.eyebrow}
          </div>

          <h1 className="mt-6 text-5xl font-semibold leading-[1.02] tracking-tight text-[#102b27] md:text-6xl xl:text-7xl">
            {copy.titleMain}
            <span className="block text-[#2d8169]">{copy.titleAccent}</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-[#4d5d56]">{copy.subtitle}</p>

          <div className="mt-9 grid max-w-3xl gap-3 sm:grid-cols-3">
            <HeroMetric icon={TrendingUp} label={copy.metricProfit} value="₩18.6M" trend="+24.8%" />
            <HeroMetric icon={PackageCheck} label={copy.metricHealth} value="86%" trend={copy.online} />
            <HeroMetric icon={Radar} label={copy.metricRisk} value="7" trend={copy.online} />
          </div>

          <div className="mt-5 max-w-3xl rounded-[28px] border border-[#cdd8cf] bg-white/82 p-4 shadow-[0_28px_80px_rgba(23,33,29,0.12)] backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold tracking-tight text-[#102b27]">{copy.previewTitle}</h2>
              <span className="rounded-full border border-[#2d8169]/18 bg-[#e6f2ed] px-3 py-1 text-xs font-bold text-[#23614f]">{copy.online}</span>
            </div>

            <div className="grid gap-3 md:grid-cols-[1.22fr_0.78fr]">
              <div className="rounded-[22px] border border-[#d9dfd7] bg-[#f8faf6] p-4">
                <div className="mb-5 flex items-center justify-between text-xs font-bold text-[#6a756f]">
                  <span>{copy.chartLabel}</span>
                  <span>2026 Q2</span>
                </div>
                <div className="flex h-36 items-end gap-2">
                  {[42, 58, 46, 72, 66, 88, 76, 94, 83, 100].map((height, index) => (
                    <div key={index} className="flex flex-1 items-end rounded-full bg-[#e5ebe4]">
                      <div
                        className="w-full rounded-full bg-gradient-to-t from-[#17483f] via-[#36aa87] to-[#d8c27d]"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3">
                <SignalCard label={copy.signalRestock} value="P1 · 3 SKU" tone="risk" />
                <SignalCard label={copy.signalProduct} value="6" tone="good" />
                <SignalCard label={copy.signalIssue} value="42%" tone="watch" />
              </div>
            </div>
          </div>
        </div>

        <section className="mx-auto w-full max-w-[480px] rounded-[32px] border border-[#c9d3cb] bg-white/70 p-3 shadow-[0_34px_90px_rgba(23,33,29,0.14)] backdrop-blur-xl lg:mx-0 lg:justify-self-end">
          <div className="rounded-[26px] border border-white bg-[#fffdf8] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            <div className="mb-7 grid grid-cols-[1fr_auto] items-start gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#102b27] text-white shadow-[0_16px_34px_rgba(16,43,39,0.22)]">
                  <Boxes size={22} />
                  <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[#fffdf8] bg-[#48c796]" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-lg font-semibold tracking-tight text-[#102b27]">{t("app.name")}</div>
                  <div className="mt-0.5 text-xs font-semibold text-[#66706a]">{copy.loginSubtitle}</div>
                </div>
              </div>
              <select
                className="h-10 min-w-24 border-[#d4dacd] bg-white text-xs font-bold text-[#102b27]"
                value={language}
                onChange={(event) => setLanguage(event.target.value as Language)}
              >
                <option value="zh">{t("language.zh")}</option>
                <option value="ko">{t("language.ko")}</option>
              </select>
            </div>

            <div className="mb-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d8c27d]/45 bg-[#fff8e6] px-3 py-1 text-xs font-bold text-[#8a6834]">
                <ShieldCheck className="h-3.5 w-3.5" />
                {copy.secure}
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#102b27]">{copy.enterTitle}</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-[#66706a]">{copy.enterText}</p>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#66706a]">{t("auth.email")}</span>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#66706a]" />
                  <input className="premium-input h-12 w-full pl-10 font-medium" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#66706a]">{t("auth.password")}</span>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#66706a]" />
                  <input
                    className="premium-input h-12 w-full pl-10 font-medium"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
              </label>

              {message ? <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{message}</div> : null}

              <div className="grid gap-3 sm:grid-cols-[1fr_0.76fr]">
                <button
                  disabled={busy}
                  className="group inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#102b27] px-4 text-sm font-bold text-white shadow-[0_16px_28px_rgba(16,43,39,0.20)] disabled:opacity-50"
                  onClick={() => submit("signin")}
                >
                  {busy ? copy.processing : t("auth.signIn")}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </button>
                <button
                  disabled={busy}
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-[#d4dacd] bg-white px-4 text-sm font-bold text-[#102b27] disabled:opacity-50"
                  onClick={() => submit("signup")}
                >
                  {t("auth.signUp")}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2">
                <TrustItem icon={ShieldCheck} label={copy.encrypted} />
                <TrustItem icon={Globe2} label={copy.cloud} />
                <TrustItem icon={CheckCircle2} label={copy.realtime} />
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function HeroMetric({ icon: Icon, label, value, trend }: { icon: typeof TrendingUp; label: string; value: string; trend: string }) {
  return (
    <div className="rounded-[22px] border border-[#cdd8cf] bg-white/78 p-4 shadow-[0_18px_45px_rgba(23,33,29,0.09)] backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-2xl border border-[#17483f]/14 bg-[#e6f2ed] text-[#17483f]">
          <Icon className="h-4 w-4" />
        </span>
        <span className="rounded-full border border-[#d4dacd] bg-[#f8faf6] px-2.5 py-1 text-xs font-bold text-[#4d5d56]">{trend}</span>
      </div>
      <div className="text-xs font-bold text-[#66706a]">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-[#102b27]">{value}</div>
    </div>
  );
}

function SignalCard({ label, value, tone }: { label: string; value: string; tone: "good" | "watch" | "risk" }) {
  const dot = tone === "good" ? "bg-emerald-500" : tone === "watch" ? "bg-[#c4a64f]" : "bg-red-500";
  return (
    <div className="rounded-[20px] border border-[#d9dfd7] bg-[#f8faf6] p-4">
      <div className="flex items-center gap-2 text-xs font-bold text-[#66706a]">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold tabular-nums text-[#102b27]">{value}</div>
    </div>
  );
}

function TrustItem({ icon: Icon, label }: { icon: typeof ShieldCheck; label: string }) {
  return (
    <div className="rounded-2xl border border-[#d4dacd] bg-white px-3 py-2 text-center">
      <Icon className="mx-auto h-4 w-4 text-[#17483f]" />
      <div className="mt-1 truncate text-[0.68rem] font-bold text-[#66706a]">{label}</div>
    </div>
  );
}
