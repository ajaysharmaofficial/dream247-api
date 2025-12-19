const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let adminLedgerSchema = new Schema({
    userid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    amount: {
        type: String,
    },
    bonustype: {
        type: String,
        default:null
    },
    description: {
        type: String,
    },
    moneytype: {
        type: String, 
    },
    is_deleted: {
        type: Boolean,
        default:false 
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin'
    },
    transactionId: {
        type: String,
        default: null
    },
    paymentstatus: {
        type: String,
        default: 'pending'  
    },
}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('adminledger', adminLedgerSchema);