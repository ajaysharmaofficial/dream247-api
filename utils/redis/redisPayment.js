const { getFinancialYearMeta } = require("../tds");
const depositModel = require("../../models/depositModel");
const WithdrawModel = require("../../models/payoutModel");
const mongoose = require('mongoose');



// payment.redis.js
if (process.env.redisEnv === "live") {
  const { Redis } = require("@upstash/redis");

  // Create Redis client (single endpoint for Upstash)
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  redis.ping()
    .then(() => console.log("Connected to Payment Redis (Upstash)"))
    .catch(err => console.error("Payment Redis connection error:", err));

  async function getkeydata(key) {
      try {
        const data = await redis.get(key);
        // console.log("KEY", key);
        // console.log("Data fetched for key:", data);
        // console.log("Type:", typeof data);
  
        if (!data) return null;
  
        // Only parse if it looks like JSON
        if (typeof data === "string" && /^[{\[].*[}\]]$/.test(data)) {
          return JSON.parse(data);
        }
  
        return data; // return as plain string or object
      } catch (error) {
        console.error("Error in getkeydata:", error);
        return null;
      }
    }

  async function setkeydata(key, data, timing = 5184000) {
    try {
      await redis.set(key, JSON.stringify(data), { ex: timing });
      return data;
    } catch (error) {
      console.error("Error in setkeydata:", error);
    }
  }

  async function deletedata(key) {
    try {
      await redis.del(key);
    } catch (error) {
      console.error("Error in deletedata:", error);
    }
  }

  async function updatedPaymentData(userId, processedPayment) {
    try {
      const depositKey = `userid:${userId}-deposit:${processedPayment._id}`;
      const paymentData =
        typeof processedPayment.toObject === "function"
          ? processedPayment.toObject()
          : processedPayment;

      const hashData = {};
      for (const [key, value] of Object.entries(paymentData)) {
        hashData[key] =
          typeof value === "object" ? JSON.stringify(value) : String(value);
      }

      await redis.hset(depositKey, hashData);
      await redis.expire(depositKey, 5184000);

      return { status: true, message: "Stored successfully in Redis with TTL." };
    } catch (error) {
      console.error("Error storing deposit to Redis:", error);
      return { status: false, message: "Redis store failed.", error };
    }
  }

  async function getTDSdata(userId) {
    try {
      const { tdsKey } = getFinancialYearMeta(userId);
      let tdsData = await redis.hgetall(tdsKey);

      if (!tdsData || Object.keys(tdsData).length === 0) {
        await getDepositAndWithdrawalAmountNew(userId);
        tdsData = await redis.hgetall(tdsKey);
      }

      return tdsData;
    } catch (err) {
      console.error("Error in getTDSdata:", err);
      return false;
    }
  }

  async function updateTDSdata(userId, dataObj) {
    try {
      const { tdsKey } = getFinancialYearMeta(userId);
      await redis.hset(tdsKey, Object.fromEntries(
        Object.entries(dataObj).map(([k, v]) => [k, String(v)])
      ));
      return true;
    } catch (err) {
      console.error("Error in updateTDSdata:", err);
      return false;
    }
  }

  async function storePaymentInRedis(userId, checkData) {
    try {
      const depositKey = `userid:${userId}-deposit:${checkData._id}`;
      const depositListKey = `userDeposit-${userId}`;

      const hashData = {};
      for (const [key, value] of Object.entries(checkData)) {
        hashData[key] =
          typeof value === "object" ? JSON.stringify(value) : String(value);
      }

      if (checkData.createdAt) {
        hashData.createdAt = new Date(checkData.createdAt).toISOString();
      }

      await redis.hset(depositKey, hashData);
      await redis.expire(depositKey, 5184000);

      // Sorted set score = timestamp
      await redis.zadd(depositListKey, {
        score: new Date(checkData.createdAt).getTime(),
        member: checkData._id.toString(),
      });

      // Keep only latest 50 entries
      const totalCount = await redis.zcard(depositListKey);
      if (totalCount > 50) {
        await redis.zremrangebyrank(depositListKey, 0, totalCount - 51);
      }
    } catch (error) {
      console.error("Error storing deposit in Redis:", error);
      throw error;
    }
  }

  async function getDepositAndWithdrawalAmountNew(userId, financialYear = null) {
    const {
      startYear,
      endYear,
      startDate,
      endDate,
      fiscalYearString,
      tdsKey,
    } = getFinancialYearMeta(userId, financialYear);

    let withdrawData = await WithdrawModel.aggregate([
      {
        $match: {
          userid: mongoose.Types.ObjectId(userId),
          status: 1,
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          successWithdraw: { $sum: { $add: ["$amount", "$tds_amount"] } },
          tdsPaid: { $sum: "$tds_amount" },
        },
      },
    ]);

    let paymentData = await depositModel.aggregate([
      {
        $match: {
          userid: mongoose.Types.ObjectId(userId),
          status: { $in: ["SUCCESS", "success"] },
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          userid: { $first: "$userid" },
          successPayment: { $sum: "$amount" },
        },
      },
      {
        $lookup: {
          from: "p2ptransactions",
          localField: "userid",
          foreignField: "receiver_id",
          as: "p2p",
        },
      },
      { $unwind: { path: "$p2p", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: null,
          userid: { $first: "$userid" },
          successPayment: { $first: "$successPayment" },
          totalP2P: { $sum: "$p2p.totalAmount" },
        },
      },
      {
        $addFields: {
          successPayment: { $add: ["$successPayment", "$totalP2P"] },
        },
      },
      {
        $unionWith: {
          coll: "users",
          pipeline: [
            { $match: { _id: mongoose.Types.ObjectId(userId) } },
            {
              $project: {
                userid: "$_id",
                successPayment: { $literal: 0 },
              },
            },
          ],
        },
      },
      {
        $group: {
          _id: "$userid",
          userid: { $first: "$userid" },
          successPayment: { $max: "$successPayment" },
        },
      },
      {
        $lookup: {
          from: "tdsdetails",
          localField: "userid",
          foreignField: "userid",
          as: "TDSdata",
        },
      },
      { $unwind: { path: "$TDSdata", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          openingBalance2025_26: {
            $ifNull: [
              { $first: "$TDSdata.financial_report" },
              { closingBalance: 0 },
            ],
          },
        },
      },
      {
        $addFields: {
          successPayment: {
            $add: ["$successPayment", "$openingBalance2025_26.closingBalance"],
          },
        },
      },
      { $project: { TDSdata: 0 } },
    ]);

    const tdsObj = {
      successPayment:
        paymentData.length > 0 ? paymentData[0].successPayment || 0 : 0,
      successWithdraw:
        withdrawData.length > 0 ? withdrawData[0].successWithdraw || 0 : 0,
      tdsPaid: withdrawData.length > 0 ? withdrawData[0].tdsPaid || 0 : 0,
      openingBalance2025_26:
        paymentData.length > 0
          ? paymentData[0].openingBalance2025_26.closingBalance || 0
          : 0,
    };

    console.log("tdsObj", tdsObj);
    await updateTDSdata(userId, tdsObj);

    return {
      financialYear: `${startYear}-${endYear}`,
      startYear,
      endYear,
      withdrawData: withdrawData.length > 0 ? withdrawData : [],
      paymentData: paymentData.length > 0 ? paymentData : [],
    };
  }

  async function incr(key) {
    return await redis.incr(key);
  }

  module.exports = {
    getkeydata,
    setkeydata,
    deletedata,
    redis,
    getTDSdata,
    updateTDSdata,
    storePaymentInRedis,
    updatedPaymentData,
    getDepositAndWithdrawalAmountNew,
    incr,
  };
}






