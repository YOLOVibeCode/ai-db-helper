// MongoDB initialization script
// MongoDB is schema-less, but we'll insert sample documents to test schema inference

db = db.getSiblingDB('testdb');

// Users collection
db.users.insertMany([
  {
    _id: ObjectId(),
    email: 'alice@example.com',
    name: 'Alice',
    role: 'admin',
    profile: {
      bio: 'Software engineer and AI enthusiast',
      location: 'San Francisco',
      skills: ['AI', 'Databases']
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: ObjectId(),
    email: 'bob@example.com',
    name: 'Bob',
    role: 'moderator',
    profile: {
      bio: 'Database architect',
      location: 'New York',
      skills: ['SQL', 'NoSQL']
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: ObjectId(),
    email: 'charlie@example.com',
    name: 'Charlie',
    role: 'user',
    createdAt: new Date()
  }
]);

// Posts collection (with referenced user IDs)
const users = db.users.find().toArray();

db.posts.insertMany([
  {
    _id: ObjectId(),
    userId: users[0]._id,
    title: 'Introduction to AI Database Helper',
    content: 'This tool helps AI understand databases...',
    status: 'published',
    tags: ['AI', 'Database'],
    metadata: {
      views: 150,
      likes: 25
    },
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: ObjectId(),
    userId: users[0]._id,
    title: 'Schema Optimization Tips',
    content: 'Here are some tips...',
    status: 'published',
    tags: ['Database', 'Schema', 'Optimization'],
    metadata: {
      views: 89,
      likes: 12
    },
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: ObjectId(),
    userId: users[1]._id,
    title: 'Database Relationships Explained',
    content: 'Understanding relationships...',
    status: 'published',
    tags: ['Database'],
    metadata: {
      views: 120,
      likes: 18
    },
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

// Comments collection (with referenced post and user IDs)
const posts = db.posts.find().toArray();

db.comments.insertMany([
  {
    _id: ObjectId(),
    postId: posts[0]._id,
    userId: users[1]._id,
    content: 'Great tool! Very helpful.',
    createdAt: new Date()
  },
  {
    _id: ObjectId(),
    postId: posts[0]._id,
    userId: users[2]._id,
    content: 'Looking forward to trying this.',
    createdAt: new Date()
  },
  {
    _id: ObjectId(),
    postId: posts[1]._id,
    userId: users[2]._id,
    content: 'Excellent tips!',
    createdAt: new Date()
  }
]);

// Create indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1 });
db.posts.createIndex({ userId: 1 });
db.posts.createIndex({ status: 1 });
db.posts.createIndex({ createdAt: -1 });
db.posts.createIndex({ tags: 1 });
db.comments.createIndex({ postId: 1 });
db.comments.createIndex({ userId: 1 });

print('MongoDB test database initialized successfully');
