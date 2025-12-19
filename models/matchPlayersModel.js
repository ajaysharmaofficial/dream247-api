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

const teamSchema = new mongoose.Schema({
    fantasyType: { type: String },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'team' },
    teamName: { type: String },
    logo: { type: String },
    team_key: { type: String },
    short_name: { type: String },
    color: { type: String }
});

let matchPlayerSchema = new Schema({
    id: { type: Number },
    matchkey: { type: mongoose.Schema.Types.ObjectId, ref: 'listMatches', index: true },
    matchData: { type: matchSchema, default: {} },
    playerid: { type: mongoose.Schema.Types.ObjectId, ref: 'player', index: true },
    points: { type: Number, default: 0 },
    role: { type: String, default: '' },
    credit: { type: Number, default: 9 },
    name: { type: String },
    legal_name: { type: String },
    battingstyle: { type: String, default: '' },
    bowlingstyle: { type: String, default: '' },
    playingstatus: { type: Number, default: -1 },
    playingtime: { type: Number },
    vplaying: { type: Number, default: 0 },
    userteam: { type: Number },
    teamData: { type: teamSchema, default: {} },
    players_count: { type: Number, default: 0 },
    totalSelected: { type: Number, default: 0 },
    captainSelected: { type: Number, default: 0 },
    vicecaptainSelected: { type: Number, default: 0 },
    captain_selection_percentage: { type: Number, default: 0 },
    vice_captain_selection_percentage: { type: Number, default: 0 },
    superPlayerSelected: { type: Number, default: 0 },
    fantasy_total_points: { type: String, default: '0' },
    lastMatchPlayed: { type: Boolean, default: false },
    is_deleted: { type: Boolean, default: false }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('matchplayer', matchPlayerSchema);
