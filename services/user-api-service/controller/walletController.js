const UserWallet = require('../../../models/userWalletModel');
const WalletTransaction = require('../../../models/walletTransactionModel');

/**
 * Get unified wallet balance
 * Returns shop tokens, game tokens, and total balance
 */
exports.getWalletBalance = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    
    let wallet = await UserWallet.findOne({ userId: userId.toString() });
    
    if (!wallet) {
      // Create wallet if doesn't exist
      wallet = await UserWallet.create({
        userId: userId.toString(),
        shopTokens: 0,
        gameTokens: 0,
        totalSpent: 0,
        totalAdded: 0,
        totalWithdrawn: 0,
      });
    }
    
    return res.json({
      success: true,
      status: true,
      balance: wallet.shopTokens || 0,      // Shop tokens (for purchases)
      bonus: wallet.gameTokens || 0,        // Game tokens (for contests)
      winning: 0,                            // Winnings (future implementation)
      totalamount: (wallet.shopTokens || 0) + (wallet.gameTokens || 0),
      data: {
        shopTokens: wallet.shopTokens || 0,
        gameTokens: wallet.gameTokens || 0,
        totalSpent: wallet.totalSpent || 0,
        totalAdded: wallet.totalAdded || 0,
        totalWithdrawn: wallet.totalWithdrawn || 0,
      },
    });
  } catch (error) {
    console.error('getWalletBalance Error:', error);
    return res.status(500).json({
      success: false,
      status: false,
      message: 'Error fetching wallet balance',
    });
  }
};

/**
 * Add shop tokens to wallet
 * Called after successful Razorpay payment
 */
exports.addShopTokens = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { amount, paymentId, orderId } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        status: false,
        message: 'Invalid amount',
      });
    }
    
    let wallet = await UserWallet.findOne({ userId: userId.toString() });
    
    if (!wallet) {
      wallet = await UserWallet.create({
        userId: userId.toString(),
        shopTokens: amount,
        gameTokens: 0,
        totalSpent: 0,
        totalAdded: amount,
        totalWithdrawn: 0,
      });
    } else {
      wallet.shopTokens += amount;
      wallet.totalAdded += amount;
      await wallet.save();
    }
    
    // Create transaction record
    await WalletTransaction.create({
      userId: userId.toString(),
      type: 'add_money',
      amount: amount,
      description: `Added ₹${amount} shop tokens via Razorpay`,
      paymentMethod: 'razorpay',
      module: 'shop',
      status: 'completed',
      balanceAfter: wallet.shopTokens,
      metadata: {
        razorpay_payment_id: paymentId,
        razorpay_order_id: orderId,
      },
    });
    
    console.log(`[WALLET] Added ${amount} shop tokens for user ${userId}, new balance: ${wallet.shopTokens}`);
    
    return res.json({
      success: true,
      status: true,
      message: 'Shop tokens added successfully',
      newBalance: wallet.shopTokens,
      data: {
        shopTokens: wallet.shopTokens,
        gameTokens: wallet.gameTokens,
        totalAdded: wallet.totalAdded,
      },
    });
  } catch (error) {
    console.error('addShopTokens Error:', error);
    return res.status(500).json({
      success: false,
      status: false,
      message: 'Error adding shop tokens',
    });
  }
};

/**
 * Deduct shop tokens from wallet
 * Called when user purchases products
 */
exports.deductShopTokens = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { amount, orderReference, description } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        status: false,
        message: 'Invalid amount',
      });
    }
    
    const wallet = await UserWallet.findOne({ userId: userId.toString() });
    
    if (!wallet) {
      return res.status(400).json({
        success: false,
        status: false,
        message: 'Wallet not found',
      });
    }
    
    if (wallet.shopTokens < amount) {
      return res.status(400).json({
        success: false,
        status: false,
        message: 'Insufficient shop tokens',
        required: amount,
        available: wallet.shopTokens,
        shortfall: amount - wallet.shopTokens,
      });
    }
    
    wallet.shopTokens -= amount;
    wallet.totalSpent += amount;
    await wallet.save();
    
    // Create transaction record
    await WalletTransaction.create({
      userId: userId.toString(),
      type: 'purchase',
      amount: -amount,
      description: description || `Product purchase - ₹${amount}`,
      orderReference: orderReference,
      paymentMethod: 'shopTokens',
      module: 'shop',
      status: 'completed',
      balanceAfter: wallet.shopTokens,
    });
    
    console.log(`[WALLET] Deducted ${amount} shop tokens for user ${userId}, new balance: ${wallet.shopTokens}`);
    
    return res.json({
      success: true,
      status: true,
      message: 'Shop tokens deducted successfully',
      newBalance: wallet.shopTokens,
      data: {
        shopTokens: wallet.shopTokens,
        totalSpent: wallet.totalSpent,
      },
    });
  } catch (error) {
    console.error('deductShopTokens Error:', error);
    return res.status(500).json({
      success: false,
      status: false,
      message: 'Error deducting shop tokens',
    });
  }
};

