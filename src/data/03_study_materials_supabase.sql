-- =====================================================================
-- MIGRATION BƯỚC 3: THƯ VIỆN TÀI LIỆU HỌC TẬP & LƯU TRỮ TỆP THẬT
-- File: src/data/03_study_materials_supabase.sql
--
-- Mục tiêu:
--   1. Tạo bảng public.study_materials lưu thông tin tài liệu học tập
--      và liên kết tới Khối lớp, Môn học, Đợt kiểm tra hoặc Bài học
--      (catalog_kien_thuc_trong_tam.json).
--   2. Tạo bảng public.study_material_answer_keys tách riêng tệp đáp án
--      để học sinh KHÔNG thể truy cập đáp án chưa công bố.
--   3. Thiết lập RLS chặt chẽ:
--      - Học sinh / khách chỉ xem được tài liệu ở trạng thái 'published'
--        và chỉ xem được đáp án khi is_published = true.
--      - Giáo viên / Quản trị viên / Người kiểm duyệt mới được tạo, sửa,
--        xóa, lưu nháp hoặc công bố tài liệu.
--   4. Tạo Storage bucket riêng tư 'study-materials' kèm chính sách RLS
--      trên storage.objects để tệp nháp và tệp đáp án chưa công bố không
--      bị tải trực tiếp qua URL công khai.
--
-- Lưu ý triển khai:
--   - Chỉ chạy file này trong Supabase SQL Editor của dự án.
--   - KHÔNG xóa hoặc ghi đè bảng hiện có của hệ thống.
-- =====================================================================

begin;

create extension if not exists pgcrypto;

-- 1. ĐẢM BẢO HÀM KIỂM TRA VAI TRÒ TỒN TẠI (AN TOÀN NẾU CHẠY ĐỘC LẬP)
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

