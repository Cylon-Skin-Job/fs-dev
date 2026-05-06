/**
 * @module color-math
 * @role Pure colour-math utilities for deterministic syntax palette generation.
 *
 * No I/O, no DOM, no side effects. Used by both server (themes-service)
 * and client (ThemePicker live preview).
 */

const { oklch, formatHex } = require('culori');

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h, s, l) {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function mixHex(a, b, ratio) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const cl = v => Math.max(0, Math.min(255, Math.round(v)));
  const r = cl(r1 * (1 - ratio) + r2 * ratio);
  const g = cl(g1 * (1 - ratio) + g2 * ratio);
  const bb = cl(b1 * (1 - ratio) + b2 * ratio);
  return '#' + [r, g, bb].map(v => v.toString(16).padStart(2, '0')).join('');
}

function luminanceToHex(luminance) {
  const ch = Math.round((clamp(luminance) / 100) * 255);
  const h = ch.toString(16).padStart(2, '0');
  return `#${h}${h}${h}`;
}

const CONTENT_LUMINANCE_CATALOG = {
  dark:  { min: 0,  max: 25 },
  light: { min: 55, max: 100 },
};

const CONTENT_SURFACE_CATALOG = {
  dark:  { surfaceOffset: 5, codeOffset: 8 },
  light: { surfaceOffset: 5, codeOffset: 0 },
};

/**
 * Compute the actual hex values for content surfaces.
 * Mirrors the CSS that content-css.js emits, but returns hex
 * so syntax palette generation can reason about real backgrounds.
 *
 * Content surfaces are driven by contentLuminance/panelContrast/contentTint
 * so the content luminance slider controls the document background while
 * panelContrast controls the surface spread (separated from contentContrast
 * which only affects syntax token distances).
 */
function computeContentSurfaces(entry) {
  const accent = entry.accent;
  const contentTint = entry.contentTint ?? entry.bgTint ?? entry.chromeTint ?? 12;
  const contentLum = entry.contentLuminance ?? entry.luminance ?? 6;
  const panelContrast = entry.panelContrast ?? 50;

  const contentIsLight = contentLum > 50;
  const contentDir = contentIsLight ? -1 : 1;
  const factor = panelContrast / 50;

  const modeKey = contentIsLight ? 'light' : 'dark';
  const { surfaceOffset, codeOffset } = CONTENT_SURFACE_CATALOG[modeKey];

  const contentSurfaceL = clamp(contentLum + contentDir * surfaceOffset * factor);
  const contentCodeL = clamp(contentLum + contentDir * codeOffset * factor);

  const documentSurfaceBg = mixHex(
    luminanceToHex(contentSurfaceL),
    accent,
    contentTint / 100,
  );
  const documentBg = (contentLum >= 100 && contentTint <= 0)
    ? '#ffffff'
    : mixHex(
        luminanceToHex(contentCodeL),
        accent,
        contentTint / 100,
      );

  return { documentSurfaceBg, documentBg };
}

/**
 * Compute a deterministic 8-bucket syntax-highlighting palette from the
 * theme accent, content-luminance and content-contrast sliders.
 *
 * All math happens in OKLCH space for perceptual uniformity:
 *   - Same L value = same brightness regardless of hue
 *   - Hue rotation doesn't accidentally darken/lighten tokens
 *   - Gamut-mapped back to srgb hex for CSS output
 *
 * If codeBgHex is provided, tokens are constrained to maintain
 * perceptible contrast against the actual document code background.
 *
 * Semantic families (fixed hue, nudged away from the accent):
 *   keyword  ~210°  blue        function  ~120°  green
 *   number   ~340°  red/rose    string    ~35°   orange/amber
 *   class    ~180°  cyan/teal   section   ~260°  purple
 *   comment  —      grey        base      —      near-black / near-white
 *
 * contentLuminance sets the base lightness of all tokens (overall brightness).
 * contentContrast controls how far individual token types deviate from that
 * base, creating visible differentiation between keywords, strings, comments, etc.
 *
 * Visibility offsets (positive = more prominent, negative = more subdued):
 *   keyword  +0.60   section   +0.50   number   +0.40
 *   function +0.30   class     +0.20   base      0.00
 *   string   +0.10   comment   +0.00
 */
