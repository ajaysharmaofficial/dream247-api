// const { Kafka } = require("kafkajs");
// const axios = require("axios");
// const userModel = require("../models/userModel");
// const TransactionModel = require("../models/transactionModel");
// const bankModel = require('../models/bankModel');
// const GetBonus = require("../utils/getBonus");
// const redisUser = require("../utils/redis/redisUser");
// const { givebonusToUser } = require("../services/kycService");
// const redisMain = require("../utils/redis/redisMain");

// const kafka = new Kafka({
//   clientId: 'test-client',
//   brokers: [global.constant.kafka1, global.constant.kafka2, global.constant.kafka3],
//   ssl: process.env.secretManager === 'prod',
//   connectionTimeout: 60000,
//   retry: {
//     initialRetryTime: 5000,
//     retries: 10,
//   },
//   requestTimeout: 30000,
//   allowAutoTopicCreation: true,
// });

// const consumer = kafka.consumer({ groupId: "kyc-group" });

// const processEmailVerification = async () => {
//   const consumer = kafka.consumer({ groupId: 'email-group', autoCommit: true });

//   try {
//     await consumer.connect();
//     console.log(`Consumer connected: Group ID - email-group`);

//     await consumer.subscribe({ topic: 'email-verification-topic', fromBeginning: true });
//     console.log(`Consumer subscribed to topic: email-verification-topic`);

//     await consumer.run({
//       eachBatchAutoResolve: false, // Important for manual offset management
//       eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
//         const maxBatchSize = 10;
//         // console.log(`Processing batch of ${batch.messages.length} messages`);

//         for (let i = 0; i < batch.messages.length; i += maxBatchSize) {
//           const messagesToProcess = batch.messages.slice(i, i + maxBatchSize);
//           const processedOffsets = [];

//           try {
//             const successfullyProcessedMessages = new Set(); // Track successfully processed messages

//             await Promise.all(
//               messagesToProcess.map(async (message) => {
//                 try {
//                   const data = JSON.parse(message.value);
//                   const { emailBonus, userId, email } = data;
//                   // console.log("Processing data:", data);

//                   let checkUser = await userModel.findOne({ _id: userId, "user_verify.email_verify": 1 });

//                   if (checkUser) {
//                     // User already verified, still commit the offset
//                     successfullyProcessedMessages.add(message.offset);
//                     return;
//                   }

//                   let user = await userModel.findByIdAndUpdate(
//                     { _id: userId },
//                     {
//                       $set: {
//                         email: email,
//                         "user_verify.email_verify": 1,
//                       },
//                       $inc: {
//                         "userbalance.bonus": emailBonus,
//                       },
//                     },
//                     { new: true }
//                   );

//                   if (user) {
//                     await redisUser.setUser(user);
//                     if(emailBonus > 0) {
//                       let totalBonus = Number(user.userbalance.bonus);
//                       let totalBalanceAmount = Number(user.userbalance.balance) + Number(user.userbalance.winning) + Number(user.userbalance.bonus);
  
//                       await TransactionModel.create({
//                         userid: user._id,
//                         type: global.constant.BONUS.EMAIL_BONUS,
//                         transaction_id: `${global.constant.APP_SHORT_NAME}-${global.constant.BONUS_TYPES.EMAIL_BONUS}-${Date.now()}`,
//                         amount: emailBonus,
//                         bonus_amt: emailBonus,
//                         bal_bonus_amt: totalBonus,
//                         bal_fund_amt: 0,
//                         total_available_amt: totalBalanceAmount,
//                       });
//                     }

//                     // Store the processed offset
//                     successfullyProcessedMessages.add(message.offset);
//                   }

//                 } catch (messageError) {
//                   console.error("Error processing message:", messageError);
//                 }
//               })
//             );