// ----------> OLD REDIS CODE <----------
// if (process.env.redisEnv == 'live') {
//     const Redis = require("ioredis");
  
//     const redis = new Redis.Cluster([
//         {
//           host: global.constant.REDIS_PAYMENT,
//           port: 6379
//         }
//       ], {
//         dnsLookup: (address, callback) => callback(null, address),
//         redisOptions: {
//           tls: true,
//           password: "", // add only if required
//           enableAutoPipelining: true,
//         },
//     });
      
  
//     redis.cluster("slots", (err, slots) => {
//       if (err) {
//         console.error("Cluster slot refresh failed", err);
//       } else {
//         console.log("Cluster slots refreshed");
//       }
//     });
  
//     redis.on("connect", () => {
//       console.log("Connected to Payment Redis");
//     });
  
//     redis.on("error", (err) => {
//       console.error("Payment Redis connection error:", err);
//     });
  
//     async function getkeydata(key) {
//       try {
//         let result;
//         let data = await redis.get(key);
//         if (data) result = JSON.parse(data);
//         else result = null;
//         return result;
//       } catch (error) {
//         console.log("Error: ", error);
//       }
//     }
  
//     function setkeydata(key, data, timing = 5184000) { // Default to 2 months
//       try {
//         let result;
//         // Setting key with an expiration time
//         redis.set(key, JSON.stringify(data), "EX", timing);
//         return data;
//       } catch (error) {
//         console.log("Error: ", error);
//       }
//     }
  
