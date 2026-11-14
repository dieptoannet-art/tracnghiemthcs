-- =====================================================================
-- MIGRATION BỔ SUNG & CỦNG CỐ BẢO MẬT (BƯỚC 2):
-- ĐỒNG BỘ LỚP HỌC, THÀNH VIÊN, ĐỀ THI & LƯỢT GIAO BÀI
-- File: src/data/02_sync_classes_exams_assignments.sql
--
-- Điều kiện chạy:
--   Chạy SAU file Bước 1 (src/data/01_bootstrap_assignment_tables.sql).
--
-- Nguyên tắc an toàn:
--   1. Chỉ bổ sung cột, bảng phụ (public.exam_protected_keys), chỉ mục,
--      trigger bảo vệ, hàm RPC và chính sách RLS.
--   2. KHÔNG xóa bảng (DROP TABLE), KHÔNG tạo lại bảng đè dữ liệu cũ.
--   3. Tương thích với production: không ép kiểu enum cứng nếu cột đang là text,
--      và bọc kiểm tra tồn tại to_regclass(...) cho các bảng tùy chọn như
--      protected_solutions, exam_matrices, audit_logs.
--   4. Mọi hàm SECURITY DEFINER đều dùng SET search_path = '', kiểm tra
--      auth.uid()/role và thu hồi EXECUTE từ PUBLIC, anon.
-- =====================================================================

begin;

-- 1. HÀM TRỢ GIÚP PHÂN QUYỀN & CHỐNG ĐỆ QUY RLS (SECURITY DEFINER + search_path = '')

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then 'anon'
    else coalesce(
      (select p.role::text from public.profiles p where p.id = auth.uid()),
      'student'
    )
  end;
$$;

create or replace function public.is_admin_role()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and public.current_user_role() = 'admin';
$$;

create or replace function public.is_staff_role()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and public.current_user_role() in ('teacher', 'admin', 'reviewer');
$$;

create or replace function public.is_class_teacher(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and public.current_user_role() in ('teacher', 'admin')
    and exists (
      select 1
      from public.classes c
      where c.id = p_class_id
        and c.teacher_id = auth.uid()
    );
$$;

create or replace function public.is_class_member(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.class_members cm
      where cm.class_id = p_class_id
        and cm.student_id = auth.uid()
    );
$$;

-- Củng cố hàm trigger tạo hồ sơ mới khi đăng ký:
--   - Mọi tài khoản tự đăng ký CHỈ nhận vai trò 'student' (KHÔNG đọc role từ raw_user_meta_data).
--   - Khi trùng id (tài khoản đã tồn tại), KHÔNG ghi đè cột role để giữ nguyên quyền hiện có.
--   - Quyền 'teacher' / 'reviewer' / 'admin' mới do Quản trị viên cấp qua luồng tin cậy.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_full_name text;
  v_grade text;
  v_student_code text;
  v_school_name text;
begin
  v_full_name := coalesce(
    nullif(pg_catalog.btrim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(pg_catalog.split_part(coalesce(new.email, ''), '@', 1), ''),
    'Người dùng'
  );

  v_grade := case
    when (new.raw_user_meta_data->>'grade') in ('6', '7', '8', '9')
    then (new.raw_user_meta_data->>'grade')
    else null
  end;

  v_student_code := nullif(pg_catalog.btrim(new.raw_user_meta_data->>'student_code'), '');
  v_school_name := coalesce(
    nullif(pg_catalog.btrim(new.raw_user_meta_data->>'school_name'), ''),
    'Trường THCS Tây Đô'
  );

  insert into public.profiles (
    id, full_name, email, role, grade, student_code, subject, school_name
  )
  values (
    new.id,
    v_full_name,
    coalesce(new.email, ''),
    'student',
    v_grade,
    v_student_code,
    null,
    v_school_name
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name);

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'auth'
      and c.relname = 'users'
      and t.tgname = 'on_auth_user_created'
      and not t.tgisinternal
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute procedure public.handle_new_user();
  end if;
exception
  when insufficient_privilege then
    raise notice 'Bỏ qua tạo trigger on_auth_user_created trên auth.users do giới hạn quyền; hàm handle_new_user() đã được cập nhật.';
end $$;

-- 2. BỔ SUNG CỘT & KIỂM TRA TƯƠNG THÍCH DỮ LIỆU CŨ (KHÔNG XÓA HAY GHI ĐÈ DỮ LIỆU)

-- 2.1. Bảng classes: lưu thêm tên giáo viên hiển thị cho học sinh
alter table public.classes
  add column if not exists teacher_name text;

-- 2.2. Bảng exams: nới lỏng ràng buộc cũ question_ids NOT NULL để hỗ trợ đề hỗn hợp,
-- đồng thời giữ nguyên 100% giá trị question_ids hiện có
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'exams'
      and column_name = 'question_ids'
  ) then
    alter table public.exams alter column question_ids set default '{}'::uuid[];
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'exams'
        and column_name = 'question_ids'
        and is_nullable = 'NO'
    ) then
      alter table public.exams alter column question_ids drop not null;
    end if;
  end if;
