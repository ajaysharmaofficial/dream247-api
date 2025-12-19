const mongoose = require('mongoose');
const Schema = mongoose.Schema;


let internalTransfersSchema = new Schema({
    user_id: {
        type: mongoose.Types.ObjectId,
        ref: 'user'
    },
    requestedAmount:{
        type: Number
    },
    totalAmount: { 
        type : Number
    },
    rewardAmount:{
        type: Number
    },
    is_deleted: {
        type: Boolean,
        default: false
    },
    mobile: {
        type: Number
    }

}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('internaltransfers', internalTransfersSchema);