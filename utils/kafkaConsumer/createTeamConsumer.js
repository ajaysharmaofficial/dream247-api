// const kafka = require('../connections/kafkaConnection');
const mongoose = require('mongoose');
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
    clientId: "my-producer",
    brokers: ["localhost:9092"],
});

const delay = async (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const startCreateTeamGroup = async () => {
    const consumer = kafka.consumer({
        groupId: 'createTeamGroup',
        sessionTimeout: 60000,
        heartbeatInterval: 20000,
        rebalanceTimeout: 120000,
        autoCommit: true,
        maxPollInterval: 300000,
    });

    try {
        await consumer.connect();
        console.log(`✅ Connected: createTeamGroup`);

        await consumer.subscribe({ topic: 'createTeamQueue', fromBeginning: true });
        console.log(`✅ Subscribed: createTeamQueue`);

        await consumer.run({
            eachBatch: async ({ batch, resolveOffset, commitOffsetsIfNecessary }) => {
                const operations = [];
                const offsets = [];

                for (const message of batch.messages) {
                    try {
                        const data = JSON.parse(message.value);
                        const Model = mongoose.model(data.modelName);
                        operations.push({ insertOne: { document: data.payload } });
                        offsets.push(message.offset);
                    } catch (err) {
                        console.error('❌ Parsing error:', err);
                        // offsets.push(message.offset);
                    }
                }

                try {
                    if (operations.length) {
                        const Model = mongoose.model(batch.messages[0] && JSON.parse(batch.messages[0].value).modelName);
                        await Model.bulkWrite(operations, { ordered: false });
                        for (let offset of offsets) resolveOffset(offset);
                        await commitOffsetsIfNecessary();
                        await delay(1000);
                        console.log(`✅ Processed ${operations.length} docs`);
                    }
                } catch (err) {
                    console.error('❌ MongoDB error:', err);
                }
            },
        });
    } catch (err) {
        await consumer.disconnect();
    }
};





module.exports = { startCreateTeamGroup }