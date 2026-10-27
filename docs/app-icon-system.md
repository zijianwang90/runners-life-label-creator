# Runners Life Label Creator — App Icon System

## Design

The application icon uses the official runner/maple symbol cropped from `logo.svg`. The symbol is rendered as a white knockout on the Runners Life red gradient, with restrained diagonal speed lines. It does not stretch, redraw, or alter the official mark.

The editable master is `build/icon-source.svg`. Run `npm run icons:generate` after changing it.

## Generated assets and coverage

| Surface | Asset / integration |
| --- | --- |
| Windows executable and taskbar | `build/icon.ico`, Electron Builder `win.icon`, BrowserWindow icon |
| Windows Start menu and desktop shortcuts | Executable icon embedded by Electron Builder |
| Windows NSIS installer, header, uninstaller | `nsis.installerIcon`, `installerHeaderIcon`, `uninstallerIcon` |
| Windows taskbar grouping and notifications | Stable `appId` plus `app.setAppUserModelId` |
| macOS Finder, Dock, Launchpad and application bundle | `build/icon.icns`, Electron Builder `mac.icon`, runtime Dock icon |
| Electron main and hidden print windows | `build/icon.png` copied into application resources |
| Linux application launchers | PNG icon directory configured under `linux.icon` |
| Browser tab / bookmark | SVG favicon, ICO fallback, 16px and 32px PNGs |
| iOS/macOS home-screen bookmark | 180px Apple Touch Icon |
| Installed web app | 192px and 512px manifest icons |
| In-app header identity | Self-contained `public/app-icon.svg` |

All raster and platform files are generated from the same 1024×1024 SVG master. Do not edit generated PNG, ICO or ICNS files by hand.
