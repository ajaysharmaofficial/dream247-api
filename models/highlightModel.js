const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let highlightSchema = new Schema({
  storyName: {
    type: String
  },
  story: {
    type: [Object]
  },
  image: {
    type: String,
    required: true
  },
  is_active: {  
    type: Boolean,
    default: true
  },
  sortBy: {
    type: Number,
    unique: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  }

}, {
  timestamps: true,
  versionKey: false
})

module.exports = mongoose.model('highlight', highlightSchema);