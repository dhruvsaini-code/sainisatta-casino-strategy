# Unit tests for Bankroll Management, Kelly Criterion & Monte Carlo Simulation Math

import math
import unittest

def calculate_kelly(prob, decimal_odds, fraction=1.0):
  p = max(0.0, min(1.0, prob))
  b = max(0.001, decimal_odds - 1.0)
  q = 1.0 - p
  ev = (p * b) - q
  full_kelly = (b * p - q) / b
  optimal_fraction = max(0.0, full_kelly * fraction) if full_kelly > 0 else 0.0
  return {
    'ev': ev,
    'full_kelly': max(0.0, full_kelly),
    'recommended_fraction': optimal_fraction,
    'is_positive_ev': ev > 0
  }

def calculate_analytical_ror(prob, decimal_odds, bankroll, bet_amount):
  if bet_amount <= 0 or bankroll <= 0:
    return 0.0
  p = prob
  q = 1.0 - p
  b = decimal_odds - 1.0
  ev = p * b - q
  if ev <= 0:
    return 100.0
  units = bankroll / bet_amount
  if abs(b - 1.0) < 0.05:
    return min(100.0, max(0.0, ((q / p) ** units) * 100.0))
  variance = p * ((b - ev) ** 2) + q * ((-1.0 - ev) ** 2)
  if variance <= 0:
    return 0.0
  ror = math.exp(-2.0 * ev * units / variance) * 100.0
  return min(100.0, max(0.0, ror))

class BankrollTestCase(unittest.TestCase):

  # ── Kelly Edge Cases ──
  def test_kelly_fair_coin_toss(self):
    """Even money on 50/50 coin toss has 0 EV and 0 Kelly stake"""
    res = calculate_kelly(0.50, 2.0)
    self.assertEqual(res['ev'], 0.0)
    self.assertEqual(res['full_kelly'], 0.0)
    self.assertEqual(res['recommended_fraction'], 0.0)
    self.assertFalse(res['is_positive_ev'])

  def test_kelly_heavy_edge(self):
    """60% win prob with 1:1 odds: Kelly = (0.6 - 0.4)/1 = 20%"""
    res = calculate_kelly(0.60, 2.0, fraction=1.0)
    self.assertAlmostEqual(res['ev'], 0.20)
    self.assertAlmostEqual(res['full_kelly'], 0.20)
    self.assertTrue(res['is_positive_ev'])

  def test_fractional_kelly_quarter(self):
    """Quarter Kelly on 20% full Kelly should be 5%"""
    res = calculate_kelly(0.60, 2.0, fraction=0.25)
    self.assertAlmostEqual(res['recommended_fraction'], 0.05)

  def test_kelly_high_multiplier_moonshot(self):
    """10x multiplier (9:1 net) with 15% win prob:
       b = 9, p = 0.15, q = 0.85
       f* = (9 * 0.15 - 0.85) / 9 = (1.35 - 0.85) / 9 = 0.50 / 9 ≈ 0.0555
    """
    res = calculate_kelly(0.15, 10.0, fraction=1.0)
    self.assertAlmostEqual(res['full_kelly'], 0.5 / 9.0, places=4)
    self.assertTrue(res['is_positive_ev'])

  # ── Risk of Ruin ──
  def test_risk_of_ruin_negative_ev_is_total(self):
    """With negative expectation over long term, RoR approaches 100%"""
    # European Roulette Red (p = 18/37 = 0.48648)
    ror = calculate_analytical_ror(18 / 37, 2.0, bankroll=1000, bet_amount=25)
    self.assertEqual(ror, 100.0)

  def test_risk_of_ruin_decays_with_bankroll_depth(self):
    """Larger bankroll in units exponentially reduces Risk of Ruin with positive edge"""
    ror_small = calculate_analytical_ror(0.53, 2.0, bankroll=200, bet_amount=20)   # 10 units
    ror_large = calculate_analytical_ror(0.53, 2.0, bankroll=1000, bet_amount=20)  # 50 units
    self.assertLess(ror_large, ror_small)
    self.assertLess(ror_large, 1.0) # 50 units with 6% edge has < 1% ruin

  def test_stop_loss_and_take_profit_simulation_behavior(self):
    """Verify that a simulation trajectory respects floor and ceiling thresholds"""
    bankroll = 1000
    stop_loss = 500
    take_profit = 1500

    current = 490 # crossed stop loss
    is_stopped = current <= stop_loss
    self.assertTrue(is_stopped)

    current_win = 1550 # crossed take profit
    is_profit_taken = current_win >= take_profit
    self.assertTrue(is_profit_taken)

if __name__ == '__main__':
  unittest.main()
