// const kafka = require('../connections/kafkaConnection');
const mongoose = require('mongoose');
const { Kafka } = require('kafkajs');
const _ = require('lodash');
const leaderBoardModel = require('../../models/userLeaderBoardModel');
const joinTeamModel = require('../../models/userTeamModel');
const transactionModel = require('../../models/walletTransactionModel');
const userModel = require('../../models/userModel');

const { setkeydata, getkeydata, redisJoinTeam } = require('../../utils/redis/redisLiveJoinTeams');
const { redis, storeSortedSet } = require('../../utils/redis/redisLiveLeaderboard');
const { matchTimeDifference } = require("../../utils/matchTimeDiffrence");
// const pLimit = require('p-limit');
const CONCURRENCY_LEVEL = 10000; // 🔥 Increase concurrency for faster processing

const kafka = new Kafka({
    clientId: "my-producer",
    brokers: ["localhost:9092"],
});

const delay = async (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const runConsumer = async () => {
    const consumer = kafka.consumer({
        groupId: 'leaderboardGroup',
        sessionTimeout: 60000,
        heartbeatInterval: 20000,
        rebalanceTimeout: 120000,
        autoCommit: false,
        maxPollInterval: 300000,
        maxBytes: 104857600, // ⬆️ Increase to 100MB
        fetchMaxBytes: 104857600, // ⬆️ Increase to 100MB
        fetchMaxBytesPerPartition: 52428800, // ⬆️ Increase per partition (50MB)
        maxInFlightRequests: 5, // ⬆️ Allow parallel requests
        fromBeginning: false,
    });

    try {
        await consumer.connect();
        console.log(`✅ Consumer connected: Group ID - leaderboardGroup`);

        await consumer.subscribe({ topic: "leaderboardUpdatess", fromBeginning: true });
        console.log(`✅ Subscribed to topic: leaderboardUpdatess`);

        await consumer.run({
            eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
                try {
                    console.log(`📌 Processing batch of ${batch.messages.length} messages`);

                    const pipeline = redis.pipeline();
                    const tasks = batch.messages.map(async (message, index) => {
                        try {
                            const messageData = JSON.parse(message.value.toString());
                            if (!messageData || messageData.length === 0) return;

                            const { matchkey, challengeId, uniqueKeys } = messageData[0];
                            const keyChallengeLeaderBoard = `liveRanksLeaderboard_${challengeId}`;
                            const keyResultName = `resultPoint-${matchkey}`;

                            console.log(`📌 Processing message #${index} from Partition`);
                            const resultPointData = await redisJoinTeam.get(keyResultName) || [];
                            // Fetch data from Redis in bulk
                            const rawData = await redis.hmget(`${keyChallengeLeaderBoard}_data`, ...uniqueKeys);
                            if (!rawData || rawData.length === 0) return;

                            const userBatchData = rawData.map(item => (item ? JSON.parse(item) : null)).filter(Boolean);

                            const teamDataResponses = await Promise.all(
                                userBatchData.map(async (userData) => {  // Renamed "data" to "userData" to avoid conflicts
                                    const key = `match:${matchkey}:user:${userData.userid}:teams`;
                                    let redisData = await redisJoinTeam.get(key);
                                    if (!redisData || redisData.length <= 0) {
                                        redisData = await setTeamsInRedis(userData.userid, matchkey);
                                    }
                                    return { ...userData, response: redisData }; // Ensure userData is spread, not redisData
                                })
                            );

                            const teamDataMap = {};
                            // teamDataResponses.forEach(({ _id, jointeamid, response }) => {
                            //     if (response) {
                            //         const parsedResponse = response ? JSON.parse(response) : null;
                            //         if (Array.isArray(parsedResponse)) {
                            //             // Find the matching object inside the array
                            //             teamDataMap[_id] = parsedResponse.find(item => item._id.toString() === jointeamid.toString()) || null;
                            //         } else {
                            //             // Handle single object case
                            //             console.log('not match parsedResponse');
                            //         }
                            //     } else {
                            //         console.log('response', response);
                            //     }

                            // });
                            teamDataResponses.forEach(({ _id, jointeamid, response }) => {
                                try {
                                    let parsedResponse = response;

                                    // Parse only if response is a string
                                    if (typeof response === 'string') {
                                        parsedResponse = JSON.parse(response);
                                    }

                                    if (Array.isArray(parsedResponse)) {
                                        // Find the matching object inside the array
                                        teamDataMap[_id] = parsedResponse.find(item => item._id.toString() === jointeamid.toString()) || null;
                                    } else if (typeof parsedResponse === 'object' && parsedResponse !== null) {
                                        // Handle single object case (if needed)
                                        console.log('Single object received instead of an array', parsedResponse);
                                    } else {
                                        console.log('Invalid response format:', response);
                                    }
                                } catch (error) {
                                    console.error('Error parsing response:', error.message, response);
                                }
                            });

                            if (teamDataResponses.length === 0) return;
                            let i = 1;
                            for (const id of uniqueKeys) {
                                const joindata = teamDataMap[id];
                                if (!joindata) {
                                    console.log(`❌ No team data found for user: ${id}`);
                                    // continue;
                                }
                                let totalPoints = 0;
                                let resultPoints = JSON.parse(resultPointData);
                                if (joindata?.players?.length > 0) {
                                    for (const player of joindata.players) {
                                        const playerPoint = resultPoints[0][player.toString()] ? parseFloat(resultPoints[0][player.toString()]) : 0;
                                        let multiplier = 1;
                                        if (player === joindata?.captain) multiplier = 2;
                                        else if (player === joindata?.vicecaptain) multiplier = 1.5;
                                        totalPoints += playerPoint * multiplier;
                                    }
                                }
                                // console.log('totalPoints--->>>', totalPoints);
                                // ✅ Batch Redis update
                                await redis.zadd(keyChallengeLeaderBoard, totalPoints, id);
                            }
                            // for (const data of userBatchData) {
                            //     // console.log(`📌 Processing message i #${i++}`);
                            //     let totalPoints = 0;
                            //     const redisKey = `match:${matchkey}:user:${data.userid}:teams`;

                            //     // // Fetch user team data
                            //     let joindata = await redisJoinTeam.get(redisKey);
                            //     joindata = JSON.parse(joindata);
                            //     if (!joindata) {
                            //         console.log('!joindata');
                            //         // let teams = await joinTeamModel.find({ userid: userId, matchkey: matchkey }).lean();
                            //         // teams = JSON.stringify(teams);
                            //         // await redis.set(redisKey, teams, "EX", 60 * 60 * 48); // Ensure correct Redis instance is used
                            //         // joindata = await this.setTeamsInRedis(data.userid, matchkey);
                            //     }

                            //     // // Use direct ID lookup
                            //     joindata = joindata?.find(team => team._id.toString() === data.jointeamid.toString());
                            //     // console.log('!joindata1', joindata);
                            //     if (!joindata) {
                            //         console.log('!joindata1');
                            //         // joindata = await this.setTeamsInRedis(data.userid, matchkey);
                            //     }
                            //     // if (!joindata) continue;

                            //     // Calculate total points
                            //     for (const player of joindata.players || []) {
                            //         const playerPoint = resultPointData[0]?.[player] ? parseFloat(resultPointData[0][player]) : 0;
                            //         let multiplier = 1;
                            //         if (player === joindata?.captain) multiplier = 2;
                            //         else if (player === joindata?.vicecaptain) multiplier = 1.5;
                            //         totalPoints += playerPoint * multiplier;
                            //     }
                            //     totalPoints = 1;
                            //     // Batch Redis update
                            //     pipeline.zadd(keyChallengeLeaderBoard, totalPoints, data._id.toString());
                            // }

                            resolveOffset(message.offset);
                            await heartbeat(); // Prevent Kafka rebalancing
                        } catch (error) {
                            console.error(`❌ Error processing message:`, error);
                        }
                    });

                    // Wait for all tasks to complete
                    await Promise.allSettled(tasks);

                    // Execute all batched Redis operations
                    // await pipeline.exec();
                    await commitOffsetsIfNecessary(); // Commit offsets

                    await heartbeat();
                    console.log(`✅ Batch processing complete.`);
                } catch (error) {
                    console.error("❌ Error processing Kafka batch:", error);
                }
            }
        });

    } catch (error) {
        console.error("❌ Consumer error:", error);
        await consumer.disconnect();
    }
};




