import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { bulkSetStatus } from '@/api/assets';
import { userMessage } from '@/api/errors';
import { AssetDetail } from '@/features/assets/AssetDetail';
import { AssetGrid } from '@/features/assets/AssetGrid';
import { StatsHeader } from '@/features/assets/StatsHeader';
import { useAssetEvents } from '@/features/assets/useAssetEvents';
import { useAssets } from '@/features/assets/useAssets';
import { chunk, reconcileBulkResults, runWithConcurrency } from '@/lib/bulk';
import { statusLabel } from '@/lib/format';
import type { Asset, AssetKind, AssetStatus, AssetQuery } from '@/lib/types';
const STATUSES: AssetStatus[] = ['draft', 'in_review', 'approved', 'archived'];
const KINDS: AssetKind[] = ['image', 'video', 'document'];
const SORTS: Array<{ value: NonNullable<AssetQuery['sort']>; label: string }> = [{ value: 'updatedAt:desc', label: 'Recently updated' }, { value: 'name:asc', label: 'Name A–Z' }, { value: 'sizeBytes:desc', label: 'Largest first' }, { value: 'createdAt:desc', label: 'Newest' }];
class ErrorBoundary extends Component<{ children: React.ReactNode }, { broken: boolean }> { state = { broken: false }; static getDerivedStateFromError() { return { broken: true }; } render() { return this.state.broken ? <main className="empty"><p>That part of MediaVault could not load.</p><button onClick={() => this.setState({ broken: false })}>Try again</button></main> : this.props.children; } }
function MediaVault() {
  const client = useQueryClient(), params = new URLSearchParams(location.search);
  const [draftQ, setDraftQ] = useState(params.get('q') ?? ''), [q, setQ] = useState(params.get('q') ?? '');
  const [status, setStatus] = useState<AssetStatus[]>((params.get('status')?.split(',').filter(Boolean) ?? []) as AssetStatus[]);
  const [kind, setKind] = useState<AssetKind[]>((params.get('kind')?.split(',').filter(Boolean) ?? []) as AssetKind[]);
  const [tagText, setTagText] = useState(params.get('tag') ?? '');
  const [tag, setTag] = useState(params.get('tag') ?? '');
  const [sort, setSort] = useState<NonNullable<AssetQuery['sort']>>((params.get('sort') as NonNullable<AssetQuery['sort']>) || 'updatedAt:desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set()), [activeId, setActiveId] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null), [online, setOnline] = useState(navigator.onLine);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const pendingBulkIds = useRef(new Set<string>());
  const [failures, setFailures] = useState<Array<{ id: string; name: string; code: string; message: string }>>([]);
  const [failedStatus, setFailedStatus] = useState<AssetStatus | null>(null);
  useEffect(() => { const timer = setTimeout(() => setQ(draftQ), 300); return () => clearTimeout(timer); }, [draftQ]);
  useEffect(() => { const timer = setTimeout(() => setTag(tagText.trim()), 300); return () => clearTimeout(timer); }, [tagText]);
  useEffect(() => { const set = () => { setOnline(navigator.onLine); if (!navigator.onLine) void client.cancelQueries({ queryKey: ['assets'] }); }; addEventListener('online', set); addEventListener('offline', set); return () => { removeEventListener('online', set); removeEventListener('offline', set); }; }, [client]);
  useEffect(() => { const next = new URLSearchParams(); if (q) next.set('q', q); if (status.length) next.set('status', status.join(',')); if (kind.length) next.set('kind', kind.join(',')); if (tag) next.set('tag', tag); if (sort !== 'updatedAt:desc') next.set('sort', sort); history.replaceState(null, '', `${location.pathname}${next.size ? `?${next}` : ''}`); setSelectedIds(new Set()); }, [q, status, kind, tag, sort]);
  const tags = useMemo(() => tag.split(',').map((value) => value.trim()).filter(Boolean), [tag]);
  const query = useMemo(() => ({ q, status, kind, tag: tags, sort, limit: 50 }), [q, status, kind, tags, sort]);
  const assetsQuery = useAssets(query, online);
  const assets = useMemo(() => assetsQuery.data?.pages.flatMap((page) => page.items) ?? [], [assetsQuery.data]);
  const total = assetsQuery.data?.pages[0]?.total ?? 0;
  useAssetEvents(client, pendingBulkIds);
  useEffect(() => {
    if (!assets.length) { if (focusedId) searchRef.current?.focus(); return; }
    if (!focusedId) { setFocusedId(assets[0]!.id); return; }
    if (!assets.some((asset) => asset.id === focusedId)) {
      const nextId = assets[0]!.id;
      setFocusedId(nextId);
      requestAnimationFrame(() => document.getElementById(`asset-card-${nextId}`)?.focus() ?? searchRef.current?.focus());
    }
  }, [assets, focusedId]);
  const patchCache = (ids: string[], transform: (asset: Asset) => Asset) => client.setQueriesData({ queryKey: ['assets'] }, (old: any) => old && ({ ...old, pages: old.pages.map((page: any) => ({ ...page, items: page.items.map((asset: Asset) => ids.includes(asset.id) ? transform(asset) : asset) })) }));
  const toggleSelect = useCallback((id: string, range = false, anchorId?: string) => { setSelectedIds((old) => { const next = new Set(old); if (range) { const anchor = anchorId ?? assets.find((asset) => old.has(asset.id))?.id; const a = assets.findIndex((asset) => asset.id === anchor), b = assets.findIndex((asset) => asset.id === id); if (a >= 0 && b >= 0) for (let i = Math.min(a, b); i <= Math.max(a, b); i++) next.add(assets[i]!.id); else next.add(id); } else if (next.has(id)) next.delete(id); else next.add(id); return next; }); }, [assets]);
  const openAsset = useCallback((id: string) => { setFocusedId(id); setActiveId(id); }, []);
  const closeAsset = useCallback(() => { const target = activeId; setActiveId(null); if (target) { setFocusedId(target); requestAnimationFrame(() => document.getElementById(`asset-card-${target}`)?.focus() ?? searchRef.current?.focus()); } }, [activeId]);
  async function applyBulkStatus(nextStatus: AssetStatus, ids = [...selectedIds]) {
    if (!ids.length || !online) return; const snapshot = new Map(assets.filter((a) => ids.includes(a.id)).map((a) => [a.id, a])); ids.forEach((id) => pendingBulkIds.current.add(id)); setNotice(null); setFailures([]); setFailedStatus(null); patchCache(ids, (a) => ({ ...a, status: nextStatus }));
    try { const results = await runWithConcurrency(chunk(ids, 50).map((batch) => () => bulkSetStatus(batch, nextStatus))); const reconciliation = reconcileBulkResults(results, snapshot); if (reconciliation.successful.length) patchCache(reconciliation.successful.map((asset) => asset.id), (asset) => reconciliation.successful.find((updated) => updated.id === asset.id) ?? asset); if (reconciliation.failed.length) patchCache(reconciliation.failed.map((failure) => failure.id), (asset) => snapshot.get(asset.id) ?? asset); setFailures(reconciliation.failed); setFailedStatus(reconciliation.failed.length ? nextStatus : null); setSelectedIds(new Set(reconciliation.failed.filter((failure) => failure.code === 'conflict').map((failure) => failure.id))); setNotice(reconciliation.failed.length ? `${reconciliation.applied} updated; ${reconciliation.failed.length} need attention.` : `${reconciliation.applied} assets updated.`); }
    catch (error) { patchCache(ids, (a) => snapshot.get(a.id) ?? a); setNotice(userMessage(error)); }
    finally { ids.forEach((id) => pendingBulkIds.current.delete(id)); }
  }
  const retryable = failures.filter((failure) => failure.code === 'conflict');
  return <div className="app"><header className="topbar"><h1>MediaVault</h1><StatsHeader /><input ref={searchRef} className="search" type="search" placeholder="Search assets" value={draftQ} onChange={(e) => setDraftQ(e.target.value)} /><select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>{SORTS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></header><div className="filters">{STATUSES.map((s) => <label key={s}><input type="checkbox" checked={status.includes(s)} onChange={(e) => setStatus((old) => e.target.checked ? [...old, s] : old.filter((x) => x !== s))} />{statusLabel(s)}</label>)}{KINDS.map((k) => <label key={k}><input type="checkbox" checked={kind.includes(k)} onChange={(e) => setKind((old) => e.target.checked ? [...old, k] : old.filter((x) => x !== k))} />{k}</label>)}<input className="tag-filter" aria-label="Filter by tags" placeholder="Tags, all required" value={tagText} onChange={(e) => setTagText(e.target.value)} /><span className="muted">{assetsQuery.isFetching && !assets.length ? 'Loading…' : `${assets.length} of ${total.toLocaleString()} shown`}</span></div>{!online && <p className="error" role="status">You’re offline. Searching and updates are paused until you reconnect.</p>}{selectedIds.size > 0 && <div className="bulkbar"><span>{selectedIds.size} selected</span>{STATUSES.map((s) => <button key={s} disabled={!online} onClick={() => applyBulkStatus(s)}>Set {statusLabel(s).toLowerCase()}</button>)}<button onClick={() => setSelectedIds(new Set())}>Clear</button></div>}<div className="bulkbar"><button disabled={!assets.length} onClick={() => setSelectedIds(new Set(assets.map((asset) => asset.id)))}>Select all loaded ({assets.length})</button>{retryable.length > 0 && failedStatus && <button disabled={!online} onClick={() => applyBulkStatus(failedStatus, retryable.map((failure) => failure.id))}>Retry {retryable.length} conflict failures</button>}</div><div className="live" aria-live="polite">{notice ?? (assetsQuery.isError ? userMessage(assetsQuery.error) : '')}</div><div className="sr-only" aria-live="polite">{assetsQuery.isSuccess && !assetsQuery.isFetching ? `${total} results. ${assets.length} loaded.` : ''}</div>{failures.length > 0 && <section className="failure-list" aria-label="Bulk update failures"><strong>Items that were not changed</strong><ul>{failures.map((failure) => <li key={failure.id}>{failure.name}: {failure.message}</li>)}</ul></section>}<main className="content"><AssetGrid assets={assets} selectedIds={selectedIds} activeId={activeId} focusedId={focusedId} onFocusedIdChange={setFocusedId} onToggleSelect={toggleSelect} onOpen={openAsset} hasNextPage={assetsQuery.hasNextPage} loadingMore={assetsQuery.isFetchingNextPage} isLoading={assetsQuery.isLoading} isError={assetsQuery.isError} errorMessage={assetsQuery.isError ? userMessage(assetsQuery.error) : ''} onLoadMore={() => assetsQuery.fetchNextPage()} />{activeId && <AssetDetail id={activeId} onClose={closeAsset} onSaved={(asset) => patchCache([asset.id], () => asset)} />}</main></div>;
}
export function App() { return <ErrorBoundary><MediaVault /></ErrorBoundary>; }
