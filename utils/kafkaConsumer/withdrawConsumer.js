const { Kafka } = require("kafkajs");
const axios = require("axios");
const payoutModel = require("../../models/payoutModel");
const walletTransactionModel = require("../../models/walletTransactionModel.js");
const userModel = require("../../models/userModel");
const p2pModel = require("../../models/p2pModel.js");
// const { redis } = require("../../utils/redis/redisPayment.js");
const redisPayment = require("../../utils/redis/redisPayment.js");
const redisUser = require("../../utils/redis/redisUser.js");
const moment = require('moment');
const crypto = require("crypto");
// const kafka = new Kafka({
//   clientId: 'test-client',
//   brokers: [
//     global.constant.kafka1, 
//     global.constant.kafka2, 
//     global.constant.kafka3
//   ],
//   ssl: process.env.secretManager === 'prod',
//   // connectionTimeout: 30000,
//   // retry: {
//   //   initialRetryTime: 300,
//   //   retries: 10,
//   // },
//   connectionTimeout: 60000,
//   retry: {
//     initialRetryTime: 5000,
//     retries: 10,
//   },
//   requestTimeout: 30000,
//   allowAutoTopicCreation: true,
// });

const kafka = new Kafka({
    clientId: "my-producer",
    brokers: ["localhost:9092"],
});

const consumer = kafka.consumer({ groupId: "withdrawal-group" });

// const processPayouts = async () => {
//     const consumer = kafka.consumer({ groupId: 'payout-group', autoCommit: true });

//     try {
//         await consumer.connect();
//         console.log(`Consumer connected: Group ID - payout-group`);

//         await consumer.subscribe({ topic: 'payout-topic', fromBeginning: true });
//         console.log(`Consumer subscribed to topic: payout-topic`);

//         await consumer.run({
//             eachBatchAutoResolve: false,
//             eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
//                 const maxBatchSize = 10;

//                 for (let i = 0; i < batch.messages.length; i += maxBatchSize) {
//                     const messagesToProcess = batch.messages.slice(i, i + maxBatchSize);
//                     const processedOffsets = [];

//                     try {
//                         const results = await Promise.all(messagesToProcess.map(async (message) => {
//                             if (!message || !message.value) {
//                                 console.warn("Skipping empty Kafka message");
//                                 return null;
//                             }

//                             let data;
//                             try {
//                                 data = JSON.parse(message.value);
//                             } catch (err) {
//                                 console.error("Failed to parse Kafka message value:", err);
//                                 return null;
//                             }

//                             try {
//                                 const { withdrawalData, transactionData, user, amount, paymentMode, duplicateWithdrawal } = data;

//                                 const alreadyExistingWithdraw = await payoutModel.findOne({ withdraw_req_id: withdrawalData.withdraw_req_id });

//                                 if (alreadyExistingWithdraw && alreadyExistingWithdraw.status == 1) {
//                                     console.log(`Withdrawal ${alreadyExistingWithdraw.withdraw_req_id} already processed. Skipping.`);
//                                     return message.offset;
//                                 }
//                                 const addedWithdraw = await payoutModel.findOneAndUpdate(
//                                     { withdraw_req_id: withdrawalData.withdraw_req_id },
//                                     withdrawalData,
//                                     { new: true, upsert: true }
//                                 );
//                                 // implemented redis logic to update lastWithdraw and TDS data
//                                 let lastWithdrawKeyname = `lastWithDraw:{${user._id}}`;

//                                 let okkk = await redisPayment.setkeydata(
//                                     lastWithdrawKeyname,
//                                     addedWithdraw.createdAt.toISOString()
//                                 );
//                                 console.log("okkk", okkk);
//                                 let paymentDataRedis = await redisPayment.getTDSdata(user._id);

//                                 let lastTxn = await walletTransactionModel.findOne({ userid: user._id }).sort({ createdAt: -1 }).select('total_available_amt');
//                                 console.log("lastTxn", lastTxn);

//                                 let currentTxn = await walletTransactionModel.findOneAndUpdate(
//                                     { transaction_id: transactionData.transaction_id },
//                                     transactionData,
//                                     { new: true, upsert: true }
//                                 );

