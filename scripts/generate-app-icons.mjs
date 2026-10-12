import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';

const sourcePath = new URL('../2143d5c4-e731-4407-808a-e726f7953a61.png', import.meta.url);
const source = await readFile(sourcePath);
const sourceUrl = `data:image/png;base64,${source.toString('base64')}`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();

async function renderIcon(size, maskable = false) {
  const base64 = await page.evaluate(async ({ sourceUrl, size, maskable }) => {
    const image = await new Promise((resolve, reject) => {
      const item = new Image();
      item.onload = () => resolve(item);
      item.onerror = reject;
      item.src = sourceUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    // Remove the even white border while retaining every part of the supplied logo.
    const crop = { x: 82, y: 81, size: 1090 };
    if (maskable) {
      context.fillStyle = '#4f46e5';
      context.fillRect(0, 0, size, size);
      const inset = Math.round(size * 0.1);
      const side = size - inset * 2;
      const radius = side * 0.23;
      context.save();
      context.beginPath();
      context.roundRect(inset, inset, side, side, radius);
      context.clip();
      context.drawImage(image, crop.x, crop.y, crop.size, crop.size, inset, inset, side, side);
      context.restore();
    } else {
      context.drawImage(image, crop.x, crop.y, crop.size, crop.size, 0, 0, size, size);
    }
    return canvas.toDataURL('image/png').split(',')[1];
  }, { sourceUrl, size, maskable });
  return Buffer.from(base64, 'base64');
}

const icon192 = await renderIcon(192);
const icon512 = await renderIcon(512);
const appleTouchIcon = await renderIcon(180);
const favicon32 = await renderIcon(32);
const maskable512 = await renderIcon(512, true);

await Promise.all([
  writeFile(new URL('../assets/icon-192.png', import.meta.url), icon192),
  writeFile(new URL('../assets/icon-512.png', import.meta.url), icon512),
  writeFile(new URL('../assets/apple-touch-icon.png', import.meta.url), appleTouchIcon),
  writeFile(new URL('../assets/favicon-32.png', import.meta.url), favicon32),
  writeFile(new URL('../assets/icon-512-maskable.png', import.meta.url), maskable512),
]);

// ICO files may contain PNG payloads; this preserves the sharp 32x32 rendering.
const icoHeader = Buffer.alloc(22);
icoHeader.writeUInt16LE(0, 0);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(1, 4);
icoHeader.writeUInt8(32, 6);
icoHeader.writeUInt8(32, 7);
icoHeader.writeUInt8(0, 8);
icoHeader.writeUInt8(0, 9);
icoHeader.writeUInt16LE(1, 10);
icoHeader.writeUInt16LE(32, 12);
icoHeader.writeUInt32LE(favicon32.length, 14);
icoHeader.writeUInt32LE(22, 18);
await writeFile(new URL('../assets/favicon.ico', import.meta.url), Buffer.concat([icoHeader, favicon32]));

await browser.close();
console.log('Generated Duo Vocab app icons from the supplied 1254x1254 PNG.');
