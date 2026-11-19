import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  KHKT_DEMO_KEYS,
  KHKT_DEMO_STORAGE_PREFIX,
  StorageLike,
  buildNavigationUrl,
  clearAllKhktDemoStorage,
  createFreshKhktDemoState,
  evaluateProductionRouteAccess,
  getDemoScopedExamDraftKey,
  isDemoPathname,
  loadKhktDemoMeta,
  loadKhktDemoState,
  resetKhktDemoSandbox,
  resolveRouteLocation,
  sanitizeDemoView,
  saveKhktDemoMeta,
  saveKhktDemoState,
} from './khktDemoSandbox';

function createMemoryStorage(initial: Record<string, string> = {}): StorageLike & { dump(): Record<string, string> } {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
    removeItem(key: string) {
      map.delete(key);
    },
    dump() {
      return Object.fromEntries(map.entries());
    },
  };
}

describe('KHKT Automatic Guest Demo Mode (/demo)', () => {
  it('1. Direct entry at /demo enters demo home immediately without login or admin views', () => {
    assert.equal(isDemoPathname('/demo'), true);
    assert.equal(isDemoPathname('/demo/'), true);
    assert.equal(isDemoPathname('/demo/bai-giang'), true);
    assert.equal(isDemoPathname('/'), false);
    assert.equal(isDemoPathname('/teacher'), false);
    assert.equal(isDemoPathname('/admin'), false);

    assert.deepEqual(resolveRouteLocation('/demo', ''), {
      isDemo: true,
      view: 'dashboard',
      isDirectProtectedPath: false,
    });

    assert.deepEqual(resolveRouteLocation('/demo/bai-giang', ''), {
      isDemo: true,
      view: 'teacher_lectures',
      isDirectProtectedPath: false,
    });

    assert.deepEqual(resolveRouteLocation('/demo', '?view=student_assignments'), {
      isDemo: true,
      view: 'student_assignments',
      isDirectProtectedPath: false,
    });

    // Admin views & login_portal are always sanitized to dashboard inside /demo
    assert.equal(sanitizeDemoView('admin_accounts'), 'dashboard');
    assert.equal(sanitizeDemoView('admin_settings'), 'dashboard');
    assert.equal(sanitizeDemoView('login_portal'), 'dashboard');
    assert.deepEqual(resolveRouteLocation('/demo', '?view=admin_accounts'), {
      isDemo: true,
      view: 'dashboard',
      isDirectProtectedPath: false,
    });
  });

  it('2. Demo state is completely separate, contains zero real credentials/Supabase storage paths, and persists across reload', () => {
    const storage = createMemoryStorage({
      taydo_questions: JSON.stringify([{ id: 'real-q-1' }]),
      'sb-realproject-auth-token': '{"access_token":"real-session"}',
    });

    const initial = loadKhktDemoState(storage);
    assert.ok(initial.classes.length >= 3);
    assert.ok(initial.assignments.length >= 3);
    assert.ok(initial.exams.length >= 3);
    assert.ok(initial.studyDocs.every((doc) => !doc.storagePath && Boolean(doc.fileUrl?.startsWith('data:text/html'))));

    // Simulate guest creating a new question, grading a submission, and saving an exam draft
    const mutated = {
      ...initial,
      questions: [
        ...initial.questions,
        { ...initial.questions[0], id: 'demo-q-custom-khkt', content: 'Câu hỏi khách tạo trong buổi trình diễn KHKT' },
      ],
    };
    saveKhktDemoState(mutated, storage);
    saveKhktDemoMeta(
      {
        view: 'student_assignments',
        demoRole: 'student',
        selectedGrade: '8',
        selectedSubject: 'math',
        selectedPeriod: 'mid1',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      storage
    );
    const draftKey = getDemoScopedExamDraftKey('demo-asg-toan8-gk1', 'demo-hs-khkt-01', true);
    assert.ok(draftKey.startsWith(KHKT_DEMO_STORAGE_PREFIX));
    storage.setItem(draftKey, JSON.stringify({ answers: { q1: 'A' }, timeLeft: 1200 }));

    // Simulate page reload in the same browser
    const reloadedState = loadKhktDemoState(storage);
    const reloadedMeta = loadKhktDemoMeta(storage);
    assert.ok(reloadedState.questions.some((q) => q.id === 'demo-q-custom-khkt'));
    assert.equal(reloadedMeta?.view, 'student_assignments');
    assert.equal(reloadedMeta?.demoRole, 'student');
    assert.ok(storage.getItem(draftKey)?.includes('1200'));

    // Production keys remain 100% untouched
    assert.equal(storage.getItem('taydo_questions'), JSON.stringify([{ id: 'real-q-1' }]));
    assert.equal(storage.getItem('sb-realproject-auth-token'), '{"access_token":"real-session"}');
  });

  it('3. Resetting demo ("Đặt lại bản demo") wipes ONLY demo keys and preserves real production storage', () => {
    const storage = createMemoryStorage({
      taydo_questions: JSON.stringify([{ id: 'real-q-1' }]),
      taydo_sidebar_collapsed: 'true',
      'sb-realproject-auth-token': '{"access_token":"keep-me"}',
      [KHKT_DEMO_KEYS.RECENT_CORE_LESSON]: '{"lessonId":"toan_6_c1_b1"}',
      [KHKT_DEMO_KEYS.GAME_FAVORITES]: '["a01","c08"]',
      [`${KHKT_DEMO_KEYS.EXAM_DRAFT_PREFIX}demo-asg-1__demo-hs-khkt-01`]: '{"answers":{"q1":"B"}}',
      [`${KHKT_DEMO_KEYS.GAME_CALL_PREFIX}history`]: '[{"studentId":"s1"}]',
    });

    const dirty = createFreshKhktDemoState();
    dirty.questions.push({ ...dirty.questions[0], id: 'demo-temp-question' });
    saveKhktDemoState(dirty, storage);

    // Execute reset
    const resetResult = resetKhktDemoSandbox(storage);
    assert.ok(resetResult.clearedKeys >= 5);
    assert.equal(resetResult.state.questions.some((q) => q.id === 'demo-temp-question'), false);
    assert.equal(storage.getItem(KHKT_DEMO_KEYS.RECENT_CORE_LESSON), null);
    assert.equal(storage.getItem(KHKT_DEMO_KEYS.GAME_FAVORITES), null);
    assert.equal(storage.getItem(`${KHKT_DEMO_KEYS.EXAM_DRAFT_PREFIX}demo-asg-1__demo-hs-khkt-01`), null);
    assert.equal(storage.getItem(`${KHKT_DEMO_KEYS.GAME_CALL_PREFIX}history`), null);

    // Real keys MUST stay completely intact
    assert.equal(storage.getItem('taydo_questions'), JSON.stringify([{ id: 'real-q-1' }]));
    assert.equal(storage.getItem('taydo_sidebar_collapsed'), 'true');
    assert.equal(storage.getItem('sb-realproject-auth-token'), '{"access_token":"keep-me"}');

    // clearAllKhktDemoStorage removes every demo key cleanly
    clearAllKhktDemoStorage(storage);
    for (const k of Object.keys(storage.dump())) {
      assert.equal(k.startsWith(KHKT_DEMO_STORAGE_PREFIX), false);
    }
  });

  it('4. Two independent browser sessions remain completely isolated', () => {
    const browserA = createMemoryStorage();
    const browserB = createMemoryStorage();

    const stateA = loadKhktDemoState(browserA);
    const stateB = loadKhktDemoState(browserB);

    stateA.classes[0].name = 'Lớp 8A1 (Khách A chỉnh sửa)';
    saveKhktDemoState(stateA, browserA);
    saveKhktDemoState(stateB, browserB);

    assert.equal(loadKhktDemoState(browserA).classes[0].name, 'Lớp 8A1 (Khách A chỉnh sửa)');
    assert.notEqual(loadKhktDemoState(browserB).classes[0].name, 'Lớp 8A1 (Khách A chỉnh sửa)');

    // Resetting browser A does not affect browser B
    resetKhktDemoSandbox(browserA);
    assert.notEqual(loadKhktDemoState(browserA).classes[0].name, 'Lớp 8A1 (Khách A chỉnh sửa)');
    assert.equal(loadKhktDemoState(browserB).classes[0].id, stateB.classes[0].id);
  });

  it('5. Production Auth Guard protects real teacher/admin routes outside /demo while preserving public & authenticated flows', () => {
    // Unauthenticated visitor hitting real teacher/admin URLs outside /demo -> BLOCKED
    assert.equal(
      evaluateProductionRouteAccess({
        isDemoSandbox: false,
        currentView: 'teacher_classes',
        pathname: '/teacher',
        search: '',
        isAuthenticated: false,
        authenticatedRole: 'student',
      }).allowed,
      false
    );

    assert.equal(
      evaluateProductionRouteAccess({
        isDemoSandbox: false,
        currentView: 'teacher_lectures',
        pathname: '/',
        search: '?view=teacher_lectures',
        isAuthenticated: false,
        authenticatedRole: 'student',
      }).allowed,
      false
    );

    assert.equal(
      evaluateProductionRouteAccess({
        isDemoSandbox: false,
        currentView: 'admin_accounts',
        pathname: '/admin',
        search: '',
        isAuthenticated: false,
        authenticatedRole: 'student',
      }).allowed,
      false
    );

    // Authenticated student trying to access teacher_grading or admin_accounts -> BLOCKED
    assert.equal(
      evaluateProductionRouteAccess({
        isDemoSandbox: false,
        currentView: 'teacher_grading',
        pathname: '/',
        search: '?view=teacher_grading',
        isAuthenticated: true,
        authenticatedRole: 'student',
      }).allowed,
      false
    );

    assert.equal(
      evaluateProductionRouteAccess({
        isDemoSandbox: false,
        currentView: 'admin_accounts',
        pathname: '/',
        search: '?view=admin_accounts',
        isAuthenticated: true,
        authenticatedRole: 'student',
      }).allowed,
      false
    );

    // Authenticated student opening a shared lecture link (?view=teacher_lectures&lecture=toan_9_c1_b2&mode=student) -> ALLOWED
    assert.equal(
      evaluateProductionRouteAccess({
        isDemoSandbox: false,
        currentView: 'teacher_lectures',
        pathname: '/',
        search: '?view=teacher_lectures&lecture=toan_9_c1_b2&mode=student',
        isAuthenticated: true,
        authenticatedRole: 'student',
      }).allowed,
      true
    );

    // Real authenticated teacher & admin continue working normally
    assert.equal(
      evaluateProductionRouteAccess({
        isDemoSandbox: false,
        currentView: 'teacher_classes',
        pathname: '/',
        search: '?view=teacher_classes',
        isAuthenticated: true,
        authenticatedRole: 'teacher',
      }).allowed,
      true
    );

    assert.equal(
      evaluateProductionRouteAccess({
        isDemoSandbox: false,
        currentView: 'admin_accounts',
        pathname: '/',
        search: '?view=admin_accounts',
        isAuthenticated: true,
        authenticatedRole: 'admin',
      }).allowed,
      true
    );

    // Public homepage & EDU Game Center remain open on /
    assert.equal(
      evaluateProductionRouteAccess({
        isDemoSandbox: false,
        currentView: 'dashboard',
        pathname: '/',
        search: '',
        isAuthenticated: false,
        authenticatedRole: 'student',
      }).allowed,
      true
    );
    assert.equal(
      evaluateProductionRouteAccess({
        isDemoSandbox: false,
        currentView: 'teacher_student_call',
        pathname: '/',
        search: '?view=teacher_student_call',
        isAuthenticated: false,
        authenticatedRole: 'student',
      }).allowed,
      true
    );

    // Inside /demo, teacher views are allowed on sandbox data, while admin views stay blocked
    assert.equal(
      evaluateProductionRouteAccess({
        isDemoSandbox: true,
        currentView: 'teacher_lectures',
        pathname: '/demo',
        search: '?view=teacher_lectures',
        isAuthenticated: false,
        authenticatedRole: 'student',
      }).allowed,
      true
    );
    assert.equal(
      evaluateProductionRouteAccess({
        isDemoSandbox: true,
        currentView: 'admin_accounts',
        pathname: '/demo',
        search: '?view=admin_accounts',
        isAuthenticated: false,
        authenticatedRole: 'student',
      }).allowed,
      false
    );
  });

  it('6. URL builder keeps /demo inside demo mode and / outside demo mode', () => {
    assert.equal(buildNavigationUrl('dashboard', 'http://localhost:3000/demo?view=teacher_lectures', true), '/demo');
    assert.equal(
      buildNavigationUrl('student_assignments', 'http://localhost:3000/demo', true),
      '/demo?view=student_assignments'
    );
    assert.equal(
      buildNavigationUrl('admin_accounts', 'http://localhost:3000/demo', true),
      '/demo'
    );
    assert.equal(
      buildNavigationUrl('login_portal', 'http://localhost:3000/demo', false),
      '/?view=login_portal'
    );
  });

  it('7. Supabase proxy stays strictly offline/no-op when runtime pathname is /demo', async () => {
    const originalWindow = (globalThis as any).window;
    let fetchCalled = false;
    const originalFetch = globalThis.fetch;

    try {
      (globalThis as any).window = {
        location: { pathname: '/demo', search: '', href: 'http://localhost:3000/demo' },
        localStorage: createMemoryStorage(),
      };
      globalThis.fetch = (async () => {
        fetchCalled = true;
        throw new Error('Network call MUST NOT happen in /demo!');
      }) as typeof fetch;

      const { supabase, fetchUserProfileDetailed } = await import('../lib/supabase');

      const sessionRes = await supabase.auth.getSession();
      assert.equal(sessionRes.data.session, null);
      assert.equal(sessionRes.error, null);

      const queryRes = await supabase.from('audit_logs').insert({ action: 'test' });
      assert.equal(queryRes.error, null);

      const rpcRes = await supabase.rpc('some_rpc', {});
      assert.equal(rpcRes.data, null);
      assert.ok(rpcRes.error?.message?.includes('Demo KHKT'));

      const storageRes = await supabase.storage.from('materials').createSignedUrl('a.pdf', 60);
      assert.equal(storageRes.data, null);

      const profileRes = await fetchUserProfileDetailed('demo-gv-khkt-01');
      assert.equal(profileRes.profile, null);

      assert.equal(fetchCalled, false);
    } finally {
      (globalThis as any).window = originalWindow;
      globalThis.fetch = originalFetch;
    }
  });
});
