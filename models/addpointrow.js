const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let matchRowSchema = new Schema(
  {
    formatid: {
      type: mongoose.Schema.Types.ObjectId,
    },
    rollid: {
      type: mongoose.Schema.Types.ObjectId,
    },

    status: {
      type: String,
      default: "enable",
    },
    value: {
      type: String,
    },
    type: [
      {
        type: Number,
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);
module.exports = mongoose.model("matchrow", matchRowSchema);
