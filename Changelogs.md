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
