/**
 * F05 — GIẢI MẬT MÃ 3D (Tây Đô Smart EDU)
 * Pure deterministic Cipher & Logic Vault Engine:
 * - Three built-in verified sample challenges ("Dữ liệu mẫu"):
 *   1. "Bốn ô khóa" (Math numeric lock, code "0734", preserves leading zero; "734" rejected as format error)
 *   2. "Bốn chữ số bí ẩn" (Logic deduction over 24 permutations of {1,2,3,4}, verified unique code "2341")
 *   3. "Tin nhắn từ Tây Đô" (Caesar +3 shift A–Z uppercase without accents, "WDB GR" -> "TAY DO")
 * - Exhaustive 24-permutation uniqueness verifier for logic deduction challenges
 * - Exact Caesar A–Z wrap-around encoder/decoder (X -> A at +3, A -> X at -3)
 * - Strict input validation & normalization:
 *   - Empty or malformed inputs show fix guidance and NEVER count as an attempt
 *   - Numeric codes compared strictly as strings (exact length + leading zero preserved)
 *   - Text codes trim outer spaces, collapse inner spaces, case-insensitive ("  tay   do " -> "TAY DO")
 * - Strict completion status rules:
 *   - "solved" ("Đã giải") ONLY when correct code is submitted BEFORE opening full solution
 *   - "viewed_solution" ("Đã xem lời giải") when full solution is opened before solving
 * - Classroom modes: Solo ("solo"), Whole Class 1–50 HS ("class"), and Simultaneous 2–6 Groups ("groups")
 * - Demo-isolated session persistence that never replays unlock animation or double-counts on reload
 */

