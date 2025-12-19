const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let depositSchema = new Schema({
    userid: {
        type: mongoose.Types.ObjectId,
        ref: 'user'
    },
    offerid: {
        type: String,
        default: ''
    },
    paymentmethod: {
        type: String,
        default: ''
    },
    amount: {
        type: Number,
        default: 0
    },
    orderid: {
        type: String,
        default: ''
    },
    txnid: {
        type: String,
        default: ''
    },
    returnid: {
        type: String,
        default: ''
    },
    pay_id: {
        type: String,
        default: 'N/A'
    },
    rp_transaction_id: {
        type: String,
        default: 'N/A'
    },
    utr: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        default: 'pending'
    },
    gst_amount: {
        type: Number
    },
    bonus_txn: {
        type: String,
        default: ''
    }
}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('deposit', depositSchema);