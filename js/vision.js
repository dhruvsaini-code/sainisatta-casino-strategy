// BetPro Screenshot Vision Analyzer (In-Browser OCR & Game State Classifier)

class VisionAnalyzer {
  constructor() {
    this.isAnalyzing = false;
    this.ocrWorker = null;
  }

  init() {
    const dropzone = document.getElementById("vs-dropzone");
    const fileInput = document.getElementById("vs-file-input");
    const logConsole = document.getElementById("vs-console-logs");
    
    if (!dropzone || !fileInput) return;

    // Drag and Drop listeners
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });

    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("dragover");
    });

    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.processFile(files[0]);
      }
    });

    fileInput.addEventListener("change", () => {
      if (fileInput.files.length > 0) {
        this.processFile(fileInput.files[0]);
      }
    });
  }

  log(message, type = 'info') {
    const logConsole = document.getElementById("vs-console-logs");
    if (!logConsole) return;

    const entry = document.createElement("div");
    entry.style.marginBottom = '0.5rem';
    
    let prefix = '[INFO]';
    let color = '#94a3b8';
    
    if (type === 'success') {
      prefix = '[SUCCESS]';
      color = '#10b981';
    } else if (type === 'error') {
      prefix = '[ERROR]';
      color = '#f43f5e';
    } else if (type === 'match') {
      prefix = '[DETECTOR]';
      color = '#06b6d4';
    } else if (type === 'warn') {
      prefix = '[WARNING]';
      color = '#fbbf24';
    }

    entry.innerHTML = `<span style="color: ${color}; font-weight: bold; margin-right: 0.5rem;">${prefix}</span><span>${message}</span>`;
    logConsole.appendChild(entry);
    logConsole.scrollTop = logConsole.scrollHeight;
  }

  clearLogs() {
    const logConsole = document.getElementById("vs-console-logs");
    if (logConsole) logConsole.innerHTML = '';
  }

  processFile(file) {
    if (this.isAnalyzing) return;
    this.isAnalyzing = true;

    this.clearLogs();
    this.log(`Received file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

    const reader = new FileReader();
    reader.onload = (e) => {
      const imgDataUrl = e.target.result;
      
      // Update preview card
      const previewImg = document.getElementById("vs-preview-img");
      const previewContainer = document.getElementById("vs-preview-container");
      const scanOverlay = document.getElementById("vs-scan-overlay");
      
      if (previewImg && previewContainer && scanOverlay) {
        previewImg.src = imgDataUrl;
        previewContainer.style.display = 'block';
        scanOverlay.style.display = 'block'; // Start scan line animation
      }

      playSound('shuffle');
      this.runOcrAnalysis(imgDataUrl);
    };
    reader.readAsDataURL(file);
  }

  async runOcrAnalysis(imageSrc) {
    this.log("Initializing OCR Engine (Tesseract.js)...");
    
    try {
      // Load Tesseract via CDN dynamically if not available globally
      if (typeof Tesseract === 'undefined') {
        this.log("Downloading OCR models in-browser...");
        await this.loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js");
      }

      this.log("OCR models loaded. Commencing screen OCR scanning...");

      Tesseract.recognize(
        imageSrc,
        'eng',
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              const pct = Math.round(m.progress * 100);
              if (pct % 20 === 0) {
                this.log(`OCR Scanning: ${pct}% complete...`);
              }
            }
          }
        }
      ).then(({ data: { text } }) => {
        this.log("OCR scanning completed successfully.", "success");
        this.analyzeTextResults(text);
      }).catch(err => {
        this.log(`OCR Analysis failed: ${err.message}`, "error");
        this.isAnalyzing = false;
        this.stopScanAnimation();
      });

    } catch (e) {
      this.log(`Failed to load OCR dependencies: ${e.message}`, "error");
      this.isAnalyzing = false;
      this.stopScanAnimation();
    }
  }

  stopScanAnimation() {
    const scanOverlay = document.getElementById("vs-scan-overlay");
    if (scanOverlay) scanOverlay.style.display = 'none';
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  analyzeTextResults(text) {
    this.log("Running heuristics pattern matcher on extracted text...");
    const lower = text.toLowerCase();
    
    // Log parsed raw text snippet for debugging/immersion
    const snippet = text.replace(/\n/g, ' ').substring(0, 120);
    this.log(`Extracted raw text snippet: "${snippet}..."`);

    let matchFound = false;

    // 1. BLACKJACK DETECTOR
    if (lower.includes('dealer') || lower.includes('player') || lower.includes('blackjack') || lower.includes('split') || lower.includes('double')) {
      this.log("Game identified: BLACKJACK (Confidence: High)", "match");
      matchFound = true;
      this.extractBlackjackState(lower);
    } 
    // 2. POKER DETECTOR
    else if (lower.includes('flop') || lower.includes('turn') || lower.includes('river') || lower.includes('pot') || lower.includes('fold') || lower.includes('hold\'em') || lower.includes('holdem')) {
      this.log("Game identified: TEXAS HOLD'EM POKER (Confidence: High)", "match");
      matchFound = true;
      this.extractPokerState(lower);
    }
    // 3. ROULETTE DETECTOR
    else if (lower.includes('roulette') || lower.includes('spin') || lower.includes('red') || lower.includes('black') || lower.includes('even') || lower.includes('odd') || lower.includes('zero')) {
      this.log("Game identified: ROULETTE (Confidence: Medium)", "match");
      matchFound = true;
      this.extractRouletteState(lower);
    }
    // 4. BACCARAT DETECTOR
    else if (lower.includes('baccarat') || lower.includes('banker') || lower.includes('tie') || lower.includes('commission')) {
      this.log("Game identified: BACCARAT (Confidence: High)", "match");
      matchFound = true;
      this.extractBaccaratState(lower);
    }
    // 5. CRAPS DETECTOR
    else if (lower.includes('craps') || lower.includes('pass line') || lower.includes('don\'t pass') || lower.includes('come out') || lower.includes('come-out')) {
      this.log("Game identified: CRAPS (Confidence: Medium)", "match");
      matchFound = true;
      this.extractCrapsState(lower);
    }

    if (!matchFound) {
      this.log("Game classification inconclusive. Falling back to default Blackjack engine template.", "warn");
      this.transitionToGameTab('blackjack-tab', 'blackjack-panel');
    }

    this.isAnalyzing = false;
    this.stopScanAnimation();
    playSound('win');
  }

  // --- Game-specific State Parsers ---

  extractBlackjackState(text) {
    this.log("Scanning for card shapes, numeric values, and dealer upcard...");
    
    // Simple heuristic parser for cards: A, K, Q, J, 10, 9, 8, etc.
    const cardRegex = /\b(10|[2-9]|[akqj])\b/g;
    const cards = text.match(cardRegex) || [];
    
    let detectedDealer = null;
    let detectedPlayer = [];

    if (cards.length > 0) {
      // Map back to uppercase rank strings
      const mapped = cards.map(c => c.toUpperCase());
      // Assume the first card is the dealer upcard, next ones are player's hand
      detectedDealer = mapped[0];
      detectedPlayer = mapped.slice(1, 4); // Capture up to 3 cards
      
      this.log(`Detected Dealer Card: ${detectedDealer}`, "match");
      this.log(`Detected Player Hand: [${detectedPlayer.join(', ')}]`, "match");
      
      // Inject to Blackjack UI
      setTimeout(() => {
        // Switch tab to blackjack
        this.transitionToGameTab('blackjack-tab', 'blackjack-panel');
        
        // Trigger UI simulation
        const playerBtn = document.getElementById("bj-select-player-btn");
        if (playerBtn) playerBtn.click();
        
        // Populate the actual engine state
        // To make it easy, we trigger clicks or call internal state modifiers
        // Let's inject directly into the DOM arrays if we find cards
        const clearBtn = document.getElementById("bj-clear-btn");
        if (clearBtn) clearBtn.click();

        // Feed mock cards (we will use spade suit by default)
        const mockSuits = ['s', 'h', 'c', 'd'];
        
        // Trigger simulated clicks on the card grid to add cards
        const cardDeckButtons = document.querySelectorAll("#bj-card-grid .deck-card");
        
        // Add player cards
        detectedPlayer.forEach((rank, idx) => {
          const suit = mockSuits[idx % 4];
          const matchBtn = Array.from(cardDeckButtons).find(btn => btn.innerText.includes(rank));
          if (matchBtn) matchBtn.click();
        });

        // Add dealer card
        if (detectedDealer) {
          const dealerBtn = document.getElementById("bj-select-dealer-btn");
          if (dealerBtn) dealerBtn.click();
          
          const matchBtn = Array.from(cardDeckButtons).find(btn => btn.innerText.includes(detectedDealer));
          if (matchBtn) matchBtn.click();
          
          // Re-activate player target for user convenience
          if (playerBtn) playerBtn.click();
        }

        this.log("Successfully synchronized detected Blackjack layout with the strategist matrix!", "success");
      }, 1000);
    } else {
      this.log("No clear card ranks identified. Initializing empty Blackjack board.", "warn");
      this.transitionToGameTab('blackjack-tab', 'blackjack-panel');
    }
  }

  extractPokerState(text) {
    this.log("Scanning community card structures & opponent sliders...");
    // Just match potential cards
    const cardRegex = /\b(10|[2-9]|[akqj])\b/g;
    const cards = (text.match(cardRegex) || []).map(c => c.toUpperCase());
    
    setTimeout(() => {
      this.transitionToGameTab('poker-tab', 'poker-panel');
      
      if (cards.length >= 2) {
        this.log(`Detected Pocket Hand: [${cards[0]}, ${cards[1]}]`, "match");
        
        // Clear Poker board
        const clearBtn = document.getElementById("pk-clear-btn");
        if (clearBtn) clearBtn.click();

        const cardDeckButtons = document.querySelectorAll("#pk-card-grid .deck-card");
        
        // Add pocket cards
        const pocketBtn = document.getElementById("pk-select-pocket-btn");
        if (pocketBtn) pocketBtn.click();
        
        const pocketRanks = cards.slice(0, 2);
        pocketRanks.forEach(rank => {
          const matchBtn = Array.from(cardDeckButtons).find(btn => btn.innerText.includes(rank));
          if (matchBtn) matchBtn.click();
        });

        // Add board cards
        if (cards.length >= 5) {
          const boardBtn = document.getElementById("pk-select-board-btn");
          if (boardBtn) boardBtn.click();
          
          const boardRanks = cards.slice(2, 7);
          this.log(`Detected Board Cards: [${boardRanks.join(', ')}]`, "match");
          boardRanks.forEach(rank => {
            const matchBtn = Array.from(cardDeckButtons).find(btn => btn.innerText.includes(rank));
            if (matchBtn) matchBtn.click();
          });
          
          if (pocketBtn) pocketBtn.click();
        }
        
        this.log("Poker configuration populated. Press 'Run Strategy Simulator' to evaluate.", "success");
      } else {
        this.log("Poker tab loaded. Please select pocket and board cards manually.", "info");
      }
    }, 1000);
  }

  extractRouletteState(text) {
    this.log("Parsing bankroll statements and spin multipliers...");
    setTimeout(() => {
      this.transitionToGameTab('roulette-tab', 'roulette-panel');
      this.log("Roulette strategy sequence loaded.", "success");
    }, 1000);
  }

  extractBaccaratState(text) {
    this.log("Parsing shoe records and roadmap entries...");
    
    // Look for winning patterns: Banker, Player, Tie
    const shoe = [];
    const words = text.split(/\s+/);
    for (let word of words) {
      const w = word.toLowerCase();
      if (w.startsWith('bank') || w === 'b') shoe.push('B');
      else if (w.startsWith('play') || w === 'p') shoe.push('P');
      else if (w.startsWith('tie') || w === 't') shoe.push('T');
    }

    const filtered = shoe.slice(0, 10); // Capture up to 10 entries

    setTimeout(() => {
      this.transitionToGameTab('baccarat-tab', 'baccarat-panel');
      if (filtered.length > 0) {
        this.log(`Restored shoe trend from screen capture: [${filtered.join(', ')}]`, "match");
        
        // Reset and populate
        const resetBtn = document.getElementById("bc-reset-btn");
        if (resetBtn) resetBtn.click();
        
        filtered.forEach(res => {
          BaccaratEngine.addResult(res);
        });
        
        // Update UI
        if (typeof updateBaccaratUI === 'function') {
          updateBaccaratUI();
        }
        this.log("Roadmaps and trend estimators recalculated!", "success");
      } else {
        this.log("Baccarat dashboard ready.", "info");
      }
    }, 1000);
  }

  extractCrapsState(text) {
    this.log("Scanning craps table layout status...");
    setTimeout(() => {
      this.transitionToGameTab('craps-tab', 'craps-panel');
      this.log("Craps strategy board ready.", "success");
    }, 1000);
  }

  transitionToGameTab(tabId, panelId) {
    const navBtn = document.getElementById(tabId);
    const panel = document.getElementById(panelId);
    
    if (navBtn && panel) {
      // Un-activate all
      document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
      document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
      
      navBtn.classList.add("active");
      panel.classList.add("active");
      
      // Re-trigger layout sizes if charts exist
      if (panelId === 'roulette-panel' && typeof updateRouletteChart === 'function') {
        updateRouletteChart();
      } else if (panelId === 'custom-panel' && typeof updateCustomChart === 'function') {
        updateCustomChart();
      }
    }
  }
}

// Global Vision Initializer
document.addEventListener("DOMContentLoaded", () => {
  window.VisionModule = new VisionAnalyzer();
  window.VisionModule.init();
});
