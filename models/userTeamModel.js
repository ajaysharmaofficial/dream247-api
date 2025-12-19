const mongoose = require('mongoose');
const Schema = mongoose.Schema;

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
    playerName: { type: String },
    playerKey: { type: String },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'team' },
    credit: { type: Number, default: 9 },
    role: { type: String },
    image: { type: String, default: '' }
});


let userTeamSchema = new Schema({
    userid: { type: mongoose.Schema.Types.ObjectId, ref: 'user', index: true },
    user_team: { type: String, default: "" },
    type: { type: String, default: "cricket" },
    matchkey: { type: mongoose.Schema.Types.ObjectId, ref: 'listMatches', index: true },
    matchData: { type: matchSchema, default: {} },
    teamnumber: { type: Number, default: 0 },
    teamType: { type: String, default: "10-1" },
    overs: [{
        over: { type: Number, default: 0 },
        MegaOver: { type: Number, default: 0 },
        inning: { type: Number, default: 0 },
        points: { type: Number, default: 0 },
        teamid: { type: mongoose.Schema.Types.ObjectId },
        teamname: { type: String },
        type: { type: String, default: 0 }
    }],
    players: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'matchplayer' }], default: [] },
    playersData: { type: [{ type: playerSchema, default: {} }], default: [] },
    captain: { type: mongoose.Schema.Types.ObjectId, ref: 'matchplayer' },
    vicecaptain: { type: mongoose.Schema.Types.ObjectId, ref: 'matchplayer' },
    captainData: { type: playerSchema, default: {} },
    viceCaptainData: { type: playerSchema, default: {} },
    guruTeamId: { type: mongoose.Schema.Types.ObjectId, default: null },
    is_guru: { type: String, default: "0" },
    count_copied: { type: Number, default: 0 },
    points: { type: Number, default: 0.0 },
    lastpoints: { type: Number, default: 0.0 },
    player_type: { type: String, default: 'classic' },
    is_deleted: { type: Boolean, default: false },
    user_type: { type: Number, default: 0 },
    updateStatus: { type: Boolean, default: false }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('userteam', userTeamSchema);
