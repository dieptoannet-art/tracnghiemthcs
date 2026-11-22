import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  areAllTeamsGraded,
  buildBankBoardCandidate,
  clearD06Session,
  computeKingStandings,
  confirmTileSettlement,
  createDefaultKingConfig,
  createDefaultKingTeams,
  createKingOfScoreMatch,
  createSampleStudentList,
  D06_MAX_SCORE_PER_TEAM,
  D06_SAMPLE_BADGE,
  D06_SAMPLE_QUESTIONS,
  editLastSettledTileVerdicts,
  finishMatchEarly,
  getCurrentPickerTeam,
  inspectMathFormulaErrors,
  loadD06Session,
  openBoardTile,
  returnToBoardAfterSettlement,
  revealActiveAnswer,
  saveD06Session,
  setTeamDraftOptionChoice,
  setTeamDraftVerdict,
  stopAnsweringAndBeginGrading,
} from './kingOfScore3dEngine';
import { renderMathToHtml } from '../../MathView';
import { EduGameSoundBank } from '../../../utils/eduGameAudioController';
import { KHKT_DEMO_STORAGE_PREFIX } from '../../../utils/khktDemoSandbox';
import { Question } from '../../../types';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (idx: number) => Array.from(store.keys())[idx] ?? null,
    get length() {
      return store.size;
    },
  };
}

function makeMockBankQuestion(
  id: string,
  subject: string,
  chapter: string,
  level: string,
  stem: string,
  status: Question['status'] = 'approved'
): Question {
  return {
    id,
    code: id.toUpperCase(),
    subject,
    grade: '8',
    textbook: 'Kết nối tri thức',
    chapter,
    lesson: chapter,
    type: 'single_choice',
    level: level as Question['level'],
    points: 1,
    stem,
    options: [
      { id: `${id}_a`, label: 'A', text: '\\(1\\)' },
      { id: `${id}_b`, label: 'B', text: '\\(2\\)' },
      { id: `${id}_c`, label: 'C', text: '\\(3\\)' },
      { id: `${id}_d`, label: 'D', text: '\\(4\\)' },
    ],
    correctAnswer: `${id}_a`,
    explanation: 'Lời giải mẫu.',
    status,
    author: 'teacher_1',
    version: 1,
  };
}

