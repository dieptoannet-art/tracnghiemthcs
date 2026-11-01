import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Assignment, Question, Submission, SubmissionAnswer } from '../../types';
import { MathView } from '../MathView';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flag,
  Send,
  Save,
  RotateCcw,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Camera,
  Image as ImageIcon,
  Upload,
  Trash2,
  RotateCw,
  ZoomIn,
  ZoomOut,
  X,
  Maximize2,
  Eye,
  FileText
} from 'lucide-react';

interface ExamTakingProps {
  assignmentId?: string;
  onBackToDashboard?: () => void;
}

export const ExamTaking: React.FC<ExamTakingProps> = ({ assignmentId, onBackToDashboard }) => {
  const { assignments, exams, studentUser, submitExamSession } = useApp();

  // Find target assignment or pick active one
  const targetAssignment = useMemo(() => {
    if (assignmentId) return assignments.find(a => a.id === assignmentId);
    return assignments.find(a => a.status === 'active') || assignments[0];
  }, [assignments, assignmentId]);

  const targetExam = useMemo(() => {
    if (!targetAssignment) return null;
    return exams.find(e => e.id === targetAssignment.examId) || exams[0];
  }, [targetAssignment, exams]);

  // Session state
  const [currentQIndex, setCurrentQIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [isSavedLocally, setIsSavedLocally] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [submittedResult, setSubmittedResult] = useState<Submission | null>(null);
  const [tabSwitches, setTabSwitches] = useState<number>(0);

  // Image handling state for essay questions
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const [previewModal, setPreviewModal] = useState<{
    url: string;
    title: string;
    zoom: number;
    rotation: number;
  } | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Utility: Client-side image compression
  const compressImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = event => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_DIM = 1600;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_DIM) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
          } else {
            resolve(event.target?.result as string);
          }
        };
        img.onerror = () => reject(new Error('Lỗi tải ảnh'));
      };
      reader.onerror = () => reject(new Error('Lỗi đọc file'));
    });
  };

  // Utility: Rotate image base64 clockwise 90 degrees
  const rotateImageBase64 = (base64: string, callback: (rotated: string) => void) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((90 * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        callback(canvas.toDataURL('image/jpeg', 0.85));
      }
    };
  };

  // Get essay state safely
  const getEssayState = (qId: string): { text: string; images: string[] } => {
    const val = answers[qId];
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      return {
        text: typeof val.text === 'string' ? val.text : '',
        images: Array.isArray(val.images) ? val.images : []
      };
    }
    return {
      text: typeof val === 'string' ? val : '',
      images: []
    };
  };

  // Timer: seconds left
  const totalSeconds = (targetAssignment?.durationMinutes || 45) * 60;
  const [secondsLeft, setSecondsLeft] = useState<number>(totalSeconds);

  // Restore answers from localStorage if refreshed
  useEffect(() => {
    if (!targetAssignment) return;
    const storageKey = `exam_session_${targetAssignment.id}_${studentUser.id}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.answers) setAnswers(parsed.answers);
        if (parsed.flagged) setFlagged(parsed.flagged);
        if (parsed.secondsLeft) setSecondsLeft(parsed.secondsLeft);
      } catch (e) {
        console.error('Error restoring session', e);
      }
    }
  }, [targetAssignment, studentUser.id]);

  // Track tab switches (warning only, per guidelines: does not auto-cancel exam)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !submittedResult) {
        setTabSwitches(prev => prev + 1);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [submittedResult]);

  // Countdown timer interval
  useEffect(() => {
    if (submittedResult) return;
    const timer = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [submittedResult]);

  // Save session state to localStorage on answer update
  const saveToStorage = (newAnswers: Record<string, any>, newFlagged: Record<string, boolean>) => {
    if (!targetAssignment) return;
    setIsSavedLocally(false);
    const storageKey = `exam_session_${targetAssignment.id}_${studentUser.id}`;
    localStorage.setItem(storageKey, JSON.stringify({
      answers: newAnswers,
      flagged: newFlagged,
      secondsLeft,
      timestamp: Date.now()
    }));
    setTimeout(() => setIsSavedLocally(true), 300);
  };

  const handleSelectSingleChoice = (questionId: string, opt: string) => {
    const updated = { ...answers, [questionId]: opt };
    setAnswers(updated);
    saveToStorage(updated, flagged);
  };

  const handleSelectTrueFalse = (questionId: string, subId: string, val: boolean) => {
    const curr = answers[questionId] || {};
    const updated = {
      ...answers,
      [questionId]: {
        ...curr,
        [subId]: val
      }
    };
    setAnswers(updated);
    saveToStorage(updated, flagged);
  };

  const handleShortAnswer = (questionId: string, text: string) => {
    const updated = { ...answers, [questionId]: text };
    setAnswers(updated);
    saveToStorage(updated, flagged);
  };

  const handleEssayTextChange = (questionId: string, text: string) => {
    const current = getEssayState(questionId);
    const updated = {
      ...answers,
      [questionId]: {
        ...current,
        text
      }
    };
    setAnswers(updated);
    saveToStorage(updated, flagged);
  };

  const handleAddEssayFiles = async (questionId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsProcessingImage(true);
    try {
      const current = getEssayState(questionId);
      const remainingSlots = Math.max(0, 5 - current.images.length);
      const filesToProcess = Array.from(files).slice(0, remainingSlots);

      const processedImages: string[] = [];
      for (const file of filesToProcess) {
        if (!file.type.startsWith('image/')) continue;
        const compressed = await compressImageFile(file);
        processedImages.push(compressed);
      }

      if (processedImages.length > 0) {
        const updatedImages = [...current.images, ...processedImages];
        const updated = {
          ...answers,
          [questionId]: {
            ...current,
            images: updatedImages
          }
        };
        setAnswers(updated);
        saveToStorage(updated, flagged);
      }
    } catch (err) {
      console.error('Lỗi nén hoặc tải ảnh:', err);
    } finally {
      setIsProcessingImage(false);
      if (galleryInputRef.current) galleryInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleRemoveEssayImage = (questionId: string, indexToRemove: number) => {
    const current = getEssayState(questionId);
    const updatedImages = current.images.filter((_, idx) => idx !== indexToRemove);
    const updated = {
      ...answers,
      [questionId]: {
        ...current,
        images: updatedImages
      }
    };
    setAnswers(updated);
    saveToStorage(updated, flagged);
  };

  const handleRotateEssayImage = (questionId: string, indexToRotate: number) => {
    const current = getEssayState(questionId);
    const target = current.images[indexToRotate];
    if (!target) return;
    rotateImageBase64(target, rotated => {
      const updatedImages = [...current.images];
      updatedImages[indexToRotate] = rotated;
      const updated = {
        ...answers,
        [questionId]: {
          ...current,
          images: updatedImages
        }
      };
      setAnswers(updated);
      saveToStorage(updated, flagged);
    });
  };

  const isQuestionAnswered = (q: Question) => {
    const ans = answers[q.id];
    if (ans === undefined || ans === null) return false;
    if (q.type === 'single_choice') return !!ans;
    if (q.type === 'short_answer') return String(ans).trim().length > 0;
    if (q.type === 'true_false_group') return typeof ans === 'object' && Object.keys(ans).length > 0;
    if (q.type === 'essay') {
      if (typeof ans === 'object' && ans !== null) {
        return (ans.text && ans.text.trim().length > 0) || (Array.isArray(ans.images) && ans.images.length > 0);
      }
      return String(ans).trim().length > 0;
    }
    return false;
  };

  const toggleFlag = (questionId: string) => {
    const updated = { ...flagged, [questionId]: !flagged[questionId] };
    setFlagged(updated);
    saveToStorage(answers, updated);
  };

  // Grade submission
  const calculateResult = (): Submission => {
    if (!targetAssignment || !targetExam) throw new Error('Missing exam context');

    let totalScore = 0;
    const formattedAnswers: Record<string, SubmissionAnswer> = {};

    targetExam.questions.forEach(q => {
      const userAns = answers[q.id];
      let isCorrect = false;
      let pointsAwarded = 0;

      if (q.type === 'single_choice') {
        isCorrect = userAns === q.correctAnswer;
        pointsAwarded = isCorrect ? q.points : 0;
        formattedAnswers[q.id] = {
          questionId: q.id,
          questionType: q.type,
          selectedOption: userAns,
          isCorrect,
          pointsAwarded
        };
      } else if (q.type === 'true_false_group') {
        const itemAnswers = (userAns || {}) as Record<string, boolean>;
        let subCorrect = 0;
        q.subItems?.forEach(sub => {
          if (itemAnswers[sub.id] === sub.isCorrect) {
            subCorrect += 1;
          }
        });
        // Quy tắc điểm GDPT 2018: 1 ý = 0.1, 2 ý = 0.25, 3 ý = 0.5, 4 ý = 1.0 (trên thang 1.0đ)
        if (subCorrect === 1) pointsAwarded = 0.1 * (q.points / 1.0);
        else if (subCorrect === 2) pointsAwarded = 0.25 * (q.points / 1.0);
        else if (subCorrect === 3) pointsAwarded = 0.5 * (q.points / 1.0);
        else if (subCorrect === 4) pointsAwarded = 1.0 * (q.points / 1.0);

        isCorrect = subCorrect === (q.subItems?.length || 4);
        formattedAnswers[q.id] = {
          questionId: q.id,
          questionType: q.type,
          trueFalseAnswers: itemAnswers,
          isCorrect,
          pointsAwarded
        };
      } else if (q.type === 'short_answer') {
        const normalized = String(userAns || '').trim().toLowerCase();
        isCorrect = (q.acceptedAnswers || []).some(a => a.toLowerCase().trim() === normalized);
        pointsAwarded = isCorrect ? q.points : 0;
        formattedAnswers[q.id] = {
          questionId: q.id,
          questionType: q.type,
          shortAnswerText: userAns,
          isCorrect,
          pointsAwarded
        };
      } else if (q.type === 'essay') {
        const essayVal = userAns;
        let essayText = '';
        let essayImages: string[] = [];
        if (typeof essayVal === 'object' && essayVal !== null) {
          essayText = typeof essayVal.text === 'string' ? essayVal.text : '';
          essayImages = Array.isArray(essayVal.images) ? essayVal.images : [];
        } else if (typeof essayVal === 'string') {
          essayText = essayVal;
        }

        // Essay is pending teacher grading
        formattedAnswers[q.id] = {
          questionId: q.id,
          questionType: q.type,
          essayAnswerText: essayText,
          essayImages,
          pointsAwarded: 0,
          teacherFeedback: 'Đang chờ giáo viên chấm bài'
        };
      }

      totalScore += pointsAwarded;
    });

    const hasEssay = targetExam.questions.some(q => q.type === 'essay');

    return {
      id: `sub-${Date.now()}`,
      assignmentId: targetAssignment.id,
      examId: targetExam.id,
      examTitle: targetExam.title,
      studentId: studentUser.id,
      studentName: studentUser.fullName,
      studentClass: studentUser.className,
      grade: targetAssignment.grade,
      subject: targetAssignment.subject,
      startTime: new Date(Date.now() - (totalSeconds - secondsLeft) * 1000).toLocaleString('vi-VN'),
      submittedAt: new Date().toLocaleString('vi-VN'),
      timeSpentSeconds: totalSeconds - secondsLeft,
      status: hasEssay ? 'in_progress' : 'graded',
      answers: formattedAnswers,
      score: parseFloat(totalScore.toFixed(2)),
      maxScore: targetExam.totalPoints,
      tabSwitchCount: tabSwitches
    };
  };

  const handleConfirmSubmit = () => {
    setShowSubmitModal(false);
    setIsSubmitting(true);
    setTimeout(() => {
      const res = calculateResult();
      submitExamSession(res);
      setSubmittedResult(res);
      setIsSubmitting(false);
      if (targetAssignment) {
        localStorage.removeItem(`exam_session_${targetAssignment.id}_${studentUser.id}`);
      }
    }, 600);
  };

  const handleAutoSubmit = () => {
    const res = calculateResult();
    submitExamSession(res);
    setSubmittedResult(res);
    if (targetAssignment) {
      localStorage.removeItem(`exam_session_${targetAssignment.id}_${studentUser.id}`);
    }
  };

  if (!targetAssignment || !targetExam) {
    return (
      <div className="bg-white rounded-2xl border border-[#DCE8F7] p-8 text-center max-w-lg mx-auto space-y-4">
        <h3 className="text-xl font-bold text-[#082B52]">Không có bài kiểm tra khả dụng</h3>
        <p className="text-sm text-slate-500">Hiện tại chưa có bài kiểm tra nào được phát hành cho lớp của bạn.</p>
        <button
          onClick={onBackToDashboard}
          className="px-4 py-2 bg-[#006BFF] text-white rounded-xl text-sm font-bold"
        >
          Quay lại bảng điều khiển
        </button>
      </div>
    );
  }

  // Formatting minutes and seconds
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const currentQ = targetExam.questions[currentQIndex];
  const unansweredCount = targetExam.questions.filter(q => !isQuestionAnswered(q)).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Result Display after Submit */}
      {submittedResult ? (
        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex flex-col items-center text-center space-y-3 pb-6 border-b border-slate-100">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-[#082B52]">Nộp bài kiểm tra thành công!</h2>
            <p className="text-sm text-slate-600">
              Bài thi: <b>{targetExam.title}</b> ({targetExam.code})
            </p>
            <p className="text-xs text-slate-400">
              Thời gian nộp: {submittedResult.submittedAt} • Thời gian làm bài: {Math.round(submittedResult.timeSpentSeconds / 60)} phút
            </p>
          </div>

          {/* Score card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#F3F8FF] border border-[#DCE8F7] rounded-xl p-4 text-center">
              <span className="text-xs text-slate-500 font-bold uppercase">Điểm phần trắc nghiệm</span>
              <div className="text-3xl font-bold text-[#006BFF] mt-1">
                {submittedResult.score.toFixed(2)} / {submittedResult.maxScore}
              </div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
              <span className="text-xs text-emerald-800 font-bold uppercase">Tình trạng chấm</span>
              <div className="text-sm font-bold text-emerald-700 mt-2">
                {targetExam.questions.some(q => q.type === 'essay') ? 'Đã chấm trắc nghiệm (Chờ tự luận)' : 'Đã hoàn tất chấm điểm'}
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <span className="text-xs text-amber-800 font-bold uppercase">Lần rời tab trình duyệt</span>
              <div className="text-2xl font-bold text-amber-700 mt-1">
                {submittedResult.tabSwitchCount} lần
              </div>
            </div>
          </div>

          {/* Solutions Review if allowed */}
          {targetAssignment.showSolutionAfterSubmit ? (
            <div className="space-y-4 pt-4">
              <h3 className="text-lg font-bold text-[#082B52] border-b border-slate-100 pb-2">
                Xem lại bài làm và lời giải chi tiết
              </h3>

              <div className="space-y-4">
                {targetExam.questions.map((q, idx) => {
                  const subAns = submittedResult.answers[q.id];
                  const isCorrect = subAns?.isCorrect;

                  return (
                    <div
                      key={q.id}
                      className={`p-4 rounded-xl border ${
                        isCorrect
                          ? 'border-emerald-200 bg-emerald-50/30'
                          : q.type === 'essay'
                          ? 'border-blue-200 bg-blue-50/20'
                          : 'border-red-200 bg-red-50/30'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-bold text-sm text-[#082B52]">
                          Câu {idx + 1}: [{q.code}] - {q.points} điểm
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-sm ${
                          isCorrect
                            ? 'bg-emerald-100 text-emerald-800'
                            : q.type === 'essay'
                            ? 'bg-blue-100 text-[#006BFF]'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {q.type === 'essay' ? 'Tự luận' : isCorrect ? 'ĐÚNG' : 'SAI'}
                        </span>
                      </div>

                      <div className="text-sm text-slate-800 my-2">
                        <MathView content={q.stem} />
                      </div>

                      {q.type === 'single_choice' && (
                        <div className="text-xs space-y-1">
                          <p>Bạn chọn: <b>{subAns?.selectedOption || 'Chưa chọn'}</b></p>
                          <p className="text-emerald-700">Đáp án đúng: <b>{q.correctAnswer}</b></p>
                        </div>
                      )}

                      {q.type === 'short_answer' && (
                        <div className="text-xs space-y-1">
                          <p>Bạn trả lời: <b>{subAns?.shortAnswerText || 'Để trống'}</b></p>
                          <p className="text-emerald-700">Đáp án chuẩn: <b>{q.acceptedAnswers?.join(' | ')}</b></p>
                        </div>
                      )}

                      {q.type === 'essay' && (
                        <div className="text-xs space-y-2 mt-2">
                          <div className="p-3 bg-white rounded-lg border border-slate-200">
                            <span className="font-bold text-[#082B52] block mb-1">
                              Bài làm tự luận của bạn:
                            </span>
                            {subAns?.essayAnswerText ? (
                              <p className="whitespace-pre-line text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                {subAns.essayAnswerText}
                              </p>
                            ) : (
                              <p className="text-slate-400 italic">Không nhập văn bản</p>
                            )}

                            {subAns?.essayImages && subAns.essayImages.length > 0 && (
                              <div className="mt-3">
                                <span className="font-semibold text-slate-700 block mb-1.5 flex items-center space-x-1">
                                  <ImageIcon className="w-3.5 h-3.5 text-[#006BFF]" />
                                  <span>Ảnh chụp bài làm đính kèm ({subAns.essayImages.length} ảnh):</span>
                                </span>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                  {subAns.essayImages.map((imgUrl, i) => (
                                    <div
                                      key={i}
                                      onClick={() => setPreviewModal({ url: imgUrl, title: `Ảnh bài làm ${i + 1}`, zoom: 1, rotation: 0 })}
                                      className="group relative cursor-pointer border rounded-lg overflow-hidden bg-slate-100 aspect-4/3 hover:border-[#006BFF] transition-all"
                                    >
                                      <img
                                        src={imgUrl}
                                        alt={`Bài làm ${i + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                        <Eye className="w-4 h-4" />
                                      </div>
                                      <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                                        Trang {i + 1}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200 text-xs">
                        <b className="text-amber-800">Lời giải chi tiết:</b>
                        <div className="mt-1 text-slate-700">
                          <MathView content={q.explanation} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-blue-50 rounded-xl text-center text-xs text-blue-800 border border-blue-200">
              Giáo viên đã cấu hình không mở xem đáp án ngay sau khi nộp bài. Lời giải sẽ được công bố khi hết thời hạn làm bài của lớp.
            </div>
          )}

          <div className="text-center pt-4">
            <button
              onClick={() => {
                setSubmittedResult(null);
                if (onBackToDashboard) onBackToDashboard();
              }}
              className="px-6 py-2.5 bg-[#006BFF] text-white rounded-xl font-bold text-sm hover:bg-blue-600 transition-colors"
            >
              Về trang chủ
            </button>
          </div>
        </div>
      ) : (
        /* LIVE EXAM TAKING INTERFACE */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column: Exam questions (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Top Bar inside exam card */}
            <div className="bg-white rounded-2xl border border-[#DCE8F7] p-4 shadow-xs flex items-center justify-between">
              <div>
                <h3 className="font-bold text-[#082B52] text-sm sm:text-base">
                  {targetExam.title}
                </h3>
                <span className="text-xs text-slate-500">Mã đề: {targetExam.code}</span>
              </div>

              {/* Auto-save status indicator */}
              <div className="flex items-center space-x-1.5 text-xs">
                {isSavedLocally ? (
                  <span className="text-emerald-600 flex items-center space-x-1">
                    <Check className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Đã tự động lưu</span>
                  </span>
                ) : (
                  <span className="text-amber-600 flex items-center space-x-1 animate-pulse">
                    <Save className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Đang lưu...</span>
                  </span>
                )}
              </div>
            </div>

            {/* Question Card */}
            <div className="bg-white rounded-2xl border border-[#DCE8F7] p-6 shadow-xs space-y-6 min-h-[420px] flex flex-col justify-between">
              <div>
                {/* Header of question */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-base font-bold text-[#006BFF]">
                      Câu {currentQIndex + 1}
                    </span>
                    <span className="text-xs text-slate-400">
                      / {targetExam.questions.length} ({currentQ.points} điểm)
                    </span>
                  </div>

                  <button
                    onClick={() => toggleFlag(currentQ.id)}
                    className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                      flagged[currentQ.id]
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>{flagged[currentQ.id] ? 'Đã đánh dấu xem lại' : 'Đánh dấu xem lại'}</span>
                  </button>
                </div>

                {/* Question Stem with KaTeX math view */}
                <div className="text-base sm:text-lg font-medium text-[#12345B] leading-relaxed mb-6">
                  <MathView content={currentQ.stem} />
                </div>

                {/* Form fields by question type */}
                {currentQ.type === 'single_choice' && currentQ.options && (
                  <div className="space-y-3">
                    {currentQ.options.map(opt => {
                      const isSelected = answers[currentQ.id] === opt.label;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => handleSelectSingleChoice(currentQ.id, opt.label)}
                          className={`w-full p-3.5 rounded-xl border text-left flex items-start space-x-3 transition-all ${
                            isSelected
                              ? 'border-[#006BFF] bg-blue-50/70 ring-1 ring-[#006BFF]'
                              : 'border-[#DCE8F7] hover:border-blue-300 hover:bg-[#F3F8FF]'
                          }`}
                        >
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                            isSelected ? 'bg-[#006BFF] text-white' : 'bg-white border border-slate-300 text-slate-700'
                          }`}>
                            {opt.label}
                          </span>
                          <div className="text-sm font-medium pt-0.5">
                            <MathView content={opt.text} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {currentQ.type === 'true_false_group' && currentQ.subItems && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500 italic">Chọn Đúng hoặc Sai cho mỗi ý sau:</p>
                    {currentQ.subItems.map(item => {
                      const ansVal = answers[currentQ.id]?.[item.id];
                      return (
                        <div
                          key={item.id}
                          className="p-3 rounded-xl border border-[#DCE8F7] bg-[#FBFDFF] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="text-sm font-medium">
                            <span className="font-bold text-[#006BFF] mr-2">{item.label})</span>
                            <MathView content={item.text} />
                          </div>
                          <div className="flex items-center space-x-2 shrink-0">
                            <button
                              onClick={() => handleSelectTrueFalse(currentQ.id, item.id, true)}
                              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                ansVal === true
                                  ? 'bg-[#006BFF] text-white border-[#006BFF]'
                                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              Đúng
                            </button>
                            <button
                              onClick={() => handleSelectTrueFalse(currentQ.id, item.id, false)}
                              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                ansVal === false
                                  ? 'bg-rose-600 text-white border-rose-600'
                                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
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

                {currentQ.type === 'short_answer' && (
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-600">
                      Điền câu trả lời ngắn:
                    </label>
                    <input
                      type="text"
                      value={answers[currentQ.id] || ''}
                      onChange={e => handleShortAnswer(currentQ.id, e.target.value)}
                      placeholder="Nhập kết quả số hoặc từ khóa (ví dụ: 25)..."
                      className="w-full px-4 py-3 rounded-xl border border-[#DCE8F7] bg-[#F3F8FF] text-sm focus:outline-hidden focus:ring-2 focus:ring-[#006BFF]"
                    />
                  </div>
                )}

                {currentQ.type === 'essay' && (() => {
                  const essayState = getEssayState(currentQ.id);
                  return (
                    <div className="space-y-4">
                      {/* Section 1: Textual input */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                            <FileText className="w-4 h-4 text-[#006BFF]" />
                            <span>1. Trình bày bài giải / Lập luận bằng chữ:</span>
                          </label>
                          <span className="text-[11px] text-slate-400">
                            {essayState.text.length} ký tự
                          </span>
                        </div>
                        <textarea
                          rows={4}
                          value={essayState.text}
                          onChange={e => handleEssayTextChange(currentQ.id, e.target.value)}
                          placeholder="Ghi rõ các bước lập luận, giả thiết, kết luận hoặc tóm tắt lời giải..."
                          className="w-full px-4 py-3 rounded-xl border border-[#DCE8F7] bg-[#F3F8FF] text-sm focus:outline-hidden focus:ring-2 focus:ring-[#006BFF]"
                        />
                      </div>

                      {/* Section 2: Photo / Document Upload */}
                      <div className="space-y-3 p-4 bg-[#F8FAFC] border border-[#DCE8F7] rounded-xl">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center space-x-1.5 font-bold text-xs text-[#082B52]">
                              <ImageIcon className="w-4 h-4 text-[#006BFF]" />
                              <span>2. Đính kèm ảnh chụp bài làm & hình vẽ (Khuyến nghị cho môn Toán):</span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Bạn có thể vẽ hình ra giấy thi, làm bài tay rồi chụp ảnh tải lên (tối đa 5 ảnh).
                            </p>
                          </div>

                          <span className="text-xs font-bold text-[#006BFF] px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg self-start sm:self-auto">
                            Đã đính kèm: {essayState.images.length}/5 ảnh
                          </span>
                        </div>

                        {/* Upload action triggers */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {/* Hidden file inputs */}
                          <input
                            ref={galleryInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={e => handleAddEssayFiles(currentQ.id, e.target.files)}
                          />
                          <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={e => handleAddEssayFiles(currentQ.id, e.target.files)}
                          />

                          {/* Trigger buttons */}
                          <button
                            type="button"
                            disabled={essayState.images.length >= 5 || isProcessingImage}
                            onClick={() => galleryInputRef.current?.click()}
                            className="flex items-center justify-center space-x-2 px-3 py-2.5 bg-white border border-[#DCE8F7] hover:border-[#006BFF] hover:bg-[#F3F8FF] text-xs font-bold text-slate-700 rounded-xl transition-all disabled:opacity-40 disabled:pointer-events-none shadow-2xs cursor-pointer"
                          >
                            <Upload className="w-4 h-4 text-[#006BFF]" />
                            <span>Tải ảnh từ máy / Thư viện</span>
                          </button>

                          <button
                            type="button"
                            disabled={essayState.images.length >= 5 || isProcessingImage}
                            onClick={() => cameraInputRef.current?.click()}
                            className="flex items-center justify-center space-x-2 px-3 py-2.5 bg-white border border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50 text-xs font-bold text-emerald-800 rounded-xl transition-all disabled:opacity-40 disabled:pointer-events-none shadow-2xs cursor-pointer"
                          >
                            <Camera className="w-4 h-4 text-emerald-600" />
                            <span>Chụp ảnh bài làm (Camera)</span>
                          </button>
                        </div>

                        {/* Processing state */}
                        {isProcessingImage && (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-[#006BFF] flex items-center space-x-2">
                            <div className="w-3.5 h-3.5 border-2 border-[#006BFF] border-t-transparent rounded-full animate-spin" />
                            <span>Đang nén và tối ưu hóa hình ảnh...</span>
                          </div>
                        )}

                        {/* Thumbnail Gallery */}
                        {essayState.images.length > 0 && (
                          <div className="space-y-2 pt-2">
                            <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                              Ảnh đã tải lên (nhấn để phóng to hoặc xoay lại chiều):
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                              {essayState.images.map((img, idx) => (
                                <div
                                  key={idx}
                                  className="relative group border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs"
                                >
                                  {/* Thumbnail display */}
                                  <div
                                    onClick={() => setPreviewModal({ url: img, title: `Trang ${idx + 1} - Bài tự luận`, zoom: 1, rotation: 0 })}
                                    className="cursor-pointer aspect-4/3 overflow-hidden bg-slate-100 flex items-center justify-center relative"
                                  >
                                    <img
                                      src={img}
                                      alt={`Trang ${idx + 1}`}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                    />
                                    <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-1.5 text-white">
                                      <ZoomIn className="w-4 h-4" />
                                      <span className="text-[11px] font-semibold">Xem to</span>
                                    </div>
                                  </div>

                                  {/* Badge info */}
                                  <div className="p-1.5 bg-white border-t border-slate-100 flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-[#082B52]">
                                      Trang {idx + 1}
                                    </span>
                                    <div className="flex items-center space-x-1">
                                      {/* Rotate button */}
                                      <button
                                        type="button"
                                        title="Xoay ảnh 90°"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRotateEssayImage(currentQ.id, idx);
                                        }}
                                        className="p-1 hover:bg-slate-100 text-slate-600 rounded transition-colors"
                                      >
                                        <RotateCw className="w-3.5 h-3.5" />
                                      </button>
                                      {/* Delete button */}
                                      <button
                                        type="button"
                                        title="Xóa ảnh này"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemoveEssayImage(currentQ.id, idx);
                                        }}
                                        className="p-1 hover:bg-rose-50 text-rose-600 rounded transition-colors"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Prev / Next navigation */}
              <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                <button
                  disabled={currentQIndex === 0}
                  onClick={() => setCurrentQIndex(prev => prev - 1)}
                  className="px-4 py-2 rounded-xl border border-[#DCE8F7] text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none flex items-center space-x-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Câu trước</span>
                </button>

                <button
                  disabled={currentQIndex === targetExam.questions.length - 1}
                  onClick={() => setCurrentQIndex(prev => prev + 1)}
                  className="px-5 py-2 rounded-xl bg-[#006BFF] text-white text-xs font-bold hover:bg-blue-600 disabled:opacity-30 disabled:pointer-events-none flex items-center space-x-1"
                >
                  <span>Câu sau</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Question Palette & Timer (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Countdown Timer Box */}
            <div className="bg-white rounded-2xl border border-[#DCE8F7] p-5 shadow-xs text-center space-y-2">
              <div className="flex items-center justify-center space-x-2 text-slate-500 text-xs font-bold uppercase">
                <Clock className="w-4 h-4 text-[#006BFF]" />
                <span>Thời gian còn lại</span>
              </div>
              <div className={`text-4xl font-bold tracking-tight font-mono ${
                secondsLeft < 300 ? 'text-red-600 animate-pulse' : 'text-[#082B52]'
              }`}>
                {timeFormatted}
              </div>
              {tabSwitches > 0 && (
                <div className="flex items-center justify-center space-x-1 text-[11px] text-amber-600">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Ghi nhận rời tab: {tabSwitches} lần</span>
                </div>
              )}
            </div>

            {/* Question Palette Grid */}
            <div className="bg-white rounded-2xl border border-[#DCE8F7] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="text-xs font-bold uppercase text-slate-500">Danh sách câu hỏi</h4>
                <span className="text-xs font-semibold text-[#006BFF]">
                  {targetExam.questions.filter(q => isQuestionAnswered(q)).length}/{targetExam.questions.length} câu đã làm
                </span>
              </div>

              {/* Status legend */}
              <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-600">
                <div className="flex items-center space-x-1">
                  <span className="w-3 h-3 rounded-full bg-[#006BFF]" />
                  <span>Đã làm</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-3 h-3 rounded-full bg-slate-200 border border-slate-300" />
                  <span>Chưa làm</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-3 h-3 rounded-full bg-amber-400" />
                  <span>Xem lại</span>
                </div>
              </div>

              {/* Numbers Grid */}
              <div className="grid grid-cols-5 gap-2 pt-2">
                {targetExam.questions.map((q, idx) => {
                  const hasAnswer = isQuestionAnswered(q);
                  const isFlag = !!flagged[q.id];
                  const isCurrent = idx === currentQIndex;

                  let bgClass = 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200';
                  if (hasAnswer) bgClass = 'bg-[#006BFF] text-white border-[#006BFF]';
                  if (isFlag) bgClass = 'bg-amber-400 text-slate-900 border-amber-500 font-bold';

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQIndex(idx)}
                      className={`h-9 rounded-lg font-bold text-xs border transition-all relative ${bgClass} ${
                        isCurrent ? 'ring-2 ring-offset-1 ring-[#082B52]' : ''
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Submit button */}
              <button
                onClick={() => setShowSubmitModal(true)}
                className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-xs hover:bg-emerald-700 transition-colors flex items-center justify-center space-x-2 mt-4"
              >
                <Send className="w-4 h-4" />
                <span>Nộp bài kiểm tra</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Submit Modal with Warning if unanswered */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center space-x-3 text-amber-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold text-[#082B52]">Xác nhận nộp bài kiểm tra?</h3>
            </div>

            {unansweredCount > 0 ? (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                Cảnh báo: Bạn vẫn còn <b>{unansweredCount}</b> câu hỏi chưa trả lời! Bạn có chắc chắn muốn nộp bài bây giờ không?
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                Bạn đã hoàn thành tất cả {targetExam.questions.length} câu hỏi. Sau khi nộp, hệ thống sẽ tự động chấm điểm và bạn không thể sửa đổi bài làm.
              </p>
            )}

            <div className="flex justify-end space-x-3 pt-3">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Kiểm tra lại
              </button>
              <button
                onClick={handleConfirmSubmit}
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700"
              >
                {isSubmitting ? 'Đang nộp bài...' : 'Nộp bài ngay'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview & Zoom Lightbox Modal */}
      {previewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="relative max-w-4xl w-full max-h-[92vh] bg-slate-900 rounded-2xl overflow-hidden flex flex-col shadow-2xl border border-slate-700">
            {/* Header */}
            <div className="flex items-center justify-between p-3.5 bg-slate-800 text-white border-b border-slate-700">
              <span className="font-bold text-sm truncate max-w-xs sm:max-w-md">{previewModal.title}</span>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewModal(prev => prev ? ({ ...prev, zoom: Math.max(0.5, Number((prev.zoom - 0.25).toFixed(2))) }) : null)}
                  className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                  title="Thu nhỏ"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono px-1 min-w-[45px] text-center">{Math.round(previewModal.zoom * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setPreviewModal(prev => prev ? ({ ...prev, zoom: Math.min(3, Number((prev.zoom + 0.25).toFixed(2))) }) : null)}
                  className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                  title="Phóng to"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewModal(prev => prev ? ({ ...prev, rotation: (prev.rotation + 90) % 360 }) : null)}
                  className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center space-x-1 text-xs transition-colors"
                  title="Xoay 90°"
                >
                  <RotateCw className="w-4 h-4" />
                  <span className="hidden sm:inline">Xoay 90°</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewModal(null)}
                  className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white ml-2 transition-colors"
                  title="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Image viewer */}
            <div className="p-4 overflow-auto flex items-center justify-center flex-1 bg-black/40 min-h-[350px]">
              <img
                src={previewModal.url}
                alt={previewModal.title}
                style={{
                  transform: `rotate(${previewModal.rotation}deg) scale(${previewModal.zoom})`,
                  transition: 'transform 0.2s ease',
                  maxWidth: '100%',
                  maxHeight: '70vh'
                }}
                className="object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
