// Crash Strategy Engine & Real-time Canvas Renderer

// Calculates probability of reaching a target multiplier in Crash
function getCrashRelevanceProb(multiplier) {
  if (multiplier < 1.01) return 99.0;
  return Math.min(99.0, 99.0 / multiplier);
}

// Generates a Crash round outcome (provably fair style)
function rollCrashMultiplier() {
  const rand = Math.random() * 100;
  if (rand < 3.0) { // 3% instant crash at 1.00x (often called house edge / instant bust)
    return 1.00;
  }
  const u = Math.random() * 97 + 0.01;
  const result = 97 / u;
  return Math.round(result * 100) / 100;
}

// Markov Chain state classifier and risk predictor
function predictNextCrashRisk(historyList) {
  // If we don't have enough history, generate simulated historical data to "train" the Markov matrix
  const activeHistory = [...historyList];
  if (activeHistory.length < 10) {
    for (let i = 0; i < 50; i++) {
      activeHistory.unshift(rollCrashMultiplier());
    }
  }

  // Define states:
  // State 0: BUST (1.00x - 1.30x)
  // State 1: LOW (1.31x - 2.00x)
  // State 2: MEDIUM (2.01x - 5.00x)
  // State 3: HIGH (> 5.00x)
  const getCardState = (val) => {
    if (val <= 1.30) return 0;
    if (val <= 2.00) return 1;
    if (val <= 5.00) return 2;
    return 3;
  };

  const stateNames = ["Bust (<1.3x)", "Low (1.3x-2x)", "Medium (2x-5x)", "High (>5x)"];

  // Initialize transition frequency matrix (4x4)
  const transitions = Array(4).fill(0).map(() => Array(4).fill(0));
  
  for (let i = 0; i < activeHistory.length - 1; i++) {
    const fromState = getCardState(activeHistory[i]);
    const toState = getCardState(activeHistory[i + 1]);
    transitions[fromState][toState]++;
  }

  // Convert frequencies to probabilities
  const transitionMatrix = transitions.map(row => {
    const sum = row.reduce((a, b) => a + b, 0);
    if (sum === 0) return [0.25, 0.25, 0.25, 0.25]; // uniform fallback
    return row.map(cell => cell / sum);
  });

  // Predict next state based on the current state (last element in history)
  const currentState = getCardState(activeHistory[activeHistory.length - 1]);
  const probabilities = transitionMatrix[currentState];

  // Calculate recommendation metrics
  // High risk of bust if prob of state 0 + state 1 is high
  const bustRiskProb = probabilities[0] + probabilities[1];
  let riskLevel = "MEDIUM RISK";
  let color = "#eab308"; // yellow
  let recCashout = 1.80;
  
  if (bustRiskProb > 0.65) {
    riskLevel = "HIGH RISK (Bust Alert)";
    color = "#f43f5e"; // crimson
    recCashout = 1.30;
  } else if (bustRiskProb < 0.40) {
    riskLevel = "LOW RISK (Growth Opportunity)";
    color = "#10b981"; // emerald
    recCashout = 2.50;
  }

  const res = {
    currentState: stateNames[currentState],
    probabilities: probabilities.map(p => Math.round(p * 100)),
    riskLevel,
    color,
    recCashout
  };

  if (window.SattaAIPredictor) {
    const aiPred = window.SattaAIPredictor.predictCrash(historyList);
    res.riskLevel = aiPred.riskLevel;
    res.color = aiPred.color;
    res.recCashout = aiPred.recCashout;
    res.currentState = `RNN State: ${aiPred.riskLevel}`;
  }

  return res;
}

