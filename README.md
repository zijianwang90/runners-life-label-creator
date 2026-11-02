# Runners Life Label Creator

Offline desktop application for editing and printing Runners Life shoe-wall labels on Windows and macOS. The approved label is **220 × 23 mm** by default (the size can be adjusted, see below) and supports New Balance, Saucony, ASICS, and Brooks.

## Included workflow

- Browse one compact shoe list showing brand logos, model names and prices. Expand one shoe at a time to edit its brand and prices or its selling points, summary and specs. Add, duplicate, reorder, search, filter, and delete shoe models; every edit is immediately persisted locally.
- Edit brand, model, regular price, optional sale price, and zero to three optional selling points.
- **Who it's for** (optional): one line, up to 60 characters, printed in red right under the model name so a shopper sees in a second which runner the shoe suits, e.g. `FOR RUNNERS CHASING A FASTER TEMPO`. Labels without it look exactly as before.
- **Specs row** (optional): heel and forefoot stack height, weight and plate (carbon / nylon / TPU / Pebax). Filled-in specs print as a smaller second row under the selling points, e.g. `STACK 39/31 MM • 245 G • CARBON PLATE`; labels without specs look exactly as before.
- **Print list (cart)**: click `Add to print list` on any row for one copy, then set the copies with that row's stepper; going below 1 removes the label. Tick several labels to add one copy of each at once (incomplete ones stay ticked). Click a row to see it in the preview without opening the editor; a row with something missing says what, and `N to complete` lists only those.
- **Gift certificates**: the header’s `Gift certificate` button opens a form with a live preview. Enter an amount (or choose $50 / $100 / $200), optional To / From names and a typed signature. Empty names and signatures keep their label and blank line for handwriting. Ref # defaults to the local date in `YYYYMMDD` format and can be edited (e.g. `20261102-2`) or reset with `Today`. `Create PDF to print` makes one Letter portrait page and opens it in the app's PDF preview; click the printer icon and use paper size **Letter** at **100%** scale. The last successfully printed signer is remembered locally; new certificates start with blank amount and customer names. There is no certificate history or automatic reference numbering, and certificate printing does not change the shoe print list. Fonts and the logo are bundled for offline printing.
- Live SVG preview, full width above the list, with the approved red/white regular and oversized SALE-seal variants.
- Everything is saved automatically on this computer; there is nothing to import or export.
- **Adjustable label size**: change the label's width and height under the preview, in `Label size & text` (fixed ranges 160–240 mm × 23–30 mm; if a change would push the shape outside 6:1–10.5:1 (so 180 × 30 mm is the squarest), the other value is adjusted automatically and a notice explains it; narrower labels shrink the logo and price blocks to keep the text readable). The preview, print layout, A4 sheet and PDF follow; `Reset` returns to 220 × 23 mm.
- **Text size**: separate sliders for the model name, selling points, price, the struck-through regular price on sale labels, and the SALE seal. 100% is the shop standard (model 130%, selling points 150%, price 120% of the original approved design); each can go smaller or larger (model and selling points 60–130%, price 70–115%, regular price 65–130%, seal 80–120%). Each shows its print size; text too long for its space still shrinks to fit.
- **Sale %**: type a discount (e.g. 25) instead of a sale price and the sale price is worked out to the cent; typing a sale price updates the percent.
- **AI selling points**: tick labels, click `AI selling points`, copy the generated prompt into any AI tool (ChatGPT, Claude, Gemini…), paste its reply back and review it. Each label gets three selling points: shoe type (race / stability / neutral…), heel-to-toe drop, and the midsole foam technology (the brand's official foam name, e.g. PWRRUN PB, never marketing wording). The same reply also writes the one-line "who it's for" summary and fills the specs row (stack heights, weight, plate); anything the AI does not know keeps the label's current value. Low-confidence answers are unticked and flagged so specs can be checked before printing.
- Printing stays inside the app: the exact sheet or label-size layout opens in a separate PDF preview window with built-in zoom, save and print controls. Click the printer icon to choose a printer and print at actual size (100% scale).
- Print one 220 × 23 mm label per page, or up to eight labels on a Letter (default) or A4 sheet with crop marks; pick the paper in the print window. The sheet is landscape, and turns portrait when a label is narrow enough (up to 191 mm on Letter, 186 mm on A4) and that fits more on it: 180 × 30 mm gets eight instead of six.
- Per-printer X/Y scale and offset calibration, including a calibration test page.

The visual rules and adjustable SVG values are documented in [docs/label-design-system.md](docs/label-design-system.md) and [design/label-design-system.json](design/label-design-system.json).

## Development

Requirements: Node.js 22 or newer and npm.

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm test
npm run typecheck
npm run build
```

## Application icons

The Windows, macOS, Electron and browser icons all come from the same Runners Life SVG master. Edit `build/icon-source.svg`, then regenerate every required PNG, ICO, ICNS, favicon and web-app size with:

```bash
npm run icons:generate
```

The complete surface and asset checklist is documented in [docs/app-icon-system.md](docs/app-icon-system.md).

## Build for Windows

Run this on Windows for the most predictable code-signing and printer integration result:

```powershell
npm install
npm run package:win
```

Artifacts are written to `release/windows/` as a clearly named NSIS `Setup` installer and a `Portable` executable. The application runs entirely offline after installation; no server is required.

Production distribution should add an organization-owned Windows code-signing certificate to avoid SmartScreen warnings. Local/internal testing does not require a certificate.

Releases are normally built by GitHub Actions instead, see [Publishing a release](#publishing-a-release).

## Updates

The app looks for a newer version on this repository's [GitHub Releases](https://github.com/zijianwang90/runners-life-label-creator/releases) a few seconds after it starts and every six hours while it stays open. When one exists, an **Update to x.y.z** button appears at the top of the window; **Check for updates** in the footer checks on demand. Labels and settings live in the user-data folder, not next to the program, so they survive every update.

| Copy of the app | What **Update and restart** does |
| --- | --- |
| Windows portable folder (the unzipped `Portable` zip) | Downloads the new `Portable` zip, unpacks it, copies the files over its own folder and starts it again. The folder must be writable and the program file must keep its name. |
| Windows portable exe (single file) | Downloads the new `Portable` exe, replaces the running file in place (same name and folder, so shortcuts keep working) and starts it again. The folder must be writable. |
| Windows installed (Setup) | Downloads the `Setup` exe and runs it silently over the existing installation, then reopens the app. |
| macOS, a dev run | Cannot replace itself; opens the release page instead. |

Every download must come from this repository's own release files and match the SHA-256 that GitHub publishes for the asset (or `SHA256SUMS.txt` in the release). A file that does not match is deleted and nothing is installed. Builds are not code-signed, so this protects against damaged downloads, not against someone with write access to the repository; keep the GitHub account protected with two-factor authentication.

Versions before the first release with the updater cannot update themselves; install that one by hand.

The repository the app reads is set by `UPDATE_REPO` in [electron/updater.ts](electron/updater.ts). It has to be public, because the app carries no GitHub token.

## Publishing a release

Releases are made on GitHub, so no local computer is involved. Open the repository's **Actions** tab, choose **Release**, press **Run workflow**, pick `patch`, `minor` or `major` and run it (or use `gh workflow run release.yml -f bump=minor` from any computer with the GitHub CLI).

The workflow ([.github/workflows/release.yml](.github/workflows/release.yml)):

1. works out the next version from `package.json` (it must be started on `main`);
2. runs the tests and builds the Windows installer, portable exe and portable zip, plus the macOS dmg and zip;
3. only if the Windows build succeeded, commits `Release vX.Y.Z` (the version bump) to `main`, tags it, writes `SHA256SUMS.txt` and publishes a GitHub release with generated notes.

A failed build leaves no commit and no tag behind, so it can simply be run again. If `main` receives another commit while the builds run, the push is rejected and nothing is published; run it again. The notes show up in the app's update dialog and can be edited on GitHub afterwards. Computers running the app pick the release up on their next check.

Tick **Publish as a pre-release** to try a release first: the updater ignores pre-releases, so no shop computer will pick it up. If `main` is ever protected by a branch rule, allow GitHub Actions to push to it, or the version commit is rejected.

## Printing setup

1. Choose the sheet layout (Letter or A4, set to match the paper in the printer) for ordinary office printers or the label-size option (`220 × 23 mm` by default, or the size you set) for a printer whose driver supports that custom media size.
2. Click **Create PDF to print**. The PDF opens in the application's preview window; click the printer icon to choose your printer.
3. Use **Actual size** or **100%** scale to preserve the label dimensions. *Fit to printable area* or *Fit to paper* can shrink the labels. Match the printer's paper size to the selected layout (Letter, A4 or custom label size).
4. Open the calibration PDF, print it, measure the outer frame, then enter small width/height and X/Y corrections if necessary. Calibration corrections are separate from the label size setting.

The PDFs are written to the system temp folder (`runners-life-label-creator`) and removed after about a week. Use the PDF preview's save control to keep a copy elsewhere.

Application data is stored in Electron's Windows user-data folder as `labels.json` and is written atomically.

## License

The source code is released under the [MIT License](LICENSE). The Runners Life logo and the brand logos in `design/assets/brands/` (New Balance, Saucony, ASICS, Brooks) belong to their owners and are not covered by that license.
