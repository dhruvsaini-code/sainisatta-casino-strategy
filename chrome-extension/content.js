/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  SAINISATTA PRO — BACKGROUND AUTO-TRAINING CONTENT SCRIPT
 *  Watches and trains AI models for all casino games automatically inside the tab
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

const DB_CACHE = {};
let dbInitialized = false;

// ── Shared DB Utility (chrome.storage.local with synchronous cache) ──
const DB = {
  get(key, def) {
    return DB_CACHE[key] !== undefined ? DB_CACHE[key] : def;
  },
  set(key, val) {
    DB_CACHE[key] = val;
    chrome.storage.local.set({ [key]: val });
  }
};

// ── Normalize Helpers ──
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const norm = (v, lo, hi) => clamp((v - lo) / (hi - lo + 1e-9), 0, 1);

function pushHist(key, val, maxLen = 200) {
  const h = DB.get('hist_' + key, []);
  h.push(val);
  if (h.length > maxLen) h.shift();
  DB.set('hist_' + key, h);
}

function stats(arr) {
  if (!arr.length) return { mean: 1, std: 0, min: 1, max: 1 };
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const std = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length);
  return { mean, std, min: Math.min(...arr), max: Math.max(...arr) };
}

// ── Mini Neural Net (Sigmoid / ReLU Feedforward with backprop) ──
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
      this.W1 = Array.from({ length: this.hid }, () => this._rand(this.in));
      this.b1 = this._rand(this.hid);
      this.W2 = Array.from({ length: this.out }, () => this._rand(this.hid));
      this.b2 = this._rand(this.out);
    }
    this.t = 0;
    this.mW1 = this.W1.map(row => row.map(() => 0.0));
    this.vW1 = this.W1.map(row => row.map(() => 0.0));
    this.mb1 = this.b1.map(() => 0.0);
    this.vb1 = this.b1.map(() => 0.0);
    this.mW2 = this.W2.map(row => row.map(() => 0.0));
    this.vW2 = this.W2.map(row => row.map(() => 0.0));
    this.mb2 = this.b2.map(() => 0.0);
    this.vb2 = this.b2.map(() => 0.0);
  }

  _save() {
    DB.set(this.key, { W1: this.W1, b1: this.b1, W2: this.W2, b2: this.b2 });
  }

  forward(x) {
    this._h = this.W1.map((row, i) =>
      this._relu(row.reduce((s, w, j) => s + w * x[j], 0) + this.b1[i])
    );
    this._z2 = this.W2.map((row, i) =>
      row.reduce((s, w, j) => s + w * this._h[j], 0) + this.b2[i]
    );
    this._out = this.out === 1 ? [this._sigmoid(this._z2[0])] : this._softmax(this._z2);
    return this._out;
  }

  train(x, label) {
    const pred = this.forward(x);
    const dOut = pred.map((p, i) => p - label[i]);
    const dHid = this._h.map((h, j) => {
      const upstream = dOut.reduce((s, d, i) => s + d * this.W2[i][j], 0);
      return upstream * (h > 0 ? 1 : 0);
    });

    this.t++;
    const beta1 = 0.9;
    const beta2 = 0.999;
    const epsilon = 1e-8;
    const biasCorrection1 = 1 - Math.pow(beta1, this.t);
    const biasCorrection2 = 1 - Math.pow(beta2, this.t);

    for (let i = 0; i < this.out; i++) {
      const gb2 = dOut[i];
      this.mb2[i] = beta1 * this.mb2[i] + (1 - beta1) * gb2;
      this.vb2[i] = beta2 * this.vb2[i] + (1 - beta2) * gb2 * gb2;
      this.b2[i] -= this.lr * (this.mb2[i] / biasCorrection1) / (Math.sqrt(this.vb2[i] / biasCorrection2) + epsilon);

      for (let j = 0; j < this.hid; j++) {
        const gW2 = dOut[i] * this._h[j];
        this.mW2[i][j] = beta1 * this.mW2[i][j] + (1 - beta1) * gW2;
        this.vW2[i][j] = beta2 * this.vW2[i][j] + (1 - beta2) * gW2 * gW2;
        this.W2[i][j] -= this.lr * (this.mW2[i][j] / biasCorrection1) / (Math.sqrt(this.vW2[i][j] / biasCorrection2) + epsilon);
      }
    }

    for (let i = 0; i < this.hid; i++) {
      const gb1 = dHid[i];
      this.mb1[i] = beta1 * this.mb1[i] + (1 - beta1) * gb1;
      this.vb1[i] = beta2 * this.vb1[i] + (1 - beta2) * gb1 * gb1;
      this.b1[i] -= this.lr * (this.mb1[i] / biasCorrection1) / (Math.sqrt(this.vb1[i] / biasCorrection2) + epsilon);

      for (let j = 0; j < this.in; j++) {
        const gW1 = dHid[i] * x[j];
        this.mW1[i][j] = beta1 * this.mW1[i][j] + (1 - beta1) * gW1;
        this.vW1[i][j] = beta2 * this.vW1[i][j] + (1 - beta2) * gW1 * gW1;
        this.W1[i][j] -= this.lr * (this.mW1[i][j] / biasCorrection1) / (Math.sqrt(this.vW1[i][j] / biasCorrection2) + epsilon);
      }
    }

    this._save();
    return pred;
  }
}

