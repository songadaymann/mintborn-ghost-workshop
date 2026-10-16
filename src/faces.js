import * as THREE from 'three';

// Ghost v4 expressions (2026-09-28). Plain dot eyes stay the default, built by ghost.js.
// Everything here is a small ink shape laid onto the approved head sphere, in head
// coordinates, so it moves with height and lean exactly like hats and glasses do.
export const FACE_VERSION = 'faces-01';
const HEAD = new THREE.Vector3(0, 1.9, 0), R = .492;
// Expressions whose extra features live on the eyes (hidden by opaque eyewear).
export const EYE_EXPRESSIONS = ['sleepy', 'happy', 'wink', 'sparkle', 'star', 'heart'];
export const MOUTH_EXPRESSIONS = ['smile', 'o_mouth'];
// Which default dot eyes each expression keeps: [left(-x), right(+x)].
export function dotEyes(expression) {
  if (['dots', 'smile', 'blush', 'o_mouth', 'sparkle'].includes(expression)) return [true, true];
  if (expression === 'wink') return [true, false];
  return [false, false];
}

function onHead(x, y, lift = 0) {
  const dy = y - HEAD.y, z = Math.sqrt(Math.max(0, R * R - x * x - dy * dy));
  const n = new THREE.Vector3(x, dy, z).normalize();
  return { p: HEAD.clone().addScaledVector(n, R + lift), n };
}
function orient(object, x, y, lift) {
  const { p, n } = onHead(x, y, lift);
  object.position.copy(p);
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  return object;
}
function stroke(group, material, points2d, radius = .0165) {
  const points = points2d.map(([x, y]) => onHead(x, y, .004).p);
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, radius, 8, false), material);
  group.add(tube);
  for (const p of [points[0], points.at(-1)]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8), material);
    cap.position.copy(p); group.add(cap);
  }
}
function arc(cx, cy, halfWidth, height, n = 13) {
  return Array.from({ length: n }, (_, i) => { const t = i / (n - 1) * 2 - 1; return [cx + halfWidth * t, cy + height * (1 - t * t)]; });
}
function decal(group, material, shape, x, y, { depth = .01, lift = -.002, scale = 1, spin = 0 } = {}) {
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: .0035, bevelThickness: .003, bevelSegments: 2, curveSegments: 10 });
  const mesh = new THREE.Mesh(geometry, material);
  const holder = orient(new THREE.Group(), x, y, lift);
  mesh.scale.setScalar(scale); mesh.rotation.z = spin; holder.add(mesh); group.add(holder);
  return mesh;
}
function starShape(r, inner = .46) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * inner : r;
    i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  s.closePath(); return s;
}
function heartShape(r) {
  const s = new THREE.Shape();
  s.moveTo(0, -r);
  s.bezierCurveTo(-r * 1.25, -r * .15, -r * 1.05, r * 1.05, 0, r * .42);
  s.bezierCurveTo(r * 1.05, r * 1.05, r * 1.25, -r * .15, 0, -r);
  return s;
}
function ellipseShape(w, h) { const s = new THREE.Shape(); s.absellipse(0, 0, w, h, 0, Math.PI * 2, false); return s; }

export function buildFace(group, expression, m) {
  const ink = m.eye, eyeY = 2.045;
  if (expression === 'happy') for (const x of [-.17, .17]) stroke(group, ink, arc(x, eyeY - .03, .07, .062), .019);
  if (expression === 'wink') {
    stroke(group, ink, arc(.17, eyeY - .03, .064, .052));
    stroke(group, ink, arc(0, 1.95, .052, -.028, 11), .014);
  }
  if (expression === 'sleepy') for (const x of [-.17, .17]) {
    // Peacefully closed: a soft downward curve with two tiny lashes.
    stroke(group, ink, arc(x, eyeY - .005, .066, -.036), .018);
    for (const d of [-1, 1]) stroke(group, ink, [[x + d * .05, eyeY - .03], [x + d * .062, eyeY - .058]], .009);
  }
  if (expression === 'star') for (const x of [-.17, .17]) {
    decal(group, ink, starShape(.092), x, eyeY, { lift: -.004 });
    decal(group, m.star, starShape(.068), x, eyeY, { lift: .004, depth: .008 });
  }
  if (expression === 'heart') for (const x of [-.17, .17]) {
    decal(group, ink, heartShape(.082), x, eyeY - .005, { lift: -.004 });
    decal(group, m.heart, heartShape(.062), x, eyeY - .005, { lift: .004, depth: .008 });
  }
  if (expression === 'blush' || expression === 'heart') for (const x of [-.29, .29]) decal(group, m.blush, ellipseShape(.058, .034), x, 1.968, { depth: .004, lift: -.001 });
  if (expression === 'smile') stroke(group, ink, arc(0, 1.955, .05, -.03, 11), .014);
  if (expression === 'o_mouth') {
    const ring = orient(new THREE.Group(), 0, 1.935, .002);
    ring.add(new THREE.Mesh(new THREE.TorusGeometry(.033, .013, 8, 22), ink));
    const inner = new THREE.Mesh(new THREE.CircleGeometry(.024, 18), m.mouth);
    inner.position.z = -.002; ring.add(inner); group.add(ring);
  }
}
