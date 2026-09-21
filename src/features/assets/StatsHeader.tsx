import { useQuery } from '@tanstack/react-query';
import { getStats } from '@/api/assets';
import { formatBytes } from '@/lib/format';

export function StatsHeader() {
  const stats = useQuery({ queryKey: ['library-stats'], queryFn: getStats, staleTime: 5 * 60_000, retry: false });
  if (stats.isPending) return <span className="stats" aria-label="Loading library statistics">Library summary loading…</span>;
  if (stats.isError || !stats.data) return null;
  return <span className="stats">{stats.data.total.toLocaleString()} assets · {formatBytes(stats.data.totalBytes)}</span>;
}
