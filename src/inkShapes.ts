// ============================================================
// inkShapes.ts — turn a rough hand-drawn stroke into a neat shape:
// straight line (snapped to horizontal / vertical / 45°), circle or
// ellipse, triangle, rectangle (or any 4-corner shape). Pure maths.
// Returns null when the stroke is not clearly one of those (so a
// letter or a squiggle is never "corrected" into something else).
// ============================================================

type P = [number, number];
export interface NeatShape {
  kind: 'line' | 'ellipse' | 'triangle' | 'rect' | 'quad';
  /** Polyline, already dense enough to render smoothly. Closed shapes end where they start. */
  pts: P[];
}

const dist = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function pathLength(p: P[]): number {
  let l = 0;
  for (let i = 1; i < p.length; i++) l += dist(p[i - 1], p[i]);
  return l;
}

/** Equal-spacing resample, so fast and slow parts of the stroke count the same. */
function resample(p: P[], n: number): P[] {
  const total = pathLength(p);
  if (total === 0) return p.slice(0, 1);
  const step = total / (n - 1);
  const out: P[] = [p[0]];
  let acc = 0;
  let prev = p[0];
  for (let i = 1; i < p.length; i++) {
    let seg = dist(prev, p[i]);
    while (acc + seg >= step && seg > 0) {
      const t = (step - acc) / seg;
      const q: P = [prev[0] + (p[i][0] - prev[0]) * t, prev[1] + (p[i][1] - prev[1]) * t];
      out.push(q);
      prev = q;
      seg = dist(prev, p[i]);
      acc = 0;
    }
    acc += seg;
    prev = p[i];
  }
  if (out.length < n) out.push(p[p.length - 1]);
  return out;
}

function distToLine(p: P, a: P, b: P): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
}

/** Ramer–Douglas–Peucker simplification. */
function rdp(p: P[], eps: number): P[] {
  if (p.length < 3) return p;
  let maxD = 0;
  let idx = 0;
  for (let i = 1; i < p.length - 1; i++) {
    const d = distToLine(p[i], p[0], p[p.length - 1]);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= eps) return [p[0], p[p.length - 1]];
  return [...rdp(p.slice(0, idx + 1), eps).slice(0, -1), ...rdp(p.slice(idx), eps)];
}

/** Interior angle (degrees) at vertex b of a-b-c. */
function angleAt(a: P, b: P, c: P): number {
  const v1: P = [a[0] - b[0], a[1] - b[1]];
  const v2: P = [c[0] - b[0], c[1] - b[1]];
  const cos = (v1[0] * v2[0] + v1[1] * v2[1]) / ((Math.hypot(...v1) * Math.hypot(...v2)) || 1);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

function densify(poly: P[], maxStep = 10): P[] {
  const out: P[] = [poly[0]];
  for (let i = 1; i < poly.length; i++) {
    const d = dist(poly[i - 1], poly[i]);
    const k = Math.max(1, Math.ceil(d / maxStep));
    for (let j = 1; j <= k; j++) {
      const t = j / k;
      out.push([poly[i - 1][0] + (poly[i][0] - poly[i - 1][0]) * t, poly[i - 1][1] + (poly[i][1] - poly[i - 1][1]) * t]);
    }
  }
  return out;
}

function recognizeLine(p: P[], L: number): NeatShape | null {
  const a = p[0];
  const b = p[p.length - 1];
  const chord = dist(a, b);
  if (chord < 25 || chord / L < 0.9) return null;
  let maxDev = 0;
  for (const q of p) maxDev = Math.max(maxDev, distToLine(q, a, b));
  if (maxDev / chord > 0.06) return null;

  // snap to horizontal / vertical / 45° when within a few degrees
  let deg = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  const snap = [0, 45, 90, 135, 180, -45, -90, -135, -180].find((t) => Math.abs(deg - t) <= (t % 90 === 0 ? 6 : 4));
  if (snap !== undefined) deg = snap;
  const rad = (deg * Math.PI) / 180;
  const mid: P = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const h = chord / 2;
  return {
    kind: 'line',
    pts: densify([[mid[0] - Math.cos(rad) * h, mid[1] - Math.sin(rad) * h], [mid[0] + Math.cos(rad) * h, mid[1] + Math.sin(rad) * h]]),
  };
}

function recognizeEllipse(p: P[]): NeatShape | null {
  const r = resample(p, 72);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of r) {
    x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]);
    y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]);
  }
  const a = (x1 - x0) / 2;
  const b = (y1 - y0) / 2;
  if (a < 10 || b < 10) return null;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rho = r.map((q) => Math.hypot((q[0] - cx) / a, (q[1] - cy) / b));
  const mean = rho.reduce((s, v) => s + v, 0) / rho.length;
  const sd = Math.sqrt(rho.reduce((s, v) => s + (v - mean) ** 2, 0) / rho.length);
  if (sd > 0.09 || Math.min(...rho) < 0.72 || Math.max(...rho) > 1.28) return null;
  const round = Math.abs(a - b) < 0.12 * Math.max(a, b);
  const ra = round ? (a + b) / 2 : a;
  const rb = round ? (a + b) / 2 : b;
  const pts: P[] = [];
  for (let i = 0; i <= 72; i++) {
    const t = (i / 72) * Math.PI * 2;
    pts.push([cx + Math.cos(t) * ra, cy + Math.sin(t) * rb]);
  }
  return { kind: 'ellipse', pts };
}

