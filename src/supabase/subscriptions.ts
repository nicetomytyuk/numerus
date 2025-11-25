import { supabase } from './client';
import type { MessageRow, PlayerRow, RoomRow } from './types';

export const subscribeToPlayers = (
  roomId: string,
  handler: (payload: { type: 'INSERT' | 'UPDATE' | 'DELETE'; record: PlayerRow }) => void
) => {
  if (!supabase) return null;
  const channel = supabase
    .channel(`room-players-${roomId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` },
      (payload) => {
        const record = (payload.new || payload.old) as PlayerRow | null;
        if (!record) return;
        handler({ type: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE', record });
      }
    )
    .subscribe();
  return channel;
};

export const subscribeToMessages = (
  roomId: string,
  handler: (payload: { type: 'INSERT' | 'DELETE'; record: MessageRow }) => void
) => {
  if (!supabase) return null;
  const channel = supabase
    .channel(`room-messages-${roomId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'room_messages', filter: `room_id=eq.${roomId}` },
      (payload) => {
        const record = (payload.new || payload.old) as MessageRow | null;
        if (!record) return;
        handler({ type: payload.eventType as 'INSERT' | 'DELETE', record });
      }
    )
    .subscribe();
  return channel;
};

export const subscribeToRoom = (
  roomId: string,
  handler: (payload: { type: 'UPDATE'; record: RoomRow }) => void
) => {
  if (!supabase) return null;
  const channel = supabase
    .channel(`room-${roomId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
      (payload) => {
        const record = payload.new as RoomRow | null;
        if (!record) return;
        handler({ type: 'UPDATE', record });
      }
    )
    .subscribe();
  return channel;
};
