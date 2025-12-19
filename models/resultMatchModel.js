const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let resultMatchSchema = new Schema({
    matchkey: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'match',
        index:true
    },
    player_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'matchplayer'
    },
    player_key: {
        type: String
    },
    innings: {
        type: Number
    },
    
    total_points: {
        type: Number,
        default: 0
    },
    batting: {
        type: Number,
        default: '0'
    },
    
    bowling: {
        type: Number,
        default: '0'
    },
    runs: {
        type: Number,
        default: 0
    },
    boundary: {
        type: Number,
        default: 0
    },
    six: {
        type: Number,
        default: 0
    },
    
    fours: {
        type: Number,
        default: 0
    },
    hitter: {
        type: Number,
        default: 0
    },
    
    thrower: {
        type: Number,
        default: 0
    },
    duck: {
        type: Number,
        default: 0
    },
    wicket: {
        type: Number,
        default: 0
    },
    maiden_over: {
        type: Number,
        default: 0
    },
    
    catch: {
        type: Number,
        default: 0
    },
    
    stumbed: {
        type: Number,
        default: 0
    },
    runouts: {
        type: Number,
        default: 0
    },
    
    starting11: {
        type: Number,
        default: 0
    },
    bball: {
        type: Number,
        default: 0
    },
    balls: {
        type: Number,
        default: 0
    },
    overs: {
        type: Number,
        default: 0
    },
    
    out_str: {
        type: String,
        default: ''
    },
    
    batting_points: {
        type: Number,
        default: 0
    },
    
    bowling_points: {
        type: Number,
        default: 0
    },
    fielding_points: {
        type: Number,
        default: 0
    },
    
    extra_points: {
        type: Number,
        default: 0
    },
    negative_points: {
        type: Number,
        default: 0
    },
    strike_rate: {
        type: Number,
        default: 0
    },
    economy_rate: {
        type: Number,
        default: 0
    },
    
    grun: {
        type: Number,
        default: 0
    },
    
    battingdots: {
        type: Number,
        default: 0
    },
    balldots: {
        type: Number,
        default: 0
    },
    
    man_of_match: {
        type: Number,
        default: 0
    },
    extra: {
        type: Number,
        default: 0
    },
    wicket_type: {
        type: String,
        default:null
        
    },
    wplayerid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'matchplayer',
        default: null
    },
    winning_status: {
        type: String,
        default: '0'
    }
}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('resultmatch', resultMatchSchema);