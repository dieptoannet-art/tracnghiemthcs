import test from 'node:test';
import assert from 'node:assert/strict';
import {
  E05_CLUSTERS,
  E05_SAMPLE_BADGE,
  E05_SAMPLE_QUESTIONS,
  E05_SESSION_STORAGE_KEY,
  buildE05QuestionPool,
  clearE05Session,
  commitStarTurn,
  computeClusterProgress,
  computeMapLitStarCount,
  computeStarStandings,
  createDefaultStarHuntConfig,
  createInitialStarHuntState,
  createStarTeams,
  editLastStarTurn,
  getCorrectOptionLabelForStarQuestion,
  getCurrentPickingTeam,
  getE05SessionStorageKey,
  getMissedStarsForReview,
  getStarNodeStatus,
  loadE05Session,
  openStarOnMap,
  recordStarReviewAttempt,
  returnToStarMap,
  saveE05Session,
  shuffleStarOptionsPreservingId,
  validateStarSetupConfig,
} from './starHunt3dEngine';
import { renderMathToHtml } from '../../MathView';
import { EduGameSoundBank } from '../../../utils/eduGameAudioController';
import { KHKT_DEMO_STORAGE_PREFIX } from '../../../utils/khktDemoSandbox';
import { Question } from '../../../types';

function createSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
    removeItem(key: string) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    get length() {
      return map.size;
    },
  };
}

// ============================================================================
// 1. EXACT 9-QUESTION SAMPLE PACK, 3 CLUSTERS, DISTINCT OPTIONS & KATEX
// ============================================================================

test('E05 Sample pack contains exact 9 THCS Math questions across 3 clusters with valid KaTeX and distinct options', () => {
  assert.equal(E05_CLUSTERS.length, 3);
  assert.equal(E05_SAMPLE_QUESTIONS.length, 9);

  const byCluster = {
    1: E05_SAMPLE_QUESTIONS.filter((q) => q.clusterId === 1),
    2: E05_SAMPLE_QUESTIONS.filter((q) => q.clusterId === 2),
    3: E05_SAMPLE_QUESTIONS.filter((q) => q.clusterId === 3),
  };
  assert.equal(byCluster[1].length, 3);
  assert.equal(byCluster[2].length, 3);
  assert.equal(byCluster[3].length, 3);

  for (const q of E05_SAMPLE_QUESTIONS) {
    assert.equal(q.isSample, true);
    assert.equal(q.sourceBadge, E05_SAMPLE_BADGE);
    assert.equal(q.options.length, 4);

    // Distinct option texts & single exact answer
    const texts = new Set(q.options.map((o) => o.text.trim()));
    assert.equal(texts.size, 4, `Duplicate option detected in ${q.code}`);
    const correctOpt = q.options.find((o) => o.id === q.correctOptionId);
    assert.ok(correctOpt, `Missing correct option in ${q.code}`);
    assert.equal(correctOpt.text, q.officialAnswerText);

    // Render KaTeX for stem, all 4 options, and explanation -> 0 katex-error
    const stemHtml = renderMathToHtml(q.stem);
    assert.equal(stemHtml.includes('katex-error'), false, `KaTeX error in ${q.code} stem`);
    for (const opt of q.options) {
      const optHtml = renderMathToHtml(opt.text);
      assert.equal(optHtml.includes('katex-error'), false, `KaTeX error in ${q.code} opt ${opt.label}`);
    }
    const expHtml = renderMathToHtml(q.explanation);
    assert.equal(expHtml.includes('katex-error'), false, `KaTeX error in ${q.code} explanation`);
  }

  // System of equations (Q6) renders cleanly without error
  const q6 = E05_SAMPLE_QUESTIONS[5];
  assert.ok(q6.stem.includes('\\begin{cases}'));
  assert.equal(renderMathToHtml(q6.stem).includes('katex-error'), false);

  // Malformed LaTeX degrades safely without throwing
  const malformed = renderMathToHtml('\\(\\begin{cases}x+y=1\\)');
  assert.equal(typeof malformed, 'string');
  assert.ok(malformed.length > 0);
});

