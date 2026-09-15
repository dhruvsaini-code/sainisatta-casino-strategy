// Blackjack Basic Strategy Engine

const BLACKJACK_STRATEGY = {
  // Key format: "PlayerTotal/State" vs "DealerCard"
  // Actions: 'H' (Hit), 'S' (Stand), 'D' (Double if allowed, else Hit), 'Ds' (Double if allowed, else Stand), 'P' (Split)
  
  pairs: {
    'A,A':   { '2':'P', '3':'P', '4':'P', '5':'P', '6':'P', '7':'P', '8':'P', '9':'P', '10':'P', 'A':'P' },
    '10,10': { '2':'S', '3':'S', '4':'S', '5':'S', '6':'S', '7':'S', '8':'S', '9':'S', '10':'S', 'A':'S' },
    '9,9':   { '2':'P', '3':'P', '4':'P', '5':'P', '6':'P', '7':'S', '8':'P', '9':'P', '10':'S', 'A':'S' },
    '8,8':   { '2':'P', '3':'P', '4':'P', '5':'P', '6':'P', '7':'P', '8':'P', '9':'P', '10':'P', 'A':'P' },
    '7,7':   { '2':'P', '3':'P', '4':'P', '5':'P', '6':'P', '7':'P', '8':'H', '9':'H', '10':'H', 'A':'H' },
    '6,6':   { '2':'P', '3':'P', '4':'P', '5':'P', '6':'P', '7':'H', '8':'H', '9':'H', '10':'H', 'A':'H' },
    '5,5':   { '2':'D', '3':'D', '4':'D', '5':'D', '6':'D', '7':'D', '8':'D', '9':'D', '10':'H', 'A':'H' },
    '4,4':   { '2':'H', '3':'H', '4':'H', '5':'P', '6':'P', '7':'H', '8':'H', '9':'H', '10':'H', 'A':'H' },
    '3,3':   { '2':'P', '3':'P', '4':'P', '5':'P', '6':'P', '7':'P', '8':'H', '9':'H', '10':'H', 'A':'H' },
    '2,2':   { '2':'P', '3':'P', '4':'P', '5':'P', '6':'P', '7':'P', '8':'H', '9':'H', '10':'H', 'A':'H' }
  },
  
  soft: {
    'A,9': { '2':'S', '3':'S', '4':'S', '5':'S', '6':'S', '7':'S', '8':'S', '9':'S', '10':'S', 'A':'S' },
    'A,8': { '2':'S', '3':'S', '4':'S', '5':'S', '6':'Ds', '7':'S', '8':'S', '9':'S', '10':'S', 'A':'S' },
    'A,7': { '2':'Ds', '3':'Ds', '4':'Ds', '5':'Ds', '6':'Ds', '7':'S', '8':'S', '9':'H', '10':'H', 'A':'H' },
    'A,6': { '2':'H', '3':'D', '4':'D', '5':'D', '6':'D', '7':'H', '8':'H', '9':'H', '10':'H', 'A':'H' },
    'A,5': { '2':'H', '3':'H', '4':'D', '5':'D', '6':'D', '7':'H', '8':'H', '9':'H', '10':'H', 'A':'H' },
    'A,4': { '2':'H', '3':'H', '4':'D', '5':'D', '6':'D', '7':'H', '8':'H', '9':'H', '10':'H', 'A':'H' },
    'A,3': { '2':'H', '3':'H', '4':'H', '5':'D', '6':'D', '7':'H', '8':'H', '9':'H', '10':'H', 'A':'H' },
    'A,2': { '2':'H', '3':'H', '4':'H', '5':'D', '6':'D', '7':'H', '8':'H', '9':'H', '10':'H', 'A':'H' }
  },
  
  hard: {
    '17': { '2':'S', '3':'S', '4':'S', '5':'S', '6':'S', '7':'S', '8':'S', '9':'S', '10':'S', 'A':'S' },
    '16': { '2':'S', '3':'S', '4':'S', '5':'S', '6':'S', '7':'H', '8':'H', '9':'H', '10':'H', 'A':'H' },
    '15': { '2':'S', '3':'S', '4':'S', '5':'S', '6':'S', '7':'H', '8':'H', '9':'H', '10':'H', 'A':'H' },
    '14': { '2':'S', '3':'S', '4':'S', '5':'S', '6':'S', '7':'H', '8':'H', '9':'H', '10':'H', 'A':'H' },
    '13': { '2':'S', '3':'S', '4':'S', '5':'S', '6':'S', '7':'H', '8':'H', '9':'H', '10':'H', 'A':'H' },
    '12': { '2':'H', '3':'H', '4':'S', '5':'S', '6':'S', '7':'H', '8':'H', '9':'H', '10':'H', 'A':'H' },
    '11': { '2':'D', '3':'D', '4':'D', '5':'D', '6':'D', '7':'D', '8':'D', '9':'D', '10':'D', 'A':'D' },
    '10': { '2':'D', '3':'D', '4':'D', '5':'D', '6':'D', '7':'D', '8':'D', '9':'D', '10':'H', 'A':'H' },
    '9':  { '2':'H', '3':'D', '4':'D', '5':'D', '6':'D', '7':'H', '8':'H', '9':'H', '10':'H', 'A':'H' },
    '8':  { '2':'H', '3':'H', '4':'H', '5':'H', '6':'H', '7':'H', '8':'H', '9':'H', '10':'H', 'A':'H' }
  }
};

