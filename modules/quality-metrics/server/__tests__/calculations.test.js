// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { computeCumulativeBugData } from '../calculations.js';

describe('computeCumulativeBugData', () => {
  const mockStorage = {
    readFromStorage: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty data for empty bugs array', () => {
    mockStorage.readFromStorage.mockReturnValue([
      { name: 'v1.0', releaseDate: '2026-01-01', project: 'RHOAIENG' }
    ]);

    const result = computeCumulativeBugData([], ['v1.0'], mockStorage);

    expect(result).toEqual({ labels: [], datasets: [{ label: 'v1.0', data: [] }] });
  });

  it('generates correct labels from 0 to maxDays', () => {
    mockStorage.readFromStorage.mockReturnValue([
      { name: 'v1.0', releaseDate: '2026-01-01', project: 'RHOAIENG' }
    ]);

    const bugs = [
      {
        key: 'BUG-1',
        affectedVersions: ['v1.0'],
        created: '2026-01-05T00:00:00Z',
        components: []
      }
    ];

    const result = computeCumulativeBugData(bugs, ['v1.0'], mockStorage);

    expect(result.labels).toEqual([0, 1, 2, 3, 4]);
    expect(result.labels.length).toBe(5);
  });

  it('computes cumulative counts correctly', () => {
    mockStorage.readFromStorage.mockReturnValue([
      { name: 'v1.0', releaseDate: '2026-01-01', project: 'RHOAIENG' }
    ]);

    const bugs = [
      { key: 'BUG-1', affectedVersions: ['v1.0'], created: '2026-01-01T00:00:00Z', components: [] },
      { key: 'BUG-2', affectedVersions: ['v1.0'], created: '2026-01-02T00:00:00Z', components: [] },
      { key: 'BUG-3', affectedVersions: ['v1.0'], created: '2026-01-02T00:00:00Z', components: [] },
      { key: 'BUG-4', affectedVersions: ['v1.0'], created: '2026-01-04T00:00:00Z', components: [] }
    ];

    const result = computeCumulativeBugData(bugs, ['v1.0'], mockStorage);

    expect(result.datasets[0].data).toEqual([1, 3, 3, 4]);
  });

  it('handles multiple versions correctly', () => {
    mockStorage.readFromStorage.mockReturnValue([
      { name: 'v1.0', releaseDate: '2026-01-01', project: 'RHOAIENG' },
      { name: 'v2.0', releaseDate: '2026-02-01', project: 'RHOAIENG' }
    ]);

    const bugs = [
      { key: 'BUG-1', affectedVersions: ['v1.0'], created: '2026-01-02T00:00:00Z', components: [] },
      { key: 'BUG-2', affectedVersions: ['v2.0'], created: '2026-02-02T00:00:00Z', components: [] }
    ];

    const result = computeCumulativeBugData(bugs, ['v1.0', 'v2.0'], mockStorage);

    expect(result.datasets).toHaveLength(2);
    expect(result.datasets[0].label).toBe('v1.0');
    expect(result.datasets[1].label).toBe('v2.0');
  });

  it('filters out bugs with negative daysSinceRelease', () => {
    mockStorage.readFromStorage.mockReturnValue([
      { name: 'v1.0', releaseDate: '2026-01-10', project: 'RHOAIENG' }
    ]);

    const bugs = [
      { key: 'BUG-1', affectedVersions: ['v1.0'], created: '2026-01-05T00:00:00Z', components: [] },
      { key: 'BUG-2', affectedVersions: ['v1.0'], created: '2026-01-11T00:00:00Z', components: [] }
    ];

    const result = computeCumulativeBugData(bugs, ['v1.0'], mockStorage);

    expect(result.datasets[0].data).toEqual([0, 1]);
  });

  it('skips versions without release dates', () => {
    mockStorage.readFromStorage.mockReturnValue([
      { name: 'v1.0', releaseDate: '2026-01-01', project: 'RHOAIENG' }
    ]);

    const bugs = [
      { key: 'BUG-1', affectedVersions: ['v2.0'], created: '2026-01-02T00:00:00Z', components: [] }
    ];

    const result = computeCumulativeBugData(bugs, ['v2.0'], mockStorage);

    expect(result).toEqual({ labels: [], datasets: [{ label: 'v2.0', data: [] }] });
  });
});
