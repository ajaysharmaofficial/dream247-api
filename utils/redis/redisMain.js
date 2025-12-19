if (process.env.redisEnv === "live") {
  const { Redis } = require("@upstash/redis");

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  console.log("✅ Connected to Upstash Redis");

  // ------------------- FUNCTIONS -------------------

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

  async function setkeydata(key, data, timing) {
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

  async function setKeyDataList(key, data, timing) {
    try {
      const jsonDataArray = data.map((item) => JSON.stringify(item));
      await redis.rpush(key, ...jsonDataArray);
      if (timing) await redis.expire(key, timing);
      return true;
    } catch (err) {
      console.error("Error in setKeyDataList:", err);
      return false;
    }
  }

  async function getKeyDataList(key, options, all = null) {
    try {
      const { pagination, filter } = options || {};
      const pageSize = pagination?.pageSize || 10;
      const page = pagination?.page || 1;

      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;

      return await getFilteredSortedPaginatedData(key, filter, start, end, "asc", all);
    } catch (err) {
      console.error("Error in getKeyDataList:", err);
      return false;
    }
  }

  // ------------------- Helper for filtering list data -------------------
  async function getFilteredSortedPaginatedData(key, filter, start, end, order = "asc", all) {
    try {
      const allKeys = await filterDataByField(key, filter);
      const sortedKeys = order === "asc" ? allKeys : allKeys.reverse();
      if (all) {
        sortedKeys.slice(start, end + 1);
      }
      return sortedKeys;
    } catch (err) {
      console.error("Error in getFilteredSortedPaginatedData:", err);
      return [];
    }
  }

  async function filterDataByField(key, filter) {
    try {
      const allKeys = await redis.lrange(key, 0, -1);
      const filteredData = [];

      for (const item of allKeys) {
        const parsedItem = JSON.parse(item);
        let matches = true;

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
      console.error("Error in filterDataByField:", err);
      return [];
    }
  }

  async function getKeyOnly(pattern) {
    return await getAllKeys(pattern);
  }

  async function healthCheck() {
    try {
      const pong = await redis.ping();
      return pong;
    } catch (err) {
      console.error("Error in healthCheck:", err);
      return "ERR";
    }
  }

  async function getAllKeys(pattern) {
    try {
      let cursor = 0;
      let keys = [];
      const batchSize = 1000;

      console.log(`⏳ Scanning Redis for keys matching: ${pattern}`);

      do {
        const [newCursor, foundKeys] = await redis.scan(cursor, {
          match: pattern,
          count: batchSize,
        });
        cursor = Number(newCursor);
        if (Array.isArray(foundKeys) && foundKeys.length > 0) {
          keys.push(...foundKeys);
        }
        console.log(`🔍 Found ${keys.length} keys so far...`);
      } while (cursor !== 0);

      console.log(`✅ SCAN complete. Total keys found: ${keys.length}`);
      return keys;
    } catch (error) {
      console.error("❌ Error fetching keys from Redis:", error);
      return [];
    }
  }
  async function retrieveLiveSortedSet(key) {
    const uniqueKeys = await redis.zrange(key, 0, -1);
    // const uniqueKeys = await redis.call('zrange', key, 0, -1); // Force 'zrange' explicitly
    if (uniqueKeys.length > 0) {
      return uniqueKeys;
    } else {
      return false;
    }
  }

  // async function storeLiveMatches(key, data, timing) {
  //   try {
  //     // Validate Order
  //     const order = Number(data.order);
  //     if (isNaN(order)) {
  //       throw new Error(`Invalid Order: ${data.order}`);
  //     }
  //     // Serialize the data
  //     const uniqueKey = data._id;
  //     // Add to sorted set
  //     await redis.zadd(key, { score: order, member: uniqueKey });
  //     // await redis.call('zadd', key, order, uniqueKey);
  //     // Set expiry time if provided
  //     if (timing && Number.isInteger(timing)) {
  //       await redis.call('expire', key, timing);
  //     }
  //     console.log('Data stored or updated successfully');
  //   } catch (error) {
  //     console.error('Error storing data:', error.message, error.stack);
  //   }
  // }

  async function storeLiveMatches(key, data, timing) {
    try {
      console.log("Data to be stored:", data);
      console.log("Key:", key);

      const order = Number(data.order);
      if (isNaN(order)) {
        throw new Error(`Invalid Order: ${data.order}`);
      }

      const uniqueKey = data._id;

      // Check type
      const type = await redis.type(key);
      if (type !== "zset" && type !== "none") {
        console.warn(`⚠️ Key ${key} is of type ${type}, deleting to reset`);
        await redis.del(key);
      }

      // Always store in zset
      await redis.zadd(key, { score: order, member: uniqueKey });

      // Expiry
      if (timing && Number.isInteger(timing)) {
        await redis.expire(key, timing);
      }

      console.log("✅ Data stored or updated successfully");
    } catch (error) {
      console.error("❌ Error storing data:", error.message, error.stack);
    }
  }

  module.exports = {
    storeLiveMatches,
    getkeydata,
    setkeydata,
    deletedata,
    setKeyDataList,
    getKeyDataList,
    redis,
    getKeyOnly,
    healthCheck,
    getAllKeys,
    retrieveLiveSortedSet,
  };
}


// if (process.env.redisEnv == 'live') {
//   const Redis = require("ioredis");

//   const redis = new Redis.Cluster([
//     { host: global.constant.REDIS_HOST, port: 6379 }
//   ], {
//     dnsLookup: (address, callback) => callback(null, address),
//     redisOptions: {
//       tls: true,
//       password: "",
//       enableAutoPipelining: true,
//     },
//   });

//   redis.cluster("slots", (err, slots) => {
//     if (err) {
//       console.error("Cluster slot refresh failed", err);
//     } else {
//       console.log("Cluster slots refreshed");
//     }
//   });

//   redis.on("connect", () => {
//     console.log("Connected to Redis");
//   });

//   redis.on("error", (err) => {
//     console.error("Redis connection error:", err);
//   });

//   async function getkeydata(key) {
//     try {
//       let result;
//       let data = await redis.get(key);
//       if (data) result = JSON.parse(data);
//       else result = null;
//       return result;
//     } catch (error) {
//       console.log("Error: ", error);
//     }
//   }

//   function setkeydata(key, data, timing) {
//     try {
//       let result;
//       // Setting key with an expiration time
//       redis.set(key, JSON.stringify(data), "EX", timing);
//       return data;
//     } catch (error) {
//       console.log("Error: ", error);
//     }
//   }

//   function deletedata(key) {
//     try {
//       redis.del(key);
//     } catch (error) {
//       console.log("Error: ", error);
//     }
//   }


//   async function setKeyDataList(key, data, timing) {
//     try {
//       const jsonDataArray = data.map((item) => JSON.stringify(item));
//       await redis.rpush(key, ...jsonDataArray);
//       if (timing) await redis.expire(key, timing);
//       return true;
//     } catch (err) {
//       console.error('Error in setKeyDataList:', err);
//       return false;
//     }
//   }

//   // Function to get filtered, sorted, and paginated data
//   async function getKeyDataList(key, options, all = null) {
//     try {
//       const { pagination, filter } = options || {};
//       const pageSize = pagination?.pageSize || 10;
//       const page = pagination?.page || 1;

//       const start = (page - 1) * pageSize;
//       const end = start + pageSize - 1;

//       return await getFilteredSortedPaginatedData(key, filter, start, end, 'asc', all);
//     } catch (err) {
//       console.error('Error in getKeyDataList:', err);
//       return false;
//     }
//   }

//   async function getKeyOnly(key) {
//     const uniqueKeys = await redis.keys(key);
//     return uniqueKeys;
//   }

//   async function healthCheck(key) {
//     const data = await redis.ping();
//     return data;
//   }

//   async function getAllKeys(pattern) {
//     try {
//       let cursor = "0";
//       let keys = [];
//       const batchSize = 1000; // Fetch keys in batches to prevent memory overload

//       console.log(`⏳ Scanning Redis for keys matching: ${pattern}`);

//       do {
//         const reply = await redis.call('SCAN', cursor, "MATCH", pattern, "COUNT", batchSize);
//         if (!reply || !Array.isArray(reply) || reply.length < 2) {
//           console.error("❌ Unexpected SCAN response:", reply);
//           break;
//         }

//         cursor = reply[0]; // Update cursor
//         const foundKeys = reply[1];

//         if (Array.isArray(foundKeys) && foundKeys.length > 0) {
//           keys.push(...foundKeys);
//         }

//         console.log(`🔍 Found ${keys.length} keys so far...`);

//       } while (cursor !== "0");

//       console.log(`✅ SCAN complete. Total keys found: ${keys.length}`);
//       return keys;

//     } catch (error) {
//       console.error("❌ Error fetching keys from Redis:", error);
//       return [];
//     }
//   }

//   module.exports = { getkeydata, setkeydata, deletedata, setKeyDataList, getKeyDataList, redis, getKeyOnly, healthCheck, getAllKeys };

// } else {
//   const redis = require('redis');

//   // let url = 'redis://ffs-redis-prod-old-x1m14m.serverless.aps1.cache.amazonaws.com';
//   let redisClient = redis.createClient({
//     // url: url
//   });
//   // Connect to the Redis server
//   redisClient.connect().catch(console.error)
//     .then(async () => {
//       await setkeydata('rinku1', { status: true }, 60 * 60);
//       console.log('Connected to Redis server successfully');
//     });
//   redisClient.on('error', err => console.log('Redis Client Error', err));

//   async function getkeydata(key) {
//     let result;
//     let data = await redisClient.get(key);
//     if (data)
//       result = JSON.parse(data);
//     else
//       result = null;
//     return result;
//   }

//   function setkeydata(key, data, timing) {
//     let result;
//     redisClient.set(key, JSON.stringify(data), { EX: timing });
//     return data;

//   }


//   function deletedata(key) {
//     redisClient.del(key);
//   }

//   async function healthCheck(key) {
//     const data = await redisClient.ping();
//     return data;
//   }

//   async function setKeyDataList(key, data, timing) {
//     try {
//       const jsonDataArray = data.map((item) => JSON.stringify(item));
//       await redisClient.rpush(key, ...jsonDataArray);
//       if (timing) await redisClient.expire(key, timing);
//       return true;
//     } catch (err) {
//       console.error('Error in setKeyDataList:', err);
//       return false;
//     }
//   }

//   // Function to get filtered, sorted, and paginated data
//   async function getKeyDataList(key, options, all = null) {
//     try {
//       const { pagination, filter } = options || {};
//       const pageSize = pagination?.pageSize || 10;
//       const page = pagination?.page || 1;

//       const start = (page - 1) * pageSize;
//       const end = start + pageSize - 1;

//       return await getFilteredSortedPaginatedData(key, filter, start, end, 'asc', all);
//     } catch (err) {
//       console.error('Error in getKeyDataList:', err);
//       return false;
//     }
//   }

//   // Function to filter, sort, and paginate data
//   async function getFilteredSortedPaginatedData(key, filter, start, end, order = 'asc', all) {
//     try {
//       const allKeys = await filterDataByField(key, filter);
//       const sortedKeys = order === 'asc' ? allKeys : allKeys.reverse();
//       if (all) {
//         sortedKeys.slice(start, end + 1);
//       }
//       return sortedKeys
//     } catch (err) {
//       console.error('Error in getFilteredSortedPaginatedData:', err);
//       return [];
//     }
//   }

//   // Function to filter data by field
//   async function filterDataByField(key, filter) {
//     try {
//       const allKeys = await redisClient.lRange(key, 0, -1); // Get all items from the list
//       const filteredData = [];

//       for (const item of allKeys) {
//         const parsedItem = JSON.parse(item);
//         let matches = true;

//         // Apply filters
//         if (Object.keys(filter).length) {
//           for (const field in filter) {
//             if (parsedItem[field] !== filter[field]) {
//               matches = false;
//               break;
//             }
//           }
//         }

//         if (matches) filteredData.push(parsedItem);
//       }

//       return filteredData;
//     } catch (err) {
//       console.error('Error in filterDataByField:', err);
//       return [];
//     }
//   }

//   async function storeSortedSet(key, data, timing) {
//     try {
//       // Ensure `data.getcurrentrank` is a valid number
//       const rank = Number(data.getcurrentrank);
//       if (isNaN(rank)) {
//         throw new Error(`Invalid rank: ${data.getcurrentrank}`);
//       }

//       // Ensure `data` is properly serialized to a string
//       const uniqueKey = data._id;
//       const value = JSON.stringify(data);
//       // Use pipeline for atomic operations
//       const pipeline = redisClient.multi();

//       // Add to sorted set (rank and uniqueKey)
//       pipeline.zAdd(key, { score: rank, value: uniqueKey });

//       // Store the full object in a hash for additional data
//       pipeline.hSet(`${key}_data`, uniqueKey, value);

//       // Set expiry time if provided
//       if (timing) {
//         pipeline.expire(key, timing);
//         pipeline.expire(`${key}_data`, timing);
//       }

//       await pipeline.exec();
//       console.log('Data stored or updated successfully');
//     } catch (error) {
//       console.error('Error storing data:', error);
//     }
//   }


//   // Retrieve and parse the sorted set
//   async function retrieveSortedSet(key, userId, start, end) {
//     const uniqueKeys = await redisClient.zRange(key, start, end); // Get keys in range
//     console.log('uniqueKeys-->', uniqueKeys);
//     if (uniqueKeys.length > 0) {
//       const rawData = await redisClient.hmGet(`${key}_data`, uniqueKeys); // Fetch corresponding data
//       let filteredData = rawData.map(item => JSON.parse(item)) // Parse JSON
//       if (userId) {
//         filteredData = filteredData.filter(item => item.userid !== userId); // Filter by userId
//       }
//       return filteredData
//     } else {
//       return false
//     }
//   }
//   async function particularUserLeaderBoard(key, userId, type = null) {
//     let start = 0, end = -1;
//     const uniqueKeys = await redisClient.zRange(key, start, end); // Get keys in range
//     const rawData = await redisClient.hmGet(`${key}_data`, uniqueKeys); // Fetch corresponding data
//     let filteredData = rawData.map(item => JSON.parse(item)) // Parse JSON
//     if (!type) {
//       filteredData = filteredData.filter(item => item.userid == userId); // Filter by userId
//     }
//     if (type == 'winner') {
//       filteredData = filteredData.filter(item => item.userjoinid == userId); // Filter by userId
//     }
//     return filteredData
//   }

//   async function getKeyOnly(key) {
//     const uniqueKeys = await redisClient.keys(key);
//     return uniqueKeys;
//   }
//   async function setUserInRedis(allUsers) {
//     const pipeline = redisClient.pipeline(); // Use pipeline for batch execution

//     for (const user of allUsers) {
//       const userId = user._id.toString();
//       const mobile = user.mobile.toString();
//       const email = user.email.toString();

//       // Store user data in a Redis Hash
//       pipeline.hmSet(`user:${userId}`, {
//         userId,
//         mobile,
//         email,
//         data: JSON.stringify(user)
//       });

//       // Index mobile and email for fast lookup
//       pipeline.set(`mobile:${mobile}`, userId);
//       pipeline.set(`email:${email}`, userId);
//     }

//     await pipeline.exec(); // Execute all Redis operations in a batch
//     return true;
//   }
//   module.exports = { setUserInRedis, getkeydata, setkeydata, deletedata, setKeyDataList, getKeyDataList, storeSortedSet, retrieveSortedSet, particularUserLeaderBoard, redis, getKeyOnly, healthCheck };
// }