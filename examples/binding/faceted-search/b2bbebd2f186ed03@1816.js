import define1 from "./3d9d1394d858ca97@553.js";

function _1(md){return(
md`# Range Slider

**Jump to:
[Examples](#section_examples) | [Documentation](#section_docs) | [Themes](#section_themes) | [Changelog](#doc_changelog)**

This notebook implements a themable range input for lower and upper bounds.

<details>
<summary style="outline:none !important"><i>View a demonstration</i></summary>
<img src=https://i.imgur.com/KkHoemh.gif style="max-width:500px;border:1px solid #ddd">
</details>
`
)}

function _section_examples(md){return(
md`---
## Examples

*All* arguments and options are optional.`
)}

function _example_observable(SLUG,md){return(
md`### Style: Observable Inputs

Mimics the appearance and interface of \`Inputs.range()\` from Observable's [Inputs library](https://observablehq.com/@observablehq/inputs). See the [documentation](#doc_interval) for a list of all available options.

~~~js
import {interval} from '${SLUG}'
~~~
`
)}

function _4(interval){return(
interval([-10, 10], {
  step: .25,
  value: [0, 8],
  label: 'My slider',
})
)}

function _example_jashkenas(SLUG,md){return(
md`---
### Style: Jeremy Ashkenas' Inputs

***This widget has been [deprecated](https://en.wikipedia.org/wiki/Deprecation).*** *Please use [\`interval()\`](#example_observable) instead.*


Mimics the appearance and interface of \`slider()\` from Jeremy Ashkenas' [Inputs notebook](https://observablehq.com/@jashkenas/inputs). See the [documentation](#doc_rangeSlider) for a list of all available options.

~~~js
import {rangeSlider} from '${SLUG}'
~~~
`
)}

function _6(rangeSlider){return(
rangeSlider({
  min: -10,
  max: 10,
  step: .25,
  value: [0, 8],
  title: 'My slider',
  description: 'This is a slider.',
})
)}

function _example_basic(SLUG,md){return(
md`---
### Style: Basic

The basic building block for custom sliders. See the [documentation](#doc_rangeInput) for a list of all available options.

~~~js
import {rangeInput} from '${SLUG}'
~~~
`
)}

function _8(rangeInput){return(
rangeInput({
  min: -10,
  max: 10,
  step: .25,
  value: [0, 8],
})
)}

function _section_docs(md){return(
md`---
## Documentation`
)}

function _doc_interval(signature,interval,md){return(
signature(interval, {
  description: md`
Widget that imitates the appearance and API of [\`range()\`](https://observablehq.com/@observablehq/input-range).

Arguments:
- \`range\`: Array of \`[min, max]\`. Defaults to \`[0, 1]\`.
- \`options\`: Optional. Available options:
${Object.entries({
  min: 'Minimum value, number. Defaults to <code>0</code>.',
  max: 'Maximum value, number. Defaults to <code>100</code>.',
  step: 'Range step, number. Defaults to <code>any</code>.',
  label: 'Input label. Defaults to `null`.',
  format: 'Callback that receives the current value  and returns an output string. Defaults to ```([start, end]) => `${start} … ${end}` ```.',
  value: 'Lower and upper range bounds, array of number. Optional, defaults to <code>[min, max]</code>.',
  theme: 'Widget CSS, string. Defaults to [<code>theme_Flat</code>](#doc_theme_Flat).',
  color: 'Range color as CSS \`color\` value. Defaults to the theme.',
  width: 'Range width, either number of pixels or a CSS \`width\` string. Defaults to the theme.',
}).map(([k,v]) => `  - \`${k}:\` ${v}\n`)}

`
})
)}

function _doc_rangeInput(signature,rangeInput,md){return(
signature(rangeInput, {
  description: md`
Basic input implementation. Supports custom themes.

Arguments:
- \`options:\` Optional. Available options:
${Object.entries({
  min: 'Minimum value, number. Defaults to <code>0</code>.',
  max: 'Maximum value, number. Defaults to <code>100</code>.',
  step: 'Range step, number. Defaults to <code>any</code>.',
  value: 'Lower and upper range bounds, array of number. Defaults to <code>[min, max]</code>.',
  theme: 'Widget CSS, string. Defaults to [<code>theme_Flat</code>](#doc_theme_Flat).',
  color: 'Range color as CSS \`color\` value. Defaults to the theme.',
  width: 'Range width, either number of pixels or a CSS \`width\` string. Defaults to the theme.',
}).map(([k,v]) => `  - \`${k}:\` ${v}\n`)}