function computeSyntaxPalette(accent, contentLuminance, contentContrast, codeBgHex, contentTint, themeCode) {
  const accentOklch = oklch(accent);
  const accentHue = accentOklch.h ?? 0;
  // Remap the slider so the bottom 20% (which produced visually unusable
  // low-contrast palettes) is dropped and the usable 20–100 range spreads
  // across the full slider. Slider 0 → effective 0.20, slider 100 → 1.00.
  // Wiki/--content-emphasized still uses the raw slider (separate derivation).
  const rawNorm = clamp(contentContrast, 0, 100) / 100;
  const conNorm = 0.20 + 0.80 * rawNorm;

  // Anchor to the real background lightness (or fall back to contentLuminance)
  let bgL;
  if (codeBgHex) {
    bgL = oklch(codeBgHex).l;
  } else {
    const lumNorm = clamp(contentLuminance, 0, 100) / 100;
    bgL = contentLuminance > 50
      ? 0.45 - 0.20 * lumNorm
      : 0.55 + 0.20 * lumNorm;
  }

  const isLight = bgL > 0.5;
  const dir = isLight ? -1 : 1;

  // Distance from bg: contrast controls how far the token palette sits
  // from the background. At 0 = barely visible, at 100 = sharp separation.
  const minDist = isLight ? 0.15 : 0.10;
  const maxDist = isLight ? 0.42 : 0.35;
  const dist = minDist + (maxDist - minDist) * conNorm;
  const baseL = clamp(bgL + dir * dist, 0.05, 0.95);

  // Spread adds differentiation between token types on top of the base distance
  const maxSpread = isLight ? 0.15 : 0.20;
  const spread = maxSpread * conNorm;

  // Chroma: base floor + tint boost + contrast boost
  const tintNorm = clamp(contentTint ?? 12, 0, 100) / 100;
  const baseChroma = 0.08;
  const tintBoost = 0.08 * tintNorm;
  const contrastBoost = 0.06 * conNorm;
  let tokenChroma = baseChroma + tintBoost + contrastBoost;

  // Luminance attenuation: srgb gamut limits chroma at extreme lightness
  const distFromMid = Math.abs(bgL - 0.5) * 2;
  tokenChroma *= (1.0 - distFromMid * 0.25);

  // Per-token contrast enforcement: push individual tokens away from bg if needed
  function ensureContrast(tokenL) {
    if (isLight) {
      return Math.min(tokenL, bgL - minDist * 0.5);
    }
    return Math.max(tokenL, bgL + minDist * 0.5);
  }

  function pushAway(hue) {
    if (hue === 0) return 0;
    let delta = Math.abs(accentHue - hue);
    if (delta > 180) delta = 360 - delta;
    if (delta < 40) hue = (hue + 60) % 360;
    return hue;
  }

  const visibilityOffsets = {
    keyword:  0.60,
    section:  0.50,
    number:   0.40,
    function: 0.30,
    class:    0.20,
    string:   0.10,
    comment:  0.00,
  };

  // Two ref tables:
  //   - Default rainbow: hardcoded reference hues from a typical syntax theme,
  //     then `pushAway` rotates them clear of the active accent.
  //   - themeCode = true: hues spread around the wheel relative to the
  //     accent's hue, so the whole palette feels derived from the system
  //     theme color (analogous + complementary + triadic offsets). pushAway
  //     is skipped here since the offsets are already chosen relative to it.
  const refs = themeCode
    ? {
        keyword:  (accentHue + 180) % 360,  // complement
        function: (accentHue +  60) % 360,  // analogous
        number:   (accentHue + 240) % 360,  // -120 (triadic)
        string:   (accentHue +  30) % 360,  // analogous-near
        class:    (accentHue + 210) % 360,  // -150 (split-complement)
        section:  (accentHue + 120) % 360,  // triadic
        comment:  0,                         // chroma 0 — hue ignored
        base:     0,                         // chroma 0 — hue ignored
      }
    : {
        keyword: 210,
        function: 120,
        number: 340,
        string: 35,
        class: 180,
        section: 260,
        comment: 0,
        base: 0,
      };

  const palette = {};
  for (const [name, refHue] of Object.entries(refs)) {
    if (name === 'base') {
      const l = isLight ? 0.12 : 0.90;
      palette.base = formatHex({ mode: 'oklch', l: ensureContrast(l), c: 0, h: 0 });
    } else if (name === 'comment') {
      const commentL = clamp(baseL + dir * spread * visibilityOffsets.comment, 0.05, 0.95);
      palette.comment = formatHex({ mode: 'oklch', l: ensureContrast(commentL), c: 0, h: 0 });
    } else {
      const offset = visibilityOffsets[name] ?? 0;
      const rawL = clamp(baseL + dir * spread * offset, 0.05, 0.95);
      const tokenL = ensureContrast(rawL);
      // pushAway is only needed for the rainbow refs (which may collide with
      // an arbitrary accent). Accent-derived refs are already placed clear.
      const finalHue = themeCode ? refHue : pushAway(refHue);
      palette[name] = formatHex({ mode: 'oklch', l: tokenL, c: tokenChroma, h: finalHue });
    }
  }
  return palette;
}

