# 反旗 / FlagBreaker

> 立 flag 的人千千万，倒 flag 的你一个。
>
> 一个嘴毒心软的 AI 损友，盯你把事做完。

反向自律 App MVP：完成目标 → AI 夸夸；没完成 → AI 毒舌调侃。基于人设化反差陪伴驱动自律，避开羞辱/社死等合规风险。

技术栈：Next.js 14 (App Router) + Supabase + 豆包 API（火山方舟 Ark）。

## 目录结构

```
toclick/
├── flag_breaker_ai_persona.md      # AI 人设 system prompt + 样本
├── flag_breaker_ui_copy_layout.md  # 首页文案 + 页面布局设计
├── flag_breaker_schema.sql         # Supabase 数据库 schema（含迁移合并）
├── AGENTS.md                       # AI 编码助手项目指引
├── package.json
├── .env.local.example
├── migrations/                     # 增量数据库迁移
│   ├── 001_add_created_at_to_view.sql
│   ├── 002_fix_weekly_reports_schema.sql
│   └── 003_add_persona_to_users.sql
├── public/
│   ├── manifest.json               # PWA 清单
│   ├── sw.js                       # Service Worker 离线缓存
│   └── icon-512.png                # App 图标
└── src/
    ├── app/
    │   ├── layout.tsx              # 根布局（PWA metadata + SW 注册）
    │   ├── page.tsx                # 落地页
    │   ├── globals.css             # 全局样式 + Tailwind
    │   ├── login/page.tsx          # 邮箱登录
    │   ├── auth/callback/route.ts  # Magic link 回调
    │   ├── dashboard/
    │   │   ├── layout.tsx          # 鉴权
    │   │   └── page.tsx            # 打卡首页（离线队列 + 同步）
    │   ├── goals/new/page.tsx      # 设目标
    │   ├── report/page.tsx         # 7 日报告（多目标 + 感想 + 分享）
    │   ├── settings/page.tsx       # 设置（AI 人设选择器 + 昵称）
    │   └── api/
    │       ├── checkin/
    │       │   ├── route.ts        # 打卡 + 调 AI（支持 PATCH 感想）
    │       │   └── sync/route.ts   # 离线打卡同步
    │       ├── ai-feedback/route.ts # AI 反馈偏好采集（传 persona）
    │       └── cron/route.ts       # 定时任务：周报生成 + 失败打卡标记
    ├── components/
    │   ├── Header.tsx
    │   ├── GoalCard.tsx            # 目标卡（失败打卡 AI 反馈）
    │   ├── AIFeedbackCard.tsx      # AI 反馈卡（打卡感想输入）
    │   ├── Toast.tsx
    │   ├── SWRegister.tsx          # Service Worker 注册
    │   └── OfflineBanner.tsx       # 离线状态提示条
    ├── lib/
    │   ├── constants.ts            # 目标/难度/状态枚举
    │   ├── types.ts                # 数据库行类型
    │   ├── offlineQueue.ts         # localStorage 离线打卡队列
    │   ├── supabase/
    │   │   ├── client.ts           # 浏览器端
    │   │   ├── server.ts           # 服务端
    │   │   └── middleware.ts       # session 刷新
    │   └── ai/
    │       ├── persona.ts          # System prompt + Few-Shot（bro + senpai 双人设）
    │       └── doubao.ts           # 豆包 API 封装（支持 persona 参数）
    └── middleware.ts               # 根中间件
```

## 部署步骤

### 1. 准备 Supabase

