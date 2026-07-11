import { LogicalPosition, LogicalSize }     from '@tauri-apps/api/dpi';
import { currentMonitor, getCurrentWindow } from '@tauri-apps/api/window';

const appWindow = getCurrentWindow();

export const BASE_WINDOW_SIZE = { width : 480, height : 740 };

const SCREEN_MARGIN = 40;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

async function getWorkArea(): Promise<{ x: number; y: number; width: number; height: number } | null> {
  const monitor = await currentMonitor();
  if (!monitor) return null;

  const position = monitor.workArea.position.toLogical(monitor.scaleFactor);
  const size     = monitor.workArea.size.toLogical(monitor.scaleFactor);
  return { x: position.x, y: position.y, width: size.width, height: size.height };
}

let generation = 0;

export async function tweenWindowSize(toWidth: number, toHeight: number, durationMs = 220): Promise<void> {
  const token = ++generation;

  const workArea = await getWorkArea();
  if (token !== generation) return;
  const clampedWidth  = workArea ? Math.min(toWidth, workArea.width - SCREEN_MARGIN) : toWidth;
  const clampedHeight = workArea ? Math.min(toHeight, workArea.height - SCREEN_MARGIN) : toHeight;

  const scaleFactor = await appWindow.scaleFactor();
  if (token !== generation) return;
  const currentSize = await appWindow.innerSize();
  if (token !== generation) return;
  const fromWidth  = currentSize.width / scaleFactor;
  const fromHeight = currentSize.height / scaleFactor;
  const start      = performance.now();

  while (true) {
    if (token !== generation) return;
    const t      = Math.min(1, (performance.now() - start) / durationMs);
    const eased  = easeOutCubic(t);
    const width  = fromWidth + (clampedWidth - fromWidth) * eased;
    const height = fromHeight + (clampedHeight - fromHeight) * eased;
    await appWindow.setSize(new LogicalSize(width, height));
    if (token !== generation) return;
    if (t >= 1) break;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  if (token !== generation) return;
  if (!workArea) return;
  const currentPos = (await appWindow.outerPosition()).toLogical(scaleFactor);
  const maxX       = workArea.x + workArea.width - clampedWidth;
  const maxY       = workArea.y + workArea.height - clampedHeight;
  const clampedX   = Math.min(Math.max(currentPos.x, workArea.x), Math.max(maxX, workArea.x));
  const clampedY   = Math.min(Math.max(currentPos.y, workArea.y), Math.max(maxY, workArea.y));
  if (clampedX !== currentPos.x || clampedY !== currentPos.y) {
    await appWindow.setPosition(new LogicalPosition(clampedX, clampedY));
  }
}
