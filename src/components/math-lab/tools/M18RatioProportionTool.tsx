import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Compass,
  Trophy,
  Maximize2,
  Minimize2,
  FlaskConical,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  Users,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Layers,
  Palette,
  Equal,
  PieChart,
  BarChart3,
  ShoppingBasket,
  Footprints,
  PencilLine,
  Volume2,
  VolumeX,
  Trash2,
  Scale,
  AlertTriangle,
} from 'lucide-react';
import { MathActivityResultRecord } from '../types';
import {
  M18ActivityId,
  RatioComparisonOrder,
  M18_ACTIVITY_METADATA,
  M18_TASK_BANK,
  M18TaskSpec,
  evaluateRatioFromCounts,
  areRatiosEqual,
  evaluateColorMixFormula,
  divideTotalByRatio,
  analyzeProportionalRelation,
  computeUnitAwareRatio,
} from '../mathEngine/ratioProportionEngine';
import {
  GlassBeaker3D,
  MixingPitcherWithRod3D,
  GlossySphere3D,
  RatioLabRobot3D,
  DoubleNumberLineSVG,
  M18ActivityThumbnailCard3D,
} from './M18Ratio3DAssets';

export interface M18RatioProportionToolProps {
  grade?: number;
  isPresentationMode?: boolean;
  isDarkTheme?: boolean;
  resetSignal?: number;
  onBackToHub: () => void;
  onTogglePresentationMode?: () => void;
  selectedClassName?: string;
  studentCount?: number;
  currentUserName?: string;
  onResultSaved?: (record: MathActivityResultRecord) => void;
  initialActivityPreset?: string;
  onSwitchTool?: (toolId: 'M05' | 'M07' | 'M18') => void;
}

const STORAGE_KEY = 'taydo_smart_edu_m18_ratio_proportion_v1';

interface M18PersistedState {
  activeActivity: M18ActivityId;
  completedTaskIds: string[];
  score: number;
  streak: number;
  // Activity 1: CREATE_RATIO
  act1Blue: number;
  act1Yellow: number;
  act1Mode: RatioComparisonOrder;
  act1ShowBundles: boolean;
  // Activity 2: MIX_COLOR_RATIO
  act2BaseBlue: number;
  act2BaseYellow: number;
  act2Multiplier: number;
  act2TestBlue: number;
  act2TestYellow: number;
  act2ShowMl: boolean;
  // Activity 3: EQUIVALENT_RATIOS
  act3A: number;
  act3B: number;
  act3C: number;
  act3D: number;
  act3ScaleK: number;
  // Activity 4: DIVIDE_BY_RATIO
  act4Total: number;
  act4PartA: number;
  act4PartB: number;
  act4PartC: number;
  act4UseThreeGroups: boolean;
  act4IsDiscrete: boolean;
  act4UnitLabel: string;
  // Activity 5: PROPORTIONAL_QUANTITIES
  act5Tab: 'DIRECT' | 'INVERSE' | 'NON_PROP';
  act5DirectK: number;
  act5DirectX: number;
  act5InverseK: number;
  act5InverseX: number;
  // Activity 6: REAL_WORLD_CHALLENGE
  act6SubMode: 'RECIPE' | 'DRINK' | 'UNIT_CONVERT' | 'UNIT_PRICE';
  act6Servings: number;
  act6DrinkTotalMl: number;
  act6LeftValue: number;
  act6LeftUnit: 'mm' | 'cm' | 'm' | 'g' | 'kg' | 'mL' | 'L';
  act6RightValue: number;
  act6RightUnit: 'mm' | 'cm' | 'm' | 'g' | 'kg' | 'mL' | 'L';
  act6PackAQty: number;
  act6PackAPrice: number;
  act6PackBQty: number;
  act6PackBPrice: number;
}

const DEFAULT_STATE: M18PersistedState = {
  activeActivity: 'MIX_COLOR_RATIO',
  completedTaskIds: [],
  score: 0,
  streak: 0,
  act1Blue: 3,
  act1Yellow: 4,
  act1Mode: 'BLUE_TO_YELLOW',
  act1ShowBundles: true,
  act2BaseBlue: 2,
  act2BaseYellow: 3,
  act2Multiplier: 2,
  act2TestBlue: 4,
  act2TestYellow: 6,
  act2ShowMl: false,
  act3A: 2,
  act3B: 3,
  act3C: 4,
  act3D: 6,
  act3ScaleK: 2,
  act4Total: 20,
  act4PartA: 2,
  act4PartB: 3,
  act4PartC: 5,
  act4UseThreeGroups: false,
  act4IsDiscrete: true,
  act4UnitLabel: 'viên bi',
  act5Tab: 'DIRECT',
  act5DirectK: 8,
  act5DirectX: 3,
  act5InverseK: 24,
  act5InverseX: 4,
  act6SubMode: 'RECIPE',
  act6Servings: 10,
  act6DrinkTotalMl: 1000,
  act6LeftValue: 50,
  act6LeftUnit: 'cm',
  act6RightValue: 1,
  act6RightUnit: 'm',
  act6PackAQty: 3,
  act6PackAPrice: 24000,
  act6PackBQty: 5,
  act6PackBPrice: 35000,
};

const ORDER_LABELS_VI: Record<RatioComparisonOrder, string> = {
  BLUE_TO_YELLOW: 'Xanh : Vàng',
  YELLOW_TO_BLUE: 'Vàng : Xanh',
  BLUE_TO_TOTAL: 'Xanh : Tổng',
  YELLOW_TO_TOTAL: 'Vàng : Tổng',
};

