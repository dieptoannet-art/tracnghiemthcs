import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  D05_SAMPLE_BADGE,
  D05_SAMPLE_PACK_TITLE,
  D05_SAMPLE_QUESTIONS,
  D05_SESSION_STORAGE_KEY,
  POINTS_PER_CORRECT,
  advanceRelayToNextQuestion,
  buildD05QuestionPool,
  clearD05Session,
  commitRelayTurnResult,
  computeRelayStandings,
  createDefaultRelayConfig,
  createInitialRelayMatchState,
  distributeRosterIntoTeams,
  editLastConfirmedRelayTurn,
  endRelayMatchEarly,
  evaluateRelaySoloAnswer,
  getActiveMember,
  getD05SessionStorageKey,
  getNextMember,
  loadD05Session,
  prepareRelayQuestions,
  saveD05Session,
  shuffleRelayOptionsPreservingId,
  skipAbsentRunnerBeforeTurn,
  validateRelaySetupConfig,
} from './relayTeam3dEngine';
import { renderMathToHtml } from '../../MathView';
import { EduGameSoundBank } from '../../../utils/eduGameAudioController';
import { KHKT_DEMO_STORAGE_PREFIX } from '../../../utils/khktDemoSandbox';
import { Question } from '../../../types';

function createMemoryWindow(pathname = '/') {
  const store = new Map<string, string>();
  const mockWindow = {
    location: { pathname },
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => store.clear(),
    },
  };
  return { mockWindow, store };
}

