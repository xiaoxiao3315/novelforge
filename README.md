# NovelForge / 小说工坊

NovelForge 是一个内部使用的互动小说生成工作台。当前交付版本默认使用内部单用户模式：登录只设置服务端内部会话 cookie，项目数据写入服务器本地 JSON 文件，AI 生成仍使用 DeepSeek。

## 当前能力

- 内部单用户登录，不依赖 Supabase Auth。
- 服务器本地 JSON 持久化，默认文件为 `INTERNAL_DATA_DIR/novelforge-store.json`。
- Dashboard 项目列表、创建项目、项目工作台。
- DeepSeek 生成作品设定、故事圣经、角色卡、章节大纲、章节正文和章节分歧。
- 经典小说模式与互动剧情模式。
- 章节预加载、章节解锁阅读、章节版本、正式稿确认。
- Supabase 数据库和计费 RPC 代码仍保留为兼容路径，但内部交付不要求启用 Supabase。

## 内部部署环境变量

复制 `.env.example` 为部署环境文件，例如服务器上的 `.env.production.local`。

内部模式最少需要：

```bash
INTERNAL_AUTH_ENABLED=true
INTERNAL_DATA_DIR=/opt/novelforge/shared/internal-data

DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash

ENABLE_MOCK_PAYMENTS=false
ENABLE_AUTO_CHAPTER_DECISION=false
```

`INTERNAL_DATA_DIR` 必须指向可持久化目录。不要放在 `.next/`、临时目录或 Vercel/serverless 文件系统中。

## 本地运行

```bash
npm install
npm run dev
```

默认开发端口是 `3300`，打开：

```text
http://127.0.0.1:3300
```

## 生产运行

```bash
npm ci
npm run build
npm run start
```

`npm run start` 会监听 `127.0.0.1:3300`，适合放在 PM2/Nginx 后面运行。

## 验证命令

```bash
npm run typecheck
npm run lint
npm run build
npm audit --audit-level=high
```

## Supabase 兼容路径

如果以后要恢复 Supabase Auth/数据库模式，需要额外配置：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

并执行 `supabase/migrations` 下的迁移。内部模式不需要这些变量。

## 安全说明

- 不要提交 `.env.local`、`.env.production.local` 或任何真实密钥。
- `ENABLE_MOCK_PAYMENTS` 生产环境保持 `false`。
- 当前内部模式是单用户工作台，不适合作为多用户公网产品直接开放。
- Vercel/serverless 不适合当前本地 JSON 持久化方案；如要部署官方网址，建议使用自建服务器持久磁盘，或改回数据库持久化。
