const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let teamTypeSchema = new Schema({
    name: {
        type: String
    },
    status: {
        type: String,
        default: "active"
    }
}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('teamtype', teamTypeSchema);