/**
 * @module secretsStore
 * @role State management for the Secrets Manager — index entries only (name + metadata + fingerprint)
 */

import { create } from 'zustand';

export interface ApiKeyIndexEntry {
  name: string;
  description: string | null;
  expires_at: number | null;
  fingerprint: string;
  created_at: number;
  updated_at: number;
}

export type ApiKeysErrorCode =
  | 'INVALID_NAME'
  | 'INVALID_VALUE'
  | 'DUPLICATE'
  | 'BACKEND_UNAVAILABLE'
  | (string & {});

export interface ApiKeysError {
  code: ApiKeysErrorCode;
  message: string;
}

interface SecretsStore {
  apiKeys: ApiKeyIndexEntry[];
  setApiKeys: (items: ApiKeyIndexEntry[]) => void;
  lastError: ApiKeysError | null;
  setApiKeysError: (err: ApiKeysError | null) => void;
}

export const useSecretsStore = create<SecretsStore>((set) => ({
  apiKeys: [],
  setApiKeys: (items) => set({ apiKeys: items, lastError: null }),
  lastError: null,
  setApiKeysError: (err) => set({ lastError: err }),
}));
