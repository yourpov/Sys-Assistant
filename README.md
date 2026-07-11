# Private Assistant

Tauri desktop app for the Sys-Info Valorant workflow. Replaces the old `.bat` automation with a real UI, more methods, and a tools suite.

**v0.2.0** is the current release.

![automate page](https://i.imgur.com/0OuBqrd.png)

## what it does

- **Automate**: Hamad method (and faster / 55% fix variants). Starts Riot/Valorant flow pieces, refreshes emu seed, runs loader, creates a session. Optional auto-fix-55 and session recovery watchdogs.
- **Account swap**: picks a saved account, signs in through Riot Client, then runs the automate path.
- **Check for issues**: Riot not running, stay signed in off, core isolation, missing files. Auto-fix for most of those.
- **Manual options**: run any single step alone. Toggle which ones show up in Settings.
- **Accounts**: save Riot logins, import/export `.txt`, session snapshots, login / forget session.
- **Tools**:
  - Lookup (HenrikDev)
  - Match lobby / live match info
  - Match monitor alerts
  - Collection (owned skins, buddies, cards, sprays, titles from your Riot Client session)
  - Player compare
  - Saved players
- **Configs**: community config board (browse, post, edit, react, comment). Discord or guest sign-in.
- **Settings**: timings, file paths, Henrik keys, notifications, motion, feedback, about / what's new.

## screenshots

|                                                |                                              |
| ---------------------------------------------- | -------------------------------------------- |
| ![loading](https://i.imgur.com/rMP93FW.png)    | ![accounts](https://i.imgur.com/brAWngo.png) |
| ![tools](https://i.imgur.com/ANrzIKx.png)      | ![configs](https://i.imgur.com/FszhZi9.png)  |
| ![settings](https://i.imgur.com/lXshPHF.png)   |                                              |

## running it

Windows only (Win32 automation + WebView2).

Prebuilt builds: [Releases](https://github.com/yourpov/Sys-Assistant/releases) (tag `v0.2.0`).

From source:

- [Node.js](https://nodejs.org)
- [Rust](https://www.rust-lang.org/tools/install) (MSVC)
- [C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/)

```sh
npm install
npm run tauri dev
npm run tauri build
```

Put the exe next to your `loader` / `tracex` bits (or under subfolders). The app finds them by filename.

## api keys and sessions

- **HenrikDev** keys go in Settings → Tools. Lookups, match info, and the monitor need at least one free key. Add more if you hit rate limits.
- **Collection** needs Riot Client open and signed in. Valorant itself can stay closed.

## development

```sh
npx tsc --noEmit
cd src-tauri && cargo test && cargo clippy --all-targets
```

CI on `main`: TypeScript check, frontend build, `cargo test`, `cargo clippy`.

## license

GPL-3.0. See [LICENSE](./LICENSE).
