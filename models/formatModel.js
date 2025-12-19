const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let formatSchema = new Schema(
  {
    name: {
      type: String,
    },

    status: {
      type: String,
      default: "enable",
    },
    sportstype: {
      type: String,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);
module.exports = mongoose.model("format", formatSchema);
