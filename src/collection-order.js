import { ACCESSORY_COLORS, GLASSES, HATS, MARKINGS } from './catalog.js?v=classic-body-01';
// v4 palette/family lists are a superset of v3, so one ordering serves both drafts.
import { COLOR_FAMILIES_V4 as COLOR_FAMILIES, PALETTES_V4 as PALETTES } from './catalog-v4.js?v=classic-body-01';

const byId = rows => new Map(rows.map((row, index) => [row.id, { ...row, index }]));
const palettes = byId(PALETTES), families = byId(COLOR_FAMILIES);
const patterns = new Map(['solid', 'vertical', 'diagonal', 'aurora', 'rainbow'].map((id, index) => [id, index]));

function groupedRanks(groups, catalog) {
  const ranks = new Map();
  groups.forEach((group, groupIndex) => group.forEach((id, itemIndex) => ranks.set(id, { group: groupIndex, item: itemIndex })));
  for (const [index, row] of catalog.entries()) if (!ranks.has(row.id)) ranks.set(row.id, { group: groups.length + index, item: 0 });
  return ranks;
}

const hatRanks = groupedRanks([
  ['none'],
  ['bow', 'flower_crown', 'antenna', 'headphones'],
  ['beret', 'beanie', 'newsboy', 'deerstalker', 'pilot'],
  ['cap', 'hardhat', 'propeller', 'sailor'],
  ['bucket', 'boater', 'bowler', 'paperboat', 'mushroom', 'rainhat', 'cowboy', 'tricorne', 'bonnet'],
  ['top_hat', 'chef', 'crown', 'fez', 'mortarboard', 'umbrella'],
  ['witch', 'wizard', 'nightcap', 'party'],
], HATS);

const glassesRanks = groupedRanks([
  ['none'],
  ['round', 'oval', 'hexagon', 'monocle', 'readers', 'pince_nez'],
  ['square', 'cat_eye', 'flip_up'],
  ['sun', 'aviator', 'visor', 'motoring', 'swim'],
  ['heart', 'star', '3d', 'hypnosis', 'shutter', 'eyepatch', 'groucho'],
], GLASSES);

const markingRanks = groupedRanks([
  ['none'],
  ['sailor', 'pinstripe', 'sash', 'hem_border'],
  ['gingham', 'checker', 'diamonds', 'polka'],
  ['stars', 'moons', 'celestial', 'sunburst', 'clouds', 'rain', 'lightning'],
  ['floral', 'daisies', 'fern', 'vines'],
  ['waves', 'scales'],
  ['patchwork', 'stitches'],
  ['hearts', 'terrazzo', 'tie_dye', 'spots'],
], MARKINGS);

const accessoryRanks = new Map(ACCESSORY_COLORS.map((color, index) => [color.toLowerCase(), index]));
const featureCache = new WeakMap();

function rgb(hex = '#000000') {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16 & 255) / 255, (value >> 8 & 255) / 255, (value & 255) / 255];
}

function rgbDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function features(recipe) {
  if (featureCache.has(recipe)) return featureCache.get(recipe);
  const palette = palettes.get(recipe.palette) ?? palettes.values().next().value;
  const family = families.get(recipe.paletteFamily) ?? families.get(palette.family);
  const value = {
    palette: palette.id,
    family: family.id,
    familyColor: rgb(family.base),
    pattern: patterns.get(recipe.pattern) ?? 0,
    hat: recipe.hat,
    hatRank: hatRanks.get(recipe.hat),
    glasses: recipe.glasses,
    glassesRank: glassesRanks.get(recipe.glasses),
    marking: recipe.marking,
    markingRank: markingRanks.get(recipe.marking),
    accessory: accessoryRanks.get(String(recipe.accessoryColor).toLowerCase()) ?? 0,
  };
  featureCache.set(recipe, value);
  return value;
}

function groupedDistance(aId, aRank, bId, bRank, near, far) {
  if (aId === bId) return 0;
  if (aRank.group === bRank.group) return near + Math.abs(aRank.item - bRank.item) * .08;
  return far + Math.abs(aRank.group - bRank.group) * .04;
}

export function visualDistance(a, b) {
  const x = features(a), y = features(b);
  const palette = x.palette === y.palette ? 0
    : x.family === y.family ? 2.5 + Math.abs(x.pattern - y.pattern) * .35
      : 7 + rgbDistance(x.familyColor, y.familyColor) * 5 + (x.pattern === y.pattern ? 0 : .4);
  const marking = groupedDistance(x.marking, x.markingRank, y.marking, y.markingRank, 1.1, 3.8);
  const hat = groupedDistance(x.hat, x.hatRank, y.hat, y.hatRank, .8, 3.1);
  const glasses = groupedDistance(x.glasses, x.glassesRank, y.glasses, y.glassesRank, .45, 1.8);
  const accessory = x.hat === 'none' && y.hat === 'none' ? 0 : Math.abs(x.accessory - y.accessory) * .09;
  return palette + marking + hat + glasses + accessory;
}

function paletteDistance(aId, bId) {
  const a = palettes.get(aId), b = palettes.get(bId);
  const af = families.get(a.family), bf = families.get(b.family);
  const family = a.family === b.family ? 0 : 3 + rgbDistance(rgb(af.base), rgb(bf.base)) * 8;
  const pattern = Math.abs((patterns.get(a.pattern) ?? 0) - (patterns.get(b.pattern) ?? 0));
  return family + pattern * .7;
}

function nearestPalettePath(ids) {
  const remaining = new Set(ids);
  const result = [];
  let current = remaining.has('linen') ? 'linen' : [...remaining][0];
  while (current) {
    result.push(current); remaining.delete(current);
    let next = null, best = Infinity;
    for (const candidate of remaining) {
      const distance = paletteDistance(current, candidate);
      if (distance < best || (distance === best && palettes.get(candidate).index < palettes.get(next)?.index)) {
        next = candidate; best = distance;
      }
    }
    current = next;
  }
  return result;
}

function nearestRecipePath(rows, previous) {
  const remaining = new Set(rows), result = [];
  let current = null, best = Infinity;
  for (const candidate of remaining) {
    const distance = previous ? visualDistance(previous, candidate) : candidate.number;
    if (distance < best || (distance === best && candidate.number < current.number)) {
      current = candidate; best = distance;
    }
  }
  while (current) {
    result.push(current); remaining.delete(current);
    let next = null; best = Infinity;
    for (const candidate of remaining) {
      const distance = visualDistance(current, candidate);
      if (distance < best || (distance === best && candidate.number < next.number)) {
        next = candidate; best = distance;
      }
    }
    current = next;
  }
  return result;
}

// Keep exact body treatments together, then walk each group by the nearest
// visible marking, hat silhouette, eyewear family and accessory color. This is
// presentation order only: recipes and token numbers are never changed.
export function orderByVisualSimilarity(recipes) {
  const groups = new Map();
  for (const recipe of recipes) {
    const rows = groups.get(recipe.palette) ?? [];
    rows.push(recipe); groups.set(recipe.palette, rows);
  }
  const ordered = [];
  for (const palette of nearestPalettePath(groups.keys())) {
    ordered.push(...nearestRecipePath(groups.get(palette), ordered.at(-1)));
  }
  return ordered;
}
