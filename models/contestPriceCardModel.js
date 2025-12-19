const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const constant = require('../config/const_credential');

let contestPriceCardSchema = new Schema({
    challengersId:{
        type:mongoose.Types.ObjectId,
        ref:'challenge',
        index:true
    },
    winners:{
        type:String,
        default:0
    },
    price:{
        type:Number,
        default:0
    },
    price_percent:{
        type:Number,
        default:0
    },
    min_position:{
        type:Number,
        default:0
    },
    max_position:{
        type:Number,
        default:0
    },
    image:{
        type:String,
        default:""
    },
    gift_type:{
        type:String,
        default:""
    },
    prize_name:{
        type:String,
        default:""
    },
    gift_type:{
        type:String,
        default:"amount"
    },
    total:{
        type:Number,
        default: 0
    },
    type:{
        type:String,
        default:""
    },
    description:{
        type:String,
        default:""
    },
    rewardType:{
        type: String
    },

}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('contestpricecards', contestPriceCardSchema);