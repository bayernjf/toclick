-- ============================================================
-- 反旗 / FlagBreaker · MVP 数据库 Schema
-- 平台：Supabase (PostgreSQL)
-- 版本：v0.1
-- 使用：在 Supabase Dashboard → SQL Editor → 粘贴执行
-- ============================================================

-- ============================================================
-- 0. 扩展 & 工具函数
-- ============================================================

-- 启用 pgcrypto（Supabase 默认已开，这里兜底，用于 gen_random_uuid）
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- updated_at 自动更新触发器函数
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 1. users 表（业务用户，关联 Supabase auth.users）
-- ============================================================
-- 说明：Supabase 自带 auth.users 存登录凭证，本表存业务字段
-- roast_enabled 放这里，不放单独 settings 表（MVP 减少表数）

CREATE TABLE IF NOT EXISTS public.users (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nickname        TEXT NOT NULL DEFAULT '匿名用户',
    age             INT  NOT NULL DEFAULT 25 CHECK (age >= 0 AND age <= 120),
    roast_enabled   BOOLEAN NOT NULL DEFAULT TRUE,   -- 毒舌模式开关，默认开
    persona         TEXT NOT NULL DEFAULT 'bro',      -- AI 人设：bro / senpai
    avatar_url      TEXT,
    last_active_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.users IS '业务用户表，1:1 关联 auth.users';
COMMENT ON COLUMN public.users.age IS '年龄，<18 时后端强制 roast_enabled=FALSE';
COMMENT ON COLUMN public.users.roast_enabled IS '毒舌模式开关，用户可随时在设置页切换';

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 2. goals 表（用户的目标）
-- ============================================================
-- 目标类型 MVP 固定 3 种：early_rise / fitness / study
-- 难度 3 档：easy / medium / hard
-- current_streak / best_streak 实时维护，便于首页直接展示

CREATE TABLE IF NOT EXISTS public.goals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    goal_type       TEXT NOT NULL CHECK (
                        goal_type IN ('early_rise', 'fitness', 'study')
                    ),

    difficulty      TEXT NOT NULL DEFAULT 'medium' CHECK (
                        difficulty IN ('easy', 'medium', 'hard')
                    ),

    checkin_time    TIME NOT NULL DEFAULT '08:00',  -- 每日应打卡时间

    current_streak  INT  NOT NULL DEFAULT 0,  -- 当前连续达成天数
    best_streak     INT  NOT NULL DEFAULT 0,  -- 历史最长连续
    total_checkins  INT  NOT NULL DEFAULT 0,  -- 累计成功打卡次数
    total_fails     INT  NOT NULL DEFAULT 0,  -- 累计失败次数

    is_active       BOOLEAN NOT NULL DEFAULT TRUE,  -- 软删除/停用
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.goals IS '用户设立的目标';
COMMENT ON COLUMN public.goals.difficulty IS '难度影响 AI 毒舌力度：easy 未完成损得最狠';
COMMENT ON COLUMN public.goals.current_streak IS '当前连续达成天数，打卡成功+1，失败归0';
COMMENT ON COLUMN public.goals.is_active IS '软删除标记，FALSE 表示用户停用该目标';

CREATE INDEX idx_goals_user_id ON public.goals(user_id) WHERE is_active = TRUE;
CREATE INDEX idx_goals_user_type ON public.goals(user_id, goal_type);

CREATE TRIGGER trg_goals_updated_at
    BEFORE UPDATE ON public.goals
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 3. checkins 表（每日打卡记录）
-- ============================================================
-- status: success / failed / skipped(休息日)
-- UNIQUE 约束保证每个目标每天只有一条记录

CREATE TABLE IF NOT EXISTS public.checkins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id         UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    checkin_date    DATE NOT NULL,    -- 打卡日期（按用户时区）
    status          TEXT NOT NULL CHECK (
                        status IN ('success', 'failed', 'skipped')
                    ),

    note            TEXT,             -- 用户可选的一句感想
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(goal_id, checkin_date)
);

