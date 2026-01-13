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

