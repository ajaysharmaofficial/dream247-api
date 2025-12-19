const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let fantasytypesSchema = new Schema({
    
    fantasyName: {
        type: String,
        require
    },
    fantasyValue:{
        type: String
        
    },
    status: {
        type: String,
        default: 'enable'
    },
    fantasyBgImage: {
        type: String,
        default:""
    },
    fantasy_icon: {
        type: String,
        default:""
    },
    fantasy_sportsbanner: {
        type: String,
        default:""
    },
    fantasy_sportsWall: {
        type: String,
        default:"" 
    },
    order: {
        type: String
    }
}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('fantasytypes', fantasytypesSchema);