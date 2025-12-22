const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let tierbreakdown = new Schema({

    minAmount: {
        type: Number,
        required: true
    },
    maxAmount: {
        type: Number,
        required: true
    },
    tokenAmount: {
        type: Number,
        required: true
    }
}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('tierbreakdown', tierbreakdown);