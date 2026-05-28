import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coupang Inventory ERP",
  description: "Lightweight inventory ERP for Korean ecommerce teams"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
