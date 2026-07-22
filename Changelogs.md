# v0.5.0

July 20, 2026

## Added

- uninstall vanguard: fully removes riot's anti-cheat from settings > general > vanguard stops and deletes the vgc and vgk services (and their registry keys) and deletes the riot vanguard folder, with an optional restart-then-reinstall prompt afterward
- check for traces: a button to check whether any vanguard services or files are still on your pc after uninstalling
- tracex version: choose between the terminal tracex and the beta TUI build (tracex.tui.exe) in settings > automation
- auto-run loader on valorant: optional setting to run the loader whenever VALORANT starts, even if you launched it yourself instead of through start process
- guides: a link to the sys-info setup guides in settings > about

## Changed

- config editor: number values now support every decimal (0.1-0.9) and can be typed in
- accounts: usernames are hidden by default and category groups start collapsed
- opening apps: opening tracex, the loader, or the emu installer now closes if already running

## Fixed

- manual steps: "Open TraceX" now stays toggled and shows on the automate page (it was not being saved)
- account login: swapping accounts is more reliable now

# v0.4.0

July 20, 2026

## Changed

- start process: previously named "Hamad Method". runs the emu installer, then ldr.exe, then valorant
- loader: looks for ldr.exe or of ldr.novgk.exe
- file locations: added TraceX
- group accounts: switch the accounts list between grouping by category, access (FA/NFA), or region
- bulk edit: select accounts and change their notes, category, region, or access all in one go
- search notes: the accounts search now also matches text in notes, so typing "fresh" finds every account noted as fresh- check for issues: warns if core isolation, the vulnerable driver blocklist, or local security authority protection is on, and requires vgc to be running and vgk to be off

## Removed

- sesh.exe: create session, session path, session delay, session recovery, and anti-temp ban are gone
- temp-open valorant: the optional open-and-close step before starting is gone

# v0.3.0

July 12, 2026

## Added

- account categories: group accounts into collapsible sections, drag to reorder them, and rename them anytime
- account regions: tag an account's region (NA, EU, AP, KR, BR, LATAM, or random) so you don't need to write it in notes
- full access status: see whether an account is FA or not on the accounts list

## Changed

- accounts page: session status was moved above the login button

## Fixed

- emu installer: sometimes got stuck if `Auto-fix 55% loader error` was enabled

# v0.2.0

July 10, 2026

## Added

- configs page: browse community configs, share your own, and leave likes or comments
- accounts import/export: back up your saved logins to a text file, or load them from one
- notifications: a bell in the titlebar shows what the app has told you
- confirm before actions: turn on a safety prompt before deletes, resets, and other hard to undo steps
- session recovery: optional setting that restarts your session if it dies (testing)
- mid-match recovery: optional setting that re-runs the hamad method if your session drops during a match (testing)
- 55% loader fix: moved to settings
- tooltips: short hints when you hover buttons and options
- feedback: send suggestions or bug reports from settings
- dev logs: view logs from settings if something goes wrong
- session labels: see whether an account still has a saved riot session for swapping or not
- collection: see the skins, buddies, cards, sprays, and titles on an account
- saved players: bookmark players you look up so you can find them again
- game version: see which valorant version you have installed vs the latest release
- player compare: put two players side by side and compare their stats
- action status: the automate page shows ready, running, or preparing
- hamad method: one button again, choose in settings configure what it does
- hide usernames: hide account usernames on the accounts page when sharing your screen or taking screenshots
- mute sounds: turn off all alert sounds in automation settings
- accent color: pick your own accent color instead of the default purple
- account notes: write down a note on any saved account
- install emu on riot launch: optionally auto run the emu installer everytime riot client opens

## Changed

- new look: across automate, accounts, tools, settings, and configs
- accounts page: easier to use with lots of accounts, search, and has more room to scroll
- what's new: changelogs moved to settings instead of their own page
- change seed: keeps your console log instead of clearing it
- settings: split into sections (general, automation, tools, about) that stay open or closed how you left them
- console: can now be collapsed
- performance mode: turns down extra visual effects for low end pcs causing lag

## Fixed

- emu installer: no longer opens a externally and installs in the app console

# v0.1.0

June 25, 2026

## Added

- automate page: starts valorant, changes the emu seed, runs loader, and creates a session for you
- manual options: runs any step on its own (open valorant, change seed, run loader, create a session, etc), pick which ones to show in settings
- account swap: signs into a different saved account before automating the process
- check for issues: finds common problems (riot client not running, stay signed in off, core isolation off, missing files) and can auto fix most of them
- accounts page: save and manage riot logins
- tools page: look up a riot id and see rank, stats, and recent matches and view live match info
- settings page: for customizing hamad method timings, setting file locations, always on top, and a key simulator if you need it (for opening menu in-game)
- changelogs: pulls from github so this can get updated without shipping a new build every time
