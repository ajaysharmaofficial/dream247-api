// if (process.env.redisEnv === 'live') {
//     const { Redis } = require('@upstash/redis');

//     // Initialize Upstash Redis client
//     const redis = new Redis({
//         url: process.env.UPSTASH_REDIS_REST_URL,
//         token: process.env.UPSTASH_REDIS_REST_TOKEN
//     });

//     // Get key data
//     async function getkeydata(key) {
//         try {
//             const data = await redis.get(key);
//             // console.log("KEY", key);
//             // console.log("Data fetched for key:", data);
//             // console.log("Type:", typeof data);

//             if (!data) return null;

//             // Only parse if it looks like JSON
//             if (typeof data === "string" && /^[{\[].*[}\]]$/.test(data)) {
//                 return JSON.parse(data);
//             }

//             return data; // return as plain string or object
//         } catch (error) {
//             console.error("Error in getkeydata:", error);
//             return null;
//         }
//     }

//     // Set key data with expiry
//     async function setkeydata(key, data, timing) {
//         try {
//             await redis.set(key, JSON.stringify(data), { ex: timing });
//             return data;
//         } catch (error) {
//             console.error("Error in setkeydata:", error);
//         }
//     }

//     // Delete key
//     async function deletedata(key) {
//         try {
//             await redis.del(key);
//         } catch (error) {
//             console.error("Error in deletedata:", error);
//         }
//     }

//     // Push array of JSON items into a list with optional expiry
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

//     // Get paginated list data
//     async function getKeyDataList(key, options, all = null) {
//         try {
//             const { pagination } = options || {};
//             const pageSize = pagination?.pageSize || 10;
//             const page = pagination?.page || 1;

//             const start = (page - 1) * pageSize;
//             const end = start + pageSize - 1;

//             return await getFilteredSortedPaginatedData(key, null, start, end, 'asc', all);
//         } catch (err) {
//             console.error('Error in getKeyDataList:', err);
//             return false;
//         }
//     }

//     // Get keys by pattern
//     async function getKeyOnly(pattern) {
//         return await redis.keys(pattern);
//     }

//     // Health check
//     async function healthCheck() {
//         return await redis.ping();
//     }

//     // Scan all keys by pattern
//     async function getAllKeys(pattern) {
//         try {
//             let cursor = 0;
//             let keys = [];
//             const batchSize = 1000;

//             do {
//                 const [newCursor, foundKeys] = await redis.scan(cursor, { match: pattern, count: batchSize });
//                 cursor = Number(newCursor);
//                 if (foundKeys?.length) keys.push(...foundKeys);
//             } while (cursor !== 0);

//             return keys;
//         } catch (error) {
//             console.error("Error in getAllKeys:", error);
//             return [];
//         }
//     }

//     // Hash operations
//     async function hgetData(hashKey, field) {
//         try {
//             const data = await redis.hget(hashKey, field);
//             return data ? JSON.parse(data) : null;
//         } catch (error) {
//             console.error(`Error in hgetData (${hashKey}:${field}):`, error);
//             return null;
//         }
//     }

//     async function hsetData(hashKey, field, value) {
//         try {
//             await redis.hset(hashKey, { [field]: JSON.stringify(value) });
//             return true;
//         } catch (error) {
//             console.error(`Error in hsetData (${hashKey}:${field}):`, error);
//             return false;
//         }
//     }

//     async function hgetAllData(hashKey) {
//         try {
//             const allData = await redis.hgetall(hashKey);
//             if (!allData || Object.keys(allData).length === 0) return [];

//             for (const k in allData) {
//                 try {
//                     allData[k] = JSON.parse(allData[k]);
//                 } catch (e) {
//                     // If it's not valid JSON, keep it as string
//                     allData[k] = allData[k];
//                 }
//             }

//             return allData;
//         } catch (error) {
//             console.error(`Error in hgetAllData (${hashKey}):`, error);
//             return {};
//         }
//     }
//     async function hgetAllDataResult(hashKey) {
//         try {
//             const allData = await redis.hgetall(hashKey);

//             if (!allData || Object.keys(allData).length === 0) return [];
//             let a = []
//             for (const k in allData) {
//                 try {
//                     allData[k] = JSON.parse(allData[k]);
//                 } catch (e) {
//                     // If it's not valid JSON, keep it as string
//                     a.push(allData[k]);
//                 }
//             }

//             return a;
//         } catch (error) {
//             console.error(`Error in hgetAllData (${hashKey}):`, error);
//             return {};
//         }
//     }