// ── RNN Cell (Elman-style hidden state for sequential data) ──
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
    }
    this.t = 0;
    this.mWh = this.Wh.map(row => row.map(() => 0.0));
    this.vWh = this.Wh.map(row => row.map(() => 0.0));
    this.mWx = this.Wx.map(row => row.map(() => 0.0));
    this.vWx = this.Wx.map(row => row.map(() => 0.0));
    this.mbh = this.bh.map(() => 0.0);
    this.vbh = this.bh.map(() => 0.0);
    this.mWy = this.Wy.map(row => row.map(() => 0.0));
    this.vWy = this.Wy.map(row => row.map(() => 0.0));
    this.mby = this.by.map(() => 0.0);
    this.vby = this.by.map(() => 0.0);
  }

  _save() {
    DB.set(this.key, { Wh: this.Wh, Wx: this.Wx, bh: this.bh, Wy: this.Wy, by: this.by, h: this.h });
  }

  forward(x) {
    this.h_prev = [...this.h];
    this.h = this.Wh.map((row, i) =>
      this._tanh(
        row.reduce((s, w, j) => s + w * this.h_prev[j], 0) +
        this.Wx[i].reduce((s, w, j) => s + w * x[j], 0) +
        this.bh[i]
      )
    );
    this._y = this.Wy.map((row, i) =>
      this._sigmoid(row.reduce((s, w, j) => s + w * this.h[j], 0) + this.by[i])
    );
    return this._y;
  }

  train(x, label) {
    const pred = this.forward(x);
    const dOut = pred.map((p, i) => p - label[i]);
    const dh = this.h.map((hj, j) => {
      const upstream = dOut.reduce((s, d, i) => s + d * this.Wy[i][j], 0);
      return upstream * (1 - hj * hj);
    });

    this.t++;
    const beta1 = 0.9;
    const beta2 = 0.999;
    const epsilon = 1e-8;
    const biasCorrection1 = 1 - Math.pow(beta1, this.t);
    const biasCorrection2 = 1 - Math.pow(beta2, this.t);

    for (let i = 0; i < this.out; i++) {
      const gby = dOut[i];
      this.mby[i] = beta1 * this.mby[i] + (1 - beta1) * gby;
      this.vby[i] = beta2 * this.vby[i] + (1 - beta2) * gby * gby;
      this.by[i] -= this.lr * (this.mby[i] / biasCorrection1) / (Math.sqrt(this.vby[i] / biasCorrection2) + epsilon);

      for (let j = 0; j < this.hid; j++) {
        const gWy = dOut[i] * this.h[j];
        this.mWy[i][j] = beta1 * this.mWy[i][j] + (1 - beta1) * gWy;
        this.vWy[i][j] = beta2 * this.vWy[i][j] + (1 - beta2) * gWy * gWy;
        this.Wy[i][j] -= this.lr * (this.mWy[i][j] / biasCorrection1) / (Math.sqrt(this.vWy[i][j] / biasCorrection2) + epsilon);
      }
    }

    for (let i = 0; i < this.hid; i++) {
      const gbh = dh[i];
      this.mbh[i] = beta1 * this.mbh[i] + (1 - beta1) * gbh;
      this.vbh[i] = beta2 * this.vbh[i] + (1 - beta2) * gbh * gbh;
      this.bh[i] -= this.lr * (this.mbh[i] / biasCorrection1) / (Math.sqrt(this.vbh[i] / biasCorrection2) + epsilon);

      for (let j = 0; j < this.in; j++) {
        const gWx = dh[i] * x[j];
        this.mWx[i][j] = beta1 * this.mWx[i][j] + (1 - beta1) * gWx;
        this.vWx[i][j] = beta2 * this.vWx[i][j] + (1 - beta2) * gWx * gWx;
        this.Wx[i][j] -= this.lr * (this.mWx[i][j] / biasCorrection1) / (Math.sqrt(this.vWx[i][j] / biasCorrection2) + epsilon);
      }

      for (let j = 0; j < this.hid; j++) {
        const gWh = dh[i] * this.h_prev[j];
        this.mWh[i][j] = beta1 * this.mWh[i][j] + (1 - beta1) * gWh;
        this.vWh[i][j] = beta2 * this.vWh[i][j] + (1 - beta2) * gWh * gWh;
        this.Wh[i][j] -= this.lr * (this.mWh[i][j] / biasCorrection1) / (Math.sqrt(this.vWh[i][j] / biasCorrection2) + epsilon);
      }
    }

    this._save();
    return pred;
  }
}

