const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let guestUserSchema = new Schema({
    username: {
        type: String
    },
    refer_id: {
        type: mongoose.Types.ObjectId,
        ref: 'user'
    },
    email: {
        type: String
    },
    mobile: {
        type: Number
    },
    password: {
        type: String
    },
    code: {
        type: String
    },
    auth_key: {
        type: String
    },
    deviceid: {
        type: String
    }
}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('guestuser', guestUserSchema);