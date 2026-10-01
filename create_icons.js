// Script to generate minimal valid PNG icons for Chrome Extension using pure Node.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crc ^ buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBody = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(crcBody);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);
  return Buffer.concat([len, crcBody, crcBuf]);
}

function generateIconPNG(size) {
  // Generate RGBA raw image data
  // Red circular stamp with a shield or "S" mark
  const scanlines = [];
  const radius = size / 2 - 1;
  const center = size / 2;

  for (let y = 0; y < size; y++) {
    scanlines.push(0); // filter byte 0 (None)
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        // Red badge
        // Border ring
        if (dist >= radius - Math.max(1, size * 0.1)) {
          scanlines.push(180, 20, 20, 255); // Dark red border
        } else {
          // Inside stamp
          // Draw horizontal bar or cross
          const isBar = Math.abs(dy) <= size * 0.15 && Math.abs(dx) <= size * 0.35;
          if (isBar) {
            scanlines.push(255, 255, 255, 255); // White inner bar
          } else {
            scanlines.push(220, 38, 38, 255); // Crimson red
          }
        }
      } else {
        scanlines.push(0, 0, 0, 0); // Transparent
      }
    }
  }

  const rawBuffer = Buffer.from(scanlines);
  const compressed = zlib.deflateSync(rawBuffer);

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: 6 (RGBA)
  ihdrData[10] = 0; // Compression method: 0
  ihdrData[11] = 0; // Filter method: 0
  ihdrData[12] = 0; // Interlace method: 0
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT Chunk
  const idatChunk = createChunk('IDAT', compressed);

  // IEND Chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function main() {
  const iconDir = path.join(__dirname, 'src', 'icons');
  if (!fs.existsSync(iconDir)) {
    fs.mkdirSync(iconDir, { recursive: true });
  }

  [16, 48, 128].forEach((size) => {
    const pngBuf = generateIconPNG(size);
    const target = path.join(iconDir, `icon${size}.png`);
    fs.writeFileSync(target, pngBuf);
    console.log(`Generated: ${target}`);
  });
}

main();
