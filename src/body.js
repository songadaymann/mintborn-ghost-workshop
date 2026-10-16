// Ghost v4 body shapes (2026-09-28). The head is never reshaped: every body variant
// keeps the approved sheet-01 crown, so hats, glasses and faces sit in one `head`
// group that simply moves with the crown (height) and turns with the lean (tilt).
// Default traits reproduce sheet-01 exactly.
export const BODY_DEFAULTS = Object.freeze({ hem: 'classic', stance: 'regular', arms: 'none' });
const BASE = { crownY: 1.9, headRadius: .49, hemY: .24, capFraction: .26 };
const TAU = Math.PI * 2;
const smooth = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

const STANCES = {
  regular: { crown: 1.9, tilt: 0 },
  tall: { crown: 2.22, tilt: 0, width: .92 },
  short: { crown: 1.52, tilt: 0, width: 1.25 },
  tilt_left: { crown: 1.9, tilt: .2 },
  tilt_right: { crown: 1.9, tilt: -.2 },
};
const HEMS = {
  classic: { hemY: .24 },
  wavy: { hemY: .27 },
  tattered: { hemY: .30 },
  short_wide: { hemY: .56 },
  long_drape: { hemY: .035 },
};
// Arms are soft cloth nubs pushed out from inside the sheet (no extra mesh).
// Front is +Z (angle 0); the sides are ±PI/2. Each nub: [angle, q, outward, lift].
const ARMS = {
  none: [],
  nubs: [[1.42, .31, .25, -.09], [-1.42, .31, .25, -.09]],
  wave: [[1.42, .25, .33, .19], [-1.42, .31, .25, -.09]],
  boo: [[1.42, .25, .33, .19], [-1.42, .25, .33, .19]],
};

export function bodyParams(traits = {}) {
  const hem = HEMS[traits.hem] ? traits.hem : 'classic';
  const stance = STANCES[traits.stance] ? traits.stance : 'regular';
  const arms = ARMS[traits.arms] ? traits.arms : 'none';
  const s = STANCES[stance], h = HEMS[hem];
  // Short-and-wide hems shorten the body from the bottom; the crown keeps its stance height.
  return { hem, stance, arms, crownY: s.crown, width: s.width ?? 1, hemY: h.hemY, tilt: s.tilt, pivotY: h.hemY, nubs: ARMS[arms],
    key: hem + '|' + stance + '|' + arms };
}

// Head group transform: translate by crown height, then rotate about the hem pivot.
export function headTransform(P) {
  const dy = P.crownY - BASE.crownY, c = Math.cos(P.tilt), s = Math.sin(P.tilt), py = P.pivotY;
  // position = R((0,dy) - p) + p
  const x = -s * (dy - py), y = c * (dy - py) + py;
  return { x, y, rotZ: P.tilt };
}

// Visual top of the body plus head (before hats), for camera framing.
export function bodyTop(traits) { const P = bodyParams(traits); return P.crownY + BASE.headRadius; }

export function bodySurface(v, angle, out, P) {
  const { headRadius, capFraction } = BASE;
  let radius, y, bend = 1;
  if (v <= capFraction) {
    const phi = v / capFraction * Math.PI / 2;
    radius = headRadius * Math.sin(phi);
    y = BASE.crownY + headRadius * Math.cos(phi) + (P.crownY - BASE.crownY);
  } else {
    const q = (v - capFraction) / (1 - capFraction);
    let foldScale = 1, flare = .075 * q * q + .115 * q ** 4, lift = q ** 5 * (.057 * Math.sin(3 * angle + .4) + .035 * Math.cos(7 * angle));
    if (P.hem === 'long_drape') {
      foldScale = 1.15;
      flare = .02 * q * q + .03 * q ** 4 + .42 * q ** 8;
      lift = q ** 6 * (.07 * Math.sin(3 * angle + .4) + .045 * Math.cos(7 * angle)) - (q ** 5) * .07 * Math.max(0, -Math.cos(angle));
    } else if (P.hem === 'short_wide') {
      foldScale = 1.05;
      flare = .10 * q + .22 * q * q + .10 * q ** 4;
      lift = q ** 5 * (.05 * Math.sin(3 * angle + .4) + .03 * Math.cos(7 * angle));
    } else if (P.hem === 'wavy') {
      // Curled scallops: every other lobe flips outward and up, like a hem that curls.
      // Six soft curls: each lobe flips out and up, the dips between hang low.
      const lobe = Math.cos(6 * angle + .9), curl = Math.sign(lobe) * Math.abs(lobe) ** .7;
      flare += q ** 6 * .10 * (1 + curl) + q ** 3 * .03;
      lift = q ** 8 * .17 * curl + q ** 5 * .02 * Math.cos(3 * angle);
      foldScale = .95;
    } else if (P.hem === 'tattered') {
      // Uneven torn points hanging down; each tooth has its own length.
      const teeth = 9, t = (angle / TAU + .5) * teeth + .37, i = Math.floor(t), f = t - i;
      const tri = 1 - Math.abs(f - .5) * 2, len = .12 + .16 * hash(i % teeth);
      lift = -(q ** 6) * len * tri ** 1.4 + q ** 5 * .03 * Math.sin(3 * angle + .4);
      flare += q ** 6 * .025 * tri;
    }
    const fold = .105 * Math.cos(7 * angle + .38 * q) + .043 * Math.sin(4 * angle - .55 + .3 * q) + .021 * Math.cos(11 * angle - .8 * q);
    radius = headRadius + (flare + foldScale * fold * smooth(q, 0, .85)) * P.width;
    y = P.crownY + (P.hemY - P.crownY) * q + lift;
    for (const [a0, q0, out0, up] of P.nubs) {
      // Flat-topped (super-Gaussian) bump reads as a rounded mitten, not a cone.
      const da = wrap(angle - a0), d2 = (da / .27) ** 2 + ((q - q0) / .085) ** 2, f = Math.exp(-(d2 * d2));
      radius += out0 * f; y += up * f;
    }
    bend = Math.max(0, 1 - q) ** 1.15;
  }
  let x = radius * Math.sin(angle), z = radius * Math.cos(angle);
  if (P.tilt) {
    const a = P.tilt * bend, c = Math.cos(a), s = Math.sin(a), ry = y - P.pivotY;
    const nx = c * x - s * ry, ny = s * x + c * ry;
    x = nx; y = ny + P.pivotY;
  }
  out.set(x, y, z);
  return out;
}
