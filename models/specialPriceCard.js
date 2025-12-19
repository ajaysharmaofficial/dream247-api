const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let specialPricecardSchema = new Schema({
    challengersId: {
        type: mongoose.Types.ObjectId,
        ref: 'challenge',
        index: true
    },
    rank: {
        type: Number,
        default: 0
    },
    price: {
        type: Number,
        default: 0
    },
    gift_type: {
        type: String,
        default: "amount"
    },
    description: {
        type: String,
        default: ""
    },
    type: {
        type: String,
        default: "extra"
    }
}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('specialpricecard', specialPricecardSchema);