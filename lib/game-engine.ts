export type StoneColor = 'B' | 'W';
export type CellState = StoneColor | null;
export type BoardState = CellState[][];

export interface Position {
  r: number;
  c: number;
}

export interface MoveResult {
  valid: boolean;
  flipped: Position[];
  newBoard: BoardState;
  nextColor: StoneColor;
  isGameOver: boolean;
  winner: StoneColor | 'DRAW' | null;
  blackCount: number;
  whiteCount: number;
}

export const BOARD_SIZE = 8;

// Direction vectors (8 directions: horizontal, vertical, diagonal)
export const DIRECTIONS: [number, number][] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

// Positional weight table for 8x8 Go/Reversi board (corners are supreme)
export const POSITION_WEIGHTS: number[][] = [
  [ 120, -15,  20,   5,   5,  20, -15,  120 ],
  [ -15, -30,  -5,  -5,  -5,  -5, -30,  -15 ],
  [  20,  -5,  15,   3,   3,  15,  -5,   20 ],
  [   5,  -5,   3,   3,   3,   3,  -5,    5 ],
  [   5,  -5,   3,   3,   3,   3,  -5,    5 ],
  [  20,  -5,  15,   3,   3,  15,  -5,   20 ],
  [ -15, -30,  -5,  -5,  -5,  -5, -30,  -15 ],
  [ 120, -15,  20,   5,   5,  20, -15,  120 ],
];

/**
 * Creates initial 8x8 board with 4 center stones (2 Black, 2 White arranged diagonally)
 */
export function createInitialBoard(size = BOARD_SIZE): BoardState {
  const board: BoardState = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null)
  );

  const mid = size / 2;
  // Center 4 stones (2 White, 2 Black)
  board[mid - 1][mid - 1] = 'W';
  board[mid - 1][mid] = 'B';
  board[mid][mid - 1] = 'B';
  board[mid][mid] = 'W';

  return board;
}

/**
 * Deep copy of a board
 */
export function cloneBoard(board: BoardState): BoardState {
  return board.map((row) => [...row]);
}

/**
 * Get the opponent color
 */
export function getOpponent(color: StoneColor): StoneColor {
  return color === 'B' ? 'W' : 'B';
}

/**
 * Check if coordinate is inside board boundaries
 */
export function isInBounds(r: number, c: number, size = BOARD_SIZE): boolean {
  return r >= 0 && r < size && c >= 0 && c < size;
}

/**
 * Find all opponent stones that will be flipped if stone is placed at (r, c)
 * If flanked on both ends along horizontal, vertical, or diagonal line.
 */
export function getFlippedStones(
  board: BoardState,
  r: number,
  c: number,
  color: StoneColor
): Position[] {
  const size = board.length;
  if (!isInBounds(r, c, size) || board[r][c] !== null) {
    return [];
  }

  const opponent = getOpponent(color);
  const totalFlipped: Position[] = [];

  for (const [dr, dc] of DIRECTIONS) {
    let curR = r + dr;
    let curC = c + dc;
    const candidates: Position[] = [];

    // Walk in direction while finding opponent stones
    while (isInBounds(curR, curC, size) && board[curR][curC] === opponent) {
      candidates.push({ r: curR, c: curC });
      curR += dr;
      curC += dc;
    }

    // If bounded at the far end by a stone of our own color, these candidates are flanked!
    if (
      candidates.length > 0 &&
      isInBounds(curR, curC, size) &&
      board[curR][curC] === color
    ) {
      totalFlipped.push(...candidates);
    }
  }

  return totalFlipped;
}

/**
 * Check if a move at (r, c) is valid.
 * Free placement rule: player can place on ANY empty cell in bounds!
 */
export function isValidMove(
  board: BoardState,
  r: number,
  c: number
): boolean {
  return isInBounds(r, c, board.length) && board[r][c] === null;
}

/**
 * Get all available moves for a player.
 * In free placement, all empty cells are valid.
 * Also computes flippedCount for tactical hints and AI evaluation.
 */
export function getValidMoves(
  board: BoardState,
  color: StoneColor
): { pos: Position; flippedCount: number }[] {
  const size = board.length;
  const moves: { pos: Position; flippedCount: number }[] = [];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === null) {
        const flipped = getFlippedStones(board, r, c, color);
        moves.push({ pos: { r, c }, flippedCount: flipped.length });
      }
    }
  }

  return moves;
}

/**
 * Count current stones on the board
 */
export function countStones(board: BoardState): {
  black: number;
  white: number;
  empty: number;
} {
  let black = 0;
  let white = 0;
  let empty = 0;

  for (const row of board) {
    for (const cell of row) {
      if (cell === 'B') black++;
      else if (cell === 'W') white++;
      else empty++;
    }
  }

  return { black, white, empty };
}

/**
 * Execute a move on the board (Free placement mode).
 * Player places stone on any empty cell (r, c).
 * If 1 or more opponent stones are flanked in any direction, they are converted!
 */
export function applyMove(
  board: BoardState,
  r: number,
  c: number,
  color: StoneColor
): MoveResult | null {
  const size = board.length;
  if (!isInBounds(r, c, size) || board[r][c] !== null) {
    return null; // Cell occupied or out of bounds
  }

  // Calculate any flanked opponent stones
  const flipped = getFlippedStones(board, r, c, color);

  // Apply move and flips
  const newBoard = cloneBoard(board);
  newBoard[r][c] = color;
  for (const pos of flipped) {
    newBoard[pos.r][pos.c] = color;
  }

  const { black, white, empty } = countStones(newBoard);
  const opponent = getOpponent(color);

  // Game over when board is completely full or one side is wiped out
  let isGameOver = empty === 0 || black === 0 || white === 0;
  let winner: StoneColor | 'DRAW' | null = null;

  if (isGameOver) {
    if (black > white) winner = 'B';
    else if (white > black) winner = 'W';
    else winner = 'DRAW';
  }

  return {
    valid: true,
    flipped,
    newBoard,
    nextColor: opponent,
    isGameOver,
    winner,
    blackCount: black,
    whiteCount: white,
  };
}

