-- 003_add_persona_to_users.sql
-- 在 users 表增加 persona 字段，支持用户选择 AI 人设
-- 默认 "bro" = 损友（原人设），新增可选 "senpai" = 冷淡御姐

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS persona VARCHAR(20) NOT NULL DEFAULT 'bro';

COMMENT ON COLUMN public.users.persona IS 'AI 人设: bro=损友, senpai=冷淡御姐';
