const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let seriesLeaderboardSchema = new Schema({
    fantasy_type: {
        type: String,
        default:"Cricket"
    },
    points: {
        type: Number,
        default:0
    },
    // matchkey: {
    //     type: mongoose.Types.ObjectId,
    //     ref:'matchchallenge',
    //     index:true
    // },
    userid: {
        type: mongoose.Types.ObjectId,
        ref:'user'
    },
    series_id: {
        type: mongoose.Types.ObjectId,
        ref:'series'
    },
    // jointeam_id: {
    //     type: mongoose.Types.ObjectId,
    //     ref:'jointeam',
    //     index:true
    // },
    // teamid: {
    //     type: mongoose.Types.ObjectId,
    //     ref:'team',
    //     index:true
    // },
    // teamnumber: {
    //     type: Number,
    //     default:0
    // },
    // data: {
    //     type: String,
    //     default:''
    // },
    final_status:{
        type:String,
        default:"pending"
    },
    is_deleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    versionKey: false
});
module.exports = mongoose.model('series_leaderboard', seriesLeaderboardSchema);