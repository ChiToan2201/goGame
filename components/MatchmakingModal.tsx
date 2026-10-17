'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, Users, Bot, X } from 'lucide-react';

interface MatchmakingModalProps {
  isOpen: boolean;
  playerName: string;
  avatar: string;
  onCancel: () => void;
  onPlayWithBot: () => void;
}

export const MatchmakingModal: React.FC<MatchmakingModalProps> = ({
  isOpen,
  playerName,
  avatar,
  onCancel,
  onPlayWithBot,
}) => {
  if (!isOpen) return null;

  return (
    <MatchmakingModalContent
      playerName={playerName}
      avatar={avatar}
      onCancel={onCancel}
      onPlayWithBot={onPlayWithBot}
    />
  );
};

interface ContentProps {
  playerName: string;
  avatar: string;
  onCancel: () => void;
  onPlayWithBot: () => void;
}

const MatchmakingModalContent: React.FC<ContentProps> = ({
  playerName,
  avatar,
  onCancel,
  onPlayWithBot,
}) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-[#FAF6EF] border-2 border-[#D5CCBC] rounded-2xl p-6 shadow-xl relative text-[#1F1C19]"
      >
        {/* Close Button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 text-[#6B635A] hover:text-[#1F1C19] hover:bg-[#EFE8DC] rounded-lg transition-colors border border-transparent hover:border-[#D5CCBC]"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Pulse Radar Animation on Paper */}
        <div className="flex flex-col items-center justify-center my-4">
          <div className="relative flex items-center justify-center w-24 h-24">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[#E5DEC8] animate-ping opacity-60" />
            <span className="absolute inline-flex h-16 w-16 rounded-full bg-[#E5DEC8] opacity-80" />
            <div className="relative z-10 w-14 h-14 rounded-xl bg-[#FAF6EF] border-2 border-[#1F1C19] flex items-center justify-center text-2xl shadow-xs">
              {avatar}
            </div>
          </div>

          <h3 className="mt-3 text-lg font-bold text-[#1F1C19] flex items-center gap-2">
            <span>Đang tìm đối thủ</span>
            <Loader2 className="w-4 h-4 animate-spin text-[#5C544B]" />
          </h3>
          <p className="text-xs text-[#6B635A] mt-1">
            Kỳ thủ: <span className="text-[#1F1C19] font-bold">{playerName}</span>
          </p>

          <div className="mt-3 px-3 py-1 rounded-md bg-[#EFE8DC] text-[#4A433B] font-mono text-xs border border-[#D5CCBC]">
            Thời gian: {seconds}s
          </div>
        </div>

        {/* Informative Tips */}
        <div className="p-3 bg-[#F2ECE0] rounded-xl border border-[#DDD3C2] text-xs text-[#4A433B] space-y-1 mb-5">
          <div className="flex items-center gap-1.5 text-[#1F1C19] font-bold">
            <Users className="w-3.5 h-3.5 text-[#7A5432]" /> Mẹo thi đấu:
          </div>
          <p>
            Các góc bàn cờ (A1, A8, H1, H8) là vị trí kiên cố nhất vì đối thủ không bao giờ kẹp lật lại được!
          </p>
        </div>

        {/* Solid Action Buttons (NO gradients) */}
        <div className="flex flex-col gap-2">
          {seconds >= 6 && (
            <button
              onClick={onPlayWithBot}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#24201D] hover:bg-[#36312C] text-[#FAF7F0] font-bold text-xs rounded-xl transition-colors border border-[#161412] shadow-xs"
            >
              <Bot className="w-4 h-4" />
              <span>Ghép ngay với AI Cao Thủ</span>
            </button>
          )}

          <button
            onClick={onCancel}
            className="w-full py-2 px-4 bg-[#EFE8DC] hover:bg-[#E5DECF] text-[#2C2723] border border-[#D5CCBC] font-semibold text-xs rounded-xl transition-colors"
          >
            Hủy tìm kiếm
          </button>
        </div>
      </motion.div>
    </div>
  );
};
