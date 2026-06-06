// BetPro Strategizer Core Application Logic

// Web Audio API Synthesizer
let audioCtx = null;
let soundEnabled = true;

function playSound(type) {
  if (!soundEnabled) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    
    if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'shuffle') {
      const bufferSize = audioCtx.sampleRate * 0.12;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1200;
      
      noise.connect(filter);
      filter.connect(gain);
      
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      noise.start(now);
      noise.stop(now + 0.12);
    } else if (type === 'win') {
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const oscNode = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscNode.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscNode.type = 'triangle';
        oscNode.frequency.setValueAtTime(freq, now + idx * 0.07);
        gainNode.gain.setValueAtTime(0.08, now + idx * 0.07);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.22);
        oscNode.start(now + idx * 0.07);
        oscNode.stop(now + idx * 0.07 + 0.22);
      });
    } else if (type === 'loss') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.linearRampToValueAtTime(90, now + 0.25);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch (err) {
    console.warn('Audio Context error (User interaction required):', err);
  }
}

// Global Variables
let rouletteChartInstance = null;
let customChartInstance = null;

// Card asset helper
const SUIT_SYMBOLS = { 's': '♠', 'h': '♥', 'd': '♦', 'c': '♣' };
const SUIT_NAMES = { 's': 'Spades', 'h': 'Hearts', 'd': 'Diamonds', 'c': 'Clubs' };

// Application Init
document.addEventListener("DOMContentLoaded", () => {
  initRouting();
  initSoundToggle();
  initAuth();
  checkSession();
  if (window.lucide) lucide.createIcons();
  
  // Game Init functions
  initBlackjack();
  initRoulette();
  initBaccarat();
  initPoker();
  initCraps();
  initCustomSequencer();
});

// Sidebar & Page Routing
function initRouting() {
  const navButtons = document.querySelectorAll(".nav-item");
  const panels = document.querySelectorAll(".panel");

  navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      playSound('click');
      const targetPanel = btn.getAttribute("data-target");
      
      navButtons.forEach(n => n.classList.remove("active"));
      panels.forEach(p => p.classList.remove("active"));
      
      btn.classList.add("active");
      const targetEl = document.getElementById(targetPanel);
      if (targetEl) {
        targetEl.classList.add("active");
      }
      
      // Track page views in the SQLite database
      trackTabAccess(targetPanel);
      
      // Special redraw trigger for charts if switching tabs
      if (targetPanel === 'roulette-panel') {
        updateRouletteChart();
      } else if (targetPanel === 'custom-panel') {
        updateCustomChart();
      } else if (targetPanel === 'analytics-panel') {
        loadAnalytics();
      }
    });
  });
}

function initSoundToggle() {
  const toggleBtn = document.getElementById("sound-toggle");
  if (!toggleBtn) return;
  toggleBtn.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    toggleBtn.innerHTML = soundEnabled 
      ? `<i data-lucide="volume-2"></i>` 
      : `<i data-lucide="volume-x"></i>`;
    if (window.lucide) lucide.createIcons();
    toggleBtn.title = soundEnabled ? "Mute Sound Effects" : "Unmute Sound Effects";
    if (soundEnabled) playSound('click');
  });
}

/* ==========================================================================
   BLACKJACK MODULE
   ========================================================================== */
