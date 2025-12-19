const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let teamSchema = new Schema({
    fantasy_type: {
        type: String
    },
    teamName: {
        type: String
    },
    logo: {
        type: String
    },
    team_key: {
        type: String
    },
    short_name: {
        type: String
    },
    color: {
        type: String
    },
    is_deleted: {
        type: Boolean,
        default: false
    },
}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('team', teamSchema);