end $$;

alter table public.exams
  add column if not exists period text default 'mid1' not null;

alter table public.exams
  add column if not exists question_count integer default 0 not null;

alter table public.exams
  add column if not exists public_questions jsonb default '[]'::jsonb not null;

alter table public.exams
  add column if not exists client_request_id uuid;

create unique index if not exists idx_exams_client_request_id
  on public.exams(client_request_id)
  where client_request_id is not null;

-- 2.3. Bảng tách riêng đáp án / lời giải / rubric của đề thi (chỉ tác giả đề & admin đọc/ghi)
create table if not exists public.exam_protected_keys (
  exam_id uuid references public.exams(id) on delete cascade primary key,
  keys jsonb default '{}'::jsonb not null,
  updated_by uuid references public.profiles(id),
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2.4. Bảng assignments: kiểm tra tương thích trước khi gắn check constraint trạng thái
alter table public.assignments
  add column if not exists status text default 'active';

do $$
declare
  v_invalid_status_count bigint;
begin
  select pg_catalog.count(*)
  into v_invalid_status_count
  from public.assignments a
  where a.status is not null
    and a.status not in ('active', 'closed', 'scheduled');

  if v_invalid_status_count > 0 then
    raise exception 'Phát hiện % dòng public.assignments có status ngoài (active, closed, scheduled). Hãy kiểm tra dữ liệu cũ trước khi thêm ràng buộc.', v_invalid_status_count;
  end if;

  alter table public.assignments
    add constraint assignments_status_check
    check (status is null or status in ('active', 'closed', 'scheduled'));
exception
  when duplicate_object then null;
end $$;

alter table public.assignments
  add column if not exists round_label text default 'Đợt 1' not null;

alter table public.assignments
  add column if not exists assigned_by uuid references public.profiles(id);

alter table public.assignments
  add column if not exists client_request_id uuid;

create unique index if not exists idx_assignments_client_request_id
  on public.assignments(client_request_id)
  where client_request_id is not null;

-- 3. TRIGGER BẢO VỆ TÍNH TOÀN VẸN & CHỐNG LEO THANG QUYỀN / LỘ ĐÁP ÁN

-- 3.1. Khóa profiles.role đối với mọi phiên không phải Admin (chặn cả INSERT, UPDATE lẫn UPSERT)
create or replace function public.tg_protect_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_trusted_admin boolean := (
    (v_uid is null and CURRENT_USER in ('postgres', 'supabase_admin', 'service_role'))
    or (v_uid is not null and public.is_admin_role())
  );
begin
  if TG_OP = 'INSERT' then
    if coalesce(new.role::text, 'student') <> 'student' and not v_is_trusted_admin then
      raise exception 'Tài khoản tự đăng ký chỉ được phép khởi tạo với vai trò Học sinh (student).'
        using errcode = '42501';
    end if;
  elsif TG_OP = 'UPDATE' then
    if new.role::text is distinct from old.role::text and not v_is_trusted_admin then
      raise exception 'Chỉ Quản trị viên mới được phép thay đổi vai trò tài khoản (profiles.role).'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_role on public.profiles;
create trigger trg_protect_profile_role
  before insert or update on public.profiles
  for each row execute procedure public.tg_protect_profile_role();

-- 3.2. Sau khi phát hành lượt giao bài, khóa cứng class_id, exam_id và assigned_by
create or replace function public.tg_lock_assignment_immutable_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.class_id is distinct from old.class_id
     or new.exam_id is distinct from old.exam_id
     or (
       new.assigned_by is distinct from old.assigned_by
       and not (old.assigned_by is null and public.is_admin_role())
     ) then
    raise exception 'Không được phép thay đổi lớp học, đề thi hoặc người giao sau khi đã phát hành lượt giao bài.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lock_assignment_immutable_fields on public.assignments;
create trigger trg_lock_assignment_immutable_fields
  before update on public.assignments
  for each row execute procedure public.tg_lock_assignment_immutable_fields();

-- 3.3. Gỡ bỏ trigger tự xóa isCorrect/is_correct nếu từng tồn tại ở bản thử nghiệm trước đó
-- để bảo toàn đáp án câu Đúng–Sai hiện có và khi nhập mới cho luồng luyện tập.
drop trigger if exists trg_sanitize_question_sub_items on public.questions;
drop function if exists public.tg_sanitize_question_sub_items();

-- 4. BẬT RLS & THIẾT LẬP CHÍNH SÁCH TRUY CẬP CHẶT CHẼ

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.questions enable row level security;
alter table public.exams enable row level security;
alter table public.exam_protected_keys enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;

-- 4.1. Policies cho public.profiles (xóa toàn bộ policy cũ còn sót để chống đệ quy & chặn tự nâng role qua INSERT/UPDATE/UPSERT)
do $$
declare
  v_pol record;
begin
  for v_pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
  loop
    execute format('drop policy if exists %I on public.profiles', v_pol.policyname);
  end loop;
end $$;

create policy "Xem hồ sơ cá nhân hoặc quản lý" on public.profiles
  for select to authenticated using (
    auth.uid() = id or public.is_staff_role()
  );

create policy "Người dùng tự cập nhật thông tin của mình" on public.profiles
  for update to authenticated using (
    auth.uid() = id
  ) with check (
    auth.uid() = id
    and role::text = public.current_user_role()
  );

create policy "Quản trị viên có toàn quyền cập nhật hồ sơ" on public.profiles
  for update to authenticated using (
    public.is_admin_role()
  ) with check (
    public.is_admin_role()
  );

create policy "Cho phép tạo hồ sơ ban đầu" on public.profiles
  for insert to authenticated with check (
    auth.uid() = id
    and role::text = 'student'
  );

-- 4.2. Policies cho public.classes
drop policy if exists "Xem lớp học phù hợp" on public.classes;
drop policy if exists "Giáo viên và Quản trị tạo lớp" on public.classes;
drop policy if exists "Giáo viên và Quản trị cập nhật lớp" on public.classes;
drop policy if exists "Giáo viên và Quản trị xóa lớp" on public.classes;

create policy "Xem lớp học phù hợp" on public.classes
  for select to authenticated using (
    teacher_id = auth.uid()
    or public.is_class_member(id)
    or public.is_admin_role()
  );

create policy "Giáo viên và Quản trị tạo lớp" on public.classes
  for insert to authenticated with check (
    teacher_id = auth.uid()
    and public.current_user_role() in ('teacher', 'admin')
  );

create policy "Giáo viên và Quản trị cập nhật lớp" on public.classes
  for update to authenticated using (
    public.is_admin_role()
    or (public.current_user_role() = 'teacher' and teacher_id = auth.uid())
  ) with check (
    public.is_admin_role()
    or (public.current_user_role() = 'teacher' and teacher_id = auth.uid())
  );

create policy "Giáo viên và Quản trị xóa lớp" on public.classes
  for delete to authenticated using (
    public.is_admin_role()
    or (public.current_user_role() = 'teacher' and teacher_id = auth.uid())
  );

-- 4.3. Policies cho public.class_members
drop policy if exists "Xem thành viên lớp phù hợp" on public.class_members;
drop policy if exists "Giáo viên thêm học sinh vào lớp của mình" on public.class_members;
drop policy if exists "Quản lý xóa thành viên lớp" on public.class_members;

create policy "Xem thành viên lớp phù hợp" on public.class_members
  for select to authenticated using (
    student_id = auth.uid()
    or public.is_class_teacher(class_id)
    or public.is_admin_role()
  );

create policy "Giáo viên thêm học sinh vào lớp của mình" on public.class_members
  for insert to authenticated with check (
    public.is_admin_role()
    or (
      public.current_user_role() = 'teacher'
      and public.is_class_teacher(class_id)
    )
  );

create policy "Quản lý xóa thành viên lớp" on public.class_members
  for delete to authenticated using (
    student_id = auth.uid()
    or public.is_class_teacher(class_id)
    or public.is_admin_role()
  );

-- 4.4. Policies cho ngân hàng câu hỏi (questions & protected_solutions):
-- Khóa hoàn toàn truy cập từ anon; protected_solutions chỉ mở cho giáo viên/quản trị/kiểm duyệt
drop policy if exists "Học sinh chỉ xem câu hỏi được duyệt trong bài thi" on public.questions;
drop policy if exists "Giáo viên và Quản trị được thêm câu hỏi" on public.questions;
drop policy if exists "Giáo viên và Quản trị được sửa câu hỏi" on public.questions;
drop policy if exists "Quản trị viên được xóa câu hỏi" on public.questions;

create policy "Học sinh chỉ xem câu hỏi được duyệt trong bài thi" on public.questions
  for select to authenticated using (
    status::text = 'approved'
    or public.is_staff_role()
  );

create policy "Giáo viên và Quản trị được thêm câu hỏi" on public.questions
  for insert to authenticated with check (
    public.is_staff_role()
  );

create policy "Giáo viên và Quản trị được sửa câu hỏi" on public.questions
  for update to authenticated using (
    public.is_staff_role()
  ) with check (
    public.is_staff_role()
  );

create policy "Quản trị viên được xóa câu hỏi" on public.questions
  for delete to authenticated using (
    public.current_user_role() in ('admin', 'reviewer')
  );

do $$
begin
  if to_regclass('public.protected_solutions') is not null then
    execute 'alter table public.protected_solutions enable row level security';
    execute 'drop policy if exists "Giáo viên bảo vệ đáp án" on public.protected_solutions';
    execute 'drop policy if exists "Giáo viên và Quản trị được thêm đáp án bảo vệ" on public.protected_solutions';
    execute 'drop policy if exists "Giáo viên và Quản trị được sửa đáp án bảo vệ" on public.protected_solutions';
    execute 'drop policy if exists "Quản trị viên được xóa đáp án bảo vệ" on public.protected_solutions';

    execute 'create policy "Giáo viên bảo vệ đáp án" on public.protected_solutions for select to authenticated using (public.is_staff_role())';
    execute 'create policy "Giáo viên và Quản trị được thêm đáp án bảo vệ" on public.protected_solutions for insert to authenticated with check (public.is_staff_role())';
    execute 'create policy "Giáo viên và Quản trị được sửa đáp án bảo vệ" on public.protected_solutions for update to authenticated using (public.is_staff_role()) with check (public.is_staff_role())';
    execute 'create policy "Quản trị viên được xóa đáp án bảo vệ" on public.protected_solutions for delete to authenticated using (public.current_user_role() in (''admin'', ''reviewer''))';

    execute 'revoke all on table public.protected_solutions from public, anon';
    execute 'grant select, insert, update, delete on table public.protected_solutions to authenticated';
  end if;
end $$;

-- 4.5. Policies cho public.exam_matrices (áp dụng có điều kiện nếu bảng đã tồn tại)
do $$
declare
  v_has_created_by boolean;
begin
  if to_regclass('public.exam_matrices') is not null then
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'exam_matrices'
        and column_name = 'created_by'
    ) into v_has_created_by;

    execute 'alter table public.exam_matrices enable row level security';
    execute 'drop policy if exists "Giáo viên và Quản trị xem ma trận" on public.exam_matrices';
    execute 'drop policy if exists "Giáo viên và Quản trị tạo ma trận" on public.exam_matrices';
    execute 'drop policy if exists "Giáo viên và Quản trị cập nhật ma trận" on public.exam_matrices';
    execute 'drop policy if exists "Giáo viên và Quản trị xóa ma trận" on public.exam_matrices';

    execute 'create policy "Giáo viên và Quản trị xem ma trận" on public.exam_matrices for select to authenticated using (public.is_staff_role())';

    if v_has_created_by then
      execute 'create policy "Giáo viên và Quản trị tạo ma trận" on public.exam_matrices for insert to authenticated with check (public.is_staff_role() and (created_by is null or created_by = auth.uid() or public.is_admin_role()))';
      execute 'create policy "Giáo viên và Quản trị cập nhật ma trận" on public.exam_matrices for update to authenticated using (created_by = auth.uid() or public.current_user_role() in (''admin'', ''reviewer'')) with check (created_by = auth.uid() or public.current_user_role() in (''admin'', ''reviewer''))';
      execute 'create policy "Giáo viên và Quản trị xóa ma trận" on public.exam_matrices for delete to authenticated using (created_by = auth.uid() or public.is_admin_role())';
    else
      execute 'create policy "Giáo viên và Quản trị tạo ma trận" on public.exam_matrices for insert to authenticated with check (public.is_staff_role())';
      execute 'create policy "Giáo viên và Quản trị cập nhật ma trận" on public.exam_matrices for update to authenticated using (public.is_staff_role()) with check (public.is_staff_role())';
      execute 'create policy "Giáo viên và Quản trị xóa ma trận" on public.exam_matrices for delete to authenticated using (public.is_admin_role())';
    end if;

    execute 'revoke all on table public.exam_matrices from public, anon';
    execute 'grant select, insert, update, delete on table public.exam_matrices to authenticated';
  end if;
