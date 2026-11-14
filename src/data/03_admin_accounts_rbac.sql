-- =====================================================================
-- MIGRATION BƯỚC 3: TÀI KHOẢN, PHÂN QUYỀN (RBAC) & NHẬT KÝ QUẢN TRỊ
-- File: src/data/03_admin_accounts_rbac.sql
--
-- Mục tiêu:
--   1. Bảo toàn 100% dữ liệu hiện có trong profiles, classes, class_members,
--      questions, exams, assignments, submissions (KHÔNG DROP, KHÔNG TRUNCATE).
--   2. Đảm bảo bảng public.audit_logs tồn tại kèm RLS chặt chẽ (chỉ Admin xem).
--   3. Siết chặt RLS của assignments, submissions, class_members để:
--      - Giáo viên CHỈ quản lý thành viên, giao bài và xem/chấm bài nộp
--        của các lớp đang được phân công phụ trách (classes.teacher_id = auth.uid()).
--      - Học sinh CHỈ xem bài giao của lớp mình và trạng thái nộp của chính mình.
--      - Chỉ Quản trị viên (admin) mới được sửa profiles.role và xem toàn hệ thống.
--   4. Cung cấp hướng dẫn & câu lệnh riêng để chủ dự án tự kiểm tra Auth UUID
--      và cấp quyền Quản trị viên đầu tiên (KHÔNG tự nâng quyền trong code ứng dụng).
--
-- Thứ tự chạy trên Supabase SQL Editor:
--   Bước 1: src/data/01_bootstrap_assignment_tables.sql (nếu chưa chạy)
--   Bước 2: src/data/02_sync_classes_exams_assignments.sql (nếu chưa chạy)
--   Bước 3: src/data/03_admin_accounts_rbac.sql (file này)
-- =====================================================================

begin;

create extension if not exists pgcrypto;

-- 1. CHỈ MỤC TRA CỨU EMAIL AN TOÀN TRÊN public.profiles
-- Hỗ trợ tìm nhanh theo email mà không làm lỗi nếu dữ liệu cũ có trùng lặp.
do $$
declare
  v_dup_email_count bigint;
begin
  select pg_catalog.count(*)
  into v_dup_email_count
  from (
    select pg_catalog.lower(pg_catalog.btrim(email)) as norm_email
    from public.profiles
    where email is not null
      and pg_catalog.btrim(email) <> ''
    group by pg_catalog.lower(pg_catalog.btrim(email))
    having pg_catalog.count(*) > 1
  ) dup;

  if v_dup_email_count = 0 then
    execute 'create unique index if not exists idx_profiles_email_unique_ci on public.profiles (pg_catalog.lower(pg_catalog.btrim(email))) where email is not null and pg_catalog.btrim(email) <> ''''';
  else
    execute 'create index if not exists idx_profiles_email_lookup_ci on public.profiles (pg_catalog.lower(pg_catalog.btrim(email))) where email is not null and pg_catalog.btrim(email) <> ''''';
  end if;
end $$;

create index if not exists idx_profiles_role on public.profiles(role);

-- 2. BẢNG NHẬT KÝ QUẢN TRỊ & KIỂM SOÁT TRUY CẬP (public.audit_logs)
create table if not exists public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  actor_name text not null,
  role text not null,
  action text not null,
  target text not null,
  details text
);

alter table public.audit_logs add column if not exists actor_id uuid references public.profiles(id) on delete set null;
alter table public.audit_logs add column if not exists target_id uuid;
alter table public.audit_logs add column if not exists metadata jsonb default '{}'::jsonb;

create index if not exists idx_audit_logs_timestamp on public.audit_logs("timestamp" desc);
create index if not exists idx_audit_logs_actor_id on public.audit_logs(actor_id);

alter table public.audit_logs enable row level security;

drop policy if exists "Chỉ Quản trị xem nhật ký thao tác" on public.audit_logs;
drop policy if exists "Cán bộ ghi nhật ký thao tác" on public.audit_logs;

create policy "Chỉ Quản trị xem nhật ký thao tác" on public.audit_logs
  for select to authenticated using (
    public.is_admin_role()
  );

