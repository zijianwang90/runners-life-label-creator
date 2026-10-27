# Runners Life Label Creator

Offline desktop application for editing and printing Runners Life shoe-wall labels on Windows and macOS. The approved label is **220 × 23 mm** by default (the size can be adjusted, see below) and supports New Balance, Saucony, ASICS, and Brooks.

## Included workflow

- Add, duplicate, reorder, search, filter, and delete shoe models; every edit is immediately persisted locally.
- Edit brand, model, regular price, optional sale price, and zero to three optional selling points.
- Add labels to a print cart, review every selected label, and set an independent print quantity before printing.
- Live SVG preview with the approved red/white regular and oversized SALE-seal variants.
- Everything is saved automatically on this computer; there is nothing to import or export.
- **Adjustable label size**: change the label's width and height in the preview panel (fixed ranges 160–240 mm × 23–30 mm; if a change would push the shape outside 6.5:1–10.5:1, the other value is adjusted automatically and a notice explains it; narrower labels shrink the logo and price blocks to keep the text readable). The preview, print layout, A4 sheet and PDF follow; `Reset` returns to 220 × 23 mm.
- **Selling point text size**: a separate slider (80–170%, 100% = approved design) makes the three selling points larger for print. It shows the resulting print size in points; phrases too long for their space still shrink to fit, but never below the approved size.
- **AI selling points**: tick labels, click `AI selling points`, copy the generated prompt into any AI tool (ChatGPT, Claude, Gemini…), paste its reply back and review it. Each label gets three selling points: shoe type (race / stability / neutral…), heel-to-toe drop, and the midsole foam technology (the brand's official foam name, e.g. PWRRUN PB, never marketing wording). Low-confidence answers are unticked and flagged so specs can be checked before printing.
- Printing is one click: the app renders the exact A4 or label-size print layout to a PDF and opens it in your default PDF viewer (Edge, Chrome, Acrobat…), where you pick the printer and print yourself. The app never talks to a printer driver, so it works with any printer.
- Print one 220 × 23 mm label per page, or eight labels on an A4 landscape sheet with crop marks.
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

1. Choose `A4 landscape` for ordinary office printers or the label-size option (`220 × 23 mm` by default, or the size you set) for a printer whose driver supports that custom media size.
2. Click **Open PDF to print**. The PDF opens in the system's default viewer; choose your printer there and print.
3. In the viewer's print dialog, set the scale to 100% / Actual size — not “Fit to page” or “Shrink to fit” — and leave the margins at their defaults.
4. Open the calibration PDF, print it, measure the outer frame, then enter small width/height and X/Y corrections if necessary. Calibration corrections are separate from the label size setting.

The PDFs are written to the system temp folder (`runners-life-label-creator`) and removed after about a week. To keep one, use the viewer's *Save as*.

Application data is stored in Electron's Windows user-data folder as `labels.json` and is written atomically.

## License

The source code is released under the [MIT License](LICENSE). The Runners Life logo and the brand logos in `design/assets/brands/` (New Balance, Saucony, ASICS, Brooks) belong to their owners and are not covered by that license.
