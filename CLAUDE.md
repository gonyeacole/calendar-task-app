# Calendar task app

## Tab bar position is FINAL

The bottom tab bar's position was approved by Cole on 2026-10-08. Do not change it unless Cole explicitly asks.

- It is controlled only by `--tab-bar-bottom` in `styles.css` (used by `#tabs { bottom: ... }`): `max(8px, calc(env(safe-area-inset-bottom, 0px) - 10px))`, i.e. 24pt above the screen edge on Face ID iPhones.
- Do not add other offsets, margins or padding to `#tabs`, and do not "fix" its height by adjusting that value.
- The bar is anchored to the bottom of `#app`. On the iOS home-screen app, `fitScreen()` in `app.js` makes the document as tall as the screen so that edge is the real screen edge. Leave `fitScreen()` and the `html.tall-screen` rules alone too.
- Scrollable content keeps `120px` of bottom padding on `#view` so nothing hides behind the bar.
