import { mkdir,writeFile } from 'node:fs/promises';
import {createHash} from 'node:crypto';
import { generateCollection,coarseKey,HATS,GLASSES,MARKINGS,PALETTES,COLOR_FAMILIES,compatible,CATALOG_VERSION,RARE_FABRICS } from './catalog.js';
const seed=9082026,recipes=generateCollection(seed);
const countBy=key=>Object.fromEntries([...new Set(recipes.map(r=>r[key]))].sort().map(value=>[value,recipes.filter(r=>r[key]===value).length]));
const exact=new Set(recipes.map(r=>{const {number,...traits}=r;return JSON.stringify(traits);}));
const coarse=new Set(recipes.map(coarseKey));
const report={catalog:CATALOG_VERSION,seed,total:recipes.length,exactUnique:exact.size,coarseUnique:coarse.size,
  rules:{body:'One shared sheet-01 shape.',coarseKey:'Hat silhouette + eyewear family + fabric marking + palette family. Ignores fine shade, gradient treatment, accessory tint and density; groups round/oval/hexagonal glasses, sun/aviator glasses, cap/hardhat.',status:'Draft art distribution; not committed mint metadata. Human perceptual uniqueness requires final collection art review.'},
  available:{hats:HATS.length-1,eyewear:GLASSES.length-1,markings:MARKINGS.length-1,palettes:PALETTES.length,paletteFamilies:COLOR_FAMILIES.length},
  rareFabricQuotas:Object.fromEntries(RARE_FABRICS.map(f=>[f.id,f.edition])),
  emptySlots:'Each hat, eyewear and marking catalog also includes none.',
  unsupportedPairs:recipes.filter(r=>!compatible(r.hat,r.glasses)).length,
  counts:{hats:countBy('hat'),eyewear:countBy('glasses'),markings:countBy('marking'),palette:countBy('palette'),paletteFamilies:countBy('paletteFamily')}};
for(const [key,list]of [['hat',HATS],['glasses',GLASSES],['marking',MARKINGS],['palette',PALETTES]]){
  const valid=new Set(list.map(x=>x.id));if(recipes.some(r=>!valid.has(r[key])))throw new Error('Unrenderable trait: '+key);
  if(list.some(t=>!recipes.some(r=>r[key]===t.id)))throw new Error('Catalog item missing from distribution: '+key);
}
for(const f of RARE_FABRICS)if(recipes.filter(r=>r.palette===f.id).length!==f.edition)throw new Error('Rare fabric quota failed: '+f.id);
if(report.total!==10000||report.exactUnique!==10000||report.coarseUnique!==10000||report.unsupportedPairs)throw new Error('Collection uniqueness audit failed.');
if(JSON.stringify(recipes)!==JSON.stringify(generateCollection(seed)))throw new Error('Generator is not deterministic.');
const json=JSON.stringify({catalog:CATALOG_VERSION,seed,recipes})+'\n';report.sha256=createHash('sha256').update(json).digest('hex');
const destination=new URL('./collection/',import.meta.url);await mkdir(destination,{recursive:true});
await writeFile(new URL('recipes.json',destination),json);await writeFile(new URL('audit.json',destination),JSON.stringify(report,null,2)+'\n');
await writeFile(new URL('catalog.json',destination),JSON.stringify({version:CATALOG_VERSION,hats:HATS,eyewear:GLASSES,markings:MARKINGS,palettes:PALETTES},null,2)+'\n');
console.log(JSON.stringify({total:report.total,exactUnique:report.exactUnique,coarseUnique:report.coarseUnique,available:report.available,unsupportedPairs:report.unsupportedPairs,sha256:report.sha256},null,2));
