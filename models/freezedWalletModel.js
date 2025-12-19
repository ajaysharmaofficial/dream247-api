const mongoose = require('mongoose');
const Schema = mongoose.Schema;
let lockedbalance = new Schema({
    balance: {
        type: Number,
        default: 0
    },
    winning: {
        type: Number,
        default: 0
    },
    bonus: {
        type: Number,
        default: 0
    },
    created_at: {
        type: Date
    },
    updated_at: {
        type: Date
    }
});
let freezedWalletSchema = new Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    lockedbalance: lockedbalance,
    transactionId: {
        type: String,
        ref: 'transaction'
    },
    isHold: {
        type: Boolean,
        default: true
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin'
    },
    reason: {
        type: String,
        default: ''
    }
}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('freezedwallet', freezedWalletSchema);