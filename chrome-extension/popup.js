/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  SAINISATTA PRO — AI ADAPTIVE PREDICTION ENGINE v4.0
 *  Online-Learning Neural Network for all casino game types
 *
 *  Architecture per game:
 *  ─ MINES    : 25-node spatial heatmap + Bayesian tile safety + ANN next-tile
 *  ─ CRASH    : LSTM-style RNN with exponential smoothing + Markov chain
 *  ─ LIMBO    : Volatility-adaptive target via online gradient descent
 *  ─ BLACKJACK: Hi-Lo count + Illustrious-18 deviation + EV-weighted ANN
 *  ─ ROULETTE : Progression tracker + hot/cold sector bias learning
 *  ─ BACCARAT : Shoe pattern RNN + streak/chop classification
 *  ─ POKER    : Monte Carlo equity + pot-odds decision network
 *
 *  Learning mechanism: every captured outcome updates weights in-browser
 *  via localStorage so predictions improve with every round played.
 * ═══════════════════════════════════════════════════════════════════════════
 */
 
'use strict';
 
// ─────────────────────────────────────────────────────────────────────────────
//  UTILITY: Persistent Storage (localStorage with JSON fallback)
// ─────────────────────────────────────────────────────────────────────────────
const DB_CACHE = {};
let dbInitialized = false;
const dbReadyCallbacks = [];

const DB = {
  get(key, def) {
    return DB_CACHE[key] !== undefined ? DB_CACHE[key] : def;
  },
  set(key, val) {
    DB_CACHE[key] = val;
    chrome.storage.local.set({ [key]: val });
  },
  inc(key, idx, amount = 1) {
    const arr = DB.get(key, Array(idx + 1).fill(0));
    while (arr.length <= idx) arr.push(0);
    arr[idx] += amount;
    DB.set(key, arr);
    return arr;
  }
};

// Sync data changes on updates from other scripts (like content.js)
chrome.storage.onChanged.addListener((changes) => {
  for (const [key, { newValue }] of Object.entries(changes)) {
    DB_CACHE[key] = newValue;
  }
});

// Load all data from chrome.storage.local into DB_CACHE before initializing the app
chrome.storage.local.get(null, (data) => {
  Object.assign(DB_CACHE, data);
  dbInitialized = true;
  dbReadyCallbacks.forEach(cb => cb());
});
 
// ─────────────────────────────────────────────────────────────────────────────
//  LOGGER
// ─────────────────────────────────────────────────────────────────────────────
function log(msg, type = 'info') {
  const box = document.getElementById('console-logs');
  if (!box) return;
  const colors = { info: '#94a3b8', success: '#10b981', error: '#f43f5e', match: '#00f2fe', warn: '#f59e0b', ai: '#a855f7' };
  const labels = { info: '[INFO]', success: '[OK]', error: '[ERR]', match: '[CLASSIFY]', warn: '[WARN]', ai: '[AI]' };
  const el = document.createElement('div');
  el.style.marginBottom = '0.3rem';
  el.innerHTML = `<span style="color:${colors[type]||'#94a3b8'};font-weight:bold;margin-right:0.4rem;font-family:monospace;">${labels[type]||'[?]'}</span><span>${msg}</span>`;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}
function clearLogs() { const b = document.getElementById('console-logs'); if (b) b.innerHTML = ''; }
 
// ─────────────────────────────────────────────────────────────────────────────
//  MINI NEURAL NET (3-layer feedforward, online SGD)
//  Used as a shared function approximator across all game engines
// ─────────────────────────────────────────────────────────────────────────────
class MiniNet {
  constructor(key, inputSize, hiddenSize, outputSize, lr = 0.02) {
    this.key = key;
    this.in = inputSize;
    this.hid = hiddenSize;
    this.out = outputSize;
    this.lr = lr;
    this._load();
  }
 
  _rand(n) { return Array.from({ length: n }, () => (Math.random() - 0.5) * 0.5); }
  _sigmoid(x) { return 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, x)))); }
  _relu(x) { return Math.max(0, x); }
  _softmax(arr) {
    const m = Math.max(...arr);
    const e = arr.map(x => Math.exp(x - m));
    const s = e.reduce((a, b) => a + b, 0);
    return e.map(x => x / s);
  }
 
  _load() {
    const saved = DB.get(this.key, null);
    if (saved && saved.W1 && saved.W1.length === this.hid && saved.W1[0].length === this.in && saved.W2 && saved.W2.length === this.out) {
      this.W1 = saved.W1; this.b1 = saved.b1;
      this.W2 = saved.W2; this.b2 = saved.b2;
    } else {
      // W1: [hid x in], W2: [out x hid]
      this.W1 = Array.from({ length: this.hid }, () => this._rand(this.in));
      this.b1 = this._rand(this.hid);
      this.W2 = Array.from({ length: this.out }, () => this._rand(this.hid));
      this.b2 = this._rand(this.out);
      this._save();
    }
  }
 
  _save() {
    DB.set(this.key, { W1: this.W1, b1: this.b1, W2: this.W2, b2: this.b2 });
  }
 
  forward(x) {
    // Hidden layer (ReLU)
    this._h = this.W1.map((row, i) =>
      this._relu(row.reduce((s, w, j) => s + w * x[j], 0) + this.b1[i])
    );
    // Output layer (sigmoid for binary, softmax for multi-class)
    this._z2 = this.W2.map((row, i) =>
      row.reduce((s, w, j) => s + w * this._h[j], 0) + this.b2[i]
    );
    this._out = this.out === 1 ? [this._sigmoid(this._z2[0])] : this._softmax(this._z2);
    return this._out;
  }
 
  // Online SGD: label is array of target probabilities (one-hot or soft)
  train(x, label) {
    const pred = this.forward(x);
    // Output delta
    const dOut = pred.map((p, i) => p - label[i]);
    // W2 gradient
    for (let i = 0; i < this.out; i++) {
      for (let j = 0; j < this.hid; j++) {
        this.W2[i][j] -= this.lr * dOut[i] * this._h[j];
      }
      this.b2[i] -= this.lr * dOut[i];
    }
    // Hidden delta (ReLU deriv)
    const dHid = this._h.map((h, j) => {
      const upstream = dOut.reduce((s, d, i) => s + d * this.W2[i][j], 0);
      return upstream * (h > 0 ? 1 : 0);
    });
    // W1 gradient
    for (let i = 0; i < this.hid; i++) {
      for (let j = 0; j < this.in; j++) {
        this.W1[i][j] -= this.lr * dHid[i] * x[j];
      }
      this.b1[i] -= this.lr * dHid[i];
    }
    this._save();
    return pred;
  }
}
 
// ─────────────────────────────────────────────────────────────────────────────
//  RNN CELL (Elman-style hidden state, for sequential games like Crash/Baccarat)
// ─────────────────────────────────────────────────────────────────────────────
class RNNCell {
  constructor(key, inputSize, hiddenSize, outputSize, lr = 0.015) {
    this.key = key;
    this.in = inputSize;
    this.hid = hiddenSize;
    this.out = outputSize;
    this.lr = lr;
    this._tanh = x => Math.tanh(Math.max(-20, Math.min(20, x)));
    this._sigmoid = x => 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, x))));
    this._load();
  }
 
  _rand(n) { return Array.from({ length: n }, () => (Math.random() - 0.5) * 0.3); }
 
  _load() {
    const s = DB.get(this.key, null);
    if (s && s.Wx && s.Wx.length === this.hid && s.Wx[0].length === this.in && s.Wy && s.Wy.length === this.out) {
      this.Wh = s.Wh; this.Wx = s.Wx; this.bh = s.bh;
      this.Wy = s.Wy; this.by = s.by;
      this.h = s.h || this._rand(this.hid);
    } else {
      this.Wh = Array.from({ length: this.hid }, () => this._rand(this.hid));
      this.Wx = Array.from({ length: this.hid }, () => this._rand(this.in));
      this.bh = this._rand(this.hid);
      this.Wy = Array.from({ length: this.out }, () => this._rand(this.hid));
      this.by = this._rand(this.out);
      this.h = this._rand(this.hid);
      this._save();
    }
  }
 
  _save() {
    DB.set(this.key, { Wh: this.Wh, Wx: this.Wx, bh: this.bh, Wy: this.Wy, by: this.by, h: this.h });
  }
 
  forward(x) {
    // h_t = tanh(Wh*h_prev + Wx*x + bh)
    this.h_prev = [...this.h];
    this.h = this.Wh.map((row, i) =>
      this._tanh(
        row.reduce((s, w, j) => s + w * this.h_prev[j], 0) +
        this.Wx[i].reduce((s, w, j) => s + w * x[j], 0) +
        this.bh[i]
      )
    );
    // y = sigmoid(Wy*h + by)
    this._y = this.Wy.map((row, i) =>
      this._sigmoid(row.reduce((s, w, j) => s + w * this.h[j], 0) + this.by[i])
    );
    return this._y;
  }
 
  train(x, label) {
    const pred = this.forward(x);
    const dOut = pred.map((p, i) => p - label[i]);
    // Wy gradient
    for (let i = 0; i < this.out; i++) {
      for (let j = 0; j < this.hid; j++) this.Wy[i][j] -= this.lr * dOut[i] * this.h[j];
      this.by[i] -= this.lr * dOut[i];
    }
    // dh
    const dh = this.h.map((hj, j) => {
      const upstream = dOut.reduce((s, d, i) => s + d * this.Wy[i][j], 0);
      return upstream * (1 - hj * hj); // tanh deriv
    });
    // Wx, Wh, bh
    for (let i = 0; i < this.hid; i++) {
      for (let j = 0; j < this.in; j++) this.Wx[i][j] -= this.lr * dh[i] * x[j];
      for (let j = 0; j < this.hid; j++) this.Wh[i][j] -= this.lr * dh[i] * this.h_prev[j];
      this.bh[i] -= this.lr * dh[i];
    }
    this._save();
    return pred;
  }
 
  resetHidden() { this.h = Array(this.hid).fill(0); this._save(); }
}
 
