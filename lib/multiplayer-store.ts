import {
  BoardState,
  createInitialBoard,
  applyMove,
  countStones,
  StoneColor,
  Position,
} from './game-engine';
import { db } from './firebase';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';

export interface PlayerInfo {
  id: string;
  name: string;
  avatar: string;
  connected: boolean;
  lastHeartbeat: number;
  rematchRequested?: boolean;
}

export interface MoveLog {
  player: StoneColor;
  r: number;
  c: number;
  flippedCount: number;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  senderName: string;
  senderId: string;
  color?: StoneColor;
  text: string;
  time: string;
}

export interface GameRoom {
  id: string;
  isPrivate: boolean;
  createdAt: number;
  lastActive: number;
  status: 'waiting' | 'playing' | 'ended';
  playerBlack: PlayerInfo | null;
  playerWhite: PlayerInfo | null;
  spectators: PlayerInfo[];
  board: BoardState;
  currentTurn: StoneColor;
  isGameOver: boolean;
  winner: StoneColor | 'DRAW' | null;
  winReason?: string;
  blackCount: number;
  whiteCount: number;
  moveHistory: MoveLog[];
  lastMove: { r: number; c: number; player: StoneColor } | null;
  lastFlipped: Position[];
  chatMessages: ChatMessage[];
  turnStartTime: number;
  turnDurationSeconds: number;
}

export interface QueuedPlayer {
  playerId: string;
  playerName: string;
  avatar: string;
  joinedAt: number;
  status?: 'waiting' | 'matched';
  assignedRoomId?: string;
}

// In-memory L1 cache inside current Node.js process
declare global {
  var __FLANK_GAME_ROOMS: Map<string, GameRoom> | undefined;
  var __FLANK_MATCH_QUEUE: QueuedPlayer[] | undefined;
}

if (!globalThis.__FLANK_GAME_ROOMS) {
  globalThis.__FLANK_GAME_ROOMS = new Map<string, GameRoom>();
}
if (!globalThis.__FLANK_MATCH_QUEUE) {
  globalThis.__FLANK_MATCH_QUEUE = [];
}

const localRooms = globalThis.__FLANK_GAME_ROOMS;

// Helper: Convert GameRoom to Firestore document representation
// (Firestore forbids nested arrays like BoardState `(StoneColor | null)[][]`)
function toFirestoreData(room: GameRoom): Record<string, any> {
  const { board, ...rest } = room;
  return {
    ...rest,
    boardStr: JSON.stringify(board),
  };
}

// Helper: Convert Firestore doc back to GameRoom
function fromFirestoreData(data: any): GameRoom {
  let parsedBoard: BoardState;
  try {
    parsedBoard = data.boardStr ? JSON.parse(data.boardStr) : (data.board || createInitialBoard(8));
  } catch {
    parsedBoard = createInitialBoard(8);
  }

  return {
    id: data.id,
    isPrivate: data.isPrivate ?? false,
    createdAt: data.createdAt ?? Date.now(),
    lastActive: data.lastActive ?? Date.now(),
    status: data.status ?? 'waiting',
    playerBlack: data.playerBlack ?? null,
    playerWhite: data.playerWhite ?? null,
    spectators: data.spectators ?? [],
    board: parsedBoard,
    currentTurn: data.currentTurn ?? 'B',
    isGameOver: data.isGameOver ?? false,
    winner: data.winner ?? null,
    winReason: data.winReason,
    blackCount: data.blackCount ?? 2,
    whiteCount: data.whiteCount ?? 2,
    moveHistory: Array.isArray(data.moveHistory) ? data.moveHistory : [],
    lastMove: data.lastMove ?? null,
    lastFlipped: Array.isArray(data.lastFlipped) ? data.lastFlipped : [],
    chatMessages: Array.isArray(data.chatMessages) ? data.chatMessages : [],
    turnStartTime: data.turnStartTime ?? Date.now(),
    turnDurationSeconds: data.turnDurationSeconds ?? 45,
  };
}

// Persist room to Firestore
async function persistRoom(room: GameRoom): Promise<void> {
  try {
    localRooms.set(room.id, room);
    await setDoc(doc(db, 'rooms', room.id), toFirestoreData(room));
  } catch (err) {
    console.error('Firestore persistRoom error:', err);
  }
}