// ── Mines AI Core ──
const MinesAI = {
  features(tileStates, minesCount) {
    const f = tileStates.map(s => s === 0 ? 0 : s === 1 ? 1 : -1);
    const total = Math.max(1, DB.get('hist_mines_sessions', 0));
    const spawnNorm = DB.get('hist_mines_spawns', Array(25).fill(0)).map(c => c / total);
    f.push(...spawnNorm);
    f.push(norm(minesCount, 1, 24));
    f.push(tileStates.filter(s => s === 1).length / 25);
    f.push(tileStates.filter(s => s === 0).length / 25);
    return f; // 53 parameters
  },

  recordBombs(bombIndices, tileStates, minesCount) {
    if (!bombIndices.length) return;
    const hash = bombIndices.sort((a, b) => a - b).join(',');
    const lastHash = DB.get('mn_last_scraped_mines_hash', '');
    if (hash === lastHash) return;
    DB.set('mn_last_scraped_mines_hash', hash);

    let sessions = DB.get('hist_mines_sessions', 0) + 1;
    let spawns = DB.get('hist_mines_spawns', Array(25).fill(0));
    bombIndices.forEach(idx => { if (idx >= 0 && idx < 25) spawns[idx]++; });
    
    DB.set('hist_mines_sessions', sessions);
    DB.set('hist_mines_spawns', spawns);

    const model = new MiniNet('ai_mines', 53, 32, 25, 0.03);
    const x = this.features(tileStates, minesCount);
    const label = Array(25).fill(0);
    bombIndices.forEach(i => { if (i < 25) label[i] = 1; });
    model.train(x, label);

    console.log(`%c[SattaAI] Automatically trained Mines ANN on round #${sessions}. Bomb layout cataloged: [${bombIndices.join(', ')}]`, 'color:#10b981; font-weight:bold;');
  }
};

// ── Crash AI Core ──
const CrashAI = {
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
    const h = DB.get('hist_crash', []);
    if (h.length < 2) return;
    const prev = h[h.length - 2];
    const curr = h[h.length - 1];
    
    const model = new RNNCell('ai_crash', 4, 12, 3, 0.02);
    model.train(this.encode(prev), this.zoneLabel(curr));
    console.log(`%c[SattaAI] Automatically trained Crash RNN on outcome: ${curr.toFixed(2)}x`, 'color:#a855f7; font-weight:bold;');
  }
};

// ── Limbo AI Core ──
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

    // Save full structured object to history
    pushHist('limbo', {
      outcome: result,
      target: target,
      streakCount: streak,
      accumulatedLoss: accLoss,
      limboProfit: profit,
      wager: lastBet
    });

    const h = DB.get('hist_limbo', []);
    if (h.length < 2) return;

    // Train the RNNCell
    const model = new RNNCell('ai_limbo', 5, 12, 3, 0.02);
    
    // Previous step features
    const prevItem = h[h.length - 2];
    const prevFeatures = this.getFeaturesForOutcome(prevItem, lastBet);
    
    // Target outputs based on current actual result
    const targetOutputs = this.getTargetOutputs(result, streak, accLoss, profit, lastBet, lastBet);
    
    model.train(prevFeatures, targetOutputs);
    console.log(`%c[SattaAI] Automatically trained Limbo RNNCell on outcome: ${result.toFixed(2)}x (Won: ${won}, Streak: ${streak}, Profit: ${profit.toFixed(2)})`, 'color:#00f2fe; font-weight:bold;');
  }
};

