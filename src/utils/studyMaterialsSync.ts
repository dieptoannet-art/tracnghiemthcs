import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isKhktDemoRuntime } from './khktDemoSandbox';
import {
  ExamPeriod,
  Grade,
  StudyDocument,
  StudyMaterialStatus,
  StudyMaterialType,
  SubjectId
} from '../types';

export const STUDY_MATERIALS_BUCKET = 'study-materials';
export const LOCAL_STUDY_MATERIALS_KEY = 'taydo_study_materials_v1';

export const STUDY_MATERIAL_TYPE_OPTIONS: Array<{
  value: StudyMaterialType;
  label: string;
  shortLabel: string;
}> = [
  { value: 'de_cuong', label: 'Đề cương ôn tập', shortLabel: 'Đề cương ôn tập' },
  { value: 'phieu_bai_tap', label: 'Phiếu bài tập', shortLabel: 'Phiếu bài tập' },
  { value: 'de_tham_khao', label: 'Đề tham khảo', shortLabel: 'Đề tham khảo' },
  { value: 'so_tay', label: 'Sổ tay kiến thức', shortLabel: 'Sổ tay kiến thức' },
  { value: 'tep_thuc_hanh', label: 'Tệp thực hành', shortLabel: 'Tệp thực hành' }
];

export const EXAM_TERM_OPTIONS: Array<{ value: ExamPeriod; label: string }> = [
  { value: 'mid1', label: 'Giữa kỳ I' },
  { value: 'final1', label: 'Cuối kỳ I' },
  { value: 'mid2', label: 'Giữa kỳ II' },
  { value: 'final2', label: 'Cuối kỳ II' }
];

export const SUBJECT_OPTIONS: Array<{ value: SubjectId; label: string }> = [
  { value: 'math', label: 'Toán học' },
  { value: 'informatics', label: 'Tin học' },
  { value: 'science', label: 'Khoa học tự nhiên' },
  { value: 'literature', label: 'Ngữ văn' },
  { value: 'english', label: 'Tiếng Anh' },
  { value: 'history_geo', label: 'Lịch sử và Địa lí' },
  { value: 'technology', label: 'Công nghệ' },
  { value: 'civics', label: 'Giáo dục công dân' },
  { value: 'other', label: 'Môn học khác' }
];

export function getMaterialTypeLabel(type?: string | null): string {
  const found = STUDY_MATERIAL_TYPE_OPTIONS.find(t => t.value === type);
  return found ? found.label : 'Tài liệu học tập';
}

export function getExamTermLabel(term?: ExamPeriod | string | null): string {
  const found = EXAM_TERM_OPTIONS.find(t => t.value === term);
  return found ? found.label : '';
}

export function getSubjectLabel(subjectId?: SubjectId | string | null): string {
  const found = SUBJECT_OPTIONS.find(s => s.value === subjectId);
  return found ? found.label : 'Môn học khác';
}

export function mapSubjectNameToId(subjectName: string): SubjectId {
  const normalized = (subjectName || '').trim().toLowerCase();
  if (normalized.includes('toán') || normalized === 'math' || normalized === 'toan') return 'math';
  if (normalized.includes('tin') || normalized === 'informatics') return 'informatics';
  if (normalized.includes('khoa học') || normalized === 'khtn' || normalized === 'science') return 'science';
  if (normalized.includes('văn') || normalized === 'literature') return 'literature';
  if (normalized.includes('anh') || normalized === 'english') return 'english';
  if (normalized.includes('sử') || normalized.includes('địa') || normalized === 'history_geo') return 'history_geo';
  if (normalized.includes('công nghệ') || normalized === 'technology') return 'technology';
  if (normalized.includes('gdcd') || normalized.includes('công dân') || normalized === 'civics') return 'civics';
  return 'other';
}

export function mapCatalogSubjectCodeToId(subjectCode: string): SubjectId {
  switch (subjectCode) {
    case 'Toan':
      return 'math';
    case 'Tin':
      return 'informatics';
    case 'KHTN':
      return 'science';
    default:
      return mapSubjectNameToId(subjectCode);
  }
}

export function mapSubjectIdToCatalogCode(subjectId: SubjectId | string): string | null {
  switch (subjectId) {
    case 'math':
      return 'Toan';
    case 'informatics':
      return 'Tin';
    case 'science':
      return 'KHTN';
    default:
      return null;
  }
}

