const { fetchVersions, fetchBugs, getComponents } = require('./data-fetcher.js');
const { computeCumulativeBugData } = require('./calculations.js');

const PROJECTS = ['RHOAIENG', 'AIPCC', 'RHAIENG', 'INFERENG'];

module.exports = function registerRoutes(router, context) {
  const { storage, requireAdmin } = context;

  function loadAllBugs() {
    const allBugs = [];
    for (const project of PROJECTS) {
      const bugs = storage.readFromStorage(`quality-metrics/bugs-${project}.json`) || [];
      allBugs.push(...bugs);
    }
    return allBugs;
  }

  router.get('/versions', function(req, res) {
    try {
      const versions = storage.readFromStorage('quality-metrics/versions.json') || [];
      const componentFilter = req.query.component || null;

      const allBugs = loadAllBugs();

      const filteredBugs = componentFilter
        ? allBugs.filter(bug => bug.components.includes(componentFilter))
        : allBugs;

      const versionsWithCounts = versions.map(version => {
        const bugCount = filteredBugs.filter(bug =>
          bug.affectedVersions.includes(version.name)
        ).length;
        return { ...version, bugCount };
      });

      versionsWithCounts.sort((a, b) => b.bugCount - a.bugCount);

      res.json(versionsWithCounts);
    } catch (error) {
      console.error('[quality-metrics] Read versions error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/bugs', function(req, res) {
    try {
      const versions = (req.query.versions || '').split(',').filter(Boolean);
      const component = req.query.component || null;

      if (versions.length === 0) {
        return res.json({ labels: [], datasets: [] });
      }

      const allBugs = loadAllBugs();

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
    } catch (error) {
      console.error('[quality-metrics] Read bugs error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/components', function(req, res) {
    try {
      const allBugs = loadAllBugs();

      const componentCounts = {};
      for (const bug of allBugs) {
        for (const comp of bug.components) {
          componentCounts[comp] = (componentCounts[comp] || 0) + 1;
        }
      }

      const componentsWithCounts = Object.entries(componentCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      res.json(componentsWithCounts);
    } catch (error) {
      console.error('[quality-metrics] Read components error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/refresh', requireAdmin, async function(req, res) {
    try {
      const versions = await fetchVersions(PROJECTS);
      storage.writeToStorage('quality-metrics/versions.json', versions);

      for (const project of PROJECTS) {
        const bugs = await fetchBugs(project, versions);
        storage.writeToStorage(`quality-metrics/bugs-${project}.json`, bugs);
      }

      const components = await getComponents(PROJECTS);
      storage.writeToStorage('quality-metrics/components.json', components);

      res.json({ success: true, fetchedAt: new Date().toISOString() });
    } catch (error) {
      console.error('[quality-metrics] Refresh error:', error);
      res.status(500).json({ error: error.message });
    }
  });
};