async function processBatch(batchData) {
    try {
        if (!Array.isArray(batchData) || batchData.length === 0) {
            throw new Error("Invalid batchData");
        }

        // 🔹 Retrieve and update match player data before processing teams
        const firstTeam = batchData[0];
        if (!firstTeam.real_matchkey) {
            throw new Error("Missing real_matchkey in batchData");
        }

        const keyName = `playerList-matchkey-${firstTeam.real_matchkey}`;
        let getMatchPlayers = await getkeydata(keyName) || [];
        const keyResultName = `resultPoint-${match.real_matchkey}`;
        let getResultPointData = await getkeydata(keyResultName) || [];
        // 🔹 Process each team and calculate points
        const redisUpdates = batchData.map(async (team) => {
            let totalPoints = 0;
            const { user } = team;
            const redisKey = `match:${user.matchkey}:user:${user.userid}:teams`;
            let joindata = await getkeydata(redisKey);

            if (!joindata) {
                joindata = await setTeamsInRedis(user.userid, data.matchkey);
            }
            const players = joindata?.players || [];
            players.forEach((player) => {
                const playerPoint = getResultPointData[0]?.[player] ? parseFloat(getResultPointData[0][player]) : 0;
                let multiplier = (player === joindata?.captain) ? 2 : (player === joindata?.vicecaptain) ? 1.5 : 1;
                totalPoints += playerPoint * multiplier;
            });

            return {
                _id: user._id,
                points: totalPoints,
                getcurrentrank: totalPoints,
                challengeid: user.challengeid,
                lastUpdate: user.lastUpdate || false,
                teamnumber: user.teamnumber,
                userno: "0",
                userjoinid: user.userjoinid,
                userid: user.userid,
                jointeamid: user.jointeamid,
                teamname: user.teamname,
                image: `${process.env.IMAGE_URL}avtar1.png`,
                player_type: "classic",
                winingamount: "",
                contest_winning_type: "price",
                // playersData: user.playersData,
                // captain: user.captain,
                // vicecaptain: user.vicecaptain
            };
        });

        // 🔹 Wait for all calculations to finish
        const resolvedRedisUpdates = await Promise.all(redisUpdates);
        var expRedisTime = await matchTimeDifference(data.matchkey);
        // 🔹 Update match player data in Redis safely
        if (Array.isArray(getMatchPlayers) && getMatchPlayers.length > 0) {
            getMatchPlayers.forEach(player => {
                player.points = batchData.find(team =>
                    team.getResultPointData?.[0]?.[player.playerid] !== undefined
                )?.getResultPointData?.[0]?.[player.playerid] || 0;
            });
            await setkeydata(keyName, getMatchPlayers, expRedisTime);
        }

        // 🔹 Bulk Redis leaderboard updates
        await Promise.all(
            resolvedRedisUpdates.map((data) =>
                storeSortedSet(`liveRanksLeaderboard_${data.challengeid}`, data, expRedisTime)
            )
        );

        console.log(`✅ Batch processed successfully!`);
        return true;
    } catch (error) {
        console.error("❌ Error processing batch:", error);
        return false;
    }
}