export function normalizeLegacyStudyDocument(raw: any): StudyDocument {
  let materialType: StudyMaterialType = raw?.materialType || raw?.material_type || 'de_cuong';
  const legacyType = raw?.type;
  if (!raw?.materialType && !raw?.material_type && legacyType) {
    if (legacyType === 'cong_thuc') materialType = 'so_tay';
    else if (legacyType === 'de_mau') materialType = 'de_tham_khao';
    else if (legacyType === 'bai_giang') materialType = 'so_tay';
    else materialType = 'de_cuong';
  }

  const fileUrl = raw?.fileUrl ?? raw?.file_url ?? raw?.downloadUrl ?? null;
  const storagePath = raw?.storagePath ?? raw?.storage_path ?? null;
  const rawSizeBytes = raw?.fileSizeBytes ?? raw?.file_size_bytes;
  const parsedSizeBytes =
    typeof rawSizeBytes === 'number' && Number.isFinite(rawSizeBytes) && rawSizeBytes > 0
      ? rawSizeBytes
      : null;

  const rawStatus: StudyMaterialStatus =
    raw?.status === 'published' ? 'published' : 'draft';

  return {
    id: String(raw?.id || `doc-${Date.now()}`),
    title: String(raw?.title || ''),
    topic: raw?.topic || undefined,
    grade: (String(raw?.grade || '8') as Grade),
    subject: (raw?.subject || 'math') as SubjectId,
    materialType,
    examTerm: (raw?.examTerm ?? raw?.exam_term ?? null) as ExamPeriod | null,
    lessonId: raw?.lessonId ?? raw?.lesson_id ?? null,
    chapterKey: raw?.chapterKey ?? raw?.chapter_key ?? null,
    chapterLabel: raw?.chapterLabel ?? raw?.chapter_label ?? null,
    lessonLabel: raw?.lessonLabel ?? raw?.lesson_label ?? null,
    author: String(raw?.author ?? raw?.author_name ?? 'Tổ Chuyên môn THCS Tây Đô'),
    authorId: raw?.authorId ?? raw?.author_id ?? undefined,
    description: String(raw?.description || ''),
    usageInstructions: raw?.usageInstructions ?? raw?.usage_instructions ?? null,
    fileName: raw?.fileName ?? raw?.file_name ?? null,
    fileFormat: raw?.fileFormat ?? raw?.file_format ?? null,
    fileUrl,
    storagePath,
    fileSizeBytes: parsedSizeBytes,
    status: rawStatus,
    updatedAt: raw?.updatedAt ?? raw?.updated_at ?? null,
    createdAt: raw?.createdAt ?? raw?.created_at ?? null,
    answerKeyFileName: raw?.answerKeyFileName ?? raw?.answer_key_file_name ?? null,
    answerKeyFileUrl: raw?.answerKeyFileUrl ?? raw?.answer_key_file_url ?? null,
    answerKeyStoragePath: raw?.answerKeyStoragePath ?? raw?.answer_key_storage_path ?? null,
    isAnswerKeyPublished: Boolean(raw?.isAnswerKeyPublished ?? raw?.is_answer_key_published ?? false)
  };
}

export function hasValidAttachedFile(doc?: Partial<StudyDocument> | null): boolean {
  if (!doc) return false;
  if (doc.storagePath && doc.storagePath.trim().length > 0) return true;
  if (!doc.fileUrl) return false;
  const trimmed = doc.fileUrl.trim();
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  );
}

export function isStudentVisibleMaterial(doc: StudyDocument): boolean {
  return doc.status === 'published' && hasValidAttachedFile(doc);
}

export function inferFileFormat(fileName?: string | null, mimeType?: string | null, explicitFormat?: string | null): string | null {
  if (explicitFormat && explicitFormat.trim()) return explicitFormat.trim().toUpperCase();
  if (fileName && fileName.includes('.')) {
    const ext = fileName.split('.').pop()?.trim().toUpperCase();
    if (ext) return ext;
  }
  if (mimeType) {
    if (mimeType.includes('pdf')) return 'PDF';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'XLSX';
    if (mimeType.includes('csv')) return 'CSV';
    if (mimeType.includes('wordprocessingml') || mimeType.includes('msword')) return 'DOCX';
  }
  return null;
}

