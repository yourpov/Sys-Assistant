# Private Assistant

A Tauri desktop app version of an automated `.bat` script. Same core workflow, with more methods and features.

![automate page](https://i.imgur.com/0OuBqrd.png)

## what it does

- **Automate**: starts Valorant, changes the emu seed, runs loader, and creates a session (the "hamad method"). Faster and "55% fix" variants are available for edge cases.
- **Account swap**: signs into a different saved account before automating the process.
- **Check for issues**: finds common problems (Riot Client not running, stay signed in off, core isolation off, missing files) and can auto-fix most of them.
- **Manual options**: run any single step on its own; choose which actions appear in Settings.
- **Accounts**: save and manage Riot logins, import/export `.txt`, session snapshots.
- **Tools**: account lookup, live match info, match monitor alerts, owned collection browser, side-by-side player comparison, saved players.
- **Configs**: browse, publish, edit, and react to community configs (Discord or guest sign-in).
- **Settings**: automation timings, file locations, HenrikDev API keys, notifications, transparency, feedback, and changelogs (About tab).

## screenshots

|                                                |                                              |
| ---------------------------------------------- | -------------------------------------------- |
| ![loading](https://i.imgur.com/rMP93FW.png)    | ![accounts](https://i.imgur.com/brAWngo.png) |
| ![tools](https://i.imgur.com/ANrzIKx.png)      | ![configs](https://i.imgur.com/FszhZi9.png)  |
| ![settings](https://i.imgur.com/lXshPHF.png)   |                                              |

## running it

Built with [Tauri](https://tauri.app/) (Windows only; relies on Windows-specific APIs).

Prebuilt binaries are under [Releases](../../releases).

From source you need:

- [Node.js](https://nodejs.org)
- [Rust](https://www.rust-lang.org/tools/install) (MSVC toolchain)
- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/)

```sh
npm install
npm run tauri dev      # dev build
npm run tauri build    # release build
```

The exe must sit in a folder that already has `loader` and `tracex` in it (or subfolders). The app scans by filename.

## api keys

Account lookups, live match info, and the match monitor need free [HenrikDev](https://api.henrikdev.xyz/dashboard/) API keys in Settings, Tools. Add more than one to spread rate limits.

Collection needs the Riot Client open and signed in (not Valorant itself).

## development

```sh
npx tsc --noEmit
cd src-tauri && cargo test && cargo clippy --all-targets
```

CI runs TypeScript check, frontend build, `cargo test`, and `cargo clippy` on pushes to `main`.