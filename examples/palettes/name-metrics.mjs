/**
 * Colour NAMING metrics, from Heer & Stone's C3 model.
 *
 * Perceptual distance says whether two colours look different. It says nothing
 * about whether a reader can NAME them, and naming is what people use to talk
 * about a chart: "the green one" fails when three of them are green. Heer &
 * Stone (CHI 2012) built a probabilistic naming model from ~3.4M responses to
 * Randall Munroe's XKCD colour survey and defined two measures on it:
 *
 *   SALIENCY      how reliably a colour is named at all, 0..1. Their own
 *                 analyser normalises the model's entropy against the XKCD
 *                 range [-4.5, 0]; the paper calls anything below 0.2 a colour
 *                 with "a high degree of naming confusion".
 *   NAME DISTANCE 1 - the cosine between two colours' name distributions. Near
 *                 zero means the two are called the same thing, however far
 *                 apart they look.
 *
 * Used at GENERATION time only - see build-palettes.mjs. The model is 1.6MB and
 * has no business in a widget bundle; what ships is the resulting hex codes.
 *
 * Carry this caveat: the XKCD respondents were 74.6% native English speakers
 * and about 68% male, so the model describes ENGLISH naming. For an
 * international audience these numbers are a tiebreaker, not an objective.
 *
 * C3 is vendored under vendor/c3 (BSD 3-clause, Copyright 2011 Stanford
 * University); see vendor/c3/LICENSE.
 */
import * as d3 from "d3";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const here = (rel) => new URL(rel, import.meta.url);

/**
 * c3.js is browser code: it fetches its data over XMLHttpRequest and expects a
 * global d3. Rather than fork it - which would mean maintaining a copy that
 * drifts - it runs unmodified in a VM context with those two things supplied.
 */
function loadC3() {
  const data = readFileSync(here("./vendor/c3/c3_data.json"), "utf8");
  const sandbox = {
    // c3.js predates d3 v4: it wants d3.keys, dropped in v5. Supplying the one
    // missing function is less brittle than vendoring an old d3 alongside it.
    d3: Object.assign(Object.create(d3), { keys: Object.keys }),
    XMLHttpRequest: class {
      open() {}
      send() {
        this.status = 200;
        this.readyState = 4;
        this.responseText = data;
      }
    },
  };
  runInNewContext(readFileSync(here("./vendor/c3/c3.js"), "utf8"), sandbox);
  sandbox.c3.load("ignored");
  return sandbox.c3;
}

const c3 = loadC3();

/**
 * Colours are binned at 5 units in CIE L*a*b*, so a colour is looked up by
 * rounding to its bin - the same index() their analyser uses. Anything that
 * misses (a colour no survey respondent was shown near) falls back to the
 * nearest bin by Lab distance rather than being dropped, so a palette is always
 * scored in full.
 */
const BINS = new Map();
c3.color.forEach((c, i) => {
  const key = [5 * Math.round(c.l / 5), 5 * Math.round(c.a / 5), 5 * Math.round(c.b / 5)].join();
  if (!BINS.has(key)) BINS.set(key, i);
});

export function binOf(colour) {
  const x = d3.lab(colour);
  const key = [5 * Math.round(x.l / 5), 5 * Math.round(x.a / 5), 5 * Math.round(x.b / 5)].join();
  if (BINS.has(key)) return BINS.get(key);
  let best = -1,
    bestD = Infinity;
  c3.color.forEach((c, i) => {
    const d = (c.l - x.l) ** 2 + (c.a - x.a) ** 2 + (c.b - x.b) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

// The range their analyser hard-wires for the XKCD model.
const MIN_ENTROPY = -4.5;

/** 0..1, higher is more reliably named. Below 0.2 is "naming confusion". */
export function saliency(colour) {
  const c = binOf(colour);
  return (c3.color.entropy(c) - MIN_ENTROPY) / (0 - MIN_ENTROPY);
}

/** 0..1, higher means the two colours are called different things. */
export function nameDistance(a, b) {
  return 1 - c3.color.cosine(binOf(a), binOf(b));
}

/** The most common name for a colour, which is what a reader would call it. */
export function nameOf(colour) {
  const terms = c3.color.relatedTerms(binOf(colour), 1);
  return terms && terms.length ? c3.terms[terms[0].index] : "?";
}

export function scorePalette(colours) {
  const sal = colours.map(saliency);
  let worstPair = { d: Infinity, a: null, b: null };
  for (let i = 0; i < colours.length; i++)
    for (let j = i + 1; j < colours.length; j++) {
      const d = nameDistance(colours[i], colours[j]);
      if (d < worstPair.d) worstPair = { d, a: colours[i], b: colours[j] };
    }
  return {
    minSaliency: +Math.min(...sal).toFixed(2),
    meanSaliency: +(sal.reduce((x, y) => x + y, 0) / sal.length).toFixed(2),
    confused: sal.filter((s) => s < 0.2).length,
    minNameDistance: +worstPair.d.toFixed(3),
    worstNamePair: worstPair.a
      ? `${nameOf(worstPair.a)} / ${nameOf(worstPair.b)}`
      : "",
    names: colours.map(nameOf),
  };
}
