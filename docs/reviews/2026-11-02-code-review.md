# 代码评审报告 — toclick（反旗 / FlagBreaker）

- 评审日期：2026-11-02
- 评审方式：只读静态审查 + 本地验证门实跑（lint / type-check / vitest / next build / npm audit）
- 评审范围：全仓（src/、e2e/、supabase/migrations/、flag_breaker_schema.sql、CI、部署配置）
- 约束说明：未连真实 Supabase 实例；涉及 RLS 行为、生产时区的结论基于代码与 Supabase/PostgreSQL 语义推断，已在条目内标注。

---

## 1. 仓库定位与规模概览

反向自律打卡 App（AI 损友/御姐人设监督），Next.js 14 (App Router) + Supabase（Auth + Postgres + RLS）+ 豆包 API（火山方舟 Ark），PWA 离线 + Web Push，Vercel 部署。

| 维度            | 实测                                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| 语言            | TypeScript / TSX、SQL、Shell                                                                                     |
| Git 跟踪文件数  | 93                                                                                                               |
| src TS/TSX 文件 | 46 个，约 5,396 行                                                                                               |
| e2e TS 文件     | 12 个（10 spec + 2 fixture），约 1,246 行                                                                        |
| src + e2e 合计  | 约 6,642 行                                                                                                      |
| SQL             | 基准 schema 390 行 + 4 个增量迁移                                                                                |
| API 路由        | 9 个（checkin、checkin/sync、ai-feedback、goals/[id]、cron、push/subscribe、push/unsubscribe、og、iap/products） |
| 单测            | 3 个文件 41 用例（validations 19 / persona 13 / rateLimit 9）                                                    |
| 当前分支        | dev（最新提交 c9e179f）                                                                                          |

## 2. 结论摘要

计数：**P0 × 0 ｜ P1 × 5 ｜ P2 × 9 ｜ P3 × 7**

最关键的三条：

1. **定时任务管线在生产环境整体失效（P1）**：`/api/cron` 使用 anon key + RLS，cron 请求无用户会话，所有表查询返回 0 行——失败标记、周报生成、失败推送从未真正执行过；目前只靠用户打开 dashboard 时的 `/api/checkin/sync` 兜底补标失败。
2. **日期/时区系统性错乱（P1）**：全链路用 UTC 日期（`toISOString().slice(0,10)` / `CURRENT_DATE`），打卡截止时间却按服务器本地时区比较；UTC+8 用户凌晨打卡记到"昨天"，cron 在 UTC 23:59 运行时会提前约 8 小时把北京用户的目标误标为失败。
3. **E2E 验证门部分空转（P1）**：存在恒真断言（`expect(count).toBeGreaterThanOrEqual(0)`、`expect(x || true).toBe(true)`）、元素不可见即静默 return 的用例，且 mocks 拦截了全部 `/api/*` 浏览器请求，9 个 API 路由的真实逻辑没有任何端到端覆盖。

## 3. 逐条发现

### P1-1 Cron 路由在 RLS 下查不到任何数据，整条定时管线失效

- **位置**：`src/lib/supabase/server.ts:6-7`（固定使用 `NEXT_PUBLIC_SUPABASE_ANON_KEY`）；`src/app/api/cron/route.ts:27-36`；`flag_breaker_schema.sql:209-255`（所有表 RLS 策略均为 `auth.uid() = user_id`）
- **证据**：全仓 grep `SERVICE_ROLE`/`service_role` 0 命中；`.env.local.example` 无 service-role 变量。Vercel Cron / pg_cron 发起的请求不携带用户 cookie → `auth.uid()` 为 NULL → RLS 全部拒绝 → `goals` 查询恒为空 → 直接返回 `no active goals`。`get_consecutive_fails` RPC 非 `SECURITY DEFINER`（schema:316-340），同样受 RLS 约束。
- **影响**：README 宣称的"周报自动生成 + 失败打卡标记 + 推送触发"（README.md:177, 194）在生产从未生效；`weekly_reports` 永远为空，失败推送永远不发。实际失败标记靠 `/api/checkin/sync`（用户打开 dashboard 时）兜底，用户不打开 App 就不会有 failed 记录，连胜也不会归零。
- **未确认**：未连真实 Supabase 实例验证；但 RLS 语义下该结论确定。
- **修复建议**：cron 路由改用 `SUPABASE_SERVICE_ROLE_KEY` 建独立 admin client（仅此路由使用，严禁入客户端）；或把标记逻辑下沉为 `SECURITY DEFINER` 的 Postgres function + pg_cron。改完补一个针对该路由的集成测试。

