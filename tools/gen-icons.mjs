// Génère des icônes PNG placeholders (fond vert + disque blanc) sans dépendance.
// Usage : node tools/gen-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const bg = [46, 125, 50];    // vert
  const fg = [255, 255, 255];  // blanc
  const r = size * 0.3;
  const cx = size / 2, cy = size / 2;

  // Scanlines RGBA avec octet de filtre 0 en tête de chaque ligne.
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      const dans = (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
      const col = dans ? fg : bg;
      raw[o++] = col[0]; raw[o++] = col[1]; raw[o++] = col[2]; raw[o++] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // profondeur
  ihdr[9] = 6;   // RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

mkdirSync(new URL("../icons/", import.meta.url), { recursive: true });
for (const s of [192, 512]) {
  const out = new URL(`../icons/icon-${s}.png`, import.meta.url);
  writeFileSync(out, png(s));
  console.log("écrit", out.pathname);
}