export function isPdfMaterial(doc?: Partial<StudyDocument> | null): boolean {
  if (!doc) return false;
  if (doc.fileFormat?.toUpperCase() === 'PDF') return true;
  const targets = [doc.fileName, doc.fileUrl, doc.storagePath];
  return targets.some(val => {
    if (!val) return false;
    const lower = val.toLowerCase();
    return (
      lower.startsWith('data:application/pdf') ||
      /\.pdf(\?|#|$)/i.test(lower)
    );
  });
}

export function isPracticeOrSpreadsheetFormat(doc?: Partial<StudyDocument> | null): boolean {
  if (!doc) return false;
  const fmt = doc.fileFormat?.toUpperCase();
  if (fmt && ['XLSX', 'XLS', 'CSV', 'XLSM', 'ODS', 'SB3', 'PY', 'ZIP'].includes(fmt)) {
    return true;
  }
  return doc.materialType === 'tep_thuc_hanh';
}

export function formatRealFileSize(bytes?: number | null): string | null {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) {
    return null;
  }
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

export function formatRealUpdatedDate(iso?: string | null): string | null {
  if (!iso || !iso.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Shared matching logic between "Ôn tập học kỳ -> Xem đề cương" and "Tài liệu học tập".
 * Ensures both entry points resolve the exact same published outline document(s).
 */
export function findMatchingPublishedOutlines(
  docs: StudyDocument[],
  grade: Grade | string,
  subject: SubjectId,
  examTerm: ExamPeriod
): StudyDocument[] {
  const normGrade = String(grade).trim();
  return docs.filter(
    doc =>
      isStudentVisibleMaterial(doc) &&
      doc.materialType === 'de_cuong' &&
      String(doc.grade) === normGrade &&
      doc.subject === subject &&
      doc.examTerm === examTerm
  );
}

/**
 * Shared matching logic between "Kiến thức trọng tâm -> Tải phiếu bài tập" and "Tài liệu học tập".
 */
export function findMatchingPublishedWorksheetsByLesson(
  docs: StudyDocument[],
  lessonId?: string | null
): StudyDocument[] {
  if (!lessonId) return [];
  return docs.filter(
    doc =>
      isStudentVisibleMaterial(doc) &&
      doc.materialType === 'phieu_bai_tap' &&
      doc.lessonId === lessonId
  );
}

export function formatStudyMaterialSupabaseError(error: any, fallback: string): string {
  if (!error) return fallback;
  const msg = String(error.message || error.details || fallback);
  const code = String(error.code || '');

  if (
    msg.includes('schema cache') ||
    msg.includes('Could not find the table') ||
    code === 'PGRST205' ||
    code === '42P01'
  ) {
    return 'CSDL Supabase chưa có bảng study_materials. Vui lòng chạy file migration src/data/03_study_materials_supabase.sql trong Supabase SQL Editor.';
  }
  if (msg.includes('Bucket not found') || msg.includes('bucket')) {
    return 'Chưa có Storage bucket "study-materials" trên Supabase. Vui lòng chạy src/data/03_study_materials_supabase.sql hoặc tạo bucket private "study-materials".';
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('AbortError')) {
    return 'Không thể kết nối mạng tới Supabase. Vui lòng kiểm tra kết nối và thử lại.';
  }
  return msg;
}

export async function fetchStudyMaterialsFromSupabase(
  includeAnswerKeys: boolean
): Promise<{ data?: StudyDocument[]; error?: string }> {
  if (isKhktDemoRuntime()) {
    return { data: [] };
  }
  if (!isSupabaseConfigured) {
    return { error: 'Chưa cấu hình Supabase.' };
  }

  try {
    const { data: rows, error } = await supabase
      .from('study_materials')
      .select('*')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      return { error: formatStudyMaterialSupabaseError(error, 'Không thể tải danh sách tài liệu học tập.') };
    }

    const answerKeyMap = new Map<string, any>();
    if ((rows || []).length > 0) {
      const { data: keyRows, error: keyErr } = await supabase
        .from('study_material_answer_keys')
        .select('*');

      if (!keyErr && Array.isArray(keyRows)) {
        for (const k of keyRows) {
          answerKeyMap.set(k.material_id, k);
        }
      }
    }

    const normalized = (rows || []).map((row: any) => {
      const k = answerKeyMap.get(row.id);
      const doc = normalizeLegacyStudyDocument({
        ...row,
        answer_key_file_name: includeAnswerKeys || k?.is_published ? k?.answer_key_file_name : null,
        answer_key_file_url: includeAnswerKeys || k?.is_published ? k?.answer_key_file_url : null,
        answer_key_storage_path: includeAnswerKeys || k?.is_published ? k?.answer_key_storage_path : null,
        is_answer_key_published: Boolean(k?.is_published)
      });
      return doc;
    });

    return { data: normalized };
  } catch (err: any) {
    return {
      error: formatStudyMaterialSupabaseError(err, 'Đã xảy ra lỗi khi tải tài liệu học tập.')
    };
  }
}

export async function resolveMaterialFileUrl(
  storagePath?: string | null,
  fallbackUrl?: string | null
): Promise<{ url: string | null; error?: string }> {
  if (isKhktDemoRuntime()) {
    if (fallbackUrl && fallbackUrl.trim()) {
      return { url: fallbackUrl.trim() };
    }
    return { url: null, error: 'Tài liệu mẫu chưa có tệp cục bộ đính kèm.' };
  }

  if (storagePath && storagePath.trim() && isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.storage
        .from(STUDY_MATERIALS_BUCKET)
        .createSignedUrl(storagePath, 3600);
      if (!error && data?.signedUrl) {
        return { url: data.signedUrl };
      }
      if (fallbackUrl && fallbackUrl.trim()) {
        return { url: fallbackUrl.trim() };
      }
      return {
        url: null,
        error: formatStudyMaterialSupabaseError(error, 'Không thể tạo liên kết tải tệp từ Supabase Storage.')
      };
    } catch (err: any) {
      if (fallbackUrl && fallbackUrl.trim()) {
        return { url: fallbackUrl.trim() };
      }
      return {
        url: null,
        error: formatStudyMaterialSupabaseError(err, 'Lỗi khi truy xuất tệp từ Supabase Storage.')
      };
    }
  }

  if (fallbackUrl && fallbackUrl.trim()) {
    return { url: fallbackUrl.trim() };
  }
  return { url: null, error: 'Tài liệu chưa có tệp đính kèm hợp lệ.' };
}

export async function triggerMaterialDownload(
  doc: StudyDocument
): Promise<{ success: boolean; error?: string }> {
  const resolved = await resolveMaterialFileUrl(doc.storagePath, doc.fileUrl);
  if (!resolved.url) {
    return { success: false, error: resolved.error || 'Tài liệu chưa có tệp hợp lệ.' };
  }

  const downloadName =
    doc.fileName ||
    `${doc.title.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 80)}${
      doc.fileFormat ? `.${doc.fileFormat.toLowerCase()}` : ''
    }`;

  try {
    if (resolved.url.startsWith('data:') || resolved.url.startsWith('blob:')) {
      const a = document.createElement('a');
      a.href = resolved.url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return { success: true };
    }

    // Fetch blob when possible so cross-origin signed URLs respect download filename cleanly
    const res = await fetch(resolved.url);
    if (!res.ok) {
      throw new Error(`Không thể tải tệp (HTTP ${res.status}).`);
    }
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(objUrl), 5000);
    return { success: true };
  } catch {
    // Direct anchor download fallback (never uses window.open / window.alert)
    const a = document.createElement('a');
    a.href = resolved.url;
    a.download = downloadName;
    a.target = '_blank';
    a.rel = 'noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return { success: true };
  }
}

