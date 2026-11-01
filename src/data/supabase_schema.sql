-- =====================================================================
-- HỆ THỐNG TRẮC NGHIỆM THCS TÂY ĐÔ - SQL SCHEMA CHO SUPABASE
-- Trường THCS Tây Đô | Giáo viên: Diệp Thanh Toàn
-- Hỗ trợ Row Level Security (RLS) & phân quyền Học sinh / Giáo viên / Quản trị
-- =====================================================================

-- 1. BẢNG HỒ SƠ NGƯỜI DÙNG & VAI TRÒ (PROFILES)
do $$ begin
  create type user_role as enum ('student', 'teacher', 'admin', 'reviewer');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  email text not null,
  role user_role default 'student' not null,
  grade text check (grade in ('6', '7', '8', '9')),
  student_code text unique,
  subject text,
  school_name text default 'Trường THCS Tây Đô',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

-- Xóa các policy cũ nếu có để tạo lại nhất quán, không lỗi trùng lặp
drop policy if exists "Xem hồ sơ cá nhân hoặc quản lý" on public.profiles;
drop policy if exists "Chỉ quản trị mới được sửa vai trò" on public.profiles;
drop policy if exists "Người dùng tự cập nhật thông tin của mình" on public.profiles;
drop policy if exists "Quản trị viên có toàn quyền cập nhật hồ sơ" on public.profiles;
drop policy if exists "Cho phép tạo hồ sơ ban đầu" on public.profiles;

-- RLS 1: Người dùng có thể xem hồ sơ của mình; Giáo viên và Quản trị có thể xem danh sách toàn trường
create policy "Xem hồ sơ cá nhân hoặc quản lý" on public.profiles
  for select using (
    auth.uid() = id or 
    exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'admin', 'reviewer'))
  );

-- RLS 2: Người dùng chỉ được sửa thông tin cá nhân của chính mình (Họ tên, khối, mã học sinh),
-- TUYỆT ĐỐI KHÔNG ĐƯỢC tự thay đổi vai trò (role) của mình
create policy "Người dùng tự cập nhật thông tin của mình" on public.profiles
  for update using (
    auth.uid() = id
  ) with check (
    auth.uid() = id and
    role = (select role from public.profiles where id = auth.uid())
  );

-- RLS 3: Chỉ quản trị viên (Admin) mới có quyền thay đổi vai trò hoặc sửa hồ sơ người khác
create policy "Quản trị viên có toàn quyền cập nhật hồ sơ" on public.profiles
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- RLS 4: Cho phép tạo hồ sơ ban đầu khi đăng ký (vai trò Học sinh hoặc Giáo viên)
create policy "Cho phép tạo hồ sơ ban đầu" on public.profiles
  for insert with check (
    auth.uid() = id and role in ('student', 'teacher')
  );

-- TRIGGER TỰ ĐỘNG: Khi có tài khoản mới đăng ký ở auth.users, tự động tạo hồ sơ profile
-- Hỗ trợ vai trò 'student' hoặc 'teacher' do người dùng chọn khi đăng ký; ngăn tự gán admin
create or replace function public.handle_new_user()
returns trigger as $$
declare
  assigned_role user_role := 'student';
begin
  if (new.raw_user_meta_data->>'role') in ('student', 'teacher') then
    assigned_role := (new.raw_user_meta_data->>'role')::user_role;
  else
    assigned_role := 'student';
  end if;

  insert into public.profiles (id, full_name, email, role, grade, student_code, subject, school_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    assigned_role,
    case when assigned_role = 'student' then (new.raw_user_meta_data->>'grade')::text else null end,
    case when assigned_role = 'student' then new.raw_user_meta_data->>'student_code' else null end,
    case when assigned_role = 'teacher' then new.raw_user_meta_data->>'subject' else null end,
    coalesce(new.raw_user_meta_data->>'school_name', 'Trường THCS Tây Đô')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, profiles.full_name),
    role = coalesce(excluded.role, profiles.role);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =====================================================================
