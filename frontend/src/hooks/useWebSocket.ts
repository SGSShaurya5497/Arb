import { useEffect, useRef, useCallback } from 'react';
import type { WsMessage } from '../types/spread';

type WsStatus = 'connecting' | 'connected' | 'disconnected';

interface UseWebSocketOptions {
  onMessage: (msg: WsMessage) => void;
  onStatusChange?: (status: WsStatus) => void;
}

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS  = 30_000;

/**
 * useWebSocket
 *
 * Connects to /ws/spreads with exponential backoff on disconnect.
 * The caller never needs to manage the socket lifecycle — just pass
 * onMessage and react to incoming data.
 *
 * Reconnect strategy:
 *   attempt 1 → 1s
 *   attempt 2 → 2s
 *   attempt 3 → 4s
 *   attempt 4 → 8s
 *   ...caps at 30s
 */
export function useWebSocket({ onMessage, onStatusChange }: UseWebSocketOptions) {
  const socketRef    = useRef<WebSocket | null>(null);
  const attemptsRef  = useRef(0);
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destroyedRef = useRef(false); // set to true on unmount — prevents reconnect after cleanup

  const onMessageRef    = useRef(onMessage);
  const onStatusRef     = useRef(onStatusChange);
  onMessageRef.current  = onMessage;
  onStatusRef.current   = onStatusChange;

  const connect = useCallback(() => {
    if (destroyedRef.current) return;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    // In development: Vite proxies /ws → localhost:8000
    // In production: same-origin
    const url = `${protocol}://${window.location.host}/ws/spreads`;

    onStatusRef.current?.('connecting');
    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      attemptsRef.current = 0;
      onStatusRef.current?.('connected');
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as WsMessage;
        // Filter out server ping frames — the UI doesn't need them
        if ('type' in data && data.type === 'ping') return;
        onMessageRef.current(data);
      } catch {
        // Malformed JSON — ignore silently
      }
    };

    ws.onclose = () => {
      if (destroyedRef.current) return;
      onStatusRef.current?.('disconnected');
      // Exponential backoff
      const delay = Math.min(BASE_DELAY_MS * 2 ** attemptsRef.current, MAX_DELAY_MS);
      attemptsRef.current += 1;
      timerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      // onclose fires immediately after onerror, so we let it handle reconnect
      ws.close();
    };
  }, []); // no deps — everything referenced via refs

  useEffect(() => {
    destroyedRef.current = false;
    connect();
    return () => {
      destroyedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      socketRef.current?.close();
    };
  }, [connect]);
}