async function setTeamsInRedis(userId, matchkey) {
    try {
        const redisKey = `match:${matchkey}:user:${userId}:teams`;
        const teams = await joinTeamModel.find({
            userid: userId,
            matchkey: matchkey,
        }).lean();
        var expRedisTime = await matchTimeDifference(matchkey);
        await setkeydata(redisKey, teams, expRedisTime);
        return teams;
    } catch (error) {
        console.error("Error in setTeamsInRedis:", error);
        throw error;
    }
}

// const mappingPlayersConsumer = async () => {
//     try {
//         const consumer = kafka.consumer({
//             groupId: 'mapping-group',
//             sessionTimeout: 60000,
//             heartbeatInterval: 20000,
//             rebalanceTimeout: 120000,
//             autoCommit: false,
//             maxPollInterval: 300000,
//             maxBytes: 10485760,
//             fromBeginning: false
//         });

//         await consumer.connect();
//         await consumer.subscribe({ topic: "leaderboard-mapping", fromBeginning: true });

//         console.log("✅ Consumer subscribed to leaderboard-mapping");

//         await consumer.run({
//             eachBatchAutoResolve: false,
//             eachBatch: async ({ batch, resolveOffset, commitOffsetsIfNecessary }) => {
//                 try {
//                     let bulkUpdateOperations = [];
//                     let redisMulti = redis.multi();

//                     console.log('Processing batch:', batch.messages.length);

//                     const messageProcessingPromises = batch.messages.map(async (message) => {
//                         try {
//                             const matchData = JSON.parse(message.value.toString());
//                             if (!matchData.length) return;
//                             let i = 0;
//                             for (let data of matchData) {
//                                 const redisKey = `match:${data.matchkey}:user:${data.userId}:teams`;
//                                 let joindata = await redis.call('get', redisKey);

//                                 if (!joindata) {
//                                     joindata = await setTeamsInRedis(data.userId, data.matchkey);
//                                 }

//                                 const players = joindata?.players || [];

