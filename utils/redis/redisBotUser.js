// if (process.env.redisEnv === "live") {
//   const { Redis } = require("@upstash/redis");

//   // Create Upstash Redis client
//   const redis = new Redis({
//     url: process.env.UPSTASH_REDIS_REST_URL, // Upstash REST URL
//     token: process.env.UPSTASH_REDIS_REST_TOKEN, // Upstash Access Token
//   });

//   redis.ping()
//     .then(() => console.log("Connected to Redis (Upstash Bot User)"))
//     .catch((err) => console.error("Redis connection error:", err));

//   async function getkeydata(key) {
//     try {
//       const data = await redis.get(key);
//       return data ? JSON.parse(data) : null;
//     } catch (error) {
//       console.log("Error: ", error);
//     }
//   }

//   async function setkeydata(key, data, timing) {
//     try {
//       await redis.set(key, JSON.stringify(data), { ex: timing });
//       return data;
//     } catch (error) {
//       console.log("Error: ", error);
//     }
//   }

//   async function deletedata(key) {
//     try {
//       await redis.del(key);
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
//       console.error("Error in setKeyDataList:", err);
//       return false;
//     }
//   }

//   async function getKeyDataList(key, options, all = null) {
//     try {
//       const { pagination, filter } = options || {};
//       const pageSize = pagination?.pageSize || 10;
//       const page = pagination?.page || 1;

//       const start = (page - 1) * pageSize;
//       const end = start + pageSize - 1;

//       return await getFilteredSortedPaginatedData(
//         key,
//         filter,
//         start,
//         end,
//         "asc",
//         all
//       );
//     } catch (err) {
//       console.error("Error in getKeyDataList:", err);
//       return false;
//     }
//   }

//   async function getKeyOnly(pattern) {
//     return await redis.keys(pattern);
//   }

//   async function healthCheck() {
//     return await redis.ping();
//   }

//   async function getAllKeys(pattern) {
//     try {
//       let cursor = "0";
//       let keys = [];
//       const batchSize = 1000;

//       console.log(`⏳ Scanning Redis for keys matching: ${pattern}`);

//       do {
//         const [nextCursor, foundKeys] = await redis.scan(
//           cursor,
//           "MATCH",
//           pattern,
//           "COUNT",
//           batchSize
//         );
//         cursor = nextCursor;
//         if (foundKeys?.length) keys.push(...foundKeys);
//         console.log(`🔍 Found ${keys.length} keys so far...`);
//       } while (cursor !== "0");

//       console.log(`✅ SCAN complete. Total keys found: ${keys.length}`);
//       return keys;
//     } catch (error) {
//       console.error("❌ Error fetching keys from Redis:", error);
//       return [];
//     }
//   }

//   async function hgetData(hashKey, field) {
//     try {
//       const data = await redis.hget(hashKey, field);
//       return data ? JSON.parse(data) : null;
//     } catch (error) {
//       console.error(
//         `❌ Error getting data from Redis Hash (${hashKey}:${field}):`,
//         error
//       );
//       return null;
//     }
//   }

//   async function hsetData(hashKey, field, value) {
//     try {
//       await redis.hset(hashKey, { [field]: JSON.stringify(value) });
//       console.log(`✅ Data saved in Redis Hash: ${hashKey} -> ${field}`);
//       return true;
//     } catch (error) {
//       console.error(
//         `❌ Error setting data in Redis Hash (${hashKey}:${field}):`,
//         error
//       );
//       return false;
//     }
//   }

//   async function hgetAllData(hashKey) {
//     try {
//       const allData = await redis.hgetall(hashKey);
//       if (!allData || Object.keys(allData).length === 0) return [];

//       Object.keys(allData).forEach((key) => {
//         allData[key] = JSON.parse(allData[key]);
//       });

//       return allData;
//     } catch (error) {
//       console.error(
//         `❌ Error getting all data from Redis Hash (${hashKey}):`,
//         error
//       );
//       return {};
//     }
//   }

//   async function scanSetWithPagination(redisKey, limit = 100, cursor = "0") {
//     let collected = [];
//     let currentCursor = cursor;

//     do {
//       const [nextCursor, members] = await redis.sscan(
//         redisKey,
//         currentCursor,
//         "COUNT",
//         limit * 2
//       );
//       collected.push(...members);
//       currentCursor = nextCursor;

//       if (collected.length >= limit) {
//         break;
//       }
//     } while (currentCursor !== "0");

//     return {
//       data: collected.slice(0, limit),
//       nextCursor: currentCursor !== "0" ? currentCursor : null,
//     };
//   }