//             // Commit only if new messages were processed successfully
//             if (successfullyProcessedMessages.size > 0) {
//               for (const offset of successfullyProcessedMessages) {
//                 resolveOffset(offset);
//               }
//               await commitOffsetsIfNecessary();
//               console.log(`Committed offsets for ${successfullyProcessedMessages.size} successfully processed messages.`);
//             }

//           } catch (batchError) {
//             console.error("Batch processing failed:", batchError);
//           }

//           await heartbeat(); // Keep Kafka connection alive
//         }
//       },
//     });
//   } catch (error) {
//     await consumer.disconnect();
//   }
// };

// const processAadharVerification = async () => {
//   const consumer = kafka.consumer({ groupId: 'aadhar-group', autoCommit: true });

//   try {
//     await consumer.connect();
//     console.log(`Consumer connected: Group ID - aadhar-group`);

//     await consumer.subscribe({ topic: 'aadhar-verification-topic', fromBeginning: true });
//     console.log(`Consumer subscribed to topic: aadhar-verification-topic`);

//     // Ensure the consumer runs only once
//     await consumer.run({
//       eachBatchAutoResolve: false,
//       eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
//         const maxBatchSize = 10;
//         // console.log(`Processing batch of ${batch.messages.length} messages`);
//         for (let i = 0; i < batch.messages.length; i += maxBatchSize) {
//           const messagesToProcess = batch.messages.slice(i, i + maxBatchSize);
//           const successfullyProcessedMessages = new Set();

//           try {
//             await Promise.all(
//               messagesToProcess.map(async (message) => {
//                 try {
//                   const data = JSON.parse(message.value);
//                   const { userId, obj } = data;
//                   // console.log("Processing data of aadhar:", data);

//                   let checkUser = await userModel.findOne({ _id: userId, "user_verify.aadhar_verify": 1 });

//                   if (checkUser) {
//                     successfullyProcessedMessages.add(message.offset);
//                     return;
//                   }

//                   const user = await userModel.findByIdAndUpdate(
//                     userId,
//                     {
//                       $set: {
//                         ...obj,
//                         "user_verify.aadhar_verify": 1
//                       }
//                     },
//                     { new: true }
//                   );

//                   if (user) {
//                     await redisUser.setUser(user);
//                     const aadharBonus = await new GetBonus().getBonus(
//                       global.constant.BONUS_TYPES.AADHAR_BONUS,
//                       global.constant.PROFILE_VERIFY_AADHAR_BANK.SUBMITED
//                     );
//                     if(aadharBonus > 0) {
//                       await givebonusToUser(
//                         aadharBonus,
//                         userId,
//                         global.constant.PROFILE_VERIFY_BONUS_TYPES.AADHAR_BONUS,
//                         global.constant.USER_VERIFY_TYPES.AADHAR_VERIFY
//                       );
//                     }
//                     successfullyProcessedMessages.add(message.offset);
//                   }
//                 } catch (messageError) {
//                   console.error("Error processing message:", messageError);
//                 }
//               })
//             );

//             if (successfullyProcessedMessages.size > 0) {
//               for (const offset of successfullyProcessedMessages) {
//                 resolveOffset(offset);
//               }
//               await commitOffsetsIfNecessary();
//               console.log(`Committed offsets for ${successfullyProcessedMessages.size} successfully processed messages.`);
//             }

//           } catch (batchError) {
//             console.error("Batch processing failed:", batchError);
//           }

//           await heartbeat();
//         }
//       },
//     });
//   } catch (error) {
//     await consumer.disconnect();
//   }
// };

// const processPanVerification = async () => {
//   const consumer = kafka.consumer({ groupId: 'pan-group', autoCommit: true });

//   try {
//     await consumer.connect();
//     console.log(`Consumer connected: Group ID - pan-group`);

//     await consumer.subscribe({ topic: 'pan-verification-topic', fromBeginning: true });
//     console.log(`Consumer subscribed to topic: pan-verification-topic`);

