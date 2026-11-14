-- =====================================================================
-- MIGRATION BƯỚC 5 (GIAI ĐOẠN 4B - BẬT CHÍNH SÁCH QUYỀN MỚI & SIẾT BẢO MẬT):
-- PHÂN TÁCH QUẢN LÝ LỚP / DẠY MÔN, KHÓA CỘT CHẤM BÀI, BẢO VỆ MÔN ĐỀ THI
-- VÀ HARDENED RPC publish_exam_assignment / grade_submission
-- File: src/data/05_enable_subject_rls_and_hardening.sql
--
-- Điều kiện tiên quyết & Thứ tự chạy trên Supabase SQL Editor:
--   Bước 1: src/data/01_bootstrap_assignment_tables.sql (đã chạy)
--   Bước 2: src/data/02_sync_classes_exams_assignments.sql (đã chạy)
--   Bước 3: src/data/03_admin_accounts_rbac.sql (đã chạy)
--   Bước 4: src/data/04_teaching_assignments_and_codes.sql (chạy trước file này)
--   Bước 4.5 (Quản trị viên): Kiểm tra v_teaching_assignments_missing_subject
--           và v_cutover_impacted_classes để bổ sung đúng môn & vai trò lớp.
--   Bước 5: Chạy file này (05_enable_subject_rls_and_hardening.sql).
--
-- Cảnh báo chuyển đổi:
--   - Sau khi chạy Bước 5, hệ thống CHÍNH THỨC ngưng dùng classes.teacher_id
--     làm căn cứ phân quyền; is_class_teacher() chỉ còn kiểm tra class_roles.
--   - Giáo viên bộ môn chỉ giao/chấm được bài đúng (lớp, môn, năm học) khi
--     teaching_assignments.status = 'active' và needs_subject_completion = false.
--   - Khi kết thúc phân công ('ended'), quyền giao bài & chấm môn đó hết hiệu
--     lực ngay lập tức (dù vẫn giữ nguyên dữ liệu lịch sử).
-- =====================================================================

begin;

-- 0. KIỂM TRA CẢNH BÁO DỮ LIỆU "THIẾU MÔN" TRƯỚC KHI BẬT RLS MỚI (KHÔNG XÓA DỮ LIỆU)
do $$
declare
  v_missing_count bigint := 0;
  v_impacted_count bigint := 0;
begin
  if to_regclass('public.teaching_assignments') is null
     or to_regclass('public.class_roles') is null then
    raise exception 'Chưa chạy Bước 4 (04_teaching_assignments_and_codes.sql). Vui lòng chạy Bước 4 trước khi bật Bước 5.';
  end if;

  select pg_catalog.count(*) into v_missing_count from public.v_teaching_assignments_missing_subject;
  select pg_catalog.count(*) into v_impacted_count from public.v_cutover_impacted_classes;

  if v_missing_count > 0 or v_impacted_count > 0 then
    raise notice 'CẢNH BÁO CHUYỂN ĐỔI BƯỚC 5: Còn % phân công "Thiếu môn" và % lớp bị ảnh hưởng. Các giáo viên thiếu môn/thiếu class_roles sẽ bị chặn giao bài, chấm bài hoặc quản lý thành viên cho đến khi Quản trị viên bổ sung.',
      v_missing_count, v_impacted_count;
  else
    raise notice 'KIỂM TRA BƯỚC 5: 100%% phân công và lớp học đã sẵn sàng cho phân quyền theo môn.';
  end if;
end $$;

-- 1. HÀM PHÂN QUYỀN RÕ RÀNG: PHỤ TRÁCH LỚP (class_roles) VS DẠY MÔN (teaching_assignments)

-- 1.1. Kiểm tra giáo viên có vai trò phụ trách lớp rõ ràng trong public.class_roles
--      (tách biệt hoàn toàn khỏi classes.teacher_id và teaching_assignments).
create or replace function public.is_class_manager(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.class_roles cr
    join public.classes c on c.id = cr.class_id
    where cr.class_id = p_class_id
      and cr.teacher_id = auth.uid()
      and cr.status = 'active'
      and cr.role_type in ('homeroom', 'class_manager')
      and pg_catalog.btrim(cr.school_year) = pg_catalog.btrim(c.school_year)
  );
$$;

