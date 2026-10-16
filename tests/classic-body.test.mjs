import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { makeClothGeometry } from '../src/ghost.js';
import { BODY_DEFAULTS, bodyParams, headTransform } from '../src/body.js';
import { generateCollectionV4, RARE_FABRICS_V4 } from '../src/catalog-v4.js';
const hash = value => createHash('sha256').update(value).digest('hex');

test('both mesh tiers match the approved pre-v4 geometry, including when given old body traits', () => {
  const original = { portrait: '3f919f841b4760651ee4a7ff1de665ad9a27abde06911f4859c0d02503723dfb', town: '78b5c83c8d8276c2a9ad849c1833ac34b5126331a6bbb279e9c358f3e09737c3' };
  for (const quality of Object.keys(original)) for (const traits of [{}, {hem:'long_drape',stance:'tall',arms:'boo'}, {hem:'short_wide',stance:'short',arms:'wave'}]) {
    const mesh = makeClothGeometry(quality, traits);
    assert.equal(hash(Buffer.from(mesh.attributes.position.array.buffer)), original[quality]);
    assert.deepEqual(headTransform(bodyParams(traits)), { x: 0, y: 0, rotZ: 0 });
    mesh.dispose();
  }
});

test('all 10000 ghosts use the original body and preserve every non-body trait from the previous shared draft', () => {
  const recipes = generateCollectionV4();
  assert.equal(recipes.length, 10000);
  for (const recipe of recipes) {
    assert.equal(recipe.body, 'sheet-01');
    for (const [key, value] of Object.entries(BODY_DEFAULTS)) assert.equal(recipe[key], value);
  }
  const retained = recipes.map(({body, hem, stance, arms, catalog, ...traits}) => traits);
  assert.equal(hash(JSON.stringify(retained)), '95062c453ad5f60210e68b2c428d67a2764f09e65bedf5d8dd19ed0fc761fdf0');
  for (const fabric of RARE_FABRICS_V4) assert.equal(recipes.filter(r => r.palette === fabric.id).length, fabric.edition);
});
