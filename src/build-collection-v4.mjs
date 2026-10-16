// Ghost v4 draft collection: node rig/ghost-study/build-collection-v4.mjs
// Writes collection/v4/{recipes,audit,catalog}.json. Never touches collection/recipes.json (v3).
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { CATALOG_V4_VERSION, V4_SEED, generateCollectionV4, coarseKeyV4, v4Conflict, HEMS, STANCES, ARMS, EXPRESSIONS,
  COLOR_FAMILIES_V4, PALETTES_V4, RARE_FABRICS_V4, NEW_RARE_FABRICS, COVERED_EYES, FACE_SAFE, HATS, GLASSES, MARKINGS, compatible } from './catalog-v4.js';

const recipes = generateCollectionV4(V4_SEED);
const v3 = JSON.parse(await readFile(new URL('./collection/recipes.json', import.meta.url)));
const n = recipes.length;
const countBy = key => Object.fromEntries([...new Set(recipes.map(r => r[key]))].sort().map(v => [v, recipes.filter(r => r[key] === v).length]));
const table = (key, rows) => rows.map(row => { const count = recipes.filter(r => r[key] === row.id).length;
  return { id: row.id, label: row.label, weight: row.weight, count, percent: +(count / n * 100).toFixed(2) }; });
const exact = new Set(recipes.map(({ number, ...t }) => JSON.stringify(t)));
const coarse = new Set(recipes.map(coarseKeyV4));
const conflicts = recipes.filter(r => v4Conflict(r) || !compatible(r.hat, r.glasses)).length;
const kept = recipes.filter((r, i) => ['hat', 'glasses', 'accessoryColor'].every(k => r[k] === v3.recipes[i][k])).length;
const sameCloth = recipes.filter((r, i) => r.palette === v3.recipes[i].palette).length;
for (const f of RARE_FABRICS_V4) if (recipes.filter(r => r.palette === f.id).length !== f.edition) throw new Error('Rare quota failed: ' + f.id);
if (n !== 10000 || exact.size !== n || coarse.size !== n || conflicts) throw new Error('v4 audit failed');
if (JSON.stringify(recipes) !== JSON.stringify(generateCollectionV4(V4_SEED))) throw new Error('v4 generator is not deterministic');

const clothGroups = {};
for (const r of recipes) { const f = COLOR_FAMILIES_V4.find(x => x.id === r.paletteFamily); const g = f.rare ? (f.group ?? f.id) + ' (rare)' : 'everyday'; clothGroups[g] = (clothGroups[g] ?? 0) + 1; }
const report = {
  catalog: CATALOG_V4_VERSION, seed: V4_SEED, basedOn: { catalog: v3.catalog, seed: v3.seed, file: 'collection/recipes.json (unchanged)' }, total: n,
  exactUnique: exact.size, coarseUnique: coarse.size, excludedCombinationsPresent: conflicts,
  continuity: { sameHatEyewearHatColour: kept, sameClothAsV3: sameCloth },
  rules: {
    determinism: 'Each ghost N keeps its v3 hat, eyewear, marking and hat colour. Body, face and cloth come from a stream seeded by (seed, N). New rare cloth uses exact collection-wide quotas from a seeded shuffle. Rare cloth clears the marking.',
    exclusions: ['short-and-wide hem never on a short stance', 'lace never tattered', `eyewear that hides the eyes (${COVERED_EYES.join(', ')}) only with ${FACE_SAFE.join(', ')}`,
      'Groucho disguise never with a smile, tiny "o" or heart eyes', 'no blush on tie-dye or pink cloth (rose, bubblegum, coral, peach, cherry)', 'no raised "boo" arms under the tiny umbrella'],
    status: 'Draft art distribution; not committed mint metadata. The ghost-rarity-v1 percentile is separate and unchanged.' },
  rarity: { hem: table('hem', HEMS), stance: table('stance', STANCES), arms: table('arms', ARMS), expression: table('expression', EXPRESSIONS),
    rareCloth: RARE_FABRICS_V4.map(f => ({ id: f.id, label: f.label, edition: f.edition, percent: f.edition / 100, new: NEW_RARE_FABRICS.includes(f) })),
    clothGroups, paletteFamily: countBy('paletteFamily') },
};
const json = JSON.stringify({ catalog: CATALOG_V4_VERSION, seed: V4_SEED, recipes }) + '\n';
report.sha256 = createHash('sha256').update(json).digest('hex');
const dir = new URL('./collection/v4/', import.meta.url); await mkdir(dir, { recursive: true });
await writeFile(new URL('recipes.json', dir), json);
await writeFile(new URL('audit.json', dir), JSON.stringify(report, null, 2) + '\n');
await writeFile(new URL('catalog.json', dir), JSON.stringify({ version: CATALOG_V4_VERSION, hems: HEMS, stances: STANCES, arms: ARMS, expressions: EXPRESSIONS,
  hats: HATS, eyewear: GLASSES, markings: MARKINGS, colorFamilies: COLOR_FAMILIES_V4, palettes: PALETTES_V4 }, null, 2) + '\n');
console.log(JSON.stringify({ total: n, exactUnique: exact.size, coarseUnique: coarse.size, conflicts, continuity: report.continuity, clothGroups, sha256: report.sha256 }, null, 2));
