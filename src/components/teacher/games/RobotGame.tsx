import React, { useState } from 'react';
import { StudentCandidate } from '../studentCallRules';
import { Bot } from 'lucide-react';

interface Props {
  availableCandidates: StudentCandidate[];
  onPick: (student: StudentCandidate) => void;
  isMuted: boolean;
}

export const RobotGame: React.FC<Props> = ({ availableCandidates, onPick, isMuted }) => {
  const [scanning, setScanning] = useState<boolean>(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentCandidate | null>(null);

  const startScan = () => {
    if (scanning || availableCandidates.length === 0) return;
    setScanning(true);
    setSelectedStudent(null);

    const timer = window.setTimeout(() => {
      const chosen = availableCandidates[Math.floor(Math.random() * availableCandidates.length)];
      setSelectedStudent(chosen);
      setScanning(false);
      onPick(chosen);
    }, 2000);

    return () => clearTimeout(timer);
  };

  return (
    <div className="w-full flex flex-col items-center justify-between h-full space-y-6 py-4">
      <div className="relative w-full max-w-md h-80 bg-gradient-to-b from-slate-950 via-cyan-950 to-blue-950 rounded-3xl border-4 border-cyan-400/50 p-6 shadow-2xl flex flex-col items-center justify-center overflow-hidden">
        <div className={`text-6xl ${scanning ? 'animate-bounce text-cyan-300' : ''}`}>
          🤖
        </div>
        <div className="text-xs text-cyan-300 font-bold uppercase tracking-widest mt-6">Robot AI quét lớp học</div>

        {selectedStudent && !scanning && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 z-30 animate-fadeIn">
            <span className="text-3xl mb-1">🤖</span>
            <span className="text-xs uppercase font-bold text-cyan-300">Robot đã chọn</span>
            <h3 className="text-2xl font-extrabold text-white mt-1">{selectedStudent.fullName}</h3>
          </div>
        )}
      </div>

      <button
        onClick={startScan}
        disabled={scanning || availableCandidates.length === 0}
        className="w-full max-w-md py-4 bg-gradient-to-r from-cyan-500 via-[#006BFF] to-indigo-600 text-white hover:opacity-95 rounded-2xl text-lg font-extrabold shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Bot className={`w-5 h-5 ${scanning ? 'animate-spin' : ''}`} />
        <span>{scanning ? '🤖 ROBOT ĐANG QUÉT LỚP...' : 'ROBOT QUÉT VÀ CHỌN ➔'}</span>
      </button>
    </div>
  );
};
