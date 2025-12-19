const mongoose = require('mongoose');
const Schema = mongoose.Schema;


let joiedmatchchallengesSchema = new Schema({
    matchchallenge_id: { type: mongoose.Types.ObjectId, ref: 'challenge' },
    matchkey: { type: mongoose.Schema.Types.ObjectId, ref: 'listmatch', index: true },
    fantasy_type: { type: String, default: 'cricket' },
    maximum_user: { type: Number, default: 0 },
    status: { type: String, default: 0 },
    joinedusers: { type: Number, default: 0 },
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('joinedmatchchallenge', joiedmatchchallengesSchema);
