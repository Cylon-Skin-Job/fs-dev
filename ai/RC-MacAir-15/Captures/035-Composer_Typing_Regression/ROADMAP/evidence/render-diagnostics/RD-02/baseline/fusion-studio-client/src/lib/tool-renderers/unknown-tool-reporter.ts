import { showToast } from '../toast';

const reportedUnknownTypes = new Set<string>();

export function reportUnknownToolType(type: string): void {
  if (reportedUnknownTypes.has(type)) return;
  reportedUnknownTypes.add(type);
  console.error('[ToolRenderer] Unknown tool segment type:', type);
  showToast(`Unknown tool renderer: ${type}`);
}