describe('D05 — Tiếp sức đồng đội 3D: Core Relay Engine', () => {
  it('verifies the exact acceptance walkthrough: Team Blue [An, Bình, Chi] across Q1–Q3 wraps baton back to An for Q4', () => {
    const config = createDefaultRelayConfig('team_relay');
    config.teams = [
      {
        id: 'team_blue',
        name: 'Đội Xanh Dương',
        paletteIndex: 0,
        members: [
          { id: 'm_an', name: 'An' },
          { id: 'm_binh', name: 'Bình' },
          { id: 'm_chi', name: 'Chi' },
        ],
      },
      {
        id: 'team_orange',
        name: 'Đội Cam Rực',
        paletteIndex: 1,
        members: [
          { id: 'm_dung', name: 'Dũng' },
          { id: 'm_ha', name: 'Hà' },
          { id: 'm_khanh', name: 'Khánh' },
        ],
      },
    ];
    config.questionCount = 5;
    config.shuffleQuestions = false;
    config.shuffleOptions = false;

    const questions = prepareRelayQuestions(D05_SAMPLE_QUESTIONS, config);
    let state = createInitialRelayMatchState(config, questions);

    // Before Q1: An holds baton
    assert.equal(getActiveMember(state.teamRuntime.team_blue).name, 'An');
    assert.equal(getNextMember(state.teamRuntime.team_blue).name, 'Bình');

    // Q1: An answers correctly (+10)
    const r1 = commitRelayTurnResult(state, {
      question: questions[0],
      verdictsByTeam: { team_blue: 'correct', team_orange: 'incorrect' },
      resultSource: 'teacher_single_device',
    });
    assert.equal(r1.committed, true);
    state = advanceRelayToNextQuestion(r1.state);
    assert.equal(state.teamRuntime.team_blue.score, 10);
    assert.equal(state.teamRuntime.team_blue.turnsCompleted, 1);
    assert.equal(getActiveMember(state.teamRuntime.team_blue).name, 'Bình');

    // Q2: Bình answers incorrectly (0 points, baton still advances to Chi!)
    const r2 = commitRelayTurnResult(state, {
      question: questions[1],
      verdictsByTeam: { team_blue: 'incorrect', team_orange: 'correct' },
      resultSource: 'teacher_single_device',
    });
    assert.equal(r2.committed, true);
    state = advanceRelayToNextQuestion(r2.state);
    assert.equal(state.teamRuntime.team_blue.score, 10);
    assert.equal(state.teamRuntime.team_blue.turnsCompleted, 2);
    assert.equal(getActiveMember(state.teamRuntime.team_blue).name, 'Chi');

    // Q3: Chi answers correctly (+10) -> total 20 điểm, 3 lượt đã hoàn thành, baton wraps to An for Q4!
    const r3 = commitRelayTurnResult(state, {
      question: questions[2],
      verdictsByTeam: { team_blue: 'correct', team_orange: 'no_answer' },
      resultSource: 'teacher_single_device',
    });
    assert.equal(r3.committed, true);
    state = advanceRelayToNextQuestion(r3.state);

    assert.equal(state.teamRuntime.team_blue.score, 20);
    assert.equal(state.teamRuntime.team_blue.correctCount, 2);
    assert.equal(state.teamRuntime.team_blue.turnsCompleted, 3);
    assert.equal(state.currentQuestionIndex, 3);
    assert.equal(getActiveMember(state.teamRuntime.team_blue).name, 'An');
    assert.equal(getNextMember(state.teamRuntime.team_blue).name, 'Bình');
  });

  it('supports solo_practice mode (1 student consecutive questions, auto-grading + teacher-graded essay)', () => {
    const config = createDefaultRelayConfig('solo_practice', ['Nguyễn Minh Anh']);
    config.questionCount = 3;
    config.shuffleQuestions = false;
    config.shuffleOptions = false;

    const validation = validateRelaySetupConfig(config, D05_SAMPLE_QUESTIONS.length);
    assert.equal(validation.valid, true);
    assert.equal(config.teams.length, 1);

    const questions = prepareRelayQuestions(D05_SAMPLE_QUESTIONS, config);
    let state = createInitialRelayMatchState(config, questions);

    // Auto-evaluate single choice Q1 (correct option)
    const eval1 = evaluateRelaySoloAnswer(questions[0], {
      selectedOptionId: questions[0].correctOptionId,
    });
    assert.equal(eval1.isCorrect, true);

    const c1 = commitRelayTurnResult(state, {
      question: questions[0],
      verdictsByTeam: { team_solo: eval1.isCorrect ? 'correct' : 'incorrect' },
      answerNotesByTeam: { team_solo: eval1.answerNote },
      resultSource: 'student_auto',
    });
    assert.equal(c1.committed, true);
    state = advanceRelayToNextQuestion(c1.state);
    assert.equal(state.teamRuntime.team_solo.score, POINTS_PER_CORRECT);
    assert.equal(getActiveMember(state.teamRuntime.team_solo).name, 'Nguyễn Minh Anh');

    // Auto-evaluate single choice Q2 (wrong distractor -9)
    const eval2 = evaluateRelaySoloAnswer(questions[1], {
      selectedOptionId: 'd05_s02_a',
    });
    assert.equal(eval2.isCorrect, false);

    // Check essay question requires teacher grading
    const bankEssay: Question = {
      id: 'q_essay_1',
      code: 'TL-01',
      type: 'essay',
      stem: 'Giải thích vì sao \\((-3)^2 = 9\\) còn \\(-3^2 = -9\\).',
      subject: 'math',
      grade: '6',
      textbook: 'Kết nối tri thức',
      chapter: 'Chương I',
      lesson: 'Lũy thừa',
      level: 'understand',
      points: 1,
      status: 'approved',
      author: 'GV Toán',
      version: 1,
      sampleAnswer: 'Do có hoặc không có ngoặc.',
      explanation: 'Dấu ngoặc xác định cơ số.',
    };
    const pool = buildD05QuestionPool({
      sourceKind: 'bank',
      bankQuestions: [bankEssay],
      userRole: 'teacher',
    });
    assert.equal(pool.length, 1);
    assert.equal(pool[0].requiresTeacherGrading, true);
  });

  it('handles 2 unequal teams (3 vs 5) with equal scoring opportunities and warns when questionCount < maxTeamSize without repeating questions', () => {
    const config = createDefaultRelayConfig('team_relay');
    config.teams = [
      {
        id: 't1',
        name: 'Đội A',
        paletteIndex: 0,
        members: [
          { id: 'a1', name: 'A1' },
          { id: 'a2', name: 'A2' },
          { id: 'a3', name: 'A3' },
        ],
      },
      {
        id: 't2',
        name: 'Đội B',
        paletteIndex: 1,
        members: [
          { id: 'b1', name: 'B1' },
          { id: 'b2', name: 'B2' },
          { id: 'b3', name: 'B3' },
          { id: 'b4', name: 'B4' },
          { id: 'b5', name: 'B5' },
        ],
      },
    ];
    config.questionCount = 4; // Less than maxTeamSize (5)

    const validation = validateRelaySetupConfig(config, D05_SAMPLE_QUESTIONS.length);
    assert.equal(validation.valid, true);
    assert.equal(validation.maxTeamSize, 5);
    assert.ok(
      validation.warnings.some((w) => w.includes('ít hơn sĩ số đội đông nhất')),
      'Expected warning when questionCount < maxTeamSize'
    );

    // Requesting more questions than available never repeats questions
    config.questionCount = 25;
    const valOver = validateRelaySetupConfig(config, D05_SAMPLE_QUESTIONS.length);
    assert.equal(valOver.effectiveQuestionCount, D05_SAMPLE_QUESTIONS.length);
    const prepared = prepareRelayQuestions(D05_SAMPLE_QUESTIONS, config);
    assert.equal(prepared.length, D05_SAMPLE_QUESTIONS.length);
    assert.equal(new Set(prepared.map((q) => q.id)).size, prepared.length);

    // Play 4 turns: both teams always have equal turnsCompleted (equal scoring opportunities)
    let state = createInitialRelayMatchState(config, prepared.slice(0, 4));
    for (let i = 0; i < 4; i++) {
      const res = commitRelayTurnResult(state, {
        question: state.questionOrder[i],
        verdictsByTeam: { t1: 'correct', t2: 'correct' },
        resultSource: 'teacher_single_device',
      });
      state = advanceRelayToNextQuestion(res.state);
    }
    assert.equal(state.status, 'finished');
    assert.equal(state.teamRuntime.t1.turnsCompleted, 4);
    assert.equal(state.teamRuntime.t2.turnsCompleted, 4);
    assert.equal(state.teamRuntime.t1.score, 40);
    assert.equal(state.teamRuntime.t2.score, 40);
    // Team 1 wrapped (4 % 3 = 1 -> A2), Team 2 at index 4 (B5)
    assert.equal(getActiveMember(state.teamRuntime.t1).name, 'A2');
    assert.equal(getActiveMember(state.teamRuntime.t2).name, 'B5');
  });

  it('distributes 50 students across 6 teams evenly (9/9/8/8/8/8) and rotates smoothly', () => {
    const names = Array.from({ length: 50 }, (_, i) => `Học sinh ${i + 1}`);
    const teams = distributeRosterIntoTeams(names, 6);
    assert.equal(teams.length, 6);
    assert.deepEqual(
      teams.map((t) => t.members.length),
      [9, 9, 8, 8, 8, 8]
    );
    const total = teams.reduce((sum, t) => sum + t.members.length, 0);
    assert.equal(total, 50);

    const config = createDefaultRelayConfig('team_relay');
    config.teams = teams;
    config.questionCount = 10;
    const questions = prepareRelayQuestions(D05_SAMPLE_QUESTIONS, config);
    let state = createInitialRelayMatchState(config, questions);

    const verdicts: Record<string, 'correct' | 'incorrect' | 'no_answer'> = {};
    teams.forEach((t, idx) => {
      verdicts[t.id] = idx % 3 === 0 ? 'correct' : idx % 3 === 1 ? 'incorrect' : 'no_answer';
    });

    const c1 = commitRelayTurnResult(state, {
      question: questions[0],
      verdictsByTeam: verdicts,
      resultSource: 'teacher_single_device',
    });
    assert.equal(c1.committed, true);
    state = c1.state;
    // Every single team rotated to member index 1 regardless of correct/incorrect/no_answer
    teams.forEach((t) => {
      assert.equal(state.teamRuntime[t.id].currentMemberIndex, 1);
      assert.equal(state.teamRuntime[t.id].turnsCompleted, 1);
    });
  });

  it('skips an absent runner BEFORE opening the question without marking them wrong or changing score', () => {
    const config = createDefaultRelayConfig('team_relay');
    config.teams = [
      {
        id: 't1',
        name: 'Đội Xanh',
        paletteIndex: 0,
        members: [
          { id: 'm1', name: 'An' },
          { id: 'm2', name: 'Bình' },
          { id: 'm3', name: 'Chi' },
        ],
      },
      {
        id: 't2',
        name: 'Đội Cam',
        paletteIndex: 1,
        members: [
          { id: 'm4', name: 'Dũng' },
          { id: 'm5', name: 'Hà' },
        ],
      },
    ];
    const questions = prepareRelayQuestions(D05_SAMPLE_QUESTIONS, config);
    const initial = createInitialRelayMatchState(config, questions);

    const skipped = skipAbsentRunnerBeforeTurn(initial, 't1');
    assert.equal(skipped.skippedMember?.name, 'An');
    assert.equal(skipped.replacementMember?.name, 'Bình');
    assert.equal(getActiveMember(skipped.state.teamRuntime.t1).name, 'Bình');
    assert.equal(skipped.state.teamRuntime.t1.score, 0);
    assert.equal(skipped.state.teamRuntime.t1.turnsCompleted, 0);
    assert.equal(skipped.state.teamRuntime.t1.absentSkipCount, 1);
    assert.equal(skipped.state.history.length, 0);
    assert.equal(skipped.state.absentSkipLogs.length, 1);
    assert.equal(skipped.state.absentSkipLogs[0].memberName, 'An');
    // Other team unaffected
    assert.equal(getActiveMember(skipped.state.teamRuntime.t2).name, 'Dũng');
  });

  it('edits the last confirmed turn: recomputes scores cleanly and preserves EXACTLY ONE baton pass', () => {
    const config = createDefaultRelayConfig('team_relay');
    config.teams = [
      {
        id: 't1',
        name: 'Đội 1',
        paletteIndex: 0,
        members: [
          { id: 'a', name: 'An' },
          { id: 'b', name: 'Bình' },
          { id: 'c', name: 'Chi' },
        ],
      },
      {
        id: 't2',
        name: 'Đội 2',
        paletteIndex: 1,
        members: [
          { id: 'd', name: 'Dũng' },
          { id: 'e', name: 'Em' },
          { id: 'f', name: 'Phong' },
        ],
      },
    ];
    const questions = prepareRelayQuestions(D05_SAMPLE_QUESTIONS, config);
    const initial = createInitialRelayMatchState(config, questions);

    // Commit Q1: t1 incorrect, t2 correct -> baton moves from idx 0 to idx 1
    const c1 = commitRelayTurnResult(initial, {
      question: questions[0],
      verdictsByTeam: { t1: 'incorrect', t2: 'correct' },
      resultSource: 'teacher_single_device',
    });
    assert.equal(c1.state.teamRuntime.t1.score, 0);
    assert.equal(c1.state.teamRuntime.t2.score, 10);
    assert.equal(c1.state.teamRuntime.t1.currentMemberIndex, 1);
    assert.equal(c1.state.teamRuntime.t2.currentMemberIndex, 1);

    // Teacher fixes Q1 result: t1 was actually correct, t2 was no_answer
    const edited = editLastConfirmedRelayTurn(c1.state, {
      t1: 'correct',
      t2: 'no_answer',
    });
    assert.equal(edited.edited, true);
    assert.equal(edited.state.teamRuntime.t1.score, 10);
    assert.equal(edited.state.teamRuntime.t1.correctCount, 1);
    assert.equal(edited.state.teamRuntime.t2.score, 0);
    assert.equal(edited.state.teamRuntime.t2.correctCount, 0);
    // CRITICAL: turnsCompleted remains 1 and currentMemberIndex remains 1 (no second baton pass!)
    assert.equal(edited.state.teamRuntime.t1.turnsCompleted, 1);
    assert.equal(edited.state.teamRuntime.t2.turnsCompleted, 1);
    assert.equal(edited.state.teamRuntime.t1.currentMemberIndex, 1);
    assert.equal(edited.state.teamRuntime.t2.currentMemberIndex, 1);
    assert.equal(edited.state.history[0].wasEdited, true);
  });

  it('prevents double-click duplicate commits and blocks ungraded teams', () => {
    const config = createDefaultRelayConfig('team_relay');
    const questions = prepareRelayQuestions(D05_SAMPLE_QUESTIONS, config);
    const initial = createInitialRelayMatchState(config, questions);
    const [t1, t2] = config.teams;

    // Ungraded team rejected
    const bad = commitRelayTurnResult(initial, {
      question: questions[0],
      verdictsByTeam: { [t1.id]: 'correct', [t2.id]: 'ungraded' },
      resultSource: 'teacher_single_device',
    });
    assert.equal(bad.committed, false);
    assert.equal(bad.reason, 'ungraded_team');

    // First commit succeeds
    const first = commitRelayTurnResult(initial, {
      question: questions[0],
      verdictsByTeam: { [t1.id]: 'correct', [t2.id]: 'incorrect' },
      resultSource: 'teacher_single_device',
    });
    assert.equal(first.committed, true);

    // Duplicate click on same questionId is rejected cleanly
    const dup = commitRelayTurnResult(first.state, {
      question: questions[0],
      verdictsByTeam: { [t1.id]: 'correct', [t2.id]: 'correct' },
      resultSource: 'teacher_single_device',
    });
    assert.equal(dup.committed, false);
    assert.equal(dup.reason, 'duplicate_question_commit');
    assert.equal(dup.state.teamRuntime[t1.id].score, 10);
    assert.equal(dup.state.teamRuntime[t1.id].currentMemberIndex, 1);
  });

  it('computes tie-aware standings strictly by total score (1, 1, 3) with isTied flags', () => {
    const config = createDefaultRelayConfig('team_relay');
    config.teams = distributeRosterIntoTeams(
      ['A1', 'B1', 'C1', 'A2', 'B2', 'C2'],
      3,
      ['Đội Xanh', 'Đội Cam', 'Đội Ngọc']
    );
    const questions = prepareRelayQuestions(D05_SAMPLE_QUESTIONS, config);
    let state = createInitialRelayMatchState(config, questions.slice(0, 2));

    const c1 = commitRelayTurnResult(state, {
      question: questions[0],
      verdictsByTeam: { team_1: 'correct', team_2: 'correct', team_3: 'incorrect' },
      resultSource: 'teacher_single_device',
    });
    state = endRelayMatchEarly(c1.state);

    const standings = computeRelayStandings(state);
    assert.equal(standings.length, 3);
    assert.equal(standings[0].rank, 1);
    assert.equal(standings[0].isTied, true);
    assert.equal(standings[1].rank, 1);
    assert.equal(standings[1].isTied, true);
    assert.equal(standings[2].rank, 3);
    assert.equal(standings[2].isTied, false);
    assert.equal(standings[2].score, 0);
  });
});

