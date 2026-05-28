"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Boxes } from "lucide-react";
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
    <main className="grid min-h-screen place-items-center bg-panel px-4">
      <section className="w-full max-w-md rounded border border-line bg-white p-6 shadow-soft">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded bg-brand text-white">
              <Boxes size={22} />
            </div>
            <div>
              <div className="text-lg font-semibold">{t.appName}</div>
              <div className="text-sm text-ink/60">Korea ecommerce operations</div>
            </div>
          </div>
          <select value={language} onChange={(event) => setLanguage(event.target.value as "zh" | "ko")}>
            <option value="zh">中文</option>
            <option value="ko">한국어</option>
          </select>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{t.email}</span>
            <input className="w-full" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{t.password}</span>
            <input
              className="w-full"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {message ? <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{message}</div> : null}
          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={busy}
              className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              onClick={() => submit("signin")}
            >
              {t.signIn}
            </button>
            <button
              disabled={busy}
              className="rounded border border-line bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
              onClick={() => submit("signup")}
            >
              {t.signUp}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
