# Unified Authentication System

## Overview

This document describes the unified authentication system that enables a single user account across both Shop and Fantasy modules with one JWT token valid for both backends.

## Architecture

### Components

1. **User Model** - Extended with unified auth fields
2. **JWT Token** - Enhanced with module and access control fields
3. **API Authentication Middleware** - Validates module access
4. **Internal Sync Endpoints** - For cross-backend user synchronization
5. **Migration Script** - Updates existing users

## Token Structure

The JWT token now includes the following claims:

```javascript
{
  _id: "user_mongodb_id",
  userId: "user_mongodb_id",
  mobile: "user_mobile_number",
  modules: ['shop', 'fantasy'],
  shop_enabled: true,
  fantasy_enabled: true
}
```

## User Sync Flow

### 1. User Registration/Login in Shop Backend

When a user registers or logs in via the Shop backend:

1. Shop backend calls Fantasy backend's internal sync endpoint
2. Fantasy backend creates/updates user record
3. Returns user_id to Shop backend
4. Shop backend generates JWT token with unified claims

### 2. User Sync Endpoint

**Endpoint:** `POST /api/user/internal/sync-user`

**Headers:**
- `x-internal-secret`: Internal API secret for authentication

**Request Body:**
```json
{
  "mobile": "1234567890",
  "hygraph_user_id": "shop_user_id",
  "shop_enabled": true,
  "fantasy_enabled": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "User synced successfully",
  "user_id": "mongodb_user_id"
}
```

### 3. Token Generation

After user sync, the Shop backend generates a JWT token:

```javascript
const token = jwt.sign(
  {
    _id: user._id,
    userId: user._id,
    mobile: user.mobile,
    modules: ['shop', 'fantasy'],
    shop_enabled: user.shop_enabled,
    fantasy_enabled: user.fantasy_enabled
  },
  process.env.SECRET_TOKEN,
  { expiresIn: '30d' }
);
```

## Module Access Control

### Middleware Validation

The `apiauth.js` middleware validates:

1. **Token validity** - Standard JWT verification
2. **Module inclusion** - Checks if 'fantasy' is in modules array
3. **Fantasy access** - Checks if fantasy_enabled is true

Example validation:

```javascript
// Check fantasy module access
if (!decoded.modules || !decoded.modules.includes('fantasy')) {
  return res.status(403).json({ 
    success: false, 
    status: false, 
    msg: 'Fantasy module not enabled for this account' 
  });
}

if (!decoded.fantasy_enabled) {
  return res.status(403).json({ 
    success: false, 
    status: false, 
    msg: 'Fantasy access disabled' 
  });
}
```

## Logout Flow

### Internal Logout Endpoint

**Endpoint:** `POST /api/user/internal/logout`

**Headers:**
- `x-internal-secret`: Internal API secret for authentication

**Request Body:**
```json
{
  "user_id": "mongodb_user_id",
  "token": "jwt_token"
}
```

**Process:**
1. Clears Redis cache for the user
2. Nullifies auth_key in MongoDB
3. Returns success response

**Response:**
```json
{
  "success": true,
  "message": "User logged out successfully"
}
```

### Cross-Backend Logout

When a user logs out from either backend:

1. Backend calls its own logout endpoint
2. Backend calls internal logout endpoint on other backend
3. Both backends invalidate the token and clear caches

## Environment Variables

Required environment variables:

```env
# MongoDB Connection
MONGO_URI=mongodb://...
MONGODB_URI=mongodb://...

# JWT Secret
SECRET_TOKEN=your-shared-secret-key-here

# Internal API Authentication
INTERNAL_API_SECRET=your-strong-random-secret-here

# Shop Backend URL (for Fantasy to call)
SHOP_API_URL=https://shop-api.yourdomain.com
```

## Database Migration

To migrate existing users, run the migration script:

```bash
node scripts/migrate-unified-auth.js
```

This will:
- Add `shop_enabled: true` to all users
- Add `fantasy_enabled: true` to all users
- Add `modules: ['shop', 'fantasy']` to all users

