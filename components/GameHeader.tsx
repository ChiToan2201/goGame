'use client';

import React from 'react';
import { Volume2, VolumeX, HelpCircle, Flag, Share2, LogOut, RotateCcw } from 'lucide-react';
import { StoneColor } from '@/lib/game-engine';

interface PlayerCardProps {
  name: string;
  avatar: string;
  color: StoneColor;
  count: number;
  isActive: boolean;
  isMe: boolean;
  timeLeft?: number;
}

const PlayerCard: React.FC<PlayerCardProps> = ({
  name,
  avatar,
  color,
  count,
  isActive,
  isMe,
  timeLeft,
}) => {
  const isBlack = color === 'B';

  return (
    <div
      className={`relative flex items-center gap-2 sm:gap-3 p-2.5 rounded-xl border transition-colors ${
        isActive
          ? 'bg-[#FAF6EF] border-[#1F1C19] shadow-sm ring-1 ring-[#1F1C19]'
          : 'bg-[#F2ECE0]/90 border-[#D8CEBE] text-[#4A433B]'
      }`}
    >
      {/* Stone Icon & Avatar */}
      <div className="relative shrink-0">
        <div
          className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center text-xl shadow-xs border ${
            isBlack
              ? 'bg-[#1F1C19] text-[#FAF7F0] border-[#141210]'
              : 'bg-[#FCFAF5] text-[#1F1C19] border-[#D5CCBC]'
          }`}
        >
          {avatar}
        </div>
        {/* Stone color dot */}
        <div
          className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border border-[#D5CCBC] shadow-xs ${
            isBlack ? 'bg-[#1F1C19]' : 'bg-[#FAF7F0]'
          }`}
        />
      </div>

      {/* Info */}
      <div className="flex flex-col min-w-[70px] sm:min-w-[90px] flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-xs sm:text-sm text-[#1F1C19] truncate max-w-[90px] sm:max-w-[130px]">
            {name}
          </span>
          {isMe && (
            <span className="text-[10px] bg-[#A83226] text-white px-1.5 py-0.2 rounded font-medium">
              Bạn
            </span>
          )}
        </div>
        <div className="flex items-center justify-between text-xs mt-0.5">
          <span className="text-[#6B635A] text-[11px] font-medium">
            {isBlack ? 'Quân Đen' : 'Quân Trắng'}
          </span>
          <span
            className={`font-black text-sm sm:text-base px-1.5 py-0.2 rounded ${
              isActive
                ? isBlack
                  ? 'bg-[#1F1C19] text-[#FAF7F0]'
                  : 'bg-[#E5DEC8] text-[#1F1C19]'
                : 'text-[#4A433B]'
            }`}
          >
            {count}
          </span>
        </div>
      </div>

      {/* Turn timer countdown (45s max per turn) */}
      {isActive && timeLeft !== undefined && (
        <div className="ml-auto pl-1 sm:pl-2 text-right shrink-0">
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-xs font-bold border transition-colors ${
              timeLeft <= 10
                ? 'bg-[#FBEBE8] text-[#A83226] border-[#F2C2BB] animate-pulse font-black'
                : 'bg-[#EFE8DC] text-[#1F1C19] border-[#D5CCBC]'
            }`}
          >
            <span>⏱️</span>
            <span>{timeLeft}s</span>
          </div>
          {timeLeft <= 10 && (
            <div className="text-[9px] text-[#A83226] font-bold mt-0.5">
              {timeLeft === 0 ? 'Xử thua!' : 'Sắp hết giờ!'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface GameHeaderProps {
  playerBlack: { name: string; avatar: string };
  playerWhite: { name: string; avatar: string };
  blackCount: number;
  whiteCount: number;
  currentTurn: StoneColor;
  myColor: StoneColor | 'spectator' | null;
  modeLabel: string;
  roomCode?: string;
  timeLeft?: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenRules: () => void;
  onShareRoom?: () => void;
  onSurrender?: () => void;
  onExit: () => void;
  onRestartLocal?: () => void;
  isLocalMode?: boolean;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  playerBlack,
  playerWhite,
  blackCount,
  whiteCount,
  currentTurn,
  myColor,
  modeLabel,
  roomCode,
  timeLeft,
  soundEnabled,
  onToggleSound,
  onOpenRules,
  onShareRoom,
  onSurrender,
  onExit,
  onRestartLocal,
  isLocalMode,
}) => {
  return (
    <div className="w-full max-w-2xl mx-auto mb-2 flex flex-col gap-2">
      {/* Top Navbar Actions (Paper aesthetic, solid tactile buttons) */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#FAF6F0] rounded-xl border border-[#DDD3C2] text-sm shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={onExit}
            className="flex items-center gap-1 px-2.5 py-1 text-[#5C544B] hover:text-[#1F1C19] hover:bg-[#EFE8DC] rounded-lg transition-colors border border-transparent hover:border-[#D5CABB]"
            title="Thoát về sảnh"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-xs font-semibold hidden sm:inline">Rời trận</span>
          </button>
          <div className="h-4 w-[1px] bg-[#DDD3C2]" />
          <span className="text-xs font-semibold text-[#665D52]">
            {modeLabel}
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {roomCode && onShareRoom && (
            <button
              onClick={onShareRoom}
              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-[#A83226] hover:bg-[#93291F] text-white font-bold rounded-lg transition-colors shadow-xs"
              title="Chia sẻ mã phòng"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Mã: {roomCode}</span>
            </button>
          )}

          {isLocalMode && onRestartLocal && (
            <button
              onClick={onRestartLocal}
              className="p-1.5 text-[#5C544B] hover:text-[#1F1C19] hover:bg-[#EFE8DC] rounded-lg transition-colors border border-transparent hover:border-[#D5CABB]"
              title="Chơi lại ván mới"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {onSurrender && (
            <button
              onClick={onSurrender}
              className="p-1.5 text-[#A83226] hover:bg-[#FBEBE8] rounded-lg transition-colors border border-transparent hover:border-[#F2C2BB]"
              title="Xin nhận thua"
            >
              <Flag className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onToggleSound}
            className="p-1.5 text-[#5C544B] hover:text-[#1F1C19] hover:bg-[#EFE8DC] rounded-lg transition-colors border border-transparent hover:border-[#D5CABB]"
            title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-[#2E6B34]" />
            ) : (
              <VolumeX className="w-4 h-4 text-[#8C8478]" />
            )}
          </button>

          <button
            onClick={onOpenRules}
            className="p-1.5 text-[#5C544B] hover:text-[#1F1C19] hover:bg-[#EFE8DC] rounded-lg transition-colors border border-transparent hover:border-[#D5CABB]"
            title="Luật chơi cờ vây kẹp quân"
          >
            <HelpCircle className="w-4 h-4 text-[#8A5A2B]" />
          </button>
        </div>
      </div>

      {/* 45-Second Turn Countdown Progress Bar */}
      {timeLeft !== undefined && (
        <div className="w-full bg-[#E5DEC8] h-1.5 rounded-full overflow-hidden border border-[#D5CCBC]">
          <div
            className={`h-full transition-all duration-300 ease-linear ${
              timeLeft <= 10 ? 'bg-[#A83226]' : 'bg-[#1F1C19]'
            }`}
            style={{ width: `${Math.max(0, Math.min(100, (timeLeft / 45) * 100))}%` }}
          />
        </div>
      )}

      {/* Players Cards Banner */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <PlayerCard
          name={playerBlack.name}
          avatar={playerBlack.avatar}
          color="B"
          count={blackCount}
          isActive={currentTurn === 'B'}
          isMe={myColor === 'B'}
          timeLeft={currentTurn === 'B' ? timeLeft : undefined}
        />
        <PlayerCard
          name={playerWhite.name}
          avatar={playerWhite.avatar}
          color="W"
          count={whiteCount}
          isActive={currentTurn === 'W'}
          isMe={myColor === 'W'}
          timeLeft={currentTurn === 'W' ? timeLeft : undefined}
        />
      </div>
    </div>
  );
};
