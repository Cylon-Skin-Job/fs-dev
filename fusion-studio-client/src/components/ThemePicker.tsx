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

import './ThemePicker.css';
import React, { useState, useEffect, useRef } from 'react';
import { usePanelStore } from '../state/panelStore';
import { applyLivePreview, clearLivePreview } from '../lib/theme/live-preview';
import { saveTheme, activateTheme } from '../lib/theme/theme-api';
import { computeUiEmphasizedAccent } from '../../../fusion-studio-server/lib/theme/color-math.js';

// Single fixed id we overwrite on every auto-save so themes.json doesn't bloat.
const ACTIVE_USER_THEME_ID = 'user-current';
const DEFAULT_THEME_ACCENT = '#39628e';
type PickerMode = 'light' | 'custom' | 'dark';

interface Props {
  onClose: () => void;
}

export default function ThemePicker({ onClose }: Props) {
  const themes = usePanelStore(s => s.themes);
  const activeThemeId = usePanelStore(s => s.activeThemeId);

  const activeTheme = themes.find(t => t.id === activeThemeId) ?? themes.find(t => t.active);

  // Slider state — session only, not committed until Apply
  const [accent, setAccent] = useState(activeTheme?.accent ?? DEFAULT_THEME_ACCENT);
  const inferredMode: 'light' | 'dark' =
    (activeTheme?.mode === 'light' || activeTheme?.mode === 'dark')
      ? activeTheme.mode
      : (activeTheme?.luminance != null && activeTheme.luminance > 50 ? 'light' : 'dark');
  const clampLum = (v: number, m: 'light' | 'dark') =>
    m === 'dark' ? Math.min(25, Math.max(0, v)) : Math.min(100, Math.max(75, v));
  const snapLum = (v: number, m: 'light' | 'dark') =>
    m === 'dark' ? Math.max(0, v - 75) : Math.min(100, v + 75);

  const [luminance, setLuminance] = useState(clampLum(activeTheme?.luminance ?? 14, inferredMode));
  const [panelContrast] = useState(activeTheme?.panelContrast ?? 50);
  const [workspaceForeground, setWorkspaceForeground] = useState(activeTheme?.workspaceForeground ?? 0);
  const [workspaceBorders] = useState(activeTheme?.workspaceBorders ?? 75);
  const [workspaceAccent, setWorkspaceAccent] = useState(activeTheme?.workspaceAccent ?? 100);
  const [threadBackground, setThreadBackground] = useState(activeTheme?.threadBackground ?? 50);
  const [threadForegroundContrast, setThreadForegroundContrast] = useState(activeTheme?.threadForegroundContrast ?? 0);
  const [threadHeadings, setThreadHeadings] = useState(activeTheme?.threadHeadings ?? 0);
  const [threadPanelForeground, setThreadPanelForeground] = useState(activeTheme?.threadForeground ?? 0);
  const [threadAccent, setThreadAccent] = useState(activeTheme?.threadAccent ?? 100);
  const [sidePanelBackground, setSidePanelBackground] = useState(activeTheme?.sidePanelBackground ?? activeTheme?.threadBackground ?? 50);
  const [sidePanelForegroundContrast, setSidePanelForegroundContrast] = useState(activeTheme?.sidePanelForegroundContrast ?? activeTheme?.threadForegroundContrast ?? 0);
  const [sidePanelHeadings, setSidePanelHeadings] = useState(activeTheme?.sidePanelHeadings ?? activeTheme?.threadHeadings ?? 0);
  const [sidePanelForeground, setSidePanelForeground] = useState(activeTheme?.sidePanelForeground ?? activeTheme?.threadForeground ?? 0);
  const [sidePanelAccent, setSidePanelAccent] = useState(activeTheme?.sidePanelAccent ?? activeTheme?.threadAccent ?? 100);
  const [chatBackground, setChatBackground] = useState(activeTheme?.chatBackground ?? 50);
  const [chatContrast, setChatContrast] = useState(activeTheme?.chatContrast ?? 0);
  const [chatBubble, setChatBubble] = useState(activeTheme?.chatBubble ?? activeTheme?.chatContrast ?? 0);
  const [chatForeground, setChatForeground] = useState(activeTheme?.chatForeground ?? 0);
  const [chatAccent, setChatAccent] = useState(activeTheme?.chatAccent ?? 0);
  const [chatTools, setChatTools] = useState(activeTheme?.chatTools ?? activeTheme?.chatAccent ?? 0);
  const [chatText, setChatText] = useState(activeTheme?.chatText ?? 0);
  const [bgTint] = useState(activeTheme?.bgTint ?? activeTheme?.chromeTint ?? 12);
  const [contentCanvasBackground, setContentCanvasBackground] = useState(activeTheme?.contentCanvasBackground ?? 0);
  const [contentAccent, setContentAccent] = useState(activeTheme?.contentAccent ?? 100);
  const [contentForeground, setContentForeground] = useState(activeTheme?.contentForeground ?? 0);
  const [contentHeadings, setContentHeadings] = useState(activeTheme?.contentHeadings ?? 0);
  const [contentText, setContentText] = useState(activeTheme?.contentText ?? 0);
  const [mode, setMode] = useState<PickerMode>(inferredMode);
  const [borderLuminance] = useState(activeTheme?.borderLuminance ?? (activeTheme?.luminance ?? 50));
  const [borderTint] = useState(activeTheme?.borderTint ?? (activeTheme?.borders ?? 0));
  const [chromeLuminance, setChromeLuminance] = useState(activeTheme?.chromeLuminance ?? (activeTheme?.luminance ?? 6));
  const [chromeTint, setChromeTint] = useState(activeTheme?.chromeTint ?? 18);
  const [accentLuminance, setAccentLuminance] = useState(activeTheme?.accentLuminance ?? 50);
  const [accentTint, setAccentTint] = useState(activeTheme?.accentTint ?? 0);
  const [chatBorder] = useState(activeTheme?.tints?.borders?.chat ?? false);
  const [themeCode] = useState(activeTheme?.themeCode ?? false);

  const [hexInput, setHexInput] = useState(activeTheme?.accent ?? DEFAULT_THEME_ACCENT);
  const [themeColorInput, setThemeColorInput] = useState(activeTheme?.themeColor ?? activeTheme?.accent ?? DEFAULT_THEME_ACCENT);
  const [borderColorInput, setBorderColorInput] = useState(activeTheme?.borderColor ?? activeTheme?.themeColor ?? activeTheme?.accent ?? DEFAULT_THEME_ACCENT);
  const [bordersEnabled, setBordersEnabled] = useState(activeTheme?.bordersEnabled ?? true);
  const persistedMode: 'light' | 'dark' = mode === 'custom'
    ? (luminance > 50 ? 'light' : 'dark')
    : mode;
  // Auto-save: 250ms debounce after the last slider/accent change.
  const initialMountRef = useRef(true);
  const pendingRef = useRef<{
    accent: string; themeColor: string; borderColor: string; bordersEnabled: boolean; luminance: number; panelContrast: number; workspaceForeground: number; workspaceBorders: number; workspaceAccent: number; threadBackground: number; threadForegroundContrast: number; threadHeadings: number; threadForeground: number; threadAccent: number; sidePanelBackground: number; sidePanelForegroundContrast: number; sidePanelHeadings: number; sidePanelForeground: number; sidePanelAccent: number; chatBackground: number; chatContrast: number; chatBubble: number; chatForeground: number; chatAccent: number; chatTools: number; chatText: number;
    bgTint: number; contentCanvasBackground: number; contentAccent: number; contentForeground: number; contentHeadings: number; contentText: number; borderLuminance: number; borderTint: number; chromeLuminance: number; chromeTint: number; accentLuminance: number; accentTint: number; chatBorder: boolean; themeCode: boolean; mode: 'light' | 'dark';
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
      accent: p.accent, themeColor: p.themeColor, borderColor: p.borderColor, bordersEnabled: p.bordersEnabled, luminance: p.luminance, panelContrast: p.panelContrast, workspaceForeground: p.workspaceForeground, workspaceBorders: p.workspaceBorders, workspaceAccent: p.workspaceAccent, threadBackground: p.threadBackground, threadForegroundContrast: p.threadForegroundContrast, threadHeadings: p.threadHeadings, threadForeground: p.threadForeground, threadAccent: p.threadAccent, sidePanelBackground: p.sidePanelBackground, sidePanelForegroundContrast: p.sidePanelForegroundContrast, sidePanelHeadings: p.sidePanelHeadings, sidePanelForeground: p.sidePanelForeground, sidePanelAccent: p.sidePanelAccent, chatBackground: p.chatBackground, chatContrast: p.chatContrast, chatBubble: p.chatBubble, chatForeground: p.chatForeground, chatAccent: p.chatAccent, chatTools: p.chatTools, chatText: p.chatText,
      bgTint: p.bgTint, contentCanvasBackground: p.contentCanvasBackground, contentAccent: p.contentAccent, contentForeground: p.contentForeground, contentHeadings: p.contentHeadings, contentText: p.contentText, borderLuminance: p.borderLuminance, borderTint: p.borderTint, chromeLuminance: p.chromeLuminance, chromeTint: p.chromeTint, accentLuminance: p.accentLuminance, accentTint: p.accentTint, themeCode: p.themeCode, mode: p.mode,
      tints: { borders: { chat: p.chatBorder } },
      builtin: false, active: false,
    });
    activateTheme(ACTIVE_USER_THEME_ID);
  }

  // Live preview — write derivations to document root on every slider/accent change.
  useEffect(() => {
    applyLivePreview(accent, luminance, panelContrast, workspaceForeground, workspaceBorders, workspaceAccent, threadBackground, threadForegroundContrast, threadHeadings, threadPanelForeground, threadAccent, sidePanelBackground, sidePanelForegroundContrast, sidePanelHeadings, sidePanelForeground, sidePanelAccent, chatBackground, chatContrast, chatBubble, chatForeground, chatAccent, chatTools, chatText, bgTint, contentCanvasBackground, contentAccent, contentForeground, contentHeadings, contentText, borderLuminance, borderTint, chromeLuminance, chromeTint, accentLuminance, accentTint, chatBorder, themeCode, themeColorInput, borderColorInput, bordersEnabled);
  }, [accent, luminance, panelContrast, workspaceForeground, workspaceBorders, workspaceAccent, threadBackground, threadForegroundContrast, threadHeadings, threadPanelForeground, threadAccent, sidePanelBackground, sidePanelForegroundContrast, sidePanelHeadings, sidePanelForeground, sidePanelAccent, chatBackground, chatContrast, chatBubble, chatForeground, chatAccent, chatTools, chatText, bgTint, contentCanvasBackground, contentAccent, contentForeground, contentHeadings, contentText, borderLuminance, borderTint, chromeLuminance, chromeTint, accentLuminance, accentTint, chatBorder, themeCode, themeColorInput, borderColorInput, bordersEnabled, mode]);

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

  function handleThemeColorInput(raw: string) {
    setThemeColorInput(raw);
  }

  function deriveThemeColor() {
    setThemeColorInput(computeUiEmphasizedAccent({ accent, luminance }));
  }

  function setBordersFromThemeColor() {
    setBorderColorInput(/^#[0-9a-fA-F]{6}$/.test(themeColorInput) ? themeColorInput : accent);
  }

  function toggleBorders() {
    if (!bordersEnabled) setBordersFromThemeColor();
    setBordersEnabled(!bordersEnabled);
  }

  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }
    pendingRef.current = { accent, themeColor: themeColorInput, borderColor: borderColorInput, bordersEnabled, luminance, panelContrast, workspaceForeground, workspaceBorders, workspaceAccent, threadBackground, threadForegroundContrast, threadHeadings, threadForeground: threadPanelForeground, threadAccent, sidePanelBackground, sidePanelForegroundContrast, sidePanelHeadings, sidePanelForeground, sidePanelAccent, chatBackground, chatContrast, chatBubble, chatForeground, chatAccent, chatTools, chatText, bgTint, contentCanvasBackground, contentAccent, contentForeground, contentHeadings, contentText, borderLuminance, borderTint, chromeLuminance, chromeTint, accentLuminance, accentTint, chatBorder, themeCode, mode: persistedMode };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flushPending, 250);
  }, [accent, themeColorInput, borderColorInput, bordersEnabled, luminance, panelContrast, workspaceForeground, workspaceBorders, workspaceAccent, threadBackground, threadForegroundContrast, threadHeadings, threadPanelForeground, threadAccent, sidePanelBackground, sidePanelForegroundContrast, sidePanelHeadings, sidePanelForeground, sidePanelAccent, chatBackground, chatContrast, chatBubble, chatForeground, chatAccent, chatTools, chatText, bgTint, contentCanvasBackground, contentAccent, contentForeground, contentHeadings, contentText, borderLuminance, borderTint, chromeLuminance, chromeTint, accentLuminance, accentTint, chatBorder, themeCode, persistedMode, mode]);

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
            }}
          >
            Light Mode
          </button>
          <button
            type="button"
            className={`rv-tp-mode-btn${mode === 'custom' ? ' rv-tp-mode-btn--active' : ''}`}
            onClick={() => setMode('custom')}
          >
            Custom Mode
          </button>
          <button
            type="button"
            className={`rv-tp-mode-btn${mode === 'dark' ? ' rv-tp-mode-btn--active' : ''}`}
            onClick={() => {
              if (mode === 'dark') return;
              setMode('dark');
              setLuminance(snapLum(luminance, 'dark'));
            }}
          >
            Dark Mode
          </button>
        </div>
      </section>

      {/* ── Color input ── */}
      <section className="rv-tp-section">
        <div className="rv-tp-color-row">
          <span className="rv-tp-color-label">Background</span>
          <div className="rv-tp-color-field">
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
        </div>
        <div className="rv-tp-color-row" data-theme-color-stub>
          <span className="rv-tp-color-label">Theme Color</span>
          <div className="rv-tp-color-actions">
            <button
              type="button"
              className="rv-tp-wand-btn"
              onClick={deriveThemeColor}
              aria-label="Derive theme color"
              title="Derive theme color"
            >
              <span className="material-symbols-outlined">wand_shine</span>
            </button>
            <div className="rv-tp-color-field">
              <input
                type="text"
                className="rv-tp-hex-input"
                value={themeColorInput}
                onChange={e => handleThemeColorInput(e.target.value)}
                aria-label="Theme Color"
                placeholder="#RRGGBB"
                spellCheck={false}
              />
              <input
                type="color"
                className="rv-tp-color-native"
                value={/^#[0-9a-fA-F]{6}$/.test(themeColorInput) ? themeColorInput : '#808080'}
                onChange={e => handleThemeColorInput(e.target.value)}
                aria-label="Pick theme color"
                title="Pick theme color"
              />
            </div>
          </div>
        </div>
        <div className="rv-tp-color-row rv-tp-border-color-row">
          <span className="rv-tp-color-label">Borders</span>
          <div className="rv-tp-color-actions">
            <button
              type="button"
              className="rv-tp-wand-btn"
              onClick={setBordersFromThemeColor}
              aria-label="Use theme color for borders"
              title="Use theme color for borders"
            >
              <span className="material-symbols-outlined">wand_shine</span>
            </button>
            <div className="rv-tp-color-field">
              <input
                type="text"
                className="rv-tp-hex-input"
                value={borderColorInput}
                onChange={e => setBorderColorInput(e.target.value)}
                aria-label="Border color"
                placeholder="#RRGGBB"
                spellCheck={false}
              />
              <input
                type="color"
                className="rv-tp-color-native"
                value={/^#[0-9a-fA-F]{6}$/.test(borderColorInput) ? borderColorInput : '#808080'}
                onChange={e => setBorderColorInput(e.target.value)}
                aria-label="Pick border color"
                title="Pick border color"
              />
            </div>
            <button
              type="button"
              className="rv-tp-border-switch"
              aria-pressed={bordersEnabled}
              aria-label="Toggle borders"
              onClick={toggleBorders}
              title={bordersEnabled ? 'Disable borders' : 'Enable borders'}
            >
              <span className="material-symbols-outlined">
                {bordersEnabled ? 'toggle_on' : 'toggle_off'}
              </span>
            </button>
          </div>
        </div>
        <div className="rv-tp-divider" />
        <div className="rv-tp-group-header">Workspace Settings</div>
        <InlineSliderRow
          label="Accent"
          value={workspaceAccent}
          min={0}
          max={100}
          onChange={setWorkspaceAccent}
        />
        <InlineSliderRow
          label="Foreground"
          value={workspaceForeground}
          min={0}
          max={100}
          onChange={setWorkspaceForeground}
        />
        <div className="rv-tp-divider" />
        <div className="rv-tp-group-header">Thread Settings</div>
        <InlineSliderRow
          label="Background"
          value={threadBackground}
          min={0}
          max={100}
          onChange={setThreadBackground}
        />
        <InlineSliderRow
          label="Accent"
          value={threadAccent}
          min={0}
          max={100}
          onChange={setThreadAccent}
        />
        <InlineSliderRow
          label="Foreground"
          value={threadPanelForeground}
          min={0}
          max={100}
          onChange={setThreadPanelForeground}
        />
        <InlineSliderRow
          label="Headings"
          value={threadHeadings}
          min={0}
          max={100}
          onChange={setThreadHeadings}
        />
        <InlineSliderRow
          label="Text"
          value={threadForegroundContrast}
          min={0}
          max={100}
          onChange={setThreadForegroundContrast}
        />
        <div className="rv-tp-divider" />
        <div className="rv-tp-group-header">Navigation Settings</div>
        <InlineSliderRow
          label="Background"
          value={sidePanelBackground}
          min={0}
          max={100}
          onChange={setSidePanelBackground}
        />
        <InlineSliderRow
          label="Accent"
          value={sidePanelAccent}
          min={0}
          max={100}
          onChange={setSidePanelAccent}
        />
        <InlineSliderRow
          label="Foreground"
          value={sidePanelForeground}
          min={0}
          max={100}
          onChange={setSidePanelForeground}
        />
        <InlineSliderRow
          label="Headings"
          value={sidePanelHeadings}
          min={0}
          max={100}
          onChange={setSidePanelHeadings}
        />
        <InlineSliderRow
          label="Text"
          value={sidePanelForegroundContrast}
          min={0}
          max={100}
          onChange={setSidePanelForegroundContrast}
        />
        <div className="rv-tp-divider" />
        <div className="rv-tp-group-header">Chat Settings</div>
        <InlineSliderRow
          label="Background"
          value={chatBackground}
          min={0}
          max={100}
          onChange={setChatBackground}
        />
        <InlineSliderRow
          label="Input"
          value={chatContrast}
          min={0}
          max={100}
          onChange={setChatContrast}
        />
        <InlineSliderRow
          label="Bubble"
          value={chatBubble}
          min={0}
          max={100}
          onChange={setChatBubble}
        />
        <InlineSliderRow
          label="Foreground"
          value={chatForeground}
          min={0}
          max={100}
          onChange={setChatForeground}
        />
        <InlineSliderRow
          label="Headings"
          value={chatAccent}
          min={0}
          max={100}
          onChange={setChatAccent}
        />
        <InlineSliderRow
          label="Tools"
          value={chatTools}
          min={0}
          max={100}
          onChange={setChatTools}
        />
        <InlineSliderRow
          label="Text"
          value={chatText}
          min={0}
          max={100}
          onChange={setChatText}
        />
      </section>

      {/* ── Sliders ── */}
      <section className="rv-tp-section rv-tp-sliders">
        <div className="rv-tp-group-header">Content Settings</div>
        <InlineSliderRow
          label="Background"
          value={contentCanvasBackground}
          min={0}
          max={100}
          onChange={setContentCanvasBackground}
        />
        <InlineSliderRow
          label="Accent"
          value={contentAccent}
          min={0}
          max={100}
          onChange={setContentAccent}
        />
        <InlineSliderRow
          label="Foreground"
          value={contentForeground}
          min={0}
          max={100}
          onChange={setContentForeground}
        />
        <InlineSliderRow
          label="Headings"
          value={contentHeadings}
          min={0}
          max={100}
          onChange={setContentHeadings}
        />
        <InlineSliderRow
          label="Text"
          value={contentText}
          min={0}
          max={100}
          onChange={setContentText}
        />
        <div className="rv-tp-divider" />
        <div className="rv-tp-group-header">Accent settings</div>
        <SliderRow label="Luminance" value={chromeLuminance} min={0} max={100} onChange={setChromeLuminance} />
        <SliderRow label="Tint" value={chromeTint} min={0} max={100} onChange={setChromeTint} />
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

function InlineSliderRow({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="rv-tp-inline-slider-row">
      <span className="rv-tp-color-label">{label}</span>
      <input
        type="range"
        className="rv-tp-slider rv-tp-inline-slider"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
      />
    </label>
  );
}