### P1-2 Cron 失败推送通知永不发送（死代码）

- **位置**：`src/app/api/cron/route.ts:46-51`（results 元素类型仅含 goal_id/status/detail/ai_feedback）对比 `:339-346`（`sendFailedPushNotifications` 期望 `user_id`/`goal_type`）与 `:356-359`（`if (!r.user_id) continue`）
- **证据**：`results.push(...)` 三处（:59-64、:87-92、:166-171）均未写入 `user_id`/`goal_type`，`userGoalMap` 恒为空，函数必然返回 0。
- **影响**：`push_sent` 恒为 0，"今天忘了打卡"推送从未送达；用户侧的推送订阅功能（settings 页）成为摆设。
- **修复建议**：在标记失败的分支里把 `goal.user_id`、`goal.goal_type` 写入 results 元素。

### P1-3 日期/时区系统性错乱（UTC 日期 vs 本地时间 vs 服务器时区混用）

- **位置**：`src/app/api/checkin/route.ts:74`、`src/app/api/cron/route.ts:28,81-85`、`src/app/api/checkin/sync/route.ts:21`、`src/components/GoalCard.tsx:24`、`src/app/dashboard/page.tsx:139`、`flag_breaker_schema.sql:107`（注释声明 checkin_date "按用户时区"）、`:305`（视图用 `CURRENT_DATE`）
- **证据**：`new Date().toISOString().slice(0,10)` 一律是 UTC 日期；而 cron 的截止判定 `deadline.setHours(hh, mm)` 用的是服务器本地时区（Vercel 上为 UTC）。
- **影响**（以 UTC+8 用户为例，可复现推算）：
  1. 北京 00:00–08:00 打卡，UTC 仍是前一天 → 打卡记录落到"昨天"，`v_today_checkins` 当天显示未打卡。
  2. cron 于 UTC 23:59（北京次日 07:59）运行：`today` 取 UTC 日期（= 北京次日的日期），北京用户 `checkin_time=08:00`（本地）对应 UTC 00:00，deadline 早已过 → 目标被误标 failed，即使用户打算在北京 08:00 准时打卡。
  3. 保护模式（连续失败 ≥3 天强制纯夸夸）会因误标而错误触发。
- **修复建议**：引入用户时区（users 表加 `timezone` 列，注册时从浏览器采集）；所有"今天"的计算统一封装为一个以用户时区为参数的函数；cron 按用户时区分桶处理。这是本项目正确性的根问题，建议优先于其他功能修复。

### P1-4 E2E 验证门部分空转：恒真断言 + 静默跳过 + mock 拦截全部 API

- **位置**：
  - 恒真断言：`e2e/report.spec.ts:35`（`expect(count).toBeGreaterThanOrEqual(0)`）、`e2e/report.spec.ts:51`（`expect(hasCommentary || true).toBe(true)`，注释自嘲 "non-blocking check"）、`e2e/dashboard.spec.ts:67`（同款 `>= 0`）
  - 静默跳过：`e2e/dashboard.spec.ts:48,57,72`（`if (!checkinBtn.isVisible()) return;`）、`e2e/goals-crud.spec.ts:21`、`e2e/push-notifications.spec.ts:24,33,44`
  - API 零覆盖：`e2e/fixtures/mocks.ts:72-127` 用 `page.route` 拦截了 `**/api/checkin`、`**/api/ai-feedback`、`**/api/checkin/sync`，请求根本不会到达 Next.js 路由处理器
  - mock 数据形状失真：`e2e/fixtures/mock-server.ts:178-212` checkins 的 `status: "done"`（真实枚举为 success/failed/skipped，schema:108-110）；`mock-server.ts:150-168` weekly_reports 返回 `stats`/`ai_commentary`/`is_published`，真实列为 `success_count`/`ai_comment` 等（schema:177-197）
