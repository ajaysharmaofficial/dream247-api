const mongoose = require("mongoose");

const affiliatorIncomeSchema = mongoose.Schema({
    promoterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "promoter"
    },
    matchkey: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "listmatch"
    },
    matchChallengeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "matchchallenges"
    },
    commission: {
        type: Number,
        default: 0
    },
    referredUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user"
    }
}, {
    timestamps: true,
    versionKey: false
});

const promoterIncomeModel = mongoose.model('affiliatorincome', affiliatorIncomeSchema);

module.exports = promoterIncomeModel;