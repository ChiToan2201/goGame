import { NextRequest, NextResponse } from 'next/server';
import { multiplayerStore } from '@/lib/multiplayer-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, player, roomId, customCode } = body;

    if (!player || !player.id) {
      return NextResponse.json({ error: 'Player info required' }, { status: 400 });
    }

    if (action === 'create') {
      const room = multiplayerStore.createRoom(
        {
          id: player.id,
          name: player.name || 'Chủ phòng',
          avatar: player.avatar || '👑',
        },
        true,
        customCode
      );
      return NextResponse.json({ success: true, room });
    }

    if (action === 'join') {
      if (!roomId) {
        return NextResponse.json({ error: 'Mã phòng không được để trống' }, { status: 400 });
      }
      const result = multiplayerStore.joinRoom(roomId, player);
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: 404 });
      }
      return NextResponse.json({ success: true, room: result.room, role: result.role });
    }

    return NextResponse.json({ error: 'Action không hợp lệ' }, { status: 400 });
  } catch (error) {
    console.error('Room API error:', error);
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
  }
}
