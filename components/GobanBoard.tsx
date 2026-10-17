'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { BoardState, StoneColor, Position, getFlippedStones } from '@/lib/game-engine';

interface GobanBoardProps {
  board: BoardState;
  currentTurn: StoneColor;
  myColor: StoneColor | 'spectator' | null;
  validMoves: { pos: Position; flippedCount: number }[];
  lastMove: { r: number; c: number; player: StoneColor } | null;
  lastFlipped: Position[];
  isMyTurn: boolean;
  disabled?: boolean;
  onMakeMove: (r: number, c: number) => void;
}

const COL_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const ROW_LABELS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export const GobanBoard: React.FC<GobanBoardProps> = ({
  board,
  currentTurn,
  myColor,
  lastMove,
  lastFlipped,
  isMyTurn,
  disabled = false,
  onMakeMove,
}) => {
  const size = board.length;
  const [hoveredCell, setHoveredCell] = useState<Position | null>(null);

  // Star points (Hoshi) on 8x8 Go board
  const isHoshi = (r: number, c: number) => {
    return (
      (r === 2 && c === 2) ||
      (r === 2 && c === 5) ||
      (r === 5 && c === 2) ||
      (r === 5 && c === 5)
    );
  };

  // Preview flipped stones on hover
  const previewFlips: Position[] =
    hoveredCell && isMyTurn && !disabled
      ? getFlippedStones(
          board,
          hoveredCell.r,
          hoveredCell.c,
          myColor === 'spectator' || !myColor ? currentTurn : myColor
        )
      : [];

  const handleCellClick = (r: number, c: number) => {
    if (disabled || !isMyTurn) return;
    if (board[r][c] === null) {
      onMakeMove(r, c);
      setHoveredCell(null);
    }
  };

  return (
    <div className="w-full flex items-center justify-center select-none py-1">
      {/* 
        Kaya Wood Goban Board on Paper Desk
        Strictly fixed 1:1 square aspect ratio.
      */}
      <div
        className="w-full max-w-[420px] sm:max-w-[440px] aspect-square rounded-xl p-2.5 sm:p-3.5 shadow-md border-2 border-[#5C3A1A] relative flex flex-col justify-between"
        style={{
          backgroundColor: '#D9AA6B',
          backgroundImage: `
            radial-gradient(circle at 50% 50%, rgba(255,255,255,0.08) 0%, transparent 80%),
            repeating-linear-gradient(90deg, rgba(90,45,10,0.04) 0px, rgba(90,45,10,0.04) 1px, transparent 1px, transparent 14px)
          `,
          boxShadow: '0 6px 16px rgba(45, 30, 15, 0.2), inset 0 1px 2px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.2)',
        }}
      >
        {/* 10x10 Grid System: Exactly 1 row top for cols, 1 row bottom for cols, 1 col left for rows, 1 col right for rows, and 8x8 in center */}
        <div className="relative w-full h-full aspect-square grid grid-cols-[18px_repeat(8,1fr)_18px] sm:grid-cols-[22px_repeat(8,1fr)_22px] grid-rows-[18px_repeat(8,1fr)_18px] sm:grid-rows-[22px_repeat(8,1fr)_22px] rounded-lg bg-[#E2B97E] border border-[#6B4420] shadow-inner overflow-hidden">
          
          {/* Top-Left Corner */}
          <div className="flex items-center justify-center text-[10px] text-[#6B4420]/50 font-mono">·</div>

          {/* Top Column Labels (A-H) */}
          {COL_LABELS.slice(0, size).map((col) => (
            <div
              key={`top-${col}`}
              className="flex items-center justify-center text-[10px] sm:text-xs font-semibold text-[#4A2D13] font-mono"
            >
              {col}
            </div>
          ))}

          {/* Top-Right Corner */}
          <div className="flex items-center justify-center text-[10px] text-[#6B4420]/50 font-mono">·</div>

          {/* Rows 0 to 7 */}
          {board.map((row, r) => (
            <React.Fragment key={`row-${r}`}>
              {/* Left Row Label (8..1) */}
              <div className="flex items-center justify-center text-[10px] sm:text-xs font-semibold text-[#4A2D13] font-mono">
                {ROW_LABELS[r]}
              </div>

              {/* 8 Intersections in this row */}
              {row.map((cell, c) => {
                const isHovered = hoveredCell?.r === r && hoveredCell?.c === c;
                const isJustPlaced = lastMove?.r === r && lastMove?.c === c;
                const isJustFlipped = lastFlipped.some((f) => f.r === r && f.c === c);
                const isWillFlip = previewFlips.some((p) => p.r === r && p.c === c);

                return (
                  <div
                    key={`cell-${r}-${c}`}
                    className="relative w-full h-full aspect-square flex items-center justify-center cursor-pointer overflow-visible"
                    onClick={() => handleCellClick(r, c)}
                    onMouseEnter={() => setHoveredCell({ r, c })}
                    onMouseLeave={() => setHoveredCell(null)}
                  >
                    {/* Horizontal Go Grid Line */}
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 h-[1px] bg-[#422610] pointer-events-none ${
                        c === 0 ? 'left-1/2 right-0' : c === size - 1 ? 'left-0 right-1/2' : 'left-0 right-0'
                      }`}
                    />

                    {/* Vertical Go Grid Line */}
                    <div
                      className={`absolute left-1/2 -translate-x-1/2 w-[1px] bg-[#422610] pointer-events-none ${
                        r === 0 ? 'top-1/2 bottom-0' : r === size - 1 ? 'top-0 bottom-1/2' : 'top-0 bottom-0'
                      }`}
                    />

                    {/* Hoshi / Star Point Dot */}
                    {isHoshi(r, c) && (
                      <div className="absolute w-2 h-2 rounded-full bg-[#3B220E] pointer-events-none z-0" />
                    )}

                    {/* Preview Ghost Stone on Hover on ANY empty cell */}
                    {isHovered && isMyTurn && !disabled && !cell && (
                      <div
                        className={`absolute w-[80%] h-[80%] rounded-full opacity-40 z-20 pointer-events-none ${
                          (myColor === 'B' || (!myColor && currentTurn === 'B'))
                            ? 'bg-[#1C1A18] border border-[#1C1A18]'
                            : 'bg-[#FAF7F0] border border-[#8C8478]'
                        }`}
                      />
                    )}

                    {/* Actual Placed Go Stone */}
                    {cell && (
                      <div
                        className={`absolute w-[82%] h-[82%] rounded-full z-20 flex items-center justify-center pointer-events-none ${
                          isWillFlip ? 'ring-2 ring-[#A83226]' : ''
                        }`}
                      >
                        <StoneView
                          color={cell}
                          isJustPlaced={isJustPlaced}
                          isJustFlipped={isJustFlipped}
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Right Row Label (8..1) */}
              <div className="flex items-center justify-center text-[10px] sm:text-xs font-semibold text-[#4A2D13] font-mono">
                {ROW_LABELS[r]}
              </div>
            </React.Fragment>
          ))}

          {/* Bottom-Left Corner */}
          <div className="flex items-center justify-center text-[10px] text-[#6B4420]/50 font-mono">·</div>

          {/* Bottom Column Labels (A-H) */}
          {COL_LABELS.slice(0, size).map((col) => (
            <div
              key={`bottom-${col}`}
              className="flex items-center justify-center text-[10px] sm:text-xs font-semibold text-[#4A2D13] font-mono"
            >
              {col}
            </div>
          ))}

          {/* Bottom-Right Corner */}
          <div className="flex items-center justify-center text-[10px] text-[#6B4420]/50 font-mono">·</div>
        </div>
      </div>
    </div>
  );
};

interface StoneViewProps {
  color: StoneColor;
  isJustPlaced: boolean;
  isJustFlipped: boolean;
}

const StoneView: React.FC<StoneViewProps> = ({ color, isJustPlaced, isJustFlipped }) => {
  const isBlack = color === 'B';

  return (
    <motion.div
      initial={isJustPlaced ? { scale: 0.6, opacity: 0 } : false}
      animate={
        isJustFlipped
          ? {
              scale: [1, 0.75, 1],
              opacity: [1, 0.9, 1],
            }
          : { scale: 1, opacity: 1 }
      }
      transition={{ duration: 0.28, ease: 'easeInOut' }}
      className={`w-full h-full rounded-full relative flex items-center justify-center shrink-0 ${
        isBlack
          ? 'bg-[#1E1B18] shadow-[1px_2px_4px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] border border-[#141210]'
          : 'bg-[#F9F6F0] shadow-[1px_2px_4px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.9),inset_0_-1px_1px_rgba(0,0,0,0.1)] border border-[#D5CDBC]'
      }`}
    >
      {/* Subtle specular glint */}
      <div
        className={`absolute top-1 left-1.5 w-2 sm:w-2.5 h-1 sm:h-1.5 rounded-full pointer-events-none ${
          isBlack ? 'bg-white/20' : 'bg-white/80'
        }`}
      />

      {/* Red seal marker on newly placed stone */}
      {isJustPlaced && (
        <span
          className={`w-1.5 h-1.5 rounded-full absolute ${
            isBlack ? 'bg-[#D14334]' : 'bg-[#A83226]'
          }`}
        />
      )}
    </motion.div>
  );
};
