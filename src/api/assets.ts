import type { Asset, AssetPage, AssetQuery, BulkResult } from '@/lib/types';
import { ApiError, isRetryable, OfflineError } from './errors';

function searchParams(query: AssetQuery) {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.status?.length) params.set('status', query.status.join(','));
  if (query.kind?.length) params.set('kind', query.kind.join(','));
  if (query.tag?.length) params.set('tag', query.tag.join(','));
  if (query.collectionId) params.set('collectionId', query.collectionId);
  if (query.owner) params.set('owner', query.owner);
  if (query.sort) params.set('sort', query.sort);
  if (query.limit) params.set('limit', String(query.limit));
  if (query.cursor) params.set('cursor', query.cursor);
  return params.toString();
}
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const MAX_ATTEMPTS = 3;
async function request<T>(path: string, init: RequestInit = {}, attempt = 0): Promise<T> {
  if (!navigator.onLine) throw new OfflineError();
  try {
    const response = await fetch(path, { ...init, headers: { 'content-type': 'application/json', ...init.headers } });
    if (response.ok) return response.json() as Promise<T>;
    let body: { error?: { code?: string; message?: string } } = {};
    try { body = await response.json(); } catch { /* non-json */ }
    const seconds = Number(response.headers.get('Retry-After'));
    const error = new ApiError(response.status, body.error?.code ?? 'request_failed', body.error?.message ?? response.statusText, Number.isFinite(seconds) ? seconds * 1000 : undefined);
    if (!isRetryable(error) || attempt >= MAX_ATTEMPTS - 1) throw error;
    await pause(error.retryAfterMs ?? Math.min(4000, 350 * 2 ** attempt + Math.random() * 250));
    return request<T>(path, init, attempt + 1);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    if (!isRetryable(error) || attempt >= MAX_ATTEMPTS - 1 || !navigator.onLine) throw error;
    await pause(Math.min(4000, 350 * 2 ** attempt + Math.random() * 250));
    return request<T>(path, init, attempt + 1);
  }
}
export function listAssets(query: AssetQuery, signal?: AbortSignal) { return request<AssetPage>(`/api/assets?${searchParams(query)}`, { signal }); }
export function getAsset(id: string, signal?: AbortSignal) { return request<Asset>(`/api/assets/${id}`, { signal }); }
export function getAssetsByIds(ids: string[]) { return request<{ items: Asset[]; missing: string[] }>(`/api/assets/batch?ids=${ids.join(',')}`); }
export function updateAsset(id: string, version: number, patch: Partial<Pick<Asset, 'name' | 'status' | 'tags'>>) { return request<Asset>(`/api/assets/${id}`, { method: 'PATCH', body: JSON.stringify({ version, patch }) }); }
export function bulkSetStatus(ids: string[], status: Asset['status']) { return request<BulkResult>('/api/assets/bulk-status', { method: 'POST', body: JSON.stringify({ ids, status }) }); }
export const thumbnailUrl = (id: string) => `/api/thumb/${id}.svg`;
