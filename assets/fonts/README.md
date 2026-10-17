# Bundled report fonts

These faces are committed rather than read from the operating system, because a
report must render identically on a developer laptop, the VPS and a `pkg`
binary — and none of those can be relied on to have Noto Tamil installed. A
missing face at render time is a blank invoice, discovered by a customer.

| File | Role |
|---|---|
| `NotoSans-Regular.ttf` / `-Bold` / `-Italic` / `-BoldItalic` | Latin text, the default family |
| `NotoSansTamil-Regular.ttf` / `-Bold` | Tamil text |
| `NotoSansMono-Regular.ttf` / `-Bold` | Monospace, for character-grid previews and code-like columns |

Licence: SIL Open Font License 1.1 (Google Noto). Redistribution inside a
commercial application is permitted; the OFL text must travel with the fonts.

## Why both a Latin and a Tamil face

The Phase 0.2 spike (`scripts/reporting/tamil-font-spike.js`) established two
things:

1. PDFKit/fontkit shapes Tamil correctly — conjuncts, pulli stacking and
   left-reordering vowel signs all come out right. No Chromium renderer needed.
2. `NotoSansTamil` has **no Latin coverage**. Drawing `Sugar சர்க்கரை 1kg` with
   the Tamil face alone silently replaces every Latin glyph with `.notdef`
   boxes.

So the renderer never draws a string with one font. It splits the string into
script runs and picks a face per run — see `engine/fonts/font.registry.ts`.

Re-run the spike after any font change:

```
node scripts/reporting/tamil-font-spike.js
```
