/**
 * Cầu nối lịch sử học tập giữa iframe bài học Toán 6 và Supabase
 * Phiên bản giao thức: taydo.edu.lesson.v1
 */

const CHANNEL = 'taydo.edu.lesson.v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface MountLessonHistoryBridgeOptions {
  iframe: HTMLIFrameElement;
  lessonId: string;
  userId: string;
  supabase: any;
}

export interface LessonAttemptEvent {
  type: string;
  timestamp?: number | string;
  [key: string]: any;
}

export interface LessonAttemptRecord {
  id: string; // UUID
  lessonId: string;
  revision: number;
  events: LessonAttemptEvent[];
  [key: string]: any;
}

/**
 * Gắn cầu nối khi iframe, lessonId và authenticated userId đều sẵn sàng.
 * Hàm trả về cleanup function để tháo gỡ khi đổi bài, đổi user hoặc unmount.
 */
export function mountLessonHistoryBridge({ iframe, lessonId, userId, supabase }: MountLessonHistoryBridgeOptions) {
  if (!(iframe instanceof HTMLIFrameElement) || !UUID.test(userId)) {
    throw new Error('Cần iframe và ID tài khoản Supabase hợp lệ (UUID).');
  }
  const origin = window.location.origin;
  const url = new URL(iframe.getAttribute('src') || '', window.location.href);
  if (url.origin !== origin || !/^\/lessons\/lop-[6-9]\//.test(url.pathname)) {
    throw new Error('Đường dẫn iframe phải thuộc thư mục học liệu THCS của website.');
  }

  let disposed = false;
  let reading = false;
  const queued = new Map<string, LessonAttemptRecord>();
  const inFlight = new Set<string>();

  function reply(type: string, fields: Record<string, any> = {}) {
    if (!disposed) {
      iframe.contentWindow?.postMessage({ channel: CHANNEL, type, lessonId, userId, ...fields }, origin);
    }
  }

  async function history() {
    if (reading || disposed) return;
    reading = true;
    reply('account');
    try {
      const records: any[] = [];
      let last: string | null = null;
      for (;;) {
        let query = supabase.from('edu_lesson_attempts').select('attempt_id, payload')
          .eq('learner_id', userId).eq('lesson_id', lessonId).order('attempt_id').limit(200);
        if (last) query = query.gt('attempt_id', last);
        const { data, error } = await query;
        if (error) throw error;
        if (disposed) return;
        records.push(...(data || []).map((row: any) => row.payload));
        if (!data || data.length < 200) break;
        last = data.at(-1).attempt_id;
      }
      reply('history', { records });
    } catch (_) {
      reply('sync-error');
    } finally {
      reading = false;
    }
  }

  async function flush(id: string) {
    if (inFlight.has(id) || disposed) return;
    inFlight.add(id);
    try {
      while (queued.has(id) && !disposed) {
        const record = queued.get(id);
        queued.delete(id);
        if (!record) break;
        const { data, error } = await supabase.rpc('edu_save_lesson_attempt', {
          p_expected_user: userId, p_lesson_id: lessonId, p_payload: record
        });
        if (error) {
          reply('sync-error');
          break;
        }
        reply('saved', { id, revision: Math.max(record.revision, Number(data) || 0) });
      }
    } catch (_) {
      reply('sync-error');
    } finally {
      inFlight.delete(id);
      if (queued.has(id)) flush(id);
    }
  }

  function onMessage(event: MessageEvent) {
    if (disposed || event.origin !== origin || event.source !== iframe.contentWindow) return;
    const message = event.data;
    if (!message || message.channel !== CHANNEL || message.lessonId !== lessonId) return;
    if (message.type === 'hello') { history(); return; }
    if (message.type !== 'save' || message.userId !== userId) return;
    const record: LessonAttemptRecord = message.record;
    if (!record || !UUID.test(record.id) || record.lessonId !== lessonId ||
        !Number.isSafeInteger(record.revision) || record.revision < 1 ||
        !Array.isArray(record.events)) return;
    if ((queued.get(record.id)?.revision || 0) < record.revision) queued.set(record.id, record);
    flush(record.id);
  }

  window.addEventListener('message', onMessage);
  iframe.addEventListener('load', history);
  history();

  return () => {
    reply('signed-out');
    disposed = true;
    queued.clear();
    iframe.removeEventListener('load', history);
    window.removeEventListener('message', onMessage);
  };
}
