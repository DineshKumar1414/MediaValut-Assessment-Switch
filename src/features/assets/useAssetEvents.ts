import { useEffect, type MutableRefObject } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { Asset } from '@/lib/types';

/** Reconciles server events without overwriting an optimistic local bulk write. */
export function useAssetEvents(client: QueryClient, pendingIds: MutableRefObject<Set<string>>) {
  useEffect(() => {
    const stream = new EventSource('/api/events');
    const update = (event: MessageEvent<string>) => {
      try {
        const incoming = JSON.parse(event.data) as Asset;
        if (pendingIds.current.has(incoming.id)) return;
        client.setQueriesData({ queryKey: ['assets'] }, (old: any) => old && ({
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: page.items.map((asset: Asset) => asset.id === incoming.id && incoming.version >= asset.version ? incoming : asset),
          })),
        }));
      } catch { /* malformed event: keep the existing cache */ }
    };
    stream.addEventListener('asset.updated', update as EventListener);
    return () => { stream.removeEventListener('asset.updated', update as EventListener); stream.close(); };
  }, [client, pendingIds]);
}
