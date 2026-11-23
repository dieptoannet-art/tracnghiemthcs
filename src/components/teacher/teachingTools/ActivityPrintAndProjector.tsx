import React, { useEffect } from 'react';
import {
  Bell,
  BellOff,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Lock,
  Pause,
  Play,
  Printer,
  RotateCcw,
  Unlock,
  X,
} from 'lucide-react';
import {
  ACTIVITY_TAB_META,
  ActivityProSessionState,
  ActivitySchedulePhase,
  ActivityScheduleResult,
  ActivityWorkingGroup,
  formatClockMMSS,
  formatDurationVietnamese,
} from './activityProEngine';

export type ActivityPrintDocType =
  | 'station_cards'
  | 'station_schedule'
  | 'jigsaw_roles'
  | 'jigsaw_expert_cards'
  | 'tablecloth_sheets'
  | 'gallery_schedule'
  | 'gallery_feedback';

export const PRINT_DOCS_BY_MODE: Record<
  ActivityProSessionState['mode'],
  Array<{ id: ActivityPrintDocType; label: string; desc: string }>
> = {
  station_rotation: [
    {
      id: 'station_cards',
      label: 'In phiếu nhiệm vụ các trạm',
      desc: 'Từng phiếu đặt cố định tại mỗi trạm kèm nhiệm vụ và giáo cụ.',
    },
    {
      id: 'station_schedule',
      label: 'In lịch luân chuyển',
      desc: 'Bảng ma trận vòng di chuyển của tất cả các nhóm qua các trạm.',
    },
  ],
  jigsaw: [
    {
      id: 'jigsaw_roles',
      label: 'In bảng phân vai',
      desc: 'Danh sách học sinh thuộc nhóm gốc nào và phụ trách chủ đề nào.',
    },
    {
      id: 'jigsaw_expert_cards',
      label: 'In phiếu chuyên gia',
      desc: 'Phiếu nhiệm vụ theo từng chủ đề kèm danh sách chuyên gia tham gia.',
    },
  ],
  tablecloth: [
    {
      id: 'tablecloth_sheets',
      label: 'In phiếu khăn trải bàn',
      desc: 'Phiếu khổ ngang chia đúng số ô cá nhân theo sĩ số từng nhóm + ô trung tâm.',
    },
  ],
  gallery_walk: [
    {
      id: 'gallery_schedule',
      label: 'In lịch tham quan',
      desc: 'Ma trận lượt di chuyển của các nhóm qua các gian sản phẩm.',
    },
    {
      id: 'gallery_feedback',
      label: 'In phiếu góp ý',
      desc: 'Các phiếu nhận xét gồm 1 điểm mạnh, 1 câu hỏi và 1 đề xuất.',
    },
  ],
};

// ============================================================================
// 1. HIGH-CONTRAST FULLSCREEN PROJECTOR MODAL
// ============================================================================

interface ProjectorModalProps {
  isOpen: boolean;
  classNameLabel: string;
  session: ActivityProSessionState;
  schedule: ActivityScheduleResult;
  currentPhase: ActivitySchedulePhase | null;
  displaySeconds: number;
  progressRatio: number;
  onClose: () => void;
  onTogglePauseResume: () => void;
  onPrevPhase: () => void;
  onNextPhase: () => void;
  onToggleBellMute: () => void;
  reducedMotion?: boolean;
}

