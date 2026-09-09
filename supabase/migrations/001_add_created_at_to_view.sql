-- =====================================================
-- Migration 001: Add created_at to today check-ins view
-- File: 001_add_created_at_to_view.sql
-- Date: 2026-08-07 04:06
-- Run: Supabase SQL Editor, execute once
-- =====================================================
-- Note: v_today_checkins lacked the created_at column the
--       dashboard sorts on; adds g.created_at to the view.
-- -----------------------------------------------------
-- ============================================================
-- 迁移 001：修复 v_today_checkins 视图缺少 created_at 字段
-- 问题：Dashboard 用 order("created_at") 排序但视图无此列
-- 解决：在视图中加入 g.created_at
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
    AND c.checkin_date = CURRENT_DATE
WHERE g.is_active = TRUE;
