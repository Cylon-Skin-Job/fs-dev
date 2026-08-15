'use strict';

function verifyProductionTableInkOwnership({
  data,
  oracleData,
  width,
  height,
  tableRects,
  nonTableRects,
  printable,
  tolerance = 3,
  glyphDilation = 3,
}) {
  const isInk = (bytes, pixel, threshold = 32) => {
    const offset = pixel * 4;
    return Math.max(
      255 - bytes[offset],
      255 - bytes[offset + 1],
      255 - bytes[offset + 2],
    ) > threshold;
  };
  const overlaps = (first, second) => (
    Math.min(first.right, second.right) > Math.max(first.left, second.left)
      && Math.min(first.bottom, second.bottom) > Math.max(first.top, second.top)
  );
  const makeNonTableGlyphMask = () => {
    const mask = new Uint8Array(width * height);
    for (const rect of nonTableRects) {
      const left = Math.max(0, Math.floor(rect.left));
      const top = Math.max(0, Math.floor(rect.top));
      const right = Math.min(width - 1, Math.ceil(rect.right));
      const bottom = Math.min(height - 1, Math.ceil(rect.bottom));
      for (let y = top; y <= bottom; y += 1) for (let x = left; x <= right; x += 1) {
        if (!isInk(oracleData, y * width + x)) continue;
        for (let dy = -glyphDilation; dy <= glyphDilation; dy += 1) {
          for (let dx = -glyphDilation; dx <= glyphDilation; dx += 1) {
            const maskX = x + dx;
            const maskY = y + dy;
            if (maskX < 0 || maskX >= width || maskY < 0 || maskY >= height) continue;
            mask[maskY * width + maskX] = 1;
          }
        }
      }
    }
    return mask;
  };
  for (let first = 0; first < tableRects.length; first += 1) {
    for (let second = first + 1; second < tableRects.length; second += 1) {
      if (overlaps(tableRects[first], tableRects[second])) {
        throw new Error(`independent table rectangles overlap ${tableRects[first].index}/${tableRects[second].index}`);
      }
    }
  }

  const glyphMask = makeNonTableGlyphMask();
  const bounds = tableRects.map((rect) => ({
    index: rect.index,
    pageNumber: rect.pageNumber,
    left: width,
    top: height,
    right: -1,
    bottom: -1,
  }));
  const left = Math.max(0, Math.ceil(printable.left));
  const top = Math.max(0, Math.ceil(printable.top));
  const right = Math.min(width - 1, Math.floor(printable.right));
  const bottom = Math.min(height - 1, Math.floor(printable.bottom));

  for (let y = top; y <= bottom; y += 1) for (let x = left; x <= right; x += 1) {
    const pixel = y * width + x;
    if (!isInk(data, pixel) || glyphMask[pixel]) continue;
    const owners = [];
    for (let index = 0; index < tableRects.length; index += 1) {
      const rect = tableRects[index];
      if (
        x >= rect.left - tolerance
        && x <= rect.right + tolerance
        && y >= rect.top - tolerance
        && y <= rect.bottom + tolerance
      ) owners.push(index);
    }
    if (owners.length !== 1) {
      throw new Error(`production table ink has ${owners.length} owners at ${x},${y}`);
    }
    const bound = bounds[owners[0]];
    bound.left = Math.min(bound.left, x);
    bound.top = Math.min(bound.top, y);
    bound.right = Math.max(bound.right, x);
    bound.bottom = Math.max(bound.bottom, y);
  }

  for (const bound of bounds) {
    if (bound.right < bound.left || bound.bottom < bound.top) {
      throw new Error(`production table paint missing ${bound.index}`);
    }
  }
  return bounds;
}

module.exports = { verifyProductionTableInkOwnership };