end $$;

-- 4.6. Policies cho public.exams: CHẶN HỌC SINH ĐỌC TRỰC TIẾP BẢNG EXAMS (kể cả khi biết exam_id)
-- Học sinh chỉ nhận thông tin tóm tắt qua RPC public.get_student_assigned_summaries()
drop policy if exists "Xem đề thi theo quyền lớp và tác giả" on public.exams;
drop policy if exists "Chỉ tác giả và Quản trị xem đề thi" on public.exams;
drop policy if exists "Giáo viên và Quản trị tạo đề" on public.exams;
drop policy if exists "Tác giả và Quản trị cập nhật đề" on public.exams;
drop policy if exists "Tác giả và Quản trị xóa đề" on public.exams;

create policy "Chỉ tác giả và Quản trị xem đề thi" on public.exams
  for select to authenticated using (
    public.is_admin_role()
    or (public.current_user_role() = 'teacher' and author_id = auth.uid())
  );

create policy "Giáo viên và Quản trị tạo đề" on public.exams
  for insert to authenticated with check (
    author_id = auth.uid()
    and public.current_user_role() in ('teacher', 'admin')
  );

create policy "Tác giả và Quản trị cập nhật đề" on public.exams
  for update to authenticated using (
    public.is_admin_role()
    or (public.current_user_role() = 'teacher' and author_id = auth.uid())
  ) with check (
    public.is_admin_role()
    or (public.current_user_role() = 'teacher' and author_id = auth.uid())
  );