import { KHKT_DEMO_STORAGE_PREFIX, isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

export type CipherChallengeKind = 'numeric_math' | 'numeric_logic' | 'caesar_text';

export type CipherPlayMode = 'solo' | 'class' | 'groups';

export type CipherChallengeStatus = 'unsolved' | 'solved' | 'viewed_solution';

export interface CipherClueItem {
  id: string;
  label: string;
  contentLatex: string;
  plainReadText: string;
}

export interface CipherSolutionStep {
  label: string;
  detailLatex: string;
  resultToken: string;
}

export interface CipherChallengeDefinition {
  id: string;
  order: number;
  title: string;
  shortTitle: string;
  categoryLabel: string;
  kind: CipherChallengeKind;
  isSample: boolean;
  sourceBadge: string;
  instructionText: string;
  expectedLength: number; // For numeric: exact digits; for text: normalized length
  answer: string; // Stored strictly as string!
  acceptedVariants?: string[]; // Optional explicitly declared variants
  displayVietnameseAnswer?: string;
  caesarShift?: number; // e.g., +3 encode / -3 decode
  cipherText?: string; // e.g., "WDB GR"
  samplePairText?: string; // e.g., "A → D (mã hóa tiến 3) · D → A (giải mã lùi 3)"
  clues: CipherClueItem[];
  hintLevel1Latex: string;
  hintLevel2Latex: string;
  solutionSummaryLatex: string;
  solutionSteps: CipherSolutionStep[];
}

export interface CipherChallengeProgress {
  challengeId: string;
  status: CipherChallengeStatus;
  attempts: number;
  hintsUsed: number;
  revealedHintLevel: 0 | 1 | 2;
  solutionRevealed: boolean;
  solvedGroupIndices: number[];
  lastSubmittedCode: string | null;
}

export interface CipherGroupDraft {
  groupIndex: number;
  code: string;
  lockedIn: boolean;
}

export interface CipherGameState {
  activeChallengeId: string;
  playMode: CipherPlayMode;
  classSizeHint: number; // 1–50
  groupCount: number; // 2–6
  groupDrafts: CipherGroupDraft[];
  progressById: Record<string, CipherChallengeProgress>;
  lastFeedback: {
    type: 'idle' | 'format_error' | 'wrong' | 'correct' | 'solution_viewed' | 'groups_evaluated';
    message: string;
  };
}

export const F05_SAMPLE_BADGE = 'Dữ liệu mẫu';
export const F05_SESSION_STORAGE_KEY = 'taydo_f05_cipher_session_v1';
export const F05_SESSION_VERSION = 1;
export const ALPHABET_AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// ============================================================================
// CAESAR CIPHER ENGINE (26-letter A–Z wrap-around, preserves spaces)
// ============================================================================

export function caesarShiftChar(ch: string, shift: number): string {
  const upper = ch.toUpperCase();
  const idx = ALPHABET_AZ.indexOf(upper);
  if (idx === -1) return ch;
  const normalizedShift = ((shift % 26) + 26) % 26;
  return ALPHABET_AZ[(idx + normalizedShift) % 26];
}

export function caesarEncode(plainText: string, shift: number): string {
  return Array.from(plainText)
    .map((ch) => (ch === ' ' ? ' ' : caesarShiftChar(ch, shift)))
    .join('');
}

export function caesarDecode(cipherText: string, shift: number): string {
  return caesarEncode(cipherText, -shift);
}

// ============================================================================
// 24-PERMUTATION LOGIC DEDUCTION VERIFIER
// ============================================================================

export function generatePermutations(digits: number[]): number[][] {
  if (digits.length <= 1) return [digits.slice()];
  const result: number[][] = [];
  for (let i = 0; i < digits.length; i++) {
    const current = digits[i];
    const rest = [...digits.slice(0, i), ...digits.slice(i + 1)];
    for (const perm of generatePermutations(rest)) {
      result.push([current, ...perm]);
    }
  }
  return result;
}

export interface LogicClueVerification {
  totalPermutationsChecked: number;
  validCodes: string[];
  hasUniqueSolution: boolean;
  uniqueCode: string | null;
}

/**
 * Exhaustively verifies all 24 permutations of [1, 2, 3, 4] against clue predicates.
 * Ensures a logic challenge has strictly ONE valid code before play.
 */
export function verifyFourDigitLogicClues(
  predicates: Array<(digits: [number, number, number, number]) => boolean>,
  allowedDigits: number[] = [1, 2, 3, 4]
): LogicClueVerification {
  const perms = generatePermutations(allowedDigits);
  const validCodes: string[] = [];

  for (const p of perms) {
    if (p.length !== 4) continue;
    const tuple = p as [number, number, number, number];
    if (predicates.every((fn) => fn(tuple))) {
      validCodes.push(tuple.join(''));
    }
  }

  return {
    totalPermutationsChecked: perms.length,
    validCodes,
    hasUniqueSolution: validCodes.length === 1,
    uniqueCode: validCodes.length === 1 ? validCodes[0] : null,
  };
}

export const LOGIC_SAMPLE_PREDICATES: Array<(d: [number, number, number, number]) => boolean> = [
  ([d1, , , d4]) => d1 === 2 * d4,
  ([d1, d2]) => d2 === d1 + 1,
];

// ============================================================================
// THREE BUILT-IN VERIFIED SAMPLE CHALLENGES ("Dữ liệu mẫu")
// ============================================================================

export const F05_SAMPLE_CHALLENGES: CipherChallengeDefinition[] = [
  {
    id: 'cipher_01_four_locks',
    order: 1,
    title: 'Màn 1 · Bốn ô khóa',
    shortTitle: 'Bốn ô khóa',
    categoryLabel: 'Tính toán tìm mã số',
    kind: 'numeric_math',
    isSample: true,
    sourceBadge: F05_SAMPLE_BADGE,
    instructionText:
      'Mỗi câu cho đúng một chữ số. Ghép kết quả theo thứ tự từ câu 1 đến câu 4 (giữ cả chữ số 0 ở đầu nếu có).',
    expectedLength: 4,
    answer: '0734',
    clues: [
      {
        id: 'c1_q1',
        label: 'Chữ số 1',
        contentLatex: 'Tính \\(3^2 - 9\\).',
        plainReadText: 'Câu 1: Tính 3 mũ 2 trừ 9.',
      },
      {
        id: 'c1_q2',
        label: 'Chữ số 2',
        contentLatex: 'Tính \\(\\sqrt{49}\\).',
        plainReadText: 'Câu 2: Tính căn bậc hai số học của 49.',
      },
      {
        id: 'c1_q3',
        label: 'Chữ số 3',
        contentLatex: 'Tính \\(\\frac{3}{4} \\times 4\\).',
        plainReadText: 'Câu 3: Tính 3 phần 4 nhân 4.',
      },
      {
        id: 'c1_q4',
        label: 'Chữ số 4',
        contentLatex: 'Tìm \\(x\\) biết \\(2x + 3 = 11\\).',
        plainReadText: 'Câu 4: Tìm x biết 2x cộng 3 bằng 11.',
      },
    ],
    hintLevel1Latex:
      'Tính riêng từng biểu thức từ câu 1 đến câu 4. Lưu ý lũy thừa \\(3^2 = 9\\) nên chữ số đầu tiên có thể là \\(0\\) — phải giữ nguyên đủ 4 chữ số.',
    hintLevel2Latex:
      'Câu 1: \\(3^2 - 9 = 9 - 9 = 0\\). Câu 2: \\(\\sqrt{49} = 7\\). Tiếp tục tính câu 3 và giải phương trình ở câu 4 để ghép đủ 4 chữ số.',
    solutionSummaryLatex:
      'Ghép kết quả theo đúng thứ tự từ câu 1 đến câu 4 ta được mã mở két là **0734** (giữ nguyên chữ số \\(0\\) ở vị trí đầu tiên).',
    solutionSteps: [
      {
        label: 'Câu 1 → Chữ số 1',
        detailLatex: '\\(3^2 - 9 = 9 - 9 = 0\\)',
        resultToken: '0',
      },
      {
        label: 'Câu 2 → Chữ số 2',
        detailLatex: '\\(\\sqrt{49} = 7\\)',
        resultToken: '7',
      },
      {
        label: 'Câu 3 → Chữ số 3',
        detailLatex: '\\(\\frac{3}{4} \\times 4 = 3\\)',
        resultToken: '3',
      },
      {
        label: 'Câu 4 → Chữ số 4',
        detailLatex: '\\(2x + 3 = 11 \\Rightarrow 2x = 8 \\Rightarrow x = 4\\)',
        resultToken: '4',
      },
    ],
  },
  {
    id: 'cipher_02_four_digits',
    order: 2,
    title: 'Màn 2 · Bốn chữ số bí ẩn',
    shortTitle: 'Bốn chữ số bí ẩn',
    categoryLabel: 'Suy luận từ manh mối',
    kind: 'numeric_logic',
    isSample: true,
    sourceBadge: F05_SAMPLE_BADGE,
    instructionText:
      'Mã số gồm 4 chữ số lấy từ tập {1, 2, 3, 4}, mỗi chữ số xuất hiện đúng một lần. Đọc hai manh mối để suy luận mã duy nhất.',
    expectedLength: 4,
    answer: '2341',
    clues: [
      {
        id: 'c2_rule',
        label: 'Tập chữ số',
        contentLatex: 'Dùng các chữ số \\(1, 2, 3, 4\\), mỗi chữ số đúng một lần.',
        plainReadText: 'Mã dùng các chữ số 1, 2, 3, 4, mỗi chữ số đúng một lần.',
      },
      {
        id: 'c2_clue1',
        label: 'Manh mối 1',
        contentLatex: 'Chữ số thứ nhất bằng hai lần chữ số cuối (\\(d_1 = 2 \\times d_4\\)).',
        plainReadText: 'Manh mối 1: Chữ số thứ nhất bằng hai lần chữ số cuối.',
      },
      {
        id: 'c2_clue2',
        label: 'Manh mối 2',
        contentLatex: 'Chữ số thứ hai lớn hơn chữ số thứ nhất đúng \\(1\\) đơn vị (\\(d_2 = d_1 + 1\\)).',
        plainReadText: 'Manh mối 2: Chữ số thứ hai lớn hơn chữ số thứ nhất đúng 1 đơn vị.',
      },
    ],
    hintLevel1Latex:
      'Bắt đầu từ manh mối \\(d_1 = 2 \\times d_4\\): trong tập \\(\\{1, 2, 3, 4\\}\\), chỉ có hai cặp \\((d_1, d_4)\\) thỏa mãn là \\((2, 1)\\) hoặc \\((4, 2)\\).',
    hintLevel2Latex:
      'Thử trường hợp \\(d_1 = 4\\): khi đó \\(d_2 = 4 + 1 = 5\\), nằm ngoài tập \\(\\{1, 2, 3, 4\\}\\) nên bị loại! Do đó chắc chắn \\(d_1 = 2\\) và \\(d_4 = 1\\).',
    solutionSummaryLatex:
      'Duyệt đủ \\(4! = 24\\) hoán vị của \\(\\{1, 2, 3, 4\\}\\), bộ manh mối cho **duy nhất một mã hợp lệ là 2341**.',
    solutionSteps: [
      {
        label: 'Bước 1 · Xét chữ số đầu và cuối',
        detailLatex:
          'Vì \\(d_1 = 2 \\times d_4\\) trong tập \\(\\{1, 2, 3, 4\\}\\), cặp \\((d_1, d_4)\\) chỉ có thể là \\((2, 1)\\) hoặc \\((4, 2)\\).',
        resultToken: '(2,1) hoặc (4,2)',
      },
      {
        label: 'Bước 2 · Loại trường hợp không hợp lệ',
        detailLatex:
          'Nếu \\(d_1 = 4\\) thì chữ số thứ hai \\(d_2 = 4 + 1 = 5\\) nằm ngoài tập cho phép \\(\\{1, 2, 3, 4\\}\\) → loại.',
        resultToken: 'd₁ = 2, d₄ = 1',
      },
      {
        label: 'Bước 3 · Tìm chữ số thứ hai',
        detailLatex: 'Với \\(d_1 = 2\\), ta có \\(d_2 = 2 + 1 = 3\\).',
        resultToken: 'd₂ = 3',
      },
      {
        label: 'Bước 4 · Chữ số còn lại',
        detailLatex:
          'Ba chữ số đã dùng là \\(2, 3, 1\\) nên chữ số thứ ba bắt buộc là \\(d_3 = 4\\). Mã mở két là **2341**.',
        resultToken: '2341',
      },
    ],
  },
  {
    id: 'cipher_03_tay_do',
    order: 3,
    title: 'Màn 3 · Tin nhắn từ Tây Đô',
    shortTitle: 'Tin nhắn từ Tây Đô',
    categoryLabel: 'Dịch vòng chữ cái (A–Z)',
    kind: 'caesar_text',
    isSample: true,
    sourceBadge: F05_SAMPLE_BADGE,
    instructionText:
      'Dùng bảng 26 chữ cái A–Z viết hoa, không dấu và giữ khoảng trắng giữa các từ. Quy tắc mã hóa dịch mỗi chữ tiến 3 vị trí (quay vòng Z về A); hãy dịch lùi 3 vị trí để giải mã.',
    expectedLength: 6,
    answer: 'TAY DO',
    displayVietnameseAnswer: 'Tây Đô',
    caesarShift: 3,
    cipherText: 'WDB GR',
    samplePairText: 'Ví dụ mẫu: A → D (mã hóa tiến 3) · X → A (quay vòng tiến 3) · D → A (giải mã lùi 3)',
    clues: [
      {
        id: 'c3_rule',
        label: 'Quy tắc dịch vòng',
        contentLatex:
          'Bảng chữ cái \\(A\\text{–}Z\\) (\\(26\\) chữ, không dấu). Mã hóa tiến \\(+3\\) vị trí (ví dụ \\(A \\to D\\), \\(X \\to A\\)); giải mã lùi \\(-3\\) vị trí (ví dụ \\(A \\to X\\)).',
        plainReadText:
          'Dùng bảng 26 chữ cái từ A đến Z không dấu. Mã hóa dịch tiến 3 vị trí, giải mã dịch lùi 3 vị trí, giữ khoảng trắng giữa các từ.',
      },
      {
        id: 'c3_cipher',
        label: 'Chuỗi đã mã hóa',
        contentLatex: 'Giải mã chuỗi: **WDB GR**',
        plainReadText: 'Chuỗi đã mã hóa là W D B, khoảng trắng, G R.',
      },
    ],
    hintLevel1Latex:
      'Giữ nguyên khoảng trắng giữa hai từ. Tra bảng chữ cái \\(A\\text{–}Z\\) và lùi đúng \\(3\\) vị trí cho từng chữ cái trong **WDB** và **GR**.',
    hintLevel2Latex:
      'Từ thứ nhất: \\(W \\xrightarrow{-3} T\\), \\(D \\xrightarrow{-3} A\\), \\(B \\xrightarrow{-3} Y\\) (lùi qua \\(A\\) quay vòng về \\(Z, Y\\)). Tiếp tục lùi \\(3\\) vị trí cho **GR**.',
    solutionSummaryLatex:
      'Dịch lùi \\(3\\) vị trí từng chữ cái trong **WDB GR** ta thu được **TAY DO** (tên tiếng Việt: **Tây Đô**).',
    solutionSteps: [
      {
        label: 'Chữ W → T',
        detailLatex: '\\(W\\) (vị trí 23) lùi \\(3\\) → \\(T\\) (vị trí 20).',
        resultToken: 'T',
      },
      {
        label: 'Chữ D → A',
        detailLatex: '\\(D\\) (vị trí 4) lùi \\(3\\) → \\(A\\) (vị trí 1).',
        resultToken: 'A',
      },
      {
        label: 'Chữ B → Y (quay vòng)',
        detailLatex: '\\(B \\to A \\to Z \\to Y\\) (quay vòng từ \\(A\\) về \\(Z\\) khi lùi \\(3\\)).',
        resultToken: 'Y',
      },
      {
        label: 'Từ thứ hai: G → D, R → O',
        detailLatex: '\\(G\\) lùi \\(3\\) → \\(D\\); \\(R\\) lùi \\(3\\) → \\(O\\). Ghép lại: **TAY DO** (Tây Đô).',
        resultToken: 'DO',
      },
    ],
  },
];

export function getCipherChallengeById(id: string): CipherChallengeDefinition {
  return F05_SAMPLE_CHALLENGES.find((c) => c.id === id) || F05_SAMPLE_CHALLENGES[0];
}

// ============================================================================
// INPUT NORMALIZATION & STRICT VALIDATION
// (Empty or malformed inputs NEVER count as attempts!)
// ============================================================================

export interface CodeValidationResult {
  validFormat: boolean;
  normalizedCode: string;
  errorMessage: string | null;
}

export function normalizeTextCode(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toUpperCase();
}

export function validateAndNormalizeCodeInput(
  challenge: CipherChallengeDefinition,
  rawInput: string
): CodeValidationResult {
  const trimmed = rawInput.trim();
  if (trimmed.length === 0) {
    return {
      validFormat: false,
      normalizedCode: '',
      errorMessage: 'Ô mã đang trống. Hãy nhập mã rồi bấm Thử mở khóa.',
    };
  }

  if (challenge.kind === 'numeric_math' || challenge.kind === 'numeric_logic') {
    if (!/^\d+$/.test(trimmed)) {
      return {
        validFormat: false,
        normalizedCode: trimmed,
        errorMessage: `Mã số chỉ gồm các chữ số 0–9 (không chứa chữ cái hay ký tự khác).`,
      };
    }
    if (trimmed.length < challenge.expectedLength) {
      return {
        validFormat: false,
        normalizedCode: trimmed,
        errorMessage: `Thiếu chữ số! Mã số cần đúng ${challenge.expectedLength} chữ số (giữ cả chữ số 0 ở đầu nếu có).`,
      };
    }
    if (trimmed.length > challenge.expectedLength) {
      return {
        validFormat: false,
        normalizedCode: trimmed,
        errorMessage: `Thừa chữ số! Mã số chỉ gồm đúng ${challenge.expectedLength} chữ số.`,
      };
    }
    return {
      validFormat: true,
      normalizedCode: trimmed, // Strictly kept as string to preserve leading zeros!
      errorMessage: null,
    };
  }

  // Caesar text challenge (A–Z uppercase without accents, spaces collapsed)
  const normalized = normalizeTextCode(rawInput);
  if (!/^[A-Z ]+$/.test(normalized)) {
    return {
      validFormat: false,
      normalizedCode: normalized,
      errorMessage:
        'Mã chữ dạng dịch vòng chỉ dùng các chữ cái A–Z không dấu và khoảng trắng giữa các từ.',
    };
  }

  return {
    validFormat: true,
    normalizedCode: normalized,
    errorMessage: null,
  };
}

export function isNormalizedCodeCorrect(
  challenge: CipherChallengeDefinition,
  normalizedCode: string
): boolean {
  if (normalizedCode === challenge.answer) return true;
  if (challenge.acceptedVariants && challenge.acceptedVariants.length > 0) {
    return challenge.acceptedVariants.includes(normalizedCode);
  }
  return false;
}

// ============================================================================
// STATE CREATION & GAMEPLAY OPERATIONS
// ============================================================================

export function createInitialChallengeProgress(challengeId: string): CipherChallengeProgress {
  return {
    challengeId,
    status: 'unsolved',
    attempts: 0,
    hintsUsed: 0,
    revealedHintLevel: 0,
    solutionRevealed: false,
    solvedGroupIndices: [],
    lastSubmittedCode: null,
  };
}

export function createGroupDrafts(count: number): CipherGroupDraft[] {
  const safe = Math.max(2, Math.min(6, Math.round(count)));
  return Array.from({ length: safe }, (_, idx) => ({
    groupIndex: idx,
    code: '',
    lockedIn: false,
  }));
}

export function createCipherGameState(params?: {
  activeChallengeId?: string;
  playMode?: CipherPlayMode;
  classSizeHint?: number;
  groupCount?: number;
}): CipherGameState {
  const progressById: Record<string, CipherChallengeProgress> = {};
  for (const ch of F05_SAMPLE_CHALLENGES) {
    progressById[ch.id] = createInitialChallengeProgress(ch.id);
  }

  const groupCount = Math.max(2, Math.min(6, Math.round(params?.groupCount ?? 4)));

  return {
    activeChallengeId: params?.activeChallengeId || F05_SAMPLE_CHALLENGES[0].id,
    playMode: params?.playMode ?? 'solo',
    classSizeHint: Math.max(1, Math.min(50, Math.round(params?.classSizeHint ?? 40))),
    groupCount,
    groupDrafts: createGroupDrafts(groupCount),
    progressById,
    lastFeedback: {
      type: 'idle',
      message: 'Đọc bảng manh mối, nhập mã rồi bấm “Thử mở khóa”.',
    },
  };
}

/**
 * Submit a code in Solo or Whole-Class mode.
 * - Empty/malformed input -> format error, attempts unchanged.
 * - Valid wrong input -> increments attempts, feedback "Mã chưa khớp" (never leaks right positions).
 * - Valid correct input -> increments attempts, unlocks vault; marks status "solved" ONLY if full solution wasn't already viewed!
 */
export function submitCipherAttempt(
  state: CipherGameState,
  rawInput: string
): {
  state: CipherGameState;
  outcome: 'format_error' | 'wrong' | 'correct' | 'already_unlocked';
  normalizedCode: string;
} {
  const challenge = getCipherChallengeById(state.activeChallengeId);
  const currentProg =
    state.progressById[challenge.id] || createInitialChallengeProgress(challenge.id);

  if (currentProg.status === 'solved') {
    return {
      state,
      outcome: 'already_unlocked',
      normalizedCode: challenge.answer,
    };
  }

  const check = validateAndNormalizeCodeInput(challenge, rawInput);
  if (!check.validFormat) {
    return {
      outcome: 'format_error',
      normalizedCode: check.normalizedCode,
      state: {
        ...state,
        lastFeedback: {
          type: 'format_error',
          message: check.errorMessage || 'Định dạng mã chưa hợp lệ.',
        },
      },
    };
  }

  const isCorrect = isNormalizedCodeCorrect(challenge, check.normalizedCode);
  const nextAttempts = currentProg.attempts + 1;

  if (!isCorrect) {
    const nextProg: CipherChallengeProgress = {
      ...currentProg,
      attempts: nextAttempts,
      lastSubmittedCode: check.normalizedCode,
    };
    return {
      outcome: 'wrong',
      normalizedCode: check.normalizedCode,
      state: {
        ...state,
        progressById: {
          ...state.progressById,
          [challenge.id]: nextProg,
        },
        lastFeedback: {
          type: 'wrong',
          message: 'Mã chưa khớp. Kiểm tra lại manh mối hoặc mở gợi ý nếu cần, rồi thử lại.',
        },
      },
    };
  }

  // Strict rule: ONLY record 'solved' if full solution was NOT opened beforehand!
  const nextStatus: CipherChallengeStatus =
    currentProg.status === 'viewed_solution' || currentProg.solutionRevealed
      ? 'viewed_solution'
      : 'solved';

  const nextProg: CipherChallengeProgress = {
    ...currentProg,
    status: nextStatus,
    attempts: nextAttempts,
    solutionRevealed: true,
    lastSubmittedCode: check.normalizedCode,
  };

  return {
    outcome: 'correct',
    normalizedCode: check.normalizedCode,
    state: {
      ...state,
      progressById: {
        ...state.progressById,
        [challenge.id]: nextProg,
      },
      lastFeedback: {
        type: 'correct',
        message:
          nextStatus === 'solved'
            ? `Chính xác! Mã ${challenge.answer} đã mở khóa két an toàn.`
            : `Mã ${challenge.answer} khớp (màn này đã ghi nhận là Đã xem lời giải trước đó).`,
      },
    },
  };
}

/**
 * Request progressive Hint (Level 1 then Level 2). Only revealed on user click; tracks hintsUsed.
 */
export function revealNextCipherHint(state: CipherGameState): {
  state: CipherGameState;
  revealedLevel: 1 | 2 | null;
} {
  const challenge = getCipherChallengeById(state.activeChallengeId);
  const prog = state.progressById[challenge.id] || createInitialChallengeProgress(challenge.id);
  if (prog.revealedHintLevel >= 2) {
    return { state, revealedLevel: null };
  }
  const nextLevel = (prog.revealedHintLevel + 1) as 1 | 2;
  const nextProg: CipherChallengeProgress = {
    ...prog,
    revealedHintLevel: nextLevel,
    hintsUsed: prog.hintsUsed + 1,
  };
  return {
    revealedLevel: nextLevel,
    state: {
      ...state,
      progressById: {
        ...state.progressById,
        [challenge.id]: nextProg,
      },
    },
  };
}

/**
 * Reveal full step-by-step solution when stuck.
 * Records status as 'viewed_solution' if not already 'solved'.
 */
export function revealCipherSolution(state: CipherGameState): CipherGameState {
  const challenge = getCipherChallengeById(state.activeChallengeId);
  const prog = state.progressById[challenge.id] || createInitialChallengeProgress(challenge.id);

  const nextStatus: CipherChallengeStatus =
    prog.status === 'solved' ? 'solved' : 'viewed_solution';

  const nextProg: CipherChallengeProgress = {
    ...prog,
    status: nextStatus,
    solutionRevealed: true,
  };

  return {
    ...state,
    progressById: {
      ...state.progressById,
      [challenge.id]: nextProg,
    },
    lastFeedback: {
      type: 'solution_viewed',
      message:
        nextStatus === 'solved'
          ? 'Đang xem lại lời giải chi tiết từng bước.'
          : 'Đã mở lời giải chi tiết (ghi nhận trạng thái: Đã xem lời giải).',
    },
  };
}

/**
 * Simultaneous 2–6 Groups Evaluation:
 * Teacher enters masked codes for groups, then clicks one simultaneous lock-in button.
 * Empty group slots are skipped; valid codes are evaluated at once; vault opens if >= 1 group solved it.
 */
export function evaluateSimultaneousGroups(state: CipherGameState): {
  state: CipherGameState;
  winningGroups: number[];
  invalidGroups: Array<{ groupIndex: number; error: string }>;
  evaluatedCount: number;
} {
  const challenge = getCipherChallengeById(state.activeChallengeId);
  const prog = state.progressById[challenge.id] || createInitialChallengeProgress(challenge.id);

  const winningGroups: number[] = [];
  const invalidGroups: Array<{ groupIndex: number; error: string }> = [];
  let evaluatedCount = 0;

  for (const draft of state.groupDrafts) {
    if (draft.code.trim().length === 0) continue;
    const check = validateAndNormalizeCodeInput(challenge, draft.code);
    if (!check.validFormat) {
      invalidGroups.push({
        groupIndex: draft.groupIndex,
        error: check.errorMessage || 'Sai định dạng',
      });
      continue;
    }
    evaluatedCount += 1;
    if (isNormalizedCodeCorrect(challenge, check.normalizedCode)) {
      winningGroups.push(draft.groupIndex);
    }
  }

  if (evaluatedCount === 0) {
    return {
      state: {
        ...state,
        lastFeedback: {
          type: 'format_error',
          message:
            invalidGroups.length > 0
              ? `Nhóm ${invalidGroups[0].groupIndex + 1}: ${invalidGroups[0].error}`
              : 'Chưa có nhóm nào nhập mã hợp lệ để chốt đồng thời.',
        },
      },
      winningGroups: [],
      invalidGroups,
      evaluatedCount: 0,
    };
  }

  const nextAttempts = prog.attempts + 1;
  const anySolved = winningGroups.length > 0;
  const nextStatus: CipherChallengeStatus = anySolved
    ? prog.status === 'viewed_solution' || prog.solutionRevealed
      ? 'viewed_solution'
      : 'solved'
    : prog.status;

  const mergedWinners = Array.from(new Set([...prog.solvedGroupIndices, ...winningGroups])).sort(
    (a, b) => a - b
  );

  const nextProg: CipherChallengeProgress = {
    ...prog,
    status: nextStatus,
    attempts: nextAttempts,
    solutionRevealed: anySolved ? true : prog.solutionRevealed,
    solvedGroupIndices: mergedWinners,
  };

  const winnerLabels = winningGroups.map((i) => `Nhóm ${i + 1}`).join(', ');
  const msg = anySolved
    ? `Chốt đồng thời: ${winnerLabels} đã giải đúng mã ${challenge.answer}!`
    : 'Mã chưa khớp ở các nhóm đã chốt. Cả lớp kiểm tra lại manh mối rồi thử lại.';

  return {
    winningGroups,
    invalidGroups,
    evaluatedCount,
    state: {
      ...state,
      progressById: {
        ...state.progressById,
        [challenge.id]: nextProg,
      },
      lastFeedback: {
        type: anySolved ? 'correct' : 'wrong',
        message: msg,
      },
    },
  };
}

// ============================================================================
// SUMMARY COMPUTATION
// ============================================================================

export interface CipherSessionSummary {
  totalChallenges: number;
  solvedCount: number;
  viewedSolutionCount: number;
  unsolvedCount: number;
  totalAttempts: number;
  totalHintsUsed: number;
  items: Array<{
    challenge: CipherChallengeDefinition;
    progress: CipherChallengeProgress;
  }>;
}

export function computeCipherSummary(state: CipherGameState): CipherSessionSummary {
  let solvedCount = 0;
  let viewedSolutionCount = 0;
  let unsolvedCount = 0;
  let totalAttempts = 0;
  let totalHintsUsed = 0;

  const items = F05_SAMPLE_CHALLENGES.map((challenge) => {
    const progress =
      state.progressById[challenge.id] || createInitialChallengeProgress(challenge.id);
    if (progress.status === 'solved') solvedCount += 1;
    else if (progress.status === 'viewed_solution') viewedSolutionCount += 1;
    else unsolvedCount += 1;
    totalAttempts += progress.attempts;
    totalHintsUsed += progress.hintsUsed;
    return { challenge, progress };
  });

  return {
    totalChallenges: F05_SAMPLE_CHALLENGES.length,
    solvedCount,
    viewedSolutionCount,
    unsolvedCount,
    totalAttempts,
    totalHintsUsed,
    items,
  };
}

// ============================================================================
// DEMO-ISOLATED SESSION PERSISTENCE
// (Restores state cleanly WITHOUT replaying unlock animation or re-adding counts)
// ============================================================================

export interface CipherPersistedSession {
  version: number;
  savedAt: number;
  state: CipherGameState;
}

export function getF05StorageKey(): string {
  return isKhktDemoRuntime()
    ? `${KHKT_DEMO_STORAGE_PREFIX}${F05_SESSION_STORAGE_KEY}`
    : F05_SESSION_STORAGE_KEY;
}

export function saveF05Session(state: CipherGameState): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: CipherPersistedSession = {
      version: F05_SESSION_VERSION,
      savedAt: Date.now(),
      state,
    };
    window.localStorage.setItem(getF05StorageKey(), JSON.stringify(payload));
  } catch {
    // Ignore quota/privacy errors
  }
}

