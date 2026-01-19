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


const { Kafka } = require('kafkajs');

const kafka = new Kafka({
    clientId: 'my-producer',
    brokers: ["134.209.158.211:9092"]
});

const admin = kafka.admin();
const producer = kafka.producer();

// connect once
(async () => {
    try {
        await admin.connect();
        await producer.connect();
        console.log("✅ Kafka Admin & Producer connected");
    } catch (err) {
        console.error("❌ Kafka connection error:", err);
    }
})();

const createTopicIfNotExists = async (topicName) => {
    try {
        const topics = await admin.listTopics();
        if (!topics.includes(topicName)) {
            console.log(`Creating topic "${topicName}"...`);
            await admin.createTopics({
                topics: [{
                    topic: topicName,
                    numPartitions: 1,
                    replicationFactor: 1,
                }],
            });
            console.log(`Topic "${topicName}" created.`);
        } else {
            console.log(`Topic "${topicName}" already exists.`);
        }
    } catch (error) {
        console.error('Error creating topic:', error);
    }
};

const sendToQueue = async (topicName, message) => {
    try {
        await createTopicIfNotExists(topicName);
        await producer.send({
            topic: topicName,
            messages: [{ value: JSON.stringify(message) }],
        });
        // console.log(`Message sent to topic "${topicName}": ${message}`);
    } catch (error) {
        console.error('Error producing message:', error);
    }
};

const consumeMessages = async () => {
    const consumer = kafka.consumer({ groupId: 'match', autoCommit: true });
    await consumer.connect();
    await consumer.subscribe({ topic: "match", fromBeginning: true });

    await consumer.run({
        eachMessage: async ({ message }) => {
            const match = JSON.parse(message.value.toString());
            // console.log("Received match Created:", match);
            return true;
        },
    });
};

// graceful shutdown
process.on("SIGINT", async () => {
    await producer.disconnect();
    await admin.disconnect();
    console.log("❎ Kafka disconnected");
    process.exit(0);
});

module.exports = { sendToQueue, consumeMessages };



// const { Kafka } = require('kafkajs');
// // console.log(global.constant.kafkaConfig)
// const kafka = new Kafka({
//     clientId: 'my-producer',
//     brokers: ["localhost:9092"]
// });

// const admin = kafka.admin();
// const producer = kafka.producer();

// const createTopicIfNotExists = async (topicName) => {
//     try {
//         await admin.connect();
//         const topics = await admin.listTopics();
//         if (!topics.includes(topicName)) {
//             console.log(`Creating topic "${topicName}"...`);
//             await admin.createTopics({
//                 topics: [{
//                     topic: topicName,
//                     numPartitions: 1,
//                     replicationFactor: 1,
//                 }],
//             });
//             console.log(`Topic "${topicName}" created.`);
//         } else {
//             console.log(`Topic "${topicName}" already exists.`);
//         }
//     } catch (error) {
//         console.error('Error creating topic:', error);
//     } finally {
//         await admin.disconnect();
//     }
// };

// const sendToQueue = async (topicName, message) => {
//     try {
//         await createTopicIfNotExists(topicName);
//         await producer.connect();
//         await producer.send({
//             topic: topicName,
//             messages: [{ value: JSON.stringify(message) }],
//         });
//         // console.log(`Message sent to topic "${topicName}": ${message}`);
//     } catch (error) {
//         console.error('Error producing message:', error);
//     } finally {
//         await producer.disconnect();
//     }
// };
// const consumeMessages = async () => {
//     const consumer = kafka.consumer({ groupId: 'match', autoCommit: true });
//     await consumer.connect();
//     await consumer.subscribe({ topic: "match", fromBeginning: true });

//     await consumer.run({
//         eachMessage: async ({ message }) => {
//             const match = JSON.parse(message.value.toString());
//             // console.log("Received match Created:", match);
//             return true;
//             // Update user orders in MongoDB
//             // await User.findByIdAndUpdate(order.userId, { $push: { orders: order } });

//             // Update Redis Cache
//             // let user = await User.findById(order.userId);
//             // if (user) await redis.set(`user:${order.userId}`, JSON.stringify(user));
//         },
//     });
// };


// module.exports = { sendToQueue, consumeMessages };