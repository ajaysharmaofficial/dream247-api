const { Kafka } = require("kafkajs");
const mongoose = require('mongoose');
const axios = require("axios");

const userModel = require('../../models/userModel');
const specialOfferModel = require('../../models/specialOfferModel.js');
const depositModel = require("../../models/depositModel.js");
const gstModel = require("../../models/gstModel");
const appliedOfferModel = require("../../models/appliedOfferModel.js");
const configModel = require("../../models/configModel.js");
const phonepeLogsModel = require("../../models/phonepeLogsModel");
const depositCashbackModel = require('../../models/depositCashbackModel.js');
const { addAmountTransaction } = require("../../services/deposit-api-service/services/paymentService");
const redisUser = require("../../utils/redis/redisUser");
const walletTransactionModel = require("../../models/walletTransactionModel.js");
const internalTransferModel = require("../../models/internalTransferModel.js")

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

// const consumer = kafka.consumer({ groupId: 'addcash-group', autoCommit: true });

// Consumer - Handles Phonepe Add Cash 

const kafka = new Kafka({
  clientId: "my-producer",
  brokers: ["localhost:9092"],
});
const processAddCash = async () => {
  const consumer = kafka.consumer({ groupId: 'addcash-group', autoCommit: true });

  try {
    await consumer.connect();
    console.log(`Consumer connected: Group ID - addcash-group`);

    await consumer.subscribe({ topic: 'addcash-topic', fromBeginning: true });
    console.log(`Consumer subscribed to topic: addcash-topic`);

    await consumer.run({
      eachBatchAutoResolve: false, // Important for manual offset management
      eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
        const maxBatchSize = 10;
        // console.log(`Processing batch of ${batch.messages.length} messages`);

        for (let i = 0; i < batch.messages.length; i += maxBatchSize) {
          const messagesToProcess = batch.messages.slice(i, i + maxBatchSize);
          const processedOffsets = [];

          try {
            await Promise.all(
              messagesToProcess.map(async (message) => {
                try {
                  const data = JSON.parse(message.value);
                  // console.log("data", data);

                  // Update withdrawal record
                  const paymentProcess = await depositModel.findOneAndUpdate(
                    { txnid: data.data.txnid },
                    data.data,
                    { new: true, upsert: true }
                  );

                  if (paymentProcess) {
                    console.log("paymentProcess", paymentProcess);
                    // Only commit offset if the record is successfully created or updated
                    resolveOffset(message.offset);
                    processedOffsets.push(message.offset);
                  }
                } catch (messageError) {
                  console.error("Error processing message:", messageError);
                }
              })
            );

            // Commit offsets only after processing the batch successfully
            if (processedOffsets.length > 0) {
              await commitOffsetsIfNecessary();
              console.log(`Processed ${processedOffsets.length} messages & committed offsets`);
            }
          } catch (batchError) {
            console.error("Batch processing failed:", batchError);
          }

          await heartbeat(); // Keep Kafka connection alive
        }
      },
    });
  } catch (error) {
    await consumer.disconnect();
  }
};





const processSelfTransfer = async () => {
  const consumer = kafka.consumer({ groupId: 'selftransfer-group', autoCommit: true });

  try {
    await consumer.connect();
    console.log(`Consumer connected: Group ID - selftransfer-group`);

    await consumer.subscribe({ topic: 'selftransfer-topic', fromBeginning: true });
    console.log(`Consumer subscribed to topic: selftransfer-topic`);

    await consumer.run({
      eachBatchAutoResolve: false, // Important for manual offset management
      eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
        const maxBatchSize = 10;
        // console.log(`Processing batch of ${batch.messages.length} messages`);

        for (let i = 0; i < batch.messages.length; i += maxBatchSize) {
          const messagesToProcess = batch.messages.slice(i, i + maxBatchSize);
          const processedOffsets = [];

          try {
            await Promise.all(
              messagesToProcess.map(async (message) => {
                try {
                  const data = JSON.parse(message.value);
                  const {
                    depositTransactionId,
                    winningTransactionId,
                    transaction_id,
                    transaction_id2,
                    userId,
                    amoutToAdd,
                    transferAmount,
                    commonTransactionProps,
                    commonTransactionPropsWinning,
                    selfTxnData
                  } = data;

                  await Promise.all([
                    // Create Deposit Transaction
                    walletTransactionModel.create({
                      _id: depositTransactionId,
                      ...commonTransactionProps,
                      transaction_id: transaction_id2,
                      type: "Self Deposit",
                      amount: amoutToAdd
                    }),

                    // Create Winning Transaction
                    walletTransactionModel.create({
                      _id: winningTransactionId,
                      ...commonTransactionPropsWinning,
                      transaction_id,
                      type: "Self Winning",
                      amount: transferAmount
                    }),

                    // Log Self Transfer Record
                    internalTransferModel.create(selfTxnData),

                    // Update User Balance
                    userModel.findOneAndUpdate(
                      { _id: userId },
                      {
                        $inc: {
                          "userbalance.balance": amoutToAdd,
                          "userbalance.winning": -transferAmount
                        }
                      },
                      { new: true }
                    )
                  ]);


                  resolveOffset(message.offset);
                  processedOffsets.push(message.offset);
                } catch (messageError) {
                  console.error("Error processing message:", messageError);
                }
              })
            );

            // Commit offsets only after processing the batch successfully
            if (processedOffsets.length > 0) {
              await commitOffsetsIfNecessary();
              console.log(`Processed ${processedOffsets.length} messages & committed offsets`);
            }
          } catch (batchError) {
            console.error("Batch processing failed:", batchError);
          }

          await heartbeat(); // Keep Kafka connection alive
        }
      },
    });
  } catch (error) {
    await consumer.disconnect();
  }
};

