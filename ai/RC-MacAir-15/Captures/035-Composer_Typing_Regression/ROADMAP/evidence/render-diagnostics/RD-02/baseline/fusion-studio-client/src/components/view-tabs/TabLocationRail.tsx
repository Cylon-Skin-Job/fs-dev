import type { TabLocationProjection } from './componentTabPresentationDomain';

export interface TabLocationNavigation {
  tabId: string;
  canGoBack: boolean;
  canGoForward: boolean;
  goBack: (tabId: string) => void;
  goForward: (tabId: string) => void;
}

export interface TabLocationRailProps {
  tabId: string;
  projection: TabLocationProjection;
  navigation?: TabLocationNavigation;
}

interface CanonicalNavigation {
  canGoBack: boolean;
  canGoForward: boolean;
  goBack: (tabId: string) => void;
  goForward: (tabId: string) => void;
}

function normalizeNavigation(
  value: unknown,
  expectedTabId: string,
): CanonicalNavigation | null {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    if (Object.getOwnPropertySymbols(value).length > 0) return null;
    const properties = Object.getOwnPropertyDescriptors(value);
    const required = ['tabId', 'canGoBack', 'canGoForward', 'goBack', 'goForward'] as const;
    if (Object.keys(properties).length !== required.length) return null;
    if (required.some((key) => !properties[key]?.enumerable || !('value' in properties[key]))) {
      return null;
    }
    if (properties.tabId.value !== expectedTabId
      || typeof properties.canGoBack.value !== 'boolean'
      || typeof properties.canGoForward.value !== 'boolean'
      || typeof properties.goBack.value !== 'function'
      || typeof properties.goForward.value !== 'function') {
      return null;
    }
    return {
      canGoBack: properties.canGoBack.value,
      canGoForward: properties.canGoForward.value,
      goBack: properties.goBack.value,
      goForward: properties.goForward.value,
    };
  } catch {
    return null;
  }
}

/** Renders one ordered display location and optional tab-correlated navigation intents. */
export function TabLocationRail({
  tabId,
  projection,
  navigation,
}: TabLocationRailProps) {
  const canonicalNavigation = navigation === undefined
    ? null
    : normalizeNavigation(navigation, tabId);
  const completeLabel = projection.segments.map((segment) => segment.label).join(' > ');

  if (navigation !== undefined && !canonicalNavigation && import.meta.env.MODE !== 'production') {
    console.assert(false, 'TabLocationRail received an invalid navigation capability.');
  }

  return (
    <section className="rv-component-tab-location-rail">
      {canonicalNavigation ? (
        <div className="rv-component-tab-location-controls" aria-label="Tab navigation">
          <button
            type="button"
            className="rv-component-tab-location-action"
            aria-label="Back"
            title="Back"
            disabled={!canonicalNavigation.canGoBack}
            onClick={() => {
              if (canonicalNavigation.canGoBack) canonicalNavigation.goBack(tabId);
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
          </button>
          <button
            type="button"
            className="rv-component-tab-location-action"
            aria-label="Forward"
            title="Forward"
            disabled={!canonicalNavigation.canGoForward}
            onClick={() => {
              if (canonicalNavigation.canGoForward) canonicalNavigation.goForward(tabId);
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
          </button>
        </div>
      ) : null}
      <nav
        className="rv-component-tab-breadcrumb"
        aria-label={`Location: ${completeLabel}`}
        title={completeLabel}
      >
        <ol className="rv-component-tab-breadcrumb-list">
          {projection.segments.map((segment, index) => (
            <li
              className="rv-component-tab-breadcrumb-segment"
              key={`${index}:${segment.label}`}
              title={segment.label}
            >
              <span className="rv-component-tab-breadcrumb-label">{segment.label}</span>
              {index < projection.segments.length - 1 ? (
                <span
                  className="material-symbols-outlined rv-component-tab-breadcrumb-separator"
                  aria-hidden="true"
                >
                  chevron_right
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </nav>
    </section>
  );
}