// Dealer bust probability table based on standard multi-deck rules (dealer hits on soft 17)
const DEALER_BUST_CHANCES = {
  '2': 35.30,
  '3': 37.56,
  '4': 40.28,
  '5': 42.89,
  '6': 42.08,
  '7': 25.99,
  '8': 23.86,
  '9': 23.34,
  '10': 21.43,
  'A': 11.65
};

// Map card ranks to Blackjack numerical values
function getCardValue(rank) {
  if (rank === 'A') return 11;
  if (['K', 'Q', 'J', '10'].includes(rank)) return 10;
  return parseInt(rank, 10);
}

function analyzeHand(playerCards) {
  let hasAce = false;
  let total = 0;
  let values = playerCards.map(r => getCardValue(r));
  
  for (let val of values) {
    total += val;
    if (val === 11) hasAce = true;
  }
  
  // Adjust Aces if total > 21
  let aceCount = playerCards.filter(r => r === 'A').length;
  while (total > 21 && aceCount > 0) {
    total -= 10;
    aceCount--;
  }
  
  const isPair = playerCards.length === 2 && playerCards[0] === playerCards[1];
  
  // Recalculate soft if we have an active Ace counting as 11
  let isSoft = false;
  if (hasAce) {
    let tempTotal = values.reduce((a, b) => a + b, 0);
    let tempAces = playerCards.filter(r => r === 'A').length;
    while (tempTotal > 21 && tempAces > 0) {
      tempTotal -= 10;
      tempAces--;
    }
    if (tempTotal <= 21 && tempAces < playerCards.filter(r => r === 'A').length) {
      // At least one Ace is valued as 11
      isSoft = true;
    } else if (playerCards.includes('A') && tempTotal <= 21 && playerCards.filter(r => r === 'A').length === 1 && tempTotal === total) {
      // Specific check for two-card soft hands or single ace hands where total is still soft
      isSoft = true;
    }
  }
  
  // Double check soft totals
  let hardSum = playerCards.filter(r => r !== 'A').reduce((a, b) => a + getCardValue(b), 0);
  let aceNum = playerCards.filter(r => r === 'A').length;
  if (aceNum > 0) {
    // If we count one Ace as 11 and others as 1
    let softSum = hardSum + 11 + (aceNum - 1);
    if (softSum <= 21) {
      isSoft = true;
      total = softSum;
    }
  }
  
  return { total, isSoft, isPair };
}