COMMENT ON TABLE  public.checkins IS '每日打卡记录，每个目标每天最多一条';
COMMENT ON COLUMN public.checkins.status IS 'success=完成 / failed=未完成 / skipped=主动休息';

CREATE INDEX idx_checkins_user_date ON public.checkins(user_id, checkin_date DESC);
CREATE INDEX idx_checkins_goal_date ON public.checkins(goal_id, checkin_date DESC);


-- ============================================================
-- 4. ai_feedback_logs 表（AI 反馈日志）
-- ============================================================
-- 用途：1) 审计保护机制是否生效 2) 采集用户偏好优化 prompt
-- user_reaction: liked / disliked / null（用户在反馈页点的哈哈/👎）

CREATE TABLE IF NOT EXISTS public.ai_feedback_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    goal_id             UUID REFERENCES public.goals(id) ON DELETE SET NULL,

    trigger_type        TEXT NOT NULL CHECK (
                            trigger_type IN (
                                'checkin_success',
                                'checkin_fail',
                                'weekly_report',
                                'mode_switch',
                                'record_delete',
                                'streak_milestone'
                            )
                        ),

    -- 传入 AI 的结构化用户状态快照（用于审计 & 复现）
    scenario            TEXT NOT NULL,
    consecutive_fail    INT NOT NULL DEFAULT 0,
    difficulty          TEXT,
    streak              INT  NOT NULL DEFAULT 0,
    age                 INT,
    roast_enabled       BOOLEAN,

    -- AI 返回内容
    ai_response         TEXT NOT NULL,

    -- 用户反馈（用于优化）
    user_reaction       TEXT CHECK (user_reaction IN ('liked', 'disliked')),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.ai_feedback_logs IS 'AI 反馈日志，用于审计 & 优化 prompt';
COMMENT ON COLUMN public.ai_feedback_logs.consecutive_fail IS '触发时连续失败天数，验证保护机制：>=3 时应已切纯夸夸';
COMMENT ON COLUMN public.ai_feedback_logs.user_reaction IS '用户在反馈页点的哈哈(liked)或👎(disliked)';

CREATE INDEX idx_feedback_user_created ON public.ai_feedback_logs(user_id, created_at DESC);
CREATE INDEX idx_feedback_trigger ON public.ai_feedback_logs(trigger_type, created_at DESC);


-- ============================================================
-- 5. weekly_reports 表（7 日报告，预计算存储）
-- ============================================================
-- 每周日触发，生成上周报告，避免每次查询实时聚合

CREATE TABLE IF NOT EXISTS public.weekly_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    goal_id         UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,

    week_start      DATE NOT NULL,    -- 周一日期
    week_end        DATE NOT NULL,    -- 周日日期

    total_goals     INT NOT NULL DEFAULT 0,   -- 当周活跃目标数
    expected_checks INT NOT NULL DEFAULT 0,   -- 应打卡总次数（目标数×7，扣除skipped）
    success_count   INT NOT NULL DEFAULT 0,
    fail_count      INT NOT NULL DEFAULT 0,
    max_streak      INT NOT NULL DEFAULT 0,
    checkins_count  INT NOT NULL DEFAULT 0,   -- 本周实际打卡次数

    ai_comment      TEXT,  -- AI 周报点评

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, goal_id, week_start)
);

COMMENT ON TABLE  public.weekly_reports IS '7 日报告，每周日预计算生成';

CREATE INDEX idx_reports_user_created ON public.weekly_reports(user_id, created_at DESC);


-- ============================================================
-- 6. Row Level Security（RLS）
-- ============================================================
-- MVP 策略：用户只能读写自己的数据

ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_feedback_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_reports    ENABLE ROW LEVEL SECURITY;

-- users：用户只能读写自己
CREATE POLICY p_users_select ON public.users
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY p_users_insert ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY p_users_update ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- goals
CREATE POLICY p_goals_select ON public.goals
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY p_goals_insert ON public.goals
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY p_goals_update ON public.goals
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY p_goals_delete ON public.goals
    FOR DELETE USING (auth.uid() = user_id);

