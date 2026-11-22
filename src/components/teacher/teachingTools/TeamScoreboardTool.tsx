import React, { useMemo, useState } from 'react';
import {
  Edit3,
  History,
  Monitor,
  Plus,
  RotateCcw,
  Trash2,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import {
  ScoreboardState,
  StudentGroupItem,
  applyTeamScoreAction,
  computeScoreboardRankings,
  importGroupsToScoreboard,
  undoLastScoreAction,
} from './teachingToolsEngine';
import { playTeachingToolScoreCue } from './teachingToolsAudio';

interface TeamScoreboardToolProps {
  groups: StudentGroupItem[];
  scoreboardState: ScoreboardState;
  isMutedGlobal: boolean;
  onChangeScoreboardState: (next: ScoreboardState) => void;
}

const TEAM_COLORS = [
  '#1D4ED8',
  '#047857',
  '#B45309',
  '#BE123C',
  '#6D28D9',
  '#0E7490',
];

export const TeamScoreboardTool: React.FC<TeamScoreboardToolProps> = ({
  groups,
  scoreboardState,
  isMutedGlobal,
  onChangeScoreboardState,
}) => {
  const [reasonText, setReasonText] = useState<string>('');
  const [newTeamName, setNewTeamName] = useState<string>('');
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [draftTeamName, setDraftTeamName] = useState<string>('');
  const [projectorOpen, setProjectorOpen] = useState<boolean>(false);

  const rankings = useMemo(
    () => computeScoreboardRankings(scoreboardState.teams),
    [scoreboardState.teams]
  );

  const handleAdjustScore = (teamId: string, delta: number) => {
    const actionId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const next = applyTeamScoreAction({
      state: scoreboardState,
      teamId,
      delta,
      reason: reasonText,
      actionId,
    });
    onChangeScoreboardState(next);
    playTeachingToolScoreCue(isMutedGlobal, delta > 0);
  };

  const handleAddTeam = () => {
    const idx = scoreboardState.teams.length;
    const name = newTeamName.trim() || `Đội ${idx + 1}`;
    const nextTeams = [
      ...scoreboardState.teams,
      {
        id: `sb_team_${Date.now().toString(36)}`,
        name,
        color: TEAM_COLORS[idx % TEAM_COLORS.length],
        score: 0,
        memberStudentIds: [],
      },
    ];
    onChangeScoreboardState({
      ...scoreboardState,
      teams: nextTeams,
    });
    setNewTeamName('');
  };

  const handleRenameCommit = (teamId: string) => {
    if (draftTeamName.trim()) {
      onChangeScoreboardState({
        ...scoreboardState,
        teams: scoreboardState.teams.map((t) =>
          t.id === teamId ? { ...t, name: draftTeamName.trim() } : t
        ),
      });
    }
    setEditingTeamId(null);
  };

  const handleRemoveTeam = (teamId: string) => {
    if (scoreboardState.teams.length <= 1) return;
    onChangeScoreboardState({
      ...scoreboardState,
      teams: scoreboardState.teams.filter((t) => t.id !== teamId),
    });
  };

  const hasUndoable = scoreboardState.history.some((h) => !h.undone);

  return (
    <div className="space-y-5 font-edtech">
      {/* Header Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[#0F2D52]">Bảng điểm đội</h3>
            <p className="text-sm text-slate-600">
              {scoreboardState.teams.length} đội · Đồng hạng tự động khi bằng điểm
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {groups.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  onChangeScoreboardState(
                    importGroupsToScoreboard(groups, scoreboardState)
                  )
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#0F56D3] text-xs sm:text-sm font-bold cursor-pointer"
              >
                <Users className="w-4 h-4" />
                <span>Lấy từ kết quả Chia nhóm ({groups.length})</span>
              </button>
            )}

            <button
              type="button"
              disabled={!hasUndoable}
              onClick={() =>
                onChangeScoreboardState(undoLastScoreAction(scoreboardState))
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-45 text-slate-800 text-xs sm:text-sm font-bold cursor-pointer disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Hoàn tác</span>
            </button>

            <button
              type="button"
              onClick={() => setProjectorOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold cursor-pointer"
            >
              <Monitor className="w-4 h-4" />
              <span>Màn chiếu (Tên &amp; Điểm)</span>
            </button>
          </div>
        </div>

        {/* Optional Reason Input & Add Team */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <div className="space-y-1">
            <label htmlFor="sb-reason" className="block text-xs font-semibold text-slate-600">
              Lý do cộng/trừ điểm (tùy chọn)
            </label>
            <input
              id="sb-reason"
              type="text"
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="Ví dụ: Phát biểu hay, hoàn thành trạm nhanh..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:border-[#1769F4] focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="sb-new-team" className="block text-xs font-semibold text-slate-600">
              Thêm đội thủ công
            </label>
            <div className="flex items-center gap-2">
              <input
                id="sb-new-team"
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddTeam();
                }}
                placeholder="Tên đội mới..."
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:border-[#1769F4] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddTeam}
                className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg bg-[#1769F4] hover:bg-[#0F56D3] text-white text-xs sm:text-sm font-bold cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm đội</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Team Score Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {scoreboardState.teams.map((team) => {
          const rankInfo = rankings.find((r) => r.teamId === team.id);
          return (
            <div
              key={team.id}
              className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between gap-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-sm shrink-0"
                      style={{ backgroundColor: team.color }}
                    />
                    {editingTeamId === team.id ? (
                      <input
                        type="text"
                        value={draftTeamName}
                        onChange={(e) => setDraftTeamName(e.target.value)}
                        onBlur={() => handleRenameCommit(team.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameCommit(team.id);
                          if (e.key === 'Escape') setEditingTeamId(null);
                        }}
                        autoFocus
                        className="w-full px-2 py-0.5 rounded border border-[#1769F4] text-sm font-bold text-slate-900"
                      />
                    ) : (
                      <h4 className="text-base font-extrabold text-[#0F2D52] truncate">
                        {team.name}
                      </h4>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTeamId(team.id);
                        setDraftTeamName(team.name);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                      aria-label={`Đổi tên ${team.name}`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Hạng #{rankInfo?.rank ?? 1}
                    {team.memberStudentIds.length > 0 &&
                      ` · ${team.memberStudentIds.length} thành viên`}
                  </div>
                </div>

                {scoreboardState.teams.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTeam(team.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                    aria-label={`Xóa ${team.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="text-center py-2">
                <span className="text-5xl font-mono font-extrabold tabular-nums text-[#0F2D52]">
                  {team.score}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {scoreboardState.quickDeltas.map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    onClick={() => handleAdjustScore(team.id, delta)}
                    className={`py-2 rounded-lg font-mono text-xs sm:text-sm font-extrabold cursor-pointer transition-colors ${
                      delta > 0
                        ? 'bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800'
                    }`}
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* History Audit Log */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-base font-bold text-[#0F2D52] flex items-center gap-2">
            <History className="w-4 h-4 text-[#1769F4]" />
            <span>Lịch sử thay đổi điểm ({scoreboardState.history.length})</span>
          </h4>
        </div>

        {scoreboardState.history.length === 0 ? (
          <p className="text-xs sm:text-sm text-slate-500">
            Chưa có lượt cộng/trừ điểm nào trong phiên này.
          </p>
        ) : (
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
            {scoreboardState.history.map((entry) => (
              <div
                key={entry.actionId}
                className={`py-2 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm ${
                  entry.undone ? 'opacity-45 line-through' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#0F2D52]">{entry.teamName}</span>
                  <span
                    className={`font-mono font-extrabold tabular-nums ${
                      entry.delta > 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                  </span>
                  <span className="text-slate-600">— {entry.reason}</span>
                </div>
                <span className="text-xs font-mono text-slate-400 tabular-nums">
                  {new Date(entry.timestampMs).toLocaleTimeString('vi-VN')}
                  {entry.undone ? ' · Đã hoàn tác' : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clean Projector Overlay — Strictly ONLY Team Names & Scores (per §4.E) */}
      {projectorOpen && (
        <div className="fixed inset-0 z-50 bg-[#071126] text-white p-6 sm:p-10 flex flex-col justify-between gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-3">
              <Trophy className="w-8 h-8 text-amber-400" />
              <span>BẢNG ĐIỂM ĐỘI</span>
            </h2>
            <button
              type="button"
              onClick={() => setProjectorOpen(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-bold cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Đóng</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 my-auto">
            {rankings.map((row) => (
              <div
                key={row.teamId}
                className="p-6 sm:p-8 rounded-2xl bg-slate-900 border border-white/15 flex flex-col items-center justify-center gap-3 text-center"
              >
                <div className="text-sm font-mono font-bold text-amber-300">
                  Hạng #{row.rank}
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white">
                  {row.name}
                </div>
                <div className="text-6xl sm:text-7xl font-mono font-extrabold text-emerald-300 tabular-nums">
                  {row.score}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
