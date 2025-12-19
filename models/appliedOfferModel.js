const mongoose = require('mongoose');
const Schema = mongoose.Schema;


let appliedOfferSchema = new Schema({
    user_id: {
        type: mongoose.Types.ObjectId,
        ref: 'user'
    },
    offer_id: {
        type: mongoose.Types.ObjectId,
        ref: 'offers'
    },
    
    transaction_id: {
        type: String
    },
    is_deleted: {
        type: Boolean,
        default: false
    }

}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('appliedoffer', appliedOfferSchema);


