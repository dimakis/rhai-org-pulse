module.exports = function registerRoutes(router, context) {
  const { storage, requireAuth, requireAdmin } = context

  const REQUIRED_KEYS = {
    'tv-fv-delta': ['metadata', 'executive_summary', 'releases'],
    'release-healthcheck': ['metadata', 'executive_summary', 'features'],
  }

  /**
   * @openapi
   * /api/modules/deep-analytics/tv-fv-delta:
   *   get:
   *     tags: ['Deep Analytics']
   *     summary: Get TV vs FV delta analysis
   *     responses:
   *       200:
   *         description: TV/FV delta data with per-release breakdowns
   *       404:
   *         description: No data available — run the export pipeline
   */
  router.get('/tv-fv-delta', requireAuth, function (req, res) {
    const data = storage.readFromStorage('deep-analytics/tv-fv-delta.json')
    if (!data) {
      return res.status(404).json({ error: 'No TV/FV delta data available. Run the export pipeline first.' })
    }
    res.json(data)
  })

  /**
   * @openapi
   * /api/modules/deep-analytics/release-health:
   *   get:
   *     tags: ['Deep Analytics']
   *     summary: Get release healthcheck analysis
   *     responses:
   *       200:
   *         description: Release health data with hygiene, drift, and action items
   *       404:
   *         description: No data available — run the export pipeline
   */
  router.get('/release-health', requireAuth, function (req, res) {
    const data = storage.readFromStorage('deep-analytics/release-healthcheck.json')
    if (!data) {
      return res.status(404).json({ error: 'No release healthcheck data available. Run the export pipeline first.' })
    }
    res.json(data)
  })

  /**
   * @openapi
   * /api/modules/deep-analytics/status:
   *   get:
   *     tags: ['Deep Analytics']
   *     summary: Check data availability for all deep-analytics datasets
   *     responses:
   *       200:
   *         description: Availability and metadata for each dataset
   */
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

  /**
   * @openapi
   * /api/modules/deep-analytics/ingest/{type}:
   *   post:
   *     tags: ['Deep Analytics']
   *     summary: Ingest JSON payload from export pipeline
   *     security: [{ admin: [] }]
   *     parameters:
   *       - in: path
   *         name: type
   *         required: true
   *         schema:
   *           type: string
   *           enum: [tv-fv-delta, release-healthcheck]
   *         description: Dataset type to ingest
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       200:
   *         description: Ingestion successful
   *       400:
   *         description: Invalid type or missing required keys
   */
  router.post('/ingest/:type', requireAdmin, function (req, res) {
    const type = req.params.type
    const validTypes = ['tv-fv-delta', 'release-healthcheck']
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` })
    }

    const required = REQUIRED_KEYS[type]
    const missing = required.filter(k => !(k in req.body))
    if (missing.length) {
      return res.status(400).json({ error: `Missing required keys: ${missing.join(', ')}` })
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