describe('D05 — Math KaTeX Rendering, Sample Pack & Question Bank RBAC', () => {
  it('includes the 10-question Math sample pack tagged "Dữ liệu mẫu" with all 5 mandatory prompt cases', () => {
    assert.equal(D05_SAMPLE_PACK_TITLE, 'Tiếp sức Toán THCS');
    assert.equal(D05_SAMPLE_BADGE, 'Dữ liệu mẫu');
    assert.equal(D05_SAMPLE_QUESTIONS.length, 10);

    for (const q of D05_SAMPLE_QUESTIONS) {
      assert.equal(q.isSample, true);
      assert.equal(q.sourceBadge, 'Dữ liệu mẫu');
      assert.ok(q.officialAnswerText.length > 0);
      assert.ok(q.explanation.length > 0);
    }

    // Verify all 5 mandatory prompt cases exist
    assert.ok(D05_SAMPLE_QUESTIONS[0].stem.includes('\\frac{3}{4} - \\frac{1}{2}'));
    assert.ok(D05_SAMPLE_QUESTIONS[1].stem.includes('(-3)^2'));
    assert.ok(D05_SAMPLE_QUESTIONS[1].options?.some((o) => o.text.includes('-9')));
    assert.ok(D05_SAMPLE_QUESTIONS[2].stem.includes('\\sqrt{(-5)^2}'));
    assert.ok(D05_SAMPLE_QUESTIONS[3].stem.includes('2x + 3 = 11'));
    assert.ok(D05_SAMPLE_QUESTIONS[4].stem.includes('xúc xắc'));
    assert.ok(D05_SAMPLE_QUESTIONS[4].officialAnswerText.includes('\\frac{3}{6} = \\frac{1}{2}'));
  });

  it('renders inline \\(...\\), display \\[...\\], legacy $...$, fractions, roots, angles, units, and gracefully falls back on malformed LaTeX', () => {
    const cases = [
      '\\(\\frac{3}{4} - \\frac{1}{2}\\)',
      '\\((-3)^2 = 9\\)',
      '\\(\\sqrt{(-5)^2} = 5\\)',
      '\\(2x + 3 = 11\\)',
      '\\(2{,}5 \\times 4 - 1{,}5\\)',
      '\\(\\widehat{A} = 65^\\circ\\)',
      '\\(49\\text{ cm}^2\\)',
      '\\[A = \\frac{2^3 + 4}{3} - (-2)\\]',
      'Legacy inline $x^2 - 1 = 0$ and display $$\\frac{1}{2}$$',
    ];

    for (const expr of cases) {
      const html = renderMathToHtml(expr);
      assert.ok(html.includes('katex'), `Expected KaTeX markup for: ${expr}`);
      assert.ok(!html.includes('katex-error'), `Unexpected KaTeX error class for: ${expr}`);
    }

    // Malformed LaTeX must NOT throw and must safely escape raw text
    const broken = 'Biểu thức lỗi \\(\\frac{1}{\\) và <script>alert(1)</script>';
    const fallbackHtml = renderMathToHtml(broken);
    assert.ok(fallbackHtml.includes('\\frac{1}{'));
    assert.ok(!fallbackHtml.includes('<script>'));
    assert.ok(fallbackHtml.includes('&lt;script&gt;'));
  });

  it('preserves stable option IDs when shuffling options and enforces RBAC question visibility', () => {
    const q = D05_SAMPLE_QUESTIONS[0];
    let seed = 42;
    const deterministicRng = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const shuffled = shuffleRelayOptionsPreservingId(q, deterministicRng);
    assert.equal(shuffled.correctOptionId, q.correctOptionId);
    const correctOpt = shuffled.options?.find((o) => o.id === shuffled.correctOptionId);
    assert.ok(correctOpt);
    assert.equal(correctOpt.text, '\\(\\frac{1}{4}\\)');

    const bank: Question[] = [
      {
        id: 'b_approved',
        code: 'M1',
        type: 'single_choice',
        stem: 'Câu đã duyệt \\(1+1\\)',
        subject: 'math',
        grade: '6',
        textbook: 'Kết nối tri thức',
        chapter: 'Chương I',
        lesson: 'Bài 1',
        level: 'know',
        points: 1,
        explanation: '1 + 1 = 2',
        status: 'approved',
        author: 'GV Toán',
        version: 1,
        options: [
          { id: 'o1', label: 'A', text: '2' },
          { id: 'o2', label: 'B', text: '3' },
        ],
        correctAnswer: 'A',
      },
      {
        id: 'b_pending',
        code: 'M2',
        type: 'single_choice',
        stem: 'Câu chờ duyệt \\(2+2\\)',
        subject: 'math',
        grade: '6',
        textbook: 'Kết nối tri thức',
        chapter: 'Chương I',
        lesson: 'Bài 1',
        level: 'know',
        points: 1,
        explanation: '2 + 2 = 4',
        status: 'pending',
        author: 'GV Toán',
        version: 1,
        options: [
          { id: 'o3', label: 'A', text: '4' },
          { id: 'o4', label: 'B', text: '5' },
        ],
        correctAnswer: 'A',
      },
      {
        id: 'b_deprecated',
        code: 'M3',
        type: 'single_choice',
        stem: 'Câu đã ẩn \\(3+3\\)',
        subject: 'math',
        grade: '6',
        textbook: 'Kết nối tri thức',
        chapter: 'Chương I',
        lesson: 'Bài 1',
        level: 'know',
        points: 1,
        explanation: '3 + 3 = 6',
        status: 'deprecated',
        author: 'GV Toán',
        version: 1,
        options: [
          { id: 'o5', label: 'A', text: '6' },
          { id: 'o6', label: 'B', text: '7' },
        ],
        correctAnswer: 'A',
      },
    ];

    const studentPool = buildD05QuestionPool({
      sourceKind: 'bank',
      bankQuestions: bank,
      userRole: 'student',
    });
    assert.deepEqual(
      studentPool.map((item) => item.id),
      ['b_approved']
    );

    const teacherPool = buildD05QuestionPool({
      sourceKind: 'bank',
      bankQuestions: bank,
      userRole: 'teacher',
    });
    assert.deepEqual(
      teacherPool.map((item) => item.id),
      ['b_approved', 'b_pending']
    );
  });
});

