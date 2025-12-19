const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const constant = require('../config/const_credential');

let payoutSchema = new Schema({
    userid: {
        type: mongoose.Types.ObjectId,
        ref: 'user',
        index: true
    },
    amount: {
        type: Number,
        default: 0
    },
    beneld: {
        type: String,
        default: null
    },
    transfer_id: {
        type: String,
        default: null
    },
    payout_id: {
        type: String,
        default: ''
    },
    withdraw_req_id: {
        type: String,
        default: null
    },
    comment: {
        type: String,
        default: ''
    },
    approved_date: {
        type: String,
    },
    status: {
        type: Number,
        default: 0
    },
    status_description: {
        type: String,
        default: ""
    },
    type: {
        type: String,
        default: null
    },
    paytm_number: {
        type: Number,
        default: null
    },
    withdrawfrom: {
        type: String,
        default: null
    },
    utr: {
        type: String,
        default: 0
    },
    tds_amount: {
        type: Number,
        default: 0
    },
    available_amount: {
        type: Number,
        default: 0
    },
    is_deleted: {
        type: Boolean,
        default: false
    },
    reason: {
        type: String,
        default: ""
    },
    fees: {
        type: Number,
        default: 0
    },
    tax: {
        type: Number,
        default: 0
    },
    receivedTime: {
        type: Date
    },
    payoutTime: {
        type: Date
    },
    idempotency_key: {
        type: String,
        default: ""
    },
    tds_approved: {
        type: Boolean
    }

}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('payout', payoutSchema);