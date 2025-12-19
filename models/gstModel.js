const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let gstSchema = new Schema({
    userid: {
        type: mongoose.Schema.Types.ObjectId,
    },
    totalAmount: {
        type: String
    },
    gstAmount: {
        type: String
    }
}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('gst', gstSchema);