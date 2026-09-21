import { describe, expect, it } from 'vitest';
import { chunk, reconcileBulkResults, runWithConcurrency } from './bulk';
import type { Asset, BulkResult } from './types';

const asset = (id: string): Asset => ({ id, name: `Asset ${id}`, kind: 'image', status: 'draft', tags: [], collectionId: 'c_01', owner: { id: 'u_01', name: 'Owner' }, sizeBytes: 1, width: 1, height: 1, durationSec: null, createdAt: '', updatedAt: '', version: 1, hasThumbnail: true });

describe('bulk update helpers', () => {
  it('chunks at the API cap and never exceeds the requested concurrency', async () => {
    expect(chunk(Array.from({ length: 101 }, (_, i) => i), 50).map((part) => part.length)).toEqual([50, 50, 1]);
    let running = 0, peak = 0;
    await runWithConcurrency(Array.from({ length: 8 }, () => async () => { running++; peak = Math.max(peak, running); await new Promise((resolve) => setTimeout(resolve, 5)); running--; }), 3);
    expect(peak).toBe(3);
  });

  it('preserves successful assets and identifies only failed assets for rollback', () => {
    const before = new Map([['a_1', asset('a_1')], ['a_2', asset('a_2')]]);
    const updated = { ...asset('a_1'), status: 'approved' as const, version: 2 };
    const result: BulkResult = { applied: 1, failed: 1, results: [{ id: 'a_1', ok: true, asset: updated }, { id: 'a_2', ok: false, code: 'legal_hold', message: 'Asset is on legal hold.' }] };
    const reconciliation = reconcileBulkResults([result], before);
    expect(reconciliation.successful).toEqual([updated]);
    expect(reconciliation.failed).toMatchObject([{ id: 'a_2', name: 'Asset a_2', code: 'legal_hold' }]);
  });
});