//     await consumer.run({
//       eachBatchAutoResolve: false, // Important for manual offset management
//       eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
//         const maxBatchSize = 10;
//         // console.log(`Processing batch of ${batch.messages.length} messages`);

//         for (let i = 0; i < batch.messages.length; i += maxBatchSize) {
//           const messagesToProcess = batch.messages.slice(i, i + maxBatchSize);
//           const processedOffsets = [];

//           try {
//             const successfullyProcessedMessages = new Set(); // Track successfully processed messages

//             await Promise.all(
//               messagesToProcess.map(async (message) => {
//                 try {
//                   const data = JSON.parse(message.value);
//                   const { userId, obj } = data;
//                   // console.log("Processing data of pan:", data);

//                   let checkUser = await userModel.findOne({ _id: userId, "user_verify.pan_verify": 1 });

//                   if (checkUser) {
//                     // User already verified, still commit the offset
//                     successfullyProcessedMessages.add(message.offset);
//                     return;
//                   }

//                   const user = await userModel.findByIdAndUpdate(
//                     { _id: userId },
//                     obj,
//                     { new: true }
//                   );

//                   if (user) {
//                     await redisUser.setUser(user);
//                     const panBonus = await new GetBonus().getBonus(
//                       global.constant.BONUS_TYPES.PAN_BONUS,
//                       global.constant.PROFILE_VERIFY_PAN_BANK.SUBMITED
//                     );
//                     // Give the bank bonus to the user and update their verification status
//                     if(panBonus > 0){
//                       await givebonusToUser(
//                         panBonus,
//                         userId,
//                         global.constant.PROFILE_VERIFY_BONUS_TYPES.PAN_BONUS,
//                         global.constant.USER_VERIFY_TYPES.PROFILE_VERIFY_PAN_BANK
//                       );
//                     }
//                     // Store the processed offset
//                     successfullyProcessedMessages.add(message.offset);
//                   }

//                 } catch (messageError) {
//                   console.error("Error processing message:", messageError);
//                 }
//               })
//             );

//             // Commit only if new messages were processed successfully
//             if (successfullyProcessedMessages.size > 0) {
//               for (const offset of successfullyProcessedMessages) {
//                 resolveOffset(offset);
//               }
//               await commitOffsetsIfNecessary();
//               console.log(`Committed offsets for ${successfullyProcessedMessages.size} successfully processed messages.`);
//             }

//           } catch (batchError) {
//             console.error("Batch processing failed:", batchError);
//           }

//           await heartbeat(); // Keep Kafka connection alive
//         }
//       },
//     });
//   } catch (error) {
//     await consumer.disconnect();
//   }
// };

// const processBankVerification = async () => {
//   const consumer = kafka.consumer({ groupId: 'bank-group', autoCommit: true });

//   try {
//     await consumer.connect();
//     console.log(`Consumer connected: Group ID - bank-group`);

//     await consumer.subscribe({ topic: 'bank-verification-topic', fromBeginning: true });
//     console.log(`Consumer subscribed to topic: bank-verification-topic`);

//     await consumer.run({
//       eachBatchAutoResolve: false, // Important for manual offset management
//       eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
//         const maxBatchSize = 10;
//         // console.log(`Processing batch of ${batch.messages.length} messages`);

//         for (let i = 0; i < batch.messages.length; i += maxBatchSize) {
//           const messagesToProcess = batch.messages.slice(i, i + maxBatchSize);
//           const processedOffsets = [];

//           try {
//             const successfullyProcessedMessages = new Set(); // Track successfully processed messages

//             await Promise.all(
//               messagesToProcess.map(async (message) => {
//                 try {
//                   const data = JSON.parse(message.value);
//                   const { userId, obj } = data;
//                   // console.log("Processing data of bank:", data);

//                   let checkUser = await userModel.findOne({ _id: userId, "user_verify.bank_verify": 1 });