export interface SaveStudyMaterialPayload {
  id?: string;
  title: string;
  topic?: string;
  grade: Grade;
  subject: SubjectId;
  materialType: StudyMaterialType;
  examTerm?: ExamPeriod | null;
  lessonId?: string | null;
  chapterKey?: string | null;
  chapterLabel?: string | null;
  lessonLabel?: string | null;
  description: string;
  usageInstructions?: string | null;
  status: StudyMaterialStatus;
  author: string;
  authorId?: string;
  selectedFile?: File | null;
  externalFileUrl?: string | null;
  existingMaterial?: StudyDocument | null;
}

function sanitizeStorageFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ensureUuidForSupabase(existingId?: string): string {
  if (existingId && UUID_REGEX.test(existingId)) return existingId;
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function saveStudyMaterialToSupabase(
  payload: SaveStudyMaterialPayload
): Promise<{ success: boolean; material?: StudyDocument; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Chưa cấu hình Supabase.' };
  }

  const recordId = ensureUuidForSupabase(payload.id);
  let fileName = payload.existingMaterial?.fileName ?? null;
  let fileFormat = payload.existingMaterial?.fileFormat ?? null;
  let fileUrl = payload.existingMaterial?.fileUrl ?? null;
  let storagePath = payload.existingMaterial?.storagePath ?? null;
  let fileSizeBytes = payload.existingMaterial?.fileSizeBytes ?? null;

  if (payload.selectedFile) {
    const f = payload.selectedFile;
    const safeName = sanitizeStorageFileName(f.name) || `tai_lieu_${Date.now()}`;
    const objectPath = `${payload.grade}/${payload.subject}/${recordId}/${Date.now()}_${safeName}`;

    const { error: uploadErr } = await supabase.storage
      .from(STUDY_MATERIALS_BUCKET)
      .upload(objectPath, f, {
        cacheControl: '3600',
        upsert: true,
        contentType: f.type || undefined
      });

    if (uploadErr) {
      return {
        success: false,
        error: formatStudyMaterialSupabaseError(uploadErr, 'Không thể tải tệp lên Supabase Storage.')
      };
    }

    fileName = f.name;
    fileFormat = inferFileFormat(f.name, f.type);
    storagePath = objectPath;
    fileUrl = null; // Served via RLS-checked signed URL from storagePath
    fileSizeBytes = f.size;
  } else if (payload.externalFileUrl !== undefined) {
    const trimmed = (payload.externalFileUrl || '').trim();
    if (trimmed) {
      fileUrl = trimmed;
      storagePath = null;
      if (!fileName || fileUrl !== payload.existingMaterial?.fileUrl) {
        const cleanSegment = trimmed.split('?')[0].split('/').pop() || 'tai-lieu';
        fileName = decodeURIComponent(cleanSegment);
        fileFormat = inferFileFormat(fileName);
        fileSizeBytes = null;
      }
    }
  }

  const nowIso = new Date().toISOString();
  const dbRow = {
    id: recordId,
    title: payload.title.trim(),
    topic: payload.topic?.trim() || null,
    grade: payload.grade,
    subject: payload.subject,
    material_type: payload.materialType,
    exam_term:
      payload.materialType === 'de_cuong' || payload.materialType === 'de_tham_khao'
        ? payload.examTerm || null
        : null,
    lesson_id:
      payload.materialType === 'phieu_bai_tap' || payload.materialType === 'tep_thuc_hanh'
        ? payload.lessonId || null
        : null,
    chapter_key:
      payload.materialType === 'phieu_bai_tap' || payload.materialType === 'tep_thuc_hanh'
        ? payload.chapterKey || null
        : null,
    chapter_label:
      payload.materialType === 'phieu_bai_tap' || payload.materialType === 'tep_thuc_hanh'
        ? payload.chapterLabel || null
        : null,
    lesson_label:
      payload.materialType === 'phieu_bai_tap' || payload.materialType === 'tep_thuc_hanh'
        ? payload.lessonLabel || null
        : null,
    description: payload.description.trim(),
    usage_instructions: payload.usageInstructions?.trim() || null,
    file_name: fileName,
    file_format: fileFormat,
    file_url: fileUrl,
    storage_path: storagePath,
    file_size_bytes: fileSizeBytes,
    author_name: payload.author,
    author_id: payload.authorId && UUID_REGEX.test(payload.authorId) ? payload.authorId : null,
    status: payload.status,
    updated_at: nowIso
  };

  const { data, error } = await supabase
    .from('study_materials')
    .upsert(dbRow, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) {
    return {
      success: false,
      error: formatStudyMaterialSupabaseError(error, 'Không thể lưu tài liệu lên Supabase.')
    };
  }

  return {
    success: true,
    material: normalizeLegacyStudyDocument(data)
  };
}

export async function deleteStudyMaterialFromSupabase(
  doc: StudyDocument
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Chưa cấu hình Supabase.' };
  }

  if (doc.storagePath) {
    await supabase.storage.from(STUDY_MATERIALS_BUCKET).remove([doc.storagePath]);
  }

  if (UUID_REGEX.test(doc.id)) {
    const { error } = await supabase.from('study_materials').delete().eq('id', doc.id);
    if (error) {
      return {
        success: false,
        error: formatStudyMaterialSupabaseError(error, 'Không thể xóa tài liệu trên Supabase.')
      };
    }
  }

  return { success: true };
}
