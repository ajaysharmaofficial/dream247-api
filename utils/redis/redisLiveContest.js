// config/redisClient.js
const { Redis } = require('@upstash/redis');

// Only initialize in live environment
let redis = null;
if (process.env.redisEnv === 'live') {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  console.log("✅ Connected to Upstash Redis");
}

// -------------------------
// Helper Functions
// -------------------------

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
    console.error("❌ Error in setkeydata:", error);
    return null;
  }
}

async function deletedata(key) {
  try {
    await redis.del(key);
  } catch (error) {
    console.error("❌ Error in deletedata:", error);
  }
}

async function setKeyDataList(key, data, timing) {
  try {
    const jsonDataArray = data.map((item) => JSON.stringify(item));
    await redis.rpush(key, ...jsonDataArray);
    if (timing) await redis.expire(key, timing);
    return true;
  } catch (err) {
    console.error('❌ Error in setKeyDataList:', err);
    return false;
  }
}

async function getKeyDataList(key, options, all = null) {
  try {
    const { pagination } = options || {};
    const pageSize = pagination?.pageSize || 10;
    const page = pagination?.page || 1;

    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;

    const listData = await redis.lrange(key, start, end);
    return listData.map((item) => JSON.parse(item));
  } catch (err) {
    console.error('❌ Error in getKeyDataList:', err);
    return [];
  }
}

async function getKeyOnly(pattern) {
  try {
    return await getAllKeys(pattern);
  } catch (error) {
    console.error("❌ Error in getKeyOnly:", error);
    return [];
  }
}

async function healthCheck() {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch (error) {
    console.error("❌ Redis healthCheck failed:", error);
    return false;
  }
}

async function getAllKeys(pattern) {
  try {
    let cursor = 0;
    let keys = [];

    do {
      const [nextCursor, foundKeys] = await redis.scan(cursor, { match: pattern, count: 1000 });
      cursor = parseInt(nextCursor, 10);
      keys.push(...foundKeys);
    } while (cursor !== 0);

    return keys;
  } catch (error) {
    console.error("❌ Error in getAllKeys:", error);
    return [];
  }
}

// Hash Operations
async function hgetData(hashKey, field) {
  try {
    const data = await redis.hget(hashKey, field);
    if (!data) return null;

    try {
      return JSON.parse(data); // if valid JSON
    } catch {
      return data; // return as string if not JSON
    }
  } catch (error) {
    console.error(`❌ Error in hgetData (${hashKey}:${field}):`, error);
    return null;
  }
}

async function hsetData(hashKey, field, value, ttlInSeconds = null) {
  try {
    await redis.hset(hashKey, { [field]: JSON.stringify(value) });
    if (ttlInSeconds) {
      await redis.expire(hashKey, ttlInSeconds);
    }
    return true;
  } catch (error) {
    console.error(`❌ Error in hsetData (${hashKey}:${field}):`, error);
    return false;
  }
}

async function hgetAllData(hashKey) {
  try {
    const allData = await redis.hgetall(hashKey);
    const parsedData = {};
    for (const [key, value] of Object.entries(allData)) {
      parsedData[key] = JSON.parse(value);
    }
    return parsedData;
  } catch (error) {
    console.error(`❌ Error in hgetAllData (${hashKey}):`, error);
    return {};
  }
}

async function hdelData(hashKey, field) {
  try {
    await redis.hdel(hashKey, field);
    console.log(`✅ Deleted field ${field} from hash ${hashKey}`);
  } catch (err) {
    console.error(`❌ Error in hdelData (${hashKey}:${field}):`, err);
  }
}

module.exports = {
  redis,
  getkeydata,
  setkeydata,
  deletedata,
  setKeyDataList,
  getKeyDataList,
  getKeyOnly,
  healthCheck,
  getAllKeys,
  hgetData,
  hsetData,
  hgetAllData,
  hdelData
};



// if (process.env.redisEnv == 'live') {
//     const Redis = require("ioredis");
  
//     const redis = new Redis.Cluster([
//       { host: global.constant.REDIS_LIVE_CONTEST_HOST, port: 6379 }
//     ], {
//       dnsLookup: (address, callback) => callback(null, address),
//       redisOptions: {
//         tls: true,
//         password: "",
//         enableAutoPipelining: true,
//       },
//     });
  
//     redis.cluster("slots", (err, slots) => {
//       if (err) {
//         console.error("Cluster slot refresh failed", err);
//       } else {
//         console.log("Cluster slots refreshed");
//       }
//     });
  
//     redis.on("connect", () => {
//       console.log("Connected to Redis");
//     });
  
//     redis.on("error", (err) => {
//       console.error("Redis connection error:", err);
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
  
