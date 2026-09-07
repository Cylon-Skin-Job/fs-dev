import { useEffect, useSyncExternalStore } from 'react';
import { connectWs, disconnectWs } from '../lib/ws-client';
import {
  getRuntimeTransportSnapshot,
  subscribeRuntimeTransport,
} from '../lib/runtime-transport';

/**
 * Thin React wrapper — calls connectWs on mount, disconnectWs on unmount.
 * All connection, message routing, and discovery logic lives in ws-client.ts.
 */
export function useWebSocket() {
  const runtime = useSyncExternalStore(
    subscribeRuntimeTransport,
    getRuntimeTransportSnapshot,
    getRuntimeTransportSnapshot,
  );
  useEffect(() => {
    connectWs();
    return () => disconnectWs();
  }, []);
  return runtime.status;
}