function initBlackjack() {
  let selectedHandTarget = 'player'; // 'player' or 'dealer'
  const playerHand = [];
  let dealerCard = null;

  const playerHandContainer = document.getElementById("bj-player-hand");
  const dealerHandContainer = document.getElementById("bj-dealer-hand");
  
  // Tab triggers for where cards go
  const selectPlayerBtn = document.getElementById("bj-select-player-btn");
  const selectDealerBtn = document.getElementById("bj-select-dealer-btn");

  if (selectPlayerBtn && selectDealerBtn) {
    selectPlayerBtn.addEventListener("click", () => {
      playSound('click');
      selectedHandTarget = 'player';
      selectPlayerBtn.classList.add("btn-primary");
      selectPlayerBtn.classList.remove("btn-secondary");
      selectDealerBtn.classList.add("btn-secondary");
      selectDealerBtn.classList.remove("btn-primary");
    });

    selectDealerBtn.addEventListener("click", () => {
      playSound('click');
      selectedHandTarget = 'dealer';
      selectDealerBtn.classList.add("btn-primary");
      selectDealerBtn.classList.remove("btn-secondary");
      selectPlayerBtn.classList.add("btn-secondary");
      selectPlayerBtn.classList.remove("btn-primary");
    });
  }

  // Clear Hand button
  const clearBtn = document.getElementById("bj-clear-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      playSound('shuffle');
      playerHand.length = 0;
      dealerCard = null;
      renderBlackjackHands();
      updateBlackjackRecommendation();
    });
  }

  // Card selector matrix clicks
  const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
  const suits = ['s', 'h', 'd', 'c'];
  const cardGrid = document.getElementById("bj-card-grid");

  if (cardGrid) {
    cardGrid.innerHTML = '';
    // Let's create visual selector cards in grid
    for (let r of ranks) {
      for (let s of suits) {
        const isRed = ['h', 'd'].includes(s);
        const cardBtn = document.createElement("div");
        cardBtn.className = `deck-card ${isRed ? 'red-suit' : ''}`;
        cardBtn.innerHTML = `
          <div>${r}</div>
          <div style="align-self: flex-end; font-size: 1.2rem;">${SUIT_SYMBOLS[s]}</div>
        `;
        
        cardBtn.addEventListener("click", () => {
          if (selectedHandTarget === 'player') {
            if (playerHand.length < 5) {
              playSound('shuffle');
              playerHand.push({ rank: r, suit: s });
            }
          } else {
            playSound('shuffle');
            dealerCard = { rank: r, suit: s };
          }
          renderBlackjackHands();
          updateBlackjackRecommendation();
        });
        cardGrid.appendChild(cardBtn);
      }
    }
  }

  function renderBlackjackHands() {
    // Render Player
    playerHandContainer.innerHTML = '';
    if (playerHand.length === 0) {
      playerHandContainer.innerHTML = '<span class="text-muted">Awaiting Player Cards...</span>';
    } else {
      playerHand.forEach((card, idx) => {
        const isRed = ['h', 'd'].includes(card.suit);
        const cardEl = document.createElement("div");
        cardEl.className = `active-card ${isRed ? 'red-suit' : ''}`;
        cardEl.innerHTML = `
          <div>${card.rank}</div>
          <div style="align-self: flex-end; font-size: 1.3rem;">${SUIT_SYMBOLS[card.suit]}</div>
          <button class="remove-btn" onclick="removePlayerBJCard(${idx})">&times;</button>
        `;
        playerHandContainer.appendChild(cardEl);
      });
    }

    // Render Dealer
    dealerHandContainer.innerHTML = '';
    if (!dealerCard) {
      dealerHandContainer.innerHTML = '<span class="text-muted">Awaiting Dealer Upcard...</span>';
    } else {
      const isRed = ['h', 'd'].includes(dealerCard.suit);
      const cardEl = document.createElement("div");
      cardEl.className = `active-card ${isRed ? 'red-suit' : ''}`;
      cardEl.innerHTML = `
        <div>${dealerCard.rank}</div>
        <div style="align-self: flex-end; font-size: 1.3rem;">${SUIT_SYMBOLS[dealerCard.suit]}</div>
        <button class="remove-btn" onclick="removeDealerBJCard()">&times;</button>
      `;
      dealerHandContainer.appendChild(cardEl);
    }
  }

  // Expose global card removal helpers
  window.removePlayerBJCard = (idx) => {
    playSound('click');
    playerHand.splice(idx, 1);
    renderBlackjackHands();
    updateBlackjackRecommendation();
  };

  window.removeDealerBJCard = () => {
    playSound('click');
    dealerCard = null;
    renderBlackjackHands();
    updateBlackjackRecommendation();
  };

  function updateBlackjackRecommendation() {
    const pRanks = playerHand.map(c => c.rank);
    const dRank = dealerCard ? dealerCard.rank : null;

    const rec = BlackjackEngine.getRecommendation(pRanks, dRank);

    // Update Advice HUD
    const adviceEl = document.getElementById("bj-advice-choice");
    const explanationEl = document.getElementById("bj-advice-explanation");
    const pctValEl = document.getElementById("bj-prob-val");
    const pctBarEl = document.getElementById("bj-prob-bar");

    if (adviceEl && explanationEl && pctValEl && pctBarEl) {
      adviceEl.textContent = rec.actionText;
      explanationEl.textContent = rec.explanation;
      pctValEl.textContent = `${rec.winPercentage}%`;
      pctBarEl.style.width = `${rec.winPercentage}%`;

      // Set action coloring
      adviceEl.className = 'advisor-choice ';
      if (rec.action === 'H') adviceEl.classList.add('text-cyan');
      else if (rec.action === 'S') adviceEl.classList.add('text-purple');
      else if (rec.action === 'D' || rec.action === 'Ds') adviceEl.classList.add('text-gold');
      else if (rec.action === 'P') adviceEl.classList.add('text-success');
      else adviceEl.classList.add('text-muted');
    }

    // Update stats table
    const statTotal = document.getElementById("bj-stat-total");
    const statType = document.getElementById("bj-stat-type");
    const statDealerBust = document.getElementById("bj-stat-dealerbust");

    if (statTotal && statType && statDealerBust) {
      if (playerHand.length >= 2) {
        const analysis = BlackjackEngine.analyzeHand(pRanks);
        statTotal.textContent = analysis.total;
        statType.textContent = analysis.isSoft ? 'Soft Hand' : (analysis.isPair ? 'Pair' : 'Hard Hand');
      } else {
        statTotal.textContent = '-';
        statType.textContent = '-';
      }

      if (dRank) {
        const dValStr = ['K', 'Q', 'J'].includes(dRank) ? '10' : dRank;
        statDealerBust.textContent = `${BlackjackEngine.dealerBustChances[dValStr]}%`;
      } else {
        statDealerBust.textContent = '-';
      }
    }
  }
}

/* ==========================================================================
   ROULETTE MODULE
   ========================================================================== */
