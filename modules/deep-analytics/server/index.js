module.exports = function registerRoutes(router, context) {
  const { storage, requireAuth, requireAdmin } = context

  // GET /api/modules/deep-analytics/tv-fv-delta
  router.get('/tv-fv-delta', requireAuth, function (req, res) {
    const data = storage.readFromStorage('deep-analytics/tv-fv-delta.json')
    if (!data) {
      return res.status(404).json({ error: 'No TV/FV delta data available. Run the export pipeline first.' })
    }
    res.json(data)
  })

  // GET /api/modules/deep-analytics/release-health
  router.get('/release-health', requireAuth, function (req, res) {
    const data = storage.readFromStorage('deep-analytics/release-healthcheck.json')
    if (!data) {
      return res.status(404).json({ error: 'No release healthcheck data available. Run the export pipeline first.' })
    }
    res.json(data)
  })

  // GET /api/modules/deep-analytics/status
  router.get('/status', requireAuth, function (req, res) {
    const tvfv = storage.readFromStorage('deep-analytics/tv-fv-delta.json')
    const health = storage.readFromStorage('deep-analytics/release-healthcheck.json')

    res.json({
      tv_fv_delta: tvfv
        ? { available: true, generated_at: tvfv.metadata?.generated_at, releases: tvfv.metadata?.releases }
        : { available: false },
      release_healthcheck: health
        ? { available: true, generated_at: health.metadata?.generated_at, target_version: health.metadata?.target_version }
        : { available: false },
    })
  })

  // POST /api/modules/deep-analytics/ingest/:type
  // Accepts JSON payload directly (used by export pipeline on cluster)
  router.post('/ingest/:type', requireAdmin, function (req, res) {
    const type = req.params.type
    const validTypes = ['tv-fv-delta', 'release-healthcheck']
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` })
    }

    const filename = type === 'tv-fv-delta' ? 'tv-fv-delta.json' : 'release-healthcheck.json'
    storage.writeToStorage(`deep-analytics/${filename}`, req.body)
    res.json({ success: true, type, size: JSON.stringify(req.body).length })
  })

  // Diagnostics hook
  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function () {
      const tvfv = storage.readFromStorage('deep-analytics/tv-fv-delta.json')
      const health = storage.readFromStorage('deep-analytics/release-healthcheck.json')
      return {
        tvFvDelta: tvfv ? { generatedAt: tvfv.metadata?.generated_at } : null,
        releaseHealth: health ? { generatedAt: health.metadata?.generated_at } : null,
      }
    })
  }
}
