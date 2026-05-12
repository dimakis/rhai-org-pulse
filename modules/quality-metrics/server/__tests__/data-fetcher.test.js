// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchVersions, fetchBugs, getComponents } from '../data-fetcher.js';

vi.mock('../../../../shared/server/jira');
import { jiraRequest, fetchAllJqlResults } from '../../../../shared/server/jira.js';

describe('fetchVersions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns sorted versions with release dates', async () => {
    vi.mocked(jiraRequest).mockResolvedValue([
      { name: 'v2.0', releaseDate: '2026-02-01', released: true },
      { name: 'v1.0', releaseDate: '2026-01-01', released: true },
      { name: 'unreleased', released: false }
    ]);

    const result = await fetchVersions(['RHOAIENG']);

    expect(result).toEqual([
      { name: 'v2.0', releaseDate: '2026-02-01', project: 'RHOAIENG', released: true },
      { name: 'v1.0', releaseDate: '2026-01-01', project: 'RHOAIENG', released: true }
    ]);
  });

  it('filters out versions without release dates', async () => {
    vi.mocked(jiraRequest).mockResolvedValue([
      { name: 'v1.0', releaseDate: '2026-01-01', released: true },
      { name: 'future-version', released: false }
    ]);

    const result = await fetchVersions(['RHOAIENG']);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('v1.0');
  });

  it('handles fetch errors gracefully', async () => {
    vi.mocked(jiraRequest).mockRejectedValue(new Error('Network error'));

    const result = await fetchVersions(['RHOAIENG']);

    expect(result).toEqual([]);
  });
});

describe('fetchBugs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters bugs created before release date', async () => {
    const versions = [
      { name: 'v1.0', releaseDate: '2026-01-10', project: 'RHOAIENG' }
    ];

    vi.mocked(fetchAllJqlResults).mockResolvedValue([
      {
        key: 'BUG-1',
        fields: {
          summary: 'Pre-release bug',
          priority: { name: 'Blocker' },
          status: { name: 'Open' },
          versions: [{ name: 'v1.0' }],
          components: [],
          created: '2026-01-05T00:00:00Z',
          resolutiondate: null
        }
      },
      {
        key: 'BUG-2',
        fields: {
          summary: 'Post-release bug',
          priority: { name: 'Critical' },
          status: { name: 'Open' },
          versions: [{ name: 'v1.0' }],
          components: [],
          created: '2026-01-15T00:00:00Z',
          resolutiondate: null
        }
      }
    ]);

    const result = await fetchBugs('RHOAIENG', versions);

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('BUG-2');
  });

  it('maps Jira response fields correctly', async () => {
    const versions = [
      { name: 'v1.0', releaseDate: '2026-01-01', project: 'RHOAIENG' }
    ];

    vi.mocked(fetchAllJqlResults).mockResolvedValue([
      {
        key: 'BUG-1',
        fields: {
          summary: 'Test bug',
          priority: { name: 'Major' },
          status: { name: 'Resolved' },
          versions: [{ name: 'v1.0' }],
          components: [{ name: 'Dashboard' }, { name: 'API' }],
          created: '2026-01-02T00:00:00Z',
          resolutiondate: '2026-01-05T00:00:00Z'
        }
      }
    ]);

    const result = await fetchBugs('RHOAIENG', versions);

    expect(result[0]).toEqual({
      key: 'BUG-1',
      summary: 'Test bug',
      priority: 'Major',
      status: 'Resolved',
      affectedVersions: ['v1.0'],
      components: ['Dashboard', 'API'],
      created: '2026-01-02T00:00:00Z',
      resolved: '2026-01-05T00:00:00Z',
      releaseDate: '2026-01-01'
    });
  });

  it('handles fetch errors gracefully', async () => {
    vi.mocked(fetchAllJqlResults).mockRejectedValue(new Error('JQL error'));

    const result = await fetchBugs('RHOAIENG', []);

    expect(result).toEqual([]);
  });
});

describe('getComponents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deduplicates component names', async () => {
    jiraRequest
      .mockResolvedValueOnce([
        { name: 'Dashboard' },
        { name: 'API' }
      ])
      .mockResolvedValueOnce([
        { name: 'Dashboard' },
        { name: 'Workbenches' }
      ]);

    const result = await getComponents(['RHOAIENG', 'AIPCC']);

    expect(result).toEqual(['API', 'Dashboard', 'Workbenches']);
  });

  it('handles fetch errors gracefully', async () => {
    vi.mocked(jiraRequest).mockRejectedValue(new Error('Network error'));

    const result = await getComponents(['RHOAIENG']);

    expect(result).toEqual([]);
  });
});