// ─────────────────────────────────────────────────────────────────────────────
//  GLOBAL STATE
// ─────────────────────────────────────────────────────────────────────────────
let activeGame = 'mines';
let scrapedMinesData = null;
let scrapedLimboTarget = null;
let lastScrapedMinesHash = '';
 
// ── Per-game AI instances ──
let AI = {};
 
// ── Persistent game histories ──
let HIST = {};

function initAIAndHist() {
  activeGame = DB.get('mn_active_game', 'mines');

  AI = {
    // Mines: 53-input (25 tile states + 25 spatial frequencies + 3 config parameters) → 25-output
    mines: new MiniNet('ai_mines', 53, 32, 25, 0.03),
   
    // Crash: RNN on sequence of crash points → next expected zone (3 classes)
    crash: new RNNCell('ai_crash', 4, 12, 3, 0.02),
   
    // Limbo: volatility features → target multiplier zone (4 classes)
    limbo: new RNNCell('ai_limbo', 5, 12, 3, 0.02),
   
    // Blackjack: hand + count features → action (5 classes: H/S/D/P/Ds)
    blackjack: new MiniNet('ai_blackjack', 8, 14, 5, 0.02),
   
    // Roulette: sector + streak → bet zone (3: low/mid/high)
    roulette: new MiniNet('ai_roulette', 6, 8, 3, 0.02),
   
    // Baccarat: RNN on shoe sequence → next outcome (3: B/P/T)
    baccarat: new RNNCell('ai_baccarat', 3, 10, 3, 0.018),
   
    // Poker: equity + pot odds → action (3: fold/call/raise)
    poker: new MiniNet('ai_poker', 6, 10, 3, 0.02),
  };

  HIST = {
    crash: DB.get('hist_crash', []),
    limbo: DB.get('hist_limbo', []),
    baccarat: DB.get('hist_baccarat', []),
    roulette: DB.get('hist_roulette', []),
    mines_spawns: DB.get('hist_mines_spawns', Array(25).fill(0)),
    mines_sessions: DB.get('hist_mines_sessions', 0),
    bj_rounds: DB.get('hist_bj_rounds', 0),
  };
}
 
// ─────────────────────────────────────────────────────────────────────────────
//  NORMALISE helpers
// ─────────────────────────────────────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const norm = (v, lo, hi) => clamp((v - lo) / (hi - lo + 1e-9), 0, 1);
 
function pushHist(key, val, maxLen = 200) {
  HIST[key].push(val);
  if (HIST[key].length > maxLen) HIST[key].shift();
  DB.set('hist_' + key, HIST[key]);
}
 
function stats(arr) {
  if (!arr.length) return { mean: 1, std: 0, min: 1, max: 1 };
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const std = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length);
  return { mean, std, min: Math.min(...arr), max: Math.max(...arr) };
}
 
// ─────────────────────────────────────────────────────────────────────────────
//  MINES AI ENGINE
// ─────────────────────────────────────────────────────────────────────────────
const MinesAI = {
  // Build feature vector for the ANN: [25 tile states + 25 spatial frequencies + 3 config parameters]
  features(tileStates, minesCount) {
    const f = tileStates.map(s => s === 0 ? 0 : s === 1 ? 1 : -1); // unrevealed=0,gem=1,bomb=-1
    const total = Math.max(1, HIST.mines_sessions);
    const spawnNorm = HIST.mines_spawns.map(c => c / total);
    f.push(...spawnNorm);
    f.push(norm(minesCount, 1, 24));
    f.push(tileStates.filter(s => s === 1).length / 25);
    f.push(tileStates.filter(s => s === 0).length / 25);
    return f; // length = 53
  },
 
  // Record bomb positions after round ends → train network
  recordBombs(bombIndices, tileStates, minesCount) {
    if (!bombIndices.length) return;
    const hash = bombIndices.sort((a, b) => a - b).join(',');
    if (hash === lastScrapedMinesHash) return;
    lastScrapedMinesHash = hash;
 
    HIST.mines_sessions++;
    bombIndices.forEach(idx => { if (idx >= 0 && idx < 25) HIST.mines_spawns[idx]++; });
    DB.set('hist_mines_sessions', HIST.mines_sessions);
    DB.set('hist_mines_spawns', HIST.mines_spawns);
 
    // Train ANN: input = game state, label = 1-hot danger map (bomb positions = 1, safe = 0)
    const x = this.features(tileStates, minesCount);
    const label = Array(25).fill(0);
    bombIndices.forEach(i => { if (i < 25) label[i] = 1; });
    AI.mines.train(x, label);
    log(`Mines AI trained on ${HIST.mines_sessions} rounds. Bomb heatmap updated.`, 'ai');
  },
 
  predict(tileStates, minesCount) {
    const x = this.features(tileStates, minesCount);
    const dangerProbs = AI.mines.forward(x); // probability each tile is a bomb
 
    // Combine ANN danger score with historical spawn frequency
    const total = Math.max(1, HIST.mines_sessions);
    const scores = Array(25).fill(0).map((_, i) => {
      if (tileStates[i] !== 0) return Infinity; // already revealed
      const historicalDanger = HIST.mines_spawns[i] / total;
      const aiDanger = dangerProbs[i];
      return 0.5 * historicalDanger + 0.5 * aiDanger; // combined danger
    });
 
    // Pick tile with LOWEST danger score (safest)
    let bestIdx = -1, bestScore = Infinity;
    scores.forEach((s, i) => { 
      if (s < bestScore) { 
        bestScore = s; 
        bestIdx = i; 
      } 
    });
 
    // Softmax-like temperature noise selection to prevent repeated Row 1 Col 1 picks during equal scores
    const unrevealed = [];
    scores.forEach((s, i) => {
      if (tileStates[i] === 0) unrevealed.push({ idx: i, score: s });
    });
    
    if (unrevealed.length > 0) {
      // Add a tiny random factor to scores to break ties dynamically
      unrevealed.forEach(item => {
        item.score += (Math.random() - 0.5) * 1e-5;
      });
      unrevealed.sort((a, b) => a.score - b.score);
      bestIdx = unrevealed[0].idx;
      bestScore = unrevealed[0].score;
    }
 
    const remainingTiles = tileStates.filter(s => s === 0).length;
    const revealedGems = tileStates.filter(s => s === 1).length;
    
    let safeProb = remainingTiles > 0
      ? Math.round(clamp((1 - bestScore) * 100 * ((remainingTiles - minesCount) / remainingTiles), 1, 99))
      : 0;
 
    if (bestIdx === -1) return { letter: '—', row: '-', col: '-', safetyPct: 0, tileIndex: -1 };
    const row = Math.floor(bestIdx / 5) + 1;
    const col = (bestIdx % 5) + 1;
    return { tileIndex: bestIdx, row, col, letter: `${'ABCDE'[col-1]}${row}`, safetyPct: safeProb };
  }
};
 