`
})
)}

function _doc_rangeSlider(signature,rangeSlider,md){return(
signature(rangeSlider, {
  description: md`

**Deprecated**. Use [\`interval()\`](#doc_interval) instead.

Widget that imitates the appearance and API of [\`slider()\`](https://observablehq.com/@jashkenas/inputs#slider).

Arguments:
- \`options:\` Optional. Available options:
${Object.entries({
      title: 'Title above widget, string. Defaults to `null`.',
      description: 'Description below widget, string. Defaults to `null`.',
      submit: 'Display a submit button to apply changes, boolean. Defaults to <code>false</code>.',
      getValue: 'Value callback, Function. Defaults to <code>n => n.value.map(roundToPrecision)</code>.',
      color: 'CSS color for range. Defaults to the theme.',
      separator: 'Value separator. Defaults to <code>" … "</code>.',
      precision: 'Number of decimals as Number. Defaults to <code>3</code>.',
      format: 'Display format as [d3-format](https://github.com/d3/d3-format) string or Function. Defaults to <code>v => v</code>.',
      display: 'Display formatter as Function. Defaults to <code>v => v.map(format).join(separator)</code>',
    }).map(([k,v]) => `  - \`${k}:\` ${v}\n`)}`

})
)}

function _section_themes(md){return(
md`---
## Themes
`
)}

function _example_theme_options(Inputs){return(
Inputs.form({
  color: Inputs.color({label: 'Range color', value: '#3b99fc'}),
})
)}

function _doc_theme_Flat(signature,md,SLUG,_themeDemoInput,theme_Flat,example_theme_options,invalidation){return(
signature('theme_Flat', {
  name: 'theme_Flat',
  description: md`
Default theme. An unshaded version of [\`theme_GoogleChrome_MacOS1013\`](#doc_theme_GoogleChrome_MacOS1013).

~~~js
import {theme_Flat} from '${SLUG}'
~~~

${_themeDemoInput(theme_Flat, example_theme_options, invalidation)}
  `
})
)}

function _doc_theme_GoogleChrome_MacOS1013(signature,md,SLUG,_themeDemoInput,theme_GoogleChrome_MacOS1013,example_theme_options,invalidation){return(
signature('theme_GoogleChrome_MacOS1013', {
  name: 'theme_GoogleChrome_MacOS1013',
  description: md`
Matches the style of range inputs in Google Chrome on macOS 10.13.

~~~js
import {theme_GoogleChrome_MacOS1013} from '${SLUG}'
~~~

${_themeDemoInput(theme_GoogleChrome_MacOS1013, example_theme_options, invalidation)}
`
})
)}

function _doc_theme_Retro1(signature,md,SLUG,_themeDemoInput,theme_Retro1,example_theme_options,invalidation){return(
signature('theme_Retro1', {
  name: 'theme_Retro1',
  description: md`
Minimal theme that showcases the bare requirements.

~~~js
import {theme_Retro1} from '${SLUG}'
~~~

${_themeDemoInput(theme_Retro1, example_theme_options, invalidation)}
`
})
)}

function _doc_theme_NoUiSlider(signature,md,SLUG,_themeDemoInput,theme_NoUiSlider,example_theme_options,invalidation){return(
signature('theme_NoUiSlider', {
  name: 'theme_NoUiSlider',
  description: md`
Replicates the style of the [noUiSlider library](https://refreshless.com/nouislider/examples/).

~~~js
import {theme_NoUiSlider} from '${SLUG}'
~~~

${_themeDemoInput(theme_NoUiSlider, example_theme_options, invalidation)}
`
})
)}

function __themeDemoInput(rangeInput,Inputs)
{
  const masterInput = rangeInput({value: [25, 75], theme: ''});
  return (theme, {widget, ...options}, invalidation) => Inputs.bind(
    rangeInput({theme, ...options}),
    masterInput,
    invalidation
  );
}


function _20(md){return(
md`---
## Implementation`
)}