// ── Baccarat AI Core ──
const BaccaratAI = {
  encode(outcome) { return [outcome==='B'?1:0, outcome==='P'?1:0, outcome==='T'?1:0]; },
  outcomeLabel(o) { return this.encode(o); },
  record(outcome) {
    pushHist('baccarat', outcome);
    const h = DB.get('hist_baccarat', []);
    if (h.length < 2) return;
    const prev = h[h.length - 2];
    const model = new RNNCell('ai_baccarat', 3, 10, 3, 0.018);
    model.train(this.encode(prev), this.outcomeLabel(outcome));
    console.log(`%c[SattaAI] Automatically trained Baccarat RNN on trend: ${outcome}`, 'color:#f43f5e; font-weight:bold;');
  }
};

// ── Roulette AI Core ──
const RouletteAI = {
  features(step, bet, streak, netProfit, rouletteHist) {
    return [
      norm(step, 1, 15), norm(bet, 5, 500), norm(streak, 0, 10),
      norm(netProfit, -500, 500),
      norm(rouletteHist.filter(v=>v).length, 0, 100),
      norm(rouletteHist.filter(v=>!v).length, 0, 100)
    ];
  },
  record(won) {
    pushHist('roulette', won);
    
    const h = DB.get('hist_roulette', []);
    let streak = 0;
    for (let i = h.length-1; i >= 0 && !h[i]; i--) streak++;
    
    const label = won ? [0,1,0] : (streak >= 5 ? [1,0,0] : [0,0,1]);
    
    const step = DB.get('rt_step', 1);
    const bet = DB.get('rt_next_bet', 10);
    const netProfit = DB.get('rt_profit', 0);
    
    const model = new MiniNet('ai_roulette', 6, 8, 3, 0.02);
    model.train(this.features(step, bet, streak, netProfit, h), label);
    
    let nextBet = bet;
    let nextStep = step;
    let nextProfit = netProfit;
    if (won) {
      nextProfit += bet;
      nextBet = 10;
      nextStep = 1;
    } else {
      nextProfit -= bet;
      nextBet = Math.min(bet * 2, 5120);
      nextStep++;
    }
    DB.set('rt_next_bet', nextBet);
    DB.set('rt_step', nextStep);
    DB.set('rt_profit', nextProfit);
    
    console.log(`%c[SattaAI] Automatically trained Roulette ANN. Outcome: ${won ? 'WIN' : 'LOSS'}, Next Bet: $${nextBet}`, 'color:#f59e0b; font-weight:bold;');
  }
};

// ── Blackjack AI Core ──
const BlackjackAI = {
  hiLoVal(rank) {
    if (['10','J','Q','K','A'].includes(rank)) return -1;
    if (['2','3','4','5','6'].includes(rank)) return 1;
    return 0;
  },
  updateCount(ranks) {
    if (!ranks.length) return;
    let rc = DB.get('bj_rc', 0);
    let dd = DB.get('bj_dd', 0);
    ranks.forEach(r => { rc += this.hiLoVal(r); dd++; });
    DB.set('bj_rc', rc);
    DB.set('bj_dd', dd);
    console.log(`%c[SattaAI] Blackjack Auto-Count updated: RC=${rc}, Decks Dealt=${(dd/52).toFixed(2)}`, 'color:#00f2fe; font-weight:bold;');
  }
};