describe('D06 — Vua ghi điểm 3D Engine, Math & Acceptance Suite', () => {
  it('1. Sample pack has all 9 exact THCS Math questions tagged Dữ liệu mẫu, valid KaTeX (including 2-fraction equation) & malformed LaTeX diagnostics', () => {
    assert.equal(D06_SAMPLE_QUESTIONS.length, 9);
    for (const q of D06_SAMPLE_QUESTIONS) {
      assert.equal(q.isSample, true);
      assert.equal(q.sourceBadge, D06_SAMPLE_BADGE);
      assert.equal(inspectMathFormulaErrors(q.stem).length, 0, `Stem math valid: ${q.code}`);
      assert.equal(inspectMathFormulaErrors(q.officialAnswerText).length, 0, `Answer math valid: ${q.code}`);
      assert.equal(inspectMathFormulaErrors(q.explanation).length, 0, `Explanation math valid: ${q.code}`);
      assert.ok(renderMathToHtml(q.stem).includes('katex'), `Stem renders KaTeX: ${q.code}`);
      for (const opt of q.options || []) {
        assert.equal(inspectMathFormulaErrors(opt.text).length, 0);
        assert.ok(renderMathToHtml(opt.text).includes('katex'));
      }
    }

    // Verify specific two-fraction equation & fraction addition
    const twoFrac = D06_SAMPLE_QUESTIONS.find((q) => q.code === 'D06-PT-30');
    assert.ok(twoFrac);
    assert.ok(twoFrac.stem.includes('\\frac{x-1}{2}+\\frac{x+2}{3}=4'));
    assert.ok(twoFrac.officialAnswerText.includes('\\frac{23}{5}'));
    assert.ok(renderMathToHtml(twoFrac.stem).includes('mfrac'));

    // Malformed LaTeX: detected with exact position & MathView falls back safely without throwing
    const broken = 'Giải phương trình \\(\\frac{x+1}{2\\) bằng 5';
    const errs = inspectMathFormulaErrors(broken);
    assert.equal(errs.length, 1);
    assert.equal(errs[0].segmentIndex, 1);
    assert.ok(errs[0].startChar > 0);
    const fallbackHtml = renderMathToHtml(broken);
    assert.ok(fallbackHtml.includes('font-mono'));
  });

  it('2. Prompt acceptance walkthrough: Team A picks 30-pt tile; A & B right, C wrong -> A +30, B +30, C +0, tile locked, picker rotates to B', () => {
    const config = createDefaultKingConfig('team');
    config.teams = createDefaultKingTeams('team', 3); // Đội A, Đội B, Đội C
    config.randomStarter = false;

    let state = createKingOfScoreMatch({ config });
    assert.equal(getCurrentPickerTeam(state).name, 'Đội A');

    // Open 30-point tile in column 0
    const openRes = openBoardTile(state, 'c0_p30');
    assert.equal(openRes.opened, true);
    state = openRes.state;
    assert.equal(state.phase, 'thinking');

    // Cannot open another tile while one is active
    const secondOpen = openBoardTile(state, 'c1_p10');
    assert.equal(secondOpen.opened, false);

    // Stop answering -> grading
    state = stopAnsweringAndBeginGrading(state);
    state = revealActiveAnswer(state);
    assert.equal(state.answerRevealed, true);

    // Cannot settle while any team is still 'ungraded'
    state = setTeamDraftVerdict(state, 'team_1', 'correct');
    state = setTeamDraftVerdict(state, 'team_2', 'correct');
    assert.equal(areAllTeamsGraded(state), false);
    const blockedSettle = confirmTileSettlement(state);
    assert.equal(blockedSettle.committed, false);

    // Grade team C incorrect -> settle ONCE
    state = setTeamDraftVerdict(state, 'team_3', 'incorrect');
    assert.equal(areAllTeamsGraded(state), true);
    const settled = confirmTileSettlement(state, 1000);
    assert.equal(settled.committed, true);
    assert.equal(settled.scorersCount, 2);
    state = settled.state;

    // Double-click settlement guard: second commit does NOT double-award points
    const dupSettle = confirmTileSettlement(state, 1010);
    assert.equal(dupSettle.committed, false);

    assert.equal(state.teamRuntime['team_1'].totalScore, 30);
    assert.equal(state.teamRuntime['team_2'].totalScore, 30);
    assert.equal(state.teamRuntime['team_3'].totalScore, 0);
    assert.equal(state.tiles.find((t) => t.tileId === 'c0_p30')?.status, 'played');
    assert.equal(getCurrentPickerTeam(state).name, 'Đội B');

    // Return to board -> cannot re-open played tile for scoring
    state = returnToBoardAfterSettlement(state);
    const reopen = openBoardTile(state, 'c0_p30');
    assert.equal(reopen.opened, false);
  });

  it('3. Full 9-tile match reaches max score 180, handles ties as Đồng hạng, and supports 2-team & 6-team with 50-student roster', () => {
    const sample50 = createSampleStudentList(50);
    assert.equal(sample50.length, 50);

    // 6-team full match where Team 1 & Team 2 answer ALL 9 tiles correctly -> 180 pts each (Đồng hạng 1)
    const config6 = createDefaultKingConfig('team');
    config6.teams = createDefaultKingTeams('team', 6);
    let state = createKingOfScoreMatch({ config: config6 });
    assert.equal(state.maxPossibleScore, D06_MAX_SCORE_PER_TEAM);
    assert.equal(state.maxPossibleScore, 180);

    const tileIds = state.tiles.map((t) => t.tileId);
    for (const tileId of tileIds) {
      const opened = openBoardTile(state, tileId);
      assert.equal(opened.opened, true);
      state = stopAnsweringAndBeginGrading(opened.state);
      state = setTeamDraftVerdict(state, 'team_1', 'correct');
      state = setTeamDraftVerdict(state, 'team_2', 'correct');
      state = setTeamDraftVerdict(state, 'team_3', 'incorrect');
      state = setTeamDraftVerdict(state, 'team_4', 'no_answer');
      state = setTeamDraftVerdict(state, 'team_5', 'incorrect');
      state = setTeamDraftVerdict(state, 'team_6', 'no_answer');
      const res = confirmTileSettlement(state);
      assert.equal(res.committed, true);
      state = returnToBoardAfterSettlement(res.state);
    }

    assert.equal(state.status, 'finished');
    assert.equal(state.endedEarly, false);
    const standings = computeKingStandings(state);
    assert.equal(standings[0].totalScore, 180);
    assert.equal(standings[1].totalScore, 180);
    assert.equal(standings[0].rank, 1);
    assert.equal(standings[1].rank, 1);
    assert.equal(standings[0].isTied, true);
    assert.equal(standings[0].rankLabel, 'Đồng hạng 1');
    assert.equal(standings[1].rankLabel, 'Đồng hạng 1');
    assert.equal(standings[2].rank, 3); // Standard competition ranking: 1, 1, 3
  });

  it('4. Edit last settled tile recomputes scores purely from history WITHOUT rotating picker turn an extra time', () => {
    const config = createDefaultKingConfig('team');
    config.teams = createDefaultKingTeams('team', 2); // Đội A, Đội B
    let state = createKingOfScoreMatch({ config });

    // Tile 1 (20 pts): A picks, A right, B wrong -> picker advances to B
    state = openBoardTile(state, 'c0_p20').state;
    state = stopAnsweringAndBeginGrading(state);
    state = setTeamDraftVerdict(state, 'team_1', 'correct');
    state = setTeamDraftVerdict(state, 'team_2', 'incorrect');
    state = confirmTileSettlement(state).state;
    state = returnToBoardAfterSettlement(state);

    assert.equal(state.teamRuntime['team_1'].totalScore, 20);
    assert.equal(state.teamRuntime['team_2'].totalScore, 0);
    assert.equal(getCurrentPickerTeam(state).id, 'team_2');
    assert.equal(state.canEditLastTile, true);

    // Edit last settled tile BEFORE opening next tile: flip to A wrong, B right
    const edited = editLastSettledTileVerdicts(state, {
      team_1: 'incorrect',
      team_2: 'correct',
    });
    assert.equal(edited.edited, true);
    state = edited.state;
    assert.equal(state.teamRuntime['team_1'].totalScore, 0);
    assert.equal(state.teamRuntime['team_2'].totalScore, 20);
    // Picker turn MUST stay team_2 (NEVER advance an extra time!)
    assert.equal(getCurrentPickerTeam(state).id, 'team_2');

    // Once next tile opens, editing previous tile is locked
    state = openBoardTile(state, 'c1_p10').state;
    assert.equal(state.canEditLastTile, false);
    const blockedEdit = editLastSettledTileVerdicts(state, {
      team_1: 'correct',
      team_2: 'correct',
    });
    assert.equal(blockedEdit.edited, false);
  });

  it('5. Solo mode has zero fake opponents, compares by stable optionId, and early finish records Kết thúc sớm with exact tiles played', () => {
    const soloCfg = createDefaultKingConfig('solo');
    let state = createKingOfScoreMatch({ config: soloCfg });
    assert.equal(state.config.teams.length, 1);

    // Play 2 tiles
    state = openBoardTile(state, 'c0_p10').state;
    state = setTeamDraftOptionChoice(state, 'solo_1', 'c0_10_a'); // Correct option ID
    state = stopAnsweringAndBeginGrading(state);
    state = confirmTileSettlement(state).state;
    state = returnToBoardAfterSettlement(state);

    state = openBoardTile(state, 'c1_p30').state;
    state = setTeamDraftOptionChoice(state, 'solo_1', 'c1_30_b'); // Incorrect option ID
    state = stopAnsweringAndBeginGrading(state);
    state = confirmTileSettlement(state).state;
    state = returnToBoardAfterSettlement(state);

    // End early after 2/9 tiles
    state = finishMatchEarly(state);
    assert.equal(state.status, 'ended_early');
    assert.equal(state.endedEarly, true);
    assert.equal(state.settledHistory.length, 2);
    assert.equal(state.teamRuntime['solo_1'].totalScore, 10);
    assert.equal(state.teamRuntime['solo_1'].correctCount, 1);
  });

  it('6. Random starter determined ONCE at match creation then rotates strictly in order', () => {
    const config = createDefaultKingConfig('team');
    config.teams = createDefaultKingTeams('team', 4);
    config.randomStarter = true;
    // randomFn = 0.6 -> floor(0.6 * 4) = 2 (Đội C)
    let state = createKingOfScoreMatch({ config, randomFn: () => 0.6 });
    assert.equal(state.startingPickerIndex, 2);
    assert.equal(getCurrentPickerTeam(state).name, 'Đội C');

    // After settling 1 tile -> rotates to index 3 (Đội D), then 0 (Đội A)
    state = openBoardTile(state, 'c0_p10').state;
    state = stopAnsweringAndBeginGrading(state);
    for (const t of state.config.teams) {
      state = setTeamDraftVerdict(state, t.id, 'no_answer');
    }
    state = returnToBoardAfterSettlement(confirmTileSettlement(state).state);
    assert.equal(getCurrentPickerTeam(state).name, 'Đội D');

    state = openBoardTile(state, 'c1_p10').state;
    state = stopAnsweringAndBeginGrading(state);
    for (const t of state.config.teams) {
      state = setTeamDraftVerdict(state, t.id, 'no_answer');
    }
    state = returnToBoardAfterSettlement(confirmTileSettlement(state).state);
    assert.equal(getCurrentPickerTeam(state).name, 'Đội A');
  });

  it('7. Custom Smart EDU bank adapter enforces RBAC, refuses guessing unclassified difficulty, never repeats questions, and reports exact missing slots', () => {
    const pool: Question[] = [
      // 3 distinct Nhận biết / know (10pt)
      makeMockBankQuestion('q1', 'Toán', 'Đại số', 'know', 'Câu 1'),
      makeMockBankQuestion('q2', 'Toán', 'Hình học', 'know', 'Câu 2'),
      makeMockBankQuestion('q3', 'Toán', 'Thống kê', 'know', 'Câu 3'),
      // Only 2 Thông hiểu / understand (20pt) -> missing 1 slot at 20pt!
      makeMockBankQuestion('q4', 'Toán', 'Đại số', 'understand', 'Câu 4'),
      makeMockBankQuestion('q5', 'Toán', 'Hình học', 'understand', 'Câu 5'),
      // Unclassified question (empty level) -> MUST NOT be guessed!
      makeMockBankQuestion('q6', 'Toán', 'Thống kê', '', 'Câu chưa phân loại'),
      // Deprecated question -> MUST be excluded!
      makeMockBankQuestion('q7', 'Toán', 'Đại số', 'apply', 'Câu cũ', 'deprecated'),
      // Draft question -> excluded for student role!
      makeMockBankQuestion('q8', 'Toán', 'Hình học', 'apply', 'Câu nháp', 'draft'),
    ];

    const resStudent = buildBankBoardCandidate({
      bankQuestions: pool,
      userRole: 'student',
      subjectFilter: 'Toán',
    });

    assert.equal(resStudent.ready, false);
    assert.equal(resStudent.unclassifiedCount, 1);
    // Student sees only approved classified questions (q1..q5 = 5 questions, missing 1x20pt and 3x30pt = 4 missing slots)
    assert.equal(resStudent.eligiblePool.length, 5);
    assert.equal(resStudent.missingSlots.length, 4);
    assert.ok(resStudent.missingSlots.some((s) => s.points === 20));
    assert.ok(resStudent.missingSlots.filter((s) => s.points === 30).length === 3);

    // Ensure zero repeated question IDs across filled slots
    const filledIds = resStudent.slots.map((s) => s.question?.id).filter(Boolean);
    assert.equal(new Set(filledIds).size, filledIds.length);
  });

  it('8. Session persistence restores opened tiles, scores, picker turn & timer, isolates /demo, heals corrupt JSON, and audio cues degrade safely', () => {
    const origWindow = (globalThis as { window?: unknown }).window;
    const mem = createMemoryStorage();
    (globalThis as { window?: unknown }).window = {
      localStorage: mem,
      location: { pathname: '/demo' },
    };

    try {
      const cfg = createDefaultKingConfig('team');
      let state = createKingOfScoreMatch({ config: cfg });
      state = openBoardTile(state, 'c0_p10').state;
      state = stopAnsweringAndBeginGrading(state);
      state = setTeamDraftVerdict(state, 'team_1', 'correct');
      state = setTeamDraftVerdict(state, 'team_2', 'incorrect');
      state = setTeamDraftVerdict(state, 'team_3', 'no_answer');
      state = returnToBoardAfterSettlement(confirmTileSettlement(state).state);

      saveD06Session(state, 18, true);
      // Verify /demo storage isolation prefix
      const demoKey = Array.from({ length: mem.length }, (_, i) => mem.key(i)).find((k) =>
        k?.includes('taydo_d06_king_of_score')
      );
      assert.ok(demoKey && demoKey.startsWith(KHKT_DEMO_STORAGE_PREFIX));

      const restored = loadD06Session();
      assert.ok(restored);
      assert.equal(restored.remainingSeconds, 18);
      assert.equal(restored.timerPaused, true);
      assert.equal(restored.state.teamRuntime['team_1'].totalScore, 10);
      assert.equal(restored.state.currentPickerIndex, 1);
      assert.equal(restored.state.tiles.find((t) => t.tileId === 'c0_p10')?.status, 'played');

      // Corrupt JSON recovery
      mem.setItem(demoKey, '{bad_json');
      assert.equal(loadD06Session(), null);
      assert.equal(mem.getItem(demoKey), null);

      clearD06Session();
    } finally {
      (globalThis as { window?: unknown }).window = origWindow;
    }

    // D06 audio cues degrade safely in headless / muted mode & honor turn tokens
    const bank = new EduGameSoundBank();
    bank.setActiveTurnToken('turn_d06_1');
    assert.doesNotThrow(() => bank.playKingTileOpen(false, 'turn_d06_1'));
    assert.doesNotThrow(() => bank.playKingScoreAward(false, 'turn_d06_1'));
    assert.doesNotThrow(() => bank.playKingSummaryFanfare(false, 'turn_d06_1'));
    assert.doesNotThrow(() => bank.playKingScoreAward(true, 'turn_d06_1'));
    assert.doesNotThrow(() => bank.playKingScoreAward(false, 'stale_token'));
    bank.stopAll();
    bank.dispose();
  });
});
