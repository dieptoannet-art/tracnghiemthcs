import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Edit3,
  Shuffle,
  Users,
} from 'lucide-react';
import {
  GroupConfigState,
  GroupSplitMode,
  ToolStudentItem,
  divideStudentsIntoGroups,
  moveStudentBetweenGroups,
  renameStudentGroup,
} from './teachingToolsEngine';

interface GroupDividerToolProps {
  presentStudents: ToolStudentItem[];
  groupsState: GroupConfigState;
  onChangeGroupsState: (next: GroupConfigState) => void;
  onSendToActivity: () => void;
  onSendToScoreboard: () => void;
}

export const GroupDividerTool: React.FC<GroupDividerToolProps> = ({
  presentStudents,
  groupsState,
  onChangeGroupsState,
  onSendToActivity,
  onSendToScoreboard,
}) => {
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');

  const studentById = useMemo(() => {
    const map = new Map<string, ToolStudentItem>();
    for (const s of presentStudents) map.set(s.id, s);
    return map;
  }, [presentStudents]);

  const duplicateNamesSet = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of presentStudents) {
      counts.set(s.fullName, (counts.get(s.fullName) || 0) + 1);
    }
    const dupes = new Set<string>();
    for (const [name, cnt] of counts.entries()) {
      if (cnt > 1) dupes.add(name);
    }
    return dupes;
  }, [presentStudents]);

  const handleDivide = () => {
    const nextGroups = divideStudentsIntoGroups({
      presentStudents,
      splitMode: groupsState.splitMode,
      groupCount: groupsState.groupCount,
      maxPerGroup: groupsState.maxPerGroup,
      existingNames: groupsState.groups.map((g) => g.name),
    });
    onChangeGroupsState({
      ...groupsState,
      groups: nextGroups,
    });
    if (nextGroups.length === 0) {
      setFeedback('Lớp chưa có học sinh có mặt để chia nhóm.');
    } else {
      const sizes = nextGroups.map((g) => g.studentIds.length).join(' – ');
      setFeedback(
        `Đã chia ${presentStudents.length} học sinh có mặt thành ${nextGroups.length} nhóm (${sizes}).`
      );
    }
  };

  const handleCommitRename = (groupId: string) => {
    if (draftName.trim()) {
      onChangeGroupsState({
        ...groupsState,
        groups: renameStudentGroup(groupsState.groups, groupId, draftName),
      });
    }
    setEditingGroupId(null);
  };

  const handleMoveStudent = (studentId: string, targetGroupId: string) => {
    onChangeGroupsState({
      ...groupsState,
      groups: moveStudentBetweenGroups(groupsState.groups, studentId, targetGroupId),
    });
  };

  const sizeSummary = groupsState.groups
    .map((g) => g.studentIds.length)
    .join(' – ');

  return (
    <div className="space-y-5 font-edtech">
      {/* Control Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[#0F2D52]">
              Chia nhóm học sinh theo danh sách có mặt
            </h3>
            <p className="text-sm text-slate-600">
              {presentStudents.length} học sinh có mặt
              {groupsState.groups.length > 0 && ` · ${groupsState.groups.length} nhóm (${sizeSummary})`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDivide}
              disabled={presentStudents.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1769F4] hover:bg-[#0F56D3] disabled:opacity-50 text-white text-sm font-bold cursor-pointer disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
            >
              <Shuffle className="w-4 h-4" />
              <span>Chia nhóm ngẫu nhiên</span>
            </button>
          </div>
        </div>

        {/* Mode & Parameters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-600">
              Cách chia
            </label>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'by_group_count', label: 'Theo số nhóm' },
                  { id: 'by_max_size', label: 'Tối đa HS/nhóm' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    onChangeGroupsState({
                      ...groupsState,
                      splitMode: opt.id as GroupSplitMode,
                    })
                  }
                  className={`px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                    groupsState.splitMode === opt.id
                      ? 'bg-white text-[#0F2D52] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {groupsState.splitMode === 'by_group_count' ? (
            <div className="space-y-1.5">
              <label
                htmlFor="c00-group-count"
                className="block text-xs font-semibold text-slate-600"
              >
                Số nhóm muốn chia (1–12)
              </label>
              <input
                id="c00-group-count"
                type="number"
                min={1}
                max={12}
                value={groupsState.groupCount}
                onChange={(e) =>
                  onChangeGroupsState({
                    ...groupsState,
                    groupCount: Math.max(1, Math.min(12, Number(e.target.value) || 1)),
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-900 tabular-nums focus:border-[#1769F4] focus:outline-none"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <label
                htmlFor="c00-max-per-group"
                className="block text-xs font-semibold text-slate-600"
              >
                Số học sinh tối đa mỗi nhóm
              </label>
              <input
                id="c00-max-per-group"
                type="number"
                min={1}
                max={30}
                value={groupsState.maxPerGroup}
                onChange={(e) =>
                  onChangeGroupsState({
                    ...groupsState,
                    maxPerGroup: Math.max(1, Math.min(30, Number(e.target.value) || 1)),
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-900 tabular-nums focus:border-[#1769F4] focus:outline-none"
              />
            </div>
          )}

          {/* Cross-tool handoff actions */}
          <div className="flex flex-col justify-end gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={groupsState.groups.length === 0}
                onClick={onSendToActivity}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-45 text-white text-xs font-semibold cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
              >
                <span>Dùng cho Hoạt động nhóm</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={groupsState.groups.length === 0}
                onClick={onSendToScoreboard}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 text-white text-xs font-semibold cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
              >
                <span>Dùng cho Bảng điểm đội</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {feedback && (
          <p className="text-xs font-medium text-[#0F56D3] bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            {feedback}
          </p>
        )}
      </div>

      {/* Groups Grid */}
      {presentStudents.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-2">
          <Users className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-base font-bold text-slate-800">
            Lớp hiện chưa có học sinh có mặt
          </p>
          <p className="text-sm text-slate-600">
            Hãy chọn lớp có sĩ số hoặc bỏ đánh dấu vắng ở thanh chọn lớp phía trên.
          </p>
        </div>
      ) : groupsState.groups.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3">
          <p className="text-base font-bold text-slate-800">
            Nhấn &ldquo;Chia nhóm ngẫu nhiên&rdquo; để xếp {presentStudents.length} học sinh
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groupsState.groups.map((grp) => (
            <div
              key={grp.id}
              className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className="w-3 h-3 rounded-sm shrink-0"
                    style={{ backgroundColor: grp.color }}
                  />
                  {editingGroupId === grp.id ? (
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="text"
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCommitRename(grp.id);
                          if (e.key === 'Escape') setEditingGroupId(null);
                        }}
                        autoFocus
                        className="w-full px-2 py-1 rounded border border-[#1769F4] text-sm font-bold text-slate-900 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleCommitRename(grp.id)}
                        className="p-1.5 rounded bg-emerald-600 text-white cursor-pointer"
                        aria-label="Lưu tên nhóm"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h4 className="text-base font-bold text-[#0F2D52] truncate">
                        {grp.name}
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingGroupId(grp.id);
                          setDraftName(grp.name);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                        aria-label={`Đổi tên ${grp.name}`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
                <span className="text-xs font-mono font-bold text-slate-600 tabular-nums shrink-0">
                  {grp.studentIds.length} HS
                </span>
              </div>

              <ul className="space-y-1.5 flex-1">
                {grp.studentIds.length === 0 ? (
                  <li className="text-xs text-slate-400 italic py-2">
                    Nhóm chưa có thành viên
                  </li>
                ) : (
                  grp.studentIds.map((stId, idx) => {
                    const st = studentById.get(stId);
                    if (!st) return null;
                    const showCodeDisambiguator = duplicateNamesSet.has(st.fullName);
                    return (
                      <li
                        key={st.id}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-mono text-slate-400 mr-1.5 tabular-nums">
                            {idx + 1}.
                          </span>
                          <span className="font-medium text-slate-800">
                            {st.fullName}
                          </span>
                          {showCodeDisambiguator && (
                            <span className="ml-1.5 text-[11px] font-mono text-slate-500">
                              ({st.code || st.id})
                            </span>
                          )}
                        </div>

                        {groupsState.groups.length > 1 && (
                          <select
                            aria-label={`Chuyển nhóm cho ${st.fullName}`}
                            value={grp.id}
                            onChange={(e) => handleMoveStudent(st.id, e.target.value)}
                            className="text-xs bg-white border border-slate-200 rounded px-1.5 py-1 text-slate-700 cursor-pointer focus:border-[#1769F4] focus:outline-none"
                          >
                            {groupsState.groups.map((targetG) => (
                              <option key={targetG.id} value={targetG.id}>
                                {targetG.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