create policy "Tác giả và Quản trị xóa đề" on public.exams
  for delete to authenticated using (
    public.is_admin_role()
    or (public.current_user_role() = 'teacher' and author_id = auth.uid())
  );

-- 4.7. Policies cho public.exam_protected_keys (cấm tuyệt đối học sinh xem đáp án/lời giải/rubric)
drop policy if exists "Chỉ giáo viên tác giả và quản trị xem đáp án đề" on public.exam_protected_keys;
drop policy if exists "Chỉ giáo viên tác giả và quản trị ghi đáp án đề" on public.exam_protected_keys;
drop policy if exists "Chỉ giáo viên tác giả và quản trị sửa đáp án đề" on public.exam_protected_keys;
drop policy if exists "Chỉ tác giả và quản trị xóa đáp án đề" on public.exam_protected_keys;

create policy "Chỉ giáo viên tác giả và quản trị xem đáp án đề" on public.exam_protected_keys
  for select to authenticated using (
    public.is_admin_role()
    or (
      public.current_user_role() = 'teacher'
      and exists (
        select 1 from public.exams e
        where e.id = exam_protected_keys.exam_id
          and e.author_id = auth.uid()
      )
    )
  );

create policy "Chỉ giáo viên tác giả và quản trị ghi đáp án đề" on public.exam_protected_keys
  for insert to authenticated with check (
    public.is_admin_role()
    or (
      public.current_user_role() = 'teacher'
      and exists (
        select 1 from public.exams e
        where e.id = exam_protected_keys.exam_id
          and e.author_id = auth.uid()
      )
    )
  );

