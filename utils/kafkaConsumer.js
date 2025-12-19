const mongoose = require('mongoose');
const { Kafka } = require('kafkajs');
const Transaction = require('../models/walletTransactionModel');
const Admin = require('../models/adminModel');

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

const kafka = new Kafka({
  clientId: "my-producer",
  brokers: ["localhost:9092"],
});


const { setUser, deletedata, getUser, saveTransactionToRedis } = require('../utils/redis/redisUser');

const startCreateRegisterGroup = async () => {
    const consumer = kafka.consumer({
        groupId: 'CreateRegisterGroup',
        sessionTimeout: 60000,
        heartbeatInterval: 20000,
        rebalanceTimeout: 120000,
        autoCommit: true,
        maxPollInterval: 300000,
    });

    try {
        await consumer.connect();
        console.log(`✅ Consumer connected: Group ID - CreateRegisterGroup`);

        await consumer.subscribe({ topic: 'registerNewUser', fromBeginning: true });
        console.log(`✅ Consumer subscribed to topic: registerNewUser`);

        await consumer.run({
            eachBatch: async ({ batch, resolveOffset, commitOffsetsIfNecessary }) => {
                const maxBatchSize = 1000;
                console.log(`Processing batch of ${batch.messages.length} messages`);

                for (let i = 0; i < batch.messages.length; i += maxBatchSize) {
                    const messagesToProcess = batch.messages.slice(i, i + maxBatchSize);

                    for (let message of messagesToProcess) {
                        try {
                            const data = JSON.parse(message.value);
                            const Model = mongoose.model(data.modelName);
                            const user = await Model.findOneAndUpdate({ mobile: data.payload.mobile }, data.payload, { upsert: true, new: true });
                            if (user) {
                                let findTempUser = [user]; // FIXED VARIABLE DECLARATION ISSUE
                                await setUser(user);

                                if (findTempUser[0]?.refer_id) {
                                    await Model.updateOne(
                                        { _id: findTempUser[0].refer_id },
                                        { $inc: { totalrefercount: 1 } }
                                    );
                                }

                                let bulkInsert = [
                                    {
                                        userid: user._id,
                                        type: global.constant.BONUS.SIGNUP_BONUS,
                                        transaction_id: `${global.constant.APP_SHORT_NAME}-${global.constant.BONUS_TYPES.SIGNUP_BONUS}-${Date.now()}`,
                                        amount: data.extraData.signupReward || 0,
                                        bonus_amt: data.extraData.signupReward || 0,
                                        bal_bonus_amt: data.extraData.signupReward || 0,
                                        bal_fund_amt: 0,
                                        total_available_amt: data.extraData.signupReward || 0,
                                    },
                                    {
                                        userid: user._id,
                                        type: global.constant.BONUS.MOBILE_BONUS,
                                        transaction_id: `${global.constant.APP_SHORT_NAME}-${global.constant.BONUS_TYPES.MOBILE_BONUS}-${Date.now()}`,
                                        amount: data.extraData.signupReward || 0,
                                        bonus_amt: data.extraData.signupReward + data.extraData.mobileBonus || 0,
                                        bal_bonus_amt: data.extraData.signupReward + data.extraData.mobileBonus || 0,
                                        bal_fund_amt: 0,
                                        total_available_amt: data.extraData.signupReward + data.extraData.mobileBonus || 0,
                                    }
                                ];

                                for (let txn of bulkInsert) {
                                    const givenRewardObj = {
                                        bonus: txn.bonus_amt || 0,
                                        balance: txn.bal_fund_amt || 0,
                                    };
                                    const transactionData = {
                                        ...txn,
                                        transaction_type: 'Credit'
                                    };

                                    await saveTransactionToRedis(user._id.toString(), givenRewardObj, transactionData);
                                }
                                await Transaction.insertMany(bulkInsert);

                                if (findTempUser[0]?.refer_id) {
                                    // let userData = await Model.findOne({ _id: findTempUser[0].refer_id }, { userbalance: 1 });
                                    let adminData = await Admin.findOne({ role: "0" }, { general_tabs: 1 });


                                    if (adminData) {
                                        let referBonus = adminData.general_tabs.find(item => item.type === global.constant.BONUS_TYPES.REFER_BONUS);
                                        if (referBonus && referBonus.amount) {
                                            const wallet = await redisUser.redis.hgetall(`wallet:{${findTempUser[0].refer_id.toString()}}`);
                                            const oldBonus = Number(wallet?.bonus || 0);
                                            const newBonus = oldBonus + Number(referBonus.amount);
                                            let totalBalance = newBonus + Number(wallet?.balance || 0) + Number(wallet?.winning || 0);
                                            let referTxn = {
                                                userid: findTempUser[0].refer_id,
                                                type: global.constant.BONUS.REFER_BONUS,
                                                transaction_id: `${global.constant.APP_SHORT_NAME}-EBONUS-${Date.now()}`,
                                                amount: referBonus.amount,
                                                bonus_amt: referBonus.amount,
                                                bal_bonus_amt: newBonus,
                                                total_available_amt: totalBalance,
                                                referredUser: user._id,
                                                transaction_type: 'Credit'
                                            }
                                            await Transaction.create(referTxn);

                                            const referRewardObj = {
                                                bonus: newBonus || 0,
                                            };
                                            await saveTransactionToRedis(findTempUser[0].refer_id.toString(), referRewardObj, referTxn);

                                            await Model.findOneAndUpdate(
                                                { _id: findTempUser[0]?.refer_id },
                                                { $inc: { "userbalance.bonus": referBonus.amount, totalreferAmount: referBonus.amount } }
                                            );
                                        }
                                    }
                                }
                                console.log(`✅ Data created successfully ${data.modelName} : _id: ${user._id}`);
                            }
                            console.log(`✅ Data created successfully ${data.modelName} : _id: ${user._id}`);
                            resolveOffset(message.offset);
                        } catch (error) {
                            console.error('❌ Error processing message:', error);
                        }
                    }

                    await commitOffsetsIfNecessary();
                    console.log(`✅ Processed ${messagesToProcess.length} messages & committed offsets`);
                }
            },
        });
    } catch (error) {
        console.error('❌ Consumer Error:', error);
        await consumer.disconnect();
    }
};

