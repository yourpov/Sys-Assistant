# Private Assistant

Tauri desktop app for the Sys-Info Valorant workflow. Replaces the old `.bat` automation with a real UI, more methods, and a tools suite.

**v0.2.0** is the current release.

![automate page](https://i.imgur.com/WGegNcj.png)

## what it does

- **Automate**: Hamad method. Changes emu seed, runs loader, creates a session. Check for issues and close-all live on the same page.
- **Account swap**: signs into the next saved account in rotation, then runs the Hamad method.
- **Manual options**: run any single step alone. Pick which ones show up in Settings.
- **Accounts**: save Riot logins, import/export `.txt`, session snapshots, login / forget session.
- **Tools**:
  - Lookup (HenrikDev)
  - Match lobby / live match info
  - Match monitor alerts
  - Collection (owned skins, buddies, cards, sprays, titles from your Riot Client session)
  - Player compare
  - Saved players
- **Configs**: community config board (browse, post, edit, react, comment). Discord or guest sign-in.
- **Settings**: automation timings, file paths, auto-fix-55, session recovery, Account Swap pool, Henrik keys, notifications, motion, feedback, about / what's new.

## screenshots

|                                              |                                              |
| -------------------------------------------- | -------------------------------------------- |
| ![splash](https://i.imgur.com/ok9N6h7.png)   | ![accounts](https://i.imgur.com/A6tDZ7i.png) |
| ![tools](https://i.imgur.com/J0bOTFX.png)    | ![configs](https://i.imgur.com/7AqL95u.png)  |
| ![settings](https://i.imgur.com/AqZ40A4.png) |                                              |

## running it

Windows only (Win32 automation + WebView2).

Prebuilt builds: [Releases](https://github.com/yourpov/Sys-Assistant/releases) (tag `v0.2.0`).

From source:

- [Node.js](https://nodejs.org)
- [Rust](https://www.rust-lang.org/tools/install) (MSVC)
- [C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/)

```sh
npm install         # install deps
npm run tauri dev   # dev build
npm run tauri build # build exe
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