function _interval(DOM,rangeInput,html){return(
function interval(range = [], options = {}) {
  const [min = 0, max = 1] = range;
  const {
    step = .001,
    label = null,
    value = [min, max],
    format = ([start, end]) => `${start} … ${end}`,
    color,
    width,
    theme,
  } = options;

  const __ns__ = DOM.uid('scope').id;
  const css = `
#${__ns__} {
  font: 13px/1.2 var(--sans-serif);
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  max-width: 100%;
  width: auto;
}
@media only screen and (min-width: 30em) {
  #${__ns__} {
    flex-wrap: nowrap;
    width: 360px;
  }
}
#${__ns__} .label {
  width: 120px;
  padding: 5px 0 4px 0;
  margin-right: 6.5px;
  flex-shrink: 0;
}
#${__ns__} .form {
  display: flex;
  width: 100%;
}
#${__ns__} .range {
  flex-shrink: 1;
  width: 100%;
}
#${__ns__} .range-slider {
  width: 100%;
}
  `;
  
  const $range = rangeInput({min, max, value: [value[0], value[1]], step, color, width, theme});
  const $output = html`<output>`;
  const $view = html`<div id=${__ns__}>
${label == null ? '' : html`<div class="label">${label}`}
<div class=form>
  <div class=range>
    ${$range}<div class=range-output>${$output}</div>
  </div>
</div>
${html`<style>${css}`}
  `;

  const update = () => {
    const content = format([$range.value[0], $range.value[1]]);
    if(typeof content === 'string') $output.value = content;
    else {
      while($output.lastChild) $output.lastChild.remove();
      $output.appendChild(content);
    }
  };
  $range.oninput = update;
  update();
  
  return Object.defineProperty($view, 'value', {
    get: () => $range.value,
    set: ([a, b]) => {
      $range.value = [a, b];
      update();
    },
  });
}
)}

function _rangeInput(theme_Flat,randomScope,htl,cssLength,Event,invalidation){return(
function rangeInput(options = {}) {
  const {
    min = 0,
    max = 100,
    step = 'any',
    value: defaultValue = [min, max],
    color,
    width,
    theme = theme_Flat,
  } = options;
  
  const controls = {};
  const scope = randomScope();
  const clamp = (a, b, v) => v < a ? a : v > b ? b : v;
  const html = htl.html;

  // Will be used to sanitize values while avoiding floating point issues.
  const input = html`<input type=range ${{min, max, step}}>`;
  
  const dom = html`<div class=${`${scope} range-slider`} style=${{
    color,
    width: cssLength(width),
  }}>
  ${controls.track = html`<div class="range-track">
    ${controls.zone = html`<div class="range-track-zone">
      ${controls.range = html`<div class="range-select" tabindex=0>
        ${controls.min = html`<div class="thumb thumb-min" tabindex=0>`}
        ${controls.max = html`<div class="thumb thumb-max" tabindex=0>`}
      `}
    `}
  `}
  ${html`<style>${theme.replace(/:scope\b/g, '.'+scope)}`}
</div>`;

  let value = [], changed = false;
  Object.defineProperty(dom, 'value', {
    get: () => [...value],
    set: ([a, b]) => {
      value = sanitize(a, b);
      updateRange();
    },
  });

  const sanitize = (a, b) => {
    a = isNaN(a) ? min : ((input.value = a), input.valueAsNumber);
    b = isNaN(b) ? max : ((input.value = b), input.valueAsNumber);
    return [Math.min(a, b), Math.max(a, b)];
  }
  
  const updateRange = () => {
    const ratio = v => (v - min) / (max - min);
    dom.style.setProperty('--range-min', `${ratio(value[0]) * 100}%`);
    dom.style.setProperty('--range-max', `${ratio(value[1]) * 100}%`);
  };

  const dispatch = name => {
    dom.dispatchEvent(new Event(name, {bubbles: true}));
  };
  const setValue = (vmin, vmax) => {
    const [pmin, pmax] = value;
    value = sanitize(vmin, vmax);
    updateRange();
    // Only dispatch if values have changed.
    if(pmin === value[0] && pmax === value[1]) return;
    dispatch('input');
    changed = true;
  };
  
  setValue(...defaultValue);
  
  // Mousemove handlers.
  const handlers = new Map([
    [controls.min, (dt, ov) => {
      const v = clamp(min, ov[1], ov[0] + dt * (max - min));
      setValue(v, ov[1]);
    }],
    [controls.max, (dt, ov) => {
      const v = clamp(ov[0], max, ov[1] + dt * (max - min));
      setValue(ov[0], v);
    }],
    [controls.range, (dt, ov) => {
      const d = ov[1] - ov[0];
      const v = clamp(min, max - d, ov[0] + dt * (max - min));
      setValue(v, v + d);
    }],
  ]);
  
  // Returns client offset object.
  const pointer = e => e.touches ? e.touches[0] : e;
  // Note: Chrome defaults "passive" for touch events to true.
  const on  = (e, fn) => e.split(' ').map(e => document.addEventListener(e, fn, {passive: false}));
  const off = (e, fn) => e.split(' ').map(e => document.removeEventListener(e, fn, {passive: false}));
  
  let initialX, initialV, target, dragging = false;
  function handleDrag(e) {
    // Gracefully handle exit and reentry of the viewport.
    if(!e.buttons && !e.touches) {
      handleDragStop();
      return;
    }
    dragging = true;
    const w = controls.zone.getBoundingClientRect().width;
    e.preventDefault();
    handlers.get(target)((pointer(e).clientX - initialX) / w, initialV);
  }
  
  
  function handleDragStop(e) {
    off('mousemove touchmove', handleDrag);
    off('mouseup touchend', handleDragStop);
    if(changed) dispatch('change');
  }
  
  invalidation.then(handleDragStop);
  
  dom.ontouchstart = dom.onmousedown = e => {
    dragging = false;
    changed = false;
    if(!handlers.has(e.target)) return;
    on('mousemove touchmove', handleDrag);
    on('mouseup touchend', handleDragStop);
    e.preventDefault();
    e.stopPropagation();
    
    target = e.target;
    initialX = pointer(e).clientX;
    initialV = value.slice();
  };
  
  controls.track.onclick = e => {
    if(dragging) return;
    changed = false;
    const r = controls.zone.getBoundingClientRect();
    const t = clamp(0, 1, (pointer(e).clientX - r.left) / r.width);
    const v = min + t * (max - min);
    const [vmin, vmax] = value, d = vmax - vmin;
    if(v < vmin) setValue(v, v + d);
    else if(v > vmax) setValue(v - d, v);
    if(changed) dispatch('change');
  };
  
  return dom;
}
)}

