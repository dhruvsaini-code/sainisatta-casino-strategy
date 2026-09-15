// Mines Strategy Engine & Simulator

const MINES_TOTAL_TILES = 25;

// Load persistent spatial training data (frequencies of mines spawning on each of the 25 tiles)
let mineSpawnCounts = Array(25).fill(0);
try {
  const saved = localStorage.getItem('mn_spawn_counts');
  if (saved) {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed) && parsed.length === 25) {
      mineSpawnCounts = parsed;
    }
  }
} catch (e) {
  console.warn("Could not load Mines spatial training weights:", e);
}

// Calculates the exact multiplier for a given number of mines and diamonds revealed
function getMinesMultiplier(minesCount, diamondsCount) {
  if (diamondsCount === 0) return 1.0;
  if (diamondsCount + minesCount > MINES_TOTAL_TILES) return 0.0;
  
  let mult = 0.99; // 1% house edge standard
  for (let i = 0; i < diamondsCount; i++) {
    mult *= (MINES_TOTAL_TILES - i) / (MINES_TOTAL_TILES - minesCount - i);
  }
  return Math.round(mult * 100) / 100;
}

// Calculates conditional probability of next click being safe
function getMinesNextSafeProb(minesCount, diamondsCount) {
  const remainingTiles = MINES_TOTAL_TILES - diamondsCount;
  const remainingMines = minesCount;
  const safeTiles = remainingTiles - remainingMines;
  if (remainingTiles <= 0) return 0;
  return (safeTiles / remainingTiles) * 100;
}

// Kelly Criterion recommendation for Mines (Adjusted for house edge)
function getMinesKellyWager(safeProbPct, currentMultiplier, nextMultiplier) {
  const p = safeProbPct / 100;
  const q = 1 - p;
  const b = (nextMultiplier / currentMultiplier) - 1;
  if (b <= 0) return 0;
  
  const f = (p * b - q) / b;
  return Math.max(0, Math.min(0.25, f));
}

// Registers mine spawn coordinates to train the spatial layout engine
function saveMinesSpawnPattern(mineLocations) {
  if (window.SattaAIPredictor && Array.isArray(mineLocations)) {
    window.SattaAIPredictor.learnMines(mineLocations);
  }
  
  if (!Array.isArray(mineLocations)) return;
  mineLocations.forEach(idx => {
    if (idx >= 0 && idx < 25) {
      mineSpawnCounts[idx]++;
    }
  });
  
  // Persist to browser storage
  try {
    localStorage.setItem('mn_spawn_counts', JSON.stringify(mineSpawnCounts));
  } catch (e) {
    console.warn("Could not save Mines spatial training weights:", e);
  }
}

// Selects the unrevealed tile with the lowest historical mine spawn rate
function getMinesRecommendedTile(revealedStates, minesCount = 3) {
  if (window.SattaAIPredictor) {
    return window.SattaAIPredictor.predictMines(revealedStates, null, minesCount);
  }
  
  let bestIdx = -1;
  let minCount = Infinity;
  
  // Calculate total rounds to provide percentages
  const totalSpawns = mineSpawnCounts.reduce((a, b) => a + b, 0);

  // We check unrevealed positions
  for (let i = 0; i < 25; i++) {
    if (!revealedStates[i]) {
      const count = mineSpawnCounts[i];
      if (count < minCount) {
        minCount = count;
        bestIdx = i;
      }
    }
  }

  // Calculate empirical safety percentage
  let safetyPct = 100;
  if (totalSpawns > 0 && bestIdx !== -1) {
    const totalPosSpawns = Math.max(1, totalSpawns / 25);
    const relativeRisk = mineSpawnCounts[bestIdx] / totalPosSpawns; // risk relative to uniform distribution
    safetyPct = Math.max(5, Math.min(99.9, 100 - (relativeRisk * 15))); // map to a realistic safety ratio
  }

  return {
    tileIndex: bestIdx,
    row: Math.floor(bestIdx / 5) + 1,
    col: (bestIdx % 5) + 1,
    safetyPct: Math.round(safetyPct)
  };
}

// Resets persistent training data
function clearMinesTrainingData() {
  mineSpawnCounts.fill(0);
  try {
    localStorage.removeItem('mn_spawn_counts');
  } catch (e) {
    console.warn("Could not reset training logs:", e);
  }
}

// Monte Carlo simulator to "train" and find the optimal cash-out threshold,
// and optionally fast-train the spatial weights by feeding simulated mine layouts
function runMinesMonteCarlo(minesCount, startingBankroll = 1000, baseBet = 10, simRounds = 5000, trainSpatial = true) {
  const results = [];
  const maxTarget = MINES_TOTAL_TILES - minesCount;
  
  for (let target = 1; target <= Math.min(15, maxTarget); target++) {
    let bankroll = startingBankroll;
    let wins = 0;
    let losses = 0;
    const history = [];
    
    const targetMult = getMinesMultiplier(minesCount, target);
    
    for (let round = 0; round < simRounds; round++) {
      const tiles = Array(MINES_TOTAL_TILES).fill(false); // false = gem, true = mine
      const mineLocations = [];
      
      while (mineLocations.length < minesCount) {
        const idx = Math.floor(Math.random() * MINES_TOTAL_TILES);
        if (!tiles[idx]) {
          tiles[idx] = true;
          mineLocations.push(idx);
        }
      }
      
      // Fast-train spatial weights in real-time if enabled
      if (trainSpatial && target === 1) { // only feed once per round iteration
        saveMinesSpawnPattern(mineLocations);
      }
      
      // Simulate click path using current spatial weights
      let hitMine = false;
      const clickedIndices = [];
      const tempRevealed = Array(25).fill(false);
      
      while (clickedIndices.length < target) {
        // Recommend Safest Tile based on current weights
        const rec = getMinesRecommendedTile(tempRevealed, minesCount);
        const idx = rec.tileIndex;
        if (idx === -1) break;
        
        clickedIndices.push(idx);
        tempRevealed[idx] = true;
        
        if (tiles[idx]) {
          hitMine = true;
          break;
        }
      }
      
      if (hitMine) {
        bankroll -= baseBet;
        losses++;
      } else {
        bankroll += baseBet * (targetMult - 1);
        wins++;
      }
      
      if (round % Math.max(1, Math.round(simRounds / 20)) === 0) {
        history.push(bankroll);
      }
    }
    
    const winRate = (wins / simRounds) * 100;
    const profit = bankroll - startingBankroll;
    results.push({
      target,
      winRate,
      multiplier: targetMult,
      profit,
      bankrollHistory: history
    });
  }
  
  const bestStrategy = results.reduce((prev, current) => (prev.profit > current.profit) ? prev : current, results[0]);
  
  return {
    bestTarget: bestStrategy.target,
    bestMultiplier: bestStrategy.multiplier,
    bestProfit: bestStrategy.profit,
    bestWinRate: bestStrategy.winRate,
    history: bestStrategy.bankrollHistory,
    allTargets: results
  };
}

// Export for app use
window.MinesEngine = {
  getMultiplier: getMinesMultiplier,
  getSafeProb: getMinesNextSafeProb,
  getKelly: getMinesKellyWager,
  saveSpawn: saveMinesSpawnPattern,
  getRecommendation: getMinesRecommendedTile,
  clearWeights: clearMinesTrainingData,
  train: runMinesMonteCarlo,
  getSpawnCounts: () => [...mineSpawnCounts]
};
