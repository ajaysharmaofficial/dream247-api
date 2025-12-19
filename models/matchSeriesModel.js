const mongoose = require("mongoose");

const matchSeries = new mongoose.Schema({
    fantasy_type: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    series_key: {
        type: String
    },
    status: {
        type: String,
        default: 'opened'
    },
    start_date: {
        type: String,
        required: true
    },
    end_date: {
        type: String,
        required: true
    },
    has_leaderboard:{
        type:"String",
        default:'no'
    },
    winningStatus:{
        type:"String",
        default:'pending'
    },
    is_deleted: {
        type: Boolean,
        default: false
    },
    automatchlaunch:{
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    versionKey: false
})

module.exports = mongoose.model('matchseries', matchSeries);