function getBlackjackRecommendation(playerInputCards, dealerUpcard, trueCount = 0) {
  if (!playerInputCards || playerInputCards.length < 2 || !dealerUpcard) {
    return {
      action: 'N/A',
      actionText: 'Awaiting Cards',
      winPercentage: 50,
      explanation: 'Please select 2 cards for your hand and 1 card for the dealer.'
    };
  }
  
  const { total, isSoft, isPair } = analyzeHand(playerInputCards);
  
  if (total > 21) {
    return {
      action: 'B',
      actionText: 'Busted',
      winPercentage: 0,
      explanation: 'Your hand total exceeds 21. You lose.'
    };
  }

  if (window.SattaAIPredictor) {
    const dValStr = ['K', 'Q', 'J'].includes(dealerUpcard) ? '10' : dealerUpcard;
    const dVal = dValStr === 'A' ? 11 : parseInt(dValStr, 10);
    const pred = window.SattaAIPredictor.predictBlackjack(total, dVal, trueCount, isSoft);
    return {
      action: pred.action,
      actionText: pred.actionText,
      winPercentage: pred.winPercentage,
      explanation: pred.explanation,
      total,
      isSoft,
      isPair
    };
  }
  
  if (total === 21 && playerInputCards.length === 2) {
    return {
      action: 'S',
      actionText: 'Stand (Blackjack)',
      winPercentage: 95,
      explanation: 'Natural Blackjack! Stand and collect your winnings unless dealer also has Blackjack.'
    };
  }
  
  let recCode = 'H';
  let explanation = '';
  let deviationApplied = false;
  
  const dValStr = ['K', 'Q', 'J'].includes(dealerUpcard) ? '10' : dealerUpcard;
  
  // Illustrious 18 Heuristics / Count Deviations
  if (!isSoft && !isPair) {
    if (total === 16 && dValStr === '10' && trueCount >= 0) {
      recCode = 'S';
      explanation = `[Illustrious 18 Deviation] True Count is ${trueCount.toFixed(1)} (>= 0). Stand on Hard 16 vs 10 (standard is Hit). `;
      deviationApplied = true;
    } else if (total === 15 && dValStr === '10' && trueCount >= 4) {
      recCode = 'S';
      explanation = `[Illustrious 18 Deviation] True Count is ${trueCount.toFixed(1)} (>= +4). Stand on Hard 15 vs 10 (standard is Hit). `;
      deviationApplied = true;
    } else if (total === 12 && dValStr === '3' && trueCount >= 2) {
      recCode = 'S';
      explanation = `[Illustrious 18 Deviation] True Count is ${trueCount.toFixed(1)} (>= +2). Stand on Hard 12 vs 3 (standard is Hit). `;
      deviationApplied = true;
    } else if (total === 12 && dValStr === '2' && trueCount >= 3) {
      recCode = 'S';
      explanation = `[Illustrious 18 Deviation] True Count is ${trueCount.toFixed(1)} (>= +3). Stand on Hard 12 vs 2 (standard is Hit). `;
      deviationApplied = true;
    } else if (total === 11 && dValStr === 'A' && trueCount >= 1) {
      recCode = 'D';
      explanation = `[Illustrious 18 Deviation] True Count is ${trueCount.toFixed(1)} (>= +1). Double Down on Hard 11 vs Ace (standard is Hit). `;
      deviationApplied = true;
    } else if (total === 10 && dValStr === '10' && trueCount >= 4) {
      recCode = 'D';
      explanation = `[Illustrious 18 Deviation] True Count is ${trueCount.toFixed(1)} (>= +4). Double Down on Hard 10 vs 10 (standard is Hit). `;
      deviationApplied = true;
    } else if (total === 10 && dValStr === 'A' && trueCount >= 4) {
      recCode = 'D';
      explanation = `[Illustrious 18 Deviation] True Count is ${trueCount.toFixed(1)} (>= +4). Double Down on Hard 10 vs Ace (standard is Hit). `;
      deviationApplied = true;
    } else if (total === 9 && dValStr === '2' && trueCount >= 1) {
      recCode = 'D';
      explanation = `[Illustrious 18 Deviation] True Count is ${trueCount.toFixed(1)} (>= +1). Double Down on Hard 9 vs 2 (standard is Hit). `;
      deviationApplied = true;
    } else if (total === 9 && dValStr === '7' && trueCount >= 3) {
      recCode = 'D';
      explanation = `[Illustrious 18 Deviation] True Count is ${trueCount.toFixed(1)} (>= +3). Double Down on Hard 9 vs 7 (standard is Hit). `;
      deviationApplied = true;
    } else if (total === 16 && dValStr === '9' && trueCount >= 5) {
      recCode = 'S';
      explanation = `[Illustrious 18 Deviation] True Count is ${trueCount.toFixed(1)} (>= +5). Stand on Hard 16 vs 9 (standard is Hit). `;
      deviationApplied = true;
    } else if (total === 13 && dValStr === '2' && trueCount <= -1) {
      recCode = 'H';
      explanation = `[Illustrious 18 Deviation] True Count is ${trueCount.toFixed(1)} (<= -1). Hit on Hard 13 vs 2 (standard is Stand). `;
      deviationApplied = true;
    } else if (total === 13 && dValStr === '3' && trueCount <= -2) {
      recCode = 'H';
      explanation = `[Illustrious 18 Deviation] True Count is ${trueCount.toFixed(1)} (<= -2). Hit on Hard 13 vs 3 (standard is Stand). `;
      deviationApplied = true;
    }
  }

  // Insurance Check
  if (dealerUpcard === 'A' && trueCount >= 3) {
    explanation += `[Insurance Alert] True Count is ${trueCount.toFixed(1)} (>= +3). It is mathematically profitable to take Insurance! `;
  }

  if (!deviationApplied) {
    // Pair Logic
    if (isPair) {
      const pairRank = playerInputCards[0];
      const key = `${pairRank},${pairRank}`;
      if (BLACKJACK_STRATEGY.pairs[key]) {
        recCode = BLACKJACK_STRATEGY.pairs[key][dValStr] || 'H';
        explanation = `Pairs of ${pairRank}s are analyzed for splitting. `;
      }
    } 
    // Soft Hand Logic
    else if (isSoft) {
      const nonAceTotal = total - 11;
      const key = `A,${nonAceTotal}`;
      if (BLACKJACK_STRATEGY.soft[key]) {
        recCode = BLACKJACK_STRATEGY.soft[key][dValStr] || 'H';
        explanation = `Soft total of ${total} (Ace + ${nonAceTotal}). `;
      } else {
        recCode = total >= 20 ? 'S' : 'H';
        explanation = `Soft total of ${total}. `;
      }
    } 
    // Hard Hand Logic
    else {
      let lookupTotal = total;
      if (total >= 17) lookupTotal = 17;
      if (total <= 8) lookupTotal = 8;
      
      const key = `${lookupTotal}`;
      if (BLACKJACK_STRATEGY.hard[key]) {
        recCode = BLACKJACK_STRATEGY.hard[key][dValStr] || 'H';
        explanation = `Hard total of ${total}. `;
      } else {
        recCode = 'H';
        explanation = `Hard total of ${total}. `;
      }
    }
  }
  
  // Map actions
  let actionText = 'Hit';
  if (recCode === 'S') actionText = 'Stand';
  if (recCode === 'D') actionText = playerInputCards.length === 2 ? 'Double Down' : 'Hit';
  if (recCode === 'Ds') actionText = playerInputCards.length === 2 ? 'Double Down' : 'Stand';
  if (recCode === 'P') actionText = 'Split';
  
  // Detailed Explanations & Ev Calculation
  let winPercentage = 50;
  const dValue = getCardValue(dValStr);
  const bustChance = DEALER_BUST_CHANCES[dValStr] || 25;
  
  if (actionText.includes('Stand')) {
    if (!deviationApplied) {
      explanation += `Standing is optimal because drawing another card carries a high bust risk, and the dealer upcard of ${dealerUpcard} has a ${bustChance}% chance of busting.`;
    }
    if (total >= 19) winPercentage = 65 + (total - 19) * 10;
    else if (total >= 17) winPercentage = 52 + (total - 17) * 5;
    else winPercentage = 20 + bustChance;
  } else if (actionText.includes('Hit')) {
    if (!deviationApplied) {
      explanation += `Hitting is optimal to improve your hand. With a total of ${total}, your risk of busting on a single hit is low, whereas standing gives the dealer an easy path to beat you.`;
    }
    if (total <= 11) winPercentage = 45 + (11 - total) * 2;
    else winPercentage = 25 + (21 - total) * 2;
  } else if (actionText.includes('Double')) {
    if (!deviationApplied) {
      explanation += `Double Down. You are in a strong mathematical position against the dealer upcard of ${dealerUpcard}. Doubling your wager maximizes long-term expected value.`;
    }
    winPercentage = 58;
  } else if (actionText.includes('Split')) {
    if (!deviationApplied) {
      explanation += `Splitting is optimal. Breaking your pair into two separate hands increases your overall winning equity.`;
    }
    winPercentage = 53;
  }
  
  // Adjust win percentage based on True Count (count increases player win probability slightly)
  winPercentage += Math.round(trueCount * 0.5);
  winPercentage = Math.max(5, Math.min(95, Math.round(winPercentage)));
  
  return {
    action: recCode,
    actionText,
    winPercentage,
    explanation,
    total,
    isSoft,
    isPair
  };
}

