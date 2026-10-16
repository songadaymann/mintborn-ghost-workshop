import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Ghost } from './ghost.js?v=classic-body-01';
import { HATS, GLASSES, MARKINGS, compatible, hatFraming } from './catalog.js?v=classic-body-01';
// Expanded cloth and expressions on the original body. ?ghost=N shows the shared draft.
import { PALETTES_V4 as PALETTES, COLOR_FAMILIES_V4 as COLOR_FAMILIES, recipeFromPaletteV4 as recipeFromPalette, generateCollectionV4 as generateCollection,
  EXPRESSIONS, framingV4 } from './catalog-v4.js?v=classic-body-01';

export const DEBUG_OPTIONS = { metrics: true, logFrames: false };
const params = new URLSearchParams(location.search);
const stage = document.querySelector('#stage'), status = document.querySelector('#status');
const field = id => document.getElementById(id);
let ghost;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e8e5de');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute('aria-label', 'Ghost preview. Drag or use arrow keys to move.');
stage.prepend(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
const environment = pmrem.fromScene(room, .035);
scene.environment = environment.texture; scene.environmentIntensity = .25;
room.dispose(); pmrem.dispose();
scene.add(new THREE.HemisphereLight('#fffaf0', '#b5b0a6', .75));
const key = new THREE.DirectionalLight('#fff6e4', 2.4);
key.position.set(-3.6, 6.5, 4.5); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = key.shadow.camera.bottom = -5;
key.shadow.camera.right = key.shadow.camera.top = 5; key.shadow.camera.near = .1; key.shadow.camera.far = 18;
key.shadow.normalBias = .018; key.shadow.bias = -.00015;
scene.add(key);
const fill = new THREE.DirectionalLight('#d6dfff', .65); fill.position.set(4, 3, -2); scene.add(fill);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshStandardMaterial({ color: '#d8d4c9', roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

const camera = new THREE.OrthographicCamera(-3, 3, 2, -2, .1, 100);
let zoom = ({ near: .75, design: 1, far: 1.4 })[params.get('view')] || 1;
function resize() {
  const { width, height: stageHeight } = stage.getBoundingClientRect();
  const height = stageHeight - (innerWidth <= 900 ? stage.querySelector('header').offsetHeight : 0);
  renderer.setSize(width, height);
  const aspect = width / height, extra = hatFraming(ghost?.traits.hat) + Math.max(0, framingV4(ghost?.traits ?? {}));
  const halfHeight = (2.05 + extra) * Math.max(1, .91 / aspect) * zoom;
  camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
  camera.top = halfHeight; camera.bottom = -halfHeight;
  camera.position.set(3.1, 3.8, 6.5);
  camera.lookAt(0, 1.24 + extra * .65, 0); camera.updateProjectionMatrix();
  ghost?.setViewport(width, height);
}
new ResizeObserver(resize).observe(stage); resize();

const quality = params.get('quality') === 'town' || innerWidth <= 900 ? 'town' : 'portrait';
ghost = new Ghost(quality); scene.add(ghost.root);
ghost.root.rotation.y = -.13; field('quality').value = quality;
const collection = generateCollection();
const requestedNumber = Number(params.get('ghost') || 1);
let currentIndex = Math.max(0, Math.min(9999, (Number.isInteger(requestedNumber) ? requestedNumber : 1) - 1));
function options(id, rows) {
  field(id).replaceChildren(...rows.map(row => { const o=document.createElement('option');o.value=row.id;o.textContent=row.label;return o; }));
}
options('expression',EXPRESSIONS);
options('hat',HATS);options('glasses',GLASSES);options('marking',MARKINGS);
options('palette',[{id:'custom',label:'Custom'},...PALETTES]);
for (const family of COLOR_FAMILIES) {
  const button=document.createElement('button');button.className='swatch';button.title=family.label;
  button.setAttribute('aria-label',family.label);button.style.background=family.id==='tie_dye'?'conic-gradient(#e8698f,#f2a553,#f1d665,#71c29d,#5c9fd8,#8e76c9,#e8698f)':family.id==='quilt'?'repeating-conic-gradient(#e8b865 0 25%,#7fb0cf 0 50%)':family.id==='rainbow'?'linear-gradient(135deg,#df5f73,#edcf65,#72bfa0,#62a8cf,#8173bd)':family.base;
  button.addEventListener('click',()=>edit(recipeFromPalette(family.id)));field('swatches').append(button);
}
function syncFields() {
  const {pattern,colors,hat,glasses,marking,markColor,markScale,accessoryColor}=ghost.traits;
  field('pattern').value=pattern;field('expression').value=ghost.traits.expression;field('hat').value=hat;field('glasses').value=glasses;field('marking').value=marking;
  ['color-a','color-b','color-c'].forEach((id,i)=>field(id).value=colors[i]);
  field('mark-color').value=markColor;field('mark-scale').value=markScale;field('accessory-color').value=accessoryColor;
  field('marked-controls').hidden=marking==='none';
  field('gradient-fields').hidden=['solid','rainbow'].includes(pattern);field('third-color').hidden=pattern!=='aurora';
  const palette=PALETTES.find(p=>p.pattern===pattern&&(p.finish??'cotton')===(ghost.traits.finish??'cotton')&&p.colors.every((c,i)=>c===colors[i]));
  field('palette').value=palette?.id??'custom';
  ghost.traits.palette=palette?.id??'custom';ghost.traits.paletteFamily=palette?.family??'custom';
  [...field('swatches').children].forEach((b,i)=>b.setAttribute('aria-pressed',String(palette?.family===COLOR_FAMILIES[i].id)));
  [...field('glasses').options].forEach(o=>o.disabled=!compatible(hat,o.value));
  status.textContent=ghost.traits.number?`Ghost ${String(ghost.traits.number).padStart(5,'0')}`:'';
  resize();
}
function edit(patch) {
  delete ghost.traits.number;
  if(!('finish' in patch)&&('colors' in patch||'pattern' in patch))patch.finish='cotton';
  if('colors' in patch&&!('pattern' in patch)&&ghost.traits.pattern==='rainbow')patch.pattern='solid';
  if(patch.hat&&!compatible(patch.hat,ghost.traits.glasses))patch.glasses='none';
  ghost.setTraits(patch);syncFields();
}
for(const id of ['pattern','hat','glasses','marking','expression'])field(id).addEventListener('change',()=>edit({[id]:field(id).value}));
field('palette').addEventListener('change',()=>{if(field('palette').value!=='custom')edit(recipeFromPalette(field('palette').value));});
for(const id of ['color-a','color-b','color-c'])field(id).addEventListener('input',()=>edit({colors:['color-a','color-b','color-c'].map(key=>field(key).value)}));
field('mark-color').addEventListener('input',()=>edit({markColor:field('mark-color').value}));
field('mark-scale').addEventListener('input',()=>edit({markScale:Number(field('mark-scale').value)}));
field('accessory-color').addEventListener('input',()=>edit({accessoryColor:field('accessory-color').value}));
field('style').addEventListener('change',()=>ghost.setStyle(field('style').value));
field('random').addEventListener('click',()=>{currentIndex=(currentIndex+7919)%collection.length;ghost.setTraits(collection[currentIndex]);syncFields();});
field('portrait').addEventListener('click',()=>{
  renderer.render(scene,camera);const a=document.createElement('a');a.href=renderer.domElement.toDataURL('image/png');
  a.download='mintborn-ghost-portrait.png';a.click();status.textContent='Portrait saved.';
});
field('quality').addEventListener('change', () => ghost.setQuality(field('quality').value));
field('debug').addEventListener('change', () => ghost.setDebug(field('debug').value));
field('save').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(ghost.traits, null, 2) + '\n'], { type: 'application/json' });
  const link = document.createElement('a'), url = URL.createObjectURL(blob);
  link.href = url; link.download = 'mintborn-ghost-traits.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status.textContent = 'Trait recipe saved.';
});

