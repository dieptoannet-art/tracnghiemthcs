-- ============================================================================
-- TÂY ĐÔ SMART EDU - BƯỚC 6: CỦNG CỐ RLS QUẢN TRỊ LỚP & TÀI KHOẢN (AN TOÀN)
-- File: src/data/06_admin_rls_and_class_crud_fix.sql
--
-- MỤC TIÊU:
-- 1. Không xóa bảng (DROP TABLE), không xóa dữ liệu hiện có.
-- 2. Không tắt RLS toàn cục; giữ nguyên bảo mật cho anonymous / student / teacher.
-- 3. Đảm bảo Quản trị viên (public.is_admin_role() = true, xác thực bằng UUID
--    trong public.profiles) có đầy đủ quyền SELECT / INSERT / UPDATE / DELETE
--    trên các bảng quản trị (profiles, classes, class_members, class_roles,
--    teaching_assignments, audit_logs) ngay cả khi truy vấn qua JWT xác thực.
-- ============================================================================

begin;

-- 1. Đảm bảo hàm kiểm tra quyền Admin theo auth.uid() hoạt động ổn định
create or replace function public.is_admin_role()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role::text = 'admin'
  );
$$;

-- 2. Cấp quyền bảng cần thiết cho vai trò authenticated (RLS vẫn kiểm soát từng dòng)
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.classes to authenticated;
grant select, insert, update, delete on public.class_members to authenticated;

do $$
begin
  if to_regclass('public.teaching_assignments') is not null then
    execute 'grant select, insert, update, delete on public.teaching_assignments to authenticated';
  end if;
  if to_regclass('public.class_roles') is not null then
    execute 'grant select, insert, update, delete on public.class_roles to authenticated';
  end if;
  if to_regclass('public.audit_logs') is not null then
    execute 'grant select, insert on public.audit_logs to authenticated';
  end if;
end $$;

-- 3. Chính sách RLS cho public.profiles:
-- Cho phép người dùng mới tự tạo hồ sơ student CỦA CHÍNH MÌNH hoặc Admin tạo/đồng bộ hồ sơ
drop policy if exists "profiles_insert_self_student" on public.profiles;
create policy "profiles_insert_self_student"
  on public.profiles for insert
  to authenticated
  with check (
    (auth.uid() = id and role::text = 'student')
    or public.is_admin_role()
  );

drop policy if exists "profiles_update_admin_only" on public.profiles;
create policy "profiles_update_admin_only"
  on public.profiles for update
  to authenticated
  using (public.is_admin_role())
  with check (public.is_admin_role());

-- 4. Chính sách RLS cho public.classes:
-- Đảm bảo Admin luôn có toàn quyền tạo, sửa, xóa lớp học
drop policy if exists "classes_admin_full_manage" on public.classes;
create policy "classes_admin_full_manage"
  on public.classes for all
  to authenticated
  using (public.is_admin_role())
  with check (public.is_admin_role());

-- 5. Chính sách RLS cho public.class_members:
-- Đảm bảo Admin luôn có toàn quyền thêm/sửa/gỡ học sinh trong lớp
drop policy if exists "class_members_admin_full_manage" on public.class_members;
create policy "class_members_admin_full_manage"
  on public.class_members for all
  to authenticated
  using (public.is_admin_role())
  with check (public.is_admin_role());

commit;
