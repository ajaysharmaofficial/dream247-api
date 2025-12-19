const mongoose = require('mongoose');
const Schema = mongoose.Schema;


let p2pSchema = new Schema({
    user_id: {
        type: mongoose.Types.ObjectId,
        ref: 'user',
        index: true
    },
    receiver_id: {
        type: mongoose.Types.ObjectId,
        ref: 'user',
        index: true
    },
    withdrawTransactionId: {
        type: String,
        index: true
    },
    depositTransactionId: {
        type: String,
        index: true
    },
    cashbackTransactionId: {
        type: String,
        index: true
    },
    requestedAmount:{
        type: Number
    },
    totalAmount: { 
        type : Number
    },
    rewardAmount:{
        type: Number
    },
    tdsAmount:{
        type: Number
    },
    is_deleted: {
        type: Boolean,
        default: false
    },
    mobile: {
        type: Number
    }

}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('p2p', p2pSchema);


