import React, { useState, useEffect, useRef } from 'react';
import { StudentCandidate } from '../studentCallRules';
import { Trophy, Play, Pause, RotateCcw, Sparkles } from 'lucide-react';

interface Props {
  availableCandidates: StudentCandidate[];
  onPick: (student: StudentCandidate) => void;
  isMuted: boolean;
}

const DUCK_COLORS = [
  'bg-amber-400 text-slate-900 border-amber-300',
  'bg-orange-500 text-white border-orange-400',
  'bg-emerald-500 text-white border-emerald-400',
  'bg-blue-500 text-white border-blue-400',
  'bg-purple-600 text-white border-purple-500',
  'bg-pink-500 text-white border-pink-400',
];

export const DuckRaceGame: React.FC<Props> = ({ availableCandidates, onPick, isMuted }) => {
  const [phase, setPhase] = useState<'IDLE' | 'COUNTDOWN' | 'RACING' | 'PAUSED' | 'REVEALED'>('IDLE');
  const [countdownVal, setCountdownVal] = useState<number>(3);
  const [raceDuration, setRaceDuration] = useState<number>(10); // 5, 10, or 15 seconds
  const [racers, setRacers] = useState<{ student: StudentCandidate; progress: number; speed: number; color: string }[]>([]);
  const [winner, setWinner] = useState<StudentCandidate | null>(null);

  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const winnerRef = useRef<StudentCandidate | null>(null);

  // Initialize racers when idle or candidates change
  useEffect(() => {
    if (phase === 'IDLE' && availableCandidates.length > 0) {
      // Pick up to 6 racers including a guaranteed winner
      const shuffled = [...availableCandidates].sort(() => Math.random() - 0.5);
      const selectedRacers = shuffled.slice(0, Math.min(6, shuffled.length));
      
      setRacers(
        selectedRacers.map((s, idx) => ({
          student: s,
          progress: 0,
          speed: 0.8 + Math.random() * 0.4,
          color: DUCK_COLORS[idx % DUCK_COLORS.length],
        }))
      );
      setWinner(null);
    }
  }, [phase, availableCandidates]);

  const startRaceSequence = () => {
    if (phase !== 'IDLE' || availableCandidates.length === 0) return;

    // 1. Pre-select winner fairly
    const chosen = availableCandidates[Math.floor(Math.random() * availableCandidates.length)];
    winnerRef.current = chosen;

    // Ensure winner is among racers if racers < available candidates
    let currentRacers = [...racers];
    if (!currentRacers.some(r => r.student.id === chosen.id)) {
      if (currentRacers.length > 0) {
        currentRacers[0] = {
          student: chosen,
          progress: 0,
          speed: 1.0,
          color: DUCK_COLORS[0],
        };
      }
    }
    setRacers(currentRacers);
    setWinner(null);
    setPhase('COUNTDOWN');
    setCountdownVal(3);

    // Countdown 3-2-1
    let count = 3;
    const countInterval = window.setInterval(() => {
      count--;
      if (count > 0) {
        setCountdownVal(count);
      } else {
        clearInterval(countInterval);
        setPhase('RACING');
        startTimeRef.current = performance.now();
        runRaceLoop();
      }
    }, 1000);
  };

  const runRaceLoop = () => {
    const durationMs = raceDuration * 1000;

    const updateFrame = (timestamp: number) => {
      if (!startTimeRef.current) return;
      const elapsed = timestamp - startTimeRef.current;
      const rawProgress = Math.min(elapsed / durationMs, 1.0);

      setRacers(prev => {
        return prev.map(r => {
          let p = r.progress;
          const isTheWinner = winnerRef.current && r.student.id === winnerRef.current.id;

          if (isTheWinner) {
            p = Math.min(rawProgress * 100, 100);
          } else {
            const maxOtherProgress = 92;
            p = Math.min(rawProgress * r.speed * maxOtherProgress, maxOtherProgress);
          }
          return { ...r, progress: p };
        });
      });

      if (rawProgress < 1.0) {
        animationFrameRef.current = requestAnimationFrame(updateFrame);
      } else {
        // Race finished - schedule outside state updater
        const finalWinner = winnerRef.current;
        if (finalWinner) {
          window.setTimeout(() => {
            setWinner(finalWinner);
            setPhase('REVEALED');
            onPick(finalWinner);
          }, 0);
        }
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateFrame);
  };

  const pauseRace = () => {
    if (phase === 'RACING') {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      setPhase('PAUSED');
    }
  };

  const resumeRace = () => {
    if (phase === 'PAUSED') {
      startTimeRef.current = performance.now(); // approximate resume
      setPhase('RACING');
      runRaceLoop();
    }
  };

  const resetRace = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setPhase('IDLE');
    setWinner(null);
    if (availableCandidates.length > 0) {
      const shuffled = [...availableCandidates].sort(() => Math.random() - 0.5);
      const selectedRacers = shuffled.slice(0, Math.min(6, shuffled.length));
      setRacers(
        selectedRacers.map((s, idx) => ({
          student: s,
          progress: 0,
          speed: 0.8 + Math.random() * 0.4,
          color: DUCK_COLORS[idx % DUCK_COLORS.length],
        }))
      );
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-between h-full space-y-4">
      {/* Duck Race Stage Container */}
      <div className="relative w-full h-[380px] lg:h-[430px] bg-gradient-to-b from-sky-950 via-teal-950 to-slate-950 rounded-3xl border-4 border-cyan-400/60 p-6 shadow-2xl flex flex-col justify-between overflow-hidden">
        {/* Top Header & Duration Selector */}
        <div className="flex items-center justify-between text-cyan-300 text-xs sm:text-sm font-bold uppercase tracking-widest px-2 z-20">
          <span>🦆 TÂY ĐÔ DUCK RACE · VỊT ĐUA MAY MẮN</span>
          <div className="flex items-center gap-2">
            <span className="text-cyan-200 text-xs">Tốc độ:</span>
            {[
              { label: 'Nhanh (5s)', val: 5 },
              { label: 'Thường (10s)', val: 10 },
              { label: 'Kịch tính (15s)', val: 15 },
            ].map(d => (
              <button
                key={d.val}
                onClick={() => setRaceDuration(d.val)}
                disabled={phase !== 'IDLE'}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                  raceDuration === d.val ? 'bg-cyan-500 text-white' : 'bg-white/10 text-cyan-200 hover:bg-white/20'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* River Track Stage */}
        <div className="relative w-full flex-1 my-3 bg-gradient-to-r from-blue-900/40 via-teal-900/60 to-blue-950/80 rounded-2xl border-2 border-cyan-400/40 shadow-inner flex flex-col justify-around p-3 overflow-hidden">
          {/* Finish Line Banner */}
          <div className="absolute right-12 top-0 bottom-0 w-2.5 bg-amber-400 border-r-2 border-white flex items-center justify-center z-10 shadow-lg">
            <span className="text-[9px] font-black text-slate-900 rotate-90 tracking-widest">FINISH 🏁</span>
          </div>

          {/* Lanes */}
          {racers.map((r, i) => (
            <div key={r.student.id} className="relative w-full h-10 bg-blue-950/40 rounded-xl border border-cyan-500/20 flex items-center px-4 overflow-hidden">
              <span className="absolute left-3 text-[11px] font-bold text-cyan-200 z-10 w-24 truncate">
                {i + 1}. {r.student.fullName}
              </span>
              
              {/* Swimming Duck */}
              <div
                className="absolute transition-all duration-75 flex items-center gap-1 z-20"
                style={{ left: `calc(120px + (100% - 160px) * ${r.progress / 100})` }}
              >
                <div className={`w-8 h-8 rounded-full ${r.color} shadow-lg flex items-center justify-center text-base border-2 animate-bounce`}>
                  🦆
                </div>
                <div className="text-[9px] font-extrabold bg-black/60 text-white px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                  {r.student.fullName.split(' ').pop()}
                </div>
              </div>
            </div>
          ))}

          {/* Countdown Overlay */}
          {phase === 'COUNTDOWN' && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-40 animate-fadeIn">
              <span className="text-7xl font-black text-amber-300 animate-pulse">{countdownVal}</span>
            </div>
          )}

          {/* Winner Result Overlay */}
          {phase === 'REVEALED' && winner && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center z-40 animate-fadeIn p-6">
              <div className="bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-slate-900 px-8 py-6 rounded-3xl border-4 border-white shadow-2xl text-center space-y-3 max-w-sm mx-auto">
                <span className="text-4xl animate-bounce">🏆</span>
                <div className="text-xs uppercase font-extrabold tracking-wider text-slate-800">Quán quân đường đua</div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">{winner.fullName}</h3>
                <div className="text-xs font-bold bg-black/10 px-3 py-1 rounded-full inline-block">Mã: {winner.code}</div>
                <div>
                  <button
                    onClick={resetRace}
                    className="mt-2 px-6 py-2.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-extrabold shadow-md transition-all flex items-center gap-2 mx-auto"
                  >
                    <span>ĐUA TIẾP ➔</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Stage Note */}
        <div className="text-center text-xs text-cyan-200/80 z-20">
          ✨ Cuộc đua vịt hoạt hình 2D sống động, người chiến thắng được chọn trước công bằng tuyệt đối.
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-3 w-full">
        {phase === 'RACING' ? (
          <button
            onClick={pauseRace}
            className="flex-1 py-4 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-2xl text-lg font-extrabold shadow-xl transition-all flex items-center justify-center gap-2"
          >
            <Pause className="w-5 h-5 fill-current" />
            <span>TẠM DỪNG ĐUA</span>
          </button>
        ) : phase === 'PAUSED' ? (
          <button
            onClick={resumeRace}
            className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-lg font-extrabold shadow-xl transition-all flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>TIẾP TỤC ĐUA</span>
          </button>
        ) : phase === 'REVEALED' ? (
          <button
            onClick={resetRace}
            className="flex-1 py-4 bg-gradient-to-r from-cyan-500 via-[#006BFF] to-indigo-600 text-white hover:opacity-95 rounded-2xl text-lg font-extrabold shadow-xl transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            <span>ĐUA LƯỢT TIẾP ➔</span>
          </button>
        ) : (
          <button
            onClick={startRaceSequence}
            disabled={availableCandidates.length === 0}
            className="flex-1 py-4 bg-gradient-to-r from-cyan-500 via-[#006BFF] to-indigo-600 text-white hover:opacity-95 rounded-2xl text-lg font-extrabold shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>BẮT ĐẦU ĐUA VỊT NGAY</span>
          </button>
        )}
      </div>
    </div>
  );
};
