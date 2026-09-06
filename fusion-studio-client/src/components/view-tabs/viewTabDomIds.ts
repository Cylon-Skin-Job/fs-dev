function stableDomPart(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function viewTabDomId(panelId: string, tabId: string): string {
  return `rv-view-tab-${stableDomPart(panelId)}-${stableDomPart(tabId)}`;
}

export function viewTabPanelDomId(panelId: string): string {
  return `rv-view-tabpanel-${stableDomPart(panelId)}`;
}

export function viewTabSingleIdentityDomId(panelId: string, tabId: string): string {
  return `rv-view-tab-single-${stableDomPart(panelId)}-${stableDomPart(tabId)}`;
}