//                                 let userbalanceFromRedis = await redisUser.redis.hgetall(`wallet:{${user._id}}`);
//                                 if (!userbalanceFromRedis) {
//                                     await redisUser.setDbtoRedisWallet(user._id);
//                                     userbalanceFromRedis = await redisUser.redis.hgetall(`wallet:{${user._id}}`);
//                                 }
//                                 if (!duplicateWithdrawal) {
//                                     const withdrawReqId = withdrawalData.withdraw_req_id;
//                                     if (process.env.secretManager === "prod") {
//                                         console.log("🔐 Production mode detected, starting watchpay payout...");

//                                         try {
//                                             const WATCHPAY_URL = 'https://api.watchglb.com/pay/transfer'
//                                             const WATCHPAY_PAYOUT_KEY = global.constant.WATCHPAY_PAYOUT_KEY;
//                                             const WATCHPAY_MERCHANT_KEY = global.constant.WATCHPAY_MERCHANT_KEY;

//                                             const BANK_CODE_BY_NAME = {
//                                                 "canara bank": "IDPT0001",
//                                                 "dcb bank": "IDPT0002",
//                                                 "federal bank": "IDPT0003",
//                                                 "hdfc bank": "IDPT0004",
//                                                 "punjab national bank": "IDPT0005",
//                                                 "indian bank": "IDPT0006",
//                                                 "icici bank": "IDPT0007",
//                                                 "syndicate bank": "IDPT0008",
//                                                 "karur vysya bank": "IDPT0009",
//                                                 "union bank of india": "IDPT0010",
//                                                 "kotak mahindra bank": "IDPT0011",
//                                                 "idfc first bank": "IDPT0012",
//                                                 "andhra bank": "IDPT0013",
//                                                 "karnataka bank": "IDPT0014",
//                                                 "icici corporate bank": "IDPT0015",
//                                                 "axis bank": "IDPT0016",
//                                                 "uco bank": "IDPT0017",
//                                                 "south indian bank": "IDPT0018",
//                                                 "yes bank": "IDPT0019",
//                                                 "standard chartered bank": "IDPT0020",
//                                                 "state bank of india": "IDPT0021",
//                                                 "indian overseas bank": "IDPT0022",
//                                                 "bandhan bank": "IDPT0023",
//                                                 "central bank of india": "IDPT0024",
//                                                 "bank of baroda": "IDPT0025"
//                                             };

//                                             const normalizedBankName = user?.bank?.bankname
//                                                 ?.toLowerCase()
//                                                 .replace(/\s+/g, " ")
//                                                 .trim();

//                                             let apply_date = moment().format('YYYY-MM-DD HH:mm:ss');
//                                             let transfer_amount = amount;
//                                             let bank_code = BANK_CODE_BY_NAME[normalizedBankName];
//                                             let mch_id = WATCHPAY_MERCHANT_KEY;
//                                             let mch_transferId = withdrawReqId;
//                                             let receive_account = user.bank.accno;
//                                             let receive_name = user.bank.accountholder;
//                                             let remark = user.bank.ifsc;

//                                             // -------------------------
//                                             // Build Sign String (same as PHP)
//                                             // -------------------------
//                                             let signStr = "";
//                                             signStr += `apply_date=${apply_date}&`;
//                                             if (bank_code) signStr += `bank_code=${bank_code}&`;
//                                             signStr += `mch_id=${mch_id}&`;
//                                             signStr += `mch_transferId=${mch_transferId}&`;
//                                             signStr += `receive_account=${receive_account}&`;
//                                             signStr += `receive_name=${receive_name}&`;
//                                             signStr += `remark=${remark}&`;
//                                             signStr += `transfer_amount=${transfer_amount}`;