function initRoulette() {
  const baseBetInput = document.getElementById("rt-base-bet");
  const systemSelect = document.getElementById("rt-system");
  const wheelTypeSelect = document.getElementById("rt-wheel");
  const labSequenceGroup = document.getElementById("rt-lab-seq-group");
  const labSequenceInput = document.getElementById("rt-lab-sequence");

  const winBtn = document.getElementById("rt-win-btn");
  const lossBtn = document.getElementById("rt-loss-btn");
  const undoBtn = document.getElementById("rt-undo-btn");
  const resetBtn = document.getElementById("rt-reset-btn");

  if (!baseBetInput || !winBtn) return;

  // Labouchere sequence visibility toggle
  systemSelect.addEventListener("change", () => {
    playSound('click');
    if (systemSelect.value === ROULETTE_SYSTEMS.LABOUCHERE) {
      labSequenceGroup.style.display = 'block';
    } else {
      labSequenceGroup.style.display = 'none';
    }
    syncRouletteParams();
  });

  baseBetInput.addEventListener("input", syncRouletteParams);
  wheelTypeSelect.addEventListener("change", () => {
    playSound('click');
    syncRouletteParams();
  });
  labSequenceInput.addEventListener("input", syncRouletteParams);

  function syncRouletteParams() {
    RouletteEngine.setParameters(
      baseBetInput.value,
      systemSelect.value,
      wheelTypeSelect.value,
      labSequenceInput.value
    );
    updateRouletteUI();
  }

  winBtn.addEventListener("click", () => {
    playSound('win');
    RouletteEngine.recordResult(true);
    updateRouletteUI();
  });

  lossBtn.addEventListener("click", () => {
    playSound('loss');
    RouletteEngine.recordResult(false);
    updateRouletteUI();
  });

  undoBtn.addEventListener("click", () => {
    playSound('click');
    RouletteEngine.undoLastStep();
    updateRouletteUI();
  });

  resetBtn.addEventListener("click", () => {
    playSound('shuffle');
    RouletteEngine.reset();
    syncRouletteParams();
  });

  // Init params
  syncRouletteParams();
}

function updateRouletteUI() {
  const status = RouletteEngine.getCurrentStatus();

  // Update recommendation card
  document.getElementById("rt-advice-choice").textContent = `$${status.nextBet.toFixed(2)}`;
  document.getElementById("rt-advice-explanation").textContent = status.explanation;
  document.getElementById("rt-prob-val").textContent = `${status.winPercentage}%`;
  document.getElementById("rt-prob-bar").style.width = `${status.winPercentage}%`;

  // Update statistics table
  document.getElementById("rt-stat-profit").textContent = `$${status.netProfit.toFixed(2)}`;
  document.getElementById("rt-stat-profit").className = status.netProfit >= 0 ? 'text-success' : 'text-danger';
  document.getElementById("rt-stat-step").textContent = status.history.length + 1;
  document.getElementById("rt-stat-houseedge").textContent = `${status.houseEdge.toFixed(2)}%`;

  // Render progression table list
  const historyList = document.getElementById("rt-history-list");
  historyList.innerHTML = '';
  
  if (status.history.length === 0) {
    historyList.innerHTML = '<div class="text-muted" style="padding: 1rem; text-align: center;">No bets logged yet. Play your first spin!</div>';
  } else {
    // Show last 6 rounds
    const displayHistory = [...status.history].reverse().slice(0, 6);
    displayHistory.forEach(h => {
      const card = document.createElement("div");
      card.className = "step-card";
      card.innerHTML = `
        <div class="step-number">${h.step}</div>
        <div class="step-content">
          <div class="step-title">Wager size: $${h.bet.toFixed(2)}</div>
          <div class="step-desc">Profit/Loss: <span class="${h.won ? 'text-success' : 'text-danger'}">${h.won ? '+' : '-'}$${h.bet.toFixed(2)}</span></div>
        </div>
        <span class="step-action ${h.won ? 'action-win' : 'action-neutral'}">${h.won ? 'WIN' : 'LOSS'}</span>
      `;
      historyList.appendChild(card);
    });
  }

  // Update charts
  updateRouletteChart();
}

function updateRouletteChart() {
  const canvas = document.getElementById("rouletteChart");
  if (!canvas) return;

  const status = RouletteEngine.getCurrentStatus();
  
  // Re-build cumulative profit array
  let currentSum = 0;
  const dataPoints = [0];
  const labels = ['Start'];

  status.history.forEach((h, index) => {
    currentSum += h.profit;
    dataPoints.push(currentSum);
    labels.push(`Spin ${index + 1}`);
  });

  if (rouletteChartInstance) {
    rouletteChartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');
  rouletteChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Net Balance Trajectory ($)',
        data: dataPoints,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.15)',
        fill: true,
        tension: 0.3,
        borderWidth: 2,
        pointBackgroundColor: '#8b5cf6',
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8' }
        }
      }
    }
  });
}

/* ==========================================================================
   BACCARAT MODULE
   ========================================================================== */
