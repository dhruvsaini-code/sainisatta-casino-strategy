// Texas Hold'em Poker Strategy Engine (Monte Carlo Sim)

const SUITS = ['s', 'h', 'd', 'c']; // spades, hearts, diamonds, clubs
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const HAND_TYPES = {
  ROYAL_FLUSH: 9,
  STRAIGHT_FLUSH: 8,
  FOUR_OF_KIND: 7,
  FULL_HOUSE: 6,
  FLUSH: 5,
  STRAIGHT: 4,
  THREE_OF_KIND: 3,
  TWO_PAIR: 2,
  PAIR: 1,
  HIGH_CARD: 0
};

const HAND_NAMES = [
  "High Card", "One Pair", "Two Pair", "Three of a Kind", 
  "Straight", "Flush", "Full House", "Four of a Kind", 
  "Straight Flush", "Royal Flush"
];

// Helper to convert rank char to score
function rankToScore(rank) {
  if (rank === 'A') return 14;
  if (rank === 'K') return 13;
  if (rank === 'Q') return 12;
  if (rank === 'J') return 11;
  return parseInt(rank, 10);
}

// Check 5 cards and return evaluation score object
function evaluate5CardHand(cards) {
  // Sort cards by value descending
  const sorted = [...cards].sort((a, b) => b.value - a.value);
  
  const isFlush = sorted.every(c => c.suit === sorted[0].suit);
  
  // Straight check (including wheel straight: A-2-3-4-5)
  let isStraight = false;
  let straightHigh = 0;
  
  const uniqueVals = [...new Set(sorted.map(c => c.value))];
  if (uniqueVals.length === 5) {
    if (sorted[0].value - sorted[4].value === 4) {
      isStraight = true;
      straightHigh = sorted[0].value;
    } else if (sorted[0].value === 14 && sorted[1].value === 5 && sorted[4].value === 2) {
      // Wheel straight: A-5-4-3-2. Ace acts as 1.
      isStraight = true;
      straightHigh = 5;
    }
  }
  
  // Count frequencies
  const counts = {};
  for (let c of sorted) {
    counts[c.value] = (counts[c.value] || 0) + 1;
  }
  
  const frequencies = Object.entries(counts)
    .map(([val, freq]) => ({ value: parseInt(val), count: freq }))
    .sort((a, b) => b.count - a.count || b.value - a.value);
  
  let type = HAND_TYPES.HIGH_CARD;
  let tieBreakers = [];
  
  if (isFlush && isStraight) {
    type = straightHigh === 14 ? HAND_TYPES.ROYAL_FLUSH : HAND_TYPES.STRAIGHT_FLUSH;
    tieBreakers = [straightHigh];
  } else if (frequencies[0].count === 4) {
    type = HAND_TYPES.FOUR_OF_KIND;
    tieBreakers = [frequencies[0].value, frequencies[1].value];
  } else if (frequencies[0].count === 3 && frequencies[1].count === 2) {
    type = HAND_TYPES.FULL_HOUSE;
    tieBreakers = [frequencies[0].value, frequencies[1].value];
  } else if (isFlush) {
    type = HAND_TYPES.FLUSH;
    tieBreakers = sorted.map(c => c.value);
  } else if (isStraight) {
    type = HAND_TYPES.STRAIGHT;
    tieBreakers = [straightHigh];
  } else if (frequencies[0].count === 3) {
    type = HAND_TYPES.THREE_OF_KIND;
    tieBreakers = [frequencies[0].value, frequencies[1].value, frequencies[2].value];
  } else if (frequencies[0].count === 2 && frequencies[1].count === 2) {
    type = HAND_TYPES.TWO_PAIR;
    tieBreakers = [frequencies[0].value, frequencies[1].value, frequencies[2].value];
  } else if (frequencies[0].count === 2) {
    type = HAND_TYPES.PAIR;
    tieBreakers = [frequencies[0].value, ...frequencies.slice(1).map(f => f.value)];
  } else {
    type = HAND_TYPES.HIGH_CARD;
    tieBreakers = sorted.map(c => c.value);
  }
  
  // Calculate a single comparable score value
  // Formula: type * 15^5 + tieBreakers weighted
  let totalScore = type;
  for (let i = 0; i < 5; i++) {
    const val = tieBreakers[i] || 0;
    totalScore = totalScore * 15 + val;
  }
  
  return {
    type,
    name: HAND_NAMES[type],
    score: totalScore
  };
}

