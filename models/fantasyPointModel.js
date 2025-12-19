const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let fantasyPointsSchema = new Schema(
  {
    roll_id: {
      type: mongoose.Schema.Types.ObjectId,
      unique: true,
    },
    pointdata: [
      {
        type: {
          type: String,
        },
        value: {
          type: Number,
        },
      },
    ],
    rules: [
      {
        point: {
          type: String,
          default:
            "Negative points for low batting Strike Rates are only applicable for individual Strike Rates of 50 runs per 100 balls or below.",
        },
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("fantasypoint", fantasyPointsSchema);
