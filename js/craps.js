// Craps Strategy Engine

const CRAPS_PHASES = {
  COMEOUT: 'Come-out Roll',
  POINT: 'Point Established'
};

const CRAPS_BETS = [
  { name: 'Pass Line', houseEdge: 1.41, payout: '1:1', description: 'Placed during Come-out. Wins on 7 or 11; loses on 2, 3, 12. Else, establishes Point.', recommended: true, phase: 'Come-out Roll' },
  { name: "Don't Pass", houseEdge: 1.36, payout: '1:1', description: "Placed during Come-out. Wins on 2 or 3; loses on 7 or 11; pushes on 12. Else, establishes Point.", recommended: true, phase: 'Come-out Roll' },
  { name: 'Odds Bet (Taking Odds)', houseEdge: 0.00, payout: '2:1 on 4/10, 3:2 on 5/9, 6:5 on 6/8', description: 'Placed behind Pass Line once Point is set. Fair mathematical odds (0% house edge!). ALWAYS play this.', recommended: true, phase: 'Point Established' },
  { name: 'Place Bet (6 or 8)', houseEdge: 1.52, payout: '7:6', description: 'Betting that 6 or 8 is rolled before a 7. Good backup bet.', recommended: true, phase: 'Point Established' },
  { name: 'Come Bet', houseEdge: 1.41, payout: '1:1', description: 'Equivalent to a Pass Line bet, but placed during Point phase. Establishes its own Come Point.', recommended: false, phase: 'Point Established' },
  { name: 'Field Bet', houseEdge: 5.56, payout: '1:1 (2:1 on 2, 3:1 on 12)', description: 'One-roll bet. Wins on 2, 3, 4, 9, 10, 11, 12. High house edge, not recommended.', recommended: false, phase: 'Both' },
  { name: 'Any 7', houseEdge: 16.67, payout: '4:1', description: 'One-roll bet that the next roll is 7. Terrible bet with extremely high house edge.', recommended: false, phase: 'Both' },
  { name: 'Hardways (6 or 8)', houseEdge: 9.09, payout: '9:1', description: 'Betting 6 or 8 is rolled as a pair (3-3 or 4-4) before a 7 or soft number. High house edge.', recommended: false, phase: 'Point Established' }
];

// Number of dice combinations out of 36
const DICE_COMBOS = {
  2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1
};

function getCrapsAnalysis(phase, pointValue = null) {
  let advice = '';
  let explanation = '';
  let recommendedBetsList = [];
  let winPercentage = 50;

  if (phase === CRAPS_PHASES.COMEOUT) {
    winPercentage = 49.3; // Pass Line win probability
    recommendedBetsList = CRAPS_BETS.filter(b => b.recommended && b.phase === 'Come-out Roll');
    
    advice = 'Bet Pass Line or Don\'t Pass';
    explanation = 'During the Come-out roll, the Pass Line (1.41% edge) and Don\'t Pass (1.36% edge) are the most mathematically sound options. Avoid all one-roll proposition bets in the center of the layout.';
  } else {
    // Point established
    const pt = parseInt(pointValue, 10) || 6;
    recommendedBetsList = CRAPS_BETS.filter(b => b.recommended && b.phase === 'Point Established');
    
    // Odds of making the point before rolling a 7
    // Combos of pt vs Combos of 7 (which is 6 combos)
    const ptCombos = DICE_COMBOS[pt] || 5;
    const makePointOdds = (ptCombos / (ptCombos + 6)) * 100;
    winPercentage = Math.round(makePointOdds);

    advice = 'Take Max Odds behind the line';
    explanation = `The Point is ${pt}. You should immediately back your Pass Line wager with a "Free Odds" bet. Since the casino pays true mathematical odds (${pt === 4 || pt === 10 ? '2:1' : pt === 5 || pt === 9 ? '3:2' : '6:5'}), this bet carries a **0.00% house edge** and decreases the overall house advantage to under 0.5%.`;
  }

  return {
    phase,
    pointValue,
    winPercentage,
    recommendedBets: recommendedBetsList,
    allBets: CRAPS_BETS,
    advice,
    explanation
  };
}

// Export for app use
window.CrapsEngine = {
  phases: CRAPS_PHASES,
  getAnalysis: getCrapsAnalysis,
  combos: DICE_COMBOS
};