//     function setkeydata(key, data, timing) {
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
  
  
//     async function setKeyDataList(key, data, timing) {
//       try {
//         const jsonDataArray = data.map((item) => JSON.stringify(item));
//         await redis.rpush(key, ...jsonDataArray);
//         if (timing) await redis.expire(key, timing);
//         return true;
//       } catch (err) {
//         console.error('Error in setKeyDataList:', err);
//         return false;
//       }
//     }
  
//     // Function to get filtered, sorted, and paginated data
//     async function getKeyDataList(key, options, all = null) {
//       try {
//         const { pagination, filter } = options || {};
//         const pageSize = pagination?.pageSize || 10;
//         const page = pagination?.page || 1;
  
//         const start = (page - 1) * pageSize;
//         const end = start + pageSize - 1;
  
//         return await getFilteredSortedPaginatedData(key, filter, start, end, 'asc', all);
//       } catch (err) {
//         console.error('Error in getKeyDataList:', err);
//         return false;
//       }
//     }
  
//     async function getKeyOnly(key) {
//       const uniqueKeys = await redis.keys(key);
//       return uniqueKeys;
//     }
  
//     async function healthCheck(key) {
//       const data = await redis.ping();
//       return data;
//     }
  
//     async function getAllKeys(pattern) {
//       try {
//         let cursor = "0";
//         let keys = [];
//         const batchSize = 1000; // Fetch keys in batches to prevent memory overload
  
//         console.log(`⏳ Scanning Redis for keys matching: ${pattern}`);
  
//         do {
//           const reply = await redis.call('SCAN', cursor, "MATCH", pattern, "COUNT", batchSize);
//           if (!reply || !Array.isArray(reply) || reply.length < 2) {
//             console.error("❌ Unexpected SCAN response:", reply);
//             break;
//           }
  
//           cursor = reply[0]; // Update cursor
//           const foundKeys = reply[1];
  
//           if (Array.isArray(foundKeys) && foundKeys.length > 0) {
//             keys.push(...foundKeys);
//           }
  
//           console.log(`🔍 Found ${keys.length} keys so far...`);
  
//         } while (cursor !== "0");
  
//         console.log(`✅ SCAN complete. Total keys found: ${keys.length}`);
//         return keys;
  
//       } catch (error) {
//         console.error("❌ Error fetching keys from Redis:", error);
//         return [];
//       }
//     }
  
//     // Function to get data from Redis Hash (hget)
//     async function hgetData(hashKey, field) {
//       try {
//         const data = await redis.hget(hashKey, field);
//         return data ? JSON.parse(data) : null;
//       } catch (error) {
//         console.error(`❌ Error getting data from Redis Hash (${hashKey}:${field}):`, error);
//         return null;
//       }
//     }
  
//     // Function to set data in Redis Hash (hset)
//     async function hsetData(hashKey, field, value, ttlInSeconds = null) {
//       try {
//         await redis.hset(hashKey, field, JSON.stringify(value));
//         console.log(`✅ Data saved in Redis Hash: ${hashKey} -> ${field}`);
//         if (ttlInSeconds && Number(ttlInSeconds) > 0) {
//           const ttlSet = await redis.expire(hashKey, ttlInSeconds);
//           if (ttlSet) {
//             console.log(`⏳ TTL of ${ttlInSeconds}s set for Redis key: ${hashKey}`);
//           }
//         }
//         return true;
//       } catch (error) {
//         console.error(`❌ Error setting data in Redis Hash (${hashKey}:${field}):`, error);
//         return false;
//       }
//     }
  
//     // Function to get all data from Redis Hash
//     async function hgetAllData(hashKey) {
//       try {
//         const allData = await redis.hgetall(hashKey);
//         if (!allData) return {};
  
//         // Parse all values from string to JSON
//         Object.keys(allData).forEach((key) => {
//           allData[key] = JSON.parse(allData[key]);
//         });
  
//         return allData;
//       } catch (error) {
//         console.error(`❌ Error getting all data from Redis Hash (${hashKey}):`, error);
//         return {};
//       }
//     }
  
//     async function hdelData(hashKey, field) {
//       try {
//         await redis.hdel(hashKey, field);
//         console.log(`✅ Deleted field ${field} from Redis Hash: ${hashKey}`);
//       } catch (err) {
//         console.error(`❌ Failed to delete field ${field} from Redis: ${hashKey}`, err);
//       }
//     }
  
//     module.exports = { getkeydata, setkeydata, deletedata, setKeyDataList, getKeyDataList, redis, getKeyOnly, healthCheck, getAllKeys, hsetData, hgetData, hgetAllData, hdelData };
  
//   }
  