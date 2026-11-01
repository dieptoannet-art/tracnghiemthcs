import React from 'react';
import { useApp } from '../../context/AppContext';
import { FolderOpen, Download, FileText, Calendar, User } from 'lucide-react';

export const StudyMaterials: React.FC = () => {
  const { studyDocs, selectedGrade } = useApp();

  const handleDownload = (docTitle: string) => {
    // Generate a downloadable text note
    const blob = new Blob([`Tài liệu học tập THCS Tây Đô\nTiêu đề: ${docTitle}\nGiáo viên: Diệp Thanh Toàn\nTrường THCS Tây Đô - Năm học 2025-2026`], {
      type: 'text/plain;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docTitle.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#082B52]">Tài liệu học tập & Đề cương</h2>
          <p className="text-sm text-slate-500">
            Tổng hợp tài liệu ôn tập, đề mẫu và sổ tay kiến thức do tổ chuyên môn Trường THCS Tây Đô biên soạn
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {studyDocs.map(doc => (
          <div
            key={doc.id}
            className="bg-white rounded-2xl border border-[#DCE8F7] p-5 shadow-xs flex flex-col justify-between hover:border-[#006BFF] hover:shadow-md transition-all space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-[#006BFF] font-bold text-xs">
                  {doc.type === 'de_cuong' ? 'Đề cương' : doc.type === 'cong_thuc' ? 'Sổ tay' : 'Đề mẫu'}
                </span>
                <span className="text-xs text-slate-400">{doc.size}</span>
              </div>

              <h4 className="font-bold text-base text-[#082B52] leading-snug">
                {doc.title}
              </h4>

              <p className="text-xs text-slate-600 line-clamp-3">
                {doc.description}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">{doc.author}</span>
              <button
                onClick={() => handleDownload(doc.title)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#006BFF] text-white rounded-lg text-xs font-semibold hover:bg-blue-600 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải về</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
