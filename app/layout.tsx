import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NovelForge / 小说工坊",
  description: "互动小说生成工作台，用 DeepSeek 生成设定、大纲和章节正文。",
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
