const paymentServices = require('../services/paymentService');
const configModel = require("../../../models/configModel");
const WithdrawModel = require("../../../models/payoutModel.js");
const TransactionModel = require("../../../models/walletTransactionModel.js");
const userModel = require("../../../models/userModel.js");
const axios = require('axios');

exports.dbHealthCheck = async (req, res) => {
    try {
        const data = await paymentServices.dbHealthCheck();

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

exports.requestWithdraw = async (req, res, next) => {
    try {
        let getTdsAmountDeductStatus = await configModel.find();
        let data;
        if (getTdsAmountDeductStatus[0].tds == 1) {
            data = await paymentServices.requestWithdraw(req);
        } else {
            data = await paymentServices.requestWithdrawWithOutTds(req);
        }

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

exports.requestWithdrawNewKafkaJune = async (req, res, next) => {
    try {
        let getTdsAmountDeductStatus = await configModel.find();
        let data;
        // if (getTdsAmountDeductStatus[0].tds == 1) {
        //     data = await paymentServices.requestWithdrawNewKafkaJune(req);
        // } else {
        data = await paymentServices.requestWithdrawNewKafkaJune(req);
        // }

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

exports.tdsDeductionDetails = async (req, res, next) => {
    try {
        let data = await paymentServices.tdsDeductionDetails(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data,
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data?.message,
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

exports.tdsDeductionDetailsNew = async (req, res, next) => {
    try {
        let data = await paymentServices.tdsDeductionDetailsNew(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data,
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data?.message,
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

exports.tdsDashboard = async (req, res, next) => {
    try {
        let data = await paymentServices.tdsDashboard(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data,
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data?.message,
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

exports.tdsHistory = async (req, res, next) => {
    try {
        let data = await paymentServices.tdsHistory(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data,
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data?.message,
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

exports.withdrawWithTDSdeduction = async (req, res, next) => {
    try {
        let data = await paymentServices.withdrawWithTDSdeduction(req);

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

exports.requestWithdrawTesting = async (req, res, next) => {
    try {
        let getTdsAmountDeductStatus = await configModel.find();
        let data;
        if (getTdsAmountDeductStatus[0].tds == 1) {
            data = await paymentServices.requestwithdrawTesting(req);
        } else {
            data = await paymentServices.requestWithdrawWithOutTdsTesting(req);
        }

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

exports.requestWithdrawKafka = async (req, res, next) => {
    try {
        let getTdsAmountDeductStatus = await configModel.find();
        let data;
        if (getTdsAmountDeductStatus[0].tds == 1) {
            data = await paymentServices.requestwithdrawKafka(req);
        } else {
            data = await paymentServices.requestWithdrawWithOutTdsKafka(req);
        }

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

exports.webhookDetail = async (req, res, next) => {
    try {
        const data = await paymentServices.webhookDetail(req);

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

exports.webhookDetailNew = async (req, res, next) => {
    try {
        const data = await paymentServices.webhookDetailNew(req);

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

exports.financialTDSdeduction = async (req, res, next) => {
    try {
        const data = await paymentServices.financialTDSdeduction(req);

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

exports.razorpayXpayoutStatus = async (req, res, next) => {
    try {
        const RAZORPAY_KEY = '';
        const RAZORPAY_SECRET = '';

        // Encode API Key and Secret for Basic Auth
        const authHeader = `Basic ${Buffer.from(`${RAZORPAY_KEY}:${RAZORPAY_SECRET}`).toString('base64')}`;

        const url = `https://api.razorpay.com/v1/payouts/${req.params.payoutId}`;

        try {
            const response = await axios.get(url, {
                headers: {
                    Authorization: authHeader,
                },
            });

            if (response) {
                // Log the response
                console.log('Payout Status:', response.data);

                let payoutEntity = response.data;
                let eventType = response.data.status;
                switch (eventType) {
                    case "initiated":
                        console.log("Payout Initiated Event:", payoutEntity);
                        // Update the withdrawal request to reflect that it has been initiated
                        await WithdrawModel.updateOne(
                            { withdraw_req_id: payoutEntity.reference_id },
                            { status: 0, updatedAt: new Date(), withdrawfrom: "RazorPay-X", status_description: payoutEntity.status }
                        );
                        await TransactionModel.updateOne(
                            { transaction_id: payoutEntity.reference_id },
                            { paymentstatus: "initiated" }
                        );
                        break;

                    case "processed":
                        // console.log("Payout Processed Event:", payoutEntity);
                        const checkWithdrawal = await WithdrawModel.findOne({
                            withdraw_req_id: payoutEntity.reference_id,
                            status: 1
                        });
                        if (checkWithdrawal) {
                            return res.status(200).json({ message: "Withdrawal record have already done" });
                        }

                        // Update the withdrawal request to completed
                        await WithdrawModel.updateOne(
                            { withdraw_req_id: payoutEntity.reference_id },
                            {
                                status: 1, // Successful
                                updatedAt: new Date(),
                                utr: payoutEntity.utr,
                                withdrawfrom: "RazorPay-X",
                                status_description: payoutEntity.status
                            }
                        );
                        await TransactionModel.updateOne(
                            { transaction_id: payoutEntity.reference_id },
                            { paymentstatus: "confirmed" }
                        );
                        break;

                    case "failed":
                        console.log("Payout Failed Event:", payoutEntity);

                        // Find the original withdrawal record
                        const withdrawalStatus = await WithdrawModel.findOne({
                            withdraw_req_id: payoutEntity.reference_id,
                            status: 2
                        });

                        if (withdrawalStatus) {
                            return res.status(200).json({ message: "Withdrawal record have already failed" });
                        }

                        const withdrawal = await WithdrawModel.findOne({
                            withdraw_req_id: payoutEntity.reference_id
                        });

                        if (withdrawal) {
                            console.log("withdrawal", withdrawal);
                            const refundAmount = withdrawal.amount;

                            // Refund the amount to the user's winning balance
                            const userUpdate = await userModel.findOneAndUpdate(
                                { _id: withdrawal.userid },
                                { $inc: { "userbalance.winning": refundAmount } },
                                { new: true }
                            );

                            // Update the withdrawal request to failed
                            await WithdrawModel.updateOne(
                                { withdraw_req_id: payoutEntity.reference_id },
                                {
                                    status: 2, // Failed
                                    updatedAt: new Date(),
                                    withdrawfrom: "RazorPay-X",
                                    status_description: payoutEntity.status
                                }
                            );

                            // Create a new transaction for the refund
                            const refundTransaction = {
                                userid: withdrawal.userid,
                                amount: refundAmount,
                                withdraw_amt: 0,
                                cons_win: refundAmount,
                                transaction_id: `REFUND-${Date.now()}`,
                                type: "Amount Withdraw Refund",
                                transaction_by: "system",
                                paymentstatus: "confirmed",
                                bal_fund_amt: userUpdate.userbalance.balance.toFixed(2),
                                bal_win_amt: userUpdate.userbalance.winning.toFixed(2),
                                bal_bonus_amt: userUpdate.userbalance.bonus.toFixed(2),
                                total_available_amt: (
                                    userUpdate.userbalance.balance +
                                    userUpdate.userbalance.bonus +
                                    userUpdate.userbalance.winning
                                ).toFixed(2),
                            };

                            await TransactionModel.create(refundTransaction);

                        }

                        break;

                    case "reversed":
                        console.log("Payout Reversed Event:", payoutEntity);

                        // Find the original withdrawal record
                        const reversedWithdrawalStatus = await WithdrawModel.findOne({
                            withdraw_req_id: payoutEntity.reference_id,
                            status: 3
                        });

                        if (reversedWithdrawalStatus) {
                            return res.status(200).json({ message: "Withdrawal record have already reversed" });
                        }

                        const reversedWithdrawal = await WithdrawModel.findOne({
                            withdraw_req_id: payoutEntity.reference_id
                        });

                        if (reversedWithdrawal) {
                            const reversedAmount = reversedWithdrawal.amount;

                            // Refund the reversed amount to the user's winning balance
                            const reversedUserUpdate = await userModel.findOneAndUpdate(
                                { _id: reversedWithdrawal.userid },
                                { $inc: { "userbalance.winning": reversedAmount } },
                                { new: true }
                            );

                            if (!reversedUserUpdate) {
                                return res.status(500).json({ message: "Failed to refund user for payout reversal" });
                            }

                            // Update the withdrawal request to indicate reversal
                            await WithdrawModel.updateOne(
                                { withdraw_req_id: payoutEntity.reference_id },
                                {
                                    status: 3, // Reversed
                                    updatedAt: new Date(),
                                    withdrawfrom: "RazorPay-X",
                                    status_description: payoutEntity.status
                                }
                            );

                            // Create a transaction for the refund
                            const reversalTransaction = {
                                userid: reversedWithdrawal.userid,
                                amount: reversedAmount,
                                withdraw_amt: 0,
                                cons_win: reversedAmount,
                                transaction_id: `REVERSAL-${Date.now()}`,
                                type: "Amount Withdraw Refund",
                                transaction_by: "system",
                                paymentstatus: "confirmed",
                                bal_fund_amt: reversedUserUpdate.userbalance.balance.toFixed(2),
                                bal_win_amt: reversedUserUpdate.userbalance.winning.toFixed(2),
                                bal_bonus_amt: reversedUserUpdate.userbalance.bonus.toFixed(2),
                                total_available_amt: (
                                    reversedUserUpdate.userbalance.balance +
                                    reversedUserUpdate.userbalance.bonus +
                                    reversedUserUpdate.userbalance.winning
                                ).toFixed(2),
                            };

                            await TransactionModel.create(reversalTransaction);
                        }

                        break;
                    default:
                        console.log("Unhandled Webhook Event Type:", eventType);
                        break;
                }

                res.status(200).json({
                    success: true,
                    message: "Payout status processed successfully",
                    data: payoutEntity
                });
            }
        } catch (error) {
            // Check if the error is an HTTP error
            if (error.response) {
                console.error('Error Response:', {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    data: error.response.data,
                });

                // Send a proper error response to the client
                res.status(error.response.status).json({
                    success: false,
                    message: error.response.data.error?.description || 'An error occurred while fetching payout status.',
                });
            } else {
                // Handle other types of errors (e.g., network issues)
                console.error('Error:', error.message);

                res.status(500).json({
                    success: false,
                    message: 'Internal Server Error. Please try again later.',
                });
            }
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
};

exports.razorpayXpayoutStatusCheck = async (req, res) => {
    try {
        const RAZORPAY_KEY = '';
        const RAZORPAY_SECRET = '';

        // Encode API Key and Secret for Basic Auth
        const authHeader = `Basic ${Buffer.from(`${RAZORPAY_KEY}:${RAZORPAY_SECRET}`).toString('base64')}`;

        const url = `https://api.razorpay.com/v1/payouts/${req.params.payoutId}`;

        try {
            const response = await axios.get(url, {
                headers: {
                    Authorization: authHeader,
                },
            });

            if (response) {
                // Log the response
                console.log('Payout Status:', response.data);

                let payoutEntity = response.data;
                let eventType = response.data.status;

                if (!payoutEntity) {
                    console.error("Payout entity is undefined for eventType:", eventType);
                    res.status(200).json({
                        success: false,
                        message: `"Payout entity is undefined for eventType: ${eventType}`
                    });
                }

                res.status(200).json({
                    success: true,
                    message: "Payout status processed successfully",
                    data: payoutEntity
                });
            }
        } catch (error) {
            // Check if the error is an HTTP error
            if (error.response) {
                console.error('Error Response:', {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    data: error.response.data,
                });

                // Send a proper error response to the client
                res.status(error.response.status).json({
                    success: false,
                    message: error.response.data.error?.description || 'An error occurred while fetching payout status.',
                });
            } else {
                // Handle other types of errors (e.g., network issues)
                console.error('Error:', error.message);

                res.status(500).json({
                    success: false,
                    message: 'Internal Server Error. Please try again later.',
                });
            }
        }
    } catch (error) {
        console.log('Unexpected Error:', error);

        // Send a fallback error response
        res.status(500).json({
            success: false,
            message: 'Something went wrong. Please contact support.',
        });
    }
}

exports.withdrawP2Pvalidation = async (req, res, next) => {
    try {
        const data = await paymentServices.withdrawP2Pvalidation(req);

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

exports.withdrawP2Ptransfer = async (req, res, next) => {
    try {
        const data = await paymentServices.withdrawP2Ptransfer(req);

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

exports.withdrawP2PtransferNew = async (req, res, next) => {
    try {
        const data = await paymentServices.withdrawP2PtransferNew(req);

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


exports.sendOTPP2p = async (req, res, next) => {
    try {
        const data = await paymentServices.sendOTPP2p(req);

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


exports.refundSuspiciousWithdraw = async (req, res, next) => {
    try {
        const data = await paymentServices.refundSuspiciousWithdraw(req);

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

