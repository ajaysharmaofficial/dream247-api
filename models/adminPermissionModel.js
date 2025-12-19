const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let adminPermissionSchema = new Schema({
  userId:{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'admin'
  },
  permission:[
{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'fantasytypes'
}
  ]
    
}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('adminpermission', adminPermissionSchema);
