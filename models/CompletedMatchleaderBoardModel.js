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


const playerSchema = new Schema({
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'player' },
    matchPlayerId: { type: mongoose.Schema.Types.ObjectId, ref: 'matchplayer' },
    player_id: { type: Number },
    fantasyType: { type: String },
    playerName: { type: String },
    playerKey: { type: String },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'team' },
    credit: { type: Number, default: 9 },
    role: { type: String },
    image: { type: String, default: '' },
    fullName: { type: String },
    dob: { type: String, default: '' },
    country: { type: String, default: '' },
    battingStyle: { type: String, default: '' },
    bowlingStyle: { type: String, default: '' }
});

// const teamSchema = new Schema({

// });

let completedmatchleaderboardSchema = new Schema({
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
    captainData: { type: playerSchema, default: {} },
    viceCaptainData: { type: playerSchema, default: {} },
    playersData: { type: [{ type: playerSchema, default: {} }], default: [] },
    players: { type: String, default: "" },
    points: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    rank: { type: Number, default: 0 },
    teamnumber: { type: Number, default: 0 },
    mapping: { type: Boolean, default: false },
    lastUpdate: { type: Boolean, default: false },
    lastPoints: { type: Number, default: 0 },
    contest_winning_type: { type: String, default: 'price' }
}, { timestamps: true });

module.exports = mongoose.model('completedmatchleaderboard', completedmatchleaderboardSchema);
