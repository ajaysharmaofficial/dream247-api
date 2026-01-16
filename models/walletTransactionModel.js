const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Wallet Transaction Schema
 * Stores all wallet transactions for users across Shop and Fantasy modules
 */
let walletTransactionSchema = new Schema({
  userId: {
    type: String,
    required: true,
    index: true,
    description: 'User ID from Hygraph or MongoDB'
  },
  type: {
    type: String,
    required: true,
    enum: ['add_money', 'purchase', 'refund', 'admin_adjustment', 'withdrawal', 'bonus', 'contest_win'],
    description: 'Transaction type'
  },
  amount: {
    type: Number,
    required: true,
    description: 'Amount (positive for credit, negative for debit)'
  },
  description: {
    type: String,
    required: true,
    description: 'Human-readable transaction description'
  },
  orderReference: {
    type: String,
    description: 'Reference to Shop Order ID or Contest ID'
  },
  paymentMethod: {
    type: String,
    enum: ['razorpay', 'shopTokens', 'gameTokens', 'bank_transfer', 'admin', 'bonus', 'cashfree', 'phonepe'],
    description: 'Payment method used'
  },
  module: {
    type: String,
    enum: ['shop', 'fantasy', 'wallet'],
    default: 'wallet',
    description: 'Which module initiated the transaction'
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    description: 'When transaction occurred'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'reversed'],
    default: 'pending',
    required: true,
    description: 'Transaction status'
  },
  balanceAfter: {
    type: Number,
    description: 'User balance after this transaction'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    description: 'Additional JSON data (payment details, etc)'
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes will be created by the migration script (scripts/create-wallet-collections.js)
// to avoid issues in production environments

module.exports = mongoose.model('wallettransactions', walletTransactionSchema);