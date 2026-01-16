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

