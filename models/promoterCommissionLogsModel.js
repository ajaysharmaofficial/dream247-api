const mongoose = require("mongoose");

const promoterCommissionLogsSchema = new mongoose.Schema(
    {
        promoterId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: true,
            index: true
        },

        // From which user commission came (nullable)
        fromUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            default: null
        },

        // CREDIT | DEBIT
        transactionType: {
            type: String,
            enum: ["CREDIT", "DEBIT"],
            required: true
        },

        // COMMISSION | WITHDRAW | ADJUSTMENT
        reason: {
            type: String,
            enum: ["COMMISSION", "WITHDRAW", "ADJUSTMENT"],
            required: true
        },

        // Related deposit / withdraw txn id
        referenceTxnId: {
            type: String,
            default: null
        },

        percentage: {
            type: Number,
            default: null // 10% etc (only for commission)
        },

        amount: {
            type: Number,
            required: true
        },

        balanceBefore: {
            type: Number,
            required: true
        },

        balanceAfter: {
            type: Number,
            required: true
        },

        status: {
            type: String,
            enum: ["SUCCESS", "PENDING", "FAILED"],
            default: "SUCCESS"
        },

        remark: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "promoterCommissionLogs",
    promoterCommissionLogsSchema
);