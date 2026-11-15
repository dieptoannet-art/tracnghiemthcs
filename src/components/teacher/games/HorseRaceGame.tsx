import React, { useState } from 'react';
import { StudentCandidate } from '../studentCallRules';
import { Play } from 'lucide-react';

interface Props {
  availableCandidates: StudentCandidate[];
  onPick: (student: StudentCandidate) => void;
  isMuted: boolean;
}

export const HorseRaceGame: React.FC<Props> = ({ availableCandidates, onPick, isMuted }) => {
  const [racing, setRacing] = useState<boolean>(false);
  const [winner, setWinner] = useState<StudentCandidate | null>(null);
  const racers = availableCandidates.slice(0, 4);

  const startRace = () => {
    if (racing || racers.length === 0) return;
    setRacing(true);
    setWinner(null);

    const timer = window.setTimeout(() => {
      const chosen = racers[Math.floor(Math.random() * racers.length)];
      setWinner(chosen);
      setRacing(false);
      onPick(chosen);
    }, 2500);

    return () => clearTimeout(timer);
  };

  return (
    <div className="w-full flex flex-col items-center justify-between h-full space-y-6 py-4">
      <div className="w-full max-w-2xl bg-gradient-to-b from-amber-950 via-slate-900 to-slate-950 rounded-3xl border-4 border-amber-500/50 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between text-amber-300 text-xs font-bold uppercase tracking-wider">
          <span>🐎 TÂY ĐÔ DERBY · ĐUA NGỰA TỐC ĐỘ</span>
          <span className="bg-amber-500/20 px-2 py-0.5 rounded text-amber-200">Đường đua cỏ</span>
        </div>

        <div className="space-y-3 py-4">
          {racers.map((r, i) => (
            <div key={r.id} className="relative bg-amber-950/40 border border-amber-500/30 rounded-xl p-3 flex items-center justify-between overflow-hidden">
              <span className="text-xs font-bold text-white z-10">Ngựa {i + 1}: {r.fullName}</span>
              <div
                className={`text-2xl transition-all duration-2000 ease-in-out z-10 ${
                  racing ? 'translate-x-[280px] animate-pulse' : winner?.id === r.id ? 'translate-x-[300px] scale-125' : 'translate-x-0'
                }`}
              >
                🐎
              </div>
              <div className="absolute right-2 top-0 bottom-0 w-2 bg-red-600 border-r-2 border-white flex items-center justify-center">
                <span className="text-[9px] font-extrabold text-white rotate-90">VẠCH ĐÍCH</span>
              </div>
            </div>
          ))}
        </div>

        {winner && !racing && (
          <div className="bg-amber-500/20 border border-amber-400 rounded-xl p-3 text-center animate-fadeIn">
            <span className="text-xs text-amber-300 font-bold uppercase">Ngựa chiến về nhất</span>
            <h4 className="text-xl font-extrabold text-white mt-0.5">{winner.fullName}</h4>
          </div>
        )}
      </div>

      <button
        onClick={startRace}
        disabled={racing || racers.length === 0}
        className="w-full max-w-md py-4 bg-gradient-to-r from-amber-500 via-red-600 to-indigo-600 text-white hover:opacity-95 rounded-2xl text-lg font-extrabold shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Play className={`w-5 h-5 ${racing ? 'animate-spin' : ''}`} />
        <span>{racing ? '🐎 ĐÀN NGỰA ĐANG PHI NƯỚC ĐẠI...' : 'BẮT ĐẦU ĐUA NGỰA ➔'}</span>
      </button>
    </div>
  );
};
