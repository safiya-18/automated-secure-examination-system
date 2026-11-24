const mongoose = require('mongoose');

/**
 * Connect to MongoDB safely with error handling and retry guidance.
 */
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI) {
      console.warn('⚠️  WARNING: MONGODB_URI is not defined in environment variables.');
      console.warn('   Please set MONGODB_URI in server/.env (e.g. MongoDB Atlas connection string).');
      return null;
    }

    // Connect with Mongoose (5 second timeout so app remains responsive if DB is offline)
    const conn = await mongoose.connect(mongoURI, {
      autoIndex: true, // Build indexes automatically in development
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`✅ MongoDB Connected successfully: ${conn.connection.host}`);
    console.log(`📦 Database Name: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.warn('💡 Tip: Ensure your MongoDB Atlas cluster is active and your current IP is whitelisted (0.0.0.0/0).');
    
    // In production, database connection is mandatory
    if (process.env.NODE_ENV === 'production') {
      console.error('Critical failure: Server cannot function without database connection. Exiting...');
      process.exit(1);
    }
    // In development, return null so API server can continue running without hard crashing
    return null;
  }
};

module.exports = connectDB;
