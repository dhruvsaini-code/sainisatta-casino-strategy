# 🎰 sainisatta — Premium Live Casino Strategy & AI Predictor Deck

![Version](https://img.shields.io/badge/version-3.0.0-purple.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/backend-Flask%203.0-green.svg)
![Frontend](https://img.shields.io/badge/frontend-HTML5%20%2F%20Vanilla%20CSS%20%2F%20ES6%2B-orange.svg)
![Extension](https://img.shields.io/badge/extension-Chrome%20Manifest%20V3-cyan.svg)

**sainisatta** is an advanced mathematical strategy companion and client-side AI engine built for real-time casino decision modeling, probability estimation, and vision-assisted screenshot scanning. 

Equipped with a standalone Python Flask backend, pure JavaScript Artificial Neural Networks (ANN/RNN with Adam Optimizer), interactive Canvas renderers, and a Live Chrome Extension, `sainisatta` empowers users with mathematical edge calculations across 8 major casino verticals.

---

## 🌟 Key Features

### 👁️ 1. Vision & OCR Screenshot Scanning
- **Instant Game Parsing**: Upload a screenshot (Mac `Cmd+Shift+4` or Windows `Win+Shift+S`) or drag-and-drop straight into the console.
- **Bounding Box Detection**: Automatically detects card bounding boxes, community cards, and chip values using client-side image canvas overlays.
- **Automated Move Recommendation**: Calculates the exact mathematical optimal play instantly based on parsed screen layout.

### 🧠 2. Pure JS Neural Network Predictor Core (`ai_predictor.js`)
- **Feedforward Artificial Neural Network (ANN)**: Multi-layer perceptron with Xavier initialization and Adam optimization for Mines, Blackjack, Poker, and Craps.
- **Elman Recurrent Neural Network (RNN)**: Backpropagation Through Time (BPTT) engine for sequential data modeling in Crash, Limbo, Roulette, and Baccarat.
- **Experience Replay Buffer**: Online continuous learning mechanism running locally inside browser `localStorage`.

### 🎮 3. Multi-Game Strategy Modules
- **Blackjack Strategy Radar**: Basic strategy decision matrix, real-time SVG radial win dial, running count & True Count calculator (Hi-Lo system) with shoe penetration tracking.
- **Roulette Progression Strategist**: Real-time Martingale, Fibonacci, D'Alembert, and Labouchere sequence calculators, interactive spinning wheel simulator, and balance trajectory chart.
- **Baccarat Shoe Roadmaps**: Live Bead Plate & Big Road rendering with Banker/Player/Tie streak tracking and heuristic mode switching.
- **Texas Hold'em Equity Simulator**: Monte Carlo simulation engine calculating hand win equity, opponent edge, pot odds limits, and improving outs against 1–9 opponents.
- **Craps Dice Odds Advisor**: Come-out phase and point phase house advantage rankings with optimal point-backed odds wagers.
- **Mines Tile Predictor**: 5x5 dynamic tile layout heatmaps powered by ANN pattern recognition.
- **Limbo & Crash Engines**: Exponential rocket trajectory canvas animation, Markov chain risk prediction, auto-cashout Monte Carlo optimizer.

### 🧩 4. Live Chrome Extension (`chrome-extension/`)
- **Live Online Casino Overlay**: Inject floating real-time strategy HUD directly over online betting platforms (Stake, Roobet, BC.Game, etc.).
- **Auto-OCR Screen Snapping**: One-click element selection & screen region capture.
- **Popup Dashboard**: Seamless synchronization with the local `sainisatta` Flask backend.

---

## 🏗️ Architecture & Tech Stack

```
sainisatta/
├── index.html            # Main SPA dashboard UI (Glassmorphic dark design)
├── style.css             # Vanilla CSS design system (tokens, glassmorphism, animations)
├── app.js                # Core UI coordinator, event routing, sound engine & chart state
├── server.py             # Flask backend with SQLite user auth & analytics tracking
├── requirements.txt      # Python backend dependencies (Flask, Werkzeug)
├── database.db           # Local SQLite database (git-ignored)
├── js/
│   ├── ai_predictor.js   # ANN & RNN Neural Network core + Adam Optimizer + Experience Replay
│   ├── vision.js         # Canvas OCR & screenshot scanning engine
│   ├── blackjack.js      # Basic strategy & Hi-Lo shoe counting matrix
│   ├── roulette.js       # Progression systems & canvas wheel renderer
│   ├── baccarat.js       # Bead Plate & Big Road canvas roadmap generators
│   ├── poker.js          # Hold'em equity simulator & outs evaluator
│   ├── craps.js          # Craps dice odds & house advantage table
│   ├── crash.js          # Exponential rocket canvas renderer & Markov risk model
│   ├── limbo.js          # Target multiplier odds & martingale calculator
│   └── mines.js          # 5x5 dynamic tile grid generator & safety predictor
└── chrome-extension/     # Manifest V3 Chrome Extension overlay
    ├── manifest.json
    ├── background.js
    ├── content.js
    ├── popup.html
    ├── popup.css
    └── popup.js
```

---

## 🚀 Quick Start Guide

### Prerequisites
- Python 3.8+ (for Flask backend)
- Any modern web browser (Chrome, Brave, Edge, Firefox, Safari)

### 1. Installation

Clone the repository and install the backend dependencies:

```bash
git clone https://github.com/dhruvsaini-code/sainisatta-casino-strategy.git
cd sainisatta-casino-strategy
pip install -r requirements.txt
```

### 2. Running the Flask Backend

Launch the Python Flask server:

```bash
python3 server.py
```

- The server will start at `http://localhost:5001`.
- SQLite database (`database.db`) will automatically initialize on first launch.

### 3. Accessing the Dashboard

Open your browser and navigate to:
```
http://localhost:5001
```
Alternatively, open `index.html` directly in any web browser.

---

## 🔌 Chrome Extension Setup

1. Open Google Chrome or any Chromium browser and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle switch in the top right corner).
3. Click **Load unpacked**.
4. Select the `chrome-extension` directory inside this repository.
5. Click the `sainisatta` icon in your toolbar to activate the floating overlay on supported sites.

---

## 📡 Backend API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/register` | `POST` | Register a new user (`username`, `password`) |
| `/api/login` | `POST` | Authenticate user session |
| `/api/logout` | `POST` | End active user session |
| `/api/session` | `GET` | Retrieve current authentication state |
| `/api/track` | `POST` | Log game module access count |
| `/api/analytics` | `GET` | Fetch session usage stats per user |

---

## ⚖️ Disclaimer & Responsible Gaming

`sainisatta` is designed strictly for **educational, analytical, and mathematical modeling purposes**. No gambling strategy guarantees positive returns in games with an inherent house edge. Always gamble responsibly and within your personal limits.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
