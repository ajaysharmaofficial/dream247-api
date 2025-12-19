const mongoose = require('mongoose');

const indianStateSchema = mongoose.Schema({
    name: { type: "String", index: true, unique: true },
    status: { type: Boolean },
    image: { type: "String", default: "" }
});

const IndianStateModel = mongoose.model('indianstate', indianStateSchema);
module.exports = IndianStateModel;