function initBaccarat() {
  const logBankerBtn = document.getElementById("bc-log-banker");
  const logPlayerBtn = document.getElementById("bc-log-player");
  const logTieBtn = document.getElementById("bc-log-tie");
  const undoBtn = document.getElementById("bc-undo-btn");
  const resetBtn = document.getElementById("bc-reset-btn");
  const trendModeSelect = document.getElementById("bc-trend-mode");

  if (!logBankerBtn) return;

  logBankerBtn.addEventListener("click", () => {
    playSound('click');
    BaccaratEngine.addResult('B');
    updateBaccaratUI();
  });

  logPlayerBtn.addEventListener("click", () => {
    playSound('click');
    BaccaratEngine.addResult('P');
    updateBaccaratUI();
  });

  logTieBtn.addEventListener("click", () => {
    playSound('click');
    BaccaratEngine.addResult('T');
    updateBaccaratUI();
  });

  undoBtn.addEventListener("click", () => {
    playSound('click');
    BaccaratEngine.removeLastResult();
    updateBaccaratUI();
  });

  resetBtn.addEventListener("click", () => {
    playSound('shuffle');
    BaccaratEngine.reset();
    updateBaccaratUI();
  });

  trendModeSelect.addEventListener("change", () => {
    playSound('click');
    BaccaratEngine.setTrendMode(trendModeSelect.value);
    updateBaccaratUI();
  });

  // Initial draw
  updateBaccaratUI();
}

function updateBaccaratUI() {
  const analysis = BaccaratEngine.getAnalysis();

  // Update recommendation HUD
  const adviceChoice = document.getElementById("bc-advice-choice");
  adviceChoice.textContent = analysis.advice;
  document.getElementById("bc-advice-explanation").textContent = analysis.explanation;

  adviceChoice.className = 'advisor-choice ';
  if (analysis.recommendedBet === 'B') adviceChoice.classList.add('text-danger');
  else if (analysis.recommendedBet === 'P') adviceChoice.classList.add('text-cyan');
  else adviceChoice.classList.add('text-success');

  // Probability stats
  document.getElementById("bc-prob-b").textContent = `${analysis.probabilities.Banker}%`;
  document.getElementById("bc-prob-p").textContent = `${analysis.probabilities.Player}%`;
  document.getElementById("bc-prob-t").textContent = `${analysis.probabilities.Tie}%`;

  // Counts
  document.getElementById("bc-stat-banker").textContent = analysis.counts.Banker;
  document.getElementById("bc-stat-player").textContent = analysis.counts.Player;
  document.getElementById("bc-stat-tie").textContent = analysis.counts.Tie;

  // Render Bead Plate
  const beadGrid = document.getElementById("bc-bead-plate");
  beadGrid.innerHTML = '';
  analysis.roadmaps.beadPlate.forEach(item => {
    const cell = document.createElement("div");
    cell.className = "road-cell";
    if (item === 'B') {
      cell.classList.add("cell-banker");
      cell.textContent = 'B';
    } else if (item === 'P') {
      cell.classList.add("cell-player");
      cell.textContent = 'P';
    } else if (item === 'T') {
      cell.classList.add("cell-tie");
      cell.textContent = 'T';
    }
    beadGrid.appendChild(cell);
  });

  // Render Big Road
  const roadGrid = document.getElementById("bc-big-road");
  roadGrid.innerHTML = '';
  // Big Road is 6 rows by 12 columns
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 12; c++) {
      const item = analysis.roadmaps.bigRoad[r][c];
      const cell = document.createElement("div");
      cell.className = "road-cell";
      if (item === 'B') {
        cell.classList.add("cell-banker");
      } else if (item === 'P') {
        cell.classList.add("cell-player");
      } else if (item === 'T') {
        cell.classList.add("cell-tie");
      }
      roadGrid.appendChild(cell);
    }
  }
}

/* ==========================================================================
   POKER MODULE
   ========================================================================== */
