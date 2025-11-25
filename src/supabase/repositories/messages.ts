import { supabase } from '../client';
import type { MessageRow } from '../types';

export const addMessage = async (params: {
  roomId: string;
  playerId?: string | null;
  type: MessageRow['type'];
  text: string;
  number?: number;
  correctRoman?: string;
}): Promise<MessageRow | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('room_messages')
    .insert({
      room_id: params.roomId,
      player_id: params.playerId ?? null,
      type: params.type,
      text: params.text,
      number: params.number ?? null,
      correct_roman: params.correctRoman ?? null
    })
    .select()
    .single();
  if (error) throw error;
  return data as MessageRow;
};

export const listMessages = async (roomId: string): Promise<MessageRow[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('room_messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as MessageRow[];
};
