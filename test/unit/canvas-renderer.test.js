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
    idOf: (i) => i,
    getAttrib: (row, a) => row[a],
    getAttribName: (a) => a,
    visibleAttribs: () => [],
    indexOfRow: (r) => r,
    posAt: () => 0,
    isMissing: (v) => v === undefined || v === null,
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
});
