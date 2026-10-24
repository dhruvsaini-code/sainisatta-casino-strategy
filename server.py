# sainisatta Full-Stack Flask Backend & SQLite Database Server

import os
import json
import sqlite3
from datetime import datetime
from flask import Flask, request, jsonify, session, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__, static_folder='.', static_url_path='')
app.secret_key = os.urandom(24)

DATABASE = os.path.join(os.path.dirname(__file__), 'database.db')

def get_db_connection():
  conn = sqlite3.connect(DATABASE)
  conn.execute('PRAGMA foreign_keys = ON;')
  conn.row_factory = sqlite3.Row
  return conn

def init_db():
  if not os.path.exists(DATABASE):
    print("[DB] Database file not found. Creating a new database...")
  
  conn = get_db_connection()
  cursor = conn.cursor()
  
  # Create Users table
  cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  ''')
  
  # Create Game Analytics table
  cursor.execute('''
    CREATE TABLE IF NOT EXISTS game_analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game_name TEXT NOT NULL,
      access_count INTEGER DEFAULT 0,
      last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      UNIQUE(user_id, game_name)
    )
  ''')

  # Create Betting & Bankroll Sessions table
  cursor.execute('''
    CREATE TABLE IF NOT EXISTS betting_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game_name TEXT NOT NULL,
      starting_bankroll REAL NOT NULL,
      ending_bankroll REAL NOT NULL,
      net_profit REAL NOT NULL,
      total_bets INTEGER DEFAULT 0,
      strategy_name TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  ''')

  # Create Strategy Presets table
  cursor.execute('''
    CREATE TABLE IF NOT EXISTS strategy_presets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      game_name TEXT NOT NULL,
      config_json TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  ''')
  
  conn.commit()
  conn.close()
  print("[DB] SQLite database initialized successfully.")

# Initialize database on startup
init_db()

# --- CORS & PREFLIGHT HANDLING ---
@app.after_request
def add_cors_headers(response):
  response.headers['Access-Control-Allow-Origin'] = request.headers.get('Origin', '*')
  response.headers['Access-Control-Allow-Credentials'] = 'true'
  response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-Requested-With'
  response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
  return response

@app.route('/api/<path:path>', methods=['OPTIONS'])
def handle_options(path):
  return ('', 204)

# --- SYSTEM HEALTH CHECK ---
@app.route('/api/health', methods=['GET'])
def health_check():
  return jsonify({
    'status': 'healthy',
    'version': '3.1.0',
    'timestamp': datetime.utcnow().isoformat() + 'Z',
    'database': 'connected'
  }), 200

# Serve static files from root
@app.route('/')
def index():
  return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
  return send_from_directory('.', path)

# --- AUTHENTICATION API ENDPOINTS ---

@app.route('/api/register', methods=['POST'])
def register():
  data = request.get_json() or {}
  username = data.get('username', '').strip()
  password = data.get('password', '')
  
  if not username or not password:
    return jsonify({'error': 'Username and password are required'}), 400
  
  if len(username) < 3 or len(password) < 5:
    return jsonify({'error': 'Username (min 3 chars) and password (min 5 chars) too short'}), 400
  
  conn = get_db_connection()
  cursor = conn.cursor()
  
  try:
    password_hash = generate_password_hash(password)
    cursor.execute(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      (username, password_hash)
    )
    conn.commit()
    conn.close()
    return jsonify({'message': 'Registration successful! Proceed to login.'}), 201
  except sqlite3.IntegrityError:
    conn.close()
    return jsonify({'error': 'Username already exists'}), 400

@app.route('/api/login', methods=['POST'])
def login():
  data = request.get_json() or {}
  username = data.get('username', '').strip()
  password = data.get('password', '')
  
  if not username or not password:
    return jsonify({'error': 'Username and password are required'}), 400
  
  conn = get_db_connection()
  cursor = conn.cursor()
  
  cursor.execute('SELECT * FROM users WHERE username = ?', (username,))
  user = cursor.fetchone()
  conn.close()
  
  if user and check_password_hash(user['password_hash'], password):
    session['user_id'] = user['id']
    session['username'] = user['username']
    return jsonify({
      'username': user['username'],
      'message': f'Welcome back, {user["username"]}!'
    }), 200
  
  return jsonify({'error': 'Invalid username or password'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
  session.clear()
  return jsonify({'message': 'Logged out successfully'}), 200

@app.route('/api/session', methods=['GET'])
def get_session():
  if 'user_id' in session:
    return jsonify({
      'logged_in': True,
      'username': session['username']
    }), 200
  return jsonify({'logged_in': False}), 401

# --- GAME ANALYTICS API ENDPOINTS ---

@app.route('/api/track', methods=['POST'])
def track_game():
  if 'user_id' not in session:
    return jsonify({'error': 'Authentication required'}), 401
    
  data = request.get_json() or {}
  game_name = data.get('game', '').strip()
  
  if not game_name:
    return jsonify({'error': 'Game name is required'}), 400
    
  conn = get_db_connection()
  cursor = conn.cursor()
  
  try:
    cursor.execute('''
      INSERT INTO game_analytics (user_id, game_name, access_count, last_accessed)
      VALUES (?, ?, 1, ?)
      ON CONFLICT(user_id, game_name)
      DO UPDATE SET 
        access_count = access_count + 1,
        last_accessed = ?
    ''', (session['user_id'], game_name, datetime.now(), datetime.now()))
    
    conn.commit()
    conn.close()
    return jsonify({'message': 'Access logged successfully'}), 200
  except Exception as e:
    conn.close()
    return jsonify({'error': str(e)}), 500

@app.route('/api/analytics', methods=['GET'])
def get_analytics():
  if 'user_id' not in session:
    return jsonify({'error': 'Authentication required'}), 401
    
  conn = get_db_connection()
  cursor = conn.cursor()
  
  cursor.execute(
    'SELECT game_name, access_count, last_accessed FROM game_analytics WHERE user_id = ? ORDER BY access_count DESC',
    (session['user_id'],)
  )
  rows = cursor.fetchall()
  conn.close()
  
  results = []
  for row in rows:
    results.append({
      'game': row['game_name'],
      'count': row['access_count'],
      'last_accessed': row['last_accessed']
    })
    
  return jsonify(results), 200

# --- BETTING SESSIONS API ENDPOINTS ---

@app.route('/api/sessions', methods=['GET', 'POST'])
def handle_sessions():
  if 'user_id' not in session:
    return jsonify({'error': 'Authentication required'}), 401

  conn = get_db_connection()
  cursor = conn.cursor()

  if request.method == 'POST':
    data = request.get_json() or {}
    game_name = data.get('game_name', '').strip()
    starting_bankroll = float(data.get('starting_bankroll', 0))
    ending_bankroll = float(data.get('ending_bankroll', 0))
    net_profit = ending_bankroll - starting_bankroll
    total_bets = int(data.get('total_bets', 0))
    strategy_name = data.get('strategy_name', 'Standard')

    if not game_name or starting_bankroll <= 0:
      conn.close()
      return jsonify({'error': 'Valid game_name and positive starting_bankroll are required'}), 400

    cursor.execute('''
      INSERT INTO betting_sessions (user_id, game_name, starting_bankroll, ending_bankroll, net_profit, total_bets, strategy_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (session['user_id'], game_name, starting_bankroll, ending_bankroll, net_profit, total_bets, strategy_name))
    conn.commit()
    session_id = cursor.lastrowid
    conn.close()

    return jsonify({
      'message': 'Session recorded successfully',
      'session_id': session_id,
      'net_profit': net_profit
    }), 201

  # GET Request
  cursor.execute('''
    SELECT id, game_name, starting_bankroll, ending_bankroll, net_profit, total_bets, strategy_name, created_at
    FROM betting_sessions
    WHERE user_id = ?
    ORDER BY created_at DESC
  ''', (session['user_id'],))
  rows = cursor.fetchall()

  sessions_list = []
  total_profit = 0.0
  total_bets_count = 0
  profitable_sessions = 0

  for r in rows:
    profit = float(r['net_profit'])
    total_profit += profit
    total_bets_count += int(r['total_bets'])
    if profit > 0:
      profitable_sessions += 1

    sessions_list.append({
      'id': r['id'],
      'game_name': r['game_name'],
      'starting_bankroll': r['starting_bankroll'],
      'ending_bankroll': r['ending_bankroll'],
      'net_profit': profit,
      'total_bets': r['total_bets'],
      'strategy_name': r['strategy_name'],
      'created_at': r['created_at']
    })

  total_count = len(sessions_list)
  win_rate = (profitable_sessions / total_count * 100) if total_count > 0 else 0.0
  conn.close()

  return jsonify({
    'sessions': sessions_list,
    'summary': {
      'total_sessions': total_count,
      'total_profit': round(total_profit, 2),
      'win_rate_percent': round(win_rate, 2),
      'total_bets': total_bets_count
    }
  }), 200

