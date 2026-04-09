const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/adhd-tracker';
    await mongoose.connect(uri);
    console.log(`✅  MongoDB connected: ${uri}`);
  } catch (err) {
    console.error('❌  MongoDB connection failed:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
