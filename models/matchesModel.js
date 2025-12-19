const mongoose = require('mongoose');


const teamSchema = new mongoose.Schema({
    fantasyType: { type: String },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'team' },
    teamName: { type: String },
    logo: { type: String },
    team_key: { type: String },
    short_name: { type: String },
    color: { type: String }
});

const seriesSchema = new mongoose.Schema({
    seriesId: { type: mongoose.Schema.Types.ObjectId, ref: 'series' },
    fantasyType: { type: String },
    name: { type: String },
    seriesKey: { type: String },
    status: { type: String, default: 'opened' },
    startDate: { type: String },
    endDate: { type: String },
    hasLeaderboard: { type: "String", default: 'no' },
    winningStatus: { type: "String", default: 'pending' }
});




let matchesSchema = new mongoose.Schema({
    fantasy_type: { type: String },
    type: { type: String },
    name: { type: String },
    notify: { type: String, default: '' },
    short_name: { type: String, default: '' },
    team1Id: { type: mongoose.Schema.Types.ObjectId, ref: 'team' },
    team2Id: { type: mongoose.Schema.Types.ObjectId, ref: 'team' },
    teamA: { type: teamSchema, default: {} },
    teamB: { type: teamSchema, default: {} },
    cricketid: { type: mongoose.Schema.Types.ObjectId, default: undefined },
    matchkey: { type: mongoose.Schema.Types.ObjectId, ref: 'listmatch', index: true },
    real_matchkey: { type: String },
    series: { type: mongoose.Schema.Types.ObjectId, ref: 'series' },
    seriesData: { type: seriesSchema, default: {} },
    start_date: { type: String },
    status: { type: String },
    launch_status: { type: String },
    info_center: { type: String, default: '' },
    final_status: { type: String },
    playing11_status: { type: Number, default: 0 },
    order_status: { type: Number, default: 0 },
    status_overview: { type: String },
    squadstatus: { type: String, default: 'YES' },
    pdfstatus: { type: Number },
    pointsstatus: { type: Number },
    withdraw_amount: { type: Number },
    format: { type: String },
    report_status: { type: String },
    second_inning_status: { type: Number },
    isoverfantasy: { type: Number },
    tosswinner_team: { type: String },
    toss_decision: { type: String },
    match_order: { type: Number },
    youtuberStatus: { type: Boolean, default: false },
    is_deleted: { type: Boolean, default: false },
    game_state: { type: Number, default: 0 },
    textNote: { type: String, default: '' },
    contestType: {
        type: String,
        default: 'old'
    },
    mapping: {
        type: Boolean,
        default: false
    },
    downloadPdfStatus: {
        type: Boolean,
        default: false
    },
    lock_winning_amount: {
        type: Boolean,
        default: false
    },
    rankUpdate: {
        type: Boolean,
        default: false
    },
    pointUpdate: {
        type: Boolean,
        default: false
    },
    verified: {
        type: String,
        default: "false"
    },
    is_recent: {
        type: Boolean,
        default: false
    },
    result_date: {
        type: String,
        default: ""
    },
    mega_status: {
        type: Boolean,
        default: false
    },
    removeKeys: {
        type: Boolean,
        default: false
    },
    removeUpcomingKeys: {
        type: Boolean,
        default: false
    },
    updateContest: {
        type: Boolean,
        default: false
    },
    checkPointsProperly: {
        type: Boolean,
        default: false
    },
    checkDuaPointsProperly: {
        type: Boolean,
        default: false
    },
    updateDuaContest: {
        type: Boolean,
        default: false
    },
    second_inning_status: {
        type: Number,
        default: 0
    },
    // duo_winner_status: {
    //     type: Boolean,
    //     default: false
    // },
    popular_status: {
        type: Boolean,
        default: false
    },
    recommended_status: {
        type: Boolean,
        default: false
    }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('matches', matchesSchema);
