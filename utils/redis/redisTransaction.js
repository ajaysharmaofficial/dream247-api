// if (process.env.redisEnv == 'live') {
//     const { Redis } = require('@upstash/redis');

//     // Initialize Upstash Redis client
//     const redis = new Redis({
//         url: process.env.UPSTASH_REDIS_REST_URL,
//         token: process.env.UPSTASH_REDIS_REST_TOKEN
//     });


//     async function getkeydata(key) {
//         try {
//             let result;
//             let data = await redis.get(key);
//             if (data) result = JSON.parse(data);
//             else result = null;
//             return result;
//         } catch (error) {
//             console.log("Error: ", error);
//         }
//     }

//     function setkeydata(key, data, timing) {
//         try {
//             let result;
//             // Setting key with an expiration time
//             redis.set(key, JSON.stringify(data),{ "ex":timing});
//             return data;
//         } catch (error) {
//             console.log("Error: ", error);
//         }
//     }

//     function deletedata(key) {
//         try {
//             redis.del(key);
//         } catch (error) {
//             console.log("Error: ", error);
//         }
//     }


//     async function setKeyDataList(key, data, timing) {
//         try {
//             const jsonDataArray = data.map((item) => JSON.stringify(item));
//             await redis.rpush(key, ...jsonDataArray);
//             if (timing) await redis.expire(key, timing);
//             return true;
//         } catch (err) {
//             console.error('Error in setKeyDataList:', err);
//             return false;
//         }
//     }

//     // Function to get filtered, sorted, and paginated data
//     async function getKeyDataList(key, options, all = null) {
//         try {
//             const { pagination, filter } = options || {};
//             const pageSize = pagination?.pageSize || 10;
//             const page = pagination?.page || 1;

//             const start = (page - 1) * pageSize;
//             const end = start + pageSize - 1;

//             return await getFilteredSortedPaginatedData(key, filter, start, end, 'asc', all);
//         } catch (err) {
//             console.error('Error in getKeyDataList:', err);
//             return false;
//         }
//     }

//     // Function to filter, sort, and paginate data
//     async function getFilteredSortedPaginatedData(key, filter, start, end, order = 'asc', all) {
//         try {
//             const allKeys = await filterDataByField(key, filter);
//             const sortedKeys = order === 'asc' ? allKeys : allKeys.reverse();
//             if (all) {
//                 sortedKeys.slice(start, end + 1);
//             }
//             return sortedKeys
//         } catch (err) {
//             console.error('Error in getFilteredSortedPaginatedData:', err);
//             return [];
//         }
//     }

//     // Function to filter data by field
//     async function filterDataByField(key, filter) {
//         try {
//             const allKeys = await redis.lRange(key, 0, -1); // Get all items from the list
//             const filteredData = [];

//             for (const item of allKeys) {
//                 const parsedItem = JSON.parse(item);
//                 let matches = true;

//                 // Apply filters
//                 if (Object.keys(filter).length) {
//                     for (const field in filter) {
//                         if (parsedItem[field] !== filter[field]) {
//                             matches = false;
//                             break;
//                         }
//                     }
//                 }

//                 if (matches) filteredData.push(parsedItem);
//             }

//             return filteredData;
//         } catch (err) {
//             console.error('Error in filterDataByField:', err);
//             return [];
//         }
//     }
//     /**
//    * Update user wallet and log transaction
//    * @param {String} userId - User ID
//    * @param {Object} walletUpdate - Example: { balance: -100, winning: 50 }
//    * @param {Object} txData - Full transaction object
//    */
//     async function saveTransactionInRedis(userId, transaction) {
//         const transactionId = transaction.transaction_id;
//         const transactionKey = `transaction:${transactionId}`;
//         const userTxListKey = `user_transactions:${userId}`;

//         const pipeline = redis.multi();

//         pipeline.hmset(transactionKey, transaction);
//         pipeline.lpush(userTxListKey, transactionId);
//         pipeline.ltrim(userTxListKey, 0, 500); // Keep only last 500

//         try {
//             await pipeline.exec();
//             console.log(`✅ Transaction ${transactionId} saved for user ${userId}`);
//         } catch (err) {
//             console.error(`❌ Redis Transaction Save Error for user ${userId}:`, err);
//         }
//     }

//     module.exports = { saveTransactionInRedis, getkeydata, setkeydata, deletedata, setKeyDataList, getKeyDataList, redis };