-- HƯỚNG DẪN CẤP QUYỀN QUẢN TRỊ VIÊN & GIÁO VIÊN BAN ĐẦU:
-- Chạy lệnh SQL này trong Supabase SQL Editor sau khi tài khoản đã đăng ký:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'dieptoan.net@gmail.com';
-- UPDATE public.profiles SET role = 'teacher' WHERE email = 'giaovien.toan@taydo.edu.vn';
-- =====================================================================


-- 2. BẢNG LỚP HỌC & THÀNH VIÊN LỚP (CLASSES & CLASS_MEMBERS)
create table if not exists public.classes (
  id uuid default gen_random_uuid() primary key,
  name text not null, -- VD: Lớp 8A1
  grade text not null,
  school_year text default '2025-2026' not null,
  teacher_id uuid references public.profiles(id),
  invite_code text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.class_members (
  id uuid default gen_random_uuid() primary key,
  class_id uuid references public.classes(id) on delete cascade not null,
  student_id uuid references public.profiles(id) on delete cascade not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (class_id, student_id)
);

alter table public.classes enable row level security;
alter table public.class_members enable row level security;

create policy "Xem lớp học phù hợp" on public.classes
  for select using (
    teacher_id = auth.uid() or
    exists (select 1 from public.class_members where class_id = classes.id and student_id = auth.uid()) or
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 3. BẢNG NGÂN HÀNG CÂU HỎI (QUESTIONS & PROTECTED_SOLUTIONS)
-- Lưu ý bảo mật: Nội dung câu hỏi và các phương án mở cho học sinh khi làm bài,
-- nhưng đáp án đúng và lời giải chi tiết được tách bảng bảo vệ (protected_solutions)
create type question_type as enum ('single_choice', 'true_false_group', 'short_answer', 'essay');
create type cognitive_level as enum ('know', 'understand', 'apply');
create type question_status as enum ('draft', 'pending', 'approved', 'deprecated');

create table if not exists public.questions (
  id uuid default gen_random_uuid() primary key,
  code text unique not null,
  grade text not null,
  subject text not null,
  textbook text not null,
  chapter text not null,
  lesson text not null,
  yccd text not null, -- Yêu cầu cần đạt
  competency text,
  level cognitive_level not null,
  type question_type not null,
  stem text not null, -- Nội dung đề bài (hỗ trợ KaTeX)
  points numeric(4,2) default 0.25 not null,
  options jsonb, -- Mảng các phương án lựa chọn A, B, C, D (không chứa đáp án)
  sub_items jsonb, -- Các ý a, b, c, d
  status question_status default 'draft' not null,
  author_id uuid references public.profiles(id),
  version integer default 1 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Bảng đáp án bảo vệ (Chỉ giáo viên, quản trị hoặc khi bài thi đã công bố mới được truy xuất)
create table if not exists public.protected_solutions (
  question_id uuid references public.questions(id) on delete cascade primary key,
  correct_answer text, -- Cho câu 1 đáp án
  sub_item_answers jsonb, -- Cho câu đúng sai (mảng {id, isCorrect})
  accepted_answers jsonb, -- Cho trả lời ngắn
  sample_essay_answer text, -- Cho tự luận
  rubric jsonb, -- Thang điểm tự luận
  explanation text not null -- Lời giải chi tiết
);

alter table public.questions enable row level security;
alter table public.protected_solutions enable row level security;

-- CẤP QUYỀN THAO TÁC CHO VAI TRÒ AUTHENTICATED
grant usage on schema public to anon, authenticated;
grant select on table public.questions to anon, authenticated;
grant select, insert, update, delete on table public.questions to authenticated;
grant select, insert, update, delete on table public.protected_solutions to authenticated;

-- Xóa các policy cũ để tạo lại nhất quán
drop policy if exists "Học sinh chỉ xem câu hỏi được duyệt trong bài thi" on public.questions;
drop policy if exists "Giáo viên và Quản trị được thêm câu hỏi" on public.questions;
drop policy if exists "Giáo viên và Quản trị được sửa câu hỏi" on public.questions;
drop policy if exists "Quản trị viên được xóa câu hỏi" on public.questions;

drop policy if exists "Giáo viên bảo vệ đáp án" on public.protected_solutions;
drop policy if exists "Giáo viên và Quản trị được thêm đáp án bảo vệ" on public.protected_solutions;
drop policy if exists "Giáo viên và Quản trị được sửa đáp án bảo vệ" on public.protected_solutions;
drop policy if exists "Quản trị viên được xóa đáp án bảo vệ" on public.protected_solutions;

-- CHÍNH SÁCH BẢNG QUESTIONS
-- 1. Xem câu hỏi: Học sinh xem câu đã duyệt, Giáo viên/Quản trị xem tất cả
create policy "Học sinh chỉ xem câu hỏi được duyệt trong bài thi" on public.questions
  for select using (
    status = 'approved' or
    exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'admin', 'reviewer'))
  );

-- 2. Thêm câu hỏi: Giáo viên và Quản trị được thêm mới (kể cả qua Excel)
create policy "Giáo viên và Quản trị được thêm câu hỏi" on public.questions
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'admin', 'reviewer'))
  );

