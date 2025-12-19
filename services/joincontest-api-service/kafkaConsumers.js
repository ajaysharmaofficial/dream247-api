// // const kafka = require('../connections/kafkaConnection');
// const mongoose = require('mongoose');

// const leaderBoardModel = require('../models/leaderBoardModel');
// const joinLeagueModel = require('../models/JoinLeaugeModel');
// const notificationModel = require('../models/notificationModel');
// const transactionModel = require('../models/transactionModel');
// const teamModel = require('../models/teamModel');

// const {
//     getMyLeaderBoard,
//     getkeydata,
//     setkeydata,
//     deletedata,
//     setKeyDataList,
//     getKeyDataList,
//     storeSortedSet,
//     retrieveSortedSet,
//     particularUserLeaderBoard,
//     redis
// } = require('./redis/redisLeaderboard');

// const consumerGroups = [
//     { groupId: 'createGroup', topic: 'create' },
//     { groupId: 'updateGroup', topic: 'update' },
//     { groupId: 'groupCreateJoinContest', topic: 'createJoinContest' },
// ];


// const { Kafka } = require('kafkajs');

// const kafka = new Kafka({
//     clientId: 'test-client',
//     brokers: [
//         global.constant.kafka1,
//         global.constant.kafka2,
//         global.constant.kafka3
//     ],
//     ssl: process.env.secretManager === 'prod',
//     connectionTimeout: 30000,
//     retry: {
//         initialRetryTime: 300,
//         retries: 10,
//     },
// });


// const startCreateGroup = async () => {
//     const consumer = kafka.consumer({ groupId: 'createGroup', autoCommit: true });

//     try {
//         await consumer.connect();
//         console.log(`Consumer connected: Group ID - createGroup`);

//         await consumer.subscribe({ topic: 'createQueue', fromBeginning: true });
//         console.log(`Consumer subscribed to topic: createQueue`);

//         consumer.run({
//             eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
//                 const maxBatchSize = 10;
//                 console.log(`Processing batch of ${batch.messages.length} messages`);

//                 for (let i = 0; i < batch.messages.length; i += maxBatchSize) {
//                     const messagesToProcess = batch.messages.slice(i, i + maxBatchSize);

//                     for (let message of messagesToProcess) {
//                         const data = JSON.parse(message.value);
//                         const Model = mongoose.model(data.modelName);
//                         try {
//                             await Model.create(data.payload);
//                             console.log('Data created successfully');

//                         } catch (error) {
//                             console.error('Error creating data:', error);
//                         }
//                         resolveOffset(message.offset);
//                         await heartbeat();
//                     }

//                     await commitOffsetsIfNecessary();
//                     console.log(`Processed ${messagesToProcess.length} messages & committed offsets`);
//                 }
//             },
//         });
//     } catch (error) {
//         await consumer.disconnect();
//     }
// };


// const startUpdateGroup = async () => {
//     const consumer = kafka.consumer({ groupId: 'updateGroup', autoCommit: true });

//     try {
//         await consumer.connect();
//         console.log(`Consumer connected: Group ID - updateGroup`);

//         await consumer.subscribe({ topic: 'updateQueue', fromBeginning: true });
//         console.log(`Consumer subscribed to topic: updateQueue`);

//         consumer.run({
//             eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
//                 const maxBatchSize = 10;
//                 console.log(`Processing batch of ${batch.messages.length} messages`);

//                 for (let i = 0; i < batch.messages.length; i += maxBatchSize) {
//                     const messagesToProcess = batch.messages.slice(i, i + maxBatchSize);

//                     for (let message of messagesToProcess) {
//                         console.log(message.value)
//                         const data = JSON.parse(message.value);
//                         const Model = mongoose.model(data.modelName);
//                         try {
//                             await Model.updateOne(data.filter, data.payload);
//                         } catch (error) {
//                             console.error('Error updating data:', error);
//                         }

//                         resolveOffset(message.offset);
//                         await heartbeat();
//                     }

//                     await commitOffsetsIfNecessary();
//                     console.log(`Processed ${messagesToProcess.length} messages & committed offsets`);
//                 }
//             },
//         });
//     } catch (error) {
//         await consumer.disconnect();
//     }
// };


// const startGroupCreateJoinContest = async () => {
//     const consumer = kafka.consumer({ groupId: 'groupCreateJoinContest', autoCommit: true });

//     try {
//         await consumer.connect();
//         console.log(`Consumer connected: Group ID - groupCreateJoinContest`);

//         await consumer.subscribe({ topic: 'createLeaderBoard', fromBeginning: true });
//         console.log(`Consumer subscribed to topic: createLeaderBoard`);

//         consumer.run({

//             eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
//                 const maxBatchSize = 10;
//                 console.log(`Processing batch of ${batch.messages.length} messages`);

//                 for (let i = 0; i < batch.messages.length; i += maxBatchSize) {
//                     const messagesToProcess = batch.messages.slice(i, i + maxBatchSize);

//                     for (let message of messagesToProcess) {

//                         const data = JSON.parse(message.value);
//                         const { leagueData, leaderBoardData, matchchallengeid, userId, listmatchId, redisLeaderboard } = data;
//                         try {

//                             const joinLeaugeResult = await joinLeagueModel.create(leagueData);
//                             leaderBoardData.joinId = joinLeaugeResult._id;
//                             const userLeaderBoard = await leaderBoardModel.create(leaderBoardData);

//                             redisLeaderboard._id = `${userLeaderBoard._id.toString()}`;
//                             redisLeaderboard.joinleaugeid = joinLeaugeResult._id;


//                             let keyChallengeLeaderBoard = `match:${listmatchId}:challenge:${matchchallengeid}:challengeLeaderBoard`;
//                             await storeSortedSet(keyChallengeLeaderBoard, redisLeaderboard, 60 * 60 * 48);
//                             redisLeaderboard._id = `${userLeaderBoard._id.toString()}-${userId}`;
//                             let keyLeaderBoard = `match:${listmatchId}:challenge:${matchchallengeid}:user:${userId}:userLeaderBoard`;
//                             await storeSortedSet(keyLeaderBoard, redisLeaderboard, 60 * 60 * 48);
//                         } catch (error) {
//                             console.error('Error creating data:', error);
//                         }

//                         resolveOffset(message.offset);
//                         await heartbeat();
//                     }

//                     await commitOffsetsIfNecessary();
//                     console.log(`Processed ${messagesToProcess.length} messages & committed offsets`);
//                 }
//             },

//         });
//     } catch (error) {
//         await consumer.disconnect();
//     }
// };

// module.exports = { startCreateGroup, startUpdateGroup, startGroupCreateJoinContest }