// Exponential Rocket Trajectory Canvas Renderer
class CrashCanvasRenderer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.animationFrameId = null;
    this.running = false;
    this.multiplier = 1.00;
    this.startTime = 0;
    this.crashPoint = 0.00;
    this.onCrashCallback = null;
    this.onUpdateCallback = null;
  }

  start(crashPoint, onUpdate, onCrash) {
    this.running = true;
    this.multiplier = 1.00;
    this.startTime = performance.now();
    this.crashPoint = crashPoint;
    this.onUpdateCallback = onUpdate;
    this.onCrashCallback = onCrash;
    this.animate();
  }

  stop() {
    this.running = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  animate() {
    if (!this.running) return;

    const elapsedSeconds = (performance.now() - this.startTime) / 1000;
    // Exponential multiplier calculation: grows from 1.00x upwards
    // Mult(t) = 1.00 * e^(0.06 * t)
    this.multiplier = Math.exp(0.08 * elapsedSeconds);
    this.multiplier = Math.round(this.multiplier * 100) / 100;

    // Call update callback
    if (this.onUpdateCallback) {
      this.onUpdateCallback(this.multiplier);
    }

    // Check crash
    if (this.multiplier >= this.crashPoint) {
      this.multiplier = this.crashPoint;
      this.running = false;
      this.draw(true);
      if (this.onCrashCallback) {
        this.onCrashCallback(this.crashPoint);
      }
      return;
    }

    this.draw(false);
    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  draw(isCrashed) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;

    // Clear Canvas
    ctx.clearRect(0, 0, width, height);

    // Draw space/grid background lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw curve trajectory
    const points = [];
    const steps = 60;
    const elapsedSeconds = (performance.now() - this.startTime) / 1000;
    
    // Scale mapping coordinates
    const scaleX = (t) => 50 + (t / 12) * (width - 100); // map 12s to canvas width
    const scaleY = (m) => height - 50 - (Math.log(m) / Math.log(10)) * (height - 100); // logarithmic y scale

    ctx.beginPath();
    ctx.strokeStyle = isCrashed ? '#f43f5e' : 'var(--primary)';
    ctx.lineWidth = 4;
    ctx.shadowBlur = 15;
    ctx.shadowColor = isCrashed ? 'rgba(244, 63, 94, 0.5)' : 'rgba(0, 242, 254, 0.5)';

    for (let i = 0; i <= steps; i++) {
      const t = (elapsedSeconds * i) / steps;
      const m = Math.exp(0.08 * t);
      const cx = scaleX(t);
      const cy = scaleY(m);
      if (i === 0) {
        ctx.moveTo(cx, cy);
      } else {
        ctx.lineTo(cx, cy);
      }
      points.push({ x: cx, y: cy });
    }
    ctx.stroke();

    // Reset shadow for text
    ctx.shadowBlur = 0;

    // Draw Rocket Indicator at the current head
    const head = points[points.length - 1];
    if (head) {
      ctx.beginPath();
      ctx.arc(head.x, head.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = isCrashed ? '#f43f5e' : '#00f2fe';
      ctx.fill();
      
      // Draw a pulsing outer ring if active
      if (!isCrashed) {
        ctx.beginPath();
        ctx.arc(head.x, head.y, 14 + Math.sin(performance.now() / 100) * 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Draw Multiplier Value Text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 3rem "Orbitron", sans-serif';
    ctx.fillStyle = isCrashed ? '#f43f5e' : '#ffffff';
    ctx.fillText(`${this.multiplier.toFixed(2)}x`, width / 2, height / 2 - 10);

    ctx.font = '600 0.85rem "Outfit", sans-serif';
    ctx.fillStyle = isCrashed ? 'rgba(244, 63, 94, 0.7)' : 'rgba(255, 255, 255, 0.4)';
    ctx.fillText(isCrashed ? 'CRASHED (FLEW AWAY)' : 'ROCKET CLIMBING...', width / 2, height / 2 + 35);
  }
}

// Monte Carlo simulator to train & optimize Crash Auto-Cashout strategies
function runCrashMonteCarlo(autoMultiplier, startingBankroll = 1000, baseBet = 10, simRounds = 5000) {
  let bankroll = startingBankroll;
  let wins = 0;
  let losses = 0;
  const history = [];

  for (let round = 0; round < simRounds; round++) {
    if (bankroll < baseBet) {
      bankroll = 0;
      break;
    }

    const crashPoint = rollCrashMultiplier();
    
    if (crashPoint >= autoMultiplier) {
      bankroll += baseBet * (autoMultiplier - 1);
      wins++;
    } else {
      bankroll -= baseBet;
      losses++;
    }

    if (round % Math.max(1, Math.round(simRounds / 20)) === 0) {
      history.push(bankroll);
    }
  }

  return {
    autoMultiplier,
    wins,
    losses,
    winRate: (wins / simRounds) * 100,
    finalBankroll: bankroll,
    profit: bankroll - startingBankroll,
    history
  };
}

// Export for app use
window.CrashEngine = {
  getProb: getCrashRelevanceProb,
  roll: rollCrashMultiplier,
  predict: predictNextCrashRisk,
  train: runCrashMonteCarlo,
  Renderer: CrashCanvasRenderer
};
