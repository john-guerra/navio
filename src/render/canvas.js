/**
 * navio's canvas painters: everything that draws to the 2D context.
 *
 * Built ONCE, in the closure, after the settings module is destructured
 * (src/navio.js:1258-1269) - `theme` and `divisionsColour` come from there.
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
 * `geom` is NOT a ctx entry - it is passed per call, because every one of
 * these functions already takes it.
 *
 * See docs/ai/2026-08-21-navio-canvas-renderer-design.md.
 *
 * @param {object} ctx - { nv, get context(), get data(), get dataIs(),
 *   get links(), get visibleLinks(), get selectedFlags(), get colScales(),
 *   idOf, getAttrib, getAttribName, visibleAttribs, indexOfRow, posAt,
 *   isMissing, theme, divisionsColour }
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
    // Read every rebound binding ONCE here, not per attribute: each is a
    // getter, and this loop is navio's hot path (see the design's section 4).
    const context = ctx.context,
      data = ctx.data,
      selectedFlags = ctx.selectedFlags,
      colScales = ctx.colScales,
      idOf = ctx.idOf,
      getAttrib = ctx.getAttrib,
      getAttribName = ctx.getAttribName,
      isMissing = ctx.isMissing,
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
      const val =
        attrib === "selected"
          ? !!selectedFlags[rowIdx]
          : attrib === "__seqId"
            ? rowIdx
            : getAttrib(item, attrib);
      const attribName = getAttribName(attrib);

      // A whole number of DEVICE pixels, so the stroke can sit exactly on the
      // grid. Round rather than ceil the device width: ceil in CSS units then
      // scaled would round twice and, at a fractional pixelRatio, still land
      // between pixels.
      const deviceWidth = Math.max(
        1,
        Math.round(Math.ceil(bandwidthR(level)) * pixelRatio())
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
      context.lineWidth = deviceWidth / pixelRatio();

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

  function drawLink(geom, link) {
    const context = ctx.context,
      dataIs = ctx.dataIs,
      idOf = ctx.idOf,
      indexOfRow = ctx.indexOfRow;
    const lastLevel = dataIs.length - 1;
    const visible = ctx.visibleAttribs();
    // link.source/link.target are resolved through indexOfRow on EVERY call.
    // This looks wasteful and is not safe to cache: callers mutate the link
    // array in place - d3-force rewrites source/target from ids to node
    // objects after navio has already seen them. It was tried, it regressed,
    // it was reverted; test/e2e/61-link-endpoints.spec.js pins it.
    let lastAttrib = ctx.getAttribName(visible[visible.length - 1]),
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
      posAt = ctx.posAt,
      idOf = ctx.idOf,
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

  return {
    drawItem,
    drawLevelBorder,
    drawLink,
    drawLevelConnections,
    drawLine,
  };
}
