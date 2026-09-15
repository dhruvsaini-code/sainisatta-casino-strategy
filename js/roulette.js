// Roulette Betting Progression Engine

const ROULETTE_SYSTEMS = {
  MARTINGALE: 'Martingale',
  FIBONACCI: 'Fibonacci',
  DALEMBERT: "D'Alembert",
  LABOUCHERE: 'Labouchere'
};

const WHEEL_TYPES = {
  EUROPEAN: 'European (Single Zero)',
  AMERICAN: 'American (Double Zero)'
};

class RouletteEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.baseBet = 10;
    this.currentBet = 10;
    this.system = ROULETTE_SYSTEMS.MARTINGALE;
    this.wheelType = WHEEL_TYPES.EUROPEAN;
    this.history = []; // Array of { bet, won: boolean, profit: number }
    this.fibSequence = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377];
    this.fibIndex = 0;
    this.dalembertMultiplier = 1;
    this.labouchereSequence = [1, 2, 3, 4];
    this.currentLabSequence = [...this.labouchereSequence];
  }

  setParameters(baseBet, system, wheelType, labSequenceInput = null) {
    this.baseBet = parseFloat(baseBet) || 10;
    this.system = system || ROULETTE_SYSTEMS.MARTINGALE;
    this.wheelType = wheelType || WHEEL_TYPES.EUROPEAN;
    
    if (labSequenceInput) {
      this.labouchereSequence = labSequenceInput.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n) && n > 0);
      if (this.labouchereSequence.length === 0) {
        this.labouchereSequence = [1, 2, 3, 4];
      }
    }
    
    this.recalculateNextBet();
  }

  recordResult(won) {
    const roundBet = this.currentBet;
    let roundProfit = won ? roundBet : -roundBet;
    
    if (window.SattaAIPredictor) {
      const pastColors = this.history.map(h => h.won ? 'R' : 'B');
      window.SattaAIPredictor.learnRoulette(pastColors, won ? 'R' : 'B');
    }
    
    // Record history
    this.history.push({
      step: this.history.length + 1,
      bet: roundBet,
      won: won,
      profit: roundProfit
    });

    // Update progression state based on system
    if (this.system === ROULETTE_SYSTEMS.MARTINGALE) {
      if (won) {
        this.currentBet = this.baseBet; // Reset
      } else {
        this.currentBet = this.currentBet * 2; // Double bet
      }
    } 
    
    else if (this.system === ROULETTE_SYSTEMS.FIBONACCI) {
      if (won) {
        // Go back 2 steps
        this.fibIndex = Math.max(0, this.fibIndex - 2);
      } else {
        // Go forward 1 step
        this.fibIndex = Math.min(this.fibSequence.length - 1, this.fibIndex + 1);
      }
      this.currentBet = this.baseBet * this.fibSequence[this.fibIndex];
    } 
    
    else if (this.system === ROULETTE_SYSTEMS.DALEMBERT) {
      if (won) {
        // Decrease bet multiplier by 1 (min 1)
        this.dalembertMultiplier = Math.max(1, this.dalembertMultiplier - 1);
      } else {
        // Increase bet multiplier by 1
        this.dalembertMultiplier += 1;
      }
      this.currentBet = this.baseBet * this.dalembertMultiplier;
    } 
    
    else if (this.system === ROULETTE_SYSTEMS.LABOUCHERE) {
      if (won) {
        // Remove first and last numbers
        if (this.currentLabSequence.length <= 2) {
          // Sequence completed! Reset
          this.currentLabSequence = [...this.labouchereSequence];
        } else {
          this.currentLabSequence.shift();
          this.currentLabSequence.pop();
        }
      } else {
        // Append lost bet to end of sequence
        this.currentLabSequence.push(roundBet / this.baseBet);
      }
      
      this.recalculateLabBet();
    }

    return this.getCurrentStatus();
  }

  recalculateNextBet() {
    if (this.history.length === 0) {
      this.fibIndex = 0;
      this.dalembertMultiplier = 1;
      this.currentLabSequence = [...this.labouchereSequence];
      
      if (this.system === ROULETTE_SYSTEMS.LABOUCHERE) {
        this.recalculateLabBet();
      } else {
        this.currentBet = this.baseBet;
      }
    }
  }

  recalculateLabBet() {
    if (this.currentLabSequence.length === 0) {
      this.currentLabSequence = [...this.labouchereSequence];
    }
    
    if (this.currentLabSequence.length === 1) {
      this.currentBet = this.currentLabSequence[0] * this.baseBet;
    } else {
      const first = this.currentLabSequence[0];
      const last = this.currentLabSequence[this.currentLabSequence.length - 1];
      this.currentBet = (first + last) * this.baseBet;
    }
  }

  undoLastStep() {
    if (this.history.length === 0) return this.getCurrentStatus();
    
    this.history.pop();
    
    // Replay history to rebuild the state
    const savedHistory = [...this.history];
    const savedBaseBet = this.baseBet;
    const savedSystem = this.system;
    const savedWheelType = this.wheelType;
    const savedLabSeq = [...this.labouchereSequence];

    this.reset();
    this.baseBet = savedBaseBet;
    this.system = savedSystem;
    this.wheelType = savedWheelType;
    this.labouchereSequence = savedLabSeq;
    this.currentLabSequence = [...savedLabSeq];

    for (let round of savedHistory) {
      this.recordResult(round.won);
    }
    
    this.recalculateNextBet();
    return this.getCurrentStatus();
  }

  getCurrentStatus() {
    const winRate = this.wheelType === WHEEL_TYPES.EUROPEAN ? 48.65 : 47.37;
    const houseEdge = this.wheelType === WHEEL_TYPES.EUROPEAN ? 2.70 : 5.26;
    
    let advice = '';
    let explanation = '';
    
    if (this.system === ROULETTE_SYSTEMS.MARTINGALE) {
      const lossStreak = this.getConsecutiveLosses();
      advice = `Bet $${this.currentBet.toFixed(2)} on Red, Black, Even, Odd, High, or Low.`;
      explanation = `Martingale progression. After ${lossStreak} consecutive losses, we double the previous bet to recover all losses plus a small profit of one base unit on the next win.`;
      if (lossStreak >= 5) {
        explanation += ` WARNING: High loss streak! Ensure you do not hit table limits or exceed your bankroll.`;
      }
    } 
    
    else if (this.system === ROULETTE_SYSTEMS.FIBONACCI) {
      advice = `Bet $${this.currentBet.toFixed(2)} on Even Money layout slots.`;
      explanation = `Fibonacci progression (index ${this.fibIndex}, multiplier x${this.fibSequence[this.fibIndex]}). When you lose, advance 1 step. When you win, retreat 2 steps. This is less aggressive than Martingale.`;
    } 
    
    else if (this.system === ROULETTE_SYSTEMS.DALEMBERT) {
      advice = `Bet $${this.currentBet.toFixed(2)} on Even Money spaces.`;
      explanation = `D'Alembert progression (unit size: $${this.baseBet}, multiplier: x${this.dalembertMultiplier}). This system increases the wager by 1 unit after a loss and decreases it by 1 unit after a win.`;
    } 
    
    else if (this.system === ROULETTE_SYSTEMS.LABOUCHERE) {
      advice = `Bet $${this.currentBet.toFixed(2)} on Even Money spaces.`;
      explanation = `Labouchere system. Current queue: [${this.currentLabSequence.join(', ')}]. Next bet is the sum of the first and last numbers multiplied by the unit value: (${this.currentLabSequence[0]} + ${this.currentLabSequence.length > 1 ? this.currentLabSequence[this.currentLabSequence.length - 1] : 0}) * $${this.baseBet}.`;
    }

    const netProfit = this.history.reduce((sum, h) => sum + h.profit, 0);

    return {
      nextBet: this.currentBet,
      system: this.system,
      wheelType: this.wheelType,
      winPercentage: winRate,
      houseEdge: houseEdge,
      history: this.history,
      netProfit: netProfit,
      advice,
      explanation,
      labSequence: [...this.currentLabSequence]
    };
  }

  getConsecutiveLosses() {
    let streak = 0;
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (!this.history[i].won) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }
}

// Export for app use
window.RouletteEngine = new RouletteEngine();
window.ROULETTE_SYSTEMS = ROULETTE_SYSTEMS;
window.WHEEL_TYPES = WHEEL_TYPES;