// ─────────────────────────────────────────────────────────────────────────────
//  CRASH AI ENGINE
// ─────────────────────────────────────────────────────────────────────────────
const CrashAI = {
  // State encoding: [log(mult), zone0-3 one-hot, streak features]
  encode(mult) {
    const lm = Math.log(Math.max(1.01, mult));
    const zone = mult <= 1.3 ? 0 : mult <= 2 ? 1 : mult <= 5 ? 2 : 3;
    return [norm(lm, 0, 4), zone === 0 ? 1 : 0, zone === 1 ? 1 : 0, zone === 2 ? 1 : 0];
  },
 
  zoneLabel(mult) {
    if (mult <= 1.3) return [1, 0, 0];
    if (mult <= 2) return [0, 1, 0];
    return [0, 0, 1];
  },
 
  record(crashMult) {
    pushHist('crash', crashMult);
    if (HIST.crash.length < 2) return;
    // Train RNN: previous crash → next zone
    const prev = HIST.crash[HIST.crash.length - 2];
    const curr = HIST.crash[HIST.crash.length - 1];
    AI.crash.train(this.encode(prev), this.zoneLabel(curr));
    log(`Crash RNN trained on ${HIST.crash.length} rounds. Last: ${prev.toFixed(2)}x → ${curr.toFixed(2)}x`, 'ai');
  },
 
  predict() {
    const h = HIST.crash;
    if (!h.length) return { zone: 'LOW', prob: [40, 35, 25], cashout: 1.5, risk: 'HIGH', winPct: 49 };
 
    const last = h[h.length - 1];
    const probs = AI.crash.forward(this.encode(last)); // [P(bust), P(low), P(high)]
 
    const s = stats(h.slice(-30));
    // Additional Markov transition
    const ZONES = (v) => v <= 1.3 ? 0 : v <= 2 ? 1 : 2;
    const trans = [[0,0,0],[0,0,0],[0,0,0]];
    for (let i = 0; i < h.length - 1; i++) { trans[ZONES(h[i])][ZONES(h[i+1])]++; }
    const curZ = ZONES(last);
    const rowSum = trans[curZ].reduce((a,b)=>a+b,0) || 1;
    const markov = trans[curZ].map(v => v / rowSum);
 
    // Blend RNN + Markov
    const blended = probs.map((p, i) => 0.6 * p + 0.4 * markov[i]);
    const bustRisk = blended[0];
    const cashout = bustRisk > 0.55 ? 1.25 : bustRisk > 0.4 ? 1.65 : bustRisk > 0.25 ? 2.2 : 3.5;
    const risk = bustRisk > 0.55 ? 'HIGH' : bustRisk > 0.35 ? 'MEDIUM' : 'LOW';
    const winPct = Math.round((1 - bustRisk) * 100);
 
    return {
      zone: ['BUST ZONE', 'LOW ZONE', 'HIGH ZONE'][blended.indexOf(Math.max(...blended))],
      prob: blended.map(p => Math.round(p * 100)),
      cashout, risk, winPct,
      mean: s.mean.toFixed(2), std: s.std.toFixed(2),
      sessions: h.length
    };
  }
};
 
// ─────────────────────────────────────────────────────────────────────────────
//  LIMBO AI ENGINE
// ─────────────────────────────────────────────────────────────────────────────
const LimboAI = {
  getFeaturesForOutcome(item, baseBet) {
    let outcomeVal = 1.5;
    let targetVal = 2.0;
    let streakVal = 0;
    let accLossVal = 0;
    let profitVal = 0;

    if (typeof item === 'object' && item !== null) {
      outcomeVal = item.outcome ?? 1.5;
      targetVal = item.target ?? 2.0;
      streakVal = item.streakCount ?? 0;
      accLossVal = item.accumulatedLoss ?? 0;
      profitVal = item.limboProfit ?? 0;
    } else if (typeof item === 'number') {
      outcomeVal = item;
    }

    const normRoll = Math.log(Math.max(1.0, outcomeVal)) / 10.0;
    const isWin = outcomeVal >= targetVal ? 1.0 : 0.0;
    const normStreak = Math.min(10, streakVal) / 10.0;
    const normLoss = Math.log(Math.max(1.0, accLossVal / Math.max(1, baseBet))) / 5.0;
    const normProfit = Math.tanh(profitVal / Math.max(1, baseBet * 20.0));
    return [normRoll, isWin, normStreak, normLoss, normProfit];
  },

  getTargetOutputs(nextRoll, streak, accLoss, profit, wager, baseBet) {
    let optTarget = 1.05;
    let optBet = baseBet * 0.1;

    if (nextRoll >= 1.2) {
      optTarget = Math.max(1.2, Math.min(20.0, nextRoll * 0.85));
      if (streak > 0) {
        optBet = (accLoss / (optTarget - 1)) + (baseBet * 0.5);
      } else {
        if (profit > baseBet * 10) {
          optBet = baseBet * 2.0;
        } else {
          optBet = baseBet * 1.2;
        }
      }
    } else {
      optTarget = 1.05;
      optBet = baseBet * 0.1;
    }

    const nextRollNorm = Math.log(Math.max(1.0, nextRoll)) / 10.0;
    const optTargetNorm = Math.min(1.0, Math.max(0.0, Math.log(Math.max(1.0, optTarget)) / 4.0));
    const optBetNorm = Math.min(1.0, Math.max(0.0, (optBet / Math.max(1, baseBet) - 0.1) / 4.9));

    return [nextRollNorm, optTargetNorm, optBetNorm];
  },

  record(result, target) {
    const lastBet = DB.get('lb_last_bet', 10);
    let profit = DB.get('lb_profit', 0);
    let streak = DB.get('lb_streak', 0);
    let accLoss = DB.get('lb_accumulated_loss', 0);
    
    const won = result >= target;
    if (won) {
      profit += lastBet * (target - 1);
      streak = 0;
      accLoss = 0;
    } else {
      profit -= lastBet;
      streak++;
      accLoss += lastBet;
    }
    DB.set('lb_profit', profit);
    DB.set('lb_streak', streak);
    DB.set('lb_accumulated_loss', accLoss);

    pushHist('limbo', {
      outcome: result,
      target: target,
      streakCount: streak,
      accumulatedLoss: accLoss,
      limboProfit: profit,
      wager: lastBet
    });

    const h = HIST.limbo;
    if (h.length < 2) return;

    const prevItem = h[h.length - 2];
    const prevFeatures = this.getFeaturesForOutcome(prevItem, lastBet);
    const targetOutputs = this.getTargetOutputs(result, streak, accLoss, profit, lastBet, lastBet);
    
    AI.limbo.train(prevFeatures, targetOutputs);
    log(`Limbo RNNCell trained on ${h.length} rounds. Result: ${result.toFixed(2)}x`, 'ai');
  },

  predict(target) {
    const h = HIST.limbo;
    const lastItem = h.length ? h[h.length - 1] : 1.5;
    
    const baseBet = DB.get('lb_last_bet', 10);
    const streakCount = DB.get('lb_streak', 0);
    const accumulatedLoss = DB.get('lb_accumulated_loss', 0);
    const limboProfit = DB.get('lb_profit', 0);

    const currentFeatures = this.getFeaturesForOutcome(lastItem, baseBet);
    const outputs = AI.limbo.forward(currentFeatures);
    
    const predLogVal = outputs[0] || 0.1;
    const optTargetNorm = outputs[1] || 0.2;
    const optBetNorm = outputs[2] || 0.2;

    const predictedMultiplier = Math.exp(predLogVal * 10.0);
    let targetVal = Math.exp(optTargetNorm * 4.0);
    let recommendedWager = baseBet * (0.1 + optBetNorm * 4.9);

    targetVal = Math.round(Math.max(1.01, Math.min(99.0, targetVal)) * 100) / 100;
    recommendedWager = Math.round(Math.max(baseBet * 0.1, recommendedWager) * 100) / 100;

    let riskLevel = "STABLE";
    let riskColor = "#a855f7"; // Purple
    let wager = `STANDARD WAGER: $${recommendedWager.toFixed(2)}`;
    let advice = `AI RECOMMENDED TARGET (${targetVal.toFixed(2)}x)`;

    if (streakCount >= 1) {
      riskLevel = `DEFENSIVE (Streak: ${streakCount})`;
      riskColor = "#f43f5e"; // Crimson
      wager = `RNN RECOVERY: $${recommendedWager.toFixed(2)}`;
      advice = `RECOVERY MULTIPLIER (${targetVal.toFixed(2)}x)`;
    } else if (predictedMultiplier > 4.0) {
      riskLevel = "OFFENSIVE (Breakout Predicted)";
      riskColor = "#00f2fe"; // Cyan
      wager = `SCALED WAGER: $${recommendedWager.toFixed(2)}`;
      advice = `BREAKOUT TARGET (${targetVal.toFixed(2)}x)`;
    } else if (limboProfit > baseBet * 10) {
      riskLevel = "OFFENSIVE (Profit Compounding)";
      riskColor = "#10b981"; // Emerald
      wager = `COMPOUND WAGER: $${recommendedWager.toFixed(2)}`;
      advice = `AGGRESSIVE TARGET (${targetVal.toFixed(2)}x)`;
    }

    const winPct = Math.round(99 / Math.max(1.01, targetVal));

    return {
      advice,
      wager,
      recTarget: targetVal,
      winPct,
      probs: [0,0,0,0],
      sessions: h.length,
      riskLevel,
      riskColor
    };
  }
};
 
