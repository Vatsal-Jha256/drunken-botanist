import type { WebSocketLikeConstructor } from "@supabase/realtime-js";

type RealtimeTransportOptions = {
  realtime?: {
    transport: WebSocketLikeConstructor;
  };
};

export async function realtimeTransportOptions(): Promise<RealtimeTransportOptions> {
  if (typeof globalThis.WebSocket !== "undefined") return {};

  const { default: WebSocket } = await import("ws");
  return {
    realtime: {
      transport: WebSocket as unknown as WebSocketLikeConstructor,
    },
  };
}
