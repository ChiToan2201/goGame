'use client';

import { StoneColor } from './game-engine';

export type P2PMessage =
  | { type: 'READY'; playerId: string; name: string; avatar: string }
  | { type: 'MOVE'; r: number; c: number; playerId: string; playerColor: StoneColor }
  | { type: 'SURRENDER'; playerId: string }
  | { type: 'REMATCH_REQUEST'; playerId: string }
  | { type: 'REMATCH_ACCEPT' }
  | { type: 'CHAT'; id: string; senderName: string; senderId: string; text: string; time: string; color?: StoneColor }
  | { type: 'LEAVE'; playerId: string }
  | { type: 'PING'; timestamp: number }
  | { type: 'PONG'; timestamp: number };

export interface P2PEvents {
  onConnected?: (opponentName?: string) => void;
  onDisconnected?: () => void;
  onMoveReceived?: (r: number, c: number, playerColor: StoneColor) => void;
  onSurrenderReceived?: (playerId: string) => void;
  onRematchRequested?: (playerId: string) => void;
  onRematchAccepted?: () => void;
  onChatReceived?: (msg: { id: string; senderName: string; senderId: string; text: string; time: string; color?: StoneColor }) => void;
}

/**
 * Lightweight Zero-Dependency Broadcast & Local Peer Channel
 * Uses native Web BroadcastChannel for zero-latency multi-tab sync
 */
export class P2PGameSync {
  private channel: BroadcastChannel | null = null;
  private roomId: string = '';
  private myPlayerId: string = '';
  private isDestroyed: boolean = false;
  private events: P2PEvents = {};

  constructor(events: P2PEvents = {}) {
    this.events = events;
  }

  init(roomId: string, isHost: boolean, myPlayerId: string, myName: string, myAvatar: string) {
    if (typeof window === 'undefined') return;
    this.roomId = roomId.toUpperCase();
    this.myPlayerId = myPlayerId;
    this.isDestroyed = false;

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.channel = new BroadcastChannel(`flank_room_${this.roomId}`);
        this.channel.onmessage = (event) => {
          if (this.isDestroyed || !event.data) return;
          const msg = event.data as P2PMessage & { senderPlayerId?: string };
          // Don't process messages from ourselves
          if (msg.senderPlayerId === this.myPlayerId) return;

          switch (msg.type) {
            case 'READY':
              this.events.onConnected?.(msg.name);
              break;
            case 'MOVE':
              this.events.onMoveReceived?.(msg.r, msg.c, msg.playerColor);
              break;
            case 'SURRENDER':
              this.events.onSurrenderReceived?.(msg.playerId);
              break;
            case 'REMATCH_REQUEST':
              this.events.onRematchRequested?.(msg.playerId);
              break;
            case 'REMATCH_ACCEPT':
              this.events.onRematchAccepted?.();
              break;
            case 'CHAT':
              this.events.onChatReceived?.({
                id: msg.id,
                senderName: msg.senderName,
                senderId: msg.senderId,
                text: msg.text,
                time: msg.time,
                color: msg.color,
              });
              break;
            case 'LEAVE':
              this.events.onDisconnected?.();
              break;
          }
        };

        this.send({
          type: 'READY',
          playerId: myPlayerId,
          name: myName,
          avatar: myAvatar,
        });
      }
    } catch (e) {
      console.warn('Native channel initialization:', e);
    }
  }

  send(msg: P2PMessage): boolean {
    if (this.channel && !this.isDestroyed) {
      try {
        this.channel.postMessage({
          ...msg,
          senderPlayerId: this.myPlayerId,
        });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  destroy() {
    this.isDestroyed = true;
    try {
      if (this.channel) {
        this.channel.close();
        this.channel = null;
      }
    } catch {
      // Safe catch
    }
  }
}
