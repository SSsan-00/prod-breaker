// Exercise the actual Canvas renderer against identical frozen worlds in Chromium.
// Usage: node scripts/render-performance.mjs --baseline d80f6ce
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { chromium } from '@playwright/test';
import { createWorld, stepWorld } from '../src/game/survivor.ts';

const ref = process.argv[process.argv.indexOf('--baseline') + 1];
if (!process.argv.includes('--baseline') || !ref) throw new Error('Provide --baseline <commit>');
function renderer(source) {
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText
    .replace(/^import .*;$/gm, '').replace('export default function Arena', 'function Arena');
  // The harness supplies just the hooks/JSX needed to run the production draw effect.
  return `(() => { const _jsx = () => null; const useRef = () => ({current:document.querySelector('canvas')}); const useEffect = fn => window.cleanup = fn(); ${js}; window.startArena = Arena; })();`;
}
const sources = [execFileSync('git', ['show', `${ref}:src/components/Arena.tsx`], { encoding: 'utf8' }), readFileSync('src/components/Arena.tsx', 'utf8')].map(renderer);
const opening = createWorld(13, 1800);
const burst = stepWorld(opening, { x: 0, y: 0, panic: true });
const damaged = structuredClone(opening);
damaged.aura = 10;
damaged.overdriveUntil = 10;
damaged.entities.forEach((entity, index) => { entity.hp *= index % 3 === 0 ? .2 : .5; });
damaged.entities.push({ id: 100, x: 1100, y: 980, hp: 200, maxHp: 580, kind: 'boss', label: 'SRE CORE', flash: .1 });
const changedNetwork = structuredClone(damaged);
changedNetwork.entities.splice(0, 4);
changedNetwork.entities[0].x += 100;
changedNetwork.player.x += 40;
const inactive = { active: false, origin: { x: 100, y: 200 }, current: { x: 100, y: 200 } };
const scenes = [
  { name: 'opening', world: 0, stick: inactive },
  { name: 'panic', world: 1, stick: inactive },
  { name: 'damaged', world: 2, stick: inactive },
  { name: 'changed network and camera', world: 3, stick: inactive },
  // Keep the identical World reference while the mutable joystick changes.
  { name: 'stick start', world: 3, stick: { ...inactive, active: true } },
  { name: 'stick move', world: 3, stick: { ...inactive, active: true, current: { x: 140, y: 230 } } },
  { name: 'stick release', world: 3, stick: inactive },
];
const browser = await chromium.launch({ headless: true });
try {
  let matched = 0;
  for (const [width, height] of [[320, 480], [393, 851], [851, 393], [1280, 720]]) {
    for (const reduced of [false, true]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
      await page.clock.install();
      const snapshots = [];
      for (const source of sources) {
        const images = [];
        await page.setContent('<style>body{margin:0}canvas{width:100vw;height:100vh;display:block}</style><canvas class="arena-canvas"></canvas>');
        await page.addScriptTag({ content: source });
        await page.evaluate(({ worlds, reduced, inactive }) => {
          window.worlds = worlds;
          window.worldRef = { current: worlds[0] };
          window.stickRef = { current: inactive };
          window.startArena({ world: window.worldRef, input: { current: { x: 0, y: 0 } }, reduced,
            stick: window.stickRef, onBlur() {} });
        }, { worlds: [opening, burst, damaged, changedNetwork], reduced, inactive });
        await page.evaluate(() => new Promise(resolve => {
          const observer = new ResizeObserver(() => { observer.disconnect(); resolve(); });
          observer.observe(document.querySelector('canvas'));
        }));
        for (const scene of scenes) {
          await page.evaluate(({ world, stick }) => {
            window.worldRef.current = window.worlds[world];
            Object.assign(window.stickRef.current, stick);
          }, scene);
          await page.clock.runFor(100);
          images.push(await page.locator('canvas').evaluate(el => {
            // The renderer scales from width; a rounded backing height can leave
            // a partially covered final device pixel. Compare fully covered pixels.
            const crop = document.createElement('canvas');
            crop.width = el.width;
            crop.height = Math.min(el.height, Math.floor(el.getBoundingClientRect().height * el.width / el.getBoundingClientRect().width));
            crop.getContext('2d').drawImage(el, 0, 0);
            return crop.toDataURL();
          }));
        }
        await page.evaluate(() => window.cleanup());
        snapshots.push(images);
      }
      for (const [index, scene] of scenes.entries()) {
        assert.ok(snapshots[0][index] === snapshots[1][index], `Canvas pixels differ: ${width}x${height}, reduced=${reduced}, scene=${scene.name}`);
        matched++;
      }
      await page.close();
    }
  }
  console.log(`${matched} Canvas snapshots match within their fully covered pixel area (4 sizes, 2 motion settings, ${scenes.length} consecutive scenes).`);
} finally { await browser.close(); }
