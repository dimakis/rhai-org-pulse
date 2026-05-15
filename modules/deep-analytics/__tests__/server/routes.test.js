import { describe, it, expect, vi, beforeEach } from 'vitest'

const registerRoutes = require('../../server/index')

function makeStorage(data = {}) {
  const store = { ...data }
  return {
    readFromStorage(key) {
      return store[key] ? JSON.parse(JSON.stringify(store[key])) : null
    },
    writeToStorage(key, value) {
      store[key] = value
    }
  }
}

function makeRouter() {
  const routes = { get: {}, post: {} }
  return {
    get: vi.fn(function (path, ...handlers) {
      routes.get[path] = handlers
    }),
    post: vi.fn(function (path, ...handlers) {
      routes.post[path] = handlers
    }),
    _routes: routes
  }
}

function makeRes() {
  const res = {
    _status: 200,
    _json: null,
    status(code) { res._status = code; return res },
    json(data) { res._json = data; return res }
  }
  return res
}

const SAMPLE_TVFV = {
  metadata: { generated_at: '2026-05-15T10:00:00Z', releases: ['rhoai-3.5'], total_features: 10 },
  executive_summary: [{ release: 'rhoai-3.5', total: 10, aligned: 5 }],
  releases: { 'rhoai-3.5': { aligned: [], tv_only: [], fv_only: [], mismatched: [] } }
}

const SAMPLE_HEALTH = {
  metadata: { generated_at: '2026-05-15T10:00:00Z', target_version: 'rhoai-3.5' },
  executive_summary: { total_open: 50 },
  features: []
}

