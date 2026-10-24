// sainisatta Strategizer Core Application Controller

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
      osc.frequency.setValueAtTime(850, now);
      osc.frequency.exponentialRampToValueAtTime(350, now + 0.07);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);
      osc.start(now);
      osc.stop(now + 0.07);
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
      filter.frequency.value = 1400;
      
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
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.linearRampToValueAtTime(80, now + 0.25);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch (err) {
    console.warn('Audio Context interaction error:', err);
  }
}

// Universal Wager Sizing Advisor HUD Helper
function updateBetAdvisor(gamePrefix, action, sizeText) {
  const betRecEl = document.getElementById(`${gamePrefix}-bet-rec`);
  if (!betRecEl) return;
  
  if (action === 'increase') {
    betRecEl.innerHTML = `Wager Action: <span class="text-emerald" style="text-shadow:0 0 8px rgba(16,185,129,0.3)">⚡ INCREASE BET (${sizeText})</span>`;
  } else if (action === 'decrease') {
    betRecEl.innerHTML = `Wager Action: <span class="text-crimson" style="text-shadow:0 0 8px rgba(244,63,94,0.3)">⚠️ DECREASE BET (${sizeText})</span>`;
  } else {
    betRecEl.innerHTML = `Wager Action: <span class="text-cyan" style="text-shadow:0 0 8px rgba(0,242,254,0.3)">NORMAL UNIT (${sizeText})</span>`;
  }
}

// Global Variables
let rouletteChartInstance = null;
let customChartInstance = null;
let authMode = 'login';
let analyticsChartInstance = null;

// Card symbols
const SUIT_SYMBOLS = { 's': '♠', 'h': '♥', 'd': '♦', 'c': '♣' };
const SUIT_NAMES = { 's': 'Spades', 'h': 'Hearts', 'd': 'Diamonds', 'c': 'Clubs' };

// Application Init
document.addEventListener("DOMContentLoaded", () => {
  initRouting();
  initSoundToggle();
  initAuth();
  checkSession();
  
  // Game Init functions
  initBlackjack();
  initRoulette();
  initBaccarat();
  initPoker();
  initCraps();
  initMines();
  initLimbo();
  initCrash();
  initCustomSequencer();
  initBankroll();

  if (window.lucide) lucide.createIcons();
});