test('E05 Option shuffling preserves stable option ID and exact answer correctness', () => {
  const q = E05_SAMPLE_QUESTIONS[5]; // Q6 system of equations
  const shuffled = shuffleStarOptionsPreservingId(q, createSeededRng(2027));
  const correctOpt = shuffled.options.find((o) => o.id === shuffled.correctOptionId);
  assert.ok(correctOpt);
  assert.equal(correctOpt.text, q.officialAnswerText);
  assert.equal(getCorrectOptionLabelForStarQuestion(shuffled), correctOpt.label);
});

// ============================================================================
// 2. TEAMS MODE ACCEPTANCE CASE, TURN LOCK, DOUBLE-CLICK & TIES
// ============================================================================

test('E05 Teams mode acceptance case: Team A picks star 4, A & B right, C wrong -> map +1 star once, A=1, B=1 (Đồng hạng), C=0, turn rotates to B', () => {
  const cfg = {
    ...createDefaultStarHuntConfig('teams'),
    teams: createStarTeams(3, ['Đội A', 'Đội B', 'Đội C']),
    shuffleOptions: false,
  };
  let state = createInitialStarHuntState({
    config: cfg,
    pool: buildE05QuestionPool({ sourceKind: 'sample' }),
  });

  // Initial picking team is Team A
  assert.equal(getCurrentPickingTeam(state)?.name, 'Đội A');

  // Team A picks star #4 (free order!)
  const open4 = openStarOnMap(state, 'star_4');
  assert.equal(open4.opened, true);
  state = open4.state;
  assert.equal(getStarNodeStatus(state, 'star_4'), 'active');

  // Opening another star while star_4 is active MUST be locked
  const openOther = openStarOnMap(state, 'star_1');
  assert.equal(openOther.opened, false);
  assert.equal(openOther.reason, 'star_already_active');

  const star4 = state.stars.find((s) => s.id === 'star_4')!;
  const rightLabel = getCorrectOptionLabelForStarQuestion(star4.question);
  const wrongLabel = rightLabel === 'A' ? 'B' : 'A';

  // Rejects unrecorded team (strictly distinct from 'no_answer')
  const blocked = commitStarTurn(state, {
    starId: 'star_4',
    teamChoices: {
      star_team_1: rightLabel,
      star_team_2: 'unrecorded',
      star_team_3: wrongLabel,
    },
  });
  assert.equal(blocked.committed, false);
  assert.equal(blocked.reason, 'unrecorded_team');

  // Commit: A & B right, C wrong
  const c4 = commitStarTurn(state, {
    starId: 'star_4',
    teamChoices: {
      star_team_1: rightLabel,
      star_team_2: rightLabel,
      star_team_3: wrongLabel,
    },
  });
  assert.equal(c4.committed, true);
  assert.equal(c4.record?.mapStarLit, true);
  state = c4.state;

  // Duplicate commit (double-click) MUST be rejected
  const dup = commitStarTurn(state, {
    starId: 'star_4',
    teamChoices: {
      star_team_1: rightLabel,
      star_team_2: rightLabel,
      star_team_3: wrongLabel,
    },
  });
  assert.equal(dup.committed, false);
  assert.equal(dup.reason, 'duplicate_star_commit');

  // Return to map -> star_4 is lit ONCE, A=1, B=1 (Đồng hạng), C=0, picking turn rotates to Team B!
  state = returnToStarMap(state);
  assert.equal(getStarNodeStatus(state, 'star_4'), 'lit');
  assert.equal(computeMapLitStarCount(state), 1); // Lit ONCE even though 2 teams got it right!
  assert.equal(getCurrentPickingTeam(state)?.name, 'Đội B');

  const standings = computeStarStandings(state);
  assert.equal(standings[0].name, 'Đội A');
  assert.equal(standings[0].stars, 1);
  assert.equal(standings[0].rank, 1);
  assert.equal(standings[0].isTied, true);
  assert.equal(standings[1].name, 'Đội B');
  assert.equal(standings[1].stars, 1);
  assert.equal(standings[1].rank, 1);
  assert.equal(standings[1].isTied, true);
  assert.equal(standings[2].name, 'Đội C');
  assert.equal(standings[2].stars, 0);
  assert.equal(standings[2].rank, 3);
  assert.equal(standings[2].isTied, false);

  // Team B picks star #5, ALL teams wrong / no_answer -> star_5 becomes 'solution_viewed', map stays at 1
  state = openStarOnMap(state, 'star_5').state;
  const star5 = state.stars.find((s) => s.id === 'star_5')!;
  const wrong5 = getCorrectOptionLabelForStarQuestion(star5.question) === 'A' ? 'B' : 'A';
  state = commitStarTurn(state, {
    starId: 'star_5',
    teamChoices: {
      star_team_1: wrong5,
      star_team_2: 'no_answer',
      star_team_3: wrong5,
    },
  }).state;
  state = returnToStarMap(state);
  assert.equal(getStarNodeStatus(state, 'star_5'), 'solution_viewed');
  assert.equal(computeMapLitStarCount(state), 1);
  assert.equal(getCurrentPickingTeam(state)?.name, 'Đội C');

  // Cannot re-open already played star as a new turn
  const reopen = openStarOnMap(state, 'star_5');
  assert.equal(reopen.opened, false);
  assert.equal(reopen.reason, 'star_already_played');
});