//                                 const redisLeaderboard = {
//                                     _id: data._id.toString(),
//                                     points: 0,
//                                     getcurrentrank: 1,
//                                     challengeid: data.challengeid.toString(),
//                                     lastUpdate: data.lastUpdate || false,
//                                     teamnumber: data.teamnumber,
//                                     userno: "0",
//                                     userjoinid: data.joinId.toString(),
//                                     userid: data.userId.toString(),
//                                     jointeamid: data.teamId.toString(),
//                                     teamname: data.user_team,
//                                     joinNumber: data.joinNumber,
//                                     image: `${process.env.IMAGE_URL}avtar1.png`,
//                                     player_type: "classic",
//                                     winingamount: "",
//                                     contest_winning_type: "price",
//                                     playersData: players,
//                                     captain: joindata?.captain?.toString(),
//                                     vicecaptain: joindata?.vicecaptain?.toString()
//                                 };

//                                 const uniqueKey = redisLeaderboard._id;
//                                 const key = `liveRanksLeaderboard_${data.challengeid}`;
//                                 const value = JSON.stringify(redisLeaderboard);

//                                 // Add Redis commands using call inside multi
//                                 redisMulti.call('zadd', key, redisLeaderboard.getcurrentrank, uniqueKey);
//                                 redisMulti.call('hset', `${key}_data`, uniqueKey, value);
//                                 redisMulti.call('expire', key, 172800);
//                                 redisMulti.call('expire', `${key}_data`, 172800);
//                                 console.log('i', i++);
//                                 bulkUpdateOperations.push({
//                                     updateOne: {
//                                         filter: { _id: data._id },
//                                         update: { $set: { mapping: true } },
//                                     },
//                                 });

//                                 resolveOffset(message.offset);
//                             }
//                         } catch (error) {
//                             console.error("❌ Error processing message:", error);
//                         }
//                     });

//                     await Promise.all(messageProcessingPromises);

//                     if (bulkUpdateOperations.length) {
//                         const bulkChunks = _.chunk(bulkUpdateOperations, 1000);
//                         await Promise.all(bulkChunks.map(chunk => leaderBoardModel.bulkWrite(chunk)));
//                     }

//                     await redisMulti.exec();
//                     await commitOffsetsIfNecessary();
//                     console.log(`✅ Processed batch of ${batch.messages.length} messages`);
//                 } catch (error) {
//                     console.error("❌ Error processing batch:", error);
//                 }
//             },
//         });
//     } catch (error) {
//         console.error("❌ Consumer error:", error);
//     }
// };