function _23(md){return(
md`### Themes`
)}

function _theme_Flat(){return(
`
/* Options */
:scope {
  color: #3b99fc;
  width: 240px;
}

:scope {
  position: relative;
  display: inline-block;
  --thumb-size: 15px;
  --thumb-radius: calc(var(--thumb-size) / 2);
  padding: var(--thumb-radius) 0;
  margin: 2px;
  vertical-align: middle;
}
:scope .range-track {
  box-sizing: border-box;
  position: relative;
  height: 7px;
  background-color: hsl(0, 0%, 80%);
  overflow: visible;
  border-radius: 4px;
  padding: 0 var(--thumb-radius);
}
:scope .range-track-zone {
  box-sizing: border-box;
  position: relative;
}
:scope .range-select {
  box-sizing: border-box;
  position: relative;
  left: var(--range-min);
  width: calc(var(--range-max) - var(--range-min));
  cursor: ew-resize;
  background: currentColor;
  height: 7px;
  border: inherit;
}
/* Expands the hotspot area. */
:scope .range-select:before {
  content: "";
  position: absolute;
  width: 100%;
  height: var(--thumb-size);
  left: 0;
  top: calc(2px - var(--thumb-radius));
}
:scope .range-select:focus,
:scope .thumb:focus {
  outline: none;
}
:scope .thumb {
  box-sizing: border-box;
  position: absolute;
  width: var(--thumb-size);
  height: var(--thumb-size);

  background: #fcfcfc;
  top: -4px;
  border-radius: 100%;
  border: 1px solid hsl(0,0%,55%);
  cursor: default;
  margin: 0;
}
:scope .thumb:active {
  box-shadow: inset 0 var(--thumb-size) #0002;
}
:scope .thumb-min {
  left: calc(-1px - var(--thumb-radius));
}
:scope .thumb-max {
  right: calc(-1px - var(--thumb-radius));
}
`
)}

