# Calendar task app

## Tab bar position is FINAL

The bottom tab bar's position was approved by Cole on 2026-10-08. Do not change it unless Cole explicitly asks.

- It is controlled only by `--tab-bar-bottom` in `styles.css` (used by `#tabs { bottom: ... }`): `max(8px, calc(env(safe-area-inset-bottom, 0px) - 10px))`, i.e. 24pt above the screen edge on Face ID iPhones.
- Do not add other offsets, margins or padding to `#tabs`, and do not "fix" its height by adjusting that value.
- The bar is anchored to the bottom of `#app`. On the iOS home-screen app, `fitScreen()` in `app.js` makes the document as tall as the screen so that edge is the real screen edge. Leave `html.tall-screen` alone too. `fitScreen()` may only be changed to make that detection more reliable (it was hardened on 2026-10-08 after the bar jumped ~50pt high on a phone); it must never move the bar's final position.
- Scrollable content keeps `120px` of bottom padding on `#view` so nothing hides behind the bar.

## Shared calendar (sync)

- The app shares one calendar between two phones. `index.html` has `<meta name="calendar-sync">`, which turns sync on; without it (the claude.ai artifact copy) the app just uses local storage.
- Everything is protected by a household code (`APP_CODE` env var on Vercel). Each phone types it once; it is kept in localStorage under `calendar-task-app:code`.
- Data lives in one private Vercel Blob file (`calendar-data.json`), read and written only by `api/sync.js`. `merge.js` is shared by the app and the server: newest `u` timestamp wins per item, and deletes are kept in `_del`.
- Anything that adds or edits an item must set `u: Date.now()`; anything that deletes must add `_del[id] = Date.now()` and then call `save()`.
- The code screen has a "Continue as guest" link: a guest copy that uses its own localStorage key (`calendar-task-app:guest-v1`), never syncs, and lasts only while the app stays open (flag in sessionStorage).
- This Vercel project deploys to production automatically on every push to the working branch, so only push work that is safe to be live.
