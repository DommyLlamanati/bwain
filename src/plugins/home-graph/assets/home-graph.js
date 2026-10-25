// Home Graph plugin: renders the whole garden's link graph on the home page.
// Force layout by d3, drawing by Pixi (both already used by the core graph).
import { forceSimulation, forceManyBody, forceCenter, forceLink, forceCollide, forceRadial } from "https://cdn.jsdelivr.net/npm/d3-force@3.0.0/+esm";
import { select } from "https://cdn.jsdelivr.net/npm/d3-selection@3.0.0/+esm";
import { zoom as d3Zoom, zoomIdentity } from "https://cdn.jsdelivr.net/npm/d3-zoom@3.0.0/+esm";
import { drag as d3Drag } from "https://cdn.jsdelivr.net/npm/d3-drag@3.0.0/+esm";
import "https://cdn.jsdelivr.net/npm/d3-transition@3.0.1/+esm"; // selection.transition() for the animated fit button
import { toGlobalGraph, buildDegreeMap, nodeRadius, fitTransform, readOptions } from "../lib/graph-data.mjs";

const PIXI_URL = "https://cdn.jsdelivr.net/npm/pixi.js@7.4.2/dist/pixi.min.js";

function loadPixi() {
  if (window.PIXI) return Promise.resolve(window.PIXI);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${PIXI_URL}"]`);
    const s = existing || document.createElement("script");
    s.addEventListener("load", () => resolve(window.PIXI));
    s.addEventListener("error", () => reject(new Error("pixi failed to load")));
    if (!existing) {
      s.src = PIXI_URL;
      document.head.appendChild(s);
    }
  });
}

function cssVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

