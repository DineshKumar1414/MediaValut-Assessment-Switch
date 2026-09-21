import type { Asset, BulkResult } from './types';

export const chunk = <T,>(values: T[], size: number) =>
  Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, index * size + size));

export async function runWithConcurrency<T>(jobs: Array<() => Promise<T>>, limit = 3) {
  const results: T[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++]!;
      results.push(await job());
    }
  }));
  return results;
}

export function reconcileBulkResults(results: BulkResult[], snapshots: Map<string, Asset>) {
  const successful = results.flatMap((result) => result.results.filter((item) => item.ok).map((item) => item.asset));
  const failed = results.flatMap((result) => result.results.filter((item) => !item.ok).map((item) => ({
    ...item,
    name: snapshots.get(item.id)?.name ?? item.id,
    message: item.message ?? (item.code === 'legal_hold' ? 'On legal hold; this status cannot be changed.' : 'Changed elsewhere. You can retry.'),
  })));
  return { successful, failed, applied: results.reduce((sum, result) => sum + result.applied, 0) };
}