describe('D05 — Session Persistence, /demo Isolation, Corrupt Recovery & Audio', () => {
  it('saves/loads exact session state, isolates /demo storage keys, and recovers safely from corrupt JSON', () => {
    const prevWindow = (globalThis as Record<string, unknown>).window;
    try {
      // 1. Standard runtime
      const normalEnv = createMemoryWindow('/teacher/games');
      (globalThis as Record<string, unknown>).window = normalEnv.mockWindow;
      assert.equal(getD05SessionStorageKey(), D05_SESSION_STORAGE_KEY);

      const config = createDefaultRelayConfig('team_relay', ['An', 'Bình', 'Chi', 'Dũng']);
      config.questionCount = 4;
      const questions = prepareRelayQuestions(D05_SAMPLE_QUESTIONS, config);
      const initial = createInitialRelayMatchState(config, questions);
      const c1 = commitRelayTurnResult(initial, {
        question: questions[0],
        verdictsByTeam: { team_1: 'correct', team_2: 'incorrect' },
        resultSource: 'teacher_single_device',
      });
      const progressed = advanceRelayToNextQuestion(c1.state);

      saveD05Session(progressed);
      const restored = loadD05Session();
      assert.equal(restored.recoveredFromCorruption, false);
      assert.ok(restored.state);
      assert.equal(restored.state.currentQuestionIndex, 1);
      assert.equal(restored.state.teamRuntime.team_1.score, 10);
      assert.equal(restored.state.teamRuntime.team_1.currentMemberIndex, 1);
      assert.equal(restored.state.teamRuntime.team_2.currentMemberIndex, 1);

      // 2. Corrupt JSON recovery
      normalEnv.mockWindow.localStorage.setItem(D05_SESSION_STORAGE_KEY, '{invalid-json!!!');
      const corrupted = loadD05Session();
      assert.equal(corrupted.state, null);
      assert.equal(corrupted.recoveredFromCorruption, true);
      assert.equal(normalEnv.mockWindow.localStorage.getItem(D05_SESSION_STORAGE_KEY), null);

      // 3. /demo runtime isolation
      const demoEnv = createMemoryWindow('/demo');
      (globalThis as Record<string, unknown>).window = demoEnv.mockWindow;
      assert.equal(
        getD05SessionStorageKey(),
        `${KHKT_DEMO_STORAGE_PREFIX}${D05_SESSION_STORAGE_KEY}`
      );
      saveD05Session(progressed);
      assert.ok(demoEnv.store.has(`${KHKT_DEMO_STORAGE_PREFIX}${D05_SESSION_STORAGE_KEY}`));
      assert.equal(demoEnv.store.has(D05_SESSION_STORAGE_KEY), false);

      clearD05Session();
      assert.equal(demoEnv.store.size, 0);
    } finally {
      (globalThis as Record<string, unknown>).window = prevWindow;
    }
  });

  it('exposes D05 relay audio cues safely on EduGameSoundBank and cleans up loops via stopAll()', () => {
    const bank = new EduGameSoundBank();
    assert.doesNotThrow(() => {
      bank.playRelayWhistle(true);
      bank.startRelayStepLoop(() => true);
      bank.playRelayBatonPass(true);
      bank.playRelayFinishFanfare(true);
      bank.playRelayWhistle(false);
      bank.startRelayStepLoop(() => false);
      bank.playRelayBatonPass(false);
      bank.playRelayFinishFanfare(false);
      bank.stopRelayStepLoop();
      bank.stopAll();
    });
  });
});
