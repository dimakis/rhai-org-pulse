const { createSession, sendMessage } = require('./opencode-client')

const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 60_000
const rateCounts = new Map()

// Maps sessionId → userEmail for ownership validation
const sessionOwners = new Map()

let _lastCleanup = Date.now()

function isRateLimited(email) {
  const now = Date.now()

  // Periodic cleanup: sweep stale entries every 5 minutes
  if (now - _lastCleanup > 5 * RATE_LIMIT_WINDOW_MS) {
    _lastCleanup = now
    for (const [k, v] of rateCounts) {
      if (now - v.windowStart >= RATE_LIMIT_WINDOW_MS) rateCounts.delete(k)
    }
  }

  const entry = rateCounts.get(email)
  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateCounts.set(email, { windowStart: now, count: 1 })
    return false
  }
  entry.count++
  return entry.count > RATE_LIMIT_MAX
}

function buildSystemPrompt(context) {
  if (!context) return ''
  const parts = ['You are an AI assistant embedded in Org Pulse, an internal org-health dashboard.']
  const safeStr = (s) => typeof s === 'string' ? s.replace(/[^a-zA-Z0-9 _-]/g, '') : ''
  if (context.module) parts.push(`The user is currently viewing the "${safeStr(context.module)}" module.`)
  if (context.view) parts.push(`They are on the "${safeStr(context.view)}" view.`)
  if (context.params && typeof context.params === 'object' && Object.keys(context.params).length > 0) {
    // Limit params to prevent prompt stuffing
    const safeParams = {}
    const keys = Object.keys(context.params).slice(0, 10)
    for (const k of keys) {
      const v = context.params[k]
      if (typeof v === 'string') safeParams[k] = v.slice(0, 200)
    }
    parts.push(`Page parameters: ${JSON.stringify(safeParams)}`)
  }
  parts.push('Answer concisely. Use markdown for formatting. If you don\'t know something, say so.')
  return parts.join(' ')
}

module.exports = function registerRoutes(router, context) {
  const { requireAuth, requireScope } = context

  context.registerScopes([
    { key: 'ai-assistant:use', label: 'Use', description: 'Send messages to the AI assistant', category: 'AI Assistant' }
  ])

  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function () {
      const url = context.resolveSecret('OPENCODE_URL')
      return {
        configured: !!url,
        openCodeUrl: url ? url.replace(/\/\/.*@/, '//***@') : null
      }
    })
  }

  router.post('/chat', requireAuth, requireScope('ai-assistant:use'), async function (req, res) {
    const baseUrl = context.resolveSecret('OPENCODE_URL')
    if (!baseUrl) {
      return res.status(503).json({ error: 'AI assistant is not configured (OPENCODE_URL missing)' })
    }

    if (!req.userEmail) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    if (isRateLimited(req.userEmail)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.' })
    }

    const { message, sessionId: existingSessionId, context: pageContext } = req.body
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' })
    }
    if (message.length > 4000) {
      return res.status(400).json({ error: 'message too long (max 4000 characters)' })
    }

    // Validate pageContext shape to prevent prompt injection
    if (pageContext) {
      if (pageContext.module && typeof pageContext.module !== 'string') {
        return res.status(400).json({ error: 'context.module must be a string' })
      }
      if (pageContext.view && typeof pageContext.view !== 'string') {
        return res.status(400).json({ error: 'context.view must be a string' })
      }
      if (pageContext.params && typeof pageContext.params !== 'object') {
        return res.status(400).json({ error: 'context.params must be an object' })
      }
    }

    try {
      // Validate session ownership or create new session
      let sessionId = null
      if (existingSessionId) {
        const owner = sessionOwners.get(existingSessionId)
        if (owner && owner !== req.userEmail) {
          return res.status(403).json({ error: 'Session does not belong to this user' })
        }
        sessionId = existingSessionId
      }

      if (!sessionId) {
        sessionId = await createSession(baseUrl)
        sessionOwners.set(sessionId, req.userEmail)
      }

      // Prepend page context to the user message
      const systemPrompt = buildSystemPrompt(pageContext)
      const fullMessage = systemPrompt
        ? `[System context: ${systemPrompt}]\n\n${message}`
        : message

      const responseText = await sendMessage(baseUrl, sessionId, fullMessage)

      res.json({ sessionId, text: responseText })
    } catch (err) {
      console.error('[ai-assistant] Chat error:', err.message)
      res.status(500).json({ error: 'Failed to get response from AI assistant' })
    }
  })
}
