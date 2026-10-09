export interface ShellAuthChallenge {
  type: 'shell-auth:challenge';
  version: 1;
  connectionId: string;
  serverNonce: string;
  generation: string;
  issuedAt: number;
  expiresAt: number;
}

export interface ShellAuthElectronApi {
  authorizeShellChallenge: (challenge: ShellAuthChallenge, rendererNonce: string) => Promise<unknown>;
}

interface ShellAuthDependencies {
  generation: string;
  electronApi: ShellAuthElectronApi | undefined;
  send: (value: string) => void;
  close: () => void;
  authenticated: () => void;
  deliver: (value: unknown) => void;
  now?: () => number;
  randomBytes?: (length: number) => Uint8Array;
}

const NONCE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const MAX_BUFFERED_FRAMES = 64;
const MAX_BUFFERED_BYTES = 1_048_576;
const MAX_OUTBOUND_FRAMES = 64;
const MAX_OUTBOUND_BYTES = 1_048_576;

function exactKeys(value: unknown, expected: string[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Reflect.ownKeys(value);
  const sorted = [...expected].sort();
  return keys.every((key): key is string => typeof key === 'string')
    && keys.length === sorted.length
    && [...keys].sort().every((key, index) => key === sorted[index]);
}

function validateChallenge(value: unknown, generation: string, now: number): ShellAuthChallenge | null {
  const keys = ['type', 'version', 'connectionId', 'serverNonce', 'generation', 'issuedAt', 'expiresAt'];
  if (!exactKeys(value, keys)) return null;
  if (value.type !== 'shell-auth:challenge' || value.version !== 1) return null;
  if (typeof value.connectionId !== 'string' || !ID_PATTERN.test(value.connectionId)) return null;
  if (typeof value.serverNonce !== 'string' || !NONCE_PATTERN.test(value.serverNonce)) return null;
  if (value.generation !== generation || typeof value.generation !== 'string') return null;
  if (!Number.isSafeInteger(value.issuedAt) || !Number.isSafeInteger(value.expiresAt)) return null;
  const issuedAt = value.issuedAt as number;
  const expiresAt = value.expiresAt as number;
  if (issuedAt < 0 || expiresAt <= issuedAt || expiresAt - issuedAt > 30_000) return null;
  if (now < issuedAt - 1_000 || now >= expiresAt) return null;
  return value as unknown as ShellAuthChallenge;
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function validateProof(value: unknown, challenge: ShellAuthChallenge, rendererNonce: string): Record<string, unknown> | null {
  const keys = ['type', 'version', 'connectionId', 'serverNonce', 'rendererNonce', 'generation', 'expiresAt', 'proof'];
  if (!exactKeys(value, keys)) return null;
  if (value.type !== 'shell-auth:proof' || value.version !== 1) return null;
  if (value.connectionId !== challenge.connectionId
    || value.serverNonce !== challenge.serverNonce
    || value.rendererNonce !== rendererNonce
    || value.generation !== challenge.generation
    || value.expiresAt !== challenge.expiresAt
    || typeof value.proof !== 'string'
    || !NONCE_PATTERN.test(value.proof)) return null;
  return value;
}

export function createShellSocketAuthenticator(dependencies: ShellAuthDependencies) {
  const now = dependencies.now || Date.now;
  const random = dependencies.randomBytes || ((length: number) => crypto.getRandomValues(new Uint8Array(length)));
  let phase: 'challenge' | 'proof' | 'activating' | 'authenticated' | 'failed' = 'challenge';
  let lane = Promise.resolve();
  let buffered: unknown[] = [];
  let bufferedBytes = 0;
  let outbound: string[] = [];
  let outboundBytes = 0;

  const fail = (close = true) => {
    if (phase === 'failed') return;
    phase = 'failed';
    buffered = [];
    bufferedBytes = 0;
    outbound = [];
    outboundBytes = 0;
    if (close) dependencies.close();
  };

  const sendProduct = (serialized: string): boolean => {
    if (phase === 'failed') return false;
    if (phase === 'authenticated') {
      try {
        dependencies.send(serialized);
        return true;
      } catch {
        fail();
        return false;
      }
    }
    const frameBytes = new TextEncoder().encode(serialized).length;
    if (outbound.length >= MAX_OUTBOUND_FRAMES || outboundBytes + frameBytes > MAX_OUTBOUND_BYTES) {
      fail();
      return false;
    }
    outbound.push(serialized);
    outboundBytes += frameBytes;
    return true;
  };

  const consume = async (value: unknown) => {
    if (phase === 'failed') return;
    if (phase === 'authenticated') {
      dependencies.deliver(value);
      return;
    }
    if (phase === 'challenge') {
      const challenge = validateChallenge(value, dependencies.generation, now());
      if (!challenge || !dependencies.electronApi?.authorizeShellChallenge) {
        fail();
        return;
      }
      phase = 'proof';
      const nonceBytes = random(32);
      if (!(nonceBytes instanceof Uint8Array) || nonceBytes.length !== 32) {
        fail();
        return;
      }
      const rendererNonce = base64Url(nonceBytes);
      let proof: unknown = null;
      try {
        proof = await dependencies.electronApi.authorizeShellChallenge(challenge, rendererNonce);
      } catch {
        proof = null;
      }
      const accepted = validateProof(proof, challenge, rendererNonce);
      if (!accepted || phase !== 'proof' || now() >= challenge.expiresAt) {
        fail();
        return;
      }
      dependencies.send(JSON.stringify(accepted));
      return;
    }
    if (exactKeys(value, ['type', 'version'])
      && value.type === 'shell-auth:authenticated'
      && value.version === 1) {
      phase = 'activating';
      try {
        dependencies.authenticated();
      } catch {
        fail();
        return;
      }
      const pending = buffered;
      buffered = [];
      bufferedBytes = 0;
      for (const frame of pending) dependencies.deliver(frame);
      if (phase !== 'activating') return;
      phase = 'authenticated';
      const pendingOutbound = outbound;
      outbound = [];
      outboundBytes = 0;
      for (const frame of pendingOutbound) {
        if (phase !== 'authenticated') return;
        try {
          dependencies.send(frame);
        } catch {
          fail();
          return;
        }
      }
      return;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)
      && 'type' in value
      && typeof value.type === 'string'
      && value.type.startsWith('shell-auth:')) {
      fail();
      return;
    }
    let frameBytes;
    try {
      frameBytes = new TextEncoder().encode(JSON.stringify(value)).length;
    } catch {
      fail();
      return;
    }
    if (buffered.length >= MAX_BUFFERED_FRAMES || bufferedBytes + frameBytes > MAX_BUFFERED_BYTES) {
      fail();
      return;
    }
    buffered.push(value);
    bufferedBytes += frameBytes;
  };

  return Object.freeze({
    receive(value: unknown): Promise<void> {
      lane = lane.then(() => consume(value)).catch(() => fail());
      return lane;
    },
    isAuthenticated(): boolean {
      return phase === 'authenticated';
    },
    sendProduct,
    retire(): void {
      fail(false);
    },
  });
}

export { validateChallenge as validateShellAuthChallenge };