const processPaymentsTransactions = async () => {
  const consumer = kafka.consumer({ groupId: 'addcash-transaction-group', autoCommit: true });

  try {
    await consumer.connect();
    console.log(`Consumer connected: Group ID - addcash-transaction-group`);

    await consumer.subscribe({ topic: 'addcash-transaction-topic', fromBeginning: true });
    console.log(`Consumer subscribed to topic: addcash-transaction-topic`);

    await consumer.run({
      eachBatchAutoResolve: false, // Important for manual offset management
      eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
        const maxBatchSize = 10;
        // console.log(`Processing batch of ${batch.messages.length} messages`);

        for (let i = 0; i < batch.messages.length; i += maxBatchSize) {
          const messagesToProcess = batch.messages.slice(i, i + maxBatchSize);
          const processedOffsets = [];

          try {
            await Promise.all(
              messagesToProcess.map(async (message) => {
                try {
                  const data = JSON.parse(message.value);
                  // console.log("data", data);

                  // Update withdrawal record
                  const paymentProcess = await depositModel.findOneAndUpdate(
                    { txnid: data.data.txnid },
                    data.data,
                    { new: true, upsert: true }
                  );

                  if (paymentProcess) {
                    console.log("paymentProcess", paymentProcess);
                    let depositKey = `userid:${req.user._id}-deposit:${checkData._id}`;
                    await redisPayment.setkeydata(depositKey, paymentProcess);
                    // Only commit offset if the record is successfully created or updated
                    resolveOffset(message.offset);
                    processedOffsets.push(message.offset);
                  }
                } catch (messageError) {
                  console.error("Error processing message:", messageError);
                }
              })
            );

            // Commit offsets only after processing the batch successfully
            if (processedOffsets.length > 0) {
              await commitOffsetsIfNecessary();
              console.log(`Processed ${processedOffsets.length} messages & committed offsets`);
            }
          } catch (batchError) {
            console.error("Batch processing failed:", batchError);
          }

          await heartbeat(); // Keep Kafka connection alive
        }
      },
    });
  } catch (error) {
    await consumer.disconnect();
  }
};

