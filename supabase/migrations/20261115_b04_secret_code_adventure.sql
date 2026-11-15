-- ============================================================================
-- MIGRATION THAM KHẢO CHO B04 – GIẢI MÃ BÍ MẬT (EDU SECRET CODE ADVENTURE 1.0)
-- Lưu ý: File migration này được tạo riêng để Giáo viên / Quản trị viên xem xét.
-- Trong phiên bản hiện tại, trò chơi B04 tái sử dụng bảng public.audit_logs có sẵn
-- kết hợp localStorage để đảm bảo tương thích 100% mà không tự ý thay đổi schema.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.edu_secret_code_sets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade INTEGER NOT NULL DEFAULT 6,
  chapter TEXT DEFAULT '',
  lesson TEXT DEFAULT '',
  play_mode TEXT NOT NULL DEFAULT 'TREASURE_CODE', -- 'TREASURE_CODE' | 'SPY_CIPHER' | 'TEAM_ARENA'
  code_style TEXT NOT NULL DEFAULT 'DIRECT_ORDER', -- 'DIRECT_ORDER' | 'LOGIC_DEDUCTION' | 'A1Z26' | 'CAESAR' | 'SYMBOL_MAP' | 'NUMBER_SEQUENCE'
  code_length INTEGER NOT NULL DEFAULT 4,
  final_code TEXT NOT NULL,
  accepted_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  rule_description TEXT NOT NULL DEFAULT '',
  step_by_step_solution TEXT NOT NULL DEFAULT '',
  stations JSONB NOT NULL DEFAULT '[]'::jsonb,
  author_id TEXT,
  status TEXT NOT NULL DEFAULT 'approved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.edu_secret_code_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id TEXT,
  class_name TEXT,
  teacher_id TEXT,
  play_mode TEXT NOT NULL,
  unlocked_clues JSONB NOT NULL DEFAULT '[]'::jsonb,
  code_attempts INTEGER NOT NULL DEFAULT 0,
  participants JSONB NOT NULL DEFAULT '[]'::jsonb,
  final_result TEXT NOT NULL DEFAULT 'COMPLETED',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.edu_secret_code_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_secret_code_sessions ENABLE ROW LEVEL SECURITY;
