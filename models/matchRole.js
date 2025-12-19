const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let matchRoleSchema = new Schema(
  {
    formatid: {
      type: mongoose.Schema.Types.ObjectId,
    },

    status: {
      type: String,
      default: "enable",
    },
    type: {
      type: String,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);
module.exports = mongoose.model("matchrole", matchRoleSchema);
