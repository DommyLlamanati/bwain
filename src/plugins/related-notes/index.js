module.exports = {
  setupEleventy(eleventyConfig) {
    // Notes related to the given url: the 2-hop link neighborhood, scored
    // by how many connections lead there. Direct neighbors are excluded —
    // they're already visible as links and backlinks.
    eleventyConfig.addFilter("gpRelatedNotes", function (graph, url, count) {
      const nodes = (graph && graph.nodes) || {};
      const current = nodes[url];

      if (!current) {
        return [];
      }

      const direct = new Set(current.neighbors || []);
      const scores = new Map();

      for (const neighborUrl of direct) {
        const neighbor = nodes[neighborUrl];

        for (const candidateUrl of (neighbor && neighbor.neighbors) || []) {
          const candidate = nodes[candidateUrl];

          if (
            !candidate ||
            candidate.hide ||
            candidate.home ||
            candidateUrl === url ||
            direct.has(candidateUrl)
          ) {
            continue;
          }

          scores.set(candidateUrl, (scores.get(candidateUrl) || 0) + 1);
        }
      }

      return [...scores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, count || 4)
        .map(([relatedUrl]) => ({
          url: relatedUrl,
          title: nodes[relatedUrl].title,
          noteIcon: nodes[relatedUrl].noteIcon,
        }));
    });
  },
};