# --- STRATEGY PRESETS API ENDPOINTS ---

@app.route('/api/presets', methods=['GET', 'POST'])
def handle_presets():
  if 'user_id' not in session:
    return jsonify({'error': 'Authentication required'}), 401

  conn = get_db_connection()
  cursor = conn.cursor()

  if request.method == 'POST':
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    game_name = data.get('game_name', '').strip()
    config = data.get('config', {})

    if not name or not game_name:
      conn.close()
      return jsonify({'error': 'Preset name and game_name are required'}), 400

    config_str = json.dumps(config) if isinstance(config, dict) else str(config)

    cursor.execute('''
      INSERT INTO strategy_presets (user_id, name, game_name, config_json)
      VALUES (?, ?, ?, ?)
    ''', (session['user_id'], name, game_name, config_str))
    conn.commit()
    preset_id = cursor.lastrowid
    conn.close()

    return jsonify({'message': 'Preset saved successfully', 'preset_id': preset_id}), 201

  # GET Request
  cursor.execute('''
    SELECT id, name, game_name, config_json, created_at
    FROM strategy_presets
    WHERE user_id = ?
    ORDER BY created_at DESC
  ''', (session['user_id'],))
  rows = cursor.fetchall()
  conn.close()

  presets = []
  for r in rows:
    try:
      parsed_cfg = json.loads(r['config_json'])
    except Exception:
      parsed_cfg = r['config_json']
    presets.append({
      'id': r['id'],
      'name': r['name'],
      'game_name': r['game_name'],
      'config': parsed_cfg,
      'created_at': r['created_at']
    })

  return jsonify({'presets': presets}), 200

