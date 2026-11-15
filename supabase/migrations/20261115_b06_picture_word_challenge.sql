-- ============================================================================
-- MIGRATION THAM KHẢO CHO B06 – ĐUỔI HÌNH BẮT CHỮ (EDU PICTURE WORD CHALLENGE 1.0)
-- Lưu ý: File migration này được tạo riêng để Giáo viên / Quản trị viên duyệt.
-- Hiện tại B06 tái sử dụng bảng questions, classes, profiles và public.audit_logs
-- có sẵn để đảm bảo an toàn tuyệt đối cho dữ liệu và RLS hiện tại.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.edu_picture_word_puzzles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade TEXT NOT NULL DEFAULT '6',
  chapter TEXT DEFAULT '',
  lesson TEXT DEFAULT '',
  original_answer TEXT NOT NULL,
  accepted_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  visual_panels JSONB NOT NULL DEFAULT '[]'::jsonb,
  hints JSONB NOT NULL DEFAULT '[]'::jsonb,
  explanation TEXT NOT NULL DEFAULT '',
  author_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.edu_picture_word_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_code TEXT NOT NULL DEFAULT 'B06',
  teacher_id TEXT,
  class_name TEXT,
  play_mode TEXT NOT NULL, -- 'CLASSIC_GUESS' | 'LETTER_TILES' | 'TEAM_ARENA'
  participants JSONB NOT NULL DEFAULT '[]'::jsonb,
  results_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.edu_picture_word_puzzles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_picture_word_sessions ENABLE ROW LEVEL SECURITY;