async function createConsumer(consumerId) {
    try {
        const consumer = kafka.consumer({
            groupId: "mapping-group",  // ✅ Consumers in same group will auto-balance partitions
            clientId: `mapping-consumer-${consumerId}`, // ✅ Unique ID for tracking
            sessionTimeout: 60000,
            heartbeatInterval: 20000,
            rebalanceTimeout: 120000,
            autoCommit: false,
            maxPollInterval: 300000,
            maxBytes: 52428800, // ⬆️ Increase batch size to 50MB
            fromBeginning: false,
        });

        await consumer.connect();
        await consumer.subscribe({ topic: "leaderboard-mapping-new", fromBeginning: true });

        console.log(`✅ Consumer ${consumerId} subscribed to leaderboard-mapping-new`);
        const pLimit = (await import('p-limit')).default;
        const processLimit = pLimit(100);
        await consumer.run({
            eachBatchAutoResolve: false,
            eachBatch: async ({ batch, resolveOffset, commitOffsets, commitOffsetsIfNecessary, heartbeat }) => {
                try {
                    // let i = 0;
                    // for (let message of batch.messages) {
                    //     console.log('i', i++);
                    //     resolveOffset(message.offset);
                    // }
                    // console.log(`🛠️ Consumer ${consumerId} processing batch from Partition`);

                    let bulkUpdateOperations = [];
                    let i = 0;
                    const tasks = batch.messages.map((message, i) => processLimit(async () => {
                        try {
                            const data = JSON.parse(message.value.toString());
                            if (!data) return;

                            console.log(`📌 Consumer ${consumerId} processing message #${i++} from Partition:`);

                            // ✅ Redis operations
                            const redisKey = `match:${data.matchkey}:user:${data.userId}:teams`;
                            let joindata = await getkeydata(redisKey);

                            if (!joindata) {
                                joindata = await setTeamsInRedis(data.userId, data.matchkey);
                            }

                            const players = joindata?.players || [];

                            const redisLeaderboard = {
                                _id: data._id.toString(),
                                points: 0,
                                getcurrentrank: 1,
                                challengeid: data.challengeid.toString(),
                                lastUpdate: data.lastUpdate || false,
                                teamnumber: data.teamnumber,
                                userno: "0",
                                userjoinid: data.joinId.toString(),
                                userid: data.userId.toString(),
                                jointeamid: data.teamId.toString(),
                                teamname: data.user_team,
                                joinNumber: data.joinNumber,
                                image: `${global.constant.IMAGE_URL}avtar1.png`,
                                player_type: "classic",
                                winingamount: "",
                                contest_winning_type: "price",
                                playersData: players,
                                captain: joindata?.captain?.toString(),
                                vicecaptain: joindata?.vicecaptain?.toString(),
                            };

                            const uniqueKey = redisLeaderboard._id;
                            const key = `liveRanksLeaderboard_${data.challengeid}`;
                            const dataKey = `liveRanksLeaderboard_${data.challengeid}_data`;
                            const value = JSON.stringify(redisLeaderboard);

                            await Promise.all([
                                redis.call("zadd", key, redisLeaderboard.getcurrentrank, uniqueKey),
                                redis.call("hset", dataKey, uniqueKey, value),
                            ]);

                            bulkUpdateOperations.push({
                                updateOne: {
                                    filter: { _id: data._id },
                                    update: { $set: { mapping: true } },
                                },
                            });

                            resolveOffset(message.offset); // ✅ Mark message as processed
                            await heartbeat(); // ✅ Prevents Kafka rebalancing issues

                        } catch (error) {
                            console.error(`❌ Error processing message in Consumer ${consumerId}:`);
                        }
                    }));

                    // ✅ Wait for all messages to be processed
                    // await Promise.all(tasks);
                    await Promise.allSettled(tasks);

                    // ✅ Perform bulk database update
                    if (bulkUpdateOperations.length) {
                        const bulkChunks = _.chunk(bulkUpdateOperations, 10000);
                        await Promise.all(bulkChunks.map(chunk => leaderBoardModel.bulkWrite(chunk, { ordered: false })));
                    }

                    await commitOffsetsIfNecessary(); // ✅ Commit offsets
                    // await commitOffsets();

                    await heartbeat();
                    console.log(`✅ Consumer ${consumerId} successfully processed Partition:`);

                } catch (error) {
                    console.error(`❌ Error in Consumer ${consumerId}:`, error);
                }
            },
        });
    } catch (error) {
        console.error(`❌ Consumer ${consumerId} error:`, error);
    }
}


const mappingPlayersConsumer = async () => {
    // Launch multiple consumers
    const NUM_CONSUMERS = 1; // Change this number to control how many consumers run
    let partition = 0;
    for (let i = 1; i <= NUM_CONSUMERS; i++) {
        createConsumer(i);
        // partition = partition === 0 ? 1 : 0;
    }
}

const pointUpdateRedisToDB = async () => {
    const consumer = kafka.consumer({
        groupId: 'leaderboardGroupNew2',
        sessionTimeout: 60000,
        heartbeatInterval: 20000,
        rebalanceTimeout: 120000,
        autoCommit: false,
        maxPollInterval: 300000,
        maxBytes: 104857600, // ⬆️ Increase to 100MB
        fetchMaxBytes: 104857600, // ⬆️ Increase to 100MB
        fetchMaxBytesPerPartition: 52428800, // ⬆️ Increase per partition (50MB)
        maxInFlightRequests: 5, // ⬆️ Allow parallel requests
        fromBeginning: false,
    });

    try {
        await consumer.connect();
        console.log(`✅ Consumer connected: Group ID - leaderboard-group-new2`);

        await consumer.subscribe({ topic: "leaderboard-update-point-new2", fromBeginning: true });
        console.log(`✅ Subscribed to topic: leaderboard-update-point-new2`);

        await consumer.run({
            eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
                try {
                    const tasks = batch.messages.map(async (message, index) => {
                        try {
                            const messageData = JSON.parse(message.value.toString());
                            if (!messageData || messageData.length === 0) return;

                            console.log(`✅ Received ${messageData.length} messages`);

                            if (messageData.length > 0) {
                                await processPointBatch(messageData); // ✅ Process entire batch at once
                                await delay(2000);
                            }

                            resolveOffset(message.offset);
                            await heartbeat(); // Prevent Kafka rebalancing
                        } catch (error) {
                            console.error(`❌ Error processing message:`, error);
                        }
                    });

                    // Wait for all tasks to complete
                    await Promise.allSettled(tasks);

                    // Execute all batched Redis operations
                    // await pipeline.exec();
                    await commitOffsetsIfNecessary(); // Commit offsets

                    await heartbeat();

                } catch (error) {
                    console.error("❌ Batch Error:", error);
                }
            }
        });


    } catch (error) {
        console.error("❌ Consumer error:", error);
        await consumer.disconnect();
    }
};


