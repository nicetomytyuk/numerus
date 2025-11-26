import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./client";

type PresenceMeta = { playerId: string; name: string; roomId: string };

type PresenceHandlers = {
  onSync: (presentIds: Set<string>) => void;
  onLeave: (players: { playerId: string; name?: string }[]) => void;
};

export const createPresenceChannel = (
  roomId: string,
  playerId: string,
  playerName: string,
  handlers: PresenceHandlers
): RealtimeChannel | null => {
  if (!supabase) return null;

  const channel = supabase.channel(`room-presence-${roomId}`, {
    config: { presence: { key: playerId } },
  });

  channel.on("presence", { event: "sync" }, () => {
    const state = channel.presenceState<PresenceMeta>();
    const presentIds = new Set(
      Object.values(state)
        .flatMap((metas) => metas || [])
        .map((meta) => meta.playerId)
        .filter(Boolean)
    );
    handlers.onSync(presentIds);
  });

  channel.on("presence", { event: "leave" }, ({ leftPresences }) => {
    const leaving =
      (leftPresences ?? [])
        .map((meta) => {
          const cast = meta as PresenceMeta | { playerId?: string; name?: string };
          return { playerId: cast.playerId, name: cast.name };
        })
        .filter((meta) => Boolean(meta.playerId)) as { playerId: string; name?: string }[];
    if (leaving.length > 0) {
      handlers.onLeave(leaving);
    }
  });

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      void channel.track({ playerId, name: playerName, roomId });
    }
  });

  return channel;
};
