import { getAttrib, getAttribName, isMissing } from "../utils.js";

/**
 * navio's canvas painters: everything that draws to the 2D context.
 *
 * Built ONCE, in the closure, after the settings module is destructured
 * (src/navio.js:1259-1270) - `theme` and `divisionsColour` come from there.
 *
 * `context`, `data`, `dataIs`, `links`, `visibleLinks`, `selectedFlags` and
 * `colScales` are all reassigned during the widget's life - `context` in
 * init(), the rest on data changes and at destroy - so they cross as GETTERS
 * and are read at call time. Everything else here is either `nv` (never
 * rebound), a hoisted function declaration, or a `const` from the settings
 * module, and is safe as a plain value. This is the same contract
 * src/geometry.js documents, and CLAUDE.md's "a module gets GETTERS, not
 * values" landmine is about exactly this.
 *
 * The contract has two halves, and they are covered very differently.
 * test/unit/canvas-renderer.test.js pins THIS module's half - that the
 * functions here re-read ctx per call rather than capturing at construction -
 * by building its own ctx with getters. It says nothing about navio.js's
 * half: that navio.js actually hands these over AS getters. Mutation-testing
 * navio.js's ctx literal, one entry at a time, shows only four of the seven
 * are caught by anything: `context` throws at once (it is undefined until
 * init()), and `data`, `dataIs` and `colScales` produce loud e2e failures.
 * `links`, `visibleLinks` and `selectedFlags` are caught by NOTHING - all
 * 293 e2e specs pass with any of them captured by value, because each starts
 * empty, so a stale capture never throws: links silently stop painting and
 * the `selected` column paints all-unselected forever. Those three are held
 * correct by this contract alone. If you change how navio.js supplies them,
 * verify by hand - no test will tell you.
 *
 * Convention: anything read inside a loop, or read more than once, is
 * hoisted into a local at function entry - a getter read is a function call
 * and drawItem's attribute loop is navio's hot path (#111). One-shot reads
 * of never-rebound plain values are left inline as `ctx.x`.
 *
 * `geom` is NOT a ctx entry - it is passed per call, because every one of
 * these functions already takes it.
 *
 * See docs/ai/2026-08-21-navio-canvas-renderer-design.md.
 *
 * @param {object} ctx - { nv, get context(), get data(), get dataIs(),
 *   get links(), get visibleLinks(), get selectedFlags(), get colScales(),
 *   rows, visibleAttribs, theme, divisionsColour }
 */
