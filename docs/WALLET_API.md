# Unified Wallet API Documentation

## Overview

The unified wallet API provides endpoints for managing shop tokens and game tokens in a single MongoDB-based wallet system.

## Authentication

All endpoints require JWT authentication via the `apiauth` middleware.

**Header:**
```
Authorization: Bearer <JWT_TOKEN>
```

---

## Endpoints

### 1. Get Wallet Balance

**GET** `/api/user/wallet/balance`

Retrieves the user's unified wallet balance including shop tokens, game tokens, and totals.

#### Request Headers
```
Authorization: Bearer <JWT_TOKEN>
```

#### Response (Success - 200 OK)
```json
{
  "success": true,
  "status": true,
  "balance": 1500,
  "bonus": 500,
  "winning": 0,
  "totalamount": 2000,
  "data": {
    "shopTokens": 1500,
    "gameTokens": 500,
    "totalSpent": 2000,
    "totalAdded": 4000,
    "totalWithdrawn": 0
  }
}
```

#### Response Fields
- `balance` - Shop tokens available for purchases
- `bonus` - Game tokens available for contests
- `winning` - Winnings (future implementation)
- `totalamount` - Sum of shop and game tokens
- `data.shopTokens` - Current shop token balance
- `data.gameTokens` - Current game token balance
- `data.totalSpent` - Total tokens ever spent
- `data.totalAdded` - Total tokens ever added
- `data.totalWithdrawn` - Total tokens withdrawn

---

### 2. Add Shop Tokens

**POST** `/api/user/wallet/add-shop-tokens`

Adds shop tokens to the user's wallet after successful Razorpay payment.

#### Request Headers
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

#### Request Body
```json
{
  "amount": 1000,
  "paymentId": "pay_MxYz123456",
  "orderId": "order_AbCd789012"
}
```

#### Request Fields
- `amount` (required, number) - Amount of tokens to add (must be > 0)
- `paymentId` (optional, string) - Razorpay payment ID
- `orderId` (optional, string) - Razorpay order ID

#### Response (Success - 200 OK)
```json
{
  "success": true,
  "status": true,
  "message": "Shop tokens added successfully",
  "newBalance": 2500,
  "data": {
    "shopTokens": 2500,
    "gameTokens": 500,
    "totalAdded": 5000
  }
}
```

#### Response (Error - 400 Bad Request)
```json
{
  "success": false,
  "status": false,
  "message": "Invalid amount"
}
```

---

### 3. Deduct Shop Tokens

**POST** `/api/user/wallet/deduct-shop-tokens`

Deducts shop tokens from the user's wallet when purchasing products.

#### Request Headers
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

#### Request Body
```json
{
  "amount": 500,
  "orderReference": "ORDER123456",
  "description": "Product purchase - iPhone 15"
}
```

#### Request Fields
- `amount` (required, number) - Amount of tokens to deduct (must be > 0)
- `orderReference` (optional, string) - Reference to shop order ID
- `description` (optional, string) - Transaction description

#### Response (Success - 200 OK)
```json
{
  "success": true,
  "status": true,
  "message": "Shop tokens deducted successfully",
  "newBalance": 2000,
  "data": {
    "shopTokens": 2000,
    "totalSpent": 2500
  }
}
```

#### Response (Insufficient Balance - 400 Bad Request)
```json
{
  "success": false,
  "status": false,
  "message": "Insufficient shop tokens",
  "required": 500,
  "available": 300,
  "shortfall": 200
}
```

#### Response (Wallet Not Found - 400 Bad Request)
```json
{
  "success": false,
  "status": false,
  "message": "Wallet not found"
}
```

---

### 4. Sync Hygraph Balance

**POST** `/api/user/wallet/sync-hygraph`

Syncs the user's Hygraph wallet balance to MongoDB (one-time migration).

#### Request Headers
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

#### Request Body
```json
{
  "hygraphBalance": 1500,
  "hygraphWalletId": "clx123456"
}
```

#### Request Fields
- `hygraphBalance` (required, number) - Balance from Hygraph wallet
- `hygraphWalletId` (optional, string) - Hygraph wallet ID reference

#### Response (Success - 200 OK)
```json
{
  "success": true,
  "status": true,
  "message": "Hygraph balance synced successfully",
  "data": {
    "shopTokens": 1500,
    "synced": true
  }
}
```

#### Sync Behavior
- **First time sync**: Creates new wallet with Hygraph balance
- **Existing wallet**: Only updates if Hygraph balance is higher than current balance
- Creates transaction records for audit trail

---

### 5. Get Transaction History

