import test from "node:test";
import assert from "node:assert/strict";
import { toGlobalGraph, buildDegreeMap, nodeRadius, fitTransform, readOptions } from "../lib/graph-data.mjs";

const sample = {
  nodes: {
    "/": { id: 0, url: "/", title: "Home", home: true, hide: false },
    "/a/": { id: 1, url: "/a/", title: "A &amp; B", hide: false },
    "/secret/": { id: 2, url: "/secret/", title: "Secret", hide: true },
    "/b/": { id: 3, url: "/b/", title: "B" },
  },
  links: [
    { source: 0, target: 1 },
    { source: 1, target: 0 },
    { source: 1, target: 2 },
    { source: 2, target: 3 },
    { source: 3, target: 3 },
    { source: 1, target: 3 },
  ],
};

test("toGlobalGraph drops hidden nodes and links touching them", () => {
  const g = toGlobalGraph(sample);
  assert.deepEqual(g.nodes.map((n) => n.id).sort(), [0, 1, 3]);
  assert.ok(g.links.every((l) => l.source !== 2 && l.target !== 2));
});

test("toGlobalGraph de-duplicates reverse links and drops self links", () => {
  const g = toGlobalGraph(sample);
  assert.deepEqual(g.links, [
    { source: 0, target: 1 },
    { source: 1, target: 3 },
  ]);
});

test("toGlobalGraph keeps the home flag and only the fields the renderer needs", () => {
  const g = toGlobalGraph(sample);
  const home = g.nodes.find((n) => n.id === 0);
  assert.deepEqual(home, { id: 0, url: "/", title: "Home", home: true });
  assert.equal(g.nodes.find((n) => n.id === 3).home, false);
});

test("toGlobalGraph tolerates missing or malformed input", () => {
  assert.deepEqual(toGlobalGraph(null), { nodes: [], links: [] });
  assert.deepEqual(toGlobalGraph({}), { nodes: [], links: [] });
  assert.deepEqual(toGlobalGraph({ nodes: { x: { id: 1, hide: false } } }), {
    nodes: [{ id: 1, url: undefined, title: undefined, home: false }],
    links: [],
  });
});

test("buildDegreeMap counts both ends, with ids or resolved objects", () => {
  assert.deepEqual(buildDegreeMap([{ source: 1, target: 2 }, { source: { id: 2 }, target: { id: 3 } }]), { 1: 1, 2: 2, 3: 1 });
  assert.deepEqual(buildDegreeMap(undefined), {});
});

test("nodeRadius grows with sqrt of degree", () => {
  assert.equal(nodeRadius(0), 2);
  assert.equal(nodeRadius(undefined), 2);
  assert.equal(nodeRadius(4), 4);
});

test("fitTransform centres and scales the bounding box", () => {
  const t = fitTransform([{ x: 0, y: 0 }, { x: 100, y: 50 }], 400, 300, 50, 2);
  // box is 200 x 150 with padding, so k = min(400/200, 300/150, 2) = 2
  assert.equal(t.k, 2);
  assert.equal(t.x, 400 / 2 - 50 * 2);
  assert.equal(t.y, 300 / 2 - 25 * 2);
});

test("fitTransform returns null without positions or size", () => {
  assert.equal(fitTransform([{ x: null, y: null }], 400, 300), null);
  assert.equal(fitTransform([], 400, 300), null);
  assert.equal(fitTransform([{ x: 1, y: 1 }], 0, 300), null);
});

test("readOptions falls back to safe defaults", () => {
  assert.deepEqual(readOptions({ placement: "below", showLabels: "true" }), { placement: "below", showLabels: true });
  assert.deepEqual(readOptions({ placement: "sideways", showLabels: "yes" }), { placement: "replace", showLabels: false });
  assert.deepEqual(readOptions(undefined), { placement: "replace", showLabels: false });
});