async function processPointBatch(batchData) {
    try {
        let bulkUpdateOperations = [];
        for (let user of batchData) {
            bulkUpdateOperations.push({
                updateMany: {
                    filter: { _id: user._id },
                    update: {
                        $set: {
                            points: user.points,
                            rank: 1,
                            pointUpdate: true,
                            rankUpdate: false
                        }
                    }
                }
            });
        }
        // ✅ Bulk Redis update using `storeSortedSet`
        if (bulkUpdateOperations.length > 0) {
            if (bulkUpdateOperations.length) {
                for (let i = 0; i < bulkUpdateOperations.length; i += 1000) {
                    const chunk = bulkUpdateOperations.slice(i, i + 1000);
                    try {
                        await leaderBoardModel.bulkWrite(chunk);
                        await delay(2000);
                    } catch (error) {
                        console.error(`Error executing bulk operation chunk ${i / 100 + 1}:`, error.message);
                    }
                }
            }
        }
        // ✅ Execute all Redis operations in one go
        // await redisPipeline.exec();
        console.log(`✅ Batch processed successfully!`);
        return true;
    } catch (error) {
        console.error("❌ Error processing batch:", error);
    }
}
const rankUpdateRedisToDB = async () => {
    const consumer = kafka.consumer({
        groupId: 'leaderboardRank',
        sessionTimeout: 60000,
        heartbeatInterval: 20000,
        rebalanceTimeout: 120000,
        autoCommit: false,
        maxPollInterval: 300000,
        maxBytes: 104857600, // ⬆️ Increase to 100MB
        fetchMaxBytes: 104857600, // ⬆️ Increase to 100MB
        fetchMaxBytesPerPartition: 52428800, // ⬆️ Increase per partition (50MB)
        maxInFlightRequests: 5, // ⬆️ Allow parallel requests
        fromBeginning: false,
    });

    try {
        await consumer.connect();
        console.log(`✅ Consumer connected: Group ID - leaderboard-group`);

        await consumer.subscribe({ topic: "leaderboard-update-rank", fromBeginning: true });
        console.log(`✅ Subscribed to topic: leaderboard-update-rank`);

        await consumer.run({
            eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
                try {
                    const tasks = batch.messages.map(async (message, index) => {
                        try {
                            const messageData = JSON.parse(message.value.toString());
                            if (!messageData || messageData.length === 0) return;

                            console.log(`✅ Received ${messageData.length} messages`);

                            if (messageData.length > 0) {
                                await processRankBatch(messageData); // ✅ Process entire batch at once
                                await delay(2000);
                            }

                            resolveOffset(message.offset);
                            await heartbeat(); // Prevent Kafka rebalancing
                        } catch (error) {
                            console.error(`❌ Error processing message:`, error);
                        }
                    });

                    // Wait for all tasks to complete
                    await Promise.allSettled(tasks);

                    // Execute all batched Redis operations
                    // await pipeline.exec();
                    await commitOffsetsIfNecessary(); // Commit offsets

                    await heartbeat();

                } catch (error) {
                    console.error("❌ Batch Error:", error);
                }
            }
        });

    } catch (error) {
        console.error("❌ Consumer error:", error);
        await consumer.disconnect();
    }
};
async function processRankBatch(batchData) {
    try {
        let bulkUpdateOperations = [];
        for (let user of batchData) {
            bulkUpdateOperations.push({
                updateMany: {
                    filter: { _id: user.players._id },
                    update: {
                        $set: {
                            rank: user.rank,
                            contest_winning_type: 'price',
                            lock_amount: false,
                            // winning: false,
                            amount: 0,
                            rankUpdate: true
                        }
                    }
                }
            });
        }
        // ✅ Bulk Redis update using `storeSortedSet`
        if (bulkUpdateOperations.length > 0) {
            if (bulkUpdateOperations.length) {
                for (let i = 0; i < bulkUpdateOperations.length; i += 1000) {
                    const chunk = bulkUpdateOperations.slice(i, i + 1000);
                    try {
                        await leaderBoardModel.bulkWrite(chunk);
                        await delay(1000);
                    } catch (error) {
                        console.error(`Error executing bulk operation chunk ${i / 100 + 1}:`, error.message);
                    }
                }
            }
        }
        // ✅ Execute all Redis operations in one go
        // await redisPipeline.exec();
        console.log(`✅ Batch processed successfully!`);
        return true;
    } catch (error) {
        console.error("❌ Error processing batch:", error);
    }
}


