const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let teamPlayerSchema = new Schema({
    playerid: {
        type: Number
    },
    fantasy_type: {
        type: String
    },
    player_name: {
        type: String
    },
    players_key: {
        type: String
    },
    team: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'team'
    },
    captain: {
        type: Boolean,
        default: false
    },
    credit: {
        type: Number,
        default: 9
    },
    role: {
        type: String
    },
    image: {
        type: String,
        default: ''
    },
    points: {
        type: Number,
        default: 0
    },
    fullname: {
        type: String
    },
    dob: {
        type: String,
        default: ''
    },
    country: {
        type: String,
        default: ''
    },
    battingstyle: {
        type: String,
        default: ''
    },
    bowlingstyle: {
        type: String,
        default: ''
    },
    is_deleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('teamplayer', teamPlayerSchema);