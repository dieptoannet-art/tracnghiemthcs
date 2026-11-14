import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Grade } from '../../types';
import {
  Users,
  Plus,
  Key,
  UserPlus,
  RefreshCw,
  AlertTriangle,
  Cloud,
  MonitorSmartphone,
  CheckCircle2,
  Info
} from 'lucide-react';

export const ClassManagement: React.FC = () => {
  const {
    classes,
    submissions,
    userProfile,
    currentRole,
    isUsingDemoAssignmentsData,
    assignmentDataLoading,
    assignmentDataError,
    retryLoadAssignmentData,
    createClassRoomAsync,
    enrollStudentInClassAsync,
    openAuthModal
  } = useApp();

  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '');
  const [showAddClassModal, setShowAddClassModal] = useState<boolean>(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState<boolean>(false);

  // New Class Form
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState<Grade>('8');
  const [newSchoolYear, setNewSchoolYear] = useState('2025-2026');
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [createClassError, setCreateClassError] = useState<string | null>(null);

  // Enroll Student Form
  const [studentIdentifier, setStudentIdentifier] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [studentGender, setStudentGender] = useState<'Nam' | 'Nữ'>('Nam');
  const [isEnrollingStudent, setIsEnrollingStudent] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  // Feedback Banner
  const [actionBanner, setActionBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (classes.length === 0) {
      setSelectedClassId('');
      return;
    }
    if (!classes.some(c => c.id === selectedClassId)) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  const activeClass = classes.find(c => c.id === selectedClassId) || classes[0] || null;
  const teacherDisplayName =
    userProfile?.fullName || (currentRole === 'admin' ? 'Quản trị viên' : 'GV. Diệp Thanh Toàn');

  const handleOpenAddClass = () => {
    setCreateClassError(null);
    setActionBanner(null);
    setShowAddClassModal(true);
  };

  const handleOpenAddStudent = () => {
    setEnrollError(null);
    setActionBanner(null);
    setShowAddStudentModal(true);
  };

  const handleCreateClass = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isCreatingClass || !newClassName.trim()) return;

    setCreateClassError(null);
    setIsCreatingClass(true);
    try {
      const res = await createClassRoomAsync({
        name: newClassName.trim(),
        grade: newClassGrade,
        schoolYear: newSchoolYear.trim() || '2025-2026'
      });

      if (!res.success || !res.classRoom) {
        setCreateClassError(res.error || 'Không thể tạo lớp học.');
        return;
      }

      setSelectedClassId(res.classRoom.id);
      setShowAddClassModal(false);
      setNewClassName('');
      setActionBanner({
        type: 'success',
        text: res.isDemo
          ? `Đã tạo lớp "${res.classRoom.name}" ở chế độ Demo cục bộ.`
          : `Đã tạo lớp "${res.classRoom.name}" và đồng bộ lên Supabase (Mã mời: ${res.classRoom.inviteCode}).`
      });
    } finally {
      setIsCreatingClass(false);
    }
  };

  const handleAddStudent = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isEnrollingStudent || !activeClass) return;

    setEnrollError(null);
    setIsEnrollingStudent(true);
    try {
      const res = isUsingDemoAssignmentsData
        ? await enrollStudentInClassAsync({
            classId: activeClass.id,
            identifier: studentCode.trim(),
            demoFallback: {
              code: studentCode.trim(),
              fullName: studentName.trim(),
              gender: studentGender
            }
          })
        : await enrollStudentInClassAsync({
            classId: activeClass.id,
            identifier: studentIdentifier.trim()
          });

      if (!res.success) {
        setEnrollError(res.error || 'Không thể thêm học sinh vào lớp.');
        return;
      }

      setShowAddStudentModal(false);
      setStudentIdentifier('');
      setStudentName('');
      setStudentCode('');
      setActionBanner({
        type: 'success',
        text: res.isDemo
          ? `Đã thêm học sinh vào lớp ${activeClass.name} (Chế độ Demo cục bộ).`
          : `Đã ghi nhận học sinh vào lớp ${activeClass.name} trên Supabase. Học sinh sẽ thấy bài giao khi đăng nhập.`
      });
    } finally {
      setIsEnrollingStudent(false);
    }
  };

  return (
    <div className="space-y-6 font-serif">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-[#082B52]">Quản lý Lớp học & Danh sách học sinh</h2>
          <p className="text-sm text-slate-600">
            Giáo viên phụ trách: <b>{teacherDisplayName}</b> • Trường THCS Tây Đô
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {isUsingDemoAssignmentsData ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md">
                <MonitorSmartphone className="w-3.5 h-3.5" />
                <span>Chế độ Demo cục bộ ({classes.length} lớp mẫu trên trình duyệt)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                <Cloud className="w-3.5 h-3.5" />
                <span>Đã kết nối đồng bộ Supabase ({classes.length} lớp học)</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActionBanner(null);
              retryLoadAssignmentData();
            }}
            disabled={assignmentDataLoading}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-[#F3F8FF] text-[#082B52] border border-[#DCE8F7] rounded-xl text-xs font-bold hover:bg-[#E4F0FF] disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-[#006BFF] ${assignmentDataLoading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddClass}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-[#006BFF] text-white rounded-xl text-xs font-bold hover:bg-blue-600 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo lớp mới</span>
          </button>
        </div>
      </div>

      {/* Explicit Demo Notice */}
      {isUsingDemoAssignmentsData && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Đang dùng dữ liệu mẫu (Demo cục bộ)</p>
              <p className="text-amber-800 mt-0.5">
                Lớp học và học sinh tạo ở chế độ này chỉ lưu trên trình duyệt hiện tại. Để giao bài cho học sinh đăng nhập từ thiết bị khác, hãy đăng nhập tài khoản Giáo viên Supabase.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shrink-0"
          >
            Đăng nhập Supabase
          </button>
        </div>
      )}

      {/* Action Feedback Banner */}
      {actionBanner && (
        <div
          role="status"
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm font-semibold ${
            actionBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {actionBanner.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span>{actionBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionBanner(null)}
            className="text-xs underline shrink-0"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Supabase Data Error */}
      {assignmentDataError && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-red-900">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm">
              <p className="font-bold">Không thể tải dữ liệu lớp học từ Supabase</p>
              <p className="text-red-800 mt-0.5">{assignmentDataError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => retryLoadAssignmentData()}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shrink-0"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Loading State when no classes loaded yet */}
      {assignmentDataLoading && classes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-10 text-center space-y-2 shadow-xs">
          <RefreshCw className="w-7 h-7 text-[#006BFF] animate-spin mx-auto" />
          <p className="text-sm font-bold text-[#082B52]">Đang tải danh sách lớp học...</p>
        </div>
      ) : classes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-10 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-[#F3F8FF] border border-[#DCE8F7] text-[#1769C2] flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-[#082B52]">Bạn chưa có lớp học nào</h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Hãy tạo lớp học mới để thêm học sinh và giao bài kiểm tra cho lớp của bạn.
          </p>
          <button
            type="button"
            onClick={handleOpenAddClass}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-[#006BFF] text-white rounded-xl text-xs font-bold hover:bg-blue-600"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo lớp đầu tiên</span>
          </button>
        </div>
      ) : (
        <>
          {/* Class tabs */}
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {classes.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedClassId(c.id)}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all whitespace-nowrap ${
                  activeClass?.id === c.id
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
                  <h3 className="text-xl font-bold text-[#082B52]">
                    {activeClass.name} - Khối {activeClass.grade}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Giáo viên phụ trách: {activeClass.teacherName}
                    {activeClass.schoolYear ? ` • Năm học ${activeClass.schoolYear}` : ''}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="px-3.5 py-1.5 bg-blue-50 border border-blue-200 rounded-xl text-xs font-mono text-[#006BFF] flex items-center space-x-2">
                    <Key className="w-4 h-4" />
                    <span>
                      Mã mời vào lớp: <b>{activeClass.inviteCode}</b>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenAddStudent}
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
                        <th className="py-3 px-4">Email tài khoản</th>
                        <th className="py-3 px-4 text-center">Trạng thái lớp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeClass.students.map((st, idx) => {
                        const stuSubmittedCount = submissions.filter(
                          s =>
                            s.studentId === st.id &&
                            (s.status === 'submitted' || s.status === 'graded' || Boolean(s.submittedAt))
                        ).length;

                        return (
                          <tr key={st.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 text-center text-xs text-slate-400">{idx + 1}</td>
                            <td className="py-3 px-4 font-mono font-bold text-[#006BFF] text-xs">
                              {st.code || '—'}
                            </td>
                            <td className="py-3 px-4 font-semibold text-[#082B52]">{st.fullName}</td>
                            <td className="py-3 px-4 text-xs text-slate-600">{st.gender || '—'}</td>
                            <td className="py-3 px-4 text-xs text-slate-500">{st.email || '—'}</td>
                            <td className="py-3 px-4 text-center">
                              {stuSubmittedCount > 0 ? (
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                                  Đã nộp {stuSubmittedCount} bài
                                </span>
                              ) : (
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-[#1769C2]">
                                  Thành viên lớp
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {activeClass.students.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                            Chưa có học sinh nào trong lớp. Hãy nhấp &quot;Thêm học sinh&quot; (theo Email / Mã HS) hoặc gửi mã mời <b>{activeClass.inviteCode}</b> để học sinh tự tham gia lớp.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal Add Class */}
      {showAddClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreateClass}
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4"
          >
            <h3 className="text-lg font-bold text-[#082B52]">Tạo lớp học mới</h3>

            {createClassError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-semibold">
                {createClassError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên lớp:</label>
                <input
                  type="text"
                  value={newClassName}
                  onChange={e => setNewClassName(e.target.value)}
                  placeholder="Ví dụ: Lớp 8A2"
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Khối lớp:</label>
                  <select
                    value={newClassGrade}
                    onChange={e => setNewClassGrade(e.target.value as Grade)}
                    className="w-full px-3 py-2 text-sm border rounded-lg"
                  >
                    <option value="6">Khối 6</option>
                    <option value="7">Khối 7</option>
                    <option value="8">Khối 8</option>
                    <option value="9">Khối 9</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Năm học:</label>
                  <input
                    type="text"
                    value={newSchoolYear}
                    onChange={e => setNewSchoolYear(e.target.value)}
                    placeholder="2025-2026"
                    className="w-full px-3 py-2 text-sm border rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3">
              <button
                type="button"
                disabled={isCreatingClass}
                onClick={() => setShowAddClassModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 border rounded-lg hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isCreatingClass || !newClassName.trim()}
                className="px-4 py-1.5 text-xs bg-[#006BFF] text-white font-bold rounded-lg disabled:opacity-40 inline-flex items-center gap-1.5"
              >
                {isCreatingClass && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isCreatingClass ? 'Đang tạo lớp...' : 'Tạo lớp'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Add Student */}
      {showAddStudentModal && activeClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <form
            onSubmit={handleAddStudent}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4"
          >
            <h3 className="text-lg font-bold text-[#082B52]">
              Thêm học sinh vào {activeClass.name}
            </h3>

            {enrollError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-semibold">
                {enrollError}
              </div>
            )}

            {!isUsingDemoAssignmentsData ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-[#F3F8FF] border border-[#DCE8F7] text-xs text-[#12345B] leading-relaxed">
                  Hệ thống liên kết học sinh bằng khóa định danh ổn định (<b>Email tài khoản</b> hoặc <b>Mã học sinh</b> đã đăng ký trong <code>profiles</code>), không ghép theo họ tên để tránh nhầm lớp.
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email hoặc Mã định danh học sinh (student_code):
                  </label>
                  <input
                    type="text"
                    value={studentIdentifier}
                    onChange={e => setStudentIdentifier(e.target.value)}
                    placeholder="Ví dụ: hs8a1@taydo.edu.vn hoặc HS80101"
                    className="w-full px-3 py-2 text-sm border rounded-lg"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Mẹo: Học sinh cũng có thể tự vào lớp sau khi đăng nhập bằng cách nhập mã mời{' '}
                  <b className="text-[#006BFF] font-mono">{activeClass.inviteCode}</b> tại mục <b>Bài được giao</b>.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Họ và tên học sinh:</label>
                  <input
                    type="text"
                    value={studentName}
                    onChange={e => setStudentName(e.target.value)}
                    placeholder="Ví dụ: Nguyễn Văn Hưng"
                    className="w-full px-3 py-2 text-sm border rounded-lg"
                    required
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
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Giới tính:</label>
                  <select
                    value={studentGender}
                    onChange={e => setStudentGender(e.target.value as 'Nam' | 'Nữ')}
                    className="w-full px-3 py-2 text-sm border rounded-lg"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-3">
              <button
                type="button"
                disabled={isEnrollingStudent}
                onClick={() => setShowAddStudentModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 border rounded-lg hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={
                  isEnrollingStudent ||
                  (!isUsingDemoAssignmentsData
                    ? !studentIdentifier.trim()
                    : !studentName.trim() || !studentCode.trim())
                }
                className="px-4 py-1.5 text-xs bg-emerald-600 text-white font-bold rounded-lg disabled:opacity-40 inline-flex items-center gap-1.5"
              >
                {isEnrollingStudent && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isEnrollingStudent ? 'Đang thêm...' : 'Thêm học sinh'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

