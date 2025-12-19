const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let JoinedReferModel = new Schema({
    sno: {
        type: Number
    },
    matchkey: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'listmatch',
        index:true
    },
    challengeid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'matchchallenges',
        index:true
    },
    refercode: {
        type: String,
        default: ''
    },
    is_deleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('JoinedRefer', JoinedReferModel);