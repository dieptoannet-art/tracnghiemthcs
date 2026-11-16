import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BookOpen, Plus, CheckCircle2, ChevronRight } from 'lucide-react';

export const CurriculumManagement: React.FC = () => {
  const { selectedGrade } = useApp();
  const [curriculumGrade, setCurriculumGrade] = useState('8');

  const subjectsStructure = [
    { name: 'Toán học', textbook: 'Kết nối tri thức', chapters: 5, yccdCount: 24 },
    { name: 'Tin học', textbook: 'Cánh Diều', chapters: 6, yccdCount: 18 },
    { name: 'Khoa học tự nhiên', textbook: 'Kết nối tri thức', chapters: 8, yccdCount: 32 },
    { name: 'Ngữ văn', textbook: 'Kết nối tri thức', chapters: 5, yccdCount: 20 },
    { name: 'Tiếng Anh', textbook: 'Global Success', chapters: 6, yccdCount: 22 },
    { name: 'Lịch sử & Địa lí', textbook: 'Chân trời sáng tạo', chapters: 4, yccdCount: 16 }
  ];

  return (
    <div className="space-y-6 font-edtech">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#102C54] flex items-center space-x-2">
            <BookOpen className="w-6 h-6 text-[#12A879] shrink-0" />
            <span>Chương trình học &amp; Danh mục Yêu cầu cần đạt (YCCĐ)</span>
          </h2>
          <p className="text-sm text-slate-500">
            Cấu trúc quản lý: Năm học → Khối → Môn → Bộ sách → Chương → Bài → Yêu cầu cần đạt GDPT 2018
          </p>
        </div>
      </div>

      {/* Grade selector */}
      <div className="flex flex-wrap gap-2">
        {['6', '7', '8', '9'].map(g => (
          <button
            key={g}
            type="button"
            onClick={() => setCurriculumGrade(g)}
            className={`px-5 py-2 rounded-xl text-sm font-bold border transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              curriculumGrade === g
                ? 'bg-[#1769F4] text-white border-[#1769F4] shadow-xs'
                : 'bg-white text-[#102C54] border-[#E2E8F0] hover:bg-[#F6F9FD]'
            }`}
          >
            Khối {g}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subjectsStructure.map((subj, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-xs space-y-3 hover:border-[#1769F4] transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-base text-[#102C54]">{subj.name}</h3>
              <span className="text-xs px-2.5 py-0.5 rounded-md bg-[#EAF3FF] text-[#1769F4] border border-[#C7DCFA] font-bold whitespace-nowrap shrink-0 tabular-nums">
                Khối {curriculumGrade}
              </span>
            </div>

            <div className="space-y-1 text-xs text-slate-600 tabular-nums">
              <p>Bộ sách chính: <b className="text-[#102C54]">{subj.textbook}</b></p>
              <p>Số chương / chủ đề: <b className="text-[#102C54]">{subj.chapters} chương</b></p>
              <p>Yêu cầu cần đạt chuẩn: <b className="text-[#102C54]">{subj.yccdCount} chuẩn</b></p>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[#1769F4]">
              <span>Xem chi tiết danh mục YCCĐ</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
