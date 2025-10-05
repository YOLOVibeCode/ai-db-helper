-- Test schema for PostgreSQL
-- Includes PostgreSQL-specific features like schemas, custom types, and more

CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Custom types
CREATE TYPE user_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE post_status AS ENUM ('draft', 'published', 'archived');

-- Tables in public schema
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role user_role DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT,
  avatar_url VARCHAR(500),
  metadata JSONB
);

CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_metadata ON profiles USING GIN (metadata);

CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  status post_status DEFAULT 'draft',
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_status ON posts(status);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);

CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tags_name ON tags(name);

CREATE TABLE IF NOT EXISTS post_tags (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, tag_id)
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX idx_categories_parent_id ON categories(parent_id);

-- Analytics schema tables
CREATE TABLE analytics.page_views (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL,
  user_id INTEGER,
  ip_address INET,
  user_agent TEXT,
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_page_views_post_id ON analytics.page_views(post_id);
CREATE INDEX idx_page_views_viewed_at ON analytics.page_views(viewed_at DESC);

-- View example
CREATE OR REPLACE VIEW post_summaries AS
SELECT
  p.id,
  p.title,
  u.name AS author_name,
  p.status,
  COUNT(DISTINCT c.id) AS comment_count,
  COUNT(DISTINCT pt.tag_id) AS tag_count
FROM posts p
LEFT JOIN users u ON p.user_id = u.id
LEFT JOIN comments c ON p.id = c.post_id
LEFT JOIN post_tags pt ON p.id = pt.post_id
GROUP BY p.id, p.title, u.name, p.status;

-- Function example
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert test data
INSERT INTO users (email, name, role) VALUES
  ('alice@example.com', 'Alice', 'admin'),
  ('bob@example.com', 'Bob', 'moderator'),
  ('charlie@example.com', 'Charlie', 'user'),
  ('diana@example.com', 'Diana', 'user');

INSERT INTO profiles (user_id, bio, metadata) VALUES
  (1, 'Software engineer and AI enthusiast', '{"location": "San Francisco", "skills": ["AI", "Databases"]}'),
  (2, 'Database architect', '{"location": "New York", "skills": ["SQL", "NoSQL"]}'),
  (3, 'Full-stack developer', '{"location": "Austin", "skills": ["React", "Node.js"]}');

INSERT INTO posts (user_id, title, content, status, published_at) VALUES
  (1, 'Introduction to AI Database Helper', 'This tool helps AI understand databases...', 'published', CURRENT_TIMESTAMP),
  (1, 'Schema Optimization Tips', 'Here are some tips...', 'published', CURRENT_TIMESTAMP),
  (2, 'Database Relationships Explained', 'Understanding relationships...', 'published', CURRENT_TIMESTAMP),
  (3, 'Draft Article', 'This is still being written...', 'draft', NULL);

INSERT INTO comments (post_id, user_id, content) VALUES
  (1, 2, 'Great tool! Very helpful.'),
  (1, 3, 'Looking forward to trying this.'),
  (2, 3, 'Excellent tips!'),
  (3, 1, 'Very informative!');

INSERT INTO tags (name) VALUES
  ('AI'),
  ('Database'),
  ('Schema'),
  ('Optimization'),
  ('PostgreSQL');

INSERT INTO post_tags (post_id, tag_id) VALUES
  (1, 1), (1, 2),
  (2, 2), (2, 3), (2, 4),
  (3, 2), (3, 5);

INSERT INTO categories (name, parent_id) VALUES
  ('Technology', NULL),
  ('Programming', 1),
  ('Databases', 2),
  ('AI/ML', 2);

INSERT INTO analytics.page_views (post_id, user_id, ip_address) VALUES
  (1, 2, '192.168.1.100'),
  (1, 3, '192.168.1.101'),
  (1, NULL, '192.168.1.102'),
  (2, 3, '192.168.1.100');
