// Limbo Strategy Engine & Volatility Predictor

// Persistent ledger of past limbo roll results
let limboRollHistory = [];
let lbLowVolThreshold = 2.0;
let lbHighVolThreshold = 12.0;

try {
  const saved = localStorage.getItem('lb_roll_history');
  if (saved) {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      limboRollHistory = parsed.slice(-100); // keep last 100
    }
  }
  const savedLow = localStorage.getItem('lb_low_vol_threshold');
  if (savedLow) lbLowVolThreshold = parseFloat(savedLow);
  const savedHigh = localStorage.getItem('lb_high_vol_threshold');
  if (savedHigh) lbHighVolThreshold = parseFloat(savedHigh);
} catch (e) {
  console.warn("Could not load Limbo historical records or thresholds:", e);
}

// Win probability for a given target multiplier
function getLimboWinProb(targetMultiplier) {
  if (targetMultiplier < 1.01) return 99.0;
  return Math.min(99.0, 99.0 / targetMultiplier);
}

// Roll result generator (Provably Fair simulation style)
function rollLimboResult() {
  const rand = Math.random() * 100;
  if (rand < 1.0) { // 1% instant bust
    return 1.00;
  }
  const u = Math.random() * 99 + 0.01;
  const result = 99 / u;
  return Math.round(result * 100) / 100;
}

// Saves roll result to history and retrains weights
function recordLimboResult(outcome, target = 2.0, streakCount = 0, accumulatedLoss = 0, limboProfit = 0, wager = 10) {
  if (window.SattaAIPredictor) {
    window.SattaAIPredictor.learnLimbo(limboRollHistory, outcome, target, streakCount, accumulatedLoss, limboProfit, wager);
  }
  limboRollHistory.push({
    outcome,
    target,
    streakCount,
    accumulatedLoss,
    limboProfit,
    wager
  });
  if (limboRollHistory.length > 100) {
    limboRollHistory.shift();
  }
  try {
    localStorage.setItem('lb_roll_history', JSON.stringify(limboRollHistory));
  } catch (e) {
    console.warn("Could not save Limbo rolls history:", e);
  }
}

// Calculates the bet multiplier needed after a loss streak to recover all losses
function getLimboRecoveryBet(targetMultiplier, accumulatedLoss, baseBet) {
  if (targetMultiplier <= 1.0) return baseBet;
  const recovery = accumulatedLoss / (targetMultiplier - 1);
  return Math.round((recovery + baseBet) * 100) / 100;
}

// Clears historical database
function clearLimboHistoryData() {
  limboRollHistory = [];
  try {
    localStorage.removeItem('lb_roll_history');
  } catch (e) {
    console.warn("Could not reset training logs:", e);
  }
}

