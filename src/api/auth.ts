import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import type { AuthSession } from '../types';

export function startDiscordSignIn(): Promise<string> {
  return invoke('start_discord_sign_in');
}

export function signInAsGuest(): Promise<AuthSession> {
  return invoke('sign_in_as_guest');
}

export function signOut(): Promise<void> {
  return invoke('sign_out');
}

export function currentAuthSession(): Promise<AuthSession | null> {
  return invoke('current_auth_session');
}

export const onAuthChanged = (callback: (session: AuthSession | null) => void) =>
  listen<AuthSession | null>('discord-auth://changed', (event) => callback(event.payload));

export const onAuthError = (callback: (message: string) => void) => listen<string>('discord-auth://error', (event) => callback(event.payload));