1. 去 [supabase.com](https://supabase.com) 新建项目
2. 进入项目 Dashboard → `SQL Editor`
3. 粘贴 [flag_breaker_schema.sql](./flag_breaker_schema.sql) 全部内容 → Run
4. 左侧 `Authentication` → `Providers` → 启用 `Email`
5. 左侧 `Authentication` → `URL Configuration` → Site URL 填 `http://localhost:3000`（本地）或你的域名
6. 在 `Project Settings` → `API` 拿到：
   - `Project URL` → 对应 `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → 对应 `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2. 准备豆包 API（火山方舟 Ark）

1. 去 [console.volcengine.com/ark](https://console.volcengine.com/ark)
2. 创建 API Key → 对应 `ARK_API_KEY`
3. 在模型广场找一个 doubao-pro 系列模型（如 `doubao-pro-32k`）→ 对应 `ARK_MODEL`
4. 默认 base url 已是 `https://ark.cn-beijing.volces.com/api/v3`，无需改

### 3. 配置环境变量

```bash
cp .env.local.example .env.local
```

编辑 `.env.local`，填入上面拿到的 5 个值。

### 4. 安装 & 启动

```bash
npm install
npm run dev
```

打开 http://localhost:3000

### 5. 验证清单

- [ ] 落地页正常显示
- [ ] 邮箱收到 magic link，点击后跳转到 /dashboard
- [ ] 在 /goals/new 设一个目标，提交后回到 /dashboard 看到该目标
- [ ] 点"✓ 打了"，弹出 AI 反馈卡片
- [ ] 反馈卡片文案符合人设（损友语气、不超过 60 字、有 emoji）
- [ ] 连续失败 ≥3 天时，AI 自动切纯夸夸模式（可手动构造数据测）
- [ ] 设置页可切换 AI 人设（bro ↔ senpai）
- [ ] 设置页可关闭毒舌模式
- [ ] 设置页可清空失败记录
- [ ] 断开网络后打卡，恢复网络后自动同步
- [ ] 周报页可查看多目标周报 + 打卡感想

### 6. 部署到 Vercel

1. 推到 GitHub
2. 在 Vercel 导入该仓库
3. 在 Vercel 项目设置里配置环境变量（同 `.env.local`）
4. `NEXT_PUBLIC_SITE_URL` 改成 Vercel 域名
5. Supabase `URL Configuration` 里把 Site URL 也改成 Vercel 域名

## 关键设计说明

- **双人设**：AI 支持「损友 bro」和「冷淡御姐 senpai」两种人设，用户可在设置页切换。不同人设有独立的 System Prompt + Few-Shot 样本。
- **保护模式**：用户连续失败 ≥3 天（`PROTECTION_MODE_THRESHOLD`），AI 自动切纯夸夸；未成年（<18 岁）强制纯夸夸。判定逻辑在 [doubao.ts](./src/lib/ai/doubao.ts) 后端再做一次，不依赖 AI 自觉。
- **洗白机制**：连续达标 7 天（`CLEAN_STREAK_DAYS`）自动清空该目标的 failed 记录。
- **敏感词过滤**：豆包 API 已过滤 + 本地 [persona.ts](./src/lib/ai/persona.ts) `BANNED_WORDS` 二次过滤。
- **RLS**：所有表开启 Row Level Security，用户只能读写自己的数据。
- **审计日志**：每次 AI 反馈都写入 `ai_feedback_logs`，存了 `consecutive_fail` 快照，便于事后核查保护机制是否生效。
- **用户偏好采集**：反馈卡片的"哈哈/👎"会 PATCH 到 `user_reaction` 字段，用于后续优化 prompt。
- **离线支持 (PWA)**：Service Worker 多策略缓存 + localStorage 离线打卡队列，断网不丢打卡。
- **定时任务 (Cron)**：`/api/cron` 支持 Vercel Cron Job 调用，自动生成周报 + 标记失败打卡。

## MVP 范围说明

本版本对应 v0.1 MVP，已实现：
- 2 个 AI 人设（损友 bro + 冷淡御姐 senpai）
- 3 类目标（早起 / 健身 / 学习）
- 邮箱登录（无社交登录）
- 文本反馈（无语音）
- PWA 离线支持
- 定时任务：周报自动生成 + 失败打卡自动标记
- 打卡感想输入
- 多目标周报 + Web Share 分享

P1 规划：音色支持、好友互损、IAP 付费人设。
