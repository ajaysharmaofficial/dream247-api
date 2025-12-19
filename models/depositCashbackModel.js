const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let depositCashbackSchema = new Schema({
    userid: {
        type: mongoose.Types.ObjectId,
        ref: 'user'
    },
    bonus: {
        type: Number,
        default: 0
    },
    transaction_id: {
        type: String
    },
    type: {
        type: String,
        default: ''
    },
    deposit_id: {
        type: mongoose.Types.ObjectId,
        ref: 'paymentprocess'
    },
    expiresAt: {
        type: Date
    },
    expired: {
        type: Boolean,
        default: false
    },
    is_deleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('depositcashback', depositCashbackSchema);


