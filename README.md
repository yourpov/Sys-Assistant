# Private Assistant

a tauri app version of an automated `.bat` script i made awhile back. same idea, just with more methods and features.

![automate page](https://i.imgur.com/0OuBqrd.png)

## what it does

- **automate page**: starts valorant, changes the emu seed, runs loader, and creates a session for you (the "hamad method"). there's a faster variant that skips the temp-open step, and a "55% fix" variant for accounts where the regular method throws the 55% error
- **account swap**: signs into a different saved account before automating the process
- **check for issues**: finds common problems (riot client not running, stay signed in off, core isolation off, missing files) and can auto fix most of them
- **manual options**: runs any single step on its own (open valorant, change seed, run loader, create a session, etc), pick which ones show up in settings
- **accounts page**: save and manage riot logins
- **tools page**: look up a riot id for rank/stats/recent matches, or pull up live match info (names, ranks, agents, attacker/defender side) for your current pregame or game. click any player to see their full lookup
- **settings page**: hamad method timings, file locations, always on top, a key simulator, and your own henrikdev api keys for the lookups above
- **changelogs page**: pulls from github so this can get updated without shipping a new build every time

## screenshots

|                                                |                                              |
| ---------------------------------------------- | -------------------------------------------- |
| ![loading](https://i.imgur.com/rMP93FW.png)    | ![accounts](https://i.imgur.com/brAWngo.png) |
| ![tools](https://i.imgur.com/ANrzIKx.png)      | ![configs](https://i.imgur.com/FszhZi9.png)  |
| ![changelogs](https://i.imgur.com/NC7sHXb.png) | ![settings](https://i.imgur.com/lXshPHF.png) |

## running it

this is built with [Tauri](https://tauri.app/), a framework i been working with alot recently. take a look if you want to know more about how it works.


there's a built binary under [Releases](../../releases) if you just want to run the app directly

to run it from source you'll need these (windows only, it relies on Windows-specific APIs):

- [Node.js](https://nodejs.org) (npm comes with it)
- [Rust](https://www.rust-lang.org/tools/install) via rustup, MSVC toolchain
- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/), "Desktop development with C++" is needed to compile the Rust side on Windows
- [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/), already installed on newer Windows 10/11 machines

```sh
npm install
npm run tauri dev      # dev build
npm run tauri build    # release build
```

the exe (dev or built) needs to sit in a folder that already has `loader` and `tracex` in it. it scans its own folder and subfolders by filename to find them.

## api keys

account lookups and live match info need a free [HenrikDev](https://api.henrikdev.xyz/dashboard/) api key, pasted into settings. add more than one and it'll spread requests across them so you don't get rate limited as easily.
