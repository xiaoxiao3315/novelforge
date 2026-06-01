import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NovelForge / 小说工坊",
  description: "A focused workspace for building AI-assisted novels step by step.",
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

