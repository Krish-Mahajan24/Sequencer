const mongoose = require('mongoose');
let retryTimer;
let attempts = 0;
let connecting;

const connectDB = () => {
  if (mongoose.connection.readyState === 1) return Promise.resolve(true);
  if (connecting) return connecting;
  connecting = openConnection().finally(() => { connecting = null; });
  return connecting;
};

const openConnection = async () => {
  clearTimeout(retryTimer);
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri || /xxxxx|<username>|<password>/.test(mongoUri)) {
    console.warn('MongoDB is not configured. Set MONGO_URI or MONGODB_URI in backend/.env and restart.');
    return false;
  }
  try {
    const databaseName = process.env.MONGO_DB_NAME || new URL(mongoUri).pathname.slice(1) || 'sequencer';
    await mongoose.connect(mongoUri, {
      dbName: databaseName,
      serverSelectionTimeoutMS: process.env.VERCEL ? 10000 : 30000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 30000,
      waitQueueTimeoutMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 0,
    });
    attempts = 0;
    console.log('MongoDB connected to database: ' + mongoose.connection.name);
    return true;
  } catch (error) {
    const delay = Math.min(2000 * 2 ** Math.min(attempts++, 4), 30000);
    console.error(`MongoDB connection failed (${error.name}). Retrying in ${delay / 1000}s. Check Atlas network access and database credentials.`);
    // A failed initial connection is not retried automatically by Mongoose.
    if (!process.env.VERCEL) {
      retryTimer = setTimeout(connectDB, delay);
      retryTimer.unref();
    }
    return false;
  }
};
// Give requests arriving during startup/reconnection a bounded opportunity to
// use the database, without pretending a disconnected database saved anything.
connectDB.waitUntilConnected = (timeoutMs = 20000) => {
  if (mongoose.connection.readyState === 1) return Promise.resolve(true);
  // Each serverless invocation must initiate/await its own connection attempt;
  // a retry timer may be frozen between requests. Concurrent requests share it.
  const attempt = connectDB();
  return new Promise(resolve => {
    const connection = mongoose.connection;
    const finish = value => {
      clearTimeout(timer);
      connection.removeListener('connected', connected);
      resolve(value);
    };
    const connected = () => finish(true);
    const timer = setTimeout(() => finish(connection.readyState === 1), timeoutMs);
    connection.once('connected', connected);
    attempt.then(connectedSuccessfully => finish(connectedSuccessfully));
    if (connection.readyState === 1) finish(true);
  });
};
module.exports = connectDB;
