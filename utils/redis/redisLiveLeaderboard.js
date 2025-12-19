if (process.env.redisEnv == 'live') {
  const { Redis } = require('@upstash/redis');

  // Create Upstash Redis client
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,  // from Upstash dashboard
    token: process.env.UPSTASH_REDIS_REST_TOKEN // from Upstash dashboard
  });

  // Function to get a key
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

  // Function to set a key with expiry
  async function setkeydata(key, data, timing) {
    try {
      await redis.set(key, JSON.stringify(data), { ex: timing });
      return data;
    } catch (error) {
      console.error("Error: ", error);
      return null;
    }
  }

  // Function to delete a key
  async function deletedata(key) {
    try {
      await redis.del(key);
    } catch (error) {
      console.error("Error: ", error);
    }
  }

  // Function to push list data
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

  // Get filtered/sorted/paginated data (dummy here — replace with your filtering logic)
  async function getKeyDataList(key, options, all = null) {
    try {
      const { pagination } = options || {};
      const pageSize = pagination?.pageSize || 10;
      const page = pagination?.page || 1;
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;

      const list = await redis.lrange(key, start, end);
      return list.map((item) => JSON.parse(item));
    } catch (err) {
      console.error('Error in getKeyDataList:', err);
      return [];
    }
  }

  // Get all keys matching a pattern
  async function getAllKeys(pattern) {
    try {
      const keys = await redis.keys(pattern);
      return keys;
    } catch (error) {
      console.error("Error fetching keys:", error);
      return [];
    }
  }

  // Hash commands
  async function hgetData(hashKey, field) {
    try {
      const data = await redis.hget(hashKey, field);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Error hgetData (${hashKey}:${field}):`, error);
      return null;
    }
  }

  async function hsetData(hashKey, field, value) {
    try {
      await redis.hset(hashKey, { [field]: JSON.stringify(value) });
      return true;
    } catch (error) {
      console.error(`Error hsetData (${hashKey}:${field}):`, error);
      return false;
    }
  }

  async function hgetAllData(hashKey) {
    try {
      const allData = await redis.hgetall(hashKey);
      Object.keys(allData).forEach((key) => {
        allData[key] = JSON.parse(allData[key]);
      });
      return allData;
    } catch (error) {
      console.error(`Error hgetAllData (${hashKey}):`, error);
      return {};
    }
  }
  async function getMatchMyLeaderBoard(key, userId, type = null) {
    try {
      const start = 0, end = -1;

      const uniqueKeys = await redis.zrange(key, start, end);
      console.log('uniqueKeys', uniqueKeys);

      if (!uniqueKeys || uniqueKeys.length === 0) {
        console.error(`No leaderboard data found for key: ${key}`);
        return false;
      }

      let rawData = await redis.hmget(`${key}_data`, ...uniqueKeys);

      // Force rawData into an array no matter what
      if (!Array.isArray(rawData)) {
        rawData = [rawData];
      }

      let filteredData = rawData
        .filter(item => item) // Remove null/empty
        .map(item => {
          if (typeof item === "string") {
            try {
              return JSON.parse(item);
            } catch (err) {
              console.error("Error parsing leaderboard JSON string:", item, err);
              return null;
            }
          } else if (typeof item === "object") {
            return item; // Already an object
          }
          return null;
        })
        .filter(Boolean);

      // Apply filters
      if (!type) {
        filteredData = filteredData.filter(item => {
          if (item.userid == userId.toString()) {
            item.usernumber = 1;
            return true;
          }
          return false;
        });
      } else if (type === 'winner') {
        filteredData = filteredData.filter(item => item.userjoinid == userId);
      }

      return filteredData;

    } catch (error) {
      console.error("Error with Redis leaderboard operations:", error);
      return false;
    }
  }


  // Health check
  async function healthCheck() {
    try {
      return await redis.ping();
    } catch (error) {
      console.error("Redis health check failed:", error);
      return null;
    }
  }
  // Retrieve and parse the sorted set
  // async function retrieveSortedSet(key, userId, start, end) {
  //   const uniqueKeys = await redis.zrange(key, start, end); // Get keys in range
  //   console.log('uniqueKeys-->', uniqueKeys);
  //   if (uniqueKeys.length > 0) {
  //     let rawData = await redis.hmget(`${key}_data`, ...uniqueKeys);
  //     if (rawData) {
  //       rawData = Object.values(rawData);
  //     }
  //     else {
  //       rawData = [];
  //     }
  //     let filteredData = rawData.map(item => (item));
  //     if (userId) {
  //       filteredData = filteredData.filter(item => item.userid !== userId); // Filter by userId
  //     }
  //     return filteredData
  //   } else {
  //     return false
  //   }
  // }


  async function retrieveSortedSet(key, userId, start, end) {
    // Step 1: Get members with scores
    // const membersWithScores = await redis.zrevrange(key, start, end, 'WITHSCORES');

    const membersWithScores = await redis.zrange(key, start, end, {
      rev: true,
      withScores: true,
    });
    if (!membersWithScores || membersWithScores.length === 0) return false;

    // Step 2: Extract members list
    const members = [];
    const scoresMap = new Map();

    for (let i = 0; i < membersWithScores.length; i += 2) {
      const member = membersWithScores[i];
      const points = Number(membersWithScores[i + 1]) || 0;
      members.push(member);
      scoresMap.set(member, points);
    }

    // Step 3: Compute Ranks Manually (for handling equal scores)
    let currentRank = 0;
    let previousPoints = null;
    const formattedRankedData = [];

    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      const points = scoresMap.get(member);
      if (previousPoints === null || points !== previousPoints) {
        currentRank = i + 1; // Rank is based on position (1-based)
      }

      formattedRankedData.push({
        _id: member,
        points: points,
        getcurrentrank: currentRank
      });

      previousPoints = points;
    }
    // Step 4: Fetch additional user details (if needed)
    const rawData = await redis.hmget(`${key}_data`, ...members);
    if (rawData) {
      // const userBatchData = rawData.map(item => (item ? JSON.parse(item) : {}));
      // console.log('userBatchData', userBatchData);
      return formattedRankedData
        .map((item, index) => ({ ...rawData[item._id], ...item, userno: `-1` }))
        .filter(item => item.userid !== userId).sort((a, b) => {
          if (a.getcurrentrank !== b.getcurrentrank) {
            return a.getcurrentrank - b.getcurrentrank; // lower rank comes first
          }
          return a.teamname.localeCompare(b.teamname); // same rank → sort by teamname
        })
    }

    return [];
  }
  // async function getMyLeaderBoard(key, userId, type = null) {
  //   console.log('getMyLeaderBoard');
  //   let start = 0, end = -1;
  //   const uniqueKeys = await redis.zrange(key, start, end);
  //   // const uniqueKeys = await redis.call('zrange', key, start, end); // Force 'zrange' explicitly
  //   if (uniqueKeys.length > 0) {
  //     const rawData = await redis.hmget(`${key}_data`, ...uniqueKeys);
  //     // const rawData = await redis.call('hmget', `${key}_data`, ...uniqueKeys); // Use 'hmget' explicitly
  //     let filteredData = rawData.map(item => JSON.parse(item)); // Parse JSON
  //     if (!type) {
  //       filteredData = filteredData.filter(item => {
  //         if (item?.userid == userId.toString()) {
  //           item.usernumber = 1;
  //           return true;
  //         }
  //         return false;
  //       }); // Filter by userId
  //     }
  //     if (type == 'winner') {
  //       filteredData = filteredData.filter(item => item.userjoinid == userId); // Filter by userId
  //     }
  //     return filteredData
  //   } else {
  //     return false;
  //     console.error("Error with Redis cluster operations:", error);
  //   }
  // }
  async function getMyLeaderBoard(key, userId, type = null) {
    const uniqueKeys = await redis.zrange(key, 0, -1);
    console.log('uniqueKeys', uniqueKeys);
    if (uniqueKeys.length > 0) {
      let rawData = await redis.hmget(`${key}_data`, ...uniqueKeys);
      if (rawData) {
        rawData = Object.values(rawData);
      }
      else {
        rawData = [];
      }

      let filteredData = rawData.map(item => item);

      if (!type) {
        filteredData = filteredData.filter(item => {
          if (item.userid == userId.toString()) {
            item.usernumber = 1;
            return true;
          }
          return false;
        });
      }
      if (type === 'winner') {
        filteredData = filteredData.filter(item => item.userjoinid == userId);
      }
      return filteredData;
    }
    return false;
  }

  async function particularUserLeaderBoard(key, userId, type = null, members = []) {
    if (!Array.isArray(members) || members.length === 0) return false;
    // members = ['691b1c830ff65eb306219651', '691b05e78d028ba2ba92bc40'];
    const pipeline = redis.pipeline();

    // Fetch score and rank for each given member
    members.forEach(member => {
      pipeline.zscore(key, member);  // Get Score
    });
    const scoreResults = await pipeline.exec();

    const memberScores = {};

    members.forEach((member, index) => {
      console.log('scoreResults[index]', scoreResults[index], index);
      memberScores[member] = scoreResults[index] ? Number(scoreResults[index]) : null;
    });
    // Fetch only scores that exist (to avoid extra queries)
    const validMembers = Object.keys(memberScores).filter(member => memberScores[member] !== null);
    if (validMembers.length === 0) return [];

    // Fetch ranks only for valid members
    const rankPipeline = redis.pipeline();
    validMembers.forEach(member => {
      rankPipeline.zcount(key, `(${memberScores[member]}`, "+inf");  // Get Rank (Count higher scores)
    });

    const rankResults = await rankPipeline.exec();
    const finalData = validMembers.map((member, index) => ({
      _id: member,
      points: memberScores[member],
      getcurrentrank: rankResults[index] + 1,  // Convert 0-based to 1-based rank
    }));

    // Fetch additional user details if needed
    let userDetails = await redis.hmget(`${key}_data`, ...validMembers);
    if (userDetails) {
      userDetails = Object.values(userDetails);
    }
    else {
      userDetails = [];
    }
    if (userDetails.some(detail => detail !== null)) {
      // const userBatchData = userDetails.map(item => (item ? JSON.parse(item) : {}));
      return finalData.map((item, index) => ({
        ...userDetails[index],
        ...item,
      }));
    }

    return finalData;
  }

  module.exports = {
    particularUserLeaderBoard,
    retrieveSortedSet,
    getMyLeaderBoard,
    getkeydata,
    setkeydata,
    deletedata,
    setKeyDataList,
    getKeyDataList,
    getMatchMyLeaderBoard,
    redis,
    getAllKeys,
    hsetData,
    hgetData,
    hgetAllData,
    healthCheck
  };
}


// if (process.env.redisEnv == 'live') {
//   const Redis = require("ioredis");
//   const redis = new Redis.Cluster([
//     { host: global.constant.REDIS_LIVE_LEADERBOARD_HOST, port: 6379 }
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
//       const allKeys = await redis.lRange(key, 0, -1); // Get all items from the list
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
//       // Validate Order
//       const Rank = Number(data.getcurrentrank);
//       if (isNaN(Rank)) {
//         throw new Error(`Invalid Order: ${data.getcurrentrank}`);
//       }

//       // Serialize the data
//       const uniqueKey = data._id;
//       const value = JSON.stringify(data);

//       // Add to sorted set
//       await redis.call('zadd', key, Rank, uniqueKey);

//       // Store the full object in a hash
//       await redis.call('hset', `${key}_data`, uniqueKey, value);

//       // Set expiry time if provided
//       if (timing && Number.isInteger(timing)) {
//         await redis.call('expire', key, timing);
//         await redis.call('expire', `${key}_data`, timing);
//       }

//       console.log('Data stored or updated successfully');
//     } catch (error) {
//       console.error('Error storing data:', error.message, error.stack);
//     }
//   }

//   //   async function retrieveSortedSet(key, userId, start, end) {

//   //     const luaScript = `
//   //   local key = KEYS[1]
//   //   local start = tonumber(ARGV[1])
//   //   local end_ = tonumber(ARGV[2])

//   //   local members = redis.call('ZREVRANGE', key, start, end_, 'WITHSCORES')

//   //   local result = {}
//   //   local memberKeys = {}

//   //   local previousPoints = nil
//   //   local currentRank = 0
//   //   local actualRank = 0

//   //   for i = 1, #members, 2 do
//   //       local member = members[i]
//   //       local points = tonumber(members[i + 1]) or 0

//   //       actualRank = actualRank + 1

//   //       if previousPoints == nil or points ~= previousPoints then
//   //           currentRank = actualRank
//   //       end

//   //       table.insert(result, member)
//   //       table.insert(result, points)
//   //       table.insert(result, currentRank)
//   //       table.insert(memberKeys, member)

//   //       previousPoints = points
//   //   end

//   //   return {result, memberKeys}
//   // `;
//   //     const [rankedData, members] = await redis.eval(luaScript, 1, key, start, end);
//   //     // Transform ranked data
//   //     const formattedRankedData = [];
//   //     // let members= [];
//   //     if (rankedData.length > 0) {
//   //       for (let i = 0; i < rankedData.length; i += 3) {
//   //         formattedRankedData.push({
//   //           _id: rankedData[i], // Member ID
//   //           points: rankedData[i + 1], // Points from sorted set
//   //           getcurrentrank: rankedData[i + 2], // Rank
//   //         });
//   //       }


//   //       // console.log("Ranked Data:", formattedRankedData);

//   //       // Fetch additional user details using HGETALL in a pipeline (since MGET won't work in Cluster)
//   //       if (members.length > 0) {
//   //         // console.log('members--', members);
//   //         const rawData = await redis.call('hmget', `${key}_data`, ...members);

//   //         if (!rawData || rawData.length === 0) return;

//   //         const userBatchData = rawData.map(item => (item ? JSON.parse(item) : null)).filter(Boolean);
//   //         // Merge user details with ranked data
//   //         const mergedData = [];
//   //         if (formattedRankedData.length > 0) {
//   //           formattedRankedData.forEach((item, index) => {
//   //             const parsedData = userBatchData[index] || {}; // Extract user data
//   //             const mergedItem = { ...parsedData, ...item };

//   //             if (mergedItem.userid !== userId) {
//   //               mergedData.push(mergedItem);
//   //             }
//   //           });
//   //         }
//   //         return mergedData;
//   //       } else {
//   //         return false;
//   //       }
//   //     } else {
//   //       return false;
//   //     }
//   //   }

//   // async function particularUserLeaderBoard(key, userId, type = null, members) {
//   //   console.log('particularUserLeaderBoard');
//   //   //     const luaScript = `
//   //   //   local results = {}
//   //   //   for i, member in ipairs(ARGV) do
//   //   //     local rank = redis.call('zrank', KEYS[1], member)
//   //   //     table.insert(results, rank)
//   //   //   end
//   //   //   return results
//   //   // `;
//   //   const luaScript = `
//   //   local key = KEYS[1]
//   //   local members = ARGV
//   //   local rankWise = {}

//   //   for i, member in ipairs(members) do
//   //     local rank = redis.call("ZREVRANK", key, member)
//   //     if rank then
//   //       rankWise[member] = rank + 1
//   //     else
//   //       rankWise[member] = nil
//   //     end
//   //   end

//   //   return cjson.encode(rankWise)
//   // `;
//   //   const getRanks = await redis.eval(luaScript, 1, key, ...members);
//   //   const rankWise = JSON.parse(getRanks);
//   //   // console.log('luaScript', luaScript);
//   //   if (getRanks.length > 0) {
//   //     const uniqueKeys = Object.keys(rankWise)
//   //       .map(key => [key, rankWise[key]]) // Convert to an array of [key, rank]
//   //       .sort((a, b) => a[1] - b[1]) // Sort by rank
//   //       .map(([key]) => key);
//   //     const rawData = await redis.call('hmget', `${key}_data`, ...uniqueKeys);
//   //     let filteredData = rawData.map(item => {
//   //       try {
//   //         const parsed = JSON.parse(item);
//   //         if (parsed.userid === userId) {
//   //           parsed.userno = '-1'; // Modify the item
//   //           parsed.getcurrentrank = rankWise[parsed._id];
//   //           return parsed;
//   //         }
//   //         return null; // Exclude non-matching items
//   //       } catch (err) {
//   //         console.error('Error parsing JSON:', item, err);
//   //         return null; // Handle invalid JSON
//   //       }
//   //     })
//   //     if (type == 'winner') {
//   //       filteredData = filteredData.filter(item => item.userjoinid == userId); // Filter by userId
//   //     }
//   //     return filteredData
//   //   } else {
//   //     return false;
//   //   }
//   // }
//   async function retrieveSortedSet(key, userId, start, end) {
//     // Step 1: Get members with scores
//     const membersWithScores = await redis.zrevrange(key, start, end, 'WITHSCORES');

//     if (!membersWithScores || membersWithScores.length === 0) return false;

//     // Step 2: Extract members list
//     const members = [];
//     const scoresMap = new Map();

//     for (let i = 0; i < membersWithScores.length; i += 2) {
//       const member = membersWithScores[i];
//       const points = Number(membersWithScores[i + 1]) || 0;
//       members.push(member);
//       scoresMap.set(member, points);
//     }

//     // Step 3: Compute Ranks Manually (for handling equal scores)
//     let currentRank = 0;
//     let previousPoints = null;
//     const formattedRankedData = [];

//     for (let i = 0; i < members.length; i++) {
//       const member = members[i];
//       const points = scoresMap.get(member);

//       if (previousPoints === null || points !== previousPoints) {
//         currentRank = i + 1; // Rank is based on position (1-based)
//       }

//       formattedRankedData.push({
//         _id: member,
//         points: points,
//         getcurrentrank: currentRank
//       });

//       previousPoints = points;
//     }
//     // Step 4: Fetch additional user details (if needed)
//     const rawData = await redis.hmget(`${key}_data`, ...members);
//     if (rawData && rawData.length > 0) {
//       const userBatchData = rawData.map(item => (item ? JSON.parse(item) : {}));
//       return formattedRankedData
//         .map((item, index) => ({ ...userBatchData[index], ...item, userno: `-1` }))
//         .filter(item => item.userid !== userId).sort((a, b) => {
//           if (a.getcurrentrank !== b.getcurrentrank) {
//             return a.getcurrentrank - b.getcurrentrank; // lower rank comes first
//           }
//           return a.teamname.localeCompare(b.teamname); // same rank → sort by teamname
//         })
//     }

//     return [];
//   }

//   async function particularUserLeaderBoard(key, userId, type = null, members = []) {
//     if (!Array.isArray(members) || members.length === 0) return false;

//     const pipeline = redis.pipeline();

//     // Fetch score and rank for each given member
//     members.forEach(member => {
//       pipeline.zscore(key, member);  // Get Score
//     });

//     const scoreResults = await pipeline.exec();
//     const memberScores = {};

//     members.forEach((member, index) => {
//       memberScores[member] = scoreResults[index][1] ? Number(scoreResults[index][1]) : null;
//     });

//     // Fetch only scores that exist (to avoid extra queries)
//     const validMembers = Object.keys(memberScores).filter(member => memberScores[member] !== null);
//     if (validMembers.length === 0) return [];

//     // Fetch ranks only for valid members
//     const rankPipeline = redis.pipeline();
//     validMembers.forEach(member => {
//       rankPipeline.zcount(key, `(${memberScores[member]}`, "+inf");  // Get Rank (Count higher scores)
//     });

//     const rankResults = await rankPipeline.exec();
//     const finalData = validMembers.map((member, index) => ({
//       _id: member,
//       points: memberScores[member],
//       getcurrentrank: rankResults[index][1] + 1,  // Convert 0-based to 1-based rank
//     }));

//     // Fetch additional user details if needed
//     const userDetails = await redis.hmget(`${key}_data`, ...validMembers);
//     if (userDetails.some(detail => detail !== null)) {
//       const userBatchData = userDetails.map(item => (item ? JSON.parse(item) : {}));
//       return finalData.map((item, index) => ({
//         ...userBatchData[index],
//         ...item,
//       }));
//     }

//     return finalData;
//   }



//   //   async function particularUserLeaderBoard(key, userId, type = null, members) {
//   //     console.log('particularUserLeaderBoard');
//   //     const luaScript = `
//   //   local results = {}
//   //   for i, member in ipairs(ARGV) do
//   //     local rank = redis.call('zrank', KEYS[1], member)
//   //     table.insert(results, rank)
//   //   end
//   //   return results
//   // `;
//   //     const getRanks = await redis.eval(luaScript, 1, key, ...members);
//   //     const rank = await redis.call('zrank', key, '67dddf24c26a0bfb57650535');
//   //     console.log('Rank:', rank);
//   //     console.log('getRanks---->>>', getRanks);
//   //     if (getRanks.length > 0) {
//   //       const uniqueKeys = members.reduce((acc, member, index) => {
//   //         if (getRanks[index] !== null) {
//   //           acc.push(member); // Add the member to the result if the rank is not null
//   //         }
//   //         return acc;
//   //       }, []);
//   //       const rawData = await redis.call('hmget', `${key}_data`, ...uniqueKeys); // Use 'hmget' explicitly
//   //       let filteredData = rawData.map(item => {
//   //         try {
//   //           const parsed = JSON.parse(item);
//   //           if (parsed.userid === userId) {
//   //             parsed.userno = '-1'; // Modify the item
//   //             return parsed;
//   //           }
//   //           return null; // Exclude non-matching items
//   //         } catch (err) {
//   //           console.error('Error parsing JSON:', item, err);
//   //           return null; // Handle invalid JSON
//   //         }
//   //       })
//   //       if (!type) {
//   //         filteredData = filteredData.filter(item => {
//   //           if (item.userid == userId) {
//   //             item.userno = '-1'; // Modify the item if userId matches
//   //             return true; // Keep the item in the filtered array
//   //           }
//   //           return false; // Exclude items that don't match the condition
//   //         });
//   //         // filteredData = filteredData.filter(item => item.userid == userId); // Filter by userId
//   //       }
//   //       if (type == 'winner') {
//   //         filteredData = filteredData.filter(item => item.userjoinid == userId); // Filter by userId
//   //       }
//   //       return filteredData
//   //     } else {
//   //       return false;
//   //     }
//   //   }

//   async function getKeyOnly(key) {
//     const uniqueKeys = await redis.keys(key);
//     return uniqueKeys;
//   }

//   async function getMyLeaderBoard(key, userId, type = null) {
//     console.log('getMyLeaderBoard');
//     let start = 0, end = -1;
//     const uniqueKeys = await redis.call('zrange', key, start, end); // Force 'zrange' explicitly
//     if (uniqueKeys.length > 0) {
//       const rawData = await redis.call('hmget', `${key}_data`, ...uniqueKeys); // Use 'hmget' explicitly
//       let filteredData = rawData.map(item => JSON.parse(item)); // Parse JSON
//       if (!type) {
//         filteredData = filteredData.filter(item => {
//           if (item?.userid == userId.toString()) {
//             item.usernumber = 1;
//             return true;
//           }
//           return false;
//         }); // Filter by userId
//       }
//       if (type == 'winner') {
//         filteredData = filteredData.filter(item => item.userjoinid == userId); // Filter by userId
//       }
//       return filteredData
//     } else {
//       return false;
//       console.error("Error with Redis cluster operations:", error);
//     }
//   }
//   async function getMatchMyLeaderBoard(key, userId, type = null) {
//     let start = 0, end = -1;
//     const uniqueKeys = await redis.call('zrange', key, start, end); // Force 'zrange' explicitly
//     console.log('uniqueKeys', uniqueKeys);
//     if (uniqueKeys.length > 0) {
//       const rawData = await redis.call('hmget', `${key}_data`, ...uniqueKeys); // Use 'hmget' explicitly
//       let filteredData = rawData.map(item => JSON.parse(item)); // Parse JSON
//       if (!type) {
//         filteredData = filteredData.filter(item => {
//           if (item.userid == userId.toString()) {
//             item.usernumber = 1;
//             return true;
//           }
//           return false;
//         }); // Filter by userId
//       }
//       if (type == 'winner') {
//         filteredData = filteredData.filter(item => item.userjoinid == userId); // Filter by userId
//       }
//       return filteredData
//     } else {
//       return false;
//       console.error("Error with Redis cluster operations:", error);
//     }
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

//   module.exports = { getMatchMyLeaderBoard, getkeydata, setkeydata, deletedata, setKeyDataList, getKeyDataList, storeSortedSet, retrieveSortedSet, particularUserLeaderBoard, redis, getKeyOnly, getMyLeaderBoard, getAllKeys };

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
//     const uniqueKeys = await redisClient.zRange(key, start, end, { REV: true, WITHSCORES: true }); // Get keys in range
//     // console.log('uniqueKeys-->', uniqueKeys);
//     if (uniqueKeys.length > 0) {
//       const result = [];
//       for (let i = 0; i < uniqueKeys.length; i += 2) {
//         const member = uniqueKeys[i];
//         const score = uniqueKeys[i + 1];
//         const rank = await redisClient.zRevRank(key, member); // Get rank in descending order

//         result.push({ member, score, rank: rank + 1 }); // Convert zero-based rank to 1-based
//       }
//       console.log('result--->>>', result);
//       const rawData = await redisClient.hmGet(`${key}_data`, uniqueKeys); // Fetch corresponding data
//       // let filteredData = rawData.map(item => JSON.parse(item)) // Parse JSON
//       let rank = 1;
//       let prevPoints = null;
//       let prevRank = 0;
//       let filteredData = rawData.map((item, index) => {
//         let user = JSON.parse(item)
//         if (user.points === prevPoints) {
//           user.getcurrentrank = prevRank; // Same rank for same points
//         } else {
//           user.getcurrentrank = index + 1;
//           prevRank = user.getcurrentrank;
//         }
//         user.userno = `${user.userno}`
//         prevPoints = user.points;
//         return user;
//       }) // Parse JSON
//       if (userId) {
//         filteredData = filteredData.filter(item => item.userid !== userId); // Filter by userId
//       }
//       return filteredData
//     } else {
//       return false
//     }
//   }

//   // async function particularUserLeaderBoard(key, userId, type = null) {
//   //   let start = 0, end = -1;
//   //   const uniqueKeys = await redisClient.zRange(key, start, end); // Get keys in range
//   //   const rawData = await redisClient.hmGet(`${key}_data`, uniqueKeys); // Fetch corresponding data
//   //   let filteredData = rawData.map(item => JSON.parse(item)) // Parse JSON
//   //   if (!type) {
//   //     filteredData = filteredData.filter(item => item.userid == userId); // Filter by userId
//   //   }
//   //   if (type == 'winner') {
//   //     filteredData = filteredData.filter(item => item.userjoinid == userId); // Filter by userId
//   //   }
//   //   return filteredData
//   // }
//   async function particularUserLeaderBoard(key, userId, type = null, members) {
//     console.log('particularUserLeaderBoard');
//     let rankWise = {};
//     const getRanks = await Promise.all(
//       members.map(async member => {
//         const rank = await redisClient.zRevRank(key, member);
//         rankWise[member] = rank + 1;
//         return rank !== null ? rankWise : null;
//       })
//     );
//     // console.log('rankWise', rankWise);
//     if (getRanks.length > 0) {
//       const uniqueKeys = Object.keys(rankWise)
//         .map(key => [key, rankWise[key]]) // Convert to an array of [key, rank]
//         .sort((a, b) => a[1] - b[1]) // Sort by rank
//         .map(([key]) => key);
//       console.log('uniqueKeys', uniqueKeys);
//       const rawData = await redisClient.hmGet(`${key}_data`, uniqueKeys);
//       // const rawData = await redisClient.call('hmget', `${key}_data`, ...uniqueKeys); // Use 'hmget' explicitly
//       let filteredData = rawData.map(item => {
//         try {
//           const parsed = JSON.parse(item);
//           if (parsed.userid === userId) {
//             parsed.userno = '-1'; // Modify the item
//             parsed.getcurrentrank = rankWise[parsed._id];
//             return parsed;
//           }
//           return null; // Exclude non-matching items
//         } catch (err) {
//           console.error('Error parsing JSON:', item, err);
//           return null; // Handle invalid JSON
//         }
//       })
//       if (type == 'winner') {
//         filteredData = filteredData.filter(item => item.userjoinid == userId); // Filter by userId
//       }
//       return filteredData
//     } else {
//       return false;
//     }
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
//   async function getMyLeaderBoard(key, userId, type = null) {
//     // console.log('getMyLeaderBoard');
//     let start = 0, end = -1;
//     const uniqueKeys = await redisClient.zRange(key, start, end); // Get keys in range
//     //   const rawData = await redisClient.hmGet(`${key}_data`, uniqueKeys); // Fetch corresponding data
//     // const uniqueKeys = await redisClient.call('zrange', key, start, end); // Force 'zrange' explicitly
//     if (uniqueKeys.length > 0) {
//       const rawData = await redisClient.hmGet(`${key}_data`, uniqueKeys); // Fetch corresponding data
//       // const rawData = await redisClient.call('hmget', `${key}_data`, ...uniqueKeys); // Use 'hmget' explicitly
//       let filteredData = rawData.map(item => JSON.parse(item)); // Parse JSON
//       if (filteredData.length > 0) {
//         if (!type) {
//           filteredData = filteredData.filter(item => {
//             if (item?.userid == userId.toString()) {
//               item.usernumber = 1;
//               return true;
//             }
//             return false;
//           }); // Filter by userId
//         }
//         if (type == 'winner') {
//           filteredData = filteredData.filter(item => item.userjoinid == userId); // Filter by userId
//         }
//         return filteredData
//       }
//       return [];
//     } else {
//       return false;
//       console.error("Error with Redis cluster operations:", error);
//     }
//   }
//   module.exports = { getMyLeaderBoard, setUserInRedis, getkeydata, setkeydata, deletedata, setKeyDataList, getKeyDataList, storeSortedSet, retrieveSortedSet, particularUserLeaderBoard, redis, getKeyOnly };
// }