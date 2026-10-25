# 📜 Changelog — sainisatta Casino Strategy Deck

All notable changes to the `sainisatta` platform are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.2.0] — 2026-10-25

### Added
- **Chrome Extension Live Kelly HUD**: Real-time Kelly staking calculator inside overlay with custom session bankroll input and automatic EV edge determination.
- **Chrome Extension Quick-Pill Selector**: Added top pill buttons (`Auto`, `BJ`, `Roulette`, `Limbo`, `Crash`, `Mines`, `Poker`, `Baccarat`) for instant 1-click model switching.
- **Glassmorphic Extension Redesign**: Custom neon scrollbars, pulsing status ring for backend connection, and glowing advice headers in `popup.css`.
- **Persistent Session Logging UI**: Interactive "Log Completed Session" form and live P/L ledger table inside Dashboard Bankroll panel.
- **CSV Session Logs Export Endpoint**: Added `GET /api/export/csv` in Flask backend with formatted spreadsheet download for tax and session auditing.
- **Web Audio Sound Effects**: Added ceramic chip clink sounds (`chip`), card slide sounds (`card`), and positive EV alert chimes (`alert`).
- **Neural Network Loss Curve Visualizer**: Canvas curve visualizer (`#nn-loss-canvas`) dynamically rendering online backpropagation loss reduction.
- **Automated Bankroll Test Suite**: Added `tests/test_bankroll.py` verifying Kelly edge boundaries, fractional staking, and Risk of Ruin decay (22 total passing unit tests).

---

## [3.1.0] — 2026-10-24

### Added
- **Kelly Criterion & Bankroll Engine**: Pure JavaScript `js/bankroll.js` module calculating full/fractional Kelly stakes, empirical Risk of Ruin, and Monte Carlo trajectory paths.
- **Expanded Backend REST API**: Added `/api/health`, `/api/sessions`, `/api/presets`, `/api/export`, and universal CORS headers in `server.py`.
- **Multi-Theme Switcher**: Added Cyber Dark, Emerald VIP Lounge, Crimson High Roller, and Midnight OLED themes with local storage persistence.
- **Keyboard Shortcuts Engine**: Interactive cheat sheet modal triggered via `?`, tab navigation with `1-9, 0`, theme cycling with `T`, and sound mute with `M`.
- **Manifest V3 Icon Suite**: Pixel-perfect neon casino chip PNG icons (16px, 48px, 128px) and `Alt+Shift+S` global shortcut in `manifest.json`.
- **Automated CI/CD**: Added GitHub Actions workflow (`.github/workflows/ci.yml`) testing across Python 3.10–3.13 and validating all JavaScript syntax.

---

## [3.0.0] — 2026-10-23

### Added
- Initial public release of `sainisatta` full-stack strategy suite.
- Pure JS Artificial Neural Network (ANN) with Adam Optimizer & Elman Recurrent Neural Network (RNN).
- 8 strategy engines: Blackjack Hi-Lo radar, Roulette progression chart, Baccarat roadmaps, Poker equity simulator, Craps house edge rankings, Mines heatmap, Limbo provably fair engine, Crash rocket canvas.
- Screenshot OCR Analyzer with bounding box overlays.
- Flask SQLite backend server with user authentication and activity tracking.
- Manifest V3 Chrome Extension overlay companion.
