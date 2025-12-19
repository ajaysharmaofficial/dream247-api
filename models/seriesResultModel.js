const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let seriesResultSchema = new Schema({
    matchkey: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'match',
        default: null,
        index: true
    },
    userid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    challengeid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'matchchallenge',
        index: true
    },
    joinedid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'joinleague'
    },
    seriesid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'series'
    },
    transaction_id: {
        type: String
    },
    points: {
        type: Number
    },
    amount: {
        type: Number
    },
    prize: {
        type: String,
        default: ""
    },
    rank: {
        type: Number
    },
    status: {
        type: Number,
        default: 1
    },
}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('seriesResult', seriesResultSchema);