//     function deletedata(key) {
//       try {
//         redis.del(key);
//       } catch (error) {
//         console.log("Error: ", error);
//       }
//     }

//     async function updatedPaymentData(userId, processedPayment) {
//       try {
//         const depositKey = `userid:${userId}-deposit:${processedPayment._id}`;
    
//         // Convert to plain object if it's a Mongoose document
//         const paymentData = typeof processedPayment.toObject === 'function'
//           ? processedPayment.toObject()
//           : processedPayment;
    
//         // Flatten all values to strings
//         const hashData = {};
//         for (const [key, value] of Object.entries(paymentData)) {
//           hashData[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
//         }
    
//         // Store in Redis as a hash
//         await redis.hset(depositKey, hashData);
    
//         // Always set TTL (2 months = 5184000 seconds)
//         await redis.expire(depositKey, 5184000);
    
//         return { status: true, message: 'Stored successfully in Redis with TTL.' };
//       } catch (error) {
//         console.error('Error storing deposit to Redis:', error);
//         return { status: false, message: 'Redis store failed.', error };
//       }
//     }
        

//     async function getTDSdata(userId) {
//         try {
//           const { tdsKey } = getFinancialYearMeta(userId);
      
//           // Attempt to get the TDS data from Redis
//           let tdsData = await redis.hgetall(tdsKey);
      
//           // If no data exists, regenerate and fetch again
//           if (!tdsData || Object.keys(tdsData).length === 0) {
//             await getDepositAndWithdrawalAmountNew(userId);
      
//             // Try fetching again after regeneration
//             tdsData = await redis.hgetall(tdsKey);
//           }
      
//           return tdsData;
//         } catch (err) {
//           console.error('Error in getTDSdata:', err);
//           return false;
//         }
//     }      

//     async function updateTDSdata(userId, dataObj) {
//       try {
//         const { tdsKey } = getFinancialYearMeta(userId);
    
//         const flattened = Object.entries(dataObj).flatMap(([k, v]) => [k, String(v)]);
//         await redis.hset(tdsKey, ...flattened);
    
//         return true;
//       } catch (err) {
//         console.error('Error in updateTDSdata:', err);
//         return false;
//       }
//     }    

//     async function storePaymentInRedis(userId, checkData) {
//       try {
//         const depositKey = `userid:${userId}-deposit:${checkData._id}`;
//         const depositListKey = `userDeposit-${userId}`;
    
//         const hashData = {};
//         for (const [key, value] of Object.entries(checkData)) {
//           hashData[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
//         }
    
//         if (checkData.createdAt) {
//           hashData.createdAt = new Date(checkData.createdAt).toISOString();
//         }
    
//         await redis.hset(depositKey, hashData);
    
//         // Only expire this key
//         await redis.expire(depositKey, 5184000); // 2 months
    
//         await redis.zadd(depositListKey, checkData.createdAt.getTime(), checkData._id.toString());
//         await redis.zremrangebyrank(depositListKey, 0, -51); // keep only latest 50
    
//       } catch (error) {
//         console.error('Error storing deposit in Redis:', error);
//         throw error;
//       }
//     }       

//     // get financial deposited and withdrawed amount
//     async function getDepositAndWithdrawalAmountNew (userId, financialYear = null) {
//       const { startYear, endYear, startDate, endDate, fiscalYearString, tdsKey } = getFinancialYearMeta(userId, financialYear);
    
    
//       let withdrawData = await WithdrawModel.aggregate([
//           {
//               $match: {
//                   userid: mongoose.Types.ObjectId(userId),
//                   status: 1,
//                   createdAt: { $gte: startDate, $lte: endDate }
//               }
//           },
//           {
//               $group: {
//                   _id: null,
//                   successWithdraw: { $sum: { $add: ["$amount", "$tds_amount"] } },
//                   tdsPaid: { $sum: "$tds_amount" }
//               }
//           }
//       ]);
    
