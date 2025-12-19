const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let tdsDataSchema = new Schema({
    openingBalance: {
        type: Number,
        default: 0
    },
    userid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        index: true
    },
    net_withdraw_amount: {
        type: Number,
        default: 0
    },
    total_tds_imposed: {
        type: Number,
        default: 0
    },
    net_deposit_amount: {
        type: Number,
        default: 0
    },
    net_profit: {
        type: Number,
        default: 0
    },
    financial_report: [
        {
            financial_year: { type: String },
            tdsAlreadyPaid: { type: Number, default: 0 },
            tdsToBeDeducted: { type: Number, default: 0 },
            successDeposit: { type: Number, default: 0 },
            successWithdraw: { type: Number, default: 0 },
            netWin: { type: Number, default: 0 },
            openingBalance: { type: Number, default: 0 },
            closingBalance: { type: Number, default: 0 },
            tdsStatus: {
                type: Boolean,
                default: false
            }
        }
    ]
}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('tdsdata', tdsDataSchema);