export const ActivityProjectorModal: React.FC<ProjectorModalProps> = ({
  isOpen,
  classNameLabel,
  session,
  schedule,
  currentPhase,
  displaySeconds,
  progressRatio,
  onClose,
  onTogglePauseResume,
  onPrevPhase,
  onNextPhase,
  onToggleBellMute,
  reducedMotion = false,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !currentPhase) return null;

  const modeMeta = ACTIVITY_TAB_META.find((m) => m.mode === session.mode);
  const nextPhase = schedule.phases[session.currentPhaseIndex + 1] || null;
  const isUrgent = displaySeconds <= 15 && session.status === 'running';
  const distinctPhaseAndRound = schedule.totalPhases !== schedule.totalRounds;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Màn hình trình chiếu hoạt động nhóm"
      className="fixed inset-0 z-50 bg-[#07162E] text-white flex flex-col justify-between overflow-y-auto p-4 sm:p-8 no-print"
    >
      {/* Top Projector Strip */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-sky-300">
            <span>{classNameLabel}</span>
            <span>·</span>
            <span>{modeMeta?.label}</span>
            <span>·</span>
            <span className="px-2 py-0.5 rounded bg-white/10 text-amber-300">
              Vòng {currentPhase.roundNumber}/{currentPhase.totalRounds}
            </span>
            {distinctPhaseAndRound && (
              <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-200">
                Pha {session.currentPhaseIndex + 1}/{schedule.totalPhases}
              </span>
            )}
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
            {currentPhase.title}
          </h2>
          <p className="text-sm sm:text-base text-slate-300">{currentPhase.instructions}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleBellMute}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold cursor-pointer"
          >
            {session.bellMuted ? <BellOff className="w-4 h-4 text-rose-300" /> : <Bell className="w-4 h-4 text-emerald-300" />}
            <span>{session.bellMuted ? 'Tắt chuông' : 'Chuông bật'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500/90 hover:bg-rose-500 text-white text-xs sm:text-sm font-extrabold cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Thoát (Esc)</span>
          </button>
        </div>
      </header>

      {/* Main Clock + Cards */}
      <main className="flex-1 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Clock Panel */}
        <section className="lg:col-span-4 bg-white/8 border border-white/15 rounded-3xl p-6 space-y-5 text-center">
          <p className="text-xs font-extrabold uppercase tracking-widest text-sky-300">
            {session.status === 'paused'
              ? 'Đang tạm dừng'
              : session.status === 'completed'
              ? 'Đã hoàn thành'
              : session.status === 'idle'
              ? 'Sẵn sàng bắt đầu'
              : currentPhase.isTransition
              ? 'Thời gian di chuyển'
              : 'Thời gian còn lại'}
          </p>
          <div
            className={`text-6xl sm:text-7xl xl:text-8xl font-extrabold font-mono-num tracking-tight ${
              isUrgent
                ? reducedMotion
                  ? 'text-amber-300'
                  : 'text-amber-300 animate-pulse'
                : 'text-white'
            }`}
          >
            {formatClockMMSS(displaySeconds)}
          </div>

          <div className="w-full h-3 rounded-full bg-white/15 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isUrgent ? 'bg-amber-400' : currentPhase.isTransition ? 'bg-sky-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, progressRatio * 100))}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={onPrevPhase}
              disabled={session.currentPhaseIndex <= 0}
              className="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Pha trước</span>
            </button>
            <button
              type="button"
              onClick={onTogglePauseResume}
              className="px-5 py-2.5 rounded-xl bg-[#1769F4] hover:bg-[#0F56D3] text-white text-sm font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
            >
              {session.status === 'running' ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span>Tạm dừng</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>{session.status === 'idle' ? 'Bắt đầu' : 'Tiếp tục'}</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onNextPhase}
              className="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <span>{session.currentPhaseIndex + 1 >= schedule.totalPhases ? 'Tổng kết' : 'Pha tiếp'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {nextPhase && (
            <div className="mt-4 pt-4 border-t border-white/15 text-left">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Pha kế tiếp ({formatDurationVietnamese(nextPhase.durationSeconds)}):
              </p>
              <p className="text-sm font-bold text-sky-200 mt-0.5">{nextPhase.title}</p>
            </div>
          )}

          {/* Station Rotation Map Strip */}
          {session.mode === 'station_rotation' &&
            schedule.stationMatrix &&
            schedule.stationMatrix.length > 0 && (() => {
              const curRoundRow =
                schedule.stationMatrix.find((r) => r.roundNumber === currentPhase.roundNumber) ||
                schedule.stationMatrix[0];
              const nextRoundRow = schedule.stationMatrix.find(
                (r) => r.roundNumber === currentPhase.roundNumber + 1
              );
              return (
                <div className="mt-4 pt-4 border-t border-white/15 text-left space-y-2">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-sky-300">
                    Bản đồ trạm · Vòng {curRoundRow.roundNumber}/{schedule.totalRounds}
                  </p>
                  <div className="space-y-1.5">
                    {session.stationConfig.stations.map((st, stIdx) => {
                      const occupying = curRoundRow.assignments.filter(
                        (a) => !a.isWaiting && a.stationId === st.id
                      );
                      const nextDestinations = nextRoundRow
                        ? occupying
                            .map((occ) => {
                              const nx = nextRoundRow.assignments.find((x) => x.groupId === occ.groupId);
                              return nx ? (nx.isWaiting ? 'Chờ' : nx.stationTitle) : null;
                            })
                            .filter(Boolean)
                        : [];
                      return (
                        <div
                          key={st.id}
                          className="px-2.5 py-2 rounded-xl bg-white/10 border border-white/10 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-extrabold text-amber-300 truncate">
                              Trạm {stIdx + 1}: {st.title}
                            </span>
                            {nextDestinations.length > 0 && (
                              <span className="text-[10px] font-semibold text-sky-200 shrink-0">
                                → {nextDestinations.join(', ')}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {occupying.length > 0 ? (
                              occupying.map((g) => (
                                <span
                                  key={g.groupId}
                                  className="px-2 py-0.5 rounded-md text-[11px] font-extrabold text-white"
                                  style={{ backgroundColor: g.groupColor }}
                                >
                                  {g.groupName}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-slate-400">Trạm trống</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
        </section>

        {/* Stage Assignment Grid */}
        <section className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {currentPhase.cards.map((card) => {
            const imgUrl = typeof card.meta?.imageUrl === 'string' ? card.meta.imageUrl : '';
            const isCenterLocked = Boolean(card.meta?.centerLocked);
            return (
              <article
                key={card.cardId}
                className={`rounded-2xl p-4 border flex flex-col justify-between gap-3 ${
                  card.isWaiting
                    ? 'bg-slate-800/70 border-slate-600 text-slate-300'
                    : 'bg-white text-[#082B52] border-white/80 shadow-lg'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="px-2.5 py-1 rounded-lg text-xs font-extrabold text-white"
                      style={{ backgroundColor: card.accentColor }}
                    >
                      {card.badge}
                    </span>
                    {card.subtitle && (
                      <span
                        className={`text-[11px] font-bold ${
                          card.isWaiting ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        {card.subtitle}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base sm:text-lg font-extrabold leading-snug">{card.title}</h3>

                  {imgUrl && (
                    <img
                      src={imgUrl}
                      alt={card.title}
                      className="w-full h-28 object-cover rounded-xl border border-slate-200"
                    />
                  )}

                  <p
                    className={`text-xs sm:text-sm leading-relaxed ${
                      card.isWaiting ? 'text-slate-300' : 'text-slate-700'
                    }`}
                  >
                    {card.body}
                  </p>

                  {session.mode === 'tablecloth' && (
                    <div
                      className={`mt-2 px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
                        isCenterLocked
                          ? 'bg-amber-50 border-amber-200 text-amber-900'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      }`}
                    >
                      {isCenterLocked ? <Lock className="w-3.5 h-3.5 shrink-0" /> : <Unlock className="w-3.5 h-3.5 shrink-0" />}
                      <span>
                        {isCenterLocked
                          ? 'Ô trung tâm: Điền ở bước 2'
                          : 'Ô trung tâm đã mở: Thống nhất kết luận'}
                      </span>
                    </div>
                  )}
                </div>

                {card.members && card.members.length > 0 && (
                  <div
                    className={`pt-2.5 border-t text-xs flex flex-wrap gap-1.5 ${
                      card.isWaiting ? 'border-slate-700' : 'border-slate-100'
                    }`}
                  >
                    {card.members.map((m) => (
                      <span
                        key={m.id}
                        className={`px-2 py-0.5 rounded-md font-semibold ${
                          card.isWaiting
                            ? 'bg-slate-700 text-slate-200'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {m.label}
                        {m.homeGroupLabel ? ` (${m.homeGroupLabel})` : ''}
                        {m.roleTag ? ` · ${m.roleTag}` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
};

// ============================================================================
// 2. FULL SCHEDULE PREVIEW MODAL ("XEM LỊCH")
// ============================================================================

interface SchedulePreviewModalProps {
  isOpen: boolean;
  session: ActivityProSessionState;
  schedule: ActivityScheduleResult;
  groups: ActivityWorkingGroup[];
  onClose: () => void;
}

export const ActivitySchedulePreviewModal: React.FC<SchedulePreviewModalProps> = ({
  isOpen,
  session,
  schedule,
  groups,
  onClose,
}) => {
  if (!isOpen) return null;
  const modeMeta = ACTIVITY_TAB_META.find((m) => m.mode === session.mode);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Xem trước toàn bộ lịch hoạt động"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 no-print"
    >
      <div className="bg-white rounded-2xl border border-[#DCE8F7] shadow-2xl w-full max-w-5xl max-h-[88vh] flex flex-col overflow-hidden">
        <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-[#F8FBFF]">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-[#1769F4]">
              Xem trước toàn bộ lịch · {modeMeta?.label}
            </p>
            <h3 className="text-lg font-extrabold text-[#082B52]">
              {schedule.totalPhases} pha ({schedule.totalRounds} vòng) · Tổng thời lượng dự kiến:{' '}
              {formatDurationVietnamese(schedule.totalDurationSeconds)}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Timeline of Phases */}
          <section className="space-y-2.5">
            <h4 className="text-sm font-extrabold text-[#082B52] flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-[#1769F4]" />
              <span>Trình tự từng pha ({schedule.totalPhases} pha)</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {schedule.phases.map((p, idx) => (
                <div
                  key={p.phaseId}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                    p.isTransition
                      ? 'bg-amber-50/70 border-amber-200'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-[#082B52] truncate">
                      Pha {idx + 1}: {p.title}
                    </p>
                    <p className="text-[11px] text-slate-600 truncate">{p.subtitle}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-[#0F2D52] font-mono-num text-xs font-extrabold shrink-0">
                    {formatDurationVietnamese(p.durationSeconds)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Station Matrix */}
          {schedule.stationMatrix && schedule.stationMatrix.length > 0 && (
            <section className="space-y-2.5">
              <h4 className="text-sm font-extrabold text-[#082B52]">
                Bảng luân chuyển theo vòng ({groups.length} nhóm)
              </h4>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 text-[#082B52]">
                    <tr>
                      <th className="p-2.5 border-b border-slate-200 font-extrabold">Vòng</th>
                      {groups.map((g) => (
                        <th key={g.id} className="p-2.5 border-b border-slate-200 font-extrabold">
                          {g.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.stationMatrix.map((row) => (
                      <tr key={row.roundNumber} className="odd:bg-white even:bg-slate-50/50">
                        <td className="p-2.5 border-b border-slate-100 font-extrabold text-[#1769F4]">
                          Vòng {row.roundNumber}
                        </td>
                        {row.assignments.map((a) => (
                          <td
                            key={a.groupId}
                            className={`p-2.5 border-b border-slate-100 font-semibold ${
                              a.isWaiting ? 'text-amber-700 bg-amber-50/50' : 'text-slate-800'
                            }`}
                          >
                            {a.stationTitle}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Jigsaw Student Assignment Table */}
          {schedule.jigsawAssignments && schedule.jigsawAssignments.length > 0 && (
            <section className="space-y-2.5">
              <h4 className="text-sm font-extrabold text-[#082B52]">
                Bảng phân vai chuyên gia ({schedule.jigsawAssignments.length} học sinh)
              </h4>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 text-[#082B52]">
                    <tr>
                      <th className="p-2.5 border-b border-slate-200 font-extrabold">Học sinh</th>
                      <th className="p-2.5 border-b border-slate-200 font-extrabold">Nhóm gốc (Mảnh ghép)</th>
                      <th className="p-2.5 border-b border-slate-200 font-extrabold">Chủ đề Chuyên gia đảm nhận</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.jigsawAssignments.map((item) => (
                      <tr key={item.memberId} className="odd:bg-white even:bg-slate-50/50">
                        <td className="p-2.5 border-b border-slate-100 font-bold text-[#082B52]">
                          {item.displayName}
                        </td>
                        <td className="p-2.5 border-b border-slate-100 font-semibold text-slate-700">
                          {item.homeGroupName}
                        </td>
                        <td className="p-2.5 border-b border-slate-100 text-[#1769F4] font-semibold">
                          {item.expertTurns
                            .map((t) => (item.expertTurns.length > 1 ? `Lượt ${t.turnNumber}: ${t.topicTitle}` : t.topicTitle))
                            .join(' · ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Gallery Matrix */}
          {schedule.galleryMatrix && schedule.galleryMatrix.length > 0 && (
            <section className="space-y-2.5">
              <h4 className="text-sm font-extrabold text-[#082B52]">
                Ma trận tham quan Phòng tranh ({schedule.galleryMatrix.length} lượt xem)
              </h4>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 text-[#082B52]">
                    <tr>
                      <th className="p-2.5 border-b border-slate-200 font-extrabold">Lượt</th>
                      {groups.map((g) => (
                        <th key={g.id} className="p-2.5 border-b border-slate-200 font-extrabold">
                          {g.name} đến xem
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.galleryMatrix.map((row) => (
                      <tr key={row.roundNumber} className="odd:bg-white even:bg-slate-50/50">
                        <td className="p-2.5 border-b border-slate-100 font-extrabold text-[#6D28D9]">
                          Lượt {row.roundNumber}
                        </td>
                        {row.visits.map((v) => (
                          <td key={v.visitingGroupId} className="p-2.5 border-b border-slate-100 font-semibold">
                            #{v.targetProductNumber} · {v.targetProductTitle}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#082B52] text-white text-xs font-extrabold cursor-pointer"
          >
            Đóng xem trước
          </button>
        </footer>
      </div>
    </div>
  );
};

// ============================================================================
// 3. PRINT PREVIEW MODAL + ACTUAL PRINTABLE A4 DOCUMENT RENDERER
// ============================================================================

interface PrintSheetContentProps {
  docType: ActivityPrintDocType;
  classNameLabel: string;
  session: ActivityProSessionState;
  schedule: ActivityScheduleResult;
  groups: ActivityWorkingGroup[];
}

export const ActivityPrintSheetContent: React.FC<PrintSheetContentProps> = ({
  docType,
  classNameLabel,
  session,
  schedule,
  groups,
}) => {
  if (docType === 'station_cards') {
    return (
      <div className="space-y-4 text-black">
        <div className="border-b-2 border-black pb-2 flex justify-between items-end">
          <div>
            <h2 className="text-xl font-bold uppercase">PHIẾU NHIỆM VỤ CÁC TRẠM HỌC TẬP</h2>
            <p className="text-sm">Lớp: {classNameLabel} · Thời lượng mỗi trạm: {formatDurationVietnamese(session.stationConfig.workSeconds)}</p>
          </div>
          <span className="text-xs font-semibold">Tây Đô Smart EDU</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {session.stationConfig.stations.map((st, idx) => (
            <div key={st.id} className="border-2 border-black rounded-lg p-4 space-y-2 break-inside-avoid">
              <div className="flex justify-between items-center border-b border-black pb-1.5">
                <span className="text-base font-bold">TRẠM {idx + 1}: {st.title}</span>
                <span className="text-xs font-semibold">Sức chứa: {st.capacity} nhóm</span>
              </div>
              <p className="text-sm font-medium leading-relaxed min-h-[54px]">{st.task}</p>
              {st.materials && (
                <p className="text-xs border-t border-dashed border-slate-400 pt-1.5">
                  <strong>Giáo cụ / Tài liệu:</strong> {st.materials}
                </p>
              )}
              <div className="pt-2 border-t border-slate-300 text-xs">
                <strong>Xác nhận hoàn thành của các nhóm:</strong>
                <div className="grid grid-cols-3 gap-1.5 mt-1">
                  {groups.map((g) => (
                    <span key={g.id} className="border border-slate-400 px-1.5 py-0.5 rounded">
                      ☐ {g.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (docType === 'station_schedule') {
    return (
      <div className="space-y-4 text-black">
        <div className="border-b-2 border-black pb-2">
          <h2 className="text-xl font-bold uppercase">LỊCH LUÂN CHUYỂN CÁC NHÓM QUA TRẠM</h2>
          <p className="text-sm">
            Lớp: {classNameLabel} · Tổng {schedule.totalRounds} vòng ({formatDurationVietnamese(schedule.totalDurationSeconds)})
          </p>
        </div>
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-black p-2">Vòng / Pha</th>
              {groups.map((g) => (
                <th key={g.id} className="border border-black p-2">{g.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(schedule.stationMatrix || []).map((row) => (
              <tr key={row.roundNumber}>
                <td className="border border-black p-2 font-bold">Vòng {row.roundNumber}</td>
                {row.assignments.map((a) => (
                  <td key={a.groupId} className="border border-black p-2">
                    {a.stationTitle}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (docType === 'jigsaw_roles') {
    return (
      <div className="space-y-4 text-black">
        <div className="border-b-2 border-black pb-2">
          <h2 className="text-xl font-bold uppercase">BẢNG PHÂN VAI CHUYÊN GIA · MẢNH GHÉP</h2>
          <p className="text-sm">
            Lớp: {classNameLabel} · {groups.length} nhóm gốc · {session.jigsawConfig.topics.length} chủ đề
          </p>
        </div>
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-black p-2">STT</th>
              <th className="border border-black p-2">Học sinh</th>
              <th className="border border-black p-2">Nhóm gốc (Mảnh ghép)</th>
              <th className="border border-black p-2">Chủ đề Chuyên gia</th>
            </tr>
          </thead>
          <tbody>
            {(schedule.jigsawAssignments || []).map((item, idx) => (
              <tr key={item.memberId}>
                <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                <td className="border border-black p-1.5 font-semibold">{item.displayName}</td>
                <td className="border border-black p-1.5">{item.homeGroupName}</td>
                <td className="border border-black p-1.5">
                  {item.expertTurns.map((t) => `Lượt ${t.turnNumber}: ${t.topicTitle}`).join(' | ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (docType === 'jigsaw_expert_cards') {
    const expertCards = schedule.phases
      .filter((p) => p.kind === 'jigsaw_expert')
      .flatMap((p) => p.cards.map((c) => ({ phaseTitle: p.title, card: c })));

    return (
      <div className="space-y-4 text-black">
        <div className="border-b-2 border-black pb-2">
          <h2 className="text-xl font-bold uppercase">PHIẾU CHUYÊN GIA THEO CHỦ ĐỀ</h2>
          <p className="text-sm">
            Lớp: {classNameLabel} · Thời gian thảo luận chuyên gia: {formatDurationVietnamese(session.jigsawConfig.expertSeconds)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {expertCards.map(({ phaseTitle, card }) => (
            <div key={card.cardId} className="border-2 border-black rounded-lg p-3 space-y-2 break-inside-avoid">
              <p className="text-[11px] uppercase font-bold">{phaseTitle} · {card.badge}</p>
              <h3 className="text-base font-bold border-b border-black pb-1">{card.title}</h3>
              <p className="text-xs leading-relaxed min-h-[48px]">{card.body}</p>
              {card.materials && <p className="text-xs"><strong>Tài liệu:</strong> {card.materials}</p>}
              <div className="border-t border-slate-400 pt-1.5 text-[11px]">
                <strong>Thành viên chuyên gia:</strong>{' '}
                {(card.members || []).map((m) => `${m.label} (${m.homeGroupLabel || ''})`).join(', ')}
              </div>
              <div className="border border-dashed border-slate-500 h-16 rounded p-1.5 text-[11px] text-slate-600">
                Ghi chú trọng tâm để giảng lại cho nhóm gốc:
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (docType === 'tablecloth_sheets') {
    // True geometric paper Tablecloth sheet per group sized to exact member count!
    return (
      <div className="space-y-6 text-black">
        {groups.map((grp) => {
          const boxCount = grp.effectiveMemberCount;
          const prompt =
            session.tableclothConfig.usePerGroupPrompts &&
            session.tableclothConfig.perGroupPrompts[grp.id]?.trim()
              ? session.tableclothConfig.perGroupPrompts[grp.id].trim()
              : session.tableclothConfig.sharedPrompt;

          const boxes = Array.from({ length: boxCount }, (_, idx) => {
            const member = grp.members[idx];
            return member ? `Góc ${idx + 1}: ${member.displayName}` : `Góc cá nhân ${idx + 1}`;
          });

          const topCount = Math.ceil(boxes.length / 2);
          const topBoxes = boxes.slice(0, topCount);
          const bottomBoxes = boxes.slice(topCount);

          return (
            <div key={grp.id} className="border-2 border-black p-4 space-y-3 break-inside-avoid">
              <div className="flex justify-between items-center border-b border-black pb-1.5">
                <span className="text-base font-bold uppercase">
                  PHIẾU KHĂN TRẢI BÀN · {grp.name} ({boxCount} thành viên)
                </span>
                <span className="text-xs font-semibold">Lớp: {classNameLabel}</span>
              </div>
              <p className="text-xs bg-slate-100 p-2 border border-slate-400 rounded">
                <strong>Nhiệm vụ / Câu hỏi:</strong> {prompt}
              </p>

              {/* Top individual corners */}
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${Math.max(1, topBoxes.length)}, minmax(0, 1fr))` }}
              >
                {topBoxes.map((label, idx) => (
                  <div key={idx} className="border border-black p-2 min-h-[110px] flex flex-col justify-between">
                    <span className="text-[11px] font-bold border-b border-dashed border-slate-400 pb-1">
                      {label}
                    </span>
                    <span className="text-[10px] text-slate-500 text-right">Pha 1 · Cá nhân</span>
                  </div>
                ))}
              </div>

              {/* Center Consensus Rectangle */}
              <div className="border-2 border-black bg-slate-50 p-3 min-h-[120px] flex flex-col justify-between">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-extrabold uppercase">
                    Ô TRUNG TÂM · Ý KIẾN THỐNG NHẤT CỦA NHÓM
                  </span>
                  <span className="text-[11px] font-semibold">(Điền ở Pha 2)</span>
                </div>
                <div className="text-[11px] text-slate-500 border-t border-dashed border-slate-400 pt-1">
                  Tổng hợp từ {boxCount} góc cá nhân xung quanh
                </div>
              </div>

              {/* Bottom individual corners */}
              {bottomBoxes.length > 0 && (
                <div
                  className="grid gap-2"
                  style={{ gridTemplateColumns: `repeat(${bottomBoxes.length}, minmax(0, 1fr))` }}
                >
                  {bottomBoxes.map((label, idx) => (
                    <div key={idx} className="border border-black p-2 min-h-[110px] flex flex-col justify-between">
                      <span className="text-[11px] font-bold border-b border-dashed border-slate-400 pb-1">
                        {label}
                      </span>
                      <span className="text-[10px] text-slate-500 text-right">Pha 1 · Cá nhân</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (docType === 'gallery_schedule') {
    return (
      <div className="space-y-4 text-black">
        <div className="border-b-2 border-black pb-2">
          <h2 className="text-xl font-bold uppercase">LỊCH THAM QUAN PHÒNG TRANH</h2>
          <p className="text-sm">
            Lớp: {classNameLabel} · {(schedule.galleryMatrix || []).length} lượt xem chéo ·{' '}
            {formatDurationVietnamese(session.galleryConfig.visitSeconds)}/lượt
          </p>
        </div>
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-black p-2">Lượt</th>
              {groups.map((g) => (
                <th key={g.id} className="border border-black p-2">{g.name} đến xem</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(schedule.galleryMatrix || []).map((row) => (
              <tr key={row.roundNumber}>
                <td className="border border-black p-2 font-bold">Lượt {row.roundNumber}</td>
                {row.visits.map((v) => (
                  <td key={v.visitingGroupId} className="border border-black p-2">
                    Tranh #{v.targetProductNumber} · {v.targetProductTitle}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // 'gallery_feedback'
  return (
    <div className="space-y-4 text-black">
      <div className="border-b-2 border-black pb-2">
        <h2 className="text-xl font-bold uppercase">PHIẾU GÓP Ý PHÒNG TRANH (MẪU CẮT RỜI)</h2>
        <p className="text-sm">Lớp: {classNameLabel} · Dán tại mỗi gian trưng bày sản phẩm</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {groups.map((owner, idx) => {
          const title =
            session.galleryConfig.products[owner.id]?.title?.trim() ||
            `Sản phẩm số ${idx + 1} (${owner.name})`;
          return (
            <div key={owner.id} className="border-2 border-black p-3 space-y-2 break-inside-avoid">
              <div className="flex justify-between items-center border-b border-black pb-1">
                <span className="font-bold text-sm">GIAN TRANH #{idx + 1} · {owner.name}</span>
                <span className="text-xs">Nhóm góp ý: ..................</span>
              </div>
              <p className="text-xs font-semibold">Sản phẩm: {title}</p>
              <div className="space-y-2 text-xs">
                <div className="border border-slate-400 p-2 min-h-[42px]">
                  <strong>1. Điểm mạnh nổi bật:</strong>
                </div>
                <div className="border border-slate-400 p-2 min-h-[42px]">
                  <strong>2. Câu hỏi làm rõ:</strong>
                </div>
                <div className="border border-slate-400 p-2 min-h-[42px]">
                  <strong>3. Đề xuất cải tiến:</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface PrintModalProps {
  docType: ActivityPrintDocType | null;
  classNameLabel: string;
  session: ActivityProSessionState;
  schedule: ActivityScheduleResult;
  groups: ActivityWorkingGroup[];
  onChangeDocType: (doc: ActivityPrintDocType) => void;
  onClose: () => void;
  onTriggerBrowserPrint: () => void;
}

export const ActivityPrintModal: React.FC<PrintModalProps> = ({
  docType,
  classNameLabel,
  session,
  schedule,
  groups,
  onChangeDocType,
  onClose,
  onTriggerBrowserPrint,
}) => {
  if (!docType) return null;
  const availableDocs = PRINT_DOCS_BY_MODE[session.mode];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Xem trước bản in A4"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 no-print"
    >
      <div className="bg-white rounded-2xl border border-[#DCE8F7] shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <header className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-[#F8FBFF]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#1769F4] mr-2">
              Phiếu in A4:
            </span>
            {availableDocs.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => onChangeDocType(d.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-colors ${
                  docType === d.id
                    ? 'bg-[#1769F4] text-white'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onTriggerBrowserPrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>In ngay (A4)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
          <div className="bg-white p-6 rounded-xl shadow-xs border border-slate-200 max-w-4xl mx-auto">
            <ActivityPrintSheetContent
              docType={docType}
              classNameLabel={classNameLabel}
              session={session}
              schedule={schedule}
              groups={groups}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. POST-ACTIVITY SUMMARY PANEL
// ============================================================================

interface SummaryCardProps {
  session: ActivityProSessionState;
  schedule: ActivityScheduleResult;
  groups: ActivityWorkingGroup[];
  onResetToIdle: () => void;
  onSavePackage: () => void;
  onOpenPrintModal: (doc: ActivityPrintDocType) => void;
}

export const ActivitySummaryPanel: React.FC<SummaryCardProps> = ({
  session,
  schedule,
  groups,
  onResetToIdle,
  onSavePackage,
  onOpenPrintModal,
}) => {
  const docs = PRINT_DOCS_BY_MODE[session.mode];
  const actualDurationSec =
    session.startedAtMs && session.endedAtMs
      ? Math.max(1, Math.round((session.endedAtMs - session.startedAtMs) / 1000))
      : schedule.totalDurationSeconds;

  return (
    <section className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">
              Hoàn thành hoạt động nhóm
            </p>
            <h3 className="text-lg font-extrabold text-[#082B52]">
              Đã xong {schedule.totalPhases} pha · {groups.length} nhóm tham gia
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Thời lượng kế hoạch: {formatDurationVietnamese(schedule.totalDurationSeconds)} · Thực chạy:{' '}
              {formatDurationVietnamese(actualDurationSec)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSavePackage}
            className="px-3.5 py-2 rounded-xl bg-[#1769F4] hover:bg-[#0F56D3] text-white text-xs font-extrabold cursor-pointer"
          >
            Lưu cấu hình vào Gói tiết dạy
          </button>
          <button
            type="button"
            onClick={onResetToIdle}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs font-bold cursor-pointer hover:bg-slate-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Chạy lại từ Pha 1</span>
          </button>
        </div>
      </div>

      {/* Mode highlights */}
      {session.mode === 'tablecloth' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {groups.map((g) => {
            const consensus = session.tableclothNotes.consensusNotes[g.id]?.trim();
            return (
              <div key={g.id} className="bg-white rounded-xl border border-emerald-200 p-3 space-y-1">
                <p className="text-xs font-extrabold text-[#082B52]">{g.name} · Kết luận trung tâm</p>
                <p className="text-xs text-slate-700">
                  {consensus || 'Chưa nhập kết luận số (nhóm ghi trên giấy A3/phiếu in).'}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {session.mode === 'gallery_walk' && session.galleryFeedbacks.length > 0 && (
        <div className="bg-white rounded-xl border border-emerald-200 p-3 space-y-2">
          <p className="text-xs font-extrabold text-[#082B52]">
            Tổng hợp góp ý đã ghi ({session.galleryFeedbacks.length} phiếu)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {session.galleryFeedbacks.map((fb) => (
              <div key={fb.id} className="p-2 rounded-lg bg-slate-50 border border-slate-200 space-y-0.5">
                <p className="font-bold text-[#082B52]">
                  {fb.fromGroupName} góp ý Tranh #{fb.targetProductNumber}
                </p>
                {fb.strength && <p>+ Điểm mạnh: {fb.strength}</p>}
                {fb.question && <p>? Câu hỏi: {fb.question}</p>}
                {fb.suggestion && <p>→ Đề xuất: {fb.suggestion}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-200/80">
        <span className="text-xs font-bold text-emerald-900">In lưu hồ sơ / phát lớp:</span>
        {docs.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onOpenPrintModal(d.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-emerald-900 text-xs font-bold hover:bg-emerald-100/50 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{d.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
};