// Consumer - Handles Phonepe Webhook
const processPhonepeWebhook = async () => {
  const consumer = kafka.consumer({ groupId: 'phonepe-webhook-group', autoCommit: true });

  try {
    await consumer.connect();
    console.log(`Consumer connected: Group ID - phonepe-webhook-group`);

    await consumer.subscribe({ topic: 'phonepe-webhook-topic', fromBeginning: true });
    console.log(`Consumer subscribed to topic: phonepe-webhook-topic`);

    await consumer.run({
      eachBatchAutoResolve: false, // Important for manual offset management
      eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
        const maxBatchSize = 10;
        // console.log(`Processing batch of ${batch.messages.length} messages`);

        for (let i = 0; i < batch.messages.length; i += maxBatchSize) {
          const messagesToProcess = batch.messages.slice(i, i + maxBatchSize);
          const processedOffsets = [];

          try {
            await Promise.all(
              messagesToProcess.map(async (message) => {
                try {
                  console.log("message.value", JSON.parse(message.value));
                  const { callbackData } = JSON.parse(message.value);
                  // console.log("callbackData.data", callbackData.data);
                  // console.log("callbackData", callbackData);
                  let paymentData = await depositModel.findOne({ txnid: callbackData.data.merchantTransactionId, status: "pending" });

                  if (paymentData) {
                    await phonepeLogsModel.create({
                      userid: paymentData.userid,
                      txnid: paymentData.txnid,
                      amount: paymentData.amount,
                      status: callbackData.code,
                      data: callbackData.data,
                    });
                    if (callbackData.code === "PAYMENT_SUCCESS") {
                      console.log(`Transaction ${callbackData.data.merchantTransactionId} successful.`);

                      let addAmount = paymentData.amount;
                      let getGetAmountDeductStatus = await configModel.find();
                      let getGstAmount = 0;

                      if (getGetAmountDeductStatus[0].gst == 1) {
                        getGstAmount = ((21.88 / 100) * addAmount).toFixed(2);
                      }

                      let amoutWithGst = addAmount - getGstAmount;

                      const updateUserBalance = await userModel.findOneAndUpdate(
                        { _id: paymentData.userid },
                        { $inc: { "userbalance.balance": amoutWithGst } },
                        { new: true }
                      );

                      if (updateUserBalance) {
                        let transaction_id = paymentData.txnid;
                        if (getGstAmount > 0) {
                          const gstDataObj = {
                            gstAmount: getGstAmount,
                            totalAmount: amoutWithGst,
                            userid: updateUserBalance._id,
                          };
                          await gstModel.create(gstDataObj);
                          const cashbackData = await depositCashbackModel.create({
                            userid: updateUserBalance._id,
                            bonus: getGstAmount,
                            type: "gst",
                            transaction_id: transaction_id,
                            deposit_id: paymentData._id,
                            expiresAt: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000) // 28 days from now
                            // expiresAt: new Date(Date.now() + 5 * 60 * 1000)
                          });
                          if (cashbackData) {
                            console.log("cashback data added successfully", cashbackData._id);
                          }
                          await userModel.findOneAndUpdate(
                            { _id: paymentData.userid },
                            { $inc: { "userbalance.bonus": getGstAmount } },
                            { new: true }
                          );
                          await addAmountTransaction(
                            updateUserBalance,
                            getGstAmount,
                            "Bonus",
                            "bonus",
                            transaction_id
                          );
                        }

                        await depositModel.findOneAndUpdate(
                          { txnid: callbackData.data.merchantTransactionId },
                          { status: "SUCCESS", pay_id: callbackData.data.transactionId, utr: callbackData.data.paymentInstrument.utr },
                          { new: true }
                        );

                        await addAmountTransaction(
                          updateUserBalance,
                          amoutWithGst,
                          "Cash added",
                          "fund",
                          transaction_id
                        );

                      }

                      // Offer Bonus Logic
                      if (paymentData.offerid) {
                        let findOffer = await specialOfferModel.findOne({ _id: mongoose.Types.ObjectId(paymentData.offerid) });

                        // Check if the offer is already used
                        let alreadyUsed = await appliedOfferModel.find({
                          user_id: mongoose.Types.ObjectId(paymentData.userid),
                          offer_id: mongoose.Types.ObjectId(paymentData.offerid)
                        });

                        if (alreadyUsed.length >= findOffer.user_time) {
                          console.log("Offer already used. Skipping update.");
                          return;
                        }

                        let amountt;
                        if (findOffer.offer_type == "flat") {
                          amountt = findOffer.bonus;
                        } else if (findOffer.offer_type == "percent") {
                          amountt = paymentData.amount * (findOffer.bonus / 100);
                        }

                        let updatedBalance;
                        if (findOffer.type == "rs") {
                          updatedBalance = await userModel.findOneAndUpdate(
                            { _id: mongoose.Types.ObjectId(paymentData.userid) },
                            { $inc: { "userbalance.balance": amountt } },
                            { new: true }
                          );
                        } else {
                          updatedBalance = await userModel.findOneAndUpdate(
                            { _id: mongoose.Types.ObjectId(paymentData.userid) },
                            { $inc: { "userbalance.bonus": amountt } },
                            { new: true }
                          );
                        }

                        let transaction_id = `${global.constant.APP_SHORT_NAME}-Offer-${Date.now()}`;
                        await addAmountTransaction(
                          updatedBalance,
                          amountt,
                          "Offer bonus",
                          "bonus",
                          transaction_id
                        );

                        await appliedOfferModel.create({
                          user_id: paymentData.userid,
                          offer_id: paymentData.offerid,
                          transaction_id,
                        });
                      }
                      processedOffsets.push(message.offset);
                      resolveOffset(message.offset);
                    } else {
                      console.log(`Transaction ${callbackData.data.merchantTransactionId} failed or pending.`);
                      await depositModel.findOneAndUpdate(
                        { txnid: callbackData.data.merchantTransactionId },
                        { status: callbackData.data.state, pay_id: callbackData.data.transactionId, utr: callbackData.data.paymentInstrument.utr },
                        { new: true }
                      );
                      processedOffsets.push(message.offset);
                      resolveOffset(message.offset);
                    }

                    return {
                      status: true,
                      message: "Callback processed successfully."
                    }
                  } else {
                    return {
                      status: false,
                      message: "Payment in database not found."
                    }
                  }

                } catch (messageError) {
                  console.error("Error processing message:", messageError);
                }
              })
            );

            // Commit offsets only after processing the batch successfully
            if (processedOffsets.length > 0) {
              await commitOffsetsIfNecessary();
              console.log(`Processed ${processedOffsets.length} messages & committed offsets`);
            }
          } catch (batchError) {
            console.error("Batch processing failed:", batchError);
          }

          await heartbeat(); // Keep Kafka connection alive
        }
      },
    });
  } catch (error) {
    await consumer.disconnect();
  }
};

module.exports = { processAddCash, processPhonepeWebhook, processPaymentsTransactions, processSelfTransfer };