function initPoker() {
  const pocketList = [];
  const boardList = [];
  let pokerActiveTarget = 'pocket'; // 'pocket' or 'board'

  const pocketTargetBtn = document.getElementById("pk-select-pocket-btn");
  const boardTargetBtn = document.getElementById("pk-select-board-btn");
  const clearBtn = document.getElementById("pk-clear-btn");
  const calcBtn = document.getElementById("pk-calculate-btn");

  const pocketDisplay = document.getElementById("pk-pocket-cards");
  const boardDisplay = document.getElementById("pk-board-cards");

  if (!pocketTargetBtn) return;

  pocketTargetBtn.addEventListener("click", () => {
    playSound('click');
    pokerActiveTarget = 'pocket';
    pocketTargetBtn.classList.add("btn-primary");
    pocketTargetBtn.classList.remove("btn-secondary");
    boardTargetBtn.classList.add("btn-secondary");
    boardTargetBtn.classList.remove("btn-primary");
  });

  boardTargetBtn.addEventListener("click", () => {
    playSound('click');
    pokerActiveTarget = 'board';
    boardTargetBtn.classList.add("btn-primary");
    boardTargetBtn.classList.remove("btn-secondary");
    pocketTargetBtn.classList.add("btn-secondary");
    pocketTargetBtn.classList.remove("btn-primary");
  });

  clearBtn.addEventListener("click", () => {
    playSound('shuffle');
    pocketList.length = 0;
    boardList.length = 0;
    renderPokerCards();
  });

  // Render cards picker matrix
  const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
  const suits = ['s', 'h', 'd', 'c'];
  const cardGrid = document.getElementById("pk-card-grid");

  if (cardGrid) {
    cardGrid.innerHTML = '';
    for (let r of ranks) {
      for (let s of suits) {
        const isRed = ['h', 'd'].includes(s);
        const cardBtn = document.createElement("div");
        cardBtn.className = `deck-card ${isRed ? 'red-suit' : ''}`;
        cardBtn.innerHTML = `
          <div>${r}</div>
          <div style="align-self: flex-end; font-size: 1.2rem;">${SUIT_SYMBOLS[s]}</div>
        `;
        
        cardBtn.addEventListener("click", () => {
          const cardStr = r + s;
          
          // Check duplicates
          if (pocketList.includes(cardStr) || boardList.includes(cardStr)) {
            return; // Already exists
          }

          if (pokerActiveTarget === 'pocket') {
            if (pocketList.length < 2) {
              playSound('shuffle');
              pocketList.push(cardStr);
            }
          } else {
            if (boardList.length < 5) {
              playSound('shuffle');
              boardList.push(cardStr);
            }
          }
          renderPokerCards();
        });
        cardGrid.appendChild(cardBtn);
      }
    }
  }

  function renderPokerCards() {
    pocketDisplay.innerHTML = '';
    if (pocketList.length === 0) {
      pocketDisplay.innerHTML = '<span class="text-muted">No Pocket Cards Selected</span>';
    } else {
      pocketList.forEach((card, idx) => {
        const rank = card.slice(0, -1);
        const suit = card.slice(-1);
        const isRed = ['h', 'd'].includes(suit);
        const cardEl = document.createElement("div");
        cardEl.className = `active-card ${isRed ? 'red-suit' : ''}`;
        cardEl.innerHTML = `
          <div>${rank}</div>
          <div style="align-self: flex-end; font-size: 1.3rem;">${SUIT_SYMBOLS[suit]}</div>
          <button class="remove-btn" onclick="removePokerPocket(${idx})">&times;</button>
        `;
        pocketDisplay.appendChild(cardEl);
      });
    }

    boardDisplay.innerHTML = '';
    if (boardList.length === 0) {
      boardDisplay.innerHTML = '<span class="text-muted">No Community Cards Selected</span>';
    } else {
      boardList.forEach((card, idx) => {
        const rank = card.slice(0, -1);
        const suit = card.slice(-1);
        const isRed = ['h', 'd'].includes(suit);
        const cardEl = document.createElement("div");
        cardEl.className = `active-card ${isRed ? 'red-suit' : ''}`;
        cardEl.innerHTML = `
          <div>${rank}</div>
          <div style="align-self: flex-end; font-size: 1.3rem;">${SUIT_SYMBOLS[suit]}</div>
          <button class="remove-btn" onclick="removePokerBoard(${idx})">&times;</button>
        `;
        boardDisplay.appendChild(cardEl);
      });
    }
  }

  window.removePokerPocket = (idx) => {
    playSound('click');
    pocketList.splice(idx, 1);
    renderPokerCards();
  };

  window.removePokerBoard = (idx) => {
    playSound('click');
    boardList.splice(idx, 1);
    renderPokerCards();
  };

  // Run Monte Carlo Equity Calculator
  calcBtn.addEventListener("click", () => {
    if (pocketList.length < 2) {
      alert("Please select 2 pocket cards.");
      return;
    }
    
    calcBtn.disabled = true;
    calcBtn.textContent = 'Calculating Equity...';
    playSound('click');
    
    // Simulate thinking delay for immersion
    setTimeout(() => {
      const opponents = parseInt(document.getElementById("pk-opponents").value, 10);
      const potSize = parseFloat(document.getElementById("pk-pot-size").value) || 100;
      const callSize = parseFloat(document.getElementById("pk-call-size").value) || 0;

      const simResults = PokerEngine.runSimulation(pocketList, boardList, opponents, 800);
      const advice = PokerEngine.getAdvice(simResults.equity, potSize, callSize);

      // Draw outcomes
      document.getElementById("pk-advice-choice").textContent = advice.action;
      document.getElementById("pk-advice-explanation").textContent = advice.explanation;
      document.getElementById("pk-prob-val").textContent = `${simResults.equity}%`;
      document.getElementById("pk-prob-bar").style.width = `${simResults.equity}%`;

      // Stat tables
      document.getElementById("pk-stat-hand").textContent = simResults.currentHandName;
      document.getElementById("pk-stat-oppequity").textContent = `${simResults.lossRate}%`;
      document.getElementById("pk-stat-potodds").textContent = `${advice.potOdds}%`;

      calcBtn.disabled = false;
      calcBtn.textContent = 'Run Strategy Simulator';
      playSound('win');
    }, 500);
  });
}

/* ==========================================================================
   CRAPS MODULE
   ========================================================================== */