create policy "Chỉ giáo viên tác giả và quản trị sửa đáp án đề" on public.exam_protected_keys
  for update to authenticated using (
    public.is_admin_role()
    or (
      public.current_user_role() = 'teacher'
      and exists (
        select 1 from public.exams e
        where e.id = exam_protected_keys.exam_id
          and e.author_id = auth.uid()
      )
    )
  ) with check (
    public.is_admin_role()
    or (
      public.current_user_role() = 'teacher'
      and exists (
        select 1 from public.exams e
        where e.id = exam_protected_keys.exam_id
          and e.author_id = auth.uid()
      )
    )
  );

create policy "Chỉ tác giả và quản trị xóa đáp án đề" on public.exam_protected_keys
  for delete to authenticated using (
    public.is_admin_role()
    or (
      public.current_user_role() = 'teacher'
      and exists (
        select 1 from public.exams e
        where e.id = exam_protected_keys.exam_id
          and e.author_id = auth.uid()
      )
    )
  );

-- 4.8. Policies cho public.assignments
drop policy if exists "Học sinh xem bài của lớp mình" on public.assignments;
drop policy if exists "Giáo viên giao bài cho lớp và đề thuộc quyền" on public.assignments;
drop policy if exists "Giáo viên cập nhật lượt giao của mình" on public.assignments;
drop policy if exists "Giáo viên xóa lượt giao của mình" on public.assignments;

create policy "Học sinh xem bài của lớp mình" on public.assignments
  for select to authenticated using (
    public.is_class_member(class_id)
    or public.is_class_teacher(class_id)
    or (public.current_user_role() = 'teacher' and assigned_by = auth.uid())
    or public.is_admin_role()
  );

