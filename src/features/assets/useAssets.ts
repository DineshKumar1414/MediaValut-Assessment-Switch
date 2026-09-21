import { useInfiniteQuery } from '@tanstack/react-query';
import { listAssets } from '@/api/assets';
import type { AssetQuery } from '@/lib/types';

export function useAssets(query: AssetQuery, enabled = true) {
  const { cursor: _cursor, ...baseQuery } = query;
  return useInfiniteQuery({
    queryKey: ['assets', baseQuery],
    enabled,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => listAssets({ ...baseQuery, cursor: pageParam ?? undefined }, signal),
    getNextPageParam: (last) => last.nextCursor,
  });
}
