import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Grade } from '../../types';
import { getSubjectDisplayName } from '../../utils/subjectCatalog';
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
  Info,
  Layers,
  ArrowRight
} from 'lucide-react';

export const ClassManagement: React.FC = () => {
  const {
    classes,
    submissions,
    teachingAssignments,
    classRoles,
    teachingSchemaWarning,
    user,
    userProfile,
    currentRole,
    setCurrentView,
    isUsingDemoAssignmentsData,
    assignmentDataLoading,
    assignmentDataError,
    retryLoadAssignmentData,
    createClassRoomAsync,
    enrollStudentInClassAsync,
    openAuthModal
  } = useApp();

  // Scope classes to teacher's active complete teaching assignments OR explicit classRoles when on Supabase
  const scopedClasses = useMemo(() => {
    if (isUsingDemoAssignmentsData || currentRole === 'admin') {
      return classes;
    }
    if (!user?.id) return [];

    // Allow legacy classes.teacher_id ONLY when Step 04 schema tables are absent
    if (teachingSchemaWarning && teachingAssignments.length === 0 && classRoles.length === 0) {
      return classes.filter(c => !c.teacherId || c.teacherId === user.id);
    }

    const activeClassIds = new Set<string>();
    for (const ta of teachingAssignments) {
      if (
        ta.teacherId === user.id &&
        ta.status === 'active' &&
        !ta.needsSubjectCompletion &&
        Boolean(ta.subject)
      ) {
        const cls = classes.find(c => c.id === ta.classId);
        if (!cls?.schoolYear || ta.schoolYear === cls.schoolYear) {
          activeClassIds.add(ta.classId);
        }
      }
    }
    for (const cr of classRoles) {
      if (cr.teacherId === user.id && cr.status === 'active') {
        const cls = classes.find(c => c.id === cr.classId);
        if (!cls?.schoolYear || cr.schoolYear === cls.schoolYear) {
          activeClassIds.add(cr.classId);
        }
      }
    }
    return classes.filter(c => activeClassIds.has(c.id));
  }, [classes, teachingAssignments, classRoles, teachingSchemaWarning, isUsingDemoAssignmentsData, currentRole, user?.id]);

  const [selectedClassId, setSelectedClassId] = useState<string>(scopedClasses[0]?.id || '');
  const [showAddClassModal, setShowAddClassModal] = useState<boolean>(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState<boolean>(false);

  // New Class Form (Admin or Demo mode)
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState<Grade>('8');
  const [newSchoolYear, setNewSchoolYear] = useState('2025-2026');
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [createClassError, setCreateClassError] = useState<string | null>(null);

  // Enroll Student Form (Admin or Demo mode)
  const [studentIdentifier, setStudentIdentifier] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [studentGender, setStudentGender] = useState<'Nam' | 'Nữ'>('Nam');
  const [isEnrollingStudent, setIsEnrollingStudent] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  // Feedback Banner
  const [actionBanner, setActionBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (scopedClasses.length === 0) {
      setSelectedClassId('');
      return;
    }
    if (!scopedClasses.some(c => c.id === selectedClassId)) {
      setSelectedClassId(scopedClasses[0].id);
    }
  }, [scopedClasses, selectedClassId]);

  const activeClass = scopedClasses.find(c => c.id === selectedClassId) || scopedClasses[0] || null;
  const teacherDisplayName =
    userProfile?.fullName || (currentRole === 'admin' ? 'Quản trị viên' : 'Giáo viên');

  const activeClassTeacherSubjects = useMemo(() => {
    if (!activeClass || !user?.id) return [];
    return teachingAssignments.filter(
      ta =>
        ta.classId === activeClass.id &&
        ta.status === 'active' &&
        (currentRole === 'admin' || ta.teacherId === user.id)
    );
  }, [activeClass, teachingAssignments, user?.id, currentRole]);

  const activeClassExplicitRoles = useMemo(() => {
    if (!activeClass || !user?.id) return [];
    return classRoles.filter(
      cr =>
        cr.classId === activeClass.id &&
        cr.status === 'active' &&
        (currentRole === 'admin' || cr.teacherId === user.id)
    );
  }, [activeClass, classRoles, user?.id, currentRole]);

  const canManageStructure = isUsingDemoAssignmentsData || currentRole === 'admin';
  const canEnrollStudentInActiveClass =
    canManageStructure ||
    (!isUsingDemoAssignmentsData && activeClassExplicitRoles.some(cr => cr.teacherId === user?.id));

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
          : `Đã ghi nhận học sinh vào lớp ${activeClass.name} trên Supabase.`
      });
    } finally {
      setIsEnrollingStudent(false);
    }
  };

  return (
    <div className="space-y-6 font-edtech">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-[#102C54]">Lớp &amp; phân công giảng dạy của tôi</h2>
          <p className="text-sm text-slate-600">
            Tài khoản: <b>{teacherDisplayName}</b> · Trường THCS Tây Đô
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
            {isUsingDemoAssignmentsData ? (
              <span className="inline-flex items-center gap-1.5 font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md">
                <MonitorSmartphone className="w-3.5 h-3.5" />
                <span className="tabular-nums">Chế độ Demo cục bộ ({scopedClasses.length} lớp mẫu)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-bold text-[#0B6E4F] bg-[#ECFDF7] border border-[#12A879]/25 px-2.5 py-0.5 rounded-md">
                <Cloud className="w-3.5 h-3.5 text-[#12A879]" />
                <span className="tabular-nums">
                  Đồng bộ Supabase ({scopedClasses.length} lớp được phân công)
                </span>
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
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-[#F6F9FD] text-[#102C54] border border-[#E2E8F0] rounded-xl text-xs font-bold hover:bg-[#EAF3FF] whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-[#1769F4] ${assignmentDataLoading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>

          {currentRole === 'admin' && !isUsingDemoAssignmentsData && (
            <button
              type="button"
              onClick={() => setCurrentView('admin_accounts')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#102C54] text-white rounded-xl text-xs font-bold hover:bg-[#102C54]/90 whitespace-nowrap shrink-0"
            >
              <Layers className="w-4 h-4" />
              <span>Mở Quản lý lớp &amp; tài khoản</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {canManageStructure && (
            <button
              type="button"
              onClick={handleOpenAddClass}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-[#1769F4] text-white rounded-xl text-xs font-bold hover:bg-[#1255CC] shadow-xs whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo lớp mới</span>
            </button>
          )}
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
                Lớp học và học sinh tạo ở chế độ này chỉ lưu trên trình duyệt hiện tại. Hãy đăng nhập tài khoản Supabase để làm việc với lớp và phân công thật.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl whitespace-nowrap shrink-0"
          >
            Đăng nhập Supabase
          </button>
        </div>
      )}

      {/* Teacher Scoped Notice */}
      {!isUsingDemoAssignmentsData && currentRole === 'teacher' && (
        <div className="bg-[#EAF3FF] border border-[#C7DCFA] rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-[#102C54]">
          <Info className="w-4 h-4 text-[#1769F4] shrink-0 mt-0.5" />
          <span>
            Bạn nhìn thấy các lớp theo <strong>phân công dạy môn đang hoạt động</strong> hoặc <strong>vai trò phụ trách / chủ nhiệm lớp (class_roles)</strong>. Quyền dạy môn chỉ dùng để giao bài và chấm điểm môn đó; chỉ Quản trị viên hoặc giáo viên có vai trò <code>class_roles</code> mới được cập nhật danh sách học sinh.
          </span>
        </div>
      )}

      {/* Action Feedback Banner */}
      {actionBanner && (
        <div
          role="status"
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm font-semibold ${
            actionBanner.type === 'success'
              ? 'bg-[#ECFDF7] border-[#12A879]/25 text-[#0B6E4F]'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {actionBanner.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-[#12A879] shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span>{actionBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionBanner(null)}
            className="text-xs underline whitespace-nowrap shrink-0"
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
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold whitespace-nowrap shrink-0"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Loading / Empty / Scoped Classes */}
      {assignmentDataLoading && scopedClasses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-10 text-center space-y-2 shadow-xs">
          <RefreshCw className="w-7 h-7 text-[#1769F4] animate-spin mx-auto" />
          <p className="text-sm font-bold text-[#102C54]">Đang tải danh sách lớp và phân công...</p>
        </div>
      ) : scopedClasses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-10 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-[#EAF3FF] border border-[#C7DCFA] text-[#1769F4] flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-[#102C54]">
            {currentRole === 'teacher' && !isUsingDemoAssignmentsData
              ? 'Bạn chưa được phân công giảng dạy lớp nào'
              : 'Chưa có lớp học nào'}
          </h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            {currentRole === 'teacher' && !isUsingDemoAssignmentsData
              ? 'Hãy liên hệ Quản trị viên để được phân công lớp – môn giảng dạy trong mục Quản lý lớp & tài khoản.'
              : 'Hãy tạo lớp học mới để thêm học sinh và giao bài kiểm tra.'}
          </p>
          {canManageStructure && (
            <button
              type="button"
              onClick={handleOpenAddClass}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-[#1769F4] text-white rounded-xl text-xs font-bold hover:bg-[#1255CC] whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo lớp đầu tiên</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Class tabs */}
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {scopedClasses.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedClassId(c.id)}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all whitespace-nowrap shrink-0 tabular-nums ${
                  activeClass?.id === c.id
                    ? 'bg-[#1769F4] text-white border-[#1769F4] shadow-xs'
                    : 'bg-white text-slate-700 border-[#E2E8F0] hover:bg-[#F6F9FD]'
                }`}
              >
                {c.name} ({c.studentCount} HS)
              </button>
            ))}
          </div>

          {/* Active Class Info & Roster */}
          {activeClass && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-[#102C54]">
                      {activeClass.name} · Khối {activeClass.grade}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                      Năm học: <b>{activeClass.schoolYear || '2025-2026'}</b>
                      {activeClass.classCode ? ` · Mã lớp: ${activeClass.classCode}` : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="px-3.5 py-1.5 bg-[#EAF3FF] border border-[#C7DCFA] rounded-xl text-xs font-mono text-[#1769F4] flex items-center space-x-2 whitespace-nowrap shrink-0">
                      <Key className="w-4 h-4" />
                      <span>
                        Mã mời: <b>{activeClass.inviteCode}</b>
                      </span>
                    </div>

                    {canEnrollStudentInActiveClass && (
                      <button
                        type="button"
                        onClick={handleOpenAddStudent}
                        className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#12A879] text-white rounded-xl text-xs font-bold hover:bg-[#0F8F67] whitespace-nowrap shrink-0"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>Thêm học sinh</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Assigned subjects for this class */}
                {activeClassTeacherSubjects.length > 0 && (
                  <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-[#102C54]">
                      {currentRole === 'admin' ? 'Phân công môn tại lớp:' : 'Môn bạn phụ trách:'}
                    </span>
                    {activeClassTeacherSubjects.map(ta => (
                      <span
                        key={ta.id}
                        className={`px-2.5 py-0.5 rounded-md border font-semibold ${
                          ta.needsSubjectCompletion || !ta.subject
                            ? 'bg-amber-50 border-amber-300 text-amber-900'
                            : 'bg-[#F6F9FD] border-[#C7DCFA] text-[#102C54]'
                        }`}
                      >
                        {ta.subject
                          ? getSubjectDisplayName(ta.subject)
                          : 'Chờ Quản trị viên bổ sung môn'}
                        {currentRole === 'admin' && ta.teacherName ? ` (${ta.teacherName})` : ''}
                      </span>
                    ))}
                  </div>
                )}

                {/* Explicit class management / homeroom roles */}
                {activeClassExplicitRoles.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-[#0B6E4F]">
                      Vai trò phụ trách lớp (class_roles):
                    </span>
                    {activeClassExplicitRoles.map(cr => (
                      <span
                        key={cr.id}
                        className="px-2.5 py-0.5 rounded-md border bg-[#ECFDF7] border-[#12A879]/25 text-[#0B6E4F] font-semibold"
                      >
                        {cr.roleLabel}
                        {currentRole === 'admin' && cr.teacherName ? ` (${cr.teacherName})` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Student Roster Table */}
              <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-xs">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-[#F6F9FD]">
                  <span className="text-xs font-bold text-[#102C54] uppercase tabular-nums">
                    Danh sách học sinh ({activeClass.students.length} học sinh)
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[#F6F9FD] text-[#102C54] text-xs uppercase font-bold border-b border-[#E2E8F0]">
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
                          <tr key={st.id} className="hover:bg-[#F6F9FD]">
                            <td className="py-3 px-4 text-center text-xs text-slate-400 tabular-nums">{idx + 1}</td>
                            <td className="py-3 px-4 font-mono font-bold text-[#1769F4] text-xs">
                              {st.code || '—'}
                            </td>
                            <td className="py-3 px-4 font-semibold text-[#102C54]">{st.fullName}</td>
                            <td className="py-3 px-4 text-xs text-slate-600">{st.gender || '—'}</td>
                            <td className="py-3 px-4 text-xs text-slate-500">{st.email || '—'}</td>
                            <td className="py-3 px-4 text-center">
                              {stuSubmittedCount > 0 ? (
                                <span className="text-xs font-semibold text-[#0B6E4F] tabular-nums">
                                  Đã nộp {stuSubmittedCount} bài
                                </span>
                              ) : (
                                <span className="text-xs font-semibold text-[#1769F4]">
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
                            Chưa có học sinh nào trong lớp.
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

      {/* Modal Add Class (Admin / Demo) */}
      {showAddClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreateClass}
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4 border border-[#E2E8F0]"
          >
            <h3 className="text-lg font-bold text-[#102C54]">Tạo lớp học mới</h3>

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
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#1769F4]"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Khối lớp:</label>
                  <select
                    value={newClassGrade}
                    onChange={e => setNewClassGrade(e.target.value as Grade)}
                    className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#1769F4]"
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
                    className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#1769F4]"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3">
              <button
                type="button"
                disabled={isCreatingClass}
                onClick={() => setShowAddClassModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 border border-[#E2E8F0] rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isCreatingClass || !newClassName.trim()}
                className="px-4 py-1.5 text-xs bg-[#1769F4] hover:bg-[#1255CC] text-white font-bold rounded-lg disabled:opacity-40 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                {isCreatingClass && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isCreatingClass ? 'Đang tạo lớp...' : 'Tạo lớp'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Add Student (Admin / Demo) */}
      {showAddStudentModal && activeClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <form
            onSubmit={handleAddStudent}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-[#E2E8F0]"
          >
            <h3 className="text-lg font-bold text-[#102C54]">
              Thêm học sinh vào {activeClass.name}
            </h3>

            {enrollError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-semibold">
                {enrollError}
              </div>
            )}

            {!isUsingDemoAssignmentsData ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-[#EAF3FF] border border-[#C7DCFA] text-xs text-[#102C54] leading-relaxed">
                  Hệ thống liên kết học sinh bằng khóa định danh ổn định (<b>Email tài khoản</b> hoặc <b>Mã học sinh</b> đã đăng ký trong <code>profiles</code>).
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
                    className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#1769F4]"
                    required
                  />
                </div>
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
                    className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#1769F4]"
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
                    className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#1769F4]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Giới tính:</label>
                  <select
                    value={studentGender}
                    onChange={e => setStudentGender(e.target.value as 'Nam' | 'Nữ')}
                    className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#1769F4]"
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
                className="px-3 py-1.5 text-xs text-slate-600 border border-[#E2E8F0] rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
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
                className="px-4 py-1.5 text-xs bg-[#12A879] hover:bg-[#0F8F67] text-white font-bold rounded-lg disabled:opacity-40 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
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
