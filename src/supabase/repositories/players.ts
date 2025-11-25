import { supabase } from '../client';
import type { PlayerRow } from '../types';

export const listPlayers = async (roomId: string): Promise<PlayerRow[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('room_players')
    .select('*')
    .eq('room_id', roomId)
    .order('turn_order', { ascending: true });
  if (error) throw error;
  return data as PlayerRow[];
};

export const addPlayer = async (params: {
  roomId: string;
  name: string;
  isBot?: boolean;
  turnOrder: number;
  isOwner?: boolean;
}): Promise<PlayerRow | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('room_players')
    .insert({
      room_id: params.roomId,
      name: params.name,
      is_bot: params.isBot ?? false,
      points: 0,
      turn_order: params.turnOrder,
      is_owner: params.isOwner ?? false
    })
    .select()
    .single();
  if (error) throw error;
  return data as PlayerRow;
};

export const updatePlayerPoints = async (playerId: string, points: number) => {
  if (!supabase) return;
  const { error } = await supabase.from('room_players').update({ points }).eq('id', playerId);
  if (error) throw error;
};

export const removePlayer = async (playerId: string) => {
  if (!supabase) return;
  const { error } = await supabase.from('room_players').delete().eq('id', playerId);
  if (error) throw error;
};