-- checkins
CREATE POLICY p_checkins_select ON public.checkins
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY p_checkins_insert ON public.checkins
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY p_checkins_update ON public.checkins
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY p_checkins_delete ON public.checkins
    FOR DELETE USING (auth.uid() = user_id);

-- ai_feedback_logs
CREATE POLICY p_feedback_select ON public.ai_feedback_logs
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY p_feedback_insert ON public.ai_feedback_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY p_feedback_update ON public.ai_feedback_logs
    FOR UPDATE USING (auth.uid() = user_id);

-- weekly_reports
CREATE POLICY p_reports_select ON public.weekly_reports
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY p_reports_insert ON public.weekly_reports
    FOR INSERT WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- 7. 触发器：新用户注册时自动创建 users 记录
-- ============================================================
-- 配合 Supabase Auth：用户注册后自动在 public.users 建行

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, nickname)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nickname', '匿名用户')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 先 DROP 防止重复创建（幂等）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- 8. 辅助视图：今日打卡看板（首页用）
-- ============================================================
-- 一次查询拿到用户所有活跃目标 + 今日打卡状态

CREATE OR REPLACE VIEW public.v_today_checkins AS
SELECT
    g.id AS goal_id,
    g.user_id,
    g.goal_type,
    g.difficulty,
    g.checkin_time,
    g.current_streak,
    g.best_streak,
    g.is_active,
    g.created_at,
    c.id AS checkin_id,
    c.checkin_date,
    c.status AS today_status,
    c.note
FROM public.goals g
LEFT JOIN public.checkins c
    ON c.goal_id = g.id
    AND c.checkin_date = CURRENT_DATE
WHERE g.is_active = TRUE;

COMMENT ON VIEW public.v_today_checkins IS '首页今日打卡看板视图';


-- ============================================================
-- 9. 辅助函数：计算某目标的连续失败天数
-- ============================================================
-- 用于判断是否触发"连续3天失败保护模式"

CREATE OR REPLACE FUNCTION public.get_consecutive_fails(p_goal_id UUID)
RETURNS INT AS $$
DECLARE
    fail_count INT := 0;
    rec RECORD;
BEGIN
    -- 从今天往回数，遇到第一个非 failed 就停
    FOR rec IN
        SELECT status
        FROM public.checkins
        WHERE goal_id = p_goal_id
          AND checkin_date <= CURRENT_DATE
        ORDER BY checkin_date DESC
        LIMIT 30  -- 最多看 30 天，防止全表扫描
    LOOP
        IF rec.status = 'failed' THEN
            fail_count := fail_count + 1;
        ELSE
            EXIT;
        END IF;
    END LOOP;

    RETURN fail_count;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_consecutive_fails IS '计算目标连续失败天数，>=3 时触发保护模式';


-- ============================================================
-- 10. push_subscriptions 表（Web Push 订阅，支持浏览器推送通知）
-- ============================================================
-- 用途：存储用户的浏览器推送订阅信息，定时任务使用 VAPID 发送推送

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    endpoint        TEXT NOT NULL,
    p256dh          TEXT NOT NULL,
    auth            TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can insert their own subscriptions
CREATE POLICY "Users insert own subscriptions" ON public.push_subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can read their own subscriptions
CREATE POLICY "Users select own subscriptions" ON public.push_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- Users can delete their own subscriptions (unsubscribe)
CREATE POLICY "Users delete own subscriptions" ON public.push_subscriptions
    FOR DELETE USING (auth.uid() = user_id);


-- ============================================================
-- 11. 验证查询（执行后自查 schema 是否建对）
-- ============================================================
-- 执行以下语句，应返回 6 张表

-- SELECT tablename FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
--
-- 预期结果：
--  ai_feedback_logs
--  checkins
--  goals
--  push_subscriptions
--  users
--  weekly_reports
