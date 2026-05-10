/**
 * ThemePicker — 320px popover for switching, creating, and deleting themes.
 *
 * Structure (top → bottom):
 *   1. Preset chips grid (all themes.json entries)
 *   2. 6 custom slots (localStorage)
 *   3. Color picker native input + hex field + bookmark button
 *   4. Sliders: luminance, chrome tint, border accent, card highlights
 *   5. Footer: [Save as new]  [Apply]
 *
 * See THEME_PICKER_SPEC.md §3b.
 */

import React, { useState, useEffect, useRef } from 'react';
import { usePanelStore } from '../state/panelStore';
import { applyLivePreview, clearLivePreview } from '../lib/theme/live-preview';
import { saveTheme, activateTheme } from '../lib/theme/theme-api';
import { CONTENT_LUMINANCE_CATALOG } from '../../../fusion-studio-server/lib/theme/color-math.js';

// Single fixed id we overwrite on every auto-save so themes.json doesn't bloat.
const ACTIVE_USER_THEME_ID = 'user-current';

interface Props {
  onClose: () => void;
}

export default function ThemePicker({ onClose }: Props) {
  const themes = usePanelStore(s => s.themes);
  const activeThemeId = usePanelStore(s => s.activeThemeId);

  const activeTheme = themes.find(t => t.id === activeThemeId) ?? themes.find(t => t.active);

  // Slider state — session only, not committed until Apply
  const [accent, setAccent] = useState(activeTheme?.accent ?? '#00d4ff');
  const inferredMode: 'light' | 'dark' =
    (activeTheme?.mode === 'light' || activeTheme?.mode === 'dark')
      ? activeTheme.mode
      : (activeTheme?.luminance != null && activeTheme.luminance > 50 ? 'light' : 'dark');
  const clampLum = (v: number, m: 'light' | 'dark') =>
    m === 'dark' ? Math.min(25, Math.max(0, v)) : Math.min(100, Math.max(75, v));
  const snapLum = (v: number, m: 'light' | 'dark') =>
    m === 'dark' ? Math.max(0, v - 75) : Math.min(100, v + 75);
  const snapContentLum = (v: number, m: 'light' | 'dark') => {
    const dark = CONTENT_LUMINANCE_CATALOG.dark;
    const light = CONTENT_LUMINANCE_CATALOG.light;
    if (m === 'dark') {
      const ratio = (v - light.min) / (light.max - light.min);
      return Math.round(dark.min + ratio * (dark.max - dark.min));
    }
    const ratio = (v - dark.min) / (dark.max - dark.min);
    return Math.round(light.min + ratio * (light.max - light.min));
  };

  const [luminance, setLuminance] = useState(clampLum(activeTheme?.luminance ?? 14, inferredMode));
  const [panelContrast, setPanelContrast] = useState(activeTheme?.panelContrast ?? 50);
  const [bgTint, setBgTint] = useState(activeTheme?.bgTint ?? activeTheme?.chromeTint ?? 12);
  const [contentLuminance, setContentLuminance] = useState(() => {
    const raw = activeTheme?.contentLuminance ?? activeTheme?.luminance ?? 14;
    const range = CONTENT_LUMINANCE_CATALOG[inferredMode];
    return Math.min(range.max, Math.max(range.min, raw));
  });
  const [contentContrast, setContentContrast] = useState(activeTheme?.contentContrast ?? activeTheme?.panelContrast ?? 50);
  const [mode, setMode] = useState<'light' | 'dark'>(inferredMode);
  const [contentTint, setContentTint] = useState(activeTheme?.contentTint ?? activeTheme?.bgTint ?? activeTheme?.chromeTint ?? 12);
  const [borderLuminance, setBorderLuminance] = useState(activeTheme?.borderLuminance ?? (activeTheme?.luminance ?? 50));
  const [borderTint, setBorderTint] = useState(activeTheme?.borderTint ?? (activeTheme?.borders ?? 0));
  const [chromeLuminance, setChromeLuminance] = useState(activeTheme?.chromeLuminance ?? (activeTheme?.luminance ?? 6));
  const [chromeTint, setChromeTint] = useState(activeTheme?.chromeTint ?? 18);
  const [chatBubbleChrome, setChatBubbleChrome] = useState(activeTheme?.chatBubbleChrome ?? false);
  const [accentLuminance, setAccentLuminance] = useState(activeTheme?.accentLuminance ?? 50);
  const [accentTint, setAccentTint] = useState(activeTheme?.accentTint ?? 0);
  const [chatBorder, setChatBorder] = useState(activeTheme?.tints?.borders?.chat ?? false);
  const [themeCode, setThemeCode] = useState(activeTheme?.themeCode ?? false);

  const [hexInput, setHexInput] = useState(activeTheme?.accent ?? '#00d4ff');

  // Live preview — write derivations to document root on every slider/accent change.
  useEffect(() => {
    applyLivePreview(accent, luminance, panelContrast, bgTint, contentLuminance, contentContrast, contentTint, borderLuminance, borderTint, chromeLuminance, chromeTint, chatBubbleChrome, accentLuminance, accentTint, chatBorder, themeCode);
  }, [accent, luminance, panelContrast, bgTint, contentLuminance, contentContrast, contentTint, borderLuminance, borderTint, chromeLuminance, chromeTint, chatBubbleChrome, accentLuminance, accentTint, chatBorder, themeCode, mode]);

  // On unmount: flush any pending debounced save FIRST, then clear inline
  // live-preview overrides so themes.css can take over cleanly.
  useEffect(() => {
    return () => {
      flushPending();
      clearLivePreview();
    };
     
  }, []);

  function handleHexChange(raw: string) {
    setHexInput(raw);
    if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
      setAccent(raw);
    }
  }

  function handleColorInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setAccent(v);
    setHexInput(v);
  }

  // Auto-save: 250ms debounce after the last slider/accent change.
  const initialMountRef = useRef(true);
  const pendingRef = useRef<{
    accent: string; luminance: number; panelContrast: number;
    bgTint: number; contentLuminance: number; contentContrast: number; contentTint: number; borderLuminance: number; borderTint: number; chromeLuminance: number; chromeTint: number; chatBubbleChrome: boolean; accentLuminance: number; accentTint: number; chatBorder: boolean; themeCode: boolean; mode: 'light' | 'dark';
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flushPending() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    saveTheme({
      id: ACTIVE_USER_THEME_ID,
      label: 'Current',
      accent: p.accent, luminance: p.luminance, panelContrast: p.panelContrast,
      bgTint: p.bgTint, contentLuminance: p.contentLuminance, contentContrast: p.contentContrast, contentTint: p.contentTint, borderLuminance: p.borderLuminance, borderTint: p.borderTint, chromeLuminance: p.chromeLuminance, chromeTint: p.chromeTint, chatBubbleChrome: p.chatBubbleChrome, accentLuminance: p.accentLuminance, accentTint: p.accentTint, themeCode: p.themeCode, mode: p.mode,
      tints: { borders: { chat: p.chatBorder } },
      builtin: false, active: false,
    });
    activateTheme(ACTIVE_USER_THEME_ID);
  }

  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }
    pendingRef.current = { accent, luminance, panelContrast, bgTint, contentLuminance, contentContrast, contentTint, borderLuminance, borderTint, chromeLuminance, chromeTint, chatBubbleChrome, accentLuminance, accentTint, chatBorder, themeCode, mode };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flushPending, 250);
  }, [accent, luminance, panelContrast, bgTint, contentLuminance, contentContrast, contentTint, borderLuminance, borderTint, chromeLuminance, chromeTint, chatBubbleChrome, accentLuminance, accentTint, chatBorder, themeCode, mode]);

  void onClose;

  return (
    <div className="rv-theme-picker">
      {/* ── Mode toggle ── */}
      <section className="rv-tp-section">
        <div className="rv-tp-mode-row">
          <button
            type="button"
            className={`rv-tp-mode-btn${mode === 'light' ? ' rv-tp-mode-btn--active' : ''}`}
            onClick={() => {
              if (mode === 'light') return;
              setMode('light');
              setLuminance(snapLum(luminance, 'light'));
              setContentLuminance(snapContentLum(contentLuminance, 'light'));
            }}
          >
            Light Mode
          </button>
          <button
            type="button"
            className={`rv-tp-mode-btn${mode === 'dark' ? ' rv-tp-mode-btn--active' : ''}`}
            onClick={() => {
              if (mode === 'dark') return;
              setMode('dark');
              setLuminance(snapLum(luminance, 'dark'));
              setContentLuminance(snapContentLum(contentLuminance, 'dark'));
            }}
          >
            Dark Mode
          </button>
        </div>
      </section>

      {/* ── Color input ── */}
      <section className="rv-tp-section">
        <div className="rv-tp-color-row">
          <input
            type="text"
            className="rv-tp-hex-input"
            value={hexInput}
            onChange={e => handleHexChange(e.target.value)}
            placeholder="#RRGGBB"
            spellCheck={false}
          />
          <input
            type="color"
            className="rv-tp-color-native"
            value={accent}
            onChange={handleColorInput}
            title="Pick color"
          />
        </div>
      </section>

      {/* ── Sliders ── */}
      <section className="rv-tp-section rv-tp-sliders">
        <div className="rv-tp-group-header">Panel settings</div>
        <SliderRow label="Background Contrast" value={panelContrast} min={0} max={100} onChange={setPanelContrast} />
        <SliderRow label="Luminance" value={luminance} min={mode === 'dark' ? 0 : 75} max={mode === 'dark' ? 25 : 100} onChange={setLuminance} />
        <SliderRow label="Tint" value={bgTint} min={0} max={30} onChange={setBgTint} />
        <div className="rv-tp-divider" />
        <div className="rv-tp-group-header">Content settings</div>
        <SliderRow label="Content Contrast" value={contentContrast} min={0} max={100} onChange={setContentContrast} />
        <SliderRow label="Luminance" value={contentLuminance} min={CONTENT_LUMINANCE_CATALOG[mode].min} max={CONTENT_LUMINANCE_CATALOG[mode].max} onChange={setContentLuminance} />
        <SliderRow label="Tint" value={contentTint} min={0} max={30} onChange={setContentTint} />
        <ToggleIconRow
          label="Theme code"
          checked={themeCode}
          onChange={setThemeCode}
        />
        <div className="rv-tp-divider" />
        <div className="rv-tp-group-header">Border settings</div>
        <SliderRow label="Luminance" value={borderLuminance} min={0} max={100} onChange={setBorderLuminance} />
        <SliderRow label="Tint" value={borderTint} min={0} max={100} onChange={setBorderTint} />
        <ToggleIconRow
          label="Chat border"
          checked={chatBorder}
          onChange={setChatBorder}
        />
        <div className="rv-tp-divider" />
        <div className="rv-tp-group-header">Accent settings</div>
        <SliderRow label="Luminance" value={chromeLuminance} min={0} max={100} onChange={setChromeLuminance} />
        <SliderRow label="Tint" value={chromeTint} min={0} max={100} onChange={setChromeTint} />
        <ToggleIconRow
          label="Chat bubble"
          checked={chatBubbleChrome}
          onChange={setChatBubbleChrome}
        />
        <div className="rv-tp-divider" />
        <div className="rv-tp-group-header">Chrome settings</div>
        <SliderRow label="Luminance" value={accentLuminance} min={0} max={100} onChange={setAccentLuminance} />
        <SliderRow label="Tint" value={accentTint} min={0} max={100} onChange={setAccentTint} />
      </section>
    </div>
  );
}

function SliderRow({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="rv-tp-slider-row">
      <input
        type="range"
        className="rv-tp-slider"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
      />
      <span className="rv-tp-slider-label">{label}</span>
    </div>
  );
}

function ToggleIconRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className="rv-tp-toggle-row"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      title={checked ? 'Disable chat border' : 'Enable chat border'}
    >
      <span className="material-symbols-outlined rv-tp-toggle-icon">
        {checked ? 'toggle_on' : 'toggle_off'}
      </span>
      <span className="rv-tp-toggle-label">{label}</span>
    </button>
  );
}
