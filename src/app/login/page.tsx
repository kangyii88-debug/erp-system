"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Boxes, CheckCircle2, Globe2, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { LanguageProvider, useLanguage } from "@/components/LanguageProvider";
import type { Language } from "@/lib/types";

const loginCopy = {
  zh: {
    eyebrow: "经营管理系统",
    titleMain: "Coupang ERP",
    titleAccent: "经营控制台",
    subtitle: "把库存、利润、补货、新品开发和客诉问题集中到一个清晰的经营入口。",
    loginSubtitle: "登录后进入经营管理后台",
    secure: "安全访问",
    enterTitle: "进入系统",
    enterText: "查看库存风险、利润趋势、待办执行、新品开发和客户问题。",
    encrypted: "加密",
    cloud: "云端",
    realtime: "实时",
    processing: "处理中"
  },
  ko: {
    eyebrow: "경영관리 시스템",
    titleMain: "Coupang ERP",
    titleAccent: "경영관리 시스템",
    subtitle: "재고, 이익, 발주, 신상품 개발, 고객 이슈를 하나의 명확한 운영 입구로 모읍니다.",
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
  const titleAccentClass = language === "ko" ? "text-[2.85rem] leading-[1.12] xl:text-[3.12rem]" : "text-[3.18rem] leading-[1.06] xl:text-[3.48rem]";
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
      <div className="absolute inset-0 bg-[linear-gradient(rgba(23,72,63,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(23,72,63,0.05)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(42,128,103,0.14),transparent_25rem),radial-gradient(circle_at_82%_20%,rgba(188,167,122,0.18),transparent_28rem),linear-gradient(135deg,#fafbf6_0%,#edf2ec_52%,#e7eee8_100%)]" />

      <section className="relative mx-auto grid min-h-screen w-full max-w-6xl items-center gap-12 px-5 py-10 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 xl:py-14">
        <div className="mx-auto w-full max-w-[640px] lg:mx-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#17483f]/16 bg-white/78 px-3 py-1.5 text-xs font-bold tracking-[0.08em] text-[#17483f] shadow-[0_12px_30px_rgba(23,33,29,0.06)] backdrop-blur-xl">
            <ShieldCheck className="h-3.5 w-3.5" />
            {copy.eyebrow}
          </div>

          <h1 className="mt-7 tracking-tight text-[#102b27]">
            <span className="block text-[3.85rem] font-semibold leading-[0.98] xl:text-[4.08rem]">{copy.titleMain}</span>
            <span className={`mt-2 block font-semibold text-[#2d8169] ${titleAccentClass}`}>{copy.titleAccent}</span>
          </h1>
          <p className="mt-5 max-w-[560px] text-base font-medium leading-7 text-[#4d5d56]">{copy.subtitle}</p>
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

function TrustItem({ icon: Icon, label }: { icon: typeof ShieldCheck; label: string }) {
  return (
    <div className="rounded-2xl border border-[#d4dacd] bg-white px-3 py-2 text-center">
      <Icon className="mx-auto h-4 w-4 text-[#17483f]" />
      <div className="mt-1 truncate text-[0.68rem] font-bold text-[#66706a]">{label}</div>
    </div>
  );
}
