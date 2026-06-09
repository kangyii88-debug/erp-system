"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Boxes, CheckCircle2, CircleDollarSign, Globe2, LockKeyhole, Mail, PackageCheck, Radar, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { LanguageProvider, useLanguage } from "@/components/LanguageProvider";

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
    <main className="relative min-h-screen overflow-hidden bg-[#07120f] text-white">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:56px_56px]" />
      <div className="absolute inset-0 bg-[linear-gradient(112deg,rgba(7,18,15,0.96)_0%,rgba(10,31,27,0.88)_42%,rgba(177,151,86,0.18)_100%)]" />
      <div className="absolute left-0 top-0 h-full w-px bg-gradient-to-b from-transparent via-[#d8c27d]/50 to-transparent" />
      <div className="absolute right-[16%] top-0 h-full w-px bg-gradient-to-b from-transparent via-white/12 to-transparent" />
      <div className="absolute top-[18%] h-px w-full bg-gradient-to-r from-transparent via-[#d8c27d]/24 to-transparent" />

      <section className="relative mx-auto grid min-h-screen w-full max-w-7xl items-center gap-10 px-5 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <div className="hidden lg:block">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#d8c27d]/25 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-[#e7d89d] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-xl">
            <Sparkles className="h-3.5 w-3.5" />
            Executive Operating System
          </div>
          <h1 className="max-w-4xl text-6xl font-semibold leading-[0.95] tracking-tight text-white xl:text-7xl">
            Coupang ERP
            <span className="block bg-gradient-to-r from-white via-[#d8c27d] to-[#7dd7b6] bg-clip-text text-transparent">
              经营控制塔
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/62">
            库存、利润、补货、新品与客诉不再分散在表格和聊天记录里。登录后进入一个面向老板的实时经营驾驶舱。
          </p>

          <div className="mt-10 grid max-w-3xl grid-cols-3 gap-3">
            <HeroMetric icon={TrendingUp} label="30日利润" value="₩18.6M" trend="+24.8%" />
            <HeroMetric icon={PackageCheck} label="健康SKU" value="86%" trend="Stable" />
            <HeroMetric icon={Radar} label="风险预警" value="7" trend="Live" />
          </div>

          <div className="mt-7 max-w-3xl rounded-[28px] border border-white/12 bg-white/[0.055] p-4 shadow-[0_36px_120px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/42">Live Command Preview</div>
                <div className="mt-1 text-xl font-semibold text-white">今日经营态势</div>
              </div>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-100">ONLINE</span>
            </div>
            <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[22px] border border-white/10 bg-[#091c18]/78 p-4">
                <div className="mb-5 flex items-center justify-between text-xs text-white/45">
                  <span>Revenue Intelligence</span>
                  <span>2026 · Q2</span>
                </div>
                <div className="flex h-36 items-end gap-2">
                  {[42, 58, 46, 72, 66, 88, 76, 94, 83, 100].map((height, index) => (
                    <div key={index} className="flex flex-1 items-end rounded-full bg-white/[0.055]">
                      <div
                        className="w-full rounded-full bg-gradient-to-t from-[#17483f] via-[#39b48f] to-[#e0ca86] shadow-[0_0_24px_rgba(72,211,166,0.28)]"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <SignalCard label="补货优先级" value="P1 · 3 SKU" tone="risk" />
                <SignalCard label="新品开发" value="6 Active" tone="good" />
                <SignalCard label="客诉洞察" value="安装问题 42%" tone="watch" />
              </div>
            </div>
          </div>
        </div>

        <section className="mx-auto w-full max-w-[470px] rounded-[32px] border border-white/14 bg-white/[0.09] p-4 shadow-[0_40px_120px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
          <div className="rounded-[26px] border border-white/12 bg-[#f8f6ef]/96 p-5 text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] sm:p-6">
            <div className="mb-7 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative grid h-12 w-12 place-items-center rounded-2xl bg-[#102b27] text-white shadow-[0_18px_34px_rgba(16,43,39,0.28)]">
                  <Boxes size={22} />
                  <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[#f8f6ef] bg-[#56d79e]" />
                </div>
                <div>
                  <div className="text-lg font-semibold tracking-tight">{t("app.name")}</div>
                  <div className="mt-0.5 text-xs font-medium text-ink/55">Executive Command Login</div>
                </div>
              </div>
              <select className="h-9 min-w-24 border-[#d8d4c4] bg-white/75 text-xs font-semibold" value={language} onChange={(event) => setLanguage(event.target.value as "zh" | "ko")}>
                <option value="zh">{t("language.zh")}</option>
                <option value="ko">{t("language.ko")}</option>
              </select>
            </div>

            <div className="mb-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d8c27d]/35 bg-[#fffaf0] px-3 py-1 text-xs font-bold text-[#8a6834]">
                <ShieldCheck className="h-3.5 w-3.5" />
                Secure ERP Access
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink">进入经营中枢</h2>
              <p className="mt-2 text-sm leading-6 text-muted">登录后查看库存风险、利润走势、待办执行、新品开发和客诉洞察。</p>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-muted">{t("auth.email")}</span>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input className="premium-input h-12 w-full pl-10 font-medium" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-muted">{t("auth.password")}</span>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    className="premium-input h-12 w-full pl-10 font-medium"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
              </label>
              {message ? <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{message}</div> : null}
              <div className="grid gap-3 sm:grid-cols-[1fr_0.82fr]">
                <button
                  disabled={busy}
                  className="group inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#102b27] px-4 text-sm font-bold text-white shadow-[0_18px_32px_rgba(16,43,39,0.24)] disabled:opacity-50"
                  onClick={() => submit("signin")}
                >
                  {busy ? "Processing" : t("auth.signIn")}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </button>
                <button
                  disabled={busy}
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-[#d8d4c4] bg-white/80 px-4 text-sm font-bold text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] disabled:opacity-50"
                  onClick={() => submit("signup")}
                >
                  {t("auth.signUp")}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2">
                <TrustItem icon={ShieldCheck} label="Encrypted" />
                <TrustItem icon={Globe2} label="Cloud ERP" />
                <TrustItem icon={CheckCircle2} label="Realtime" />
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
    <div className="rounded-[22px] border border-white/10 bg-white/[0.06] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-2xl border border-[#d8c27d]/20 bg-[#d8c27d]/10 text-[#f0dda0]">
          <Icon className="h-4 w-4" />
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-bold text-white/62">{trend}</span>
      </div>
      <div className="text-xs font-semibold text-white/45">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-white">{value}</div>
    </div>
  );
}

function SignalCard({ label, value, tone }: { label: string; value: string; tone: "good" | "watch" | "risk" }) {
  const dot = tone === "good" ? "bg-emerald-300" : tone === "watch" ? "bg-[#d8c27d]" : "bg-red-300";
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.055] p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-white/45">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function TrustItem({ icon: Icon, label }: { icon: typeof ShieldCheck; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white/55 px-3 py-2 text-center">
      <Icon className="mx-auto h-4 w-4 text-[#17483f]" />
      <div className="mt-1 truncate text-[0.68rem] font-bold text-muted">{label}</div>
    </div>
  );
}