//                   if (checkUser) {
//                     // User already verified, still commit the offset
//                     successfullyProcessedMessages.add(message.offset);
//                     return;
//                   }

//                   const user = await userModel.findByIdAndUpdate(
//                     { _id: userId },
//                     {
//                       "user_verify.bank_verify": 1,
//                       bank: obj
//                     },
//                     { new: true }
//                   );

//                   if (user) {
//                     await redisUser.setUser(user);
//                     const bankNameAdded = await bankModel.findOneAndUpdate(
//                       { name: obj.bankname },
//                       { $inc: { users: 1 } }, 
//                       { upsert: true, new: true }
//                     );   
//                     if(bankNameAdded){
//                       const disabledBanks = await bankModel.find({ status: 0 }).select("name status");
//                       if (disabledBanks.length > 0) {
//                           await redisMain.setkeydata("disabledBanks", JSON.stringify(disabledBanks), 432000); 
//                       }
//                     }                 
//                     const bankBonus = await new GetBonus().getBonus(
//                       global.constant.BONUS_TYPES.BANK_BONUS,
//                       global.constant.PROFILE_VERIFY_AADHAR_BANK.SUBMITED
//                     );

//                     if (bankBonus > 0) {
//                       const transactionId = `${global.constant.APP_SHORT_NAME}-BANKBONUS-${Date.now()}`;
//                       const updatedUser = await userModel.findOneAndUpdate(
//                         { _id: userId },
//                         { $inc: { "userbalance.bonus": bankBonus } },
//                         { new: true }
//                       );

//                       await TransactionModel.create({
//                         userid: userId,
//                         type: global.constant.BONUS_NAME.bankbonus,
//                         transaction_id: transactionId,
//                         transaction_by: global.constant.TRANSACTION_BY.APP_NAME,
//                         amount: bankBonus,
//                         paymentstatus: global.constant.PAYMENT_STATUS_TYPES.CONFIRMED,
//                         bonus_amt: bankBonus,
//                         win_amt: 0,
//                         addfund_amt: 0,
//                         bal_bonus_amt: updatedUser.userbalance.bonus || 0,
//                         bal_win_amt: updatedUser.userbalance.balance || 0,
//                         bal_fund_amt: updatedUser.userbalance.winning || 0,
//                         total_available_amt: (updatedUser.userbalance.balance || 0) + (updatedUser.userbalance.winning || 0) + (updatedUser.userbalance.bonus || 0),
//                         withdraw_amt: 0,
//                         challenge_join_amt: 0,
//                         cons_bonus: 0,
//                         cons_win: 0,
//                         cons_amount: 0,
//                       });
//                     }
//                     // Store the processed offset
//                     successfullyProcessedMessages.add(message.offset);
//                   }

//                 } catch (messageError) {
//                   console.error("Error processing message:", messageError);
//                 }
//               })
//             );

//             // Commit only if new messages were processed successfully
//             if (successfullyProcessedMessages.size > 0) {
//               for (const offset of successfullyProcessedMessages) {
//                 resolveOffset(offset);
//               }
//               await commitOffsetsIfNecessary();
//               console.log(`Committed offsets for ${successfullyProcessedMessages.size} successfully processed messages.`);
//             }

//           } catch (batchError) {
//             console.error("Batch processing failed:", batchError);
//           }

//           await heartbeat(); // Keep Kafka connection alive
//         }
//       },
//     });
//   } catch (error) {
//     await consumer.disconnect();
//   }
// };

// // async function processEmailVerification() {

// //   await consumer.subscribe({ topic: "email-verification-topic", fromBeginning: true });
// //   console.log(`Consumer subscribed to topic: email-verification-topic`);

// //   await consumer.run({
// //     eachBatchAutoResolve: false, // Important for manual offset management
// //     eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
// //       const maxBatchSize = 10;
// //       console.log(`Processing batch of ${batch.messages.length} messages`);

