const mongoose = require('mongoose');
const userModel = require('../models/userModel');
require('dotenv').config();

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const result = await userModel.updateMany(
      {},
      {
        $set: {
          shop_enabled: true,
          fantasy_enabled: true,
          modules: ['shop', 'fantasy']
        }
      }
    );
    
    console.log(`Migration complete: ${result.modifiedCount} users updated`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
