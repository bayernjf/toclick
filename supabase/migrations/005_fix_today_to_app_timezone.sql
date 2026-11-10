-- =====================================================
-- Migration 005: App-timezone "today" for view + RPC
-- File: 005_fix_today_to_app_timezone.sql
-- Date: 2026-11-03 10:58
-- Run: Supabase SQL Editor, execute once
-- =====================================================
-- 问题：v_today_checkins 与 get_consecutive_fails 用 CURRENT_DATE，
--       在 Supabase（UTC）上比 app 时区（Asia/Shanghai）晚 8 小时翻日，
--       与应用层 dates.ts（c18b70e/3646412 起统一走 Asia/Shanghai）错位：
--       北京 00:00-08:00 打卡已按 app 时区落当天，视图却按 UTC 判定，看板漏显。
-- 解决：两处改用 (now() AT TIME ZONE 'Asia/Shanghai')::date。
-- ============================================================

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
    AND c.checkin_date = (now() AT TIME ZONE 'Asia/Shanghai')::date
WHERE g.is_active = TRUE;

COMMENT ON VIEW public.v_today_checkins IS '首页今日打卡看板视图（"今天"按 Asia/Shanghai，与应用层 dates.ts 一致）';

CREATE OR REPLACE FUNCTION public.get_consecutive_fails(p_goal_id UUID)
RETURNS INT AS $$
DECLARE
    fail_count INT := 0;
    rec RECORD;
BEGIN
    -- 从今天（app 时区）往回数，遇到第一个非 failed 就停
    FOR rec IN
        SELECT status
        FROM public.checkins
        WHERE goal_id = p_goal_id
          AND checkin_date <= (now() AT TIME ZONE 'Asia/Shanghai')::date
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

COMMENT ON FUNCTION public.get_consecutive_fails IS '计算目标连续失败天数（"今天"按 Asia/Shanghai），>=3 时触发保护模式';
