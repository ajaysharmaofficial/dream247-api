const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * User Wallet Schema
 * Caches user wallet balances for quick access
 * Syncs with Hygraph periodically
 */
let userWalletSchema = new Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    description: 'User ID (from Hygraph or MongoDB)'
  },
  shopTokens: {
    type: Number,
    default: 0,
    required: true,
    description: 'Shop tokens balance'
  },
  gameTokens: {
    type: Number,
    default: 0,
    required: true,
    description: 'Fantasy game tokens balance'
  },
  totalSpent: {
    type: Number,
    default: 0,
    required: true,
    description: 'Total tokens ever spent'
  },
  totalAdded: {
    type: Number,
    default: 0,
    required: true,
    description: 'Total tokens ever added'
  },
  totalWithdrawn: {
    type: Number,
    default: 0,
    description: 'Total tokens withdrawn'
  },
  lastSyncedAt: {
    type: Date,
    description: 'Last sync with Hygraph'
  },
  hygraphWalletId: {
    type: String,
    description: 'Reference to Hygraph wallet ID'
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes will be created by the migration script (scripts/create-wallet-collections.js)
// to avoid issues in production environments

module.exports = mongoose.model('userwallets', userWalletSchema);