const target = new THREE.Vector3(), speed = new THREE.Vector3(), acceleration = new THREE.Vector3();
const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.3);
const hit = new THREE.Vector3(), dragOffset = new THREE.Vector3();
let dragging = false;
function pointOnPlane(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.ray.intersectPlane(dragPlane, hit);
}
renderer.domElement.addEventListener('pointerdown', event => {
  if (!pointOnPlane(event)) return;
  dragging = true;
  dragOffset.copy(target).sub(hit); dragOffset.y = 0;
  field('wander').checked = false;
  renderer.domElement.setPointerCapture(event.pointerId); renderer.domElement.focus({ preventScroll: true });
});
renderer.domElement.addEventListener('pointermove', event => {
  if (!dragging || !pointOnPlane(event)) return;
  target.copy(hit).add(dragOffset); target.y = 0;
  target.x = THREE.MathUtils.clamp(target.x, -1.25, 1.25);
  target.z = THREE.MathUtils.clamp(target.z, -.7, .7);
});
function endDrag() { dragging = false; }
renderer.domElement.addEventListener('pointerup', endDrag);
renderer.domElement.addEventListener('pointercancel', endDrag);
renderer.domElement.addEventListener('lostpointercapture', endDrag);
renderer.domElement.addEventListener('wheel', event => {
  event.preventDefault(); zoom = THREE.MathUtils.clamp(zoom + event.deltaY * .0007, .75, 1.4); resize();
}, { passive: false });
const keys = new Set(), acceptedKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
renderer.domElement.addEventListener('keydown', event => {
  if (!acceptedKeys.includes(event.key)) return;
  event.preventDefault(); keys.add(event.key); field('wander').checked = false;
});
window.addEventListener('keyup', event => keys.delete(event.key));
window.addEventListener('blur', () => { keys.clear(); endDrag(); });
// Compatible with the mann.cool virtual controller when the study is embedded.
window.addEventListener('message', event => {
  if (event.origin !== 'https://mann.cool' && event.origin !== location.origin) return;
  const data = event.data;
  if (data?.type !== 'keyEvent' || !acceptedKeys.includes(data.key)) return;
  if (data.eventType === 'keydown') keys.add(data.key);
  if (data.eventType === 'keyup') keys.delete(data.key);
});
function reset() {
  target.set(0, 0, 0); ghost.root.position.set(0, .055, 0); speed.set(0, 0, 0);
  ghost.root.rotation.y = -.13; ghost.resetMotion(); keys.clear();
  field('wander').checked = false; field('turn').checked = false;
  zoom = 1; resize();
}
field('reset').addEventListener('click', reset);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let last = performance.now(), elapsed = Number(params.get('time') || 0), frames = 0, frameMs = 0, cpuMs = 0, lastMetrics = last;
const fixedTime = params.has('time');
function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = (now - last) / 1000; last = now;
  if (document.hidden) return;
  const cpuStart=performance.now();
  const dt = Math.min(rawDt, 1 / 20);
  if (!fixedTime && !reducedMotion) elapsed += dt;
  if (field('wander').checked) target.set(Math.sin(elapsed * .72) * .95, 0, Math.sin(elapsed * 1.44) * .28);
  if (keys.size) {
    target.x = THREE.MathUtils.clamp(target.x + ((keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0)) * dt * 1.5, -1.25, 1.25);
    target.z = THREE.MathUtils.clamp(target.z + ((keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0)) * dt * 1.5, -.7, .7);
  }
  const steps = Math.max(1, Math.ceil(dt * 120)), h = dt / steps;
  for (let i = 0; i < steps; i++) {
    acceleration.set(target.x - ghost.root.position.x, 0, target.z - ghost.root.position.z).multiplyScalar(72).addScaledVector(speed, -14);
    speed.addScaledVector(acceleration, h);
    ghost.root.position.x += speed.x * h; ghost.root.position.z += speed.z * h;
  }
  if (field('turn').checked && !reducedMotion) ghost.root.rotation.y += dt * .4;
  ghost.update(elapsed, dt, speed, Number(field('softness').value));
  renderer.render(scene, camera);
  frames++; frameMs += rawDt * 1000; cpuMs += performance.now()-cpuStart;
  if (now - lastMetrics > 800 && DEBUG_OPTIONS.metrics) {
    field('metrics').textContent = `${ghost.cloth.geometry.index.count / 3} cloth / ${renderer.info.render.triangles.toLocaleString()} rendered triangles · ${renderer.info.render.calls} draw calls · ${(cpuMs / frames).toFixed(1)} ms CPU · ${(frameMs / frames).toFixed(1)} ms/frame`;
    frames = 0; frameMs = 0; cpuMs = 0; lastMetrics = now;
  }
}

