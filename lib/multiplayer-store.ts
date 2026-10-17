import {
  BoardState,
  createInitialBoard,
  applyMove,
  countStones,
  StoneColor,
  Position,
  getValidMoves,
} from './game-engine';

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
  assignedRoomId?: string;
}

// Global persistence store inside Node process (persists across API invocations)
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

const rooms = globalThis.__FLANK_GAME_ROOMS;
const matchQueue = globalThis.__FLANK_MATCH_QUEUE;

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const multiplayerStore = {
  // Create or get room
  createRoom(
    hostPlayer: { id: string; name: string; avatar?: string },
    isPrivate = false,
    customCode?: string
  ): GameRoom {
    const roomId = customCode ? customCode.toUpperCase() : generateCode();
    const initialBoard = createInitialBoard(8);
    const counts = countStones(initialBoard);

    // Randomize whether host starts as Black or White
    const hostStartsBlack = Math.random() < 0.5;

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
      playerBlack: hostStartsBlack ? hostInfo : null,
      playerWhite: hostStartsBlack ? null : hostInfo,
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
          text: `Phòng ${roomId} đã tạo! Đang chờ đối thủ...`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ],
      turnStartTime: Date.now(),
      turnDurationSeconds: 45,
    };

    rooms.set(roomId, room);
    return room;
  },

  getRoom(roomId: string): GameRoom | null {
    const cleanId = roomId.toUpperCase();
    const room = rooms.get(cleanId);
    if (!room) return null;

    // Check timer expiration if playing
    if (room.status === 'playing' && !room.isGameOver) {
      const elapsedSeconds = (Date.now() - room.turnStartTime) / 1000;
      if (elapsedSeconds > room.turnDurationSeconds) {
        // Current player timed out! Opponent gets automatic win or turn pass
        const timeoutPlayer = room.currentTurn;
        const winner = timeoutPlayer === 'B' ? 'W' : 'B';
        const timedOutName =
          timeoutPlayer === 'B'
            ? room.playerBlack?.name ?? 'Đen'
            : room.playerWhite?.name ?? 'Trắng';

        room.isGameOver = true;
        room.status = 'ended';
        room.winner = winner;
        room.winReason = `Hết giờ! ${timedOutName} quá 45 giây suy nghĩ và bị xử thua!`;
        room.chatMessages.push({
          id: `timeout-${Date.now()}`,
          senderName: 'Trọng Tài',
          senderId: 'sys',
          text: `⏱️ Hết thời gian 45 giây! ${timedOutName} bị xử thua. ${winner === 'B' ? 'Quân Đen' : 'Quân Trắng'} thắng!`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      }
    }

    return room;
  },

  joinRoom(
    roomId: string,
    player: { id: string; name: string; avatar?: string }
  ): { room: GameRoom; role: 'B' | 'W' | 'spectator' } | { error: string } {
    const cleanId = roomId.toUpperCase();
    const room = rooms.get(cleanId);
    if (!room) {
      return { error: 'Không tìm thấy phòng với mã này' };
    }

    room.lastActive = Date.now();

    // Check if player is already registered in this room
    if (room.playerBlack?.id === player.id) {
      room.playerBlack.connected = true;
      room.playerBlack.lastHeartbeat = Date.now();
      return { room, role: 'B' };
    }
    if (room.playerWhite?.id === player.id) {
      room.playerWhite.connected = true;
      room.playerWhite.lastHeartbeat = Date.now();
      return { room, role: 'W' };
    }

    // Assign to empty slot
    const pInfo: PlayerInfo = {
      id: player.id,
      name: player.name.trim() || 'Người chơi 2',
      avatar: player.avatar || '⚔️',
      connected: true,
      lastHeartbeat: Date.now(),
    };

    if (!room.playerBlack) {
      room.playerBlack = pInfo;
      if (room.playerWhite) {
        room.status = 'playing';
        room.turnStartTime = Date.now();
      }
      room.chatMessages.push({
        id: `join-${Date.now()}`,
        senderName: 'Hệ Thống',
        senderId: 'sys',
        text: `${pInfo.name} đã tham gia với tư cách Quân Đen!`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      return { room, role: 'B' };
    }

    if (!room.playerWhite) {
      room.playerWhite = pInfo;
      room.status = 'playing';
      room.turnStartTime = Date.now();
      room.chatMessages.push({
        id: `join-${Date.now()}`,
        senderName: 'Hệ Thống',
        senderId: 'sys',
        text: `${pInfo.name} đã tham gia với tư cách Quân Trắng! Trận đấu bắt đầu!`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      return { room, role: 'W' };
    }

    // Room is full, join as spectator
    const existingSpec = room.spectators.find((s) => s.id === player.id);
    if (!existingSpec) {
      room.spectators.push(pInfo);
    }
    return { room, role: 'spectator' };
  },

  makeMove(
    roomId: string,
    playerId: string,
    r: number,
    c: number
  ): { success: boolean; error?: string; room?: GameRoom } {
    const room = this.getRoom(roomId);
    if (!room) return { success: false, error: 'Phòng không tồn tại' };

    if (room.status !== 'playing' || room.isGameOver) {
      return { success: false, error: 'Trận đấu chưa bắt đầu hoặc đã kết thúc' };
    }

    // Determine player's color
    let playerColor: StoneColor | null = null;
    if (room.playerBlack?.id === playerId) playerColor = 'B';
    else if (room.playerWhite?.id === playerId) playerColor = 'W';

    if (!playerColor) {
      return { success: false, error: 'Bạn chỉ đang theo dõi trận đấu' };
    }

    if (room.currentTurn !== playerColor) {
      return { success: false, error: 'Chưa tới lượt của bạn' };
    }

    // Apply move using game engine (free placement on any empty cell)
    const moveRes = applyMove(room.board, r, c, playerColor);
    if (!moveRes) {
      return {
        success: false,
        error: 'Nước đi không hợp lệ! Vui lòng chọn điểm giao cắt còn trống trên bàn cờ.',
      };
    }

    // Update room state
    room.board = moveRes.newBoard;
    room.currentTurn = moveRes.nextColor;
    room.isGameOver = moveRes.isGameOver;
    room.winner = moveRes.winner;
    room.blackCount = moveRes.blackCount;
    room.whiteCount = moveRes.whiteCount;
    room.lastMove = { r, c, player: playerColor };
    room.lastFlipped = moveRes.flipped;
    room.turnStartTime = Date.now();
    room.lastActive = Date.now();

    room.moveHistory.push({
      player: playerColor,
      r,
      c,
      flippedCount: moveRes.flipped.length,
      timestamp: Date.now(),
    });

    if (moveRes.isGameOver) {
      room.status = 'ended';
      const winnerName =
        moveRes.winner === 'B'
          ? room.playerBlack?.name ?? 'Quân Đen'
          : moveRes.winner === 'W'
          ? room.playerWhite?.name ?? 'Quân Trắng'
          : 'Hòa cờ';
      room.winReason =
        moveRes.winner === 'DRAW'
          ? 'Hai bên có số quân bằng nhau!'
          : `${winnerName} thắng với ${
              moveRes.winner === 'B' ? moveRes.blackCount : moveRes.whiteCount
            } quân!`;

      room.chatMessages.push({
        id: `gameover-${Date.now()}`,
        senderName: 'Hệ Thống',
        senderId: 'sys',
        text: `🏆 Trận đấu kết thúc! ${room.winReason}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    }

    return { success: true, room };
  },

  surrender(
    roomId: string,
    playerId: string
  ): { success: boolean; room?: GameRoom; error?: string } {
    const room = this.getRoom(roomId);
    if (!room || room.status !== 'playing' || room.isGameOver) {
      return { success: false, error: 'Không thể đầu hàng lúc này' };
    }

    if (room.playerBlack?.id === playerId) {
      room.isGameOver = true;
      room.status = 'ended';
      room.winner = 'W';
      room.winReason = `${room.playerBlack.name} đã xin nhận thua!`;
    } else if (room.playerWhite?.id === playerId) {
      room.isGameOver = true;
      room.status = 'ended';
      room.winner = 'B';
      room.winReason = `${room.playerWhite.name} đã xin nhận thua!`;
    } else {
      return { success: false, error: 'Người chơi không hợp lệ' };
    }

    room.chatMessages.push({
      id: `surrender-${Date.now()}`,
      senderName: 'Hệ Thống',
      senderId: 'sys',
      text: `🏳️ ${room.winReason}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    return { success: true, room };
  },

  requestRematch(
    roomId: string,
    playerId: string
  ): { success: boolean; room?: GameRoom; error?: string } {
    const room = this.getRoom(roomId);
    if (!room) return { success: false, error: 'Phòng không tồn tại' };

    if (room.playerBlack?.id === playerId) {
      room.playerBlack.rematchRequested = true;
    } else if (room.playerWhite?.id === playerId) {
      room.playerWhite.rematchRequested = true;
    } else {
      return { success: false, error: 'Chỉ hai kỳ thủ mới có thể yêu cầu tái đấu' };
    }

    // If both agreed, restart!
    if (room.playerBlack?.rematchRequested && room.playerWhite?.rematchRequested) {
      // Swap colors for rematch
      const oldBlack = room.playerBlack;
      const oldWhite = room.playerWhite;
      oldBlack.rematchRequested = false;
      oldWhite.rematchRequested = false;

      room.playerBlack = oldWhite;
      room.playerWhite = oldBlack;
      room.board = createInitialBoard(8);
      const counts = countStones(room.board);
      room.blackCount = counts.black;
      room.whiteCount = counts.white;
      room.currentTurn = 'B';
      room.status = 'playing';
      room.isGameOver = false;
      room.winner = null;
      room.winReason = undefined;
      room.moveHistory = [];
      room.lastMove = null;
      room.lastFlipped = [];
      room.turnStartTime = Date.now();

      room.chatMessages.push({
        id: `rematch-start-${Date.now()}`,
        senderName: 'Hệ Thống',
        senderId: 'sys',
        text: `🔄 Cả hai đã đồng ý tái đấu! Đổi quân cờ và bắt đầu ván mới!`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } else {
      const requester =
        room.playerBlack?.id === playerId
          ? room.playerBlack.name
          : room.playerWhite?.name;
      room.chatMessages.push({
        id: `rematch-req-${Date.now()}`,
        senderName: 'Hệ Thống',
        senderId: 'sys',
        text: `💬 ${requester} muốn tái đấu ván mới! Bấm "Đồng ý tái đấu" để bắt đầu.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    }

    return { success: true, room };
  },

  sendChat(
    roomId: string,
    senderId: string,
    text: string
  ): { success: boolean; room?: GameRoom } {
    const room = this.getRoom(roomId);
    if (!room) return { success: false };

    let senderName = 'Khán giả';
    let color: StoneColor | undefined;
    if (room.playerBlack?.id === senderId) {
      senderName = room.playerBlack.name;
      color = 'B';
    } else if (room.playerWhite?.id === senderId) {
      senderName = room.playerWhite.name;
      color = 'W';
    } else {
      const spec = room.spectators.find((s) => s.id === senderId);
      if (spec) senderName = spec.name;
    }

    room.chatMessages.push({
      id: `chat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      senderName,
      senderId,
      color,
      text: text.slice(0, 100),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    if (room.chatMessages.length > 50) {
      room.chatMessages.shift();
    }

    return { success: true, room };
  },

  heartbeat(roomId: string, playerId: string) {
    const room = rooms.get(roomId.toUpperCase());
    if (!room) return;
    room.lastActive = Date.now();
    if (room.playerBlack?.id === playerId) {
      room.playerBlack.lastHeartbeat = Date.now();
      room.playerBlack.connected = true;
    } else if (room.playerWhite?.id === playerId) {
      room.playerWhite.lastHeartbeat = Date.now();
      room.playerWhite.connected = true;
    }
  },

  // Matchmaking Queue
  addToMatchmaking(player: { id: string; name: string; avatar?: string }): {
    status: 'queued' | 'matched';
    roomId?: string;
  } {
    // Check if player is already assigned a room
    const existing = matchQueue.find((q) => q.playerId === player.id);
    if (existing?.assignedRoomId) {
      const roomId = existing.assignedRoomId;
      // Remove from queue
      const idx = matchQueue.indexOf(existing);
      if (idx !== -1) matchQueue.splice(idx, 1);
      return { status: 'matched', roomId };
    }

    // Clean queue of players older than 60s
    const now = Date.now();
    for (let i = matchQueue.length - 1; i >= 0; i--) {
      if (now - matchQueue[i].joinedAt > 60000) {
        matchQueue.splice(i, 1);
      }
    }

    // Check if another waiting player is in queue
    const otherPlayer = matchQueue.find((q) => q.playerId !== player.id && !q.assignedRoomId);

    if (otherPlayer) {
      // Pair them up!
      const room = this.createRoom(
        { id: otherPlayer.playerId, name: otherPlayer.playerName, avatar: otherPlayer.avatar },
        false
      );

      // Join the second player
      this.joinRoom(room.id, {
        id: player.id,
        name: player.name,
        avatar: player.avatar,
      });

      // Mark first player as matched
      otherPlayer.assignedRoomId = room.id;

      // Remove current player from queue if present
      const currIdx = matchQueue.findIndex((q) => q.playerId === player.id);
      if (currIdx !== -1) matchQueue.splice(currIdx, 1);

      return { status: 'matched', roomId: room.id };
    }

    // No waiting opponent yet, add to queue if not present
    if (!existing) {
      matchQueue.push({
        playerId: player.id,
        playerName: player.name,
        avatar: player.avatar || '⚡',
        joinedAt: Date.now(),
      });
    }

    return { status: 'queued' };
  },

  checkMatchmaking(playerId: string): { status: 'queued' | 'matched' | 'not_found'; roomId?: string } {
    const entry = matchQueue.find((q) => q.playerId === playerId);
    if (!entry) return { status: 'not_found' };

    if (entry.assignedRoomId) {
      const roomId = entry.assignedRoomId;
      const idx = matchQueue.indexOf(entry);
      if (idx !== -1) matchQueue.splice(idx, 1);
      return { status: 'matched', roomId };
    }

    return { status: 'queued' };
  },

  removeFromMatchmaking(playerId: string) {
    const idx = matchQueue.findIndex((q) => q.playerId === playerId);
    if (idx !== -1) {
      matchQueue.splice(idx, 1);
    }
  },
};