// Navigation Sidebar Routing
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
      
      // Track visits in the SQLite database
      trackTabAccess(targetPanel);
      
      // Redraw charts
      if (targetPanel === 'roulette-panel') {
        updateRouletteChart();
      } else if (targetPanel === 'custom-panel') {
        updateCustomChart();
      } else if (targetPanel === 'analytics-panel') {
        loadAnalytics();
      } else if (targetPanel === 'bankroll-panel') {
        updateBankrollEngine();
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

// Helper to update SVG progress rings
function setProgressRing(fillId, textId, pct) {
  const ring = document.getElementById(fillId);
  const text = document.getElementById(textId);
  
  if (ring) {
    const circumference = 282.7; // 2 * PI * r (r=45)
    const offset = circumference - (pct / 100) * circumference;
    ring.style.strokeDashoffset = offset;
  }
  
  if (text) {
    text.textContent = `${pct}%`;
  }
}

/* ==========================================================================
   BLACKJACK MODULE
   ========================================================================== */
function initBlackjack() {
  let selectedHandTarget = 'player';
  const playerHand = [];
  let dealerCard = null;

  const playerHandContainer = document.getElementById("bj-player-hand");
  const dealerHandContainer = document.getElementById("bj-dealer-hand");
  
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

  const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
  const suits = ['s', 'h', 'd', 'c'];
  const cardGrid = document.getElementById("bj-card-grid");

  if (cardGrid) {
    cardGrid.innerHTML = '';
    for (let r of ranks) {
      for (let s of suits) {
        const isRed = ['h', 'd'].includes(s);
        const cardBtn = document.createElement("div");
        cardBtn.className = `deck-card ${isRed ? 'red-suit' : ''}`;
        cardBtn.innerHTML = `
          <div>${r}</div>
          <div style="align-self: flex-end; font-size: 1.1rem;">${SUIT_SYMBOLS[s]}</div>
        `;
        
        cardBtn.addEventListener("click", () => {
          if (selectedHandTarget === 'player') {
            if (playerHand.length < 5) {
              playSound('shuffle');
              playerHand.push({ rank: r, suit: s });
              BlackjackEngine.addDealtCardToCount(r);
            }
          } else {
            playSound('shuffle');
            dealerCard = { rank: r, suit: s };
            BlackjackEngine.addDealtCardToCount(r);
          }
          renderBlackjackHands();
          updateBlackjackRecommendation();
        });
        cardGrid.appendChild(cardBtn);
      }
    }
  }

  function renderBlackjackHands() {
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
          <div style="align-self: flex-end; font-size: 1.1rem;">${SUIT_SYMBOLS[card.suit]}</div>
          <button class="remove-btn" onclick="removePlayerBJCard(${idx})">&times;</button>
        `;
        playerHandContainer.appendChild(cardEl);
      });
    }

    dealerHandContainer.innerHTML = '';
    if (!dealerCard) {
      dealerHandContainer.innerHTML = '<span class="text-muted">Awaiting Dealer Upcard...</span>';
    } else {
      const isRed = ['h', 'd'].includes(dealerCard.suit);
      const cardEl = document.createElement("div");
      cardEl.className = `active-card ${isRed ? 'red-suit' : ''}`;
      cardEl.innerHTML = `
        <div>${dealerCard.rank}</div>
        <div style="align-self: flex-end; font-size: 1.1rem;">${SUIT_SYMBOLS[dealerCard.suit]}</div>
        <button class="remove-btn" onclick="removeDealerBJCard()">&times;</button>
      `;
      dealerHandContainer.appendChild(cardEl);
    }
  }

  window.removePlayerBJCard = (idx) => {
    playSound('click');
    const card = playerHand[idx];
    playerHand.splice(idx, 1);
    
    // Remove from dealt cards count history
    const dealt = BlackjackEngine.getDealtCards();
    const cardIdx = dealt.lastIndexOf(card.rank);
    if (cardIdx !== -1) {
      BlackjackEngine.removeDealtCardFromCount(cardIdx);
    }
    
    renderBlackjackHands();
    updateBlackjackRecommendation();
  };

  window.removeDealerBJCard = () => {
    playSound('click');
    if (dealerCard) {
      const rank = dealerCard.rank;
      dealerCard = null;
      
      const dealt = BlackjackEngine.getDealtCards();
      const cardIdx = dealt.lastIndexOf(rank);
      if (cardIdx !== -1) {
        BlackjackEngine.removeDealtCardFromCount(cardIdx);
      }
    }
    renderBlackjackHands();
    updateBlackjackRecommendation();
  };

  // Card Counting Event Handlers
  const logPlus1Btn = document.getElementById("bj-log-plus1");
  const logZeroBtn = document.getElementById("bj-log-zero");
  const logMinus1Btn = document.getElementById("bj-log-minus1");
  const resetShoeBtn = document.getElementById("bj-reset-shoe-btn");
  const shoeDecksSelect = document.getElementById("bj-shoe-decks");

  if (logPlus1Btn) {
    logPlus1Btn.addEventListener("click", () => {
      playSound('click');
      BlackjackEngine.addDealtCardToCount('2');
      updateCountUI();
      updateBlackjackRecommendation();
    });
  }
  if (logZeroBtn) {
    logZeroBtn.addEventListener("click", () => {
      playSound('click');
      BlackjackEngine.addDealtCardToCount('7');
      updateCountUI();
      updateBlackjackRecommendation();
    });
  }
  if (logMinus1Btn) {
    logMinus1Btn.addEventListener("click", () => {
      playSound('click');
      BlackjackEngine.addDealtCardToCount('10');
      updateCountUI();
      updateBlackjackRecommendation();
    });
  }
  if (resetShoeBtn) {
    resetShoeBtn.addEventListener("click", () => {
      playSound('shuffle');
      BlackjackEngine.clearShoeCount();
      updateCountUI();
      updateBlackjackRecommendation();
    });
  }
  if (shoeDecksSelect) {
    shoeDecksSelect.addEventListener("change", () => {
      playSound('click');
      BlackjackEngine.setShoeDecks(shoeDecksSelect.value);
      updateCountUI();
      updateBlackjackRecommendation();
    });
  }

  function updateCountUI() {
    const rc = BlackjackEngine.getRunningCount();
    const tc = BlackjackEngine.getTrueCount();
    const multiplier = BlackjackEngine.getRecommendedBetMultiplier();
    const dealtCount = BlackjackEngine.getDealtCards().length;
    const totalCards = BlackjackEngine.getShoeDecks() * 52;
    const penetration = Math.min(100, Math.round((dealtCount / totalCards) * 100));

    const rcEl = document.getElementById("bj-running-count");
    const tcEl = document.getElementById("bj-true-count");
    const penBarEl = document.getElementById("bj-shoe-penetration-bar");
    const penTextEl = document.getElementById("bj-shoe-penetration");
    const multEl = document.getElementById("bj-bet-multiplier");
    const dealtCountEl = document.getElementById("bj-cards-dealt-count");

    if (rcEl) {
      rcEl.textContent = (rc > 0 ? '+' : '') + rc;
      rcEl.style.color = rc > 0 ? 'var(--emerald)' : (rc < 0 ? 'var(--crimson)' : 'var(--secondary)');
    }
    if (tcEl) {
      tcEl.textContent = (tc > 0 ? '+' : '') + tc.toFixed(1);
      tcEl.style.color = tc > 0 ? 'var(--emerald)' : (tc < 0 ? 'var(--crimson)' : 'var(--secondary)');
    }
    if (penBarEl) penBarEl.style.width = `${penetration}%`;
    if (penTextEl) penTextEl.textContent = `${penetration}%`;
    if (multEl) {
      multEl.textContent = `${multiplier}x${multiplier > 1 ? ' (EV Positive)' : ' (Base Bet)'}`;
      multEl.style.color = multiplier > 1 ? 'var(--gold)' : 'var(--text-secondary)';
    }
    if (dealtCountEl) dealtCountEl.textContent = dealtCount;
  }

  function updateBlackjackRecommendation() {
    const pRanks = playerHand.map(c => c.rank);
    const dRank = dealerCard ? dealerCard.rank : null;
    const tc = BlackjackEngine.getTrueCount();

    const rec = BlackjackEngine.getRecommendation(pRanks, dRank, tc);

    // Update Advice HUD
    const adviceEl = document.getElementById("bj-advice-choice");
    const explanationEl = document.getElementById("bj-advice-explanation");

    if (adviceEl && explanationEl) {
      adviceEl.textContent = rec.actionText;
      explanationEl.textContent = rec.explanation;

      // Radial dial win rate
      setProgressRing("bj-gauge-fill", "bj-prob-val", rec.winPercentage);

      // Color actions
      adviceEl.className = 'advisor-choice ';
      if (rec.action === 'H') adviceEl.classList.add('text-cyan');
      else if (rec.action === 'S') adviceEl.classList.add('text-purple');
      else if (rec.action === 'D' || rec.action === 'Ds') adviceEl.classList.add('text-gold');
      else if (rec.action === 'P') adviceEl.classList.add('text-success');
      else adviceEl.classList.add('text-muted');
      
      // Update wager sizing recommendation
      if (tc >= 1.5) {
        updateBetAdvisor('bj', 'increase', `True Count is +${tc.toFixed(1)}`);
      } else if (tc < 0) {
        updateBetAdvisor('bj', 'decrease', `True Count is ${tc.toFixed(1)}`);
      } else {
        updateBetAdvisor('bj', 'normal', 'Neutral Count');
      }
    }

    // Stats
    const statTotal = document.getElementById("bj-stat-total");
    const statType = document.getElementById("bj-stat-type");
    const statDealerBust = document.getElementById("bj-stat-dealerbust");

    if (statTotal && statType && statDealerBust) {
      if (playerHand.length >= 2) {
        const analysis = BlackjackEngine.analyzeHand(pRanks);
        statTotal.textContent = analysis.total;
        statType.textContent = analysis.isSoft ? 'Soft' : (analysis.isPair ? 'Pair' : 'Hard');
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

    updateCountUI();
  }
}

/* ==========================================================================
   ROULETTE MODULE (Physics-based spin canvas)
   ========================================================================== */
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const WHEEL_NUMBERS = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

let rouletteAngle = 0;
let rouletteSpeed = 0;
let isRouletteSpinning = false;

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
  const spinBtn = document.getElementById("rt-spin-btn");
  const betPlacementSelect = document.getElementById("rt-bet-placement");

  if (!baseBetInput || !winBtn) return;

  // Draw initial canvas wheel
  drawRouletteWheel();

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
    if (isRouletteSpinning) return;
    playSound('click');
    triggerRouletteSpinAnimation(() => {
      playSound('win');
      RouletteEngine.recordResult(true);
      updateRouletteUI();
    });
  });

  lossBtn.addEventListener("click", () => {
    if (isRouletteSpinning) return;
    playSound('click');
    triggerRouletteSpinAnimation(() => {
      playSound('loss');
      RouletteEngine.recordResult(false);
      updateRouletteUI();
    });
  });

  if (spinBtn) {
    spinBtn.addEventListener("click", () => {
      if (isRouletteSpinning) return;
      playSound('click');
      triggerRouletteSpinAnimation(() => {
        // Resolve result based on selected bet placement
        const resultText = document.getElementById("rt-wheel-result").textContent;
        const parts = resultText.replace("Landed: ", "").split(" ");
        const color = parts[0];
        const num = parseInt(parts[1], 10);
        
        const placement = betPlacementSelect.value;
        let won = false;
        
        if (placement === 'red' && color === 'RED') won = true;
        else if (placement === 'black' && color === 'BLACK') won = true;
        else if (placement === 'even' && num !== 0 && num % 2 === 0) won = true;
        else if (placement === 'odd' && num % 2 !== 0) won = true;
        else if (placement === 'high' && num >= 19 && num <= 36) won = true;
        else if (placement === 'low' && num >= 1 && num <= 18) won = true;
        
        if (won) {
          playSound('win');
          RouletteEngine.recordResult(true);
        } else {
          playSound('loss');
          RouletteEngine.recordResult(false);
        }
        updateRouletteUI();
      });
    });
  }

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

  syncRouletteParams();
}

function drawRouletteWheel() {
  const canvas = document.getElementById("roulette-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const cx = 80;
  const cy = 80;
  const r = 76;

  ctx.clearRect(0, 0, 160, 160);

  // Draw outer casing ring
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.fillStyle = '#02040a';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Draw slices
  const sliceAngle = (2 * Math.PI) / 37;
  for (let i = 0; i < 37; i++) {
    const startAngle = rouletteAngle + (i * sliceAngle);
    const endAngle = rouletteAngle + ((i + 1) * sliceAngle);
    
    const num = WHEEL_NUMBERS[i];
    let color = '#0f172a'; // Black default
    if (num === 0) color = '#10b981'; // Green
    else if (RED_NUMBERS.includes(num)) color = '#f43f5e'; // Red

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r - 6, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Small numbers text placement
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(startAngle + sliceAngle / 2);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 7px Orbitron, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(num, r - 16, 3);
    ctx.restore();
  }

  // Draw inner turret ring
  ctx.beginPath();
  ctx.arc(cx, cy, 32, 0, 2 * Math.PI);
  ctx.fillStyle = '#1e293b';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner center brass star
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, 2 * Math.PI);
  ctx.fillStyle = '#f59e0b';
  ctx.fill();

  // Draw top landing pointer arrow
  ctx.beginPath();
  ctx.moveTo(cx, cy - r + 2);
  ctx.lineTo(cx - 6, cy - r + 12);
  ctx.lineTo(cx + 6, cy - r + 12);
  ctx.closePath();
  ctx.fillStyle = '#00f2fe';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function triggerRouletteSpinAnimation(callback) {
  isRouletteSpinning = true;
  document.getElementById("rt-wheel-result").textContent = "Spinning...";
  document.getElementById("rt-wheel-result").style.color = "var(--primary)";
  
  rouletteSpeed = Math.random() * 0.4 + 0.35; // Random initial speed
  const friction = 0.975; // Deceleration rate

  function animate() {
    rouletteAngle += rouletteSpeed;
    rouletteSpeed *= friction;
    drawRouletteWheel();

    if (rouletteSpeed > 0.002) {
      requestAnimationFrame(animate);
    } else {
      isRouletteSpinning = false;
      
      // Calculate top slice number
      // Top position is -Math.PI / 2. We align rotation to find which slot is at the pointer (1.5 * PI)
      const sliceAngle = (2 * Math.PI) / 37;
      let topIndexOffset = (1.5 * Math.PI - rouletteAngle) % (2 * Math.PI);
      if (topIndexOffset < 0) topIndexOffset += 2 * Math.PI;
      
      const winningIndex = Math.floor(topIndexOffset / sliceAngle) % 37;
      const num = WHEEL_NUMBERS[winningIndex];
      const color = num === 0 ? 'GREEN' : (RED_NUMBERS.includes(num) ? 'RED' : 'BLACK');

      const resultText = document.getElementById("rt-wheel-result");
      resultText.textContent = `Landed: ${color} ${num}`;
      
      if (color === 'RED') resultText.style.color = 'var(--crimson)';
      else if (color === 'GREEN') resultText.style.color = 'var(--emerald)';
      else resultText.style.color = '#fff';

      callback();
    }
  }
  animate();
}

function updateRouletteUI() {
  const status = RouletteEngine.getCurrentStatus();

  // Update HUD dial and labels
  document.getElementById("rt-advice-choice").textContent = `$${status.nextBet.toFixed(2)}`;
  document.getElementById("rt-advice-explanation").textContent = status.explanation;
  setProgressRing("rt-gauge-fill", "rt-prob-val", status.winPercentage);

  // Stats
  document.getElementById("rt-stat-profit").textContent = `$${status.netProfit.toFixed(2)}`;
  document.getElementById("rt-stat-profit").className = status.netProfit >= 0 ? 'text-success' : 'text-danger';
  document.getElementById("rt-stat-step").textContent = status.history.length + 1;
  document.getElementById("rt-stat-houseedge").textContent = `${status.houseEdge.toFixed(2)}%`;

  // History list
  const historyList = document.getElementById("rt-history-list");
  historyList.innerHTML = '';
  
  if (status.history.length === 0) {
    historyList.innerHTML = '<div class="text-muted" style="padding: 1rem; text-align: center;">No spins logged. Click WIN/LOSS to spin!</div>';
  } else {
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

  // Update wager advisor
  const baseBetVal = parseFloat(document.getElementById("rt-base-bet").value) || 10.0;
  if (status.nextBet > baseBetVal) {
    updateBetAdvisor('rt', 'increase', `Progression Active: $${status.nextBet.toFixed(2)}`);
  } else if (status.nextBet < baseBetVal) {
    updateBetAdvisor('rt', 'decrease', `Progression Lowered: $${status.nextBet.toFixed(2)}`);
  } else {
    updateBetAdvisor('rt', 'normal', 'Base Unit Bet');
  }

  updateRouletteChart();
}

function updateRouletteChart() {
  const canvas = document.getElementById("rouletteChart");
  if (!canvas) return;

  const status = RouletteEngine.getCurrentStatus();
  
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
        label: 'Balance ($)',
        data: dataPoints,
        borderColor: '#00f2fe',
        backgroundColor: 'rgba(0, 242, 254, 0.12)',
        fill: true,
        tension: 0.3,
        borderWidth: 2,
        pointBackgroundColor: '#a855f7',
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
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

  updateBaccaratUI();
}

function updateBaccaratUI() {
  const analysis = BaccaratEngine.getAnalysis();

  const adviceChoice = document.getElementById("bc-advice-choice");
  adviceChoice.textContent = analysis.advice;
  document.getElementById("bc-advice-explanation").textContent = analysis.explanation;

  adviceChoice.className = 'advisor-choice ';
  if (analysis.recommendedBet === 'B') adviceChoice.classList.add('text-danger');
  else if (analysis.recommendedBet === 'P') adviceChoice.classList.add('text-cyan');
  else adviceChoice.classList.add('text-success');

  // Probability radial gauge
  setProgressRing("bc-gauge-fill", "bc-prob-b", analysis.probabilities.Banker);

  // Shares table
  document.getElementById("bc-prob-p").textContent = `${analysis.probabilities.Player}%`;
  document.getElementById("bc-prob-t").textContent = `${analysis.probabilities.Tie}%`;

  // Stats
  document.getElementById("bc-stat-banker").textContent = analysis.counts.Banker;
  document.getElementById("bc-stat-player").textContent = analysis.counts.Player;
  document.getElementById("bc-stat-tie").textContent = analysis.counts.Tie;

  // Bead Plate
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

  // Big Road
  const roadGrid = document.getElementById("bc-big-road");
  roadGrid.innerHTML = '';
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

  // Update wager advisor
  if (analysis.probabilities.Banker > 51.5) {
    updateBetAdvisor('bc', 'increase', `Strong Banker Advantage (${analysis.probabilities.Banker}%)`);
  } else if (analysis.probabilities.Player > 50.0) {
    updateBetAdvisor('bc', 'increase', `Player Bias (${analysis.probabilities.Player}%)`);
  } else if (analysis.probabilities.Tie > 12.0) {
    updateBetAdvisor('bc', 'decrease', `High Tie Volatility (${analysis.probabilities.Tie}%)`);
  } else {
    updateBetAdvisor('bc', 'normal', 'Standard Banker Edge');
  }
}

/* ==========================================================================
   POKER MODULE
   ========================================================================== */
function initPoker() {
  const pocketList = [];
  const boardList = [];
  let pokerActiveTarget = 'pocket';

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
          <div style="align-self: flex-end; font-size: 1.1rem;">${SUIT_SYMBOLS[s]}</div>
        `;
        
        cardBtn.addEventListener("click", () => {
          const cardStr = r + s;
          if (pocketList.includes(cardStr) || boardList.includes(cardStr)) return;

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
      pocketDisplay.innerHTML = '<span class="text-muted">No Cards Selected</span>';
    } else {
      pocketList.forEach((card, idx) => {
        const rank = card.slice(0, -1);
        const suit = card.slice(-1);
        const isRed = ['h', 'd'].includes(suit);
        const cardEl = document.createElement("div");
        cardEl.className = `active-card ${isRed ? 'red-suit' : ''}`;
        cardEl.innerHTML = `
          <div>${rank}</div>
          <div style="align-self: flex-end; font-size: 1.15rem;">${SUIT_SYMBOLS[suit]}</div>
          <button class="remove-btn" onclick="removePokerPocket(${idx})">&times;</button>
        `;
        pocketDisplay.appendChild(cardEl);
      });
    }

    boardDisplay.innerHTML = '';
    if (boardList.length === 0) {
      boardDisplay.innerHTML = '<span class="text-muted">No Cards Selected</span>';
    } else {
      boardList.forEach((card, idx) => {
        const rank = card.slice(0, -1);
        const suit = card.slice(-1);
        const isRed = ['h', 'd'].includes(suit);
        const cardEl = document.createElement("div");
        cardEl.className = `active-card ${isRed ? 'red-suit' : ''}`;
        cardEl.innerHTML = `
          <div>${rank}</div>
          <div style="align-self: flex-end; font-size: 1.15rem;">${SUIT_SYMBOLS[suit]}</div>
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

  calcBtn.addEventListener("click", () => {
    if (pocketList.length < 2) {
      alert("Please select 2 pocket cards.");
      return;
    }
    
    calcBtn.disabled = true;
    calcBtn.textContent = 'Simulating Hands...';
    playSound('click');
    
    setTimeout(() => {
      const opponents = parseInt(document.getElementById("pk-opponents").value, 10);
      const potSize = parseFloat(document.getElementById("pk-pot-size").value) || 100;
      const callSize = parseFloat(document.getElementById("pk-call-size").value) || 0;

      const simResults = PokerEngine.runSimulation(pocketList, boardList, opponents, 800);
      const advice = PokerEngine.getAdvice(simResults.equity, potSize, callSize);

      // HUD Dial
      document.getElementById("pk-advice-choice").textContent = advice.action;
      document.getElementById("pk-advice-explanation").textContent = advice.explanation;
      setProgressRing("pk-gauge-fill", "pk-prob-val", simResults.equity);

      // Stats
      document.getElementById("pk-stat-hand").textContent = simResults.currentHandName;
      document.getElementById("pk-stat-oppequity").textContent = `${simResults.lossRate}%`;
      document.getElementById("pk-stat-potodds").textContent = `${advice.potOdds}%`;

      const outsResult = PokerEngine.calculateOuts(pocketList, boardList);
      document.getElementById("pk-stat-outs").textContent = outsResult.count;
      document.getElementById("pk-stat-outs-desc").textContent = outsResult.text;

      // Update wager advisor
      if (simResults.equity > 55.0) {
        updateBetAdvisor('pk', 'increase', `High Equity (${simResults.equity}%)`);
      } else if (simResults.equity < 45.0) {
        updateBetAdvisor('pk', 'decrease', `Weak Equity (${simResults.equity}%)`);
      } else {
        updateBetAdvisor('pk', 'normal', `Marginal Hand (${simResults.equity}%)`);
      }

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

    document.getElementById("cr-advice-choice").textContent = analysis.advice;
    document.getElementById("cr-advice-explanation").textContent = analysis.explanation;
    
    // Radial dial
    setProgressRing("cr-gauge-fill", "cr-prob-val", analysis.winPercentage);

    crapsBetsTable.innerHTML = '';
    const filteredBets = [...analysis.allBets].sort((a, b) => b.recommended - a.recommended);

    filteredBets.forEach(bet => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="padding: 0.85rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.03);">
          <strong style="color: ${bet.recommended ? '#10b981' : '#f43f5e'}">${bet.name}</strong>
          ${bet.recommended ? '<span class="badge" style="font-size:0.55rem; padding:0.1rem 0.3rem; margin-left:0.5rem; background:rgba(16,185,129,0.08); color:#10b981;">Best</span>' : ''}
        </td>
        <td style="padding: 0.85rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.03); font-weight:700;">${bet.houseEdge.toFixed(2)}%</td>
        <td style="padding: 0.85rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.03); color:#94a3b8;">${bet.payout}</td>
        <td style="padding: 0.85rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.03); font-size:0.8rem; color:#64748b;">${bet.description}</td>
      `;
      crapsBetsTable.appendChild(tr);
    });

    // Update wager advisor
    if (activePhase === 'Point Established') {
      updateBetAdvisor('cr', 'increase', 'Point Active: Take Max 3x-4x-5x Odds Bets');
    } else {
      updateBetAdvisor('cr', 'normal', 'Come-out Phase: Stable Pass Line Unit');
    }
  }

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
    return baseBet;
  } else {
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

  const totalRounds = CUSTOM_HISTORY.length;
  const netProfit = CUSTOM_HISTORY.reduce((sum, h) => sum + h.profit, 0);

  const pLoss = 1 - (winProb / 100);
  const ruinProbability = Math.min(99, Math.round(Math.pow(pLoss, 6) * 100));

  document.getElementById("cs-advice-choice").textContent = `$${nextBet.toFixed(2)}`;
  document.getElementById("cs-advice-explanation").textContent = `Custom Progression. Multiplier applied on losses. Plays: ${totalRounds}. 6-Loss streak probability: ${ruinProbability}%.`;
  
  // Radial dial
  setProgressRing("cs-gauge-fill", "cs-prob-val", winProb);

  // Stats
  document.getElementById("cs-stat-profit").textContent = `$${netProfit.toFixed(2)}`;
  document.getElementById("cs-stat-profit").className = netProfit >= 0 ? 'text-success' : 'text-danger';
  document.getElementById("cs-stat-step").textContent = totalRounds + 1;
  document.getElementById("cs-stat-ruin").textContent = `${ruinProbability}%`;

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

  // Update wager advisor
  const baseBet = parseFloat(document.getElementById("cs-base-bet").value) || 10;
  if (nextBet > baseBet) {
    updateBetAdvisor('cs', 'increase', `Progression Active: $${nextBet.toFixed(2)}`);
  } else if (nextBet < baseBet) {
    updateBetAdvisor('cs', 'decrease', `Progression Lowered: $${nextBet.toFixed(2)}`);
  } else {
    updateBetAdvisor('cs', 'normal', 'Base Unit Bet');
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
        label: 'Balance ($)',
        data: dataPoints,
        borderColor: '#a855f7',
        backgroundColor: 'rgba(168, 85, 247, 0.12)',
        fill: true,
        tension: 0.3,
        borderWidth: 2,
        pointBackgroundColor: '#00f2fe',
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
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

function initAuth() {
  const authForm = document.getElementById("auth-form");
  const authToggleLink = document.getElementById("auth-toggle-link");
  const authToggleDesc = document.getElementById("auth-toggle-desc");
  const authSubmitBtn = document.getElementById("auth-submit-btn");
  const errorMsg = document.getElementById("auth-error-msg");
  const logoutBtn = document.getElementById("logout-btn");

  if (!authForm) return;

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
      if (!res.ok) throw new Error(data.error || 'Authentication failed');
      return data;
    })
    .then(data => {
      if (authMode === 'register') {
        playSound('win');
        alert(data.message);
        authMode = 'login';
        authToggleDesc.textContent = "Don't have an account?";
        authToggleLink.textContent = 'Register Here';
        authSubmitBtn.textContent = 'LOG IN';
        document.getElementById("auth-password").value = '';
      } else {
        playSound('win');
        document.getElementById("auth-username").value = '';
        document.getElementById("auth-password").value = '';
        
        document.getElementById("auth-modal").style.display = 'none';
        document.getElementById("user-profile-badge").style.display = 'inline-block';
        document.getElementById("header-username").textContent = data.username.toUpperCase();
        logoutBtn.style.display = 'inline-block';
        
        trackTabAccess('vision-panel');
      }
    })
    .catch(err => {
      playSound('loss');
      errorMsg.textContent = err.message;
      errorMsg.style.display = 'block';
    });
  });

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
  const gameMap = {
    'vision-panel': 'Screenshot OCR Scan',
    'blackjack-panel': 'Blackjack Strategizer',
    'roulette-panel': 'Roulette Progression',
    'baccarat-panel': 'Baccarat Roadmaps',
    'poker-panel': 'Poker Holdem Equity',
    'craps-panel': 'Craps Odds',
    'mines-panel': 'Mines Strategizer',
    'limbo-panel': 'Limbo Odds',
    'crash-panel': 'Crash Predictor',
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
  .catch(err => console.warn('Analytic event warning:', err));
}

function loadAnalytics() {
  fetch('/api/analytics')
  .then(res => {
    if (res.ok) return res.json();
    throw new Error('Analytics failed');
  })
  .then(data => {
    drawAnalyticsChart(data);
    compileAnalyticsInsights(data);
    updateNNAnalytics();
  })
  .catch(err => console.error(err));
}

function updateNNAnalytics() {
  const list = document.getElementById("analytics-nn-list");
  if (!list) return;
  list.innerHTML = "";

  if (!window.SattaAIPredictor) {
    list.innerHTML = `<div class="text-muted" style="font-size:0.75rem;text-align:center;padding:1rem;">Neural Network not initialized.</div>`;
    return;
  }

  const games = Object.keys(window.SattaAIPredictor.models);
  games.forEach(game => {
    const model = window.SattaAIPredictor.models[game];
    const stats = window.SattaAIPredictor.stats[game];
    const card = document.createElement("div");
    card.className = "step-card";
    
    // Determine type (ANN vs RNN)
    const isRnn = (game === 'limbo' || game === 'crash' || game === 'roulette' || game === 'baccarat');
    const typeLabel = isRnn ? "RNN Cell" : "FeedForward ANN";
    const structure = isRnn 
      ? `In: ${model.inputSize} | Hid: ${model.hiddenSize} | Out: ${model.outputSize}`
      : `Layers: [${model.sizes.join(" → ")}]`;

    card.innerHTML = `
      <div class="step-number" style="color:var(--primary); border-color:var(--primary-glow)">${isRnn ? '⏳' : '🧠'}</div>
      <div class="step-content" style="width: 100%;">
        <div class="step-title" style="display:flex; justify-content:space-between; align-items:center; font-weight:700;">
          <span>${game.toUpperCase()} (${typeLabel})</span>
          <span style="font-size:0.65rem; color:#64748b; font-weight:normal;">LR: ${model.learningRate}</span>
        </div>
        <div class="step-desc" style="font-size:0.7rem; color:#94a3b8; line-height:1.4; margin-top:0.25rem;">
          • Structure: <code>${structure}</code><br>
          • Trained Iterations: <strong>${stats.steps} rounds</strong><br>
          • Cumulative loss: <strong class="${stats.loss < 0.1 ? 'text-emerald' : 'text-gold'}">${stats.loss.toFixed(4)}</strong>
        </div>
      </div>
    `;
    list.appendChild(card);
  });
}

function drawAnalyticsChart(data) {
  const canvas = document.getElementById("analyticsChart");
  if (!canvas) return;

  const labels = data.map(item => item.game);
  const counts = data.map(item => item.count);

  if (analyticsChartInstance) {
    analyticsChartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 400, 0);
  gradient.addColorStop(0, '#a855f7');
  gradient.addColorStop(1, '#00f2fe');

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
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
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
        <div class="step-number" style="color:var(--gold); border-color:rgba(245,158,11,0.3)">AI</div>
        <div class="step-content">
          <div class="step-title">Analytic Insight</div>
          <div class="step-desc">Awaiting more session data to compile statistics. Switch between game panels to track usage.</div>
        </div>
      </div>
    `;
    return;
  }

  const topGame = data[0];
  const insightCard = document.createElement("div");
  insightCard.className = "step-card";
  insightCard.innerHTML = `
    <div class="step-number" style="color:var(--gold); border-color:var(--gold-glow)">🏆</div>
    <div class="step-content">
      <div class="step-title">Most Active Deck</div>
      <div class="step-desc"><strong>${topGame.game}</strong> is your most used system. You have accessed it <strong>${topGame.count}</strong> times this session.</div>
    </div>
  `;
  insightsList.appendChild(insightCard);

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

/* ==========================================================================
   MINES GAME MODULE
   ================================================================function initMines() {
  const minesCountInput = document.getElementById("mn-mines-count");
  const betInput = document.getElementById("mn-bet-amount");
  const startBtn = document.getElementById("mn-start-btn");
  const resetBtn = document.getElementById("mn-reset-btn");
  const cashoutBtn = document.getElementById("mn-cashout-btn");
  const cashoutVal = document.getElementById("mn-cashout-val");
  const gridContainer = document.getElementById("mn-grid");
  
  let minesCount = 3;
  let betAmount = 10;
  let uncoveredCount = 0;
  let minesLocations = [];
  let revealedStates = Array(25).fill(false);
  let isGameActive = false;
  let sessionProfit = 0.0;
  let minesChart = null;

  if (!startBtn) return;

  function resetBoard() {
    isGameActive = false;
    uncoveredCount = 0;
    revealedStates.fill(false);
    minesLocations = [];
    cashoutBtn.disabled = true;
    cashoutVal.textContent = "0.00";
    minesCountInput.disabled = false;
    betInput.disabled = false;
    
    // Reset grid UI
    gridContainer.innerHTML = '';
    for (let i = 0; i < 25; i++) {
      const tile = document.createElement("div");
      tile.className = "mine-tile";
      tile.textContent = "?";
      tile.addEventListener("click", () => handleTileClick(i, tile));
      gridContainer.appendChild(tile);
    }
    
    setProgressRing("mn-gauge-fill", "mn-prob-val", 100);
    updateMetrics();
    highlightSuggestedTile();
    updateBetAdvisor('mn', 'normal', 'Awaiting Start');
  }

  function startBoard() {
    playSound('click');
    minesCount = parseInt(minesCountInput.value, 10) || 3;
    betAmount = parseFloat(betInput.value) || 10;
    
    if (minesCount < 1 || minesCount > 24) {
      alert("Mines must be between 1 and 24");
      return;
    }

    // Lock parameters
    minesCountInput.disabled = true;
    betInput.disabled = true;
    
    // Generate mines
    minesLocations = [];
    while (minesLocations.length < minesCount) {
      const pos = Math.floor(Math.random() * 25);
      if (!minesLocations.includes(pos)) {
        minesLocations.push(pos);
      }
    }

    revealedStates.fill(false);
    uncoveredCount = 0;
    isGameActive = true;
    cashoutBtn.disabled = false;
    cashoutVal.textContent = betAmount.toFixed(2);
    
    // Re-build clean grid tiles
    gridContainer.innerHTML = '';
    for (let i = 0; i < 25; i++) {
      const tile = document.createElement("div");
      tile.className = "mine-tile";
      tile.textContent = "?";
      tile.addEventListener("click", () => handleTileClick(i, tile));
      gridContainer.appendChild(tile);
    }

    const safeProb = MinesEngine.getSafeProb(minesCount, 0);
    setProgressRing("mn-gauge-fill", "mn-prob-val", Math.round(safeProb));
    updateMetrics();
    highlightSuggestedTile();
    
    document.getElementById("mn-advice-choice").textContent = "LOW RISK";
    document.getElementById("mn-advice-choice").className = "advisor-choice text-cyan";
    document.getElementById("mn-advice-explanation").textContent = "Board active. Select tiles carefully.";
    
    if (safeProb >= 85) {
      updateBetAdvisor('mn', 'increase', `Safe Initial Board (${Math.round(safeProb)}%)`);
    } else {
      updateBetAdvisor('mn', 'normal', `Board Active (${Math.round(safeProb)}%)`);
    }
  }

  function highlightSuggestedTile() {
    const tiles = gridContainer.children;
    for (let i = 0; i < 25; i++) {
      if (tiles[i]) {
        tiles[i].classList.remove("ai-recommended");
      }
    }
    
    if (!isGameActive) {
      document.getElementById("mn-stat-suggested").textContent = "Row: -, Col: -";
      return;
    }

    const rec = MinesEngine.getRecommendation(revealedStates, minesCount);
    if (rec.tileIndex !== -1 && tiles[rec.tileIndex]) {
      tiles[rec.tileIndex].classList.add("ai-recommended");
      document.getElementById("mn-stat-suggested").textContent = `Row: ${rec.row}, Col: ${rec.col} (${rec.safetyPct}% safe)`;
    } else {
      document.getElementById("mn-stat-suggested").textContent = "None remaining";
    }
  }

  function handleTileClick(idx, tileEl) {
    if (!isGameActive || revealedStates[idx]) return;

    revealedStates[idx] = true;
    
    if (minesLocations.includes(idx)) {
      // Boom! Game Over
      isGameActive = false;
      tileEl.classList.add("revealed", "mine");
      tileEl.textContent = "💣";
      playSound('loss');
      
      // Save mine locations patterns to train weights database
      MinesEngine.saveSpawn(minesLocations);
      
      // Reveal other mines
      const tiles = gridContainer.children;
      minesLocations.forEach(loc => {
        tiles[loc].classList.add("revealed", "mine");
        tiles[loc].textContent = "💣";
      });
      
      cashoutBtn.disabled = true;
      sessionProfit -= betAmount;
      updateMetrics();
      highlightSuggestedTile();
      
      document.getElementById("mn-advice-choice").textContent = "BUSTED";
      document.getElementById("mn-advice-choice").className = "advisor-choice text-crimson";
      document.getElementById("mn-advice-explanation").textContent = "You hit a mine! Lost wager of $" + betAmount.toFixed(2);
      setProgressRing("mn-gauge-fill", "mn-prob-val", 0);
      updateBetAdvisor('mn', 'decrease', 'Mine Hit - Lost Wager');
    } else {
      // Safe! Gem uncovered
      uncoveredCount++;
      tileEl.classList.add("revealed", "diamond");
      tileEl.textContent = "💎";
      playSound('click');
      
      const currentMult = MinesEngine.getMultiplier(minesCount, uncoveredCount);
      const cashVal = betAmount * currentMult;
      cashoutVal.textContent = cashVal.toFixed(2);
      
      const safeProb = MinesEngine.getSafeProb(minesCount, uncoveredCount);
      setProgressRing("mn-gauge-fill", "mn-prob-val", Math.round(safeProb));
      
      updateMetrics();
      highlightSuggestedTile();
      
      // Update advice
      let riskLvl = "LOW RISK";
      let clrClass = "text-cyan";
      if (safeProb < 50) {
        riskLvl = "HIGH RISK";
        clrClass = "text-crimson";
      } else if (safeProb < 80) {
        riskLvl = "MEDIUM RISK";
        clrClass = "text-gold";
      }
      document.getElementById("mn-advice-choice").textContent = riskLvl;
      document.getElementById("mn-advice-choice").className = "advisor-choice " + clrClass;
      document.getElementById("mn-advice-explanation").textContent = `Revealed ${uncoveredCount} gems. Next click safety index is ${safeProb.toFixed(1)}%.`;
      
      if (safeProb >= 85) {
        updateBetAdvisor('mn', 'increase', `High Safety (${safeProb.toFixed(1)}%)`);
      } else if (safeProb < 75) {
        updateBetAdvisor('mn', 'decrease', `Elevated Risk (${safeProb.toFixed(1)}%)`);
      } else {
        updateBetAdvisor('mn', 'normal', `Medium Safety (${safeProb.toFixed(1)}%)`);
      }
      
      // Auto cashout if all gems are revealed
      const maxGems = 25 - minesCount;
      if (uncoveredCount === maxGems) {
        cashoutBoard();
      }
    }
  }

  function cashoutBoard() {
    if (!isGameActive) return;
    
    isGameActive = false;
    playSound('win');
    
    const finalMult = MinesEngine.getMultiplier(minesCount, uncoveredCount);
    const winProfit = betAmount * (finalMult - 1);
    sessionProfit += winProfit;
    
    cashoutBtn.disabled = true;
    
    // Save mine locations patterns to train weights database
    MinesEngine.saveSpawn(minesLocations);
    
    // Reveal everything
    const tiles = gridContainer.children;
    for (let i = 0; i < 25; i++) {
      if (minesLocations.includes(i)) {
        tiles[i].classList.add("revealed", "mine");
        tiles[i].textContent = "💣";
      } else if (!revealedStates[i]) {
        tiles[i].classList.add("revealed", "diamond");
        tiles[i].style.opacity = '0.5';
        tiles[i].textContent = "💎";
      }
    }
    
    updateMetrics();
    highlightSuggestedTile();
    
    document.getElementById("mn-advice-choice").textContent = "CASHED OUT";
    document.getElementById("mn-advice-choice").className = "advisor-choice text-emerald";
    document.getElementById("mn-advice-explanation").textContent = `Secured profit of $${winProfit.toFixed(2)} at multiplier ${finalMult.toFixed(2)}x!`;
    updateBetAdvisor('mn', 'normal', 'Cashed Out - Secured Profit');
  }

  function updateMetrics() {
    document.getElementById("mn-stat-gems").textContent = uncoveredCount;
    
    const curMult = MinesEngine.getMultiplier(minesCount, uncoveredCount);
    const nextMult = MinesEngine.getMultiplier(minesCount, uncoveredCount + 1);
    
    document.getElementById("mn-stat-mult").textContent = curMult.toFixed(2) + "x";
    document.getElementById("mn-stat-nextmult").textContent = nextMult.toFixed(2) + "x";
    
    const safeProb = MinesEngine.getSafeProb(minesCount, uncoveredCount);
    const kellyPct = MinesEngine.getKelly(safeProb, curMult, nextMult);
    document.getElementById("mn-stat-kelly").textContent = kellyPct > 0 ? `${Math.round(kellyPct * 100)}% Wager` : "0% (Neg EV)";
  }

  // AI Training Action
  const trainBtn = document.getElementById("mn-train-btn");
  trainBtn.addEventListener("click", () => {
    playSound('click');
    const mCount = parseInt(minesCountInput.value, 10) || 3;
    const bAmt = parseFloat(betInput.value) || 10;
    
    const trainResult = MinesEngine.train(mCount, 1000, bAmt, 5000, true);
    
    document.getElementById("mn-train-results").style.display = 'block';
    document.getElementById("mn-opt-clicks").textContent = trainResult.bestTarget;
    document.getElementById("mn-opt-mult").textContent = trainResult.bestMultiplier.toFixed(2) + "x";
    document.getElementById("mn-opt-winrate").textContent = trainResult.bestWinRate.toFixed(1);
    
    // Draw chart
    document.getElementById("mn-chart-card").style.display = 'block';
    const chartCtx = document.getElementById("mn-simulation-chart").getContext('2d');
    
    if (minesChart) minesChart.destroy();
    
    const labels = trainResult.history.map((_, i) => `R${i * 250}`);
    const gradient = chartCtx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(0, 242, 254, 0.4)');
    gradient.addColorStop(1, 'rgba(0, 242, 254, 0.0)');

    minesChart = new Chart(chartCtx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: `Simulation Balance Curve (Revealing ${trainResult.bestTarget} tiles)`,
          data: trainResult.history,
          borderColor: '#00f2fe',
          backgroundColor: gradient,
          fill: true,
          tension: 0.3,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: 'rgba(255, 255, 255, 0.03)' }, ticks: { color: '#64748b' } },
          y: { grid: { color: 'rgba(255, 255, 255, 0.03)' }, ticks: { color: '#64748b' } }
        },
        plugins: { legend: { labels: { color: '#94a3b8' } } }
      }
    });

    // Re-highlight safest tile based on new training weights
    highlightSuggestedTile();
  });

  startBtn.addEventListener("click", startBoard);
  resetBtn.addEventListener("click", resetBoard);
  cashoutBtn.addEventListener("click", cashoutBoard);

  resetBoard();
}

/* ==========================================================================
   LIMBO GAME MODULE
   ========================================================================== */
function initLimbo() {
  const targetInput = document.getElementById("lb-target");
  const betInput = document.getElementById("lb-bet");
  const progSelect = document.getElementById("lb-progression");
  const rollBtn = document.getElementById("lb-roll-btn");
  const autoBtn = document.getElementById("lb-auto-btn");
  const ticker = document.getElementById("lb-ticker");
  const historyList = document.getElementById("lb-history-list");
  const clearBtn = document.getElementById("lb-history-clear");
  const trainBtn = document.getElementById("lb-train-btn");
  
  let accumulatedLoss = 0.0;
  let limboProfit = 0.0;
  let streakCount = 0;
  let nextWager = 10.0;
  let limboChart = null;
  let autoTimer = null;

  if (!rollBtn) return;

  function updateLimboUI() {
    const baseBet = parseFloat(betInput.value) || 10.0;
    const prog = progSelect.value;
    
    // Get AI prediction passing current state
    const prediction = LimboEngine.predict(baseBet, streakCount, accumulatedLoss, limboProfit);

    // If SALS is selected, it dynamically controls target and wager
    if (prog === 'sals') {
      nextWager = prediction.recommendedWager;
      targetInput.value = prediction.targetVal.toFixed(2);
    }

    const target = parseFloat(targetInput.value) || 2.0;
    
    // Probability dial
    const prob = LimboEngine.getWinProb(target);
    setProgressRing("lb-gauge-fill", "lb-prob-val", Math.round(prob));

    // Next bet calc for other strategies
    if (prog === 'recovery') {
      nextWager = LimboEngine.getRecoveryBet(target, accumulatedLoss, baseBet);
    } else if (prog === 'martingale') {
      nextWager = streakCount > 0 ? baseBet * Math.pow(2, streakCount) : baseBet;
    } else if (prog !== 'sals') {
      nextWager = baseBet;
    }

    // Update labels
    document.getElementById("lb-advice-choice").textContent = `$${nextWager.toFixed(2)}`;
    document.getElementById("lb-advice-explanation").textContent = `State: ${prediction.currentState} | Recommendation: ${prediction.targetAdvice}`;
    
    document.getElementById("lb-stat-volatility").textContent = `${prediction.volatility} [L: ${prediction.lowVolThreshold} | H: ${prediction.highVolThreshold}]`;
    document.getElementById("lb-stat-aitarget").textContent = `${prediction.targetVal.toFixed(2)}x`;
    document.getElementById("lb-stat-capitalsize").textContent = prediction.capitalAdvice;
    
    document.getElementById("lb-stat-recovery").textContent = `$${nextWager.toFixed(2)}`;
    document.getElementById("lb-stat-streak").textContent = streakCount;
    document.getElementById("lb-stat-profit").textContent = (limboProfit >= 0 ? '+' : '') + `$${limboProfit.toFixed(2)}`;
    document.getElementById("lb-stat-profit").className = "font-outfit " + (limboProfit >= 0 ? "text-success" : "text-danger");

    // Wager Advisor
    if (prediction.betRecommendation.includes("INCREASE") || prediction.betRecommendation.includes("SALS Recovery") || prediction.betRecommendation.includes("RNN Recovery")) {
      updateBetAdvisor('lb', 'increase', prediction.betRecommendation);
    } else if (prediction.betRecommendation.includes("DECREASE")) {
      updateBetAdvisor('lb', 'decrease', prediction.betRecommendation);
    } else {
      updateBetAdvisor('lb', 'normal', prediction.betRecommendation);
    }

    // Render Stake-style outcome pills (wins in green, losses in grey)
    const recentOutcomesDiv = document.getElementById("lb-recent-outcomes");
    if (recentOutcomesDiv) {
      recentOutcomesDiv.innerHTML = "";
      const rawHistory = window.LimboEngine.getRawHistory ? window.LimboEngine.getRawHistory() : window.LimboEngine.getHistory();
      const slice = rawHistory.slice(-5);
      slice.forEach(item => {
        const pill = document.createElement("span");
        let outcomeVal = 1.0;
        let isWin = false;
        if (typeof item === 'object' && item !== null) {
          outcomeVal = item.outcome ?? 1.0;
          isWin = outcomeVal >= (item.target ?? 2.0);
        } else if (typeof item === 'number') {
          outcomeVal = item;
          isWin = outcomeVal >= target;
        }
        
        pill.textContent = `${outcomeVal.toFixed(2)}x`;
        pill.style.background = isWin ? "#10b981" : "#374151";
        pill.style.color = "#ffffff";
        pill.style.borderRadius = "9999px";
        pill.style.padding = "3px 8px";
        pill.style.fontSize = "0.72rem";
        pill.style.fontWeight = "bold";
        pill.style.fontFamily = "'Orbitron', sans-serif";
        pill.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
        pill.style.display = "inline-block";
        
        recentOutcomesDiv.appendChild(pill);
      });
    }
  }

  function handleRoll() {
    if (rollBtn.disabled) return;
    
    rollBtn.disabled = true;
    autoBtn.disabled = true;
    playSound('click');
    
    const target = parseFloat(targetInput.value) || 2.0;
    const baseBet = parseFloat(betInput.value) || 10.0;
    const wager = nextWager;

    ticker.className = "";
    ticker.textContent = "Rolling...";
    
    // Simulate spin ticker animation
    let frames = 0;
    const interval = setInterval(() => {
      ticker.textContent = (Math.random() * target * 1.5 + 1.0).toFixed(2) + "x";
      frames++;
      if (frames > 8) {
        clearInterval(interval);
        
        // Resolve actual roll
        const outcome = LimboEngine.roll();
        LimboEngine.record(outcome, target, streakCount, accumulatedLoss, limboProfit, wager);
        ticker.textContent = outcome.toFixed(2) + "x";
        
        const isWin = outcome >= target;
        const record = document.createElement("div");
        record.className = "step-card";
        
        if (isWin) {
          ticker.className = "ticker-win";
          playSound('win');
          
          const profit = wager * (target - 1);
          limboProfit += profit;
          accumulatedLoss = 0;
          streakCount = 0;

          record.innerHTML = `
            <div class="step-number" style="color:var(--emerald); border-color:var(--emerald)">✓</div>
            <div class="step-content">
              <div class="step-title text-emerald">Win (${outcome.toFixed(2)}x)</div>
              <div class="step-desc">Target: ${target.toFixed(2)}x | Wagered: $${wager.toFixed(2)} | Profit: +$${profit.toFixed(2)}</div>
            </div>
          `;
        } else {
          ticker.className = "ticker-loss";
          playSound('loss');
          
          limboProfit -= wager;
          accumulatedLoss += wager;
          streakCount++;

          record.innerHTML = `
            <div class="step-number" style="color:var(--crimson); border-color:var(--crimson)">✗</div>
            <div class="step-content">
              <div class="step-title text-crimson">Lose (${outcome.toFixed(2)}x)</div>
              <div class="step-desc">Target: ${target.toFixed(2)}x | Wagered: $${wager.toFixed(2)} | Loss: -$${wager.toFixed(2)}</div>
            </div>
          `;
        }

        historyList.insertBefore(record, historyList.firstChild);
        
        rollBtn.disabled = false;
        autoBtn.disabled = false;
        
        updateLimboUI();
      }
    }, 45);
  }

  // AI Training
  trainBtn.addEventListener("click", () => {
    playSound('click');
    const target = parseFloat(targetInput.value) || 2.0;
    const baseBet = parseFloat(betInput.value) || 10.0;
    const prog = progSelect.value;
    
    const trainResult = LimboEngine.train(target, prog, 1000, baseBet, 5000);
    
    document.getElementById("lb-train-results").style.display = 'block';
    document.getElementById("lb-opt-profit").textContent = (trainResult.profit >= 0 ? '+$' : '-$') + Math.abs(trainResult.profit).toFixed(2);
    document.getElementById("lb-opt-profit").className = trainResult.profit >= 0 ? "text-emerald" : "text-danger";
    document.getElementById("lb-opt-maxbet").textContent = `$${trainResult.maxBet.toFixed(2)}`;
    document.getElementById("lb-opt-streak").textContent = trainResult.maxLossStreak;
    
    // Draw chart
    document.getElementById("lb-chart-card").style.display = 'block';
    const chartCtx = document.getElementById("lb-simulation-chart").getContext('2d');
    
    if (limboChart) limboChart.destroy();
    
    const labels = trainResult.history.map((_, i) => `R${i * 250}`);
    const gradient = chartCtx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(168, 85, 247, 0.4)');
    gradient.addColorStop(1, 'rgba(168, 85, 247, 0.0)');

    limboChart = new Chart(chartCtx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: `Balance Progression History (${prog.toUpperCase()})`,
          data: trainResult.history,
          borderColor: '#a855f7',
          backgroundColor: gradient,
          fill: true,
          tension: 0.3,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: 'rgba(255, 255, 255, 0.03)' }, ticks: { color: '#64748b' } },
          y: { grid: { color: 'rgba(255, 255, 255, 0.03)' }, ticks: { color: '#64748b' } }
        },
        plugins: { legend: { labels: { color: '#94a3b8' } } }
      }
    });
  });

  autoBtn.addEventListener("click", () => {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
      autoBtn.textContent = "Auto (10x)";
      autoBtn.classList.remove("btn-cyan");
      autoBtn.classList.add("btn-secondary");
    } else {
      let count = 0;
      autoBtn.textContent = "Stop (10)";
      autoBtn.classList.add("btn-cyan");
      autoBtn.classList.remove("btn-secondary");
      
      autoTimer = setInterval(() => {
        if (!rollBtn.disabled) {
          handleRoll();
          count++;
          autoBtn.textContent = `Stop (${10 - count})`;
          if (count >= 10) {
            clearInterval(autoTimer);
            autoTimer = null;
            autoBtn.textContent = "Auto (10x)";
            autoBtn.classList.remove("btn-cyan");
            autoBtn.classList.add("btn-secondary");
          }
        }
      }, 700);
    }
  });

  clearBtn.addEventListener("click", () => {
    playSound('click');
    historyList.innerHTML = '';
  });

  const datasetInput = document.getElementById("lb-dataset-input");
  const importDatasetBtn = document.getElementById("lb-import-dataset-btn");
  const clearDatasetBtn = document.getElementById("lb-clear-dataset-btn");
  const datasetStatus = document.getElementById("lb-dataset-status");

  function refreshDatasetStatus() {
    if (!datasetStatus) return;
    const history = LimboEngine.getHistory();
    const thresholds = LimboEngine.getThresholds();
    if (history.length > 0) {
      const mean = history.reduce((a, b) => a + b, 0) / history.length;
      const variance = history.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / history.length;
      const stdDev = Math.sqrt(variance);
      datasetStatus.innerHTML = `Loaded: <strong class="text-cyan">${history.length} rolls</strong>. Volatility Std Dev: <strong class="text-gold">${stdDev.toFixed(2)}</strong>. Tuned Low: <strong class="text-success">${thresholds.low.toFixed(1)}</strong>, Tuned High: <strong class="text-cyan">${thresholds.high.toFixed(1)}</strong>.`;
    } else {
      datasetStatus.textContent = "Loaded: 0 rolls. Volatility thresholds trained to default (2.0 | 12.0).";
    }
  }

  if (importDatasetBtn && datasetInput) {
    importDatasetBtn.addEventListener("click", () => {
      playSound('click');
      const text = datasetInput.value.trim();
      if (!text) {
        alert("Please paste comma-separated roll multipliers.");
        return;
      }
      const parts = text.split(/[,\s\n]+/).map(p => parseFloat(p.trim())).filter(p => !isNaN(p) && p >= 0.99);
      if (parts.length < 5) {
        alert("Requires at least 5 valid numbers (multipliers >= 0.99).");
        return;
      }

      const res = LimboEngine.trainOnDataset(parts);
      if (res.error) {
        alert(res.error);
        return;
      }

      refreshDatasetStatus();
      updateLimboUI();
      alert(`Model Trained Successfully!\nDataset Size: ${res.size} spins\nVolatility Std Dev: ${res.std}\nLow Volatility Bound: ${res.lowThreshold}\nHigh Volatility Bound: ${res.highThreshold}`);
    });
  }

  if (clearDatasetBtn) {
    clearDatasetBtn.addEventListener("click", () => {
      playSound('shuffle');
      LimboEngine.clearHistory();
      localStorage.removeItem('lb_low_vol_threshold');
      localStorage.removeItem('lb_high_vol_threshold');
      refreshDatasetStatus();
      updateLimboUI();
    });
  }

  refreshDatasetStatus();

  targetInput.addEventListener("input", updateLimboUI);
  betInput.addEventListener("input", updateLimboUI);
  progSelect.addEventListener("change", updateLimboUI);
  rollBtn.addEventListener("click", handleRoll);

  updateLimboUI();
}

/* ==========================================================================
   CRASH GAME MODULE
   ========================================================================== */
function initCrash() {
  const betInput = document.getElementById("crsh-bet");
  const autoCashInput = document.getElementById("crsh-auto-cash");
  const startBtn = document.getElementById("crsh-start-btn");
  const cashoutBtn = document.getElementById("crsh-cashout-btn");
  const canvas = document.getElementById("crsh-canvas");
  const historyList = document.getElementById("crsh-history-list");
  const trainBtn = document.getElementById("crsh-train-btn");
  
  let flightEngine = null;
  let isFlying = false;
  let betAmount = 10.0;
  let autoCash = 2.0;
  let sessionProfit = 0.0;
  let pastCrashValues = [2.4, 1.15, 4.2, 1.8, 1.08, 3.5, 9.2, 1.4, 2.1, 1.5]; // mock initial history
  let hasCashedOutCurrentRound = false;
  let currentMultiplierVal = 1.00;
  let crashChart = null;

  if (!startBtn) return;

  flightEngine = new CrashEngine.Renderer(canvas);

  function startRound() {
    if (isFlying) return;
    
    playSound('shuffle');
    
    betAmount = parseFloat(betInput.value) || 10.0;
    autoCash = parseFloat(autoCashInput.value) || 2.0;
    
    isFlying = true;
    hasCashedOutCurrentRound = false;
    currentMultiplierVal = 1.00;
    
    startBtn.textContent = "FLYING...";
    startBtn.disabled = true;
    cashoutBtn.disabled = false;
    
    // Determine random crash point
    const crashOutcome = CrashEngine.roll();
    
    // Configure gauge
    const prob = CrashEngine.getProb(autoCash);
    setProgressRing("crsh-gauge-fill", "crsh-prob-val", Math.round(prob));

    flightEngine.start(
      crashOutcome,
      (currentMult) => {
        // Update live multiplier
        currentMultiplierVal = currentMult;
        
        // Auto cashout check
        if (currentMult >= autoCash && !hasCashedOutCurrentRound) {
          cashOut(autoCash);
        }
      },
      (crashedPoint) => {
        // Crashed
        isFlying = false;
        startBtn.textContent = "Start Rocket";
        startBtn.disabled = false;
        cashoutBtn.disabled = true;
        
        if (window.SattaAIPredictor) {
          window.SattaAIPredictor.learnCrash(pastCrashValues, crashedPoint);
        }
        pastCrashValues.push(crashedPoint);
        if (pastCrashValues.length > 30) pastCrashValues.shift();
        
        // Record to ledger
        const record = document.createElement("div");
        record.className = "step-card";
        
        if (hasCashedOutCurrentRound) {
          record.innerHTML = `
            <div class="step-number" style="color:var(--emerald); border-color:var(--emerald)">✓</div>
            <div class="step-content">
              <div class="step-title text-emerald">Won at Cashout</div>
              <div class="step-desc">Flew to ${crashedPoint.toFixed(2)}x | Auto: ${autoCash.toFixed(2)}x | Profit: +$${(betAmount * (autoCash - 1)).toFixed(2)}</div>
            </div>
          `;
        } else {
          playSound('loss');
          sessionProfit -= betAmount;
          
          record.innerHTML = `
            <div class="step-number" style="color:var(--crimson); border-color:var(--crimson)">✗</div>
            <div class="step-content">
              <div class="step-title text-crimson">Crashed at ${crashedPoint.toFixed(2)}x</div>
              <div class="step-desc">Wagered: $${betAmount.toFixed(2)} | Loss: -$${betAmount.toFixed(2)}</div>
            </div>
          `;
        }
        historyList.insertBefore(record, historyList.firstChild);
        
        // Update Markov Predictor
        resolveMarkovPrediction();
      }
    );
  }

  function cashOut(targetMultiplier = null) {
    if (!isFlying || hasCashedOutCurrentRound) return;
    
    hasCashedOutCurrentRound = true;
    playSound('win');
    
    const mult = targetMultiplier || currentMultiplierVal;
    const profit = betAmount * (mult - 1);
    sessionProfit += profit;
    
    cashoutBtn.disabled = true;
    
    document.getElementById("crsh-advice-choice").textContent = "CASHED OUT";
    document.getElementById("crsh-advice-choice").className = "advisor-choice text-emerald";
    document.getElementById("crsh-advice-explanation").textContent = `Secured profit of $${profit.toFixed(2)} at ${mult.toFixed(2)}x!`;
  }

  function resolveMarkovPrediction() {
    const analysis = CrashEngine.predict(pastCrashValues);
    
    document.getElementById("crsh-advice-choice").textContent = analysis.riskLevel;
    document.getElementById("crsh-advice-choice").style.color = analysis.color;
    document.getElementById("crsh-advice-explanation").textContent = `State: ${analysis.currentState}. Rec Cashout: ${analysis.recCashout.toFixed(2)}x.`;
    
    // Update probability Matrix rows
    document.getElementById("crsh-prob-bust").textContent = analysis.probabilities[0] + "%";
    document.getElementById("crsh-prob-low").textContent = analysis.probabilities[1] + "%";
    document.getElementById("crsh-prob-medium").textContent = analysis.probabilities[2] + "%";
    document.getElementById("crsh-prob-high").textContent = analysis.probabilities[3] + "%";

    // Update wager advisor
    if (analysis.riskLevel === 'LOW') {
      updateBetAdvisor('crsh', 'increase', 'Markov Safe Multiplier Cycle');
    } else if (analysis.riskLevel === 'HIGH') {
      updateBetAdvisor('crsh', 'decrease', 'Elevated Multiplier Crash Risk');
    } else {
      updateBetAdvisor('crsh', 'normal', 'Markov Stable Risk Cycle');
    }
  }

  trainBtn.addEventListener("click", () => {
    playSound('click');
    const autoCashVal = parseFloat(autoCashInput.value) || 2.0;
    
    const trainResult = CrashEngine.train(autoCashVal, 1000, betAmount, 5000);
    
    document.getElementById("crsh-train-results").style.display = 'block';
    document.getElementById("crsh-opt-mult").textContent = trainResult.autoMultiplier.toFixed(2) + "x";
    document.getElementById("crsh-opt-winrate").textContent = trainResult.winRate.toFixed(1);
    document.getElementById("crsh-opt-profit").textContent = (trainResult.profit >= 0 ? '+$' : '-$') + Math.abs(trainResult.profit).toFixed(2);
    document.getElementById("crsh-opt-profit").className = trainResult.profit >= 0 ? "text-emerald" : "text-danger";
    
    // Draw chart
    document.getElementById("crsh-chart-card").style.display = 'block';
    const chartCtx = document.getElementById("crsh-simulation-chart").getContext('2d');
    
    if (crashChart) crashChart.destroy();
    
    const labels = trainResult.history.map((_, i) => `R${i * 250}`);
    const gradient = chartCtx.createLinearGradient(0, 0, 0, 150);
    gradient.addColorStop(0, 'rgba(6, 182, 212, 0.4)');
    gradient.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

    crashChart = new Chart(chartCtx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: `Simulated Balance over 5,000 Rounds (Auto @ ${autoCashVal.toFixed(2)}x)`,
          data: trainResult.history,
          borderColor: '#06b6d4',
          backgroundColor: gradient,
          fill: true,
          tension: 0.3,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: 'rgba(255, 255, 255, 0.03)' }, ticks: { color: '#64748b' } },
          y: { grid: { color: 'rgba(255, 255, 255, 0.03)' }, ticks: { color: '#64748b' } }
        },
        plugins: { legend: { labels: { color: '#94a3b8' } } }
      }
    });
  });

  startBtn.addEventListener("click", startRound);
  cashoutBtn.addEventListener("click", () => cashOut());

  // Render initial predictions
  resolveMarkovPrediction();
}

// ═══════════════════════════════════════════════════════════════════════════
// KELLY CRITERION & BANKROLL SIMULATOR CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════
function initBankroll() {
  const bankrollInput = document.getElementById("bk-bankroll");
  const winProbInput = document.getElementById("bk-win-prob");
  const oddsInput = document.getElementById("bk-odds");
  const fractionSelect = document.getElementById("bk-fraction");
  const tpInput = document.getElementById("bk-take-profit");
  const slInput = document.getElementById("bk-stop-loss");
  const betsInput = document.getElementById("bk-num-bets");
  const simsInput = document.getElementById("bk-num-sims");
  const runBtn = document.getElementById("bk-run-sim-btn");
  const presetBtns = document.querySelectorAll(".bk-preset-btn");

  if (!bankrollInput || !runBtn) return;

  function runSimulation() {
    playSound('shuffle');
    const bankroll = parseFloat(bankrollInput.value) || 1000;
    const prob = (parseFloat(winProbInput.value) || 50) / 100;
    const decimalOdds = parseFloat(oddsInput.value) || 2.0;
    const fraction = parseFloat(fractionSelect.value) || 0.5;
    const takeProfit = parseFloat(tpInput.value) || 2000;
    const stopLoss = parseFloat(slInput.value) || 0;
    const numBets = parseInt(betsInput.value) || 120;
    const numSims = parseInt(simsInput.value) || 500;

    // Kelly calculation
    const kelly = window.SattaBankroll.calculateKelly(prob, decimalOdds, fraction);
    const stakeAmt = bankroll * kelly.recommendedFraction;

    const stakeEl = document.getElementById("bk-res-stake");
    const stakePctEl = document.getElementById("bk-res-stake-pct");
    const evEl = document.getElementById("bk-res-ev");
    const evBadge = document.getElementById("bk-res-ev-badge");

    if (stakeEl) stakeEl.textContent = '$' + stakeAmt.toFixed(2);
    if (stakePctEl) stakePctEl.textContent = (kelly.recommendedFraction * 100).toFixed(2) + '% of Bankroll';

    if (evEl) {
      evEl.textContent = (kelly.ev >= 0 ? '+' : '') + (kelly.ev * 100).toFixed(2) + '%';
      evEl.className = kelly.ev >= 0 ? 'text-emerald' : 'text-crimson';
    }

    if (evBadge) {
      evBadge.textContent = kelly.isPositiveEV ? 'POSITIVE EV' : 'NEGATIVE EV';
      evBadge.style.color = kelly.isPositiveEV ? '#10b981' : '#f43f5e';
      evBadge.style.borderColor = kelly.isPositiveEV ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)';
    }

    // Run Monte Carlo
    const simRes = window.SattaBankroll.runMonteCarlo({
      initialBankroll: bankroll,
      prob,
      decimalOdds,
      betFraction: Math.max(0.005, kelly.recommendedFraction),
      numBets,
      numSims,
      takeProfit,
      stopLoss
    });

    const rorEl = document.getElementById("bk-res-ror");
    const tpRateEl = document.getElementById("bk-res-tp-rate");
    const medianEl = document.getElementById("bk-res-median");
    const p10El = document.getElementById("bk-res-p10");
    const p90El = document.getElementById("bk-res-p90");
    const ddEl = document.getElementById("bk-res-drawdown");

    if (rorEl) rorEl.textContent = simRes.empiricalRoR.toFixed(1) + '%';
    if (tpRateEl) tpRateEl.textContent = simRes.empiricalTakeProfit.toFixed(1) + '%';
    if (medianEl) medianEl.textContent = '$' + Math.round(simRes.medianFinal).toLocaleString();
    if (p10El) p10El.textContent = '$' + Math.round(simRes.p10).toLocaleString();
    if (p90El) p90El.textContent = '$' + Math.round(simRes.p90).toLocaleString();
    if (ddEl) ddEl.textContent = simRes.avgMaxDrawdown.toFixed(1) + '%';

    // Draw canvas
    window.SattaBankroll.drawSimulationCanvas("bankroll-sim-canvas", simRes);
  }

  runBtn.addEventListener("click", runSimulation);

  presetBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      playSound('click');
      const p = btn.getAttribute("data-prob");
      const o = btn.getAttribute("data-odds");
      const f = btn.getAttribute("data-fraction");
      if (p) winProbInput.value = p;
      if (o) oddsInput.value = o;
      if (f) fractionSelect.value = f;
      runSimulation();
    });
  });

  // Run initial simulation
  runSimulation();
}

function updateBankrollEngine() {
  const lastRes = window.SattaBankroll ? window.SattaBankroll.getLastResult() : null;
  if (lastRes) {
    window.SattaBankroll.drawSimulationCanvas("bankroll-sim-canvas", lastRes);
  } else {
    const btn = document.getElementById("bk-run-sim-btn");
    if (btn) btn.click();
  }
}