// ============================================================================
// 3. CONSTELLATION COMPLETION & EDIT-LAST-TURN RECOMPUTATION
// ============================================================================

test('E05 Lighting all 3 stars in Cluster 1 completes constellation, and editLastStarTurn cleanly reverses constellation & team stars', () => {
  const cfg = {
    ...createDefaultStarHuntConfig('teams'),
    teams: createStarTeams(2, ['Đội 1', 'Đội 2']),
    shuffleOptions: false,
  };
  let state = createInitialStarHuntState({
    config: cfg,
    pool: buildE05QuestionPool({ sourceKind: 'sample' }),
  });

  // Light stars 1, 2, 3 (Cluster 1)
  for (const starId of ['star_1', 'star_2', 'star_3']) {
    state = openStarOnMap(state, starId).state;
    const star = state.stars.find((s) => s.id === starId)!;
    const right = getCorrectOptionLabelForStarQuestion(star.question);
    const wrong = right === 'A' ? 'B' : 'A';
    const res = commitStarTurn(state, {
      starId,
      teamChoices: {
        star_team_1: right,
        star_team_2: wrong,
      },
    });
    assert.equal(res.committed, true);
    if (starId === 'star_3') {
      assert.equal(res.newlyCompletedClusterId, 1);
    }
    state = returnToStarMap(res.state);
  }

  assert.equal(computeMapLitStarCount(state), 3);
  assert.equal(computeClusterProgress(state)[0].isComplete, true);
  assert.equal(computeStarStandings(state)[0].stars, 3);

  // Edit star_3 (last committed turn) so BOTH teams missed -> Cluster 1 constellation turns OFF, map stars -> 2, Team 1 -> 2
  const star3 = state.stars.find((s) => s.id === 'star_3')!;
  const wrong3 = getCorrectOptionLabelForStarQuestion(star3.question) === 'A' ? 'B' : 'A';
  const edited = editLastStarTurn(state, {
    teamChoices: {
      star_team_1: wrong3,
      star_team_2: 'no_answer',
    },
  });
  assert.equal(edited.edited, true);
  state = edited.state;

  assert.equal(getStarNodeStatus(state, 'star_3'), 'solution_viewed');
  assert.equal(computeMapLitStarCount(state), 2);
  assert.equal(computeClusterProgress(state)[0].isComplete, false);
  assert.equal(computeStarStandings(state)[0].stars, 2);
});

// ============================================================================
// 4. SOLO / WHOLE-CLASS COOPERATIVE + SEPARATE "ÔN LẠI CÂU CHƯA ĐÚNG"
// ============================================================================

