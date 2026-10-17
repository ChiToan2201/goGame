'use client';

import React, { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import {
  Swords,
  Users,
  Bot,
  PlusCircle,
  LogIn,
  Dice5,
  Volume2,
  VolumeX,
  HelpCircle,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import {
  BoardState,
  StoneColor,
  Position,
  createInitialBoard,
  getValidMoves,
  applyMove,
  countStones,
  getAIMove,
  getFlippedStones,
  AIDifficulty,
  sounds,
} from '@/lib/game-engine';
import { GameRoom } from '@/lib/multiplayer-store';
import { GobanBoard } from '@/components/GobanBoard';
import { GameHeader } from '@/components/GameHeader';
import { MatchmakingModal } from '@/components/MatchmakingModal';
import { GameOverModal } from '@/components/GameOverModal';
import { RulesModal } from '@/components/RulesModal';
import { RoomShareModal } from '@/components/RoomShareModal';
import { InGameChat } from '@/components/InGameChat';

const AVATARS = [
  '🥋', '🥷', '🏮', '🐉', '⚔️', '👑', '⚡', '🦊',
  '🎋', '🍵', '🦅', '🐅', '🪷', '🎯', '🛡️', '💎'
];

const RANDOM_NAMES = [
  'Bạch Kỳ Tử',
  'Hắc Long',
  'Kỳ Thánh',
  'Thần Cờ',
  'Lãng Khách',
  'Đại Hiệp',
  'Vô Song',
  'Trúc Lâm',
  'Huyền Cực',
  'Phi Yến',
];

type GameMode = 'lobby' | 'online_match' | 'online_room' | 'ai' | 'local';

function getRandomProfile() {
  const rnd = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${rnd} #${num}`;
}

const emptySubscribe = () => () => {};

function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export default function GamePage() {
  const isMounted = useMounted();

  if (!isMounted) {
    return (
      <main className="min-h-screen bg-[#F5F1E8] text-[#1F1C19] flex items-center justify-center p-6 selection:bg-[#A83226] selection:text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#EFE8DC] border border-[#D5CCBC] flex items-center justify-center text-2xl shadow-xs">
            🥋
          </div>
          <div className="text-[#6B635A] text-xs tracking-wider">
            Đang sắp xếp bàn cờ...
          </div>
        </div>
      </main>
    );
  }

  return <GameApp />;
}

function GameApp() {
  // User Profile
  const [playerName, setPlayerName] = useState(() => {
    const saved = localStorage.getItem('flank_player_name');
    if (saved) return saved;
    const initial = getRandomProfile();
    localStorage.setItem('flank_player_name', initial);
    return initial;
  });

  const [avatar, setAvatar] = useState(() => {
    return localStorage.getItem('flank_player_avatar') || '🥋';
  });

  const [playerId] = useState(() => {
    if (typeof window === 'undefined') return 'user_init';
    // Use sessionStorage so multiple browser tabs have distinct player IDs for multiplayer testing
    let pid = sessionStorage.getItem('flank_player_session_id');
    if (!pid) {
      pid = 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
      sessionStorage.setItem('flank_player_session_id', pid);
    }
    return pid;
  });

  // App State
  const [mode, setMode] = useState<GameMode>('lobby');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room')?.toUpperCase() || '';
  });
  const [joinError, setJoinError] = useState('');

  // Matchmaking State
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [showGameStart, setShowGameStart] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Online Room State
  const [onlineRoom, setOnlineRoom] = useState<GameRoom | null>(null);
  const [myOnlineRole, setMyOnlineRole] = useState<'B' | 'W' | 'spectator' | null>(null);
  const [rematchSent, setRematchSent] = useState(false);

  // Local / AI Game State
  const [board, setBoard] = useState<BoardState>(createInitialBoard(8));
  const [currentTurn, setCurrentTurn] = useState<StoneColor>('B');
  const [lastMove, setLastMove] = useState<{ r: number; c: number; player: StoneColor } | null>(null);
  const [lastFlipped, setLastFlipped] = useState<Position[]>([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [winner, setWinner] = useState<StoneColor | 'DRAW' | null>(null);
  const [winReason, setWinReason] = useState<string | undefined>();
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('medium');
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Timer countdown
  const [turnTimeLeft, setTurnTimeLeft] = useState<number>(45);
  const localTurnStartTimeRef = useRef<number>(0);

  // Sound sync
  useEffect(() => {
    sounds.soundEnabled = soundEnabled;
  }, [soundEnabled]);

  const savePlayerProfile = (name: string, av: string) => {
    setPlayerName(name);
    setAvatar(av);
    localStorage.setItem('flank_player_name', name);
    localStorage.setItem('flank_player_avatar', av);
  };

  const handleRandomizeName = () => {
    const newName = getRandomProfile();
    const newAv = AVATARS[Math.floor(Math.random() * AVATARS.length)];
    savePlayerProfile(newName, newAv);
  };

  // ----------------- ROOM CREATION & JOINING -----------------

  const joinOnlineRoom = useCallback(
    async (codeToJoin?: string) => {
      const code = (codeToJoin || joinCodeInput).trim().toUpperCase();
      if (!code) {
        setJoinError('Vui lòng nhập mã phòng');
        return;
      }
      setJoinError('');
      setIsLoading(true);
      try {
        const res = await fetch('/api/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'join',
            roomId: code,
            player: { id: playerId, name: playerName.trim(), avatar },
          }),
        });
        const data = await res.json();
        if (!data.success || !data.room) {
          setJoinError(data.error || 'Không tìm thấy phòng');
          return;
        }

        setOnlineRoom(data.room);
        setMyOnlineRole(data.role);
        setMode('online_room');
        setIsMatchmaking(false);
        sounds.playTurnAlert();
      } catch (err) {
        console.error(err);
        setJoinError('Lỗi kết nối tới phòng');
      } finally {
        setIsLoading(false);
      }
    },
    [joinCodeInput, playerId, playerName, avatar]
  );

  const createCustomRoom = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          player: { id: playerId, name: playerName.trim(), avatar },
        }),
      });
      const data = await res.json();
      if (data.success && data.room) {
        setOnlineRoom(data.room);
        const role = data.room.playerBlack?.id === playerId ? 'B' : 'W';
        setMyOnlineRole(role);
        setMode('online_room');
        setShowShareModal(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // ----------------- ONLINE MATCHMAKING -----------------

  const startMatchmaking = async () => {
    if (!playerName.trim()) return;
    setIsMatchmaking(true);

    try {
      const res = await fetch('/api/matchmaking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          playerId,
          playerName: playerName.trim(),
          avatar,
        }),
      });
      const data = await res.json();
      if (data.status === 'matched' && data.roomId) {
        setIsMatchmaking(false);
        await joinOnlineRoom(data.roomId);
      }
    } catch (err) {
      console.error('Start matchmaking error:', err);
      setIsMatchmaking(false);
    }
  };

  const cancelMatchmaking = async () => {
    setIsMatchmaking(false);
    try {
      await fetch('/api/matchmaking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave', playerId }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Poll matchmaking queue if searching (Fast 400ms polling for instant match)
  useEffect(() => {
    if (!isMatchmaking) return;

    let isSubscribed = true;
    let timerId: NodeJS.Timeout;

    const pollQueue = async () => {
      if (!isSubscribed) return;
      try {
        const res = await fetch('/api/matchmaking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'poll', playerId }),
        });
        const data = await res.json();
        if (isSubscribed && data.status === 'matched' && data.roomId) {
          setIsMatchmaking(false);
          await joinOnlineRoom(data.roomId);
          return;
        }
      } catch (err) {
        console.error('Matchmaking poll error:', err);
      }

      if (isSubscribed) {
        timerId = setTimeout(pollQueue, 400);
      }
    };

    timerId = setTimeout(pollQueue, 400);

    return () => {
      isSubscribed = false;
      clearTimeout(timerId);
    };
  }, [isMatchmaking, playerId, joinOnlineRoom]);

  // ----------------- ONLINE ROOM POLLING (ZERO-DELAY SYNC) -----------------

  const prevMoveRef = useRef<number>(0);
  const roomId = onlineRoom?.id;
  const isOnlineGameOver = onlineRoom?.isGameOver;
  const currentRoomTurn = onlineRoom?.currentTurn;
  const roomStatus = onlineRoom?.status;

  useEffect(() => {
    if (mode !== 'online_room' || !roomId) return;

    let isSubscribed = true;
    let pollTimer: NodeJS.Timeout;

    const fetchRoomState = async () => {
      if (!isSubscribed) return;

      try {
        const res = await fetch(`/api/rooms/${roomId}?playerId=${playerId}`);
        const data = await res.json();
        if (isSubscribed && data.success && data.room) {
          const room: GameRoom = data.room;

          // Sound triggers on new opponent move
          const moveLen = room.moveHistory.length;
          if (moveLen > prevMoveRef.current) {
            const lastM = room.moveHistory[moveLen - 1];
            if (lastM && lastM.player !== myOnlineRole) {
              sounds.playStoneClack();
              if (lastM.flippedCount > 0) {
                sounds.playFlipStone(lastM.flippedCount);
              }
              if (room.currentTurn === myOnlineRole && !room.isGameOver) {
                sounds.playTurnAlert();
              }
            }
            prevMoveRef.current = moveLen;
          }

          if (room.isGameOver && !isOnlineGameOver) {
            sounds.playVictory();
          }

          // Calculate time left (45s max per turn)
          const elapsed = (Date.now() - room.turnStartTime) / 1000;
          const remaining = Math.max(0, Math.floor(room.turnDurationSeconds - elapsed));
          setTurnTimeLeft(remaining);

          // Auto-close matchmaking/waiting and show game start
          if (room.status === 'playing' && onlineRoom?.status !== 'playing') {
            setShowGameStart(true);
            setTimeout(() => setShowGameStart(false), 1500);
            if (isMatchmaking) setIsMatchmaking(false);
            setShowShareModal(false);
          }
          
          // Handle disconnection immediately
          if (room.status === 'playing' && 
              ((onlineRoom?.playerBlack?.connected && !room.playerBlack?.connected) ||
               (onlineRoom?.playerWhite?.connected && !room.playerWhite?.connected))) {
            // Server should have triggered surrender, we just update UI
          }

          setOnlineRoom(room);
        }
      } catch (err) {
        console.error('Polling room error:', err);
      }

      if (isSubscribed) {
        // Fast 300ms polling when waiting for opponent move!
        // 800ms when waiting for user to move or game is ended
        const isWaitingForOpponent = roomStatus === 'playing' && currentRoomTurn !== myOnlineRole && !isOnlineGameOver;
        const intervalMs = isWaitingForOpponent ? 300 : 800;
        pollTimer = setTimeout(fetchRoomState, intervalMs);
      }
    };

    fetchRoomState();

    return () => {
      isSubscribed = false;
      clearTimeout(pollTimer);
    };
  }, [mode, roomId, playerId, myOnlineRole, isOnlineGameOver, currentRoomTurn, roomStatus, isMatchmaking, onlineRoom?.status]);

  // ----------------- ONLINE MOVE ACTIONS (OPTIMISTIC 0MS RESPONSE) -----------------

  const handleOnlineMove = async (r: number, c: number) => {
    if (!onlineRoom || onlineRoom.status !== 'playing' || onlineRoom.isGameOver) return;
    if (onlineRoom.currentTurn !== myOnlineRole) return;
    if (onlineRoom.board[r][c] !== null) return;

    // 1. Instant sound feedback on tap
    sounds.playStoneClack();

    const myRole = myOnlineRole;
    const opponentRole: StoneColor = myRole === 'B' ? 'W' : 'B';
    const flipped = getFlippedStones(onlineRoom.board, r, c, myRole);
    if (flipped.length > 0) {
      sounds.playFlipStone(flipped.length);
    }

    // 2. Instant Optimistic Board Update (0ms delay on player's screen!)
    const moveResult = applyMove(onlineRoom.board, r, c, myRole);
    if (!moveResult) return;
    const optimisticBoard = moveResult.newBoard;
    const counts = countStones(optimisticBoard);
    const prevRoomSnapshot = onlineRoom;

    setOnlineRoom((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        board: optimisticBoard,
        currentTurn: opponentRole,
        blackCount: counts.black,
        whiteCount: counts.white,
        lastMove: { r, c, player: myRole },
        lastFlipped: flipped,
        turnStartTime: Date.now(),
      };
    });
    setTurnTimeLeft(45);

    // 3. Dispatch move to server
    try {
      const res = await fetch(`/api/rooms/${onlineRoom.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'move',
          playerId,
          r,
          c,
        }),
      });
      const data = await res.json();
      if (data.success && data.room) {
        setOnlineRoom(data.room);
      } else {
        // Rollback on rejection
        setOnlineRoom(prevRoomSnapshot);
        sounds.playInvalid();
      }
    } catch (err) {
      console.error('Online move error:', err);
      setOnlineRoom(prevRoomSnapshot);
      sounds.playInvalid();
    }
  };

  const handleOnlineSurrender = async () => {
    if (!onlineRoom || onlineRoom.isGameOver) return;
    const confirmSurrender = window.confirm('Bạn có chắc chắn muốn nhận thua không?');
    if (!confirmSurrender) return;

    try {
      const res = await fetch(`/api/rooms/${onlineRoom.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'surrender',
          playerId,
        }),
      });
      const data = await res.json();
      if (data.success && data.room) {
        setOnlineRoom(data.room);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOnlineRematch = async () => {
    if (!onlineRoom) return;
    setRematchSent(true);

    try {
      const res = await fetch(`/api/rooms/${onlineRoom.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rematch',
          playerId,
        }),
      });
      const data = await res.json();
      if (data.success && data.room) {
        setOnlineRoom(data.room);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOnlineChat = async (text: string) => {
    if (!onlineRoom) return;
    try {
      await fetch(`/api/rooms/${onlineRoom.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          playerId,
          text,
        }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  // ----------------- LOCAL & AI GAME LOGIC -----------------

  const startLocalGame = () => {
    setBoard(createInitialBoard(8));
    setCurrentTurn('B');
    setLastMove(null);
    setLastFlipped([]);
    setIsGameOver(false);
    setWinner(null);
    setWinReason(undefined);
    setMode('local');
    localTurnStartTimeRef.current = Date.now();
    setTurnTimeLeft(45);
    sounds.playTurnAlert();
  };

  const startAiGame = (difficulty: AIDifficulty = 'medium') => {
    setAiDifficulty(difficulty);
    setBoard(createInitialBoard(8));
    setCurrentTurn('B'); // Player is Black, AI is White
    setLastMove(null);
    setLastFlipped([]);
    setIsGameOver(false);
    setWinner(null);
    setWinReason(undefined);
    setIsAiThinking(false);
    setMode('ai');
    localTurnStartTimeRef.current = Date.now();
    setTurnTimeLeft(45);
    sounds.playTurnAlert();
  };

  const handleLocalOrAiMove = useCallback(
    (r: number, c: number) => {
      if (isGameOver || isAiThinking) return;

      const result = applyMove(board, r, c, currentTurn);
      if (!result) {
        sounds.playInvalid();
        return;
      }

      sounds.playStoneClack();
      if (result.flipped.length > 0) {
        sounds.playFlipStone(result.flipped.length);
      }

      localTurnStartTimeRef.current = Date.now();
      setTurnTimeLeft(45);
      setBoard(result.newBoard);
      setLastMove({ r, c, player: currentTurn });
      setLastFlipped(result.flipped);
      setCurrentTurn(result.nextColor);

      if (result.isGameOver) {
        setIsGameOver(true);
        setWinner(result.winner);
        const { black, white } = countStones(result.newBoard);
        setWinReason(
          result.winner === 'DRAW'
            ? 'Hai bên bằng điểm nhau!'
            : result.winner === 'B'
            ? `Quân Đen thắng với ${black} quân!`
            : `Quân Trắng thắng với ${white} quân!`
        );
        sounds.playVictory();
      } else if (mode === 'ai' && result.nextColor === 'W') {
        setIsAiThinking(true);
      }
    },
    [board, currentTurn, isGameOver, isAiThinking, mode]
  );

  // Trigger AI move when it's AI's turn (White)
  useEffect(() => {
    if (mode !== 'ai' || isGameOver || currentTurn !== 'W') return;

    const timer = setTimeout(() => {
      const aiPos = getAIMove(board, 'W', aiDifficulty);
      if (aiPos) {
        const res = applyMove(board, aiPos.r, aiPos.c, 'W');
        if (res) {
          sounds.playStoneClack();
          if (res.flipped.length > 0) {
            sounds.playFlipStone(res.flipped.length);
          }
          localTurnStartTimeRef.current = Date.now();
          setTurnTimeLeft(45);
          setBoard(res.newBoard);
          setLastMove({ r: aiPos.r, c: aiPos.c, player: 'W' });
          setLastFlipped(res.flipped);
          setCurrentTurn(res.nextColor);

          if (res.isGameOver) {
            setIsGameOver(true);
            setWinner(res.winner);
            const { black, white } = countStones(res.newBoard);
            setWinReason(
              res.winner === 'DRAW'
                ? 'Hai bên hòa cờ!'
                : res.winner === 'W'
                ? `AI (${aiDifficulty === 'hard' ? 'Cao Thủ' : 'Máy'}) đã thắng với ${white} quân!`
                : `Bạn đã xuất sắc đánh bại AI với ${black} quân!`
            );
            sounds.playVictory();
          }
        }
      }
      setIsAiThinking(false);
    }, 600);

    return () => clearTimeout(timer);
  }, [mode, currentTurn, board, isGameOver, aiDifficulty]);

  // ----------------- 45-SECOND TURN TIMER WITH FORFEITURE -----------------

  // Smooth client ticker for Online Mode
  const onlineTurnStartTime = onlineRoom?.turnStartTime;
  const onlineRoomStatus = onlineRoom?.status;
  const onlineRoomIsGameOver = onlineRoom?.isGameOver;

  useEffect(() => {
    if (mode !== 'online_room' || !onlineTurnStartTime || onlineRoomStatus !== 'playing' || onlineRoomIsGameOver) {
      return;
    }

    const timer = setInterval(() => {
      const elapsed = (Date.now() - onlineTurnStartTime) / 1000;
      const remaining = Math.max(0, Math.floor(45 - elapsed));
      setTurnTimeLeft(remaining);
    }, 500);

    return () => clearInterval(timer);
  }, [mode, onlineTurnStartTime, onlineRoomStatus, onlineRoomIsGameOver]);

  // Active 45s Countdown & Loss-by-Timeout for AI & Local modes
  useEffect(() => {
    if (mode !== 'local' && mode !== 'ai') return;
    if (isGameOver) return;

    const interval = setInterval(() => {
      if (!localTurnStartTimeRef.current) {
        localTurnStartTimeRef.current = Date.now();
      }
      const elapsed = Math.floor((Date.now() - localTurnStartTimeRef.current) / 1000);
      const remaining = Math.max(0, 45 - elapsed);
      setTurnTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        setIsGameOver(true);

        if (mode === 'ai') {
          if (currentTurn === 'B') {
            setWinner('W');
            setWinReason('Hết giờ! Bạn đã quá thời gian 45 giây và bị xử thua!');
            sounds.playInvalid();
          } else {
            setWinner('B');
            setWinReason('Hết giờ! AI đã quá thời gian 45 giây và bị xử thua!');
            sounds.playVictory();
          }
        } else if (mode === 'local') {
          if (currentTurn === 'B') {
            setWinner('W');
            setWinReason('Hết giờ! Người chơi 1 (Quân Đen) đã quá thời gian 45 giây và bị xử thua!');
          } else {
            setWinner('B');
            setWinReason('Hết giờ! Người chơi 2 (Quân Trắng) đã quá thời gian 45 giây và bị xử thua!');
          }
          sounds.playVictory();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [mode, currentTurn, isGameOver]);

  const handleExitToLobby = async () => {
    if (mode === 'online_room' && onlineRoom) {
      try {
        await fetch(`/api/rooms/${onlineRoom.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'leave',
            playerId,
          }),
        });
      } catch (err) {
        console.error('Error leaving room:', err);
      }
    }
    setMode('lobby');
    setOnlineRoom(null);
    setMyOnlineRole(null);
    setRematchSent(false);
    setIsMatchmaking(false);
  };

  // Compute counts & valid moves based on active mode
  const activeBoard = mode === 'online_room' ? onlineRoom?.board ?? board : board;
  const activeTurn = mode === 'online_room' ? onlineRoom?.currentTurn ?? 'B' : currentTurn;
  const activeCounts = countStones(activeBoard);

  const myColor =
    mode === 'online_room'
      ? myOnlineRole
      : mode === 'ai'
      ? 'B'
      : null;

  const isMyTurn =
    mode === 'online_room'
      ? onlineRoom?.status === 'playing' &&
        !onlineRoom?.isGameOver &&
        onlineRoom?.currentTurn === myOnlineRole
      : mode === 'ai'
      ? currentTurn === 'B' && !isAiThinking && !isGameOver
      : !isGameOver;

  const validMoves = isMyTurn ? getValidMoves(activeBoard, activeTurn) : [];

  return (
    <main className="min-h-screen bg-[#F5F1E8] text-[#1F1C19] flex flex-col items-center justify-between p-3 sm:p-6 selection:bg-[#A83226] selection:text-white">
      {/* -------------------- LOBBY VIEW (Paper / Xuan paper aesthetic, NO gradients) -------------------- */}
      {mode === 'lobby' ? (
        <div className="w-full max-w-xl mx-auto flex flex-col items-center justify-center my-auto py-4">
          {/* Editorial Header (Natural typography, no sparkles or tech pills) */}
          <div className="text-center mb-6">
            <div className="text-[11px] font-bold text-[#7A5432] tracking-widest uppercase mb-1">
              Kỳ Đạo Đối Kháng
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-[#1F1C19]">
              CỜ VÂY KẸP QUÂN
            </h1>
            <p className="text-xs sm:text-sm text-[#5C554E] mt-2 max-w-md mx-auto">
              Chặn hai đầu lật quân đối phương · Chiếm lĩnh kỳ bàn 8x8
            </p>
          </div>

          {/* Player Profile Card (Washi paper tile with tactile borders) */}
          <div className="w-full bg-[#FAF6F0] border border-[#DDD3C2] rounded-2xl p-4 sm:p-5 shadow-xs mb-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B635A]">
                Thông tin kỳ thủ
              </span>
              <button
                onClick={handleRandomizeName}
                className="flex items-center gap-1 text-xs text-[#7A5432] hover:text-[#52371E] font-semibold transition-colors"
              >
                <Dice5 className="w-3.5 h-3.5" />
                <span>Đổi tên ngẫu nhiên</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              {/* Avatar display box */}
              <div className="relative shrink-0">
                <div className="w-14 h-14 rounded-xl bg-[#F0EAE0] border-2 border-[#1F1C19] flex items-center justify-center text-3xl shadow-xs select-none">
                  {avatar}
                </div>
              </div>

              {/* Name input */}
              <div className="flex-1">
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => savePlayerProfile(e.target.value, avatar)}
                  placeholder="Nhập tên của bạn..."
                  maxLength={20}
                  className="w-full bg-[#F4EFE6] text-[#1F1C19] font-bold text-sm sm:text-base px-3.5 py-2.5 rounded-xl border border-[#D5CCBC] focus:outline-none focus:border-[#1F1C19] transition-colors"
                />
              </div>
            </div>

            {/* 16-Avatar Grid (Clean 8x2 grid on paper) */}
            <div className="mt-3 pt-3 border-t border-[#DDD3C2]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-[#6B635A]">
                  Chọn biểu tượng:
                </span>
                <span className="text-[11px] text-[#7A5432] font-medium">
                  {avatar} Đang chọn
                </span>
              </div>
              <div className="grid grid-cols-8 gap-1.5 sm:gap-2">
                {AVATARS.map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => savePlayerProfile(playerName, av)}
                    className={`h-9 sm:h-10 rounded-lg flex items-center justify-center text-xl transition-all cursor-pointer ${
                      avatar === av
                        ? 'bg-[#24201D] text-white border-2 border-[#161412] shadow-xs scale-105'
                        : 'bg-[#F0EAE0] hover:bg-[#E5DECF] border border-[#DDD3C2] text-[#1F1C19]'
                    }`}
                    title={`Chọn biểu tượng ${av}`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action Cards (Solid, grounded buttons - NO gradients!) */}
          <div className="w-full flex flex-col gap-2.5">
            {/* 1. Quick Match Online: Elegant Sumi-e ink black button (calm, non-glaring, paper-harmonious) */}
            <button
              onClick={startMatchmaking}
              className="w-full p-4 rounded-xl bg-[#24201D] hover:bg-[#36312C] active:bg-[#1A1715] text-[#FAF7F0] font-bold text-base transition-colors flex items-center justify-between border-2 border-[#161412] shadow-xs group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#181614] border border-[#3D3730] flex items-center justify-center text-[#FAF7F0]">
                  <Swords className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-base font-black leading-tight tracking-wide text-[#FAF7F0]">
                    GHÉP TRẬN ONLINE
                  </div>
                  <div className="text-xs text-[#A8A094] font-medium">
                    Tìm đối thủ trực tuyến theo thời gian thực
                  </div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-[#C8BFB2] transition-transform group-hover:translate-x-1" />
            </button>

            {/* 2. Custom Room (Create or Join) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={createCustomRoom}
                className="p-3.5 bg-[#FAF6F0] hover:bg-[#F2ECE0] border border-[#DDD3C2] hover:border-[#1F1C19] rounded-xl transition-colors flex items-center gap-3 text-left shadow-xs group"
              >
                <div className="p-2 rounded-lg bg-[#EFE8DC] text-[#1F1C19] border border-[#D5CCBC]">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs sm:text-sm text-[#1F1C19]">
                    Tạo phòng thi đấu
                  </div>
                  <div className="text-[11px] text-[#6B635A]">Mời bạn bè qua mã/link</div>
                </div>
              </button>

              <div className="p-3 bg-[#FAF6F0] border border-[#DDD3C2] rounded-xl flex flex-col justify-between shadow-xs">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <LogIn className="w-3.5 h-3.5 text-[#5C544B]" />
                  <span className="font-bold text-xs text-[#1F1C19]">Vào bằng mã phòng:</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={joinCodeInput}
                    onChange={(e) => {
                      setJoinCodeInput(e.target.value.toUpperCase());
                      setJoinError('');
                    }}
                    placeholder="MÃ PHÒNG"
                    maxLength={6}
                    className="w-full bg-[#F4EFE6] text-[#1F1C19] font-mono font-bold text-xs px-2.5 py-1.5 rounded-lg border border-[#D5CCBC] uppercase tracking-wider focus:outline-none focus:border-[#1F1C19]"
                  />
                  <button
                    onClick={() => joinOnlineRoom()}
                    className="px-3 py-1.5 bg-[#1F1C19] hover:bg-[#38332E] text-white text-xs font-bold rounded-lg transition-colors border border-[#141210]"
                  >
                    Vào
                  </button>
                </div>
                {joinError && <div className="text-[10px] text-[#7A5432] mt-1 font-semibold">{joinError}</div>}
              </div>
            </div>

            {/* 3. AI & Local Modes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Play with AI */}
              <div className="p-3 bg-[#FAF6F0] border border-[#DDD3C2] rounded-xl shadow-xs">
                <div className="flex items-center gap-1.5 mb-2">
                  <Bot className="w-4 h-4 text-[#5C544B]" />
                  <span className="font-bold text-xs text-[#1F1C19]">Luyện tập với AI</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => startAiGame('easy')}
                    className="py-1.5 bg-[#EFE8DC] hover:bg-[#E5DECF] text-[#2C2723] rounded-lg text-xs font-semibold transition-colors border border-[#D5CCBC]"
                  >
                    Dễ
                  </button>
                  <button
                    onClick={() => startAiGame('medium')}
                    className="py-1.5 bg-[#EFE8DC] hover:bg-[#E5DECF] text-[#2C2723] rounded-lg text-xs font-semibold transition-colors border border-[#D5CCBC]"
                  >
                    Thường
                  </button>
                  <button
                    onClick={() => startAiGame('hard')}
                    className="py-1.5 bg-[#1F1C19] hover:bg-[#38332E] text-white rounded-lg text-xs font-bold transition-colors border border-[#141210]"
                  >
                    Cao Thủ
                  </button>
                </div>
              </div>

              {/* Pass and Play Local */}
              <button
                onClick={startLocalGame}
                className="p-3.5 bg-[#FAF6F0] hover:bg-[#F2ECE0] border border-[#DDD3C2] hover:border-[#1F1C19] rounded-xl transition-colors flex items-center gap-3 text-left shadow-xs group"
              >
                <div className="p-2 rounded-lg bg-[#EFE8DC] text-[#1F1C19] border border-[#D5CCBC]">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs sm:text-sm text-[#1F1C19]">
                    Chơi 2 người trên máy
                  </div>
                  <div className="text-[11px] text-[#6B635A]">Đấu cờ cùng bạn trên cùng thiết bị</div>
                </div>
              </button>
            </div>
          </div>

          {/* Footer Controls: Rules & Audio */}
          <div className="flex items-center justify-between w-full mt-6 px-1 text-xs text-[#6B635A]">
            <button
              onClick={() => setShowRules(true)}
              className="flex items-center gap-1.5 hover:text-[#1F1C19] transition-colors"
            >
              <HelpCircle className="w-4 h-4 text-[#7A5432]" />
              <span>Xem luật chơi cờ</span>
            </button>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="flex items-center gap-1.5 hover:text-[#1F1C19] transition-colors"
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-[#2E6B34]" />
                  <span>Âm thanh: Bật</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-[#8C8478]" />
                  <span>Âm thanh: Tắt</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* -------------------- IN-GAME VIEW (Paper Desk Setting) -------------------- */
        <div className="w-full max-w-2xl mx-auto flex flex-col items-center py-1 sm:py-2">
          {/* Header Bar */}
          <GameHeader
            playerBlack={
              mode === 'online_room'
                ? {
                    name: onlineRoom?.playerBlack?.name || 'Đang chờ...',
                    avatar: onlineRoom?.playerBlack?.avatar || '⌛',
                  }
                : mode === 'ai'
                ? { name: playerName, avatar }
                : { name: 'Người chơi 1 (Đen)', avatar: '🥋' }
            }
            playerWhite={
              mode === 'online_room'
                ? {
                    name: onlineRoom?.playerWhite?.name || 'Đang chờ...',
                    avatar: onlineRoom?.playerWhite?.avatar || '⌛',
                  }
                : mode === 'ai'
                ? {
                    name: `AI (${aiDifficulty === 'hard' ? 'Cao Thủ' : aiDifficulty === 'medium' ? 'Thường' : 'Dễ'})`,
                    avatar: '🤖',
                  }
                : { name: 'Người chơi 2 (Trắng)', avatar: '⚔️' }
            }
            blackCount={activeCounts.black}
            whiteCount={activeCounts.white}
            currentTurn={activeTurn}
            myColor={myColor}
            modeLabel={
              mode === 'online_room'
                ? `Phòng ${onlineRoom?.id}`
                : mode === 'ai'
                ? `Đấu với AI (${aiDifficulty.toUpperCase()})`
                : '2 Người Cục Bộ'
            }
            roomCode={mode === 'online_room' ? onlineRoom?.id : undefined}
            timeLeft={
              mode === 'online_room'
                ? onlineRoom?.status === 'playing' && !onlineRoom?.isGameOver
                  ? turnTimeLeft
                  : undefined
                : !isGameOver
                ? turnTimeLeft
                : undefined
            }
            soundEnabled={soundEnabled}
            onToggleSound={() => setSoundEnabled(!soundEnabled)}
            onOpenRules={() => setShowRules(true)}
            onShareRoom={() => setShowShareModal(true)}
            onSurrender={mode === 'online_room' ? handleOnlineSurrender : undefined}
            onExit={handleExitToLobby}
            onRestartLocal={mode === 'local' ? startLocalGame : undefined}
            isLocalMode={mode === 'local'}
          />

          {/* Waiting For Opponent Banner */}
          {mode === 'online_room' && onlineRoom?.status === 'waiting' && (
            <div className="w-full bg-[#FAF6EF] border border-[#DDD3C2] rounded-xl p-3.5 mb-2 text-center shadow-xs">
              <div className="flex items-center justify-center gap-2 text-[#1F1C19] font-bold text-xs mb-1">
                <span className="w-2 h-2 rounded-full bg-[#24201D] animate-ping" />
                <span>Đang chờ đối thủ vào phòng {onlineRoom.id}...</span>
              </div>
              <p className="text-[11px] text-[#6B635A] mb-2.5">
                Gửi mã phòng <strong>{onlineRoom.id}</strong> cho bạn bè để bắt đầu ván cờ.
              </p>
              <button
                onClick={() => setShowShareModal(true)}
                className="px-3.5 py-1.5 bg-[#24201D] hover:bg-[#36312C] text-white font-bold text-xs rounded-lg transition-colors border border-[#161412]"
              >
                Chia sẻ mã phòng / link
              </button>
            </div>
          )}

          {/* Status Bar (Fixed height to prevent layout jump) */}
          <div className="h-6 w-full flex items-center justify-center mb-1 text-xs">
            {mode === 'ai' && isAiThinking ? (
              <div className="text-[#24201D] flex items-center gap-1.5 font-bold">
                <Bot className="w-3.5 h-3.5" />
                <span>AI đang tính toán nước đi...</span>
              </div>
            ) : (
              <div className="text-[#5C544B]">
                {isMyTurn ? (
                  <span className="text-[#24201D] font-bold">
                    Lượt của bạn ({activeTurn === 'B' ? 'Quân Đen' : 'Quân Trắng'})
                  </span>
                ) : (
                  <span>
                    Chờ đối thủ ({activeTurn === 'B' ? 'Quân Đen' : 'Quân Trắng'}) đi...
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Goban Board View */}
          <GobanBoard
            board={activeBoard}
            currentTurn={activeTurn}
            myColor={myColor}
            validMoves={validMoves}
            lastMove={mode === 'online_room' ? onlineRoom?.lastMove ?? null : lastMove}
            lastFlipped={mode === 'online_room' ? onlineRoom?.lastFlipped ?? [] : lastFlipped}
            isMyTurn={isMyTurn}
            disabled={
              (mode === 'online_room' && onlineRoom?.status !== 'playing') ||
              isAiThinking ||
              (mode === 'online_room' ? onlineRoom?.isGameOver : isGameOver)
            }
            onMakeMove={(r, c) => {
              if (mode === 'online_room') {
                handleOnlineMove(r, c);
              } else {
                handleLocalOrAiMove(r, c);
              }
            }}
          />

          {/* In-game Chat (Online Room Mode) */}
          {mode === 'online_room' && onlineRoom && (
            <InGameChat
              messages={onlineRoom.chatMessages}
              currentUserId={playerId}
              onSendMessage={handleOnlineChat}
            />
          )}
        </div>
      )}

      {/* -------------------- MODALS -------------------- */}

      {/* 1. Matchmaking Radar Modal */}
      <MatchmakingModal
        isOpen={isMatchmaking}
        playerName={playerName}
        avatar={avatar}
        onCancel={cancelMatchmaking}
        onPlayWithBot={() => {
          cancelMatchmaking();
          startAiGame('hard');
        }}
      />

      {/* 2. Room Share Modal */}
      {onlineRoom && (
        <RoomShareModal
          isOpen={showShareModal}
          roomCode={onlineRoom.id}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* 3. Rules Modal */}
      <RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />

      {/* Game Start Notification */}
      {showGameStart && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none">
          <div className="bg-green-600 text-white px-8 py-4 rounded-full text-2xl font-bold animate-start-fade-out shadow-lg">
            BẮT ĐẦU
          </div>
        </div>
      )}

      {/* 4. Game Over Modal */}
      <GameOverModal
        isOpen={
          mode === 'online_room'
            ? !!onlineRoom?.isGameOver
            : isGameOver
        }
        winner={mode === 'online_room' ? onlineRoom?.winner ?? null : winner}
        winReason={mode === 'online_room' ? onlineRoom?.winReason : winReason}
        blackCount={activeCounts.black}
        whiteCount={activeCounts.white}
        playerBlack={
          mode === 'online_room'
            ? {
                name: onlineRoom?.playerBlack?.name || 'Quân Đen',
                avatar: onlineRoom?.playerBlack?.avatar || '🥋',
              }
            : mode === 'ai'
            ? { name: playerName, avatar }
            : { name: 'Người chơi 1 (Đen)', avatar: '🥋' }
        }
        playerWhite={
          mode === 'online_room'
            ? {
                name: onlineRoom?.playerWhite?.name || 'Quân Trắng',
                avatar: onlineRoom?.playerWhite?.avatar || '⚔️',
              }
            : mode === 'ai'
            ? { name: 'AI Cao Thủ', avatar: '🤖' }
            : { name: 'Người chơi 2 (Trắng)', avatar: '⚔️' }
        }
        myColor={myColor}
        rematchRequested={
          mode === 'online_room'
            ? (myOnlineRole === 'B'
                ? onlineRoom?.playerBlack?.rematchRequested
                : onlineRoom?.playerWhite?.rematchRequested) || rematchSent
            : false
        }
        onRematch={() => {
          if (mode === 'online_room') {
            handleOnlineRematch();
          } else if (mode === 'ai') {
            startAiGame(aiDifficulty);
          } else {
            startLocalGame();
          }
        }}
        onExit={handleExitToLobby}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <Loader2 className="w-10 h-10 animate-spin text-white" />
        </div>
      )}
    </main>
  );
}
