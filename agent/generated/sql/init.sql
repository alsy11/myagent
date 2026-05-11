-- Space Fractions Database Initialization
-- Run: psql -U spacefractions -d spacefractions -f sql/init.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===== USERS TABLE =====
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(200),
  role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== QUESTIONS TABLE =====
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer VARCHAR(255) NOT NULL,
  difficulty VARCHAR(20) NOT NULL DEFAULT 'easy' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== GAMES TABLE =====
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_state JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_games_user_id ON games(user_id);

-- ===== SEED ADMIN USER =====
-- Password: admin123 (bcrypt hash)
INSERT INTO users (username, password_hash, display_name, role)
VALUES ('admin', '$2a$10$/3wexeJJa5NgyenbrZZfV.QYXCRHpkt9NfM1G7ImwM1qpHpbAbUnC', 'Admin', 'admin')
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  display_name = EXCLUDED.display_name,
  role = EXCLUDED.role,
  updated_at = NOW();

-- ===== SEED 10 FRACTION QUESTIONS =====
INSERT INTO questions (prompt, options, correct_answer, difficulty) VALUES
(
  'What is <span class="fraction">1/2</span> + <span class="fraction">1/4</span>?',
  '["3/4", "2/6", "1/6", "2/4"]',
  '3/4',
  'easy'
),
(
  'What is <span class="fraction">2/3</span> of 12?',
  '["6", "8", "4", "10"]',
  '8',
  'easy'
),
(
  'Which fraction is equivalent to <span class="fraction">3/5</span>?',
  '["6/10", "3/10", "6/5", "9/15"]',
  '6/10',
  'easy'
),
(
  'What is <span class="fraction">3/4</span> − <span class="fraction">1/2</span>?',
  '["1/4", "2/2", "1/2", "2/4"]',
  '1/4',
  'medium'
),
(
  'Simplify: <span class="fraction">8/12</span>',
  '["2/3", "4/6", "1/3", "3/4"]',
  '2/3',
  'medium'
),
(
  'What is <span class="fraction">2/5</span> + <span class="fraction">3/10</span>?',
  '["7/10", "5/15", "1/2", "5/10"]',
  '7/10',
  'medium'
),
(
  'Which is larger: <span class="fraction">5/8</span> or <span class="fraction">3/5</span>?',
  '["5/8", "3/5", "They are equal", "Cannot determine"]',
  '5/8',
  'hard'
),
(
  'What is <span class="fraction">1/3</span> × <span class="fraction">3/4</span>?',
  '["1/4", "3/12", "1/3", "3/7"]',
  '1/4',
  'hard'
),
(
  'What is <span class="fraction">3/4</span> ÷ <span class="fraction">1/2</span>?',
  '["1 1/2", "3/8", "3/2", "1/2"]',
  '1 1/2',
  'hard'
),
(
  'Order from smallest to largest: <span class="fraction">1/3</span>, <span class="fraction">2/5</span>, <span class="fraction">3/10</span>',
  '["3/10, 1/3, 2/5", "1/3, 2/5, 3/10", "2/5, 1/3, 3/10", "3/10, 2/5, 1/3"]',
  '3/10, 1/3, 2/5',
  'hard'
);
