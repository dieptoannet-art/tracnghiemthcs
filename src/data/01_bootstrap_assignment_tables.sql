-- =====================================================================
-- MIGRATION BƯỚC 1 (BOOTSTRAP BẢNG NỀN TẢNG CHO PHÂN HỆ LỚP HỌC & GIAO BÀI)
-- File: src/data/01_bootstrap_assignment_tables.sql
--
-- Mục tiêu:
--   - Tạo các bảng nền tảng còn thiếu trên production:
--       public.classes, public.class_members, public.exams,
--       public.assignments, public.submissions
--   - KHÔNG tạo trùng bảng public.exam_protected_keys (giữ ở file Bước 2:
--     src/data/02_sync_classes_exams_assignments.sql).
--   - GIỮ NGUYÊN 100% dữ liệu trong public.profiles và public.questions.
--     Không DROP TABLE, không chạy lại toàn bộ schema gốc, không nạp dữ liệu mẫu.
--   - Bật RLS và thu hồi quyền mặc định ngay khi tạo bảng (default-deny)
--     trước khi chạy file Bước 2 để thiết lập policy & RPC.
-- =====================================================================

begin;

create extension if not exists pgcrypto;

-- 1. BỔ SUNG CỘT CÒN THIẾU TRÊN public.profiles (CHỈ ADD IF NOT EXISTS, KHÔNG SỬA/XÓA DỮ LIỆU CŨ)
-- Lý do từng cột bổ sung:
--   - full_name   : hiển thị họ tên giáo viên / học sinh trong lớp & bài giao
--   - email       : định danh đăng nhập và tra cứu thêm học sinh vào lớp
--   - role        : phân biệt student / teacher / admin / reviewer khi kiểm tra quyền
--   - grade       : khối lớp (6, 7, 8, 9) của học sinh để gợi ý và lọc phù hợp
--   - student_code: mã định danh học sinh (dùng trong teacher_enroll_student và ClassManagement)
--   - subject     : môn giảng dạy của giáo viên
--   - school_name : tên trường hiển thị trên hồ sơ
--   - created_at  : dấu thời gian tạo hồ sơ
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists role text default 'student';
alter table public.profiles add column if not exists grade text;
alter table public.profiles add column if not exists student_code text;
alter table public.profiles add column if not exists subject text;
alter table public.profiles add column if not exists school_name text default 'Trường THCS Tây Đô';
alter table public.profiles add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());

-- Tạo chỉ mục cho student_code (an toàn nếu dữ liệu cũ có trùng lặp)
do $$
declare
  v_dup_count bigint;
begin
  select pg_catalog.count(*)
  into v_dup_count
  from (
    select pg_catalog.lower(student_code) as norm_code
    from public.profiles
    where student_code is not null
      and pg_catalog.btrim(student_code) <> ''
    group by pg_catalog.lower(student_code)
    having pg_catalog.count(*) > 1
  ) dup;

  if v_dup_count = 0 then
    execute 'create unique index if not exists idx_profiles_student_code_unique on public.profiles (pg_catalog.lower(student_code)) where student_code is not null and pg_catalog.btrim(student_code) <> ''''';
  else
    execute 'create index if not exists idx_profiles_student_code_lookup on public.profiles (pg_catalog.lower(student_code)) where student_code is not null and pg_catalog.btrim(student_code) <> ''''';
  end if;
end $$;

-- 2. TẠO CÁC BẢNG NỀN TẢNG CÒN THIẾU

