import { NextRequest, NextResponse } from 'next/server';
import { multiplayerStore } from '@/lib/multiplayer-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, playerId, playerName, avatar } = body;

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 });
    }

    if (action === 'join') {
      const result = multiplayerStore.addToMatchmaking({
        id: playerId,
        name: playerName || 'Kỳ Thủ Vô Danh',
        avatar: avatar || '🥋',
      });
      return NextResponse.json(result);
    }

    if (action === 'poll') {
      const result = multiplayerStore.checkMatchmaking(playerId);
      return NextResponse.json(result);
    }

    if (action === 'leave') {
      multiplayerStore.removeFromMatchmaking(playerId);
      return NextResponse.json({ status: 'left' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Matchmaking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