/**
 * Content-emphasized derivation — sister to computeSyntaxPalette's `comment`
 * tier, but with a larger contrast distance so the result reads as foreground
 * (headings, active labels, border emphasis) rather than muted gray.
 *
 * Behavior:
 *   - Anchors to the actual document-bg luminance (same surface the consumer
 *     sits on).
 *   - In dark mode walks lighter, in light mode walks darker — so a dark
 *     purple bg yields a lighter purple, a light purple yields a darker one.
 *   - Distance is driven by Content Contrast: at slider = 50 the result lands
 *     mid-range (default emphasis), below 50 it relaxes toward the bg, above
 *     50 it pushes further away.
 *   - Chroma carries the accent hue and is boosted by Content Tint, so the
 *     result stays "in the spectrum" of the active accent.
 */
function computeContentEmphasized({ accent, luminance, contentContrast, contentTint, documentBg }) {
  const accentH = oklch(accent).h ?? 0;
  const bgL = oklch(documentBg).l;
  const isLight = (luminance ?? 6) > 50;
  const dir = isLight ? -1 : 1;
  const conNorm = clamp(contentContrast ?? 50, 0, 100) / 100;
  const minDist = 0.40;
  const maxDist = 0.70;
  const dist = minDist + (maxDist - minDist) * conNorm;
  const emphL = Math.min(0.95, Math.max(0.05, bgL + dir * dist));
  const tintNorm = clamp(contentTint ?? 12, 0, 100) / 100;
  const chroma = 0.08 + 0.10 * tintNorm;
  return formatHex({ mode: 'oklch', l: emphL, c: chroma, h: accentH });
}

/**
 * Content-link derivation — third tier of the content paradigm. Sits closer
 * to body-text brightness than headings (so links flow inline) but with
 * higher chroma so they're recognizable as interactive without needing
 * structural emphasis (size/weight) like headings have. Same hue as the
 * active accent, so a purple theme yields a saturated purple link.
 *
 * Distance is driven by Content Contrast (same slider as headings); chroma
 * picks up Content Tint. Gamut-attenuated at extreme luminance.
 */
function computeContentLink({ accent, luminance, contentContrast, contentTint, documentBg }) {
  const accentH = oklch(accent).h ?? 0;
  const bgL = oklch(documentBg).l;
  const isLight = (luminance ?? 6) > 50;
  const dir = isLight ? -1 : 1;
  const conNorm = clamp(contentContrast ?? 50, 0, 100) / 100;
  // Larger walk than --content-emphasized so links sit nearer body-text
  // brightness, in the text flow rather than competing with headings.
  const minDist = 0.55;
  const maxDist = 0.85;
  const dist = minDist + (maxDist - minDist) * conNorm;
  const linkL = Math.min(0.95, Math.max(0.05, bgL + dir * dist));
  // Strong chroma so the link reads as interactive at body brightness.
  const tintNorm = clamp(contentTint ?? 12, 0, 100) / 100;
  let chroma = 0.18 + 0.06 * tintNorm;
  // Gamut attenuation: chroma can't sustain at extreme luminance.
  const distFromMid = Math.abs(linkL - 0.5) * 2;
  chroma *= (1.0 - distFromMid * 0.20);
  return formatHex({ mode: 'oklch', l: linkL, c: chroma, h: accentH });
}

/**
 * Content-border derivation — opposite-direction sister to
 * computeContentEmphasized. In dark mode walks slightly darker than the
 * document bg; in light mode walks slightly lighter. Result: in-content
 * borders read as recessed/embedded rather than prominent (the heading and
 * link tiers cover prominence).
 *
 * Chroma is zero so borders stay neutral. Distance is small and fixed —
 * borders should be subtle by default.
 */
function computeContentBorder({ luminance, documentBg }) {
  const bgL = oklch(documentBg).l;
  const isLight = (luminance ?? 6) > 50;
  // Inverted direction vs --content-emphasized: light mode walks lighter,
  // dark mode walks darker — so the border deepens away from bg into the
  // mode's dominant pole.
  const dir = isLight ? 1 : -1;
  const dist = 0.035;
  const borderL = Math.min(0.98, Math.max(0.02, bgL + dir * dist));
  return formatHex({ mode: 'oklch', l: borderL, c: 0, h: 0 });
}

module.exports = {
  hexToHsl,
  hslToHex,
  clamp,
  hexToRgb,
  mixHex,
  luminanceToHex,
  computeContentSurfaces,
  computeSyntaxPalette,
  computeContentEmphasized,
  computeContentLink,
  computeContentBorder,
  CONTENT_LUMINANCE_CATALOG,
  CONTENT_SURFACE_CATALOG,
};
