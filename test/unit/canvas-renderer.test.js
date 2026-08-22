import { describe, it, expect } from "vitest";
import { createCanvasRenderer } from "../../src/render/canvas.js";

// A recording 2D context: enough surface for the painters to run real code
// rather than stubs, and to assert the exact call order they produce.
function fakeContext() {
  const calls = [];
  return {
    calls,
    save: () => calls.push(["save"]),
    restore: () => calls.push(["restore"]),
    beginPath: () => calls.push(["beginPath"]),
    closePath: () => calls.push(["closePath"]),
    moveTo: (x, y) => calls.push(["moveTo", x, y]),
    lineTo: (x, y) => calls.push(["lineTo", x, y]),
    rect: (x, y, w, h) => calls.push(["rect", x, y, w, h]),
    quadraticCurveTo: (a, b, c, d) =>
      calls.push(["quadraticCurveTo", a, b, c, d]),
    stroke: () => calls.push(["stroke"]),
    fill: () => calls.push(["fill"]),
    set lineWidth(v) {
      calls.push(["lineWidth", v]);
    },
    set strokeStyle(v) {
      calls.push(["strokeStyle", v]);
    },
    set fillStyle(v) {
      calls.push(["fillStyle", v]);
    },
    set globalAlpha(v) {
      calls.push(["globalAlpha", v]);
    },
  };
}

function buildCtx(overrides = {}) {
  return {
    nv: { DEBUG: false, ...overrides.nv },
    context: overrides.context,
    data: [],
    dataIs: [],
    links: [],
    visibleLinks: [],
    selectedFlags: new Uint8Array(0),
    colScales: new Map(),
    rows: {
      idOf: (i) => i,
      indexOfRow: (r) => r,
      posAt: () => 0,
    },
    visibleAttribs: () => [],
    theme: () => ({ border: "#000" }),
    divisionsColour: () => "#ccc",
    ...overrides,
  };
}

describe("createCanvasRenderer construction contract", () => {
  // drawLinks is one of the module's two public entry points, and it reads
  // three ctx bindings - context, links and nv - which makes it the natural
  // surface for pinning the getter contract. The painters behind it are
  // private by design (see the design doc's section 3), and what they put on
  // the canvas is covered by the e2e suite, not here.

  it("does not touch the context when there are no links", () => {
    const context = fakeContext();
    const { drawLinks } = createCanvasRenderer(buildCtx({ context }));
    // geom is never reached on the empty path, so it does not need to be real.
    drawLinks({});
    expect(context.calls).toEqual([]);
  });

  // The contract this module exists to honour. `context` is assigned in
  // init() (src/navio.js), long after this factory is constructed, so a
  // renderer that captured ctx.context by VALUE would hold undefined forever
  // and throw on the first paint. Same class of bug as geom's yScales getter.
  it("reads the CURRENT context, not one captured at construction", () => {
    let context = null;
    const ctx = buildCtx({ links: [{}], visibleLinks: [] });
    Object.defineProperty(ctx, "context", { get: () => context });
    const { drawLinks } = createCanvasRenderer(ctx);

    // Constructed while context is still null - exactly navio's real order.
    context = fakeContext();
    drawLinks({});
    expect(context.calls[0]).toEqual(["save"]);
    expect(context.calls).toContainEqual(["stroke"]);
    expect(context.calls[context.calls.length - 1]).toEqual(["restore"]);
  });

  it("reads the CURRENT links array, not one captured at construction", () => {
    let links = [];
    const context = fakeContext();
    const ctx = buildCtx({ context, visibleLinks: [] });
    Object.defineProperty(ctx, "links", { get: () => links });
    const { drawLinks } = createCanvasRenderer(ctx);

    drawLinks({});
    expect(context.calls).toEqual([]); // empty -> early return

    links = [{}, {}];
    drawLinks({});
    expect(context.calls).toContainEqual(["save"]);
  });

  // The third getter reachable from the public surface, and the one whose
  // failure is SILENT: visibleLinks starts as [] (src/navio.js), so a stale
  // capture never throws - links simply stop being painted. This test pins
  // THIS module's half of the contract (that the module re-reads ctx per call),
  // but nothing catches navio.js's half (actually supplying a getter): all 293
  // e2e specs pass with it captured by value, because 61-link-endpoints.spec.js
  // asserts on nv.getVisibleLinks() (the model) rather than on what reaches
  // the canvas.
  it("reads the CURRENT visibleLinks, not one captured at construction", () => {
    let visibleLinks = [];
    const context = fakeContext();
    // links non-empty so drawLinks gets past its early return; one level and
    // one attribute is all drawLink needs to resolve an endpoint.
    const ctx = buildCtx({
      context,
      links: [{}],
      dataIs: [[0]],
      visibleAttribs: () => ["value"],
    });
    Object.defineProperty(ctx, "visibleLinks", { get: () => visibleLinks });
    const { drawLinks } = createCanvasRenderer(ctx);
    // rightBorder = cellA + bandwidthA + 2 = 12; ys = cellR + bandwidthR/2 = 6.
    const geom = {
      cellA: () => 0,
      bandwidthA: () => 10,
      cellR: () => 5,
      bandwidthR: () => 2,
    };

    drawLinks(geom);
    expect(context.calls).not.toContainEqual(["moveTo", 12, 6]);

    visibleLinks = [{ source: 0, target: 0 }];
    drawLinks(geom);
    expect(context.calls).toContainEqual(["moveTo", 12, 6]);
  });
});