test('E05 Solo & Whole-Class record post-session review practice separately without mutating main-play star count', () => {
  const cfg = {
    ...createDefaultStarHuntConfig('whole_class'),
    shuffleOptions: false,
  };
  let state = createInitialStarHuntState({
    config: cfg,
    pool: buildE05QuestionPool({ sourceKind: 'sample' }),
  });

  // Play all 9 stars: miss star_2 and star_6, light the other 7
  for (const star of state.stars) {
    state = openStarOnMap(state, star.id).state;
    const right = getCorrectOptionLabelForStarQuestion(star.question);
    const wrong = right === 'A' ? 'B' : 'A';
    const choice = star.id === 'star_2' || star.id === 'star_6' ? wrong : right;
    const res = commitStarTurn(state, { starId: star.id, singleChoice: choice });
    assert.equal(res.committed, true);
    state = returnToStarMap(res.state);
  }

  assert.equal(state.status, 'finished');
  assert.equal(computeMapLitStarCount(state), 7);
  assert.equal(computeStarStandings(state)[0].stars, 7);

  const missed = getMissedStarsForReview(state);
  assert.equal(missed.length, 2);
  assert.deepEqual(
    missed.map((s) => s.id),
    ['star_2', 'star_6']
  );

  // Answer both missed stars correctly in Review Practice
  for (const s of missed) {
    const right = getCorrectOptionLabelForStarQuestion(s.question);
    state = recordStarReviewAttempt(state, s.id, right);
  }

  assert.equal(state.reviewPractice.star_2?.isCorrect, true);
  assert.equal(state.reviewPractice.star_6?.isCorrect, true);
  // CRITICAL: Main-play star count and map lit count MUST remain 7!
  assert.equal(computeMapLitStarCount(state), 7);
  assert.equal(computeStarStandings(state)[0].stars, 7);
});

// ============================================================================
// 5. RBAC BANK ADAPTER & NO-REPEAT REDUCED STAR COUNT
// ============================================================================

test('E05 Bank adapter enforces RBAC, deduplicates, and reduces star count cleanly without repeating questions', () => {
  const mockBank: Question[] = [
    {
      id: 'q_app_1',
      code: 'M1',
      subject: 'math',
      grade: '6',
      textbook: 'Kết nối tri thức',
      chapter: 'Đại số',
      lesson: 'Bài 1',
      level: 'know',
      points: 1,
      author: 'GV',
      version: 1,
      type: 'single_choice',
      stem: 'Câu ngân hàng 1',
      options: [
        { id: 'o1', label: 'A', text: '1' },
        { id: 'o2', label: 'B', text: '2' },
        { id: 'o3', label: 'C', text: '3' },
        { id: 'o4', label: 'D', text: '4' },
      ],
      correctAnswer: 'o2',
      explanation: 'Đáp án 2',
      status: 'approved',
    },
    {
      id: 'q_pend_1',
      code: 'M2',
      subject: 'math',
      grade: '6',
      textbook: 'Kết nối tri thức',
      chapter: 'Hình học',
      lesson: 'Bài 2',
      level: 'know',
      points: 1,
      author: 'GV',
      version: 1,
      type: 'single_choice',
      stem: 'Câu chờ duyệt',
      options: [
        { id: 'p1', label: 'A', text: 'A1' },
        { id: 'p2', label: 'B', text: 'B1' },
        { id: 'p3', label: 'C', text: 'C1' },
        { id: 'p4', label: 'D', text: 'D1' },
      ],
      correctAnswer: 'A',
      explanation: '',
      status: 'pending',
    },
    {
      id: 'q_dep_1',
      code: 'M3',
      subject: 'math',
      grade: '6',
      textbook: 'Kết nối tri thức',
      chapter: 'Cũ',
      lesson: 'Bài 3',
      level: 'know',
      points: 1,
      author: 'GV',
      version: 1,
      type: 'single_choice',
      stem: 'Câu đã loại bỏ',
      options: [
        { id: 'd1', label: 'A', text: 'X' },
        { id: 'd2', label: 'B', text: 'Y' },
        { id: 'd3', label: 'C', text: 'Z' },
        { id: 'd4', label: 'D', text: 'W' },
      ],
      correctAnswer: 'A',
      explanation: '',
      status: 'deprecated',
    },
  ];

  const studentPool = buildE05QuestionPool({
    sourceKind: 'bank',
    bankQuestions: mockBank,
    userRole: 'student',
  });
  assert.equal(studentPool.length, 1);
  assert.equal(studentPool[0].id, 'q_app_1');

  const teacherPool = buildE05QuestionPool({
    sourceKind: 'bank',
    bankQuestions: mockBank,
    userRole: 'teacher',
  });
  assert.equal(teacherPool.length, 2);

  // Requested 9 stars with only 2 available -> warns and creates strictly 2 unique stars (never repeats!)
  const cfg = {
    ...createDefaultStarHuntConfig('solo_practice'),
    sourceKind: 'bank' as const,
    starCount: 9,
  };
  const val = validateStarSetupConfig(cfg, teacherPool.length);
  assert.equal(val.valid, true);
  assert.equal(val.effectiveStarCount, 2);
  assert.ok(val.warnings.length > 0);

  const st = createInitialStarHuntState({ config: cfg, pool: teacherPool });
  assert.equal(st.stars.length, 2);
  assert.notEqual(st.stars[0].question.id, st.stars[1].question.id);
});

