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
  var __FLANK_MATCH_RESULTS: Map<string, { roomId: string; matchedAt: number }> | undefined;
}

if (!globalThis.__FLANK_GAME_ROOMS) {
  globalThis.__FLANK_GAME_ROOMS = new Map<string, GameRoom>();
}
if (!globalThis.__FLANK_MATCH_QUEUE) {
  globalThis.__FLANK_MATCH_QUEUE = [];
}
if (!globalThis.__FLANK_MATCH_RESULTS) {
  globalThis.__FLANK_MATCH_RESULTS = new Map<string, { roomId: string; matchedAt: number }>();
}

const rooms = globalThis.__FLANK_GAME_ROOMS;
const matchQueue = globalThis.__FLANK_MATCH_QUEUE;
const matchResults = globalThis.__FLANK_MATCH_RESULTS;

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
    const now = Date.now();
    if (room.status === 'playing' && !room.isGameOver) {
      const elapsedSeconds = (now - room.turnStartTime) / 1000;
      if (elapsedSeconds > room.turnDurationSeconds) {
        this.surrender(cleanId, room.currentTurn === 'B' ? (room.playerBlack?.id || '') : (room.playerWhite?.id || ''));
      } else if (room.playerBlack?.connected && room.playerBlack.lastHeartbeat && now - room.playerBlack.lastHeartbeat > 10000) {
        room.playerBlack.connected = false;
        this.surrender(cleanId, room.playerBlack.id);
      } else if (room.playerWhite?.connected && room.playerWhite.lastHeartbeat && now - room.playerWhite.lastHeartbeat > 10000) {
        room.playerWhite.connected = false;
        this.surrender(cleanId, room.playerWhite.id);
      }
    }

    return room;
  },

  leaveRoom(roomId: string, playerId: string): { success: boolean; room?: GameRoom } {
    const room = this.getRoom(roomId);
    if (!room) return { success: false };

    // If game is in progress, treat as surrender
    if (room.status === 'playing' && !room.isGameOver) {
      this.surrender(roomId, playerId);
    }

    // If spectator, remove from spectator list
    const specIdx = room.spectators.findIndex(s => s.id === playerId);
    if (specIdx !== -1) {
      room.spectators.splice(specIdx, 1);
    }

    // Mark disconnected
    if (room.playerBlack?.id === playerId) room.playerBlack.connected = false;
    if (room.playerWhite?.id === playerId) room.playerWhite.connected = false;

    return { success: true, room };
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
    const now = Date.now();

    // 1. Check if this player already has an existing valid match result
    const recentMatch = matchResults.get(player.id);
    if (recentMatch && now - recentMatch.matchedAt < 45000) {
      return { status: 'matched', roomId: recentMatch.roomId };
    }

    // 2. Clean stale match queue entries older than 45 seconds
    for (let i = matchQueue.length - 1; i >= 0; i--) {
      if (now - matchQueue[i].joinedAt > 45000) {
        matchQueue.splice(i, 1);
      }
    }

    // 3. Clean stale match results
    for (const [pid, res] of matchResults.entries()) {
      if (now - res.matchedAt > 60000) {
        matchResults.delete(pid);
      }
    }

    // 4. Check if player was already assigned a room in queue
    const existing = matchQueue.find((q) => q.playerId === player.id);
    if (existing?.assignedRoomId) {
      const rId = existing.assignedRoomId;
      matchResults.set(player.id, { roomId: rId, matchedAt: now });
      const idx = matchQueue.indexOf(existing);
      if (idx !== -1) matchQueue.splice(idx, 1);
      return { status: 'matched', roomId: rId };
    }

    // 5. Look for any waiting opponent (different player ID)
    const opponentIndex = matchQueue.findIndex((q) => q.playerId !== player.id && !q.assignedRoomId);

    if (opponentIndex !== -1) {
      const opponent = matchQueue[opponentIndex];
      // Create matched room with random host side
      const room = this.createRoom(
        { id: opponent.playerId, name: opponent.playerName, avatar: opponent.avatar },
        false
      );

      // Join the current second player into the room
      this.joinRoom(room.id, {
        id: player.id,
        name: player.name,
        avatar: player.avatar,
      });

      // Cache match results for BOTH players so polling never misses it!
      matchResults.set(opponent.playerId, { roomId: room.id, matchedAt: now });
      matchResults.set(player.id, { roomId: room.id, matchedAt: now });

      // Mark and remove opponent from queue
      opponent.assignedRoomId = room.id;
      matchQueue.splice(opponentIndex, 1);

      // Remove current player if somehow present
      const currIdx = matchQueue.findIndex((q) => q.playerId === player.id);
      if (currIdx !== -1) matchQueue.splice(currIdx, 1);

      return { status: 'matched', roomId: room.id };
    }

    // 6. No waiting opponent yet, add or refresh in queue
    if (!existing) {
      matchQueue.push({
        playerId: player.id,
        playerName: player.name,
        avatar: player.avatar || '🥋',
        joinedAt: now,
      });
    } else {
      existing.joinedAt = now;
    }

    return { status: 'queued' };
  },

  checkMatchmaking(playerId: string): { status: 'queued' | 'matched' | 'not_found'; roomId?: string } {
    const now = Date.now();

    // 1. Check match results cache first (guaranteed delivery!)
    const recent = matchResults.get(playerId);
    if (recent && now - recent.matchedAt < 45000) {
      return { status: 'matched', roomId: recent.roomId };
    }

    // 2. Check if assigned in matchQueue
    const entry = matchQueue.find((q) => q.playerId === playerId);
    if (entry?.assignedRoomId) {
      const rId = entry.assignedRoomId;
      matchResults.set(playerId, { roomId: rId, matchedAt: now });
      const idx = matchQueue.indexOf(entry);
      if (idx !== -1) matchQueue.splice(idx, 1);
      return { status: 'matched', roomId: rId };
    }

    if (entry) {
      return { status: 'queued' };
    }

    return { status: 'not_found' };
  },

  removeFromMatchmaking(playerId: string) {
    const idx = matchQueue.findIndex((q) => q.playerId === playerId);
    if (idx !== -1) {
      matchQueue.splice(idx, 1);
    }
    matchResults.delete(playerId);
  },
};
