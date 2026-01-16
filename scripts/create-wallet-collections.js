/**
 * MongoDB Wallet Collections Setup Script
 * Creates wallet_transactions and user_wallets collections with proper schemas and indexes
 * 
 * Usage: node scripts/create-wallet-collections.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function createWalletCollections() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    
    if (!mongoUri) {
      console.error('❌ Error: MONGO_URI or MONGODB_URI not found in environment variables');
      process.exit(1);
    }

    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // Check if collections already exist
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    // Create wallet_transactions collection
    if (!collectionNames.includes('wallettransactions')) {
      console.log('📝 Creating wallet_transactions collection...');
      
      await db.createCollection('wallettransactions', {
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['userId', 'type', 'amount', 'description', 'timestamp', 'status'],
            properties: {
              userId: { 
                bsonType: 'string',
                description: 'User ID (from Hygraph or MongoDB)'
              },
              type: { 
                bsonType: 'string',
                enum: ['add_money', 'purchase', 'refund', 'admin_adjustment', 'withdrawal', 'bonus', 'contest_win'],
                description: 'Transaction type'
              },
              amount: { 
                bsonType: 'double',
                description: 'Amount (positive for credit, negative for debit)'
              },
              description: { 
                bsonType: 'string',
                description: 'Human-readable description'
              },
              orderReference: { 
                bsonType: 'string',
                description: 'Reference to Shop Order ID or Contest ID'
              },
              paymentMethod: { 
                bsonType: 'string',
                description: 'Payment method (razorpay, shopTokens, etc)'
              },
              module: {
                bsonType: 'string',
                enum: ['shop', 'fantasy', 'wallet'],
                description: 'Module that initiated transaction'
              },
              timestamp: { 
                bsonType: 'date',
                description: 'When transaction occurred'
              },
              status: { 
                bsonType: 'string',
                enum: ['pending', 'completed', 'failed', 'reversed'],
                description: 'Transaction status'
              },
              balanceAfter: {
                bsonType: 'double',
                description: 'Balance after transaction'
              },
              metadata: { 
                bsonType: 'object',
                description: 'Additional JSON data'
              },
              createdAt: { 
                bsonType: 'date'
              },
              updatedAt: { 
                bsonType: 'date'
              }
            }
          }
        }
      });

      console.log('✅ wallet_transactions collection created');

      // Create indexes
      console.log('📊 Creating indexes for wallet_transactions...');
      await db.collection('wallettransactions').createIndex({ userId: 1 });
      await db.collection('wallettransactions').createIndex({ userId: 1, timestamp: -1 });
      await db.collection('wallettransactions').createIndex({ orderReference: 1 }, { sparse: true });
      await db.collection('wallettransactions').createIndex({ status: 1 });
      await db.collection('wallettransactions').createIndex({ type: 1 });
      console.log('✅ Indexes created for wallet_transactions\n');
    } else {
      console.log('ℹ️  wallet_transactions collection already exists\n');
    }

    // Create user_wallets collection
    if (!collectionNames.includes('userwallets')) {
      console.log('📝 Creating user_wallets collection...');
      
      await db.createCollection('userwallets', {
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['userId', 'shopTokens', 'gameTokens', 'totalSpent', 'totalAdded'],
            properties: {
              userId: { 
                bsonType: 'string',
                description: 'User ID (unique)'
              },
              shopTokens: { 
                bsonType: 'double',
                description: 'Shop tokens balance'
              },
              gameTokens: { 
                bsonType: 'double',
                description: 'Game tokens balance'
              },
              totalSpent: { 
                bsonType: 'double',
                description: 'Total tokens ever spent'
              },
              totalAdded: { 
                bsonType: 'double',
                description: 'Total tokens ever added'
              },
              totalWithdrawn: {
                bsonType: 'double',
                description: 'Total tokens withdrawn'
              },
              lastSyncedAt: { 
                bsonType: 'date',
                description: 'Last sync with Hygraph'
              },
              hygraphWalletId: {
                bsonType: 'string',
                description: 'Hygraph wallet ID reference'
              },
              createdAt: { 
                bsonType: 'date'
              },
              updatedAt: { 
                bsonType: 'date'
              }
            }
          }
        }
      });

      console.log('✅ user_wallets collection created');

      // Create unique index on userId
      console.log('📊 Creating unique index for user_wallets...');
      await db.collection('userwallets').createIndex({ userId: 1 }, { unique: true });
      console.log('✅ Unique index created for user_wallets\n');
    } else {
      console.log('ℹ️  user_wallets collection already exists\n');
    }

    // Verify collections
    console.log('🔍 Verifying collections...');
    const finalCollections = await db.listCollections().toArray();
    const walletCollections = finalCollections.filter(c => 
      c.name === 'wallettransactions' || c.name === 'userwallets'
    );

    console.log('\n✅ Wallet collections verified:');
    walletCollections.forEach(c => {
      console.log(`   - ${c.name}`);
    });

    console.log('\n🎉 Wallet collections setup completed successfully!');
    console.log('\nYou can now use:');
    console.log('   - WalletTransaction model: require("./models/walletTransactionModel")');
    console.log('   - UserWallet model: require("./models/userWalletModel")');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating wallet collections:', error);
    process.exit(1);
  }
}

// Run migration
createWalletCollections();
