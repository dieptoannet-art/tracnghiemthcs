const CHANNEL = 'taydo.edu.lesson.v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Mount when iframe, lesson ID and authenticated user are all available.
// Call the returned cleanup on unmount, lesson change or user change.
export function mountLessonHistoryBridge({ iframe, lessonId, userId, supabase }) {
  if (!(iframe instanceof HTMLIFrameElement) || !UUID.test(userId)) {
    throw new Error('Cần iframe và ID tài khoản Supabase.');
  }
  const origin = window.location.origin;
  const url = new URL(iframe.getAttribute('src') || '',window.location.href);
  if (url.origin!==origin || !/^\/lessons\/lop-[6-9]\//.test(url.pathname)) {
    throw new Error('Đường dẫn iframe phải thuộc thư mục học liệu THCS của website.');
  }

  let disposed = false;
  let reading = false;
  const queued = new Map();
  const inFlight = new Set();

  function reply(type, fields = {}) {
    if (!disposed) {
      iframe.contentWindow?.postMessage({ channel:CHANNEL, type, lessonId, userId, ...fields },origin);
    }
  }
  async function history() {
    if (reading || disposed) return;
    reading = true;
    reply('account');
    try {
      const records = [];
      let last = null;
      for (;;) {
        let query = supabase.from('edu_lesson_attempts').select('attempt_id, payload')
          .eq('learner_id',userId).eq('lesson_id',lessonId).order('attempt_id').limit(200);
        if (last) query=query.gt('attempt_id',last);
        const { data, error } = await query;
        if (error) throw error;
        if (disposed) return;
        records.push(...data.map(row=>row.payload));
        if (data.length<200) break;
        last=data.at(-1).attempt_id;
      }
      reply('history',{records});
    } catch (_) {
      reply('sync-error');
    } finally {
      reading=false;
    }
  }

  async function flush(id) {
    if (inFlight.has(id) || disposed) return;
    inFlight.add(id);
    try {
      while (queued.has(id) && !disposed) {
        const record=queued.get(id);
        queued.delete(id);
        const { data, error }=await supabase.rpc('edu_save_lesson_attempt',{
          p_expected_user:userId, p_lesson_id:lessonId, p_payload:record
        });
        if(error) {
          reply('sync-error');
          break;
        }
        reply('saved',{id,revision:Math.max(record.revision,Number(data)||0)});
      }
    } catch (_) {
      reply('sync-error');
    } finally {
      inFlight.delete(id);
      if (queued.has(id)) flush(id);
    }
  }

  function onMessage(event) {
    if (disposed || event.origin!==origin || event.source!==iframe.contentWindow) return;
    const message=event.data;
    if (!message || message.channel!==CHANNEL || message.lessonId!==lessonId) return;
    if (message.type==='hello') { history(); return; }
    if (message.type!=='save' || message.userId!==userId) return;
    const record=message.record;
    if (!record || !UUID.test(record.id) || record.lessonId!==lessonId ||
        !Number.isSafeInteger(record.revision) || record.revision<1 ||
        !Array.isArray(record.events)) return;
    if ((queued.get(record.id)?.revision||0)<record.revision) queued.set(record.id,record);
    flush(record.id);
  }

  window.addEventListener('message',onMessage);
  iframe.addEventListener('load',history);
  history();
  return ()=>{
    reply('signed-out');
    disposed=true;
    queued.clear();
    iframe.removeEventListener('load',history);
    window.removeEventListener('message',onMessage);
  };
}
