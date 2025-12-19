const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let resultPointSchema = new Schema({
    matchkey: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'match',
        index: true
    },
    player_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'matchplayer'
    },
    resultmatch_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'resultmatch'
    },
    startingpoints: {
        type: Number,
        default: 0
    },
    runs: {
        type: Number,
        default: 0
    },
    sixs: {
        type: Number,
        default: 0
    },
    fours: {
        type: Number,
        default: 0
    },
    strike_rate: {
        type: Number,
        default: 0
    },
    century: {
        type: Number,
        default: 0
    },
    halfcentury: {
        type: Number,
        default: 0
    },
    thirtypoints: {
        type: Number,
        default: '0'
    },
    wicketbonuspoint: {
        type: Number,
        default: '0'
    },
    catch: {
        type: Number,
        default: 0
    },
    wickets: {
        type: Number,
        default: 0
    },
    maidens: {
        type: Number,
        default: 0
    },

    economy_rate: {
        type: Number,
        default: 0
    },
    runouts: {
        type: Number,
        default: 0
    },
    stumping: {
        type: Number,
        default: 0
    },
    thrower: {
        type: Number,
        default: 0
    },

    hitter: {
        type: String,
        default: "0"
    },

    bonus: {
        type: Number,
        default: 0
    },

    negative: {
        type: Number,
        default: 0
    },
    total: {
        type: Number,
        default: 0
    }

}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('resultpoint', resultPointSchema);