create policy "Giáo viên giao bài cho lớp và đề thuộc quyền" on public.assignments
  for insert to authenticated with check (
    assigned_by = auth.uid()
    and (
      public.is_admin_role()
      or (
        public.current_user_role() = 'teacher'
        and public.is_class_teacher(class_id)
        and exists (
          select 1 from public.exams e
          where e.id = exam_id
            and e.author_id = auth.uid()
        )
      )
    )
  );

-- Lưu ý: trigger trg_lock_assignment_immutable_fields khóa thêm class_id, exam_id, assigned_by khi UPDATE
create policy "Giáo viên cập nhật lượt giao của mình" on public.assignments
  for update to authenticated using (
    public.is_admin_role()
    or (
      public.current_user_role() = 'teacher'
      and (public.is_class_teacher(class_id) or assigned_by = auth.uid())
    )
  ) with check (
    public.is_admin_role()
    or (
      public.current_user_role() = 'teacher'
      and (public.is_class_teacher(class_id) or assigned_by = auth.uid())
    )
  );

create policy "Giáo viên xóa lượt giao của mình" on public.assignments
  for delete to authenticated using (
    public.is_admin_role()
    or (
      public.current_user_role() = 'teacher'
      and (public.is_class_teacher(class_id) or assigned_by = auth.uid())
    )
  );

-- 4.9. Policies cho public.submissions (Bước 2: CHỈ CHO HỌC SINH ĐỌC TRẠNG THÁI BÀI CỦA CHÍNH MÌNH, CHẶN MỌI GHI TRỰC TIẾP TỪ HỌC SINH)
drop policy if exists "Học sinh chỉ xem và gửi bài của chính mình" on public.submissions;
drop policy if exists "Xem bài nộp theo quyền" on public.submissions;
drop policy if exists "Học sinh nộp bài của chính mình" on public.submissions;
drop policy if exists "Cập nhật bài nộp theo quyền" on public.submissions;
drop policy if exists "Quản trị tạo bản ghi bài nộp" on public.submissions;
drop policy if exists "Giáo viên và Quản trị chấm bài nộp" on public.submissions;
drop policy if exists "Quản trị xóa bài nộp" on public.submissions;

create policy "Xem bài nộp theo quyền" on public.submissions
  for select to authenticated using (
    student_id = auth.uid()
    or public.is_admin_role()
    or (
      public.current_user_role() = 'teacher'
      and exists (
        select 1
        from public.assignments a
        where a.id = submissions.assignment_id
          and (public.is_class_teacher(a.class_id) or a.assigned_by = auth.uid())
      )
    )
  );

-- Học sinh bị chặn hoàn toàn INSERT / UPDATE / DELETE vào submissions ở Bước 2 (chỉ admin/teacher theo phân quyền quản lý)
create policy "Quản trị tạo bản ghi bài nộp" on public.submissions
  for insert to authenticated with check (
    public.is_admin_role()
  );

create policy "Giáo viên và Quản trị chấm bài nộp" on public.submissions
  for update to authenticated using (
    public.is_admin_role()
    or (
      public.current_user_role() = 'teacher'
      and exists (
        select 1
        from public.assignments a
        where a.id = submissions.assignment_id
          and (public.is_class_teacher(a.class_id) or a.assigned_by = auth.uid())
      )
    )
  ) with check (
    public.is_admin_role()
    or (
      public.current_user_role() = 'teacher'
      and exists (
        select 1
        from public.assignments a
        where a.id = submissions.assignment_id
          and (public.is_class_teacher(a.class_id) or a.assigned_by = auth.uid())
      )
    )
  );

create policy "Quản trị xóa bài nộp" on public.submissions
  for delete to authenticated using (
    public.is_admin_role()
  );

-- 4.10. Policies cho public.audit_logs (áp dụng có điều kiện nếu bảng đã tồn tại)
do $$
begin
  if to_regclass('public.audit_logs') is not null then
    execute 'alter table public.audit_logs enable row level security';
    execute 'drop policy if exists "Chỉ Quản trị xem nhật ký thao tác" on public.audit_logs';
    execute 'drop policy if exists "Cán bộ ghi nhật ký thao tác" on public.audit_logs';
    execute 'create policy "Chỉ Quản trị xem nhật ký thao tác" on public.audit_logs for select to authenticated using (public.is_admin_role())';
    execute 'create policy "Cán bộ ghi nhật ký thao tác" on public.audit_logs for insert to authenticated with check (public.is_staff_role())';
    execute 'revoke all on table public.audit_logs from public, anon';
    execute 'grant select, insert on table public.audit_logs to authenticated';
  end if;