// Markov Chain and Volatility model to predict target recommendations
function predictLimboNextState(currentBet = 10, streakCount = 0, accumulatedLoss = 0, limboProfit = 0) {
  const activeHistory = [...limboRollHistory];
  // If history is small, pre-train the model with 50 mock rolls
  if (activeHistory.length < 10) {
    for (let i = 0; i < 50; i++) {
      activeHistory.unshift(rollLimboResult());
    }
  }

  const getVal = (x) => (typeof x === 'object' && x !== null) ? x.outcome : x;

  // Classify states:
  // State 0: COLD (< 1.50x)
  // State 1: STABLE (1.50x - 3.00x)
  // State 2: HOT (3.01x - 10.00x)
  // State 3: MOON (> 10.00x)
  const getLimboState = (val) => {
    const numericVal = getVal(val);
    if (numericVal < 1.50) return 0;
    if (numericVal <= 3.00) return 1;
    if (numericVal <= 10.00) return 2;
    return 3;
  };

  const stateNames = ["Cold (<1.5x)", "Stable (1.5-3x)", "Hot (3-10x)", "Moon (>10x)"];

  // Transition frequency counts
  const transitions = Array(4).fill(0).map(() => Array(4).fill(0));
  for (let i = 0; i < activeHistory.length - 1; i++) {
    const fromState = getLimboState(activeHistory[i]);
    const toState = getLimboState(activeHistory[i + 1]);
    transitions[fromState][toState]++;
  }

  // Convert to probabilities
  const matrix = transitions.map(row => {
    const sum = row.reduce((a, b) => a + b, 0);
    if (sum === 0) return [0.25, 0.25, 0.25, 0.25];
    return row.map(c => c / sum);
  });

  const lastRoll = activeHistory[activeHistory.length - 1];
  const currentState = getLimboState(lastRoll);
  const nextProbabilities = matrix[currentState];

  // Calculate rolling volatility (standard deviation over the last 15 rolls)
  const recentRolls = activeHistory.slice(-15).map(getVal);
  const mean = recentRolls.reduce((a, b) => a + b, 0) / recentRolls.length;
  const variance = recentRolls.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recentRolls.length;
  const standardDeviation = Math.sqrt(variance);

  // Volatility strategies:
  // 1. High Volatility (Standard Deviation is high):
  //    - Safe multiplier target is recommended (1.50x - 2.00x)
  //    - Capital allocation should be HIGH (stable bet size) because high multiplier attempts are high risk.
  // 2. Low Volatility (Standard Deviation is low - drought of multipliers):
  //    - Breakout target is recommended (5.00x - 10.00x) to catch large multiplier breakouts.
  //    - Capital allocation (bet size) should be LOW to conserve balance during consecutive losses.
  
  let targetAdvice = "LOW TARGET (1.80x)";
  let capitalAdvice = "HIGH CAPITAL (Safe Range)";
  let betRecommendation = "INCREASE BET (Scale Up)";
  let targetVal = 1.80;
  let riskColor = "#10b981"; // emerald
  let recommendedWager = currentBet;

  if (standardDeviation < lbLowVolThreshold) {
    // Low volatility drought: go for high target, decrease bet
    const dynamicHighTarget = Math.max(5.00, parseFloat((mean * 1.5).toFixed(2)));
    targetAdvice = `HIGH TARGET (${dynamicHighTarget.toFixed(2)}x)`;
    capitalAdvice = "LOW WAGER (Capital Defense)";
    betRecommendation = "DECREASE BET (Minimize Risk)";
    targetVal = dynamicHighTarget;
    riskColor = "#f43f5e"; // crimson
  } else if (standardDeviation > lbHighVolThreshold) {
    // High volatility spikes: play safe multiplier, scale bet
    const dynamicLowTarget = Math.max(1.20, Math.min(1.80, parseFloat((mean * 0.4).toFixed(2))));
    targetAdvice = `LOW TARGET (${dynamicLowTarget.toFixed(2)}x)`;
    capitalAdvice = "HIGH WAGER (Exploit Volatility)";
    betRecommendation = "INCREASE BET (Scale Up)";
    targetVal = dynamicLowTarget;
    riskColor = "#00f2fe"; // cyan
  }

  const res = {
    currentState: stateNames[currentState],
    probabilities: nextProbabilities.map(p => Math.round(p * 100)),
    volatility: standardDeviation.toFixed(2),
    targetAdvice,
    capitalAdvice,
    betRecommendation,
    targetVal,
    riskColor,
    lowVolThreshold: lbLowVolThreshold.toFixed(2),
    highVolThreshold: lbHighVolThreshold.toFixed(2),
    recommendedWager
  };

  if (window.SattaAIPredictor) {
    const targetValInput = parseFloat(document.getElementById("lb-target")?.value) || 2.0;
    const aiPred = window.SattaAIPredictor.predictLimbo(
      limboRollHistory,
      targetValInput,
      currentBet,
      streakCount,
      accumulatedLoss,
      limboProfit
    );
    res.targetAdvice = aiPred.targetAdvice;
    res.capitalAdvice = aiPred.capitalAdvice;
    res.betRecommendation = aiPred.betRecommendation;
    res.targetVal = aiPred.targetVal;
    res.riskColor = aiPred.riskColor;
    res.currentState = `RNN State: ${aiPred.riskLevel}`;
    res.recommendedWager = aiPred.recommendedWager;
  }

  return res;
}

