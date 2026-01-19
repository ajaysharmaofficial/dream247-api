const mongoose = require('mongoose');
const { Kafka } = require('kafkajs');
// const dualgamematchChallengersModel = require("../../models/dualgamematchChallengersModel");

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
    brokers: ["134.209.158.211:9092"],
});
const startClosedGroup = async () => {
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
        console.log(`✅ Consumer connected: Group ID - startClosedGroup`);

        await consumer.subscribe({ topic: 'contestClosed', fromBeginning: true });
        console.log(`✅ Consumer subscribed to topic: contestClosed`);

        await consumer.run({
            eachBatch: async ({ batch, resolveOffset, commitOffsetsIfNecessary }) => {
                const maxBatchSize = 10000;
                console.log(`Processing batch of ${batch.messages.length} messages`);

                for (let i = 0; i < batch.messages.length; i += maxBatchSize) {
                    const messagesToProcess = batch.messages.slice(i, i + maxBatchSize);

                    for (let message of messagesToProcess) {
                        try {
                            const data = JSON.parse(message.value);
                            console.log("===============", data);
                            const Model = mongoose.model(data.modelName);

                            const result = await Model.updateOne(
                                data.filter,
                                { $set: data.payload }
                            );

                            console.log(`✅ Data created successfully ${data.modelName} : _id: ${data.filter}`);
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
        // await consumer.disconnect();
    }
};

const startRunningCreate = async () => {
    const consumer = kafka.consumer({
        groupId: 'startRunningCreate',
        sessionTimeout: 60000,
        heartbeatInterval: 20000,
        rebalanceTimeout: 120000,
        autoCommit: true,
        maxPollInterval: 300000,
    });

    try {
        await consumer.connect();
        console.log(`✅ Consumer connected: Group ID - startRunningCreate`);

        await consumer.subscribe({ topic: 'contestInsert', fromBeginning: true });
        console.log(`✅ Consumer subscribed to topic: contestInsert`);

        await consumer.run({
            eachBatch: async ({ batch, resolveOffset, commitOffsetsIfNecessary }) => {
                const maxBatchSize = 10000;
                console.log(`Processing batch of ${batch.messages.length} messages`);

                for (let i = 0; i < batch.messages.length; i += maxBatchSize) {
                    const messagesToProcess = batch.messages.slice(i, i + maxBatchSize);

                    for (let message of messagesToProcess) {
                        try {
                            const data = JSON.parse(message.value);
                            console.log("=====", data.modelName);
                            const Model = mongoose.model(data.modelName);
                            const existing = await Model.findOne(data.filter).lean();

                            if (!existing) {
                                console.warn(`⚠️ No contest found matching filter: ${JSON.stringify(data.filter)}`);
                                continue;
                            }

                            delete existing._id;
                            const newChallenge = {
                                ...existing,
                                joinedusers: 0,
                                is_duplicated: 0,
                                status: 'opened',
                                _id: data.payload._id
                            };
                            const result = await Model.create(newChallenge);
                            console.log(`✅ New contest inserted: ${data.modelName} : _id: ${result._id}`);

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

module.exports = { startClosedGroup, startRunningCreate };