# AegisBet Full-Stack Flask Backend & SQLite Database Server

import os
import sqlite3
from datetime import datetime
from flask import Flask, request, jsonify, session, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__, static_folder='.', static_url_path='')
app.secret_key = os.urandom(24)

DATABASE = os.path.join(os.path.dirname(__file__), 'database.db')

def get_db_connection():
  conn = sqlite3.connect(DATABASE)
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
  
  conn.commit()
  conn.close()
  print("[DB] SQLite database initialized successfully.")

# Initialize database on startup
init_db()

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
    # Use SQLite UPSERT syntax to insert/update the access counter
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

if __name__ == '__main__':
  # Run Flask on port 5001 to avoid AirPlay conflict on macOS
  app.run(host='0.0.0.0', port=5001, debug=True)
