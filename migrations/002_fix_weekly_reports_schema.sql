-- ============================================================
-- 迁移 002：修复 weekly_reports 表以支持多目标独立周报
-- 问题：
--   1. 缺少 goal_id 列，导致 cron 按目标生成报告时无法关联
--   2. UNIQUE 约束是 (user_id, week_start)，需改为 (goal_id, week_start)
--   3. 缺少 checkins_count 列，新增便于汇总显示
-- ============================================================

-- 1. 添加 goal_id 列（允许为空以兼容现有数据）
ALTER TABLE public.weekly_reports 
ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES public.goals(id) ON DELETE CASCADE;

-- 2. 添加总打卡次数列
ALTER TABLE public.weekly_reports 
ADD COLUMN IF NOT EXISTS checkins_count INTEGER DEFAULT 0;

-- 3. 移除旧的唯一约束（如果存在）
DO $$
BEGIN
    -- PostgreSQL 自动生成的约束名可能不同，尝试两种常见命名
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'weekly_reports_user_id_week_start_key'
    ) THEN
        ALTER TABLE public.weekly_reports DROP CONSTRAINT weekly_reports_user_id_week_start_key;
    END IF;
END $$;

-- 4. 添加新的唯一约束（每个目标每周只有一条报告）
ALTER TABLE public.weekly_reports 
ADD CONSTRAINT weekly_reports_goal_id_week_start_key UNIQUE(goal_id, week_start);
