"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Boxes, ClipboardCheck, ClipboardList, Landmark, Lightbulb, LogOut, Megaphone, Package, ReceiptText, ShieldAlert, ShoppingCart, Warehouse } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { LanguageProvider, useLanguage } from "./LanguageProvider";

const navItems = [
  { href: "/dashboard", key: "nav.dashboard", icon: BarChart3 },
  { href: "/products", key: "nav.products", icon: Package },
  { href: "/inventory", key: "nav.inventory", icon: Boxes },
  { href: "/sales", key: "nav.sales", icon: ShoppingCart },
  { href: "/advertising", key: "nav.advertising", icon: Megaphone },
  { href: "/purchases", key: "nav.purchases", icon: ClipboardList },
  { href: "/expenses", key: "nav.expenses", icon: ReceiptText },
  { href: "/task-center", key: "nav.taskCenter", icon: ClipboardCheck, label: { zh: "待办中心", ko: "업무 센터" } },
  { href: "/product-development", key: "nav.productDevelopment", icon: Lightbulb, label: { zh: "产品开发中心", ko: "상품 개발 센터" } },
  { href: "/customer-issues", key: "nav.customerIssues", icon: ShieldAlert, label: { zh: "客诉问题库", ko: "고객 리뷰 센터" } },
  { href: "/settlements", key: "nav.settlements", icon: Landmark },
  { href: "/coupang-inbound", key: "nav.coupangInbound", icon: Warehouse }
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
  if (!ready) return <div className="flex min-h-screen items-center justify-center text-muted">{t("common.loading")}</div>;

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-white/10 bg-[#102b27] px-4 py-5 text-white shadow-lift lg:block">
        <div className="mb-8 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3">
          <div className="text-lg font-semibold tracking-tight">{t("app.name")}</div>
          <div className="mt-1 h-1 w-10 rounded-full bg-[#b7c7b6]" />
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                  active ? "bg-white/[0.12] text-white shadow-[inset_3px_0_0_rgba(183,199,182,0.95)]" : "text-white/72 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                <Icon size={17} className={active ? "text-[#dce7dc]" : "text-white/55 group-hover:text-[#dce7dc]"} />
                {"label" in item ? item.label[language] : t(item.key)}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-line bg-card/82 px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.55)] backdrop-blur-xl lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-2 overflow-x-auto lg:hidden">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className="erp-chip whitespace-nowrap px-3 py-2 text-xs font-semibold">
                  {"label" in item ? item.label[language] : t(item.key)}
                </Link>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <select className="h-9 min-w-28 text-xs font-semibold" value={language} onChange={(event) => setLanguage(event.target.value as "zh" | "ko")}>
                <option value="zh">{t("language.zh")}</option>
                <option value="ko">{t("language.ko")}</option>
              </select>
              <button
                className="inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-semibold erp-button-primary"
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.replace("/login");
                }}
              >
                <LogOut size={16} />
                {t("nav.logout")}
              </button>
            </div>
          </div>
        </header>
        <div className="px-4 py-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
