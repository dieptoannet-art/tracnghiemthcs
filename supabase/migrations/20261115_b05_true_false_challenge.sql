-- ============================================================================
-- MIGRATION THAM KHẢO CHO B05 – ĐÚNG HAY SAI (EDU TRUE OR FALSE CHALLENGE 1.0)
-- Lưu ý: File migration này được tạo riêng để Giáo viên / Quản trị viên duyệt.
-- Hiện tại B05 tái sử dụng bảng questions, classes, profiles và public.audit_logs
-- có sẵn để đảm bảo an toàn tuyệt đối cho dữ liệu và RLS hiện tại.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.edu_true_false_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_code TEXT NOT NULL DEFAULT 'B05',
  teacher_id TEXT,
  class_name TEXT,
  play_mode TEXT NOT NULL, -- 'LIGHTNING_REFLEX' | 'TWO_SIDES_ARENA' | 'TEAM_BATTLE' | 'FOUR_STATEMENTS_CHALLENGE'
  question_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  participants JSONB NOT NULL DEFAULT '[]'::jsonb,
  answers_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  final_scores JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.edu_true_false_sessions ENABLE ROW LEVEL SECURITY;