export const M18RatioProportionTool: React.FC<M18RatioProportionToolProps> = ({
  onBackToHub,
  selectedClassName = 'Lớp 6A1',
  currentUserName = 'Học sinh THCS Tây Đô',
  onResultSaved,
  initialActivityPreset,
  onSwitchTool,
}) => {
  const [state, setState] = useState<M18PersistedState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_STATE, ...JSON.parse(raw) };
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_STATE;
  });

  const [mode, setMode] = useState<'EXPLORE' | 'CHALLENGE'>('EXPLORE');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [studentGroupInput, setStudentGroupInput] = useState(currentUserName);
  const [taskIndexByActivity, setTaskIndexByActivity] = useState<Record<M18ActivityId, number>>({
    CREATE_RATIO: 0,
    MIX_COLOR_RATIO: 0,
    EQUIVALENT_RATIOS: 0,
    DIVIDE_BY_RATIO: 0,
    PROPORTIONAL_QUANTITIES: 0,
    REAL_WORLD_CHALLENGE: 0,
  });

  const [stepWalkthroughIndex, setStepWalkthroughIndex] = useState<number>(0);
  const [isStirring, setIsStirring] = useState(false);
  const [showPredictionDrawer, setShowPredictionDrawer] = useState(false);
  const [predictionChoice, setPredictionChoice] = useState<
    'KEEP_COLOR' | 'DARKER_BLUE' | 'BRIGHTER_YELLOW' | null
  >(null);
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2 | 3>(0);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'warning' | 'info';
    title: string;
    detail: string;
  } | null>(null);
  const [selectedChoiceText, setSelectedChoiceText] = useState<string | null>(null);
  const [answerInputText, setAnswerInputText] = useState<string>('');
  const [showClassModal, setShowClassModal] = useState(false);

  useEffect(() => {
    if (
      initialActivityPreset &&
      M18_ACTIVITY_METADATA.some((a) => a.id === initialActivityPreset)
    ) {
      setState((prev) => ({
        ...prev,
        activeActivity: initialActivityPreset as M18ActivityId,
      }));
    }
  }, [initialActivityPreset]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  const activeActivityMeta = useMemo(
    () =>
      M18_ACTIVITY_METADATA.find((a) => a.id === state.activeActivity) ||
      M18_ACTIVITY_METADATA[1],
    [state.activeActivity]
  );

  const activityTasks = useMemo(
    () => M18_TASK_BANK.filter((t) => t.activityId === state.activeActivity),
    [state.activeActivity]
  );

  const currentTaskIdx = taskIndexByActivity[state.activeActivity] || 0;
  const currentTask: M18TaskSpec = activityTasks[currentTaskIdx] || activityTasks[0];

  const handleSelectActivity = (actId: M18ActivityId) => {
    setState((prev) => ({ ...prev, activeActivity: actId }));
    setStepWalkthroughIndex(0);
    setHintLevel(0);
    setSelectedChoiceText(null);
    setAnswerInputText('');
    setFeedback(null);
  };

  // Activity 1 computed evaluation
  const act1Eval = useMemo(
    () => evaluateRatioFromCounts(state.act1Blue, state.act1Yellow, state.act1Mode),
    [state.act1Blue, state.act1Yellow, state.act1Mode]
  );

  // Activity 2 computed evaluation
  const act2Eval = useMemo(
    () =>
      evaluateColorMixFormula(
        state.act2BaseBlue,
        state.act2BaseYellow,
        state.act2TestBlue,
        state.act2TestYellow,
        50
      ),
    [state.act2BaseBlue, state.act2BaseYellow, state.act2TestBlue, state.act2TestYellow]
  );

  // Activity 3 computed evaluation
  const act3Eval = useMemo(() => {
    const equal = areRatiosEqual(state.act3A, state.act3B, state.act3C, state.act3D);
    const crossProductLeft = state.act3A * state.act3D;
    const crossProductRight = state.act3B * state.act3C;
    const reasonVi = equal
      ? `Hai tỉ số bằng nhau vì tích chéo ${state.act3A} × ${state.act3D} = ${state.act3B} × ${state.act3C} = ${crossProductLeft}.`
      : `Hai tỉ số KHÔNG bằng nhau vì tích chéo ${state.act3A} × ${state.act3D} = ${crossProductLeft} ≠ ${state.act3B} × ${state.act3C} = ${crossProductRight}.`;
    return { equal, crossProductLeft, crossProductRight, reasonVi };
  }, [state.act3A, state.act3B, state.act3C, state.act3D]);

  // Activity 4 computed evaluation
  const act4Eval2 = useMemo(
    () =>
      divideTotalByRatio(
        state.act4Total,
        [state.act4PartA, state.act4PartB],
        state.act4IsDiscrete,
        state.act4UnitLabel
      ),
    [state.act4Total, state.act4PartA, state.act4PartB, state.act4IsDiscrete, state.act4UnitLabel]
  );

  const act4Eval3 = useMemo(
    () =>
      divideTotalByRatio(
        state.act4Total,
        [state.act4PartA, state.act4PartB, state.act4PartC],
        state.act4IsDiscrete,
        state.act4UnitLabel
      ),
    [
      state.act4Total,
      state.act4PartA,
      state.act4PartB,
      state.act4PartC,
      state.act4IsDiscrete,
      state.act4UnitLabel,
    ]
  );

  // Activity 5 computed evaluation
  const act5Eval = useMemo(() => {
    if (state.act5Tab === 'DIRECT') {
      return analyzeProportionalRelation('DIRECT', state.act5DirectK, [1, 2, 3, 4]);
    }
    if (state.act5Tab === 'INVERSE') {
      return analyzeProportionalRelation('INVERSE', state.act5InverseK, [1, 2, 3, 4]);
    }
    return analyzeProportionalRelation('NON_PROPORTIONAL_LINEAR', 2, [1, 2, 3, 4]);
  }, [state.act5Tab, state.act5DirectK, state.act5InverseK]);

  // Activity 6 computed evaluation
  const act6UnitEval = useMemo(
    () =>
      computeUnitAwareRatio(
        state.act6LeftValue,
        state.act6LeftUnit,
        state.act6RightValue,
        state.act6RightUnit
      ),
    [state.act6LeftValue, state.act6LeftUnit, state.act6RightValue, state.act6RightUnit]
  );

  // Handler for Activity 2 Multiplier ("Hệ số")
  const handleAct2MultiplierChange = (delta: number) => {
    setState((prev) => {
      const nextMult = Math.max(1, Math.min(4, prev.act2Multiplier + delta));
      return {
        ...prev,
        act2Multiplier: nextMult,
        act2TestBlue: prev.act2BaseBlue * nextMult,
        act2TestYellow: prev.act2BaseYellow * nextMult,
      };
    });
    setFeedback(null);
  };

  const handleAct2TestBlueChange = (delta: number) => {
    setState((prev) => {
      const nextBlue = Math.max(0, Math.min(12, prev.act2TestBlue + delta));
      const ratioMult =
        prev.act2BaseBlue > 0 &&
        nextBlue % prev.act2BaseBlue === 0 &&
        prev.act2TestYellow === (nextBlue / prev.act2BaseBlue) * prev.act2BaseYellow
          ? nextBlue / prev.act2BaseBlue
          : prev.act2Multiplier;
      return {
        ...prev,
        act2TestBlue: nextBlue,
        act2Multiplier: ratioMult,
      };
    });
    setFeedback(null);
  };

  const handleAct2TestYellowChange = (delta: number) => {
    setState((prev) => {
      const nextYellow = Math.max(0, Math.min(12, prev.act2TestYellow + delta));
      const ratioMult =
        prev.act2BaseYellow > 0 &&
        nextYellow % prev.act2BaseYellow === 0 &&
        prev.act2TestBlue === (nextYellow / prev.act2BaseYellow) * prev.act2BaseBlue
          ? nextYellow / prev.act2BaseYellow
          : prev.act2Multiplier;
      return {
        ...prev,
        act2TestYellow: nextYellow,
        act2Multiplier: ratioMult,
      };
    });
    setFeedback(null);
  };

  // Pour & Stir animation ("Pha thử")
  const handlePourAndMix = () => {
    setIsStirring(true);
    setTimeout(() => setIsStirring(false), 1200);

    if (state.activeActivity === 'MIX_COLOR_RATIO') {
      if (act2Eval.isSameRatio) {
        setFeedback({
          type: 'success',
          title: 'Màu pha trùng khớp hoàn toàn với công thức gốc!',
          detail: `${act2Eval.explanationVi} Tổng thể tích: ${act2Eval.mixTotalMl} mL.`,
        });
      } else {
        setFeedback({
          type: 'warning',
          title: act2Eval.isAdditiveTrap
            ? 'Cảnh báo bẫy cộng thêm cùng một số!'
            : 'Màu pha đã bị lệch khỏi công thức gốc!',
          detail: act2Eval.explanationVi,
        });
      }
    } else {
      handleStepWalkthrough();
    }
  };

  // Step-by-step pedagogical walkthrough ("Từng bước")
  const handleStepWalkthrough = () => {
    const nextStep = (stepWalkthroughIndex + 1) % 4;
    setStepWalkthroughIndex(nextStep);

    const stepsByAct: Record<M18ActivityId, string[]> = {
      CREATE_RATIO: [
        'Bước 1: Đếm số hạt Xanh lam và số hạt Vàng cam trên bàn thí nghiệm.',
        `Bước 2: Xác định đúng chiều tỉ số đang hỏi (${ORDER_LABELS_VI[state.act1Mode]}). Lưu ý a : b khác b : a!`,
        `Bước 3: Tỉ số ban đầu là ${act1Eval.colonNotation} (viết dạng phân số là ${act1Eval.fractionNotation}).`,
        `Bước 4: Chia cả hai phần cho ƯCLN = ${act1Eval.bundleCount} để được ${act1Eval.bundleCount} cụm bằng nhau → Tỉ số tối giản là ${act1Eval.simplifiedColonNotation}.`,
      ],
      MIX_COLOR_RATIO: [
        `Bước 1: Quan sát tầng trên (Công thức gốc): ${state.act2BaseBlue} cốc Xanh : ${state.act2BaseYellow} cốc Vàng.`,
        `Bước 2: Để giữ nguyên sắc độ xanh lá, số cốc Xanh và Vàng ở tầng dưới phải cùng nhân với một hệ số k (hiện tại Hệ số = ${state.act2Multiplier}).`,
        `Bước 3: Tầng dưới hiện có ${state.act2TestBlue} cốc Xanh và ${state.act2TestYellow} cốc Vàng → Tỉ số ${state.act2TestBlue} : ${state.act2TestYellow}.`,
        `Bước 4: ${act2Eval.explanationVi}`,
      ],
      EQUIVALENT_RATIOS: [
        `Bước 1: So sánh hai tỉ số ${state.act3A} : ${state.act3B} và ${state.act3C} : ${state.act3D} trên hai trục số song song.`,
        `Bước 2: Rút gọn hai tỉ số về dạng tối giản để đối chiếu các vạch tương ứng.`,
        `Bước 3: Kiểm tra tích chéo: ${state.act3A} × ${state.act3D} = ${act3Eval.crossProductLeft} và ${state.act3B} × ${state.act3C} = ${act3Eval.crossProductRight}.`,
        `Bước 4: Kết luận: ${act3Eval.reasonVi}`,
      ],
      DIVIDE_BY_RATIO: [
        `Bước 1: Tính tổng số phần bằng nhau: ${
          state.act4UseThreeGroups
            ? `${state.act4PartA} + ${state.act4PartB} + ${state.act4PartC} = ${act4Eval3.sumOfParts}`
            : `${state.act4PartA} + ${state.act4PartB} = ${act4Eval2.sumOfParts}`
        } phần.`,
        `Bước 2: Tính giá trị của 1 phần bằng cách lấy tổng ${state.act4Total} chia cho tổng số phần.`,
        `Bước 3: Nhân giá trị 1 phần với số phần của từng nhóm để tìm lượng mỗi nhóm nhận được.`,
        `Bước 4: ${state.act4UseThreeGroups ? act4Eval3.explanationVi : act4Eval2.explanationVi}`,
      ],
      PROPORTIONAL_QUANTITIES: [
        'Bước 1: Quan sát bảng giá trị của hai đại lượng x và y khi x thay đổi.',
        state.act5Tab === 'DIRECT'
          ? `Bước 2: Kiểm tra tỉ số y / x ở mọi cột: đều bằng hệ số k = ${state.act5DirectK} không đổi.`
          : state.act5Tab === 'INVERSE'
            ? `Bước 2: Kiểm tra tích x × y ở mọi cột: đều bằng hệ số k = ${state.act5InverseK} không đổi.`
            : 'Bước 2: Kiểm tra y = 2x + 3: tỉ số y/x thay đổi (5/1 ≠ 7/2) và tích x·y cũng thay đổi.',
        'Bước 3: Đối chiếu đồ thị trực quan (đường thẳng qua gốc O với tỉ lệ thuận, nhánh cong với tỉ lệ nghịch).',
        `Bước 4: ${act5Eval.explanationVi}`,
      ],
      REAL_WORLD_CHALLENGE: [
        'Bước 1: Đọc kỹ đề bài thực tế và kiểm tra đơn vị đo của các đại lượng.',
        'Bước 2: Nếu hai đại lượng khác đơn vị (ví dụ cm và m, g và kg), đổi về cùng đơn vị trước khi lập tỉ số.',
        'Bước 3: Tìm giá trị của 1 phần (hoặc 1 suất, 1 sản phẩm) rồi nhân theo yêu cầu.',
        'Bước 4: Kiểm tra lại kết quả xem có hợp lý với thực tế không.',
      ],
    };

    setFeedback({
      type: 'info',
      title: `Hướng dẫn từng bước (${nextStep + 1}/4)`,
      detail: stepsByAct[state.activeActivity][nextStep],
    });
  };

  // Reset current activity ("Làm lại")
  const handleResetCurrentActivity = () => {
    setStepWalkthroughIndex(0);
    setHintLevel(0);
    setSelectedChoiceText(null);
    setAnswerInputText('');
    setPredictionChoice(null);
    setFeedback(null);

    setState((prev) => {
      if (prev.activeActivity === 'CREATE_RATIO') {
        return { ...prev, act1Blue: 3, act1Yellow: 4, act1Mode: 'BLUE_TO_YELLOW' };
      }
      if (prev.activeActivity === 'MIX_COLOR_RATIO') {
        return {
          ...prev,
          act2BaseBlue: 2,
          act2BaseYellow: 3,
          act2Multiplier: 2,
          act2TestBlue: 4,
          act2TestYellow: 6,
        };
      }
      if (prev.activeActivity === 'EQUIVALENT_RATIOS') {
        return { ...prev, act3A: 2, act3B: 3, act3C: 4, act3D: 6, act3ScaleK: 2 };
      }
      if (prev.activeActivity === 'DIVIDE_BY_RATIO') {
        return {
          ...prev,
          act4Total: 20,
          act4PartA: 2,
          act4PartB: 3,
          act4UseThreeGroups: false,
          act4IsDiscrete: true,
        };
      }
      if (prev.activeActivity === 'PROPORTIONAL_QUANTITIES') {
        return { ...prev, act5Tab: 'DIRECT', act5DirectK: 8, act5DirectX: 3 };
      }
      return {
        ...prev,
        act6SubMode: 'RECIPE',
        act6Servings: 10,
        act6DrinkTotalMl: 1000,
      };
    });
  };

  // Reset all persisted data for M18 room only
  const handleClearRoomStorage = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setState(DEFAULT_STATE);
    setFeedback({
      type: 'info',
      title: 'Đã đặt lại dữ liệu phòng Khám phá tỉ số và tỉ lệ',
      detail: 'Toàn bộ tiến độ của phòng đã quay về trạng thái mặc định ban đầu.',
    });
  };

  // Validate task or interactive 3D stage ("Kiểm tra")
  const handleCheckAnswer = () => {
    if (currentTask && (selectedChoiceText !== null || answerInputText.trim().length > 0)) {
      let isCorrect = false;
      const cleaned = answerInputText.trim();

      if (currentTask.answerType === 'CHOICE' && selectedChoiceText !== null) {
        isCorrect = selectedChoiceText === currentTask.expectedChoice;
      } else if (currentTask.answerType === 'SINGLE_NUMBER' && cleaned.length > 0) {
        isCorrect = Number(cleaned) === currentTask.expectedNumber;
      } else if (currentTask.answerType === 'RATIO_PAIR' && currentTask.expectedRatio) {
        const parts = cleaned.split(/[:/,\s]+/).map(Number);
        if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
          if (currentTask.requireSimplifiedRatio) {
            isCorrect =
              parts[0] === currentTask.expectedRatio.a &&
              parts[1] === currentTask.expectedRatio.b;
          } else {
            isCorrect = areRatiosEqual(
              parts[0],
              parts[1],
              currentTask.expectedRatio.a,
              currentTask.expectedRatio.b
            );
          }
        }
      } else if (currentTask.answerType === 'PAIR_NUMBERS' && currentTask.expectedPair) {
        const parts = cleaned.split(/[;,\s:]+/).map(Number);
        if (parts.length >= 2) {
          isCorrect =
            parts[0] === currentTask.expectedPair.first &&
            parts[1] === currentTask.expectedPair.second;
        }
      }

      if (isCorrect) {
        const alreadyDone = state.completedTaskIds.includes(currentTask.id);
        setState((prev) => ({
          ...prev,
          score: alreadyDone ? prev.score : prev.score + 10,
          streak: prev.streak + 1,
          completedTaskIds: alreadyDone
            ? prev.completedTaskIds
            : [...prev.completedTaskIds, currentTask.id],
        }));
        setFeedback({
          type: 'success',
          title: 'Chính xác! Em đã nắm vững bản chất tỉ số và tỉ lệ!',
          detail: currentTask.explanationVi,
        });
      } else {
        setState((prev) => ({ ...prev, streak: 0 }));
        setFeedback({
          type: 'warning',
          title: 'Chưa chính xác — Hãy kiểm tra lại mối quan hệ tỉ số!',
          detail: `${currentTask.hints[1]} (${currentTask.explanationVi})`,
        });
      }
      return;
    }

    // Otherwise validate interactive 3D stage state directly
    if (state.activeActivity === 'MIX_COLOR_RATIO') {
      if (act2Eval.isSameRatio) {
        const predBonus =
          predictionChoice === 'KEEP_COLOR'
            ? ' Dự đoán của em hoàn toàn chính xác: sắc độ màu không đổi!'
            : '';
        setFeedback({
          type: 'success',
          title: `Đúng công thức! ${state.act2BaseBlue} : ${state.act2BaseYellow} = ${state.act2TestBlue} : ${state.act2TestYellow}`,
          detail: `${act2Eval.explanationVi}${predBonus}`,
        });
      } else {
        setFeedback({
          type: 'warning',
          title: act2Eval.isAdditiveTrap
            ? 'Phát hiện lỗi cộng thêm cùng một số vào hai phần!'
            : `Tỉ số ${state.act2TestBlue} : ${state.act2TestYellow} không bằng ${state.act2BaseBlue} : ${state.act2BaseYellow}!`,
          detail: act2Eval.explanationVi,
        });
      }
      return;
    }

    if (state.activeActivity === 'CREATE_RATIO') {
      if (act1Eval.status === 'VALID') {
        setFeedback({
          type: 'success',
          title: `Tỉ số hợp lệ: ${act1Eval.colonNotation} (Rút gọn: ${act1Eval.simplifiedColonNotation})`,
          detail: act1Eval.explanationVi,
        });
      } else {
        setFeedback({
          type: 'warning',
          title: 'Không thể lập tỉ số khi phần làm chuẩn bằng 0!',
          detail: act1Eval.explanationVi,
        });
      }
      return;
    }

    if (state.activeActivity === 'EQUIVALENT_RATIOS') {
      setFeedback({
        type: act3Eval.equal ? 'success' : 'warning',
        title: act3Eval.equal
          ? `Hai tỉ số bằng nhau: ${state.act3A} : ${state.act3B} = ${state.act3C} : ${state.act3D}`
          : `Hai tỉ số chưa bằng nhau: ${state.act3A} : ${state.act3B} ≠ ${state.act3C} : ${state.act3D}`,
        detail: act3Eval.reasonVi,
      });
      return;
    }

    if (state.activeActivity === 'DIVIDE_BY_RATIO') {
      const res = state.act4UseThreeGroups ? act4Eval3 : act4Eval2;
      setFeedback({
        type: res.status === 'VALID' ? 'success' : 'warning',
        title:
          res.status === 'VALID'
            ? 'Phép chia theo tỉ lệ hợp lệ!'
            : 'Không chia chẵn được cho vật rời!',
        detail: res.explanationVi,
      });
      return;
    }

    if (state.activeActivity === 'PROPORTIONAL_QUANTITIES') {
      setFeedback({
        type: 'success',
        title:
          act5Eval.mode === 'DIRECT'
            ? `Đại lượng tỉ lệ thuận: ${act5Eval.formulaText}`
            : act5Eval.mode === 'INVERSE'
              ? `Đại lượng tỉ lệ nghịch: ${act5Eval.formulaText}`
              : 'Hai đại lượng không tỉ lệ thuận cũng không tỉ lệ nghịch!',
        detail: act5Eval.explanationVi,
      });
      return;
    }

    if (state.activeActivity === 'REAL_WORLD_CHALLENGE') {
      setFeedback({
        type: act6UnitEval.status !== 'INVALID' ? 'success' : 'warning',
        title: 'Đã kiểm tra bài toán thực tế!',
        detail: act6UnitEval.explanationVi,
      });
    }
  };

  const handleSaveProgressToClass = () => {
    const newRecord: MathActivityResultRecord = {
      id: `m18_res_${Date.now()}`,
      toolId: 'M18',
      activityId: state.activeActivity,
      studentName: studentGroupInput.trim() || currentUserName,
      className: selectedClassName,
      completedSteps: [
        'PREDICT',
        'MANIPULATE',
        'OBSERVE',
        'EXPLAIN',
        'CONCLUDE',
        'PRACTICE',
      ],
      predictionText: predictionChoice || 'Dự đoán tỉ số tương đương',
      conclusionText: `${activeActivityMeta.shortTitle}: hoàn thành ${state.completedTaskIds.length}/${M18_TASK_BANK.length} nhiệm vụ.`,
      practiceAnswer: `${state.act2BaseBlue}:${state.act2BaseYellow} = ${state.act2TestBlue}:${state.act2TestYellow}`,
      isCorrect: true,
      score: state.score,
      maxScore: M18_TASK_BANK.length * 10,
      completedAt: new Date().toISOString(),
    };
    onResultSaved?.(newRecord);
    setShowClassModal(false);
    setFeedback({
      type: 'success',
      title: 'Đã lưu kết quả vào sổ điểm Smart EDU!',
      detail: `Điểm hiện tại: ${state.score} điểm (${state.completedTaskIds.length}/${M18_TASK_BANK.length} nhiệm vụ).`,
    });
  };

  const renderSidebarIcon = (id: M18ActivityId, isActive: boolean) => {
    const cls = 'w-4 h-4 text-white';
    const bgCls = isActive
      ? 'bg-[#EA580C] shadow-xs'
      : 'bg-[#14532D] group-hover:bg-[#166534]';
    const icon = (() => {
      switch (id) {
        case 'CREATE_RATIO':
          return <Layers className={cls} />;
        case 'MIX_COLOR_RATIO':
          return <Palette className={cls} />;
        case 'EQUIVALENT_RATIOS':
          return <Equal className={cls} />;
        case 'DIVIDE_BY_RATIO':
          return <PieChart className={cls} />;
        case 'PROPORTIONAL_QUANTITIES':
          return <BarChart3 className={cls} />;
        case 'REAL_WORLD_CHALLENGE':
          return <ShoppingBasket className={cls} />;
      }
    })();

    return (
      <span
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${bgCls}`}
      >
        {icon}
      </span>
    );
  };

  const lowerPedestalLabelVi = useMemo(() => {
    if (
      state.act2TestBlue === state.act2BaseBlue * 2 &&
      state.act2TestYellow === state.act2BaseYellow * 2
    ) {
      return 'Gấp đôi lượng pha';
    }
    if (
      state.act2TestBlue === state.act2BaseBlue * 3 &&
      state.act2TestYellow === state.act2BaseYellow * 3
    ) {
      return 'Gấp ba lượng pha';
    }
    if (
      state.act2TestBlue === state.act2BaseBlue &&
      state.act2TestYellow === state.act2BaseYellow
    ) {
      return 'Bằng lượng công thức gốc';
    }
    return `Mẻ pha thử (${state.act2TestBlue} Xanh : ${state.act2TestYellow} Vàng)`;
  }, [state.act2BaseBlue, state.act2BaseYellow, state.act2TestBlue, state.act2TestYellow]);

  return (
    <div
      className={`${
        isFullscreen ? 'fixed inset-0 z-50 overflow-y-auto' : 'min-h-screen'
      } bg-gradient-to-b from-[#F4EFE6] via-[#EFE7DA] to-[#E6DEC8] text-[#1E293B] font-sans select-none flex flex-col rounded-3xl overflow-hidden border border-[#DED4C1] shadow-xl`}
    >
      {/* =================================================================== */}
      {/* TOP HEADER BAR (Đồng bộ M07, M05 và khớp ảnh mẫu đính kèm)          */}
      {/* =================================================================== */}
      <header className="px-4 py-2.5 bg-gradient-to-r from-[#F9F6F0] via-[#F5EFE4] to-[#F9F6F0] border-b border-[#DED4C1] shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#166534] to-[#0F5132] flex items-center justify-center shadow-sm border border-[#F59E0B]/40">
              <BookOpen className="w-5 h-5 text-[#FDE047]" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-black tracking-tight text-[#0F5132]">
                TÂY ĐÔ SMART EDU
              </div>
              <div className="text-[10px] font-bold text-[#64748B]">
                HỆ SINH THÁI GIÁO DỤC 3D
              </div>
            </div>
          </div>

          <div className="h-6 w-[1.5px] bg-[#D5C9B4] hidden sm:block" />

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-[#EA580C] to-[#F97316] text-white text-xs font-extrabold shadow-xs">
            <FlaskConical className="w-3.5 h-3.5" />
            <span>SMART MATH LAB</span>
          </div>
        </div>

        {/* Center Dark-Green Pill Title */}
        <div className="px-6 py-1.5 rounded-full bg-gradient-to-r from-[#0F5132] via-[#14532D] to-[#0F5132] text-white font-black text-base sm:text-lg tracking-wide shadow-md border-2 border-[#D7C9B1]">
          Khám phá tỉ số và tỉ lệ
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {onSwitchTool && (
            <div className="hidden xl:flex items-center gap-1 bg-[#EFE8D8] px-2 py-1 rounded-full border border-[#D6C9B3] text-[11px] font-extrabold">
              <button
                onClick={() => onSwitchTool('M07')}
                className="px-2 py-0.5 rounded-full hover:bg-white text-[#0F5132] transition cursor-pointer"
                title="Chuyển sang phòng Số nguyên và trục số"
              >
                Số nguyên
              </button>
              <span className="text-[#94A3B8]">•</span>
              <button
                onClick={() => onSwitchTool('M05')}
                className="px-2 py-0.5 rounded-full hover:bg-white text-[#0F5132] transition cursor-pointer"
                title="Chuyển sang phòng Khám phá phân số"
              >
                Phân số
              </button>
            </div>
          )}

          <button
            onClick={onBackToHub}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF6EE] hover:bg-white text-[#1E293B] text-xs font-extrabold border border-[#D6C9B3] shadow-2xs transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#0F5132]" />
            <span>Về thư viện</span>
          </button>

          <button
            onClick={() => setMode('EXPLORE')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-extrabold transition cursor-pointer border ${
              mode === 'EXPLORE'
                ? 'bg-gradient-to-r from-[#15803D] to-[#0F5132] text-white border-[#0F5132] shadow-sm'
                : 'bg-[#FAF6EE] text-[#334155] border-[#D6C9B3] hover:bg-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Khám phá</span>
          </button>

          <button
            onClick={() => setMode('CHALLENGE')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-extrabold transition cursor-pointer border ${
              mode === 'CHALLENGE'
                ? 'bg-gradient-to-r from-[#EA580C] to-[#D97706] text-white border-[#C2410C] shadow-sm'
                : 'bg-[#FAF6EE] text-[#334155] border-[#D6C9B3] hover:bg-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-[#D97706]" />
            <span>Thử thách</span>
          </button>

          <button
            onClick={() => setShowClassModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF6EE] hover:bg-white text-[#0F5132] text-xs font-extrabold border border-[#D6C9B3] shadow-2xs transition cursor-pointer"
            title="Lưu kết quả vào lớp học"
          >
            <Users className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Lớp học ({state.score}đ)</span>
          </button>

          <button
            onClick={() => setMuted((m) => !m)}
            className="p-1.5 rounded-full bg-[#FAF6EE] hover:bg-white text-[#334155] border border-[#D6C9B3] shadow-2xs cursor-pointer"
            title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setIsFullscreen((f) => !f)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF6EE] hover:bg-white text-[#1E293B] text-xs font-extrabold border border-[#D6C9B3] shadow-2xs transition cursor-pointer"
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Toàn màn hình</span>
          </button>
        </div>
      </header>

      {/* =================================================================== */}
      {/* MAIN 3-COLUMN WORKSPACE                                             */}
      {/* =================================================================== */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 px-3.5 pt-2.5 pb-2 max-w-[1600px] w-full mx-auto items-stretch">
        {/* LEFT SIDEBAR: 6 HOẠT ĐỘNG */}
        <aside className="lg:col-span-2 bg-[#F8F3E8]/95 rounded-3xl p-2.5 border-2 border-[#DFD4C0] shadow-md flex flex-col justify-between">
          <div>
            <div className="px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-[#0F5132] to-[#166534] text-white font-extrabold text-sm flex items-center gap-2 shadow-xs mb-2.5">
              <Layers className="w-4 h-4 text-[#86EFAC]" />
              <span>6 hoạt động</span>
            </div>

            <div className="space-y-2">
              {M18_ACTIVITY_METADATA.map((act) => {
                const isActive = state.activeActivity === act.id;
                return (
                  <button
                    key={act.id}
                    onClick={() => handleSelectActivity(act.id)}
                    className={`group w-full flex items-center justify-between gap-2 px-2.5 py-2.5 rounded-2xl text-left transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-gradient-to-r from-[#FDBA74]/50 via-[#FED7AA]/75 to-[#FDBA74]/60 border-[#EA580C] text-[#7C2D12] shadow-sm scale-[1.01]'
                        : 'bg-[#F4EFE4] hover:bg-white text-[#1E293B] border-[#E2D8C5]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {renderSidebarIcon(act.id, isActive)}
                      <span className="text-xs font-extrabold leading-snug truncate">
                        {act.shortTitle}
                      </span>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-[#C2410C]' : 'text-[#64748B]'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#E2D8C5] space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#475569] px-1">
              <span>Hoàn thành:</span>
              <span className="font-black text-[#0F5132]">
                {state.completedTaskIds.length}/{M18_TASK_BANK.length} nhiệm vụ
              </span>
            </div>
            <button
              onClick={handleClearRoomStorage}
              className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#EFE8D8] hover:bg-[#E5DEC9] text-[#475569] text-[11px] font-bold transition cursor-pointer"
              title="Chỉ xóa dữ liệu lưu cục bộ của phòng Khám phá tỉ số và tỉ lệ"
            >
              <Trash2 className="w-3 h-3" />
              <span>Đặt lại dữ liệu phòng</span>
            </button>
          </div>
        </aside>

        {/* CENTER 3D LAB STAGE */}
        <main className="lg:col-span-7 relative rounded-3xl border-2 border-[#DFD4C0] shadow-lg overflow-hidden flex flex-col justify-between bg-gradient-to-b from-[#EFE7D6] via-[#F7F2E7] to-[#E6DBC6]">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-[66%] bg-gradient-to-b from-[#DFD3BD]/75 via-[#EFE7D8]/60 to-[#F7F3EA]" />
            <div className="absolute inset-x-0 bottom-0 h-[34%] bg-gradient-to-b from-[#E5D7C1] via-[#EFE5D4] to-[#DFCFAE] border-t-2 border-[#D4C3A8]" />

            <div className="absolute left-3 top-3 w-28 h-36 opacity-45">
              <svg viewBox="0 0 120 150" className="w-full h-full">
                <path d="M 35 120 Q 10 80 28 35 Q 50 65 45 120 Z" fill="#15803D" />
                <path d="M 45 120 Q 45 60 75 25 Q 80 75 55 120 Z" fill="#16A34A" />
                <path d="M 52 120 Q 85 75 105 55 Q 88 100 58 120 Z" fill="#22C55E" />
              </svg>
            </div>

            <div className="absolute right-4 top-8 w-52 h-32 opacity-45 hidden sm:block">
              <svg viewBox="0 0 220 120" className="w-full h-full">
                <rect x="10" y="96" width="200" height="8" rx="4" fill="#B49B78" />
                <path d="M 48 36 L 48 56 L 30 94 L 78 94 L 60 56 L 60 36 Z" fill="rgba(255,255,255,0.7)" stroke="#94A3B8" strokeWidth="2" />
                <path d="M 34 80 L 74 80 L 77 93 L 31 93 Z" fill="#38BDF8" opacity="0.65" />
                <rect x="102" y="42" width="38" height="52" rx="6" fill="rgba(255,255,255,0.7)" stroke="#94A3B8" strokeWidth="2" />
                <rect x="104" y="64" width="34" height="28" rx="4" fill="#2563EB" opacity="0.65" />
                <rect x="154" y="50" width="32" height="44" rx="5" fill="rgba(255,255,255,0.7)" stroke="#94A3B8" strokeWidth="2" />
                <rect x="156" y="68" width="28" height="24" rx="3" fill="#FACC15" opacity="0.7" />
              </svg>
            </div>
          </div>

          {/* Top Floating Banner Pill */}
          <div className="relative z-10 pt-3 px-4 flex justify-center">
            <div className="inline-flex items-center gap-2.5 px-7 py-2 rounded-full bg-gradient-to-b from-[#FCF9F2] to-[#EFE6D4] border-2 border-[#D7C9B1] shadow-md">
              <FlaskConical className="w-5 h-5 text-[#15803D]" />
              <span className="text-base sm:text-xl font-black text-[#1E293B]">
                {activeActivityMeta.stageHeadline}
              </span>
            </div>
          </div>

          {/* DYNAMIC 3D STAGE CONTENT BY ACTIVITY */}
          <div className="relative z-10 flex-1 flex flex-col justify-center px-3 py-2">
            {/* ACTIVITY 2: PHA MÀU THEO TỈ LỆ */}
            {state.activeActivity === 'MIX_COLOR_RATIO' && (
              <div className="flex flex-col items-center">
                <div className="w-full flex flex-col md:flex-row items-end justify-center gap-2 lg:gap-3">
                  <div className="shrink-0 -mb-2 hidden sm:block">
                    <RatioLabRobot3D
                      mood={act2Eval.isSameRatio ? 'happy' : 'thinking'}
                      speechText={
                        act2Eval.isSameRatio
                          ? 'Cùng tỉ số 2:3 nên màu xanh lá giống hệt nhau!'
                          : 'Ôi! Tỉ số lệch rồi, sắc độ màu đã đổi khác!'
                      }
                    />
                  </div>

                  {/* Center: 2-Tier 3D Cream Lab Pedestal */}
                  <div className="flex-1 max-w-[540px] w-full flex flex-col items-center">
                    <div className="flex items-end justify-center gap-1.5 sm:gap-2.5 px-3 -mb-2 z-20 flex-wrap">
                      {Array.from({ length: state.act2BaseBlue }).map((_, i) => (
                        <GlassBeaker3D
                          key={`base-b-${i}`}
                          liquidColor="#1D4ED8"
                          size="md"
                          label={state.act2ShowMl ? '50mL' : undefined}
                        />
                      ))}
                      {Array.from({ length: state.act2BaseYellow }).map((_, i) => (
                        <GlassBeaker3D
                          key={`base-y-${i}`}
                          liquidColor="#FACC15"
                          size="md"
                          label={state.act2ShowMl ? '50mL' : undefined}
                        />
                      ))}
                    </div>

                    <div className="w-[86%] rounded-2xl bg-gradient-to-b from-[#FAF5EB] via-[#EFE5D4] to-[#DFD1B8] border-2 border-[#D2C2A8] shadow-md py-2 px-4 flex justify-center relative z-10">
                      <div className="px-5 py-1 rounded-xl bg-gradient-to-b from-[#F5EDE0] to-[#E6D8C0] border border-[#C8B698] shadow-xs text-xs sm:text-sm font-black text-[#1E293B]">
                        Công thức gốc
                      </div>
                    </div>

                    <div className="flex items-end justify-center gap-1 sm:gap-1.5 px-2 mt-2 -mb-2 z-20 flex-wrap">
                      {Array.from({ length: Math.min(state.act2TestBlue, 8) }).map((_, i) => (
                        <GlassBeaker3D
                          key={`test-b-${i}`}
                          liquidColor="#1D4ED8"
                          size={state.act2TestBlue + state.act2TestYellow > 10 ? 'sm' : 'md'}
                          onClick={() => handleAct2TestBlueChange(-1)}
                        />
                      ))}
                      {Array.from({ length: Math.min(state.act2TestYellow, 8) }).map((_, i) => (
                        <GlassBeaker3D
                          key={`test-y-${i}`}
                          liquidColor="#FACC15"
                          size={state.act2TestBlue + state.act2TestYellow > 10 ? 'sm' : 'md'}
                          onClick={() => handleAct2TestYellowChange(-1)}
                        />
                      ))}
                      {state.act2TestBlue + state.act2TestYellow === 0 && (
                        <div className="py-4 text-xs font-extrabold text-[#B91C1C]">
                          Chưa có cốc màu nào trên khay thử! Hãy tăng số phần Xanh hoặc Vàng.
                        </div>
                      )}
                    </div>

                    <div className="w-full rounded-2xl bg-gradient-to-b from-[#FAF5EB] via-[#EFE5D4] to-[#DACAAEE6] border-2 border-[#CBB99B] shadow-lg py-2.5 px-4 flex justify-center relative z-10">
                      <div className="px-5 py-1 rounded-xl bg-gradient-to-b from-[#F5EDE0] to-[#E6D8C0] border border-[#C8B698] shadow-xs text-xs sm:text-sm font-black text-[#1E293B]">
                        {lowerPedestalLabelVi}
                      </div>
                    </div>
                  </div>

                  {/* Right: Large Graduated Mixing Pitcher with Stirring Rod */}
                  <div className="shrink-0 flex flex-col items-center">
                    <MixingPitcherWithRod3D
                      mixedColorHex={act2Eval.conventionalColorHex}
                      totalParts={state.act2TestBlue + state.act2TestYellow}
                      isStirring={isStirring}
                      label={
                        state.act2ShowMl
                          ? `${act2Eval.mixTotalMl} mL`
                          : act2Eval.conventionalColorNameVi
                      }
                    />
                  </div>
                </div>

                {/* Formula Pill Below Pedestal: 2 : 3 = 4 : 6  |  Xanh : Vàng */}
                <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
                  <div
                    className={`px-6 py-1.5 rounded-full bg-[#FAF7F0] border-2 shadow-sm flex items-center gap-2 text-xl sm:text-2xl font-black ${
                      act2Eval.isSameRatio
                        ? 'border-[#15803D]'
                        : 'border-[#EA580C]'
                    }`}
                  >
                    <span className="text-[#1D4ED8]">{state.act2BaseBlue}</span>
                    <span className="text-[#1E293B]">:</span>
                    <span className="text-[#EA580C]">{state.act2BaseYellow}</span>
                    <span
                      className={`mx-1 ${
                        act2Eval.isSameRatio ? 'text-[#15803D]' : 'text-[#DC2626]'
                      }`}
                    >
                      {act2Eval.isSameRatio ? '=' : '≠'}
                    </span>
                    <span className="text-[#1D4ED8]">{state.act2TestBlue}</span>
                    <span className="text-[#1E293B]">:</span>
                    <span className="text-[#EA580C]">{state.act2TestYellow}</span>
                  </div>

                  <div className="h-7 w-[1.5px] bg-[#C8B99E] hidden sm:block" />

                  <div className="px-4 py-1.5 rounded-full bg-[#FAF7F0] border border-[#D4C6AE] shadow-xs flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[#1E293B]">
                    <span className="w-4 h-4 rounded-sm bg-[#1D4ED8] inline-block shadow-2xs" />
                    <span>Xanh</span>
                    <span className="font-black">:</span>
                    <span className="w-4 h-4 rounded-sm bg-[#FACC15] inline-block shadow-2xs border border-[#CA8A04]" />
                    <span>Vàng</span>
                  </div>

                  <button
                    onClick={() =>
                      setState((prev) => ({ ...prev, act2ShowMl: !prev.act2ShowMl }))
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-extrabold border transition cursor-pointer ${
                      state.act2ShowMl
                        ? 'bg-[#0F5132] text-white border-[#0F5132]'
                        : 'bg-[#FAF7F0] text-[#334155] border-[#D4C6AE] hover:bg-white'
                    }`}
                  >
                    {state.act2ShowMl ? 'Đơn vị: 50 mL/phần' : 'Đổi sang mL (50 mL/phần)'}
                  </button>
                </div>
              </div>
            )}

            {/* ACTIVITY 1: TẠO TỈ SỐ */}
            {state.activeActivity === 'CREATE_RATIO' && (
              <div className="flex flex-col items-center gap-3">
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {(
                    [
                      { id: 'BLUE_TO_YELLOW', label: 'Xanh : Vàng' },
                      { id: 'YELLOW_TO_BLUE', label: 'Vàng : Xanh (Đổi chiều)' },
                      { id: 'BLUE_TO_TOTAL', label: 'Xanh : Tổng' },
                      { id: 'YELLOW_TO_TOTAL', label: 'Vàng : Tổng' },
                    ] as { id: RatioComparisonOrder; label: string }[]
                  ).map((q) => (
                    <button
                      key={q.id}
                      onClick={() =>
                        setState((prev) => ({ ...prev, act1Mode: q.id }))
                      }
                      className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold border transition cursor-pointer ${
                        state.act1Mode === q.id
                          ? 'bg-[#0F5132] text-white border-[#0F5132] shadow-xs'
                          : 'bg-white/90 text-[#334155] border-[#D4C6AE] hover:bg-white'
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>

                <div className="w-full max-w-[620px] rounded-3xl bg-gradient-to-b from-[#FAF5EB] to-[#E6D8C0] border-2 border-[#CBB99B] shadow-md p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3 bg-white/80 rounded-2xl px-4 py-2.5 border border-[#DBEAFE]">
                    <span className="text-xs font-black text-[#1D4ED8] min-w-[90px]">
                      Xanh lam ({state.act1Blue})
                    </span>
                    <div className="flex-1 flex items-center justify-center gap-2 flex-wrap min-h-[42px]">
                      {Array.from({ length: state.act1Blue }).map((_, i) => (
                        <GlossySphere3D
                          key={`s-b-${i}`}
                          colorType="blue"
                          size={38}
                          badge={i + 1}
                        />
                      ))}
                      {state.act1Blue === 0 && (
                        <span className="text-xs font-bold text-[#64748B] italic">
                          0 hạt Xanh
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 bg-white/80 rounded-2xl px-4 py-2.5 border border-[#FEF08A]">
                    <span className="text-xs font-black text-[#B45309] min-w-[90px]">
                      Vàng cam ({state.act1Yellow})
                    </span>
                    <div className="flex-1 flex items-center justify-center gap-2 flex-wrap min-h-[42px]">
                      {Array.from({ length: state.act1Yellow }).map((_, i) => (
                        <GlossySphere3D
                          key={`s-y-${i}`}
                          colorType="yellow"
                          size={38}
                          badge={i + 1}
                        />
                      ))}
                      {state.act1Yellow === 0 && (
                        <span className="text-xs font-bold text-[#64748B] italic">
                          0 hạt Vàng
                        </span>
                      )}
                    </div>
                  </div>

                  {act1Eval.status === 'VALID' && act1Eval.bundleCount > 1 && (
                    <div className="rounded-2xl bg-[#F0FDF4] border border-[#86EFAC] px-3.5 py-2 text-center">
                      <div className="text-xs font-black text-[#15803D]">
                        Gom thành {act1Eval.bundleCount} cụm đều nhau (ƯCLN = {act1Eval.bundleCount}): mỗi cụm gồm {act1Eval.bluePerBundle} hạt Xanh : {act1Eval.yellowPerBundle} hạt Vàng
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <div className="px-5 py-1.5 rounded-full bg-[#FAF7F0] border-2 border-[#0F5132] shadow-xs text-sm sm:text-base font-black text-[#1E293B]">
                    {ORDER_LABELS_VI[state.act1Mode]}:{' '}
                    <span className="text-[#1D4ED8] text-lg">{act1Eval.colonNotation}</span>
                    {act1Eval.status === 'VALID' && (
                      <>
                        {' '}
                        <span className="text-[#64748B]">| Phân số:</span>{' '}
                        <span className="text-[#15803D]">{act1Eval.fractionNotation}</span>
                        {' '}
                        <span className="text-[#64748B]">| Tối giản:</span>{' '}
                        <span className="text-[#EA580C]">{act1Eval.simplifiedColonNotation}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ACTIVITY 3: TỈ SỐ BẰNG NHAU */}
            {state.activeActivity === 'EQUIVALENT_RATIOS' && (
              <div className="flex flex-col items-center gap-3 px-2">
                <div className="w-full max-w-[630px]">
                  <DoubleNumberLineSVG
                    baseA={state.act3A}
                    baseB={state.act3B}
                    activeMultiplier={state.act3ScaleK}
                    maxStep={5}
                    labelA="Đại lượng A"
                    labelB="Đại lượng B"
                  />
                </div>

                <div className="w-full max-w-[630px] grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="rounded-2xl bg-[#FAF7F0] border border-[#D4C6AE] p-3 shadow-xs">
                    <div className="text-xs font-black text-[#0F5132] mb-1.5">
                      Bảng tỉ số tương ứng (Nhân/chia cùng hệ số k ≠ 0)
                    </div>
                    <table className="w-full text-center text-xs font-extrabold border-collapse">
                      <thead>
                        <tr className="bg-[#EFE8D8] text-[#475569]">
                          <th className="p-1.5 border border-[#D4C6AE]">Hệ số</th>
                          <th className="p-1.5 border border-[#D4C6AE]">×1 (Gốc)</th>
                          <th className="p-1.5 border border-[#D4C6AE]">×2</th>
                          <th className="p-1.5 border border-[#D4C6AE]">×3</th>
                          <th className="p-1.5 border border-[#D4C6AE] bg-[#DCFCE7] text-[#15803D]">
                            Đang chọn
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="p-1.5 border border-[#D4C6AE] text-[#1D4ED8]">Hàng A</td>
                          <td className="p-1.5 border border-[#D4C6AE]">{state.act3A}</td>
                          <td className="p-1.5 border border-[#D4C6AE]">{state.act3A * 2}</td>
                          <td className="p-1.5 border border-[#D4C6AE]">{state.act3A * 3}</td>
                          <td className="p-1.5 border border-[#D4C6AE] bg-[#F0FDF4] text-[#15803D] font-black">
                            {state.act3C}
                          </td>
                        </tr>
                        <tr>
                          <td className="p-1.5 border border-[#D4C6AE] text-[#D97706]">Hàng B</td>
                          <td className="p-1.5 border border-[#D4C6AE]">{state.act3B}</td>
                          <td className="p-1.5 border border-[#D4C6AE]">{state.act3B * 2}</td>
                          <td className="p-1.5 border border-[#D4C6AE]">{state.act3B * 3}</td>
                          <td className="p-1.5 border border-[#D4C6AE] bg-[#F0FDF4] text-[#15803D] font-black">
                            {state.act3D}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="rounded-2xl bg-[#FAF7F0] border border-[#D4C6AE] p-3 shadow-xs flex flex-col justify-between">
                    <div className="text-xs font-black text-[#0F5132]">
                      Kiểm tra tính chất tỉ lệ thức (Tích chéo a·d = b·c)
                    </div>
                    <div className="my-1.5 text-sm font-black text-center py-2 rounded-xl bg-white border border-[#E2D8C5]">
                      <span className="text-[#1D4ED8]">{state.act3A}</span> ×{' '}
                      <span className="text-[#D97706]">{state.act3D}</span> ={' '}
                      <span>{act3Eval.crossProductLeft}</span>
                      <span className="mx-2 text-[#15803D]">
                        {act3Eval.equal ? '=' : '≠'}
                      </span>
                      <span className="text-[#D97706]">{state.act3B}</span> ×{' '}
                      <span className="text-[#1D4ED8]">{state.act3C}</span> ={' '}
                      <span>{act3Eval.crossProductRight}</span>
                    </div>
                    <div
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                        act3Eval.equal
                          ? 'bg-[#DCFCE7] text-[#15803D]'
                          : 'bg-[#FFEDD5] text-[#C2410C]'
                      }`}
                    >
                      {act3Eval.reasonVi}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ACTIVITY 4: CHIA THEO TỈ LỆ */}
            {state.activeActivity === 'DIVIDE_BY_RATIO' && (
              <div className="flex flex-col items-center gap-3 px-3">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={() =>
                      setState((prev) => ({ ...prev, act4UseThreeGroups: false }))
                    }
                    className={`px-3.5 py-1 rounded-full text-xs font-extrabold border cursor-pointer ${
                      !state.act4UseThreeGroups
                        ? 'bg-[#0F5132] text-white border-[#0F5132]'
                        : 'bg-white text-[#334155] border-[#D4C6AE]'
                    }`}
                  >
                    Chia 2 nhóm (a : b)
                  </button>
                  <button
                    onClick={() =>
                      setState((prev) => ({ ...prev, act4UseThreeGroups: true }))
                    }
                    className={`px-3.5 py-1 rounded-full text-xs font-extrabold border cursor-pointer ${
                      state.act4UseThreeGroups
                        ? 'bg-[#0F5132] text-white border-[#0F5132]'
                        : 'bg-white text-[#334155] border-[#D4C6AE]'
                    }`}
                  >
                    Mở rộng 3 nhóm (a : b : c)
                  </button>
                  <button
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        act4IsDiscrete: !prev.act4IsDiscrete,
                        act4UnitLabel: !prev.act4IsDiscrete ? 'viên bi' : 'mL nước',
                      }))
                    }
                    className="px-3.5 py-1 rounded-full text-xs font-extrabold bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B] cursor-pointer"
                  >
                    Loại đại lượng: {state.act4IsDiscrete ? 'Vật rời (số nguyên)' : 'Liên tục (chia thập phân)'}
                  </button>
                </div>

                <div className="w-full max-w-[620px] rounded-3xl bg-[#FAF7F0] border-2 border-[#CBB99B] p-4 shadow-md space-y-3">
                  <div className="flex items-center justify-between text-xs font-black text-[#1E293B]">
                    <span>
                      Tổng lượng cần chia: S = {state.act4Total} ({state.act4UnitLabel})
                    </span>
                    <span className="text-[#0F5132]">
                      Tổng số phần ={' '}
                      {state.act4UseThreeGroups
                        ? `${state.act4PartA} + ${state.act4PartB} + ${state.act4PartC} = ${act4Eval3.sumOfParts}`
                        : `${state.act4PartA} + ${state.act4PartB} = ${act4Eval2.sumOfParts}`}{' '}
                      phần
                    </span>
                  </div>

                  <div className="flex items-center gap-1 w-full h-11 rounded-xl bg-[#E2D8C5] p-1">
                    {Array.from({ length: state.act4PartA }).map((_, i) => (
                      <div
                        key={`pa-${i}`}
                        className="flex-1 h-full rounded-lg bg-gradient-to-b from-[#3B82F6] to-[#1D4ED8] text-white text-[11px] font-black flex items-center justify-center shadow-2xs"
                      >
                        {state.act4UseThreeGroups
                          ? act4Eval3.status === 'VALID'
                            ? Number(act4Eval3.onePartDecimal.toFixed(1))
                            : '?'
                          : act4Eval2.status === 'VALID'
                            ? Number(act4Eval2.onePartDecimal.toFixed(1))
                            : '?'}
                      </div>
                    ))}
                    {Array.from({ length: state.act4PartB }).map((_, i) => (
                      <div
                        key={`pb-${i}`}
                        className="flex-1 h-full rounded-lg bg-gradient-to-b from-[#FACC15] to-[#D97706] text-[#1E293B] text-[11px] font-black flex items-center justify-center shadow-2xs"
                      >
                        {state.act4UseThreeGroups
                          ? act4Eval3.status === 'VALID'
                            ? Number(act4Eval3.onePartDecimal.toFixed(1))
                            : '?'
                          : act4Eval2.status === 'VALID'
                            ? Number(act4Eval2.onePartDecimal.toFixed(1))
                            : '?'}
                      </div>
                    ))}
                    {state.act4UseThreeGroups &&
                      Array.from({ length: state.act4PartC }).map((_, i) => (
                        <div
                          key={`pc-${i}`}
                          className="flex-1 h-full rounded-lg bg-gradient-to-b from-[#22C55E] to-[#15803D] text-white text-[11px] font-black flex items-center justify-center shadow-2xs"
                        >
                          {act4Eval3.status === 'VALID'
                            ? Number(act4Eval3.onePartDecimal.toFixed(1))
                            : '?'}
                        </div>
                      ))}
                  </div>

                  {(
                    state.act4UseThreeGroups
                      ? act4Eval3.status === 'VALID'
                      : act4Eval2.status === 'VALID'
                  ) ? (
                    <div
                      className={`grid gap-2.5 ${
                        state.act4UseThreeGroups ? 'grid-cols-3' : 'grid-cols-2'
                      }`}
                    >
                      <div className="rounded-2xl bg-[#EFF6FF] border border-[#93C5FD] p-2.5 text-center">
                        <div className="text-xs font-bold text-[#1E40AF]">
                          Nhóm 1 ({state.act4PartA} phần)
                        </div>
                        <div className="text-lg font-black text-[#1D4ED8]">
                          {state.act4UseThreeGroups
                            ? act4Eval3.allocatedDecimals[0]
                            : act4Eval2.allocatedDecimals[0]}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-[#FEF9C3] border border-[#FDE047] p-2.5 text-center">
                        <div className="text-xs font-bold text-[#854D0E]">
                          Nhóm 2 ({state.act4PartB} phần)
                        </div>
                        <div className="text-lg font-black text-[#B45309]">
                          {state.act4UseThreeGroups
                            ? act4Eval3.allocatedDecimals[1]
                            : act4Eval2.allocatedDecimals[1]}
                        </div>
                      </div>
                      {state.act4UseThreeGroups && (
                        <div className="rounded-2xl bg-[#DCFCE7] border border-[#86EFAC] p-2.5 text-center">
                          <div className="text-xs font-bold text-[#166534]">
                            Nhóm 3 ({state.act4PartC} phần)
                          </div>
                          <div className="text-lg font-black text-[#15803D]">
                            {act4Eval3.allocatedDecimals[2]}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-[#FEF2F2] border border-[#FCA5A5] p-3 flex items-center gap-2 text-xs font-extrabold text-[#B91C1C]">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        {state.act4UseThreeGroups
                          ? act4Eval3.explanationVi
                          : act4Eval2.explanationVi}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ACTIVITY 5: ĐẠI LƯỢNG TỈ LỆ */}
            {state.activeActivity === 'PROPORTIONAL_QUANTITIES' && (
              <div className="flex flex-col items-center gap-2.5 px-3">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={() => setState((prev) => ({ ...prev, act5Tab: 'DIRECT' }))}
                    className={`px-3.5 py-1 rounded-full text-xs font-extrabold border cursor-pointer ${
                      state.act5Tab === 'DIRECT'
                        ? 'bg-[#0F5132] text-white border-[#0F5132]'
                        : 'bg-white text-[#334155] border-[#D4C6AE]'
                    }`}
                  >
                    Tỉ lệ thuận (y = kx)
                  </button>
                  <button
                    onClick={() => setState((prev) => ({ ...prev, act5Tab: 'INVERSE' }))}
                    className={`px-3.5 py-1 rounded-full text-xs font-extrabold border cursor-pointer ${
                      state.act5Tab === 'INVERSE'
                        ? 'bg-[#0F5132] text-white border-[#0F5132]'
                        : 'bg-white text-[#334155] border-[#D4C6AE]'
                    }`}
                  >
                    Tỉ lệ nghịch (y = k / x)
                  </button>
                  <button
                    onClick={() => setState((prev) => ({ ...prev, act5Tab: 'NON_PROP' }))}
                    className={`px-3.5 py-1 rounded-full text-xs font-extrabold border cursor-pointer ${
                      state.act5Tab === 'NON_PROP'
                        ? 'bg-[#EA580C] text-white border-[#EA580C]'
                        : 'bg-white text-[#334155] border-[#D4C6AE]'
                    }`}
                  >
                    Phản ví dụ không tỉ lệ (y = 2x + 3)
                  </button>
                </div>

                <div className="w-full max-w-[630px] grid grid-cols-1 sm:grid-cols-12 gap-3 bg-[#FAF7F0] border-2 border-[#CBB99B] rounded-3xl p-3.5 shadow-md items-center">
                  <div className="sm:col-span-7 space-y-2">
                    <div className="text-xs font-black text-[#0F5132]">
                      {state.act5Tab === 'DIRECT'
                        ? `Mua vở cùng đơn giá ${state.act5DirectK}.000đ/quyển: y = ${state.act5DirectK}x`
                        : state.act5Tab === 'INVERSE'
                          ? `Chia đều ${state.act5InverseK} lít nước vào x bình: x · y = ${state.act5InverseK}`
                          : 'Bẫy tăng cùng chiều nhưng KHÔNG tỉ lệ thuận: y = 2x + 3'}
                    </div>

                    <table className="w-full text-center text-xs font-bold border-collapse">
                      <thead>
                        <tr className="bg-[#EFE8D8] text-[#334155]">
                          <th className="p-1.5 border border-[#D4C6AE]">x</th>
                          {[1, 2, 3, 4].map((x) => (
                            <th key={x} className="p-1.5 border border-[#D4C6AE]">
                              {x}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="p-1.5 border border-[#D4C6AE] font-black text-[#1D4ED8]">
                            y
                          </td>
                          {[1, 2, 3, 4].map((x) => {
                            const yVal =
                              state.act5Tab === 'DIRECT'
                                ? state.act5DirectK * x
                                : state.act5Tab === 'INVERSE'
                                  ? Number((state.act5InverseK / x).toFixed(1))
                                  : 2 * x + 3;
                            return (
                              <td key={x} className="p-1.5 border border-[#D4C6AE] font-black">
                                {yVal}
                              </td>
                            );
                          })}
                        </tr>
                        <tr className="bg-[#F0FDF4] text-[#15803D]">
                          <td className="p-1.5 border border-[#D4C6AE] font-black">
                            {state.act5Tab === 'INVERSE' ? 'Tích x·y' : 'Tỉ số y/x'}
                          </td>
                          {[1, 2, 3, 4].map((x) => {
                            const checkVal =
                              state.act5Tab === 'DIRECT'
                                ? `${state.act5DirectK}`
                                : state.act5Tab === 'INVERSE'
                                  ? `${state.act5InverseK}`
                                  : Number(((2 * x + 3) / x).toFixed(2));
                            return (
                              <td key={x} className="p-1.5 border border-[#D4C6AE] font-black">
                                {checkVal}
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>

                    <div className="text-[11px] font-bold text-[#334155] bg-white px-2.5 py-1.5 rounded-xl border border-[#E2D8C5]">
                      {act5Eval.explanationVi}
                    </div>
                  </div>

                  <div className="sm:col-span-5 flex justify-center">
                    <svg viewBox="0 0 180 140" className="w-full max-w-[190px] bg-white rounded-2xl border border-[#D4C6AE] p-1">
                      <line x1="26" y1="116" x2="166" y2="116" stroke="#334155" strokeWidth="2" />
                      <line x1="26" y1="116" x2="26" y2="14" stroke="#334155" strokeWidth="2" />
                      <text x="162" y="130" fontSize="10" fontWeight="800" fill="#334155">x</text>
                      <text x="12" y="22" fontSize="10" fontWeight="800" fill="#334155">y</text>
                      <text x="14" y="126" fontSize="10" fontWeight="800" fill="#334155">O</text>

                      {state.act5Tab === 'DIRECT' && (
                        <>
                          <line x1="26" y1="116" x2="154" y2="24" stroke="#16A34A" strokeWidth="3" />
                          {[1, 2, 3, 4].map((x) => (
                            <circle
                              key={x}
                              cx={26 + x * 30}
                              cy={116 - x * 22}
                              r="4.5"
                              fill="#1D4ED8"
                              stroke="#FFFFFF"
                              strokeWidth="1.5"
                            />
                          ))}
                        </>
                      )}

                      {state.act5Tab === 'INVERSE' && (
                        <>
                          <path
                            d="M 52 24 Q 76 76 154 102"
                            fill="none"
                            stroke="#EA580C"
                            strokeWidth="3"
                          />
                          {[
                            { cx: 52, cy: 24 },
                            { cx: 82, cy: 68 },
                            { cx: 114, cy: 86 },
                            { cx: 148, cy: 98 },
                          ].map((pt, idx) => (
                            <circle
                              key={idx}
                              cx={pt.cx}
                              cy={pt.cy}
                              r="4.5"
                              fill="#EA580C"
                              stroke="#FFFFFF"
                              strokeWidth="1.5"
                            />
                          ))}
                        </>
                      )}

                      {state.act5Tab === 'NON_PROP' && (
                        <>
                          <line x1="26" y1="88" x2="150" y2="26" stroke="#DC2626" strokeWidth="2.5" strokeDasharray="4 3" />
                          <circle cx="26" cy="88" r="4.5" fill="#DC2626" />
                        </>
                      )}
                    </svg>
                  </div>
                </div>
              </div>
            )}

            {/* ACTIVITY 6: THỬ THÁCH THỰC TẾ */}
            {state.activeActivity === 'REAL_WORLD_CHALLENGE' && (
              <div className="flex flex-col items-center gap-2.5 px-3">
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {(
                    [
                      { id: 'RECIPE', label: '1. Nấu ăn theo suất' },
                      { id: 'DRINK', label: '2. Pha nước cam 1:4' },
                      { id: 'UNIT_CONVERT', label: '3. Đổi đơn vị trước khi lập tỉ số' },
                      { id: 'UNIT_PRICE', label: '4. Mua sắm theo đơn giá' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() =>
                        setState((prev) => ({ ...prev, act6SubMode: tab.id }))
                      }
                      className={`px-3 py-1 rounded-full text-xs font-extrabold border cursor-pointer ${
                        state.act6SubMode === tab.id
                          ? 'bg-[#0F5132] text-white border-[#0F5132]'
                          : 'bg-white text-[#334155] border-[#D4C6AE]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="w-full max-w-[620px] rounded-3xl bg-[#FAF7F0] border-2 border-[#CBB99B] p-4 shadow-md">
                  {state.act6SubMode === 'RECIPE' && (
                    <div className="space-y-2 text-center">
                      <div className="text-sm font-black text-[#0F5132]">
                        Công thức chuẩn: 4 suất bánh cần 300 g bột mì (1 suất = 75 g)
                      </div>
                      <div className="text-xs font-bold text-[#334155]">
                        Khi làm <span className="font-black text-[#EA580C]">{state.act6Servings} suất</span>, lượng bột cần dùng là:{' '}
                        <span className="text-lg font-black text-[#15803D]">
                          {state.act6Servings * 75} g
                        </span>
                      </div>
                    </div>
                  )}

                  {state.act6SubMode === 'DRINK' && (
                    <div className="space-y-2 text-center">
                      <div className="text-sm font-black text-[#0F5132]">
                        Pha si-rô cam và nước lọc theo tỉ lệ 1 : 4 (Tổng 5 phần)
                      </div>
                      <div className="text-xs font-bold text-[#334155]">
                        Với bình <span className="font-black text-[#1D4ED8]">{state.act6DrinkTotalMl} mL</span>:
                        {' '}Si-rô cam ={' '}
                        <span className="font-black text-[#EA580C]">
                          {state.act6DrinkTotalMl / 5} mL
                        </span>
                        {' '}và Nước lọc ={' '}
                        <span className="font-black text-[#1D4ED8]">
                          {(state.act6DrinkTotalMl * 4) / 5} mL
                        </span>
                      </div>
                    </div>
                  )}

                  {state.act6SubMode === 'UNIT_CONVERT' && (
                    <div className="space-y-2 text-center">
                      <div className="text-sm font-black text-[#0F5132]">
                        So sánh {state.act6LeftValue} {state.act6LeftUnit} và {state.act6RightValue} {state.act6RightUnit}
                      </div>
                      <div className="text-xs font-bold text-[#334155] bg-white p-2.5 rounded-xl border border-[#E2D8C5]">
                        {act6UnitEval.explanationVi}
                      </div>
                    </div>
                  )}

                  {state.act6SubMode === 'UNIT_PRICE' && (
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="p-2.5 rounded-2xl bg-white border border-[#93C5FD]">
                        <div className="text-xs font-black text-[#1D4ED8]">
                          Gói A (Giả định): {state.act6PackAQty} hộp giá {state.act6PackAPrice.toLocaleString('vi-VN')}đ
                        </div>
                        <div className="text-sm font-black text-[#1E293B] mt-1">
                          Đơn giá: {(state.act6PackAPrice / state.act6PackAQty).toLocaleString('vi-VN')}đ/hộp
                        </div>
                      </div>
                      <div className="p-2.5 rounded-2xl bg-[#F0FDF4] border border-[#86EFAC]">
                        <div className="text-xs font-black text-[#15803D]">
                          Gói B (Giả định): {state.act6PackBQty} hộp giá {state.act6PackBPrice.toLocaleString('vi-VN')}đ
                        </div>
                        <div className="text-sm font-black text-[#15803D] mt-1">
                          Đơn giá: {(state.act6PackBPrice / state.act6PackBQty).toLocaleString('vi-VN')}đ/hộp (Tiết kiệm hơn!)
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Feedback Banner */}
            {feedback && (
              <div
                className={`mt-2.5 mx-auto max-w-[640px] w-full rounded-2xl px-4 py-2 border-2 shadow-sm flex items-start justify-between gap-3 ${
                  feedback.type === 'success'
                    ? 'bg-[#DCFCE7]/95 border-[#16A34A] text-[#14532D]'
                    : feedback.type === 'warning'
                      ? 'bg-[#FFEDD5]/95 border-[#EA580C] text-[#7C2D12]'
                      : 'bg-[#EFF6FF]/95 border-[#3B82F6] text-[#1E3A8A]'
                }`}
              >
                <div className="text-xs leading-snug">
                  <div className="font-black">{feedback.title}</div>
                  <div className="font-semibold mt-0.5">{feedback.detail}</div>
                </div>
                <button
                  onClick={() => setFeedback(null)}
                  className="text-xs font-black opacity-70 hover:opacity-100 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* BOTTOM 4 ACTION BUTTONS */}
          <div className="relative z-10 px-4 pb-3 pt-1 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5">
            <button
              onClick={handleStepWalkthrough}
              className="min-w-[130px] px-4 py-2 rounded-full bg-gradient-to-b from-[#FAF6EE] to-[#E6DEC8] hover:from-white hover:to-[#EFE7D6] text-[#1E293B] font-extrabold text-xs sm:text-sm border-2 border-[#CBB99B] shadow-md flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <Footprints className="w-4 h-4 text-[#0F5132]" />
              <span>Từng bước</span>
            </button>

            <button
              onClick={handlePourAndMix}
              className="min-w-[130px] px-5 py-2 rounded-full bg-gradient-to-b from-[#3B82F6] via-[#2563EB] to-[#1D4ED8] hover:brightness-110 text-white font-extrabold text-xs sm:text-sm border-2 border-[#93C5FD] shadow-md flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <FlaskConical className="w-4 h-4" />
              <span>Pha thử</span>
            </button>

            <button
              onClick={handleResetCurrentActivity}
              className="min-w-[130px] px-4 py-2 rounded-full bg-gradient-to-b from-[#FAF6EE] to-[#E6DEC8] hover:from-white hover:to-[#EFE7D6] text-[#1E293B] font-extrabold text-xs sm:text-sm border-2 border-[#CBB99B] shadow-md flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-[#334155]" />
              <span>Làm lại</span>
            </button>

            <button
              onClick={handleCheckAnswer}
              className="min-w-[140px] px-5 py-2 rounded-full bg-gradient-to-b from-[#FB923C] via-[#EA580C] to-[#C2410C] hover:brightness-110 text-white font-extrabold text-xs sm:text-sm border-2 border-[#FDBA74] shadow-md flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Kiểm tra</span>
            </button>
          </div>
        </main>

        {/* RIGHT MISSION PANEL: NHIỆM VỤ */}
        <aside className="lg:col-span-3 bg-[#F8F3E8]/95 rounded-3xl p-3 border-2 border-[#DFD4C0] shadow-md flex flex-col justify-between gap-2.5">
          <div className="space-y-2.5">
            <div className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#0F5132] to-[#166534] text-white font-extrabold text-sm flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#FDE047]" />
                <span>Nhiệm vụ</span>
              </div>
              <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full">
                Câu {currentTaskIdx + 1}/{activityTasks.length}
              </span>
            </div>

            <div className="px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-[#FDE68A]/55 via-[#FEF3C7]/80 to-[#FDE68A]/55 border border-[#F59E0B]/50 text-center shadow-2xs">
              {state.activeActivity === 'MIX_COLOR_RATIO' ? (
                <div className="text-xs sm:text-sm font-black text-[#1E293B]">
                  Giữ tỉ số <span className="text-[#1D4ED8]">Xanh</span> :{' '}
                  <span className="text-[#EA580C]">Vàng</span> ={' '}
                  <span>
                    {state.act2BaseBlue} : {state.act2BaseYellow}
                  </span>
                </div>
              ) : (
                <div className="text-xs font-black text-[#1E293B]">
                  {currentTask?.title}
                </div>
              )}
            </div>

            {/* Steppers matching Reference Image (Hệ số | Xanh | Vàng) */}
            {state.activeActivity === 'MIX_COLOR_RATIO' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-20 px-3 py-2 rounded-xl bg-[#E6E4D8] text-xs font-extrabold text-[#1E293B] text-center">
                    Hệ số
                  </div>
                  <div className="flex-1 flex items-center justify-between bg-white rounded-xl border border-[#D4C6AE] px-3 py-1.5 shadow-2xs">
                    <span className="text-sm font-black text-[#1E293B]">
                      {state.act2Multiplier}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleAct2MultiplierChange(-1)}
                        className="w-6 h-6 rounded-md bg-[#F1EDE4] hover:bg-[#E2D8C5] text-xs font-black cursor-pointer"
                      >
                        −
                      </button>
                      <button
                        onClick={() => handleAct2MultiplierChange(1)}
                        className="w-6 h-6 rounded-md bg-[#F1EDE4] hover:bg-[#E2D8C5] text-xs font-black cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="w-20 px-3 py-2 rounded-xl bg-[#E6E4D8] text-xs font-extrabold text-[#1E293B] text-center">
                    Xanh
                  </div>
                  <div className="flex-1 flex items-center justify-between bg-white rounded-xl border border-[#D4C6AE] px-3 py-1.5 shadow-2xs">
                    <span className="text-sm font-black text-[#1E293B]">
                      {state.act2TestBlue} phần
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleAct2TestBlueChange(-1)}
                        className="w-6 h-6 rounded-md bg-[#F1EDE4] hover:bg-[#E2D8C5] text-xs font-black cursor-pointer"
                      >
                        −
                      </button>
                      <button
                        onClick={() => handleAct2TestBlueChange(1)}
                        className="w-6 h-6 rounded-md bg-[#F1EDE4] hover:bg-[#E2D8C5] text-xs font-black cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="w-20 px-3 py-2 rounded-xl bg-[#E6E4D8] text-xs font-extrabold text-[#1E293B] text-center">
                    Vàng
                  </div>
                  <div className="flex-1 flex items-center justify-between bg-white rounded-xl border border-[#D4C6AE] px-3 py-1.5 shadow-2xs">
                    <span className="text-sm font-black text-[#1E293B]">
                      {state.act2TestYellow} phần
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleAct2TestYellowChange(-1)}
                        className="w-6 h-6 rounded-md bg-[#F1EDE4] hover:bg-[#E2D8C5] text-xs font-black cursor-pointer"
                      >
                        −
                      </button>
                      <button
                        onClick={() => handleAct2TestYellowChange(1)}
                        className="w-6 h-6 rounded-md bg-[#F1EDE4] hover:bg-[#E2D8C5] text-xs font-black cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Steppers for Activity 1 */}
            {state.activeActivity === 'CREATE_RATIO' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="w-24 px-2.5 py-1.5 rounded-xl bg-[#DBEAFE] text-xs font-black text-[#1D4ED8]">
                    Hạt Xanh
                  </span>
                  <div className="flex-1 flex items-center justify-between bg-white rounded-xl border border-[#D4C6AE] px-3 py-1">
                    <span className="text-sm font-black">{state.act1Blue} hạt</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() =>
                          setState((p) => ({ ...p, act1Blue: Math.max(0, p.act1Blue - 1) }))
                        }
                        className="w-6 h-6 rounded bg-[#F1EDE4] font-black cursor-pointer"
                      >
                        −
                      </button>
                      <button
                        onClick={() =>
                          setState((p) => ({ ...p, act1Blue: Math.min(12, p.act1Blue + 1) }))
                        }
                        className="w-6 h-6 rounded bg-[#F1EDE4] font-black cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="w-24 px-2.5 py-1.5 rounded-xl bg-[#FEF9C3] text-xs font-black text-[#B45309]">
                    Hạt Vàng
                  </span>
                  <div className="flex-1 flex items-center justify-between bg-white rounded-xl border border-[#D4C6AE] px-3 py-1">
                    <span className="text-sm font-black">{state.act1Yellow} hạt</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() =>
                          setState((p) => ({
                            ...p,
                            act1Yellow: Math.max(0, p.act1Yellow - 1),
                          }))
                        }
                        className="w-6 h-6 rounded bg-[#F1EDE4] font-black cursor-pointer"
                      >
                        −
                      </button>
                      <button
                        onClick={() =>
                          setState((p) => ({
                            ...p,
                            act1Yellow: Math.min(12, p.act1Yellow + 1),
                          }))
                        }
                        className="w-6 h-6 rounded bg-[#F1EDE4] font-black cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Steppers for Activity 3 */}
            {state.activeActivity === 'EQUIVALENT_RATIOS' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white rounded-xl p-2 border border-[#D4C6AE]">
                  <div className="text-[11px] font-bold text-[#64748B]">Tỉ số 1 (a : b)</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm font-black text-[#1D4ED8]">
                      {state.act3A} : {state.act3B}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() =>
                          setState((p) => ({ ...p, act3A: Math.max(1, p.act3A - 1) }))
                        }
                        className="px-1.5 py-0.5 rounded bg-[#F1EDE4] text-xs font-black cursor-pointer"
                      >
                        a−
                      </button>
                      <button
                        onClick={() =>
                          setState((p) => ({ ...p, act3A: Math.min(9, p.act3A + 1) }))
                        }
                        className="px-1.5 py-0.5 rounded bg-[#F1EDE4] text-xs font-black cursor-pointer"
                      >
                        a+
                      </button>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-2 border border-[#D4C6AE]">
                  <div className="text-[11px] font-bold text-[#64748B]">Tỉ số 2 (c : d)</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm font-black text-[#EA580C]">
                      {state.act3C} : {state.act3D}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() =>
                          setState((p) => ({ ...p, act3C: Math.max(1, p.act3C + 1) }))
                        }
                        className="px-1.5 py-0.5 rounded bg-[#F1EDE4] text-xs font-black cursor-pointer"
                      >
                        c+
                      </button>
                      <button
                        onClick={() =>
                          setState((p) => ({ ...p, act3D: Math.max(1, p.act3D + 1) }))
                        }
                        className="px-1.5 py-0.5 rounded bg-[#F1EDE4] text-xs font-black cursor-pointer"
                      >
                        d+
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Steppers for Activity 4 */}
            {state.activeActivity === 'DIVIDE_BY_RATIO' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between bg-white rounded-xl px-3 py-1.5 border border-[#D4C6AE]">
                  <span className="text-xs font-bold">Tổng lượng S:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        setState((p) => ({ ...p, act4Total: Math.max(2, p.act4Total - 1) }))
                      }
                      className="w-6 h-6 rounded bg-[#F1EDE4] font-black cursor-pointer"
                    >
                      −
                    </button>
                    <span className="text-sm font-black w-8 text-center">{state.act4Total}</span>
                    <button
                      onClick={() =>
                        setState((p) => ({ ...p, act4Total: Math.min(100, p.act4Total + 1) }))
                      }
                      className="w-6 h-6 rounded bg-[#F1EDE4] font-black cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-white rounded-xl px-3 py-1.5 border border-[#D4C6AE]">
                  <span className="text-xs font-bold">Tỉ lệ a : b:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        setState((p) => ({ ...p, act4PartA: (p.act4PartA % 6) + 1 }))
                      }
                      className="px-2 py-0.5 rounded bg-[#EFF6FF] text-xs font-black text-[#1D4ED8] cursor-pointer"
                    >
                      a={state.act4PartA}
                    </button>
                    <span>:</span>
                    <button
                      onClick={() =>
                        setState((p) => ({ ...p, act4PartB: (p.act4PartB % 6) + 1 }))
                      }
                      className="px-2 py-0.5 rounded bg-[#FEF9C3] text-xs font-black text-[#B45309] cursor-pointer"
                    >
                      b={state.act4PartB}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Dashed Blue Prediction Button */}
            <div>
              <button
                onClick={() => setShowPredictionDrawer((v) => !v)}
                className="w-full py-2 px-3 rounded-xl bg-[#EFF6FF]/90 hover:bg-[#DBEAFE] border-2 border-dashed border-[#60A5FA] text-[#1D4ED8] text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <PencilLine className="w-3.5 h-3.5" />
                <span>Dự đoán trước khi kiểm tra</span>
              </button>

              {showPredictionDrawer && (
                <div className="mt-1.5 p-2.5 rounded-xl bg-white border border-[#93C5FD] space-y-1.5 text-xs">
                  <div className="font-black text-[#1E3A8A]">
                    Em dự đoán màu pha thử sẽ như thế nào so với công thức gốc?
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {(
                      [
                        { id: 'KEEP_COLOR', label: 'Giữ nguyên sắc độ xanh lá' },
                        { id: 'DARKER_BLUE', label: 'Đậm màu Xanh lam hơn' },
                        { id: 'BRIGHTER_YELLOW', label: 'Ngả sang màu Vàng hơn' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setPredictionChoice(opt.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-left font-bold border cursor-pointer ${
                          predictionChoice === opt.id
                            ? 'bg-[#DBEAFE] border-[#2563EB] text-[#1E3A8A]'
                            : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#334155]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Active Task Card from 48-Task Bank */}
            {currentTask && (
              <div className="rounded-2xl bg-white/95 border border-[#D4C6AE] p-2.5 shadow-2xs space-y-2">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#DCFCE7] text-[#15803D]">
                    Nhiệm vụ #{currentTaskIdx + 1} ({currentTask.difficulty})
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setSelectedChoiceText(null);
                        setAnswerInputText('');
                        setHintLevel(0);
                        setTaskIndexByActivity((prev) => ({
                          ...prev,
                          [state.activeActivity]:
                            (currentTaskIdx - 1 + activityTasks.length) %
                            activityTasks.length,
                        }));
                      }}
                      className="p-1 rounded hover:bg-[#F1EDE4] cursor-pointer"
                      title="Câu trước"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedChoiceText(null);
                        setAnswerInputText('');
                        setHintLevel(0);
                        setTaskIndexByActivity((prev) => ({
                          ...prev,
                          [state.activeActivity]:
                            (currentTaskIdx + 1) % activityTasks.length,
                        }));
                      }}
                      className="p-1 rounded hover:bg-[#F1EDE4] cursor-pointer"
                      title="Câu tiếp theo"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs font-extrabold text-[#1E293B] leading-snug">
                  {currentTask.question}
                </p>

                {currentTask.choiceOptions && currentTask.choiceOptions.length > 0 ? (
                  <div className="grid grid-cols-1 gap-1">
                    {currentTask.choiceOptions.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setSelectedChoiceText(opt)}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold border text-left transition cursor-pointer ${
                          selectedChoiceText === opt
                            ? 'bg-[#0F5132] text-white border-[#0F5132] shadow-2xs'
                            : 'bg-[#FAF6EE] hover:bg-[#EFE7D6] text-[#1E293B] border-[#DFD4C0]'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={answerInputText}
                      onChange={(e) => setAnswerInputText(e.target.value)}
                      placeholder={
                        currentTask.answerType === 'RATIO_PAIR'
                          ? 'Nhập a : b (VD: 2:3)'
                          : currentTask.answerType === 'PAIR_NUMBERS'
                            ? 'Nhập 2 số (VD: 8; 12)'
                            : 'Nhập kết quả...'
                      }
                      className="w-full rounded-xl bg-[#FAF6EE] border border-[#D4C6AE] px-2.5 py-1.5 text-xs font-extrabold text-[#1E293B]"
                    />
                    {currentTask.unitSuffix && (
                      <span className="text-[11px] font-bold text-[#64748B] shrink-0">
                        {currentTask.unitSuffix}
                      </span>
                    )}
                  </div>
                )}

                <div className="pt-1 flex items-center justify-between gap-1">
                  <button
                    onClick={() =>
                      setHintLevel((h) => ((h + 1) % 4) as 0 | 1 | 2 | 3)
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#D97706] hover:text-[#B45309] cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>
                      {hintLevel === 0
                        ? 'Xem gợi ý 3 mức'
                        : `Gợi ý mức ${hintLevel}/3`}
                    </span>
                  </button>
                  {state.completedTaskIds.includes(currentTask.id) && (
                    <span className="text-[10px] font-black text-[#16A34A]">
                      ✓ Đã hoàn thành
                    </span>
                  )}
                </div>

                {hintLevel > 0 && (
                  <div className="p-2 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-[11px] font-bold text-[#92400E] leading-snug">
                    {hintLevel === 1 && `Mức 1 (Quan sát): ${currentTask.hints[0]}`}
                    {hintLevel === 2 && `Mức 2 (Thao tác): ${currentTask.hints[1]}`}
                    {hintLevel === 3 && `Mức 3 (Giải thích): ${currentTask.hints[2]}`}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* =================================================================== */}
      {/* BOTTOM 6 3D THUMBNAIL CARDS (Khớp ảnh mẫu đính kèm)                 */}
      {/* =================================================================== */}
      <footer className="px-3.5 pb-3 pt-1 max-w-[1600px] w-full mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {M18_ACTIVITY_METADATA.map((act) => {
            const isActive = state.activeActivity === act.id;
            return (
              <button
                key={act.id}
                onClick={() => handleSelectActivity(act.id)}
                className={`group rounded-2xl bg-gradient-to-b from-[#FAF6EE] to-[#EFE6D5] border-2 overflow-hidden shadow-sm transition-all cursor-pointer flex flex-col justify-between ${
                  isActive
                    ? 'border-[#EA580C] ring-2 ring-[#F97316]/30 -translate-y-0.5 shadow-md'
                    : 'border-[#D7C9B1] hover:border-[#0F5132] hover:-translate-y-0.5'
                }`}
              >
                <div className="px-2 pt-2 pb-1 flex items-center justify-center">
                  <M18ActivityThumbnailCard3D activityId={act.id} />
                </div>
                <div
                  className={`w-full py-1.5 px-2 text-center text-xs font-extrabold transition-colors ${
                    isActive
                      ? 'bg-gradient-to-r from-[#15803D] to-[#0F5132] text-white'
                      : 'bg-gradient-to-r from-[#0F5132] to-[#14532D] text-white group-hover:from-[#166534] group-hover:to-[#15803D]'
                  }`}
                >
                  {act.thumbnailCaption}
                </div>
              </button>
            );
          })}
        </div>
      </footer>

      {/* =================================================================== */}
      {/* CLASSROOM & RESULT SAVING MODAL                                     */}
      {/* =================================================================== */}
      {showClassModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FAF6EE] rounded-3xl max-w-md w-full p-5 border-2 border-[#D4C6AE] shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#0F5132] font-black text-base">
                <Scale className="w-5 h-5" />
                <span>Lưu kết quả học tập — {selectedClassName}</span>
              </div>
              <button
                onClick={() => setShowClassModal(false)}
                className="text-sm font-black text-[#64748B] hover:text-[#1E293B] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs font-bold">
              <div>
                <label className="block text-[#334155] mb-1">
                  Tên học sinh / Nhóm thực hành:
                </label>
                <input
                  type="text"
                  value={studentGroupInput}
                  onChange={(e) => setStudentGroupInput(e.target.value)}
                  placeholder="Ví dụ: Nhóm 1 - Tổ Toán 6A1"
                  className="w-full rounded-xl bg-white border border-[#CBB99B] px-3 py-2 font-extrabold text-[#1E293B]"
                />
              </div>

              <div className="p-3 rounded-2xl bg-[#DCFCE7] border border-[#86EFAC] text-[#14532D] space-y-1">
                <div>Lớp: {selectedClassName}</div>
                <div>Điểm tích lũy: {state.score} điểm</div>
                <div>
                  Nhiệm vụ hoàn thành: {state.completedTaskIds.length}/{M18_TASK_BANK.length}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowClassModal(false)}
                className="px-4 py-2 rounded-xl bg-[#E2D8C5] text-[#334155] text-xs font-extrabold cursor-pointer"
              >
                Đóng
              </button>
              <button
                onClick={handleSaveProgressToClass}
                className="px-5 py-2 rounded-xl bg-[#0F5132] hover:bg-[#15803D] text-white text-xs font-extrabold shadow-sm cursor-pointer"
              >
                Lưu vào sổ điểm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
