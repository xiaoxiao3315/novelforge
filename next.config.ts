import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // 上级目录存在 pnpm-lock.yaml，显式固定 workspace root，避免 Next 误判。
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
