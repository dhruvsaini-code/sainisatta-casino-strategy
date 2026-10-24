# Unit tests for gambling strategy mathematics and algorithms

import math
import unittest

class MathEnginesTestCase(unittest.TestCase):
  
  # ── Kelly Criterion Math ──
  def test_kelly_criterion_positive_ev(self):
    """Kelly formula: f* = (b*p - q) / b"""
    p = 0.52   # 52% win rate
    b = 1.0    # 1:1 payout (even money)
    q = 1.0 - p  # 48% loss
    
    full_kelly = (b * p - q) / b
    self.assertAlmostEqual(full_kelly, 0.04, places=4) # 4% bankroll
    
    half_kelly = full_kelly * 0.5
    self.assertAlmostEqual(half_kelly, 0.02, places=4) # 2% bankroll

  def test_kelly_criterion_negative_ev(self):
    """Negative EV should produce f* <= 0 (Optimal wager is 0)"""
    p = 18 / 37  # European roulette red/black (~48.65%)
    b = 1.0      # 1:1 payout
    q = 1.0 - p
    
    ev = (p * b) - q
    full_kelly = (b * p - q) / b
    
    self.assertLess(ev, 0)
    self.assertLess(full_kelly, 0)

  # ── Hi-Lo Card Counting ──
  def test_blackjack_hilo_weights(self):
    """Hi-Lo: 2-6 = +1, 7-9 = 0, 10-A = -1"""
    hilo_weights = {
      '2': 1, '3': 1, '4': 1, '5': 1, '6': 1,
      '7': 0, '8': 0, '9': 0,
      '10': -1, 'J': -1, 'Q': -1, 'K': -1, 'A': -1
    }
    # Sum of an entire 52-card standard deck must equal exactly 0
    full_deck_count = sum([hilo_weights[rank] * 4 for rank in hilo_weights])
    self.assertEqual(full_deck_count, 0)

  def test_true_count_conversion(self):
    """True Count = Running Count / Decks Remaining"""
    running_count = 8
    decks_remaining = 2.0
    true_count = running_count / decks_remaining
    self.assertEqual(true_count, 4.0)

  # ── Progression Sequences (Martingale & Fibonacci) ──
  def test_martingale_doubling(self):
    """Martingale multiplies wager by 2 on each consecutive loss"""
    base_bet = 10
    streak_losses = 4
    wagers = [base_bet * (2 ** i) for i in range(streak_losses + 1)]
    self.assertEqual(wagers, [10, 20, 40, 80, 160])
    
    # Net profit upon winning on 5th bet: 160 - (10 + 20 + 40 + 80) = +10 (base bet)
    net_profit = wagers[-1] - sum(wagers[:-1])
    self.assertEqual(net_profit, base_bet)

  def test_fibonacci_progression(self):
    """Fibonacci: advance 1 step on loss, retreat 2 steps on win"""
    fib = [1, 1, 2, 3, 5, 8, 13, 21, 34]
    for i in range(2, len(fib)):
      self.assertEqual(fib[i], fib[i - 1] + fib[i - 2])

  # ── Limbo Provably Fair Math ──
  def test_limbo_win_probability(self):
    """Limbo win prob: 99 / targetMultiplier (1% house edge)"""
    target = 2.0
    win_prob = 99.0 / target
    self.assertEqual(win_prob, 49.5)

    moonshot_target = 10.0
    moonshot_prob = 99.0 / moonshot_target
    self.assertEqual(moonshot_prob, 9.9)

  # ── Craps True Odds ──
  def test_craps_point_odds(self):
    """True mathematically fair odds for points in Craps:
       Points 4 & 10: 2 to 1 (6:3 ways)
       Points 5 & 9:  3 to 2 (6:4 ways)
       Points 6 & 8:  6 to 5 (6:5 ways)
    """
    ways_to_roll_7 = 6
    ways = {4: 3, 10: 3, 5: 4, 9: 4, 6: 5, 8: 5}
    
    odds_4 = ways_to_roll_7 / ways[4]
    self.assertEqual(odds_4, 2.0) # 2:1
    
    odds_5 = ways_to_roll_7 / ways[5]
    self.assertEqual(odds_5, 1.5) # 3:2
    
    odds_6 = ways_to_roll_7 / ways[6]
    self.assertEqual(odds_6, 1.2) # 6:5

if __name__ == '__main__':
  unittest.main()