## Security Considerations

1. **Internal API Secret** - Must be strong and kept secure
2. **Secret Token** - Must be the same across both backends
3. **Token Expiration** - Consider implementing refresh tokens for better security
4. **HTTPS Only** - All communications should use HTTPS
5. **Rate Limiting** - Implement rate limiting on sync endpoints

## Error Handling

### Common Errors

1. **403 Forbidden** - Invalid internal API secret
2. **403 Fantasy module not enabled** - User doesn't have fantasy in modules
3. **403 Fantasy access disabled** - User's fantasy_enabled is false
4. **401 Invalid Token** - JWT verification failed
5. **500 Internal Server Error** - Sync or logout operation failed

## Testing Checklist

- [ ] Test user sync with valid secret
- [ ] Test user sync with invalid secret
- [ ] Test token generation includes all required fields
- [ ] Test middleware blocks access when fantasy not in modules
- [ ] Test middleware blocks access when fantasy_enabled is false
- [ ] Test internal logout clears cache and invalidates token
- [ ] Test cross-backend logout flow
- [ ] Run migration script on staging database
- [ ] Test backward compatibility with existing tokens

## API Examples

### Sync User Example (cURL)

```bash
curl -X POST https://fantasy-api.yourdomain.com/api/user/internal/sync-user \
  -H "Content-Type: application/json" \
  -H "x-internal-secret: your-secret-here" \
  -d '{
    "mobile": "1234567890",
    "hygraph_user_id": "shop_user_123",
    "shop_enabled": true,
    "fantasy_enabled": true
  }'
```

### Internal Logout Example (cURL)

```bash
curl -X POST https://fantasy-api.yourdomain.com/api/user/internal/logout \
  -H "Content-Type: application/json" \
  -H "x-internal-secret: your-secret-here" \
  -d '{
    "user_id": "mongodb_user_id",
    "token": "jwt_token_here"
  }'
```

## Token Management Endpoints

### Token Validation

**Endpoint:** `POST /api/user/validate-token`

Validate JWT token and check its status.

**Request:**
```json
{
  "token": "jwt-token-here"
}
```

**Response (Valid):**
```json
{
  "success": true,
  "valid": true,
  "message": "Token is valid",
  "user": {
    "id": "user-mongodb-id",
    "mobile": 9876543210,
    "modules": ["shop", "fantasy"],
    "fantasy_enabled": true,
    "shop_enabled": true,
    "expiresAt": "2024-12-31T23:59:59.000Z"
  }
}
```

**Response (Invalid):**
```json
{
  "success": true,
  "valid": false,
  "message": "Invalid or expired token"
}
```

### Token Refresh

**Endpoint:** `POST /api/user/refresh-token`

Generate new access token using refresh token.

**Request:**
```json
{
  "refreshToken": "refresh-token-here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "token": "new-access-token-here",
  "user": {
    "id": "user-id",
    "mobile": 9876543210,
    "modules": ["shop", "fantasy"],
    "fantasy_enabled": true,
    "shop_enabled": true
  }
}
```

## Token Lifecycle

1. **Login/Signup:** User receives:
   - Access token (15 minutes expiry)
   - Refresh token (30 days expiry)
2. **API Calls:** Use access token in Authorization header
3. **Token Expiry:** After 15 minutes, access token expires
4. **Refresh:** Call `/api/user/refresh-token` with refresh token to get new access token
5. **Logout:** Both tokens are invalidated
6. **Refresh Token Expiry:** After 30 days, user must re-login

## Security Improvements

- **Short-lived access tokens:** Reduces risk if token is compromised (15 minutes)
- **Long-lived refresh tokens:** Better UX, no forced re-login every 15 minutes (30 days)
- **Token validation endpoint:** Frontend can verify token health
- **Revocation support:** Refresh tokens can be invalidated on logout
- **Token expiration:** All new tokens have expiration times for better security

## Support

For issues or questions, contact the development team.