- **影响**：10 个 spec 在 CI 全绿（最近一次 2026-09-09 main 运行 success，2m45s），但对服务端逻辑（鉴权、RLS、限流、时区、失败标记）不提供任何信号；P1-1/P1-2/P1-3 这类 bug 永远无法被现有 E2E 发现。
- **修复建议**：删除或补实恒真断言与静默 return；至少为 `/api/checkin`、`/api/cron` 增加不经 page.route 拦截、直连真实路由处理器的 API 层测试（可用 Next 测试模式或起 dev server 直接 fetch）；mock 数据形状与 schema 对齐并加 CI 校验。

### P1-5 生产依赖存在 2 个 critical 漏洞（npm audit 实测）

- **证据**：`npm audit --omit=dev`（2026-11-02 实跑）输出 `16 vulnerabilities (6 moderate, 8 high, 2 critical)`：
  - `next 9.3.4-canary.0 - 16.3.0-preview.10`，Severity: critical（本仓安装 14.2.33，在受影响范围内）
  - `@sentry/nextjs 10.0.0-alpha.0 - 10.76.1`，Severity: critical（本仓安装 10.69.0）
  - 另有 high：`zod <4.6.6`（安装 4.4.3，GHSA-mrhx-c7xc-m3w5 校验内存耗尽）、`sharp <=0.35.5-rc.1`（安装 0.34.5，经 @vercel/og）、`source-map-js`、`nanoid`、`postcss`、`fast-uri`、`brace-expansion`
- **影响**：Next.js critical 公告历史上包含鉴权绕过/RCE 级别问题（具体 CVE 未逐条核对，标"未确认"）；zod 的内存耗尽可直接被 API 入参触发（所有路由都走 `parseBody`）。
- **修复建议**：升级 `next` 至 14.2.x 最新或 15.x、`@sentry/nextjs` 至 >10.76.1、`zod` 至 ≥4.6.6；`npm audit fix` 处理其余；升级后重跑 type-check/test/build。

### P2-1 离线打卡丢失原始日期，README"断网不丢打卡"名不副实

- **位置**：`src/lib/offlineQueue.ts:33-48`（入队只存 goal_id，不存业务日期）、`:71-75`（重播调 `/api/checkin`）；`src/app/api/checkin/route.ts:74`（服务器按当前 UTC 日期落库）
- **影响**：用户昨天 23:00 离线打卡、今早联网重播 → 记录落在"今天"，而"昨天"已被 `/api/checkin/sync` 标为 failed；连胜断裂且无法补救。队列里的 `created_at` 未被服务端采信。
- **修复建议**：`checkinPostSchema` 增加可选 `checkin_date`（服务端校验不晚于今天、不早于 N 天），重播时携带原日期。

### P2-2 `/api/checkin/sync` 语义与文档矛盾

- **位置**：`src/app/api/checkin/sync/route.ts:5-7`（实现为"补标昨天 failed"）；`README.md:70`、`AGENTS.md:65` 均称其为"离线打卡同步"
- **影响**：文档误导后续维护者；真正的离线同步实际在 `offlineQueue.replayQueue()` → `/api/checkin`。
- **修复建议**：改文档或改路由命名（如 `/api/checkin/mark-missed`）。

### P2-3 迁移链与基准 schema 终态不一致

- **位置**：`flag_breaker_schema.sql:196`（`UNIQUE(user_id, goal_id, week_start)`）vs `supabase/migrations/002_fix_weekly_reports_schema.sql` 第 4 步（`UNIQUE(goal_id, week_start)`）；迁移 002 新增的 `goal_id` 允许 NULL，基准 schema:180 为 NOT NULL
- **影响**：新环境跑基准文件与旧环境跑迁移链得到不同约束定义；`tools/check-migrations.sh` 只查文件命名/编号/头注释，不查内容一致性。
- **附带**：`README.md:28-32` 与 `AGENTS.md:30` 写迁移目录为 `migrations/`，实际为 `supabase/migrations/`。
- **修复建议**：以迁移链终态为准刷新基准文件（或反之），修正文档目录路径。

