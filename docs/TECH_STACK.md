# 技术栈 — toclick（反旗 / FlagBreaker）

更新时间：2026-09-09

## 概览

反向自律 App：完成目标 → AI 夸夸；没完成 → AI 毒舌调侃。用「人设化反差陪伴」驱动自律，
避开羞辱 / 社死等合规风险。package.json 里的包名是 `flag-breaker`。

## 技术选型

| 层            | 选型                                                  |
| ------------- | ----------------------------------------------------- |
| 框架          | Next.js 14（App Router）                              |
| 语言          | TypeScript 5.6                                        |
| 数据库 / 认证 | Supabase（`@supabase/supabase-js` + `@supabase/ssr`） |
| AI            | 豆包 API（火山方舟 Ark）                              |
| 样式          | Tailwind CSS 3 + PostCSS                              |
| 监控          | Sentry（`sentry.client/edge/server.config.ts`）       |
| 推送          | Web Push（`web-push`）                                |
| 校验          | zod                                                   |
| 测试          | Vitest（单测）+ Playwright（E2E，`e2e/`）             |
| 工程          | husky + lint-staged + ESLint + Prettier               |

## 常用命令

```bash
npm run dev        # 开发服务器
npm run build      # 生产构建
npm run start      # 启动构建产物
npm run lint       # next lint
npm run type-check # tsc --noEmit
npm test           # vitest run
npm run test:e2e   # playwright test
```

## 目录结构

```
src/
  app/           # App Router 路由与页面
  components/    # UI 组件
  lib/           # Supabase、AI、推送等封装
  middleware.ts  # 鉴权等中间件
  instrumentation.ts
api 路由：/api/checkin（AI 反馈）、/api/goals/[id]（CRUD）、/api/push（订阅）、
        /api/cron（Vercel Cron：周报 + 失败标记 + 推送）、/api/og（@vercel/og 生成 OG 图）、
        /api/iap（内购占位）
migrations/      # 增量数据库迁移（001 起顺序编号）
根目录：flag_breaker_ai_persona.md（AI 人设 prompt）、flag_breaker_ui_copy_layout.md（文案与布局）、
       flag_breaker_schema.sql（初始 schema）
```

## 注意点

- 数据库变更走 `migrations/` 增量文件，**不要**直接改 `flag_breaker_schema.sql`。
- AI 人设与文案分别在根目录两个 md 里，改 prompt / 首页文案时同步更新，避免和产品表现脱节。
- 涉及「毒舌」文案要守住合规边界：调侃而非羞辱，不做社死式公开。
- 详细项目指引见根目录 `AGENTS.md`、`README.md` 与 `handoff.md`。
