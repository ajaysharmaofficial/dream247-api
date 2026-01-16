# MongoDB Wallet Collections - Manual Setup Commands

If you prefer to create collections manually using MongoDB Shell (`mongosh`), use these commands:

## Connect to MongoDB

```bash
mongosh "mongodb+srv://username:password@cluster.mongodb.net/dream247"
# Or for local MongoDB:
mongosh "mongodb://localhost:27017/dream247"
```

## Create wallet_transactions Collection

```javascript
db.createCollection("wallettransactions", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "type", "amount", "description", "timestamp", "status"],
      properties: {
        userId: { 
          bsonType: "string",
          description: "User ID (from Hygraph or MongoDB)"
        },
        type: { 
          bsonType: "string",
          enum: ["add_money", "purchase", "refund", "admin_adjustment", "withdrawal", "bonus", "contest_win"],
          description: "Transaction type"
        },
        amount: { 
          bsonType: "double",
          description: "Amount (positive for credit, negative for debit)"
        },
        description: { 
          bsonType: "string",
          description: "Human-readable description"
        },
        orderReference: { 
          bsonType: "string",
          description: "Reference to Shop Order ID or Contest ID"
        },
        paymentMethod: { 
          bsonType: "string",
          description: "Payment method (razorpay, shopTokens, etc)"
        },
        module: {
          bsonType: "string",
          enum: ["shop", "fantasy", "wallet"],
          description: "Module that initiated transaction"
        },
        timestamp: { 
          bsonType: "date",
          description: "When transaction occurred"
        },
        status: { 
          bsonType: "string",
          enum: ["pending", "completed", "failed", "reversed"],
          description: "Transaction status"
        },
        balanceAfter: {
          bsonType: "double",
          description: "Balance after transaction"
        },
        metadata: { 
          bsonType: "object",
          description: "Additional JSON data"
        },
        createdAt: { 
          bsonType: "date"
        },
        updatedAt: { 
          bsonType: "date"
        }
      }
    }
  }
});
```

## Create Indexes for wallet_transactions

```javascript
db.wallettransactions.createIndex({ userId: 1 });
db.wallettransactions.createIndex({ userId: 1, timestamp: -1 });
db.wallettransactions.createIndex({ orderReference: 1 }, { sparse: true });
db.wallettransactions.createIndex({ status: 1 });
db.wallettransactions.createIndex({ type: 1 });
```

## Create user_wallets Collection

```javascript
db.createCollection("userwallets", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "shopTokens", "gameTokens", "totalSpent", "totalAdded"],
      properties: {
        userId: { 
          bsonType: "string",
          description: "User ID (unique)"
        },
        shopTokens: { 
          bsonType: "double",
          description: "Shop tokens balance"
        },
        gameTokens: { 
          bsonType: "double",
          description: "Game tokens balance"
        },
        totalSpent: { 
          bsonType: "double",
          description: "Total tokens ever spent"
        },
        totalAdded: { 
          bsonType: "double",
          description: "Total tokens ever added"
        },
        totalWithdrawn: {
          bsonType: "double",
          description: "Total tokens withdrawn"
        },
        lastSyncedAt: { 
          bsonType: "date",
          description: "Last sync with Hygraph"
        },
        hygraphWalletId: {
          bsonType: "string",
          description: "Hygraph wallet ID reference"
        },
        createdAt: { 
          bsonType: "date"
        },
        updatedAt: { 
          bsonType: "date"
        }
      }
    }
  }
});
```

## Create Unique Index for user_wallets

```javascript
db.userwallets.createIndex({ userId: 1 }, { unique: true });
```

## Verify Collections

```javascript
// List all collections
db.getCollectionNames();

// Check wallet collections exist
db.wallettransactions.findOne();  // Should return null if empty
db.userwallets.findOne();  // Should return null if empty

// Check indexes
db.wallettransactions.getIndexes();
db.userwallets.getIndexes();
```

## Sample Data Insertion (for testing)

```javascript
// Insert test wallet transaction
db.wallettransactions.insertOne({
  userId: "test-user-123",
  type: "add_money",
  amount: 100.00,
  description: "Test add money transaction",
  paymentMethod: "razorpay",
  module: "shop",
  timestamp: new Date(),
  status: "completed",
  balanceAfter: 100.00,
  createdAt: new Date(),
  updatedAt: new Date()
});

// Insert test user wallet
db.userwallets.insertOne({
  userId: "test-user-123",
  shopTokens: 100.00,
  gameTokens: 0.00,
  totalSpent: 0.00,
  totalAdded: 100.00,
  totalWithdrawn: 0.00,
  createdAt: new Date(),
  updatedAt: new Date()
});

// Verify insertions
db.wallettransactions.find({userId: "test-user-123"}).pretty();
db.userwallets.find({userId: "test-user-123"}).pretty();
```

## Cleanup (if needed)

```javascript
// Drop collections (CAUTION: This deletes all data!)
db.wallettransactions.drop();
db.userwallets.drop();
```
