const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const constant = require('../config/const_credential');

let pricecards = new Schema({
    seriesId:{
        type:mongoose.Types.ObjectId,
        ref:'series'
    },
    winners:{
        type:String
    },
    price:{
        type:Number,

    },
    price_percent:{
        type:Number,

    },
    min_position:{
        type:Number,

    },
    max_position:{
        type:Number,
    },
    total:{
        type:Number,
        default: 0
    },
    type:{
        type:String
    },
    description:{
        type:String
    }

}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('seriespricecard', pricecards);