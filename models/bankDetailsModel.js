const mongoose = require('mongoose');

const bankDetailSchema = mongoose.Schema({
    name: { type: "String", index: true, unique: true },
    status: { type: Number, default: 1 },
    users: { type: Number, default: 1 }
}, {
    timestamps: true,
    versionKey: false
});

const bankDetailsModel = mongoose.model('bankdetail', bankDetailSchema);
module.exports = bankDetailsModel;