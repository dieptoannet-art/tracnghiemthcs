import React, { useState } from 'react';
import { StudentCandidate } from '../studentCallRules';
import { Rocket } from 'lucide-react';

interface Props {
  availableCandidates: StudentCandidate[];
  onPick: (student: StudentCandidate) => void;
  isMuted: boolean;
}

export const RocketGame: React.FC<Props> = ({ availableCandidates, onPick, isMuted }) => {
  const [launching, setLaunching] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentCandidate | null>(null);

  const startLaunch = () => {
    if (launching || availableCandidates.length === 0) return;
    setLaunching(true);
    setSelectedStudent(null);
    setCountdown(3);

    let count = 3;
    const countInterval = window.setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(countInterval);
        setCountdown(null);
        const chosen = availableCandidates[Math.floor(Math.random() * availableCandidates.length)];
        setSelectedStudent(chosen);
        setLaunching(false);
        onPick(chosen);
      }
    }, 1000);
  };

  return (
    <div className="w-full flex flex-col items-center justify-between h-full space-y-6 py-4">
      <div className="relative w-full max-w-md h-80 bg-gradient-to-b from-slate-950 via-indigo-950 to-blue-950 rounded-3xl border-4 border-cyan-400/50 p-6 shadow-2xl flex flex-col items-center justify-center overflow-hidden">
        {countdown !== null && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-30">
            <span className="text-6xl font-black text-amber-300 animate-pulse">{countdown}</span>
          </div>
        )}

        <div className={`text-6xl transition-all duration-1000 ${launching ? '-translate-y-48 scale-110 animate-bounce' : 'translate-y-0'}`}>
          🚀
        </div>
        <div className="text-xs text-cyan-300 font-bold uppercase tracking-widest mt-6">Bệ phóng tên lửa không gian</div>

        {selectedStudent && !launching && countdown === null && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 z-30 animate-fadeIn">
            <span className="text-3xl mb-1">🌟</span>
            <span className="text-xs uppercase font-bold text-cyan-300">Tên lửa hạ cánh thành công</span>
            <h3 className="text-2xl font-extrabold text-white mt-1">{selectedStudent.fullName}</h3>
          </div>
        )}
      </div>

      <button
        onClick={startLaunch}
        disabled={launching || availableCandidates.length === 0}
        className="w-full max-w-md py-4 bg-gradient-to-r from-cyan-500 via-[#006BFF] to-indigo-600 text-white hover:opacity-95 rounded-2xl text-lg font-extrabold shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Rocket className={`w-5 h-5 ${launching ? 'animate-spin' : ''}`} />
        <span>{launching ? '🚀 ĐANG ĐẾM NGƯỢC PHÓNG...' : 'PHÓNG TÊN LỬA NGAY ➔'}</span>
      </button>
    </div>
  );
};