//                                             const sign = await generateMD5Sign(signStr, WATCHPAY_PAYOUT_KEY);
//                                             const payload = {
//                                                 apply_date,
//                                                 bank_code,
//                                                 mch_id,
//                                                 mch_transferId,
//                                                 receive_account,
//                                                 receive_name,
//                                                 transfer_amount,
//                                                 remark,
//                                                 sign_type: "MD5",
//                                                 sign,
//                                             };
//                                             const payoutRes = await axios.post(
//                                                 WATCHPAY_URL,
//                                                 new URLSearchParams(payload).toString(),
//                                                 {
//                                                     headers: { "Content-Type": "application/x-www-form-urlencoded" },
//                                                 }
//                                             );
//                                             const receivedAt = new Date();
//                                             if (!payoutRes?.data || payoutRes.data.respCode !== "SUCCESS") {
//                                                 console.error("❌ Watchpay Payout Failed:", payoutRes?.data);

//                                                 if (withdrawalData.status === 2) {
//                                                     console.log("⚠️ Refund already done, skipping:", withdrawReqId);
//                                                     return message.offset;
//                                                 }
//                                                 await payoutModel.updateOne(
//                                                     { withdraw_req_id: withdrawReqId },
//                                                     {
//                                                         status: 2,
//                                                         status_description: payoutRes?.data?.respMsg || "Payout failed",
//                                                         receivedTime: receivedAt,
//                                                         withdrawfrom: "WatchPay"
//                                                     }
//                                                 );
//                                                 await walletTransactionModel.updateOne(
//                                                     { transaction_id: transactionData.transaction_id },
//                                                     { paymentstatus: global.constant.PAYMENT_STATUS_TYPES.FAILED }
//                                                 );
//                                                 await userModel.updateOne(
//                                                     { _id: user._id },
//                                                     {
//                                                         $inc: {
//                                                             "userbalance.winning": Number(withdrawalData.amount)
//                                                         }
//                                                     }
//                                                 );

//                                                 // 4️⃣ Create REFUND transaction entry (IMPORTANT ✅)
//                                                 const refundTransaction = {
//                                                     userid: user._id,
//                                                     amount: withdrawalData.amount,
//                                                     withdraw_amt: 0,
//                                                     cons_win: withdrawalData.amount,
//                                                     transaction_id: `${withdrawReqId}_REFUND`,
//                                                     type: 'Amount Withdraw Refund',
//                                                     transaction_by: global.constant.TRANSACTION_BY.WALLET,
//                                                     paymentstatus: global.constant.PAYMENT_STATUS_TYPES.SUCCESS,
//                                                     bal_fund_amt: Number(userbalanceFromRedis.balance).toFixed(2),
//                                                     bal_win_amt: (
//                                                         Number(userbalanceFromRedis.winning) +
//                                                         Number(withdrawalData.amount)
//                                                     ).toFixed(2),
//                                                     bal_bonus_amt: Number(userbalanceFromRedis.bonus).toFixed(2),
//                                                     total_available_amt: (
//                                                         Number(userbalanceFromRedis.balance) +
//                                                         Number(userbalanceFromRedis.bonus) +
//                                                         Number(userbalanceFromRedis.winning) +
//                                                         Number(withdrawalData.amount)
//                                                     ).toFixed(2),
//                                                     tds_amount: 0
//                                                 };

//                                                 await walletTransactionModel.create(refundTransaction);

//                                                 const refundTxnRedis = {
//                                                     txnid: withdrawReqId,
//                                                     transaction_id: refundTransaction.transaction_id,
//                                                     type: "Amount Withdraw Refund",
//                                                     transaction_type: "Credit",
//                                                     amount: withdrawalData.amount,
//                                                     userid: user._id,
//                                                     paymentmethod: "WatchPay",
//                                                     paymentstatus: "success",
//                                                     tds_amount: 0
//                                                 };

//                                                 const walletAfterRefund = {
//                                                     balance: Number(userbalanceFromRedis.balance),
//                                                     bonus: Number(userbalanceFromRedis.bonus),
//                                                     winning:
//                                                         Number(userbalanceFromRedis.winning) +
//                                                         Number(withdrawalData.amount),
//                                                 };

//                                                 await redisUser.saveTransactionToRedis(
//                                                     user._id,
//                                                     walletAfterRefund,
//                                                     refundTxnRedis
//                                                 );

