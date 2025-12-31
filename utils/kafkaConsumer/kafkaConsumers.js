const kafka = require('../connections/kafkaConnection');
const mongoose = require('mongoose');

const { joinLeagueModel, leaderBoardModel } = require('../models');

const {
    getMyLeaderBoard,
    getkeydata,
    setkeydata,
    deletedata,
    setKeyDataList,
    getKeyDataList,
    storeSortedSet,
    retrieveSortedSet,
    particularUserLeaderBoard,
    redis
} = require('../connections/redis/redisLeaderboard');
const { matchTimeDifference } = require("../connections/matchTimeDiffrence");


const consumerGroups = [
    { groupId: 'createGroup', topic: 'create' },
    { groupId: 'updateGroup', topic: 'update' },
    { groupId: 'groupCreateJoinContest', topic: 'createJoinContest' },
];
const delay = async (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const startUpdateGroup = async () => {
    const consumer = kafka.consumer({
        groupId: 'updateTeamGroup',
        sessionTimeout: 60000,
        heartbeatInterval: 20000,
        rebalanceTimeout: 120000,
        autoCommit: true,
        maxPollInterval: 300000,
    });

    try {
        await consumer.connect();
        console.log(`✅ Connected: updateTeamGroup`);

        await consumer.subscribe({ topic: 'updateTeamQueue', fromBeginning: true });
        console.log(`✅ Subscribed: updateTeamQueue`);

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
                        await delay(1500);
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




module.exports = { startUpdateGroup }