-- Test schema for MSSQL
-- Includes relationships and sample data for testing

-- Create database if needed (run against master)
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'testdb')
BEGIN
    CREATE DATABASE testdb;
END
GO

USE testdb;
GO

-- Drop existing tables if they exist
IF OBJECT_ID('post_tags', 'U') IS NOT NULL DROP TABLE post_tags;
IF OBJECT_ID('comments', 'U') IS NOT NULL DROP TABLE comments;
IF OBJECT_ID('posts', 'U') IS NOT NULL DROP TABLE posts;
IF OBJECT_ID('profiles', 'U') IS NOT NULL DROP TABLE profiles;
IF OBJECT_ID('tags', 'U') IS NOT NULL DROP TABLE tags;
IF OBJECT_ID('categories', 'U') IS NOT NULL DROP TABLE categories;
IF OBJECT_ID('users', 'U') IS NOT NULL DROP TABLE users;
GO

-- Users table
CREATE TABLE users (
    id INT PRIMARY KEY IDENTITY(1,1),
    email NVARCHAR(255) UNIQUE NOT NULL,
    name NVARCHAR(255) NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);
GO

CREATE INDEX idx_users_email ON users(email);
GO

-- Profiles table (1:1 with users)
CREATE TABLE profiles (
    id INT PRIMARY KEY IDENTITY(1,1),
    user_id INT UNIQUE NOT NULL,
    bio NVARCHAR(MAX),
    avatar_url NVARCHAR(500),
    CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
GO

CREATE INDEX idx_profiles_user_id ON profiles(user_id);
GO

-- Posts table
CREATE TABLE posts (
    id INT PRIMARY KEY IDENTITY(1,1),
    user_id INT NOT NULL,
    title NVARCHAR(255) NOT NULL,
    content NVARCHAR(MAX),
    published BIT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
GO

CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
GO

-- Comments table
CREATE TABLE comments (
    id INT PRIMARY KEY IDENTITY(1,1),
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    content NVARCHAR(MAX) NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT fk_comments_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION
);
GO

CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
GO

-- Tags table
CREATE TABLE tags (
    id INT PRIMARY KEY IDENTITY(1,1),
    name NVARCHAR(100) UNIQUE NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE()
);
GO

CREATE INDEX idx_tags_name ON tags(name);
GO

-- Post Tags junction table (many-to-many)
CREATE TABLE post_tags (
    post_id INT NOT NULL,
    tag_id INT NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    PRIMARY KEY (post_id, tag_id),
    CONSTRAINT fk_post_tags_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_post_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
GO

-- Categories table (self-referential)
CREATE TABLE categories (
    id INT PRIMARY KEY IDENTITY(1,1),
    name NVARCHAR(100) UNIQUE NOT NULL,
    parent_id INT,
    CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE NO ACTION
);
GO

CREATE INDEX idx_categories_parent_id ON categories(parent_id);
GO

-- Insert test data
INSERT INTO users (email, name) VALUES
    ('alice@example.com', 'Alice'),
    ('bob@example.com', 'Bob'),
    ('charlie@example.com', 'Charlie'),
    ('diana@example.com', 'Diana');
GO

INSERT INTO profiles (user_id, bio) VALUES
    (1, 'Software engineer and AI enthusiast'),
    (2, 'Database architect'),
    (3, 'Full-stack developer');
GO

INSERT INTO posts (user_id, title, content, published) VALUES
    (1, 'Introduction to AI Database Helper', 'This tool helps AI understand databases...', 1),
    (1, 'Schema Optimization Tips', 'Here are some tips...', 1),
    (2, 'Database Relationships Explained', 'Understanding relationships...', 1),
    (3, 'Draft Article', 'This is still being written...', 0);
GO

INSERT INTO comments (post_id, user_id, content) VALUES
    (1, 2, 'Great tool! Very helpful.'),
    (1, 3, 'Looking forward to trying this.'),
    (2, 3, 'Excellent tips!'),
    (3, 1, 'Very informative!');
GO

INSERT INTO tags (name) VALUES
    ('AI'),
    ('Database'),
    ('Schema'),
    ('Optimization'),
    ('MSSQL');
GO

INSERT INTO post_tags (post_id, tag_id) VALUES
    (1, 1), (1, 2),
    (2, 2), (2, 3), (2, 4),
    (3, 2), (3, 5);
GO

INSERT INTO categories (name, parent_id) VALUES
    ('Technology', NULL),
    ('Programming', 1),
    ('Databases', 2),
    ('AI/ML', 2);
GO

PRINT 'Test data created successfully!';
GO
