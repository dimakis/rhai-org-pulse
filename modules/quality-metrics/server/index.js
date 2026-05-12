const { fetchVersions, fetchBugs, getComponents } = require('./data-fetcher.js');
const { computeCumulativeBugData } = require('./calculations.js');

module.exports = function registerRoutes(router, context) {
  const { storage, requireAdmin } = context;

  router.get('/versions', function(req, res) {
    const versions = storage.readFromStorage('quality-metrics/versions.json') || [];
    const componentFilter = req.query.component || null;

    // Compute bug counts per version
    const projects = ['RHOAIENG', 'AIPCC', 'RHAIENG', 'INFERENG'];
    const allBugs = [];
    for (const project of projects) {
      const bugs = storage.readFromStorage(`quality-metrics/bugs-${project}.json`) || [];
      allBugs.push(...bugs);
    }

    // Filter bugs by component if specified
    const filteredBugs = componentFilter
      ? allBugs.filter(bug => bug.components.includes(componentFilter))
      : allBugs;

    const versionsWithCounts = versions.map(version => {
      const bugCount = filteredBugs.filter(bug =>
        bug.affectedVersions.includes(version.name)
      ).length;
      return { ...version, bugCount };
    });

    // Sort by bug count descending (most bugs first)
    versionsWithCounts.sort((a, b) => b.bugCount - a.bugCount);

    res.json(versionsWithCounts);
  });

  router.get('/bugs', function(req, res) {
    const versions = (req.query.versions || '').split(',').filter(Boolean);
    const component = req.query.component || null;

    if (versions.length === 0) {
      return res.json({ labels: [], datasets: [] });
    }

    const projects = ['RHOAIENG', 'AIPCC', 'RHAIENG', 'INFERENG'];
    const allBugs = [];
    for (const project of projects) {
      const bugs = storage.readFromStorage(`quality-metrics/bugs-${project}.json`) || [];
      allBugs.push(...bugs);
    }

    const versionSet = new Set(versions);
    let filteredBugs = allBugs.filter(bug =>
      bug.affectedVersions.some(v => versionSet.has(v))
    );

    if (component) {
      filteredBugs = filteredBugs.filter(bug =>
        bug.components.includes(component)
      );
    }

    const chartData = computeCumulativeBugData(filteredBugs, versions, storage);
    res.json(chartData);
  });

  router.get('/components', function(req, res) {
    // Get all bugs across all projects
    const projects = ['RHOAIENG', 'AIPCC', 'RHAIENG', 'INFERENG'];
    const allBugs = [];
    for (const project of projects) {
      const bugs = storage.readFromStorage(`quality-metrics/bugs-${project}.json`) || [];
      allBugs.push(...bugs);
    }

    // Compute bug counts per component
    const componentCounts = {};
    for (const bug of allBugs) {
      for (const comp of bug.components) {
        componentCounts[comp] = (componentCounts[comp] || 0) + 1;
      }
    }

    // Convert to array and sort by count descending
    const componentsWithCounts = Object.entries(componentCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    res.json(componentsWithCounts);
  });

  router.post('/refresh', requireAdmin, async function(req, res) {
    try {
      const projects = ['RHOAIENG', 'AIPCC', 'RHAIENG', 'INFERENG'];

      const versions = await fetchVersions(projects);
      storage.writeToStorage('quality-metrics/versions.json', versions);

      for (const project of projects) {
        const bugs = await fetchBugs(project, versions);
        storage.writeToStorage(`quality-metrics/bugs-${project}.json`, bugs);
      }

      const components = await getComponents(projects);
      storage.writeToStorage('quality-metrics/components.json', components);

      res.json({ success: true, fetchedAt: new Date().toISOString() });
    } catch (error) {
      console.error('[quality-metrics] Refresh error:', error);
      res.status(500).json({ error: error.message });
    }
  });
};