### P2-4 `goalUpdateSchema.goal_type` 未做枚举约束

- **位置**：`src/lib/validations.ts:64`（`z.string().min(1)`，对比 difficulty 用了 `z.enum`）
- **影响**：任意字符串直达 DB 被 CHECK 约束拒绝，返回 500"更新失败"，错误语义差；schema 三字段全必填，API 不支持部分更新（当前 edit 页全量提交，暂无实际故障）。
- **修复建议**：`goal_type` 改 `z.enum(["early_rise","fitness","study"])`；字段改 `.optional()` 支持 PATCH 语义。

### P2-5 限流器为单实例内存实现，serverless 下失效

- **位置**：`src/lib/rateLimit.ts:1-12`（注释已自知"多实例需换 Vercel KV / Upstash"）
- **影响**：Vercel 多实例/冷启动下 `/api/checkin` 10 次/分、`/api/ai-feedback` 5 次/分的承诺打折，付费 AI API 存在被刷量风险。
- **修复建议**：接入 Upstash Ratelimit 或按用户维度在 DB 计数；至少对 AI 调用路由。

### P2-6 CSP 脚本策略过宽

- **位置**：`next.config.js:29`（`script-src 'self' 'unsafe-inline' 'unsafe-eval'`）
- **影响**：XSS 纵深防御基本失效；`'unsafe-eval'` 非 Next 运行所必需。
- **修复建议**：移除 `'unsafe-eval'`；评估 nonce-based CSP（Next 14 支持 middleware nonce）。

### P2-7 Cron 串行循环 + 无 maxDuration 声明，规模大时必超时

- **位置**：`src/app/api/cron/route.ts:54-179`（每目标串行 4+ 次 DB 往返 + 1 次 15s 超时的 AI 调用）
- **影响**：目标数到几十上百时，循环总时长轻易超过 Vercel Function 默认 10s（Hobby）/60s 上限，cron 中途被杀且部分目标已处理、部分未处理（无事务、无断点续跑）。
- **修复建议**：声明 `export const maxDuration`；批量化（一次 SQL 批量插入 failed）；AI 调用并发限速或后置异步。

### P2-8 打卡主流程忽略 goals 更新的错误

- **位置**：`src/app/api/checkin/route.ts:146-153`（`await supabase.from("goals").update(...)` 未检查返回 error）
- **影响**：checkins 已写入但连胜/累计未更新时无任何告警，数据静默不一致；`checkin` PATCH（:243-247）同样不校验影响行数。
- **修复建议**：检查 error 并记录/告警；关键写路径考虑 DB 事务或 RPC。

### P2-9 AI 反馈接口的 RPC 错误未处理 + 兜底文案与保护模式不一致

- **位置**：`src/app/api/ai-feedback/route.ts:85-88`（`.rpc` 返回的 error 未检查，`:97` 失败时默认 `consecutive_fail = 1`）
- **影响**：RPC 失败时连续失败数被当作 1，可能绕过保护模式（≥3 才触发纯夸夸），让本该被保护的用户收到毒舌内容——合规敏感。
- **修复建议**：检查 rpc error，失败时按保守值（≥阈值）处理或直接返回错误。

### P3-1 登录页 /terms、/privacy 死链

- **位置**：`src/app/login/page.tsx:85-91`；`src/app/` 下无对应路由（实测目录无 terms/privacy）。点击 404。

### P3-2 里程碑文案出现负数

- **位置**：`src/components/AIFeedbackCard.tsx:112-116` + `src/app/dashboard/page.tsx:312`（固定 `milestone={7}`）；streak > 7 时显示"再坚持 -N 天解锁成就"。

### P3-3 "清空失败记录"不同步 goals 计数器

- **位置**：`src/app/settings/page.tsx:177-181`（只删 checkins，`total_fails` 等冗余字段不重置），与打卡/失败路径维护的冗余统计漂移。

### P3-4 `/api/og` 无鉴权无限流

- **位置**：`src/app/api/og/route.tsx:6-11`；任意 title/subtitle 可被生成图片，存在轻量滥用/费用风险（Edge Runtime CPU）。