const probe = document.createElement("div");
probe.style.display = "none";
document.body.appendChild(probe);
function resolveColor(value, fallback) {
  probe.style.color = "";
  probe.style.color = value;
  const m = getComputedStyle(probe).color.match(/(\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return fallback;
  return (parseInt(m[1], 10) << 16) + (parseInt(m[2], 10) << 8) + parseInt(m[3], 10);
}

const decoder = document.createElement("textarea");
function htmlDecode(s) {
  decoder.innerHTML = s || "";
  return decoder.value;
}

function render(PIXI, el, data, state) {
  const { Application, Container, Graphics, Text, Circle } = PIXI;
  while (el.firstChild) el.removeChild(el.firstChild);
  const width = el.clientWidth;
  const height = el.clientHeight;
  if (!width || !height || !data.nodes.length) return null;

  const mainColor = resolveColor(cssVar("--dg-graph-node-color") || cssVar("--graph-main") || "#666", 0x666666);
  const mutedColor = resolveColor(cssVar("--dg-graph-node-color-muted") || cssVar("--graph-muted") || "#ccc", 0xcccccc);
  const textColor = resolveColor(cssVar("--dg-graph-label-color") || cssVar("--text-normal") || "#eee", 0xeeeeee);
  const bodyFont = getComputedStyle(document.body).fontFamily || "Sans-Serif";

  const degrees = buildDegreeMap(data.links);
  const nodes = data.nodes.map((n) => ({ ...n, text: htmlDecode(n.title) }));
  const links = data.links.map((l) => ({ source: l.source, target: l.target }));

  const simulation = forceSimulation(nodes)
    .force("charge", forceManyBody().strength(-300))
    .force("center", forceCenter(width / 2, height / 2).strength(0.5))
    .force("link", forceLink(links).id((d) => d.id).distance(80))
    .force("collide", forceCollide((d) => nodeRadius(degrees[d.id]) + 1).iterations(3))
    .force("radial", forceRadial(Math.min(width, height) / 3, width / 2, height / 2).strength(0.05));

  const app = new Application({
    width, height, antialias: true, autoStart: false, autoDensity: true,
    backgroundAlpha: 0, resolution: window.devicePixelRatio || 1,
  });
  el.appendChild(app.view);

  const stage = app.stage;
  stage.interactive = true;
  stage.hitArea = app.screen;
  const linkGfx = new Graphics();
  const nodesLayer = new Container();
  const labelsLayer = new Container();
  stage.addChild(linkGfx, nodesLayer, labelsLayer);

  let hovered = null;
  let dragging = false;
  let dragStart = { t: 0, x: 0, y: 0 };
  let transform = zoomIdentity;
  const nodeItems = [];
  const linkItems = [];

  function setHover(id) {
    hovered = id;
    const neighbours = new Set();
    for (const l of linkItems) {
      const s = l.sim.source.id, t = l.sim.target.id;
      l.active = id !== null && (s === id || t === id);
      if (l.active) { neighbours.add(s); neighbours.add(t); }
    }
    for (const n of nodeItems) {
      n.active = id !== null && neighbours.has(n.sim.id);
      n.target = id === null ? 1 : n.active ? 1 : 0.1;
    }
    for (const l of linkItems) l.target = id === null ? 0.4 : l.active ? 0.8 : 0.05;
  }

  for (const n of nodes) {
    const r = nodeRadius(degrees[n.id]);
    const label = new Text(n.text, { fontSize: 16, fill: textColor, fontFamily: bodyFont });
    label.resolution = 2;
    label.anchor.set(0.5, 1);
    label.scale.set(1 / 3);
    label.alpha = state.showLabels ? 1 : 0;

    const gfx = new Graphics();
    gfx.interactive = true;
    gfx.cursor = "pointer";
    gfx.hitArea = new Circle(0, 0, r + 2);
    gfx.beginFill(n.home ? mainColor : mutedColor);
    gfx.drawCircle(0, 0, r);
    gfx.endFill();
    if (n.home) {
      gfx.lineStyle(0.5, mainColor);
      gfx.drawCircle(0, 0, r + 1.5);
    }
    gfx.on("pointerover", () => { setHover(n.id); });
    gfx.on("pointerleave", () => { setHover(null); });

    nodesLayer.addChild(gfx);
    labelsLayer.addChild(label);
    nodeItems.push({ sim: n, gfx, label, r, active: false, target: 1, alpha: 1 });
  }
  for (const l of links) linkItems.push({ sim: l, active: false, target: 0.4, alpha: 0.4 });

  select(app.view).call(
    d3Drag()
      .container(() => app.view)
      .subject(() => {
        if (hovered === null) return null;
        const node = nodes.find((n) => n.id === hovered);
        if (!node) return null;
        return { x: node.x * transform.k + transform.x, y: node.y * transform.k + transform.y, node };
      })
      .on("start", (event) => {
        if (!event.active) simulation.alphaTarget(0.7).restart();
        const node = event.subject.node;
        node.fx = node.x; node.fy = node.y;
        dragStart = { t: Date.now(), x: event.x, y: event.y };
        dragging = true;
      })
      .on("drag", (event) => {
        const node = event.subject.node;
        node.fx = (event.x - transform.x) / transform.k;
        node.fy = (event.y - transform.y) / transform.k;
      })
      .on("end", (event) => {
        if (!event.active) simulation.alphaTarget(0);
        const node = event.subject.node;
        node.fx = null; node.fy = null;
        dragging = false;
        const dt = Date.now() - dragStart.t;
        const dist = Math.hypot(event.x - dragStart.x, event.y - dragStart.y);
        if (dt < 500 && dist < 5 && node.url) window.location = node.url;
      })
  );

  function labelAlphaFor(k) {
    return state.showLabels ? 1 : Math.max((k - 1) / 3.75, 0);
  }
  const zoomBehavior = d3Zoom()
    .extent([[0, 0], [width, height]])
    .scaleExtent([0.1, 6])
    .on("zoom", ({ transform: t }) => {
      transform = t;
      stage.scale.set(t.k, t.k);
      stage.position.set(t.x, t.y);
    });
  select(app.view).call(zoomBehavior);

  let stopped = false;
  function frame() {
    if (stopped) return;
    const idle = labelAlphaFor(transform.k);
    for (const n of nodeItems) {
      const { x, y } = n.sim;
      if (x == null || y == null) continue;
      n.gfx.position.set(x, y);
      n.label.position.set(x, y - n.r - 2);
      n.alpha += (n.target - n.alpha) * 0.15;
      n.gfx.alpha = n.alpha;
      n.label.alpha = n.sim.id === hovered ? 1 : hovered !== null ? (n.active ? Math.max(idle, 0.6) : idle * 0.2) : idle;
    }
    linkGfx.clear();
    for (const l of linkItems) {
      const s = l.sim.source, t = l.sim.target;
      if (s.x == null || t.x == null) continue;
      l.alpha += (l.target - l.alpha) * 0.15;
      linkGfx.lineStyle(1, l.active ? mainColor : mutedColor, l.alpha);
      linkGfx.moveTo(s.x, s.y);
      linkGfx.lineTo(t.x, t.y);
    }
    app.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function fit(animated) {
    const t = fitTransform(nodes, width, height);
    if (!t) return;
    const z = zoomIdentity.translate(t.x, t.y).scale(t.k);
    const sel = animated ? select(app.view).transition().duration(400) : select(app.view);
    sel.call(zoomBehavior.transform, z);
  }
  // Keep the whole graph in view while the layout settles, then leave the
  // camera alone. Stops early as soon as the visitor zooms, pans or drags.
  let userZoomed = false;
  let settled = false;
  zoomBehavior.on("start.user", (event) => { if (event.sourceEvent) userZoomed = true; });
  simulation.on("tick", () => { if (!settled && !userZoomed && !dragging) fit(false); });
  simulation.on("end", () => { settled = true; });

  return {
    fit: () => fit(true),
    destroy() {
      stopped = true;
      simulation.stop();
      select(app.view).on(".drag", null).on(".zoom", null);
      app.destroy(true, { children: true });
    },
  };
}

async function main() {
  const root = document.querySelector("[data-home-graph]");
  if (!root) return;
  const canvasEl = root.querySelector("[data-home-graph-canvas]");
  const emptyEl = root.querySelector("[data-home-graph-empty]");
  const state = readOptions(root.dataset);

  let graph;
  try {
    const [PIXI, raw] = await Promise.all([loadPixi(), fetch("/graph.json").then((r) => r.json())]);
    graph = { PIXI, data: toGlobalGraph(raw) };
  } catch (err) {
    console.warn("[home-graph] could not load the graph:", err);
    return;
  }
  if (!graph.data.nodes.length) {
    if (emptyEl) emptyEl.hidden = false;
    root.dataset.state = "empty";
    return;
  }
  root.dataset.state = "ready";

  let instance = null;
  function draw() {
    if (instance) instance.destroy();
    instance = null;
    try {
      instance = render(graph.PIXI, canvasEl, graph.data, state);
    } catch (err) {
      // Typically: no WebGL available. Leave a note instead of a blank box.
      console.warn("[home-graph] could not render the graph:", err);
      root.dataset.state = "error";
      if (emptyEl) {
        emptyEl.textContent = "The graph could not be rendered in this browser.";
        emptyEl.hidden = false;
      }
    }
  }
  draw();

  let resizeTimer = null;
  let lastWidth = canvasEl.clientWidth;
  window.addEventListener("resize", () => {
    if (canvasEl.clientWidth === lastWidth) return;
    lastWidth = canvasEl.clientWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(draw, 200);
  });
  document.addEventListener("forestry:css-changed", draw);

  const fitBtn = root.querySelector("[data-home-graph-fit]");
  if (fitBtn) fitBtn.addEventListener("click", () => instance && instance.fit());
  const labelBtn = root.querySelector("[data-home-graph-labels]");
  if (labelBtn) labelBtn.addEventListener("click", () => {
    state.showLabels = !state.showLabels;
    labelBtn.setAttribute("aria-pressed", String(state.showLabels));
  });
}

main();
