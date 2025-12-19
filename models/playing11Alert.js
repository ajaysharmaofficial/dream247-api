const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let playing11AlertSchema = new Schema({
    
    matchkey: {
        type: mongoose.Schema.Types.ObjectId,
        default: 'listmatches'
        
    }

}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('playing11alert', playing11AlertSchema);