export function createCanvasRenderer(ctx) {
  function drawLevelBorder(geom, i) {
    const context = ctx.context;
    context.save();
    context.beginPath();
    const origin = geom.toXY(geom.levelStartA(i), geom.recordAxisStart() - 1),
      size = geom.toWH(geom.levelExtentA() + 1, geom.recordExtent() + 2);
    context.rect(origin.x, origin.y, size.width, size.height);
    context.strokeStyle = ctx.theme().border;
    context.lineWidth = 1;
    context.stroke();
    context.restore();
  }

  /**
   * Stroke or fill a path of already-mapped SCREEN points.
   *
   * This is the one painter that takes no `geom`: its caller
   * (drawLevelConnections) builds the path in (attribute, record) space and
   * maps the whole thing through geom.toXY before calling here, so by this
   * point the coordinates are screen x/y and must not be transposed again.
   */
  function drawLine(points, width, color, close) {
    const context = ctx.context;
    context.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (i === 0) {
        context.moveTo(p.x, p.y);
      } else {
        context.lineTo(p.x, p.y);
      }
    }
    context.lineWidth = width;
    if (close) {
      context.fillStyle = color;
      context.closePath();
      context.fill();
    } else {
      context.strokeStyle = color;
      context.stroke();
    }
  }

  function drawItem(geom, rowIdx, level) {
    const {
      toXY,
      cellA,
      cellR,
      bandwidthA,
      bandwidthR,
      snapToDevice,
      pixelRatio,
    } = geom;
    // pixelRatio is a method call on geom; read it once per row rather than
    // twice per attribute (#111).
    const ratio = pixelRatio();
    // Read every rebound binding ONCE here, not per attribute: each is a
    // getter, and this loop is navio's hot path (see the design's section 4).
    const context = ctx.context,
      data = ctx.data,
      selectedFlags = ctx.selectedFlags,
      colScales = ctx.colScales,
      idOf = ctx.rows.idOf,
      divisionsColour = ctx.divisionsColour,
      nv = ctx.nv;
    const item = data[rowIdx];
    let attrib, i, y;

    const drawn = ctx.visibleAttribs();
    context.save();
    for (i = 0; i < drawn.length; i++) {
      attrib = drawn[i];
      // `selected` and `__seqId` are rendered columns but no longer row
      // properties - both are derived from the row's index. See #88.
      //
      // This is attribAt(rowIdx, attrib) (src/rows.js) open-coded. The
      // duplication is deliberate: consolidating onto ctx.rows.attribAt
      // measured ~594ms against ~587ms (medians-of-3-medians, 5-sample
      // medians each, 100 hardUpdate() calls at 20000 rows + 5000 links)
      // over six independently-rebuilt runs, interleaved B,A,B,A,A,B, with
      // zero overlap between the two groups. Thermal drift would give a
      // rising sequence; this one falls at runs 3 and 6, both times exactly
      // where it switches back to BEFORE, so the gap is the change and not
      // the machine warming up. It costs because this runs once per cell,
      // and a cross-module call per cell is what #111 was about. Keep the
      // two in sync by hand; rows.attribAt is the definition. See
      // docs/ai/2026-08-22-navio-row-access-design.md.
      const val =
        attrib === "selected"
          ? !!selectedFlags[rowIdx]
          : attrib === "__seqId"
            ? rowIdx
            : getAttrib(item, attrib, nv.DEBUG);
      const attribName = getAttribName(attrib);

      // A whole number of DEVICE pixels, so the stroke can sit exactly on the
      // grid. Round rather than ceil the device width: ceil in CSS units then
      // scaled would round twice and, at a fractional pixelRatio, still land
      // between pixels.
      const deviceWidth = Math.max(
        1,
        Math.round(Math.ceil(bandwidthR(level)) * ratio)
      );
      y = snapToDevice(
        cellR(idOf(rowIdx), level) + bandwidthR(level) / 2,
        deviceWidth
      );

      // One stroke per (record, attribute) cell: it runs the width of the
      // attribute band along A, and is as thick as one record along R.
      const aStart = Math.round(cellA(attribName, level)),
        aEnd = Math.round(cellA(attribName, level) + bandwidthA()),
        p0 = toXY(aStart, y),
        p1 = toXY(aEnd, y);
      context.beginPath();
      context.moveTo(p0.x, p0.y);
      context.lineTo(p1.x, p1.y);
      context.lineWidth = deviceWidth / ratio;

      context.strokeStyle = isMissing(val)
        ? nv.nullColor
        : colScales.get(attrib)(val);

      context.stroke();

      // TODO get this out
      //If the range bands are tick enough draw divisions
      if (bandwidthR(level) > nv.divisionsThreshold * 2) {
        let yLine = Math.round(cellR(idOf(rowIdx), level));
        const d0 = toXY(cellA(attribName, level), yLine),
          d1 = toXY(cellA(attribName, level) + bandwidthA(), yLine);
        context.beginPath();
        context.moveTo(d0.x, d0.y);
        context.lineTo(d1.x, d1.y);
        context.lineWidth = 1;
        context.strokeStyle = divisionsColour();
        context.stroke();
      }
    }
    context.restore();
  } // drawItem

  // Links between nodes
  function drawLink(geom, link) {
    const context = ctx.context,
      dataIs = ctx.dataIs,
      idOf = ctx.rows.idOf,
      indexOfRow = ctx.rows.indexOfRow;
    const lastLevel = dataIs.length - 1;
    const visible = ctx.visibleAttribs();
    // link.source/link.target are resolved through indexOfRow on EVERY call.
    // This looks wasteful and is not safe to cache: callers mutate the link
    // array in place - d3-force rewrites source/target from ids to node
    // objects after navio has already seen them. It was tried, it regressed,
    // it was reverted; test/e2e/61-link-endpoints.spec.js pins it.
    let lastAttrib = getAttribName(visible[visible.length - 1]),
      rightBorder = geom.cellA(lastAttrib, lastLevel) + geom.bandwidthA() + 2,
      ys =
        geom.cellR(idOf(indexOfRow(link.source)), lastLevel) +
        geom.bandwidthR(lastLevel) / 2,
      yt =
        geom.cellR(idOf(indexOfRow(link.target)), lastLevel) +
        geom.bandwidthR(lastLevel) / 2,
      miny = Math.min(ys, yt),
      maxy = Math.max(ys, yt),
      midy = maxy - miny;
    context.moveTo(rightBorder, miny); //starting point
    context.quadraticCurveTo(
      rightBorder + midy / 6,
      miny + midy / 2, // mid point
      rightBorder,
      maxy // end point
    );
  }

  function drawLevelConnections(geom, level) {
    if (level <= 0) {
      return;
    }
    const dataIs = ctx.dataIs,
      posAt = ctx.rows.posAt,
      idOf = ctx.rows.idOf,
      nv = ctx.nv;
    for (let item of dataIs[level].representatives) {
      // Compute the yPrev by calculating the index of the corresponding
      // representative
      let iOnPrev = posAt(item, level - 1);
      let iRep = Math.floor(
        iOnPrev - (iOnPrev % dataIs[level - 1].itemsPerpixel)
      );
      let locPrevLevel = {
        x: geom.levelStartA(level - 1) + geom.levelExtentA(),
        y: geom.cellR(idOf(dataIs[level - 1][iRep]), level - 1),
      };
      let locLevel = {
        x: geom.levelStartA(level),
        y: geom.cellR(idOf(item), level),
      };

      let points = [
        locPrevLevel,
        { x: locPrevLevel.x + nv.levelsSeparation * 0.3, y: locPrevLevel.y },
        { x: locLevel.x - nv.levelsSeparation * 0.3, y: locLevel.y },
        locLevel,
        { x: locLevel.x, y: locLevel.y + geom.bandwidthR(level) },
        {
          x: locLevel.x - nv.levelsSeparation * 0.3,
          y: locLevel.y + geom.bandwidthR(level),
        },
        {
          x: locPrevLevel.x + nv.levelsSeparation * 0.3,
          y: locPrevLevel.y + geom.bandwidthR(level - 1),
        },
        {
          x: locPrevLevel.x,
          y: locPrevLevel.y + geom.bandwidthR(level - 1),
        },
        locPrevLevel,
      ];
      // `points` is built in (attribute-axis, record-axis) space above - the
      // .x fields come from levelScale/xScale and the .y fields from yScales -
      // so mapping the whole path through toXY transposes it for free (#22).
      const path = points.map((pt) => geom.toXY(pt.x, pt.y));
      drawLine(path, 1, nv.levelConnectionsColor);
      drawLine(path, 1, nv.levelConnectionsColor, true);
    }
  }

  function updateLevel(geom, levelData, i) {
    drawLevelBorder(geom, i);
    for (let rep of levelData.representatives) {
      drawItem(geom, rep, i);
    }

    drawLevelConnections(geom, i);
  }

  function drawLinks(geom) {
    const context = ctx.context,
      links = ctx.links,
      nv = ctx.nv;
    if (!links.length) return;
    if (nv.DEBUG)
      console.log("Draw links ", links[links.length - 1].length, links);
    context.save();
    context.beginPath();
    context.strokeStyle = nv.linkColor;
    context.globalAlpha = Math.min(
      1,
      // links.length, not links[last].length - the latter is a link object, so
      // this evaluated to NaN and canvas silently ignored the assignment.
      Math.max(0.1, 1000 / links.length)
    ); // More links more transparency
    for (let link of ctx.visibleLinks) {
      drawLink(geom, link);
    }
    context.stroke();
    context.restore();
  }

  return { updateLevel, drawLinks };
}