end $$;

-- 5. RPC AN TOÀN CHO BƯỚC 2:
--    5.1. Liên kết học sinh vào lớp bằng khóa định danh ổn định
--    5.2. Trả thông tin TÓM TẮT "Bài được giao" cho học sinh (KHÔNG trả câu hỏi / đáp án / lời giải)

create or replace function public.teacher_enroll_student(
  p_class_id uuid,
  p_identifier text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_clean text := pg_catalog.btrim(coalesce(p_identifier, ''));
  v_student public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'Bạn cần đăng nhập để thực hiện thao tác này.' using errcode = '42501';
  end if;

  if public.current_user_role() not in ('teacher', 'admin') then
    raise exception 'Chỉ Giáo viên hoặc Quản trị viên mới được phép thêm học sinh vào lớp.' using errcode = '42501';
  end if;

  if not (public.is_class_teacher(p_class_id) or public.is_admin_role()) then
    raise exception 'Bạn không có quyền quản lý thành viên của lớp học này.' using errcode = '42501';
  end if;

  if v_clean = '' then
    raise exception 'Vui lòng nhập Email tài khoản hoặc Mã định danh học sinh.' using errcode = '22023';
  end if;

  select *
  into v_student
  from public.profiles p
  where p.role::text = 'student'
    and (
      pg_catalog.lower(p.email) = pg_catalog.lower(v_clean)
      or (
        p.student_code is not null
        and pg_catalog.lower(p.student_code) = pg_catalog.lower(v_clean)
      )
    )
  limit 1;

  if v_student.id is null then
    raise exception 'Không tìm thấy tài khoản học sinh khớp với Email hoặc Mã học sinh "%". Học sinh cần đăng ký tài khoản vai trò Học sinh trước, hoặc tự tham gia bằng mã lớp.', v_clean;
  end if;

  insert into public.class_members (class_id, student_id)
  values (p_class_id, v_student.id)
  on conflict (class_id, student_id) do nothing;

  return pg_catalog.jsonb_build_object(
    'id', v_student.id,
    'code', coalesce(v_student.student_code, ''),
    'fullName', v_student.full_name,
    'email', v_student.email
  );
end;
$$;

create or replace function public.join_class_by_invite_code(
  p_invite_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_invite_code, '')));
  v_class public.classes%rowtype;
begin
  if v_uid is null then
    raise exception 'Bạn cần đăng nhập tài khoản học sinh để tham gia lớp.' using errcode = '42501';
  end if;

  if public.current_user_role() <> 'student' then
    raise exception 'Chỉ tài khoản vai trò Học sinh mới có thể tự tham gia lớp bằng mã mời.' using errcode = '42501';
  end if;

  if v_code = '' then
    raise exception 'Vui lòng nhập mã tham gia lớp.' using errcode = '22023';
  end if;

  select *
  into v_class
  from public.classes c
  where pg_catalog.upper(pg_catalog.btrim(c.invite_code)) = v_code
  limit 1;

  if v_class.id is null then
    raise exception 'Mã tham gia lớp "%" không tồn tại hoặc không chính xác.', v_code;
  end if;

  insert into public.class_members (class_id, student_id)
  values (v_class.id, v_uid)
  on conflict (class_id, student_id) do nothing;

  return pg_catalog.jsonb_build_object(
    'classId', v_class.id,
    'className', v_class.name,
    'grade', v_class.grade
  );
end;
$$;

