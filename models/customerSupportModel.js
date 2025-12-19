const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let customerSupportSchema = new Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        ref: 'users'
    },
    issue: {
        type: String
    },
    mobile: {
        type: String
    },
    email: {
        type: String,
    },
    message: {
        type: String,
    },
    image: {
        type: String,
        default: ""
    },
    ticketId: {
        type: Number
    },
    is_active: {
        type: Boolean,
        default: true
    },
},
    {
        timestamps: true,
        versionKey: false
    })
module.exports = mongoose.model('customersupport', customerSupportSchema);