// ═══════════════════════════════════════════════════════════════════════════
// SAINISATTA BANKROLL & KELLY CRITERION SIMULATION ENGINE
// Mathematical Edge, Kelly Staking, Risk of Ruin & Monte Carlo Trajectories
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

window.SattaBankroll = (function () {
  let lastSimResult = null;

  /**
   * Kelly Criterion Formula:
   * f* = (b * p - q) / b
   * where:
   *   b = net payout odds (decimalOdds - 1)
   *   p = probability of winning (0 to 1)
   *   q = probability of losing (1 - p)
   */
  function calculateKelly(prob, decimalOdds, fraction = 1.0) {
    const p = Math.max(0, Math.min(1, prob));
    const b = Math.max(0.001, decimalOdds - 1);
    const q = 1 - p;

    // Expected Value per 1 unit wagered
    const ev = (p * b) - q;

    // Full Kelly fraction
    const fullKelly = (b * p - q) / b;

    // Constrained Kelly
    const optimalFraction = fullKelly > 0 ? fullKelly * fraction : 0;

    return {
      ev,
      fullKelly: Math.max(0, fullKelly),
      recommendedFraction: Math.max(0, optimalFraction),
      isPositiveEV: ev > 0,
      edgePercent: ev * 100
    };
  }

  /**
   * Analytical Risk of Ruin formula approximation:
   * RoR = ((1 - A) / (1 + A))^B where A = edge/variance ratio
   */
  function calculateAnalyticalRoR(prob, decimalOdds, bankroll, betAmount) {
    if (betAmount <= 0 || bankroll <= 0) return 0;
    const p = prob;
    const q = 1 - p;
    const b = decimalOdds - 1;
    const ev = p * b - q;

    if (ev <= 0) {
      // In negative EV with infinite bets, RoR is 100%
      return 100;
    }

    const units = bankroll / betAmount;
    // For even money (b = 1): RoR = (q / p)^units
    if (Math.abs(b - 1) < 0.05) {
      const r = Math.pow(q / p, units);
      return Math.min(100, Math.max(0, r * 100));
    }

    // Generalized continuous diffusion approximation: exp(-2 * mu * units / sigma^2)
    const variance = p * Math.pow(b - ev, 2) + q * Math.pow(-1 - ev, 2);
    if (variance <= 0) return 0;
    const ror = Math.exp(-2 * ev * units / variance);
    return Math.min(100, Math.max(0, ror * 100));
  }

  /**
   * Monte Carlo Bankroll Simulator
   * Simulates multiple path trajectories of sequential betting
   */
  function runMonteCarlo({
    initialBankroll = 1000,
    prob = 0.515,
    decimalOdds = 2.0,
    betFraction = 0.02,
    numBets = 150,
    numSims = 500,
    takeProfit = 2000,
    stopLoss = 0
  }) {
    const p = Math.max(0.001, Math.min(0.999, prob));
    const b = Math.max(0.01, decimalOdds - 1);
    const simsToRecord = Math.min(25, numSims);
    const samplePaths = [];

    let ruinedCount = 0;
    let takeProfitCount = 0;
    const finalBankrolls = [];
    let totalMaxDrawdown = 0;

    // Track distributions at each step for confidence bands
    const stepMatrix = Array.from({ length: numBets + 1 }, () => []);

    for (let s = 0; s < numSims; s++) {
      let current = initialBankroll;
      let peak = initialBankroll;
      let maxDrawdown = 0;
      let isRuined = false;
      let hitTarget = false;
      const path = [current];

      if (s < simsToRecord) {
        stepMatrix[0].push(current);
      }

      for (let step = 1; step <= numBets; step++) {
        if (current <= stopLoss || current <= 0) {
          isRuined = true;
          current = 0;
          path.push(0);
          if (s < simsToRecord) stepMatrix[step].push(0);
          continue;
        }

        if (current >= takeProfit) {
          hitTarget = true;
        }

        // Variable staking based on current bankroll percentage (Kelly style)
        const wager = Math.max(1, current * betFraction);
        const win = Math.random() < p;

        if (win) {
          current += wager * b;
        } else {
          current -= wager;
        }

        if (current > peak) peak = current;
        const dd = peak > 0 ? (peak - current) / peak : 0;
        if (dd > maxDrawdown) maxDrawdown = dd;

        path.push(Math.round(current * 100) / 100);
        if (s < simsToRecord) {
          stepMatrix[step].push(current);
        }
      }

      if (isRuined || current <= stopLoss) ruinedCount++;
      if (hitTarget || current >= takeProfit) takeProfitCount++;
      finalBankrolls.push(current);
      totalMaxDrawdown += maxDrawdown;

      if (s < simsToRecord) {
        samplePaths.push(path);
      }
    }

    finalBankrolls.sort((a, b) => a - b);
    const medianFinal = finalBankrolls[Math.floor(finalBankrolls.length * 0.5)];
    const p10 = finalBankrolls[Math.floor(finalBankrolls.length * 0.1)];
    const p90 = finalBankrolls[Math.floor(finalBankrolls.length * 0.9)];
    const avgMaxDrawdown = (totalMaxDrawdown / numSims) * 100;
    const empiricalRoR = (ruinedCount / numSims) * 100;
    const empiricalTakeProfit = (takeProfitCount / numSims) * 100;

    // Calculate median trajectory path across sample paths
    const medianTrajectory = [];
    for (let step = 0; step <= numBets; step++) {
      const vals = stepMatrix[step];
      if (vals && vals.length) {
        const sorted = [...vals].sort((a, b) => a - b);
        medianTrajectory.push(sorted[Math.floor(sorted.length * 0.5)]);
      } else {
        medianTrajectory.push(initialBankroll);
      }
    }

    lastSimResult = {
      initialBankroll,
      prob,
      decimalOdds,
      betFraction,
      numBets,
      numSims,
      takeProfit,
      stopLoss,
      samplePaths,
      medianTrajectory,
      medianFinal,
      p10,
      p90,
      empiricalRoR,
      empiricalTakeProfit,
      avgMaxDrawdown
    };

    return lastSimResult;
  }

  /**
   * Renders the simulation result into a high-performance Canvas element
   */
  function drawSimulationCanvas(canvasId, result) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#060a17');
    bgGrad.addColorStop(1, '#02040a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    if (!result || !result.samplePaths || !result.samplePaths.length) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Configure bankroll parameters and click Run Monte Carlo Simulation', width / 2, height / 2);
      return;
    }

    const padding = { top: 30, right: 35, bottom: 40, left: 65 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Find min and max across all sample paths
    let maxVal = result.takeProfit * 1.05;
    let minVal = 0;

    result.samplePaths.forEach(p => {
      p.forEach(v => {
        if (v > maxVal) maxVal = v * 1.08;
      });
    });

    if (maxVal <= result.initialBankroll) maxVal = result.initialBankroll * 2;

    const scaleX = (step) => padding.left + (step / result.numBets) * chartW;
    const scaleY = (val) => padding.top + chartH - ((val - minVal) / (maxVal - minVal)) * chartH;

    // Horizontal grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    const numGridLines = 5;
    for (let i = 0; i <= numGridLines; i++) {
      const val = minVal + (i / numGridLines) * (maxVal - minVal);
      const y = scaleY(val);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('$' + Math.round(val), padding.left - 8, y + 3);
    }

    // Vertical grid lines
    for (let step = 0; step <= result.numBets; step += Math.ceil(result.numBets / 5)) {
      const x = scaleX(step);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('B' + step, x, height - padding.bottom + 15);
    }

    // Take-Profit Target Line (Green dashed)
    if (result.takeProfit <= maxVal) {
      const tpY = scaleY(result.takeProfit);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padding.left, tpY);
      ctx.lineTo(width - padding.right, tpY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#10b981';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('Take Profit: $' + result.takeProfit, padding.left + 8, tpY - 4);
    }

    // Initial Bankroll Baseline (Purple dashed)
    const initY = scaleY(result.initialBankroll);
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, initY);
    ctx.lineTo(width - padding.right, initY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Sample Simulation Paths
    const colors = [
      'rgba(0, 242, 254, 0.25)',
      'rgba(168, 85, 247, 0.25)',
      'rgba(59, 130, 246, 0.22)',
      'rgba(236, 72, 153, 0.22)',
      'rgba(16, 185, 129, 0.25)'
    ];

    result.samplePaths.forEach((path, idx) => {
      ctx.strokeStyle = colors[idx % colors.length];
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      path.forEach((v, step) => {
        const x = scaleX(step);
        const y = scaleY(v);
        if (step === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    // Median Trajectory (Bright Cyan with neon glow)
    if (result.medianTrajectory && result.medianTrajectory.length) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 242, 254, 0.8)';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      result.medianTrajectory.forEach((v, step) => {
        const x = scaleX(step);
        const y = scaleY(v);
        if (step === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    }

    // Chart Title & Legend
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Monte Carlo Trajectories (Cyan: Median Path)', padding.left, 18);
  }

  return {
    calculateKelly,
    calculateAnalyticalRoR,
    runMonteCarlo,
    drawSimulationCanvas,
    getLastResult: () => lastSimResult
  };
})();