// Generate combinations of 5 cards from n cards
function getBest5CardHand(allCards) {
  let bestHand = null;
  
  // Helper to generate combinations recursively
  function getCombos(arr, len) {
    let result = [];
    function helper(start, combo) {
      if (combo.length === len) {
        result.push([...combo]);
        return;
      }
      for (let i = start; i < arr.length; i++) {
        combo.push(arr[i]);
        helper(i + 1, combo);
        combo.pop();
      }
    }
    helper(0, []);
    return result;
  }
  
  const combos = getCombos(allCards, 5);
  for (let combo of combos) {
    const evaluated = evaluate5CardHand(combo);
    if (!bestHand || evaluated.score > bestHand.score) {
      bestHand = evaluated;
    }
  }
  
  return bestHand;
}

// Run Monte Carlo simulation
function runPokerSimulation(playerCards, boardCards, opponentCount = 1, iterations = 600) {
  // Parse inputs
  // playerCards: ['As', 'Kd']
  // boardCards: ['Qc', '10d', '5s'] (can be 0, 3, 4, 5)
  const parsedPlayer = playerCards.map(c => ({
    rank: c.slice(0, -1),
    suit: c.slice(-1),
    value: rankToScore(c.slice(0, -1))
  }));
  
  const parsedBoard = boardCards.map(c => ({
    rank: c.slice(0, -1),
    suit: c.slice(-1),
    value: rankToScore(c.slice(0, -1))
  }));
  
  // Build remaining deck
  const usedCardStrings = new Set([...playerCards, ...boardCards]);
  const baseDeck = [];
  for (let r of RANKS) {
    for (let s of SUITS) {
      const cardStr = r + s;
      if (!usedCardStrings.has(cardStr)) {
        baseDeck.push({ rank: r, suit: s, value: rankToScore(r) });
      }
    }
  }
  
  let playerWins = 0;
  let playerTies = 0;
  let playerLosses = 0;
  
  // Shuffle helper
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
  
  for (let sim = 0; sim < iterations; sim++) {
    // Clone deck and shuffle
    const deck = [...baseDeck];
    shuffle(deck);
    
    // Complete the board if needed
    const simBoard = [...parsedBoard];
    while (simBoard.length < 5) {
      simBoard.push(deck.pop());
    }
    
    // Evaluate player hand
    const playerBest = getBest5CardHand([...parsedPlayer, ...simBoard]);
    
    // Deal and evaluate opponents
    let opponentBestScore = -1;
    let playerWonSim = true;
    let playerTiedSim = false;
    
    for (let op = 0; op < opponentCount; op++) {
      const opCards = [deck.pop(), deck.pop()];
      const opBest = getBest5CardHand([...opCards, ...simBoard]);
      
      if (opBest.score > opponentBestScore) {
        opponentBestScore = opBest.score;
      }
    }
    
    if (playerBest.score > opponentBestScore) {
      playerWins++;
    } else if (playerBest.score === opponentBestScore) {
      playerTies++;
    } else {
      playerLosses++;
    }
  }
  
  const total = playerWins + playerTies + playerLosses;
  const winRate = (playerWins / total) * 100;
  const tieRate = (playerTies / total) * 100;
  const lossRate = (playerLosses / total) * 100;
  
  // Equity is win% + (tie% / 2)
  const equity = winRate + (tieRate / 2);
  
  // Current hand strength on board
  const currentHand = getBest5CardHand([...parsedPlayer, ...parsedBoard]);
  
  return {
    equity: Math.round(equity),
    winRate: Math.round(winRate),
    tieRate: Math.round(tieRate),
    lossRate: Math.round(lossRate),
    currentHandName: currentHand ? currentHand.name : "High Card"
  };
}

