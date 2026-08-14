/**
 * Regenerate palettes.json.
 *
 *     node examples/palettes/build-palettes.mjs
 *
 * The palettes in this example are not magic constants: they are computed here,
 * and so are the numbers the page reports. Change a candidate, rerun, and the
 * page tells you whether it was an improvement.
 *
 * Two things are worth understanding before reading the numbers.
 *
 * WHICH METRIC. The page reports both CIEDE2000 and CIELAB dE*ab because they
 * disagree about which palette wins: dE00 down-weights differences between
 * saturated colours, so it scores a vivid palette far lower than dE*ab does.
 * The visualisation size literature (Stone et al. 2014; Szafir 2018) reports
 * dE*ab; the modern colour-difference standard is dE00. Reporting one would be
 * choosing the winner by choosing the scoreboard.
 *
 * WHAT THE MINIMUM MEANS. Every score is the MINIMUM pairwise distance - the
 * closest pair anywhere in the palette, which is the pair a reader confuses.
 * A palette's average distance can be excellent while two of its colours are
 * identical, and the average is no comfort to whoever needs those two.
 *
 * See docs/ai/COLOR-CATEGORICAL.md for the sourcing, and for why no palette
 * makes 25 categories legible in 1px rows however good these numbers get.
 */
import * as d3 from "d3";
import { writeFileSync } from "node:fs";
import { saliency, scorePalette } from "./name-metrics.mjs";

const hex = (c) => d3.rgb(c).formatHex();
const TYPES = ["normal", "protan", "deutan", "tritan"];

// ---------------------------------------------------------------- CIEDE2000
// Per Sharma, Wu & Dalal (2005). Validated against their published reference
// pairs below, before a single number is computed with it.
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

function ciede2000(L1, a1, b1, L2, a2, b2) {
  const C1 = Math.hypot(a1, b1),
    C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1,
    a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1),
    C2p = Math.hypot(a2p, b2);
  const h1p =
    Math.abs(a1p) + Math.abs(b1) === 0
      ? 0
      : (deg(Math.atan2(b1, a1p)) + 360) % 360;
  const h2p =
    Math.abs(a2p) + Math.abs(b2) === 0
      ? 0
      : (deg(Math.atan2(b2, a2p)) + 360) % 360;
  const dLp = L2 - L1,
    dCp = C2p - C1p;
  let dhp;
  if (C1p * C2p === 0) dhp = 0;
  else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
  else if (h2p - h1p > 180) dhp = h2p - h1p - 360;
  else dhp = h2p - h1p + 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp) / 2);
  const Lbp = (L1 + L2) / 2,
    Cbp = (C1p + C2p) / 2;
  let hbp;
  if (C1p * C2p === 0) hbp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hbp = (h1p + h2p + 360) / 2;
  else hbp = (h1p + h2p - 360) / 2;
  const T =
    1 -
    0.17 * Math.cos(rad(hbp - 30)) +
    0.24 * Math.cos(rad(2 * hbp)) +
    0.32 * Math.cos(rad(3 * hbp + 6)) -
    0.2 * Math.cos(rad(4 * hbp - 63));
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp,
    Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(rad(2 * dTheta)) * Rc;
  return Math.sqrt(
    (dLp / Sl) ** 2 +
      (dCp / Sc) ** 2 +
      (dHp / Sh) ** 2 +
      Rt * (dCp / Sc) * (dHp / Sh)
  );
}