describe('deep-analytics routes', () => {
  let router, requireAuth, requireAdmin, context, storage

  beforeEach(() => {
    vi.clearAllMocks()
    storage = makeStorage()
    router = makeRouter()
    requireAuth = vi.fn()
    requireAdmin = vi.fn()
    context = { storage, requireAuth, requireAdmin, registerDiagnostics: vi.fn() }
    registerRoutes(router, context)
  })

  describe('route registration', () => {
    it('registers all expected GET routes', () => {
      const paths = Object.keys(router._routes.get)
      expect(paths).toContain('/tv-fv-delta')
      expect(paths).toContain('/release-health')
      expect(paths).toContain('/status')
    })

    it('registers POST /ingest/:type', () => {
      const paths = Object.keys(router._routes.post)
      expect(paths).toContain('/ingest/:type')
    })
  })

  describe('auth middleware', () => {
    it('gates GET routes behind requireAuth', () => {
      expect(router.get).toHaveBeenCalledWith('/tv-fv-delta', requireAuth, expect.any(Function))
      expect(router.get).toHaveBeenCalledWith('/release-health', requireAuth, expect.any(Function))
      expect(router.get).toHaveBeenCalledWith('/status', requireAuth, expect.any(Function))
    })

    it('gates POST /ingest/:type behind requireAdmin', () => {
      expect(router.post).toHaveBeenCalledWith('/ingest/:type', requireAdmin, expect.any(Function))
    })
  })

  describe('GET /tv-fv-delta', () => {
    it('returns 404 when no data', () => {
      const handler = router._routes.get['/tv-fv-delta'].at(-1)
      const res = makeRes()
      handler({}, res)
      expect(res._status).toBe(404)
      expect(res._json.error).toMatch(/No TV\/FV delta data/)
    })

    it('returns data when available', () => {
      const s = makeStorage({ 'deep-analytics/tv-fv-delta.json': SAMPLE_TVFV })
      const r = makeRouter()
      registerRoutes(r, { ...context, storage: s })
      const handler = r._routes.get['/tv-fv-delta'].at(-1)
      const res = makeRes()
      handler({}, res)
      expect(res._status).toBe(200)
      expect(res._json.metadata.releases).toEqual(['rhoai-3.5'])
    })
  })

  describe('GET /release-health', () => {
    it('returns 404 when no data', () => {
      const handler = router._routes.get['/release-health'].at(-1)
      const res = makeRes()
      handler({}, res)
      expect(res._status).toBe(404)
      expect(res._json.error).toMatch(/No release healthcheck data/)
    })

    it('returns data when available', () => {
      const s = makeStorage({ 'deep-analytics/release-healthcheck.json': SAMPLE_HEALTH })
      const r = makeRouter()
      registerRoutes(r, { ...context, storage: s })
      const handler = r._routes.get['/release-health'].at(-1)
      const res = makeRes()
      handler({}, res)
      expect(res._status).toBe(200)
      expect(res._json.metadata.target_version).toBe('rhoai-3.5')
    })
  })

  describe('GET /status', () => {
    it('returns unavailable when no data', () => {
      const handler = router._routes.get['/status'].at(-1)
      const res = makeRes()
      handler({}, res)
      expect(res._json.tv_fv_delta).toEqual({ available: false })
      expect(res._json.release_healthcheck).toEqual({ available: false })
    })

    it('returns metadata when data exists', () => {
      const s = makeStorage({
        'deep-analytics/tv-fv-delta.json': SAMPLE_TVFV,
        'deep-analytics/release-healthcheck.json': SAMPLE_HEALTH
      })
      const r = makeRouter()
      registerRoutes(r, { ...context, storage: s })
      const handler = r._routes.get['/status'].at(-1)
      const res = makeRes()
      handler({}, res)
      expect(res._json.tv_fv_delta.available).toBe(true)
      expect(res._json.tv_fv_delta.releases).toEqual(['rhoai-3.5'])
      expect(res._json.release_healthcheck.available).toBe(true)
      expect(res._json.release_healthcheck.target_version).toBe('rhoai-3.5')
    })
  })

  describe('POST /ingest/:type', () => {
    it('rejects invalid type', () => {
      const handler = router._routes.post['/ingest/:type'].at(-1)
      const res = makeRes()
      handler({ params: { type: 'invalid' }, body: {} }, res)
      expect(res._status).toBe(400)
      expect(res._json.error).toMatch(/Invalid type/)
    })

    it('rejects payload missing required keys', () => {
      const handler = router._routes.post['/ingest/:type'].at(-1)
      const res = makeRes()
      handler({ params: { type: 'tv-fv-delta' }, body: { metadata: {} } }, res)
      expect(res._status).toBe(400)
      expect(res._json.error).toMatch(/Missing required keys/)
      expect(res._json.error).toMatch(/executive_summary/)
    })

    it('ingests valid tv-fv-delta payload', () => {
      const handler = router._routes.post['/ingest/:type'].at(-1)
      const res = makeRes()
      handler({ params: { type: 'tv-fv-delta' }, body: SAMPLE_TVFV }, res)
      expect(res._status).toBe(200)
      expect(res._json.success).toBe(true)
      expect(res._json.type).toBe('tv-fv-delta')
      // Verify it was written to storage
      expect(storage.readFromStorage('deep-analytics/tv-fv-delta.json')).toBeTruthy()
    })

    it('ingests valid release-healthcheck payload', () => {
      const handler = router._routes.post['/ingest/:type'].at(-1)
      const res = makeRes()
      handler({ params: { type: 'release-healthcheck' }, body: SAMPLE_HEALTH }, res)
      expect(res._status).toBe(200)
      expect(res._json.success).toBe(true)
      expect(storage.readFromStorage('deep-analytics/release-healthcheck.json')).toBeTruthy()
    })
  })

  describe('diagnostics', () => {
    it('registers a diagnostics hook', () => {
      expect(context.registerDiagnostics).toHaveBeenCalledWith(expect.any(Function))
    })

    it('returns null when no data', async () => {
      const diagFn = context.registerDiagnostics.mock.calls[0][0]
      const result = await diagFn()
      expect(result.tvFvDelta).toBeNull()
      expect(result.releaseHealth).toBeNull()
    })

    it('returns timestamps when data exists', async () => {
      const s = makeStorage({
        'deep-analytics/tv-fv-delta.json': SAMPLE_TVFV,
        'deep-analytics/release-healthcheck.json': SAMPLE_HEALTH
      })
      const r = makeRouter()
      const ctx = { ...context, storage: s, registerDiagnostics: vi.fn() }
      registerRoutes(r, ctx)
      const diagFn = ctx.registerDiagnostics.mock.calls[0][0]
      const result = await diagFn()
      expect(result.tvFvDelta.generatedAt).toBe('2026-05-15T10:00:00Z')
      expect(result.releaseHealth.generatedAt).toBe('2026-05-15T10:00:00Z')
    })
  })
})