-- 2.1. Bảng lớp học (public.classes)
create table if not exists public.classes (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  grade text not null,
  school_year text default '2025-2026' not null,
  teacher_id uuid references public.profiles(id),
  invite_code text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2.2. Bảng thành viên lớp học (public.class_members)
create table if not exists public.class_members (
  id uuid default gen_random_uuid() primary key,
  class_id uuid references public.classes(id) on delete cascade not null,
  student_id uuid references public.profiles(id) on delete cascade not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (class_id, student_id)
);

-- 2.3. Bảng đề kiểm tra (public.exams)
-- Lưu ý: gắn khóa ngoại matrix_id -> public.exam_matrices(id) có điều kiện
-- để không bị lỗi nếu bảng public.exam_matrices chưa tồn tại trên production.
create table if not exists public.exams (
  id uuid default gen_random_uuid() primary key,
  code text not null,
  title text not null,
  matrix_id uuid,
  grade text not null,
  subject text not null,
  duration_minutes integer not null,
  total_points numeric(4,2) default 10.0 not null,
  question_ids uuid[] default '{}'::uuid[],
  author_id uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

do $$
begin
  if to_regclass('public.exam_matrices') is not null
     and not exists (
       select 1
       from pg_constraint c
       join pg_class t on t.oid = c.conrelid
       join pg_namespace n on n.oid = t.relnamespace
       where n.nspname = 'public'
         and t.relname = 'exams'
         and c.conname = 'exams_matrix_id_fkey'
     ) then
    alter table public.exams
      add constraint exams_matrix_id_fkey
      foreign key (matrix_id) references public.exam_matrices(id);
  end if;
end $$;

-- 2.4. Bảng lượt giao bài cho lớp (public.assignments)
create table if not exists public.assignments (
  id uuid default gen_random_uuid() primary key,
  exam_id uuid references public.exams(id) on delete cascade not null,
  class_id uuid references public.classes(id) on delete cascade not null,
  open_time timestamp with time zone not null,
  close_time timestamp with time zone not null,
  duration_minutes integer not null,
  attempts_allowed integer default 1 not null,
  allow_review boolean default true not null,
  show_solution_after_submit boolean default false not null,
  shuffle_questions boolean default true not null,
  shuffle_options boolean default true not null,
  is_computer_lab_mode boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2.5. Bảng bài nộp / trạng thái làm bài của học sinh (public.submissions)
create table if not exists public.submissions (
  id uuid default gen_random_uuid() primary key,
  assignment_id uuid references public.assignments(id) on delete cascade not null,
  student_id uuid references public.profiles(id) on delete cascade not null,
  start_time timestamp with time zone default timezone('utc'::text, now()) not null,
  submitted_at timestamp with time zone,
  time_spent_seconds integer default 0 not null,
  answers jsonb default '{}'::jsonb not null,
  score numeric(4,2) default 0.0 not null,
  max_score numeric(4,2) default 10.0 not null,
  tab_switch_count integer default 0 not null,
  status text default 'in_progress' check (status in ('in_progress', 'submitted', 'graded')) not null
);

-- 3. CHỈ MỤC TỐI ƯU TRUY VẤN KHÓA NGOẠI
create index if not exists idx_classes_teacher_id on public.classes(teacher_id);
create index if not exists idx_class_members_class_id on public.class_members(class_id);
create index if not exists idx_class_members_student_id on public.class_members(student_id);
create index if not exists idx_exams_author_id on public.exams(author_id);
create index if not exists idx_assignments_class_id on public.assignments(class_id);
create index if not exists idx_assignments_exam_id on public.assignments(exam_id);
create index if not exists idx_submissions_assignment_student on public.submissions(assignment_id, student_id);
create index if not exists idx_submissions_student_id on public.submissions(student_id);

-- 4. BẬT RLS NGAY KHI TẠO BẢNG & KHÓA TRUY CẬP MẶC ĐỊNH (DEFAULT-DENY)
-- Toàn bộ policy chi tiết, bảng exam_protected_keys và các hàm RPC sẽ được tạo ở Bước 2
-- (src/data/02_sync_classes_exams_assignments.sql).
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.exams enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;

revoke all on table
  public.classes,
  public.class_members,
  public.exams,
  public.assignments,
  public.submissions
  from public, anon, authenticated;

commit;