const SHARMA = [
  [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
  [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
  [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0],
  [[50, 0, 0], [50, -1, 2], 2.3669],
  [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
  [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
];
for (const [p, q, want] of SHARMA) {
  const got = ciede2000(...p, ...q);
  if (Math.abs(got - want) > 0.0002) {
    console.error(`CIEDE2000 is wrong: ${got} should be ${want}`);
    process.exit(1);
  }
}

// ------------------------------------------------- colour-vision simulation
// Vienot, Brettel & Mollon (1999), applied to linear-light sRGB.
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
const clamp = (x) => Math.max(0, Math.min(1, x));

export function simulate(colour, type) {
  if (!type || type === "normal") return colour;
  const c = d3.rgb(colour);
  const R = toLin(c.r / 255),
    G = toLin(c.g / 255),
    B = toLin(c.b / 255);
  const L = 0.31399022 * R + 0.63951294 * G + 0.04649755 * B;
  const M = 0.15537241 * R + 0.75789446 * G + 0.08670142 * B;
  const S = 0.01775239 * R + 0.10944209 * G + 0.87256922 * B;
  let l = L,
    m = M,
    s = S;
  if (type === "protan") l = 1.05118294 * M - 0.05116099 * S;
  if (type === "deutan") m = 0.9513092 * L + 0.04866992 * S;
  if (type === "tritan") s = -0.86744736 * L + 1.86727089 * M;
  const R2 = 5.47221206 * l - 4.6419601 * m + 0.16963708 * s;
  const G2 = -1.1252419 * l + 2.29317094 * m - 0.1678952 * s;
  const B2 = 0.02980165 * l - 0.19318073 * m + 1.16364789 * s;
  return d3
    .rgb(
      255 * clamp(toSrgb(clamp(R2))),
      255 * clamp(toSrgb(clamp(G2))),
      255 * clamp(toSrgb(clamp(B2)))
    )
    .formatHex();
}

const de00 = (x, y) => {
  const A = d3.lab(x),
    B = d3.lab(y);
  return ciede2000(A.l, A.a, A.b, B.l, B.a, B.b);
};
const de76 = (x, y) => {
  const A = d3.lab(x),
    B = d3.lab(y);
  return Math.hypot(A.l - B.l, A.a - B.a, A.b - B.b);
};

const minPair = (cols, type, metric) => {
  const c = cols.map((x) => simulate(x, type));
  let m = Infinity;
  for (let i = 0; i < c.length; i++)
    for (let j = i + 1; j < c.length; j++) m = Math.min(m, metric(c[i], c[j]));
  return m;
};

// ------------------------------------------------------------- the palettes
/**
 * Greedy farthest-point over a sampled HCL gamut: at each step take the
 * candidate whose nearest already-chosen colour is furthest away. Same idea as
 * glasbey palettes. With `cvd`, a candidate is scored on the WORST of normal
 * and the three simulated deficiencies, so a pair that collapses under
 * deuteranopia is rejected however far apart it looks to normal vision.
 *
 * Optimising for normal vision alone is included in the output as a cautionary
 * row: it scores superbly on the metric it was optimised for and collapses
 * under simulation.
 */
function maxMin(n, { cvd = true, salFloor = 0 } = {}) {
  let cand = [];
  for (let L = 30; L <= 85; L += 5)
    for (let C = 15; C <= 110; C += 5)
      for (let H = 0; H < 360; H += 5) {
        const c = d3.hcl(H, C, L),
          r = d3.rgb(c);
        if (
          r.r < -0.5 ||
          r.r > 255.5 ||
          r.g < -0.5 ||
          r.g > 255.5 ||
          r.b < -0.5 ||
          r.b > 255.5
        )
          continue;
        cand.push(hex(c));
      }
  // Optionally drop colours nobody can name before searching at all.
  // Maximising distance alone walks into the GAPS of colour space, and the gaps
  // are where the unnameable colours live: without this, 4 of 25 land below the
  // 0.2 saliency the paper calls "naming confusion". Filtering first is free at
  // 0.2 - identical minimum distance - and at 0.4 buys nameability comparable
  // to a hand-designed scheme for about 1.4 of separation.
  if (salFloor > 0) cand = cand.filter((c) => saliency(c) >= salFloor);
  const types = cvd ? TYPES : ["normal"];
  const lab = types.map((t) =>
    cand.map((c) => {
      const L = d3.lab(simulate(c, t));
      return [L.l, L.a, L.b];
    })
  );
  const labOf = (c) =>
    types.map((t) => {
      const L = d3.lab(simulate(c, t));
      return [L.l, L.a, L.b];
    });
  const dist = (i, pt) =>
    Math.min(...types.map((_, k) => ciede2000(...lab[k][i], ...pt[k])));

  const out = [cand[0]];
  const best = new Float64Array(cand.length).fill(Infinity);
  const absorb = (colour) => {
    const pt = labOf(colour);
    for (let i = 0; i < cand.length; i++)
      best[i] = Math.min(best[i], dist(i, pt));
  };
  absorb(out[0]);
  while (out.length < n) {
    let bi = -1,
      bd = -1;
    for (let i = 0; i < cand.length; i++)
      if (best[i] > bd) {
        bd = best[i];
        bi = i;
      }
    if (bi < 0) break;
    out.push(cand[bi]);
    absorb(cand[bi]);
  }
  return out;
}

// d3.quantize samples i/(n-1) and so takes BOTH endpoints. On a cyclical ramp
// those are the same colour, which is an exact duplicate - the very bug this
// example is about. Sampling i/n never reaches the far end.
const cyclic = (f, n) => d3.range(n).map((i) => hex(f(i / n)));

const MOKOLE50 = "d3d3d3 2f4f4f 556b2f 6b8e23 a0522d a52a2a 2e8b57 228b22 708090 483d8b 008b8b 4682b4 000080 d2691e 9acd32 32cd32 daa520 8fbc8f 8b008b d2b48c 48d1cc 9932cc ff4500 ff8c00 ffd700 0000cd 00ff00 00fa9a dc143c 00bfff f4a460 0000ff a020f0 adff2f ff6347 ff00ff 1e90ff db7093 f0e68c fa8072 ffff54 dda0dd 90ee90 87ceeb ff1493 7b68ee ee82ee 7fffd4 ff69b4 ffc0cb"
  .split(" ")
  .map((h) => "#" + h);

const CANDIDATES = (n) => [
  {
    name: "max-min, CVD-aware + nameable",
    note: "as below, but searched only over colours people can name (saliency >= 0.4)",
    colours: maxMin(n, { salFloor: 0.4 }),
  },
  {
    name: "max-min, CVD-aware",
    note: "generated here: farthest-point, scored on the worst vision type",
    colours: maxMin(n),
  },
  {
    name: "Mokole 50",
    note: "mokole.com, and the best dE*ab here for normal vision",
    colours: MOKOLE50.slice(0, n),
  },
  {
    name: "max-min, normal vision only",
    note: "optimised for the wrong objective: superb, then collapses",
    colours: maxMin(n, { cvd: false }),
  },
  {
    name: "Rainbow at i/n",
    note: "cyclical, sampled so the wrap-around duplicate cannot happen",
    colours: cyclic(d3.interpolateRainbow, n),
  },
  {
    name: "Sinebow at i/n",
    note: "cyclical, sampled so the wrap-around duplicate cannot happen",
    colours: cyclic(d3.interpolateSinebow, n),
  },
  {
    name: "quantize(Rainbow)",
    note: "cyclical: t=0 and t=1 are the same colour",
    colours: d3.quantize(d3.interpolateRainbow, n).map(hex),
  },
  {
    name: "quantize(Turbo)",
    note: "built for sequential data, not for categories",
    colours: d3.quantize(d3.interpolateTurbo, n).map(hex),
  },
  {
    name: "Cat10+Obs10+Accent+Pastel1",
    note: "the d3 schemes concatenated: 37 colours, far fewer usable",
    colours: (() => {
      const pool = [
        ...d3.schemeCategory10,
        ...d3.schemeObservable10,
        ...d3.schemeAccent,
        ...d3.schemePastel1,
      ].map(hex);
      return d3.range(n).map((i) => pool[i % pool.length]);
    })(),
  },
  {
    name: "schemeCategory10 (Navio today)",
    note: "recycles after ten, and collides under simulation before that",
    colours: d3.range(n).map((i) => hex(d3.schemeCategory10[i % 10])),
  },
];

const out = { generatedBy: "examples/palettes/build-palettes.mjs", sets: {} };
for (const n of [10, 12, 25, 50]) {
  out.sets[n] = CANDIDATES(n)
    .filter((p) => p.colours.length === n)
    .map((p) => ({
      name: p.name,
      note: p.note,
      colours: p.colours,
      de00: Object.fromEntries(
        TYPES.map((t) => [t, +minPair(p.colours, t, de00).toFixed(1)])
      ),
      de76: Object.fromEntries(
        TYPES.map((t) => [t, +minPair(p.colours, t, de76).toFixed(1)])
      ),
      // Naming, from Heer & Stone's C3 model - see name-metrics.mjs. Distance
      // says whether two colours LOOK different; this says whether a reader can
      // say which one they mean.
      naming: scorePalette(p.colours),
    }))
    .map((p) => ({
      ...p,
      worst00: +Math.min(...TYPES.map((t) => p.de00[t])).toFixed(1),
      worst76: +Math.min(...TYPES.map((t) => p.de76[t])).toFixed(1),
    }))
    .sort((a, b) => b.worst00 - a.worst00);
}

writeFileSync(
  new URL("./palettes.json", import.meta.url),
  JSON.stringify(out, null, 1) + "\n"
);
console.log(
  "wrote palettes.json:",
  Object.keys(out.sets)
    .map((n) => `${n} categories x ${out.sets[n].length} palettes`)
    .join(", ")
);