// //       for (let i = 0; i < batch.messages.length; i += maxBatchSize) {
// //         const messagesToProcess = batch.messages.slice(i, i + maxBatchSize);
// //         const processedOffsets = [];

// //         try {
// //           const successfullyProcessedMessages = new Set(); // Track successfully processed messages

// //           await Promise.all(
// //             messagesToProcess.map(async (message) => {
// //               try {
// //                 const data = JSON.parse(message.value);
// //                 const { emailBonus, userId, email } = data;
// //                 console.log("Processing data:", data);

// //                 let checkUser = await userModel.findOne({ _id: userId, "user_verify.email_verify": 1 });

// //                 if (checkUser) {
// //                   // User already verified, still commit the offset
// //                   successfullyProcessedMessages.add(message.offset);
// //                   return;
// //                 }

// //                 let user = await userModel.findByIdAndUpdate(
// //                   { _id: userId },
// //                   {
// //                     $set: {
// //                       email: email,
// //                       "user_verify.email_verify": 1,
// //                     },
// //                     $inc: {
// //                       "userbalance.bonus": emailBonus,
// //                     },
// //                   },
// //                   { new: true }
// //                 );

// //                 if (user) {
// //                   await redisUser.setUser(user);
// //                   let totalBonus = Number(user.userbalance.bonus);
// //                   let totalBalanceAmount = Number(user.userbalance.balance) + Number(user.userbalance.winning) + Number(user.userbalance.bonus);

// //                   await TransactionModel.create({
// //                     userid: user._id,
// //                     type: global.constant.BONUS.EMAIL_BONUS,
// //                     transaction_id: `${global.constant.APP_SHORT_NAME}-${global.constant.BONUS_TYPES.EMAIL_BONUS}-${Date.now()}`,
// //                     amount: emailBonus,
// //                     bonus_amt: emailBonus,
// //                     bal_bonus_amt: totalBonus,
// //                     bal_fund_amt: 0,
// //                     total_available_amt: totalBalanceAmount,
// //                   });

// //                   // Store the processed offset
// //                   successfullyProcessedMessages.add(message.offset);
// //                 }

// //               } catch (messageError) {
// //                 console.error("Error processing message:", messageError);
// //               }
// //             })
// //           );

// //           // Commit only if new messages were processed successfully
// //           if (successfullyProcessedMessages.size > 0) {
// //             for (const offset of successfullyProcessedMessages) {
// //               resolveOffset(offset);
// //             }
// //             await commitOffsetsIfNecessary();
// //             console.log(`Committed offsets for ${successfullyProcessedMessages.size} successfully processed messages.`);
// //           }

// //         } catch (batchError) {
// //           console.error("Batch processing failed:", batchError);
// //         }

// //         await heartbeat(); // Keep Kafka connection alive
// //       }
// //     },
// //   });

// //   // await consumer.run({
// //   //   eachBatchAutoResolve: false, // Manual offset management
// //   //   eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
// //   //     console.log(`Skipping batch of ${batch.messages.length} messages`);

// //   //     // Skip all messages but commit offsets to avoid reprocessing
// //   //     batch.messages.forEach((message) => resolveOffset(message.offset));

// //   //     await commitOffsetsIfNecessary(); // Commit all skipped messages
// //   //     console.log(`Skipped ${batch.messages.length} messages successfully.`);

// //   //     await heartbeat(); // Keep Kafka connection alive
// //   //   },
// //   // });
// // };

// // async function processAadharVerification() {
// //   try {
// //     // Subscribe to topic before running the consumer
// //     await consumer.subscribe({ topic: "aadhar-verification-topic", fromBeginning: true });
// //     console.log(`Consumer subscribed to topic: aadhar-verification-topic`);

