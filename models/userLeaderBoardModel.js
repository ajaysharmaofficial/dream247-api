const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', index: true },
    image: { type: String, default: '' },
    team: { type: String, default: '' }
});

let matchSchema = new Schema({
    matchkey: { type: mongoose.Schema.Types.ObjectId, ref: 'listmatch', index: true },
    name: { type: String },
    shortName: { type: String, default: '' },
    type: { type: String },
    realMatchkey: { type: String },
    startDate: { type: String },
    status: { type: String },
    launch_status: { type: String },
});
// const teamSchema = new Schema({

// });

let userLeaderboardSchema = new Schema({
    joinId: { type: mongoose.Schema.Types.ObjectId },
    challengeid: { type: mongoose.Schema.Types.ObjectId },
    userId: { type: mongoose.Schema.Types.ObjectId },
    userData: { type: userSchema, default: {} },
    user_team: { type: String, default: '' },
    matchkey: { type: mongoose.Schema.Types.ObjectId },
    matchData: { type: matchSchema, default: {} },
    teamId: { type: mongoose.Schema.Types.ObjectId },
    // teamData:{ type: teamSchema, default:{} },
    captain: { type: mongoose.Schema.Types.ObjectId },
    vicecaptain: { type: mongoose.Schema.Types.ObjectId },
    playersData: {
        type: Array,
        default: []
    },
    players: { type: String, default: "" },
    points: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    rank: { type: Number, default: 0 },
    teamnumber: { type: Number, default: 0 },
    mapping: { type: Boolean, default: false },
    lastUpdate: { type: Boolean, default: false },
    lastPoints: { type: Number, default: 0 },
    contest_winning_type: { type: String, default: 'price' },

    joinNumber: {
        type: Number,
        default: 0
    },
    contest_winning_type: {
        type: String,
        default: 'price'
    },
    lock_amount: {
        type: Boolean,
        default: true
    },
    amount: {
        type: Number,
        default: 0
    },
    prize: {
        type: String,
        default: ""
    },
    winning: {
        type: Boolean,
        default: false
    },

    redisData: {
        type: Boolean,
        default: false
    },
    playersData1: {
        type: [String],
        default: []
    },
    captain1: {
        type: String,

    },
    vicecaptain1: {
        type: String,
    },
    status: {
        type: Number,
        default: 0
    },
    user_type: { type: Number, default: 0 }

}, {
    timestamps: true,

})
module.exports = mongoose.model('userleaderboard', userLeaderboardSchema);