//                                                 console.log("🔁 Withdrawal FAILED & REFUNDED (DB + Redis):", withdrawReqId);
//                                                 return message.offset;
//                                             }
//                                             else {
//                                                 await payoutModel.updateOne(
//                                                     { withdraw_req_id: withdrawReqId },
//                                                     {
//                                                         payout_id: payoutRes.data.tradeNo,
//                                                         status_description: 'processed',
//                                                         receivedTime: receivedAt,
//                                                         utr: payoutRes.data.tradeNo,
//                                                         status: 1,
//                                                         withdrawfrom: "WatchPay"
//                                                     }
//                                                 );
//                                                 await walletTransactionModel.updateOne(
//                                                     { transaction_id: transactionData.transaction_id },
//                                                     {
//                                                         paymentstatus: "success"
//                                                     }
//                                                 );

//                                                 const transactionDataRedis = {
//                                                     txnid: withdrawalData.withdraw_req_id,
//                                                     transaction_id: withdrawalData.withdraw_req_id,
//                                                     type: "Amount Withdraw",
//                                                     transaction_type: "Debit",
//                                                     amount: withdrawalData.amount,
//                                                     userid: user._id,
//                                                     paymentmethod: "WatchPay",
//                                                     paymentstatus: "success",
//                                                     tds_amount: withdrawalData.tds_amount || 0
//                                                 };
//                                                 const walletUpdateSuccess = {
//                                                     balance: Number(userbalanceFromRedis.balance),
//                                                     bonus: Number(userbalanceFromRedis.bonus),
//                                                     winning: Number(userbalanceFromRedis.winning),
//                                                 };
//                                                 await redisUser.saveTransactionToRedis(
//                                                     user._id,
//                                                     walletUpdateSuccess,
//                                                     transactionDataRedis
//                                                 );
//                                                 console.log("📝 Withdrawal record updated with payout info");
//                                             }
//                                         } catch (err) {
//                                             console.error("❌ Watchpay payout error", err?.response?.data || err.message);
//                                             return message.offset;
//                                         }
//                                     }
//                                 }
//                                 else {
//                                     const receivedAt = new Date();
//                                     let processedPayment = await payoutModel.findOneAndUpdate(
//                                         { withdraw_req_id: addedWithdraw.withdraw_req_id },
//                                         {
//                                             status_description: "cancelled",
//                                             withdrawfrom: "WatchPay",
//                                             receivedTime: receivedAt,
//                                             status: 4,
//                                             comment: "Withdrawal cancelled due to unknown source.",
//                                             suspicious: true
//                                         },
//                                         { new: true }
//                                     );

//                                     const transactionDataRedis = {
//                                         txnid: withdrawalData.withdraw_req_id,
//                                         transaction_id: withdrawalData.withdraw_req_id,
//                                         type: "Amount Withdraw",
//                                         transaction_type: "Debit",
//                                         amount: withdrawalData.amount,
//                                         userid: withdrawalData.userid,
//                                         paymentmethod: withdrawalData.withdrawfrom,
//                                         paymentstatus: "failed",
//                                         tds_amount: withdrawalData.tds_amount || 0
//                                     };

//                                     // Updating in Redis
//                                     const walletUpdateSuccess = {
//                                         balance: Number(userbalanceFromRedis.balance),
//                                         bonus: Number(userbalanceFromRedis.bonus),
//                                         winning: Number(userbalanceFromRedis.winning),
//                                     };

//                                     redisUser.saveTransactionToRedis(user._id, walletUpdateSuccess, transactionDataRedis);

//                                     await redisPayment.updatedPaymentData(user._id, processedPayment);

//                                     console.log(`⚠️ Withdrawal txn is having some problem, ${withdrawalData.withdraw_req_id}`);
//                                 }


//                                 return message.offset;

//                             } catch (err) {
//                                 console.error("Error processing Kafka payout message:", err);
//                                 return null;
//                             }
//                         }));

