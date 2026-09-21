import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { thumbnailUrl } from '@/api/assets';
import { formatBytes, formatDate, statusLabel } from '@/lib/format';
import type { Asset } from '@/lib/types';
interface Props { assets: Asset[]; selectedIds: Set<string>; activeId: string | null; focusedId: string | null; onFocusedIdChange: (id: string) => void; onToggleSelect: (id: string, range?: boolean, anchorId?: string) => void; onOpen: (id: string) => void; hasNextPage: boolean; loadingMore: boolean; isLoading: boolean; isError: boolean; errorMessage: string; onLoadMore: () => void; }
const Card = memo(function Card({ asset, selected, active, focused, onFocusedIdChange, onToggleSelect, onOpen, onKeyDown }: { asset: Asset; selected: boolean; active: boolean; focused: boolean; onFocusedIdChange: Props['onFocusedIdChange']; onToggleSelect: Props['onToggleSelect']; onOpen: Props['onOpen']; onKeyDown: (event: React.KeyboardEvent<HTMLElement>, id: string) => void }) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const missing = !asset.hasThumbnail || thumbnailFailed;
  return <article id={`asset-card-${asset.id}`} role="gridcell" aria-selected={selected} tabIndex={focused ? 0 : -1} className={`card${selected ? ' card--selected' : ''}${active ? ' card--active' : ''}`} onFocus={() => onFocusedIdChange(asset.id)} onKeyDown={(event) => onKeyDown(event, asset.id)} onClick={() => onOpen(asset.id)}><>{missing ? <div className="card__thumb placeholder" aria-hidden="true">{asset.kind}</div> : <img className="card__thumb" src={thumbnailUrl(asset.id)} loading="lazy" alt="" onError={() => setThumbnailFailed(true)} />}</><div className="card__body"><p className="card__name">{asset.name}</p><p className="muted">{asset.kind} · {formatBytes(asset.sizeBytes)} · {formatDate(asset.updatedAt)}</p><span className={`pill pill--${asset.status}`}>{statusLabel(asset.status)}</span></div><input type="checkbox" className="card__check" aria-label={`Select ${asset.name}`} checked={selected} onClick={(e) => e.stopPropagation()} onChange={(e) => onToggleSelect(asset.id, (e.nativeEvent as MouseEvent).shiftKey)} /></article>;
});
export function AssetGrid({ assets, selectedIds, activeId, focusedId, onFocusedIdChange, onToggleSelect, onOpen, hasNextPage, loadingMore, isLoading, isError, errorMessage, onLoadMore }: Props) {
  const parentRef = useRef<HTMLDivElement>(null); const virtual = useVirtualizer({ count: assets.length, getScrollElement: () => parentRef.current, estimateSize: () => 240, overscan: 6 });
  const rows = virtual.getVirtualItems();
  useEffect(() => { if (!focusedId) return; const index = assets.findIndex((asset) => asset.id === focusedId); if (index >= 0) virtual.scrollToIndex(index, { align: 'auto' }); }, [focusedId, assets, virtual]);
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>, id: string) => {
    const index = assets.findIndex((asset) => asset.id === id);
    const delta = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
    if (delta) { event.preventDefault(); const next = assets[Math.max(0, Math.min(assets.length - 1, index + delta))]!; onFocusedIdChange(next.id); if (event.shiftKey) onToggleSelect(next.id, true, id); requestAnimationFrame(() => document.getElementById(`asset-card-${next.id}`)?.focus()); return; }
    if (event.key === 'Enter') { event.preventDefault(); onOpen(id); }
    if (event.key === ' ') { event.preventDefault(); onToggleSelect(id); }
  }, [assets, onFocusedIdChange, onToggleSelect, onOpen]);
  useEffect(() => { const last = rows.at(-1); if (last && last.index >= assets.length - 8 && hasNextPage && !loadingMore) onLoadMore(); }, [rows, assets.length, hasNextPage, loadingMore, onLoadMore]);
  if (!assets.length && isLoading) return <div className="empty"><p>Loading assets…</p></div>;
  if (!assets.length && isError) return <div className="empty"><p>{errorMessage}</p><p className="muted">Check your connection, then change a filter or reload to try again.</p></div>;
  if (!assets.length && !loadingMore) return <div className="empty"><p>Nothing matches these filters.</p><p className="muted">Clear the search box or widen the status filter.</p></div>;
  return <div ref={parentRef} className="grid" role="grid" aria-label="Assets"><div className="virtual-space" style={{ height: virtual.getTotalSize() }}>{rows.map((row) => { const asset = assets[row.index]!; return <div key={asset.id} role="row" data-index={row.index} ref={virtual.measureElement} className="virtual-card" style={{ transform: `translateY(${row.start}px)` }}><Card asset={asset} selected={selectedIds.has(asset.id)} active={activeId === asset.id} focused={focusedId === asset.id} onFocusedIdChange={onFocusedIdChange} onToggleSelect={onToggleSelect} onOpen={onOpen} onKeyDown={handleKeyDown} /></div>; })}</div>{loadingMore && <p className="loading-more">Loading more assets…</p>}</div>;
}