const winningUpdateInLeaderboard = async () => {

    const consumer = kafka.consumer({
        groupId: 'leaderboardWinning',
        sessionTimeout: 60000,
        heartbeatInterval: 20000,
        rebalanceTimeout: 120000,
        autoCommit: false,
        maxPollInterval: 300000,
        maxBytes: 104857600, // ⬆️ Increase to 100MB
        fetchMaxBytes: 104857600, // ⬆️ Increase to 100MB
        fetchMaxBytesPerPartition: 52428800, // ⬆️ Increase per partition (50MB)
        maxInFlightRequests: 5, // ⬆️ Allow parallel requests
        fromBeginning: false,
    });
    try {
        await consumer.connect();
        console.log(`✅ Consumer connected: Group ID - leaderboard-winning`);

        await consumer.subscribe({ topic: "leaderboard-winning-update", fromBeginning: true });
        console.log(`✅ Subscribed to topic: leaderboard-winning-update`);

        await consumer.run({
            eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
                try {
                    const tasks = batch.messages.map(async (message, index) => {
                        try {
                            const messageData = JSON.parse(message.value.toString());
                            if (!messageData || messageData.length === 0) return;

                            console.log(`✅ Received ${messageData.length} messages`);

                            if (messageData.length > 0) {
                                await processWinningLeaderboardBatch(messageData); // ✅ Process entire batch at once
                                await delay(2000);
                            }

                            resolveOffset(message.offset);
                            await heartbeat(); // Prevent Kafka rebalancing
                        } catch (error) {
                            console.error(`❌ Error processing message:`, error);
                        }
                    });

                    // Wait for all tasks to complete
                    await Promise.allSettled(tasks);

                    // Execute all batched Redis operations
                    // await pipeline.exec();
                    await commitOffsetsIfNecessary(); // Commit offsets

                    await heartbeat();

                } catch (error) {
                    console.error("❌ Batch Error:", error);
                }
            }
        });

    } catch (error) {
        console.error("❌ Consumer error:", error);
        await consumer.disconnect();
    }
};
async function processWinningLeaderboardBatch(batchData) {
    try {
        let bulkUpdateOperations = [];
        for (let user of batchData) {
            bulkUpdateOperations.push({
                updateMany: {
                    filter: { _id: user._id },
                    update: {
                        $set: {
                            winning: true,
                        }
                    }
                }
            });
        }
        // ✅ Bulk Redis update using `storeSortedSet`
        if (bulkUpdateOperations.length > 0) {
            if (bulkUpdateOperations.length) {
                for (let i = 0; i < bulkUpdateOperations.length; i += 1000) {
                    const chunk = bulkUpdateOperations.slice(i, i + 1000);
                    try {
                        await leaderBoardModel.bulkWrite(chunk);
                        await delay(1000);
                    } catch (error) {
                        console.error(`Error executing bulk operation chunk ${i / 100 + 1}:`, error.message);
                    }
                }
            }
        }
        // ✅ Execute all Redis operations in one go
        // await redisPipeline.exec();
        console.log(`✅ Batch processed successfully!`);
        return true;
    } catch (error) {
        console.error("❌ Error processing batch:", error);
    }
}



