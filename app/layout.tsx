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
  // 防白闪：首屏绘制前从 localStorage 读取主题/字号/沉浸模式并写到 <html>，
  // 避免刷新时先显示浅色再跳到夜间，或沉浸布局先闪一下。
  // key 与 ThemeController / ReadingFocusToggle 一致。
  const themeInitScript = `(function(){try{var t=localStorage.getItem('nf-theme');if(t==='sepia'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}var f=localStorage.getItem('nf-reader-font-scale');if(f){document.documentElement.style.setProperty('--reader-font-scale',f);}var m=localStorage.getItem('nf-focus-mode');if(m==='on'){document.documentElement.setAttribute('data-focus-mode','on');}}catch(e){}})();`;

  return (
    <html lang="zh-CN">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