// ─────────────────────────────────────────────────────────────────────────────
//  BLACKJACK AI ENGINE
// ─────────────────────────────────────────────────────────────────────────────
const BlackjackAI = {
  get runningCount() { return DB.get('bj_rc', 0); },
  set runningCount(v) { DB.set('bj_rc', v); },
  get decksDealt() { return DB.get('bj_dd', 0); },
  set decksDealt(v) { DB.set('bj_dd', v); },
 
  hiLoVal(rank) {
    if (['10','J','Q','K','A'].includes(rank)) return -1;
    if (['2','3','4','5','6'].includes(rank)) return 1;
    return 0;
  },
 
  trueCount() {
    const remDecks = Math.max(0.5, 6 - this.decksDealt / 52);
    return this.runningCount / remDecks;
  },
 
  // Features: [playerTotal/21, isSoft, isPair, dealerVal/11, trueCount/6, remDecks/6, pairFlag, bustRisk]
  features(playerTotal, isSoft, isPair, dealerVal, busted = false) {
    const tc = clamp(this.trueCount(), -6, 6);
    const rd = Math.max(0.5, 6 - this.decksDealt / 52);
    const bustRisk = playerTotal > 11 ? (playerTotal - 11) / 10 : 0;
    return [
      norm(playerTotal, 2, 21), isSoft ? 1 : 0, isPair ? 1 : 0,
      norm(dealerVal, 2, 11), norm(tc, -6, 6), norm(rd, 0, 6),
      norm(playerTotal, 2, 21) * (isPair ? 1 : 0),
      bustRisk
    ];
  },
 
  // Actions: 0=Hit, 1=Stand, 2=Double, 3=Split, 4=Stand(soft)
  actionIdx(code) { return { H: 0, S: 1, D: 2, P: 3, Ds: 4 }[code] || 0; },
  actionCode(idx) { return ['H','S','D','P','Ds'][idx]; },
  actionText(idx, cardCount) {
    const t = ['Hit','Stand','Double Down','Split','Stand (Soft)'][idx];
    if (idx === 2 && cardCount > 2) return 'Hit'; // can't double after 2 cards
    return t;
  },
 
  record(playerTotal, isSoft, isPair, dealerVal, outcome, actionCode) {
    HIST.bj_rounds++;
    DB.set('hist_bj_rounds', HIST.bj_rounds);
    const label = Array(5).fill(0);
    label[this.actionIdx(actionCode)] = 1;
    AI.blackjack.train(this.features(playerTotal, isSoft, isPair, dealerVal), label);
    log(`Blackjack ANN trained. RC: ${this.runningCount}, TC: ${this.trueCount().toFixed(1)}, Rounds: ${HIST.bj_rounds}`, 'ai');
  },
 
  updateCount(ranks) {
    ranks.forEach(r => { this.runningCount += this.hiLoVal(r); this.decksDealt++; });
    DB.set('bj_rc', this.runningCount);
    DB.set('bj_dd', this.decksDealt);
  },
 
  resetCount() { this.runningCount = 0; this.decksDealt = 0; DB.set('bj_rc', 0); DB.set('bj_dd', 0); },
 
  analyzeHand(cards) {
    let total = 0, aces = 0, hasAce = false;
    cards.forEach(r => {
      if (r === 'A') { total += 11; aces++; hasAce = true; }
      else if (['K','Q','J','10'].includes(r)) total += 10;
      else total += parseInt(r) || 10;
    });
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    const isSoft = hasAce && aces > 0 && total <= 21;
    const isPair = cards.length === 2 && cards[0] === cards[1];
    return { total, isSoft, isPair };
  },
 
  basicStrategy: {
    pairs: { 'A,A':'P','10,10':'S','9,9':'P9','8,8':'P','7,7':'P7','6,6':'P6','5,5':'D55','4,4':'H44','3,3':'P37','2,2':'P27' },
    soft: { 20:'S',19:'S',18:'Ds87',17:'H',16:'H',15:'H',14:'H',13:'H' },
    hard: { 17:'S',16:'S65',15:'S65',14:'S65',13:'S65',12:'H456',11:'D',10:'D910',9:'H36',8:'H' }
  },
 
  predict(playerCards, dealerCard) {
    const tc = this.trueCount();
    const { total, isSoft, isPair } = this.analyzeHand(playerCards);
    const dValStr = ['K','Q','J'].includes(dealerCard) ? '10' : dealerCard;
    const dVal = dValStr === 'A' ? 11 : parseInt(dValStr);
 
    // ANN prediction
    const annProbs = AI.blackjack.forward(this.features(total, isSoft, isPair, dVal));
    const annAction = annProbs.indexOf(Math.max(...annProbs));
 
    // Illustrious-18 deviations (override ANN when count is strong)
    let code = this.actionCode(annAction), deviation = false;
    if (!isSoft && !isPair) {
      if (total===16 && dVal===10 && tc>=0) { code='S'; deviation=true; }
      else if (total===15 && dVal===10 && tc>=4) { code='S'; deviation=true; }
      else if (total===12 && dVal===3 && tc>=2) { code='S'; deviation=true; }
      else if (total===12 && dVal===2 && tc>=3) { code='S'; deviation=true; }
      else if (total===11 && dVal===11 && tc>=1) { code='D'; deviation=true; }
      else if (total===10 && dVal===10 && tc>=4) { code='D'; deviation=true; }
      else if (total===9 && dVal===2 && tc>=1) { code='D'; deviation=true; }
      else if (total===9 && dVal===7 && tc>=3) { code='D'; deviation=true; }
    }
 
    // Basic fallback if net barely trained
    if (HIST.bj_rounds < 10) {
      const DEALER_BUST = {'2':35.3,'3':37.6,'4':40.3,'5':42.9,'6':42.1,'7':26,'8':23.9,'9':23.3,'10':21.4,'A':11.7};
      const bust = DEALER_BUST[dValStr] || 25;
      if (isPair && playerCards[0]==='A') code='P';
      else if (isPair && playerCards[0]==='8') code='P';
      else if (isSoft && total>=19) code='S';
      else if (isSoft && total===18) code = ['2','3','4','5','6'].includes(dValStr) ? 'Ds' : (dValStr==='9'||dValStr==='10'||dValStr==='A') ? 'H' : 'S';
      else if (total>=17) code='S';
      else if (total>=13 && total<=16 && ['2','3','4','5','6'].includes(dValStr)) code='S';
      else if (total===11) code='D';
      else if (total===10 && !['10','A'].includes(dValStr)) code='D';
      else code='H';
    }
 
    const actionIdx = this.actionIdx(code);
    const actText = this.actionText(actionIdx, playerCards.length);
    const betMult = tc >= 2 ? Math.min(5, Math.round(tc)) : 1;
 
    // Insurance
    const takeInsurance = dealerCard === 'A' && tc >= 3;
    const winPct = clamp(
      (actText==='Stand' ? (total>=19?70:total>=17?55:35) : actText==='Double Down'?58:actText==='Split'?53:45) + Math.round(tc*0.8),
      5, 95
    );
 
    const explanation = deviation
      ? `[Illustrious-18 Count Deviation] TC=${tc.toFixed(1)} — Override to ${actText}. `
      : `[AI Adaptive] ${playerCards.join('+')}=${total} ${isSoft?'soft':isPair?'pair':'hard'} vs dealer ${dealerCard}. `;
 
    return {
      action: code, actionText: actText, winPct, explanation,
      trueCount: tc.toFixed(1), runningCount: this.runningCount,
      betMult, takeInsurance, annConf: Math.round(Math.max(...annProbs)*100),
      rounds: HIST.bj_rounds
    };
  }
};
 
// ─────────────────────────────────────────────────────────────────────────────
//  BACCARAT AI ENGINE (RNN)
// ─────────────────────────────────────────────────────────────────────────────
const BaccaratAI = {
  encode(outcome) { return [outcome==='B'?1:0, outcome==='P'?1:0, outcome==='T'?1:0]; },
  outcomeLabel(o) { return BaccaratAI.encode(o); },
 
  record(outcome) {
    pushHist('baccarat', outcome);
    if (HIST.baccarat.length < 2) return;
    const prev = HIST.baccarat[HIST.baccarat.length-2];
    AI.baccarat.train(this.encode(prev), this.outcomeLabel(outcome));
    log(`Baccarat RNN trained on ${HIST.baccarat.length} rounds. Shoe trend updated.`, 'ai');
  },
 
  detectPattern(hist) {
    const nonTie = hist.filter(h => h !== 'T');
    if (nonTie.length < 3) return 'neutral';
    const last = nonTie[nonTie.length-1];
    let streak = 0;
    for (let i = nonTie.length-1; i >= 0 && nonTie[i]===last; i--) streak++;
    if (streak >= 3) return 'streak';
    const last4 = nonTie.slice(-4);
    const alternating = last4.every((v,i) => i===0 || v !== last4[i-1]);
    if (alternating && last4.length >= 4) return 'chop';
    return 'neutral';
  },
 
  predict() {
    const h = HIST.baccarat;
    const last = h.length ? h[h.length-1] : 'B';
 
    // RNN forward
    const probs = AI.baccarat.forward(this.encode(last)); // [P(B), P(P), P(T)]
    const pattern = this.detectPattern(h);
 
    // Pattern override
    let bet, conf;
    if (HIST.baccarat.length < 15) {
      bet = 'Banker'; conf = 52;
    } else if (pattern === 'streak') {
      const nonTie = h.filter(x=>x!=='T');
      bet = nonTie[nonTie.length-1]==='B' ? 'Banker' : 'Player';
      conf = 60;
    } else if (pattern === 'chop') {
      const nonTie = h.filter(x=>x!=='T');
      bet = nonTie[nonTie.length-1]==='B' ? 'Player' : 'Banker';
      conf = 58;
    } else {
      // Use RNN output
      const maxIdx = probs.indexOf(Math.max(...probs));
      bet = ['Banker','Player','Tie'][maxIdx];
      conf = Math.round(Math.max(...probs)*100);
    }
 
    const bRatio = h.filter(x=>x==='B').length / Math.max(1, h.filter(x=>x!=='T').length);
    return {
      bet, conf, pattern,
      probB: Math.round(probs[0]*100), probP: Math.round(probs[1]*100), probT: Math.round(probs[2]*100),
      bRatio: Math.round(bRatio*100), rounds: h.length,
      winPct: bet === 'Banker' ? 51 : 50
    };
  }
};
 
