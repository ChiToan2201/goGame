'use client';

import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { Trophy, RotateCcw, Home } from 'lucide-react';
import { StoneColor } from '@/lib/game-engine';

interface GameOverModalProps {
  isOpen: boolean;
  winner: StoneColor | 'DRAW' | null;
  winReason?: string;
  blackCount: number;
  whiteCount: number;
  playerBlack: { name: string; avatar: string };
  playerWhite: { name: string; avatar: string };
  myColor: StoneColor | 'spectator' | null;
  rematchRequested?: boolean;
  onRematch: () => void;
  onExit: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  winner,
  winReason,
  blackCount,
  whiteCount,
  playerBlack,
  playerWhite,
  myColor,
  rematchRequested,
  onRematch,
  onExit,
}) => {
  useEffect(() => {
    if (isOpen && winner) {
      const isMeWinner =
        (winner === 'B' && myColor === 'B') ||
        (winner === 'W' && myColor === 'W') ||
        myColor === null;

      if (isMeWinner) {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#A83226', '#1F1C19', '#D9AA6B', '#F5F1E8'],
        });
      }
    }
  }, [isOpen, winner, myColor]);

  if (!isOpen) return null;

  const isDraw = winner === 'DRAW';
  const winnerName =
    winner === 'B'
      ? playerBlack.name
      : winner === 'W'
      ? playerWhite.name
      : 'Hòa Cờ';

  const isMeWinner =
    myColor && winner
      ? (winner === 'B' && myColor === 'B') || (winner === 'W' && myColor === 'W')
      : null;

  const total = blackCount + whiteCount || 1;
  const blackPercent = Math.round((blackCount / total) * 100);
  const whitePercent = 100 - blackPercent;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-[#FAF6EF] border-2 border-[#D5CCBC] rounded-2xl p-6 shadow-xl relative text-center text-[#1F1C19]"
      >
        {/* Seal stamp badge */}
        <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-xl bg-[#F0E8DC] border border-[#D5CCBC] shadow-xs mb-3 text-3xl">
          {isDraw ? '🤝' : <Trophy className="w-8 h-8 text-[#7A5432]" />}
        </div>

        {/* Title */}
        <h2 className="text-2xl font-black text-[#1F1C19]">
          {isDraw
            ? 'Trận Đấu Hòa Cờ'
            : isMeWinner === true
            ? 'Chiến Thắng!'
            : isMeWinner === false
            ? 'Kết Thúc Ván Cờ'
            : `${winnerName} Thắng`}
        </h2>

        <p className="text-xs text-[#665D52] mt-1 mb-5">
          {winReason ||
            (isDraw
              ? 'Hai kỳ thủ kết thúc với số quân ngang nhau'
              : `${winnerName} kiểm soát thế trận trên bàn cờ`)}
        </p>

        {/* Score comparison card */}
        <div className="bg-[#F2ECE0] rounded-xl p-4 border border-[#DDD3C2] mb-5">
          <div className="flex items-center justify-between mb-3">
            {/* Black player score */}
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-[#1F1C19] text-[#FAF7F0] border border-[#141210] flex items-center justify-center text-lg">
                {playerBlack.avatar}
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-[#1F1C19] truncate max-w-[100px]">
                  {playerBlack.name}
                </div>
                <div className="text-lg font-black text-[#1F1C19]">{blackCount}</div>
              </div>
            </div>

            <div className="text-[11px] font-bold text-[#6B635A] px-2 py-0.5 rounded bg-[#E5DEC8]">
              TỶ SỐ
            </div>

            {/* White player score */}
            <div className="flex items-center gap-2 flex-row-reverse text-right">
              <div className="w-9 h-9 rounded-lg bg-[#FCFAF5] text-[#1F1C19] border border-[#D5CCBC] flex items-center justify-center text-lg">
                {playerWhite.avatar}
              </div>
              <div>
                <div className="text-xs font-bold text-[#1F1C19] truncate max-w-[100px]">
                  {playerWhite.name}
                </div>
                <div className="text-lg font-black text-[#1F1C19]">{whiteCount}</div>
              </div>
            </div>
          </div>

          {/* Ratio bar */}
          <div className="w-full h-2.5 bg-[#DDD3C2] rounded-full overflow-hidden flex">
            <div
              className="h-full bg-[#1F1C19]"
              style={{ width: `${blackPercent}%` }}
              title={`Đen: ${blackPercent}%`}
            />
            <div
              className="h-full bg-[#FCFAF5]"
              style={{ width: `${whitePercent}%` }}
              title={`Trắng: ${whitePercent}%`}
            />
          </div>
          <div className="flex justify-between text-[11px] text-[#6B635A] mt-1 font-mono">
            <span>Quân Đen {blackPercent}%</span>
            <span>Quân Trắng {whitePercent}%</span>
          </div>
        </div>

        {/* Solid Action Buttons (NO gradients) */}
        <div className="flex flex-col gap-2">
          <button
            onClick={onRematch}
            className={`w-full py-2.5 px-4 font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 shadow-xs ${
              rematchRequested
                ? 'bg-[#2E6B34] text-white border border-[#235328]'
                : 'bg-[#24201D] hover:bg-[#36312C] text-[#FAF7F0] border border-[#161412]'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>
              {rematchRequested ? 'Đã gửi yêu cầu... (Chờ đối thủ)' : 'Tái Đấu Ván Mới'}
            </span>
          </button>

          <button
            onClick={onExit}
            className="w-full py-2 px-4 bg-[#EFE8DC] hover:bg-[#E5DECF] text-[#2C2723] border border-[#D5CCBC] font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span>Về Sảnh Chờ</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
