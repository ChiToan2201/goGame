import { NextRequest, NextResponse } from 'next/server';
import { multiplayerStore } from '@/lib/multiplayer-store';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const { searchParams } = new URL(req.url);
    const playerId = searchParams.get('playerId');

    // Register heartbeat first so the room timer sees an active connection
    if (playerId) {
      multiplayerStore.heartbeat(roomId, playerId);
    }

    const room = multiplayerStore.getRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: 'Phòng không tồn tại' }, { status: 404 });
    }

    return NextResponse.json({ success: true, room });
  } catch (error) {
    console.error('Fetch room error:', error);
    return NextResponse.json({ error: 'Lỗi tải phòng' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const body = await req.json();
    const { action, playerId, r, c, text } = body;

    if (!playerId) {
      return NextResponse.json({ error: 'Thiếu thông tin người chơi' }, { status: 400 });
    }

    // Refresh heartbeat on any player interaction
    multiplayerStore.heartbeat(roomId, playerId);

    if (action === 'move') {
      if (typeof r !== 'number' || typeof c !== 'number') {
        return NextResponse.json({ error: 'Tọa độ không hợp lệ' }, { status: 400 });
      }
      const result = multiplayerStore.makeMove(roomId, playerId, r, c);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, room: result.room });
    }

    if (action === 'chat') {
      if (!text || typeof text !== 'string') {
        return NextResponse.json({ error: 'Tin nhắn không hợp lệ' }, { status: 400 });
      }
      const result = multiplayerStore.sendChat(roomId, playerId, text);
      return NextResponse.json(result);
    }

    if (action === 'surrender') {
      const result = multiplayerStore.surrender(roomId, playerId);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, room: result.room });
    }

    if (action === 'rematch') {
      const result = multiplayerStore.requestRematch(roomId, playerId);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, room: result.room });
    }

    if (action === 'leave') {
      const result = multiplayerStore.leaveRoom(roomId, playerId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Action không hợp lệ' }, { status: 400 });
  } catch (error) {
    console.error('Room action error:', error);
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
  }
}
