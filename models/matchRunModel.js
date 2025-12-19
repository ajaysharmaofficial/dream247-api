const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let matchRunSchema = new Schema({
    matchkey: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'match',
        index: true
    },
    teams1: {
        type: String,
        default: ''
    },

    runs1: {
        type: String,
        default: 0
    },
    wickets1: {
        type: String,
        default: 0
    },
    overs1: {
        type: String,
        default: 0
    },
    teams2: {
        type: String,
        default: ''
    },
    runs2: {
        type: String,
        default: 0
    },
    wickets2: {
        type: String,
        default: 0
    },
    overs2: {
        type: String,
        default: 0
    },
    winning_status: {
        type: String,
        default: '0'
    },
    teama: {
        type: Object,
        default: ''
    },
    teamb: {
        type: Object,
        default: ''
    }
}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('matchrun', matchRunSchema);