// ----------------- AI ALGORITHMS -----------------

export type AIDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Evaluates candidate moves for AI based on flips, positional advantage and proximity to other stones
 */
function scoreAIMove(
  board: BoardState,
  r: number,
  c: number,
  color: StoneColor,
  flippedCount: number
): number {
  const size = board.length;
  let score = 0;

  // Huge bonus for flipping opponent stones
  if (flippedCount > 0) {
    score += flippedCount * 25 + 30;
  }

  // Positional weight (corners are high priority)
  score += POSITION_WEIGHTS[r]?.[c] ?? 0;

  // Prefer moves that are adjacent to existing stones (tactical clustering)
  let adjacentStones = 0;
  for (const [dr, dc] of DIRECTIONS) {
    const nr = r + dr;
    const nc = c + dc;
    if (isInBounds(nr, nc, size) && board[nr][nc] !== null) {
      adjacentStones++;
    }
  }
  score += adjacentStones * 4;

  return score;
}

/**
 * AI move selector with 3 levels of intelligence
 */
export function getAIMove(
  board: BoardState,
  aiColor: StoneColor,
  difficulty: AIDifficulty = 'medium'
): Position | null {
  const allMoves = getValidMoves(board, aiColor);
  if (allMoves.length === 0) return null;

  // Filter moves that have flips
  const flippingMoves = allMoves.filter((m) => m.flippedCount > 0);

  if (difficulty === 'easy') {
    // 60% random empty cell, 40% flipping move if available
    if (flippingMoves.length > 0 && Math.random() < 0.4) {
      const idx = Math.floor(Math.random() * flippingMoves.length);
      return flippingMoves[idx].pos;
    }
    const randomIdx = Math.floor(Math.random() * allMoves.length);
    return allMoves[randomIdx].pos;
  }

  // Score all moves
  const scoredMoves = allMoves.map((m) => ({
    pos: m.pos,
    flippedCount: m.flippedCount,
    score: scoreAIMove(board, m.pos.r, m.pos.c, aiColor, m.flippedCount),
  }));

  scoredMoves.sort((a, b) => b.score - a.score);

  if (difficulty === 'medium') {
    // Top 3 moves with slight temperature randomization
    const topChoices = scoredMoves.slice(0, Math.min(3, scoredMoves.length));
    return topChoices[Math.floor(Math.random() * topChoices.length)].pos;
  }

  // HARD: Top candidate with lookahead
  if (scoredMoves.length <= 1) return scoredMoves[0].pos;

  // Lookahead 1-ply: pick move that minimizes opponent's best response
  const candidates = scoredMoves.slice(0, Math.min(6, scoredMoves.length));
  let bestCandidate = candidates[0].pos;
  let bestNet = -Infinity;
  const oppColor = getOpponent(aiColor);

  for (const cand of candidates) {
    const res = applyMove(board, cand.pos.r, cand.pos.c, aiColor);
    if (!res) continue;

    // Check opponent's best possible flip count
    const oppMoves = getValidMoves(res.newBoard, oppColor);
    let maxOppFlip = 0;
    for (const om of oppMoves) {
      if (om.flippedCount > maxOppFlip) maxOppFlip = om.flippedCount;
    }

    const netScore = cand.score - maxOppFlip * 20;
    if (netScore > bestNet) {
      bestNet = netScore;
      bestCandidate = cand.pos;
    }
  }

  return bestCandidate;
}

// ----------------- SYNTHESIZED SOUND EFFECTS (WEB AUDIO) -----------------

class SoundSystem {
  private ctx: AudioContext | null = null;
  public soundEnabled: boolean = true;

  private initCtx() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Realistic Go stone click against wooden board
  playStoneClack() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.initCtx();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(800, now);
      osc1.frequency.exponentialRampToValueAtTime(140, now + 0.04);
      gain1.gain.setValueAtTime(0.4, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(220, now);
      osc2.frequency.exponentialRampToValueAtTime(80, now + 0.08);
      gain2.gain.setValueAtTime(0.3, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.05);
      osc2.start(now);
      osc2.stop(now + 0.09);
    } catch {
      // AudioContext policy safe catch
    }
  }

  // Subtle flipper click when stones flip
  playFlipStone(count = 1) {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.initCtx();
      if (!ctx) return;

      const numSounds = Math.min(count, 5);
      for (let i = 0; i < numSounds; i++) {
        const delay = i * 0.035;
        const now = ctx.currentTime + delay;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(500 + i * 80, now);
        osc.frequency.exponentialRampToValueAtTime(250, now + 0.03);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.035);
      }
    } catch {
      // AudioContext policy safe catch
    }
  }

  // Celebratory victory fan-fare
  playVictory() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.initCtx();
      if (!ctx) return;

      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((freq, idx) => {
        const now = ctx.currentTime + idx * 0.12;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.4);
      });
    } catch {
      // AudioContext policy safe catch
    }
  }

  // Turn alert sound
  playTurnAlert() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // AudioContext policy safe catch
    }
  }

  // Soft warning thump for invalid attempt
  playInvalid() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.1);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.13);
    } catch {
      // safe catch
    }
  }
}

export const sounds = new SoundSystem();