// //     // Ensure the consumer runs only once
// //     await consumer.run({
// //       eachBatchAutoResolve: false,
// //       eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
// //         const maxBatchSize = 10;
// //         console.log(`Processing batch of ${batch.messages.length} messages`);
// //         for (let i = 0; i < batch.messages.length; i += maxBatchSize) {
// //           const messagesToProcess = batch.messages.slice(i, i + maxBatchSize);
// //           const successfullyProcessedMessages = new Set();

// //           try {
// //             await Promise.all(
// //               messagesToProcess.map(async (message) => {
// //                 try {
// //                   const data = JSON.parse(message.value);
// //                   const { userId, obj } = data;
// //                   console.log("Processing data of aadhar:", data);

// //                   let checkUser = await userModel.findOne({ _id: userId, "user_verify.aadhar_verify": 1 });

// //                   if (checkUser) {
// //                     successfullyProcessedMessages.add(message.offset);
// //                     return;
// //                   }

// //                   const user = await userModel.findByIdAndUpdate(userId, obj, { new: true });

// //                   if (user) {
// //                     await redisUser.setUser(userId, JSON.stringify(user));
// //                     const aadharBonus = await new GetBonus().getBonus(
// //                       global.constant.BONUS_TYPES.AADHAR_BONUS,
// //                       global.constant.PROFILE_VERIFY_AADHAR_BANK.SUBMITED
// //                     );
// //                     await givebonusToUser(
// //                       aadharBonus,
// //                       userId,
// //                       global.constant.PROFILE_VERIFY_BONUS_TYPES.AADHAR_BONUS,
// //                       global.constant.USER_VERIFY_TYPES.AADHAR_VERIFY
// //                     );
// //                     successfullyProcessedMessages.add(message.offset);
// //                   }
// //                 } catch (messageError) {
// //                   console.error("Error processing message:", messageError);
// //                 }
// //               })
// //             );

// //             if (successfullyProcessedMessages.size > 0) {
// //               for (const offset of successfullyProcessedMessages) {
// //                 resolveOffset(offset);
// //               }
// //               await commitOffsetsIfNecessary();
// //               console.log(`Committed offsets for ${successfullyProcessedMessages.size} successfully processed messages.`);
// //             }

// //           } catch (batchError) {
// //             console.error("Batch processing failed:", batchError);
// //           }

// //           await heartbeat();
// //         }
// //       },
// //     });

// //     // await consumer.run({
// //     //   eachBatchAutoResolve: false, // Manual offset management
// //     //   eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
// //     //     console.log(`Skipping batch of ${batch.messages.length} messages`);

// //     //     // Skip all messages but commit offsets to avoid reprocessing
// //     //     batch.messages.forEach((message) => resolveOffset(message.offset));

// //     //     await commitOffsetsIfNecessary(); // Commit all skipped messages
// //     //     console.log(`Skipped ${batch.messages.length} messages successfully.`);

// //     //     await heartbeat(); // Keep Kafka connection alive
// //     //   },
// //     // });

// //   } catch (error) {
// //     console.error("Error in Kafka Consumer:", error);
// //   }
// // }

// // async function processPanVerification() {

// //   // await consumer.connect(); // Ensure consumer is connected before subscribing
// //   // console.log("Consumer connected");

// //   await consumer.subscribe({ topic: "pan-verification-topic", fromBeginning: true });
// //   console.log(`Consumer subscribed to topic: pan-verification-topic`);

// //   await consumer.run({
// //     eachBatchAutoResolve: false, // Important for manual offset management
// //     eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
// //       const maxBatchSize = 10;
// //       console.log(`Processing batch of ${batch.messages.length} messages`);

// //       for (let i = 0; i < batch.messages.length; i += maxBatchSize) {
// //         const messagesToProcess = batch.messages.slice(i, i + maxBatchSize);
// //         const processedOffsets = [];

// //         try {
// //           const successfullyProcessedMessages = new Set(); // Track successfully processed messages