const winningTransactionUpdate = async () => {
    const consumer = kafka.consumer({
        groupId: 'winningTransaction',
        sessionTimeout: 60000,
        heartbeatInterval: 20000,
        rebalanceTimeout: 120000,
        autoCommit: false,
        maxPollInterval: 300000,
        maxBytes: 104857600, // ⬆️ Increase to 100MB
        fetchMaxBytes: 104857600, // ⬆️ Increase to 100MB
        fetchMaxBytesPerPartition: 52428800, // ⬆️ Increase per partition (50MB)
        maxInFlightRequests: 5, // ⬆️ Allow parallel requests
        fromBeginning: false,
    });

    try {
        await consumer.connect();
        console.log(`✅ Consumer connected: Group ID - winning transaction`);

        await consumer.subscribe({ topic: "winning-transaction-update", fromBeginning: true });
        console.log(`✅ Subscribed to topic: winning-transaction-update`);

        await consumer.run({
            eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
                try {
                    const tasks = batch.messages.map(async (message, index) => {
                        try {
                            const messageData = JSON.parse(message.value.toString());
                            if (!messageData || messageData.length === 0) return;

                            console.log(`✅ Received ${messageData.length} messages`);

                            if (messageData.length > 0) {
                                await processWinningTransaction(messageData); // ✅ Process entire batch at once
                                await delay(2000);
                            }

                            resolveOffset(message.offset);
                            await heartbeat(); // Prevent Kafka rebalancing
                        } catch (error) {
                            console.error(`❌ Error processing message:`, error);
                        }
                    });

                    // Wait for all tasks to complete
                    await Promise.allSettled(tasks);

                    // Execute all batched Redis operations
                    // await pipeline.exec();
                    await commitOffsetsIfNecessary(); // Commit offsets

                    await heartbeat();

                } catch (error) {
                    console.error("❌ Batch Error:", error);
                }
            }
        });

    } catch (error) {
        console.error("❌ Consumer error:", error);
        await consumer.disconnect();
    }
};
async function processWinningTransaction(bulkUpdateOperations) {
    try {
        // ✅ Bulk Redis update using `storeSortedSet`
        if (bulkUpdateOperations.length > 0) {
            if (bulkUpdateOperations.length) {
                for (let i = 0; i < bulkUpdateOperations.length; i += 1000) {
                    const chunk = bulkUpdateOperations.slice(i, i + 1000);
                    try {
                        await transactionModel.bulkWrite(chunk);
                        await delay(2000);
                    } catch (error) {
                        console.error(`Error executing bulk operation chunk ${i / 100 + 1}:`, error.message);
                    }
                }
            }
        }
        // ✅ Execute all Redis operations in one go
        // await redisPipeline.exec();
        console.log(`✅ Batch processed successfully!`);
        return true;
    } catch (error) {
        console.error("❌ Error processing batch:", error);
    }
}


const winningWalletUpdate = async () => {
    const consumer = kafka.consumer({
        groupId: 'winningWallet',
        sessionTimeout: 60000,
        heartbeatInterval: 20000,
        rebalanceTimeout: 120000,
        autoCommit: false,
        maxPollInterval: 300000,
        maxBytes: 104857600, // ⬆️ Increase to 100MB
        fetchMaxBytes: 104857600, // ⬆️ Increase to 100MB
        fetchMaxBytesPerPartition: 52428800, // ⬆️ Increase per partition (50MB)
        maxInFlightRequests: 5, // ⬆️ Allow parallel requests
        fromBeginning: false,
    });

    try {
        await consumer.connect();
        console.log(`✅ Consumer connected: Group ID - winning-wallet`);

        await consumer.subscribe({ topic: "winning-wallet-update", fromBeginning: true });
        console.log(`✅ Subscribed to topic: winning-wallet-update`);

        await consumer.run({
            eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
                try {
                    const tasks = batch.messages.map(async (message, index) => {
                        try {
                            const messageData = JSON.parse(message.value.toString());
                            if (!messageData || messageData.length === 0) return;

                            console.log(`✅ Received wallet ${messageData.length} messages`);

                            if (messageData.length > 0) {
                                await processWinningWalletUpdate(messageData); // ✅ Process entire batch at once
                                await delay(500);
                            }

                            resolveOffset(message.offset);
                            await heartbeat(); // Prevent Kafka rebalancing
                        } catch (error) {
                            console.error(`❌ Error processing message:`, error);
                        }
                    });

                    // Wait for all tasks to complete
                    await Promise.allSettled(tasks);

                    // Execute all batched Redis operations
                    // await pipeline.exec();
                    await commitOffsetsIfNecessary(); // Commit offsets

                    await heartbeat();

                } catch (error) {
                    console.error("❌ Batch Error:", error);
                }
            }
        });

    } catch (error) {
        console.error("❌ Consumer error:", error);
        await consumer.disconnect();
    }
};
async function processWinningWalletUpdate(bulkUpdateOperations) {
    try {      // ✅ Bulk Redis update using `storeSortedSet`
        if (bulkUpdateOperations.length > 0) {
            if (bulkUpdateOperations.length) {
                for (let i = 0; i < bulkUpdateOperations.length; i += 1000) {
                    const chunk = bulkUpdateOperations.slice(i, i + 1000);
                    try {
                        await userModel.bulkWrite(chunk);
                        await delay(1000);
                    } catch (error) {
                        console.error(`Error executing bulk operation chunk ${i / 100 + 1}:`, error.message);
                    }
                }
            }
        }
        // ✅ Execute all Redis operations in one go
        // await redisPipeline.exec();
        console.log(`✅ Batch processed successfully!`);
        return true;
    } catch (error) {
        console.error("❌ Error processing batch:", error);
    }
}
module.exports = { winningWalletUpdate, winningTransactionUpdate, winningUpdateInLeaderboard, rankUpdateRedisToDB, runConsumer, mappingPlayersConsumer, pointUpdateRedisToDB }