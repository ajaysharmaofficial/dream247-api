const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let revenueSchema = new Schema({
    matchkey: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'listMatches',
        index:true
    },
    matchName:{
        type:String,
        default:''
    },
    start_date:{
        type:String,
        default:''
    },
    invested_amount:{
        type:Number,
        default:0
    },
    win_amount:{
        type:Number,
        default:0
    },
    bonus_used:{
        type:Number,
        default:0
    },
    refund_amount:{
        type:Number,
        default:0
    },
    youtuber_bonus:{
        type:Number,
        default:0
    },
    TDS_amount:{
        type:Number,
        default:0
    },
    profit_or_loss:{
        type:String,
        default:''
    },
    profit_or_loss_amount:{
        type:Number,
        default:0
    }
}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('revenue', revenueSchema);