-- 2. BẢNG TÀI LIỆU HỌC TẬP (public.study_materials)
create table if not exists public.study_materials (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  topic text,
  grade text not null check (grade in ('6', '7', '8', '9')),
  subject text not null,
  material_type text not null check (
    material_type in ('de_cuong', 'phieu_bai_tap', 'de_tham_khao', 'so_tay', 'tep_thuc_hanh')
  ),
  exam_term text check (
    exam_term is null or exam_term in ('mid1', 'final1', 'mid2', 'final2')
  ),
  lesson_id text,
  chapter_key text,
  chapter_label text,
  lesson_label text,
  description text default '' not null,
  usage_instructions text,
  file_name text,
  file_format text,
  file_url text,
  storage_path text,
  file_size_bytes bigint,
  author_name text default 'Tổ Chuyên môn THCS Tây Đô' not null,
  author_id uuid references public.profiles(id) on delete set null,
  status text default 'draft' not null check (status in ('draft', 'published')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone
);

create index if not exists idx_study_materials_status_filter
  on public.study_materials (status, grade, subject, material_type);

create index if not exists idx_study_materials_exam_term
  on public.study_materials (exam_term)
  where exam_term is not null;

create index if not exists idx_study_materials_lesson_id
  on public.study_materials (lesson_id)
  where lesson_id is not null;

-- 3. BẢNG TÁCH RIÊNG TỆP ĐÁP ÁN / HƯỚNG DẪN CHẤM (BẢO VỆ ĐÁP ÁN CHƯA CÔNG BỐ)
create table if not exists public.study_material_answer_keys (
  material_id uuid references public.study_materials(id) on delete cascade primary key,
  answer_key_file_name text,
  answer_key_file_url text,
  answer_key_storage_path text,
  is_published boolean default false not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. BẬT ROW LEVEL SECURITY (RLS)
alter table public.study_materials enable row level security;
alter table public.study_material_answer_keys enable row level security;

drop policy if exists "study_materials_select_policy" on public.study_materials;
drop policy if exists "study_materials_insert_staff" on public.study_materials;
drop policy if exists "study_materials_update_staff" on public.study_materials;
drop policy if exists "study_materials_delete_staff" on public.study_materials;

create policy "study_materials_select_policy" on public.study_materials
  for select using (
    status = 'published'
    or public.is_staff_role()
  );

create policy "study_materials_insert_staff" on public.study_materials
  for insert with check (
    public.is_staff_role()
  );

create policy "study_materials_update_staff" on public.study_materials
  for update using (
    public.is_staff_role()
  ) with check (
    public.is_staff_role()
  );

create policy "study_materials_delete_staff" on public.study_materials
  for delete using (
    public.is_staff_role()
  );

drop policy if exists "study_material_answer_keys_select_policy" on public.study_material_answer_keys;
drop policy if exists "study_material_answer_keys_insert_staff" on public.study_material_answer_keys;
drop policy if exists "study_material_answer_keys_update_staff" on public.study_material_answer_keys;
drop policy if exists "study_material_answer_keys_delete_staff" on public.study_material_answer_keys;

create policy "study_material_answer_keys_select_policy" on public.study_material_answer_keys
  for select using (
    public.is_staff_role()
    or (
      is_published = true
      and exists (
        select 1
        from public.study_materials m
        where m.id = material_id
          and m.status = 'published'
      )
    )
  );

create policy "study_material_answer_keys_insert_staff" on public.study_material_answer_keys
  for insert with check (
    public.is_staff_role()
  );

create policy "study_material_answer_keys_update_staff" on public.study_material_answer_keys
  for update using (
    public.is_staff_role()
  ) with check (
    public.is_staff_role()
  );

create policy "study_material_answer_keys_delete_staff" on public.study_material_answer_keys
  for delete using (
    public.is_staff_role()
  );

-- 5. CẤP QUYỀN TỐI THIỂU TRÊN BẢNG & HÀM
revoke all on table public.study_materials, public.study_material_answer_keys from public, anon, authenticated;
grant select on table public.study_materials, public.study_material_answer_keys to anon, authenticated;
grant insert, update, delete on table public.study_materials, public.study_material_answer_keys to authenticated;

revoke all on function public.current_user_role() from public, anon;
revoke all on function public.is_staff_role() from public, anon;
grant execute on function public.current_user_role() to authenticated, anon;
grant execute on function public.is_staff_role() to authenticated, anon;

-- 6. STORAGE BUCKET RIÊNG TƯ CHO TÀI LIỆU HỌC TẬP ('study-materials')
insert into storage.buckets (id, name, public)
values ('study-materials', 'study-materials', false)
on conflict (id) do update set public = false;

do $$
begin
  drop policy if exists "study_materials_storage_read_published_or_staff" on storage.objects;
  drop policy if exists "study_materials_storage_insert_staff" on storage.objects;
  drop policy if exists "study_materials_storage_update_staff" on storage.objects;
  drop policy if exists "study_materials_storage_delete_staff" on storage.objects;

  create policy "study_materials_storage_read_published_or_staff" on storage.objects
    for select to anon, authenticated using (
      bucket_id = 'study-materials'
      and (
        public.is_staff_role()
        or exists (
          select 1
          from public.study_materials m
          where m.storage_path = name
            and m.status = 'published'
        )
        or exists (
          select 1
          from public.study_material_answer_keys k
          join public.study_materials m on m.id = k.material_id
          where k.answer_key_storage_path = name
            and k.is_published = true
            and m.status = 'published'
        )
      )
    );

  create policy "study_materials_storage_insert_staff" on storage.objects
    for insert to authenticated with check (
      bucket_id = 'study-materials'
      and public.is_staff_role()
    );

  create policy "study_materials_storage_update_staff" on storage.objects
    for update to authenticated using (
      bucket_id = 'study-materials'
      and public.is_staff_role()
    ) with check (
      bucket_id = 'study-materials'
      and public.is_staff_role()
    );

  create policy "study_materials_storage_delete_staff" on storage.objects
    for delete to authenticated using (
      bucket_id = 'study-materials'
      and public.is_staff_role()
    );
exception
  when insufficient_privilege then
    raise notice 'Lưu ý: Tài khoản SQL hiện tại không đủ quyền tạo policy trên storage.objects. Vui lòng chạy bằng quyền postgres/owner trong Supabase Dashboard SQL Editor hoặc thiết lập Policy cho bucket study-materials trong mục Storage -> Policies.';
end $$;

notify pgrst, 'reload schema';

commit;
