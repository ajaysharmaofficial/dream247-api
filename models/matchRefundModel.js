const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let matchRefundSchema = new Schema({
    matchkey: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'match',
        index:true
    },
    userid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    amount: {
        type: Number
    },
    joinid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'joinleague'
    },
    challengeid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'matchchallenge',
        index:true
    },
    
    reason: {
        type: String
    },
    transaction_id: {
        type: String
    }
}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('matchrefund', matchRefundSchema);