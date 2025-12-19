const mongoose = require('mongoose');
const TransactionModel = require("../models/walletTransactionModel");
const WithdrawModel = require("../models/payoutModel");
const depositModel = require("../models/depositModel");
const tdsDataModel = require("../models/tdsDataModel");
const redisPayment = require("../utils/redis/redisPayment");

exports.calculateTDSDetailsNew = async ({
  userId,
  currentWithdrawingAmount,
  userWinningBalance,
}) => {
  if (userWinningBalance < currentWithdrawingAmount) {
    return null; // or throw an error if preferred
  }

  const { startDate, endDate, tdsKey } = this.getFinancialYearMeta(userId);

  let tdsData = await redisPayment.redis.hgetall(tdsKey);

  if (!tdsData || Object.keys(tdsData).length === 0) {
    await redisPayment.getDepositAndWithdrawalAmountNew(userId); // must update Redis
    tdsData = await redisPayment.redis.hgetall(tdsKey);
  }

  const successWithdraw = Number(tdsData.successWithdraw || 0);
  const tdsPaid = Number(tdsData.tdsPaid || 0);
  const successPayment = Number(tdsData.successPayment || 0);

  const addedAmount = currentWithdrawingAmount + successWithdraw;
  let tdsAmount = 0;
  let withdrawalAmount = currentWithdrawingAmount;

  if (addedAmount >= successPayment) {
    const deductedDeposit = addedAmount - successPayment;
    const overallTDS = deductedDeposit * 0.30;
    tdsAmount = Math.max(0, overallTDS - tdsPaid);
    withdrawalAmount = currentWithdrawingAmount - tdsAmount;

    const realTDS = currentWithdrawingAmount * 0.30;
    if (withdrawalAmount < 0 || realTDS < tdsAmount) {
      return null; // withdrawal not allowed
    }
  }

  return {
    netAmount: currentWithdrawingAmount,
    tdsAmount: Number(tdsAmount.toFixed(2)),
    withdrawalAmount: Number(withdrawalAmount.toFixed(2))
  };
};