// Recommends betting decision based on equity, pot odds
function getPokerAdvice(equity, potSize = 100, callSize = 20) {
  // Pot odds = callSize / (potSize + callSize)
  const potOdds = (callSize / (potSize + callSize)) * 100;
  
  let action = 'Check/Fold';
  let colorClass = 'value-red';
  let explanation = '';
  
  if (equity > potOdds + 15) {
    action = 'Raise';
    colorClass = 'value-green';
    explanation = `Your equity (${equity}%) is significantly higher than your pot odds requirement (${Math.round(potOdds)}%). Raising extracts maximum value from opponents who hold weaker hands.`;
  } else if (equity > potOdds) {
    action = 'Call / Check';
    colorClass = 'value-cyan';
    explanation = `Your equity (${equity}%) justifies continuing in the hand compared to the price offered by the pot (${Math.round(potOdds)}%). Checking or calling is a profitable decision.`;
  } else {
    action = callSize === 0 ? 'Check' : 'Fold';
    colorClass = callSize === 0 ? 'value-cyan' : 'value-red';
    explanation = callSize === 0 
      ? `Checking is free, allowing you to see the next card. Your win probability is low, so do not call any bets.`
      : `Your winning probability (${equity}%) is below the odds needed to make calling profitable (${Math.round(potOdds)}%). Fold to conserve chip stack.`;
  }
  
  return {
    action,
    colorClass,
    explanation,
    potOdds: Math.round(potOdds)
  };
}

function calculateOuts(playerCards, boardCards) {
  if (playerCards.length < 2 || boardCards.length < 3 || boardCards.length >= 5) {
    return { outs: [], count: 0, text: "Outs calculation only available on Flop (3-card board) or Turn (4-card board)." };
  }

  const parsedPlayer = playerCards.map(c => ({
    rank: c.slice(0, -1),
    suit: c.slice(-1),
    value: rankToScore(c.slice(0, -1))
  }));
  
  const parsedBoard = boardCards.map(c => ({
    rank: c.slice(0, -1),
    suit: c.slice(-1),
    value: rankToScore(c.slice(0, -1))
  }));

  const currentHand = getBest5CardHand([...parsedPlayer, ...parsedBoard]);
  const currentType = currentHand ? currentHand.type : HAND_TYPES.HIGH_CARD;

  // Build remaining deck
  const usedCardStrings = new Set([...playerCards, ...boardCards]);
  const baseDeck = [];
  const cardSuits = ['s', 'h', 'd', 'c'];
  const cardRanks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  for (let r of cardRanks) {
    for (let s of cardSuits) {
      const cardStr = r + s;
      if (!usedCardStrings.has(cardStr)) {
        baseDeck.push({ rank: r, suit: s, value: rankToScore(r) });
      }
    }
  }

  const outs = [];
  for (let card of baseDeck) {
    const nextBoard = [...parsedBoard, card];
    const nextHand = getBest5CardHand([...parsedPlayer, ...nextBoard]);
    if (nextHand && nextHand.type > currentType) {
      outs.push(card);
    } else if (nextHand && currentType === HAND_TYPES.PAIR && nextHand.type === HAND_TYPES.PAIR) {
      // If we had a pair, make sure our score increased significantly (e.g. hitting trips/two-pair)
      if (nextHand.score > currentHand.score + 50) {
        outs.push(card);
      }
    }
  }

  const suitSymbols = { 's': '♠', 'h': '♥', 'd': '♦', 'c': '♣' };
  let count = outs.length;
  let summary = "";
  if (count === 0) {
    summary = "No clear improving outs detected.";
  } else {
    const outsStr = outs.map(c => c.rank + suitSymbols[c.suit]).join(", ");
    const nextStreetProb = ((count / baseDeck.length) * 100).toFixed(1);
    summary = `${count} Outs detected: [${outsStr}]. Probability of hitting on next card: ${nextStreetProb}%.`;
  }

  return {
    outs: outs.map(c => c.rank + c.suit),
    count,
    text: summary
  };
}

// Export for app use
window.PokerEngine = {
  runSimulation: runPokerSimulation,
  getAdvice: getPokerAdvice,
  calculateOuts
};
