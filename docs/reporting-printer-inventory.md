# Printer inventory — Phase 0.4

Risk R6: the ESC/P (dot matrix) and ESC/POS (thermal) command sets differ by
model family in ways no datasheet settles, and the differences only surface
against the customer's actual hardware. This list **cannot be guessed**. It is
an external dependency the reporting feature depends on, and collecting it is a
site task, not a development one.

The good news: acting on the answers is cheap. Every raw renderer reads its
command bytes from a **printer profile** row (`reports.printer_profile`), and a
profile is *sparse* — it only states the bytes that differ from the built-in
Epson defaults. So onboarding a customer's specific model is a seed row or an
API create, never a code change. Stock profiles are already seeded
(`src/database/seed/seeds/printer-profiles.seed.ts`); most sites will match one
as-is.

## Questionnaire — per printer at the site

1. **Type:** dot matrix / thermal / laser-inkjet (laser needs no profile).
2. **Make and exact model.** e.g. "TVS MSP 250 Star", "Epson TM-T82",
   "Epson LX-310". The model number matters — a series can span emulations.
3. **For dot matrix:**
   - Carriage width: **80 column** or **132 column**?
   - Default pitch: 10 / 12 / 15 CPI (usually 10).
   - Stationery: continuous fanfold or cut sheet? Form length (inches)?
   - Emulation setting in the printer's own menu: **Epson (ESC/P)** or **IBM**?
     If IBM, note it — the profile's command bytes differ.
4. **For thermal:**
   - Paper width: **58 mm** or **80 mm**?
   - Does it have an **auto-cutter**?
   - Character columns at font A (usually 32 for 58 mm, 48 for 80 mm).
5. **Connection:** local USB / parallel (LPT) / network (IP) / shared Windows
   queue? For a Windows RAW spool, the exact **share/queue name**.
6. **Language on the invoice:** English only, or Tamil?
   - **Tamil on dot matrix is not possible in text mode** — a character ROM has
     no Tamil glyphs, and graphics mode is the slowness the whole path avoids.
     A Tamil-language dealer prints on PDF/laser, or keeps the dot-matrix
     template in English/transliterated. Confirm the expectation in writing.

## Turning an answer into a profile

Match the site's printer to a stock profile first:

| Site answer | Stock profile code |
|---|---|
| 80-col Epson-compatible dot matrix | `EPSON-LX-80` |
| 132-col dot matrix | `EPSON-LQ-132` |
| TVS MSP series, 80 col | `TVS-MSP-240` |
| 80 mm thermal, cutter | `ESCPOS-80MM` |
| 80 mm thermal, no cutter | `ESCPOS-80MM-NOCUT` |
| 58 mm thermal | `ESCPOS-58MM` |

If the printer diverges (a byte sequence prints wrong), create a **company**
profile with the same output mode and only the differing commands in
`pp_commands` (hex, keyed by capability name — see the renderer's
`DEFAULT_COMMANDS` for the key names). A company profile of the same code wins
over the stock one, so no rename is needed.

Then set the print request's `printerProfile` to the profile code, or make it
the company default for its output mode.

## Verifying a profile on site

```
# Thermal / dot matrix produce raw bytes. Print them straight to the device:
curl -s "https://HOST/api/v1/reports/SALE_INVOICE/<docId>/print?mode=ESCPOS&paper=T80&accYear=2026-2027&printerProfile=ESCPOS-80MM" \
  -H "Authorization: Bearer <token>" --output receipt.bin

# Windows RAW spool:  copy /b receipt.bin \\localhost\<QueueName>
# Linux/CUPS raw:     lp -o raw -d <QueueName> receipt.bin
# Direct USB (Linux): cat receipt.bin > /dev/usb/lp0
```

If the receipt cuts in the wrong place, the wrong characters print, or bold
leaks down the page, that is a profile byte to adjust — captured in
`pp_commands`, not in the renderer.