create policy "Cán bộ ghi nhật ký thao tác" on public.audit_logs
  for insert to authenticated with check (
    public.is_staff_role()
    and (actor_id is null or actor_id = auth.uid() or public.is_admin_role())
  );

revoke all on table public.audit_logs from public, anon;
grant select, insert on table public.audit_logs to authenticated;

-- 3. RÀ SOÁT & SIẾT CHẶT RLS THEO LỚP ĐƯỢC PHÂN CÔNG
-- Đảm bảo giáo viên CHỈ xem/quản lý bài giao và bài nộp của lớp mình phụ trách hiện tại
-- (tránh trường hợp giáo viên từng giao bài nhưng đã được điều chuyển khỏi lớp vẫn còn quyền xem/sửa).

drop policy if exists "Học sinh xem bài của lớp mình" on public.assignments;
drop policy if exists "Giáo viên cập nhật lượt giao của mình" on public.assignments;
drop policy if exists "Giáo viên xóa lượt giao của mình" on public.assignments;

create policy "Học sinh xem bài của lớp mình" on public.assignments
  for select to authenticated using (
    public.is_class_member(class_id)
    or (public.current_user_role() = 'teacher' and public.is_class_teacher(class_id))
    or public.is_admin_role()
  );

create policy "Giáo viên cập nhật lượt giao của mình" on public.assignments
  for update to authenticated using (
    public.is_admin_role()
    or (
      public.current_user_role() = 'teacher'
      and public.is_class_teacher(class_id)
    )
  ) with check (
    public.is_admin_role()
    or (
      public.current_user_role() = 'teacher'
      and public.is_class_teacher(class_id)
    )
  );

create policy "Giáo viên xóa lượt giao của mình" on public.assignments
  for delete to authenticated using (
    public.is_admin_role()
    or (
      public.current_user_role() = 'teacher'
      and public.is_class_teacher(class_id)
    )
  );

drop policy if exists "Xem bài nộp theo quyền" on public.submissions;
drop policy if exists "Giáo viên và Quản trị chấm bài nộp" on public.submissions;

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
          and public.is_class_teacher(a.class_id)
      )
    )
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
          and public.is_class_teacher(a.class_id)
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
          and public.is_class_teacher(a.class_id)
      )
    )
  );

-- 4. ĐẢM BẢO CHẶN HỌC SINH/GIÁO VIÊN TỰ NÂNG VAI TRÒ QUA PROFILE RLS & TRIGGER
-- (Giữ nguyên và xác nhận các hàm đã có ở file 02 vẫn hiệu lực)
alter table public.profiles enable row level security;

commit;

-- =====================================================================
-- HƯỚNG DẪN CHỦ DỰ ÁN: KIỂM TRA & CẤP QUYỀN QUẢN TRỊ VIÊN ĐẦU TIÊN
-- (CHẠY RIÊNG TRONG SUPABASE SQL EDITOR, KHÔNG ĐƯA VÀO CODE ỨNG DỤNG)
--
-- Bước 1: Kiểm tra tài khoản quản trị hiện có & UUID trong Supabase Auth:
--   select
--     u.id as auth_user_uuid,
--     u.email,
--     u.email_confirmed_at,
--     p.role as profile_role,
--     p.full_name
--   from auth.users u
--   left join public.profiles p on p.id = u.id
--   order by u.created_at asc;
--
-- Bước 2: Nếu chưa có tài khoản nào có profile_role = 'admin', lấy đúng UUID
--         tài khoản Auth của quản trị viên từ Bước 1 (hoặc trong mục
--         Supabase Dashboard -> Authentication -> Users -> cột User UID)
--         và chạy LỆNH RIÊNG bên dưới (thay <AUTH_USER_UUID>):
--
--   insert into public.profiles (id, full_name, email, role, school_name)
--   select
--     u.id,
--     coalesce(nullif(pg_catalog.btrim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1)),
--     u.email,
--     'admin',
--     'Trường THCS Tây Đô'
--   from auth.users u
--   where u.id = '<AUTH_USER_UUID>'::uuid
--   on conflict (id) do update
--     set role = 'admin',
--         email = excluded.email;
--
-- Bước 3: Kiểm tra lại sau khi cấp quyền:
--   select id, full_name, email, role from public.profiles where role = 'admin';
-- =====================================================================
