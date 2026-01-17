const userService = require('../services/userService.js');
const configModel = require("../../../models/configModel.js");
const TransactionModel = require("../../../models/walletTransactionModel.js");
const userModel = require("../../../models/userModel.js");
const redisUser = require("../../../utils/redis/redisUser.js");
exports.dbCheck = async (req, res) => {
    try {
        const data = await userService.dbCheck();

        if (data && data.status) {
            return res.status(200).json({ data });
        } else {
            return res.status(200).json({ data });
        }
    } catch (error) {
        console.error("Error:", error);
        return res.status(200).json({ data });
    }
}

exports.getVersion = async (req, res) => {
    try {
        const data = await userService.getVersion(req);
        // console.log(data)

        if (data) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data,
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}

/**
 * @deprecated - OTP verification is now handled by Shop backend
 * Fantasy app receives verified users via /internal/sync-user or /login endpoints
 */
exports.addTempUser = async (req, res) => {
    try {
        const data = await userService.addTempUser(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data,
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
};

exports.verifyOtp = async (req, res) => {
    try {
        const data = await userService.verifyOtp(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data,
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}
/**
 * @deprecated - OTP verification is now handled by Shop backend
 * Use /login endpoint after user is synced via /internal/sync-user
 */
exports.logout = async (req, res) => {
    try {
        const data = await userService.logout(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data,
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}

/**
 * @deprecated - OTP verification is now handled by Shop backend
 * OTP resend is no longer needed in Fantasy app
 */
exports.otpResend = async (req, res) => {
    try {
        const data = await userService.otpResend(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data,
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}

exports.userCompleteDetails = async (req, res) => {
    try {
        const data = await userService.userCompleteDetails(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data,
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}

exports.uploadUserProfileImage = async (req, res) => {
    try {
        const data = await userService.uploadUserProfileImage(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data,
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}

exports.userRefferals = async (req, res) => {
    try {
        const data = await userService.userRefferals(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data,
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}

exports.getUserReferCode = async (req, res) => {
    try {
        const data = await userService.getUserReferCode(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data,
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}

exports.editUserProfile = async (req, res) => {
    try {
        const data = await userService.editUserProfile(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data,
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}

exports.myRedisTransaction = async (req, res) => {
    try {
        const data = await userService.myRedisTransaction(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data,
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}

exports.userOwnTransactions = async (req, res) => {
    try {
        const data = await userService.userOwnTransactions(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data,
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}

exports.myDetailedTransactions = async (req, res) => {
    try {
        const data = await userService.myDetailedTransactions(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data,
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}

exports.editUserTeamName = async (req, res) => {
    try {
        const data = await userService.editUserTeamName(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data,
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}

exports.contestWonUpdate = async (req, res) => {
    try {
        const data = await userService.contestWonUpdate(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data,
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}

exports.fetchUserLevelData = async (req, res) => {
    try {
        const data = await userService.fetchUserLevelData(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data,
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}

exports.helpDeskMail = async (req, res) => {
    try {

        const data = await userService.helpDeskMail(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data,
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}

exports.updateUserDataInRedis = async (req, res) => {
    try {
        const data = await userService.updateUserDataInRedis(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}

exports.userWalletDetails = async (req, res) => {
    try {
        const data = await userService.userWalletDetails(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}


exports.updateAllUserBalnace = async (req, res) => {
    try {
        const data = await redisUser.syncWalletFromDBNew(req.query.userId);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}


exports.usersDetailedTransaction = async (req, res) => {
    try {
        const data = await userService.usersDetailedTransaction(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}


exports.MaintenanceCheck = async (req, res) => {
    try {
        const data = await userService.MaintenanceCheck(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}

/**
 * @deprecated - OTP verification is now handled by Shop backend
 * Use /login endpoint after user is synced via /internal/sync-user
 */
exports.verifyPhoneAndGetToken = async (req, res) => {
    try {
        const data = await userService.verifyPhoneAndGetToken(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data,
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}

exports.syncUserFromShop = async (req, res) => {
  try {
    const data = await userService.syncUserFromShop(req);
    if (data && data.status) {
      return res.status(200).json({
        success: true,
        message: data.message,
        user_id: data.user_id,
      });
    } else {
      return res.status(200).json({
        success: false,
        message: data.message,
      });
    }
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      success: false,
      message: "User sync failed",
    });
  }
};

exports.shopVerifiedLogin = async (req, res) => {
  try {
    const data = await userService.shopVerifiedLogin(req);
    if (data && data.status) {
      return res.status(200).json({
        success: true,
        message: data.message,
        user_id: data.user_id,
        auth_key: data.auth_key,
        refresh_token: data.refresh_token,
        user: data.user
      });
    } else {
      return res.status(200).json({
        success: false,
        message: data.message,
      });
    }
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
};

exports.internalLogout = async (req, res) => {
  try {
    const data = await userService.internalLogout(req);
    if (data && data.status) {
      return res.status(200).json({
        success: true,
        message: data.message,
      });
    } else {
      return res.status(200).json({
        success: false,
        message: data.message,
      });
    }
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal logout failed",
    });
  }
};

exports.validateToken = async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Token is required'
      });
    }
    
    try {
      // Use jose library for consistency with token generation
      const { jwtVerify } = await import('jose');
      const secret = Buffer.from(global.constant.SECRET_TOKEN);
      const { payload: decoded } = await jwtVerify(token, secret);
      
      // Check fantasy module access
      if (!decoded.modules || !decoded.modules.includes('fantasy')) {
        return res.json({
          success: true,
          valid: false,
          message: 'Fantasy module not enabled for this account'
        });
      }
      
      if (decoded.fantasy_enabled === false) {
        return res.json({
          success: true,
          valid: false,
          message: 'Fantasy access disabled'
        });
      }
      
      // Get user from MongoDB
      const user = await userModel.findById(decoded._id);
      
      if (!user) {
        return res.json({
          success: true,
          valid: false,
          message: 'User not found'
        });
      }
      
      if (user.status === 'blocked') {
        return res.json({
          success: true,
          valid: false,
          message: 'User is blocked'
        });
      }
      
      // Token is valid
      return res.json({
        success: true,
        valid: true,
        message: 'Token is valid',
        user: {
          id: user._id,
          mobile: user.mobile,
          modules: decoded.modules || ['shop', 'fantasy'],
          fantasy_enabled: decoded.fantasy_enabled !== false,
          shop_enabled: decoded.shop_enabled !== false,
          expiresAt: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null
        }
      });
    } catch (jwtError) {
      console.error('JWT Validation Error:', jwtError.message);
      return res.json({
        success: true,
        valid: false,
        message: 'Invalid or expired token'
      });
    }
  } catch (error) {
    console.error('Error in validate-token:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }
    
    try {
      // Use jose library for consistency with token generation
      const { jwtVerify } = await import('jose');
      const secret = Buffer.from(global.constant.SECRET_TOKEN);
      const { payload: decoded } = await jwtVerify(refreshToken, secret);
      
      // Ensure it's a refresh token
      if (decoded.type !== 'refresh') {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token type'
        });
      }
      
      // Get user from MongoDB
      const user = await userModel.findById(decoded.userId);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }
      
      if (user.status === 'blocked') {
        return res.status(401).json({
          success: false,
          message: 'User is blocked'
        });
      }
      
      // Verify stored refresh token matches using constant-time comparison
      const crypto = require('crypto');
      const storedToken = Buffer.from(user.refresh_token || '', 'utf8');
      const providedToken = Buffer.from(refreshToken, 'utf8');
      
      // Only compare if both tokens have the same length to avoid timing attacks
      if (storedToken.length !== providedToken.length || 
          !crypto.timingSafeEqual(storedToken, providedToken)) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token has been revoked. Please login again.'
        });
      }
      
      // Generate new access token
      const { SignJWT } = await import('jose');
      
      const newAccessToken = await new SignJWT({
        _id: user._id.toString(),
        userId: user._id.toString(),
        mobile: user.mobile,
        modules: user.modules || ['shop', 'fantasy'],
        shop_enabled: user.shop_enabled !== false,
        fantasy_enabled: user.fantasy_enabled !== false
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('15m')  // 15 minutes
        .setIssuedAt()
        .sign(secret);
      
      // Update user's access token in MongoDB
      await userModel.findByIdAndUpdate(user._id, {
        auth_key: newAccessToken
      });
      
      // Clear Redis cache for user to refresh data
      await redisUser.deletedata(`user:${user._id.toString()}`);
      
      res.json({
        success: true,
        message: 'Token refreshed successfully',
        token: newAccessToken,
        user: {
          id: user._id,
          mobile: user.mobile,
          modules: user.modules || ['shop', 'fantasy'],
          fantasy_enabled: user.fantasy_enabled !== false,
          shop_enabled: user.shop_enabled !== false
        }
      });
    } catch (jwtError) {
      console.error('Refresh Token Error:', jwtError.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token. Please login again.'
      });
    }
  } catch (error) {
    console.error('Error in refresh-token:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