function _theme_GoogleChrome_MacOS1013(){return(
`
/* Options */
:scope {
  color: #3b99fc;
  width: 240px;
}

:scope {
  position: relative;
  display: inline-block;
  --thumb-size: 15px;
  --thumb-radius: calc(var(--thumb-size) / 2);
  padding: var(--thumb-radius) 0;
  margin: 2px;
  vertical-align: middle;
}
:scope .range-track {
  box-sizing: border-box;
  position: relative;
  height: 5px;
  background-color: hsl(0, 0%, 80%);
  box-shadow: inset 0 1px 3px -1px rgba(0,0,0,0.33);
  overflow: visible;
  border-radius: 3px;
  border: 1px inset hsl(0, 0%, 70%);
  padding: 0 var(--thumb-radius);
}
:scope .range-track-zone {
  box-sizing: border-box;
  position: relative;
}
:scope .range-select {
  box-sizing: border-box;
  position: relative;
  left: var(--range-min);
  width: calc(var(--range-max) - var(--range-min));
  cursor: ew-resize;
  background: currentColor;
  height: 5px;
  top: -1px;
  border: inherit;
}
/* Expands the hotspot area. */
:scope .range-select:before {
  content: "";
  position: absolute;
  width: 100%;
  height: var(--thumb-size);
  left: 0;
  top: calc(2px - var(--thumb-radius));
}
:scope .range-select:focus,
:scope .thumb:focus {
  outline: none;
}
:scope .thumb {
  box-sizing: border-box;
  position: absolute;
  width: var(--thumb-size);
  height: var(--thumb-size);

  background: #eee linear-gradient(0deg, #fff0 50%, #fff9 50%, #fff5);
  top: -5px;
  border-radius: 100%;
  border: 1px solid hsl(0,0%,55%);
  cursor: default;
  margin: 0;
}
:scope .thumb:active {
  box-shadow: inset 0 var(--thumb-size) #0002;
}
:scope .thumb-min {
  left: calc(-1px - var(--thumb-radius));
}
:scope .thumb-max {
  right: calc(-1px - var(--thumb-radius));
}
`
)}

function _theme_Retro1(){return(
`
/* Options */
:scope {
  color: #3b99fc;  
  width: 240px;
}

:scope {
  position: relative;
  display: inline-block;
  vertical-align: -10px;
  margin: 2px;
}
:scope .range-track {
  height: 20px;
  border: 2px solid #000;
  padding: 0 18px;
  position: relative;
  background: #fff url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAPUlEQVQoU2NkYGD4z8DAwMiAH/wnpACunWyFIGeAAIYB6ALYFILFiLGaaIXY3YIrlLBZjdVDIIXoAY7VQwD4rQoH9uQ3nwAAAABJRU5ErkJggg==");
}
:scope .range-track-zone {
  position: relative;
  height: 100%;
}
:scope .range-select {
  box-sizing: border-box;
  position: relative;
  left: var(--range-min);
  width: calc(var(--range-max) - var(--range-min));
  height: 100%;
  cursor: ew-resize;
  background: currentColor url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJCAYAAADgkQYQAAAAK0lEQVQoU2NkwA/+g6QZqaEIbAY2k8BWIMuRrQjDmTCTMKxAVkmSIrwhAQBStQYIBYnwugAAAABJRU5ErkJggg==") fixed;
}
:scope .range-select:focus,
:scope .thumb:focus {
  outline: none;
}
:scope .thumb {
  box-sizing: border-box;
  position: absolute;
  height: 100%;
  top: 0;
  width: 20px;
  background: #fff;
  border: 2px solid #000;
  border-width: 0 2px;
  cursor: default;
}
:scope .thumb:active {
  background: #000;
}
:scope .thumb-min {
  left: -20px;
}
:scope .thumb-max {
  right: -20px;
}
`
)}

function _theme_NoUiSlider(){return(
`
/* Options */
:scope {
  color: #3b99fc;
  width: 240px;
}

:scope {
  box-sizing: border-box;
  display: inline-block;
  vertical-align: middle;
}
:scope .range-track {
  box-sizing: border-box;
  margin: 10px 17px;
  position: relative;
  background: #FAFAFA;
  border-radius: 4px;
  border: 1px solid #D3D3D3;
  box-shadow: inset 0 1px 1px #F0F0F0, 0 3px 6px -5px #BBB;
  height: 18px;
}
:scope .range-select {
  box-sizing: border-box;
  position: absolute;
  background: currentColor;
  left: var(--range-min);
  width: calc(var(--range-max) - var(--range-min));
  height: 100%;
  cursor: ew-resize;
}
:scope .thumb {
  box-sizing: border-box;
  position: absolute;
  width: 34px;
  height: 28px;
  top: -6px;
  border: 1px solid #D9D9D9;
  border-radius: 3px;
  background: #FFF;
  cursor: default;
  box-shadow: inset 0 0 1px #FFF, inset 0 1px 7px #EBEBEB, 0 3px 6px -3px #BBB;
}
:scope .thumb:before,
:scope .thumb:after {
  content: "";
  display: block;
  position: absolute;
  height: 14px;
  width: 1px;
  background: #E8E7E6;
  left: 14px;
  top: 6px;
}
:scope .thumb:after {
  left: 17px;
}
:scope .thumb-min {
  left: -17px;
}
:scope .thumb-max {
  right: -17px;
}
`
)}