// //           await Promise.all(
// //             messagesToProcess.map(async (message) => {
// //               try {
// //                 const data = JSON.parse(message.value);
// //                 const { userId, obj } = data;
// //                 console.log("Processing data of pan:", data);

// //                 let checkUser = await userModel.findOne({ _id: userId, "user_verify.pan_verify": 1 });

// //                 if (checkUser) {
// //                   // User already verified, still commit the offset
// //                   successfullyProcessedMessages.add(message.offset);
// //                   return;
// //                 }

// //                 const user = await userModel.findByIdAndUpdate(
// //                   { _id: req.user._id },
// //                   obj,
// //                   { new: true }
// //                 );

// //                 if (user) {
// //                   await redisUser.setUser(user);
// //                   const panBonus = await new GetBonus().getBonus(
// //                     global.constant.BONUS_TYPES.PAN_BONUS,
// //                     global.constant.PROFILE_VERIFY_PAN_BANK.SUBMITED
// //                   );
// //                   // Give the bank bonus to the user and update their verification status
// //                   await givebonusToUser(
// //                     panBonus,
// //                     req.user._id,
// //                     global.constant.PROFILE_VERIFY_BONUS_TYPES.PAN_BONUS,
// //                     global.constant.USER_VERIFY_TYPES.PROFILE_VERIFY_PAN_BANK
// //                   );
// //                   // Store the processed offset
// //                   successfullyProcessedMessages.add(message.offset);
// //                 }

// //               } catch (messageError) {
// //                 console.error("Error processing message:", messageError);
// //               }
// //             })
// //           );

// //           // Commit only if new messages were processed successfully
// //           if (successfullyProcessedMessages.size > 0) {
// //             for (const offset of successfullyProcessedMessages) {
// //               resolveOffset(offset);
// //             }
// //             await commitOffsetsIfNecessary();
// //             console.log(`Committed offsets for ${successfullyProcessedMessages.size} successfully processed messages.`);
// //           }

// //         } catch (batchError) {
// //           console.error("Batch processing failed:", batchError);
// //         }

// //         await heartbeat(); // Keep Kafka connection alive
// //       }
// //     },
// //   });
// //   // await consumer.run({
// //   //   eachBatchAutoResolve: false, // Manual offset management
// //   //   eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
// //   //     console.log(`Skipping batch of ${batch.messages.length} messages`);

// //   //     // Skip all messages but commit offsets to avoid reprocessing
// //   //     batch.messages.forEach((message) => resolveOffset(message.offset));

// //   //     await commitOffsetsIfNecessary(); // Commit all skipped messages
// //   //     console.log(`Skipped ${batch.messages.length} messages successfully.`);

// //   //     await heartbeat(); // Keep Kafka connection alive
// //   //   },
// //   // });
// // }

// // async function processBankVerification() {

// //   // await consumer.connect(); // Ensure consumer is connected before subscribing
// //   // console.log("Consumer connected");

// //   await consumer.subscribe({ topic: "bank-verification-topic", fromBeginning: true });
// //   console.log(`Consumer subscribed to topic: bank-verification-topic`);

// //   await consumer.run({
// //     eachBatchAutoResolve: false, // Important for manual offset management
// //     eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
// //       const maxBatchSize = 10;
// //       console.log(`Processing batch of ${batch.messages.length} messages`);

// //       for (let i = 0; i < batch.messages.length; i += maxBatchSize) {
// //         const messagesToProcess = batch.messages.slice(i, i + maxBatchSize);
// //         const processedOffsets = [];

// //         try {
// //           const successfullyProcessedMessages = new Set(); // Track successfully processed messages

// //           await Promise.all(
// //             messagesToProcess.map(async (message) => {
// //               try {
// //                 const data = JSON.parse(message.value);
// //                 const { userId, obj } = data;
// //                 console.log("Processing data of aadhar:", data);

// //                 let checkUser = await userModel.findOne({ _id: userId, "user_verify.bank_verify": 1 });

