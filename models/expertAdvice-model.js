const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const expertAdviceSchema = new Schema(
  {
    title: {
      type: String,
    },

    content: {
      type: String,
    },

    status: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("expertAdvice", expertAdviceSchema);
