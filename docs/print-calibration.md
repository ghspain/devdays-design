# Print calibration gate

DevDays badge PDFs are **proofs**, not print-ready output, until a physical printer workflow has been checked. The repository fixture is synthetic and contains no attendee data.

## Procedure

1. Download `devdays-print-calibration-a4.pdf` from the attendee import dialog.
2. In the operating-system and printer dialogs choose **100% / Actual size**. Do **not** choose **Fit to page**, **Shrink oversized pages**, or any automatic scaling.
3. Print both pages, selecting the duplex mode intended for the badge profile (long-edge or short-edge).
4. Measure the `100 mm ruler reference` and the `80 × 120 mm` trim rectangle with a physical ruler. Check the `5 mm` safe-area rectangle.
5. Compare the numbered `FRONT 1–4` and `BACK 1–4` markers. A mirrored or shifted back identifies an incorrect duplex flip mode or printer registration error.

The conservative starting tolerance is **±1 mm** for each measured length and for front/back registration. If a check is outside tolerance, disable every scaling option, verify the selected long-/short-edge mode, adjust the selected printer/profile settings, and repeat the fixture. Record the printer, driver, scale, duplex mode, measurements and date alongside the profile before describing it as print-ready.

Automated PDF checks verify page size, page count and fixture geometry only. They cannot verify ink, paper feed, margins or duplex registration. The manual physical-printer check is therefore the production gate. Until that evidence is documented, generated badge sheets remain labelled **proof / calibration pending**.
