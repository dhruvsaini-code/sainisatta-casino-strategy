# Unit tests for sainisatta Flask REST API Server

import os
import tempfile
import unittest
import json
import server

class ServerTestCase(unittest.TestCase):
  def setUp(self):
    # Set up isolated temporary SQLite database for testing
    self.db_fd, self.temp_db_path = tempfile.mkstemp()
    server.DATABASE = self.temp_db_path
    server.app.config['TESTING'] = True
    server.init_db()
    self.client = server.app.test_client()

  def tearDown(self):
    os.close(self.db_fd)
    if os.path.exists(self.temp_db_path):
      os.unlink(self.temp_db_path)

  # ── Health Check ──
  def test_health_check(self):
    res = self.client.get('/api/health')
    self.assertEqual(res.status_code, 200)
    data = res.get_json()
    self.assertEqual(data.get('status'), 'healthy')
    self.assertEqual(data.get('version'), '3.1.0')

  # ── Registration & Authentication ──
  def test_register_and_login_flow(self):
    # Register user
    reg_res = self.client.post('/api/register', json={
      'username': 'strategist',
      'password': 'superpassword123'
    })
    self.assertEqual(reg_res.status_code, 201)

    # Duplicate registration should fail
    dup_res = self.client.post('/api/register', json={
      'username': 'strategist',
      'password': 'superpassword123'
    })
    self.assertEqual(dup_res.status_code, 400)

    # Login with incorrect password
    bad_login = self.client.post('/api/login', json={
      'username': 'strategist',
      'password': 'wrongpassword'
    })
    self.assertEqual(bad_login.status_code, 401)

    # Login with correct password
    login_res = self.client.post('/api/login', json={
      'username': 'strategist',
      'password': 'superpassword123'
    })
    self.assertEqual(login_res.status_code, 200)
    self.assertEqual(login_res.get_json().get('username'), 'strategist')

    # Session verification
    sess_res = self.client.get('/api/session')
    self.assertEqual(sess_res.status_code, 200)
    self.assertTrue(sess_res.get_json().get('logged_in'))

    # Logout
    logout_res = self.client.post('/api/logout')
    self.assertEqual(logout_res.status_code, 200)

    # Post-logout session verification
    sess_after = self.client.get('/api/session')
    self.assertEqual(sess_after.status_code, 401)

  # ── Game Analytics Tracking ──
  def test_game_analytics_tracking(self):
    # Register and login
    self.client.post('/api/register', json={'username': 'player1', 'password': 'password123'})
    self.client.post('/api/login', json={'username': 'player1', 'password': 'password123'})

    # Track games
    self.client.post('/api/track', json={'game': 'blackjack'})
    self.client.post('/api/track', json={'game': 'blackjack'})
    self.client.post('/api/track', json={'game': 'mines'})

    # Retrieve analytics
    analytics_res = self.client.get('/api/analytics')
    self.assertEqual(analytics_res.status_code, 200)
    data = analytics_res.get_json()
    self.assertEqual(len(data), 2)
    # Blackjack should be top accessed with count = 2
    self.assertEqual(data[0]['game'], 'blackjack')
    self.assertEqual(data[0]['count'], 2)

  # ── Betting Sessions Recording ──
  def test_betting_sessions_crud(self):
    self.client.post('/api/register', json={'username': 'bettor', 'password': 'password123'})
    self.client.post('/api/login', json={'username': 'bettor', 'password': 'password123'})

    # Record winning session
    win_session = self.client.post('/api/sessions', json={
      'game_name': 'limbo',
      'starting_bankroll': 500.0,
      'ending_bankroll': 750.0,
      'total_bets': 45,
      'strategy_name': 'Martingale 2.0x'
    })
    self.assertEqual(win_session.status_code, 201)
    self.assertEqual(win_session.get_json().get('net_profit'), 250.0)

    # Record losing session
    lose_session = self.client.post('/api/sessions', json={
      'game_name': 'roulette',
      'starting_bankroll': 750.0,
      'ending_bankroll': 650.0,
      'total_bets': 20,
      'strategy_name': 'Fibonacci'
    })
    self.assertEqual(lose_session.status_code, 201)
    self.assertEqual(lose_session.get_json().get('net_profit'), -100.0)

    # Get sessions summary
    summary_res = self.client.get('/api/sessions')
    self.assertEqual(summary_res.status_code, 200)
    body = summary_res.get_json()
    self.assertEqual(body['summary']['total_sessions'], 2)
    self.assertEqual(body['summary']['total_profit'], 150.0)
    self.assertEqual(body['summary']['total_bets'], 65)
    self.assertEqual(body['summary']['win_rate_percent'], 50.0)

  # ── Strategy Presets ──
  def test_strategy_presets(self):
    self.client.post('/api/register', json={'username': 'tactician', 'password': 'password123'})
    self.client.post('/api/login', json={'username': 'tactician', 'password': 'password123'})

    # Create preset
    create_res = self.client.post('/api/presets', json={
      'name': 'Aggressive Limbo 3x',
      'game_name': 'limbo',
      'config': {'target': 3.0, 'baseBet': 10, 'onLoss': 2.0}
    })
    self.assertEqual(create_res.status_code, 201)
    preset_id = create_res.get_json().get('preset_id')

    # Fetch presets
    get_res = self.client.get('/api/presets')
    self.assertEqual(get_res.status_code, 200)
    presets = get_res.get_json().get('presets')
    self.assertEqual(len(presets), 1)
    self.assertEqual(presets[0]['name'], 'Aggressive Limbo 3x')

    # Delete preset
    del_res = self.client.delete(f'/api/presets/{preset_id}')
    self.assertEqual(del_res.status_code, 200)

    # Ensure deleted
    get_res2 = self.client.get('/api/presets')
    self.assertEqual(len(get_res2.get_json().get('presets')), 0)

  # ── Export Endpoint ──
  def test_user_data_export(self):
    self.client.post('/api/register', json={'username': 'exporter', 'password': 'password123'})
    self.client.post('/api/login', json={'username': 'exporter', 'password': 'password123'})
    self.client.post('/api/track', json={'game': 'blackjack'})

    export_res = self.client.get('/api/export')
    self.assertEqual(export_res.status_code, 200)
    data = export_res.get_json()
    self.assertIn('user', data)
    self.assertIn('analytics', data)
    self.assertIn('sessions', data)
    self.assertIn('presets', data)
    self.assertEqual(data['user']['username'], 'exporter')

if __name__ == '__main__':
  unittest.main()
