import * as THREE from 'three';
import { addIllustratedCloth, makeContour } from './illustrated-material.js?v=classic-body-01';
import { makeMarkings } from './markings.js';
import { buildHat, buildGlasses } from './accessories.js?v=classic-body-01';
import { BODY_DEFAULTS, classicBody, bodyParams, bodySurface, headTransform } from './body.js?v=classic-body-01';
import { buildFace, dotEyes } from './faces.js?v=classic-body-01';
import { makeFabricPrint, PRINT_FINISHES } from './fabrics.js?v=classic-body-01';

// One approved sheet-01 topology and fold layout for every look.
export const SHAPE = Object.freeze({ crownY: 1.9, headRadius: .49, hemY: .24, capFraction: .26 });
export const QUALITY = Object.freeze({ portrait: [96, 58], town: [40, 28] });
export const DEFAULT_TRAITS = Object.freeze({ version: 3, body: 'sheet-01', finish: 'cotton', pattern: 'solid', colors: ['#f7f3e9', '#9272de', '#efb58a'], hat: 'none', glasses: 'none', marking: 'none', ...BODY_DEFAULTS, expression: 'dots', markColor: '#657773', markScale: 1, accessoryColor: '#35433b', trimColor: '#d9c593' });
const smooth = THREE.MathUtils.smoothstep;
const tau = Math.PI * 2;

// Y up, front +Z. The crown is a hemisphere; the skirt opens into authored,
// unequal folds. These continuous functions are shared by both mesh tiers.
function surface(v, angle, out, P = bodyParams()) { return bodySurface(v, angle, out, P); }