// ============================================================================
// 6. PERSISTENCE, /DEMO ISOLATION & CORRUPT STORAGE AUTO-RECOVERY
// ============================================================================

test('E05 Persistence saves/restores star map, picking turn & results, isolates /demo, and recovers from corrupt JSON', () => {
  const storage = createMemoryStorage();
  const prevWindow = (globalThis as any).window;

  try {
    (globalThis as any).window = {
      location: { pathname: '/' },
      localStorage: storage,
    };
    assert.equal(getE05SessionStorageKey(), E05_SESSION_STORAGE_KEY);

    const cfg = {
      ...createDefaultStarHuntConfig('teams'),
      teams: createStarTeams(3, ['Đội 1', 'Đội 2', 'Đội 3']),
      shuffleOptions: false,
    };
    let st = createInitialStarHuntState({
      config: cfg,
      pool: buildE05QuestionPool({ sourceKind: 'sample' }),
    });
    st = openStarOnMap(st, 'star_6').state;
    const right6 = getCorrectOptionLabelForStarQuestion(
      st.stars.find((s) => s.id === 'star_6')!.question
    );
    st = commitStarTurn(st, {
      starId: 'star_6',
      teamChoices: {
        star_team_1: right6,
        star_team_2: 'no_answer',
        star_team_3: right6,
      },
    }).state;
    st = returnToStarMap(st);
    saveE05Session(st);

    const restored = loadE05Session();
    assert.equal(restored.recoveredFromCorruption, false);
    assert.equal(restored.state?.history.length, 1);
    assert.equal(restored.state?.history[0].starId, 'star_6');
    assert.equal(getCurrentPickingTeam(restored.state!)?.name, 'Đội 2');

    // Switch to /demo -> isolated key
    (globalThis as any).window = {
      location: { pathname: '/demo' },
      localStorage: storage,
    };
    assert.equal(
      getE05SessionStorageKey(),
      `${KHKT_DEMO_STORAGE_PREFIX}${E05_SESSION_STORAGE_KEY}`
    );
    assert.equal(loadE05Session().state, null);

    // Corrupt JSON on /demo -> auto-cleared and recovered
    storage.setItem(getE05SessionStorageKey(), '{bad-json');
    const rec = loadE05Session();
    assert.equal(rec.state, null);
    assert.equal(rec.recoveredFromCorruption, true);
    assert.equal(storage.getItem(getE05SessionStorageKey()), null);

    // Normal storage unaffected
    (globalThis as any).window = {
      location: { pathname: '/' },
      localStorage: storage,
    };
    assert.equal(loadE05Session().state?.history.length, 1);
    clearE05Session();
    assert.equal(loadE05Session().state, null);
  } finally {
    if (prevWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = prevWindow;
    }
  }
});

// ============================================================================
// 7. E05 AUDIO CUES IN HEADLESS / MUTED ENVIRONMENTS
// ============================================================================

test('E05 EduGameSoundBank star cues execute safely in headless/muted environments and honor turn tokens', () => {
  const bank = new EduGameSoundBank();
  const token = 'e05_star_1';
  bank.setActiveTurnToken(token);

  assert.doesNotThrow(() => {
    bank.playStarSelectCue(true, token);
    bank.playStarSelectCue(false, token);
    bank.playStarLitCue(true, token);
    bank.playStarLitCue(false, token);
    bank.playStarMissCue(true, token);
    bank.playStarMissCue(false, token);
    bank.playConstellationCompleteCue(true, token);
    bank.playConstellationCompleteCue(false, token);
    bank.playStarSessionSummary(true, token);
    bank.playStarSessionSummary(false, token);
    bank.stopAll();
    bank.setActiveTurnToken('e05_star_2');
    bank.playStarLitCue(false, token);
    bank.dispose();
  });
});
