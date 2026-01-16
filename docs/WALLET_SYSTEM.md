# Wallet System Documentation

## Overview

The wallet system provides unified wallet functionality across Shop and Fantasy modules with transaction tracking and balance management.

## MongoDB Collections

### 1. wallet_transactions (wallettransactions)

Stores all wallet transactions for users.

**Schema:**
- `userId` (String, required, indexed): User ID from Hygraph or MongoDB
- `type` (String, required): Transaction type (add_money, purchase, refund, etc.)
- `amount` (Number, required): Amount (positive for credit, negative for debit)
- `description` (String, required): Human-readable description
- `orderReference` (String, optional): Reference to Shop Order or Contest
- `paymentMethod` (String): Payment method used
- `module` (String): Which module initiated (shop/fantasy/wallet)
- `timestamp` (Date, required): When transaction occurred
- `status` (String, required): pending/completed/failed/reversed
- `balanceAfter` (Number): User balance after transaction
- `metadata` (Object): Additional JSON data

**Indexes:**
- `userId` (ascending)
- `userId + timestamp` (compound, descending timestamp)
- `orderReference` (sparse)
- `status`
- `type`

### 2. user_wallets (userwallets)

Caches user wallet balances for quick access.

**Schema:**
- `userId` (String, required, unique): User ID
- `shopTokens` (Number, required, default: 0): Shop tokens balance
- `gameTokens` (Number, required, default: 0): Game tokens balance
- `totalSpent` (Number, required, default: 0): Total ever spent
- `totalAdded` (Number, required, default: 0): Total ever added
- `totalWithdrawn` (Number, default: 0): Total withdrawn
- `lastSyncedAt` (Date): Last sync with Hygraph
- `hygraphWalletId` (String): Hygraph wallet ID reference

**Indexes:**
- `userId` (unique)

## Setup

### Automated Setup (Recommended)

```bash
node scripts/create-wallet-collections.js
```

### Manual Setup

See `scripts/wallet-mongodb-commands.md` for manual MongoDB shell commands.

## Usage

### Import Models

```javascript
const WalletTransaction = require('./models/walletTransactionModel');
const UserWallet = require('./models/userWalletModel');
```

### Create Transaction

```javascript
const transaction = await WalletTransaction.create({
  userId: '507f1f77bcf86cd799439011',
  type: 'add_money',
  amount: 100.00,
  description: 'Added money via Razorpay',
  paymentMethod: 'razorpay',
  module: 'shop',
  status: 'completed',
  balanceAfter: 100.00,
  metadata: {
    razorpay_payment_id: 'pay_123456',
    razorpay_order_id: 'order_123456'
  }
});
```

### Get User Balance

```javascript
const wallet = await UserWallet.findOne({ userId: '507f1f77bcf86cd799439011' });
console.log('Shop Tokens:', wallet.shopTokens);
console.log('Game Tokens:', wallet.gameTokens);
```

### Get Transaction History

```javascript
const transactions = await WalletTransaction.find({ 
  userId: '507f1f77bcf86cd799439011',
  status: 'completed'
})
.sort({ timestamp: -1 })
.limit(50);
```

## Integration

This wallet system integrates with:
- **Hygraph**: Syncs wallet balance
- **Shop Backend**: Processes shop orders
- **Fantasy Backend**: Handles contest wins and withdrawals
- **Payment Gateways**: Razorpay, Cashfree, PhonePe

## Migration

To migrate existing wallet data, create a custom migration script based on your current data structure.
