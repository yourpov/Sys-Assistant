export const AUTOMATION_METHODS_SCROLL_THRESHOLD = 4;
export const AUTOMATION_METHODS_SEARCH_THRESHOLD = 8;
export const AUTOMATION_METHODS_DENSE_THRESHOLD  = 16;

export const AUTOMATION_METHODS_VISIBLE_ROWS   = 2;
export const AUTOMATION_METHOD_SCROLL_ROW_PX = 40;
export const AUTOMATION_METHOD_SCROLL_GAP_PX   = 8;

export const MANUAL_GRID_GAP_PX             = 8;
export const MANUAL_ROW_HEIGHT_PX           = 44;
export const MANUAL_EXPANDABLE_INNER_PAD_PX = 10;

export const AUTOMATE_ISLAND_BAND_PX   = 60;
export const AUTOMATE_ISLAND_MARGIN_PX = 8;
export const AUTOMATE_ISLAND_OVERHEAD_PX = AUTOMATE_ISLAND_BAND_PX + AUTOMATE_ISLAND_MARGIN_PX;

export const AUTOMATE_CONSOLE_COLLAPSED_PX = 38;
export const AUTOMATE_CONSOLE_MIN_PX       = 160;
export const AUTOMATE_CONSOLE_MAX_PX       = 280;

export type AutomateExpandableId = 'manual-options';

export interface AutomateLayoutReport {
                consoleCollapsed?: boolean;
  manualOptions ?                : {
    open       : boolean;
    actionCount: number;
  };
}

function manualGridHeight(actionCount: number): number {
  const rows = Math.ceil(actionCount / 2);
  if (rows === 0) return 0;
  return rows * MANUAL_ROW_HEIGHT_PX + (rows - 1) * MANUAL_GRID_GAP_PX;
}

export function manualOptionsExtraHeight(actionCount: number): number {
  if (actionCount <= 1) return 0;
  return manualGridHeight(actionCount) + MANUAL_EXPANDABLE_INNER_PAD_PX;
}

export function consoleReclaimedHeightPx(): number {
  return AUTOMATE_CONSOLE_MAX_PX - AUTOMATE_CONSOLE_COLLAPSED_PX;
}

export function automateWindowExtraHeight(report: AutomateLayoutReport): number {
  const manual = report.manualOptions;
  if (!manual?.open || manual.actionCount <= 1) return 0;

  const manualExtra = manualOptionsExtraHeight(manual.actionCount);
  if (report.consoleCollapsed) {
    return Math.max(0, manualExtra - consoleReclaimedHeightPx());
  }
  return manualExtra;
}