//                         processedOffsets.push(...results.filter(offset => offset !== null));
//                         processedOffsets.forEach(offset => resolveOffset(offset));
//                         await commitOffsetsIfNecessary();
//                         console.log(`Processed ${processedOffsets.length} messages & committed offsets`);
//                     } catch (batchError) {
//                         console.error("Batch processing failed:", batchError);
//                     }

//                     await heartbeat(); // Keep Kafka connection alive
//                 }
//             },
//         });

//     } catch (error) {
//         console.error("Kafka consumer error:", error);
//         await consumer.disconnect();
//     }
// };

const processP2Ptxns = async () => {
    const consumer = kafka.consumer({ groupId: 'p2p-group', autoCommit: true });

    try {
        await consumer.connect();
        console.log(`✅ Consumer connected: Group ID - p2p-group`);

        await consumer.subscribe({ topic: 'p2p-topic', fromBeginning: true });
        console.log(`✅ Consumer subscribed to topic: p2p-topic`);

        await consumer.run({
            eachBatchAutoResolve: false,
            eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
                const maxBatchSize = 10;

                for (let i = 0; i < batch.messages.length; i += maxBatchSize) {
                    const messagesToProcess = batch.messages.slice(i, i + maxBatchSize);
                    const processedOffsets = [];

                    try {
                        const results = await Promise.all(
                            messagesToProcess.map(async (message) => {
                                if (!message?.value) return null;

                                let data;
                                try {
                                    data = JSON.parse(message.value);
                                } catch (err) {
                                    console.error("❌ Failed to parse Kafka message:", err);
                                    return null;
                                }

                                try {
                                    await Promise.all([
                                        userModel.findOneAndUpdate(
                                            data.userUpdateQuery.filter,
                                            data.userUpdateQuery.update,
                                            { new: true }
                                        ),
                                        userModel.findOneAndUpdate(
                                            data.receiverUpdateQuery.filter,
                                            data.receiverUpdateQuery.update,
                                            { new: true }
                                        ),
                                    ]);

                                    await walletTransactionModel.insertMany(data.transactionDocs);
                                    await payoutModel.create(data.withdrawDoc);
                                    await p2pModel.create(data.p2pDoc);

                                    return message.offset;
                                } catch (err) {
                                    console.error("❌ Mongo operations failed:", err);
                                    return null;
                                }
                            })
                        );

                        // ✅ Only resolve offsets for successfully processed messages
                        results.forEach((offset) => {
                            if (offset !== null) resolveOffset(offset);
                        });

                        await commitOffsetsIfNecessary();
                        console.log(`✅ Processed and committed offsets for ${results.filter(r => r !== null).length} messages`);

                    } catch (batchError) {
                        console.error("❌ Batch processing failed:", batchError);
                    }

                    await heartbeat(); // Keep Kafka connection alive
                }
            },
        });

    } catch (error) {
        console.error("❌ Kafka consumer error:", error);
        await consumer.disconnect();
    }
};

async function generateMD5Sign(signStr, key) {
    return crypto
        .createHash("md5")
        .update(signStr + "&key=" + key)
        .digest("hex");
}