// }






if (process.env.redisEnv == 'live') {
  const Redis = require("ioredis");

  const redis = new Redis.Cluster([
    { host: global.constant.REDIS_HOST, port: 6379 }
  ], {
    dnsLookup: (address, callback) => callback(null, address),
    redisOptions: {
      tls: true,
      password: "",
      enableAutoPipelining: true,
    },
  });

  redis.cluster("slots", (err, slots) => {
    if (err) {
      console.error("Cluster slot refresh failed", err);
    } else {
      console.log("Cluster slots refreshed");
    }
  });

  redis.on("connect", () => {
    console.log("Connected to Redis");
  });

  redis.on("error", (err) => {
    console.error("Redis connection error:", err);
  });

  async function getkeydata(key) {
    try {
      let result;
      let data = await redis.get(key);
      if (data) result = JSON.parse(data);
      else result = null;
      return result;
    } catch (error) {
      console.log("Error: ", error);
    }
  }

  function setkeydata(key, data, timing) {
    try {
      let result;
      // Setting key with an expiration time
      redis.set(key, JSON.stringify(data), "EX", timing);
      return data;
    } catch (error) {
      console.log("Error: ", error);
    }
  }

  function deletedata(key) {
    try {
      redis.del(key);
    } catch (error) {
      console.log("Error: ", error);
    }
  }


  async function setKeyDataList(key, data, timing) {
    try {
      const jsonDataArray = data.map((item) => JSON.stringify(item));
      await redis.rpush(key, ...jsonDataArray);
      if (timing) await redis.expire(key, timing);
      return true;
    } catch (err) {
      console.error('Error in setKeyDataList:', err);
      return false;
    }
  }

  // Function to get filtered, sorted, and paginated data
  async function getKeyDataList(key, options, all = null) {
    try {
      const { pagination, filter } = options || {};
      const pageSize = pagination?.pageSize || 10;
      const page = pagination?.page || 1;

      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;

      return await getFilteredSortedPaginatedData(key, filter, start, end, 'asc', all);
    } catch (err) {
      console.error('Error in getKeyDataList:', err);
      return false;
    }
  }

  // Function to filter, sort, and paginate data
  async function getFilteredSortedPaginatedData(key, filter, start, end, order = 'asc', all) {
    try {
      const allKeys = await filterDataByField(key, filter);
      const sortedKeys = order === 'asc' ? allKeys : allKeys.reverse();
      if (all) {
        sortedKeys.slice(start, end + 1);
      }
      return sortedKeys
    } catch (err) {
      console.error('Error in getFilteredSortedPaginatedData:', err);
      return [];
    }
  }

  // Function to filter data by field
  async function filterDataByField(key, filter) {
    try {
      const allKeys = await redis.lRange(key, 0, -1); // Get all items from the list
      const filteredData = [];

      for (const item of allKeys) {
        const parsedItem = JSON.parse(item);
        let matches = true;

        // Apply filters
        if (Object.keys(filter).length) {
          for (const field in filter) {
            if (parsedItem[field] !== filter[field]) {
              matches = false;
              break;
            }
          }
        }

        if (matches) filteredData.push(parsedItem);
      }

      return filteredData;
    } catch (err) {
      console.error('Error in filterDataByField:', err);
      return [];
    }
  }
  /**
 * Update user wallet and log transaction
 * @param {String} userId - User ID
 * @param {Object} walletUpdate - Example: { balance: -100, winning: 50 }
 * @param {Object} txData - Full transaction object
 */
  async function saveTransactionInRedis(userId, transaction) {
    const transactionId = transaction.transaction_id;
    const transactionKey = `transaction:${transactionId}`;
    const userTxListKey = `user_transactions:${userId}`;

    const pipeline = redis.multi();

    pipeline.hmset(transactionKey, transaction);
    pipeline.lpush(userTxListKey, transactionId);
    pipeline.ltrim(userTxListKey, 0, 500); // Keep only last 500

    try {
      await pipeline.exec();
      console.log(`✅ Transaction ${transactionId} saved for user ${userId}`);
    } catch (err) {
      console.error(`❌ Redis Transaction Save Error for user ${userId}:`, err);
    }
  }

  module.exports = { saveTransactionInRedis, getkeydata, setkeydata, deletedata, setKeyDataList, getKeyDataList, redis };

} 