import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ClassRoom } from '../../types';
import { Users, Plus, Key, Mail, UserPlus, Check, Sparkles } from 'lucide-react';

export const ClassManagement: React.FC = () => {
  const { classes, addClassRoom, addStudentToClass } = useApp();
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '');
  const [showAddClassModal, setShowAddClassModal] = useState<boolean>(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState<boolean>(false);

  // New Class Form
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState<'6' | '7' | '8' | '9'>('8');

  // New Student Form
  const [studentName, setStudentName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [studentGender, setStudentGender] = useState<'Nam' | 'Nữ'>('Nam');

  const activeClass = classes.find(c => c.id === selectedClassId) || classes[0];

  const handleCreateClass = () => {
    if (!newClassName.trim()) return;
    const newCls: ClassRoom = {
      id: `cls-${Date.now()}`,
      name: newClassName.trim(),
      grade: newClassGrade,
      teacherName: 'Diệp Thanh Toàn',
      studentCount: 0,
      inviteCode: `TAYDO-${newClassName.toUpperCase().replace(/\s+/g, '')}-2026`,
      students: []
    };
    addClassRoom(newCls);
    setSelectedClassId(newCls.id);
    setShowAddClassModal(false);
    setNewClassName('');
  };

  const handleAddStudent = () => {
    if (!studentName.trim() || !studentCode.trim() || !activeClass) return;
    addStudentToClass(activeClass.id, {
      id: `stu-${Date.now()}`,
      code: studentCode.trim().toUpperCase(),
      fullName: studentName.trim(),
      email: `${studentCode.toLowerCase()}@taydo.edu.vn`,
      gender: studentGender
    });
    setShowAddStudentModal(false);
    setStudentName('');
    setStudentCode('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#082B52]">Quản lý Lớp học & Danh sách học sinh</h2>
          <p className="text-sm text-slate-500">
            Giáo viên phụ trách: <b>Thầy Diệp Thanh Toàn</b> • Trường THCS Tây Đô
          </p>
          <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-md inline-block mt-1">
            Dữ liệu trên trình duyệt ({classes.length} lớp học)
          </span>
        </div>

        <button
          onClick={() => setShowAddClassModal(true)}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-[#006BFF] text-white rounded-xl text-xs font-bold hover:bg-blue-600 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo lớp mới</span>
        </button>
      </div>

      {/* Class tabs */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        {classes.map(c => (
          <button
            key={c.id}
            onClick={() => setSelectedClassId(c.id)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all whitespace-nowrap ${
              activeClass.id === c.id
                ? 'bg-[#006BFF] text-white border-[#006BFF] shadow-xs'
                : 'bg-white text-slate-700 border-[#DCE8F7] hover:bg-slate-50'
            }`}
          >
            {c.name} ({c.studentCount} HS)
          </button>
        ))}
      </div>

      {/* Active Class Info & Roster */}
      {activeClass && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#DCE8F7] p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-[#082B52]">{activeClass.name} - Khối {activeClass.grade}</h3>
              <p className="text-xs text-slate-500">Giáo viên chủ nhiệm / Bộ môn: {activeClass.teacherName}</p>
            </div>

            <div className="flex items-center space-x-3">
              <div className="px-3.5 py-1.5 bg-blue-50 border border-blue-200 rounded-xl text-xs font-mono text-[#006BFF] flex items-center space-x-2">
                <Key className="w-4 h-4" />
                <span>Mã tham gia: <b>{activeClass.inviteCode}</b></span>
              </div>

              <button
                onClick={() => setShowAddStudentModal(true)}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700"
              >
                <UserPlus className="w-4 h-4" />
                <span>Thêm học sinh</span>
              </button>
            </div>
          </div>

          {/* Student Roster Table */}
          <div className="bg-white rounded-2xl border border-[#DCE8F7] overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-xs font-bold text-[#082B52] uppercase">
                Danh sách học sinh ({activeClass.students.length} học sinh)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#F3F8FF] text-[#12345B] text-xs uppercase font-bold border-b border-[#DCE8F7]">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">STT</th>
                    <th className="py-3 px-4">Mã học sinh</th>
                    <th className="py-3 px-4">Họ và tên</th>
                    <th className="py-3 px-4">Giới tính</th>
                    <th className="py-3 px-4">Email học đường</th>
                    <th className="py-3 px-4 text-center">Tình trạng kiểm tra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeClass.students.map((st, idx) => (
                    <tr key={st.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 text-center text-xs text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-mono font-bold text-[#006BFF] text-xs">{st.code}</td>
                      <td className="py-3 px-4 font-semibold text-[#082B52]">{st.fullName}</td>
                      <td className="py-3 px-4 text-xs text-slate-600">{st.gender}</td>
                      <td className="py-3 px-4 text-xs text-slate-500">{st.email}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          Đã nộp bài
                        </span>
                      </td>
                    </tr>
                  ))}
                  {activeClass.students.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                        Chưa có học sinh nào trong lớp. Hãy nhấp "Thêm học sinh" hoặc cấp mã tham gia cho học sinh.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add Class */}
      {showAddClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-[#082B52]">Tạo lớp học mới</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên lớp:</label>
                <input
                  type="text"
                  value={newClassName}
                  onChange={e => setNewClassName(e.target.value)}
                  placeholder="Ví dụ: Lớp 8A2"
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Khối lớp:</label>
                <select
                  value={newClassGrade}
                  onChange={e => setNewClassGrade(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                >
                  <option value="6">Khối 6</option>
                  <option value="7">Khối 7</option>
                  <option value="8">Khối 8</option>
                  <option value="9">Khối 9</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3">
              <button
                onClick={() => setShowAddClassModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 border rounded-lg hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={handleCreateClass}
                disabled={!newClassName.trim()}
                className="px-4 py-1.5 text-xs bg-[#006BFF] text-white font-bold rounded-lg disabled:opacity-40"
              >
                Tạo lớp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add Student */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-[#082B52]">Thêm học sinh vào {activeClass?.name}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Họ và tên học sinh:</label>
                <input
                  type="text"
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn Hưng"
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mã định danh học sinh:</label>
                <input
                  type="text"
                  value={studentCode}
                  onChange={e => setStudentCode(e.target.value)}
                  placeholder="Ví dụ: HS80106"
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Giới tính:</label>
                <select
                  value={studentGender}
                  onChange={e => setStudentGender(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                >
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3">
              <button
                onClick={() => setShowAddStudentModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 border rounded-lg hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={handleAddStudent}
                disabled={!studentName.trim() || !studentCode.trim()}
                className="px-4 py-1.5 text-xs bg-emerald-600 text-white font-bold rounded-lg disabled:opacity-40"
              >
                Thêm học sinh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