export function makeClothGeometry(quality = 'portrait', traits = {}) {
  const [radial, rows] = QUALITY[quality], P = bodyParams(traits);
  const vertices = 1 + rows * (radial + 1);
  const position = new Float32Array(vertices * 3);
  const uv = new Float32Array(vertices * 2);
  const color = new Float32Array(vertices * 3);
  const weight = new Float32Array(vertices);
  const index = [], p = new THREE.Vector3();
  surface(0, 0, p, P); p.toArray(position, 0); uv[0] = .5; uv[1] = 1;
  for (let row = 1; row <= rows; row++) {
    const v = row / rows;
    for (let col = 0; col <= radial; col++) {
      const i = 1 + (row - 1) * (radial + 1) + col;
      surface(v, (col / radial - .5) * tau, p, P).toArray(position, i * 3);
      uv[i * 2] = col / radial;
      uv[i * 2 + 1] = 1 - v;
      weight[i] = Math.max(0, (v - SHAPE.capFraction) / (1 - SHAPE.capFraction)) ** 1.6;
      if (col < radial) {
        if (row === 1) index.push(0, i, i + 1);
        else {
          const above = i - radial - 1;
          index.push(above, i, above + 1, above + 1, i, i + 1);
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
  geometry.setIndex(index);
  geometry.userData = { rest: position.slice(), weight, radial, rows, body: P.key };
  updateNormals(geometry);
  geometry.computeBoundingSphere();
  // Includes the bounded secondary motion, keeping culling safe while dragged.
  geometry.boundingSphere.radius += 1;
  return geometry;
}

function updateNormals(geometry) {
  geometry.computeVertexNormals();
  const n = geometry.attributes.normal, { radial, rows } = geometry.userData;
  for (let row = 0; row < rows; row++) {
    const a = 1 + row * (radial + 1), b = a + radial;
    const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b);
    const l = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
  }
  n.setXYZ(0, 0, 1, 0); n.needsUpdate = true;
}

function weaveTexture() {
  const size = 256, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const threadX = Math.cos(x * tau / 8), threadY = Math.cos(y * tau / 8);
    const over = ((x >> 3) + (y >> 3)) % 2;
    const value = Math.round(128 + 32 * (over ? threadX : threadY) + 9 * (threadX + threadY));
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = value; data[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4); texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function mesh(geometry, material, parent, position = [0, 0, 0], scale = [1, 1, 1]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position); object.scale.set(...scale);
  object.castShadow = object.receiveShadow = true; parent.add(object);
  return object;
}

function curveTube(points, radius = .018) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 16, radius, 6, false);
}

export class Ghost {
  constructor(quality = 'portrait') {
    this.root = new THREE.Group();
    this.root.name = 'Mintborn sheet-01';
    this.traits = structuredClone(DEFAULT_TRAITS);
    this.material = new THREE.MeshPhysicalMaterial({ color: 'white', vertexColors: true, roughness: .93, metalness: 0, sheen: .55, sheenColor: '#fff8ef', sheenRoughness: .85, specularIntensity: .2, side: THREE.DoubleSide, bumpMap: weaveTexture(), bumpScale: .003 });
    this.illustrated = addIllustratedCloth(this.material);
    this.quality = quality;
    this.cloth = mesh(makeClothGeometry(quality), this.material, this.root);
    this.contour = makeContour(this.cloth.geometry); this.root.add(this.contour);
    this.style = 'illustrated';
    // Everything worn on the head rides in one group that follows the crown.
    this.head = new THREE.Group(); this.head.name = 'Ghost head'; this.root.add(this.head);
    this.face = new THREE.Group(); this.head.add(this.face);
    this.hat = new THREE.Group(); this.head.add(this.hat);
    this.glasses = new THREE.Group(); this.head.add(this.glasses);
    this.expressionGroup = new THREE.Group(); this.face.add(this.expressionGroup);
    this.normalMaterial = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
    this.weightMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.black = new THREE.MeshStandardMaterial({ color: '#171a20', roughness: .34 });
    this.eyeMaterial = this.black.clone();
    this.metal = new THREE.MeshStandardMaterial({ color: '#66532c', metalness: .8, roughness: .3 });
    this.accessoryWeave = weaveTexture(); this.accessoryWeave.repeat.set(1.5, 2);
    this.hatMaterial = new THREE.MeshPhysicalMaterial({ color: '#35433b', roughness: .94, sheen: .3, sheenRoughness: .9, bumpMap: this.accessoryWeave, bumpScale: .0018 });
    this.bandMaterial = new THREE.MeshStandardMaterial({ color: '#c3ad80', roughness: .8 });
    this.creamMaterial = new THREE.MeshStandardMaterial({ color: '#eee2c5', roughness: .9 });
    this.frameMaterial = new THREE.MeshPhysicalMaterial({ color: '#725b43', roughness: .4, clearcoat: .3, clearcoatRoughness: .35 });
    this.lensMaterial = new THREE.MeshPhysicalMaterial({ color: '#253d43', roughness: .23, metalness: .1, clearcoat: .4, clearcoatRoughness: .25 });
    this.redMaterial = new THREE.MeshStandardMaterial({ color: '#b54d48', roughness: .4 });
    this.blueMaterial = new THREE.MeshStandardMaterial({ color: '#3e8dba', roughness: .4 });
    const detail = (color, roughness=.8, metalness=0) => new THREE.MeshStandardMaterial({color, roughness, metalness});
    this.metal.color.set('#bc9b61'); this.metal.roughness=.44; this.metal.metalness=.55;
    this.accessoryMaterials = {
      main:this.hatMaterial, trim:this.bandMaterial, ink:this.black, cream:this.creamMaterial,
      frame:this.frameMaterial, lens:this.lensMaterial, red:this.redMaterial, blue:this.blueMaterial,
      metal:this.metal, seam:detail('#35433b'), stitch:detail('#8b9480'), leather:detail('#90694c',.78),
      straw:detail('#d4b47c',.95), strawSeam:detail('#b99762',.95), paper:detail('#e4dcc8'),
      paperInk:detail('#aaa18a'), mushroom:detail('#b56549',.88), gill:detail('#c2b599'),
      leaf:detail('#536d50'), gem:detail('#386768',.25,.25), lensGlint:detail('#739397',.35),
      disguiseNose:detail('#c9906b',.78), disguiseHair:detail('#292821',.96),
      oilskin:detail('#d7b139',.61), oilskinSeam:detail('#9b7928',.79),
      bonnetCotton:detail('#d5d8c5',.97), bonnetSeam:detail('#bbbca7',.97),
      huntingWool:detail('#bc3730',.96), huntingSeam:detail('#853a30',.98), huntingLining:detail('#b8b2a0',.98)
    };
    // Fine stitches and painted lens glints should not cast coarse shadow-map
    // speckles. Their parent silhouettes still cast and receive normal shadows.
    for (const key of ['seam','stitch','strawSeam','paperInk','gill','lensGlint'])
      this.accessoryMaterials[key].userData.noAccessoryShadow=true;
    for (const key of ['straw','mushroom','leather','bonnetCotton','huntingWool','huntingLining']) {
      this.accessoryMaterials[key].bumpMap=this.accessoryWeave;
      this.accessoryMaterials[key].bumpScale=.0012;
    }
    this.highlightMaterial = new THREE.MeshBasicMaterial({ color: '#fff7e4' });
    this.eyes = [];
    for (const x of [-.17, .17]) {
      const eye = mesh(new THREE.SphereGeometry(1, 20, 14), this.eyeMaterial, this.face, [x, 2.045, .449], [.068, .102, .025]);
      eye.rotation.y = x * 1.5;
      mesh(new THREE.SphereGeometry(.016, 10, 8), this.highlightMaterial, eye, [-.22, .34, .85], [1 / .068, 1 / .102, 1 / .025]);
      const sparkle = mesh(new THREE.SphereGeometry(.016, 8, 6), this.highlightMaterial, eye, [.24, -.34, .8], [1 / .068, 1 / .102, 1 / .025]);
      sparkle.visible = false; eye.userData.sparkle = sparkle;
      this.eyes.push(eye);
    }
    this.faceMaterials = { eye: this.eyeMaterial,
      star: new THREE.MeshStandardMaterial({ color: '#f2c24c', roughness: .45, emissive: '#6b4a08', emissiveIntensity: .35 }),
      heart: new THREE.MeshStandardMaterial({ color: '#e0506a', roughness: .45, emissive: '#5a1020', emissiveIntensity: .3 }),
      blush: new THREE.MeshStandardMaterial({ color: '#ef9aa0', roughness: .9, emissive: '#6a2a2e', emissiveIntensity: .25 }),
      mouth: new THREE.MeshStandardMaterial({ color: '#5a2c34', roughness: .8 }) };
    this.tail = new THREE.Vector3(); this.tailVelocity = new THREE.Vector3();
    this.debug = 'fabric';
    this.setTraits({});
  }

  setQuality(quality) {
    this.quality = quality;
    this.cloth.geometry.dispose(); this.cloth.geometry = makeClothGeometry(quality, this.traits);
    this.contour.geometry = this.cloth.geometry;
    this.paint();
  }

  // Rebuild the sheet only when a body trait changes; place the head on the new crown.
  applyBody() {
    const P = bodyParams(this.traits);
    if (this.cloth.geometry.userData.body !== P.key) {
      this.cloth.geometry.dispose(); this.cloth.geometry = makeClothGeometry(this.quality, this.traits);
      this.contour.geometry = this.cloth.geometry;
      this.paint();
    }
    const h = headTransform(P);
    this.head.position.set(h.x, h.y, 0); this.head.rotation.set(0, 0, h.rotZ);
  }

  applyExpression() {
    const expression = this.traits.expression ?? 'dots', keep = dotEyes(expression);
    this.eyes.forEach((eye, i) => {
      eye.visible = keep[i];
      const big = expression === 'sparkle' ? 1.2 : 1;
      eye.scale.set(.068 * big, .102 * big, .025); eye.userData.sparkle.visible = expression === 'sparkle';
    });
    this.clearAccessory(this.expressionGroup);
    buildFace(this.expressionGroup, expression, this.faceMaterials);
    this.expressionGroup.traverse(o => { if (o.isMesh) o.castShadow = false; });
  }

  // Town night level 0..1 (the sky's `night`, same ramp as the kit glow). Only the
  // glow-in-the-dark finish reacts; every other cloth ignores it.
  setNight(value) { this.illustrated.night.value = THREE.MathUtils.clamp(value, 0, 1); }

  setTraits(patch) {
    const previousFinish=this.traits.finish;
    Object.assign(this.traits, classicBody(patch));
    const finish=this.traits.finish??'cotton',opal=finish==='opal',gold=finish==='gold';
    this.material.roughness=opal?.42:gold?.50:finish==='jet'?.83:.93;
    this.material.metalness=gold?.68:opal?.12:0;
    this.material.iridescence=opal?.85:0;
    this.material.iridescenceIOR=1.32;
    this.material.iridescenceThicknessRange=[180,380];
    this.material.specularIntensity=opal?.65:gold?.55:.2;
    this.material.sheen=gold?.22:opal?.4:.55;
    this.material.bumpScale=gold?.0018:opal?.0015:.003;
    if(previousFinish!==finish)this.material.needsUpdate=true;
    this.illustrated.starlight.value=finish==='starlight'?1:0;
    const velvet=finish==='velvet';
    this.illustrated.finish.value=velvet?1:finish==='glow'?2:0;
    if(velvet){this.material.roughness=.97;this.material.sheen=1;this.material.sheenRoughness=.4;
      this.material.sheenColor.set(this.traits.colors[1]);this.illustrated.sheenColor.value.set(this.traits.colors[1]);}
    else{this.material.sheenRoughness=.85;this.material.sheenColor.set('#fff8ef');}
    // Pale eyes on any dark cloth, so faces always read (Jet Black already did this).
    const base=new THREE.Color(this.traits.colors[0]),dark=base.r*.2126+base.g*.7152+base.b*.0722<.1;
    this.eyeMaterial.color.set(['jet','starlight'].includes(finish)||dark?'#eee9d7':'#171a20');
    this.setStyle(this.style);

    this.hatMaterial.color.set(this.traits.accessoryColor);
    const hardSurface=['hardhat','headphones','antenna'].includes(this.traits.hat);
    this.hatMaterial.roughness=hardSurface?.43:.94;
    this.hatMaterial.sheen=hardSurface?.08:.3;
    this.hatMaterial.bumpScale=hardSurface?0:.0018;
    this.bandMaterial.color.set(this.traits.trimColor);
    const m=this.accessoryMaterials;
    m.seam.color.copy(this.hatMaterial.color).multiplyScalar(.70);
    m.stitch.color.copy(this.hatMaterial.color).lerp(new THREE.Color(this.traits.trimColor),.45);
    m.bonnetCotton.color.copy(this.hatMaterial.color).lerp(this.creamMaterial.color,.79);
    m.bonnetSeam.color.copy(m.bonnetCotton.color).multiplyScalar(.83);
    m.mushroom.color.set('#a7513b').lerp(this.hatMaterial.color,.15);
    m.gem.color.copy(this.hatMaterial.color).lerp(new THREE.Color('#398e89'),.3);
    this.frameMaterial.color.set('#895b45').lerp(this.hatMaterial.color,.23);
    this.paint();
    if (!this.initialized || ['marking','markColor','markScale','colors','trimColor','finish'].some(key => key in patch)) {
      this.markingsTexture?.dispose(); this.openworkTexture?.dispose(); this.openworkTexture = null;
      const print = PRINT_FINISHES.includes(finish) ? makeFabricPrint(this.traits) : null;
      this.markingsTexture = print ? print.map : makeMarkings(this.traits);
      this.illustrated.markings.value = this.markingsTexture;
      this.illustrated.hasMarks.value = this.markingsTexture ? 1 : 0;
      // Lace is real openwork: eyelets and a scalloped edge are cut from the sheet.
      this.openworkTexture = print?.alpha ?? null;
      const hadOpenwork = !!this.material.alphaMap;
      this.material.alphaMap = this.openworkTexture; this.material.alphaTest = this.openworkTexture ? .5 : 0;
      if (hadOpenwork !== !!this.openworkTexture) this.material.needsUpdate = true;
      this.contour.material.uniforms.openwork.value = this.openworkTexture;
      this.contour.material.uniforms.hasOpenwork.value = this.openworkTexture ? 1 : 0;
    }
    if (!this.initialized || ['hem','stance','arms'].some(key => key in patch)) this.applyBody();
    if (!this.initialized || 'expression' in patch) this.applyExpression();
    if (patch.hat !== undefined || !this.initialized) this.makeHat();
    if (patch.glasses !== undefined || !this.initialized) this.makeGlasses();
    this.initialized = true;
  }

  paint() {
    const { pattern, colors } = this.traits;
    const a = new THREE.Color(colors[0]), b = new THREE.Color(colors[1]), c = new THREE.Color(colors[2]);
    const geometry = this.cloth.geometry, { rest, weight } = geometry.userData;
    const output = geometry.attributes.color, uv = geometry.attributes.uv, mixed = new THREE.Color();
    const spectrum=pattern==='rainbow'?['#df5f73','#ef9553','#edcf65','#72bfa0','#62a8cf','#8173bd','#c486b6'].map(c=>new THREE.Color(c)):null;
    for (let i = 0; i < output.count; i++) {
      const v = uv.getY(i), x = rest[i * 3];
      let t = smooth(1 - v, .1, .96);
      if (pattern === 'diagonal') t = smooth((1 - v) + x * .4, .08, .96);
      if (this.debug === 'motion') mixed.setRGB(weight[i], .18, 1 - weight[i]);
      else if (pattern === 'solid') mixed.copy(a);
      else if (spectrum) {
        const q=THREE.MathUtils.clamp((1-v)+x*.11,0,1)*(spectrum.length-1),lo=Math.min(spectrum.length-2,Math.floor(q));
        mixed.copy(spectrum[lo]).lerp(spectrum[lo+1],q-lo);
      }
      else if (pattern === 'aurora') {
        t = THREE.MathUtils.clamp(t + .12 * Math.sin(x * 3.5 + v * 4), 0, 1);
        if (t < .5) mixed.copy(a).lerp(b, t * 2); else mixed.copy(b).lerp(c, t * 2 - 1);
      } else mixed.copy(a).lerp(b, t);
      output.setXYZ(i, mixed.r, mixed.g, mixed.b);
    }
    output.needsUpdate = true;
  }

  clearAccessory(group) {
    group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    group.clear();
  }

  makeHat() {
    this.clearAccessory(this.hat);
    buildHat(this.hat, this.traits.hat, this.accessoryMaterials);
    this.inspectAccessories();
  }

  makeGlasses() {
    this.clearAccessory(this.glasses);
    buildGlasses(this.glasses, this.traits.glasses, this.accessoryMaterials);
    this.inspectAccessories();
  }

  inspectAccessories() {
    for (const group of [this.hat,this.glasses,this.expressionGroup]) group.traverse(object => {
      if (!object.isMesh) return;
      object.userData.surfaceMaterial ??= object.material;
      object.material = this.debug === 'normals' ? this.normalMaterial : object.userData.surfaceMaterial;
      object.userData.surfaceMaterial.wireframe = this.debug === 'wire';
    });
  }

  setStyle(value) {
    this.style = value;
    this.illustrated.illustration.value = value === 'illustrated' ? (['gold','opal'].includes(this.traits.finish)?.38:.72) : 0;
    this.contour.visible = value === 'illustrated' && this.debug === 'fabric';
  }

  setViewport(width, height) { this.contour.material.uniforms.resolution.value.set(width, height); }

  dispose() {
    const geometries = new Set(), materials = new Set([...Object.values(this.accessoryMaterials), ...Object.values(this.faceMaterials)]);
    this.root.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) materials.add(o.material); });
    [this.material,this.normalMaterial,this.weightMaterial,this.highlightMaterial,this.metal].forEach(m => materials.add(m));
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    this.markingsTexture?.dispose(); this.openworkTexture?.dispose(); this.material.bumpMap?.dispose(); this.accessoryWeave?.dispose();
    this.root.clear();
  }

  setDebug(value) {
    this.debug = value;
    this.contour.visible = this.style === 'illustrated' && value === 'fabric';
    this.material.wireframe = value === 'wire';
    this.inspectAccessories();
    this.cloth.material = value === 'normals' ? this.normalMaterial : value === 'motion' ? this.weightMaterial : this.material;
    this.paint();
  }

  resetMotion() { this.tail.set(0, 0, 0); this.tailVelocity.set(0, 0, 0); }

  update(time, dt, velocity, softness) {
    // A bounded, sub-stepped spring creates velocity-dependent follow-through.
    // Convert world velocity into the body's local coordinates before deformation.
    const yaw = this.root.rotation.y, cos = Math.cos(yaw), sin = Math.sin(yaw);
    const vx = velocity.x * cos - velocity.z * sin, vz = velocity.x * sin + velocity.z * cos;
    const tx = THREE.MathUtils.clamp(-vx * .15 * softness, -.55, .55);
    const tz = THREE.MathUtils.clamp(-vz * .15 * softness, -.55, .55);
    const steps = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / steps;
    for (let n = 0; n < steps; n++) {
      this.tailVelocity.x += ((tx - this.tail.x) * 30 - this.tailVelocity.x * 7) * h;
      this.tailVelocity.z += ((tz - this.tail.z) * 30 - this.tailVelocity.z * 7) * h;
      this.tail.addScaledVector(this.tailVelocity, h);
    }
    const geometry = this.cloth.geometry, pos = geometry.attributes.position;
    const { rest, weight } = geometry.userData;
    for (let i = 0; i < pos.count; i++) {
      const j = i * 3, w = weight[i], x = rest[j], y = rest[j + 1], z = rest[j + 2];
      const angle = Math.atan2(x, z), wind = .012 * softness * w * Math.sin(time * 1.65 + y * 3 + angle * 2);
      pos.setXYZ(i, x + this.tail.x * w + Math.sin(angle) * wind, y + w * w * .018 * softness * Math.sin(time * 2 + angle * 3), z + this.tail.z * w + Math.cos(angle) * wind);
    }
    pos.needsUpdate = true; updateNormals(geometry);
    this.root.position.y = .055 + .035 * Math.sin(time * 1.6);
  }
}
