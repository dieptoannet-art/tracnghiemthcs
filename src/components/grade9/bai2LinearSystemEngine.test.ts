// ============================================================================
// AUTOMATED UNIT TEST SUITE — TOÁN 9 CHƯƠNG I BÀI 2
// Run via: npx tsx src/components/grade9/bai2LinearSystemEngine.test.ts
// ============================================================================

import {
  makeRational,
  eqRat,
  formatRational,
  parseRationalInput,
  solveLinearSystem2x2,
  verifySubstitutionIsolationStep,
  verifySubstitutedSingleVarEquation,
  verifyEliminationMultipliers,
  verifyEliminationCombinedEquationInput,
  verifySystemFinalAnswer,
  SUBSTITUTION_ITEMS,
  ELIMINATION_ITEMS,
  CALCULATOR_ITEMS,
  TEXTBOOK_EXERCISES_16_TO_19,
  SUPPLEMENTARY_EXERCISES,
} from './bai2LinearSystemEngine';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`TEST FAILED: ${message}`);
  }
}

export function runBai2LinearSystemTests(): { passed: number; details: string[] } {
  let passed = 0;
  const details: string[] = [];

  const check = (cond: boolean, msg: string) => {
    assert(cond, msg);
    passed++;
    details.push(`PASS: ${msg}`);
  };

  // 1. Rational & Vietnamese decimal parsing
  const rDec = parseRationalInput('-0,5');
  check(Boolean(rDec && eqRat(rDec, makeRational(-1, 2))), 'Parse Vietnamese decimal -0,5 -> -1/2');
  const rFrac = parseRationalInput('-12/5');
  check(Boolean(rFrac && formatRational(rFrac, 'vi_decimal_if_clean') === '-2,4'), 'Format -12/5 -> -2,4');

  // 2. Vận dụng 1 (Vườn cải bắp): { -3x + 8y = -84 ; 2x - 4y = 72 } -> (60; 12), 720 cây
  const cabbageSol = solveLinearSystem2x2({
    eq1: { a: makeRational(-3), b: makeRational(8), c: makeRational(-84) },
    eq2: { a: makeRational(2), b: makeRational(-4), c: makeRational(72) },
  });
  check(
    cabbageSol.status === 'unique' &&
      Boolean(cabbageSol.x && eqRat(cabbageSol.x, makeRational(60))) &&
      Boolean(cabbageSol.y && eqRat(cabbageSol.y, makeRational(12))) &&
      cabbageSol.x!.num * cabbageSol.y!.num === 720,
    'Vận dụng 1 (Vườn cải bắp): x = 60, y = 12, xy = 720 cây'
  );

  // 3. Vận dụng 2 (Pha dung dịch HCl): { x + y = 2000 ; 0,20x + 0,05y = 200 } -> (2000/3; 4000/3)
  const hclSol = solveLinearSystem2x2({
    eq1: { a: makeRational(1), b: makeRational(1), c: makeRational(2000) },
    eq2: { a: makeRational(20, 100), b: makeRational(5, 100), c: makeRational(200) },
  });
  check(
    hclSol.status === 'unique' &&
      Boolean(hclSol.x && eqRat(hclSol.x, makeRational(2000, 3))) &&
      Boolean(hclSol.y && eqRat(hclSol.y, makeRational(4000, 3))),
    'Vận dụng 2 (Dung dịch HCl): x = 2000/3 mL, y = 4000/3 mL'
  );

  // 4. Verify all SUBSTITUTION_ITEMS (HĐ1, VD1, VD2, VD3, LT1a, LT1b, LT2, LT3)
  const expectedSubSummary: Record<string, string> = {
    vd1: 'unique:2,1',
    hd1: 'unique:2,1',
    vd2: 'no_solution',
    vd3: 'infinite_solutions',
    lt1a: 'unique:-13,-5',
    lt1b: 'unique:1,-5',
    lt2: 'no_solution',
    lt3: 'infinite_solutions',
  };
  for (const item of SUBSTITUTION_ITEMS) {
    const sol = solveLinearSystem2x2(item.system);
    const key =
      sol.status === 'unique'
        ? `unique:${formatRational(sol.x!)},${formatRational(sol.y!)}`
        : sol.status;
    check(key === expectedSubSummary[item.id], `Substitution item ${item.id} -> ${key}`);
  }

  // 5. Verify all ELIMINATION_ITEMS (HĐ2, VD4, VD5, VD6, VD7, LT4a, LT4b, LT5, LT6)
  const expectedElimSummary: Record<string, string> = {
    vd6: 'unique:1,2',
    hd2: 'unique:3,-3/2',
    vd4: 'unique:-1,2',
    vd5: 'unique:-1,-2',
    vd7: 'infinite_solutions',
    lt4a: 'unique:3,4',
    lt4b: 'unique:-3,4',
    lt5: 'unique:0,2',
    lt6: 'no_solution',
  };
  for (const item of ELIMINATION_ITEMS) {
    const sol = solveLinearSystem2x2(item.system);
    const key =
      sol.status === 'unique'
        ? `unique:${formatRational(sol.x!)},${formatRational(sol.y!)}`
        : sol.status;
    check(key === expectedElimSummary[item.id], `Elimination item ${item.id} -> ${key}`);
  }

  // 6. Verify all CALCULATOR_ITEMS (VD, Thực hành a, b, c)
  const expectedCalcSummary: Record<string, string> = {
    calc_vd: 'unique:-1,2',
    calc_tha: 'unique:11/5,-14/5',
    calc_thb: 'no_solution',
    calc_thc: 'infinite_solutions',
  };
  for (const item of CALCULATOR_ITEMS) {
    const sol = solveLinearSystem2x2(item.system);
    const key =
      sol.status === 'unique'
        ? `unique:${formatRational(sol.x!)},${formatRational(sol.y!)}`
        : sol.status;
    check(key === expectedCalcSummary[item.id], `Calculator item ${item.id} -> ${key}`);
  }

  // 7. Verify all TEXTBOOK_EXERCISES_16_TO_19 (Bài 1.6 -> 1.9)
  const expectedExSummary: Record<string, string> = {
    bt_1_6_a: 'unique:10,7',
    bt_1_6_b: 'unique:1,-2',
    bt_1_6_c: 'no_solution',
    bt_1_7_a: 'unique:4,-3',
    bt_1_7_b: 'unique:5,3',
    bt_1_7_c: 'infinite_solutions',
    bt_1_8_a: 'unique:-12/5,-9/5',
    bt_1_8_b: 'no_solution',
    bt_1_8_c: 'no_solution',
    bt_1_9_a: 'unique:-2,0',
    bt_1_9_b: 'infinite_solutions',
    bt_1_9_c: 'no_solution',
    bt_1_9_d: 'unique:9/2,-15',
  };
  for (const ex of TEXTBOOK_EXERCISES_16_TO_19) {
    const sol = solveLinearSystem2x2(ex.system);
    const key =
      sol.status === 'unique'
        ? `unique:${formatRational(sol.x!)},${formatRational(sol.y!)}`
        : sol.status;
    check(key === expectedExSummary[ex.id], `Textbook exercise ${ex.id} -> ${key}`);
  }

  // 8. Verify all 12 SUPPLEMENTARY_EXERCISES
  check(SUPPLEMENTARY_EXERCISES.length === 12, '12 supplementary exercises exist');
  for (const sup of SUPPLEMENTARY_EXERCISES) {
    const sol = solveLinearSystem2x2(sup.system);
    check(Boolean(sol.status), `Supplementary exercise ${sup.id} solved cleanly (${sol.status})`);
  }

  // 9. Edge cases when D = 0 and b = 0 or a = 0 or 0 = 0 (no division by zero!)
  const zeroBSol = solveLinearSystem2x2({
    eq1: { a: makeRational(2), b: makeRational(0), c: makeRational(4) },
    eq2: { a: makeRational(4), b: makeRational(0), c: makeRational(8) },
  });
  check(
    zeroBSol.status === 'infinite_solutions' &&
      zeroBSol.parametric?.freeVar === 'y' &&
      zeroBSol.parametric?.xExprDisplay === '2',
    'Degenerate b=0 system {2x=4; 4x=8} -> infinite_solutions (2; t) without division by zero'
  );

  const zeroEqInconsistent = solveLinearSystem2x2({
    eq1: { a: makeRational(0), b: makeRational(0), c: makeRational(5) },
    eq2: { a: makeRational(1), b: makeRational(1), c: makeRational(2) },
  });
  check(zeroEqInconsistent.status === 'no_solution', 'Degenerate 0x+0y=5 -> no_solution');

  // 10. Step-by-step Verifier & Specific Error Diagnostics
  const vd1Sys = SUBSTITUTION_ITEMS[0].system; // { 2x - y = 3 ; x + 2y = 4 }
  // Valid isolation: y = 2x - 3, or x = 4 - 2y, or x = (y + 3)/2
  check(
    verifySubstitutionIsolationStep(vd1Sys, 1, 'y', '2x - 3').isValid,
    'VD1 isolation y = 2x - 3 valid'
  );
  check(
    verifySubstitutionIsolationStep(vd1Sys, 2, 'x', '4 - 2y').isValid,
    'VD1 alternative isolation x = 4 - 2y valid'
  );
  check(
    verifySubstitutionIsolationStep(vd1Sys, 1, 'x', '(y + 3)/2').isValid,
    'VD1 alternative fractional isolation x = (y + 3)/2 valid'
  );
  // Error diagnosis: wrong sign when transposing
  const wrongSignIso = verifySubstitutionIsolationStep(vd1Sys, 1, 'y', '3 - 2x');
  check(
    !wrongSignIso.isValid && wrongSignIso.errorCode === 'wrong_sign_transpose',
    'Diagnose wrong sign on transpose (3 - 2x)'
  );
  // Error diagnosis: missing parentheses when substituting 2x - 3 into x + 2y = 4
  const missingParenCheck = verifySubstitutedSingleVarEquation(vd1Sys, 1, 'y', 'x + 4x - 3 = 4');
  check(
    !missingParenCheck.isValid && missingParenCheck.errorCode === 'missing_parentheses',
    'Diagnose missing parentheses (x + 4x - 3 = 4)'
  );
  // Valid substituted equation (both unexpanded and simplified)
  check(
    verifySubstitutedSingleVarEquation(vd1Sys, 1, 'y', 'x + 2(2x - 3) = 4').isValid &&
      verifySubstitutedSingleVarEquation(vd1Sys, 1, 'y', '5x - 6 = 4').isValid,
    'Accept both x + 2(2x - 3) = 4 and 5x - 6 = 4'
  );

  // Elimination diagnostics on VD6 { 3x + 2y = 7 ; 2x - 3y = -4 }
  const vd6Sys = ELIMINATION_ITEMS[0].system;
  const validNotElim = verifyEliminationMultipliers(
    vd6Sys,
    makeRational(1),
    makeRational(1),
    'add'
  );
  check(
    !validNotElim.isValid && validNotElim.errorCode === 'valid_but_not_eliminated',
    'Diagnose valid multiplier that does not eliminate any variable ("Hợp lệ, nhưng chưa khử được ẩn")'
  );
  const forgotRhs = verifyEliminationCombinedEquationInput(
    vd6Sys,
    makeRational(3),
    makeRational(2),
    'add',
    '13x = 3'
  );
  check(
    !forgotRhs.isValid && forgotRhs.errorCode === 'forgot_rhs_multiplication',
    'Diagnose forgetting to multiply RHS (13x = 3 instead of 13x = 13)'
  );

  // Final answer check: pair satisfying only eq1 (1; -1) for { 2x - y = 3 ; x + 2y = 4 }
  const oneEqOnly = verifySystemFinalAnswer(vd1Sys, 'unique', '1', '-1');
  check(
    !oneEqOnly.isValid && oneEqOnly.errorCode === 'only_satisfies_one_equation',
    'Diagnose pair (1; -1) satisfying only equation (1) and not equation (2)'
  );

  // Parametric equivalence check on VD3 { -x + y = -2 ; 3x - 3y = 6 }
  const vd3Sys = SUBSTITUTION_ITEMS[3].system;
  check(
    verifySystemFinalAnswer(vd3Sys, 'infinite_solutions', 't', 't - 2').isValid &&
      verifySystemFinalAnswer(vd3Sys, 'infinite_solutions', 't + 2', 't').isValid,
    'Accept both (t; t - 2) and (t + 2; t) for infinite-solution system VD3'
  );

  return { passed, details };
}

// Execute when run via npx tsx
const result = runBai2LinearSystemTests();
console.log(`ALL ${result.passed} TESTS PASSED SUCCESSFULLY!`);
