const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let referralAmount = new Schema({
     user_id:{
        type:mongoose.Types.ObjectId
     },
     from_id:{
        type:mongoose.Types.ObjectId
     },
     level:{
        type:Number,
        default:0
     },
     amount:{
        type:Number,
        default:0
     },
    type:{
        type:String,
        default:''
     },
     txnid:{
        type:String,
        default:''
     }
}, {
    timestamps: true,
    versionKey: false
});
module.exports = mongoose.model('referralamount', referralAmount);