-- RPC duy nhất cho menu "Bài được giao" của học sinh (Bước 2):
-- Chỉ trả thông tin TÓM TẮT lớp đã tham gia, lượt giao của lớp đó, metadata tóm tắt đề
-- (TUYỆT ĐỐI KHÔNG trả public_questions, question_ids, đáp án, lời giải, rubric hay submissions.answers)
create or replace function public.get_student_assigned_summaries()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Bạn cần đăng nhập tài khoản học sinh để xem bài được giao.' using errcode = '42501';
  end if;

  if public.current_user_role() <> 'student' then
    raise exception 'Chỉ tài khoản vai trò Học sinh mới được phép truy xuất danh sách bài được giao qua hàm này.' using errcode = '42501';
  end if;

  return pg_catalog.jsonb_build_object(
    'studentId', v_uid,
    'classes', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'grade', c.grade,
          'school_year', c.school_year,
          'teacher_id', c.teacher_id,
          'teacher_name', c.teacher_name,
          'joined_at', cm.joined_at
        )
        order by c.name asc
      )
      from public.class_members cm
      join public.classes c on c.id = cm.class_id
      where cm.student_id = v_uid
    ), '[]'::jsonb),
    'assignments', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', a.id,
          'exam_id', a.exam_id,
          'class_id', a.class_id,
          'open_time', a.open_time,
          'close_time', a.close_time,
          'duration_minutes', a.duration_minutes,
          'attempts_allowed', a.attempts_allowed,
          'allow_review', a.allow_review,
          'show_solution_after_submit', a.show_solution_after_submit,
          'shuffle_questions', a.shuffle_questions,
          'shuffle_options', a.shuffle_options,
          'is_computer_lab_mode', a.is_computer_lab_mode,
          'status', coalesce(a.status, 'active'),
          'round_label', a.round_label,
          'created_at', a.created_at
        )
        order by a.close_time asc
      )
      from public.assignments a
      where exists (
        select 1
        from public.class_members cm
        where cm.class_id = a.class_id
          and cm.student_id = v_uid
      )
    ), '[]'::jsonb),
    'exams', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', e_summary.id,
          'code', e_summary.code,
          'title', e_summary.title,
          'grade', e_summary.grade,
          'subject', e_summary.subject,
          'period', coalesce(e_summary.period, 'mid1'),
          'duration_minutes', e_summary.duration_minutes,
          'total_points', e_summary.total_points,
          'question_count', coalesce(
            nullif(e_summary.question_count, 0),
            pg_catalog.cardinality(e_summary.question_ids),
            0
          ),
          'created_at', e_summary.created_at
        )
      )
      from (
        select distinct
          e.id,
          e.code,
          e.title,
          e.grade,
          e.subject,
          e.period,
          e.duration_minutes,
          e.total_points,
          e.question_count,
          e.question_ids,
          e.created_at
        from public.exams e
        join public.assignments a on a.exam_id = e.id
        join public.class_members cm on cm.class_id = a.class_id
        where cm.student_id = v_uid
      ) e_summary
    ), '[]'::jsonb),
    'submissions', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', s.id,
          'assignment_id', s.assignment_id,
          'student_id', s.student_id,
          'start_time', s.start_time,
          'submitted_at', s.submitted_at,
          'time_spent_seconds', s.time_spent_seconds,
          'score', s.score,
          'max_score', s.max_score,
          'status', s.status,
          'tab_switch_count', s.tab_switch_count
        )
        order by s.start_time desc
      )
      from public.submissions s
      join public.assignments a on a.id = s.assignment_id
      join public.class_members cm on cm.class_id = a.class_id
      where s.student_id = v_uid
        and cm.student_id = v_uid
    ), '[]'::jsonb)
  );
end;
$$;

-- 6. THU HỒI & CẤP LẠI QUYỀN BẢNG VÀ HÀM THEO NGUYÊN TẮC TỐI THIỂU

revoke all on table
  public.profiles,
  public.classes,
  public.class_members,
  public.questions,
  public.exams,
  public.exam_protected_keys,
  public.assignments,
  public.submissions
  from public, anon;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table
  public.classes,
  public.class_members,
  public.questions,
  public.exams,
  public.exam_protected_keys,
  public.assignments,
  public.submissions
  to authenticated;

-- Thu hồi EXECUTE từ PUBLIC và anon cho TẤT CẢ hàm SECURITY DEFINER & trigger
revoke all on function public.current_user_role() from public, anon;
revoke all on function public.is_admin_role() from public, anon;
revoke all on function public.is_staff_role() from public, anon;
revoke all on function public.is_class_teacher(uuid) from public, anon;
revoke all on function public.is_class_member(uuid) from public, anon;
revoke all on function public.teacher_enroll_student(uuid, text) from public, anon;
revoke all on function public.join_class_by_invite_code(text) from public, anon;
revoke all on function public.get_student_assigned_summaries() from public, anon;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.tg_protect_profile_role() from public, anon, authenticated;
revoke all on function public.tg_lock_assignment_immutable_fields() from public, anon, authenticated;

-- Chỉ cấp lại EXECUTE cho authenticated với các hàm ứng dụng & RLS cần dùng
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin_role() to authenticated;
grant execute on function public.is_staff_role() to authenticated;
grant execute on function public.is_class_teacher(uuid) to authenticated;
grant execute on function public.is_class_member(uuid) to authenticated;
grant execute on function public.teacher_enroll_student(uuid, text) to authenticated;
grant execute on function public.join_class_by_invite_code(text) to authenticated;
grant execute on function public.get_student_assigned_summaries() to authenticated;

-- Làm mới schema cache của PostgREST ngay sau khi áp dụng bảng & RPC mới
notify pgrst, 'reload schema';

commit;
