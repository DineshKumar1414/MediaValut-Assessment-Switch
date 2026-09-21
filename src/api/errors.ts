export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly retryAfterMs?: number) {
    super(message); this.name = 'ApiError';
  }
}

export class OfflineError extends ApiError {
  constructor() { super(0, 'offline', 'You appear to be offline.'); this.name = 'OfflineError'; }
}

export function isRetryable(error: unknown) {
  return error instanceof ApiError ? error.status === 429 || error.status === 500 || error.status === 503 : error instanceof TypeError;
}

export function userMessage(error: unknown) {
  if (error instanceof OfflineError || !navigator.onLine) return 'You are offline. Reconnect to resume searching and updates.';
  if (error instanceof ApiError) {
    if (error.status === 429) return 'We are slowing down to protect the service. Please try again shortly.';
    if (error.code === 'version_conflict') return 'This asset changed elsewhere. Refresh it before making another edit.';
    if (error.code === 'legal_hold') return 'This asset is on legal hold and cannot be archived.';
    if (error.status >= 500) return 'The service is temporarily unavailable. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}
