const mongoose = require('mongoose');

const redisMain = require('../redis/redisMain');

const { Kafka } = require('kafkajs');

const userLeagueModel = require('../../models/userLeagueModel');
const userLeaderBoardModel = require('../../models/userLeaderBoardModel');

const kafka = new Kafka({
    clientId: "my-producer",
    brokers: ["localhost:9092"],
});

const delay = async (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const startGroupCreateJoinContest = async () => {
    const consumer = kafka.consumer({
        groupId: 'createLeaderboardGroup',
        sessionTimeout: 60000,
        heartbeatInterval: 20000,
        rebalanceTimeout: 120000,
        autoCommit: false,
        maxPollInterval: 300000,
    });

    try {
        await consumer.connect();
        console.log(`✅ Connected: createLeaderboardGroup`);

        await consumer.subscribe({ topic: 'createContestLeaderboard', fromBeginning: true });
        console.log(`✅ Subscribed: createContestLeaderboard`);

        await consumer.run({
            eachBatchAutoResolve: false,
            eachBatch: async ({
                batch,
                resolveOffset,
                heartbeat,
                commitOffsetsIfNecessary,
                isRunning,
                isStale,
            }) => {
                const messages = batch.messages;
                const errorMessages = [];
                for (let i = 0; i < messages.length; i += 1000) {
                    if (!isRunning() || isStale()) break;

                    const chunk = messages.slice(i, i + 1000);
                    const joinLeagueOps = [];
                    const leaderBoardOps = [];
                    let lastOffset = null;

                    for (const message of chunk) {
                        try {
                            const data = JSON.parse(message.value?.toString() ?? '{}');
                            // if (data.leagueData) joinLeagueOps.push({ insertOne: { document: data.leagueData } });
                            // if (data.leaderBoardData) leaderBoardOps.push({ insertOne: { document: data.leaderBoardData } });
                            if (data.leagueData) {
                                joinLeagueOps.push({
                                    updateOne: {
                                        filter: { _id: data.leagueData._id }, // or any unique field
                                        update: { $set: data.leagueData },
                                        upsert: true,
                                    },
                                });
                            }

                            if (data.leaderBoardData) {
                                leaderBoardOps.push({
                                    updateOne: {
                                        filter: { _id: data.leaderBoardData._id }, // or any unique field
                                        update: { $set: data.leaderBoardData },
                                        upsert: true,
                                    },
                                });
                            }

                            lastOffset = message.offset;
                        } catch (err) {
                            errorMessages.push({
                                error: err.message,
                                rawMessage: message.value.toString(),
                                timestamp: new Date().toISOString()
                            });
                            console.error('❌ JSON parse error:', err);
                        }
                    }

                    try {
                        if (joinLeagueOps.length && leaderBoardOps.length) {
                            await Promise.all([
                                userLeagueModel.bulkWrite(joinLeagueOps, { ordered: false }),
                                userLeaderBoardModel.bulkWrite(leaderBoardOps, { ordered: false }),
                            ]);

                            if (lastOffset !== null) resolveOffset(lastOffset);
                            await commitOffsetsIfNecessary();
                            console.log(`✅ Processed ${chunk.length} messages`);
                        }
                    } catch (err) {

                        console.error('❌ MongoDB error:', err);
                        errorMessages.push({
                            error: err.message,
                            operations: {
                                joinLeagueOps,
                                leaderBoardOps
                            },
                            timestamp: new Date().toISOString()
                        });
                        break; // stop if error occurs
                    }

                    await heartbeat(); // send heartbeat to avoid rebalance
                    await delay(5000); // optional cooldown between batches
                }

                if (errorMessages.length > 0) {
                    try {
                        const pipeline = redisMain.redis.pipeline();
                        errorMessages.forEach(error => {
                            pipeline.rpush(
                                'leaderboard-errors:messages',
                                JSON.stringify(error)
                            );
                        });

                        pipeline.expire('leaderboard-errors:messages', 60 * 60 * 24 * 2);

                        await pipeline.exec();
                        console.log(`⚠️ Stored ${errorMessages.length} error messages in Redis`);
                    } catch (redisErr) {
                        console.error('❌ Redis storage failed:', redisErr);
                        console.error('Failed error messages:', errorMessages);
                    }
                }

            },
        });

        // 🔁 Log rebalance
        consumer.on(consumer.events.GROUP_JOIN, e => {
            console.log(`🔁 Rebalanced: ${e.payload.memberId}`);
        });

    } catch (err) {
        console.error('❌ Kafka error:', err);
        await consumer.disconnect();
    }
};


const startContestUpdateGroup = async () => {
    const consumer = kafka.consumer({
        groupId: 'startClosedGroup',
        sessionTimeout: 60000,
        heartbeatInterval: 20000,
        rebalanceTimeout: 120000,
        autoCommit: true,
        maxPollInterval: 300000,
    });

    try {
        await consumer.connect();
        console.log(`✅ Connected: startClosedGroup`);

        await consumer.subscribe({ topic: 'contestClosed', fromBeginning: true });
        console.log(`✅ Subscribed: contestClosed`);

        await consumer.run({
            eachBatch: async ({ batch, resolveOffset, commitOffsetsIfNecessary }) => {
                const updates = [];
                const offsets = [];

                for (const message of batch.messages) {
                    try {
                        const data = JSON.parse(message.value);
                        const Model = mongoose.model(data.modelName);
                        updates.push({ updateOne: { filter: data.filter, update: data.payload } });
                        offsets.push(message.offset);
                    } catch (err) {
                        console.error('❌ Parsing error:', err);
                    }
                }

                try {
                    if (updates.length) {
                        const Model = mongoose.model(batch.messages[0] && JSON.parse(batch.messages[0].value).modelName);
                        await Model.bulkWrite(updates, { ordered: false });
                        for (let offset of offsets) resolveOffset(offset);
                        await commitOffsetsIfNecessary();
                        await delay(5000);
                        console.log(`✅ Processed ${updates.length} updates`);
                    }
                } catch (err) {
                    console.error('❌ MongoDB update error:', err);
                }
            },
        });
    } catch (err) {
        await consumer.disconnect();
    }
};

const startUpdateUserGroup = async () => {
    const consumer = kafka.consumer({
        groupId: 'updateUserGroup',
        sessionTimeout: 60000,
        heartbeatInterval: 20000,
        rebalanceTimeout: 120000,
        autoCommit: true,
        maxPollInterval: 300000,
    });

    try {
        await consumer.connect();
        console.log(`✅ Connected: updateUserGroup`);

        await consumer.subscribe({ topic: 'updateUserQueue', fromBeginning: true });
        console.log(`✅ Subscribed: updateUserQueue`);

        await consumer.run({
            eachBatch: async ({ batch, resolveOffset, commitOffsetsIfNecessary }) => {
                const updates = [];
                const offsets = [];

                for (const message of batch.messages) {
                    try {
                        const data = JSON.parse(message.value);
                        const Model = mongoose.model(data.modelName);
                        updates.push({ updateOne: { filter: data.filter, update: data.payload } });
                        offsets.push(message.offset);
                    } catch (err) {
                        console.error('❌ Parsing error:', err);
                    }
                }

                try {
                    if (updates.length) {
                        const Model = mongoose.model(batch.messages[0] && JSON.parse(batch.messages[0].value).modelName);
                        await Model.bulkWrite(updates, { ordered: false });
                        for (let offset of offsets) resolveOffset(offset);
                        await commitOffsetsIfNecessary();
                        await delay(100);
                        console.log(`✅ Processed ${updates.length} updates`);
                    }
                } catch (err) {
                    console.error('❌ MongoDB update error:', err);
                }
            },
        });
    } catch (err) {
        await consumer.disconnect();
    }
};


module.exports = { startGroupCreateJoinContest, startContestUpdateGroup, startUpdateUserGroup }