//       let paymentData = await depositModel.aggregate([
//           {
//               $match: {
//                   userid: mongoose.Types.ObjectId(userId),
//                   status: { $in: ["SUCCESS", "success"] },
//                   createdAt: { $gte: startDate, $lte: endDate }
//               }
//           },
//           {
//             $group: {
//               _id: null,
//               userid: { $first: "$userid" },
//               successPayment: { $sum: "$amount" }
//             }
//           },
//           {
//             $lookup: {
//               from: "p2ptransactions",
//               localField: "userid",
//               foreignField: "receiver_id",
//               as: "p2p"
//             }
//           },
//           {
//             $unwind: {
//               path: "$p2p",
//               preserveNullAndEmptyArrays: true
//             }
//           },
//           {
//             $group: {
//               _id: null,
//               userid: { $first: "$userid" },
//               successPayment: {
//                 $first: "$successPayment"
//               },
//               totalP2P: { $sum: "$p2p.totalAmount" }
//             }
//           },
//           {
//             $addFields: {
//               successPayment: {
//                 $add: ["$successPayment", "$totalP2P"]
//               }
//             }
//           },
//           {
//             $unionWith: {
//               coll: "users", // Any collection that always has the user (e.g., "users" collection)
//               pipeline: [
//                 {
//                   $match: {
//                     _id: mongoose.Types.ObjectId(userId)
//                   }
//                 },
//                 {
//                   $project: {
//                     userid: "$_id",
//                     successPayment: { $literal: 0 }
//                   }
//                 }
//               ]
//             }
//           },
//           {
//             $group: {
//               _id: "$userid",
//               userid: { $first: "$userid" },
//               successPayment: { $max: "$successPayment" } // Ensures the actual sum is taken if available
//             }
//           },
//           {
//             $lookup: {
//               from: "tdsdetails",
//               localField: "userid",
//               foreignField: "userid",
//               as: "TDSdata"
//             }
//           },
//           {
//             $unwind: {
//               path: "$TDSdata",
//               preserveNullAndEmptyArrays: true
//             }
//           },
//           {
//             $addFields: {
//               openingBalance2025_26: {
//                 $ifNull: [
//                   { $first: "$TDSdata.financial_report" },
//                   { closingBalance: 0 }
//                 ]
//               }
//             }
//           },
//           {
//             $addFields: {
//               successPayment: {
//                 $add: [
//                   "$successPayment",
//                   "$openingBalance2025_26.closingBalance"
//                 ]
//               }
//             }
//           },
//           {
//             $project: {
//               TDSdata: 0
//             }
//           }
//       ]);
    
//       // let fiscalYearString = `${startYear}-${String(endYear).slice(-2)}`;
//       // let tdsKey = `tds:${fiscalYearString}:${userId}`;
    
//       let tdsObj = {
//         successPayment: paymentData.length > 0 ? paymentData[0].successPayment || 0 : 0,
//         successWithdraw: withdrawData.length > 0 ? withdrawData[0].successWithdraw || 0 : 0,
//         tdsPaid: withdrawData.length > 0 ? withdrawData[0].tdsPaid || 0 : 0,
//         openingBalance2025_26: paymentData.length > 0 ? paymentData[0].openingBalance2025_26.closingBalance || 0 : 0
//       }

//       console.log("tdsObj", tdsObj);
    
//       await updateTDSdata(userId, tdsObj); 
    
//       return {
//           financialYear: `${startYear}-${endYear}`,
//           startYear: startYear,
//           endYear: endYear,
//           withdrawData: withdrawData.length > 0 ? withdrawData : [],
//           paymentData: paymentData.length > 0 ? paymentData : [],
//           // challengeWinning: challengeWinning.length > 0 ? challengeWinning : []
//       };
//     };

//     async function incr(key) {
//       return await redis.incr(key);
//     }
      
//     module.exports = { getkeydata, setkeydata, deletedata, redis, getTDSdata, updateTDSdata, storePaymentInRedis, updatedPaymentData, getDepositAndWithdrawalAmountNew, incr };
  
//   } 