@app.route('/api/presets/<int:preset_id>', methods=['DELETE'])
def delete_preset(preset_id):
  if 'user_id' not in session:
    return jsonify({'error': 'Authentication required'}), 401

  conn = get_db_connection()
  cursor = conn.cursor()
  cursor.execute('DELETE FROM strategy_presets WHERE id = ? AND user_id = ?', (preset_id, session['user_id']))
  deleted = cursor.rowcount
  conn.commit()
  conn.close()

  if deleted > 0:
    return jsonify({'message': 'Preset deleted successfully'}), 200
  return jsonify({'error': 'Preset not found or unauthorized'}), 404

# --- DATA EXPORT ENDPOINT ---

@app.route('/api/export', methods=['GET'])
def export_user_data():
  if 'user_id' not in session:
    return jsonify({'error': 'Authentication required'}), 401

  conn = get_db_connection()
  cursor = conn.cursor()

  cursor.execute('SELECT username, created_at FROM users WHERE id = ?', (session['user_id'],))
  user_info = dict(cursor.fetchone())

  cursor.execute('SELECT game_name, access_count, last_accessed FROM game_analytics WHERE user_id = ?', (session['user_id'],))
  analytics = [dict(r) for r in cursor.fetchall()]

  cursor.execute('SELECT game_name, starting_bankroll, ending_bankroll, net_profit, total_bets, strategy_name, created_at FROM betting_sessions WHERE user_id = ?', (session['user_id'],))
  sessions_data = [dict(r) for r in cursor.fetchall()]

  cursor.execute('SELECT name, game_name, config_json, created_at FROM strategy_presets WHERE user_id = ?', (session['user_id'],))
  presets_data = [dict(r) for r in cursor.fetchall()]

  conn.close()

  return jsonify({
    'export_version': '1.0',
    'exported_at': datetime.utcnow().isoformat() + 'Z',
    'user': user_info,
    'analytics': analytics,
    'sessions': sessions_data,
    'presets': presets_data
  }), 200

if __name__ == '__main__':
  # Run Flask on port 5001 to avoid AirPlay conflict on macOS
  app.run(host='0.0.0.0', port=5001, debug=True)