// //                 if (checkUser) {
// //                   // User already verified, still commit the offset
// //                   successfullyProcessedMessages.add(message.offset);
// //                   return;
// //                 }

// //                 const user = await userModel.findByIdAndUpdate(
// //                   { _id: req.user._id },
// //                   {
// //                     "user_verify.bank_verify": global.constant.PROFILE_VERIFY_PAN_BANK.APPROVE,
// //                     bank: obj
// //                   },
// //                   { new: true }
// //                 );

// //                 if (user) {
// //                   await redisUser.setUser(user);
// //                   const bankBonus = await new GetBonus().getBonus(
// //                     global.constant.BONUS_TYPES.BANK_BONUS,
// //                     global.constant.PROFILE_VERIFY_AADHAR_BANK.SUBMITED
// //                   );

// //                   if (bankBonus > 0) {
// //                     const transactionId = `${global.constant.APP_SHORT_NAME}-BANKBONUS-${Date.now()}`;
// //                     const updatedUser = await userModel.findOneAndUpdate(
// //                       { _id: req.user._id },
// //                       { $inc: { "userbalance.bonus": bankBonus } },
// //                       { new: true }
// //                     );

// //                     await TransactionModel.create({
// //                       userid: req.user._id,
// //                       type: global.constant.BONUS_NAME.bankbonus,
// //                       transaction_id: transactionId,
// //                       transaction_by: global.constant.TRANSACTION_BY.APP_NAME,
// //                       amount: bankBonus,
// //                       paymentstatus: global.constant.PAYMENT_STATUS_TYPES.CONFIRMED,
// //                       bonus_amt: bankBonus,
// //                       win_amt: 0,
// //                       addfund_amt: 0,
// //                       bal_bonus_amt: updatedUser.userbalance.bonus || 0,
// //                       bal_win_amt: updatedUser.userbalance.balance || 0,
// //                       bal_fund_amt: updatedUser.userbalance.winning || 0,
// //                       total_available_amt: (updatedUser.userbalance.balance || 0) + (updatedUser.userbalance.winning || 0) + (updatedUser.userbalance.bonus || 0),
// //                       withdraw_amt: 0,
// //                       challenge_join_amt: 0,
// //                       cons_bonus: 0,
// //                       cons_win: 0,
// //                       cons_amount: 0,
// //                     });
// //                   }
// //                   // Store the processed offset
// //                   successfullyProcessedMessages.add(message.offset);
// //                 }

// //               } catch (messageError) {
// //                 console.error("Error processing message:", messageError);
// //               }
// //             })
// //           );

// //           // Commit only if new messages were processed successfully
// //           if (successfullyProcessedMessages.size > 0) {
// //             for (const offset of successfullyProcessedMessages) {
// //               resolveOffset(offset);
// //             }
// //             await commitOffsetsIfNecessary();
// //             console.log(`Committed offsets for ${successfullyProcessedMessages.size} successfully processed messages.`);
// //           }

// //         } catch (batchError) {
// //           console.error("Batch processing failed:", batchError);
// //         }

// //         await heartbeat(); // Keep Kafka connection alive
// //       }
// //     },
// //   });
// //   // await consumer.run({
// //   //   eachBatchAutoResolve: false, // Manual offset management
// //   //   eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
// //   //     console.log(`Skipping batch of ${batch.messages.length} messages`);

// //   //     // Skip all messages but commit offsets to avoid reprocessing
// //   //     batch.messages.forEach((message) => resolveOffset(message.offset));

// //   //     await commitOffsetsIfNecessary(); // Commit all skipped messages
// //   //     console.log(`Skipped ${batch.messages.length} messages successfully.`);

// //   //     await heartbeat(); // Keep Kafka connection alive
// //   //   },
// //   // });
// // }

// module.exports = { processEmailVerification, processAadharVerification, processPanVerification, processBankVerification };

