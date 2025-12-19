const mongoose = require('mongoose');

const branchInfoSchema = mongoose.Schema({
    bank: { type: "String", index: true, unique: true },
    ifsc: { type: "String", index: true, unique: true },
    neft: { type: "Boolean", default: false },
    imps: { type: "Boolean", default: false },
    rtgs: { type: "Boolean", default: false },
    upi: { type: "Boolean", default: false },
    address: { type: "String", default: "" },
    city: { type: "String", default: "" },
    state: { type: "String", default: "" },
    branch: { type: "String", default: "" },
    status: { type: Number, default: 1 },
    users: { type: Number, default: 1 }
}, {
    timestamps: true,
    versionKey: false
});

const bankDetailsModel = mongoose.model('branchinfo', branchInfoSchema);
module.exports = bankDetailsModel;