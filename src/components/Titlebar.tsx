import { getCurrentWindow } from '@tauri-apps/api/window';

import type { Page } from '../types';
import { HamburgerMenu } from './HamburgerMenu';

const appWindow = getCurrentWindow();

interface Props {
  page: Page;
  onSelectPage: (page: Page) => void;
  navDisabled?: boolean;
}

export function Titlebar({ page, onSelectPage, navDisabled }: Props) {
  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar-left" data-tauri-drag-region>
        <HamburgerMenu page={page} onSelectPage={onSelectPage} disabled={navDisabled} />
        <span className="titlebar-title" data-tauri-drag-region>
          Private Assistant
        </span>
      </div>
      <div className="titlebar-controls">
        <button onClick={() => appWindow.minimize()} aria-label="Minimize">
          &minus;
        </button>
        <button onClick={() => appWindow.close()} aria-label="Close">
          &times;
        </button>
      </div>
    </div>
  );
}
