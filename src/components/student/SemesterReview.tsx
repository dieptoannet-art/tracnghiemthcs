import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { MathView } from '../MathView';
import { supabase } from '../../lib/supabase';
import { Question, Grade, SubjectId, ExamPeriod } from '../../types';
import { normalizeGrade, isQuestionInSubject, getSubjectDisplayName } from '../teacher/QuestionBank';
import {
  GraduationCap,
  Calendar,
  Clock,
  BookOpen,
  Award,
  FileText,
  Printer,
  Download,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  BarChart3,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Flag,
  FileCheck,
  Percent,
  Play,
  Sliders,
  Camera,
  Upload,
  Trash2,
  Image as ImageIcon
} from 'lucide-react';
import {
  ExamStructureConfig,
  getExamStructure,
  resetExamStructure
} from '../../utils/examStructure';
import { ExamStructureConfigModal } from '../teacher/ExamStructureConfigModal';

export const SemesterReview: React.FC = () => {
  const {
    questions: localQuestions,
    selectedGrade: contextGrade,
    selectedSubject: contextSubject,
    setCurrentView,
    currentRole,
    userProfile
  } = useApp();

  // 1. Bộ lọc kỳ thi, khối, môn
  const [selectedPeriod, setSelectedPeriod] = useState<ExamPeriod>('mid1');
  const [selectedGrade, setSelectedGrade] = useState<string>(() => normalizeGrade(contextGrade) || '6');
  const [selectedSubject, setSelectedSubject] = useState<string>('Toán');
  const [activeTab, setActiveTab] = useState<'mock_exam' | 'curriculum_guide' | 'matrix_spec'>('mock_exam');

  // Cấu hình cấu trúc đề thi động theo môn (Toán: 16-2-4; Tin: 12-4-3)
  const [structureConfig, setStructureConfig] = useState<ExamStructureConfig>(() => getExamStructure('Toán'));
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);

  // Khi thay đổi môn học, tự động cập nhật cấu trúc chuẩn của môn đó
  useEffect(() => {
    setStructureConfig(getExamStructure(selectedSubject));
  }, [selectedSubject]);

  // Supabase question storage
  const [supabaseQuestions, setSupabaseQuestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Nạp câu hỏi từ Supabase
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const fetchQuestions = async () => {
      try {
        const { data, error } = await supabase
          .from('questions')
          .select('*')
          .limit(1000);

        if (isMounted) {
          if (!error && data) {
            setSupabaseQuestions(data);
          }
        }
      } catch (err: any) {
        console.warn('Lỗi khi nạp câu hỏi cho Ôn tập học kỳ:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchQuestions();

    return () => {
      isMounted = false;
    };
  }, []);

  // Tổng hợp kho câu hỏi
  const allQuestions = useMemo<Question[]>(() => {
    const qMap = new Map<string, Question>();
    (localQuestions || []).forEach(q => qMap.set(q.id, q));

    supabaseQuestions.forEach((sq: any) => {
      let parsedOptions: any[] = [];
      if (Array.isArray(sq.options)) parsedOptions = sq.options;
      else if (typeof sq.options === 'string') {
        try { parsedOptions = JSON.parse(sq.options); } catch { parsedOptions = []; }
      }
      const formattedOptions = parsedOptions.map((opt, i) => ({
        id: opt.id || `opt-${i}`,
        label: opt.label || String.fromCharCode(65 + i),
        text: opt.text || ''
      }));

      qMap.set(sq.id, {
        id: sq.id,
        code: sq.code || `Q-${sq.id.slice(0, 8)}`,
        grade: (normalizeGrade(sq.grade) || '6') as Grade,
        subject: sq.subject || 'Tin học',
        textbook: sq.textbook || 'Kết nối tri thức',
        chapter: sq.chapter || 'Chủ đề chung',
        lesson: sq.lesson || 'Bài học chung',
        yccd: sq.yccd || '',
        competency: sq.competency || '',
        level: sq.level || 'know',
        type: sq.type || 'single_choice',
        stem: sq.stem || '',
        points: Number(sq.points) || 1.0,
        options: formattedOptions,
        subItems: Array.isArray(sq.sub_items) ? sq.sub_items : [],
        correctAnswer: sq.correctAnswer || (formattedOptions[0]?.label || 'A'),
        explanation: sq.explanation || 'Xem lại kiến thức trong đề cương học kỳ.',
        acceptedAnswers: sq.acceptedAnswers || [],
        rubric: sq.rubric || undefined,
        sampleAnswer: sq.sample_answer || sq.sampleAnswer || undefined,
        status: sq.status || 'approved',
        author: sq.author || 'Tổ Chuyên môn THCS Tây Đô',
        version: sq.version || 1
      });
    });

    return Array.from(qMap.values());
  }, [localQuestions, supabaseQuestions]);

  // Bộ câu hỏi phù hợp với khối lớp và môn học
  const poolQuestions = useMemo(() => {
    return allQuestions.filter(q => {
      const matchGrade = normalizeGrade(q.grade) === selectedGrade;
      const matchSub = isQuestionInSubject(q, selectedSubject);
      return matchGrade && matchSub;
    });
  }, [allQuestions, selectedGrade, selectedSubject]);

  // Bộ đề thi học kỳ mô phỏng theo chuẩn cấu trúc GDPT 2018 và tùy chỉnh của Giáo viên
  // Toán: 16 ABCD - 2 Đúng/Sai - 4 Tự luận (40-20-40) -> 22 câu = 10đ
  // Tin: 12 ABCD - 4 Đúng/Sai - 3 Tự luận (30-40-30) -> 19 câu = 10đ
  const semesterMockExamQuestions = useMemo(() => {
    // 1. Phân loại theo khối lớp & môn học
    const singleInGrade = poolQuestions.filter(q => q.type === 'single_choice');
    const tfInGrade = poolQuestions.filter(q => q.type === 'true_false_group');
    const essayInGrade = poolQuestions.filter(q => q.type === 'essay' || q.type === 'short_answer');

    // Mở rộng tìm kiếm trong toàn bộ môn học để đảm bảo luôn đủ số lượng câu
    const allSubjectQuestions = allQuestions.filter(q => isQuestionInSubject(q, selectedSubject));
    const allSingle = allSubjectQuestions.filter(q => q.type === 'single_choice');
    const allTf = allSubjectQuestions.filter(q => q.type === 'true_false_group');
    const allEssay = allSubjectQuestions.filter(q => q.type === 'essay' || q.type === 'short_answer');

    const result: Question[] = [];

    // --- PHẦN I: TRẮC NGHIỆM ABCD ---
    const targetSingleCount = structureConfig.singleChoiceCount;
    const ptsPerSingle = targetSingleCount > 0 ? Number((structureConfig.singleChoicePoints / targetSingleCount).toFixed(2)) : 0.25;
    const singlePicked: Question[] = [];
    singleInGrade.forEach(q => {
      if (singlePicked.length < targetSingleCount && !singlePicked.some(p => p.id === q.id)) {
        singlePicked.push({ ...q, points: ptsPerSingle, examSection: 'part1' as any });
      }
    });
    allSingle.forEach(q => {
      if (singlePicked.length < targetSingleCount && !singlePicked.some(p => p.id === q.id)) {
        singlePicked.push({ ...q, points: ptsPerSingle, examSection: 'part1' as any });
      }
    });
    // Bổ sung câu hỏi dự phòng nếu kho câu hỏi chưa đủ
    if (singlePicked.length < targetSingleCount) {
      const needed = targetSingleCount - singlePicked.length;
      for (let i = 0; i < needed; i++) {
        singlePicked.push({
          id: `syn-mc-${selectedSubject}-${i + 1}`,
          code: `${selectedSubject.slice(0, 2).toUpperCase()}${selectedGrade}_GK_MC_${(singlePicked.length + 1).toString().padStart(3, '0')}`,
          grade: selectedGrade as Grade,
          subject: selectedSubject,
          textbook: 'Kết nối tri thức',
          chapter: 'Kiến thức trọng tâm học kỳ',
          lesson: `Dạng bài tập trắc nghiệm số ${singlePicked.length + 1}`,
          level: (i % 3 === 0 ? 'know' : i % 3 === 1 ? 'understand' : 'apply') as any,
          type: 'single_choice',
          stem: `Khẳng định nào sau đây là chính xác đối với kiến thức trọng tâm học kỳ môn ${selectedSubject} (Khối ${selectedGrade})?`,
          points: ptsPerSingle,
          options: [
            { id: 'A', label: 'A', text: 'Khẳng định đúng theo định nghĩa chuẩn SGK' },
            { id: 'B', label: 'B', text: 'Khẳng định sai lệch điều kiện cần và đủ' },
            { id: 'C', label: 'C', text: 'Khẳng định thiếu giả thiết bài toán' },
            { id: 'D', label: 'D', text: 'Khẳng định chỉ đúng trong một trường hợp suy biến' }
          ],
          correctAnswer: 'A',
          explanation: `Kiến thức cốt lõi được quy định trong chương trình GDPT 2018 môn ${selectedSubject}.`,
          status: 'approved',
          author: 'Tổ Chuyên môn THCS Tây Đô',
          version: 1,
          examSection: 'part1' as any
        });
      }
    }
    result.push(...singlePicked);

    // --- PHẦN II: TRẮC NGHIỆM ĐÚNG - SAI 4 Ý ---
    const targetTfCount = structureConfig.trueFalseCount;
    const ptsPerTf = targetTfCount > 0 ? Number((structureConfig.trueFalsePoints / targetTfCount).toFixed(2)) : 1.0;
    const tfPicked: Question[] = [];
    tfInGrade.forEach(q => {
      if (tfPicked.length < targetTfCount && !tfPicked.some(p => p.id === q.id)) {
        tfPicked.push({ ...q, points: ptsPerTf, examSection: 'part2' as any });
      }
    });
    allTf.forEach(q => {
      if (tfPicked.length < targetTfCount && !tfPicked.some(p => p.id === q.id)) {
        tfPicked.push({ ...q, points: ptsPerTf, examSection: 'part2' as any });
      }
    });
    if (tfPicked.length < targetTfCount) {
      const needed = targetTfCount - tfPicked.length;
      for (let i = 0; i < needed; i++) {
        tfPicked.push({
          id: `syn-tf-${selectedSubject}-${i + 1}`,
          code: `${selectedSubject.slice(0, 2).toUpperCase()}${selectedGrade}_GK_TF_${(tfPicked.length + 1).toString().padStart(2, '0')}`,
          grade: selectedGrade as Grade,
          subject: selectedSubject,
          textbook: 'Kết nối tri thức',
          chapter: 'Kiến thức cốt lõi học kỳ',
          lesson: `Câu hỏi suy luận đúng - sai ${tfPicked.length + 1}`,
          level: 'understand',
          type: 'true_false_group',
          stem: `Xét tính Đúng/Sai của các nhận định chuyên đề môn ${selectedSubject} lớp ${selectedGrade}:`,
          points: ptsPerTf,
          explanation: 'Đối chiếu tính chất và công thức trong đề cương ôn tập học kỳ.',
          status: 'approved',
          author: 'Tổ Chuyên môn THCS Tây Đô',
          version: 1,
          subItems: [
            { id: `syn-tf-sub-a-${i}`, label: 'a', text: 'Nhận định đúng theo định nghĩa SGK GDPT 2018.', isCorrect: true, level: 'know' },
            { id: `syn-tf-sub-b-${i}`, label: 'b', text: 'Phát biểu sai về điều kiện áp dụng định lí/quy tắc.', isCorrect: false, level: 'understand' },
            { id: `syn-tf-sub-c-${i}`, label: 'c', text: 'Công thức toán học/tin học được áp dụng chính xác.', isCorrect: true, level: 'understand' },
            { id: `syn-tf-sub-d-${i}`, label: 'd', text: 'Kết luận tổng quát trong mọi trường hợp là không đúng.', isCorrect: false, level: 'apply' }
          ],
          examSection: 'part2' as any
        });
      }
    }
    result.push(...tfPicked);

    // --- PHẦN III: TỰ LUẬN / TRẢ LỜI NGẮN ---
    const targetEssayCount = structureConfig.essayCount;
    const ptsPerEssay = targetEssayCount > 0 ? Number((structureConfig.essayPoints / targetEssayCount).toFixed(2)) : 1.0;
    const essayPicked: Question[] = [];
    essayInGrade.forEach(q => {
      if (essayPicked.length < targetEssayCount && !essayPicked.some(p => p.id === q.id)) {
        essayPicked.push({ ...q, points: ptsPerEssay, examSection: 'part3' as any });
      }
    });
    allEssay.forEach(q => {
      if (essayPicked.length < targetEssayCount && !essayPicked.some(p => p.id === q.id)) {
        essayPicked.push({ ...q, points: ptsPerEssay, examSection: 'part3' as any });
      }
    });
    if (essayPicked.length < targetEssayCount) {
      const needed = targetEssayCount - essayPicked.length;
      for (let i = 0; i < needed; i++) {
        essayPicked.push({
          id: `syn-es-${selectedSubject}-${i + 1}`,
          code: `${selectedSubject.slice(0, 2).toUpperCase()}${selectedGrade}_GK_ES_${(essayPicked.length + 1).toString().padStart(2, '0')}`,
          grade: selectedGrade as Grade,
          subject: selectedSubject,
          textbook: 'Kết nối tri thức',
          chapter: 'Vận dụng thực tiễn học kỳ',
          lesson: `Bài toán tự luận trọng tâm ${essayPicked.length + 1}`,
          level: 'apply',
          type: 'essay',
          stem: `Trình bày chi tiết lời giải hoặc các bước giải quyết tình huống thực tế sau đây môn ${selectedSubject} (Khối ${selectedGrade}):`,
          points: ptsPerEssay,
          explanation: 'Lập luận rõ ràng, nêu các bước giải, tính toán chính xác và kết luận.',
          sampleAnswer: 'Trình bày lời giải chi tiết theo các bước hướng dẫn trong đáp án ma trận.',
          status: 'approved',
          author: 'Tổ Chuyên môn THCS Tây Đô',
          version: 1,
          examSection: 'part3' as any
        });
      }
    }
    result.push(...essayPicked);

    return result;
  }, [poolQuestions, allQuestions, selectedSubject, selectedGrade, structureConfig]);

  // Trạng thái phiên thi thử học kỳ
  const [isExamRunning, setIsExamRunning] = useState<boolean>(false);
  const [examIndex, setExamIndex] = useState<number>(0);
  const [examAnswers, setExamAnswers] = useState<Record<string, any>>({});
  const [examSecondsLeft, setExamSecondsLeft] = useState<number>(() => structureConfig.durationMinutes * 60);
  const [isExamSubmitted, setIsExamSubmitted] = useState<boolean>(false);

  // Đếm ngược giờ thi học kỳ
  useEffect(() => {
    let timer: any = null;
    if (isExamRunning && !isExamSubmitted) {
      timer = setInterval(() => {
        setExamSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsExamSubmitted(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isExamRunning, isExamSubmitted]);

  const handleStartSemesterExam = () => {
    setExamIndex(0);
    setExamAnswers({});
    setExamSecondsLeft(structureConfig.durationMinutes * 60);
    setIsExamSubmitted(false);
    setIsExamRunning(true);
  };

  const handleSelectExamOption = (qId: string, val: any) => {
    if (isExamSubmitted) return;
    setExamAnswers(prev => ({ ...prev, [qId]: val }));
  };

  // Tính kết quả thi thử học kỳ theo chuẩn GDPT 2018 (thang 10,0 điểm)
  const examResult = useMemo(() => {
    let totalScore = 0;
    let correctCount = 0;
    let wrongCount = 0;

    const ptsPerSingle = structureConfig.singleChoiceCount > 0
      ? structureConfig.singleChoicePoints / structureConfig.singleChoiceCount
      : 0.25;

    const ptsPerTF = structureConfig.trueFalseCount > 0
      ? structureConfig.trueFalsePoints / structureConfig.trueFalseCount
      : 1.0;

    const ptsPerEssay = structureConfig.essayCount > 0
      ? structureConfig.essayPoints / structureConfig.essayCount
      : 1.0;

    semesterMockExamQuestions.forEach(q => {
      const ans = examAnswers[q.id];

      if (q.type === 'single_choice') {
        if (ans && String(ans).trim().toUpperCase() === String(q.correctAnswer).trim().toUpperCase()) {
          totalScore += ptsPerSingle;
          correctCount++;
        } else {
          wrongCount++;
        }
      } else if (q.type === 'true_false_group') {
        const itemAnswers = (ans as Record<string, boolean>) || {};
        let subCorrect = 0;
        (q.subItems || []).forEach(sub => {
          if (itemAnswers[sub.id] !== undefined && itemAnswers[sub.id] === (sub as any).isCorrect) {
            subCorrect++;
          }
        });

        // Quy tắc chấm điểm chuẩn Bộ GD&ĐT cho câu đúng-sai (thang chuẩn 1,0đ):
        // Đúng 1 ý: 0.1đ | Đúng 2 ý: 0.25đ | Đúng 3 ý: 0.50đ | Đúng 4 ý: 1.00đ
        let ptsRatio = 0;
        if (subCorrect === 1) ptsRatio = 0.10;
        else if (subCorrect === 2) ptsRatio = 0.25;
        else if (subCorrect === 3) ptsRatio = 0.50;
        else if (subCorrect === 4) ptsRatio = 1.00;

        totalScore += ptsRatio * ptsPerTF;
        if (subCorrect === 4) correctCount++;
        else if (subCorrect === 0) wrongCount++;
      } else {
        // Tự luận / Trả lời ngắn
        const textAns = typeof ans === 'object' ? ans?.text : ans;
        const fileAns = typeof ans === 'object' ? ans?.attachment : null;
        if ((textAns && String(textAns).trim().length > 3) || fileAns) {
          totalScore += ptsPerEssay;
          correctCount++;
        } else {
          wrongCount++;
        }
      }
    });

    const scaledScore = Math.min(10, Math.max(0, Number(totalScore.toFixed(1))));

    // Xếp loại học kỳ theo Thông tư 22/2021/TT-BGDĐT
    let rank = 'Chưa đạt';
    let rankBadge = 'bg-rose-100 text-rose-800 border-rose-300';
    if (scaledScore >= 8.0) {
      rank = 'Tốt (Giỏi)';
      rankBadge = 'bg-emerald-100 text-emerald-800 border-emerald-300';
    } else if (scaledScore >= 6.5) {
      rank = 'Khá';
      rankBadge = 'bg-blue-100 text-blue-800 border-blue-300';
    } else if (scaledScore >= 5.0) {
      rank = 'Đạt (Trung bình)';
      rankBadge = 'bg-amber-100 text-amber-800 border-amber-300';
    }

    return {
      scaledScore,
      correctCount,
      wrongCount,
      rank,
      rankBadge
    };
  }, [semesterMockExamQuestions, examAnswers, structureConfig]);

  const formatPeriodName = (p: ExamPeriod) => {
    switch (p) {
      case 'mid1': return 'Giữa học kỳ I (GK1)';
      case 'final1': return 'Cuối học kỳ I (CK1)';
      case 'mid2': return 'Giữa học kỳ II (GK2)';
      case 'final2': return 'Cuối học kỳ II (CK2)';
    }
  };

  const formatMinutes = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 font-serif">
      {/* 1. HEADER CHÍNH */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-[#006BFF] font-bold text-xs">
              GDPT 2018 • Khối {selectedGrade}
            </span>
            <span className="text-xs text-slate-500">Môn: <b>{selectedSubject}</b></span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#082B52] mt-1 flex items-center space-x-2.5">
            <GraduationCap className="w-8 h-8 text-[#006BFF]" />
            <span>Ôn tập & Thi thử Học kỳ</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Bộ đề cương tổng hợp, ma trận kiểm tra và phòng thi thử trực tuyến chuẩn cấu trúc Bộ GD&ĐT
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentView('student_practice')}
            className="px-3.5 py-2 border border-[#DCE8F7] bg-white text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 flex items-center space-x-1.5 transition-colors"
          >
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span>Luyện theo bài & chương</span>
          </button>
        </div>
      </div>

      {/* 2. CHỌN KỲ THI (4 KỲ THI CHÍNH THỨC) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { id: 'mid1', label: 'Giữa học kỳ I', sub: 'Trọng tâm bài 1 - 8' },
          { id: 'final1', label: 'Cuối học kỳ I', sub: 'Tổng hợp toàn bộ HK1' },
          { id: 'mid2', label: 'Giữa học kỳ II', sub: 'Trọng tâm bài 9 - 13' },
          { id: 'final2', label: 'Cuối học kỳ II', sub: 'Tổng kết năm học' }
        ].map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setSelectedPeriod(item.id as ExamPeriod);
              setIsExamRunning(false);
            }}
            className={`p-3.5 rounded-2xl border text-left transition-all ${
              selectedPeriod === item.id
                ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-300'
                : 'bg-white text-slate-700 border-[#DCE8F7] hover:border-blue-300 hover:bg-[#F3F8FF]'
            }`}
          >
            <div className="flex items-center space-x-1.5 text-xs font-bold">
              <Calendar className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </div>
            <div className={`text-[11px] mt-1 ${selectedPeriod === item.id ? 'text-blue-100' : 'text-slate-400'}`}>
              {item.sub}
            </div>
          </button>
        ))}
      </div>

      {/* 3. BỘ LỌC KHỐI LỚP & MÔN HỌC */}
      <div className="bg-white rounded-2xl border border-[#DCE8F7] p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-[#082B52]">Khối lớp:</span>
          {['6', '7', '8', '9'].map(g => (
            <button
              key={g}
              type="button"
              onClick={() => {
                setSelectedGrade(g);
                setIsExamRunning(false);
              }}
              className={`px-3 py-1.5 rounded-xl font-bold border transition-all ${
                selectedGrade === g
                  ? 'bg-[#006BFF] text-white border-[#006BFF] shadow-xs'
                  : 'bg-[#F3F8FF] text-slate-600 border-[#DCE8F7] hover:bg-slate-100'
              }`}
            >
              Lớp {g}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-[#082B52]">Môn học:</span>
          <select
            value={selectedSubject}
            onChange={e => {
              setSelectedSubject(e.target.value);
              setIsExamRunning(false);
            }}
            className="px-3 py-1.5 rounded-xl border border-[#DCE8F7] bg-white text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[#006BFF]"
          >
            <option value="Toán">Toán học</option>
            <option value="Tin học">Tin học</option>
            <option value="Khoa học tự nhiên">Khoa học tự nhiên</option>
            <option value="Ngữ văn">Ngữ văn</option>
            <option value="Tiếng Anh">Tiếng Anh</option>
            <option value="Lịch sử và Địa lí">Lịch sử & Địa lí</option>
            <option value="Công nghệ">Công nghệ</option>
            <option value="Giáo dục công dân">GDCD</option>
          </select>

          {/* Nút Giáo viên tùy chỉnh số câu */}
          <button
            type="button"
            onClick={() => setIsConfigModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold text-xs transition-all shadow-2xs cursor-pointer"
            title="Tùy chỉnh số lượng câu hỏi và ma trận đề thi"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-600" />
            <span>Tùy chỉnh số câu ({selectedSubject})</span>
          </button>
        </div>
      </div>

      {/* 4. TABS PHÂN HỆ ÔN TẬP HỌC KỲ */}
      {!isExamRunning && (
        <div className="flex border-b border-[#DCE8F7] space-x-4 text-xs font-bold">
          <button
            onClick={() => setActiveTab('mock_exam')}
            className={`pb-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
              activeTab === 'mock_exam'
                ? 'border-[#006BFF] text-[#006BFF]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>1. Đề thi thử học kỳ (Có bấm giờ)</span>
          </button>

          <button
            onClick={() => setActiveTab('curriculum_guide')}
            className={`pb-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
              activeTab === 'curriculum_guide'
                ? 'border-[#006BFF] text-[#006BFF]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>2. Đề cương kiến thức cốt lõi</span>
          </button>

          <button
            onClick={() => setActiveTab('matrix_spec')}
            className={`pb-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
              activeTab === 'matrix_spec'
                ? 'border-[#006BFF] text-[#006BFF]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>3. Ma trận & Đặc tả GDPT 2018</span>
          </button>
        </div>
      )}

      {/* 5. NỘI DUNG TỪNG PHÂN HỆ */}
      {!isExamRunning ? (
        activeTab === 'mock_exam' ? (
          /* TAB 1: PHÒNG THI THỬ HỌC KỲ */
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2 max-w-xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-semibold backdrop-blur-xs">
                      Đề thi thử chuẩn cấu trúc GDPT 2018 • {structureConfig.durationMinutes} phút
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsConfigModalOpen(true)}
                      className="px-2.5 py-0.5 bg-amber-400 hover:bg-amber-300 text-slate-900 rounded-full text-[11px] font-bold shadow-xs transition-colors inline-flex items-center space-x-1 cursor-pointer"
                    >
                      <Sliders className="w-3 h-3 text-slate-900" />
                      <span>Tùy chỉnh số câu</span>
                    </button>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold">
                    Đề kiểm tra {formatPeriodName(selectedPeriod)}
                  </h3>
                  <p className="text-blue-100 text-xs sm:text-sm leading-relaxed">
                    Môn: <b>{selectedSubject}</b> • Lớp <b>{selectedGrade}</b> • Cấu trúc gồm:{' '}
                    <b>{structureConfig.singleChoiceCount} câu Trắc nghiệm ABCD</b> ({(structureConfig.singleChoicePoints * 10).toFixed(0)}%),{' '}
                    <b>{structureConfig.trueFalseCount} câu Đúng - Sai 4 ý</b> ({(structureConfig.trueFalsePoints * 10).toFixed(0)}%), và{' '}
                    <b>{structureConfig.essayCount} câu Tự luận/Trả lời ngắn</b> ({(structureConfig.essayPoints * 10).toFixed(0)}%).{' '}
                    Tỷ lệ điểm: <b>({(structureConfig.singleChoicePoints * 10).toFixed(0)}-{(structureConfig.trueFalsePoints * 10).toFixed(0)}-{(structureConfig.essayPoints * 10).toFixed(0)})</b>.{' '}
                    Ma trận: <b>Biết {structureConfig.knowPercent}% - Hiểu {structureConfig.understandPercent}% - Vận dụng {structureConfig.applyPercent}%</b>.{' '}
                    Tự động chấm điểm và xếp loại học lực theo Thông tư 22/2021/TT-BGDĐT.
                  </p>
                  <div className="pt-1 flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setIsConfigModalOpen(true)}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold border border-white/30 backdrop-blur-xs transition-colors cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>⚙️ Giáo viên tùy chỉnh số câu & ma trận ({selectedSubject})</span>
                    </button>
                  </div>
                </div>

                <div className="shrink-0 text-center bg-white/10 p-5 rounded-2xl border border-white/20 backdrop-blur-md">
                  <div className="text-xs text-blue-200 uppercase font-semibold">Tổng số câu hỏi</div>
                  <div className="text-4xl font-extrabold text-white mt-1">
                    {semesterMockExamQuestions.length}
                  </div>
                  <div className="text-xs text-blue-200 mt-1">Thời gian: {structureConfig.durationMinutes} phút</div>
                  <button
                    onClick={handleStartSemesterExam}
                    disabled={semesterMockExamQuestions.length === 0}
                    className="mt-4 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center space-x-1.5 w-full cursor-pointer disabled:opacity-40"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Vào thi thử ngay</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Danh sách các đề ôn tập số 1, 2, 3 */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-[#082B52] flex items-center space-x-2">
                <FileCheck className="w-4 h-4 text-[#006BFF]" />
                <span>Các bộ đề thi thử có sẵn cho kỳ này:</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: 1, title: 'Đề số 01 - Đề chuẩn cơ bản', level: 'Chuẩn ma trận Bộ GD&ĐT', duration: '45 phút', count: semesterMockExamQuestions.length },
                  { id: 2, title: 'Đề số 02 - Đề nâng cao phân hóa', level: 'Tăng cường câu vận dụng', duration: '45 phút', count: semesterMockExamQuestions.length },
                  { id: 3, title: 'Đề số 03 - Đề tổng ôn trọng điểm', level: 'Quét toàn bộ đơn vị kiến thức', duration: '45 phút', count: semesterMockExamQuestions.length }
                ].map(examItem => (
                  <div
                    key={examItem.id}
                    className="bg-white rounded-2xl border border-[#DCE8F7] p-5 shadow-xs space-y-3 hover:border-blue-300 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                          Mã đề: TĐ-0{examItem.id}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">{examItem.duration}</span>
                      </div>
                      <h5 className="font-bold text-sm text-[#082B52]">{examItem.title}</h5>
                      <p className="text-xs text-slate-500">{examItem.level}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-[#006BFF]">{examItem.count} câu hỏi</span>
                      <button
                        onClick={handleStartSemesterExam}
                        className="px-3.5 py-1.5 bg-[#006BFF] hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-colors"
                      >
                        Bắt đầu
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : activeTab === 'curriculum_guide' ? (
          /* TAB 2: ĐỀ CƯƠNG KIẾN THỨC CỐT LÕI */
          <div className="bg-white rounded-2xl border border-[#DCE8F7] p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div>
                <h4 className="text-base font-bold text-[#082B52]">
                  Đề cương ôn tập trọng tâm: {formatPeriodName(selectedPeriod)}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Môn {selectedSubject} - Lớp {selectedGrade} • Căn cứ theo chương trình giáo dục phổ thông 2018
                </p>
              </div>

              <button
                onClick={() => window.print()}
                className="inline-flex items-center space-x-1.5 px-4 py-2 border border-[#DCE8F7] bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 transition-colors"
              >
                <Printer className="w-4 h-4 text-blue-600" />
                <span>In đề cương ôn tập</span>
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
              <div className="p-4 bg-blue-50/70 rounded-xl border border-blue-200 space-y-2">
                <b className="text-blue-900 text-sm block">A. NỘI DUNG LÝ THUYẾT TRỌNG TÂM:</b>
                <ul className="list-disc list-inside space-y-1.5 pl-2">
                  <li><b>Chủ đề 1: Máy tính và cộng đồng</b> – Thông tin và dữ liệu, các dạng thông tin cơ bản, vật mang tin; Đơn vị đo dung lượng thông tin (Bit, Byte, KB, MB, GB).</li>
                  <li><b>Chủ đề 2: Mạng máy tính và Internet</b> – Khái niệm mạng máy tính, các thiết bị mạng cơ bản (Switch, Router, Modem, Cáp mạng, Wi-Fi); Lợi ích và các dịch vụ phổ biến trên Internet.</li>
                  <li><b>Chủ đề 3: Tổ chức lưu trữ, tìm kiếm và trao đổi thông tin</b> – Sử dụng máy tìm kiếm (Google), đặt từ khóa tìm kiếm hiệu quả; Thư điện tử (Email) và các quy tắc bảo mật thông tin cá nhân.</li>
                  <li><b>Chủ đề 4: Ứng dụng tin học</b> – Soạn thảo văn bản, định dạng bảng biểu, sơ đồ tư duy; Xử lý và chỉnh sửa hình ảnh cơ bản.</li>
                </ul>
              </div>

              <div className="p-4 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-2">
                <b className="text-emerald-900 text-sm block">B. CÁC DẠNG BÀI TẬP VÀ THỰC HÀNH HAY XUẤT HIỆN TRONG ĐỀ THI:</b>
                <ul className="list-disc list-inside space-y-1.5 pl-2">
                  <li><b>Dạng 1:</b> Quy đổi các đơn vị đo dung lượng thông tin (Ví dụ: Một thẻ nhớ 16GB chứa được khoảng bao nhiêu bức ảnh 2MB?).</li>
                  <li><b>Dạng 2:</b> Nhận biết và phân loại các thiết bị mạng có dây và không dây trong phòng tin học thực tế.</li>
                  <li><b>Dạng 3:</b> Xác định địa chỉ thư điện tử hợp lệ và nhận diện các hành vi lừa đảo/mất an toàn trên mạng xã hội.</li>
                  <li><b>Dạng 4:</b> Mô tả thuật toán giải quyết vấn đề bằng cách liệt kê từng bước hoặc vẽ sơ đồ khối.</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          /* TAB 3: MA TRẬN & ĐẶC TẢ ĐỀ THI */
          <div className="bg-white rounded-2xl border border-[#DCE8F7] p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div>
                <h4 className="text-base font-bold text-[#082B52]">
                  Khung Ma trận Đề kiểm tra Học kỳ: Môn {selectedSubject} - Lớp {selectedGrade}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chuẩn hóa theo công văn hướng dẫn của Bộ GD&ĐT • Thang điểm 10.0
                </p>
              </div>

              <button
                onClick={() => setIsConfigModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-[#006BFF] border border-blue-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Sliders className="w-4 h-4" />
                <span>⚙️ Tùy chỉnh ma trận & số câu</span>
              </button>
            </div>

            {/* Bảng tỉ lệ nhận thức */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 bg-[#F3F8FF] rounded-xl border border-[#DCE8F7] text-center">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Nhận biết</span>
                <div className="text-2xl font-extrabold text-[#006BFF] mt-1">{structureConfig.knowPercent}%</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Tương đương {(structureConfig.knowPercent / 10).toFixed(1)} điểm</div>
              </div>

              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 text-center">
                <span className="text-[11px] font-bold text-blue-700 uppercase">Thông hiểu</span>
                <div className="text-2xl font-extrabold text-blue-700 mt-1">{structureConfig.understandPercent}%</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Tương đương {(structureConfig.understandPercent / 10).toFixed(1)} điểm</div>
              </div>

              <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200 text-center">
                <span className="text-[11px] font-bold text-indigo-700 uppercase">Vận dụng</span>
                <div className="text-2xl font-extrabold text-indigo-700 mt-1">{structureConfig.applyPercent}%</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Tương đương {(structureConfig.applyPercent / 10).toFixed(1)} điểm</div>
              </div>
            </div>

            {/* Bảng cấu trúc chi tiết */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F3F8FF] text-[#082B52] font-bold">
                  <tr>
                    <th className="p-3">Phần thi</th>
                    <th className="p-3">Dạng câu hỏi</th>
                    <th className="p-3">Số lượng câu</th>
                    <th className="p-3">Thang điểm</th>
                    <th className="p-3">Tỉ lệ điểm</th>
                    <th className="p-3">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="p-3 font-bold text-blue-900">Phần I</td>
                    <td className="p-3">Trắc nghiệm ABCD (1 ĐA đúng)</td>
                    <td className="p-3 font-semibold">{structureConfig.singleChoiceCount} câu</td>
                    <td className="p-3 font-semibold">{structureConfig.singleChoicePoints.toFixed(1)} điểm ({structureConfig.singleChoiceCount > 0 ? (structureConfig.singleChoicePoints / structureConfig.singleChoiceCount).toFixed(2) : 0}đ/câu)</td>
                    <td className="p-3 font-bold text-[#006BFF]">{(structureConfig.singleChoicePoints * 10).toFixed(0)}%</td>
                    <td className="p-3 text-slate-500">Bao quát toàn bộ bài học cốt lõi</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-blue-900">Phần II</td>
                    <td className="p-3">Trắc nghiệm Đúng – Sai (4 ý a, b, c, d)</td>
                    <td className="p-3 font-semibold">{structureConfig.trueFalseCount} câu ({structureConfig.trueFalseCount * 4} ý)</td>
                    <td className="p-3 font-semibold">{structureConfig.trueFalsePoints.toFixed(1)} điểm ({structureConfig.trueFalseCount > 0 ? (structureConfig.trueFalsePoints / structureConfig.trueFalseCount).toFixed(2) : 0}đ/câu)</td>
                    <td className="p-3 font-bold text-blue-700">{(structureConfig.trueFalsePoints * 10).toFixed(0)}%</td>
                    <td className="p-3 text-slate-500">Đúng 1=0.1đ, 2=0.25đ, 3=0.5đ, 4=1.0đ</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-blue-900">Phần III</td>
                    <td className="p-3">Tự luận / Trả lời ngắn</td>
                    <td className="p-3 font-semibold">{structureConfig.essayCount} câu</td>
                    <td className="p-3 font-semibold">{structureConfig.essayPoints.toFixed(1)} điểm ({structureConfig.essayCount > 0 ? (structureConfig.essayPoints / structureConfig.essayCount).toFixed(2) : 0}đ/câu)</td>
                    <td className="p-3 font-bold text-indigo-700">{(structureConfig.essayPoints * 10).toFixed(0)}%</td>
                    <td className="p-3 text-slate-500">Lập luận, giải thích, vẽ sơ đồ, tính toán</td>
                  </tr>
                  <tr className="bg-slate-50 font-bold">
                    <td colSpan={2} className="p-3 text-[#082B52]">Tổng cộng toàn đề</td>
                    <td className="p-3 text-[#006BFF]">{structureConfig.singleChoiceCount + structureConfig.trueFalseCount + structureConfig.essayCount} câu</td>
                    <td className="p-3 text-emerald-700">10.0 điểm</td>
                    <td className="p-3 text-emerald-700">100%</td>
                    <td className="p-3 text-slate-500">Thời gian làm bài: {structureConfig.durationMinutes} phút</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* ============================================================
           6. GIAO DIỆN PHÒNG THI THỬ HỌC KỲ TRỰC TUYẾN
           ============================================================ */
        <div className="space-y-4 max-w-4xl mx-auto">
          {isExamSubmitted ? (
            /* KẾT QUẢ THI THỬ HỌC KỲ */
            <div className="bg-white rounded-3xl border border-[#DCE8F7] p-8 shadow-md text-center space-y-6 animate-fadeIn">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
                <Award className="w-10 h-10" />
              </div>

              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                  Kết quả thi thử {formatPeriodName(selectedPeriod)}
                </span>
                <h3 className="text-3xl font-extrabold text-[#082B52] mt-1">
                  Điểm tổng kết: <span className="text-[#006BFF]">{examResult.scaledScore}</span> / 10
                </h3>
                <div className={`mt-2 inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold border ${examResult.rankBadge}`}>
                  <span>Xếp loại học lực: <b>{examResult.rank}</b></span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto text-xs">
                <div className="p-3 bg-[#F3F8FF] rounded-xl border border-[#DCE8F7]">
                  <span className="text-slate-500 block">Số câu đúng</span>
                  <b className="text-emerald-600 text-lg">{examResult.correctCount}</b>
                </div>
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                  <span className="text-rose-600 block">Số câu sai</span>
                  <b className="text-rose-700 text-lg">{examResult.wrongCount}</b>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <span className="text-blue-700 block">Đã trả lời</span>
                  <b className="text-blue-900 text-lg">{Object.keys(examAnswers).length} / {semesterMockExamQuestions.length}</b>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <span className="text-amber-700 block">Thời gian làm</span>
                  <b className="text-amber-800 text-lg">{formatMinutes(structureConfig.durationMinutes * 60 - examSecondsLeft)}</b>
                </div>
              </div>

              <div className="flex justify-center gap-3 pt-4 border-t">
                <button
                  onClick={handleStartSemesterExam}
                  className="px-5 py-2.5 bg-[#006BFF] text-white rounded-xl text-xs font-bold hover:bg-blue-600 transition-colors shadow-xs"
                >
                  Thi lại đề này
                </button>
                <button
                  onClick={() => setIsExamRunning(false)}
                  className="px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Quay lại trang đề cương học kỳ
                </button>
              </div>
            </div>
          ) : (
            /* ĐANG LÀM BÀI THI THỬ HỌC KỲ */
            <div className="space-y-4">
              {/* Header đồng hồ đếm ngược kỳ thi */}
              <div className="bg-white rounded-2xl border border-[#DCE8F7] p-4 shadow-xs flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="px-3 py-1 bg-blue-100 text-[#006BFF] rounded-lg text-xs font-bold">
                    Câu {examIndex + 1} / {semesterMockExamQuestions.length}
                  </span>
                  <span className="text-xs text-slate-600 font-semibold truncate max-w-xs">
                    {semesterMockExamQuestions[examIndex]?.lesson || 'Học kỳ'}
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1.5 px-3 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-xs font-mono font-bold">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>{formatMinutes(examSecondsLeft)}</span>
                  </div>

                  <button
                    onClick={() => {
                      if (window.confirm('Bạn có chắc chắn muốn nộp bài thi học kỳ sớm?')) {
                        setIsExamSubmitted(true);
                      }
                    }}
                    className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 shadow-xs"
                  >
                    Nộp bài thi
                  </button>
                </div>
              </div>

              {/* Bản đồ câu hỏi thi học kỳ */}
              <div className="bg-white rounded-2xl border border-[#DCE8F7] p-3 shadow-xs">
                <div className="text-[11px] font-bold text-slate-500 mb-1.5">Bản đồ câu hỏi thi:</div>
                <div className="flex flex-wrap gap-1.5">
                  {semesterMockExamQuestions.map((q, idx) => {
                    const isCur = idx === examIndex;
                    const isAns = examAnswers[q.id] !== undefined;
                    return (
                      <button
                        key={q.id}
                        onClick={() => setExamIndex(idx)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center border transition-all ${
                          isCur
                            ? 'bg-[#006BFF] text-white border-[#006BFF] ring-2 ring-blue-300'
                            : isAns
                            ? 'bg-blue-100 text-[#006BFF] border-blue-300'
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Nội dung câu hỏi thi học kỳ */}
              {semesterMockExamQuestions[examIndex] && (() => {
                const cur = semesterMockExamQuestions[examIndex];
                const ptsPerSingle = structureConfig.singleChoiceCount > 0 ? Number((structureConfig.singleChoicePoints / structureConfig.singleChoiceCount).toFixed(2)) : 0.25;
                const ptsPerTf = structureConfig.trueFalseCount > 0 ? Number((structureConfig.trueFalsePoints / structureConfig.trueFalseCount).toFixed(2)) : 1.0;
                const ptsPerEssay = structureConfig.essayCount > 0 ? Number((structureConfig.essayPoints / structureConfig.essayCount).toFixed(2)) : 1.0;

                const partLabel = cur.type === 'single_choice'
                  ? `Phần I: Trắc nghiệm ABCD (${ptsPerSingle}đ)`
                  : cur.type === 'true_false_group'
                  ? `Phần II: Đúng - Sai 4 ý (${ptsPerTf}đ)`
                  : `Phần III: Tự luận (${ptsPerEssay}đ)`;

                return (
                  <div className="bg-white rounded-2xl border border-[#DCE8F7] p-6 sm:p-8 shadow-xs space-y-5">
                    <div className="flex items-center justify-between border-b pb-3 text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-blue-600">[{cur.code}]</span>
                        <span className="font-semibold text-slate-500">
                          {partLabel}
                        </span>
                      </div>
                      <span className="font-bold text-[#082B52]">{cur.points || 0.5} điểm</span>
                    </div>

                    <div className="text-base sm:text-lg font-bold text-[#12345B]">
                      <MathView content={cur.stem} />
                    </div>

                    {/* Dạng ABCD */}
                    {cur.type === 'single_choice' && cur.options && (
                      <div className="space-y-2.5">
                        {cur.options.map((opt: any) => {
                          const isSel = examAnswers[cur.id] === opt.label;
                          return (
                            <button
                              key={opt.id || opt.label}
                              type="button"
                              onClick={() => handleSelectExamOption(cur.id, opt.label)}
                              className={`w-full p-3.5 rounded-xl border text-left flex items-start space-x-3 transition-all ${
                                isSel
                                  ? 'bg-blue-50 border-[#006BFF] ring-1 ring-[#006BFF] text-blue-900 font-semibold'
                                  : 'bg-white border-[#DCE8F7] hover:bg-slate-50'
                              }`}
                            >
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border ${
                                isSel ? 'bg-[#006BFF] text-white border-[#006BFF]' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {opt.label}
                              </span>
                              <div className="text-sm font-medium pt-0.5 flex-1">
                                <MathView content={opt.text} />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Dạng Đúng - Sai */}
                    {cur.type === 'true_false_group' && cur.subItems && (
                      <div className="space-y-2.5">
                        {cur.subItems.map((sub: any, sIdx: number) => {
                          const currVal = examAnswers[cur.id]?.[sub.id];
                          return (
                            <div key={sub.id || sIdx} className="p-3.5 rounded-xl border border-[#DCE8F7] bg-[#FBFDFF] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                              <div className="font-medium flex-1">
                                <b className="text-blue-600 mr-2">{sub.label || String.fromCharCode(97 + sIdx)})</b>
                                <MathView content={sub.text} />
                              </div>
                              <div className="flex items-center space-x-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const old = examAnswers[cur.id] || {};
                                    handleSelectExamOption(cur.id, { ...old, [sub.id]: true });
                                  }}
                                  className={`px-3 py-1.5 rounded-lg font-bold border transition-colors ${
                                    currVal === true ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700'
                                  }`}
                                >
                                  Đúng
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const old = examAnswers[cur.id] || {};
                                    handleSelectExamOption(cur.id, { ...old, [sub.id]: false });
                                  }}
                                  className={`px-3 py-1.5 rounded-lg font-bold border transition-colors ${
                                    currVal === false ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-700'
                                  }`}
                                >
                                  Sai
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Dạng Tự luận / Trả lời ngắn với hỗ trợ nhập text & đính kèm ảnh/file */}
                    {(cur.type === 'essay' || cur.type === 'short_answer') && (
                      <div className="space-y-3">
                        <label className="block text-xs font-bold text-slate-700">
                          Nhập bài giải tự luận hoặc đính kèm ảnh/file bài làm:
                        </label>
                        <textarea
                          rows={4}
                          value={typeof examAnswers[cur.id] === 'string' ? examAnswers[cur.id] : (examAnswers[cur.id]?.text || '')}
                          onChange={e => {
                            const prev = examAnswers[cur.id];
                            if (typeof prev === 'object' && prev !== null) {
                              handleSelectExamOption(cur.id, { ...prev, text: e.target.value });
                            } else {
                              handleSelectExamOption(cur.id, e.target.value);
                            }
                          }}
                          placeholder="Trình bày chi tiết lời giải, cách tính toán hoặc các bước thực hiện..."
                          className="w-full px-4 py-3 rounded-xl border border-[#DCE8F7] bg-[#F3F8FF] text-sm focus:outline-hidden focus:ring-2 focus:ring-[#006BFF]"
                        />

                        {/* Upload ảnh / file bài làm */}
                        <div className="p-3.5 bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-600 flex items-center space-x-1.5">
                              <Camera className="w-4 h-4 text-blue-600" />
                              <span>Đính kèm ảnh chụp bài giải viết tay hoặc file tệp:</span>
                            </span>
                            <label className="cursor-pointer inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-[#DCE8F7] hover:border-blue-400 rounded-lg text-xs font-bold text-[#006BFF] shadow-2xs">
                              <Upload className="w-3.5 h-3.5" />
                              <span>Chọn ảnh / tệp</span>
                              <input
                                type="file"
                                accept="image/*,.pdf,.doc,.docx"
                                className="hidden"
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = ev => {
                                      const dataUrl = ev.target?.result as string;
                                      const prev = examAnswers[cur.id];
                                      const currentText = typeof prev === 'string' ? prev : (prev?.text || '');
                                      const currentFiles = (typeof prev === 'object' && Array.isArray(prev?.files)) ? prev.files : [];
                                      handleSelectExamOption(cur.id, {
                                        text: currentText,
                                        files: [...currentFiles, { name: file.name, url: dataUrl }]
                                      });
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>
                          </div>

                          {/* Preview danh sách file đã tải lên */}
                          {(() => {
                            const val = examAnswers[cur.id];
                            const files: Array<{ name: string; url: string }> = (typeof val === 'object' && Array.isArray(val?.files)) ? val.files : [];
                            if (files.length === 0) return null;
                            return (
                              <div className="flex flex-wrap gap-2 pt-2">
                                {files.map((f, fIdx) => (
                                  <div key={fIdx} className="relative group rounded-lg border border-blue-200 bg-white p-1.5 flex items-center space-x-2">
                                    {f.url.startsWith('data:image') ? (
                                      <img src={f.url} alt={f.name} className="w-10 h-10 object-cover rounded-md" />
                                    ) : (
                                      <FileText className="w-6 h-6 text-blue-600" />
                                    )}
                                    <div className="text-[11px] max-w-[120px] truncate text-slate-700 font-medium">
                                      {f.name}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updatedFiles = files.filter((_, idx) => idx !== fIdx);
                                        const currentText = typeof val === 'string' ? val : (val?.text || '');
                                        handleSelectExamOption(cur.id, {
                                          text: currentText,
                                          files: updatedFiles
                                        });
                                      }}
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
                                      title="Xóa tệp"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Nút chuyển câu */}
                    <div className="flex items-center justify-between pt-4 border-t">
                      <button
                        type="button"
                        onClick={() => setExamIndex(p => Math.max(0, p - 1))}
                        disabled={examIndex === 0}
                        className="px-4 py-2 border rounded-xl text-xs font-bold disabled:opacity-30 flex items-center space-x-1"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Câu trước</span>
                      </button>

                      {examIndex < semesterMockExamQuestions.length - 1 ? (
                        <button
                          type="button"
                          onClick={() => setExamIndex(p => p + 1)}
                          className="px-5 py-2 bg-[#006BFF] text-white rounded-xl text-xs font-bold hover:bg-blue-600 flex items-center space-x-1"
                        >
                          <span>Câu tiếp theo</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsExamSubmitted(true)}
                          className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-xs"
                        >
                          Nộp bài thi ngay
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Modal tùy chỉnh ma trận số câu cho giáo viên */}
      <ExamStructureConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        initialSubject={selectedSubject}
        onStructureUpdated={cfg => setStructureConfig(cfg)}
      />
    </div>
  );
};