function _28(md){return(
md`### Utilities`
)}

function _randomScope(){return(
function randomScope(prefix = 'scope-') {
  return prefix + (performance.now() + Math.random()).toString(32).replace('.', '-');
}
)}

function _html(htl){return(
htl.html
)}

function _cssLength(){return(
v => v == null ? null : typeof v === 'number' ? `${v}px` : `${v}`
)}

function _32(md){return(
md`### Documentation`
)}

function _requireCompat(invalidation){return(
function requireCompat({invalidation: invalidated = invalidation} = {}) {
  const DEFINE = 'define';
  const desc = Object.getOwnPropertyDescriptor(window, DEFINE);
  if(desc && (!('value' in desc) || !desc.configurable || !desc.writable || !desc.enumerable)) {
    throw Error('Cannot override non-default descriptor');
  }

  const defines = new Set(window.define ? [window.define] : []);
  
  const bridge = function define(...args) {
    for(const define of defines) {
      try { define.apply(window, args) } catch(e) {}
    }
  };
  bridge.amd = {};
  
  Object.defineProperty(window, DEFINE, {
    get: () => bridge,
    set: value => { defines.add(value) },
    enumerable: true,
    configurable: true,
  });

  const disable = () => {
    Object.defineProperty(window, DEFINE, desc || {
      value: desc?.value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  };
  invalidated.then(disable);
  return disable;
}
)}

function _disableCompat(requireCompat,invalidation){return(
requireCompat({invalidation})
)}

function _SLUG(){return(
'@mootari/range-slider'
)}

function _37(md){return(
md`### Deprecated`
)}

function _rangeSlider(rangeInput,d3format,jashkenasInput,html){return(
function rangeSlider(options = {}) {
  const {min = 0, max = 1, step = 'any', value, color, theme} = options;
  const input = rangeInput({min, max, step, value, theme});
  if(color) input.style.color = color;

  const {precision = 3, format = v => v, display: _display, separator = ' … '} = options;
  const round   = (p => (p = 10 ** p, v => Math.round(v * p) / p))(precision);
  const output  = typeof format === 'function' ? format : d3format.format(format);
  const display = _display || (v => v.map(output).join(separator));
  
  const {
    title, description, submit,
    getValue = n => n.value.map(round),
  } = options;
  
  const w = jashkenasInput({
    title, description, submit, display, getValue,
    form: Object.assign(html`<form>${input}`, {input}),
  });
  
  w.querySelector('output').style.display = 'inline-block';
  return w;
}
)}

function _themes(theme_Flat,theme_GoogleChrome_MacOS1013,theme_NoUiSlider,theme_Retro1){return(
{
  'Flat': theme_Flat,
  'Chrome macOS': theme_GoogleChrome_MacOS1013,
  'noUiSlider': theme_NoUiSlider,
  'Retro': theme_Retro1,
}
)}

function _jashkenasInput(html,d3format){return(
function input(config) {
  let {
    form,
    type = "text",
    attributes = {},
    action,
    getValue,
    title,
    description,
    format,
    display,
    submit,
    options
  } = config;
  const wrapper = html`<div></div>`;
  if (!form)
    form = html`<form>
	<input name=input type=${type} />
  </form>`;
  Object.keys(attributes).forEach(key => {
    const val = attributes[key];
    if (val != null) form.input.setAttribute(key, val);
  });
  if (submit)
    form.append(
      html`<input name=submit type=submit style="margin: 0 0.75em" value="${
        typeof submit == "string" ? submit : "Submit"
      }" />`
    );
  form.append(
    html`<output name=output style="font: 14px Menlo, Consolas, monospace; margin-left: 0.5em;"></output>`
  );
  if (title)
    form.prepend(
      html`<div style="font: 700 0.9rem sans-serif; margin-bottom: 3px;">${title}</div>`
    );
  if (description)
    form.append(
      html`<div style="font-size: 0.85rem; font-style: italic; margin-top: 3px;">${description}</div>`
    );
  if (format)
    format = typeof format === "function" ? format : d3format.format(format);
  if (action) {
    action(form);
  } else {
    const verb = submit
      ? "onsubmit"
      : type == "button"
      ? "onclick"
      : type == "checkbox" || type == "radio"
      ? "onchange"
      : "oninput";
    form[verb] = e => {
      e && e.preventDefault();
      const value = getValue ? getValue(form.input) : form.input.value;
      if (form.output) {
        const out = display ? display(value) : format ? format(value) : value;
        if (out instanceof window.Element) {
          while (form.output.hasChildNodes()) {
            form.output.removeChild(form.output.lastChild);
          }
          form.output.append(out);
        } else {
          form.output.value = out;
        }
      }
      form.value = value;
      if (verb !== "oninput")
        form.dispatchEvent(new CustomEvent("input", { bubbles: true }));
    };
    if (verb !== "oninput")
      wrapper.oninput = e => e && e.stopPropagation() && e.preventDefault();
    if (verb !== "onsubmit") form.onsubmit = e => e && e.preventDefault();
    form[verb]();
  }
  while (form.childNodes.length) {
    wrapper.appendChild(form.childNodes[0]);
  }
  form.append(wrapper);
  return form;
}
)}

function _d3format(require){return(
require("d3-format@1")
)}

function _doc_changelog(md)
{
  const rev = (d, n = '') => `${d} ([${n || 'latest'}](https://observablehq.com/@mootari/range-slider${n}))`;
  return md`
---
## Changelog
- ${rev('2023-05-03')}
  - Added ISC license
- ${rev('2023-04-30', '@1800')}
  - Removed \`lazyImport()\` in favor of the v4 module format.
- ${rev('2022-05-22', '@1786')}
  - Changed the \`step\` default value in \`rangeInput\` to \`"any"\`.
  - \`rangeInput\` accepts new options \`color\` and \`width\`.
  - \`interval\` accepts new options \`format\`, \`theme\`, \`color\` and \`width\`.
  - \`interval\` uses a single \`<output>\` element.
  - Removed \`clamp\` cell.
  - Inlined \`d3format\` and \`input\` from \`@jashkenas/inputs\`, removed lazy dependency.
  - Deprecated \`rangeSlider\` and \`themes\`.
  - Restructured documentation.
- ${rev('2022-05-18', '@1342')}
  - Fixed \`"Invalid module"\` errors on slow networks.
- ${rev('2022-04-03', '@1327')}
  - Dispatch \`Event\` instead of \`CustomEvent\`.
  - Dispatch \`change\` events.
- ${rev('2022-01-13', '@1312')}:
  - Added setter to \`rangeInput()\` and \`interval()\`.
  - Fixed \`interval()\` events not bubbling.
- ${rev('2021-12-31', '@1208')}:
  - Added provisional \`interval()\` widget to match the style of Observable's \`Inputs\` library. Thanks to [Sylvain Lesage](https://observablehq.com/@severo) for suggesting the name!
  - Removed a few static imports.
- ${rev('2020-03-27', '@1004')}: Added new default theme "Flat", a more neutral version of the macOS Chrome theme. (via [Jed Fox](https://observablehq.com/@j-f1))
- ${rev('2020-03-27', '@930')}: Changelog start.
`;
}


function _43(md){return(
md`---
## Remaining Tasks / Work in progress

*Code in this section is subject to change. Only import with a pinned version!*

- Delta constraints (min/max range)
- Keyboard controls
- Compare with control guidelines in https://material.io/components/sliders
`
)}

export default function define(runtime, observer) {
  const main = runtime.module();
  main.variable(observer()).define(["md"], _1);
  main.variable(observer("section_examples")).define("section_examples", ["md"], _section_examples);
  main.variable(observer("example_observable")).define("example_observable", ["SLUG","md"], _example_observable);
  main.variable(observer()).define(["interval"], _4);
  main.variable(observer("example_jashkenas")).define("example_jashkenas", ["SLUG","md"], _example_jashkenas);
  main.variable(observer()).define(["rangeSlider"], _6);
  main.variable(observer("example_basic")).define("example_basic", ["SLUG","md"], _example_basic);
  main.variable(observer()).define(["rangeInput"], _8);
  main.variable(observer("section_docs")).define("section_docs", ["md"], _section_docs);
  main.variable(observer("doc_interval")).define("doc_interval", ["signature","interval","md"], _doc_interval);
  main.variable(observer("doc_rangeInput")).define("doc_rangeInput", ["signature","rangeInput","md"], _doc_rangeInput);
  main.variable(observer("doc_rangeSlider")).define("doc_rangeSlider", ["signature","rangeSlider","md"], _doc_rangeSlider);
  main.variable(observer("section_themes")).define("section_themes", ["md"], _section_themes);
  main.variable(observer("viewof example_theme_options")).define("viewof example_theme_options", ["Inputs"], _example_theme_options);
  main.variable(observer("example_theme_options")).define("example_theme_options", ["Generators", "viewof example_theme_options"], (G, _) => G.input(_));
  main.variable(observer("doc_theme_Flat")).define("doc_theme_Flat", ["signature","md","SLUG","_themeDemoInput","theme_Flat","example_theme_options","invalidation"], _doc_theme_Flat);
  main.variable(observer("doc_theme_GoogleChrome_MacOS1013")).define("doc_theme_GoogleChrome_MacOS1013", ["signature","md","SLUG","_themeDemoInput","theme_GoogleChrome_MacOS1013","example_theme_options","invalidation"], _doc_theme_GoogleChrome_MacOS1013);
  main.variable(observer("doc_theme_Retro1")).define("doc_theme_Retro1", ["signature","md","SLUG","_themeDemoInput","theme_Retro1","example_theme_options","invalidation"], _doc_theme_Retro1);
  main.variable(observer("doc_theme_NoUiSlider")).define("doc_theme_NoUiSlider", ["signature","md","SLUG","_themeDemoInput","theme_NoUiSlider","example_theme_options","invalidation"], _doc_theme_NoUiSlider);
  main.variable(observer("_themeDemoInput")).define("_themeDemoInput", ["rangeInput","Inputs"], __themeDemoInput);
  main.variable(observer()).define(["md"], _20);
  main.variable(observer("interval")).define("interval", ["DOM","rangeInput","html"], _interval);
  main.variable(observer("rangeInput")).define("rangeInput", ["theme_Flat","randomScope","htl","cssLength","Event","invalidation"], _rangeInput);
  main.variable(observer()).define(["md"], _23);
  main.variable(observer("theme_Flat")).define("theme_Flat", _theme_Flat);
  main.variable(observer("theme_GoogleChrome_MacOS1013")).define("theme_GoogleChrome_MacOS1013", _theme_GoogleChrome_MacOS1013);
  main.variable(observer("theme_Retro1")).define("theme_Retro1", _theme_Retro1);
  main.variable(observer("theme_NoUiSlider")).define("theme_NoUiSlider", _theme_NoUiSlider);
  main.variable(observer()).define(["md"], _28);
  main.variable(observer("randomScope")).define("randomScope", _randomScope);
  main.variable(observer("html")).define("html", ["htl"], _html);
  main.variable(observer("cssLength")).define("cssLength", _cssLength);
  main.variable(observer()).define(["md"], _32);
  const child1 = runtime.module(define1);
  main.import("signature", child1);
  main.variable(observer("requireCompat")).define("requireCompat", ["invalidation"], _requireCompat);
  main.variable(observer("disableCompat")).define("disableCompat", ["requireCompat","invalidation"], _disableCompat);
  main.variable(observer("SLUG")).define("SLUG", _SLUG);
  main.variable(observer()).define(["md"], _37);
  main.variable(observer("rangeSlider")).define("rangeSlider", ["rangeInput","d3format","jashkenasInput","html"], _rangeSlider);
  main.variable(observer("themes")).define("themes", ["theme_Flat","theme_GoogleChrome_MacOS1013","theme_NoUiSlider","theme_Retro1"], _themes);
  main.variable(observer("jashkenasInput")).define("jashkenasInput", ["html","d3format"], _jashkenasInput);
  main.variable(observer("d3format")).define("d3format", ["require"], _d3format);
  main.variable(observer("doc_changelog")).define("doc_changelog", ["md"], _doc_changelog);
  main.variable(observer()).define(["md"], _43);
  return main;
}