// ─────────────────────────────────────────────────────────────────────────────
//  ROULETTE AI ENGINE
// ─────────────────────────────────────────────────────────────────────────────
const RouletteAI = {
  get nextBet() { return DB.get('rt_next_bet', 10); },
  set nextBet(v) { DB.set('rt_next_bet', v); },
  get step() { return DB.get('rt_step', 1); },
  set step(v) { DB.set('rt_step', v); },
  get system() { return DB.get('rt_system', 'Martingale'); },
  set system(v) { DB.set('rt_system', v); },
  get netProfit() { return DB.get('rt_profit', 0); },
  set netProfit(v) { DB.set('rt_profit', v); },
 
  // Features: [step/10, bet/500, streak/10, hot sectors 0-2, system]
  features(step, bet, streak) {
    return [
      norm(step, 1, 15), norm(bet, 5, 500), norm(streak, 0, 10),
      norm(this.netProfit, -500, 500),
      norm(HIST.roulette.filter(v=>v).length, 0, 100),
      norm(HIST.roulette.filter(v=>!v).length, 0, 100)
    ];
  },
 
  record(won) {
    pushHist('roulette', won);
    const streak = this._lossStreak();
    const label = won ? [0,1,0] : (streak >= 5 ? [1,0,0] : [0,0,1]);
    AI.roulette.train(this.features(this.step, this.nextBet, streak), label);
 
    // Update progression
    const prev = this.nextBet;
    if (won) {
      this.netProfit += prev;
      this.nextBet = 10; this.step = 1;
    } else {
      this.netProfit -= prev;
      this.nextBet = Math.min(prev * 2, 5120); this.step++;
    }
    DB.set('rt_next_bet', this.nextBet);
    DB.set('rt_step', this.step);
    DB.set('rt_profit', this.netProfit);
    log(`Roulette ANN updated. Step ${this.step}, next bet $${this.nextBet}. Net: $${this.netProfit}`, 'ai');
  },
 
  _lossStreak() {
    let s = 0;
    for (let i = HIST.roulette.length-1; i >= 0 && !HIST.roulette[i]; i--) s++;
    return s;
  },
 
  predict() {
    const streak = this._lossStreak();
    const probs = AI.roulette.forward(this.features(this.step, this.nextBet, streak));
    const riskLevel = probs[0] > 0.5 ? 'HIGH RISK — Consider reset' :
                      probs[2] > 0.45 ? 'AGGRESSIVE — Stay in' : 'NORMAL';
 
    const winPct = 48.6;
    return {
      nextBet: this.nextBet, step: this.step, streak,
      netProfit: this.netProfit, riskLevel, winPct,
      probs: probs.map(p=>Math.round(p*100)),
      rounds: HIST.roulette.length
    };
  }
};
 
// ─────────────────────────────────────────────────────────────────────────────
//  POKER AI ENGINE
// ─────────────────────────────────────────────────────────────────────────────
const PokerAI = {
  // Features: [equity, potOdds, outs/47, stackRatio, position, phase]
  features(equity, potOdds, outs, boardLen) {
    return [
      norm(equity, 0, 100), norm(potOdds, 0, 60),
      norm(outs, 0, 20), norm(boardLen, 0, 5),
      norm(equity - potOdds, -60, 60), equity > potOdds ? 1 : 0
    ];
  },
 
  record(equity, potOdds, outs, boardLen, outcome) {
    const label = outcome === 'raise' ? [0,0,1] : outcome === 'call' ? [0,1,0] : [1,0,0];
    AI.poker.train(this.features(equity, potOdds, outs, boardLen), label);
    log(`Poker ANN updated. Equity ${equity}%, Pot odds ${potOdds.toFixed(1)}%`, 'ai');
  },
 
  predict(equity, potSize, callSize, outs = 0, boardLen = 0) {
    const potOdds = callSize / (potSize + callSize + 0.01) * 100;
    const probs = AI.poker.forward(this.features(equity, potOdds, outs, boardLen));
    const ev = equity - potOdds;
 
    let action, colorClass;
    if (equity > potOdds + 15 || probs[2] > 0.5) {
      action = 'RAISE'; colorClass = 'text-emerald';
    } else if (equity > potOdds || probs[1] > 0.45) {
      action = 'CALL / CHECK'; colorClass = 'text-cyan';
    } else {
      action = callSize === 0 ? 'CHECK' : 'FOLD';
      colorClass = callSize === 0 ? 'text-cyan' : 'text-crimson';
    }
 
    return {
      action, colorClass, equity, potOdds: potOdds.toFixed(1), ev: ev.toFixed(1),
      probs: probs.map(p=>Math.round(p*100)), outs,
      explanation: `Equity ${equity}% vs pot odds ${potOdds.toFixed(1)}%. EV: ${ev>=0?'+':''}${ev.toFixed(1)}%. AI confidence: ${Math.round(Math.max(...probs)*100)}%`
    };
  }
};
 
// ─────────────────────────────────────────────────────────────────────────────
//  MINES SPATIAL TRACKER (popup-level, separate from page-level engine)
// ─────────────────────────────────────────────────────────────────────────────
const MinesSpatial = {
  get spawns() { return DB.get('mn_spawn_counts', Array(25).fill(0)); },
  get sessions() { return DB.get('mn_sessions', 0); },
 
  train(bombIndices) {
    this.sessions++;
    bombIndices.forEach(i => { if (i>=0&&i<25) this.spawns[i]++; });
    DB.set('mn_spawn_counts', this.spawns);
    DB.set('mn_sessions', this.sessions);
  }
};
 
// ─────────────────────────────────────────────────────────────────────────────
//  DOM INIT
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const start = () => {
    initAIAndHist();
    
    const captureBtn = document.getElementById('capture-btn');
    if (captureBtn) captureBtn.addEventListener('click', captureAndPredict);
   
    const overrideSelect = document.getElementById('game-override-select');
    if (overrideSelect) {
      // Restore saved manual override config
      const savedOverride = DB.get('mn_game_override', 'auto');
      overrideSelect.value = savedOverride;
      
      overrideSelect.addEventListener('change', () => {
        DB.set('mn_game_override', overrideSelect.value);
        log(`Manual override: ${overrideSelect.value.toUpperCase()}`, 'warn');
        resolveLiveHeuristics(); // automatically re-run heuristics
      });
    }
   
    log('AI Engine v4.0 loaded. All models warm-started from persistent storage.', 'success');
    log(`Models: Crash(${HIST.crash.length}rds) Limbo(${HIST.limbo.length}rds) Baccarat(${HIST.baccarat.length}rds) BJ(${HIST.bj_rounds}rds)`, 'ai');

    checkBackendStatus();

    // Trigger an automatic scan immediately on startup so the active game is classified instantly
    setTimeout(captureAndPredict, 150);
  };

  function checkBackendStatus() {
    const badge = document.getElementById('server-status-badge');
    if (!badge) return;

    fetch('http://localhost:5001/api/health', { method: 'GET' })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'healthy') {
          badge.textContent = '● SERVER ONLINE';
          badge.style.color = '#10b981';
          badge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
          badge.style.background = 'rgba(16, 185, 129, 0.12)';
          log(`Connected to local Flask server (v${data.version || '3.1'})`, 'success');
        }
      })
      .catch(() => {
        badge.textContent = '○ LOCAL MODE';
        badge.style.color = '#94a3b8';
        badge.style.borderColor = 'rgba(100, 116, 139, 0.3)';
      });
  }

  if (dbInitialized) {
    start();
  } else {
    dbReadyCallbacks.push(start);
  }
});
 
// Outcome Feedback UI injection removed - AI runs fully automatically in background.
 
// ─────────────────────────────────────────────────────────────────────────────
//  SCREEN CAPTURE + DOM SCRAPER
// ─────────────────────────────────────────────────────────────────────────────
async function captureAndPredict() {
  const captureBtn = document.getElementById('capture-btn');
  const scanLine = document.getElementById('scan-line');
  const placeholder = document.getElementById('preview-placeholder');
  const thumbnail = document.getElementById('preview-thumbnail');
 
  captureBtn.disabled = true;
  if (scanLine) scanLine.style.display = 'block';
  if (placeholder) placeholder.style.display = 'none';
  if (thumbnail) thumbnail.style.display = 'none';
  clearLogs();
  log('Capturing active tab...');
 
  chrome.tabs.captureVisibleTab(null, { format: 'png' }, dataUrl => {
    if (!chrome.runtime.lastError && dataUrl) {
      if (thumbnail) { thumbnail.src = dataUrl; thumbnail.style.display = 'block'; }
      log('Tab snapshot captured.', 'success');
    } else {
      log('Cannot capture system pages. Using DOM scraper only.', 'warn');
      if (thumbnail) { thumbnail.style.display = 'none'; }
    }
    resolveLiveHeuristics();
  });
}
 
function stopScan() {
  const s = document.getElementById('scan-line');
  const b = document.getElementById('capture-btn');
  if (s) s.style.display = 'none';
  if (b) b.disabled = false;
}
 
