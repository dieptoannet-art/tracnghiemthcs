-- =====================================================================
-- SCRIPT CẬP NHẬT CẤU TRÚC ĐƯỜNG DẪN HỌC LIỆU KIẾN THỨC TRỌNG TÂM
-- Dành cho cơ sở dữ liệu Supabase (PostgreSQL)
-- Ngày tạo: 2026-11-11T00:29:36.068Z
-- =====================================================================

-- 1. Tạo bảng kttt_catalog (nếu chưa có)
CREATE TABLE IF NOT EXISTS public.kttt_catalog (
  id TEXT PRIMARY KEY,
  grade INTEGER NOT NULL,
  subject_code TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  book_series TEXT NOT NULL,
  volume INTEGER NOT NULL DEFAULT 1,
  group_type TEXT NOT NULL,
  chapter_number INTEGER,
  chapter_title TEXT,
  chapter_label TEXT NOT NULL,
  lesson_number INTEGER,
  lesson_title TEXT NOT NULL,
  lesson_label TEXT NOT NULL,
  item_type TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  source_file TEXT,
  source_page INTEGER,
  html_file TEXT NOT NULL DEFAULT 'index.html',
  html_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_upload',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Bật Row Level Security (RLS) bảo vệ dữ liệu
ALTER TABLE public.kttt_catalog ENABLE ROW LEVEL SECURITY;

-- Cho phép mọi người (kể cả khách vãng lai và học sinh) xem danh mục
DROP POLICY IF EXISTS "Cho phep doc danh muc hoc lieu cong khai" ON public.kttt_catalog;
CREATE POLICY "Cho phep doc danh muc hoc lieu cong khai" ON public.kttt_catalog FOR SELECT USING (true);

-- Chỉ Quản trị viên (role = 'admin') mới có quyền cập nhật đường dẫn hoặc trạng thái
DROP POLICY IF EXISTS "Chi quan tri vien duoc cap nhat danh muc hoc lieu" ON public.kttt_catalog;
CREATE POLICY "Chi quan tri vien duoc cap nhat danh muc hoc lieu" ON public.kttt_catalog FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 3. Lệnh cập nhật html_url theo từng ID (an toàn, không ghi đè tiến độ học sinh)
BEGIN;

UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-01/bai-01/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c1_b1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-01/bai-02/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c1_b2';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-01/bai-03/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c1_b3';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-01/bai-04/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c1_b4';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-01/bai-05/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c1_b5';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-01/luyen-tap-01/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c1_lt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-01/bai-06/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c1_b6';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-01/bai-07/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c1_b7';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-01/luyen-tap-02/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c1_lt2';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-01/bai-tap-cuoi-chuong/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c1_bt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-02/bai-08/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c2_b8';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-02/bai-09/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c2_b9';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-02/bai-10/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c2_b10';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-02/luyen-tap-01/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c2_lt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-02/bai-11/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c2_b11';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-02/bai-12/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c2_b12';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-02/luyen-tap-02/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c2_lt2';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-02/bai-tap-cuoi-chuong/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c2_bt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-03/bai-13/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c3_b13';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-03/bai-14/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c3_b14';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-03/bai-15/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c3_b15';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-03/luyen-tap-01/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c3_lt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-03/bai-16/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c3_b16';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-03/bai-17/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c3_b17';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-03/luyen-tap-02/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c3_lt2';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-03/bai-tap-cuoi-chuong/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c3_bt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-04/bai-18/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c4_b18';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-04/bai-19/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c4_b19';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-04/bai-20/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c4_b20';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-04/luyen-tap-01/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c4_lt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-04/bai-tap-cuoi-chuong/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c4_bt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-05/bai-21/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c5_b21';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-05/bai-22/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c5_b22';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-05/luyen-tap-01/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c5_lt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-05/bai-tap-cuoi-chuong/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c5_bt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/trai-nghiem/tap-1/hoat-dong-01/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_hdtn_t1_hd1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/trai-nghiem/tap-1/hoat-dong-02/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_hdtn_t1_hd2';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/trai-nghiem/tap-1/hoat-dong-03/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_hdtn_t1_hd3';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-06/bai-23/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c6_b23';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-06/bai-24/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c6_b24';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-06/luyen-tap-01/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c6_lt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-06/bai-25/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c6_b25';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-06/bai-26/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c6_b26';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-06/bai-27/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c6_b27';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-06/luyen-tap-02/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c6_lt2';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-06/bai-tap-cuoi-chuong/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c6_bt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-07/bai-28/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c7_b28';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-07/bai-29/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c7_b29';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-07/bai-30/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c7_b30';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-07/bai-31/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c7_b31';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-07/luyen-tap-01/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c7_lt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-07/bai-tap-cuoi-chuong/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c7_bt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-08/bai-32/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c8_b32';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-08/bai-33/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c8_b33';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-08/bai-34/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c8_b34';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-08/bai-35/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c8_b35';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-08/luyen-tap-01/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c8_lt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-08/bai-36/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c8_b36';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-08/bai-37/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c8_b37';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-08/luyen-tap-02/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c8_lt2';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-08/bai-tap-cuoi-chuong/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c8_bt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-09/bai-38/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c9_b38';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-09/bai-39/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c9_b39';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-09/bai-40/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c9_b40';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-09/bai-41/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c9_b41';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-09/luyen-tap-01/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c9_lt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-09/bai-42/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c9_b42';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-09/bai-43/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c9_b43';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-09/luyen-tap-02/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c9_lt2';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/chuong-09/bai-tap-cuoi-chuong/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_c9_bt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/trai-nghiem/tap-2/hoat-dong-01/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_hdtn_t2_hd1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/trai-nghiem/tap-2/hoat-dong-02/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_hdtn_t2_hd2';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/trai-nghiem/tap-2/hoat-dong-03/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_hdtn_t2_hd3';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/toan/on-tap-cuoi-nam/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_6_hdtn_t2_on1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-01/bai-01/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c1_b1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-01/bai-02/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c1_b2';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-01/luyen-tap-01/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c1_lt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-01/bai-03/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c1_b3';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-01/bai-04/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c1_b4';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-01/luyen-tap-02/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c1_lt2';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-01/bai-tap-cuoi-chuong/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c1_bt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-02/bai-05/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c2_b5';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-02/bai-06/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c2_b6';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-02/bai-07/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c2_b7';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-02/luyen-tap-01/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c2_lt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-02/bai-tap-cuoi-chuong/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c2_bt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-03/bai-08/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c3_b8';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-03/bai-09/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c3_b9';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-03/luyen-tap-01/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c3_lt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-03/bai-10/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c3_b10';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-03/bai-11/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c3_b11';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-03/luyen-tap-02/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c3_lt2';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-03/bai-tap-cuoi-chuong/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c3_bt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-04/bai-12/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c4_b12';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-04/bai-13/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c4_b13';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-04/luyen-tap-01/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c4_lt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-04/bai-14/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c4_b14';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-04/luyen-tap-02/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c4_lt2';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-04/bai-15/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c4_b15';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-04/bai-16/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c4_b16';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-04/luyen-tap-03/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c4_lt3';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-04/bai-tap-cuoi-chuong/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c4_bt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-05/bai-17/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c5_b17';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-05/bai-18/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c5_b18';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-05/bai-19/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c5_b19';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-05/luyen-tap-01/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c5_lt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-05/bai-tap-cuoi-chuong/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c5_bt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/trai-nghiem/tap-1/hoat-dong-01/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_hdtn_t1_hd1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/trai-nghiem/tap-1/hoat-dong-02/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_hdtn_t1_hd2';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-06/bai-20/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c6_b20';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-06/bai-21/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c6_b21';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-06/luyen-tap-01/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c6_lt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-06/bai-22/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c6_b22';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-06/bai-23/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c6_b23';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-06/luyen-tap-02/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c6_lt2';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-06/bai-tap-cuoi-chuong/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c6_bt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-07/bai-24/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c7_b24';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-07/bai-25/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c7_b25';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-07/bai-26/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c7_b26';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-07/luyen-tap-01/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c7_lt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-07/bai-27/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c7_b27';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-07/bai-28/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c7_b28';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-07/luyen-tap-02/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c7_lt2';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-07/bai-tap-cuoi-chuong/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c7_bt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-08/bai-29/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c8_b29';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-08/bai-30/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c8_b30';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-08/luyen-tap-01/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c8_lt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-08/bai-tap-cuoi-chuong/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c8_bt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-09/bai-31/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c9_b31';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-09/bai-32/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c9_b32';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-09/bai-33/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c9_b33';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-09/luyen-tap-01/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c9_lt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-09/bai-34/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c9_b34';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-09/bai-35/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c9_b35';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-09/luyen-tap-02/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c9_lt2';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-09/bai-tap-cuoi-chuong/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c9_bt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-10/bai-36/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c10_b36';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-10/luyen-tap-01/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c10_lt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-10/bai-37/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c10_b37';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-10/luyen-tap-02/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c10_lt2';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/chuong-10/bai-tap-cuoi-chuong/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_c10_bt1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/trai-nghiem/tap-2/hoat-dong-01/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_hdtn_t2_hd1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/trai-nghiem/tap-2/hoat-dong-02/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_hdtn_t2_hd2';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/trai-nghiem/tap-2/hoat-dong-03/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_hdtn_t2_hd3';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/toan/on-tap-cuoi-nam/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'toan_7_hdtn_t2_on1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/tin-hoc/chu-de-01/bai-01/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_6_cd1_b1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/tin-hoc/chu-de-01/bai-02/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_6_cd1_b2';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/tin-hoc/chu-de-01/bai-03/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_6_cd1_b3';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/tin-hoc/chu-de-02/bai-04/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_6_cd2_b4';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/tin-hoc/chu-de-02/bai-05/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_6_cd2_b5';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/tin-hoc/chu-de-03/bai-06/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_6_cd3_b6';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/tin-hoc/chu-de-03/bai-07/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_6_cd3_b7';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/tin-hoc/chu-de-03/bai-08/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_6_cd3_b8';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/tin-hoc/chu-de-04/bai-09/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_6_cd4_b9';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/tin-hoc/chu-de-05/bai-10/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_6_cd5_b10';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/tin-hoc/chu-de-05/bai-11/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_6_cd5_b11';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/tin-hoc/chu-de-05/bai-12/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_6_cd5_b12';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/tin-hoc/chu-de-05/bai-13/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_6_cd5_b13';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/tin-hoc/chu-de-05/bai-14/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_6_cd5_b14';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/tin-hoc/chu-de-06/bai-15/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_6_cd6_b15';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/tin-hoc/chu-de-06/bai-16/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_6_cd6_b16';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-6/tin-hoc/chu-de-06/bai-17/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_6_cd6_b17';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/tin-hoc/chu-de-01/bai-01/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_7_cd1_b1';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/tin-hoc/chu-de-01/bai-02/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_7_cd1_b2';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/tin-hoc/chu-de-01/bai-03/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_7_cd1_b3';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/tin-hoc/chu-de-02/bai-04/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_7_cd2_b4';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/tin-hoc/chu-de-03/bai-05/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_7_cd3_b5';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/tin-hoc/chu-de-04/bai-06/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_7_cd4_b6';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/tin-hoc/chu-de-04/bai-07/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_7_cd4_b7';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/tin-hoc/chu-de-04/bai-08/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_7_cd4_b8';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/tin-hoc/chu-de-04/bai-09/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_7_cd4_b9';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/tin-hoc/chu-de-04/bai-10/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_7_cd4_b10';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/tin-hoc/chu-de-04/bai-11/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_7_cd4_b11';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/tin-hoc/chu-de-04/bai-12/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_7_cd4_b12';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/tin-hoc/chu-de-04/bai-13/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_7_cd4_b13';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/tin-hoc/chu-de-05/bai-14/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_7_cd5_b14';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/tin-hoc/chu-de-05/bai-15/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_7_cd5_b15';
UPDATE public.kttt_catalog SET html_url = '/lessons/lop-7/tin-hoc/chu-de-05/bai-16/index.html', html_file = 'index.html', updated_at = now() WHERE id = 'tin_7_cd5_b16';

COMMIT;