/**
 * Sync Hygraph wallet balance to MongoDB
 * One-time migration when user logs in for first time
 */
exports.syncHygraphBalance = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { hygraphBalance } = req.body;
    
    // Validate hygraphBalance
    if (typeof hygraphBalance !== 'number' || hygraphBalance < 0) {
      return res.status(400).json({
        success: false,
        status: false,
        message: 'Invalid hygraphBalance: must be a non-negative number',
      });
    }
    
    let wallet = await UserWallet.findOne({ userId: userId.toString() });
    
    if (!wallet) {
      // First time sync - create wallet with Hygraph balance
      wallet = await UserWallet.create({
        userId: userId.toString(),
        shopTokens: hygraphBalance || 0,
        gameTokens: 0,
        totalSpent: 0,
        totalAdded: hygraphBalance || 0,
        totalWithdrawn: 0,
        hygraphWalletId: req.body.hygraphWalletId || null,
        lastSyncedAt: new Date(),
      });
      
      // Create migration transaction record
      if (hygraphBalance > 0) {
        await WalletTransaction.create({
          userId: userId.toString(),
          type: 'admin_adjustment',
          amount: hygraphBalance,
          description: `Migrated from Hygraph - ₹${hygraphBalance}`,
          paymentMethod: 'admin',
          module: 'wallet',
          status: 'completed',
          balanceAfter: hygraphBalance,
          metadata: {
            source: 'hygraph_migration',
            migratedAt: new Date(),
          },
        });
      }
      
      console.log(`[WALLET] Synced ${hygraphBalance} from Hygraph for user ${userId}`);
    } else {
      // Wallet exists - only sync if Hygraph balance is higher
      if (hygraphBalance > wallet.shopTokens) {
        const diff = hygraphBalance - wallet.shopTokens;
        wallet.shopTokens = hygraphBalance;
        wallet.totalAdded += diff;
        wallet.lastSyncedAt = new Date();
        await wallet.save();
        
        // Create adjustment transaction
        await WalletTransaction.create({
          userId: userId.toString(),
          type: 'admin_adjustment',
          amount: diff,
          description: `Hygraph balance adjustment - ₹${diff}`,
          paymentMethod: 'admin',
          module: 'wallet',
          status: 'completed',
          balanceAfter: wallet.shopTokens,
          metadata: {
            source: 'hygraph_sync',
            syncedAt: new Date(),
          },
        });
        
        console.log(`[WALLET] Adjusted ${diff} from Hygraph sync for user ${userId}`);
      }
    }
    
    return res.json({
      success: true,
      status: true,
      message: 'Hygraph balance synced successfully',
      data: {
        shopTokens: wallet.shopTokens,
        synced: true,
      },
    });
  } catch (error) {
    console.error('syncHygraphBalance Error:', error);
    return res.status(500).json({
      success: false,
      status: false,
      message: 'Error syncing Hygraph balance',
    });
  }
};

/**
 * Get wallet transaction history
 * Returns paginated list of transactions
 */
exports.getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const transactions = await WalletTransaction.find({ 
      userId: userId.toString() 
    })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const totalCount = await WalletTransaction.countDocuments({ 
      userId: userId.toString() 
    });
    
    return res.json({
      success: true,
      status: true,
      data: transactions,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('getTransactionHistory Error:', error);
    return res.status(500).json({
      success: false,
      status: false,
      message: 'Error fetching transaction history',
    });
  }
};

/**
 * Get ONLY game tokens (for header display)
 * Fantasy app header shows only game tokens
 */
exports.getGameTokensOnly = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    
    let wallet = await UserWallet.findOne({ userId: userId.toString() });
    
    if (!wallet) {
      wallet = await UserWallet.create({
        userId: userId.toString(),
        gameTokens: 0,
      });
    }
    
    return res.json({
      success: true,
      status: true,
      gameTokens: wallet.gameTokens || 0,
    });
  } catch (error) {
    console.error('getGameTokensOnly Error:', error);
    return res.status(500).json({
      success: false,
      status: false,
      message: 'Error fetching game tokens',
    });
  }
};

