const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let contestSchema = new Schema({
    fantasy_type: {
        type: String,
        default: ''
    },
    mega_status: {
        type: Number,
        default: 0
    },
    entryfee: {
        type: Number,
        default: 0
    },
    win_amount: {
        type: Number,
        default: 0
    },
    winning_percentage: {
        type: Number,
        default: 0
    },
    maximum_user: {
        type: Number,
        default: 2
    },
    minimum_user: {
        type: Number,
        default: 0
    },
    contest_type: {
        type: String,
        default: ''
    },
    amount_type: {
        type: String,
        default: ''
    },
    discount_fee: {
        type: Number,
        default: 0

    },
    c_type: {
        type: String,
        default: ''
    },
    contest_name: {
        type: String,
        default: ''
    },
    multi_entry: {
        type: Number,
        default: 0
    },
    team_limit: {
        type: Number,
        default: 0
    },
    confirmed_challenge: {
        type: Number,
        default: 0
    },
    is_bonus: {
        type: Number,
        default: 0
    },
    is_running: {
        type: Number,
        default: 0
    },
    type: {
        type: String,
        default: ''
    },
    contest_cat: {
        type: mongoose.Types.ObjectId,
        ref: 'contestcategory'
    },
    mandatoryContest: {
        type: mongoose.Types.ObjectId,
        default: null
    },
    pricecard_type: {
        type: String,
        default: ''
    },
    freez: {
        type: Number,
        default: 0
    },
    bonus_type: {
        type: String,
        default: ''
    },
    is_recent: {
        type: String,
        default: "false"
    },
    conditional_contest: {
        type: Number,
        default: 0
    },
    autolaunch: {
        type: String,
        default: "false"
    },
    flexible_contest: {
        type: String,
        default: "0"
    },
    bonus_percentage: {
        type: Number,
        default: 0
    },
    WinningpriceAndPrize: {
        type: String
    },
    contestStatus: {
        type: Boolean
    },
    pdfDownloadStatus: {
        type: Boolean,
        default: false
    },
    team_type_id: {
        type: mongoose.Types.ObjectId,
        ref: "teamtypes",
    },

    team_type_name: {
        type: String,
        default: "",
    },
    setCount: { type: Number, default: 20 },
    textNote: { type: String, default: '' },
}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('contest', contestSchema);