// Card Counting state variables
let cardCountHistory = [];
let shoeDecks = 6;

function getHiLoValue(rank) {
  if (['10', 'J', 'Q', 'K', 'A'].includes(rank)) return -1;
  if (['2', '3', '4', '5', '6'].includes(rank)) return 1;
  return 0;
}

function addDealtCardToCount(rank) {
  cardCountHistory.push(rank);
}

function removeDealtCardFromCount(index) {
  if (index >= 0 && index < cardCountHistory.length) {
    cardCountHistory.splice(index, 1);
  }
}

function clearShoeCount() {
  cardCountHistory = [];
}

function getRunningCount() {
  return cardCountHistory.reduce((sum, rank) => sum + getHiLoValue(rank), 0);
}

function getRemainingDecks() {
  const cardsDealt = cardCountHistory.length;
  const totalCards = shoeDecks * 52;
  const cardsRemaining = Math.max(0, totalCards - cardsDealt);
  return cardsRemaining / 52;
}

function getTrueCount() {
  const remDecks = getRemainingDecks();
  if (remDecks < 0.25) return getRunningCount() / 0.25;
  return getRunningCount() / remDecks;
}

function getRecommendedBetMultiplier() {
  const tc = getTrueCount();
  if (tc <= 1.0) return 1;
  if (tc >= 5.0) return 5;
  return Math.round(tc);
}

// Export for app use
window.BlackjackEngine = {
  getRecommendation: getBlackjackRecommendation,
  analyzeHand: analyzeHand,
  getCardValue: getCardValue,
  dealerBustChances: DEALER_BUST_CHANCES,
  addDealtCardToCount,
  removeDealtCardFromCount,
  clearShoeCount,
  getRunningCount,
  getTrueCount,
  getRemainingDecks,
  getRecommendedBetMultiplier,
  getHiLoValue,
  getShoeDecks: () => shoeDecks,
  setShoeDecks: (num) => { shoeDecks = parseInt(num, 10) || 6; },
  getDealtCards: () => cardCountHistory
};
