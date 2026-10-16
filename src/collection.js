import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Ghost } from './ghost.js?v=classic-body-01';
import { ACCESSORY_ART_VERSION } from './accessories.js?v=classic-body-01';
import { HATS, GLASSES, MARKINGS, labelFor, compatible, hatFraming } from './catalog.js?v=classic-body-01';
// v4 by default (collection/v4/); ?v=3 browses the untouched v3 draft (collection/recipes.json).
import { PALETTES_V4 as PALETTES, COLOR_FAMILIES_V4 as COLOR_FAMILIES, recipeFromPaletteV4 as recipeFromPalette, RARE_FABRICS_V4 as RARE_FABRICS,
  CATALOG_V4_VERSION, EXPRESSIONS, framingV4 } from './catalog-v4.js?v=classic-body-01';
const V3 = new URLSearchParams(location.search).get('v') === '3';
const BODY_DEFAULTS = { hem: 'classic', stance: 'regular', arms: 'none', expression: 'dots' };
import { EXPANDED_HATS, EXPANDED_GLASSES } from './accessories-expanded.js?v=classic-body-01';
import { orderByVisualSimilarity } from './collection-order.js?v=classic-body-01';

export const DEBUG_OPTIONS = { catalogAudit: true };
const $ = id => document.getElementById(id), pageSize = 24, width = 320, height = 400;
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
const { recipes: loaded } = await fetch(V3 ? './collection/recipes.json?v=ghost-textiles-03' : `./collection/v4/recipes.json?v=${CATALOG_V4_VERSION}`).then(response => {
  if (!response.ok) throw new Error('Collection recipes could not be loaded.');
  return response.json();
});
const recipes = loaded.map(r => ({ ...BODY_DEFAULTS, ...r }));
const similarRecipes = orderByVisualSimilarity(recipes);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#f3efe5');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(width, height); renderer.setPixelRatio(1);
renderer.domElement.id = 'capture-canvas'; renderer.domElement.setAttribute('aria-hidden', 'true');
document.body.append(renderer.domElement);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
const environment = pmrem.fromScene(room, .035); scene.environment = environment.texture; scene.environmentIntensity = .25;
room.dispose(); pmrem.dispose();
scene.add(new THREE.HemisphereLight('#fffaf0', '#b5b0a6', .75));
const key = new THREE.DirectionalLight('#fff6e4', 2.4); key.position.set(-3.6, 6.5, 4.5); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = key.shadow.camera.bottom = -5;
key.shadow.camera.right = key.shadow.camera.top = 5; key.shadow.camera.near = .1; key.shadow.camera.far = 18;
key.shadow.normalBias = .018; key.shadow.bias = -.00015; scene.add(key);
const fill = new THREE.DirectionalLight('#d6dfff', .65); fill.position.set(4, 3, -2); scene.add(fill);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshStandardMaterial({ color: '#e7e3d7', roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, .1, 100);
const ghost = new Ghost('town'); ghost.root.rotation.y = -.13; ghost.setViewport(width, height); scene.add(ghost.root);
const zero = new THREE.Vector3(), cache = new Map();
const query=new URLSearchParams(location.search);
$('detail').checked=query.get('detail')==='1';
$('angle').value=['front','side','back'].includes(query.get('angle'))?query.get('angle'):'design';
let studyKind=query.get('study')||'collection';
let renderId = 0, page = 0, order = 'similar', mixOffset = 0, sheet = null, visible = [], auditBusy = false;
const base = { ...recipeFromPalette('linen'), ...BODY_DEFAULTS, hat: 'none', glasses: 'none', marking: 'none', markScale: 1, accessoryColor: '#41584f', trimColor: '#d9bc83' };

function additions(){return [
  ...HATS.filter(r=>EXPANDED_HATS.includes(r.id)).map(r=>({...base,hat:r.id,studyLabel:r.label})),
  ...GLASSES.filter(r=>EXPANDED_GLASSES.includes(r.id)||r.id==='groucho').map(r=>({...base,glasses:r.id,studyLabel:r.label})),
];}
function rareFabrics(){return RARE_FABRICS.map(r=>({...base,...recipeFromPalette(r.id),studyLabel:`${r.label} · ${r.edition} of 10,000`}));}
function showStudy(kind){studyKind=kind;sheet=kind==='rare'?rareFabrics():additions();page=0;paint();}
$('new-sheet').addEventListener('click',()=>showStudy('new'));
$('rare-sheet').addEventListener('click',()=>showStudy('rare'));
$('catalog-count').textContent=`${HATS.length-1} hats, ${GLASSES.length-1} eyewear designs, ${MARKINGS.length-1} markings, and ${PALETTES.length} color treatments.`;

function draw(recipe) {
  ghost.setTraits(recipe); ghost.resetMotion(); ghost.update(2, 0, zero, 1);
  const extra = hatFraming(recipe.hat) + Math.max(0, framingV4(recipe));
  const close=$('detail').checked;
  const half = close ? (recipe.hat==='deerstalker'?1.35:['witch','wizard','cowboy','tricorne','umbrella'].includes(recipe.hat)?1.13:recipe.glasses==='flip_up'?1.04:.92) : (2.05 + extra) * .91 / (width / height);
  camera.left = -half * width / height; camera.right = half * width / height;
  camera.top = half; camera.bottom = -half;
  const target=close?2.29+extra*.75:1.24+extra*.65;
  const angle=$('angle').value;
  ghost.root.rotation.y=angle==='design'?-.13:0;
  if(angle==='front')camera.position.set(0,target+.3,7);
  else if(angle==='side')camera.position.set(7,target+.45,0);
  else if(angle==='back')camera.position.set(0,target+.5,-7);
  else camera.position.set(3.1,close?4.15:3.8,6.5);
  camera.lookAt(0,target,0); camera.updateProjectionMatrix();
  renderer.render(scene, camera);
}
function portrait(recipe) {
  const key = JSON.stringify([recipe,$('detail').checked,$('angle').value]);
  if (cache.has(key)) return cache.get(key);
  draw(recipe);
  const url = renderer.domElement.toDataURL('image/png');
  if (cache.size >= 192) cache.delete(cache.keys().next().value);
  cache.set(key, url); return url;
}
function linkFor(recipe) {
  if (recipe.number) return `./?ghost=${recipe.number}`;
  return './?' + new URLSearchParams(Object.fromEntries(['palette', 'hat', 'glasses', 'marking'].map(key => [key, recipe[key]])));
}
function caption(recipe) {
  return recipe.studyLabel ?? `Ghost ${String(recipe.number).padStart(5, '0')}`;
}
function description(recipe) {
  return [labelFor(PALETTES, recipe.palette), recipe.hat === 'none' ? null : labelFor(HATS, recipe.hat),
    recipe.glasses === 'none' ? null : labelFor(GLASSES, recipe.glasses), labelFor(MARKINGS, recipe.marking),
    recipe.expression === 'dots' ? null : labelFor(EXPRESSIONS, recipe.expression)].filter(Boolean).join(' · ');
}
function filtered() {
  const source = order === 'similar' ? similarRecipes : recipes;
  let result = source.filter(r => ['hat', 'glasses', 'marking', 'palette', 'expression'].every(key => !$(key).value || r[key === 'palette' ? 'paletteFamily' : key] === $(key).value));
  if (order === 'mixed') result = result.map(r => ({ r, key: ((r.number + mixOffset) * 7919) % 10007 })).sort((a, b) => a.key - b.key).map(x => x.r);
  return result;
}
function setOrder(next) {
  order = next;
  for (const [id, value] of [['similar', 'similar'], ['sample', 'mixed']]) {
    const active = value === order;
    $(id).dataset.active = String(active); $(id).setAttribute('aria-pressed', String(active));
  }
}
async function paint() {
  const ticket = ++renderId, all = sheet ?? filtered();
  page = Math.min(page, Math.max(0, Math.ceil(all.length / pageSize) - 1));
  visible = all.slice(page * pageSize, (page + 1) * pageSize);
  $('grid').replaceChildren(); $('export-sheet').disabled = true;
  $('previous').disabled = page === 0; $('next').disabled = (page + 1) * pageSize >= all.length;
  $('status').textContent = `Rendering ${visible.length} portraits…`;
  for (const [i, recipe] of visible.entries()) {
    if (ticket !== renderId) return;
    const a = document.createElement('a'), img = document.createElement('img'), title = document.createElement('strong'), subtitle = document.createElement('small');
    a.className = 'ghost'; a.href = linkFor(recipe);
    img.width = width; img.height = height; img.src = portrait(recipe); img.alt = `${caption(recipe)}: ${description(recipe)}`;
    title.textContent = caption(recipe); subtitle.textContent = description(recipe);
    a.append(img, title, subtitle); $('grid').append(a);
    if (i % 3 === 2) await frame();
  }
  if (ticket !== renderId) return;
  $('status').textContent = all.length ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, all.length)} of ${all.length.toLocaleString()} ${sheet ? 'trait studies' : 'ghosts'}` : 'No ghosts match these filters.';
  $('export-sheet').disabled = !visible.length;
}
for (const [id, catalog] of [['hat', HATS], ['glasses', GLASSES], ['marking', MARKINGS], ['palette', COLOR_FAMILIES], ['expression', EXPRESSIONS]]) {
  for (const row of [{ id: '', label: 'All' }, ...catalog]) {
    const option = document.createElement('option'); option.value = row.id; option.textContent = row.label; $(id).append(option);
  }
  $(id).addEventListener('change', () => { sheet = null; page = 0; paint(); });
}
for(const id of ['detail','angle'])$(id).addEventListener('change',()=>paint());
$('previous').addEventListener('click', () => { page--; paint(); });
$('next').addEventListener('click', () => { page++; paint(); });
$('similar').addEventListener('click', () => { sheet = null; setOrder('similar'); page = 0; paint(); });
$('sample').addEventListener('click', () => { sheet = null; setOrder('mixed'); mixOffset += 193; page = 0; paint(); });
$('clear').addEventListener('click', () => {
  ['hat', 'glasses', 'marking', 'palette', 'expression'].forEach(key => $(key).value = ''); sheet = null; page = 0; paint();
});
$('open').addEventListener('click', () => {
  if ($('number').reportValidity()) location.href = (V3 ? './collection.html?v=3&ghost=' : './?ghost=') + Math.max(1, Math.min(10000, Math.floor(Number($('number').value) || 1)));
});
for (const [id, key, catalog] of [['hat-sheet', 'hat', HATS], ['glasses-sheet', 'glasses', GLASSES], ['marking-sheet', 'marking', MARKINGS]]) {
  $(id).addEventListener('click', () => {
    studyKind=key==='hat'?'hats':key==='glasses'?'glasses':'markings';
    sheet = catalog.map(row => ({ ...base, [key]: row.id, studyLabel: row.label })); page = 0; paint();
  });
}
$('export-sheet').addEventListener('click', async () => {
  const imgs = [...$('grid').querySelectorAll('img')], captured = [...visible];
  await Promise.all(imgs.map(img => img.decode()));
  const cols = Math.min(6, imgs.length), tileHeight = height + 66, canvas = document.createElement('canvas');
  canvas.width = cols * width; canvas.height = Math.ceil(imgs.length / cols) * tileHeight + 76;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#f3efe5'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#30433e'; ctx.font = '36px Georgia'; ctx.fillText('Mintborn / Ghost textiles', 26, 48);
  for (const [i, img] of imgs.entries()) {
    const x = i % cols * width, y = 76 + Math.floor(i / cols) * tileHeight;
    ctx.drawImage(img, x, y); ctx.fillStyle = '#30433e'; ctx.font = 'bold 14px Arial'; ctx.fillText(caption(captured[i]), x + 20, y + height + 15);
    ctx.font = '12px Arial';
    const words = description(captured[i]).split(' '); let line = '', row = 0;
    for (const word of words) {
      if (ctx.measureText(line + word).width > width - 40) { ctx.fillText(line.trim(), x + 20, y + height + 34 + row++ * 15); line = ''; }
      line += word + ' ';
    }
    ctx.fillText(line.trim(), x + 20, y + height + 34 + row * 15);
  }
  const a = document.createElement('a'); a.download = `mintborn-ghost-${ACCESSORY_ART_VERSION}-${sheet?studyKind:'collection'}-${$('detail').checked?'details':'portraits'}-${$('angle').value}.png`; a.href = canvas.toDataURL('image/png'); a.click();
});

// An explicit development action: exercise every geometry/material path in the renderer.
$('audit').addEventListener('click', async () => {
  if (auditBusy || !DEBUG_OPTIONS.catalogAudit) return;
  auditBusy = true; ++renderId;
  const controls = [...document.querySelectorAll('button,select,input')]; controls.forEach(el => el.disabled = true);
  const failures = [], markings = new Set(), tests = [];
  for (const hat of HATS) for (const glasses of GLASSES) if (compatible(hat.id, glasses.id)) tests.push({ ...base, hat: hat.id, glasses: glasses.id });
  const accessoryCases = tests.length;
  for (const marking of MARKINGS) tests.push({ ...base, marking: marking.id });
  for (const palette of PALETTES) tests.push({ ...base, ...recipeFromPalette(palette.id), marking: 'daisies' });
  let maxCalls = 0, maxTriangles = 0;
  try {
    for (const [i, recipe] of tests.entries()) {
      draw(recipe);
      ghost.root.traverse(object => {
        if (!object.geometry) return;
        const geometry = object.geometry, position = geometry.attributes.position;
        if ([...position.array].some(n => !Number.isFinite(n))) failures.push(`Non-finite geometry: ${recipe.hat}/${recipe.glasses}`);
        if (!geometry.attributes.normal || [...geometry.attributes.normal.array].some(n => !Number.isFinite(n))) failures.push(`Invalid normals: ${recipe.hat}/${recipe.glasses}`);
        if (geometry.index && [...geometry.index.array].some(index => index >= position.count)) failures.push(`Invalid indices: ${recipe.hat}/${recipe.glasses}`);
      });
      if (i >= accessoryCases && i < accessoryCases + MARKINGS.length) {
        const canvas = ghost.markingsTexture.image;
        markings.add(canvas.toDataURL());
      }
      maxCalls = Math.max(maxCalls, renderer.info.render.calls); maxTriangles = Math.max(maxTriangles, renderer.info.render.triangles);
      if (i % 4 === 0) { $('audit-result').textContent = `Rendered ${i + 1}/${tests.length} catalog checks…`; await frame(); }
    }
    if (markings.size !== MARKINGS.length) failures.push('Duplicate marking texture output.');
    $('audit-result').textContent = JSON.stringify({ artVersion: ACCESSORY_ART_VERSION, status: failures.length ? 'FAILED' : 'Passed', renderedCases: tests.length,
      compatibleAccessoryPairs: accessoryCases, distinctMarkingTextures: markings.size,
      paletteTreatments: PALETTES.length, invalidGeometry: failures.length, maxDrawCalls: maxCalls, maxTriangles,
      limitation: 'Geometry and shader exercise; does not replace visual review of fitting or all 10,000 portraits.', failures }, null, 2);
  } catch (error) { $('audit-result').textContent = 'FAILED: ' + error.message; }
  finally { auditBusy = false; controls.forEach(el => el.disabled = false); paint(); }
});
window.addEventListener('error', event => { $('status').textContent = event.message; document.body.dataset.error = 'true'; });
window.addEventListener('unhandledrejection', event => { $('status').textContent = String(event.reason); document.body.dataset.error = 'true'; });
const requestedStudy={hats:['hat',HATS],glasses:['glasses',GLASSES],markings:['marking',MARKINGS]}[query.get('study')];
if(['new','rare'].includes(query.get('study'))){sheet=query.get('study')==='rare'?rareFabrics():additions();document.querySelector('details').open=true;}
if(requestedStudy){const [key,catalog]=requestedStudy;sheet=catalog.map(row=>({...base,[key]:row.id,studyLabel:row.label}));document.querySelector('details').open=true;}
window.render_game_to_text=()=>JSON.stringify({mode:'ghost-collection',order,page:page+1,total:(sheet??filtered()).length,visible:visible.map(recipe=>recipe.number??recipe.studyLabel),filters:Object.fromEntries(['hat','glasses','marking','palette'].map(key=>[key,$(key).value||null]))});
paint();
