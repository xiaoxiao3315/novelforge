import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NovelForge / 小说工坊",
  description: "电子书式 AI 互动小说创作工作台。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
