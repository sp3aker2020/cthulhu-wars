import { MongoClient } from 'mongodb';

let client = null;
let db = null;

/**
 * Connect to MongoDB Atlas and return the database instance.
 * Reuses existing connection if already connected.
 */
export async function getDB() {
  if (db) return db;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(); // uses the database from the connection string (grf_league)
  console.log('Connected to MongoDB Atlas');
  return db;
}

/**
 * Get the profiles collection.
 */
export async function getProfiles() {
  const database = await getDB();
  return database.collection('profiles');
}

/**
 * Get the matches collection.
 */
export async function getMatches() {
  const database = await getDB();
  return database.collection('matches');
}

/**
 * Graceful shutdown — close the MongoDB connection.
 */
export async function closeDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('MongoDB connection closed');
  }
}