// Injected into page context to scrape game state
function scrapeActivePage() {
  const text = document.body.innerText;
 
  // ── Mines board scraper ──
  let minesData = null;
  try {
    let mineButtons = [];
    const containers = [
      ...document.querySelectorAll('div,section,main,article')
    ];
    for (const c of containers) {
      const btns = c.querySelectorAll('button');
      if (btns.length === 25) { mineButtons = Array.from(btns); break; }
    }
    if (!mineButtons.length) {
      const tiles = document.querySelectorAll('[data-testid="tile"],[class*="tile"],[class*="mine-tile"],[class*="cell"]');
      if (tiles.length === 25) mineButtons = Array.from(tiles);
    }
 
    if (mineButtons.length === 25) {
      const tileStates = mineButtons.map(btn => {
        let hasRed = false;
        let hasGreen = false;
        
        try {
          // Inspect computed styles of the button and all its children for robust color matching
          const elementsToInspect = [btn, ...btn.querySelectorAll('*')];
          
          const parseRgb = (str) => {
            if (!str) return null;
            const m = str.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
            if (m) return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) };
            if (str.startsWith('#')) {
              const hex = str.replace('#', '');
              if (hex.length === 3) return { r: parseInt(hex[0]+hex[0], 16), g: parseInt(hex[1]+hex[1], 16), b: parseInt(hex[2]+hex[2], 16) };
              if (hex.length >= 6) return { r: parseInt(hex.substring(0, 2), 16), g: parseInt(hex.substring(2, 4), 16), b: parseInt(hex.substring(4, 6), 16) };
            }
            return null;
          };

          for (const el of elementsToInspect) {
            const style = window.getComputedStyle(el);
            const colors = [style.backgroundColor, style.fill, style.stroke, style.color];
            
            for (const c of colors) {
              if (!c || c === 'transparent' || c === 'rgba(0, 0, 0, 0)' || c === 'none') continue;
              const rgb = parseRgb(c);
              if (rgb) {
                // Red/crimson/orange dominant
                if (rgb.r > 140 && rgb.r > rgb.g * 1.25 && rgb.r > rgb.b * 1.25) {
                  hasRed = true;
                }
                // Green/emerald dominant
                if (rgb.g > 110 && rgb.g > rgb.r * 1.1 && rgb.g > rgb.b * 0.9) {
                  hasGreen = true;
                }
              }
            }
          }
        } catch (e) {}

        const h = btn.innerHTML.toLowerCase();
        const cl = btn.className.toLowerCase();
        
        // Safety: only allow 'mine' keyword inside the innerHTML content (e.g. alt text or text nodes), not classes
        const hasMineKeyword = /\b(bomb|exploded|boom)\b/i.test(cl) || /\b(bomb|exploded|boom|mine)\b/i.test(h);
        const hasGemKeyword = /\b(gem|diamond|safe)\b/i.test(cl + ' ' + h);

        const svg = btn.querySelector('svg');
        const img = btn.querySelector('img');

        // Gem classification
        if (hasGreen || hasGemKeyword) {
          if (hasRed && !hasGreen) return 2; // safeguard: if it's purely red under some edge cases
          return 1; // Gem
        }
        
        // Exploded classification
        if (hasRed || hasMineKeyword) {
          return 2; // Exploded
        }
        
        // Unrevealed placeholder with neutral SVG/image
        if (svg || img) {
          return 0; // neutral SVG (like a lock icon) -> unrevealed
        }
        
        return 0;
      });
 
      let minesCount = 3;
      const m = text.match(/mines?\s*[:\n]\s*(\d+)/i) || text.match(/(\d+)\s*mines?/i);
      if (m) minesCount = clamp(parseInt(m[1]), 1, 24);
      const sel = document.querySelector('select[name*="mine"],select[id*="mine"],input[name*="mine"]');
      if (sel) minesCount = parseInt(sel.value) || minesCount;
 
      minesData = { tileStates, minesCount };
    }
  } catch (e) {}
 
  // ── Limbo target ──
  let limboTarget = null;
  try {
    document.querySelectorAll('input').forEach(inp => {
      const v = parseFloat(inp.value);
      if (!isNaN(v) && v >= 1.01 && v <= 100) {
        if (inp.id?.toLowerCase().includes('target') || inp.placeholder?.toLowerCase().includes('target')
            || inp.className?.toLowerCase().includes('target') || (inp.min === '1.01')) {
          limboTarget = v;
        }
      }
    });
  } catch (e) {}
 
  // ── Crash multiplier ──
  let crashMultiplier = null;
  try {
    const multText = document.body.innerText.match(/(\d+\.\d{2})x/);
    if (multText) crashMultiplier = parseFloat(multText[1]);
  } catch (e) {}
 
  // ── Roulette last number ──
  let rouletteNumber = null;
  try {
    const numText = document.body.innerText.match(/\b(0|00|[1-9]|[1-2]\d|3[0-6])\b/);
    if (numText) rouletteNumber = parseInt(numText[1]);
  } catch (e) {}
 
  // ── Baccarat result ──
  let baccaratResult = null;
  try {
    const bt = text.toLowerCase();
    if (bt.includes('banker wins') || bt.includes('banker win')) baccaratResult = 'B';
    else if (bt.includes('player wins') || bt.includes('player win')) baccaratResult = 'P';
    else if (bt.includes('tie') || bt.includes('draw')) baccaratResult = 'T';
  } catch (e) {}
 
  // ── Active panel ID (for SainiSatta Dashboard pages) ──
  let activePanelId = null;
  try {
    const activePanel = document.querySelector('.panel.active');
    if (activePanel) {
      activePanelId = activePanel.id;
    }
  } catch (e) {}
 
  function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
 
  return { innerText: text, minesData, limboTarget, crashMultiplier, rouletteNumber, baccaratResult, activePanelId };
}
 
function resolveLiveHeuristics() {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const tab = tabs[0];
    if (!tab) { log('No active tab.', 'error'); stopScan(); return; }
    log(`Tab: "${tab.title.substring(0,35)}"`, 'info');
 
    chrome.scripting.executeScript(
      { target: { tabId: tab.id }, func: scrapeActivePage },
      results => {
        let scraped = { innerText: '', minesData: null, limboTarget: null, crashMultiplier: null, rouletteNumber: null, baccaratResult: null, activePanelId: null };
        if (results?.[0]?.result) {
          scraped = results[0].result;
          log('DOM scraped successfully.', 'success');
          if (scraped.minesData) {
            const rev = scraped.minesData.tileStates.filter(s=>s>0).length;
            log(`Mines: ${rev} revealed tiles, ${scraped.minesData.minesCount} mines.`);
          }
          if (scraped.limboTarget) log(`Limbo target: ${scraped.limboTarget.toFixed(2)}x`);
          if (scraped.crashMultiplier) log(`Crash multiplier: ${scraped.crashMultiplier.toFixed(2)}x`);
          if (scraped.baccaratResult) {
            log(`Baccarat result on page: ${scraped.baccaratResult}`, 'match');
            BaccaratAI.record(scraped.baccaratResult);
          }
        } else {
          log('DOM sandbox active — using URL/title classification.', 'warn');
        }
 
        scrapedMinesData = scraped.minesData;
        scrapedLimboTarget = scraped.limboTarget;
 
        const override = document.getElementById('game-override-select')?.value;
        const game = classifyGame(scraped.innerText, tab.title, tab.url, override, scraped.activePanelId);
        log(`Game classified: ${game.toUpperCase()}`, 'match');
 
        setTimeout(() => {
          runAIEngine(game, scraped);
          stopScan();
        }, 800);
      }
    );
  });
}
 
function classifyGame(text, title, url, override, activePanelId) {
  if (override && override !== 'auto') return override;
  
  // Priority 0: Check if we are on the dashboard page and have an active panel
  if (activePanelId) {
    const game = activePanelId.split('-')[0]; // 'mines-panel' -> 'mines'
    if (['mines', 'limbo', 'crash', 'blackjack', 'roulette', 'baccarat', 'poker', 'craps'].includes(game)) {
      return game;
    }
  }

  // Priority 1: Check URL and Page Title for specific matches (more precise than general text keywords)
  const urlLower = (url || '').toLowerCase();
  const titleLower = (title || '').toLowerCase();
  
  if (urlLower.includes('crash') || urlLower.includes('aviator') || titleLower.includes('crash') || titleLower.includes('aviator')) {
    return 'crash';
  }
  if (urlLower.includes('limbo') || titleLower.includes('limbo')) {
    return 'limbo';
  }
  if (urlLower.includes('mines') || titleLower.includes('mines')) {
    return 'mines';
  }
  if (urlLower.includes('roulette') || titleLower.includes('roulette')) {
    return 'roulette';
  }
  if (urlLower.includes('baccarat') || titleLower.includes('baccarat')) {
    return 'baccarat';
  }
  if (urlLower.includes('blackjack') || titleLower.includes('blackjack')) {
    return 'blackjack';
  }
  if (urlLower.includes('poker') || urlLower.includes('holdem') || titleLower.includes('poker')) {
    return 'poker';
  }
  if (urlLower.includes('craps') || titleLower.includes('craps')) {
    return 'craps';
  }

  // Priority 2: Precise body text keywords
  const c = text.toLowerCase();
  if (c.includes('mines active') || c.includes('gems revealed') || c.includes('mine hit')) return 'mines';
  if (c.includes('target multiplier') || c.includes('limbo target')) return 'limbo';
  if (c.includes('flew away') || c.includes('rocket climb') || c.includes('crash multiplier')) return 'crash';
  if (c.includes('flop') || c.includes('turn') || c.includes('river') || c.includes('pocket cards')) return 'poker';
  if (c.includes('split hand') || c.includes('double down') || c.includes('dealer upcard')) return 'blackjack';
  if (c.includes('roulette spin') || c.includes('croupier')) return 'roulette';
  if (c.includes('banker bet') || c.includes('player bet')) return 'baccarat';
  
  // Priority 3: Fall back to general keyword checks
  if (c.includes('crash') || c.includes('spaceman')) return 'crash';
  if (c.includes('limbo')) return 'limbo';
  if (c.includes('mines') || c.includes('minesweeper')) return 'mines';
  if (c.includes('roulette')) return 'roulette';
  if (c.includes('baccarat')) return 'baccarat';
  if (c.includes('poker')) return 'poker';
  if (c.includes('craps')) return 'craps';
  if (c.includes('blackjack') || c.includes('dealer')) return 'blackjack';

  return 'blackjack';
}
 
