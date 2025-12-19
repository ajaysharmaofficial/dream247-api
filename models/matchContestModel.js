const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let matchpricecard = new Schema({
    challengersId: { type: mongoose.Types.ObjectId, ref: 'challenge', default: null },
    matchkey: { type: mongoose.Types.ObjectId, ref: 'listmatch', index: true },
    prize_name: { type: String, default: '' },
    is_recent: { type: String, default: "false" },
    image: { type: String, default: '' },
    winners: { type: String },
    price: { type: Number },
    price_percent: { type: Number },
    min_position: { type: Number },
    max_position: { type: Number },
    total: { type: Number, default: 0 },
    gift_type: { type: String, default: "amount" },
    type: { type: String },
    description: { type: String }
}, { timestamps: true, versionKey: false });

let contestCategorySchema = new Schema({
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'contestcategory' },
    fantasyType: { type: String, default: '' },
    name: { type: String, default: '' },
    subTitle: { type: String, default: '' },
    Order: { type: Number, default: '' },
    image: { type: String, default: '' },
    tblOrder: { type: Number, default: 0 },
    hasLeaderBoard: { type: String, default: "no" },
    megaStatus: { type: Boolean, default: false }
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

let extrapricecard = new Schema({
    challengersId: { type: mongoose.Types.ObjectId, ref: 'challenge', default: null },
    matchkey: { type: mongoose.Types.ObjectId, ref: 'listmatch', index: true },
    prize_name: { type: String, default: '' },
    price: { type: Number },
    rank: { type: Number },
    type: { type: String },
    description: { type: String }
}, { timestamps: true, versionKey: false });


let matchContestSchema = new Schema({
    contestid: { type: Number },
    contest_cat: { type: mongoose.Schema.Types.ObjectId, ref: 'contestcategory' },
    contestCategory: { type: contestCategorySchema, default: {} },
    challenge_id: { type: mongoose.Types.ObjectId, ref: 'challenge' },
    matchkey: { type: mongoose.Schema.Types.ObjectId, ref: 'listmatch', index: true },
    matchData: { type: matchSchema, default: {} },
    fantasy_type: { type: String, default: 'cricket' },
    entryfee: { type: Number, default: '' },
    win_amount: { type: Number, default: '' },
    multiple_entryfee: { type: Number, default: 0 },
    expert_teamid: { type: mongoose.Types.ObjectId, ref: 'jointeam' },
    maximum_user: { type: Number, default: 0 },
    status: { type: String, default: 0 },
    isWinning: { type: Boolean, default: false },
    contestStatus: { type: Boolean },
    created_by: { type: String, default: '' },
    joinedusers: { type: Number, default: 0 },
    bonus_type: { type: String, default: '' },
    contest_type: { type: String, default: '' },
    expert_name: { type: String, default: "" },
    contest_name: { type: String, default: '' },
    amount_type: { type: String, default: 'price' },
    mega_status: { type: Number, default: 0 },
    winning_percentage: { type: Number, default: 0 },
    is_bonus: { type: Number, default: 0 },
    bonus_percentage: { type: Number, default: 0 },
    pricecard_type: { type: String, default: 0 },
    minimum_user: { type: Number, default: 0 },
    confirmed_challenge: { type: Number, default: 0 },
    multi_entry: { type: Number, default: 0 },
    team_limit: { type: Number, default: 11 },
    image: { type: String, default: '' },
    c_type: { type: String, default: '' },
    is_private: { type: Number, default: 0 },
    is_running: { type: Number, default: 0 },
    is_expert: { type: Number, default: 0 },
    bonus_percentage: { type: Number, default: 0 },
    matchpricecards: [matchpricecard],
    extrapricecards: [extrapricecard],
    is_duplicated: { type: Number, default: 0 },
    is_deleted: { type: Boolean, default: false },
    is_PromoCode_Contest: { type: Boolean, default: false },
    team1players: { type: Array, default: [] },
    team2players: { type: Array, default: [] },
    contestCode: { type: String },
    WinningpriceAndPrize: { type: String, default: '' },
    startDate: { type: String, default: "" },
    endDate: { type: String, default: "" },
    is_recent: { type: String, default: "false" },
    discount_fee: { type: Number, default: 0 },
    compress: { type: Boolean, default: false },
    conditional_contest: { type: Number, default: 0 },
    mandatoryContest: { type: mongoose.Types.ObjectId, default: null },
    flexible_contest: {
        type: String,
        default: "0"
    },
    team_type_id: {
        type: mongoose.Types.ObjectId,
        ref: "teamtypes",
    },

    team_type_name: {
        type: String,
        default: "",
    },

    subscription_fee: { type: Number, default: 0 },
    textNote: { type: String, default: '' },
    pdfDownloadStatus: {
        type: Boolean,
        default: false
    },
    setCount: { type: Number, default: 20 },
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('matchcontest', matchContestSchema);
