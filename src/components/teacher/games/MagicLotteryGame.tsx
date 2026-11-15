import React, { useState, useEffect, useRef } from 'react';
import { StudentCandidate } from '../studentCallRules';
import { Sparkles, Trophy, RotateCcw } from 'lucide-react';

interface Props {
  availableCandidates: StudentCandidate[];
  onPick: (student: StudentCandidate) => void;
  isMuted: boolean;
}

const BALL_COLORS = [
  'bg-red-500 text-white shadow-red-500/50',
  'bg-amber-400 text-slate-900 shadow-amber-400/50',
  'bg-emerald-500 text-white shadow-emerald-500/50',
  'bg-blue-600 text-white shadow-blue-600/50',
  'bg-purple-600 text-white shadow-purple-600/50',
  'bg-pink-500 text-white shadow-pink-500/50',
  'bg-cyan-500 text-slate-900 shadow-cyan-500/50',
  'bg-indigo-600 text-white shadow-indigo-600/50',
];

export const MagicLotteryGame: React.FC<Props> = ({ availableCandidates, onPick, isMuted }) => {
  const [phase, setPhase] = useState<'IDLE' | 'SPINNING' | 'DISPENSING' | 'OPENING' | 'REVEALED'>('IDLE');
  const [drawnStudent, setDrawnStudent] = useState<StudentCandidate | null>(null);
  const [chosenBallColor, setChosenBallColor] = useState<string>(BALL_COLORS[0]);
  const timeoutRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timeoutRef.current.forEach(t => clearTimeout(t));
    };
  }, []);

  const startLottery = () => {
    if (phase !== 'IDLE' || availableCandidates.length === 0) return;

    setPhase('SPINNING');
    const randomColor = BALL_COLORS[Math.floor(Math.random() * BALL_COLORS.length)];
    setChosenBallColor(randomColor);

    const t1 = window.setTimeout(() => {
      setPhase('DISPENSING');

      // Step 2: Dispensing ball down the tube (800ms)
      const t2 = window.setTimeout(() => {
        setPhase('OPENING');

        // Step 3: Opening ball / slip (600ms)
        const t3 = window.setTimeout(() => {
          const chosen = availableCandidates[Math.floor(Math.random() * availableCandidates.length)];
          setDrawnStudent(chosen);
          setPhase('REVEALED');
          onPick(chosen);
        }, 600);
        timeoutRef.current.push(t3);
      }, 800);
      timeoutRef.current.push(t2);
    }, 1200);

    timeoutRef.current.push(t1);
  };

  const nextDraw = () => {
    setPhase('IDLE');
    setDrawnStudent(null);
  };

  const isCompleted = availableCandidates.length === 0;

  return (
    <div className="w-full flex flex-col items-center justify-between h-full space-y-4">
      {/* TV Game Show Lottery Tumbler Stage Container */}
      <div className="relative w-full h-[380px] lg:h-[430px] bg-gradient-to-b from-slate-950 via-indigo-950 to-blue-950 rounded-3xl border-4 border-cyan-400/60 p-6 shadow-2xl flex flex-col justify-between overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between text-cyan-300 text-xs sm:text-sm font-bold uppercase tracking-widest px-2 z-20">
          <span>🎰 TÂY ĐÔ LOTTERY TUMBLER · LỒNG CẦU QUAY XỔ SỐ</span>
          <span className="bg-cyan-500/20 px-3 py-1 rounded-lg text-cyan-200">
            {isCompleted ? 'ĐÃ GỌI HẾT LỚP' : `Sẵn sàng: ${availableCandidates.length} học sinh`}
          </span>
        </div>

        {/* Lottery Machine Stage */}
        <div className="relative w-72 h-64 mx-auto my-auto flex flex-col items-center justify-center z-10">
          {/* Glass Sphere Cage */}
          <div className={`relative w-48 h-48 rounded-full border-4 border-cyan-300/80 bg-gradient-to-tr from-blue-900/40 via-cyan-900/30 to-indigo-950/60 shadow-2xl flex items-center justify-center overflow-hidden ${
            phase === 'SPINNING' ? 'animate-spin border-amber-400 ring-8 ring-amber-400/30' : ''
          }`} style={{ animationDuration: '0.8s' }}>
            
            {/* Inner wireframe meridian lines */}
            <div className="absolute inset-0 rounded-full border border-cyan-400/35 scale-90" />
            <div className="absolute inset-0 rounded-full border border-cyan-400/35 scale-75" />
            <div className="absolute inset-0 w-full h-full border-t-2 border-cyan-400/40 rounded-full rotate-45" />

            {/* Bouncing Lottery Balls inside the Sphere */}
            <div className="relative w-full h-full flex flex-wrap items-center justify-center gap-2 p-4">
              {Array.from({ length: Math.min(availableCandidates.length, 12) }).map((_, i) => {
                const color = BALL_COLORS[i % BALL_COLORS.length];
                return (
                  <div
                    key={i}
                    className={`w-8 h-8 rounded-full ${color} shadow-lg flex items-center justify-center text-[10px] font-black transform transition-all duration-200 ${
                      phase === 'SPINNING' ? 'animate-bounce scale-110' : 'hover:scale-105'
                    }`}
                    style={{
                      transform: phase === 'SPINNING' ? `translate(${Math.sin(i * 3) * 25}px, ${Math.cos(i * 3) * 25}px)` : undefined,
                    }}
                  >
                    #{i + 1}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Machine Chute / Dispensing Tube */}
          <div className="relative -mt-2 w-16 h-10 bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-cyan-400 rounded-b-xl flex items-center justify-center shadow-lg z-20">
            <div className="w-4 h-4 rounded-full bg-amber-400 shadow-md animate-pulse" />
          </div>

          {/* Machine Base Stand */}
          <div className="w-56 h-6 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl border-2 border-cyan-400 shadow-xl -mt-1 flex items-center justify-center">
            <span className="text-[10px] text-cyan-300 font-extrabold uppercase tracking-widest">TÂY ĐÔ TV GAME SHOW</span>
          </div>

          {/* Dispensing / Revealed Result Overlay */}
          {(phase === 'DISPENSING' || phase === 'OPENING' || phase === 'REVEALED') && (
            <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center z-40 animate-fadeIn">
              {phase === 'REVEALED' && drawnStudent ? (
                <div className="bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-slate-900 px-8 py-6 rounded-3xl border-4 border-white shadow-2xl text-center space-y-3 animate-fadeIn max-w-sm mx-auto">
                  <span className="text-4xl animate-bounce">🎉</span>
                  <div className="text-xs uppercase font-extrabold tracking-wider text-slate-800">Trúng thưởng lượt quay</div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">{drawnStudent.fullName}</h3>
                  <div className="text-xs font-bold bg-black/10 px-3 py-1 rounded-full inline-block">Mã: {drawnStudent.code}</div>
                  <div>
                    <button
                      onClick={nextDraw}
                      className="mt-2 px-6 py-2.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-extrabold shadow-md transition-all flex items-center gap-2 mx-auto"
                    >
                      <span>BỐC THĂM TIẾP ➔</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`w-20 h-20 rounded-full ${chosenBallColor} border-4 border-white shadow-2xl flex items-center justify-center font-black text-sm animate-bounce`}>
                  🎱 ➔
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom stage note */}
        <div className="text-center text-xs text-cyan-200/80 z-20">
          ✨ Lồng cầu quay xổ số cơ học trực quan, chọn ngẫu nhiên học sinh công bằng tuyệt đối.
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={phase === 'REVEALED' ? nextDraw : startLottery}
        disabled={(phase !== 'IDLE' && phase !== 'REVEALED') || isCompleted}
        className="w-full py-4 bg-gradient-to-r from-cyan-500 via-[#006BFF] to-indigo-600 text-white hover:opacity-95 rounded-2xl text-lg font-extrabold shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-3"
      >
        <Sparkles className={`w-6 h-6 ${phase === 'SPINNING' ? 'animate-spin' : ''}`} />
        <span>
          {isCompleted
            ? 'ĐÃ GỌI HẾT LỚP'
            : phase === 'SPINNING'
            ? '🎰 LỒNG CẦU ĐANG QUAY XỔ SỐ...'
            : phase === 'REVEALED'
            ? 'BỐC THĂM TIẾP ➔'
            : '🎰 BẮT ĐẦU QUAY XỔ SỐ NGAY'}
        </span>
      </button>
    </div>
  );
};
