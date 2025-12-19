const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let leaugestransaction = new Schema({
    bonus: { type: Number, default: 0 },
    winning: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'user' }
}, { timestamps: true, versionKey: false });

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

const challengeSchema = new Schema({
    matchkey: { type: mongoose.Schema.Types.ObjectId, ref: 'listmatch', index: true },
    name: { type: String },
    type: { type: String },
    winning: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    entryFee: { type: Number, default: 0 },
    maxTeam: { type: Number, default: 0 },
    status: { type: String },
    totalWinning: { type: Number, default: 0 },
    totalBonus: { type: Number, default: 0 },
});

let userLeagueSchema = new Schema({
    refercode: { type: String, default: '' },
    transaction_id: { type: String, default: '' },
    teamNumbercount: { type: Number, default: 0 },
    sta: { type: Number, default: 0 },
    userid: { type: mongoose.Schema.Types.ObjectId, ref: 'user', index: true },
    userData: { type: userSchema, default: {} },
    user_team: { type: String, default: '' },
    challengeid: { type: mongoose.Schema.Types.ObjectId, ref: 'matchchallenges', index: true },
    challengeData: { type: challengeSchema, default: {} },
    teamid: { type: mongoose.Schema.Types.ObjectId, ref: 'team' },
    teamnumber: { type: Number, default: 0 },
    matchkey: { type: mongoose.Schema.Types.ObjectId, ref: 'listmatch', index: true },
    matchData: { type: matchSchema, default: {} },
    seriesid: { type: mongoose.Schema.Types.ObjectId, ref: 'series' },
    leaugestransaction: leaugestransaction,
    is_deleted: { type: Boolean, default: false },

    redisData: {
        type: Boolean,
        default: false
    },
    user_type: { type: Number, default: 0 }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('userleague', userLeagueSchema);