// Fetch room from Firestore
async function fetchRoom(roomId: string): Promise<GameRoom | null> {
  try {
    const snap = await getDoc(doc(db, 'rooms', roomId));
    if (snap.exists()) {
      const room = fromFirestoreData(snap.data());
      localRooms.set(roomId, room);
      return room;
    }
  } catch (err) {
    console.error('Firestore fetchRoom error:', err);
  }
  return localRooms.get(roomId) || null;
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const multiplayerStore = {
  // Create room
  async createRoomAsync(
    hostPlayer: { id: string; name: string; avatar?: string },
    isPrivate = false,
    customCode?: string
  ): Promise<GameRoom> {
    const roomId = customCode ? customCode.toUpperCase() : generateCode();
    const initialBoard = createInitialBoard(8);
    const counts = countStones(initialBoard);

    const hostInfo: PlayerInfo = {
      id: hostPlayer.id,
      name: hostPlayer.name.trim() || 'Người chơi 1',
      avatar: hostPlayer.avatar || '🏮',
      connected: true,
      lastHeartbeat: Date.now(),
    };

    const room: GameRoom = {
      id: roomId,
      isPrivate,
      createdAt: Date.now(),
      lastActive: Date.now(),
      status: 'waiting',
      playerBlack: hostInfo,
      playerWhite: null,
      spectators: [],
      board: initialBoard,
      currentTurn: 'B',
      isGameOver: false,
      winner: null,
      blackCount: counts.black,
      whiteCount: counts.white,
      moveHistory: [],
      lastMove: null,
      lastFlipped: [],
      chatMessages: [
        {
          id: 'welcome',
          senderName: 'Hệ Thống',
          senderId: 'sys',
          text: `Phòng ${roomId} đã được tạo! Đang chờ đối thủ...`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ],
      turnStartTime: Date.now(),
      turnDurationSeconds: 45,
    };

    await persistRoom(room);
    return room;
  },

  createRoom(
    hostPlayer: { id: string; name: string; avatar?: string },
    isPrivate = false,
    customCode?: string
  ): GameRoom {
    const roomId = customCode ? customCode.toUpperCase() : generateCode();
    const initialBoard = createInitialBoard(8);
    const counts = countStones(initialBoard);

    const hostInfo: PlayerInfo = {
      id: hostPlayer.id,
      name: hostPlayer.name.trim() || 'Người chơi 1',
      avatar: hostPlayer.avatar || '🏮',
      connected: true,
      lastHeartbeat: Date.now(),
    };

    const room: GameRoom = {
      id: roomId,
      isPrivate,
      createdAt: Date.now(),
      lastActive: Date.now(),
      status: 'waiting',
      playerBlack: hostInfo,
      playerWhite: null,
      spectators: [],
      board: initialBoard,
      currentTurn: 'B',
      isGameOver: false,
      winner: null,
      blackCount: counts.black,
      whiteCount: counts.white,
      moveHistory: [],
      lastMove: null,
      lastFlipped: [],
      chatMessages: [
        {
          id: 'welcome',
          senderName: 'Hệ Thống',
          senderId: 'sys',
          text: `Phòng ${roomId} đã được tạo! Đang chờ đối thủ...`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ],
      turnStartTime: Date.now(),
      turnDurationSeconds: 45,
    };

    persistRoom(room);
    return room;
  },

  // Get room
  async getRoomAsync(roomId: string): Promise<GameRoom | null> {
    const cleanId = roomId.toUpperCase();
    const room = await fetchRoom(cleanId);
    if (!room) return null;

    // Check timer expiration if playing
    const now = Date.now();
    if (room.status === 'playing' && !room.isGameOver) {
      const elapsedSeconds = (now - room.turnStartTime) / 1000;
      if (elapsedSeconds > room.turnDurationSeconds) {
        await this.surrenderAsync(cleanId, room.currentTurn === 'B' ? (room.playerBlack?.id || '') : (room.playerWhite?.id || ''));
        return localRooms.get(cleanId) || room;
      }
    }

    return room;
  },

  getRoom(roomId: string): GameRoom | null {
    const cleanId = roomId.toUpperCase();
    return localRooms.get(cleanId) || null;
  },

  // Join room
  async joinRoomAsync(
    roomId: string,
    player: { id: string; name: string; avatar?: string }
  ): Promise<{ room: GameRoom; role: 'B' | 'W' | 'spectator' } | { error: string }> {
    const cleanId = roomId.toUpperCase();
    let room = await fetchRoom(cleanId);
    if (!room) {
      return { error: 'Không tìm thấy phòng với mã này' };
    }

    const now = Date.now();
    room.lastActive = now;

    // Check if player is already registered in this room
    if (room.playerBlack?.id === player.id) {
      room.playerBlack.connected = true;
      room.playerBlack.lastHeartbeat = now;
      await persistRoom(room);
      return { room, role: 'B' };
    }
    if (room.playerWhite?.id === player.id) {
      room.playerWhite.connected = true;
      room.playerWhite.lastHeartbeat = now;
      await persistRoom(room);
      return { room, role: 'W' };
    }

    const pInfo: PlayerInfo = {
      id: player.id,
      name: player.name.trim() || 'Người chơi 2',
      avatar: player.avatar || '⚔️',
      connected: true,
      lastHeartbeat: now,
    };

    // If white is empty (standard for guests joining host's room)
    if (!room.playerWhite) {
      room.playerWhite = pInfo;
      room.status = 'playing';
      room.turnStartTime = now;
      if (room.playerBlack) {
        room.playerBlack.lastHeartbeat = now;
        room.playerBlack.connected = true;
      }
      room.playerWhite.lastHeartbeat = now;
      room.playerWhite.connected = true;

      room.chatMessages.push({
        id: `join-${now}`,
        senderName: 'Hệ Thống',
        senderId: 'sys',
        text: `${pInfo.name} đã tham gia với tư cách Quân Trắng! Trận đấu bắt đầu!`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });

      await persistRoom(room);
      return { room, role: 'W' };
    }

    // If black is empty
    if (!room.playerBlack) {
      room.playerBlack = pInfo;
      if (room.playerWhite) {
        room.status = 'playing';
        room.turnStartTime = now;
        room.playerBlack.lastHeartbeat = now;
        room.playerBlack.connected = true;
        room.playerWhite.lastHeartbeat = now;
        room.playerWhite.connected = true;
      }
      room.chatMessages.push({
        id: `join-${now}`,
        senderName: 'Hệ Thống',
        senderId: 'sys',
        text: `${pInfo.name} đã tham gia với tư cách Quân Đen! Trận đấu bắt đầu!`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });

      await persistRoom(room);
      return { room, role: 'B' };
    }

    // Room is full, join as spectator
    const existingSpec = room.spectators.find((s) => s.id === player.id);
    if (!existingSpec) {
      room.spectators.push(pInfo);
    }
    await persistRoom(room);
    return { room, role: 'spectator' };
  },

  // Make move
  async makeMoveAsync(
    roomId: string,
    playerId: string,
    r: number,
    c: number,
    playerColorHint?: StoneColor
  ): Promise<{ success: boolean; error?: string; room?: GameRoom }> {
    const cleanId = roomId.toUpperCase();
    const room = await fetchRoom(cleanId);
    if (!room) return { success: false, error: 'Phòng không tồn tại' };

    // Auto-transition to playing if both players exist
    if (room.status === 'waiting' && room.playerBlack && room.playerWhite) {
      room.status = 'playing';
      room.turnStartTime = Date.now();
    }

    if (room.status !== 'playing' || room.isGameOver) {
      return { success: false, error: 'Trận đấu chưa bắt đầu hoặc đã kết thúc' };
    }

    let playerColor: StoneColor | null = null;
    if (room.playerBlack?.id === playerId) playerColor = 'B';
    else if (room.playerWhite?.id === playerId) playerColor = 'W';
    else if (playerColorHint === 'B' || playerColorHint === 'W') {
      playerColor = playerColorHint;
      if (playerColor === 'B' && room.playerBlack) room.playerBlack.id = playerId;
      if (playerColor === 'W' && room.playerWhite) room.playerWhite.id = playerId;
    }

    if (!playerColor) {
      return { success: false, error: 'Bạn chỉ đang theo dõi trận đấu' };
    }

    if (room.currentTurn !== playerColor) {
      return { success: false, error: 'Chưa tới lượt của bạn' };
    }

    const moveResult = applyMove(room.board, r, c, playerColor);
    if (!moveResult) {
      return { success: false, error: 'Nước đi không hợp lệ' };
    }

    room.board = moveResult.newBoard;
    room.currentTurn = moveResult.nextColor;
    room.blackCount = moveResult.blackCount;
    room.whiteCount = moveResult.whiteCount;
    room.isGameOver = moveResult.isGameOver;
    room.winner = moveResult.winner;
    room.lastMove = { r, c, player: playerColor };
    room.lastFlipped = moveResult.flipped;
    room.turnStartTime = Date.now();
    room.lastActive = Date.now();

    if (moveResult.isGameOver) {
      room.status = 'ended';
      if (moveResult.winner === 'DRAW') {
        room.winReason = 'Hai bên bằng điểm nhau! Kết quả hòa cờ!';
      } else {
        const winnerName =
          moveResult.winner === 'B'
            ? room.playerBlack?.name || 'Quân Đen'
            : room.playerWhite?.name || 'Quân Trắng';
        room.winReason = `${winnerName} (${moveResult.winner === 'B' ? 'Đen' : 'Trắng'}) giành chiến thắng với tỉ số ${room.blackCount} - ${room.whiteCount}!`;
      }
    }

    room.moveHistory.push({
      player: playerColor,
      r,
      c,
      flippedCount: moveResult.flipped.length,
      timestamp: Date.now(),
    });

    await persistRoom(room);
    return { success: true, room };
  },

  makeMove(
    roomId: string,
    playerId: string,
    r: number,
    c: number,
    playerColorHint?: StoneColor
  ): { success: boolean; error?: string; room?: GameRoom } {
    const cleanId = roomId.toUpperCase();
    const room = localRooms.get(cleanId);
    if (!room) return { success: false, error: 'Phòng không tồn tại' };

    let playerColor: StoneColor | null = null;
    if (room.playerBlack?.id === playerId) playerColor = 'B';
    else if (room.playerWhite?.id === playerId) playerColor = 'W';
    else if (playerColorHint === 'B' || playerColorHint === 'W') {
      playerColor = playerColorHint;
    }

    if (!playerColor || room.currentTurn !== playerColor) {
      return { success: false, error: 'Chưa tới lượt của bạn' };
    }

    const moveResult = applyMove(room.board, r, c, playerColor);
    if (!moveResult) {
      return { success: false, error: 'Nước đi không hợp lệ' };
    }

    room.board = moveResult.newBoard;
    room.currentTurn = moveResult.nextColor;
    room.blackCount = moveResult.blackCount;
    room.whiteCount = moveResult.whiteCount;
    room.isGameOver = moveResult.isGameOver;
    room.winner = moveResult.winner;
    room.lastMove = { r, c, player: playerColor };
    room.lastFlipped = moveResult.flipped;
    room.turnStartTime = Date.now();
    room.lastActive = Date.now();

    if (moveResult.isGameOver) {
      room.status = 'ended';
      room.winReason = moveResult.winner === 'DRAW' ? 'Hòa cờ!' : `${moveResult.winner === 'B' ? room.playerBlack?.name : room.playerWhite?.name} chiến thắng!`;
    }

    room.moveHistory.push({
      player: playerColor,
      r,
      c,
      flippedCount: moveResult.flipped.length,
      timestamp: Date.now(),
    });

    persistRoom(room);
    return { success: true, room };
  },

  // Surrender
  async surrenderAsync(
    roomId: string,
    playerId: string
  ): Promise<{ success: boolean; error?: string; room?: GameRoom }> {
    const cleanId = roomId.toUpperCase();
    const room = await fetchRoom(cleanId);
    if (!room) return { success: false, error: 'Phòng không tồn tại' };

    const isBlack = room.playerBlack?.id === playerId;
    const isWhite = room.playerWhite?.id === playerId;
    if (!isBlack && !isWhite) {
      return { success: false, error: 'Bạn không phải là người chơi trong ván này' };
    }

    room.isGameOver = true;
    room.status = 'ended';
    room.winner = isBlack ? 'W' : 'B';
    const loserName = isBlack ? room.playerBlack?.name || 'Quân Đen' : room.playerWhite?.name || 'Quân Trắng';
    const winnerName = isBlack ? room.playerWhite?.name || 'Quân Trắng' : room.playerBlack?.name || 'Quân Đen';
    room.winReason = `${loserName} đã xin nhận thua. ${winnerName} giành chiến thắng!`;
    room.lastActive = Date.now();

    room.chatMessages.push({
      id: `surrender-${Date.now()}`,
      senderName: 'Hệ Thống',
      senderId: 'sys',
      text: `${loserName} đã xin nhận thua! Trận đấu kết thúc!`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    await persistRoom(room);
    return { success: true, room };
  },

  surrender(
    roomId: string,
    playerId: string
  ): { success: boolean; error?: string; room?: GameRoom } {
    const cleanId = roomId.toUpperCase();
    const room = localRooms.get(cleanId);
    if (!room) return { success: false, error: 'Phòng không tồn tại' };

    const isBlack = room.playerBlack?.id === playerId;
    const isWhite = room.playerWhite?.id === playerId;
    if (!isBlack && !isWhite) {
      return { success: false, error: 'Bạn không phải là người chơi' };
    }

    room.isGameOver = true;
    room.status = 'ended';
    room.winner = isBlack ? 'W' : 'B';
    const loserName = isBlack ? room.playerBlack?.name || 'Quân Đen' : room.playerWhite?.name || 'Quân Trắng';
    const winnerName = isBlack ? room.playerWhite?.name || 'Quân Trắng' : room.playerBlack?.name || 'Quân Đen';
    room.winReason = `${loserName} đã nhận thua. ${winnerName} chiến thắng!`;
    room.lastActive = Date.now();

    persistRoom(room);
    return { success: true, room };
  },

  // Leave room: If playing, forfeits the leaver immediately and ends match
  async leaveRoomAsync(
    roomId: string,
    playerId: string
  ): Promise<{ success: boolean; room?: GameRoom }> {
    const cleanId = roomId.toUpperCase();
    const room = await fetchRoom(cleanId);
    if (!room) return { success: false };

    const isBlack = room.playerBlack?.id === playerId;
    const isWhite = room.playerWhite?.id === playerId;

    if (isBlack && room.playerBlack) room.playerBlack.connected = false;
    if (isWhite && room.playerWhite) room.playerWhite.connected = false;

    // RULE: If game was in progress ('playing') and not ended, FORFEIT IMMEDIATELY
    if (room.status === 'playing' && !room.isGameOver) {
      const leaverName = isBlack
        ? room.playerBlack?.name || 'Quân Đen'
        : room.playerWhite?.name || 'Quân Trắng';
      const winnerName = isBlack
        ? room.playerWhite?.name || 'Quân Trắng'
        : room.playerBlack?.name || 'Quân Đen';
      const winningColor: StoneColor = isBlack ? 'W' : 'B';

      room.isGameOver = true;
      room.status = 'ended';
      room.winner = winningColor;
      room.winReason = `${leaverName} đã rời trận đấu (Xử thua). ${winnerName} giành chiến thắng!`;

      room.chatMessages.push({
        id: `leave-${Date.now()}`,
        senderName: 'Hệ Thống',
        senderId: 'sys',
        text: `${leaverName} đã rời trận đấu. Đối thủ được xử thắng!`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    }

    // Remove from spectators if present
    const specIdx = room.spectators.findIndex((s) => s.id === playerId);
    if (specIdx !== -1) {
      room.spectators.splice(specIdx, 1);
    }

    room.lastActive = Date.now();
    await persistRoom(room);
    return { success: true, room };
  },

  leaveRoom(
    roomId: string,
    playerId: string
  ): { success: boolean; room?: GameRoom } {
    const cleanId = roomId.toUpperCase();
    const room = localRooms.get(cleanId);
    if (!room) return { success: false };

    const isBlack = room.playerBlack?.id === playerId;
    const isWhite = room.playerWhite?.id === playerId;

    if (isBlack && room.playerBlack) room.playerBlack.connected = false;
    if (isWhite && room.playerWhite) room.playerWhite.connected = false;

    if (room.status === 'playing' && !room.isGameOver) {
      const leaverName = isBlack ? room.playerBlack?.name || 'Quân Đen' : room.playerWhite?.name || 'Quân Trắng';
      const winnerName = isBlack ? room.playerWhite?.name || 'Quân Trắng' : room.playerBlack?.name || 'Quân Đen';
      room.isGameOver = true;
      room.status = 'ended';
      room.winner = isBlack ? 'W' : 'B';
      room.winReason = `${leaverName} đã rời trận đấu (Xử thua). ${winnerName} giành chiến thắng!`;
    }

    persistRoom(room);
    return { success: true, room };
  },

  // Rematch
  async requestRematchAsync(
    roomId: string,
    playerId: string
  ): Promise<{ success: boolean; error?: string; room?: GameRoom }> {
    const cleanId = roomId.toUpperCase();
    const room = await fetchRoom(cleanId);
    if (!room) return { success: false, error: 'Phòng không tồn tại' };

    const isBlack = room.playerBlack?.id === playerId;
    const isWhite = room.playerWhite?.id === playerId;
    if (!isBlack && !isWhite) {
      return { success: false, error: 'Bạn không phải là người chơi trong ván này' };
    }

    if (isBlack && room.playerBlack) room.playerBlack.rematchRequested = true;
    if (isWhite && room.playerWhite) room.playerWhite.rematchRequested = true;

    // Both accepted: restart match with swapped colors
    if (room.playerBlack?.rematchRequested && room.playerWhite?.rematchRequested) {
      const newBlack = room.playerWhite;
      const newWhite = room.playerBlack;
      newBlack.rematchRequested = false;
      newWhite.rematchRequested = false;

      const initialBoard = createInitialBoard(8);
      const counts = countStones(initialBoard);

      room.board = initialBoard;
      room.playerBlack = newBlack;
      room.playerWhite = newWhite;
      room.currentTurn = 'B';
      room.status = 'playing';
      room.isGameOver = false;
      room.winner = null;
      room.winReason = undefined;
      room.blackCount = counts.black;
      room.whiteCount = counts.white;
      room.moveHistory = [];
      room.lastMove = null;
      room.lastFlipped = [];
      room.turnStartTime = Date.now();

      room.chatMessages.push({
        id: `rematch-${Date.now()}`,
        senderName: 'Hệ Thống',
        senderId: 'sys',
        text: 'Cả hai đấu thủ đã đồng ý tái đấu! Ván cờ mới bắt đầu!',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    }

    room.lastActive = Date.now();
    await persistRoom(room);
    return { success: true, room };
  },

  requestRematch(
    roomId: string,
    playerId: string
  ): { success: boolean; error?: string; room?: GameRoom } {
    this.requestRematchAsync(roomId, playerId);
    const room = localRooms.get(roomId.toUpperCase());
    return { success: true, room: room || undefined };
  },

  // Send Chat
  async sendChatAsync(
    roomId: string,
    playerId: string,
    text: string
  ): Promise<{ success: boolean; error?: string; chatMessages?: ChatMessage[] }> {
    const cleanId = roomId.toUpperCase();
    const room = await fetchRoom(cleanId);
    if (!room) return { success: false, error: 'Phòng không tồn tại' };

    let senderName = 'Khán giả';
    let color: StoneColor | undefined;
    if (room.playerBlack?.id === playerId) {
      senderName = room.playerBlack.name;
      color = 'B';
    } else if (room.playerWhite?.id === playerId) {
      senderName = room.playerWhite.name;
      color = 'W';
    } else {
      const spec = room.spectators.find((s) => s.id === playerId);
      if (spec) senderName = spec.name;
    }

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      senderName,
      senderId: playerId,
      color,
      text: text.slice(0, 200),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    room.chatMessages.push(newMsg);
    if (room.chatMessages.length > 50) {
      room.chatMessages = room.chatMessages.slice(-50);
    }
    room.lastActive = Date.now();

    await persistRoom(room);
    return { success: true, chatMessages: room.chatMessages };
  },

  sendChat(
    roomId: string,
    playerId: string,
    text: string
  ): { success: boolean; error?: string; chatMessages?: ChatMessage[] } {
    this.sendChatAsync(roomId, playerId, text);
    const room = localRooms.get(roomId.toUpperCase());
    return { success: true, chatMessages: room?.chatMessages };
  },

  // Heartbeat
  async heartbeatAsync(roomId: string, playerId: string): Promise<void> {
    const cleanId = roomId.toUpperCase();
    const room = await fetchRoom(cleanId);
    if (!room) return;

    const now = Date.now();
    room.lastActive = now;
    if (room.playerBlack?.id === playerId) {
      room.playerBlack.connected = true;
      room.playerBlack.lastHeartbeat = now;
    }
    if (room.playerWhite?.id === playerId) {
      room.playerWhite.connected = true;
      room.playerWhite.lastHeartbeat = now;
    }

    await persistRoom(room);
  },

  heartbeat(roomId: string, playerId: string): void {
    const cleanId = roomId.toUpperCase();
    const room = localRooms.get(cleanId);
    if (room) {
      const now = Date.now();
      room.lastActive = now;
      if (room.playerBlack?.id === playerId) {
        room.playerBlack.connected = true;
        room.playerBlack.lastHeartbeat = now;
      }
      if (room.playerWhite?.id === playerId) {
        room.playerWhite.connected = true;
        room.playerWhite.lastHeartbeat = now;
      }
      persistRoom(room);
    }
  },

  // Matchmaking (Serverless-Safe via Firestore collection 'matchmaking')
  async addToMatchmakingAsync(player: { id: string; name: string; avatar?: string }): Promise<{ status: 'waiting' | 'matched'; roomId?: string }> {
    try {
      // 1. Look for waiting players in Firestore matchmaking
      const mmRef = collection(db, 'matchmaking');
      const q = query(mmRef, where('status', '==', 'waiting'), limit(5));
      const snaps = await getDocs(q);

      const now = Date.now();
      let opponent: QueuedPlayer | null = null;
      for (const d of snaps.docs) {
        const data = d.data() as QueuedPlayer;
        if (data.playerId !== player.id && now - data.joinedAt < 60000) {
          opponent = data;
          break;
        }
      }

      if (opponent) {
        // Matched! Create a room with opponent as Black, player as White
        const room = await this.createRoomAsync(
          { id: opponent.playerId, name: opponent.playerName, avatar: opponent.avatar },
          false
        );
        // Join current player as White
        await this.joinRoomAsync(room.id, {
          id: player.id,
          name: player.name || 'Người chơi 2',
          avatar: player.avatar || '⚔️',
        });

        // Update opponent's matchmaking doc
        await setDoc(doc(db, 'matchmaking', opponent.playerId), {
          playerId: opponent.playerId,
          playerName: opponent.playerName,
          avatar: opponent.avatar,
          joinedAt: opponent.joinedAt,
          status: 'matched',
          assignedRoomId: room.id,
        });

        return { status: 'matched', roomId: room.id };
      }

      // No opponent available yet, register in matchmaking
      await setDoc(doc(db, 'matchmaking', player.id), {
        playerId: player.id,
        playerName: player.name,
        avatar: player.avatar || '🥋',
        joinedAt: now,
        status: 'waiting',
      });

      return { status: 'waiting' };
    } catch (e) {
      console.error('Matchmaking error:', e);
      return { status: 'waiting' };
    }
  },

  addToMatchmaking(player: { id: string; name: string; avatar?: string }): { status: 'waiting' | 'matched'; roomId?: string } {
    this.addToMatchmakingAsync(player);
    return { status: 'waiting' };
  },

  async checkMatchmakingAsync(playerId: string): Promise<{ status: 'waiting' | 'matched'; roomId?: string }> {
    try {
      const snap = await getDoc(doc(db, 'matchmaking', playerId));
      if (snap.exists()) {
        const data = snap.data();
        if (data.status === 'matched' && data.assignedRoomId) {
          // Cleanup after match
          deleteDoc(doc(db, 'matchmaking', playerId)).catch(() => {});
          return { status: 'matched', roomId: data.assignedRoomId };
        }
      }
    } catch (e) {
      console.error('Check matchmaking error:', e);
    }
    return { status: 'waiting' };
  },

  checkMatchmaking(playerId: string): { status: 'waiting' | 'matched'; roomId?: string } {
    return { status: 'waiting' };
  },

  async removeFromMatchmakingAsync(playerId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'matchmaking', playerId));
    } catch {}
  },

  removeFromMatchmaking(playerId: string): void {
    this.removeFromMatchmakingAsync(playerId);
  },
};
