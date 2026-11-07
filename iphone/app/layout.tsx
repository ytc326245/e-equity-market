import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "纸上美股 · iPhone",
  description: "手机独立运行的美股与 ETF 模拟交易工具，账户保存在手机。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