export function loadF05Session(): CipherPersistedSession | null {
  if (typeof window === 'undefined') return null;
  const key = getF05StorageKey();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CipherPersistedSession>;
    if (
      !parsed ||
      parsed.version !== F05_SESSION_VERSION ||
      !parsed.state ||
      typeof parsed.state.activeChallengeId !== 'string' ||
      !parsed.state.progressById ||
      typeof parsed.state.progressById !== 'object'
    ) {
      window.localStorage.removeItem(key);
      return null;
    }

    const validIds = new Set(F05_SAMPLE_CHALLENGES.map((c) => c.id));
    const activeId = validIds.has(parsed.state.activeChallengeId)
      ? parsed.state.activeChallengeId
      : F05_SAMPLE_CHALLENGES[0].id;

    const mergedProgress: Record<string, CipherChallengeProgress> = {};
    for (const ch of F05_SAMPLE_CHALLENGES) {
      const saved = parsed.state.progressById[ch.id];
      if (
        saved &&
        (saved.status === 'unsolved' ||
          saved.status === 'solved' ||
          saved.status === 'viewed_solution')
      ) {
        mergedProgress[ch.id] = {
          challengeId: ch.id,
          status: saved.status,
          attempts: Math.max(0, Number(saved.attempts) || 0),
          hintsUsed: Math.max(0, Number(saved.hintsUsed) || 0),
          revealedHintLevel:
            saved.revealedHintLevel === 2 ? 2 : saved.revealedHintLevel === 1 ? 1 : 0,
          solutionRevealed: Boolean(saved.solutionRevealed),
          solvedGroupIndices: Array.isArray(saved.solvedGroupIndices)
            ? saved.solvedGroupIndices.filter((n) => typeof n === 'number')
            : [],
          lastSubmittedCode:
            typeof saved.lastSubmittedCode === 'string' ? saved.lastSubmittedCode : null,
        };
      } else {
        mergedProgress[ch.id] = createInitialChallengeProgress(ch.id);
      }
    }

    const groupCount = Math.max(2, Math.min(6, Math.round(Number(parsed.state.groupCount) || 4)));
    const restoredState: CipherGameState = {
      activeChallengeId: activeId,
      playMode:
        parsed.state.playMode === 'class' || parsed.state.playMode === 'groups'
          ? parsed.state.playMode
          : 'solo',
      classSizeHint: Math.max(1, Math.min(50, Math.round(Number(parsed.state.classSizeHint) || 40))),
      groupCount,
      groupDrafts: createGroupDrafts(groupCount),
      progressById: mergedProgress,
      lastFeedback: {
        type: 'idle',
        message: 'Đã khôi phục tiến độ phiên giải mã trước đó.',
      },
    };

    return {
      version: F05_SESSION_VERSION,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
      state: restoredState,
    };
  } catch {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore
    }
    return null;
  }
}

export function clearF05Session(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getF05StorageKey());
  } catch {
    // Ignore
  }
}
