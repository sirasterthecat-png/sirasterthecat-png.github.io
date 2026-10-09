'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const js=fs.readFileSync(path.join(__dirname,'../adventure.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../styles.css'),'utf8');
const launch=js.slice(js.indexOf('function setupLink'),js.indexOf('function attachCartridges'));
const frames=css.slice(css.indexOf('@keyframes boot-seat'),css.indexOf('@media(max-width:1050px)'));

test('YouTube is not opened until the animation completes at 5040ms',()=>{
  assert.doesNotMatch(js,/about:blank/);
  assert.doesNotMatch(js,/window\.focus\(/);
  assert.match(js,/reset:\s*5040/);
  assert.ok(launch.indexOf('window.open(')>launch.indexOf('after(TIMING.reset'));
  assert.ok(launch.indexOf('window.open(')>launch.indexOf('after(TIMING.fade'));
});
test('popup-blocking fallback remains a normal YouTube link',()=>{
  assert.match(launch,/fallback\.target = '_blank'/);
  assert.match(launch,/fallback\.rel = 'noopener noreferrer'/);
  assert.match(launch,/host\.classList\.contains\('library-card'\)/);
});
test('cartridge has centered and strictly vertical travel',()=>{
  assert.match(js,/consoleElement\.append\(img, cartridge, switchEl, led\)/);
  assert.match(css,/\.boot-cartridge\s*\{[^}]*left:50%;top:-38%/s);
  assert.doesNotMatch(frames,/rotate\s*\(/);
  assert.match(frames,/top:5%;transform:translateX\(-50%\);clip-path:inset\(0 0 34% 0\)/);
});
test('real N64 hides inserted cartridge below slot lip',()=>{
  assert.match(css,/\.boot-console-image\s*\{[^}]*z-index:3/s);
  assert.match(css,/\.boot-cartridge\s*\{[^}]*z-index:2/s);
});
