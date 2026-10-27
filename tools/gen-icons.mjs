// Génère les icônes PNG de MiamMiam : un petit chat qui mange des nouilles.
// Dessin vectoriel simple, lissé par super-échantillonnage, sans dépendance.
// Usage : node tools/gen-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const SS = 4; // super-échantillonnage (anti-aliasing)

// --- Palette (violet + orange) ---
const BG1 = [124, 58, 170];   // violet (haut)
const BG2 = [94, 23, 140];    // violet (bas)
const CHAT = [245, 124, 0];   // chat orange
const CHAT2 = [230, 108, 0];  // rayures / contour doux
const OREILLE = [248, 187, 208]; // intérieur d'oreille rose
const BLANC = [255, 255, 255];
const FONCE = [60, 45, 65];   // yeux / traits
const NOUILLE = [255, 213, 79];
const BOUILLON = [255, 138, 101];
const JOUE = [255, 138, 128];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(size, rgb) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  let o = 0;
  for (let y = 0; y < size; y++) { raw[o++] = 0; for (let x = 0; x < size; x++) { const i = (y * size + x) * 3; raw[o++] = rgb[i]; raw[o++] = rgb[i + 1]; raw[o++] = rgb[i + 2]; } }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

function dessiner(size) {
  const S = size * SS;
  const f = S / 1000;
  const buf = new Float32Array(S * S * 3);

  const put = (px, py, col, a) => {
    if (px < 0 || py < 0 || px >= S || py >= S) return;
    const i = (py * S + px) * 3;
    buf[i] = buf[i] * (1 - a) + col[0] * a;
    buf[i + 1] = buf[i + 1] * (1 - a) + col[1] * a;
    buf[i + 2] = buf[i + 2] * (1 - a) + col[2] * a;
  };
  // Remplit une zone logique [x0,y0,x1,y1] selon test(x,y) -> {col,a} | null.
  const zone = (x0, y0, x1, y1, test) => {
    const px0 = Math.max(0, Math.floor(x0 * f)), px1 = Math.min(S, Math.ceil(x1 * f));
    const py0 = Math.max(0, Math.floor(y0 * f)), py1 = Math.min(S, Math.ceil(y1 * f));
    for (let py = py0; py < py1; py++) { const y = py / f; for (let px = px0; px < px1; px++) { const x = px / f; const r = test(x, y); if (r) put(px, py, r.col, r.a === undefined ? 1 : r.a); } }
  };
  const ell = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
  const disque = (cx, cy, r, col, a = 1) => zone(cx - r, cy - r, cx + r, cy + r, (x, y) => (ell(x, y, cx, cy, r, r) <= 1 ? { col, a } : null));
  const tri = (ax, ay, bx, by, cx, cy, col) => {
    const s = (px, py, x1, y1, x2, y2) => (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
    zone(Math.min(ax, bx, cx), Math.min(ay, by, cy), Math.max(ax, bx, cx), Math.max(ay, by, cy), (x, y) => {
      const d1 = s(x, y, ax, ay, bx, by), d2 = s(x, y, bx, by, cx, cy), d3 = s(x, y, cx, cy, ax, ay);
      const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
      return (!(neg && pos)) ? { col } : null;
    });
  };
  const segment = (x1, y1, x2, y2, w, col, a = 1) => {
    zone(Math.min(x1, x2) - w, Math.min(y1, y2) - w, Math.max(x1, x2) + w, Math.max(y1, y2) + w, (x, y) => {
      const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy;
      let t = L ? ((x - x1) * dx + (y - y1) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
      const px = x1 + t * dx, py = y1 + t * dy;
      return (Math.hypot(x - px, y - py) <= w ? { col, a } : null);
    });
  };

  // Fond violet (dégradé).
  zone(0, 0, 1000, 1000, (x, y) => { const t = y / 1000; return { col: [BG1[0] + (BG2[0] - BG1[0]) * t, BG1[1] + (BG2[1] - BG1[1]) * t, BG1[2] + (BG2[2] - BG1[2]) * t] }; });

  // Oreilles (triangles) + intérieur rose.
  tri(250, 300, 330, 120, 470, 300, CHAT);
  tri(750, 300, 670, 120, 530, 300, CHAT);
  tri(300, 300, 345, 185, 430, 300, OREILLE);
  tri(700, 300, 655, 185, 570, 300, OREILLE);

  // Tête du chat.
  zone(260, 210, 740, 700, (x, y) => (ell(x, y, 500, 450, 240, 235) <= 1 ? { col: CHAT } : null));
  // Deux petites rayures sur le front.
  segment(430, 250, 445, 320, 10, CHAT2);
  segment(500, 240, 500, 315, 10, CHAT2);
  segment(570, 250, 555, 320, 10, CHAT2);

  // Joues roses.
  disque(372, 500, 46, JOUE, 0.5);
  disque(628, 500, 46, JOUE, 0.5);
  // Yeux (contents : grands yeux brillants).
  disque(422, 430, 30, FONCE);
  disque(578, 430, 30, FONCE);
  disque(432, 420, 10, BLANC);
  disque(588, 420, 10, BLANC);
  // Museau : nez + bouche.
  tri(478, 486, 522, 486, 500, 512, [214, 120, 140]);
  disque(500, 545, 26, FONCE); // bouche ouverte (miam)
  // Moustaches.
  segment(360, 495, 215, 470, 5, BLANC); segment(360, 515, 210, 520, 5, BLANC);
  segment(640, 495, 785, 470, 5, BLANC); segment(640, 515, 790, 520, 5, BLANC);

  // Bol de nouilles (devant, en bas).
  zone(190, 740, 810, 1000, (x, y) => (ell(x, y, 500, 800, 300, 210) <= 1 && y >= 800 ? { col: BLANC } : null));
  zone(190, 720, 810, 900, (x, y) => (ell(x, y, 500, 802, 312, 78) <= 1 ? { col: [236, 239, 241] } : null)); // liseré
  zone(200, 735, 800, 880, (x, y) => (ell(x, y, 500, 802, 286, 60) <= 1 ? { col: BOUILLON } : null)); // bouillon
  // Nouilles dans le bol (quelques arcs).
  for (let i = -2; i <= 2; i++) segment(500 + i * 70, 770, 500 + i * 55, 815, 10, NOUILLE);

  // Nouille slurpée : du bol jusqu'à la bouche.
  let prev = [520, 770];
  for (let s = 0; s <= 20; s++) {
    const t = s / 20;
    const x = 520 + Math.sin(t * 7) * 34 - t * 20;
    const y = 770 - (770 - 560) * t;
    segment(prev[0], prev[1], x, y, 9, NOUILLE);
    prev = [x, y];
  }

  // Réduction box filter.
  const out = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) { const i = ((y * SS + sy) * S + (x * SS + sx)) * 3; r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; }
    const n = SS * SS, o = (y * size + x) * 3;
    out[o] = Math.round(r / n); out[o + 1] = Math.round(g / n); out[o + 2] = Math.round(b / n);
  }
  return out;
}

mkdirSync(new URL("../icons/", import.meta.url), { recursive: true });
for (const s of [192, 512]) {
  writeFileSync(new URL(`../icons/icon-${s}.png`, import.meta.url), encodePng(s, dessiner(s)));
  console.log("écrit icons/icon-" + s + ".png");
}