-- 1.2. Kiểm tra giáo viên có ÍT NHẤT MỘT phân công giảng dạy đang hoạt động tại lớp
--      (chỉ dùng cho quyền SELECT xem tên lớp và danh sách học sinh để phục vụ giảng dạy/chấm bài,
--      KHÔNG cấp quyền thêm/xóa thành viên lớp).
create or replace function public.has_active_teaching_in_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.teaching_assignments ta
    join public.classes c on c.id = ta.class_id
    where ta.class_id = p_class_id
      and ta.teacher_id = auth.uid()
      and ta.status = 'active'
      and ta.needs_subject_completion = false
      and ta.subject is not null
      and pg_catalog.btrim(ta.subject) <> ''
      and pg_catalog.btrim(ta.school_year) = pg_catalog.btrim(c.school_year)
  );
$$;

-- 1.3. Chuẩn hóa is_class_teacher(uuid):
--      Không dùng classes.teacher_id, không tự suy từ phân công dạy môn;
--      chỉ trả true khi caller là Quản trị hoặc có class_roles phụ trách lớp rõ ràng.
create or replace function public.is_class_teacher(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_admin_role()
    or (
      public.current_user_role() = 'teacher'
      and public.is_class_manager(p_class_id)
    );
$$;

-- 1.4. Kiểm tra giáo viên có phân công ĐANG HOẠT ĐỘNG đúng (lớp, môn chuẩn hóa, năm học) hay không.
--      Khi phân công chuyển sang status = 'ended', hàm lập tức trả về false.
create or replace function public.is_teacher_assigned_subject(
  p_class_id uuid,
  p_subject text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_norm_subject text := public.normalize_subject_code(p_subject);
begin
  if v_norm_subject is null or v_norm_subject = '' then
    return false;
  end if;

  return exists (
    select 1
    from public.teaching_assignments ta
    join public.classes c on c.id = ta.class_id
    where ta.class_id = p_class_id
      and ta.teacher_id = auth.uid()
      and ta.status = 'active'
      and ta.needs_subject_completion = false
      and ta.subject is not null
      and public.normalize_subject_code(ta.subject) = v_norm_subject
      and pg_catalog.btrim(ta.school_year) = pg_catalog.btrim(c.school_year)
  );
end;
$$;

-- 1.5. Kiểm tra quyền giáo viên đối với một assignment cụ thể
--      Ưu tiên snapshot assignments.subject_code (đã khóa bất biến khi tạo assignment),
--      fallback sang normalize_subject_code(exams.subject) nếu bản ghi cũ chưa có subject_code.
create or replace function public.can_teacher_access_assignment(p_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.assignments a
    left join public.exams e on e.id = a.exam_id
    where a.id = p_assignment_id
      and public.is_teacher_assigned_subject(
        a.class_id,
        coalesce(
          nullif(public.normalize_subject_code(a.subject_code), ''),
          public.normalize_subject_code(e.subject)
        )
      )
  );
$$;

-- 1.6. Cập nhật RPC teacher_enroll_student:
--      Chỉ Quản trị viên hoặc Giáo viên được cấp vai trò phụ trách lớp (class_roles) mới được thêm học sinh vào lớp.
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
    raise exception 'Chỉ Quản trị viên hoặc Giáo viên phụ trách lớp mới được phép thêm học sinh vào lớp.' using errcode = '42501';
  end if;

  if not (
    public.is_admin_role()
    or (public.current_user_role() = 'teacher' and public.is_class_manager(p_class_id))
  ) then
    raise exception 'Bạn chưa được cấp vai trò phụ trách quản lý lớp này (class_roles). Liên hệ Quản trị viên để thêm học sinh.'
      using errcode = '42501';
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
    raise exception 'Không tìm thấy tài khoản học sinh khớp với Email hoặc Mã học sinh "%".', v_clean;
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

-- 2. BẢO VỆ TÍNH TOÀN VẸN ĐỀ THI, LƯỢT GIAO BÀI & CỬA SỔ THỜI GIAN

-- 2.1. Khóa subject và author_id của public.exams ngay khi đã có lượt giao bài tham chiếu
create or replace function public.tg_protect_assigned_exam_subject()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_norm_subject text;
begin
  if new.subject is not null then
    v_norm_subject := public.normalize_subject_code(new.subject);
    if v_norm_subject not in (
      'math', 'informatics', 'science', 'literature',
      'english', 'history_geo', 'technology', 'civics', 'other'
    ) then
      raise exception 'Mã môn học của đề thi "%" không hợp lệ.', new.subject using errcode = '22023';
    end if;
    new.subject := v_norm_subject;
  end if;

  if TG_OP = 'UPDATE' then
    if (new.subject is distinct from old.subject or new.author_id is distinct from old.author_id)
       and exists (select 1 from public.assignments a where a.exam_id = old.id) then
      raise exception 'Không thể thay đổi môn học hoặc tác giả đề thi sau khi đã phát hành lượt giao bài (tránh sai lệch quyền chấm bài cũ).'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_assigned_exam_subject on public.exams;
create trigger trg_protect_assigned_exam_subject
  before insert or update on public.exams
  for each row execute procedure public.tg_protect_assigned_exam_subject();

-- 2.2. Backfill & khóa snapshot assignments.subject_code + kiểm tra cửa sổ thời gian khi INSERT/UPDATE
update public.assignments a
set subject_code = public.normalize_subject_code(e.subject)
from public.exams e
where e.id = a.exam_id
  and (
    a.subject_code is null
    or pg_catalog.btrim(a.subject_code) = ''
    or public.normalize_subject_code(a.subject_code) is distinct from a.subject_code
  );

create or replace function public.tg_enforce_assignment_teaching_scope()
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
  v_exam_subject text;
  v_exam_author uuid;
begin
  select public.normalize_subject_code(e.subject), e.author_id
  into v_exam_subject, v_exam_author
  from public.exams e
  where e.id = new.exam_id;

  if v_exam_subject is null then
    raise exception 'Không tìm thấy đề thi hợp lệ hoặc đề thi thiếu mã môn (exam_id = %).', new.exam_id
      using errcode = '22023';
  end if;

  new.subject_code := v_exam_subject;

  if new.close_time <= new.open_time then
    raise exception 'Thời điểm đóng bài (close_time) phải lớn hơn thời điểm mở bài (open_time).'
      using errcode = '22023';
  end if;

  if coalesce(new.duration_minutes, 0) < 1 then
    raise exception 'Thời lượng làm bài (duration_minutes) phải từ 1 phút trở lên.'
      using errcode = '22023';
  end if;

  if coalesce(new.attempts_allowed, 0) < 1 then
    raise exception 'Số lượt làm bài cho phép (attempts_allowed) phải từ 1 trở lên.'
      using errcode = '22023';
  end if;

  if not v_is_trusted_admin then
    if v_uid is null or public.current_user_role() <> 'teacher' then
      raise exception 'Chỉ Quản trị viên hoặc Giáo viên được phân công môn mới được giao bài.'
        using errcode = '42501';
    end if;

    if new.assigned_by is distinct from v_uid then
      raise exception 'assigned_by phải trùng với tài khoản đang đăng nhập.'
        using errcode = '42501';
    end if;

    if v_exam_author is distinct from v_uid then
      raise exception 'Bạn không có quyền giao đề kiểm tra của giáo viên khác.'
        using errcode = '42501';
    end if;

    if not public.is_teacher_assigned_subject(new.class_id, new.subject_code) then
      raise exception 'Bạn không có phân công giảng dạy đang hoạt động cho môn "%" tại lớp này.', new.subject_code
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_assignment_teaching_scope on public.assignments;
create trigger trg_enforce_assignment_teaching_scope
  before insert on public.assignments
  for each row execute procedure public.tg_enforce_assignment_teaching_scope();

-- Mở rộng trigger khóa trường bất biến khi UPDATE assignments (khóa thêm subject_code và kiểm tra thời gian)
create or replace function public.tg_lock_assignment_immutable_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.class_id is distinct from old.class_id
     or new.exam_id is distinct from old.exam_id
     or new.subject_code is distinct from old.subject_code
     or (
       new.assigned_by is distinct from old.assigned_by
       and not (old.assigned_by is null and public.is_admin_role())
     ) then
    raise exception 'Không được phép thay đổi lớp học, đề thi, mã môn snapshot hoặc người giao sau khi đã phát hành lượt giao bài.'
      using errcode = '42501';
  end if;

  if new.close_time <= new.open_time then
    raise exception 'Thời điểm đóng bài (close_time) phải lớn hơn thời điểm mở bài (open_time).'
      using errcode = '22023';
  end if;

  if coalesce(new.duration_minutes, 0) < 1 or coalesce(new.attempts_allowed, 0) < 1 then
    raise exception 'Thời lượng và số lượt làm bài phải lớn hơn hoặc bằng 1.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_lock_assignment_immutable_fields on public.assignments;
create trigger trg_lock_assignment_immutable_fields
  before update on public.assignments
  for each row execute procedure public.tg_lock_assignment_immutable_fields();

-- Thêm check constraint cửa sổ thời gian an toàn nếu dữ liệu cũ thỏa mãn
do $$
declare
  v_bad_rows bigint := 0;
begin
  select pg_catalog.count(*)
  into v_bad_rows
  from public.assignments
  where close_time <= open_time
     or duration_minutes < 1
     or attempts_allowed < 1;

  if v_bad_rows = 0 then
    alter table public.assignments
      add constraint assignments_time_window_check
      check (close_time > open_time and duration_minutes >= 1 and attempts_allowed >= 1);
  else
    raise notice 'Bỏ qua thêm assignments_time_window_check vì phát hiện % dòng dữ liệu cũ có thời gian/thời lượng chưa chuẩn (trigger vẫn chặn mọi bản ghi mới không hợp lệ).', v_bad_rows;
  end if;
exception
  when duplicate_object then null;
end $$;

-- 3. GIỚI HẠN THAO TÁC CHẤM BÀI TRÊN public.submissions Ở TẦNG CSDL
--    Giáo viên CHỈ được sửa: score, status, teacher_feedback, grading_details, graded_by, graded_at.
--    Cấm tuyệt đối sửa answers (bài làm học sinh), student_id, assignment_id, start_time, submitted_at, ...

create or replace function public.tg_protect_submission_grading()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_service boolean := (v_uid is null and CURRENT_USER in ('postgres', 'supabase_admin', 'service_role'));
begin
  if not v_is_service then
    if new.id is distinct from old.id
       or new.assignment_id is distinct from old.assignment_id
       or new.student_id is distinct from old.student_id
       or new.start_time is distinct from old.start_time
       or new.submitted_at is distinct from old.submitted_at
       or new.time_spent_seconds is distinct from old.time_spent_seconds
       or new.answers is distinct from old.answers
       or new.max_score is distinct from old.max_score
       or new.tab_switch_count is distinct from old.tab_switch_count then
      raise exception 'Thao tác chấm bài không được phép thay đổi bài làm (answers), học sinh, lượt giao bài hoặc thời điểm nộp bài.'
        using errcode = '42501';
    end if;
  end if;

  if new.score is not null then
    if new.score < 0 or new.score > coalesce(old.max_score, new.max_score, 10) then
      raise exception 'Điểm số (%) phải nằm trong khoảng từ 0 đến %.', new.score, coalesce(old.max_score, new.max_score, 10)
        using errcode = '22023';
    end if;
  end if;

  if new.status is not null and new.status not in ('in_progress', 'submitted', 'graded') then
    raise exception 'Trạng thái bài nộp (%) không hợp lệ.', new.status using errcode = '22023';
  end if;

  if v_uid is not null then
    new.graded_by := v_uid;
  end if;
  new.graded_at := timezone('utc'::text, now());

  return new;
end;
$$;

drop trigger if exists trg_protect_submission_grading on public.submissions;
create trigger trg_protect_submission_grading
  before update on public.submissions
  for each row execute procedure public.tg_protect_submission_grading();

-- Cấp quyền UPDATE cấp cột: chỉ cho phép sửa các trường chấm điểm và nhận xét
revoke update on table public.submissions from public, anon, authenticated;
grant update (score, status, teacher_feedback, grading_details, graded_by, graded_at)
  on table public.submissions to authenticated;

-- 4. KÍCH HOẠT RLS MỚI TÁCH BIỆT PHỤ TRÁCH LỚP (class_roles) VÀ DẠY MÔN (teaching_assignments)

-- 4.1. public.classes: Giáo viên có class_roles HOẶC có phân công dạy môn đang hoạt động được SELECT; chỉ Admin sửa/tạo/xóa lớp.
drop policy if exists "Xem lớp học phù hợp" on public.classes;
drop policy if exists "Giáo viên và Quản trị tạo lớp" on public.classes;
drop policy if exists "Giáo viên và Quản trị cập nhật lớp" on public.classes;
drop policy if exists "Giáo viên và Quản trị xóa lớp" on public.classes;

create policy "Xem lớp học phù hợp" on public.classes
  for select to authenticated using (
    public.is_admin_role()
    or public.is_class_member(id)
    or (
      public.current_user_role() = 'teacher'
      and (
        public.is_class_manager(id)
        or public.has_active_teaching_in_class(id)
      )
    )
  );

create policy "Chỉ Quản trị tạo lớp" on public.classes
  for insert to authenticated with check (public.is_admin_role());

create policy "Chỉ Quản trị cập nhật lớp" on public.classes
  for update to authenticated using (public.is_admin_role())
  with check (public.is_admin_role());

create policy "Chỉ Quản trị xóa lớp" on public.classes
  for delete to authenticated using (public.is_admin_role());

-- 4.2. public.class_members: Giáo viên dạy môn hoặc phụ trách lớp được SELECT danh sách HS;
--      CHỈ Quản trị viên hoặc Giáo viên có vai trò class_roles ('homeroom'/'class_manager') được thêm/gỡ HS.
drop policy if exists "Xem thành viên lớp phù hợp" on public.class_members;
drop policy if exists "Giáo viên thêm học sinh vào lớp của mình" on public.class_members;
drop policy if exists "Quản lý xóa thành viên lớp" on public.class_members;
drop policy if exists "Quản lý thêm học sinh vào lớp" on public.class_members;

create policy "Xem thành viên lớp phù hợp" on public.class_members
  for select to authenticated using (
    student_id = auth.uid()
    or public.is_admin_role()
    or (
      public.current_user_role() = 'teacher'
      and (
        public.is_class_manager(class_id)
        or public.has_active_teaching_in_class(class_id)
      )
    )
  );

create policy "Quản lý thêm học sinh vào lớp" on public.class_members
  for insert to authenticated with check (
    public.is_admin_role()
    or (
      public.current_user_role() = 'teacher'
      and public.is_class_manager(class_id)
    )
  );

create policy "Quản lý xóa thành viên lớp" on public.class_members
  for delete to authenticated using (
    public.is_admin_role()
    or (
      public.current_user_role() = 'teacher'
      and public.is_class_manager(class_id)
    )
  );

-- 4.3. public.assignments: CHỈ theo đúng phân công môn đang hoạt động (KHÔNG còn fallback assigned_by / classes.teacher_id)
drop policy if exists "Học sinh xem bài của lớp mình" on public.assignments;
drop policy if exists "Giáo viên giao bài cho lớp và đề thuộc quyền" on public.assignments;
drop policy if exists "Giáo viên cập nhật lượt giao của mình" on public.assignments;
drop policy if exists "Giáo viên xóa lượt giao của mình" on public.assignments;

create policy "Học sinh xem bài của lớp mình" on public.assignments
  for select to authenticated using (
    public.is_class_member(class_id)
    or public.is_admin_role()
    or (
      public.current_user_role() = 'teacher'
      and public.can_teacher_access_assignment(id)
    )
  );

create policy "Giáo viên giao bài cho lớp và đề thuộc quyền" on public.assignments
  for insert to authenticated with check (
    assigned_by = auth.uid()
    and (
      public.is_admin_role()
      or (
        public.current_user_role() = 'teacher'
        and exists (
          select 1
          from public.exams e
          where e.id = exam_id
            and e.author_id = auth.uid()
            and public.is_teacher_assigned_subject(
              class_id,
              coalesce(
                nullif(public.normalize_subject_code(subject_code), ''),
                public.normalize_subject_code(e.subject)
              )
            )
        )
      )
    )
  );

create policy "Giáo viên cập nhật lượt giao của mình" on public.assignments
  for update to authenticated using (
    public.is_admin_role()
    or (
      public.current_user_role() = 'teacher'
      and public.can_teacher_access_assignment(id)
    )
  ) with check (
    public.is_admin_role()
    or (
      public.current_user_role() = 'teacher'
      and public.can_teacher_access_assignment(id)
    )
  );

create policy "Giáo viên xóa lượt giao của mình" on public.assignments
  for delete to authenticated using (
    public.is_admin_role()
    or (
      public.current_user_role() = 'teacher'
      and public.can_teacher_access_assignment(id)
    )
  );

-- 4.4. public.submissions: giáo viên chỉ xem và chấm bài thuộc phân công môn ĐANG HOẠT ĐỘNG
drop policy if exists "Xem bài nộp theo quyền" on public.submissions;
drop policy if exists "Giáo viên và Quản trị chấm bài nộp" on public.submissions;

create policy "Xem bài nộp theo quyền" on public.submissions
  for select to authenticated using (
    student_id = auth.uid()
    or public.is_admin_role()
    or (
      public.current_user_role() = 'teacher'
      and public.can_teacher_access_assignment(assignment_id)
    )
  );

create policy "Giáo viên và Quản trị chấm bài nộp" on public.submissions
  for update to authenticated using (
    public.is_admin_role()
    or (
      public.current_user_role() = 'teacher'
      and public.can_teacher_access_assignment(assignment_id)
    )
  ) with check (
    public.is_admin_role()
    or (
      public.current_user_role() = 'teacher'
      and public.can_teacher_access_assignment(assignment_id)
    )
  );

-- 5. RPC HARDENED GIAO BÀI KIỂM TRA (public.publish_exam_assignment)
--    - Kiểm tra idempotency theo toàn bộ khóa (client_request_id, assigned_by, exam_id, class_id):
--      nếu trùng key mà khác người giao/đề/lớp thì báo lỗi 23505 (409 conflict), KHÔNG trả bản ghi cũ sai phạm vi.
--    - Khóa pg_advisory_xact_lock + ON CONFLICT DO NOTHING chống double-submit đồng thời.
--    - Ràng buộc close_time > open_time, close_time > now() với bài active/scheduled, duration >= 1, attempts >= 1.

create or replace function public.publish_exam_assignment(
  p_exam_id uuid,
  p_class_id uuid,
  p_open_time timestamp with time zone,
  p_close_time timestamp with time zone,
  p_duration_minutes integer,
  p_attempts_allowed integer,
  p_allow_review boolean default true,
  p_show_solution_after_submit boolean default false,
  p_shuffle_questions boolean default true,
  p_shuffle_options boolean default true,
  p_is_computer_lab_mode boolean default false,
  p_status text default 'active',
  p_round_label text default 'Đợt 1',
  p_client_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_exam public.exams%rowtype;
  v_subject_code text;
  v_status text := coalesce(nullif(pg_catalog.btrim(p_status), ''), 'active');
  v_round_label text := coalesce(nullif(pg_catalog.btrim(p_round_label), ''), 'Đợt 1');
  v_existing public.assignments%rowtype;
  v_inserted public.assignments%rowtype;
  v_lock_key text;
begin
  if v_uid is null then
    raise exception 'Bạn cần đăng nhập để giao bài kiểm tra.' using errcode = '42501';
  end if;

  v_role := public.current_user_role();
  if v_role not in ('teacher', 'admin') then
    raise exception 'Chỉ Giáo viên hoặc Quản trị viên mới được phép giao bài.' using errcode = '42501';
  end if;

  if v_status not in ('active', 'scheduled', 'closed') then
    raise exception 'Trạng thái giao bài "%" không hợp lệ.', v_status using errcode = '22023';
  end if;

  if p_open_time is null or p_close_time is null or p_close_time <= p_open_time then
    raise exception 'Thời điểm đóng bài (close_time) phải lớn hơn thời điểm mở bài (open_time).' using errcode = '22023';
  end if;

  if v_status in ('active', 'scheduled') and p_close_time <= timezone('utc'::text, now()) then
    raise exception 'Thời điểm đóng bài phải lớn hơn thời điểm hiện tại đối với lượt giao đang mở hoặc hẹn giờ.' using errcode = '22023';
  end if;

  if coalesce(p_duration_minutes, 0) < 1 then
    raise exception 'Thời lượng làm bài phải từ 1 phút trở lên.' using errcode = '22023';
  end if;

  if coalesce(p_attempts_allowed, 0) < 1 then
    raise exception 'Số lượt làm bài cho phép phải từ 1 trở lên.' using errcode = '22023';
  end if;

  select *
  into v_exam
  from public.exams e
  where e.id = p_exam_id;

  if v_exam.id is null then
    raise exception 'Không tìm thấy đề kiểm tra cần giao.' using errcode = 'P0002';
  end if;

  v_subject_code := public.normalize_subject_code(v_exam.subject);
  if v_subject_code is null then
    raise exception 'Đề kiểm tra chưa xác định mã môn chuẩn.' using errcode = '22023';
  end if;

  if v_role <> 'admin' then
    if v_exam.author_id is distinct from v_uid then
      raise exception 'Bạn không có quyền giao đề kiểm tra của giáo viên khác.' using errcode = '42501';
    end if;

    if not public.is_teacher_assigned_subject(p_class_id, v_subject_code) then
      raise exception 'Bạn không có phân công giảng dạy đang hoạt động cho môn "%" tại lớp này.', v_subject_code
        using errcode = '42501';
    end if;
  end if;

  -- Chống trùng/chống ghi đè khi 2 request chạy đồng thời
  v_lock_key := coalesce(
    p_client_request_id::text,
    v_uid::text || ':' || p_exam_id::text || ':' || p_class_id::text
  );
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_lock_key));

  if p_client_request_id is not null then
    select *
    into v_existing
    from public.assignments a
    where a.client_request_id = p_client_request_id;

    if v_existing.id is not null then
      if v_existing.assigned_by is distinct from v_uid
         or v_existing.exam_id is distinct from p_exam_id
         or v_existing.class_id is distinct from p_class_id then
        raise exception 'Mã giao dịch (client_request_id) đã được sử dụng cho một lượt giao bài hoặc người giao khác.'
          using errcode = '23505';
      end if;
      return pg_catalog.to_jsonb(v_existing);
    end if;
  end if;

  insert into public.assignments (
    exam_id,
    class_id,
    subject_code,
    open_time,
    close_time,
    duration_minutes,
    attempts_allowed,
    allow_review,
    show_solution_after_submit,
    shuffle_questions,
    shuffle_options,
    is_computer_lab_mode,
    status,
    round_label,
    assigned_by,
    client_request_id
  )
  values (
    p_exam_id,
    p_class_id,
    v_subject_code,
    p_open_time,
    p_close_time,
    p_duration_minutes,
    p_attempts_allowed,
    coalesce(p_allow_review, true),
    coalesce(p_show_solution_after_submit, false),
    coalesce(p_shuffle_questions, true),
    coalesce(p_shuffle_options, true),
    coalesce(p_is_computer_lab_mode, false),
    v_status,
    v_round_label,
    v_uid,
    p_client_request_id
  )
  on conflict (client_request_id) where client_request_id is not null do nothing
  returning * into v_inserted;

  if v_inserted.id is null and p_client_request_id is not null then
    select *
    into v_existing
    from public.assignments a
    where a.client_request_id = p_client_request_id;

    if v_existing.id is null then
      raise exception 'Không thể tạo hoặc truy xuất lượt giao bài.' using errcode = 'P0001';
    end if;

    if v_existing.assigned_by is distinct from v_uid
       or v_existing.exam_id is distinct from p_exam_id
       or v_existing.class_id is distinct from p_class_id then
      raise exception 'Mã giao dịch (client_request_id) đã tồn tại cho một lượt giao bài khác.'
        using errcode = '23505';
    end if;

    return pg_catalog.to_jsonb(v_existing);
  end if;

  return pg_catalog.to_jsonb(v_inserted);
end;
$$;

-- 6. RPC CHẤM BÀI AN TOÀN (public.grade_submission) & CẬP NHẬT SUMMARY HỌC SINH

create or replace function public.grade_submission(
  p_submission_id uuid,
  p_question_id text default null,
  p_points_awarded numeric default null,
  p_teacher_feedback text default null,
  p_score numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_sub public.submissions%rowtype;
  v_details jsonb;
  v_now timestamp with time zone := timezone('utc'::text, now());
  v_next_score numeric;
  v_updated public.submissions%rowtype;
begin
  if v_uid is null then
    raise exception 'Bạn cần đăng nhập để chấm bài.' using errcode = '42501';
  end if;

  v_role := public.current_user_role();
  if v_role not in ('teacher', 'admin') then
    raise exception 'Chỉ Giáo viên hoặc Quản trị viên mới được phép chấm bài.' using errcode = '42501';
  end if;

  select *
  into v_sub
  from public.submissions s
  where s.id = p_submission_id;

  if v_sub.id is null then
    raise exception 'Không tìm thấy bài nộp.' using errcode = 'P0002';
  end if;

  if v_role <> 'admin' and not public.can_teacher_access_assignment(v_sub.assignment_id) then
    raise exception 'Từ chối chấm bài: Bạn không có phân công giảng dạy đang hoạt động đúng lớp và môn của bài kiểm tra này.'
      using errcode = '42501';
  end if;

  v_details := coalesce(v_sub.grading_details, '{}'::jsonb);

  if p_question_id is not null and pg_catalog.btrim(p_question_id) <> '' then
    v_details := pg_catalog.jsonb_set(
      v_details,
      array[pg_catalog.btrim(p_question_id)],
      pg_catalog.jsonb_build_object(
        'pointsAwarded', coalesce(p_points_awarded, 0),
        'teacherFeedback', coalesce(p_teacher_feedback, ''),
        'gradedBy', v_uid,
        'gradedAt', v_now
      ),
      true
    );
  end if;

  if p_score is not null then
    v_next_score := pg_catalog.least(coalesce(v_sub.max_score, 10), pg_catalog.greatest(0, p_score));
  elsif p_question_id is not null and pg_catalog.btrim(p_question_id) <> '' then
    select coalesce(sum(
      coalesce(
        (v_details->kv.key->>'pointsAwarded')::numeric,
        (kv.value->>'pointsAwarded')::numeric,
        0
      )
    ), coalesce(v_sub.score, 0))
    into v_next_score
    from pg_catalog.jsonb_each(coalesce(v_sub.answers, '{}'::jsonb)) as kv;

    v_next_score := pg_catalog.least(coalesce(v_sub.max_score, 10), pg_catalog.greatest(0, v_next_score));
  else
    v_next_score := coalesce(v_sub.score, 0);
  end if;

  -- Chỉ cập nhật đúng các trường điểm & nhận xét; tuyệt đối không đụng submissions.answers
  update public.submissions
  set score = v_next_score,
      status = 'graded',
      teacher_feedback = coalesce(p_teacher_feedback, teacher_feedback),
      grading_details = v_details,
      graded_by = v_uid,
      graded_at = v_now
  where id = p_submission_id
  returning * into v_updated;

  return pg_catalog.to_jsonb(v_updated);
end;
$$;

-- Cập nhật RPC get_student_assigned_summaries để trả kèm teacher_feedback & grading_details cho học sinh
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
          'subject_code', a.subject_code,
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
          'teacher_feedback', s.teacher_feedback,
          'grading_details', s.grading_details,
          'graded_at', s.graded_at,
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

-- 7. THU HỒI & CẤP QUYỀN HÀM MỚI THEO NGUYÊN TẮC TỐI THIỂU

revoke all on function public.is_class_manager(uuid) from public, anon;
revoke all on function public.has_active_teaching_in_class(uuid) from public, anon;
revoke all on function public.is_class_teacher(uuid) from public, anon;
revoke all on function public.is_teacher_assigned_subject(uuid, text) from public, anon;
revoke all on function public.can_teacher_access_assignment(uuid) from public, anon;
revoke all on function public.teacher_enroll_student(uuid, text) from public, anon;
revoke all on function public.grade_submission(uuid, text, numeric, text, numeric) from public, anon;
revoke all on function public.get_student_assigned_summaries() from public, anon;
revoke all on function public.publish_exam_assignment(
  uuid, uuid, timestamp with time zone, timestamp with time zone,
  integer, integer, boolean, boolean, boolean, boolean, boolean, text, text, uuid
) from public, anon;

revoke all on function public.tg_protect_assigned_exam_subject() from public, anon, authenticated;
revoke all on function public.tg_enforce_assignment_teaching_scope() from public, anon, authenticated;
revoke all on function public.tg_lock_assignment_immutable_fields() from public, anon, authenticated;
revoke all on function public.tg_protect_submission_grading() from public, anon, authenticated;

grant execute on function public.is_class_manager(uuid) to authenticated;
grant execute on function public.has_active_teaching_in_class(uuid) to authenticated;
grant execute on function public.is_class_teacher(uuid) to authenticated;
grant execute on function public.is_teacher_assigned_subject(uuid, text) to authenticated;
grant execute on function public.can_teacher_access_assignment(uuid) to authenticated;
grant execute on function public.teacher_enroll_student(uuid, text) to authenticated;
grant execute on function public.grade_submission(uuid, text, numeric, text, numeric) to authenticated;
grant execute on function public.get_student_assigned_summaries() to authenticated;
grant execute on function public.publish_exam_assignment(
  uuid, uuid, timestamp with time zone, timestamp with time zone,
  integer, integer, boolean, boolean, boolean, boolean, boolean, text, text, uuid
) to authenticated;

notify pgrst, 'reload schema';

commit;