// ── DOM Scrapers ──
function scrapeMinesBoard() {
  let mineButtons = [];
  const containers = Array.from(document.querySelectorAll('div,section,main,article'));
  for (const c of containers) {
    const btns = c.querySelectorAll('button');
    if (btns.length === 25) { mineButtons = Array.from(btns); break; }
  }
  if (!mineButtons.length) {
    const tiles = document.querySelectorAll('[data-testid="tile"],[class*="tile"],[class*="mine-tile"],[class*="cell"]');
    if (tiles.length === 25) mineButtons = Array.from(tiles);
  }

  if (mineButtons.length !== 25) return null;

  const tileStates = mineButtons.map(btn => {
    let hasRed = false;
    let hasGreen = false;
    
    try {
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
            if (rgb.r > 140 && rgb.r > rgb.g * 1.25 && rgb.r > rgb.b * 1.25) hasRed = true;
            if (rgb.g > 110 && rgb.g > rgb.r * 1.1 && rgb.g > rgb.b * 0.9) hasGreen = true;
          }
        }
      }
    } catch (e) {}

    const h = btn.innerHTML.toLowerCase();
    const cl = btn.className.toLowerCase();
    const hasMineKeyword = /\b(bomb|exploded|boom)\b/i.test(cl) || /\b(bomb|exploded|boom|mine)\b/i.test(h);
    const hasGemKeyword = /\b(gem|diamond|safe)\b/i.test(cl + ' ' + h);

    if (hasGreen || hasGemKeyword) {
      if (hasRed && !hasGreen) return 2;
      return 1;
    }
    if (hasRed || hasMineKeyword) return 2;
    return 0;
  });

  let minesCount = 3;
  const text = document.body.innerText;
  const m = text.match(/mines?\s*[:\n]\s*(\d+)/i) || text.match(/(\d+)\s*mines?/i);
  if (m) minesCount = Math.max(1, Math.min(24, parseInt(m[1])));
  const sel = document.querySelector('select[name*="mine"],select[id*="mine"],input[name*="mine"]');
  if (sel) minesCount = parseInt(sel.value) || minesCount;

  return { tileStates, minesCount };
}

// ── Game Classification ──
function classifyActiveGame() {
  const override = DB.get('mn_game_override', 'auto');
  if (override && override !== 'auto') return override;

  const url = window.location.href.toLowerCase();
  const title = document.title.toLowerCase();
  const text = document.body.innerText.toLowerCase();

  if (url.includes('crash') || url.includes('aviator') || title.includes('crash') || title.includes('aviator')) return 'crash';
  if (url.includes('limbo') || title.includes('limbo')) return 'limbo';
  if (url.includes('mines') || title.includes('mines')) return 'mines';
  if (url.includes('roulette') || title.includes('roulette')) return 'roulette';
  if (url.includes('baccarat') || title.includes('baccarat')) return 'baccarat';
  if (url.includes('blackjack') || title.includes('blackjack')) return 'blackjack';
  
  if (text.includes('mines active') || text.includes('gems revealed')) return 'mines';
  if (text.includes('target multiplier') || text.includes('limbo target')) return 'limbo';
  if (text.includes('flew away') || text.includes('rocket climb')) return 'crash';
  
  return 'unknown';
}

// ── Watcher State Cache ──
let lastLimboHistoryStr = '';
let lastCrashHistoryStr = '';
let lastBaccaratHistoryStr = '';
let lastRouletteHistoryStr = '';
let lastBlackjackRanksStr = '';