### P3-5 Service Worker 预缓存鉴权页

- **位置**：`public/sw.js:8`（SHELL_URLS 含 /dashboard、/settings）；未登录状态下 install 会把登录页 HTML 缓存到 /dashboard 键下，离线打开语义混乱；个人数据不进入缓存（数据为客户端拉取），风险低。

### P3-6 Cron secret 非常量时间比较

- **位置**：`src/app/api/cron/route.ts:23`（`!==` 直比）；且未使用 Vercel Cron 原生 `Authorization: Bearer` 头约定。实际可攻击性低。

### P3-7 前端对枚举映射无保护索引

- **位置**：`src/components/GoalCard.tsx:21-22`、`src/app/report/page.tsx:275`（`GOAL_TYPES[g.goal_type]` 直接取属性）；DB CHECK 兜底，但属脆弱点（对比 report/page.tsx:235 有保护，风格不统一）。

## 4. 验证门实际执行结果（2026-11-02 本机实跑）

| 门禁      | 命令                   | 结果                                                                                                                                                                                                                              |
| --------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 类型检查  | `npm run type-check`   | ✅ 通过，0 错误（exit 0）                                                                                                                                                                                                         |
| Lint      | `npm run lint`         | ✅ `No ESLint warnings or errors`                                                                                                                                                                                                 |
| 单测      | `npm test`             | ✅ 3 文件 41/41 通过，428ms（与 README 宣称的 41 一致）                                                                                                                                                                           |
| 生产构建  | `npm run build`        | ✅ 17 条路由全部生成；First Load JS 87.3–173kB；仅一条 edge runtime 禁静态化警告（/api/og 预期内）                                                                                                                                |
| 依赖审计  | `npm audit --omit=dev` | ⚠️ 16 个漏洞（2 critical / 8 high / 6 moderate），见 P1-5                                                                                                                                                                         |
| E2E       | `npm run test:e2e`     | ⛔ 未执行：端口 4321 已被本机用户 node 进程（PID 36305）占用，评审约束禁止 kill 进程/占用端口；Playwright 浏览器已安装（chromium_headless_shell 多版本）。CI 侧最近一次运行（2026-09-09，main，run 34396814320）为 success，2m45s |
| CI 真实性 | `gh run list`          | ✅ 工作流真实触发并运行（push/PR 均触发）；但仅有 E2E 一个 workflow，lint/type-check/单测不进 CI，只靠本地 husky pre-commit（`.husky/pre-commit` 实跑 lint-staged + type-check + vitest）                                         |

## 5. 修复优先级建议

1. **第一梯队（正确性根因）**：P1-3 时区体系 → P1-1 cron service-role 化 → P1-2 推送字段补全。三者共同决定"失败标记/周报/推送"这条产品主链路是否真实工作。
2. **第二梯队（安全与依赖）**：P1-5 升级 next/@sentry/nextjs/zod 并重跑全部门禁；P2-5 AI 路由限流落库；P2-9 保护模式兜底。
3. **第三梯队（验证门可信度）**：P1-4 清理恒真断言、为 API 路由加不拦截的集成测试、CI 增加 lint+type-check+vitest job；P2-3 对齐迁移终态。
4. **第四梯队（质量与体验）**：P2-1 离线日期、P2-2 文档语义、P2-4 校验枚举、P2-6/P2-7/P2-8 及全部 P3。

## 6. 做得好的地方（值得保留）

- 模块边界清晰：API 路由 / lib / components 分层明确，Zod 校验集中在 `validations.ts`，4 个写接口均有 schema 校验。
- 合规纵深到位：保护模式在 `doubao.ts:29-32` 服务端强制判定（不依赖 AI 自觉），`BANNED_WORDS` 本地二次过滤，ai_feedback_logs 存快照可审计。
- 无密钥泄漏：全仓无 service-role key；`.env.local` 已被 .gitignore 覆盖且未跟踪（`git check-ignore` 验证），`.env.local` 内容仅为占位值。
- 单测是真断言且全绿；husky pre-commit 真实串联 lint-staged + type-check + vitest。
- 构建产物健康：First Load JS 最大 173kB，无大包。