/**
 * Get FULL wallet balance (both tokens)
 * Fantasy wallet screen shows both game and shop tokens
 */
exports.getWalletBalanceFull = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    
    let wallet = await UserWallet.findOne({ userId: userId.toString() });
    
    if (!wallet) {
      wallet = await UserWallet.create({
        userId: userId.toString(),
        shopTokens: 0,
        gameTokens: 0,
        totalSpent: 0,
        totalAdded: 0,
        totalWithdrawn: 0,
      });
    }
    
    return res.json({
      success: true,
      status: true,
      data: {
        gameTokens: wallet.gameTokens || 0,      // Editable - Fantasy manages
        shopTokens: wallet.shopTokens || 0,      // Read-only - From Shop
        totalSpent: wallet.totalSpent || 0,
        totalAdded: wallet.totalAdded || 0,
        totalWithdrawn: wallet.totalWithdrawn || 0,
      },
    });
  } catch (error) {
    console.error('getWalletBalanceFull Error:', error);
    return res.status(500).json({
      success: false,
      status: false,
      message: 'Error fetching full wallet balance',
    });
  }
};

/**
 * Get unified wallet history (both shop and game tokens)
 * Fantasy wallet screen shows transaction history of both tokens
 */
exports.getUnifiedHistory = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get all transactions for this user (both shop and game tokens)
    const transactions = await WalletTransaction.find({ userId: userId.toString() })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const totalCount = await WalletTransaction.countDocuments({ userId: userId.toString() });
    
    return res.json({
      success: true,
      status: true,
      data: {
        transactions: transactions,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
        },
      },
    });
  } catch (error) {
    console.error('getUnifiedHistory Error:', error);
    return res.status(500).json({
      success: false,
      status: false,
      message: 'Error fetching unified history',
    });
  }
};

/**
 * Sync shop tokens to Shop backend
 * Called after successful payment in Fantasy app
 * Notifies Shop backend to update Hygraph with new shop tokens
 */
exports.syncShopTokensToShop = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const hygraphUserId = req.user.hygraph_user_id || req.body.hygraph_user_id;
    const { amount, paymentId } = req.body;
    
    if (!hygraphUserId) {
      return res.status(400).json({
        success: false,
        status: false,
        message: 'hygraph_user_id not found',
      });
    }
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        status: false,
        message: 'Invalid amount',
      });
    }
    
    // Get current wallet
    const wallet = await UserWallet.findOne({ userId: userId.toString() });
    
    if (!wallet) {
      return res.status(400).json({
        success: false,
        status: false,
        message: 'Wallet not found',
      });
    }
    
    try {
      // Call Shop backend to sync shop tokens
      const shopBackendUrl = process.env.SHOP_BACKEND_URL || 'http://localhost:4001';
      const axios = require('axios');
      
      const syncResponse = await axios.post(
        `${shopBackendUrl}/api/wallet/receive-shop-tokens-from-fantasy`,
        {
          hygraph_user_id: hygraphUserId,
          shop_tokens: amount,
          transaction_id: paymentId,
          timestamp: new Date().toISOString(),
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': process.env.INTERNAL_API_SECRET,
          },
          timeout: 5000,
        }
      );
      
      if (syncResponse.data && syncResponse.data.success) {
        // Log successful sync
        console.log(`[SYNC] Shop tokens synced to Shop backend for user ${hygraphUserId}: ${amount}`);
        
        return res.json({
          success: true,
          status: true,
          message: 'Shop tokens synced to Shop app successfully',
          data: {
            shopTokensSynced: amount,
            shopResponse: syncResponse.data,
          },
        });
      } else {
        console.error('[SYNC ERROR] Shop backend returned error:', syncResponse.data);
        return res.status(500).json({
          success: true,
          status: true,
          message: 'Shop tokens added locally but Shop app sync delayed',
          warning: 'Shop app may need manual refresh',
          data: {
            shopTokensAdded: amount,
          },
        });
      }
    } catch (syncError) {
      console.error('[SYNC ERROR] Failed to sync to Shop backend:', syncError.message);
      // Still return success because tokens are added locally
      // Shop will sync when user logs in next time
      return res.json({
        success: true,
        status: true,
        message: 'Shop tokens added to wallet (Shop app sync pending)',
        warning: 'Shop app sync will happen on next login',
        data: {
          shopTokensAdded: amount,
          localBalance: wallet.shopTokens,
        },
      });
    }
  } catch (error) {
    console.error('syncShopTokensToShop Error:', error);
    return res.status(500).json({
      success: false,
      status: false,
      message: 'Error syncing shop tokens',
    });
  }
};

