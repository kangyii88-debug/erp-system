"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Landmark,
  Lightbulb,
  LogOut,
  Megaphone,
  Package,
  PackageSearch,
  ReceiptText,
  Ruler,
  Scale,
  ShieldAlert,
  ShoppingCart,
  Warehouse
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { LanguageProvider, useLanguage } from "./LanguageProvider";

const navItemsById = {
  dashboard: { href: "/dashboard", icon: BarChart3, label: { zh: "数据看板", ko: "데이터 대시보드" } },
  tasks: { href: "/task-center", icon: ClipboardCheck, label: { zh: "待办中心", ko: "업무 센터" } },
  products: { href: "/products", icon: Package, label: { zh: "商品管理", ko: "상품 관리" } },
  inventory: { href: "/inventory", icon: Boxes, label: { zh: "库存管理", ko: "재고 관리" } },
  sales: { href: "/sales", icon: ShoppingCart, label: { zh: "销售管理", ko: "판매 관리" } },
  advertising: { href: "/advertising", icon: Megaphone, label: { zh: "广告分析", ko: "광고 분석" } },
  purchases: { href: "/purchases", icon: ClipboardList, label: { zh: "采购管理", ko: "구매 관리" } },
  inbound: { href: "/coupang-inbound", icon: Warehouse, label: { zh: "入仓记录", ko: "입고 기록" } },
  development: { href: "/product-development", icon: Lightbulb, label: { zh: "产品开发", ko: "상품 개발" } },
  competitors: { href: "/competitor-products", icon: PackageSearch, label: { zh: "竞品采集", ko: "경쟁 상품 수집" } },
  productTest: { href: "/single-product-report", icon: FileText, label: { zh: "商品测试", ko: "상품 테스트" } },
  packaging: { href: "/sku-packaging-specs", icon: Ruler, label: { zh: "SKU 包装规格", ko: "SKU 포장 규격" } },
  customerIssues: { href: "/customer-issues", icon: ShieldAlert, label: { zh: "客诉问题", ko: "고객 리뷰" } },
  settlements: { href: "/settlements", icon: Landmark, label: { zh: "结算中心", ko: "정산 센터" } },
  expenses: { href: "/expenses", icon: ReceiptText, label: { zh: "支出报表", ko: "지출 리포트" } },
  tax: { href: "/tax-compliance", icon: Scale, label: { zh: "税务合规", ko: "세무 컴플라이언스" } }
} as const;

type NavItem = (typeof navItemsById)[keyof typeof navItemsById];

const topNavItems: NavItem[] = [
  navItemsById.dashboard,
  navItemsById.tasks
];

const navGroups: Array<{ label: { zh: string; ko: string }; items: NavItem[] }> = [
  {
    label: { zh: "核心运营", ko: "핵심 운영" },
    items: [navItemsById.products, navItemsById.inventory, navItemsById.sales, navItemsById.advertising]
  },
  {
    label: { zh: "供应链", ko: "공급망" },
    items: [navItemsById.purchases, navItemsById.inbound]
  },
  {
    label: { zh: "产品资产", ko: "상품 자산" },
    items: [navItemsById.development, navItemsById.competitors, navItemsById.productTest, navItemsById.packaging, navItemsById.customerIssues]
  },
  {
    label: { zh: "财务合规", ko: "재무 컴플라이언스" },
    items: [navItemsById.settlements, navItemsById.expenses, navItemsById.tax]
  }
];

const navItems: NavItem[] = [
  ...topNavItems,
  ...navGroups.flatMap((group) => group.items)
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <ProtectedShell>{children}</ProtectedShell>
    </LanguageProvider>
  );
}

function SidebarLink({ item, active, language }: { item: NavItem; active: boolean; language: "zh" | "ko" }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={`group relative flex h-10 items-center gap-3 rounded-[10px] px-[14px] text-sm transition ${
        active
          ? "bg-white font-semibold text-[#111827] shadow-[0_10px_26px_rgba(0,0,0,0.18)]"
          : "font-medium text-[#d1d5db] hover:bg-white/[0.08] hover:text-white"
      }`}
    >
      <Icon size={16} className={active ? "text-[#111827]" : "text-white/40 group-hover:text-white/75"} />
      <span className="truncate">{item.label[language]}</span>
    </Link>
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
      <aside className="fixed inset-y-0 left-0 hidden w-60 overflow-y-auto border-r border-white/10 bg-[#111827] px-4 py-5 text-[#d1d5db] shadow-[10px_0_36px_rgba(17,24,39,0.10)] lg:block">
        <div className="mb-6 flex h-[72px] flex-col justify-center rounded-2xl border border-white/10 bg-white/[0.045] px-4">
          <div className="text-[15px] font-bold tracking-tight text-white">Coupang ERP</div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Inventory OS</div>
        </div>
        <nav className="space-y-1">
          <div className="space-y-1">
            {topNavItems.map((item) => (
              <SidebarLink key={item.href} item={item} active={pathname === item.href} language={language} />
            ))}
          </div>

          {navGroups.map((group) => (
            <div key={group.label.zh} className="pt-[18px]">
              <div className="mb-2 px-[14px] text-xs font-semibold text-white/35">{group.label[language]}</div>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <SidebarLink key={item.href} item={item} active={pathname === item.href} language={language} />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <main className="lg:pl-60">
        <header className="sticky top-0 z-10 border-b border-line bg-white/82 px-4 py-3 shadow-[0_1px_0_rgba(17,24,39,0.03)] backdrop-blur-xl lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-2 overflow-x-auto lg:hidden">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className="erp-chip whitespace-nowrap px-3 py-2 text-xs font-semibold">
                  {item.label[language]}
                </Link>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <select className="h-9 min-w-28 rounded-[10px] border border-line bg-white px-3 text-xs font-semibold text-ink shadow-[0_4px_14px_rgba(17,24,39,0.04)]" value={language} onChange={(event) => setLanguage(event.target.value as "zh" | "ko")}>
                <option value="zh">{t("language.zh")}</option>
                <option value="ko">{t("language.ko")}</option>
              </select>
              <button
                className="inline-flex h-9 items-center gap-2 rounded-[10px] px-3 text-sm font-semibold erp-button-primary"
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
        <div className="px-4 py-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
