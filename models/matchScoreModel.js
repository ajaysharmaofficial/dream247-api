const mongoose = require('mongoose');
const Schema = mongoose.Schema;
let matchScoreModel = new Schema({
    teams: {
        type: [Object]
    },
    real_matchkey: {
        type: String
    },
    matchkey: {
        type: mongoose.Schema.Types.ObjectId
    },
    status: {
        type: String,
    },
    status_note: {
        type: String,
        default: ""
    },
    team_batting: {
        type: String,
        default: ""
    },
    teama: {
        type: Object,
        default: {}
    },
    teamb: {
        type: Object,
        default: {}
    },
    // team_bowling: {
    //     type: String,
    // },
    // team_bowling: {
    //     type: String,
    // },
    // batting_team_id: {
    //     type: String
    // },
    // fielding_team_id: {
    //     type: String
    // },
    // bolwer: {
    //     type: String
    // },
    // currentOverBall: {
    //     type: Number
    // },
    // liveScore: {
    //     type: [Object],
    // },
    // batsmen: {
    //     type: [Object],
    // },
    // bowlers: {
    //     type: [Object],
    // },
    // inning: {
    //     type: [Object],
    // },
    // currentOverData: {
    //     type: [Object]
    // }
}, {
    timestamps: true,
    versionKey: false
});


module.exports = mongoose.model('matchscore', matchScoreModel);