-- =====================================================================
-- MIGRATION BƯỚC 4 (GIAI ĐOẠN 4A - CHUẨN BỊ CẤU TRÚC & DỮ LIỆU CHUYỂN TIẾP):
-- BỔ SUNG BẢNG PHÂN CÔNG GIẢNG DẠY, VAI TRÒ PHỤ TRÁCH LỚP, MÃ ĐỊNH DANH
-- & DANH SÁCH "THIẾU MÔN" / LỚP BỊ ẢNH HƯỞNG TRƯỚC KHI BẬT QUYỀN MỚI
-- File: src/data/04_teaching_assignments_and_codes.sql
--
-- Điều kiện & Thứ tự chạy trên Supabase SQL Editor:
--   Bước 1: src/data/01_bootstrap_assignment_tables.sql (đã chạy trên production)
--   Bước 2: src/data/02_sync_classes_exams_assignments.sql (đã chạy trên production)
--   Bước 3: src/data/03_admin_accounts_rbac.sql (đã chạy trên production)
--   Bước 4: src/data/04_teaching_assignments_and_codes.sql (file này - CHƯA bật RLS mới)
--   Bước 5: Sau khi Quản trị viên bổ sung đủ môn & vai trò phụ trách lớp từ danh sách
--           "Thiếu môn", mới chạy src/data/05_enable_subject_rls_and_hardening.sql.
--
-- Nguyên tắc an toàn:
--   1. TÁCH BIỆT việc thêm bảng/cột phân công với việc bật chính sách quyền mới:
--      File này KHÔNG đổi RLS của classes, class_members, assignments, submissions,
--      KHÔNG đổi is_class_teacher() hay teacher_enroll_student(), để tránh làm gián đoạn
--      giáo viên hiện tại trong lúc Quản trị viên bổ sung môn.
--   2. KHÔNG tự suy đoán môn dạy từ tên lớp, tên giáo viên hay profiles.subject:
--      Phân công cũ từ classes.teacher_id được đưa vào teaching_assignments với
--      subject = NULL và needs_subject_completion = true ("Thiếu môn").
--   3. Cung cấp view & RPC đọc danh sách "Thiếu môn" và các lớp sẽ bị ảnh hưởng
--      trước khi chuyển sang Bước 5.
-- =====================================================================

begin;

create extension if not exists pgcrypto;

-- 1. HÀM CHUẨN HÓA MÃ MÔN THỐNG NHẤT GIỮA ĐỀ THI, PHÂN CÔNG & PHÂN QUYỀN

