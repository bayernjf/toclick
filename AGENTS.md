# 反旗 / FlagBreaker — AI Agent 项目指引

## 项目概述

反向自律 App：AI 人设化监督打卡工具。完成目标 → AI 夸夸；没完成 → AI 毒舌调侃。

技术栈：**Next.js 14 (App Router) + Supabase + 豆包 API (火山方舟 Ark)**

## 架构速览

```
用户浏览器 (Client)
  ├── Supabase Client ←→ Supabase (Auth + DB)
  ├── /api/checkin     ←→ 豆包 AI 反馈
  ├── /api/cron        ←→ Vercel Cron (周报 + 失败标记)
  └── Service Worker   ←→ 离线缓存 + 离线打卡队列
```

## 关键约定

### 1. 数据库
- **Supabase PostgreSQL**，所有表开启 RLS，用户只能读写自己的数据
- Schema 基准文件：`flag_breaker_schema.sql`
- 增量迁移在 `migrations/` 目录，命名格式 `NNN_描述.sql`
- 每次修改 schema 后，同步更新基准文件和迁移文件

### 2. 环境变量
- `.env.local.example` 为模板，新增变量必须同步添加到该文件
- 服务端 API Key（`ARK_API_KEY`、`CRON_SECRET`）不加 `NEXT_PUBLIC_` 前缀
- 浏览器端变量加 `NEXT_PUBLIC_` 前缀

### 3. AI 人设
- 双人设系统：`bro`（损友）+ `senpai`（冷淡御姐），定义在 `src/lib/ai/persona.ts`
- 每个人设有独立的 System Prompt + Few-Shot 样本
- `doubao.ts` 接收 `persona` 参数，按需加载对应 prompt
- 新增人设步骤：
  1. 在 `PersonaId` 类型中添加新 ID
  2. 在 `PERSONA_MAP` 中添加元数据
  3. 编写 System Prompt + Few-Shot 样本
  4. 在 `getPersonaSystemPrompt` / `getPersonaFewShot` 中添加分支

### 4. 安全与合规
- **保护模式**：连续失败 ≥3 天强制纯夸夸；未成年 (<18) 强制纯夸夸
- **敏感词过滤**：`BANNED_WORDS` 本地二次过滤，豆包 API 侧也有过滤
- **RLS**：所有表开启行级安全
- **Cron 鉴权**：`/api/cron` 通过 `CRON_SECRET` 请求头鉴权

### 5. PWA 离线
- Service Worker：`public/sw.js`，多策略缓存
- 离线打卡队列：`src/lib/offlineQueue.ts`（localStorage）
- 网络恢复后通过 `/api/checkin/sync` 同步
- Dashboard 启动时自动触发 `replayQueue()`

### 6. 代码风格
- TypeScript 严格模式，所有 API 返回必须带 `ok` 字段
- API 路由用 `NextRequest` + `NextResponse`
- 组件用函数式 + Hooks
- 样式用 Tailwind CSS，自定义颜色在 `tailwind.config.js`
- Commit 信息用英文，按原子规则拆分

## 常用命令

```bash
npm run dev         # 本地开发
npm run build       # 生产构建
npm run lint        # ESLint
npm run type-check  # TypeScript 类型检查
```

## 部署

- **Vercel** 为主部署平台
- 需要在 Vercel 项目 Settings → Environment Variables 中配置所有 `.env.local.example` 中的变量
- 需要在 `vercel.json` 或 Dashboard 中配置 Cron Job 触发 `/api/cron`

## 文件索引

| 文件 | 用途 |
|------|------|
| `flag_breaker_schema.sql` | 数据库 Schema 基准（含所有迁移合并） |
| `migrations/` | 增量迁移 SQL |
| `flag_breaker_ai_persona.md` | AI 人设设计文档 |
| `flag_breaker_ui_copy_layout.md` | UI 文案与布局设计 |
| `.env.local.example` | 环境变量模板 |
| `public/sw.js` | Service Worker |
| `public/manifest.json` | PWA 清单 |
| `src/lib/types.ts` | TypeScript 类型定义 |
| `src/lib/constants.ts` | 常量与枚举 |
| `src/lib/ai/persona.ts` | AI 人设定义 |
| `src/lib/ai/doubao.ts` | 豆包 API 封装 |
| `src/lib/offlineQueue.ts` | 离线打卡队列 |
| `src/lib/supabase/` | Supabase 客户端 |
| `src/app/api/cron/route.ts` | 定时任务 |
| `src/app/api/checkin/sync/route.ts` | 离线同步 |
| `src/app/report/page.tsx` | 周报页 |
| `src/app/settings/page.tsx` | 设置页 |