// Reproducible named study views, also useful for comparing both geometry tiers.
ghost.setTraits(recipeFromPalette('linen'));
if (params.has('ghost')) ghost.setTraits(collection[currentIndex]);
if (params.get('look') === 'aurora') ghost.setTraits({ pattern: 'aurora', colors: ['#a8dbc0', '#a497da', '#eea5b0'], hat: 'beret', glasses: 'round' });
if (params.get('look') === 'sunrise') ghost.setTraits({ pattern: 'diagonal', colors: ['#f3d382', '#e16a82', '#efb58a'], hat: 'bucket', glasses: 'sun' });
const textileLooks = {
  celestial:{...recipeFromPalette('ink'),marking:'celestial',hat:'witch',glasses:'none',accessoryColor:'#354557'},
  botanical:{...recipeFromPalette('leaf'),marking:'fern',hat:'mushroom',glasses:'none',accessoryColor:'#b97256'},
  quilt:{...recipeFromPalette('rust'),marking:'patchwork',hat:'beret',glasses:'round',accessoryColor:'#634d44'},
  maritime:{...recipeFromPalette('teal-fade'),marking:'waves',hat:'boater',glasses:'sun',accessoryColor:'#344954'},
  daisy:{...recipeFromPalette('lilac-aurora'),marking:'daisies',markColor:'#f1dfb4',hat:'bow',glasses:'cat_eye',accessoryColor:'#a7768e'},
  gingham:{...recipeFromPalette('linen'),marking:'gingham',markColor:'#c57966',hat:'sailor',glasses:'oval',accessoryColor:'#3e536a'},
};
if (textileLooks[params.get('look')]) ghost.setTraits(textileLooks[params.get('look')]);
if (PALETTES.some(p => p.id === params.get('palette'))) ghost.setTraits(recipeFromPalette(params.get('palette')));
for (const [key, list] of [['hat', HATS], ['glasses', GLASSES], ['marking', MARKINGS], ['expression', EXPRESSIONS]]) {
  if (list.some(row => row.id === params.get(key))) ghost.setTraits({ [key]: params.get(key) });
}
if (!compatible(ghost.traits.hat, ghost.traits.glasses)) ghost.setTraits({ glasses: 'none' });
if (params.has('night')) ghost.setNight(Number(params.get('night')) || 1);
if (params.get('style') === 'soft') { ghost.setStyle('soft'); field('style').value='soft'; }
if (['normals', 'motion', 'wire'].includes(params.get('debug'))) {
  ghost.setDebug(params.get('debug')); field('debug').value = params.get('debug');
}
syncFields();
renderer.setAnimationLoop(null); requestAnimationFrame(frame);
window.addEventListener('error', event => { document.body.dataset.error = 'true'; status.textContent = event.message; });
window.addEventListener('unhandledrejection', event => { document.body.dataset.error = 'true'; status.textContent = String(event.reason); });

// No play telemetry for a local art study. Track only if explicitly hosted as a game.
if (location.hostname === 'mann.cool') fetch('https://mann.cool/api/plays', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: 'mintborn-ghost-study', source: 'direct' }) }).catch(() => {});