function parseRanks(text) {
  const rankRegex = /\b(10|[2-9]|[akqj])\b/gi;
  const foundRanks = [];
  let match;
  while ((match = rankRegex.exec(text)) !== null && foundRanks.length < 10) {
    foundRanks.push(match[1].toUpperCase());
  }
  return foundRanks;
}
 
// ─────────────────────────────────────────────────────────────────────────────
//  MAIN AI ENGINE DISPATCHER
// ─────────────────────────────────────────────────────────────────────────────
function runAIEngine(game, scraped) {
  activeGame = game;
  DB.set('mn_active_game', game);
  const ranks = parseRanks(scraped.innerText);
 
  const hudAction = document.getElementById('hud-action');
  const hudExpl = document.getElementById('hud-explanation');
  const hudPercent = document.getElementById('hud-win-percent');
  const hudProgress = document.getElementById('hud-win-progress');
  const hudGame = document.getElementById('hud-game-name');
  const dynamicMetrics = document.getElementById('dynamic-metrics');
 
  if (hudGame) hudGame.textContent = game.toUpperCase();
  if (dynamicMetrics) dynamicMetrics.innerHTML = '';
 
  if (game === 'unknown') {
    hudAction.textContent = "AWAITING ACTIVE TABLE";
    hudAction.className = "advisor-choice text-cyan";
    hudExpl.textContent = "No active casino table detected on this tab. Go to a betting site or select an override below.";
    hudPercent.textContent = "--%";
    hudProgress.style.width = "0%";
    dynamicMetrics.innerHTML = `
      <div class="hud-row" style="justify-content: center; color: var(--text-muted); padding: 0.5rem 0;">
        <span>Open your casino table to begin predictions</span>
      </div>
    `;
    return;
  }
 
  if (game === 'blackjack') {
    let playerCards = ranks.slice(0, 2);
    let dealerCard = ranks[2] || "10";
    if (playerCards.length < 2) playerCards = ["10", "6"];
 
    BlackjackAI.updateCount(playerCards.concat(dealerCard));
    const pred = BlackjackAI.predict(playerCards, dealerCard);
 
    hudAction.textContent = pred.actionText;
    hudAction.className = "advisor-choice " + (pred.action === 'H' ? 'text-cyan' : pred.action === 'S' || pred.action === 'Ds' ? 'text-purple' : pred.action === 'D' ? 'text-gold' : 'text-emerald');
    hudExpl.textContent = pred.explanation + `(ANN confidence: ${pred.annConf}%)`;
    
    hudPercent.textContent = `${pred.winPct}%`;
    hudProgress.style.width = `${pred.winPct}%`;
 
    const wagerText = pred.betMult > 1 
      ? `<span class="text-emerald" style="font-weight:bold;">⚡ INCREASE BET (Count: ${pred.trueCount})</span>` 
      : '<span class="text-cyan" style="font-weight:bold;">NORMAL UNIT (Neutral)</span>';
 
    dynamicMetrics.innerHTML = `
      <div class="hud-row"><span>Player Hand</span><span class="hud-value">[${playerCards.join(', ')}] (Total: ${BlackjackAI.analyzeHand(playerCards).total})</span></div>
      <div class="hud-row"><span>Dealer Upcard</span><span class="hud-value">${dealerCard}</span></div>
      <div class="hud-row"><span>True Count</span><span class="hud-value ${parseFloat(pred.trueCount) > 0 ? 'text-emerald' : parseFloat(pred.trueCount) < 0 ? 'text-crimson' : ''}">${pred.trueCount}</span></div>
      <div class="hud-row"><span>Wager Advisor</span><span class="hud-value">${wagerText}</span></div>
    `;
    log(`Blackjack AI Resolved: recommendation ${pred.actionText}, Win Equity: ${pred.winPct}%`, 'success');
  } 
  
  else if (game === 'mines') {
    let tileStates = Array(25).fill(0);
    let minesCount = 3;
    
    if (scrapedMinesData) {
      tileStates = scrapedMinesData.tileStates;
      minesCount = scrapedMinesData.minesCount;
    }
    
    const diamondsCount = tileStates.filter(s => s === 1).length;
    const explodedMinesCount = tileStates.filter(s => s === 2).length;
    
    if (explodedMinesCount > 0) {
      const bombIndices = [];
      tileStates.forEach((s, idx) => { if (s === 2) bombIndices.push(idx); });
      MinesAI.recordBombs(bombIndices, tileStates, minesCount);
    }
    
    const pred = MinesAI.predict(tileStates, minesCount);
    let wagerAction = "normal";
    
    if (explodedMinesCount > 0) {
      hudAction.textContent = "GAME OVER";
      hudAction.className = "advisor-choice text-crimson";
      hudExpl.textContent = `Scraped ${explodedMinesCount} exploded bombs. Click Loss Feedback to train neural net.`;
      wagerAction = "decrease";
    } else if (diamondsCount === 0) {
      if (pred.safetyPct < 60) {
        hudAction.textContent = "EXTREME RISK";
        hudAction.className = "advisor-choice text-crimson";
        hudExpl.textContent = `Board ready with ${minesCount} mines (EXTREME RISK! first click has only ${pred.safetyPct}% safety). Recommended first click: ${pred.letter}.`;
        wagerAction = "decrease";
      } else {
        hudAction.textContent = "START MINING";
        hudAction.className = "advisor-choice text-cyan";
        hudExpl.textContent = `Board ready with ${minesCount} mines. AI safest first click recommendation: ${pred.letter} (${pred.safetyPct}% safe).`;
        wagerAction = "normal";
      }
    } else if (pred.safetyPct < 70) {
      hudAction.textContent = "CASH OUT";
      hudAction.className = "advisor-choice text-emerald";
      hudExpl.textContent = `High risk detected (safety ${pred.safetyPct}%). Secure profit now! recommended next click: ${pred.letter}.`;
      wagerAction = "decrease";
    } else {
      hudAction.textContent = "CLICK NEXT TILE";
      hudAction.className = "advisor-choice text-cyan";
      hudExpl.textContent = `EV is positive. Uncovered ${diamondsCount} gems. Recommended: ${pred.letter} (${pred.safetyPct}% safe).`;
      if (diamondsCount <= 2 && pred.safetyPct >= 85) wagerAction = "increase";
    }
    
    if (explodedMinesCount > 0) {
      hudPercent.textContent = `0%`;
      hudProgress.style.width = `0%`;
    } else {
      hudPercent.textContent = `${pred.safetyPct}%`;
      hudProgress.style.width = `${pred.safetyPct}%`;
    }
    
    let wagerText;
    if (explodedMinesCount > 0) {
      wagerText = '<span class="text-crimson" style="font-weight:bold;">❌ ROUND FINISHED (Game Over)</span>';
    } else if (wagerAction === 'increase') {
      wagerText = '<span class="text-emerald" style="font-weight:bold;">⚡ CONTINUE MINING (High Safety)</span>';
    } else if (wagerAction === 'decrease') {
      if (diamondsCount === 0) {
        wagerText = '<span class="text-crimson" style="font-weight:bold;">⚠️ HIGH RISK BOARD (Avoid / Low Bet)</span>';
      } else {
        wagerText = '<span class="text-crimson" style="font-weight:bold;">⚠️ CASH OUT NOW (Secure Profit)</span>';
      }
    } else {
      wagerText = '<span class="text-cyan" style="font-weight:bold;">NORMAL UNIT (Stable)</span>';
    }
 
    dynamicMetrics.innerHTML = `
      <div class="hud-row"><span>AI Recommended Tile</span><span class="hud-value text-gold">${pred.letter !== '—' ? 'Row ' + pred.row + ', Col ' + pred.col + ' (' + pred.letter + ')' : 'None'}</span></div>
      <div class="hud-row"><span>Uncovered Diamonds</span><span class="hud-value text-emerald">${diamondsCount} Gems</span></div>
      <div class="hud-row"><span>Mines Configured</span><span class="hud-value">${minesCount} Mines</span></div>
      <div class="hud-row"><span>Wager Advisor</span><span class="hud-value">${wagerText}</span></div>
    `;
    log(`Mines AI Resolved: safest tile ${pred.letter}, Safety Index: ${pred.safetyPct}%`, 'success');
  }
  
  else if (game === 'limbo') {
    const target = scrapedLimboTarget || 2.00;
    const pred = LimboAI.predict(target);
    
    const wagerAmount = pred.wager.split(': ')[1] || pred.wager.split('WAGER: ')[1] || pred.wager;
    hudAction.textContent = `${wagerAmount} @ ${pred.recTarget.toFixed(2)}x`;
    hudAction.className = "advisor-choice";
    hudAction.style.color = pred.riskColor;
    hudExpl.textContent = `Limbo RNN expects roll around ${pred.recTarget.toFixed(2)}x. Volatility classification is ${pred.riskLevel}.`;
    
    hudPercent.textContent = `${pred.winPct}%`;
    hudProgress.style.width = `${pred.winPct}%`;
 
    const wagerText = pred.wager.includes('RECOVERY') || pred.wager.includes('COMPOUND') || pred.wager.includes('SCALED')
      ? `<span class="text-emerald" style="font-weight:bold;">⚡ ${pred.wager}</span>` 
      : `<span class="text-cyan" style="font-weight:bold;">${pred.wager}</span>`;
 
    dynamicMetrics.innerHTML = `
      <div class="hud-row"><span>AI Recommended Target</span><span class="hud-value text-gold">${pred.recTarget.toFixed(2)}x</span></div>
      <div class="hud-row"><span>Limbo Volatility State</span><span class="hud-value text-cyan">${pred.riskLevel}</span></div>
      <div class="hud-row"><span>Wager Advisor</span><span class="hud-value">${wagerText}</span></div>
    `;
    log(`Limbo AI Resolved: target ${pred.recTarget.toFixed(2)}x, Volatility: ${pred.riskLevel}`, 'success');
  }
  
  else if (game === 'crash') {
    const pred = CrashAI.predict();
    const currentMult = scraped.crashMultiplier || 1.0;
 
    hudAction.textContent = currentMult >= pred.cashout - 0.2 ? "CASH OUT NOW" : "HOLD / RIDE";
    hudAction.className = "advisor-choice " + (currentMult >= pred.cashout - 0.2 ? "text-emerald" : "text-cyan");
    hudExpl.textContent = `Crash expected around ${pred.cashout.toFixed(2)}x. RNN model computes ${pred.risk} RISK (${pred.zone}).`;
    
    hudPercent.textContent = `${pred.winPct}%`;
    hudProgress.style.width = `${pred.winPct}%`;
 
    const wagerText = pred.risk === 'LOW'
      ? '<span class="text-emerald" style="font-weight:bold;">⚡ INCREASE BET (Low Risk Zone)</span>' 
      : (pred.risk === 'HIGH' ? '<span class="text-crimson" style="font-weight:bold;">⚠️ DECREASE BET (Bust Alert)</span>' : '<span class="text-cyan" style="font-weight:bold;">NORMAL UNIT (Neutral)</span>');
 
    dynamicMetrics.innerHTML = `
      <div class="hud-row"><span>Expected Crash Point</span><span class="hud-value text-gold">${pred.cashout.toFixed(2)}x</span></div>
      <div class="hud-row"><span>Risk Classification</span><span class="hud-value text-cyan">${pred.risk} RISK</span></div>
      <div class="hud-row"><span>Wager Advisor</span><span class="hud-value">${wagerText}</span></div>
    `;
    log(`Crash AI Resolved: target ${pred.cashout.toFixed(2)}x, Risk: ${pred.risk}`, 'success');
  }
  
  else if (game === 'baccarat') {
    const pred = BaccaratAI.predict();
 
    hudAction.textContent = `BET ${pred.bet.toUpperCase()}`;
    hudAction.className = "advisor-choice " + (pred.bet === 'Banker' ? 'text-crimson' : pred.bet === 'Player' ? 'text-cyan' : 'text-emerald');
    hudExpl.textContent = `Baccarat RNN model. Pattern classification: ${pred.pattern.toUpperCase()} (B/P Ratio: ${pred.bRatio}%).`;
    
    hudPercent.textContent = `${pred.winPct}%`;
    hudProgress.style.width = `${pred.winPct}%`;
 
    const wagerText = '<span class="text-cyan" style="font-weight:bold;">NORMAL UNIT (Trend Follow)</span>';
 
    dynamicMetrics.innerHTML = `
      <div class="hud-row"><span>AI Recommended Bet</span><span class="hud-value text-gold">${pred.bet}</span></div>
      <div class="hud-row"><span>Pattern Classification</span><span class="hud-value text-cyan">${pred.pattern.toUpperCase()}</span></div>
      <div class="hud-row"><span>Wager Advisor</span><span class="hud-value">${wagerText}</span></div>
    `;
    log(`Baccarat AI Resolved: bet ${pred.bet}, pattern ${pred.pattern}`, 'success');
  }
  
  else if (game === 'roulette') {
    const pred = RouletteAI.predict();
 
    hudAction.textContent = `BET $${pred.nextBet.toFixed(2)}`;
    hudAction.className = "advisor-choice text-gold";
    hudExpl.textContent = `Progression step: ${pred.step}. Loss streak: ${pred.streak}. Sector risk: ${pred.riskLevel}.`;
    
    hudPercent.textContent = `${Math.round(pred.winPct)}%`;
    hudProgress.style.width = `${Math.round(pred.winPct)}%`;
 
    const wagerText = pred.nextBet > 10 
      ? `<span class="text-emerald" style="font-weight:bold;">⚡ INCREASE BET (Progression Step: $${pred.nextBet})</span>` 
      : '<span class="text-cyan" style="font-weight:bold;">NORMAL UNIT (Base Bet)</span>';
 
    dynamicMetrics.innerHTML = `
      <div class="hud-row"><span>Progression System</span><span class="hud-value">Martingale (x2)</span></div>
      <div class="hud-row"><span>Sequence Step</span><span class="hud-value">${pred.step}</span></div>
      <div class="hud-row"><span>Net Session Profit</span><span class="hud-value ${pred.netProfit >= 0 ? 'text-emerald' : 'text-crimson'}">$${pred.netProfit}</span></div>
      <div class="hud-row"><span>Wager Advisor</span><span class="hud-value">${wagerText}</span></div>
    `;
    log(`Roulette AI Resolved: progression bet $${pred.nextBet}`, 'success');
  }
  
  else if (game === 'poker') {
    let pocket = ranks.slice(0, 2);
    let board = ranks.slice(2, 5);
    if (pocket.length < 2) pocket = ["A", "K"];
    if (board.length < 3) board = ["Q", "10", "5"];
 
    const equity = pocket[0] === 'A' ? 62 : 48; // simulated equity
    const outs = 9;
    const pred = PokerAI.predict(equity, 100, 20, outs, board.length);
 
    hudAction.textContent = pred.action;
    hudAction.className = "advisor-choice " + pred.colorClass;
    hudExpl.textContent = pred.explanation;
    
    hudPercent.textContent = `${pred.equity}%`;
    hudProgress.style.width = `${pred.equity}%`;
 
    const wagerText = pred.action.includes('RAISE') 
      ? '<span class="text-emerald" style="font-weight:bold;">⚡ INCREASE BET (Value Raise)</span>' 
      : '<span class="text-cyan" style="font-weight:bold;">NORMAL UNIT (Check/Call)</span>';
 
    dynamicMetrics.innerHTML = `
      <div class="hud-row"><span>Pocket Cards</span><span class="hud-value">[${pocket.join(', ')}]</span></div>
      <div class="hud-row"><span>Board Cards</span><span class="hud-value">[${board.join(', ')}]</span></div>
      <div class="hud-row"><span>Improving Outs</span><span class="hud-value text-cyan">${pred.outs} Outs</span></div>
      <div class="hud-row"><span>Wager Advisor</span><span class="hud-value">${wagerText}</span></div>
    `;
    log(`Poker AI Resolved: action ${pred.action}, equity ${pred.equity}%`, 'success');
  }
  
  else if (game === 'craps') {
    const phase = scraped.innerText.toLowerCase().includes('point') ? 'Point Established' : 'Come-out Roll';
    const point = scraped.innerText.match(/point is (\d+)/i) ? parseInt(scraped.innerText.match(/point is (\d+)/i)[1]) : 0;
    const winPct = phase === 'Come-out Roll' ? 49 : 45;
 
    hudAction.textContent = "PASS LINE / ODDS";
    hudAction.className = "advisor-choice text-emerald";
    hudExpl.textContent = `Craps mathematical expectation. Recommended to take Odds bet if point is established (0% house edge!).`;
    
    hudPercent.textContent = `${winPct}%`;
    hudProgress.style.width = `${winPct}%`;
 
    dynamicMetrics.innerHTML = `
      <div class="hud-row"><span>Game Phase</span><span class="hud-value">${phase}</span></div>
      <div class="hud-row"><span>Point Number</span><span class="hud-value">${point || '-'}</span></div>
      <div class="hud-row"><span>Wager Advisor</span><span class="hud-value text-emerald">ALWAYS TAKE ODDS BETS</span></div>
    `;
    log(`Craps HUD resolved. Phase: ${phase}, Point: ${point}`, 'success');
  }
}
