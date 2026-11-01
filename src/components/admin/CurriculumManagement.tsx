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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#082B52] flex items-center space-x-2">
            <BookOpen className="w-6 h-6 text-emerald-600" />
            <span>Chương trình học & Danh mục Yêu cầu cần đạt (YCCĐ)</span>
          </h2>
          <p className="text-sm text-slate-500">
            Cấu trúc quản lý: Năm học → Khối → Môn → Bộ sách → Chương → Bài → Yêu cầu cần đạt GDPT 2018
          </p>
        </div>
      </div>

      {/* Grade selector */}
      <div className="flex gap-2">
        {['6', '7', '8', '9'].map(g => (
          <button
            key={g}
            onClick={() => setCurriculumGrade(g)}
            className={`px-5 py-2 rounded-xl text-sm font-bold border transition-all ${
              curriculumGrade === g
                ? 'bg-[#006BFF] text-white border-[#006BFF] shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
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
            className="bg-white rounded-2xl border border-[#DCE8F7] p-5 shadow-xs space-y-3 hover:border-[#006BFF] transition-colors"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-[#082B52]">{subj.name}</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-[#006BFF] font-semibold">
                Khối {curriculumGrade}
              </span>
            </div>

            <div className="space-y-1 text-xs text-slate-600">
              <p>Bộ sách chính: <b>{subj.textbook}</b></p>
              <p>Số chương / chủ đề: <b>{subj.chapters} chương</b></p>
              <p>Yêu cầu cần đạt chuẩn: <b>{subj.yccdCount} chuẩn</b></p>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[#006BFF]">
              <span>Xem chi tiết danh mục YCCĐ</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