const startUpdateLoginGroup = async () => {
    const consumer = kafka.consumer({
        groupId: 'updateLoginGroup',
        sessionTimeout: 60000,
        heartbeatInterval: 20000,
        rebalanceTimeout: 120000,
        autoCommit: true,
        maxPollInterval: 300000,
    });

    try {
        await consumer.connect();
        console.log(`✅ Consumer connected: Group ID - updateLoginGroup`);

        await consumer.subscribe({ topic: 'loginUser', fromBeginning: true });
        console.log(`✅ Consumer subscribed to topic: loginUser`);

        await consumer.run({
            eachBatch: async ({ batch, resolveOffset, commitOffsetsIfNecessary }) => {
                const maxBatchSize = 1000;
                console.log(`Processing batch of ${batch.messages.length} messages`);

                for (let i = 0; i < batch.messages.length; i += maxBatchSize) {
                    const messagesToProcess = batch.messages.slice(i, i + maxBatchSize);

                    for (let message of messagesToProcess) {
                        try {
                            // console.log("Received Message:", message.value);
                            const data = JSON.parse(message.value);
                            const Model = mongoose.model(data.modelName);

                            let loggedInUser = await Model.findOneAndUpdate(
                                data.filter,
                                { $set: data.payload, $currentDate: { lastUpdated: true } },
                                { new: true, writeConcern: { w: 1, j: false } }
                            );

                            if (loggedInUser) {
                                await setUser(loggedInUser);
                                // console.log(`✅ Data updated successfully for model: ${data.modelName}`);
                            } else {
                                var userData = await getUser(data.filter._id);
                                if (userData) {
                                    await deletedata(`user:${data.filter._id}`);
                                    await deletedata(`user-${userData.mobile}`);
                                }
                                console.log(`❌ Data not found for model: ${data.modelName}`);
                            }
                        } catch (error) {
                            console.error('❌ Error updating data:', error);
                        }
                        resolveOffset(message.offset);
                    }

                    await commitOffsetsIfNecessary();
                    console.log(`✅ Processed ${messagesToProcess.length} messages & committed offsets`);
                }
            },
        });
    } catch (error) {
        console.error('❌ Consumer Error:', error);
        await consumer.disconnect();
    }
};

// module.exports = { startCreateRegisterGroup, startUpdateLoginGroup, kafka };