-- 3. Cập nhật câu hỏi: Giáo viên và Quản trị được chỉnh sửa
create policy "Giáo viên và Quản trị được sửa câu hỏi" on public.questions
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'admin', 'reviewer'))
  );

-- 4. Xóa câu hỏi: Chỉ Quản trị viên và Người kiểm duyệt
create policy "Quản trị viên được xóa câu hỏi" on public.questions
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'reviewer'))
  );

-- CHÍNH SÁCH BẢNG PROTECTED_SOLUTIONS
-- 1. Xem đáp án: Chỉ Giáo viên/Quản trị
create policy "Giáo viên bảo vệ đáp án" on public.protected_solutions
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'admin', 'reviewer'))
  );

-- 2. Thêm đáp án: Giáo viên và Quản trị
create policy "Giáo viên và Quản trị được thêm đáp án bảo vệ" on public.protected_solutions
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'admin', 'reviewer'))
  );

-- 3. Cập nhật đáp án: Giáo viên và Quản trị
create policy "Giáo viên và Quản trị được sửa đáp án bảo vệ" on public.protected_solutions
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'admin', 'reviewer'))
  );

-- 4. Xóa đáp án: Quản trị viên
create policy "Quản trị viên được xóa đáp án bảo vệ" on public.protected_solutions
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'reviewer'))
  );

-- 4. BẢNG MA TRẬN & ĐỀ KIỂM TRA (EXAM_MATRICES & EXAMS)
create table if not exists public.exam_matrices (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  grade text not null,
  subject text not null,
  period text not null,
  total_points numeric(4,2) default 10.0 not null,
  cognitive_ratio jsonb not null, -- {know: 40, understand: 40, apply: 20}
  rows jsonb not null, -- Danh sách hàng ma trận
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.exams (
  id uuid default gen_random_uuid() primary key,
  code text not null,
  title text not null,
  matrix_id uuid references public.exam_matrices(id),
  grade text not null,
  subject text not null,
  duration_minutes integer not null,
  total_points numeric(4,2) default 10.0 not null,
  question_ids uuid[] not null,
  author_id uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. BẢNG GIAO BÀI & LƯỢT LÀM BÀI (ASSIGNMENTS & SUBMISSIONS)
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

alter table public.assignments enable row level security;
alter table public.submissions enable row level security;

create policy "Học sinh xem bài của lớp mình" on public.assignments
  for select using (
    exists (
      select 1 from public.class_members
      where class_id = assignments.class_id and student_id = auth.uid()
    ) or
    exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'admin'))
  );

create policy "Học sinh chỉ xem và gửi bài của chính mình" on public.submissions
  for all using (
    student_id = auth.uid() or
    exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'admin'))
  );

-- 6. BẢNG NHẬT KÝ THAO TÁC (AUDIT_LOGS)
create table if not exists public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  actor_name text not null,
  role text not null,
  action text not null,
  target text not null,
  details text
);

-- Đã hoàn thành cấu hình Schema & Chính sách RLS!