//     async function hgetNewAllData(hashKey) {
//         return hgetAllData(hashKey);
//     }

//     // Store data in hash with optional expiry
//     async function storeSortedSet(key, data, timing) {
//         try {
//             const uniqueKey = data._id.toString();
//             const value = JSON.stringify(data);
//             await redis.hset(key, { [uniqueKey]: value });
//             if (timing && Number.isInteger(timing)) {
//                 await redis.expire(key, timing);
//             }
//             console.log(uniqueKey, 'Data stored or updated successfully');
//         } catch (error) {
//             console.error('Error in storeSortedSet:', error);
//         }
//     }

//     // Paginate set members
//     async function getKeysPaginated(keyname, cursor = 0, count = 10) {
//         const [nextCursor, redisdata] = await redis.sscan(keyname, cursor, { count });
//         return {
//             nextCursor,
//             redisdata,
//             hasMore: nextCursor !== '0',
//         };
//     }

//     // Retrieve sorted set (reverse order)
//     // Retrieve sorted set (reverse order)
//     async function retrieveSortedSet(keyname, start = 0, end = 10) {
//         // `rev: true` is the new way to do ZREVRANGE
//         const uniqueKeys = await redis.zrange(keyname, start, end, { rev: true });
//         return uniqueKeys.length > 0
//             ? { redisdata: uniqueKeys }
//             : false;
//     }




//     module.exports = {
//         retrieveSortedSet,
//         getKeysPaginated,
//         hgetNewAllData,
//         storeSortedSet,
//         getkeydata,
//         setkeydata,
//         deletedata,
//         setKeyDataList,
//         getKeyDataList,
//         redis,
//         getKeyOnly,
//         healthCheck,
//         getAllKeys,
//         hsetData,
//         hgetData,
//         hgetAllData,
//         hgetAllDataResult
//     };
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
    async function hgetNewAllData(hashKey) {
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
    async function storeSortedSet(key, data, timing) {
        try {
            // Serialize the data
            const uniqueKey = data._id.toString();
            const value = JSON.stringify(data);
            // Store the full object in a hash
            await redis.call('hset', key, uniqueKey, value);

            // Set expiry time if provided
            if (timing && Number.isInteger(timing)) {
                await redis.call('expire', key, timing);
            }
            console.log(uniqueKey, 'Data stored or updated successfully');
        } catch (error) {
            console.error('Error storing data:', error.message, error.stack);
        }
    }
    // async function getKeysPaginated(keyname,limit, skip) {
    //     const redisdata = await redis.smembers(keyname);
    //     return redisdata;
    // }
    async function getKeysPaginated(keyname, cursor = '0', count = 10) {
        const result = await redis.sscan(keyname, cursor, 'COUNT', count);
        const nextCursor = result[0]; // Use this in next call
        const redisdata = result[1];      // Retrieved members (approx count)

        return {
            nextCursor,
            redisdata,
            hasMore: nextCursor !== '0',
        };
    }
    async function retrieveSortedSet(keyname, start = 0, end = 10) {
        const uniqueKeys = await redis.zrevrange(keyname, 0, end);
        if (uniqueKeys.length > 0) {
            return {
                redisdata: uniqueKeys
            }
        } else {
            return false
        }
        // const result = await redis.sscan(keyname, cursor, 'COUNT', count);
        // const nextCursor = result[0]; // Use this in next call
        // const redisdata = result[1];      // Retrieved members (approx count)

        // return {
        //     nextCursor,
        //     redisdata,
        //     hasMore: nextCursor !== '0',
        // };
    }

    async function hgetAllDataResult(hashKey) {
        try {
            const allData = await redis.hgetall(hashKey);

            if (!allData || Object.keys(allData).length === 0) return [];
            let a = []
            for (const k in allData) {
                try {
                    allData[k] = JSON.parse(allData[k]);
                } catch (e) {
                    // If it's not valid JSON, keep it as string
                    a.push(allData[k]);
                }
            }

            return a;
        } catch (error) {
            console.error(`Error in hgetAllData (${hashKey}):`, error);
            return {};
        }
    }

    module.exports = { retrieveSortedSet, getKeysPaginated, hgetNewAllData, storeSortedSet, getkeydata, setkeydata, deletedata, setKeyDataList, getKeyDataList, redis, getKeyOnly, healthCheck, getAllKeys, hsetData, hgetData, hgetAllData, hgetAllDataResult };

}