**GET** `/api/user/wallet/transactions?page=1&limit=20`

Retrieves paginated transaction history for the user's wallet.

#### Request Headers
```
Authorization: Bearer <JWT_TOKEN>
```

#### Query Parameters
- `page` (optional, number, default: 1) - Page number
- `limit` (optional, number, default: 20) - Results per page

#### Response (Success - 200 OK)
```json
{
  "success": true,
  "status": true,
  "data": [
    {
      "_id": "65abc123def456",
      "userId": "507f1f77bcf86cd799439011",
      "type": "add_money",
      "amount": 1000,
      "description": "Added ₹1000 shop tokens via Razorpay",
      "paymentMethod": "razorpay",
      "module": "shop",
      "status": "completed",
      "balanceAfter": 2500,
      "timestamp": "2024-01-15T10:30:00.000Z",
      "metadata": {
        "razorpay_payment_id": "pay_MxYz123456",
        "razorpay_order_id": "order_AbCd789012"
      },
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "_id": "65abc456def789",
      "userId": "507f1f77bcf86cd799439011",
      "type": "purchase",
      "amount": -500,
      "description": "Product purchase - ₹500",
      "orderReference": "ORDER123456",
      "paymentMethod": "shopTokens",
      "module": "shop",
      "status": "completed",
      "balanceAfter": 2000,
      "timestamp": "2024-01-15T11:00:00.000Z",
      "createdAt": "2024-01-15T11:00:00.000Z",
      "updatedAt": "2024-01-15T11:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

#### Transaction Types
- `add_money` - Tokens added via payment
- `purchase` - Tokens spent on products
- `refund` - Refunded tokens
- `admin_adjustment` - Admin-initiated balance changes
- `withdrawal` - Tokens withdrawn
- `bonus` - Bonus tokens added
- `contest_win` - Tokens won in contests

---

## Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "status": false,
  "msg": "No token provided"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "status": false,
  "msg": "Module access denied. Fantasy module required."
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "status": false,
  "message": "Error fetching wallet balance"
}
```

---

## Usage Examples

### Example 1: Get Balance
```javascript
const response = await fetch('https://api.dream247.com/api/user/wallet/balance', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  }
});
const data = await response.json();
console.log('Shop Tokens:', data.data.shopTokens);
```

### Example 2: Add Tokens After Payment
```javascript
const response = await fetch('https://api.dream247.com/api/user/wallet/add-shop-tokens', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 1000,
    paymentId: 'pay_MxYz123456',
    orderId: 'order_AbCd789012'
  })
});
const data = await response.json();
console.log('New Balance:', data.newBalance);
```

### Example 3: Deduct Tokens for Purchase
```javascript
const response = await fetch('https://api.dream247.com/api/user/wallet/deduct-shop-tokens', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 500,
    orderReference: 'ORDER123456',
    description: 'Product purchase - iPhone 15'
  })
});
const data = await response.json();
if (data.success) {
  console.log('Purchase successful, new balance:', data.newBalance);
} else {
  console.error('Purchase failed:', data.message);
}
```

### Example 4: Sync Hygraph Balance (First Login)
```javascript
const response = await fetch('https://api.dream247.com/api/user/wallet/sync-hygraph', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    hygraphBalance: 1500,
    hygraphWalletId: 'clx123456'
  })
});
const data = await response.json();
console.log('Sync successful:', data.data.synced);
```

---

## Integration Flow

### Flutter App Integration

1. **On User Login:**
   - Call `/wallet/sync-hygraph` to migrate Hygraph balance (if first login)
   - Call `/wallet/balance` to display current balance

2. **After Razorpay Payment:**
   - Verify payment with Razorpay
   - Call `/wallet/add-shop-tokens` with payment details
   - Update UI with new balance

3. **During Product Purchase:**
   - Show available balance from `/wallet/balance`
   - Call `/wallet/deduct-shop-tokens` when user confirms purchase
   - Handle insufficient balance error gracefully

4. **Transaction History:**
   - Call `/wallet/transactions` with pagination
   - Display transaction list with filtering options

---

## Database Collections

### userwallets
Stores user wallet balances for quick access.

### wallettransactions
Stores all transaction records for audit trail.

See `WALLET_SYSTEM.md` for detailed schema information.

---

## Notes

- All token amounts are in Indian Rupees (₹)
- Transactions are atomic and use MongoDB transactions where needed
- Balance updates are immediate
- Transaction history is stored indefinitely for audit purposes
- The system supports both shop tokens and game tokens in a unified wallet
- Future implementation will add winnings tracking

---

## Support

For API support or issues, contact the backend team or create an issue in the repository.