function recognizePolygon(p: P[], L: number): NeatShape | null {
  let v = rdp(p, 0.04 * L);
  // closed: the end point sits on the start point
  if (v.length > 2 && dist(v[0], v[v.length - 1]) < 0.12 * L) v = v.slice(0, -1);
  // drop vertices that are really just a point on a straight edge (e.g. where the pen started)
  let changed = true;
  while (changed && v.length > 3) {
    changed = false;
    for (let i = 0; i < v.length; i++) {
      const ang = angleAt(v[(i + v.length - 1) % v.length], v[i], v[(i + 1) % v.length]);
      if (ang > 158) {
        v = v.filter((_, j) => j !== i);
        changed = true;
        break;
      }
    }
  }
  if (v.length === 3) {
    // a triangle needs three real corners and sides that are not tiny
    if (v.some((q, i) => dist(q, v[(i + 1) % 3]) < 0.1 * L)) return null;
    return { kind: 'triangle', pts: densify([...v, v[0]]) };
  }
  if (v.length === 4) {
    const angs = v.map((_, i) => angleAt(v[(i + 3) % 4], v[i], v[(i + 1) % 4]));
    const square = angs.every((x) => Math.abs(x - 90) < 22);
    if (square) {
      // axis-aligned if the longest edge is within ~12° of horizontal/vertical
      let longest = 0;
      let ang = 0;
      v.forEach((q, i) => {
        const n = v[(i + 1) % 4];
        const d = dist(q, n);
        if (d > longest) {
          longest = d;
          ang = Math.abs((Math.atan2(n[1] - q[1], n[0] - q[0]) * 180) / Math.PI) % 90;
        }
      });
      if (Math.min(ang, 90 - ang) < 12) {
        const xs = v.map((q) => q[0]);
        const ys = v.map((q) => q[1]);
        const [l, r, t, b] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
        return { kind: 'rect', pts: densify([[l, t], [r, t], [r, b], [l, b], [l, t]]) };
      }
      return { kind: 'rect', pts: densify([...v, v[0]]) };
    }
    return { kind: 'quad', pts: densify([...v, v[0]]) };
  }
  return null;
}

/** `points` are the stroke's [x, y] in page units. */
export function recognizeShape(points: P[]): NeatShape | null {
  if (points.length < 6) return null;
  const L = pathLength(points);
  if (L < 40) return null;
  const line = recognizeLine(points, L);
  if (line) return line;
  // closed? (start and end close together compared with the length drawn)
  if (dist(points[0], points[points.length - 1]) > 0.3 * L) return null;
  return recognizeEllipse(points) ?? recognizePolygon(resample(points, 96), L);
}
