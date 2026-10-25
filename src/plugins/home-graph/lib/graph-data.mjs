// Pure helpers shared by the browser renderer and the node tests.
// No DOM, no imports.

/**
 * Turn the garden's /graph.json into a { nodes, links } pair containing only
 * visible notes. Nodes flagged `hide` (dg-hide / dg-hide-in-graph) and any
 * link touching them are dropped. Links are de-duplicated as undirected pairs.
 */
export function toGlobalGraph(graph) {
  if (!graph || !graph.nodes) return { nodes: [], links: [] };
  const nodes = Object.values(graph.nodes).filter((n) => n && !n.hide);
  const visible = new Set(nodes.map((n) => n.id));
  const seen = new Set();
  const links = [];
  for (const l of graph.links || []) {
    if (!l || !visible.has(l.source) || !visible.has(l.target)) continue;
    if (l.source === l.target) continue;
    const key = l.source < l.target ? `${l.source}|${l.target}` : `${l.target}|${l.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ source: l.source, target: l.target });
  }
  return {
    nodes: nodes.map((n) => ({ id: n.id, url: n.url, title: n.title, home: !!n.home })),
    links,
  };
}

/** Number of visible links touching each node id. */
export function buildDegreeMap(links) {
  const degrees = {};
  for (const l of links || []) {
    const s = typeof l.source === "object" ? l.source.id : l.source;
    const t = typeof l.target === "object" ? l.target.id : l.target;
    degrees[s] = (degrees[s] || 0) + 1;
    degrees[t] = (degrees[t] || 0) + 1;
  }
  return degrees;
}

/** Same sizing curve as the core graph: small base, grows with sqrt(degree). */
export function nodeRadius(degree) {
  return 2 + Math.sqrt(degree || 0);
}

/**
 * Zoom transform that fits a set of positioned points into width x height.
 * Returns { k, x, y } or null if no point has a position yet.
 */
export function fitTransform(points, width, height, padding = 50, maxScale = 2) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points || []) {
    if (p.x == null || p.y == null) continue;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  if (minX === Infinity || !width || !height) return null;
  const gw = maxX - minX + padding * 2;
  const gh = maxY - minY + padding * 2;
  const k = Math.min(width / gw, height / gh, maxScale);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return { k, x: width / 2 - cx * k, y: height / 2 - cy * k };
}

/** Parse the plugin's data-* attribute values. */
export function readOptions(dataset) {
  const d = dataset || {};
  return {
    placement: ["replace", "above", "below"].includes(d.placement) ? d.placement : "replace",
    showLabels: d.showLabels === "true",
  };
}
