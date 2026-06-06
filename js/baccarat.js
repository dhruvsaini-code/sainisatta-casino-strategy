// Baccarat Strategy & Roadmap Engine

class BaccaratEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.shoeHistory = []; // Array of 'B' (Banker), 'P' (Player), 'T' (Tie)
    this.trendMode = 'math'; // 'math' (always Banker due to lower edge) or 'trend' (follows patterns)
  }

  addResult(result) {
    if (['B', 'P', 'T'].includes(result)) {
      this.shoeHistory.push(result);
    }
    return this.getAnalysis();
  }

  removeLastResult() {
    this.shoeHistory.pop();
    return this.getAnalysis();
  }

  setTrendMode(mode) {
    if (['math', 'trend'].includes(mode)) {
      this.trendMode = mode;
    }
    return this.getAnalysis();
  }

  getAnalysis() {
    // Standard statistics
    const bankerCount = this.shoeHistory.filter(x => x === 'B').length;
    const playerCount = this.shoeHistory.filter(x => x === 'P').length;
    const tieCount = this.shoeHistory.filter(x => x === 'T').length;
    const total = this.shoeHistory.length;
    
    // Default probabilities
    let pBanker = 45.86;
    let pPlayer = 44.62;
    let pTie = 9.52;
    
    // If shoe history is large enough, adjust probabilities slightly based on cards drawn (simulated drift)
    if (total > 10) {
      const bRatio = bankerCount / (bankerCount + playerCount);
      // Drift the probabilities slightly to simulate shoe variance
      pBanker = 45.86 + (bRatio - 0.5068) * 10;
      pPlayer = 44.62 + ((1 - bRatio) - 0.4932) * 10;
      // Bound
      pBanker = Math.max(35, Math.min(55, pBanker));
      pPlayer = Math.max(35, Math.min(55, pPlayer));
      pTie = 100 - pBanker - pPlayer;
    }
    
    // Calculate recommendations
    let recommendedBet = 'B'; // Banker is standard math choice
    let advice = 'Bet on Banker';
    let explanation = '';
    
    if (this.trendMode === 'math') {
      recommendedBet = 'B';
      advice = 'Bet Banker';
      explanation = 'The Banker bet has the lowest house edge in Baccarat (1.06% house edge, even with the 5% commission on wins), making it the mathematically superior bet long-term.';
    } else {
      // Trend following mode (e.g. Follow the Dragon or chop)
      if (total === 0) {
        recommendedBet = 'B';
        advice = 'Bet Banker';
        explanation = 'Shoe is empty. Standard mathematical starting choice is Banker.';
      } else {
        const lastResult = this.shoeHistory[total - 1];
        
        // Detect streak (Dragon) vs Alternate (Chop)
        const streakLength = this.getStreakLength();
        if (streakLength >= 3) {
          // Streak detected: follow the dragon!
          recommendedBet = lastResult === 'T' ? 'B' : lastResult;
          advice = `Bet ${recommendedBet === 'B' ? 'Banker' : 'Player'}`;
          explanation = `Streak of ${streakLength} consecutive outcomes detected ("Follow the Dragon" rule). Bet on the streak to continue.`;
        } else {
          // Chop or alternating: bet opposite of last non-tie result
          let lastNonTie = 'B';
          for (let i = total - 1; i >= 0; i--) {
            if (this.shoeHistory[i] !== 'T') {
              lastNonTie = this.shoeHistory[i];
              break;
            }
          }
          recommendedBet = lastNonTie === 'B' ? 'P' : 'B';
          advice = `Bet ${recommendedBet === 'B' ? 'Banker' : 'Player'}`;
          explanation = `Alternating shoe trend detected. Play the "Chop" strategy: bet opposite of the last non-tie result.`;
        }
      }
    }
    
    const roadmaps = this.generateRoadmaps();
    
    return {
      history: this.shoeHistory,
      counts: { Banker: bankerCount, Player: playerCount, Tie: tieCount },
      probabilities: { Banker: Math.round(pBanker), Player: Math.round(pPlayer), Tie: Math.round(pTie) },
      recommendedBet,
      advice,
      explanation,
      roadmaps
    };
  }

  getStreakLength() {
    if (this.shoeHistory.length === 0) return 0;
    
    // Filter out ties for streak analysis
    const nonTies = this.shoeHistory.filter(x => x !== 'T');
    if (nonTies.length === 0) return 0;
    
    const last = nonTies[nonTies.length - 1];
    let streak = 0;
    for (let i = nonTies.length - 1; i >= 0; i--) {
      if (nonTies[i] === last) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  generateRoadmaps() {
    // Bead Plate: Simple grid sequential filler (col by col or row by row)
    // We will lay it out row by row, 6 rows per column, typical in casinos.
    const rows = 6;
    const cols = 12;
    const beadPlate = Array(rows * cols).fill(null);
    
    for (let i = 0; i < Math.min(this.shoeHistory.length, rows * cols); i++) {
      beadPlate[i] = this.shoeHistory[i];
    }
    
    // Big Road: Stacks streaks vertically in columns, shifting to next col on change
    // If a streak exceeds 6 rows, it turns right (creating a "dragon tail").
    const bigRoad = Array(rows).fill(null).map(() => Array(cols).fill(null));
    let currentCol = 0;
    let currentRow = 0;
    let lastOutcome = null;
    
    for (let outcome of this.shoeHistory) {
      if (outcome === 'T') {
        // Ties are typically represented as a green stripe on the last circle.
        // For simplicity, we just mark it on the last placed cell or place a 'T'
        // if it's the very start of the shoe.
        if (lastOutcome === null) {
          bigRoad[currentRow][currentCol] = 'T';
          lastOutcome = 'T';
        } else {
          // Tie goes on top of the last non-tie cell
          // We will handle tie markers in client rendering.
        }
        continue;
      }
      
      if (lastOutcome === null) {
        bigRoad[currentRow][currentCol] = outcome;
        lastOutcome = outcome;
      } else if (outcome === lastOutcome) {
        // Same outcome, stack vertically
        if (currentRow + 1 < rows && bigRoad[currentRow + 1][currentCol] === null) {
          currentRow++;
          bigRoad[currentRow][currentCol] = outcome;
        } else {
          // Turn right (dragon tail)
          let slideCol = currentCol + 1;
          while (slideCol < cols && bigRoad[currentRow][slideCol] !== null) {
            slideCol++;
          }
          if (slideCol < cols) {
            bigRoad[currentRow][slideCol] = outcome;
          }
        }
      } else {
        // Different outcome, new column
        currentCol++;
        if (currentCol >= cols) {
          // Shift columns left if we exceed grid size
          for (let r = 0; r < rows; r++) {
            bigRoad[r].shift();
            bigRoad[r].push(null);
          }
          currentCol = cols - 1;
        }
        currentRow = 0;
        bigRoad[currentRow][currentCol] = outcome;
        lastOutcome = outcome;
      }
    }
    
    return {
      beadPlate,
      bigRoad
    };
  }
}

// Export for app use
window.BaccaratEngine = new BaccaratEngine();
