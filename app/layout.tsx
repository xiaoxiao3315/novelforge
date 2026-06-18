import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "NovelForge / 小说工坊",
    template: "%s · NovelForge",
  },
  description:
    "电子书式 AI 互动小说创作工作台：生成作品设定、故事圣经、章节大纲与正文；互动模式让故事记住你的每次选择。",
  applicationName: "NovelForge",
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