// ── Main Background Scraper Tick Loop ──
function runBackgroundAutoTrainer() {
  if (!dbInitialized) return;

  const game = classifyActiveGame();
  
  if (game === 'mines') {
    const scraped = scrapeMinesBoard();
    if (scraped) {
      const explodedMinesCount = scraped.tileStates.filter(s => s === 2).length;
      if (explodedMinesCount > 0) {
        const bombIndices = [];
        scraped.tileStates.forEach((s, idx) => { if (s === 2) bombIndices.push(idx); });
        MinesAI.recordBombs(bombIndices, scraped.tileStates, scraped.minesCount);
      }
    }
  } 
  
  else if (game === 'limbo') {
    let target = 2.0;
    let betAmount = 10;
    try {
      document.querySelectorAll('input').forEach(inp => {
        const v = parseFloat(inp.value);
        if (!isNaN(v)) {
          if (v >= 1.01 && v <= 100) {
            if (inp.id?.toLowerCase().includes('target') || inp.placeholder?.toLowerCase().includes('target') || (inp.min === '1.01')) {
              target = v;
            }
          }
          if (v > 0) {
            if (inp.id?.toLowerCase().includes('bet') || inp.id?.toLowerCase().includes('amount') || inp.placeholder?.toLowerCase().includes('bet') || inp.placeholder?.toLowerCase().includes('amount')) {
              betAmount = v;
            }
          }
        }
      });
      DB.set('lb_last_bet', betAmount);
    } catch (e) {}

    const bubbles = Array.from(document.querySelectorAll('[class*="recent-outcomes"] span, [class*="history"] span, [class*="bubble"]'))
      .map(el => el.textContent.trim())
      .filter(txt => /^\d+\.\d+x$/i.test(txt));
    
    if (bubbles.length > 0) {
      const historyStr = bubbles.join(',');
      if (historyStr !== lastLimboHistoryStr) {
        const newRoll = parseFloat(bubbles[0].replace(/x/i, ''));
        LimboAI.record(newRoll, target);
        lastLimboHistoryStr = historyStr;
      }
    }
  } 
  
  else if (game === 'crash') {
    const bubbles = Array.from(document.querySelectorAll('[class*="recent-outcomes"] span, [class*="history"] span, [class*="bubble"]'))
      .map(el => el.textContent.trim())
      .filter(txt => /^\d+\.\d+x$/i.test(txt));
    
    if (bubbles.length > 0) {
      const historyStr = bubbles.join(',');
      if (historyStr !== lastCrashHistoryStr) {
        const newMult = parseFloat(bubbles[0].replace(/x/i, ''));
        CrashAI.record(newMult);
        lastCrashHistoryStr = historyStr;
      }
    }
  } 
  
  else if (game === 'baccarat') {
    const bubbles = Array.from(document.querySelectorAll('[class*="recent-outcomes"] span, [class*="history"] span, [class*="bubble"]'))
      .map(el => el.textContent.trim().toUpperCase())
      .filter(txt => ['B', 'P', 'T'].includes(txt));
    
    if (bubbles.length > 0) {
      const historyStr = bubbles.join(',');
      if (historyStr !== lastBaccaratHistoryStr) {
        const outcome = bubbles[0];
        BaccaratAI.record(outcome);
        lastBaccaratHistoryStr = historyStr;
      }
    }
  } 
  
  else if (game === 'roulette') {
    const bubbles = Array.from(document.querySelectorAll('[class*="recent-outcomes"] span, [class*="history"] span, [class*="bubble"]'))
      .map(el => el.textContent.trim())
      .filter(txt => /^\b(00|0|[1-9]|[1-2]\d|3[0-6])\b$/.test(txt));
    
    if (bubbles.length > 0) {
      const historyStr = bubbles.join(',');
      if (historyStr !== lastRouletteHistoryStr) {
        const num = parseInt(bubbles[0]);
        const savedOverride = DB.get('rt_bet_placement', 'red');
        
        const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
        const isNumRed = RED_NUMBERS.includes(num);
        const isNumGreen = num === 0;
        
        let won = false;
        if (savedOverride === 'red' && isNumRed) won = true;
        else if (savedOverride === 'black' && !isNumRed && !isNumGreen) won = true;
        else if (savedOverride === 'even' && num !== 0 && num % 2 === 0) won = true;
        else if (savedOverride === 'odd' && num % 2 !== 0) won = true;
        else if (savedOverride === 'high' && num >= 19 && num <= 36) won = true;
        else if (savedOverride === 'low' && num >= 1 && num <= 18) won = true;
        
        RouletteAI.record(won);
        lastRouletteHistoryStr = historyStr;
      }
    }
  } 
  
  else if (game === 'blackjack') {
    const rankRegex = /\b(10|[2-9]|[akqj])\b/gi;
    const foundRanks = [];
    let match;
    const text = document.body.innerText;
    while ((match = rankRegex.exec(text)) !== null && foundRanks.length < 15) {
      foundRanks.push(match[1].toUpperCase());
    }
    
    if (foundRanks.length > 0) {
      const ranksStr = foundRanks.join(',');
      if (ranksStr !== lastBlackjackRanksStr) {
        const prevRanks = lastBlackjackRanksStr ? lastBlackjackRanksStr.split(',') : [];
        const newRanks = [];
        if (foundRanks.length > prevRanks.length) {
          for (let i = prevRanks.length; i < foundRanks.length; i++) {
            newRanks.push(foundRanks[i]);
          }
          BlackjackAI.updateCount(newRanks);
        }
        lastBlackjackRanksStr = ranksStr;
      }
    }
  }
}

// ── Startup ──
chrome.storage.local.get(null, (data) => {
  Object.assign(DB_CACHE, data);
  dbInitialized = true;
  console.log("%c[SattaAI] Universal Background Auto-Trainer active on this tab.", "color:#00f2fe; font-weight:bold;");
  
  // Continuous observation loop (runs every 1.5 seconds)
  setInterval(runBackgroundAutoTrainer, 1500);
});

// Sync data changes on updates
chrome.storage.onChanged.addListener((changes) => {
  for (const [key, { newValue }] of Object.entries(changes)) {
    DB_CACHE[key] = newValue;
  }
});