create or replace function public.normalize_subject_code(p_raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_raw is null or pg_catalog.btrim(p_raw) = '' then null
    when pg_catalog.lower(pg_catalog.btrim(p_raw)) in ('math', 'toan', 'toán', 'toan hoc', 'toán học', 'mathematics') then 'math'
    when pg_catalog.lower(pg_catalog.btrim(p_raw)) in ('informatics', 'tin', 'tin hoc', 'tin học', 'it') then 'informatics'
    when pg_catalog.lower(pg_catalog.btrim(p_raw)) in ('science', 'khtn', 'khoa hoc tu nhien', 'khoa học tự nhiên', 'natural science', 'natural_science') then 'science'
    when pg_catalog.lower(pg_catalog.btrim(p_raw)) in ('literature', 'van', 'văn', 'ngu van', 'ngữ văn') then 'literature'
    when pg_catalog.lower(pg_catalog.btrim(p_raw)) in ('english', 'anh', 'tieng anh', 'tiếng anh', 'ngoai ngu', 'ngoại ngữ') then 'english'
    when pg_catalog.lower(pg_catalog.btrim(p_raw)) in (
      'history_geo', 'lsdl', 'su dia', 'sử địa', 'su - dia', 'sử - địa',
      'lich su va dia li', 'lịch sử và địa lí', 'lịch sử và địa lý',
      'lich su dia li', 'lịch sử địa lí', 'lịch sử địa lý',
      'lich su & dia li', 'lịch sử & địa lí', 'lịch sử & địa lý',
      'history and geography'
    ) then 'history_geo'
    when pg_catalog.lower(pg_catalog.btrim(p_raw)) in ('technology', 'cn', 'cong nghe', 'công nghệ') then 'technology'
    when pg_catalog.lower(pg_catalog.btrim(p_raw)) in ('civics', 'gdcd', 'giao duc cong dan', 'giáo dục công dân') then 'civics'
    when pg_catalog.lower(pg_catalog.btrim(p_raw)) = 'other' then 'other'
    else pg_catalog.lower(pg_catalog.btrim(p_raw))
  end;
$$;

-- Chuẩn hóa dữ liệu mã môn cũ trong public.exams (chỉ chuẩn hóa khi khớp danh mục chuẩn)
update public.exams
set subject = public.normalize_subject_code(subject)
where subject is not null
  and public.normalize_subject_code(subject) is distinct from subject;

-- 2. BỔ SUNG MÃ GIÁO VIÊN (profiles.teacher_code) & MÃ LỚP (classes.class_code)

alter table public.profiles add column if not exists teacher_code text;

do $$
declare
  v_dup_teacher_codes bigint;
begin
  select pg_catalog.count(*)
  into v_dup_teacher_codes
  from (
    select pg_catalog.lower(pg_catalog.btrim(teacher_code)) as norm_code
    from public.profiles
    where teacher_code is not null
      and pg_catalog.btrim(teacher_code) <> ''
    group by pg_catalog.lower(pg_catalog.btrim(teacher_code))
    having pg_catalog.count(*) > 1
  ) dup;

  if v_dup_teacher_codes = 0 then
    execute 'create unique index if not exists idx_profiles_teacher_code_unique on public.profiles (pg_catalog.lower(pg_catalog.btrim(teacher_code))) where teacher_code is not null and pg_catalog.btrim(teacher_code) <> ''''';
  else
    execute 'create index if not exists idx_profiles_teacher_code_lookup on public.profiles (pg_catalog.lower(pg_catalog.btrim(teacher_code))) where teacher_code is not null and pg_catalog.btrim(teacher_code) <> ''''';
  end if;
end $$;

alter table public.classes add column if not exists class_code text;

update public.classes
set class_code = pg_catalog.upper(
  pg_catalog.regexp_replace(pg_catalog.btrim(name), '\s+', '', 'g')
)
where (class_code is null or pg_catalog.btrim(class_code) = '')
  and name is not null
  and pg_catalog.btrim(name) <> '';

do $$
declare
  v_dup_class_codes bigint;
begin
  select pg_catalog.count(*)
  into v_dup_class_codes
  from (
    select
      school_year,
      pg_catalog.lower(pg_catalog.btrim(class_code)) as norm_code
    from public.classes
    where class_code is not null
      and pg_catalog.btrim(class_code) <> ''
    group by school_year, pg_catalog.lower(pg_catalog.btrim(class_code))
    having pg_catalog.count(*) > 1
  ) dup;

  if v_dup_class_codes = 0 then
    execute 'create unique index if not exists idx_classes_year_code_unique on public.classes (school_year, pg_catalog.lower(pg_catalog.btrim(class_code))) where class_code is not null and pg_catalog.btrim(class_code) <> ''''';
  else
    execute 'create index if not exists idx_classes_year_code_lookup on public.classes (school_year, pg_catalog.lower(pg_catalog.btrim(class_code))) where class_code is not null and pg_catalog.btrim(class_code) <> ''''';
  end if;
end $$;

-- 3. BỔ SUNG CỘT CHUẨN HÓA TRÊN assignments & submissions (CHUẨN BỊ CHO BƯỚC 5)

-- Snapshot mã môn của đề tại thời điểm giao bài để việc sửa đề không làm đổi quyền bài nộp cũ
alter table public.assignments add column if not exists subject_code text;

update public.assignments a
set subject_code = public.normalize_subject_code(e.subject)
from public.exams e
where e.id = a.exam_id
  and (a.subject_code is null or pg_catalog.btrim(a.subject_code) = '');

-- Các trường chấm điểm & nhận xét chuyên biệt (tách khỏi submissions.answers của học sinh)
alter table public.submissions add column if not exists teacher_feedback text;
alter table public.submissions add column if not exists grading_details jsonb default '{}'::jsonb not null;
alter table public.submissions add column if not exists graded_by uuid references public.profiles(id) on delete set null;
alter table public.submissions add column if not exists graded_at timestamp with time zone;

-- 4. TẠO BẢNG PHÂN CÔNG GIẢNG DẠY THEO MÔN (public.teaching_assignments)

create table if not exists public.teaching_assignments (
  id uuid default gen_random_uuid() primary key,
  school_year text not null default '2025-2026',
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject text,
  status text not null default 'active' check (status in ('active', 'ended')),
  needs_subject_completion boolean not null default false,
  notes text,
  started_at timestamp with time zone default timezone('utc'::text, now()) not null,
  ended_at timestamp with time zone,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint teaching_assignments_subject_required_unless_legacy check (
    needs_subject_completion = true
    or (subject is not null and pg_catalog.btrim(subject) <> '')
  )
);

create index if not exists idx_teaching_assignments_teacher_status
  on public.teaching_assignments(teacher_id, status);
create index if not exists idx_teaching_assignments_class_status
  on public.teaching_assignments(class_id, status);
create index if not exists idx_teaching_assignments_year
  on public.teaching_assignments(school_year);
create index if not exists idx_teaching_assignments_missing_subject
  on public.teaching_assignments(status, needs_subject_completion)
  where status = 'active' and (needs_subject_completion = true or subject is null);

create unique index if not exists idx_teaching_assignments_active_unique
  on public.teaching_assignments (school_year, teacher_id, class_id, pg_catalog.lower(subject))
  where status = 'active' and subject is not null;

create unique index if not exists idx_teaching_assignments_legacy_unique
  on public.teaching_assignments (school_year, teacher_id, class_id)
  where status = 'active' and needs_subject_completion = true;

-- Trigger đảm bảo tính toàn vẹn & chuẩn hóa mã môn cho teaching_assignments
create or replace function public.tg_validate_teaching_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_teacher_role text;
  v_class_year text;
  v_norm_subject text;
begin
  select p.role::text
  into v_teacher_role
  from public.profiles p
  where p.id = new.teacher_id;

  if v_teacher_role is null then
    raise exception 'Không tìm thấy hồ sơ giáo viên (teacher_id = %).', new.teacher_id;
  end if;

  if v_teacher_role not in ('teacher', 'admin') then
    raise exception 'Chỉ tài khoản có vai trò Giáo viên hoặc Quản trị viên mới được nhận phân công giảng dạy.'
      using errcode = '22023';
  end if;

  select c.school_year
  into v_class_year
  from public.classes c
  where c.id = new.class_id;

  if v_class_year is null then
    raise exception 'Không tìm thấy lớp học (class_id = %).', new.class_id;
  end if;

  if new.school_year is null or pg_catalog.btrim(new.school_year) = '' then
    new.school_year := v_class_year;
  elsif pg_catalog.btrim(new.school_year) <> pg_catalog.btrim(v_class_year) then
    raise exception 'Năm học phân công (%) không khớp với năm học của lớp (%).', new.school_year, v_class_year
      using errcode = '22023';
  end if;

  if new.subject is not null and pg_catalog.btrim(new.subject) <> '' then
    v_norm_subject := public.normalize_subject_code(new.subject);
    if v_norm_subject not in (
      'math', 'informatics', 'science', 'literature',
      'english', 'history_geo', 'technology', 'civics', 'other'
    ) then
      raise exception 'Mã môn học "%" không nằm trong danh mục môn chuẩn (math, informatics, science, literature, english, history_geo, technology, civics).', new.subject
        using errcode = '22023';
    end if;
    new.subject := v_norm_subject;
    new.needs_subject_completion := false;
  else
    new.subject := null;
    if coalesce(new.needs_subject_completion, false) = false then
      raise exception 'Phân công giảng dạy phải có môn học hợp lệ.' using errcode = '22023';
    end if;
  end if;

  if new.status = 'ended' and new.ended_at is null then
    new.ended_at := timezone('utc'::text, now());
  elsif new.status = 'active' then
    new.ended_at := null;
  end if;

  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists trg_validate_teaching_assignment on public.teaching_assignments;
create trigger trg_validate_teaching_assignment
  before insert or update on public.teaching_assignments
  for each row execute procedure public.tg_validate_teaching_assignment();

-- Chuyển tiếp phân công cũ từ public.classes.teacher_id vào danh sách "Thiếu môn"
-- QUAN TRỌNG: Tuyệt đối KHÔNG tự đoán môn dạy; giữ subject = NULL, needs_subject_completion = true.
insert into public.teaching_assignments (
  school_year,
  teacher_id,
  class_id,
  subject,
  status,
  needs_subject_completion,
  notes
)
select
  coalesce(nullif(pg_catalog.btrim(c.school_year), ''), '2025-2026'),
  c.teacher_id,
  c.id,
  null,
  'active',
  true,
  'Thiếu môn — chuyển tiếp từ phân công lớp cũ (classes.teacher_id). Quản trị viên bổ sung đúng môn dạy hoặc cấp vai trò phụ trách lớp.'
from public.classes c
join public.profiles p on p.id = c.teacher_id
where c.teacher_id is not null
  and p.role::text in ('teacher', 'admin')
  and not exists (
    select 1
    from public.teaching_assignments ta
    where ta.class_id = c.id
      and ta.teacher_id = c.teacher_id
      and ta.school_year = coalesce(nullif(pg_catalog.btrim(c.school_year), ''), '2025-2026')
      and ta.status = 'active'
  );

-- 5. TẠO BẢNG VAI TRÒ PHỤ TRÁCH LỚP RIÊNG BIỆT (public.class_roles)
--    Phân biệt rõ ràng:
--      - class_roles (homeroom / class_manager): quyền xem lớp & quản lý danh sách học sinh.
--      - teaching_assignments (theo môn): quyền giao bài & chấm bài đúng môn đó.
--    KHÔNG tự động gán class_roles từ classes.teacher_id hay teaching_assignments.

create table if not exists public.class_roles (
  id uuid default gen_random_uuid() primary key,
  school_year text not null default '2025-2026',
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  role_type text not null default 'homeroom' check (role_type in ('homeroom', 'class_manager')),
  status text not null default 'active' check (status in ('active', 'ended')),
  notes text,
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamp with time zone default timezone('utc'::text, now()) not null,
  ended_at timestamp with time zone,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_class_roles_teacher_status
  on public.class_roles(teacher_id, status);
create index if not exists idx_class_roles_class_status
  on public.class_roles(class_id, status);

create unique index if not exists idx_class_roles_active_unique
  on public.class_roles(school_year, class_id, teacher_id, role_type)
  where status = 'active';

create or replace function public.tg_validate_class_role()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_role text;
  v_class_year text;
begin
  select p.role::text into v_role from public.profiles p where p.id = new.teacher_id;
  if v_role is null then
    raise exception 'Không tìm thấy hồ sơ giáo viên (teacher_id = %).', new.teacher_id;
  end if;
  if v_role not in ('teacher', 'admin') then
    raise exception 'Chỉ tài khoản Giáo viên hoặc Quản trị viên mới được cấp vai trò phụ trách lớp.'
      using errcode = '22023';
  end if;

  select c.school_year into v_class_year from public.classes c where c.id = new.class_id;
  if v_class_year is null then
    raise exception 'Không tìm thấy lớp học (class_id = %).', new.class_id;
  end if;

  if new.school_year is null or pg_catalog.btrim(new.school_year) = '' then
    new.school_year := v_class_year;
  elsif pg_catalog.btrim(new.school_year) <> pg_catalog.btrim(v_class_year) then
    raise exception 'Năm học vai trò lớp (%) không khớp với năm học của lớp (%).', new.school_year, v_class_year
      using errcode = '22023';
  end if;

  if new.status = 'ended' and new.ended_at is null then
    new.ended_at := timezone('utc'::text, now());
  elsif new.status = 'active' then
    new.ended_at := null;
  end if;

  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists trg_validate_class_role on public.class_roles;
create trigger trg_validate_class_role
  before insert or update on public.class_roles
  for each row execute procedure public.tg_validate_class_role();

-- 6. RLS CHO 2 BẢNG MỚI (teaching_assignments & class_roles)
--    Lưu ý: CHƯA thay đổi RLS của classes, class_members, assignments, submissions ở Bước 4!

alter table public.teaching_assignments enable row level security;
alter table public.class_roles enable row level security;

drop policy if exists "Xem phân công giảng dạy theo phạm vi" on public.teaching_assignments;
drop policy if exists "Chỉ Quản trị thêm phân công giảng dạy" on public.teaching_assignments;
drop policy if exists "Chỉ Quản trị cập nhật phân công giảng dạy" on public.teaching_assignments;
drop policy if exists "Chỉ Quản trị xóa phân công giảng dạy" on public.teaching_assignments;

create policy "Xem phân công giảng dạy theo phạm vi" on public.teaching_assignments
  for select to authenticated using (
    public.is_admin_role()
    or (public.current_user_role() = 'teacher' and teacher_id = auth.uid())
  );

create policy "Chỉ Quản trị thêm phân công giảng dạy" on public.teaching_assignments
  for insert to authenticated with check (public.is_admin_role());

create policy "Chỉ Quản trị cập nhật phân công giảng dạy" on public.teaching_assignments
  for update to authenticated using (public.is_admin_role())
  with check (public.is_admin_role());

create policy "Chỉ Quản trị xóa phân công giảng dạy" on public.teaching_assignments
  for delete to authenticated using (public.is_admin_role());

drop policy if exists "Xem vai trò phụ trách lớp theo phạm vi" on public.class_roles;
drop policy if exists "Chỉ Quản trị quản lý vai trò phụ trách lớp" on public.class_roles;

create policy "Xem vai trò phụ trách lớp theo phạm vi" on public.class_roles
  for select to authenticated using (
    public.is_admin_role()
    or (public.current_user_role() = 'teacher' and teacher_id = auth.uid())
  );

create policy "Chỉ Quản trị quản lý vai trò phụ trách lớp" on public.class_roles
  for all to authenticated
  using (public.is_admin_role())
  with check (public.is_admin_role());

revoke all on table public.teaching_assignments, public.class_roles from public, anon;
grant select, insert, update, delete on table public.teaching_assignments, public.class_roles to authenticated;

-- 7. DANH SÁCH "THIẾU MÔN" & BÁO CÁO LỚP BỊ ẢNH HƯỞNG TRƯỚC KHI BẬT QUYỀN MỚI (BƯỚC 5)

create or replace view public.v_teaching_assignments_missing_subject as
select
  ta.id as teaching_assignment_id,
  ta.school_year,
  ta.class_id,
  c.class_code,
  c.name as class_name,
  c.grade,
  ta.teacher_id,
  p.teacher_code,
  p.full_name as teacher_name,
  p.email as teacher_email,
  ta.status,
  ta.needs_subject_completion,
  ta.notes,
  ta.created_at,
  (
    select pg_catalog.count(*)::bigint
    from public.assignments a
    where a.class_id = ta.class_id
      and (a.assigned_by = ta.teacher_id or a.assigned_by is null)
  ) as affected_assignments_count,
  (
    select pg_catalog.count(*)::bigint
    from public.submissions s
    join public.assignments a on a.id = s.assignment_id
    where a.class_id = ta.class_id
      and (a.assigned_by = ta.teacher_id or a.assigned_by is null)
  ) as affected_submissions_count
from public.teaching_assignments ta
join public.classes c on c.id = ta.class_id
join public.profiles p on p.id = ta.teacher_id
where ta.status = 'active'
  and (ta.needs_subject_completion = true or ta.subject is null or pg_catalog.btrim(ta.subject) = '')
order by ta.school_year desc, c.grade asc, c.name asc, p.full_name asc;

create or replace view public.v_cutover_impacted_classes as
with class_stats as (
  select
    c.id as class_id,
    c.name as class_name,
    c.class_code,
    c.grade,
    c.school_year,
    c.teacher_id as legacy_teacher_id,
    coalesce(lp.full_name, c.teacher_name) as legacy_teacher_name,
    lp.teacher_code as legacy_teacher_code,
    lp.email as legacy_teacher_email,
    (
      select pg_catalog.count(*)::bigint
      from public.teaching_assignments ta
      where ta.class_id = c.id
        and ta.status = 'active'
        and (ta.needs_subject_completion = true or ta.subject is null or pg_catalog.btrim(ta.subject) = '')
    ) as missing_subject_count,
    (
      select pg_catalog.count(*)::bigint
      from public.teaching_assignments ta
      where ta.class_id = c.id
        and ta.status = 'active'
        and ta.needs_subject_completion = false
        and ta.subject is not null
        and ta.school_year = c.school_year
    ) as completed_subject_count,
    (
      select pg_catalog.count(*)::bigint
      from public.class_roles cr
      where cr.class_id = c.id
        and cr.status = 'active'
        and cr.school_year = c.school_year
    ) as explicit_class_role_count,
    (
      select pg_catalog.count(*)::bigint
      from public.assignments a
      where a.class_id = c.id
    ) as total_assignments_count,
    (
      select pg_catalog.count(*)::bigint
      from public.submissions s
      join public.assignments a on a.id = s.assignment_id
      where a.class_id = c.id
    ) as total_submissions_count,
    (
      select pg_catalog.count(*)::bigint
      from public.assignments a
      left join public.exams e on e.id = a.exam_id
      where a.class_id = c.id
        and (
          a.assigned_by is null
          or not exists (
            select 1
            from public.teaching_assignments ta2
            where ta2.class_id = a.class_id
              and ta2.teacher_id = a.assigned_by
              and ta2.status = 'active'
              and ta2.needs_subject_completion = false
              and ta2.school_year = c.school_year
              and public.normalize_subject_code(ta2.subject) = coalesce(
                public.normalize_subject_code(a.subject_code),
                public.normalize_subject_code(e.subject)
              )
          )
        )
    ) as unmapped_assignments_count
  from public.classes c
  left join public.profiles lp on lp.id = c.teacher_id
)
select
  cs.*,
  case
    when cs.missing_subject_count > 0 and cs.legacy_teacher_id is not null and cs.explicit_class_role_count = 0
      then 'Còn phân công "Thiếu môn" và giáo viên cũ chưa có vai trò phụ trách lớp riêng (sẽ mất quyền giao/chấm/quản lý thành viên khi bật Bước 5).'
    when cs.missing_subject_count > 0
      then 'Còn phân công "Thiếu môn" chưa xác định môn giảng dạy (sẽ bị chặn giao/chấm bài ở Bước 5).'
    when cs.legacy_teacher_id is not null and cs.explicit_class_role_count = 0 and cs.completed_subject_count = 0
      then 'Lớp chỉ có teacher_id cũ, chưa có phân công môn và chưa cấp vai trò phụ trách lớp (sẽ không có giáo viên truy cập lớp ở Bước 5).'
    when cs.unmapped_assignments_count > 0
      then 'Có lượt giao bài cũ mà người giao chưa có phân công hoạt động đúng môn tại lớp.'
    else 'Sẵn sàng'
  end as impact_reason
from class_stats cs
where cs.missing_subject_count > 0
   or (cs.legacy_teacher_id is not null and cs.explicit_class_role_count = 0 and cs.completed_subject_count = 0)
   or cs.unmapped_assignments_count > 0
order by cs.school_year desc, cs.grade asc, cs.class_name asc;

-- RPC chỉ đọc cho Quản trị viên (và SQL Editor) xem danh sách "Thiếu môn" + lớp bị ảnh hưởng
create or replace function public.get_teaching_cutover_readiness()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin_or_sql boolean := (
    (v_uid is null and CURRENT_USER in ('postgres', 'supabase_admin', 'service_role'))
    or (v_uid is not null and public.is_admin_role())
  );
  v_missing jsonb;
  v_impacted jsonb;
  v_missing_count bigint;
  v_impacted_count bigint;
begin
  if not v_is_admin_or_sql then
    raise exception 'Chỉ Quản trị viên mới được phép xem báo cáo sẵn sàng chuyển đổi phân quyền.' using errcode = '42501';
  end if;

  select
    pg_catalog.count(*),
    coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(v)), '[]'::jsonb)
  into v_missing_count, v_missing
  from public.v_teaching_assignments_missing_subject v;

  select
    pg_catalog.count(*),
    coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(v)), '[]'::jsonb)
  into v_impacted_count, v_impacted
  from public.v_cutover_impacted_classes v;

  return pg_catalog.jsonb_build_object(
    'readyForCutover', (v_missing_count = 0 and v_impacted_count = 0),
    'missingSubjectCount', v_missing_count,
    'impactedClassCount', v_impacted_count,
    'missingSubjectItems', v_missing,
    'impactedClasses', v_impacted
  );
end;
$$;

revoke all on public.v_teaching_assignments_missing_subject from public, anon, authenticated;
revoke all on public.v_cutover_impacted_classes from public, anon, authenticated;
revoke all on function public.get_teaching_cutover_readiness() from public, anon;
revoke all on function public.tg_validate_teaching_assignment() from public, anon, authenticated;
revoke all on function public.tg_validate_class_role() from public, anon, authenticated;

grant select on public.v_teaching_assignments_missing_subject to authenticated;
grant select on public.v_cutover_impacted_classes to authenticated;
grant execute on function public.normalize_subject_code(text) to authenticated;
grant execute on function public.get_teaching_cutover_readiness() to authenticated;

notify pgrst, 'reload schema';

commit;

-- =====================================================================
-- TRUY VẤN KIỂM TRA CHỈ ĐỌC SAU BƯỚC 4 (CHẠY TRƯỚC KHI BẬT BƯỚC 5):
--   select * from public.v_teaching_assignments_missing_subject;
--   select * from public.v_cutover_impacted_classes;
--   select public.get_teaching_cutover_readiness();
-- =====================================================================
