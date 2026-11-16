import React from 'react';
import {
  Award,
  Presentation,
  Compass,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Gamepad2,
  FlaskConical,
  BookOpen,
  ClipboardCheck,
  Layers,
  Lock,
  ArrowRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import khktShowcaseHeroImg from '../../assets/images/khkt_showcase_hero_1794796357670.jpg';
import {
  KHKT_PROJECT_OVERVIEW,
  KHKT_INNOVATION_PILLARS,
  KHKT_TECH_ARCHITECTURE,
  KHKT_EVIDENCE_ITEMS
} from './khktContentData';

export const KhktShowcaseView: React.FC = () => {
  const {
    enterKhktShowcase,
    enterPublicGuest,
    enterDemoRole,
    openCoreKnowledgeLesson,
    setPreferredDemoAssignmentId,
    setCurrentView,
  } = useApp();

  const handleOpenDemoExam = () => {
    enterDemoRole('student');
    setPreferredDemoAssignmentId('demo-asg-tin6-b1');
    setCurrentView('student_assignments');
  };

  return (
    <div className="space-y-7 font-edtech pb-10">
      {/* Hero Banner */}
      <section className="bg-white rounded-3xl border border-indigo-200 shadow-[0_12px_36px_rgba(30,41,89,0.08)] overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-center">
          <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold">
              <Award className="w-4 h-4" />
              <span>HỒ SƠ TRÌNH DIỄN KHKT 2027 · TÂY ĐÔ SMART EDU</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#102C54] leading-tight">
              {KHKT_PROJECT_OVERVIEW.title}
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              <strong>Lĩnh vực:</strong> {KHKT_PROJECT_OVERVIEW.domain} ·{' '}
              <strong>Đối tượng:</strong> {KHKT_PROJECT_OVERVIEW.targetUsers}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => enterKhktShowcase(true)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold whitespace-nowrap shrink-0 shadow-sm transition-colors cursor-pointer"
              >
                <Presentation className="w-4 h-4" />
                <span>Bắt đầu Trình diễn 6 bước (Ban Giám khảo)</span>
              </button>
              <button
                type="button"
                onClick={enterPublicGuest}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-[#EAF3FF] hover:bg-[#DAE9FF] text-[#1769F4] text-sm font-bold whitespace-nowrap shrink-0 border border-[#C7DCFA] transition-colors cursor-pointer"
              >
                <Compass className="w-4 h-4" />
                <span>Tự do trải nghiệm (/explore)</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 h-full bg-indigo-50/70 p-4 sm:p-6 flex items-center justify-center">
            <div className="w-full overflow-hidden rounded-2xl border border-indigo-200 shadow-md bg-white">
              <img
                src={khktShowcaseHeroImg}
                alt="Minh họa sản phẩm KHKT 2027 Tây Đô Smart EDU"
                referrerPolicy="no-referrer"
                className="w-full h-56 sm:h-72 object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Problem & Objectives */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-2xs space-y-3">
          <h2 className="text-lg font-extrabold text-[#102C54]">
            1. Vấn đề Thực tiễn Đặt ra
          </h2>
          <ul className="space-y-2.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
            {KHKT_PROJECT_OVERVIEW.problemStatement.map((p, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center text-[11px] font-bold font-mono-num tabular-nums shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-2xs space-y-3">
          <h2 className="text-lg font-extrabold text-[#102C54]">
            2. Mục tiêu Giải pháp
          </h2>
          <ul className="space-y-2.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
            {KHKT_PROJECT_OVERVIEW.objectives.map((obj, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-1" />
                <span>{obj}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 4 Innovation Pillars */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#102C54]">
            3. Điểm mới &amp; Sáng tạo Công nghệ
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Mỗi trụ cột dưới đây đều ánh xạ trực tiếp tới module đã triển khai trong mã nguồn.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {KHKT_INNOVATION_PILLARS.map((item) => (
            <div
              key={item.code}
              className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-2xs space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono-num text-xs font-extrabold px-2.5 py-1 rounded bg-[#EAF3FF] text-[#1769F4]">
                  TRỤ CỘT {item.code}
                </span>
              </div>
              <h3 className="text-base font-extrabold text-[#102C54]">{item.title}</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{item.summary}</p>
              <div className="pt-2 border-t border-slate-100 text-[11px] font-bold text-teal-800">
                Phạm vi kiểm chứng: {item.verifiedScope}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Live Linked Product Testing Strip */}
      <section className="bg-white rounded-2xl border border-indigo-200 p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold text-[#102C54]">
              4. Kiểm chứng Trực tiếp Sản phẩm Thật ngay trong Hệ thống
            </h2>
            <p className="text-xs text-slate-500">
              Không dùng ảnh chụp minh họa — Hội đồng có thể thao tác trực tiếp ngay tại đây.
            </p>
          </div>
          <button
            type="button"
            onClick={() => enterKhktShowcase(true)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:underline cursor-pointer"
          >
            <span>Chuyển sang Hướng dẫn 6 bước</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => enterDemoRole('teacher', 'teacher_student_call')}
            className="text-left p-4 rounded-xl bg-[#F6F9FD] hover:bg-[#EAF3FF] border border-[#C7DCFA] space-y-1.5 cursor-pointer"
          >
            <Gamepad2 className="w-5 h-5 text-[#1769F4]" />
            <div className="text-sm font-bold text-[#102C54]">Game Lớp học 50 HS</div>
            <div className="text-[11px] text-slate-600">Chạy A05 Đua vịt 3D, A01 Vòng quay 3D</div>
          </button>

          <button
            type="button"
            onClick={() => setCurrentView('math_lab')}
            className="text-left p-4 rounded-xl bg-teal-50/70 hover:bg-teal-100/70 border border-teal-200 space-y-1.5 cursor-pointer"
          >
            <FlaskConical className="w-5 h-5 text-teal-700" />
            <div className="text-sm font-bold text-[#102C54]">Math Lab M01–M17</div>
            <div className="text-[11px] text-slate-600">Khám phá M15 Pythagore &amp; Hình học 3D</div>
          </button>

          <button
            type="button"
            onClick={() => openCoreKnowledgeLesson('tin_6_cd1_b1')}
            className="text-left p-4 rounded-xl bg-indigo-50/70 hover:bg-indigo-100/70 border border-indigo-200 space-y-1.5 cursor-pointer"
          >
            <BookOpen className="w-5 h-5 text-indigo-700" />
            <div className="text-sm font-bold text-[#102C54]">Tin học 6 – Bài 1</div>
            <div className="text-[11px] text-slate-600">Mở thẳng bài Thông tin &amp; Dữ liệu</div>
          </button>

          <button
            type="button"
            onClick={handleOpenDemoExam}
            className="text-left p-4 rounded-xl bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200 space-y-1.5 cursor-pointer"
          >
            <ClipboardCheck className="w-5 h-5 text-amber-700" />
            <div className="text-sm font-bold text-[#102C54]">Làm Đề Mẫu Tin 6</div>
            <div className="text-[11px] text-slate-600">Trải nghiệm thi &amp; chấm điểm tức thì</div>
          </button>
        </div>
      </section>

      {/* Architecture + Security Isolation */}
      <section className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2.5">
          <Layers className="w-5 h-5 text-[#1769F4]" />
          <h2 className="text-lg font-extrabold text-[#102C54]">
            5. Kiến trúc Kỹ thuật &amp; Tách biệt Bảo mật Production
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {KHKT_TECH_ARCHITECTURE.map((layer) => (
            <div key={layer.layer} className="p-4 rounded-xl bg-[#F6F9FD] border border-[#E2E8F0] space-y-2">
              <div className="text-xs font-extrabold text-[#1769F4] uppercase">{layer.layer}</div>
              <div className="text-xs font-mono-num font-bold text-[#102C54]">{layer.stack}</div>
              <p className="text-xs text-slate-600 leading-relaxed">{layer.role}</p>
            </div>
          ))}
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 text-xs flex items-start gap-2.5">
          <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            Nguyên tắc bảo mật đã xác minh: Route quản trị (<code>/admin*</code>) và API <code>/api/admin</code>, <code>/api/teacher</code> không mở cho khách hay vai trò Demo; khóa bí mật Supabase Service Role chỉ xử lý phía server.
          </span>
        </div>
      </section>

      {/* Honest Empirical Evidence Section */}
      <section className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-700" />
          <div>
            <h2 className="text-lg font-extrabold text-[#102C54]">
              6. Hồ sơ Minh chứng Thực nghiệm (Nguyên tắc Trung thực Khoa học)
            </h2>
            <p className="text-xs text-slate-500">
              Hệ thống không tự tạo số liệu khảo sát hoặc file minh chứng giả. Các mục chưa có file đính kèm hiển thị rõ ràng trạng thái thực tế.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {KHKT_EVIDENCE_ITEMS.map((ev) => (
            <div
              key={ev.id}
              className={`p-4 rounded-xl border space-y-1.5 ${
                ev.status === 'VERIFIED_TECH_SPEC'
                  ? 'bg-emerald-50/60 border-emerald-200'
                  : 'bg-amber-50/50 border-amber-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase">{ev.category}</span>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded ${
                    ev.status === 'VERIFIED_TECH_SPEC'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {ev.status === 'VERIFIED_TECH_SPEC' ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : (
                    <AlertCircle className="w-3 h-3" />
                  )}
                  <span>{ev.displayText}</span>
                </span>
              </div>
              <div className="text-xs sm:text-sm font-bold text-[#102C54]">{ev.title}</div>
              <p className="text-xs text-slate-600 leading-relaxed">{ev.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