function initCraps() {
  const comeoutBtn = document.getElementById("cr-phase-comeout");
  const pointBtn = document.getElementById("cr-phase-point");
  const pointSelectorContainer = document.getElementById("cr-point-selector");
  const crapsBetsTable = document.getElementById("cr-bets-table");

  let activePhase = 'Come-out Roll';
  let activePoint = 6;

  if (!comeoutBtn) return;

  comeoutBtn.addEventListener("click", () => {
    playSound('click');
    activePhase = 'Come-out Roll';
    comeoutBtn.classList.add("btn-primary");
    comeoutBtn.classList.remove("btn-secondary");
    pointBtn.classList.add("btn-secondary");
    pointBtn.classList.remove("btn-primary");
    pointSelectorContainer.style.display = 'none';
    updateCrapsUI();
  });

  pointBtn.addEventListener("click", () => {
    playSound('click');
    activePhase = 'Point Established';
    pointBtn.classList.add("btn-primary");
    pointBtn.classList.remove("btn-secondary");
    comeoutBtn.classList.add("btn-secondary");
    comeoutBtn.classList.remove("btn-primary");
    pointSelectorContainer.style.display = 'block';
    updateCrapsUI();
  });

  // Bind Point Selector buttons
  const pointButtons = document.querySelectorAll(".cr-point-val-btn");
  pointButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      playSound('click');
      pointButtons.forEach(b => b.classList.remove("btn-cyan"));
      pointButtons.forEach(b => b.classList.add("btn-secondary"));
      btn.classList.add("btn-cyan");
      btn.classList.remove("btn-secondary");
      activePoint = parseInt(btn.getAttribute("data-val"), 10);
      updateCrapsUI();
    });
  });

  function updateCrapsUI() {
    const analysis = CrapsEngine.getAnalysis(activePhase, activePoint);

    // Update Advice Card
    document.getElementById("cr-advice-choice").textContent = analysis.advice;
    document.getElementById("cr-advice-explanation").textContent = analysis.explanation;
    document.getElementById("cr-prob-val").textContent = `${analysis.winPercentage}%`;
    document.getElementById("cr-prob-bar").style.width = `${analysis.winPercentage}%`;

    // Render Bets Table
    crapsBetsTable.innerHTML = '';
    
    // Determine filtered bets (show recommended bets first, then show other bets)
    const filteredBets = [...analysis.allBets].sort((a, b) => b.recommended - a.recommended);

    filteredBets.forEach(bet => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05);">
          <strong style="color: ${bet.recommended ? '#10b981' : '#f43f5e'}">${bet.name}</strong>
          ${bet.recommended ? '<span class="badge" style="font-size:0.6rem; padding:0.1rem 0.4rem; margin-left:0.5rem; background:rgba(16,185,129,0.15); border-color:rgba(16,185,129,0.3); color:#10b981;">Best Bet</span>' : ''}
        </td>
        <td style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); font-weight:700;">${bet.houseEdge.toFixed(2)}%</td>
        <td style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color:#94a3b8;">${bet.payout}</td>
        <td style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); font-size:0.8rem; color:#94a3b8;">${bet.description}</td>
      `;
      crapsBetsTable.appendChild(tr);
    });
  }

  // Initial draw
  updateCrapsUI();
}

/* ==========================================================================
   CUSTOM PROGRESSION SEQUENCER
   ========================================================================== */
const CUSTOM_HISTORY = [];

function initCustomSequencer() {
  const winProbInput = document.getElementById("cs-win-prob");
  const baseBetInput = document.getElementById("cs-base-bet");
  const multiplierInput = document.getElementById("cs-multiplier");

  const winBtn = document.getElementById("cs-win-btn");
  const lossBtn = document.getElementById("cs-loss-btn");
  const resetBtn = document.getElementById("cs-reset-btn");

  if (!winBtn) return;

  winBtn.addEventListener("click", () => {
    playSound('win');
    logCustomRound(true);
  });

  lossBtn.addEventListener("click", () => {
    playSound('loss');
    logCustomRound(false);
  });

  resetBtn.addEventListener("click", () => {
    playSound('shuffle');
    CUSTOM_HISTORY.length = 0;
    updateCustomUI();
  });

  updateCustomUI();
}

function calculateNextCustomBet() {
  const baseBet = parseFloat(document.getElementById("cs-base-bet").value) || 10;
  const mult = parseFloat(document.getElementById("cs-multiplier").value) || 2;

  if (CUSTOM_HISTORY.length === 0) return baseBet;

  const lastRound = CUSTOM_HISTORY[CUSTOM_HISTORY.length - 1];
  if (lastRound.won) {
    return baseBet; // Reset on win
  } else {
    // Multiply bet on loss
    return lastRound.bet * mult;
  }
}

function logCustomRound(won) {
  const bet = calculateNextCustomBet();
  const profit = won ? bet : -bet;

  CUSTOM_HISTORY.push({
    step: CUSTOM_HISTORY.length + 1,
    bet,
    won,
    profit
  });

  updateCustomUI();
}

function updateCustomUI() {
  const nextBet = calculateNextCustomBet();
  const winProb = parseFloat(document.getElementById("cs-win-prob").value) || 50;

  // Calculate stats
  const totalRounds = CUSTOM_HISTORY.length;
  const netProfit = CUSTOM_HISTORY.reduce((sum, h) => sum + h.profit, 0);

  // Risk of ruin estimation (hitting 6 losses in a row)
  const pLoss = 1 - (winProb / 100);
  const ruinProbability = Math.min(99, Math.round(Math.pow(pLoss, 6) * 100));

  // Update advisor card
  document.getElementById("cs-advice-choice").textContent = `$${nextBet.toFixed(2)}`;
  document.getElementById("cs-advice-explanation").textContent = `Custom Betting Sequencer. Multiplier applied on losses. Total plays: ${totalRounds}. Expected risk of a 6-loss streak: ${ruinProbability}%.`;
  document.getElementById("cs-prob-val").textContent = `${winProb}%`;
  document.getElementById("cs-prob-bar").style.width = `${winProb}%`;

  // Update stats table
  document.getElementById("cs-stat-profit").textContent = `$${netProfit.toFixed(2)}`;
  document.getElementById("cs-stat-profit").className = netProfit >= 0 ? 'text-success' : 'text-danger';
  document.getElementById("cs-stat-step").textContent = totalRounds + 1;
  document.getElementById("cs-stat-ruin").textContent = `${ruinProbability}%`;

  // Render log
  const historyList = document.getElementById("cs-history-list");
  historyList.innerHTML = '';

  if (CUSTOM_HISTORY.length === 0) {
    historyList.innerHTML = '<div class="text-muted" style="padding: 1rem; text-align: center;">Awaiting betting interactions...</div>';
  } else {
    const displayHistory = [...CUSTOM_HISTORY].reverse().slice(0, 6);
    displayHistory.forEach(h => {
      const card = document.createElement("div");
      card.className = "step-card";
      card.innerHTML = `
        <div class="step-number">${h.step}</div>
        <div class="step-content">
          <div class="step-title">Wager size: $${h.bet.toFixed(2)}</div>
          <div class="step-desc">Profit/Loss: <span class="${h.won ? 'text-success' : 'text-danger'}">${h.won ? '+' : '-'}$${h.bet.toFixed(2)}</span></div>
        </div>
        <span class="step-action ${h.won ? 'action-win' : 'action-neutral'}">${h.won ? 'WIN' : 'LOSS'}</span>
      `;
      historyList.appendChild(card);
    });
  }

  updateCustomChart();
}

function updateCustomChart() {
  const canvas = document.getElementById("customChart");
  if (!canvas) return;

  let currentSum = 0;
  const dataPoints = [0];
  const labels = ['Start'];

  CUSTOM_HISTORY.forEach((h, index) => {
    currentSum += h.profit;
    dataPoints.push(currentSum);
    labels.push(`Play ${index + 1}`);
  });

  if (customChartInstance) {
    customChartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');
  customChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Net Balance Trajectory ($)',
        data: dataPoints,
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        fill: true,
        tension: 0.3,
        borderWidth: 2,
        pointBackgroundColor: '#06b6d4',
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8' }
        }
      }
    }
  });
}

/* ==========================================================================
   AUTHENTICATION & ANALYTICS EXTENSIONS
   ========================================================================== */

let authMode = 'login'; // 'login' or 'register'
let analyticsChartInstance = null;

function initAuth() {
  const authForm = document.getElementById("auth-form");
  const authToggleLink = document.getElementById("auth-toggle-link");
  const authToggleDesc = document.getElementById("auth-toggle-desc");
  const authSubmitBtn = document.getElementById("auth-submit-btn");
  const errorMsg = document.getElementById("auth-error-msg");
  const logoutBtn = document.getElementById("logout-btn");

  if (!authForm) return;

  // Toggle Login/Register
  authToggleLink.addEventListener("click", (e) => {
    e.preventDefault();
    playSound('click');
    errorMsg.style.display = 'none';
    
    if (authMode === 'login') {
      authMode = 'register';
      authToggleDesc.textContent = 'Already have an account?';
      authToggleLink.textContent = 'Log In Here';
      authSubmitBtn.textContent = 'REGISTER';
    } else {
      authMode = 'login';
      authToggleDesc.textContent = "Don't have an account?";
      authToggleLink.textContent = 'Register Here';
      authSubmitBtn.textContent = 'LOG IN';
    }
  });

  // Submit Handler
  authForm.addEventListener("submit", (e) => {
    e.preventDefault();
    playSound('click');
    errorMsg.style.display = 'none';

    const username = document.getElementById("auth-username").value;
    const password = document.getElementById("auth-password").value;

    const url = authMode === 'login' ? '/api/login' : '/api/register';
    
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
    .then(async res => {
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }
      return data;
    })
    .then(data => {
      if (authMode === 'register') {
        // Success register
        playSound('win');
        alert(data.message);
        authMode = 'login';
        authToggleDesc.textContent = "Don't have an account?";
        authToggleLink.textContent = 'Register Here';
        authSubmitBtn.textContent = 'LOG IN';
        document.getElementById("auth-password").value = '';
      } else {
        // Success login
        playSound('win');
        document.getElementById("auth-username").value = '';
        document.getElementById("auth-password").value = '';
        
        document.getElementById("auth-modal").style.display = 'none';
        document.getElementById("user-profile-badge").style.display = 'inline-block';
        document.getElementById("header-username").textContent = data.username.toUpperCase();
        logoutBtn.style.display = 'inline-block';
        
        // Track initial tab view
        trackTabAccess('vision-panel');
      }
    })
    .catch(err => {
      playSound('loss');
      errorMsg.textContent = err.message;
      errorMsg.style.display = 'block';
    });
  });

  // Logout Handler
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      playSound('click');
      fetch('/api/logout', { method: 'POST' })
      .then(() => {
        document.getElementById("auth-modal").style.display = 'flex';
        document.getElementById("user-profile-badge").style.display = 'none';
        logoutBtn.style.display = 'none';
        playSound('shuffle');
      });
    });
  }
}

function checkSession() {
  fetch('/api/session')
  .then(res => {
    if (res.ok) return res.json();
    throw new Error('Not logged in');
  })
  .then(data => {
    if (data.logged_in) {
      document.getElementById("auth-modal").style.display = 'none';
      document.getElementById("user-profile-badge").style.display = 'inline-block';
      document.getElementById("header-username").textContent = data.username.toUpperCase();
      document.getElementById("logout-btn").style.display = 'inline-block';
      trackTabAccess('vision-panel');
    }
  })
  .catch(() => {
    document.getElementById("auth-modal").style.display = 'flex';
  });
}

function trackTabAccess(panelId) {
  // Translate panels to friendly game names
  const gameMap = {
    'vision-panel': 'Screenshot OCR Scan',
    'blackjack-panel': 'Blackjack Strategizer',
    'roulette-panel': 'Roulette Progression',
    'baccarat-panel': 'Baccarat Roadmaps',
    'poker-panel': 'Poker Holdem Equity',
    'craps-panel': 'Craps Odds',
    'custom-panel': 'Custom Sequencer',
    'analytics-panel': 'Engine Analytics'
  };

  const gameFriendly = gameMap[panelId];
  if (!gameFriendly) return;

  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game: gameFriendly })
  })
  .catch(err => console.warn('Failed to log analytic event:', err));
}

function loadAnalytics() {
  fetch('/api/analytics')
  .then(res => {
    if (res.ok) return res.json();
    throw new Error('Could not load analytics');
  })
  .then(data => {
    drawAnalyticsChart(data);
    compileAnalyticsInsights(data);
  })
  .catch(err => console.error(err));
}

function drawAnalyticsChart(data) {
  const canvas = document.getElementById("analyticsChart");
  if (!canvas) return;

  // Extract counts and names
  const labels = data.map(item => item.game);
  const counts = data.map(item => item.count);

  if (analyticsChartInstance) {
    analyticsChartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');
  
  // Custom gradient bar styling
  const gradient = ctx.createLinearGradient(0, 0, 400, 0);
  gradient.addColorStop(0, '#8b5cf6');
  gradient.addColorStop(1, '#06b6d4');

  analyticsChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length > 0 ? labels : ['No Data'],
      datasets: [{
        label: 'Module Clicks',
        data: counts.length > 0 ? counts : [0],
        backgroundColor: gradient,
        borderRadius: 6,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y', // Horizontal bars
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8', stepSize: 1 }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#94a3b8' }
        }
      }
    }
  });
}

function compileAnalyticsInsights(data) {
  const insightsList = document.getElementById("analytics-insights-list");
  if (!insightsList) return;

  insightsList.innerHTML = '';

  if (data.length === 0) {
    insightsList.innerHTML = `
      <div class="step-card">
        <div class="step-number" style="color:var(--gold); border-color:rgba(251,191,36,0.3)">AI</div>
        <div class="step-content">
          <div class="step-title">Analytic Insight</div>
          <div class="step-desc">Awaiting more session data to compile statistics. Switch between game panels to track usage.</div>
        </div>
      </div>
    `;
    return;
  }

  // Identify most accessed game
  const topGame = data[0];
  const insightCard = document.createElement("div");
  insightCard.className = "step-card";
  insightCard.innerHTML = `
    <div class="step-number" style="color:var(--gold); border-color:rgba(251,191,36,0.3)">🏆</div>
    <div class="step-content">
      <div class="step-title">Most Active Deck</div>
      <div class="step-desc"><strong>${topGame.game}</strong> is your most used system. You have accessed it <strong>${topGame.count}</strong> times this session.</div>
    </div>
  `;
  insightsList.appendChild(insightCard);

  // General recommendation based on active game
  const secondaryCard = document.createElement("div");
  secondaryCard.className = "step-card";
  
  let recTitle = "Strategy Tip";
  let recDesc = "Ensure you practice basic strategy tables off-table before running live sequences.";
  
  if (topGame.game.includes('Blackjack')) {
    recTitle = "Blackjack Recommendation";
    recDesc = "Remember that Basic Strategy reduces the house edge to ~0.5%, but card counting triggers are needed to turn the edge positive.";
  } else if (topGame.game.includes('Roulette')) {
    recTitle = "Roulette Risk Analysis";
    recDesc = "Martingale progressions have a high probability of small wins but carry a risk of ruin during rare, consecutive losing streaks.";
  } else if (topGame.game.includes('Baccarat')) {
    recTitle = "Baccarat Tip";
    recDesc = "Always bet on Banker in Baccarat if in doubt. Banker carries a lower house edge (1.06%) compared to Player (1.24%).";
  } else if (topGame.game.includes('Poker')) {
    recTitle = "Hold'em Equity Advice";
    recDesc = "Trust the Monte Carlo pot odds recommendations. Folding when your win equity is below pot odds is statistically profitable long-term.";
  }

  secondaryCard.innerHTML = `
    <div class="step-number" style="color:var(--primary); border-color:var(--primary-glow)">💡</div>
    <div class="step-content">
      <div class="step-title">${recTitle}</div>
      <div class="step-desc">${recDesc}</div>
    </div>
  `;
  insightsList.appendChild(secondaryCard);
}