// Consumer - Handles Razorpay payout
async function processPayouts() {
    await consumer.subscribe({ topic: 'payout-topic', fromBeginning: true });
    console.log(`Consumer subscribed to topic: payout-topic`);

    await consumer.run({
        eachBatchAutoResolve: false,  // Important for manual offset management
        eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
            const maxBatchSize = 500;
            console.log(`Processing batch of ${batch.messages.length} messages`);

            for (let i = 0; i < batch.messages.length; i += maxBatchSize) {
                const messagesToProcess = batch.messages.slice(i, i + maxBatchSize);
                const processedOffsets = [];

                try {
                    const results = await Promise.all(messagesToProcess.map(async (message) => {
                        const data = JSON.parse(message.value);
                        try {
                            const { withdrawalData, transactionData, user, amount } = data;

                            // console.log(
                            //   "withdrawalData", withdrawalData,
                            //   "transactionData", transactionData,
                            //   "user", user,
                            //   "amount", amount
                            // )

                            const alreadyExistingWithdraw = await payoutModel.findOne(
                                { withdraw_req_id: withdrawalData.withdraw_req_id }
                            )

                            // If the withdrawal status is already 1, commit the offset and skip processing
                            if (alreadyExistingWithdraw && alreadyExistingWithdraw.status == 1) {
                                console.log(`Withdrawal ${alreadyExistingWithdraw.withdraw_req_id} is already processed. Skipping payout.`);
                                return message.offset; // Ensure this offset is committed
                            }

                            const addedWithdraw = await payoutModel.findOneAndUpdate(
                                { withdraw_req_id: withdrawalData.withdraw_req_id },
                                withdrawalData,
                                { new: true, upsert: true }
                            )

                            await walletTransactionModel.findOneAndUpdate(
                                { transaction_id: transactionData.transaction_id },
                                transactionData,
                                { new: true, upsert: true }
                            );

                            if (addedWithdraw) {
                                const authHeader = "Basic " + Buffer.from(`${global.constant.RAZORPAY_X_KEY_ID_LIVE}:${global.constant.RAZORPAY_X_KEY_SECRET_LIVE}`).toString("base64");

                                // Ensure Contact exists
                                let contactId = user.razorpay_x_contact_id;
                                if (!contactId) {
                                    const contactResponse = await axios.post("https://api.razorpay.com/v1/contacts", {
                                        name: user.bank.accountholder,
                                        email: user.email,
                                        contact: user.mobile,
                                        type: "employee",
                                        reference_id: addedWithdraw.withdraw_req_id,
                                    }, { headers: { "Content-Type": "application/json", Authorization: authHeader } });

                                    contactId = contactResponse.data.id;
                                    await userModel.updateOne({ _id: user._id }, { $set: { razorpay_x_contact_id: contactId } });
                                }

                                // Create Fund Account if not exists
                                let fundAccountId = user.fund_account_id;
                                if (!fundAccountId) {
                                    const fundAccountResponse = await axios.post("https://api.razorpay.com/v1/fund_accounts", {
                                        contact_id: contactId,
                                        account_type: "bank_account",
                                        bank_account: {
                                            name: user.bank.accountholder,
                                            ifsc: user.bank.ifsc,
                                            account_number: user.bank.accno
                                        },
                                    }, { headers: { "Content-Type": "application/json", Authorization: authHeader } });

                                    fundAccountId = fundAccountResponse.data.id;
                                    await userModel.updateOne({ _id: user._id }, { $set: { fund_account_id: fundAccountId } });
                                }

                                // Create Payout in Razorpay
                                const payoutResponse = await axios.post("https://api.razorpay.com/v1/payouts", {
                                    account_number: `${global.constant.RAZORPAY_X_ACCOUNT_NUMBER}`,
                                    fund_account_id: fundAccountId,
                                    amount: amount * 100,
                                    currency: "INR",
                                    mode: "IMPS",
                                    purpose: "refund",
                                    reference_id: addedWithdraw.withdraw_req_id,
                                }, { headers: { "Content-Type": "application/json", Authorization: authHeader } });

                                // Update withdrawal record
                                await payoutModel.findOneAndUpdate(
                                    { withdraw_req_id: addedWithdraw.withdraw_req_id }, {
                                    payout_id: payoutResponse.data.id,
                                    status_description: payoutResponse.data.status
                                });

                                return message.offset;
                            }
                        } catch (error) {
                            console.error('Error processing transaction:', error);
                            return null;  // Skip offset commit for failed messages
                        }
                    }));

                    // Commit successful messages' offsets
                    processedOffsets.push(...results.filter(offset => offset !== null));
                    processedOffsets.forEach(offset => resolveOffset(offset));
                    await commitOffsetsIfNecessary();
                    console.log(`Processed ${processedOffsets.length} messages & committed offsets`);
                } catch (batchError) {
                    console.error("Batch processing failed:", batchError);
                }

                await heartbeat();  // Keep Kafka connection alive
            }
        }
    });
}

module.exports = { processPayouts, processP2Ptxns };

