/**
 * @module officeCustomColorEditor
 * @role Own the HSV/hex editor nested inside the Office palette popover.
 */

type Rgb = { r: number; g: number; b: number };
type Hsv = { h: number; s: number; v: number };

const HEX_COLOR = /^#[0-9a-f]{6}$/;
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const toHexPart = (value: number) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0');

function hexToRgb(hex: string): Rgb | null {
  if (!HEX_COLOR.test(hex)) return null;
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  return `#${toHexPart(r)}${toHexPart(g)}${toHexPart(b)}`;
}

function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === red) h = 60 * (((green - blue) / delta) % 6);
    else if (max === green) h = 60 * ((blue - red) / delta + 2);
    else h = 60 * ((red - green) / delta + 4);
  }
  return { h: h < 0 ? h + 360 : h, s: max === 0 ? 0 : delta / max, v: max };
}

function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const chroma = v * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const match = v - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;
  if (h < 60) [red, green, blue] = [chroma, x, 0];
  else if (h < 120) [red, green, blue] = [x, chroma, 0];
  else if (h < 180) [red, green, blue] = [0, chroma, x];
  else if (h < 240) [red, green, blue] = [0, x, chroma];
  else if (h < 300) [red, green, blue] = [x, 0, chroma];
  else [red, green, blue] = [chroma, 0, x];
  return { r: (red + match) * 255, g: (green + match) * 255, b: (blue + match) * 255 };
}

interface CustomColorEditorOptions {
  initialColor: string | null;
  enabled: boolean;
  onCommit: (hex: string, button: HTMLButtonElement) => void;
  onOpen: (input: HTMLInputElement) => void;
}

export interface CustomColorEditorElements {
  add: HTMLButtonElement;
  editor: HTMLDivElement;
}

export function createOfficeCustomColorEditor(
  options: CustomColorEditorOptions,
): CustomColorEditorElements {
  const editor = document.createElement('div');
  editor.className = 'rv-office-color-custom-editor';
  editor.dataset.open = 'false';
  let hsv = rgbToHsv(hexToRgb(options.initialColor ?? '') ?? hexToRgb('#4a86e8')!);

  const picker = document.createElement('div');
  picker.className = 'rv-office-color-picker';
  const valuePlane = document.createElement('button');
  valuePlane.type = 'button';
  valuePlane.className = 'rv-office-color-plane';
  valuePlane.setAttribute('aria-label', 'Choose custom color shade');
  const planeCursor = document.createElement('span');
  planeCursor.className = 'rv-office-color-plane-cursor';
  valuePlane.appendChild(planeCursor);

  const hueRow = document.createElement('div');
  hueRow.className = 'rv-office-color-hue-row';
  const preview = document.createElement('span');
  preview.className = 'rv-office-color-preview';
  const hueInput = document.createElement('input');
  hueInput.type = 'range';
  hueInput.className = 'rv-office-color-hue';
  hueInput.min = '0';
  hueInput.max = '360';
  hueInput.step = '1';
  hueInput.setAttribute('aria-label', 'Custom color hue');
  hueRow.append(preview, hueInput);
  picker.append(valuePlane, hueRow);

  const hexInput = document.createElement('input');
  hexInput.type = 'text';
  hexInput.className = 'rv-office-color-hex';
  hexInput.setAttribute('aria-label', 'Custom color hex');
  hexInput.spellcheck = false;
  const commit = document.createElement('button');
  commit.type = 'button';
  commit.className = 'rv-office-color-commit';
  commit.title = 'Save custom color';
  commit.innerHTML = '<span class="material-symbols-outlined">check</span>';

  const render = (hex: string) => {
    hexInput.value = hex;
    hueInput.value = String(Math.round(hsv.h));
    valuePlane.style.setProperty('--hue', `${hsv.h}`);
    preview.style.setProperty('--custom-color', hex);
    planeCursor.style.left = `${hsv.s * 100}%`;
    planeCursor.style.top = `${(1 - hsv.v) * 100}%`;
    commit.disabled = false;
  };
  const setHsv = (next: Hsv) => {
    hsv = { h: ((next.h % 360) + 360) % 360, s: clamp(next.s), v: clamp(next.v) };
    render(rgbToHex(hsvToRgb(hsv)));
  };
  const setHex = (value: string) => {
    const normalized = value.trim().toLowerCase();
    hexInput.value = normalized;
    const rgb = hexToRgb(normalized);
    if (rgb) {
      hsv = rgbToHsv(rgb);
      render(normalized);
    }
    commit.disabled = !HEX_COLOR.test(normalized);
  };
  const updatePlane = (event: PointerEvent) => {
    const rect = valuePlane.getBoundingClientRect();
    setHsv({
      h: hsv.h,
      s: (event.clientX - rect.left) / rect.width,
      v: 1 - ((event.clientY - rect.top) / rect.height),
    });
  };
  valuePlane.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    updatePlane(event);
    valuePlane.setPointerCapture(event.pointerId);
  });
  valuePlane.addEventListener('pointermove', (event) => {
    if (!valuePlane.hasPointerCapture(event.pointerId)) return;
    event.preventDefault();
    event.stopPropagation();
    updatePlane(event);
  });
  valuePlane.addEventListener('pointerup', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (valuePlane.hasPointerCapture(event.pointerId)) valuePlane.releasePointerCapture(event.pointerId);
  });
  hueInput.addEventListener('input', (event) => {
    event.stopPropagation();
    setHsv({ ...hsv, h: Number(hueInput.value) });
  });
  hexInput.addEventListener('input', (event) => {
    event.stopPropagation();
    setHex(hexInput.value);
  });
  hexInput.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key !== 'Enter' || commit.disabled) return;
    event.preventDefault();
    commit.click();
  });
  commit.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const hex = hexInput.value.trim().toLowerCase();
    if (HEX_COLOR.test(hex)) options.onCommit(hex, commit);
  });

  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'rv-office-color-add';
  add.title = 'Custom color';
  add.disabled = !options.enabled;
  add.innerHTML = '<span class="material-symbols-outlined">add_circle</span>';
  add.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    editor.dataset.open = editor.dataset.open === 'true' ? 'false' : 'true';
    const host = editor.closest('.rv-office-color-popover') as HTMLElement | null;
    if (host) host.dataset.customOpen = editor.dataset.open;
    if (editor.dataset.open === 'true') options.onOpen(hexInput);
  });

  editor.append(picker, hexInput, commit);
  render(rgbToHex(hsvToRgb(hsv)));
  return { add, editor };
}
