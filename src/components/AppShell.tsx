"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Boxes, ClipboardList, FileSpreadsheet, LogOut, Package, ShoppingCart } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { LanguageProvider, useLanguage } from "./LanguageProvider";

const navItems = [
  { href: "/dashboard", key: "dashboard", icon: BarChart3 },
  { href: "/products", key: "products", icon: Package },
  { href: "/inventory", key: "inventory", icon: Boxes },
  { href: "/sales", key: "sales", icon: ShoppingCart },
  { href: "/purchases", key: "purchases", icon: ClipboardList },
  { href: "/import-export", key: "importExport", icon: FileSpreadsheet }
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <ProtectedShell>{children}</ProtectedShell>
    </LanguageProvider>
  );
}

function ProtectedShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();
  const [ready, setReady] = useState(pathname === "/login");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session && pathname !== "/login") {
        router.replace("/login");
      } else if (data.session && pathname === "/login") {
        router.replace("/dashboard");
      } else {
        setReady(true);
      }
    });
  }, [pathname, router]);

  if (pathname === "/login") return <>{children}</>;
  if (!ready) return <div className="flex min-h-screen items-center justify-center">{t.loading}</div>;

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-panel px-4 py-5 lg:block">
        <div className="mb-8 text-xl font-semibold text-ink">{t.appName}</div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded px-3 py-2 text-sm font-medium ${
                  active ? "bg-brand text-white" : "text-ink hover:bg-white"
                }`}
              >
                <Icon size={18} />
                {t[item.key]}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-line bg-panel/95 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-2 overflow-x-auto lg:hidden">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className="whitespace-nowrap rounded bg-white px-3 py-2 text-xs">
                  {t[item.key]}
                </Link>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <select value={language} onChange={(event) => setLanguage(event.target.value as "zh" | "ko")}>
                <option value="zh">中文</option>
                <option value="ko">한국어</option>
              </select>
              <button
                className="inline-flex items-center gap-2 rounded bg-ink px-3 py-2 text-sm font-medium text-white"
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.replace("/login");
                }}
              >
                <LogOut size={16} />
                {t.logout}
              </button>
            </div>
          </div>
        </header>
        <div className="px-4 py-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
