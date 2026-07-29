# 反旗 / FlagBreaker

> 立 flag 的人千千万，倒 flag 的你一个。
>
> 一个嘴毒心软的 AI 损友，盯你把事做完。

反向自律 App MVP：完成目标 → AI 夸夸；没完成 → AI 毒舌调侃。基于人设化反差陪伴驱动自律，避开羞辱/社死等合规风险。

技术栈：Next.js 14 (App Router) + Supabase + 豆包 API（火山方舟 Ark）。

## 目录结构

```
toclick/
├── flag_breaker_ai_persona.md      # AI 人设 system prompt + 51 条样本
├── flag_breaker_ui_copy_layout.md  # 首页文案 + 页面布局设计
├── flag_breaker_schema.sql         # Supabase 数据库 schema
├── package.json
├── .env.local.example
└── src/
    ├── app/
    │   ├── layout.tsx              # 根布局
    │   ├── page.tsx                # 落地页
    │   ├── globals.css             # 全局样式 + Tailwind
    │   ├── login/page.tsx          # 邮箱登录
    │   ├── auth/callback/route.ts  # Magic link 回调
    │   ├── dashboard/
    │   │   ├── layout.tsx          # 鉴权
    │   │   └── page.tsx            # 打卡首页
    │   ├── goals/new/page.tsx      # 设目标
    │   ├── report/page.tsx         # 7 日报告
    │   ├── settings/page.tsx       # 设置
    │   └── api/
    │       ├── checkin/route.ts    # 打卡 + 调 AI
    │       └── ai-feedback/route.ts # 用户偏好采集
    ├── components/
    │   ├── Header.tsx
    │   ├── GoalCard.tsx
    │   ├── AIFeedbackCard.tsx
    │   └── Toast.tsx
    ├── lib/
    │   ├── constants.ts            # 目标/难度/状态枚举
    │   ├── types.ts                # 数据库行类型
    │   ├── supabase/
    │   │   ├── client.ts           # 浏览器端
    │   │   ├── server.ts           # 服务端
    │   │   └── middleware.ts       # session 刷新
    │   └── ai/
    │       ├── persona.ts          # System prompt + Few-Shot
    │       └── doubao.ts           # 豆包 API 封装
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
- [ ] 设置页可关闭毒舌模式
- [ ] 设置页可清空失败记录

### 6. 部署到 Vercel

1. 推到 GitHub
2. 在 Vercel 导入该仓库
3. 在 Vercel 项目设置里配置环境变量（同 `.env.local`）
4. `NEXT_PUBLIC_SITE_URL` 改成 Vercel 域名
5. Supabase `URL Configuration` 里把 Site URL 也改成 Vercel 域名

## 关键设计说明

- **保护模式**：用户连续失败 ≥3 天（`PROTECTION_MODE_THRESHOLD`），AI 自动切纯夸夸；未成年（<18 岁）强制纯夸夸。判定逻辑在 [doubao.ts](./src/lib/ai/doubao.ts) 后端再做一次，不依赖 AI 自觉。
- **洗白机制**：连续达标 7 天（`CLEAN_STREAK_DAYS`）自动清空该目标的 failed 记录。
- **敏感词过滤**：豆包 API 已过滤 + 本地 [persona.ts](./src/lib/ai/persona.ts) `BANNED_WORDS` 二次过滤。
- **RLS**：所有表开启 Row Level Security，用户只能读写自己的数据。
- **审计日志**：每次 AI 反馈都写入 `ai_feedback_logs`，存了 `consecutive_fail` 快照，便于事后核查保护机制是否生效。
- **用户偏好采集**：反馈卡片的"哈哈/👎"会 PATCH 到 `user_reaction` 字段，用于后续优化 prompt。

## MVP 范围说明

本版本对应 v0.1 MVP，只做：
- 1 个 AI 人设（损友型）
- 3 类目标（早起 / 健身 / 学习）
- 邮箱登录（无社交登录）
- 文本反馈（无语音）
- 不做社交、不做重度羞辱、不做付费

验证通过后再做 P1：第 2/3 个 AI 人设、主动分享卡片、好友互损。

## 已知限制

- 周报（`weekly_reports` 表）目前没有自动生成任务，需手动触发或后续接 Supabase Edge Function / cron。
- 当日未打卡时目前不会自动写 `failed` 记录，需要后续加定时任务（每天 23:59 把未打卡的活跃目标标记为 failed）。
- 移动端没有做 PWA / 推送，召回手段（公众号模板消息）待接入。
