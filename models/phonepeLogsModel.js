const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let phonepeLogsSchema = new Schema({
    userid: {
        type: mongoose.Types.ObjectId,
        ref: 'user',
        index: true
    },
    txnid: {
        type: String
        // type: mongoose.Types.ObjectId,
        // ref: 'user',
        // index: true
    },
    amount: {
        type: Number,
        default: 0
    },
    status: {
        type: String
    },
    data: {
        type: Object
    }
}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('phonepelogs', phonepeLogsSchema);