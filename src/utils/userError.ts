import { appendAppLog } from '../api/applog';
import type { NotificationContent } from '../hooks/useToastStore';

export interface UserFacingError {
  code : string;
  title: string;
  body : string;
  log  : string;
}

export const DEV_LOGS_HINT = 'Settings, About, Developer, View developer logs';

const FALLBACK: UserFacingError = {
  code : 'unknown',
  title: "That didn't work",
  body : `Something blocked this step. Try again. If it keeps failing, open Developer logs in ${DEV_LOGS_HINT}.`,
  log  : 'unknown error',
};

function isUserFacingError(value: unknown): value is UserFacingError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'title' in value &&
    'body' in value &&
    typeof (value as UserFacingError).title === 'string' &&
    typeof (value as UserFacingError).body === 'string'
  );
}

function legacyStringError(message: string): UserFacingError {
  const lower = message.toLowerCase();

  if (lower.includes('henrikdev api key') || lower.includes('no henrikdev api key')) {
    return {
      code : 'henrik_api_key_missing',
      title: "Your lookup couldn't run",
      body : 'Add a free HenrikDev API key in Settings, Tools, then try again.',
      log  : message,
    };
  }

  if (lower.includes('rate limit') || lower.includes('429')) {
    return {
      code : 'henrik_rate_limited',
      title: 'Your lookup was rate limited',
      body : 'Wait a minute or add another HenrikDev API key in Settings, Tools, then try again.',
      log  : message,
    };
  }

  if (lower.includes('lockfile') && (lower.includes("isn't there") || lower.includes('not found'))) {
    return {
      code : 'riot_client_not_running',
      title: 'Riot client not open',
      body : 'Open the Riot Client and sign in, then try again. Valorant does not need to be open.',
      log  : message,
    };
  }

  if (lower.includes('sign in') && lower.includes('discord')) {
    return {
      code : 'sign_in_required',
      title: 'Sign-in required',
      body : 'Sign in with Discord or continue as guest from the profile menu, then try again.',
      log  : message,
    };
  }

  if (lower.includes('cancelled')) {
    return {
      code : 'cancelled',
      title: 'Cancelled',
      body : 'This step was stopped before it finished.',
      log  : message,
    };
  }

  if (lower.includes('player not found')) {
    return {
      code : 'player_not_found',
      title: "That player wasn't found",
      body : 'Check the name and tag, then try again.',
      log  : message,
    };
  }

  if (
    lower.includes('valorant content')
    || lower.includes('valorant-api')
    || lower.includes('couldn\'t reach the api')
    || lower.includes('api error')
  ) {
    return {
      code : 'remote_service_failed',
      title: 'That request couldn\'t finish',
      body : 'The service may be down or slow. Try again in a moment.',
      log  : message,
    };
  }

  return { ...FALLBACK, log: message };
}

export function parseInvokeError(error: unknown): UserFacingError {
  if (isUserFacingError(error)) {
    return {
      code : String(error.code ?? FALLBACK.code),
      title: error.title,
      body : error.body,
      log  : String(error.log ?? error.title),
    };
  }

  if (typeof error === 'string') {
    try {
      const parsed: unknown = JSON.parse(error);
      if (isUserFacingError(parsed)) return parseInvokeError(parsed);
    } catch {
    }
    return legacyStringError(error);
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;

    if (isUserFacingError(record)) return parseInvokeError(record);

    if (typeof record.message === 'string') {
      if (isUserFacingError(record.message)) return parseInvokeError(record.message);
      return legacyStringError(record.message);
    }

    if (typeof record.data === 'object' && record.data !== null) {
      return parseInvokeError(record.data);
    }
  }

  return legacyStringError(String(error));
}

export function toastFromError(error: unknown, overrides?: Partial<NotificationContent>): NotificationContent {
  const parsed = parseInvokeError(error);
  return {
    title: overrides?.title ?? parsed.title,
    body : overrides?.body ?? parsed.body,
    icon : overrides?.icon ?? 'error',
  };
}

export function inlineErrorText(error: unknown): string {
  const parsed = parseInvokeError(error);
  return parsed.body ? `${parsed.title} ${parsed.body}` : parsed.title;
}

export function userError(code: string, title: string, body: string): UserFacingError {
  return { code, title, body, log: body };
}

export const EMPTY_RIOT_ID_ERROR: UserFacingError = {
  code : 'input_invalid',
  title: "Your Riot ID is incomplete",
  body : 'Type a name and tag like Player#Tag, then try again.',
  log  : 'riot id empty',
};

export function isRateLimitedError(error: UserFacingError | null): boolean {
  return error?.code === 'henrik_rate_limited';
}

export function logUserFacingError(error: UserFacingError, scope?: string): void {
  const prefix = scope ? `[${scope}] ` : '';
  const detail = error.log.trim();
  const shown  = error.body.trim() ? `${error.title}. ${error.body}` : error.title;
  const message = detail && detail !== error.body && detail !== shown
    ? `${prefix}${shown} | ${detail}`
    : `${prefix}${shown}`;
  void appendAppLog('error', message).catch(() => {});
}