const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let Transaction = new Schema({
    userid: {
        type: mongoose.Types.ObjectId,
        ref: 'user'
    },
    type: {
        type: String,
        default: ''
    },
    transaction_id: {
        type: String
    },
    transaction_by: {
        type: String,
        default: process.env.APP_NAME
    },
    amount: {
        type: Number,
        default: 0
    },
    prize: {
        type: String,
        default: ""
    },
    paymentstatus: {
        type: String,
        default: 'confirmed'
    },
    contestdetail: {
        type: String,
        default: '0'
    },
    challengeid: {
        type: mongoose.Types.ObjectId,
        ref: 'matchchallenge', //MatchChallenge,
        index: true,
        default: null
    },
    seriesid: {
        type: mongoose.Types.ObjectId,
        ref: 'series' //Series
    },
    giftType: {
        type: String,
        default: ''
    },
    joinid: {
        type: mongoose.Types.ObjectId,
        ref: 'joinedleauge', //Joinedleauge,
        index: true
    },
    bonus_amt: {
        type: Number,
        default: 0
    },
    win_amt: {
        type: Number,
        default: 0
    },
    addfund_amt: {
        type: Number,
        default: 0
    },
    bal_bonus_amt: {
        type: Number,
        default: 0
    },
    bal_win_amt: {
        type: Number,
        default: 0
    },
    bal_fund_amt: {
        type: Number,
        default: 0
    },
    extra_fund_amt: {
        type: Number,
        default: 0
    },
    total_available_amt: {
        type: Number,
        default: 0
    },
    challenge_join_amt: {
        type: Number,
        default: 0
    },
    withdraw_amt: {
        type: Number,
        default: 0
    },
    withdrawId: {
        type: String
    },
    cons_bonus: {
        type: Number,
        default: 0
    },
    cons_win: {
        type: Number,
        default: 0
    },
    cons_amount: {
        type: Number,
        default: 0
    },
    rp_transaction_id: {
        type: String,
        default: "N/A"
    },
    coin: {
        type: Number
    },
    is_deleted: {
        type: Boolean,
        default: false
    },
    referredUser: {
        type: mongoose.Types.ObjectId,
        ref: 'user',
        index: true
    },
    tdsStatus: {
        type: Number,
        default: 0
    },
    tdsRefund: {
        type: Number,
        default: 0
    }

}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('wallettransactions', Transaction);