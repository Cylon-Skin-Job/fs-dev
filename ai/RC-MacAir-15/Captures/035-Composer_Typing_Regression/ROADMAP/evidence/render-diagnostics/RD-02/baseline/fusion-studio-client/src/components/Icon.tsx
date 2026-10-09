/**
 * @module Icon
 * @role Render a Material Symbol as either an inline SVG (customizable) or
 * a font glyph (fallback). Works with the icon-registry cache.
 *
 * Usage:
 *   <Icon name="home" className="rv-icon-xl" />
 *
 * If the SVG is cached in icon-registry, renders inline <svg>.
 * Otherwise renders <span className="material-symbols-outlined"> so
 * the icon is visible immediately while the SVG loads in the background.
 */

import { useEffect, useState } from 'react';
import { getCachedIcon, loadIcon } from '../lib/icon-registry';

interface IconProps {
  name: string;
  className?: string;
  style?: React.CSSProperties;
  filled?: boolean;
  /** Only used for customizable icons; panels/UI stay outlined */
  symbolStyle?: 'outlined' | 'rounded' | 'sharp';
}

export function Icon({ name, className = '', style, filled = false, symbolStyle = 'outlined' }: IconProps) {
  const iconKey = `${symbolStyle}:${name}:${filled ? 'filled' : 'outlined'}`;
  const [iconState, setIconState] = useState(() => ({
    key: iconKey,
    svg: getCachedIcon(name, symbolStyle, filled),
  }));

  let svg = iconState.svg;
  if (iconState.key !== iconKey) {
    svg = getCachedIcon(name, symbolStyle, filled);
    setIconState({ key: iconKey, svg });
  }

  useEffect(() => {
    if (getCachedIcon(name, symbolStyle, filled)) return;

    let mounted = true;
    loadIcon(name, symbolStyle, filled).then((loaded) => {
      if (mounted && loaded) setIconState({ key: iconKey, svg: loaded });
    });
    return () => { mounted = false; };
  }, [name, symbolStyle, filled, iconKey]);

  if (svg) {
    return (
      <span
        className={className}
        style={{
          ...style,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }

  // Fallback: render as font glyph (instant, no layout shift)
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{
        ...style,
        fontVariationSettings: filled ? "'FILL' 1" : undefined,
      }}
    >
      {name}
    </span>
  );
}