//   module.exports = {
//     scanSetWithPagination,
//     getkeydata,
//     setkeydata,
//     deletedata,
//     setKeyDataList,
//     getKeyDataList,
//     redis,
//     getKeyOnly,
//     healthCheck,
//     getAllKeys,
//     hsetData,
//     hgetData,
//     hgetAllData,
//   };
// }


if (process.env.redisEnv == 'live') {
    const Redis = require("ioredis");
    let redis;

    if (process.env.REDIS_PROVIDER === "upstash") {
        redis = new Redis(process.env.UPSTASH_REDIS_REST_URL, {
            enableAutoPipelining: true,
        });

        console.log("🚀 Using Upstash Redis");

    } else {
        redis = new Redis.Cluster([
            { host: global.constant.REDIS_HOST, port: 6379 }
        ], {
            dnsLookup: (address, callback) => callback(null, address),
            redisOptions: {
                tls: true,
                password: "",
                enableAutoPipelining: true,
            },
        });

        console.log("🚀 Using AWS Redis Cluster");
        redis.cluster("slots", (err) => {
            if (err) {
                console.error("Cluster slot refresh failed", err);
            } else {
                console.log("Cluster slots refreshed");
            }
        });
    }

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

    async function getKeyOnly(key) {
        const uniqueKeys = await redis.keys(key);
        return uniqueKeys;
    }

    async function healthCheck(key) {
        const data = await redis.ping();
        return data;
    }

    async function getAllKeys(pattern) {
        try {
            let cursor = "0";
            let keys = [];
            const batchSize = 1000; // Fetch keys in batches to prevent memory overload

            console.log(`⏳ Scanning Redis for keys matching: ${pattern}`);

            do {
                const reply = await redis.call('SCAN', cursor, "MATCH", pattern, "COUNT", batchSize);
                if (!reply || !Array.isArray(reply) || reply.length < 2) {
                    console.error("❌ Unexpected SCAN response:", reply);
                    break;
                }

                cursor = reply[0]; // Update cursor
                const foundKeys = reply[1];

                if (Array.isArray(foundKeys) && foundKeys.length > 0) {
                    keys.push(...foundKeys);
                }

                console.log(`🔍 Found ${keys.length} keys so far...`);

            } while (cursor !== "0");

            console.log(`✅ SCAN complete. Total keys found: ${keys.length}`);
            return keys;

        } catch (error) {
            console.error("❌ Error fetching keys from Redis:", error);
            return [];
        }
    }

    // Function to get data from Redis Hash (hget)
    async function hgetData(hashKey, field) {
        try {
            const data = await redis.hget(hashKey, field);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error(`❌ Error getting data from Redis Hash (${hashKey}:${field}):`, error);
            return null;
        }
    }

    // Function to set data in Redis Hash (hset)
    async function hsetData(hashKey, field, value) {
        try {
            await redis.hset(hashKey, field, JSON.stringify(value));
            console.log(`✅ Data saved in Redis Hash: ${hashKey} -> ${field}`);
            return true;
        } catch (error) {
            console.error(`❌ Error setting data in Redis Hash (${hashKey}:${field}):`, error);
            return false;
        }
    }

    // Function to get all data from Redis Hash
    async function hgetAllData(hashKey) {
        try {
            const allData = await redis.hgetall(hashKey);
            // if (!allData) return [];\
            if (!allData || Object.keys(allData).length === 0) return [];

            // Parse all values from string to JSON
            Object.keys(allData).forEach((key) => {
                allData[key] = JSON.parse(allData[key]);
            });

            return allData;
        } catch (error) {
            console.error(`❌ Error getting all data from Redis Hash (${hashKey}):`, error);
            return {};
        }
    }
    /**
 * Paginate a Redis Set using SSCAN (safe for large sets)
 * @param {string} redisKey - Redis key of the set
 * @param {number} limit - Max items to return in this page
 * @param {string} cursor - Redis scan cursor (start with '0')
 * @returns {object} - { data: [], nextCursor: '0' or more }
 */
    async function scanSetWithPagination(redisKey, limit = 100, cursor = '0') {
        let collected = [];
        let currentCursor = cursor;

        do {
            const [nextCursor, members] = await redis.sscan(redisKey, currentCursor, 'COUNT', limit * 2); // over-fetch a bit
            collected.push(...members);
            currentCursor = nextCursor;

            // Stop when we have enough data
            if (collected.length >= limit) {
                break;
            }
        } while (currentCursor !== '0');

        return {
            data: collected.slice(0, limit),
            nextCursor: currentCursor !== '0' ? currentCursor : null // null means end
        };
    }


    module.exports = { scanSetWithPagination, getkeydata, setkeydata, deletedata, setKeyDataList, getKeyDataList, redis, getKeyOnly, healthCheck, getAllKeys, hsetData, hgetData, hgetAllData };

}