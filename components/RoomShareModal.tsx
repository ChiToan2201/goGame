'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Copy, Check, Share2, Link as LinkIcon } from 'lucide-react';

interface RoomShareModalProps {
  isOpen: boolean;
  roomCode: string;
  onClose: () => void;
}

export const RoomShareModal: React.FC<RoomShareModalProps> = ({
  isOpen,
  roomCode,
  onClose,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const roomLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}?room=${roomCode}`
      : `?room=${roomCode}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(roomLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-[#FAF6EF] border-2 border-[#D5CCBC] rounded-2xl p-6 shadow-xl relative text-[#1F1C19]"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[#6B635A] hover:text-[#1F1C19] hover:bg-[#EFE8DC] rounded-lg transition-colors border border-transparent hover:border-[#D5CCBC]"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-[#A83226] mb-1.5">
          <Share2 className="w-5 h-5" />
          <h3 className="text-lg font-bold text-[#1F1C19]">Mời Bạn Cùng Chơi</h3>
        </div>
        <p className="text-xs text-[#6B635A] mb-4">
          Gửi mã phòng hoặc liên kết bên dưới để bạn bè có thể tham gia vào trận đấu!
        </p>

        {/* Big Room Code Box */}
        <div className="bg-[#F2ECE0] rounded-xl p-4 border border-[#DDD3C2] text-center mb-4">
          <span className="text-[11px] text-[#6B635A] block mb-1 uppercase font-semibold">
            Mã phòng thi đấu
          </span>
          <div className="text-3xl sm:text-4xl font-mono font-black tracking-widest text-[#1F1C19] select-all">
            {roomCode}
          </div>
          <button
            onClick={handleCopyCode}
            className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#A83226] hover:bg-[#93291F] text-white text-xs font-bold transition-colors border border-[#7A2118] shadow-xs"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? 'Đã sao chép mã!' : 'Sao chép mã phòng'}</span>
          </button>
        </div>

        {/* Link Share Box */}
        <div className="bg-[#F2ECE0] rounded-xl p-3 border border-[#DDD3C2] mb-5">
          <div className="text-xs text-[#6B635A] mb-1.5 flex items-center gap-1">
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Liên kết tham gia trực tiếp:</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={roomLink}
              className="bg-[#FAF6EF] text-[#1F1C19] text-xs px-2.5 py-1.5 rounded-lg border border-[#D5CCBC] flex-1 truncate select-all"
            />
            <button
              onClick={handleCopyLink}
              className="p-1.5 bg-[#EFE8DC] hover:bg-[#E5DECF] text-[#2C2723] border border-[#D5CCBC] rounded-lg transition-colors"
              title="Sao chép liên kết"
            >
              {copiedLink ? <Check className="w-4 h-4 text-[#2E6B34]" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 bg-[#EFE8DC] hover:bg-[#E5DECF] text-[#2C2723] border border-[#D5CCBC] text-xs font-semibold rounded-xl transition-colors"
        >
          Đóng cửa sổ
        </button>
      </motion.div>
    </div>
  );
};