// get financial deposited and withdrawed amount
exports.getDepositAndWithdrawalAmount = async (req, financialYear = null) => {
  let currentDate = new Date();
  let startYear, endYear;
  let startDate, endDate;

  // If a specific financial year is provided (e.g., "2024-25"), calculate dynamically
  if (financialYear) {
    let [startFiscalYear, endFiscalYear] = financialYear.split("-").map(Number);
    startYear = startFiscalYear;
    endYear = endFiscalYear;
  } else {
    // Determine the current financial year dynamically
    let currentYear = currentDate.getFullYear();
    let currentMonth = currentDate.getMonth() + 1; // Months are 0-indexed

    if (currentMonth >= 4) {
      startYear = currentYear;
      endYear = currentYear + 1;
    } else {
      startYear = currentYear - 1;
      endYear = currentYear;
    }
  }

  // Special case for 2024-25 financial year
  if (startYear === 2024 && endYear === 2025) {
    startDate = new Date("2025-03-31T18:30:00.000Z"); // March 13, 2025
  } else {
    startDate = new Date(`${startYear}-03-31T18:30:00.000Z`); // April 1st-IST Time zone
  }

  endDate = new Date(`${endYear}-03-31T18:29:59.999Z`); // March 31st

  let withdrawData = await WithdrawModel.aggregate([
    {
      $match: {
        userid: mongoose.Types.ObjectId(req.user._id),
        status: { $in: [0, 1] },
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        successWithdraw: { $sum: { $add: ["$amount", "$tds_amount"] } },
        tdsPaid: { $sum: "$tds_amount" }
      }
    }
  ]);

  let paymentData = await depositModel.aggregate([
    {
      $match: {
        userid: mongoose.Types.ObjectId(req.user._id),
        status: { $in: ["SUCCESS", "success"] },
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        userid: { $first: "$userid" },
        successPayment: { $sum: "$amount" }
      }
    },
    {
      $lookup: {
        from: "p2ptransactions",
        localField: "userid",
        foreignField: "receiver_id",
        as: "p2p"
      }
    },
    {
      $unwind: {
        path: "$p2p",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $group: {
        _id: null,
        userid: { $first: "$userid" },
        successPayment: {
          $first: "$successPayment"
        },
        totalP2P: { $sum: "$p2p.totalAmount" }
      }
    },
    {
      $addFields: {
        successPayment: {
          $add: ["$successPayment", "$totalP2P"]
        }
      }
    },
    {
      $unionWith: {
        coll: "users", // Any collection that always has the user (e.g., "users" collection)
        pipeline: [
          {
            $match: {
              _id: mongoose.Types.ObjectId(req.user._id)
            }
          },
          {
            $project: {
              userid: "$_id",
              successPayment: { $literal: 0 }
            }
          }
        ]
      }
    },
    {
      $group: {
        _id: "$userid",
        userid: { $first: "$userid" },
        successPayment: { $max: "$successPayment" } // Ensures the actual sum is taken if available
      }
    },
    {
      $lookup: {
        from: "tdsdetails",
        localField: "userid",
        foreignField: "userid",
        as: "TDSdata"
      }
    },
    {
      $unwind: {
        path: "$TDSdata",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $addFields: {
        openingBalance2025_26: {
          $ifNull: [
            { $first: "$TDSdata.financial_report" },
            { closingBalance: 0 }
          ]
        }
      }
    },
    {
      $addFields: {
        successPayment: {
          $add: [
            "$successPayment",
            "$openingBalance2025_26.closingBalance"
          ]
        }
      }
    },
    {
      $project: {
        TDSdata: 0
      }
    }
  ]);

  // let tdsKey = `tds-2025-26-${req.user._id}`;

  // let tdsObj = {
  //   successPayment: paymentData.length > 0 ? paymentData[0].successPayment || 0 : 0,
  //   successWithdraw: withdrawData.length > 0 ? withdrawData[0].successWithdraw || 0 : 0,
  //   tdsPaid: withdrawData.length > 0 ? withdrawData[0].tdsPaid || 0 : 0,
  //   openingBalance2025_26: paymentData.length > 0 ? paymentData[0].openingBalance2025_26.closingBalance || 0 : 0
  // }

  // await redisPayment.redis.hmset(tdsKey, tdsObj);

  return {
    financialYear: `${startYear}-${endYear}`,
    startYear: startYear,
    endYear: endYear,
    withdrawData: withdrawData.length > 0 ? withdrawData : [],
    paymentData: paymentData.length > 0 ? paymentData : [],
    // challengeWinning: challengeWinning.length > 0 ? challengeWinning : []
  };
};

exports.getFinancialYearMeta = (userId, financialYear = null) => {
  const currentDate = new Date();
  let startYear, endYear;

  if (financialYear) {
    const [startFiscalYear, endFiscalYear] = financialYear.split("-").map(Number);
    startYear = startFiscalYear;
    endYear = endFiscalYear;
  } else {
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    if (currentMonth >= 4) {
      startYear = currentYear;
      endYear = currentYear + 1;
    } else {
      startYear = currentYear - 1;
      endYear = currentYear;
    }
  }

  // Date ranges
  const startDate =
    startYear === 2024 && endYear === 2025
      ? new Date("2025-03-31T18:30:00.000Z") // Special case
      : new Date(`${startYear}-03-31T18:30:00.000Z`);

  const endDate = new Date(`${endYear}-03-31T18:29:59.999Z`);
  const fiscalYearString = `${startYear}-${String(endYear).slice(-2)}`;
  const tdsKey = `tds:${fiscalYearString}:${userId}`;
  console.log("getFinancialYearMeta input userId:", userId);
  console.log("getFinancialYearMeta generated tdsKey:", tdsKey);

  return {
    startYear,
    endYear,
    startDate,
    endDate,
    fiscalYearString,
    tdsKey
  };
};
