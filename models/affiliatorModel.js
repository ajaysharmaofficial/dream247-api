const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let affiliator = new Schema({
    userid: {
        type: mongoose.Types.ObjectId
    },
    channelType: {
        type: "String"
    },
    channelName: {
        type: "String"
    },
    channelurl: {
        type: "String"
    },
    is_deleted: {
        type: Boolean,
        default: false
    },
    percentage: {
        type: Number
    },
    refercode: {
        type: String
    },
    receiveAmount: {
        type: Number,
        default: 0
    },
    oldTotalAmount: {
        type: Number,
        default: 0
    },
    newTotalAmount: {
        type: Number,
        default: 0
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    refereduser_id:{
        type: mongoose.Types.ObjectId
    }
}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('affiliator', affiliator);