-- Test schema for MySQL
-- This schema includes all relationship types for comprehensive testing

CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email)
);

CREATE TABLE IF NOT EXISTS profiles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT UNIQUE NOT NULL,
  bio TEXT,
  avatar_url VARCHAR(500),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
);

CREATE TABLE IF NOT EXISTS posts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS comments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  post_id INT NOT NULL,
  user_id INT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_post_id (post_id),
  INDEX idx_user_id (user_id)
);

CREATE TABLE IF NOT EXISTS tags (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_name (name)
);

CREATE TABLE IF NOT EXISTS post_tags (
  post_id INT NOT NULL,
  tag_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, tag_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL,
  parent_id INT,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_parent_id (parent_id)
);

-- Insert test data
INSERT INTO users (email, name) VALUES
  ('alice@example.com', 'Alice'),
  ('bob@example.com', 'Bob'),
  ('charlie@example.com', 'Charlie');

INSERT INTO profiles (user_id, bio) VALUES
  (1, 'Software engineer and AI enthusiast'),
  (2, 'Database architect'),
  (3, 'Full-stack developer');

INSERT INTO posts (user_id, title, content, published) VALUES
  (1, 'Introduction to AI Database Helper', 'This tool helps AI understand databases...', TRUE),
  (1, 'Schema Optimization Tips', 'Here are some tips for optimizing your schema...', TRUE),
  (2, 'Database Relationships Explained', 'Understanding 1:1, 1:N, and N:N relationships...', TRUE);

INSERT INTO comments (post_id, user_id, content) VALUES
  (1, 2, 'Great tool! Very helpful.'),
  (1, 3, 'Looking forward to trying this.'),
  (2, 3, 'Excellent tips!');

INSERT INTO tags (name) VALUES
  ('AI'),
  ('Database'),
  ('Schema'),
  ('Optimization');

INSERT INTO post_tags (post_id, tag_id) VALUES
  (1, 1), (1, 2),
  (2, 2), (2, 3), (2, 4),
  (3, 2);

INSERT INTO categories (name, parent_id) VALUES
  ('Technology', NULL),
  ('Programming', 1),
  ('Databases', 2),
  ('AI/ML', 2);