// Monte Carlo simulator to "train" and evaluate Limbo strategies
function runLimboMonteCarlo(targetMultiplier, strategyType = 'recovery', startingBankroll = 1000, baseBet = 10, simRounds = 10000) {
  let bankroll = startingBankroll;
  let currentBet = baseBet;
  let accumulatedLoss = 0;
  let wins = 0;
  let losses = 0;
  let maxLossStreak = 0;
  let currentLossStreak = 0;
  let maxBet = baseBet;
  const history = [];

  for (let round = 0; round < simRounds; round++) {
    if (bankroll < currentBet) {
      bankroll = 0;
      break;
    }

    const result = rollLimboResult();
    
    // Train spatial/historical dataset with simulated outputs
    recordLimboResult(result, targetMultiplier, currentLossStreak, accumulatedLoss, bankroll - startingBankroll, currentBet);
    
    const isWin = result >= targetMultiplier;

    if (isWin) {
      const payout = currentBet * targetMultiplier;
      const profit = payout - currentBet;
      bankroll += profit;
      wins++;
      accumulatedLoss = 0;
      currentLossStreak = 0;
      currentBet = baseBet;
    } else {
      bankroll -= currentBet;
      losses++;
      accumulatedLoss += currentBet;
      currentLossStreak++;
      if (currentLossStreak > maxLossStreak) {
        maxLossStreak = currentLossStreak;
      }

      if (strategyType === 'recovery') {
        currentBet = getLimboRecoveryBet(targetMultiplier, accumulatedLoss, baseBet);
      } else if (strategyType === 'martingale') {
        currentBet = currentBet * 2;
      } else {
        currentBet = baseBet;
      }
      
      if (currentBet > maxBet) {
        maxBet = currentBet;
      }
    }

    if (currentBet > bankroll) {
      currentBet = bankroll;
    }

    if (round % Math.max(1, Math.round(simRounds / 20)) === 0) {
      history.push(bankroll);
    }
  }

  return {
    strategyType,
    wins,
    losses,
    winRate: (wins / simRounds) * 100,
    maxLossStreak,
    maxBet,
    finalBankroll: bankroll,
    profit: bankroll - startingBankroll,
    history
  };
}

function trainLimboModelOnDataset(multipliers) {
  if (!Array.isArray(multipliers) || multipliers.length === 0) {
    return { error: "Invalid dataset array." };
  }

  const cleaned = multipliers.map(Number).filter(v => !isNaN(v) && v >= 0.99);
  if (cleaned.length < 5) {
    return { error: "Requires at least 5 valid outcomes." };
  }

  // Update history
  limboRollHistory = cleaned.slice(-100).map(v => ({
    outcome: v,
    streakCount: 0,
    accumulatedLoss: 0,
    limboProfit: 0,
    wager: 10
  }));
  try {
    localStorage.setItem('lb_roll_history', JSON.stringify(limboRollHistory));
  } catch (e) {
    console.warn("Could not save trained Limbo history:", e);
  }

  // If dataset is short (<15), fill window with simulated outcomes for threshold calculation
  const fullSet = [...cleaned];
  while (fullSet.length < 30) {
    fullSet.unshift(rollLimboResult());
  }

  // Compute rolling standard deviations of window size 15
  const rollingStds = [];
  for (let i = 14; i < fullSet.length; i++) {
    const windowSlice = fullSet.slice(i - 14, i + 1);
    const mean = windowSlice.reduce((a, b) => a + b, 0) / windowSlice.length;
    const variance = windowSlice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / windowSlice.length;
    rollingStds.push(Math.sqrt(variance));
  }

  // Sort standard deviations to find percentiles
  rollingStds.sort((a, b) => a - b);
  
  // 25th percentile for low volatility threshold
  const p25Idx = Math.floor(rollingStds.length * 0.25);
  lbLowVolThreshold = Math.max(0.5, Math.min(6.0, rollingStds[p25Idx] || 2.0));

  // 75th percentile for high volatility threshold
  const p75Idx = Math.floor(rollingStds.length * 0.75);
  lbHighVolThreshold = Math.max(lbLowVolThreshold + 1.0, Math.min(30.0, rollingStds[p75Idx] || 12.0));

  try {
    localStorage.setItem('lb_low_vol_threshold', lbLowVolThreshold);
    localStorage.setItem('lb_high_vol_threshold', lbHighVolThreshold);
  } catch (e) {
    console.warn("Could not save trained Limbo thresholds:", e);
  }

  // Calculate general stats
  const totalMean = cleaned.reduce((a, b) => a + b, 0) / cleaned.length;
  const totalVariance = cleaned.reduce((a, b) => a + Math.pow(b - totalMean, 2), 0) / cleaned.length;
  const totalStd = Math.sqrt(totalVariance);

  return {
    size: cleaned.length,
    mean: totalMean.toFixed(2),
    std: totalStd.toFixed(2),
    lowThreshold: lbLowVolThreshold.toFixed(2),
    highThreshold: lbHighVolThreshold.toFixed(2)
  };
}

// Export for app use
window.LimboEngine = {
  getWinProb: getLimboWinProb,
  roll: rollLimboResult,
  record: recordLimboResult,
  getRecoveryBet: getLimboRecoveryBet,
  predict: predictLimboNextState,
  clearHistory: clearLimboHistoryData,
  train: runLimboMonteCarlo,
  trainOnDataset: trainLimboModelOnDataset,
  getThresholds: () => ({ low: lbLowVolThreshold, high: lbHighVolThreshold }),
  getHistory: () => limboRollHistory.map(v => (typeof v === 'object' && v !== null) ? v.outcome : v),
  getRawHistory: () => [...limboRollHistory]
};
