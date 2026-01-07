const mongoose = require('mongoose');
const axios = require("axios");
const userModel = require('../../../models/userModel');
const randomstring = require('randomstring');
const specialOfferModel = require('../../../models/specialOfferModel');
const depositModel = require("../../../models/depositModel");
const tierbreakdown = require("../../../models/tierbreakdown");
const gstModel = require("../../../models/gstModel");
const appliedOfferModel = require("../../../models/appliedOfferModel");
const configModel = require("../../../models/configModel");
const TransactionModel = require("../../../models/walletTransactionModel");
const phonepeLogsModel = require("../../../models/phonepeLogsModel");
const { sendToQueue } = require('../../../utils/kafka');
const cashbackModel = require('../../../models/depositCashbackModel');
const redisMain = require('../../../utils/redis/redisMain');
// const selfTransferModel = require("../../../models/selfTransferModel");
const redisUser = require('../../../utils/redis/redisUser');
const moment = require('moment');
const Razorpay = require('razorpay');
const razorpayLogsModel = require("../../../models/razorpayLogsModel");
const base64 = require("base-64");
const crypto = require("crypto");
const redisPayment = require("../../../utils/redis/redisPayment");

exports.dbCheck = async () => {
  try {
    // MongoDB Health Check
    const mongoConnected = mongoose.connection.readyState === 1; // 1 means connected

    // Redis Health Check
    // const redisPing = await Redis.healthCheck();
    // const redisConnected = redisPing === "PONG";

    // Determine overall health status
    const isHealthy = mongoConnected;

    return {
      status: isHealthy,
      database: { status: mongoConnected, message: mongoConnected ? "MongoDB is connected." : "MongoDB is not connected." },
      // redis: { status: redisConnected, message: redisConnected ? "Redis is connected." : "Redis is not responding." }
    };
  } catch (error) {
    return {
      status: false,
      database: { status: false, message: "Database health check failed.", error: error.message },
      // redis: { status: false, message: "Redis health check failed.", error: error.message }
    };
  }
};

exports.addAmountTransaction = async (
  userData,
  addAmount,
  type,
  amountType,
  transaction_id
) => {
  let transactionObj = {};
  transactionObj.transaction_id = transaction_id;
  transactionObj.transaction_by = global.constant.TRANSACTION_BY.APP_NAME;
  transactionObj.userid = userData._id;
  transactionObj.type = type;
  transactionObj.amount = addAmount;
  transactionObj.paymentstatus = "confirmed";
  if (amountType == "fund") {
    transactionObj.addfund_amt = addAmount;
  } else if (amountType == "bonus") {
    transactionObj.bonus_amt = addAmount;
  } else {
    transactionObj.win_amt = addAmount;
  }
  transactionObj.bal_fund_amt = userData.userbalance.balance;
  transactionObj.bal_win_amt = userData.userbalance.winning;
  transactionObj.bal_bonus_amt = userData.userbalance.bonus;
  transactionObj.total_available_amt =
    userData.userbalance.balance +
    userData.userbalance.winning +
    userData.userbalance.bonus;
  const insertTransaction = await TransactionModel.create(transactionObj);

  // // Updating in Redis
  // const walletUpdate = {
  //   balance: userData.userbalance.balance,
  //   bonus: userData.userbalance.winning,
  //   winning: userData.userbalance.bonus
  // };
  // transactionObj.paymentstatus = "success";
  // transactionObj.paymentmethod = paymentmethod || "";
  // transactionObj.utr = utr || "";
  // transactionObj.gst_amount = gst_amount || 0;
  // transactionObj.expiresAt = expiresAt || null;
  // await redisUser.saveTransactionToRedis(userData._id, walletUpdate, transactionObj)
  return true;
};

async function generateToken(clientSecret, requestId, timestamp) {
  const ENCRYPTION_KEY = '84f8020f8006de247b808f7645478606'; // 256-bit key (32 characters)
  const ENCRYPTION_IV = '0b88ad32f2ae6a9a';   // 16-byte IV
  const JWT_SECRET = `${global.constant.SECRET_TOKEN}`;
  // Step 1: Create a JWT token
  const payload = {
    requestId: requestId,
    timestamp: timestamp, // Current time in seconds
  };
  const jwtToken = jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });

  // Step 2: Encrypt the JWT token using AES
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), Buffer.from(ENCRYPTION_IV));
  let encryptedToken = cipher.update(jwtToken, 'utf8', 'base64');
  encryptedToken += cipher.final('base64');

  return encryptedToken;
}

exports.fetchOffers = async (req) => {
  try {
    const offerKeys = await redisPayment.redis.keys("offer:*");

    // Filter only keys with valid ObjectId after 'offer:'
    const validOfferKeys = offerKeys.filter((key) => {
      const parts = key.split(":");
      const id = parts[1];
      return (
        !id.includes("{") &&
        !id.includes("}") &&
        mongoose.Types.ObjectId.isValid(id)
      );
    });

    if (validOfferKeys.length > 0) {
      let parsedOffers = [];

      for (const key of validOfferKeys) {
        try {
          const offerData = await redisPayment.redis.get(key);
          if (!offerData) continue;

          let parsed;

          // ✅ Handle both string (JSON) and object cases
          if (typeof offerData === "string") {
            parsed = JSON.parse(offerData);
          } else if (typeof offerData === "object" && offerData !== null) {
            parsed = offerData;
          } else {
            console.warn(`⚠️ Skipping invalid Redis data for ${key}:`, offerData);
            continue;
          }

          // ✅ Only keep active offers
          if (parsed.enddate && new Date(parsed.enddate) > new Date()) {
            parsedOffers.push(parsed);
          }
        } catch (err) {
          console.warn(`Error handling offer for key ${key}:`, err.message);
        }
      }

      return {
        message: "Offers fetched from Redis",
        status: true,
        data: parsedOffers,
      };
    }

    // ---- Fallback: fetch offers from MongoDB ----
    const offers = await specialOfferModel.aggregate([
      {
        $addFields: {
          currentDate: {
            $dateToString: {
              format: "%Y/%m/%d %H:%M",
              date: "$$NOW",
            },
          },
        },
      },
      {
        $match: {
          $expr: {
            $lt: ["$currentDate", "$enddate"],
          },
        },
      },
      {
        $lookup: {
          from: "appliedoffer", // collection name must match your DB
          let: { offerId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$offer_id", "$$offerId"] },
                    { $eq: ["$user_id", new mongoose.Types.ObjectId(req.user._id)] },
                  ],
                },
              },
            },
          ],
          as: "userUsage",
        },
      },
      {
        $project: {
          max_amount: 1,
          min_amount: 1,
          bonus: 1,
          offer_code: 1,
          bonus_type: 1,
          title: 1,
          user_time: 1,
          type: 1,
          createdAt: 1,
          enddate: 1,
          description: 1,
          usedCount: { $size: "$userUsage" },
        },
      },
    ]);

    if (!offers || offers.length === 0) {
      return {
        message: "Offer Not Found",
        status: false,
        data: [],
      };
    }

    // ✅ Save fresh offers into Redis (always JSON.stringify)
    for (const offer of offers) {
      await redisPayment.redis.set(
        `offer:${offer._id}`,
        JSON.stringify(offer)
      );
    }

    return {
      message: "Offer Data from DB",
      status: true,
      data: offers,
    };
  } catch (error) {
    console.error("Get Offers Error:", error);
    return {
      status: false,
      message: "Get Offers failed.",
      error: error.message,
    };
  }
};

exports.getTiers = async (req) => {
  try {
    const REDIS_KEY = "tierbreakdown";
    const redisData = await redisMain.getkeydata(REDIS_KEY);

    if (
      redisData &&
      redisData.data &&
      Array.isArray(redisData.data) &&
      redisData.data.length > 0
    ) {
      return {
        status: true,
        message: "Tier data fetched from Redis",
        data: redisData.data,
      };
    }

    const tiers = await tierbreakdown
      .find()
      .sort({ minAmount: 1 })
      .lean();

    if (!tiers || tiers.length === 0) {
      return {
        status: false,
        message: "Tier data not found",
        data: [],
      };
    }

    const ONE_YEAR_TTL = 60 * 60 * 24 * 365;

    await redisMain.setkeydata(
      REDIS_KEY,
      { data: tiers },
      ONE_YEAR_TTL
    );

    return {
      status: true,
      message: "Tier data fetched from DB",
      data: tiers,
    };
  } catch (error) {
    console.error("getTiers error:", error);
    return {
      status: false,
      message: "Failed to fetch tier data",
    };
  }
};

exports.newRequestAddCash = async (req) => {
  try {
    console.log("wwwwwwwwwwwwwwwwwwwwwwwww");
    console.log("req.body", req.body);
    let { paymentmethod } = req.body;

    const hasUser = await userModel.findOne({ _id: req.user._id });
    console.log("hasUser", hasUser);
    if (!hasUser)
      return { message: "Failed", status: false, data: { txnid: 0 } };

    let offerId = "";
    const amount = Number(req.body.amount);

    // Handle Offer validation
    if (req.body.offerid && req.body.offerid !== "") {

      const offerData = await specialOfferModel.findOne({ _id: req.body.offerid });

      // Check if the offer is already used
      let alreadyUsedOffer = await appliedOfferModel.find({
        userid: req.user._id,
        offerid: mongoose.Types.ObjectId(req.body.offerid),
      });

      if (alreadyUsedOffer.length >= offerData.user_time) {
        return {
          status: false,
          message: "You have already used this offer.",
          data: {},
        }
      }

      if (offerData) {
        const minAmount = Number(offerData.min_amount);
        const maxAmount = Number(offerData.max_amount);

        if (amount >= minAmount && amount <= maxAmount) {
          offerId = req.body.offerid;
        } else {
          return {
            message: `Offer applies only for amounts between ₹${minAmount} and ₹${maxAmount}.`,
            status: false,
            data: {},
          };
        }
      } else {
        return {
          message: "Invalid offer code.",
          status: false,
          data: {},
        };
      }
    }

    // Generate unique txnid
    let randomStr = randomstring.generate({
      length: 8,
      charset: "alphabetic",
      capitalization: "uppercase",
    });
    const txnid = `${global.constant.APP_SHORT_NAME}_add_${Date.now()}${randomStr}`;

    let orderId;
    let checksum;
    let sessionId;
    let callbackUrl;

    // Handle Razorpay
    if (paymentmethod === "RazorPay") {
      const Razorpay = require("razorpay"); // ✅ Make sure this is at the top

      var instance = new Razorpay({
        key_id: global.constant.RAZORPAY_KEY_ID_LIVE,
        key_secret: global.constant.RAZORPAY_KEY_SECRET_LIVE,
      });

      console.log("instance", instance);

      const options = {
        amount: amount * 100, // ₹100 becomes 10000 paise
        currency: "INR",
        receipt: "rcp1",
      };

      const order = await instance.orders.create(options); // ✅ requires top-level `async` function
      console.log("order", order);
      orderId = order.id;
    }

    else if (paymentmethod === "PhonePe") {
      orderId = `${global.constant.APP_SHORT_NAME}${Date.now()}_${randomStr}`;
      // const orderId = uniqid();

      // callbackUrl = `https://localhost:3001/api/phonepe/callback/${orderId}`;
      // const data = {
      //   merchantId: 'M22K6D3WC5AWJ',
      //   // merchantId: 'PGTESTPAYUAT77',
      //   merchantTransactionId: orderId,
      //   merchantUserId: req.user._id,
      //   amount: amount * 100,
      //   callbackUrl: callbackUrl,
      //   mobile: hasUser.mobile,
      //   "redirectMode": "REDIRECT",
      //   paymentInstrument: {
      //     type: "PAY_PAGE"
      //   }
      // };

      // const payload = JSON.stringify(data);
      // const payloadMain = Buffer.from(payload).toString('base64');
      // const apiEndPoint = '/pg/v1/pay';
      // // const phonepeAppId = '14fa5465-f8a10-143f-8477-f986b8fcfde9';
      // const phonepeAppId = '277b175e-5ba1-493a-8127-3806e34862ba';
      // const saltIndex = 1;

      // const xVerify = sha256(payloadMain + apiEndPoint
      //     + phonepeAppId) + "###" + saltIndex

      // try {
      //   const prod_URL = 'https://api.phonepe.com/apis/hermes/pg/v1/pay';
      //   // const prod_URL = 'https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay';
      //   const options = {
      //     method: 'POST',
      //     url: prod_URL,
      //     headers: {
      //       accept: 'application/json',
      //       'Content-Type': 'application/json',
      //       'X-VERIFY': xVerify,
      //     },
      //     data: {
      //       request: payloadMain
      //     }
      //   };

      //   const response = await axios.request(options);

      //   console.log("-----------phonePeResponse------", response);
      //   console.log("-----------response.data.instrumentResponse------", response.data);
      // const callbackUrl = response.data.data.instrumentResponse.redirectInfo.url;

      // } catch (error) {
      //   console.error('Error in PhonePe API request:', error.response?.data || error.message);
      // }
    }
    else if (paymentmethod === "YesBank") {
      // const txnReference = uuidv4();
      const txnReference = `txn_${Date.now()}`;
      const timestamp = Math.floor(Date.now() / 1000); // Timestamp in seconds
      const requestId = `req_${timestamp}`;

      const requestData = {
        apiId: '20249',
        bankId: '2',
        subVPA: 'simranajmera22@ybl',
        txnReferance: `${txnReference}`, // Unique reference
        // txnReferance: `txn_${Date.now()}`, // Unique reference
        requestid: requestId, // Add requestId to the requestData
        timestamp: timestamp,
        txnNote: 'Txnnote',
        mobile: "9999999999",
        callbackUrl: '',
      };

      console.log('Generated txnReference:', requestData.txnReferance);
      let CLIENT_SECRET = '85a8e61db715f0444267cc8dc2ee6bbebf7e3171c88d02594d52b86edab6895d';
      const token = await generateToken(CLIENT_SECRET, requestId, timestamp, requestData);

      //   console.log("tokennnnnnnnnnnnnnnnnnn", token);
      try {
        sprintnxt.auth('+rCaNJ1y4xxwO4ZhDZRhASaeZZFQ1a+nU4TGRYocDIohc0iBYqbO8q4ELHVs0xlxnVEsiA9t1GyWjN/rlsIzdw/lxfjNY1+PznW3k2FtdBsvC9uxi8Us/Z/xoUcvyCWGz8jd1c7KHHDBrIJRgoFXJZ7QH8fZsoKujB89IC1/0xQ55S0m5A2naIFnSKxUgIX6');
        sprintnxt.auth('U1BSX05YVF3453340NTg=');
        sprintnxt.generateStaticQr({
          apiId: '20249',
          bankId: '2',
          subVPA: 'simranajmera22@ybl',
          txnReferance: `${txnReference}`,
          requestid: requestId, // Add requestId to the requestData
          timestamp: timestamp,
          txnNote: 'Txnnote',
          mobile: '9999999999',
          callbackUrl: '',
        }, {
          'Client-id': '=='
        })
          .then(({ data }) => console.log("dataaaaaaaaaaaaa", data))
          .catch(err => console.error(err));
        //         const response = await axios.post('https://uat.sprintnxt.in/services/api/v2/UPIService/UPI', requestData, {
        //             headers: {
        //                 'Client-id': "U1BSX05YVF91YXRfOTc3YThmYmJiY2VmNjU4Nw",
        //                 Token: `+rCaNJ1y4xxwO4ZhDZRhASaeZZFQ1a+nU4TGRYocDIohc0iBYqbO8q4ELHVs0xlxnVEsiA9t1GyWjN/rlsIzdw/lxfjNY1+PznW3k2FtdBsvC9uxi8Us/Z/xoUcvyCWGz8jd1c7KHHDBrIJRgoFXJZ7QH8fZsoKujB89IC1/
        // 0xQ55S0m5A2naIFnSKxUgIX6`,
        //                 accept: 'application/json',
        //                 'content-type': 'application/json',
        //             },
        //         });

        //         console.log('yesBANK---------Response:', response.data);
        return {
          status: true,
          data: response.data,
        };
      } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
        if (error.response && error.response.status === 422) {
          return {
            status: false,
            message: 'Transaction reference already exists. Please retry with a unique reference.',
          };
        }
        throw error;
      }

    } else if (paymentmethod === "CashFree") {
      // Handle CashFree
      const url = 'https://sandbox.cashfree.com/pg/orders';
      console.log(hasUser);
      const data = {
        order_amount: amount,
        order_currency: 'INR',
        customer_details: {
          customer_id: hasUser._id || "default_user_id",
          customer_name: hasUser.fullname || "Default Name",
          customer_email: hasUser.email || "default@example.com",
          customer_phone: hasUser.mobile ? `+91${hasUser.mobile}` : "+919876543210",
        },
        order_meta: {
          return_url: 'https://b8af79f41056.eu.ngrok.io?order_id=order_123'
        }
      };

      const headers = {
        'X-Client-Id': 'TEST101573077580fd4bc990b582f3f170375101',
        'X-Client-Secret': 'cfsk_ma_test_281dc7ad532a8e3292ef210362dda26f_d4b71d3d',
        'x-api-version': '2023-08-01',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      try {
        const response = await axios.post(url, data, { headers });
        console.log('Response:', response.data);
        orderId = response.data.order_id;
        sessionId = response.data.payment_session_id;
      } catch (error) {
        console.error('Error:', error);
        return {
          message: 'Error creating CashFree order',
          status: false,
          data: error.response?.data || error.message
        }
      }
    } else {
      let randomStrrr = randomstring.generate({
        length: 10,
        charset: "alphabetic",
        capitalization: "uppercase",
      });
      orderId = randomStrrr;
    }

    // Save payment process record
    let checkData = await depositModel.create({
      amount: req.body.amount,
      userid: req.user._id,
      paymentmethod: req.body.paymentmethod,
      orderid: orderId,
      // sessionId: sessionId,
      txnid: txnid,
      offerid: offerId,
      payment_type: global.constant.PAYMENT_TYPE.ADD_CASH,
    });

    return {
      message: "Order ID Generated",
      status: true,
      data: {
        order_id: checkData.orderid,
        txnid: txnid,
        // sessionId: sessionId,
        amount: amount
      },
    }
  } catch (error) {
    console.log('Error: ', error);
    return {
      status: false,
      message: 'Internal server error.'
    }
  }
}

function encrypt(text) {
  const algorithm = "aes-128-cbc";
  var authKey = "xLIHPmENPyy7Hcvi";
  var authIV = "p6DN9vHFlPgWBVNg";
  // var authKey = global.constant.SABPAISA_AUTHKEY;   
  // var authIV = global.constant.SABPAISA_AUTHIV;

  if (!authKey || !authIV) {
    throw new Error("Encryption key or IV is not defined");
  }
  let cipher = crypto.createCipheriv(algorithm, Buffer.from(authKey), authIV);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return encrypted.toString("base64");
}

exports.AddCashNewRequestKafka = async (req, res) => {
  try {
    console.log("-----------AddCashNewRequestKafka-----------", req.body);
    let { paymentmethod } = req.body;
    let hasUser = await redisUser.getUser(req.user._id);
    if (!hasUser) {

      let hasUser = await userModel.findOne({ _id: req.user._id });
      // let hasUser = await userModel.findOne({ mobile: 8875705044 });
      if (hasUser) {
        await redisUser.setUser(hasUser);
      }
    }

    if (!hasUser) {
      return { message: "Failed", status: false, data: { txnid: 0 } };
    }

    let offerId = "";
    const amount = Number(req.body.amount);

    // Handle Offer validation
    if (req.body.offerid && req.body.offerid !== "") {
      const offerData = await specialOfferModel.findOne({ _id: req.body.offerid });

      if (offerData) {
        const minAmount = Number(offerData.min_amount);
        const maxAmount = Number(offerData.max_amount);

        if (amount >= minAmount && amount <= maxAmount) {
          offerId = req.body.offerid;
        } else {
          return {
            message: `Offer applies only for amounts between ₹${minAmount} and ₹${maxAmount}.`,
            status: false,
            data: {},
          };
        }
      } else {
        return {
          message: "Invalid offer code.",
          status: false,
          data: {},
        };
      }
    }

    // Generate unique txnid
    let randomStr = randomstring.generate({
      length: 4,
      charset: "alphabetic",
      capitalization: "uppercase",
    });
    const txnid = `${global.constant.APP_SHORT_NAME}_add_${Date.now()}_${randomStr}`;

    let orderId;
    // let sessionId;
    let htmlContent;

    // Handle Razorpay
    if (paymentmethod === "RazorPay") {
      var instance = new Razorpay({
        key_id: global.constant.RAZORPAY_KEY_ID_TEST,
        key_secret: global.constant.RAZORPAY_KEY_SECRET_TEST,
      });

      var options = {
        amount: amount * 100, // amount in the smallest currency unit
        currency: "INR",
        receipt: "rcp1",
      };
      const order = await instance.orders.create(options);
      // console.log(order, "Razorpay Order Details");
      orderId = order.id;

    }
    else if (paymentmethod === "PhonePe") {
      orderId = `${global.constant.APP_SHORT_NAME}${Date.now()}${randomStr}`;
    } else if (paymentmethod === "CashFree") {
      orderId = `${global.constant.APP_SHORT_NAME}${Date.now()}${randomStr}`;
      const paymentLink = await createCashfreeOrder(amount, orderId);
      console.log("paymentLink", paymentLink);
      if (!paymentLink) {
        return {
          message: "Failed to create CashFree order",
          status: false,
          data: {}
        };
      }
      // return {
      //   message: "Order ID Generated",
      //   status: true,
      //   data: {
      //     payment_link: paymentLink,
      //     order_id: orderId,
      //     txnid: txnid,
      //     amount: amount
      //   },
      // }

      res.set('Content-Type', 'text/html');
      return res.send(paymentLink);

      // checkData.payment_link = paymentLink; // Save for tracking
    } else if (paymentmethod === "SabPaisa") {
      console.log("-----------sabpaisa-----------");
      const randomStrrr = randomstring.generate({
        length: 8,
        charset: "alphabetic",
        capitalization: "uppercase",
      });

      const timestamp = Date.now(); // current time in ms

      orderId = `SabPaisa_${timestamp}_${randomStrrr}`;
    } else if (paymentmethod === "WatchPay") {

      const paymentLink = await addDepositWithQatchpay(amount, txnid, hasUser);
      console.log("paymentLink", paymentLink);
      if (paymentLink.success == true && paymentLink?.watchpay_response?.respCode == "SUCCESS") {
        htmlContent = paymentLink?.watchpay_response?.payInfo;
        orderId = paymentLink?.watchpay_response?.orderNo;
      } else {
        return {
          message: "Failed. Please try again",
          status: false,
          data: {}
        };
      }

    }

    // Save payment process record
    let checkData = {
      _id: mongoose.Types.ObjectId(), // Unique MongoDB ObjectId
      amount: req.body.amount,
      userid: hasUser._id,
      paymentmethod: req.body.paymentmethod,
      orderid: orderId,
      // sessionId: sessionId,
      txnid: txnid,
      offerid: offerId,
      payment_type: global.constant.PAYMENT_TYPE.ADD_CASH,
      createdAt: new Date(),
      status: "pending"
    };

    await redisPayment.storePaymentInRedis(hasUser._id, checkData);
    sendToQueue('addcash-topic', { data: checkData });

    return {
      message: "Order ID Generated",
      status: true,
      data: {
        order_id: orderId,
        txnid: txnid,
        amount: amount,
        paymentLink: htmlContent
      },
    }
  } catch (error) {
    console.log('Error: ', error);
    return {
      status: false,
      message: 'Internal server error.'
    }
  }
}

const WATCHPAY_URL = 'https://api.watchglb.com/pay/web'
const WATCHPAY_PAYMENT_KEY = global.constant.WATCHPAY_PAYMENT_KEY;  // your merchant key
const WATCHPAY_MERCHANT_KEY = global.constant.WATCHPAY_MERCHANT_KEY;  // your merchant key

// ========== Generate MD5 Sign ==========
async function generateMD5Sign(signStr, key) {
  return crypto
    .createHash("md5")
    .update(signStr + "&key=" + key)
    .digest("hex");
}
async function addDepositWithQatchpay(amount, orderId, user) {
  try {
    const notify_url = global.constant.CALLBACK_URL;
    const pay_type = 101;
    const version = "1.0";
    const trade_amount = amount.toString();
    const order_date = new Date().toISOString().slice(0, 19).replace("T", " ");
    // =====================
    // Build SIGN STRING
    // =====================
    const signStr =
      `goods_name=${user.team}` +
      `&mch_id=${WATCHPAY_MERCHANT_KEY}` +
      `&mch_order_no=${orderId}` +
      `&notify_url=${notify_url}` +
      `&order_date=${order_date}` +
      `&pay_type=${pay_type}` +
      `&trade_amount=${trade_amount}` +
      `&version=${version}`;
    const sign = await generateMD5Sign(signStr, WATCHPAY_PAYMENT_KEY);

    const postData = {
      goods_name: user.team,
      mch_id: WATCHPAY_MERCHANT_KEY,
      mch_order_no: orderId,
      notify_url,
      order_date,
      pay_type,
      trade_amount,
      version,                         // FIXED
      sign_type: "MD5",
      sign
    };
    // Call WatchPay API
    const response = await axios.post(WATCHPAY_URL,
      new URLSearchParams(postData).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    // console.log('response', response);
    const resp = response.data;

    return {
      success: true,
      request_payload: postData,
      watchpay_response: resp
    };
  } catch (error) {
    console.log('Error: ', error);
    return {
      status: false,
      message: 'Internal server error.'
    }
  }
}

async function createCashfreeOrder(amount, orderId) {
  try {
    const payload = {
      order_id: orderId,
      order_amount: amount,
      order_currency: "INR",
      customer_details: {
        customer_id: "CUST123",
        customer_name: "John Doe",
        customer_email: "john@example.com",
        customer_phone: "9999999999"
      }
    };

    const cfResponse = await axios.post(
      "https://sandbox.cashfree.com/pg/orders",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "x-client-id": "TEST10749374869961944771132a3a0247394701",
          "x-client-secret": "cfsk_ma_test_dfb89ccc211ea6a4f48cdc480b790ceb_f9175651",
          "x-api-version": "2022-09-01"
        }
      }
    );

    const paymentSessionId = cfResponse.data.payment_session_id;

    // Return HTML string instead of sending via res
    return `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Cashfree Checkout</title>
          <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
      </head>
      <body>
          <script>
              const cashfree = Cashfree({ mode: "sandbox" });
              window.onload = function() {
                  cashfree.checkout({
                      paymentSessionId: "${paymentSessionId}",
                      redirectTarget: "_self",
                      style: { theme: { color: "#FF5733" } }
                  });
              };
          </script>
      </body>
      </html>`;
  } catch (error) {
    console.error("Cashfree Order Error:", error.response?.data || error.message);
    throw error;
  }
}


// exports.AddCashNewRequestKafka = async(req) => {
//   try {
//     console.log("-----------AddCashNewRequestKafka-----------", req.body);
//     let { paymentmethod } = req.body;
//     // let hasUser = await redisUser.getUser(req.user._id);

//     // if (!hasUser) {
//      let hasUser = await userModel.findOne({ _id: req.user._id });

//     //   if (hasUser) {
//     //     await redisUser.setUser(hasUser); 
//     //   }
//     // }

//     if (!hasUser) {
//       return { message: "Failed", status: false, data: { txnid: 0 } };
//     }

//     let offerId = "";
//     const amount = Number(req.body.amount);

//     // Handle Offer validation
//     if (req.body.offerid && req.body.offerid !== "") {
//       const offerData = await specialOfferModel.findOne({ _id: req.body.offerid });

//       if (offerData) {
//           const minAmount = Number(offerData.min_amount);
//           const maxAmount = Number(offerData.max_amount);

//           if (amount >= minAmount && amount <= maxAmount) {
//               offerId = req.body.offerid;
//           } else {
//               return {
//                   message: `Offer applies only for amounts between ₹${minAmount} and ₹${maxAmount}.`,
//                   status: false,
//                   data: {},
//               };
//           }
//       } else {
//           return {
//               message: "Invalid offer code.",
//               status: false,
//               data: {},
//           };
//       }
//     }      

//     // Generate unique txnid
//     let randomStr = randomstring.generate({
//       length: 4,
//       charset: "alphabetic",
//       capitalization: "uppercase",
//     });
//     const txnid = `${global.constant.APP_SHORT_NAME}_add_${Date.now()}_${randomStr}`;

//     let orderId;
//     // let sessionId;
//     let htmlContent;

//     // Handle Razorpay
//     if (paymentmethod === "RazorPay") {
//       var instance = new Razorpay({
//         key_id: global.constant.RAZORPAY_KEY_ID_LIVE,
//         key_secret: global.constant.RAZORPAY_KEY_SECRET_LIVE,
//       });

//       var options = {
//         amount: amount * 100, // amount in the smallest currency unit
//         currency: "INR",
//         receipt: "rcp1",
//       };
//       const order = await instance.orders.create(options);
//       // console.log(order, "Razorpay Order Details");
//       orderId = order.id;

//     }
//     else if (paymentmethod === "PhonePe") {
//       orderId = `${global.constant.APP_SHORT_NAME}${Date.now()}${randomStr}`;
//     }
//     else if (paymentmethod === "YesBank") {
//       // const txnReference = uuidv4();
//       const txnReference = `txn_${Date.now()}`;
//       const timestamp = Math.floor(Date.now() / 1000); // Timestamp in seconds
//       const requestId = `req_${timestamp}`;

//       const requestData = {
//         apiId: '20249',
//         bankId: '2',
//         subVPA: 'simranajmera22@ybl',
//         txnReferance: `${txnReference}`, // Unique reference
//         // txnReferance: `txn_${Date.now()}`, // Unique reference
//         requestid: requestId, // Add requestId to the requestData
//         timestamp: timestamp,
//         txnNote: 'Txnnote',
//         mobile: "9999999999",
//         callbackUrl: '',
//       };

//       // console.log('Generated txnReference:', requestData.txnReferance);
//       let CLIENT_SECRET = '85a8e61db715f0444267cc8dc2ee6bbebf7e3171c88d02594d52b86edab6895d';
//       const token = await generateToken(CLIENT_SECRET, requestId, timestamp, requestData);

//     //   console.log("tokennnnnnnnnnnnnnnnnnn", token);
//       try {
//         sprintnxt.auth('+rCaNJ1y4xxwO4ZhDZRhASaeZZFQ1a+nU4TGRYocDIohc0iBYqbO8q4ELHVs0xlxnVEsiA9t1GyWjN/rlsIzdw/lxfjNY1+PznW3k2FtdBsvC9uxi8Us/Z/xoUcvyCWGz8jd1c7KHHDBrIJRgoFXJZ7QH8fZsoKujB89IC1/0xQ55S0m5A2naIFnSKxUgIX6');
//         sprintnxt.auth('U1BSX05YVF3453340NTg=');
//         sprintnxt.generateStaticQr({
//           apiId: '20249',
//           bankId: '2',
//           subVPA: 'simranajmera22@ybl',
//           txnReferance: `${txnReference}`,
//           requestid: requestId, // Add requestId to the requestData
//           timestamp: timestamp,
//           txnNote: 'Txnnote',
//           mobile: '9999999999',
//           callbackUrl: '',
//         }, {
//           'Client-id': 'U1BSX05YVF91YXRfOTc3YThmYmJiY2VmNjU4Nw=='
//         })
//           .then(({ data }) => console.log("dataaaaaaaaaaaaa", data))
//           .catch(err => console.error(err));
//         //         const response = await axios.post('https://uat.sprintnxt.in/services/api/v2/UPIService/UPI', requestData, {
//         //             headers: {
//         //                 'Client-id': "U1BSX05YVF91YXRfOTc3YThmYmJiY2VmNjU4Nw",
//         //                 Token: `+rCaNJ1y4xxwO4ZhDZRhASaeZZFQ1a+nU4TGRYocDIohc0iBYqbO8q4ELHVs0xlxnVEsiA9t1GyWjN/rlsIzdw/lxfjNY1+PznW3k2FtdBsvC9uxi8Us/Z/xoUcvyCWGz8jd1c7KHHDBrIJRgoFXJZ7QH8fZsoKujB89IC1/
//         // 0xQ55S0m5A2naIFnSKxUgIX6`,
//         //                 accept: 'application/json',
//         //                 'content-type': 'application/json',
//         //             },
//         //         });

//         //         console.log('yesBANK---------Response:', response.data);
//         return {
//           status: true,
//           data: response.data,
//         };
//       } catch (error) {
//         console.error('Error:', error.response ? error.response.data : error.message);
//         if (error.response && error.response.status === 422) {
//           return {
//             status: false,
//             message: 'Transaction reference already exists. Please retry with a unique reference.',
//           };
//         }
//         throw error;
//       }

//     } else if (paymentmethod === "CashFree") {
//       // Handle CashFree
//       // const url = 'https://sandbox.cashfree.com/pg/orders';
//       // console.log(hasUser);
//       // const data = {
//       //   order_amount: amount,
//       //   order_currency: 'INR',
//       //   customer_details: {
//       //     customer_id: hasUser._id || "default_user_id",
//       //     customer_name: hasUser.fullname || "Default Name",
//       //     customer_email: hasUser.email || "default@example.com",
//       //     customer_phone: hasUser.mobile ? `+91${hasUser.mobile}` : "+919876543210",
//       //   },
//       //   order_meta: {
//       //     return_url: 'https://b8af79f41056.eu.ngrok.io?order_id=order_123'
//       //   }
//       // };

//       // const headers = {
//       //   'X-Client-Id': 'TEST101573077580fd4bc990b582f3f170375101',
//       //   'X-Client-Secret': 'cfsk_ma_test_281dc7ad532a8e3292ef210362dda26f_d4b71d3d',
//       //   'x-api-version': '2023-08-01',
//       //   'Content-Type': 'application/json',
//       //   'Accept': 'application/json'
//       // };

//       // try {
//       //   const response = await axios.post(url, data, { headers });
//       //   console.log('Response:', response.data);
//       //   orderId = response.data.order_id;
//       //   sessionId = response.data.payment_session_id;
//       // } catch (error) {
//       //   console.error('Error:', error);
//       //   return {
//       //     message: 'Error creating CashFree order',
//       //     status: false,
//       //     data: error.response?.data || error.message
//       //   }
//       // }
//     } else if (paymentmethod === "SabPaisa") {
//       console.log("-----------sabpaisa-----------");
//       const randomStrrr = randomstring.generate({
//           length: 8,
//           charset: "alphabetic",
//           capitalization: "uppercase",
//       });

//       const timestamp = Date.now(); // current time in ms

//       orderId = `SabPaisa_${timestamp}_${randomStrrr}`;

//       // let callbackUrl2 = "";
//       // if(process.env.secretManager == "prod"){
//       //     callbackUrl2 = ""
//       // }

//       // console.log("hasUser", hasUser);

//       // var payerName = hasUser.username;
//       // var payerEmail = hasUser.email;
//       // var payerMobile = hasUser.mobile;
//       // var clientTxnId = orderId;
//       // var clientCode = "VIKR89";    // Please use the credentials shared by your Account   Manager  If not, please contact your Account Manage
//       // var transUserName = "admin_17889";      // Please use the credentials shared by your Account   Manager  If not, please contact your Account Manage
//       // var transUserPassword = "VIKR89_SP17889";   // Please use the credentials shared by your   Account Manager  If not, please contact your Account Manage
//       // // var clientCode = global.constant.SABPAISA_CLIENTCODE;       // Please use the credentials shared by your Account   Manager  If not, please contact your Account Manage
//       // // var transUserName = global.constant.SABPAISA_TRANS_USERNAME;      // Please use the credentials shared by your Account   Manager  If not, please contact your Account Manage
//       // // var transUserPassword = global.constant.SABPAISA_TRANS_USER_PASSWORD;   // Please use the credentials shared by your   Account Manager  If not, please contact your Account Manage
//       // const callbackUrl = callbackUrl2;
//       // const channelId = "W";
//       // const spURL = "https://securepay.sabpaisa.in/SabPaisa/sabPaisaInit?v=1"; // Staging   environment

//       // var mcc = "5666";
//       // var transData = new Date();

//       // var stringForRequest =
//       //   "payerName=" +
//       //   payerName +
//       //   "&payerEmail=" +
//       //   payerEmail +
//       //   "&payerMobile=" +
//       //   payerMobile +
//       //   "&clientTxnId=" +
//       //   clientTxnId +
//       //   "&amount=" +
//       //   amount +
//       //   "&clientCode=" +
//       //   clientCode +
//       //   "&transUserName=" +
//       //   transUserName +
//       //   "&transUserPassword=" +
//       //   transUserPassword +
//       //   "&callbackUrl=" +
//       //   callbackUrl +
//       //   "&channelId=" +
//       //   channelId +
//       //   "&mcc=" +
//       //   mcc +
//       //   "&transData=" +
//       //   transData;

//       // console.log("stringForRequest :: " + stringForRequest);

//       // var encryptedStringForRequest = encrypt(stringForRequest);
//       // console.log("encryptedStringForRequest :: " + encryptedStringForRequest);

//       // const formData = {
//       //   spURL: spURL,
//       //   encData: encryptedStringForRequest,
//       //   clientCode: clientCode,
//       // };

//       // htmlContent = `
//       //   <!DOCTYPE html>
//       //   <html>
//       //   <head>
//       //       <title>Redirecting...</title>
//       //   </head>
//       //   <body onload="document.forms[0].submit();">
//       //       <form method="POST" action="${formData.spURL}">
//       //           <input type="hidden" name="encData" value="${formData.encData}" />
//       //           <input type="hidden" name="clientCode" value="${formData.clientCode}" />
//       //       </form>
//       //       <p>Redirecting to payment...</p>
//       //   </body>
//       //   </html>
//       // `;

//       // // Save payment process record
//       // let checkData = {
//       //   amount: req.body.amount,
//       //   userid: req.user._id,
//       //   paymentmethod: req.body.paymentmethod,
//       //   orderid: orderId,
//       //   sessionId: sessionId,
//       //   txnid: txnid,
//       //   offerid: offerId,
//       //   payment_type: global.constant.PAYMENT_TYPE.ADD_CASH,
//       // };

//       // sendToQueue('addcash-topic', {data: checkData});

//       // console.log("htmlContent", htmlContent);
//       // console.log("orderId", orderId);

//       // return { 
//       //   status: true, 
//       //   message: "SabPaisa Order ID Generated", 
//       //   data: { htmlContent: htmlContent, order_id: orderId } };
//     }

//     // Save payment process record
//     let checkData = {
//       _id: mongoose.Types.ObjectId(), // Unique MongoDB ObjectId
//       amount: req.body.amount,
//       userid: req.user._id,
//       paymentmethod: req.body.paymentmethod,
//       orderid: orderId,
//       // sessionId: sessionId,
//       txnid: txnid,
//       offerid: offerId,
//       payment_type: global.constant.PAYMENT_TYPE.ADD_CASH,
//       createdAt: new Date(),
//       status: "pending"
//     };

//     await redisPayment.storePaymentInRedis(req.user._id, checkData);
//     sendToQueue('addcash-topic', {data: checkData});

//     return {
//       message: "Order ID Generated",
//       status: true,
//       data: {
//         order_id: orderId,
//         txnid: txnid,
//         amount: amount
//       },
//     }
//   } catch (error) {
//       console.log('Error: ', error);
//       return {
//           status: false,
//           message: 'Internal server error.'
//       }
//   }
// }

exports.cashfreePayment = async (req, res) => {
  const lang = req.headers['accept-language'] || 'en';
  const { payment_session_id } = req.query;

  try {
    const embedHtml = `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Cashfree Checkout Integration</title>
            <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
        </head>
        <body>
            <script>
                const cashfree = Cashfree({
                    mode: "${CASHFREE_MODE}", // Change to "prod" for live transactions
                });

                window.onload = function() {
                    let checkoutOptions = {
                        paymentSessionId: "${payment_session_id}",
                        redirectTarget: "_self",
                        style: {
                        theme: {
                            color: "#FF5733" // Set the desired color here (hex, rgb, etc.)
                        }
                    }
                    };
                    cashfree.checkout(checkoutOptions);
                };
            </script>
        </body>
        </html>`;

    res.set('Content-Type', 'text/html');
    return res.send(embedHtml);
  } catch (error) {
    return {
      message: messages.generalError[lang],
      status: false,
      data: { message: error.message || '' }
    }
  }
};

exports.cashfreePaymentVerify = async (req, res) => {
  const data = req.body;
  const newWebhookData = new Cashfreewebhook({ data });
  await newWebhookData.save();
  const updateData = {};
  switch (data.data.payment_status) {
    case "SUCCESS":
      const orderData = await Order.findOne({
        trackId: data.data.order.order_id,
        payableAmount: data.data.order.order_amount,
        paymentStatus: "pending"
      });
      if (orderData) {
        const updateOrderData = {
          paymentId: data.data.cf_payment_id,
          paymentMode: data.data.payment_method.payment_group,
          payableAmount: data.data.payment_amount,
        };
        const vendorDetails = await Vendor.aggregate([
          {
            $match: {
              _id: new mongoose.Types.ObjectId(orderData.vendorId)
            }
          },
          {
            $lookup: {
              from: "types",
              localField: "vendorType",
              foreignField: "_id",
              as: "vendorType"
            }
          },
          {
            $unwind: "$vendorType"
          }
        ]);
        if (data.data.payment_status === 'SUCCESS' && orderData.payableAmount === data.data.payment_amount) {
          updateOrderData.paymentStatus = 'success';
          if (vendorDetails[0].vendorType.name == "Food") {
            updateOrderData.status = 'Pending';
          } else {
            updateOrderData.status = 'Accepted';
          }
          await Cart.findOneAndDelete({ userId: orderData.userId });
        } else {
          updateOrderData.paymentStatus = 'failed';
        }
        const orderDetails = await Order.findByIdAndUpdate(orderData._id, updateOrderData, { new: true });
        if (updateOrderData.paymentStatus === 'success') {
          const vendorSocketId = await getRedis(redisKeyPrefixVendorSocket + orderData.vendorId.toString());
          io.to(vendorSocketId).emit('orderReceived', orderDetails);
          const appType = 'vendor';
          const message = {
            title: '📦 New Order Received!',
            body: 'Please review and prepare the order for delivery!'
          };
          const registrationToken = vendorDetails[0].fcmToken;
          sendNotification(registrationToken, message, appType);
        }
        const responseMessage = updateOrderData.paymentStatus === 'success'
          ? 'Payment verified successfully'
          : 'Payment verification failed';

        return {
          status: updateOrderData.paymentStatus === 'success',
          message: responseMessage
        };
      }
      break;

    case "FAILED":
      const droppedOrderData = await Order.findOne({
        trackId: data.data.order.order_id,
        paymentStatus: "pending"
      });
      if (droppedOrderData) {
        const updateDroppedOrderData = {
          paymentId: data.data.cf_payment_id,
          paymentMode: data.data.payment_method.payment_group,
          payableAmount: data.data.payment_amount,
          paymentStatus: 'failed'
        };
        await Order.findByIdAndUpdate(droppedOrderData._id, updateDroppedOrderData, { new: true });
        const responseMessage = 'Payment verification failed';
        return {
          status: false,
          message: responseMessage
        };
      }
      break;

    default:
      console.warn('Unhandled webhook type:', data.type);
      return {
        status: false,
        message: 'Unhandled webhook type'
      };
  }
};

exports.sabPaisaCallback = async (req) => {
  try {
    console.log("-----------sabPaisaCallback------------", req.body);

    let txnid = req.body.txnid;
    let orderid = req.body.orderid;

    const paymentData = await depositModel.findOne({ orderid: orderid, status: global.constant.PAYMENT_STATUS_TYPES.PENDING });
    console.log("paymentData", paymentData);

    // await razorpayLogsModel.create({
    //   userid: paymentData.userid,
    //   txnid: paymentData.txnid,
    //   amount: paymentData.amount,
    //   status: "PAYMENT_SUCCESS",
    //   data: paymentEntity,
    // });

    if (!paymentData) {
      return { status: false, message: "Transaction not found" };
    }

    let paymentDataRedis = await redisPayment.getTDSdata(paymentData.userid);

    if (req.body.status == "SUCCESS") {
      const addAmount = paymentData.amount;
      const appSettingData = await redisMain.getkeydata("appSettingData");
      let gstAmount = 0;

      if (appSettingData?.gst == 1) {
        gstAmount = ((21.88 / 100) * addAmount).toFixed(2);
      }

      const amountWithGst = addAmount - gstAmount;
      const userWalletKey = `wallet:{${paymentData.userid}}`;
      let userBalance = await redisUser.redis.hgetall(userWalletKey);

      if (!userBalance) {
        await redisUser.setDbtoRedisWallet(paymentData.userid);
        userBalance = await redisUser.redis.hgetall(userWalletKey);
      }

      const transactionObj = {
        txnid: txnid,
        transaction_id: txnid,
        type: "Cash added",
        transaction_type: "Credit",
        amount: amountWithGst,
        userid: paymentData.userid,
        paymentstatus: "success",
        paymentmethod: paymentData.paymentmethod,
        utr: "",
        gst_amount: gstAmount,
      };

      await redisUser.saveTransactionToRedis(paymentData.userid, {
        balance: Number(userBalance.balance || 0) + Number(amountWithGst),
      }, transactionObj);

      const randomStr = randomstring.generate({ length: 8, charset: "alphabetic", capitalization: "uppercase" });
      let expiresAt = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);

      if (process.env.secretManager === "dev") {
        expiresAt = new Date(Date.now() + 2 * 60 * 1000);
      }

      const gstTxnId = `CASHBACK-GST-${Date.now()}-${randomStr}`;
      const bonusObj = {
        txnid: gstTxnId,
        transaction_id: gstTxnId,
        type: "Bonus",
        transaction_type: "Credit",
        userid: paymentData.userid,
        amount: gstAmount,
        expiresAt: moment(expiresAt).format("YYYY-MM-DD HH:mm:ss"),
      };

      await redisUser.saveTransactionToRedis(paymentData.userid, {
        bonus: Number(userBalance.bonus || 0) + Number(gstAmount),
      }, bonusObj);

      console.log("amountWithGst", amountWithGst);
      console.log("gstAmount", gstAmount);

      const updatedUser = await userModel.findOneAndUpdate(
        { _id: paymentData.userid },
        { $inc: { "userbalance.balance": amountWithGst, "userbalance.bonus": Number(gstAmount) } },
        { new: true }
      );

      if (gstAmount > 0) {
        await gstModel.create({
          gstAmount,
          totalAmount: amountWithGst,
          userid: updatedUser._id,
        });

        const cashbackData = await cashbackModel.create({
          userid: updatedUser._id,
          bonus: gstAmount,
          type: "gst",
          transaction_id: paymentData.txnid,
          deposit_id: paymentData._id,
          expiresAt: expiresAt,
        });

        if (cashbackData) {
          await this.addAmountTransaction(updatedUser, gstAmount, "Bonus", "bonus", gstTxnId);
        }
      }

      let processedPayment = await depositModel.findOneAndUpdate(
        { orderid: orderid },
        {
          status: "SUCCESS",
          pay_id: "N/A",
          utr: "",
          gst_amount: gstAmount,
          bonus_txn: gstTxnId,
        },
        { new: true }
      );

      await this.addAmountTransaction(updatedUser, amountWithGst, "Cash added", "fund", txnid);

      // ✅ Offer Bonus Section
      if (paymentData.offerid) {

        const offerKey = `offer:${paymentData.offerid}`;
        const usedOfferKey = `used_offer:${paymentData.userid}:${paymentData.offerid}`;

        let offer = redisPayment.getkeydata(offerKey);
        if (!offer) {
          offer = await specialOfferModel.findOne({ _id: mongoose.Types.ObjectId(paymentData.offerid) }).lean();
          if (offer) {
            await redisPayment.setkeydata(offerKey, offer); // Cache it
          }
        }

        if (offer) {
          let alreadyUsed = await redisPayment.getkeydata(usedOfferKey);
          console.log("Used offer from Redis:", alreadyUsed);

          if (alreadyUsed === null) {
            alreadyUsed = await appliedOfferModel.countDocuments({
              user_id: paymentData.userid,
              offer_id: paymentData.offerid,
            });
            console.log("Used offer from DB:", alreadyUsed);

            await redisPayment.setkeydata(usedOfferKey, alreadyUsed);
            console.log("Cached used offer in Redis");
          }

          alreadyUsed = parseInt(alreadyUsed);

          if (alreadyUsed < offer.user_time) {
            const bonusAmount =
              offer.offer_type === "flat"
                ? offer.bonus
                : (paymentData.amount * (offer.bonus / 100));

            const bonusField = offer.type === "rs" ? "balance" : "bonus";
            const bonusPath = `userbalance.${bonusField}`;

            console.log(`Applying bonus of ${bonusAmount} to field: ${bonusPath}`);

            const updatedUserOffer = await userModel.findOneAndUpdate(
              { _id: paymentData.userid },
              { $inc: { [bonusPath]: bonusAmount } },
              { new: true }
            );

            const transaction_id_offer = `${global.constant.APP_SHORT_NAME}-OFFER-${Date.now()}`;

            const walletUpdateOffer = {
              [bonusField]: Number(userBalance?.[bonusField] || 0) + Number(bonusAmount),
            };

            const offerObj = {
              txnid: transaction_id_offer,
              transaction_id: transaction_id_offer,
              transaction_type: "Credit",
              userid: paymentData.userid,
              type: "Offer bonus",
              amount: bonusAmount,
            };

            await redisUser.saveTransactionToRedis(paymentData.userid, walletUpdateOffer, offerObj);
            console.log("Saved transaction to Redis");

            await this.addAmountTransaction(
              updatedUserOffer,
              bonusAmount,
              "Offer bonus",
              "bonus",
              transaction_id_offer
            );
            console.log("Added amount transaction to DB");

            await appliedOfferModel.create({
              user_id: paymentData.userid,
              offer_id: paymentData.offerid,
              transaction_id_offer,
            });
            console.log("Saved used offer to DB");

            await redisPayment.incr(usedOfferKey);
            console.log("Incremented used offer in Redis");
          } else {
            console.log("Offer usage limit reached");
          }
        }


        // const alreadyUsed = await appliedOfferModel.countDocuments({
        //   user_id: paymentData.userid,
        //   offer_id: paymentData.offerid,
        // });

        // if (alreadyUsed < offer.user_time) {
        //   const bonusAmount = offer.offer_type === "flat"
        //     ? offer.bonus
        //     : (paymentData.amount * (offer.bonus / 100));

        //   const bonusField = offer.type === "rs" ? "userbalance.balance" : "userbalance.bonus";

        //   const updatedUserOffer = await userModel.findOneAndUpdate(
        //     { _id: paymentData.userid },
        //     { $inc: { [bonusField]: bonusAmount } },
        //     { new: true }
        //   );

        //   const transaction_id_offer = `${global.constant.APP_SHORT_NAME}-OFFER-${Date.now()}`;

        //   const walletUpdateOffer = {
        //     bonus: Number(userBalance.bonus || 0) + Number(bonusAmount),
        //   };

        //   const offerObj = {
        //     txnid: transaction_id_offer,
        //     transaction_id: transaction_id_offer,
        //     transaction_type: "Credit",
        //     userid: paymentData.userid,
        //     type: "Offer bonus",
        //     amount: bonusAmount,
        //   };

        //   await redisUser.saveTransactionToRedis(paymentData.userid, walletUpdateOffer, offerObj);
        //   await this.addAmountTransaction(updatedUserOffer, bonusAmount, "Offer bonus", "bonus", transaction_id_offer);
        //   await appliedOfferModel.create({
        //     user_id: paymentData.userid,
        //     offer_id: paymentData.offerid,
        //     transaction_id_offer,
        //   });
        // }
      }
      // end offer

      // let depositKey = `userid:${paymentData.userid}-deposit:${processedPayment._id}`;
      // await redisPayment.redis.hset(depositKey, processedPayment);

      await redisPayment.updatedPaymentData(paymentData.userid, processedPayment);

      let tdsWallet = {
        ...paymentDataRedis,
        successPayment: Number(paymentDataRedis.successPayment || 0) + Number(paymentData.amount || 0)
      };

      await redisPayment.updateTDSdata(paymentData.userid, tdsWallet);

      return { status: true, message: "Payment processed successfully" };

    } else if (req.body.status == "null") {
      await depositModel.findOneAndUpdate(
        { orderid: orderid },
        {
          status: "FAILED",
          pay_id: "N/A"
        }
      );
      return { status: false, message: `Payment ${req.body.status}.` };
    } else {
      await depositModel.findOneAndUpdate(
        { orderid: orderid },
        {
          status: req.body.status,
          pay_id: "N/A"
        }
      );
      return { status: false, message: `Payment ${req.body.status}.` };
    }


  } catch (error) {
    console.log('Error: ', error);
    return {
      status: false,
      message: 'Internal server error.'
    }
  }
}

// Live
// exports.sabPaisaCallback = async(req) => {
//     try {
//       console.log("-----------sabPaisaCallback------------", req.body);

//       let txnid = req.body.txnid;
//       let orderid = req.body.orderid;

//       const paymentData = await depositModel.findOne({ orderid: orderid, status: global.constant.PAYMENT_STATUS_TYPES.PENDING });

//       // await razorpayLogsModel.create({
//       //   userid: paymentData.userid,
//       //   txnid: paymentData.txnid,
//       //   amount: paymentData.amount,
//       //   status: "PAYMENT_SUCCESS",
//       //   data: paymentEntity,
//       // });

//       if (!paymentData) {
//         return { status: false, message: "Transaction not found" };
//       }

//       if(req.body.status == "SUCCESS") {
//         const addAmount = paymentData.amount;
//         const appSettingData = await redisMain.getkeydata("appSettingData");
//         let gstAmount = 0;

//         if (appSettingData?.gst == 1) {
//           gstAmount = ((21.88 / 100) * addAmount).toFixed(2);
//         }

//         const amountWithGst = addAmount - gstAmount;
//         const userWalletKey = `wallet:{${paymentData.userid}}`;
//         let userBalance = await redisUser.redis.hgetall(userWalletKey);

//         if (!userBalance) {
//           await redisUser.setDbtoRedisWallet(paymentData.userid);
//           userBalance = await redisUser.redis.hgetall(userWalletKey);
//         }

//         const transactionObj = {
//           txnid: txnid,
//           transaction_id: txnid,
//           type: "Cash added",
//           transaction_type: "Credit",
//           amount: amountWithGst,
//           userid: paymentData.userid,
//           paymentstatus: "success",
//           paymentmethod: paymentData.paymentmethod,
//           utr: "",
//           gst_amount: gstAmount,
//         };

//         await redisUser.saveTransactionToRedis(paymentData.userid, {
//           balance: Number(userBalance.balance || 0) + Number(amountWithGst),
//         }, transactionObj);

//         const randomStr = randomstring.generate({ length: 8, charset: "alphabetic", capitalization: "uppercase" });
//         let expiresAt = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);

//         if (process.env.secretManager === "dev") {
//           expiresAt = new Date(Date.now() + 2 * 60 * 1000);
//         }

//         const gstTxnId = `CASHBACK-GST-${Date.now()}-${randomStr}`;
//         const bonusObj = {
//           txnid: gstTxnId,
//           transaction_id: gstTxnId,
//           type: "Bonus",
//           transaction_type: "Credit",
//           userid: paymentData.userid,
//           amount: gstAmount,
//           expiresAt: moment(expiresAt).format("YYYY-MM-DD HH:mm:ss"),
//         };

//         await redisUser.saveTransactionToRedis(paymentData.userid, {
//           bonus: Number(userBalance.bonus || 0) + Number(gstAmount),
//         }, bonusObj);

//         console.log("amountWithGst", amountWithGst);
//         console.log("gstAmount", gstAmount);

//         const updatedUser = await userModel.findOneAndUpdate(
//           { _id: paymentData.userid },
//           { $inc: { "userbalance.balance": amountWithGst, "userbalance.bonus": Number(gstAmount) } },
//           { new: true }
//         );

//         if (gstAmount > 0) {
//           await gstModel.create({
//             gstAmount,
//             totalAmount: amountWithGst,
//             userid: updatedUser._id,
//           });

//           const cashbackData = await cashbackModel.create({
//             userid: updatedUser._id,
//             bonus: gstAmount,
//             type: "gst",
//             transaction_id: paymentData.txnid,
//             deposit_id: paymentData._id,
//             expiresAt: expiresAt,
//           });

//           if (cashbackData) {
//             await this.addAmountTransaction(updatedUser, gstAmount, "Bonus", "bonus", gstTxnId);
//           }
//         }

//         await depositModel.findOneAndUpdate(
//           { orderid: orderid },
//           {
//             status: "SUCCESS",
//             pay_id: "N/A",
//             utr: "",
//             gst_amount: gstAmount,
//             bonus_txn: gstTxnId,
//           },
//           { new: true }
//         );

//         await this.addAmountTransaction(updatedUser, amountWithGst, "Cash added", "fund", txnid);

//         // ✅ Offer Bonus Section
//         if (paymentData.offerid) {
//           const offer = await specialOfferModel.findOne({ _id: mongoose.Types.ObjectId(paymentData.offerid) });

//           const alreadyUsed = await appliedOfferModel.countDocuments({
//             user_id: paymentData.userid,
//             offer_id: paymentData.offerid,
//           });

//           if (alreadyUsed < offer.user_time) {
//             const bonusAmount = offer.offer_type === "flat"
//               ? offer.bonus
//               : (paymentData.amount * (offer.bonus / 100));

//             const bonusField = offer.type === "rs" ? "userbalance.balance" : "userbalance.bonus";

//             const updatedUserOffer = await userModel.findOneAndUpdate(
//               { _id: paymentData.userid },
//               { $inc: { [bonusField]: bonusAmount } },
//               { new: true }
//             );

//             const transaction_id_offer = `${global.constant.APP_SHORT_NAME}-OFFER-${Date.now()}`;

//             const walletUpdateOffer = {
//               bonus: Number(userBalance.bonus || 0) + Number(bonusAmount),
//             };

//             const offerObj = {
//               txnid: transaction_id_offer,
//               transaction_id: transaction_id_offer,
//               transaction_type: "Credit",
//               userid: paymentData.userid,
//               type: "Offer bonus",
//               amount: bonusAmount,
//             };

//             await redisUser.saveTransactionToRedis(paymentData.userid, walletUpdateOffer, offerObj);
//             await this.addAmountTransaction(updatedUserOffer, bonusAmount, "Offer bonus", "bonus", transaction_id_offer);
//             await appliedOfferModel.create({
//               user_id: paymentData.userid,
//               offer_id: paymentData.offerid,
//               transaction_id_offer,
//             });
//           }
//         }

//         return { status: true, message: "Payment processed successfully" };

//       } else if (req.body.status == "null") {
//         await depositModel.findOneAndUpdate(
//           { orderid: orderid },
//           {
//             status: "FAILED",
//             pay_id: "N/A"
//           }
//         );
//         return { status: false, message: `Payment ${req.body.status}.`};
//       } else {
//         await depositModel.findOneAndUpdate(
//           { orderid: orderid },
//           {
//             status: req.body.status,
//             pay_id: "N/A"
//           }
//         );
//         return { status: false, message: `Payment ${req.body.status}.`};
//       }


//     } catch (error) {
//         console.log('Error: ', error);
//         return {
//             status: false,
//             message: 'Internal server error.'
//         }
//     }
// }

exports.sabPaisaCallbackWeb = async (data) => {
  try {
    data = JSON.parse(JSON.stringify(data));
    console.log("-----------sabPaisaCallback_Web------------");

    // let txnid = data.txnid;
    let orderid = data.clientTxnId;

    const paymentData = await depositModel.findOne({ orderid: orderid, status: global.constant.PAYMENT_STATUS_TYPES.PENDING });

    // await razorpayLogsModel.create({
    //   userid: paymentData.userid,
    //   txnid: paymentData.txnid,
    //   amount: paymentData.amount,
    //   status: "PAYMENT_SUCCESS",
    //   data: paymentEntity,
    // });

    if (!paymentData) {
      return { status: false, message: "Transaction not found" };
    }

    if (data.status == "SUCCESS") {
      const addAmount = paymentData.amount;
      const appSettingData = await redisMain.getkeydata("appSettingData");
      let gstAmount = 0;

      if (appSettingData?.gst == 1) {
        gstAmount = ((21.88 / 100) * addAmount).toFixed(2);
      }

      const amountWithGst = addAmount - gstAmount;
      const userWalletKey = `wallet:{${paymentData.userid}}`;
      let userBalance = await redisUser.redis.hgetall(userWalletKey);

      if (!userBalance) {
        await redisUser.setDbtoRedisWallet(paymentData.userid);
        userBalance = await redisUser.redis.hgetall(userWalletKey);
      }

      const transactionObj = {
        txnid: paymentData.txnid,
        transaction_id: paymentData.txnid,
        type: "Cash added",
        transaction_type: "Credit",
        amount: amountWithGst,
        userid: paymentData.userid,
        paymentstatus: "success",
        paymentmethod: paymentData.paymentmethod,
        utr: "",
        gst_amount: gstAmount,
      };

      await redisUser.saveTransactionToRedis(paymentData.userid, {
        balance: Number(userBalance.balance || 0) + Number(amountWithGst),
      }, transactionObj);

      const randomStr = randomstring.generate({ length: 8, charset: "alphabetic", capitalization: "uppercase" });
      let expiresAt = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);

      if (process.env.secretManager === "dev") {
        expiresAt = new Date(Date.now() + 2 * 60 * 1000);
      }

      const gstTxnId = `CASHBACK-GST-${Date.now()}-${randomStr}`;
      const bonusObj = {
        txnid: gstTxnId,
        transaction_id: gstTxnId,
        type: "Bonus",
        transaction_type: "Credit",
        userid: paymentData.userid,
        amount: gstAmount,
        expiresAt: moment(expiresAt).format("YYYY-MM-DD HH:mm:ss"),
      };

      await redisUser.saveTransactionToRedis(paymentData.userid, {
        bonus: Number(userBalance.bonus || 0) + Number(gstAmount),
      }, bonusObj);

      console.log("amountWithGst", amountWithGst);
      console.log("gstAmount", gstAmount);

      const updatedUser = await userModel.findOneAndUpdate(
        { _id: paymentData.userid },
        { $inc: { "userbalance.balance": amountWithGst, "userbalance.bonus": Number(gstAmount) } },
        { new: true }
      );

      if (gstAmount > 0) {
        await gstModel.create({
          gstAmount,
          totalAmount: amountWithGst,
          userid: updatedUser._id,
        });

        const cashbackData = await cashbackModel.create({
          userid: updatedUser._id,
          bonus: gstAmount,
          type: "gst",
          transaction_id: paymentData.txnid,
          deposit_id: paymentData._id,
          expiresAt: expiresAt,
        });

        if (cashbackData) {
          await this.addAmountTransaction(updatedUser, gstAmount, "Bonus", "bonus", gstTxnId);
        }
      }

      await depositModel.findOneAndUpdate(
        { orderid: orderid },
        {
          status: "SUCCESS",
          pay_id: "N/A",
          utr: "",
          gst_amount: gstAmount,
          bonus_txn: gstTxnId,
        },
        { new: true }
      );

      await this.addAmountTransaction(updatedUser, amountWithGst, "Cash added", "fund", paymentData.txnid);

      // ✅ Offer Bonus Section
      if (paymentData.offerid) {
        const offer = await specialOfferModel.findOne({ _id: mongoose.Types.ObjectId(paymentData.offerid) });

        const alreadyUsed = await appliedOfferModel.countDocuments({
          user_id: paymentData.userid,
          offer_id: paymentData.offerid,
        });

        if (alreadyUsed < offer.user_time) {
          const bonusAmount = offer.offer_type === "flat"
            ? offer.bonus
            : (paymentData.amount * (offer.bonus / 100));

          const bonusField = offer.type === "rs" ? "userbalance.balance" : "userbalance.bonus";

          const updatedUserOffer = await userModel.findOneAndUpdate(
            { _id: paymentData.userid },
            { $inc: { [bonusField]: bonusAmount } },
            { new: true }
          );

          const transaction_id_offer = `${global.constant.APP_SHORT_NAME}-OFFER-${Date.now()}`;

          const walletUpdateOffer = {
            bonus: Number(userBalance.bonus || 0) + Number(bonusAmount),
          };

          const offerObj = {
            txnid: transaction_id_offer,
            transaction_id: transaction_id_offer,
            transaction_type: "Credit",
            userid: paymentData.userid,
            type: "Offer bonus",
            amount: bonusAmount,
          };

          await redisUser.saveTransactionToRedis(paymentData.userid, walletUpdateOffer, offerObj);
          await this.addAmountTransaction(updatedUserOffer, bonusAmount, "Offer bonus", "bonus", transaction_id_offer);
          await appliedOfferModel.create({
            user_id: paymentData.userid,
            offer_id: paymentData.offerid,
            transaction_id_offer,
          });
        }
      }

      return { status: true, message: "Payment processed successfully" };

    } else if (data.status == "null") {
      await depositModel.findOneAndUpdate(
        { orderid: orderid },
        {
          status: "FAILED",
          pay_id: "N/A"
        }
      );
      return { status: false, message: `Payment ${data.status}.` };
    } else {
      await depositModel.findOneAndUpdate(
        { orderid: orderid },
        {
          status: data.status,
          pay_id: "N/A"
        }
      );
      return { status: false, message: `Payment ${data.status}.` };
    }


  } catch (error) {
    console.log('Error: ', error);
    return {
      status: false,
      message: 'Internal server error.'
    }
  }
}

function decryptResponse(encryptedText, secretKey, iv) {
  // Decode from base64
  const encryptedData = Buffer.from(encryptedText, 'base64');

  // Create decipher
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(secretKey), Buffer.from(iv));

  // Decrypt
  let decrypted = decipher.update(encryptedData);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
}

// exports.sabPaisaCallbackWeb = async(req) => {
//     try {
//       console.log("-----------sabPaisaCallback_Web------------", req.body);

//       const { clientCode, encryptedResponse } = req.body;

//       const secretKey = 'YOUR_SECRET_KEY_32BYTESLONG!!'; // Must be 32 bytes
//       const iv = 'YOUR_IV_16BYTES'; // Must be 16 bytes

//       try {
//         const decrypted = decryptResponse(encryptedResponse, secretKey, iv);

//         // Convert query string to object
//         const params = new URLSearchParams(decrypted);
//         const result = Object.fromEntries(params.entries());

//         console.log(result);

//       } catch (err) {
//         console.error('Decryption failed:', err);
//         return {
//           status: false,
//           message: "Something went wrong."
//         }
//       }

//       let txnid = req.body.txnid;
//       let orderid = req.body.orderid;

//       const paymentData = await depositModel.findOne({ orderid: orderid, status: global.constant.PAYMENT_STATUS_TYPES.PENDING });

//       // await razorpayLogsModel.create({
//       //   userid: paymentData.userid,
//       //   txnid: paymentData.txnid,
//       //   amount: paymentData.amount,
//       //   status: "PAYMENT_SUCCESS",
//       //   data: paymentEntity,
//       // });

//       if (!paymentData) {
//         return { status: false, message: "Transaction not found" };
//       }

//       if(req.body.status == "SUCCESS") {
//         const addAmount = paymentData.amount;
//         const appSettingData = await redisMain.getkeydata("appSettingData");
//         let gstAmount = 0;

//         if (appSettingData?.gst == 1) {
//           gstAmount = ((21.88 / 100) * addAmount).toFixed(2);
//         }

//         const amountWithGst = addAmount - gstAmount;
//         const userWalletKey = `wallet:{${paymentData.userid}}`;
//         let userBalance = await redisUser.redis.hgetall(userWalletKey);

//         if (!userBalance) {
//           await redisUser.setDbtoRedisWallet(paymentData.userid);
//           userBalance = await redisUser.redis.hgetall(userWalletKey);
//         }

//         const transactionObj = {
//           txnid: txnid,
//           transaction_id: txnid,
//           type: "Cash added",
//           transaction_type: "Credit",
//           amount: amountWithGst,
//           userid: paymentData.userid,
//           paymentstatus: "success",
//           paymentmethod: paymentData.paymentmethod,
//           utr: "",
//           gst_amount: gstAmount,
//         };

//         await redisUser.saveTransactionToRedis(paymentData.userid, {
//           balance: Number(userBalance.balance || 0) + Number(amountWithGst),
//         }, transactionObj);

//         const randomStr = randomstring.generate({ length: 8, charset: "alphabetic", capitalization: "uppercase" });
//         let expiresAt = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);

//         if (process.env.secretManager === "dev") {
//           expiresAt = new Date(Date.now() + 2 * 60 * 1000);
//         }

//         const gstTxnId = `CASHBACK-GST-${Date.now()}-${randomStr}`;
//         const bonusObj = {
//           txnid: gstTxnId,
//           transaction_id: gstTxnId,
//           type: "Bonus",
//           transaction_type: "Credit",
//           userid: paymentData.userid,
//           amount: gstAmount,
//           expiresAt: moment(expiresAt).format("YYYY-MM-DD HH:mm:ss"),
//         };

//         await redisUser.saveTransactionToRedis(paymentData.userid, {
//           bonus: Number(userBalance.bonus || 0) + Number(gstAmount),
//         }, bonusObj);

//         console.log("amountWithGst", amountWithGst);
//         console.log("gstAmount", gstAmount);

//         const updatedUser = await userModel.findOneAndUpdate(
//           { _id: paymentData.userid },
//           { $inc: { "userbalance.balance": amountWithGst, "userbalance.bonus": Number(gstAmount) } },
//           { new: true }
//         );

//         if (gstAmount > 0) {
//           await gstModel.create({
//             gstAmount,
//             totalAmount: amountWithGst,
//             userid: updatedUser._id,
//           });

//           const cashbackData = await cashbackModel.create({
//             userid: updatedUser._id,
//             bonus: gstAmount,
//             type: "gst",
//             transaction_id: paymentData.txnid,
//             deposit_id: paymentData._id,
//             expiresAt: expiresAt,
//           });

//           if (cashbackData) {
//             await this.addAmountTransaction(updatedUser, gstAmount, "Bonus", "bonus", gstTxnId);
//           }
//         }

//         await depositModel.findOneAndUpdate(
//           { orderid: orderid },
//           {
//             status: "SUCCESS",
//             pay_id: "N/A",
//             utr: "",
//             gst_amount: gstAmount,
//             bonus_txn: gstTxnId,
//           },
//           { new: true }
//         );

//         await this.addAmountTransaction(updatedUser, amountWithGst, "Cash added", "fund", txnid);

//         // ✅ Offer Bonus Section
//         if (paymentData.offerid) {
//           const offer = await specialOfferModel.findOne({ _id: mongoose.Types.ObjectId(paymentData.offerid) });

//           const alreadyUsed = await appliedOfferModel.countDocuments({
//             user_id: paymentData.userid,
//             offer_id: paymentData.offerid,
//           });

//           if (alreadyUsed < offer.user_time) {
//             const bonusAmount = offer.offer_type === "flat"
//               ? offer.bonus
//               : (paymentData.amount * (offer.bonus / 100));

//             const bonusField = offer.type === "rs" ? "userbalance.balance" : "userbalance.bonus";

//             const updatedUserOffer = await userModel.findOneAndUpdate(
//               { _id: paymentData.userid },
//               { $inc: { [bonusField]: bonusAmount } },
//               { new: true }
//             );

//             const transaction_id_offer = `${global.constant.APP_SHORT_NAME}-OFFER-${Date.now()}`;

//             const walletUpdateOffer = {
//               bonus: Number(userBalance.bonus || 0) + Number(bonusAmount),
//             };

//             const offerObj = {
//               txnid: transaction_id_offer,
//               transaction_id: transaction_id_offer,
//               transaction_type: "Credit",
//               userid: paymentData.userid,
//               type: "Offer bonus",
//               amount: bonusAmount,
//             };

//             await redisUser.saveTransactionToRedis(paymentData.userid, walletUpdateOffer, offerObj);
//             await this.addAmountTransaction(updatedUserOffer, bonusAmount, "Offer bonus", "bonus", transaction_id_offer);
//             await appliedOfferModel.create({
//               user_id: paymentData.userid,
//               offer_id: paymentData.offerid,
//               transaction_id_offer,
//             });
//           }
//         }

//         return { status: true, message: "Payment processed successfully" };

//       } else if (req.body.status == "null") {
//         await depositModel.findOneAndUpdate(
//           { orderid: orderid },
//           {
//             status: "FAILED",
//             pay_id: "N/A"
//           }
//         );
//         return { status: false, message: `Payment ${req.body.status}.`};
//       } else {
//         await depositModel.findOneAndUpdate(
//           { orderid: orderid },
//           {
//             status: req.body.status,
//             pay_id: "N/A"
//           }
//         );
//         return { status: false, message: `Payment ${req.body.status}.`};
//       }


//     } catch (error) {
//         console.log('Error: ', error);
//         return {
//             status: false,
//             message: 'Internal server error.'
//         }
//     }
// }

exports.razorPayPaymentVerify = async (req) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", global.constant.RAZORPAY_KEY_SECRET_TEST)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return { status: false, message: "Signature verification failed" };
    }

    const paymentData = await depositModel.findOne({
      orderid: razorpay_order_id,
      status: global.constant.PAYMENT_STATUS_TYPES.PENDING
    });

    if (!paymentData) {
      return { status: false, message: "Transaction not found or already processed" };
    }

    await razorpayLogsModel.create({
      userid: paymentData.userid,
      txnid: paymentData.txnid,
      amount: paymentData.amount,
      status: "PAYMENT_SUCCESS",
      data: req.body
    });

    await processSuccessfulDeposit.call(this, paymentData, {
      payment_id: razorpay_payment_id
    });

    return { status: true, message: "Payment verified & bonus credited successfully" };

  } catch (error) {
    console.error(error);
    return { status: false, message: "Payment verification failed", error: error.message };
  }
};


async function processSuccessfulDeposit(paymentData, razorpayData) {

  const addAmount = paymentData.amount;
  let gstAmount = 0;

  const amountWithGst = addAmount - gstAmount;

  const userWalletKey = `wallet:{${paymentData.userid}}`;
  let userBalance = await redisUser.redis.hgetall(userWalletKey);

  if (!userBalance || !userBalance.balance) {
    await redisUser.setDbtoRedisWallet(paymentData.userid);
    userBalance = await redisUser.redis.hgetall(userWalletKey);
  }

  const tiers = await tierbreakdown.findOne({
    minAmount: { $lte: addAmount },
    maxAmount: { $gte: addAmount }
  }).lean();

  if (!tiers) throw new Error("No tier found");

  /* ================= CASH CREDIT ================= */
  await redisUser.saveTransactionToRedis(
    paymentData.userid,
    { balance: Number(userBalance.balance || 0) + amountWithGst },
    {
      txnid: paymentData.txnid,
      transaction_id: paymentData.txnid,
      type: "Cash added",
      transaction_type: "Credit",
      amount: amountWithGst,
      userid: paymentData.userid,
      paymentstatus: "success",
      paymentmethod: paymentData.paymentmethod,
      utr: razorpayData.utr || razorpayData.payment_id,
      gst_amount: gstAmount,
      tierAmount: tiers.tokenAmount
    }
  );

  /* ================= BONUS / GEMS ================= */
  const randomStr = randomstring.generate({ length: 8, charset: "alphabetic", capitalization: "uppercase" });
  let expiresAt = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);

  const gemsTxnId = `CASHBACK-GEMS-${Date.now()}-${randomStr}`;

  await redisUser.saveTransactionToRedis(
    paymentData.userid,
    { bonus: Number(userBalance.bonus || 0) + Number(tiers.tokenAmount) },
    {
      txnid: gemsTxnId,
      transaction_id: gemsTxnId,
      type: "Bonus",
      transaction_type: "Credit",
      userid: paymentData.userid,
      amount: tiers.tokenAmount,
      expiresAt: moment(expiresAt).format("YYYY-MM-DD HH:mm:ss"),
    }
  );

  /* ================= DB UPDATE ================= */
  const updatedUser = await userModel.findOneAndUpdate(
    { _id: paymentData.userid },
    {
      $inc: {
        "userbalance.balance": amountWithGst,
        "userbalance.bonus": tiers.tokenAmount
      }
    },
    { new: true }
  );

  /* ================= DEPOSIT UPDATE ================= */
  await depositModel.findOneAndUpdate(
    { _id: paymentData._id },
    {
      status: "SUCCESS",
      pay_id: razorpayData.payment_id,
      utr: razorpayData.utr || "",
      tierAmount: tiers.tokenAmount,
      gems_txn: gemsTxnId
    }
  );

  await this.addAmountTransaction(updatedUser, amountWithGst, "Cash added", "fund", paymentData.txnid);
  await this.addAmountTransaction(updatedUser, tiers.tokenAmount, "Gems Bonus", "bonus", gemsTxnId);

  /* ================= OFFER BONUS ================= */
  if (paymentData.offerid) {
    const offer = await specialOfferModel.findById(paymentData.offerid);
    if (offer) {
      const alreadyUsed = await appliedOfferModel.countDocuments({
        user_id: paymentData.userid,
        offer_id: paymentData.offerid,
      });

      if (alreadyUsed < offer.user_time) {
        const bonusAmount = offer.offer_type === "flat"
          ? offer.bonus
          : (paymentData.amount * (offer.bonus / 100));

        const transaction_id_offer = `${global.constant.APP_SHORT_NAME}-OFFER-${Date.now()}`;

        await redisUser.saveTransactionToRedis(
          paymentData.userid,
          { bonus: Number(userBalance.bonus || 0) + Number(bonusAmount) },
          {
            txnid: transaction_id_offer,
            transaction_id: transaction_id_offer,
            type: "Offer bonus",
            transaction_type: "Credit",
            userid: paymentData.userid,
            amount: bonusAmount
          }
        );

        await appliedOfferModel.create({
          user_id: paymentData.userid,
          offer_id: paymentData.offerid,
          transaction_id_offer
        });
      }
    }
  }
}


exports.razorPayCallback = async (req) => {
  try {
    console.log("-------------razorpay_Webhook---------------", req.body);

    const eventType = req.body?.event;
    const paymentEntity = req.body?.payload?.payment?.entity;

    if (!paymentEntity || eventType !== "payment.captured") {
      return { status: false, message: "Invalid webhook event" };
    }

    const txnid = paymentEntity.order_id;

    const paymentData = await depositModel.findOne({ orderid: txnid, status: global.constant.PAYMENT_STATUS_TYPES.PENDING });

    console.log("paymentData", paymentData);

    await razorpayLogsModel.create({
      userid: paymentData.userid,
      txnid: paymentData.txnid,
      amount: paymentData.amount,
      status: "PAYMENT_SUCCESS",
      data: paymentEntity,
    });

    if (!paymentData) {
      return { status: false, message: "Transaction not found" };
    }


    const addAmount = paymentData.amount;
    const appSettingData = await redisMain.getkeydata("appSettingData");
    let gstAmount = 0;

    let paymentDataRedis = await redisPayment.getTDSdata(paymentData.userid);

    // if (appSettingData?.gst == 1) {
    //   gstAmount = ((21.88 / 100) * addAmount).toFixed(2);
    // }

    const amountWithGst = addAmount - gstAmount;
    const userWalletKey = `wallet:{${paymentData.userid}}`;
    let userBalance = await redisUser.redis.hgetall(userWalletKey);

    if (!userBalance) {
      await redisUser.setDbtoRedisWallet(paymentData.userid);
      userBalance = await redisUser.redis.hgetall(userWalletKey);
    }
    const tiers = await tierbreakdown
      .findOne({
        minAmount: { $lte: addAmount },
        maxAmount: { $gte: addAmount }
      })
      .lean();

    const transactionObj = {
      txnid: txnid,
      transaction_id: txnid,
      type: "Cash added",
      transaction_type: "Credit",
      amount: amountWithGst,
      userid: paymentData.userid,
      paymentstatus: "success",
      paymentmethod: paymentData.paymentmethod,
      utr: paymentEntity.acquirer_data?.utr || "",
      gst_amount: gstAmount,
      tierAmount: tiers?.tokenAmount || 0,
    };

    await redisUser.saveTransactionToRedis(paymentData.userid, {
      balance: Number(userBalance.balance || 0) + Number(amountWithGst),
    }, transactionObj);

    const randomStr = randomstring.generate({ length: 8, charset: "alphabetic", capitalization: "uppercase" });
    let expiresAt = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);

    if (process.env.secretManager === "dev") {
      expiresAt = new Date(Date.now() + 2 * 60 * 1000);
    }


    const gstTxnId = `CASHBACK-GST-${Date.now()}-${randomStr}`;
    const bonusObj = {
      txnid: gstTxnId,
      transaction_id: gstTxnId,
      type: "Bonus",
      transaction_type: "Credit",
      userid: paymentData.userid,
      amount: gstAmount,
      expiresAt: moment(expiresAt).format("YYYY-MM-DD HH:mm:ss"),
    };

    if (!tiers) {
      throw new Error("No tier found for this amount");
    }

    const gemsTxnId = `CASHBACK-GEMS-${Date.now()}-${randomStr}`;

    const bonusObj1 = {
      txnid: gemsTxnId,
      transaction_id: gemsTxnId,
      type: "Bonus",
      transaction_type: "Credit",
      userid: paymentData.userid,
      amount: tiers.tokenAmount,
      expiresAt: moment(expiresAt).format("YYYY-MM-DD HH:mm:ss"),
    };


    await redisUser.saveTransactionToRedis(paymentData.userid, {
      bonus: Number(userBalance.bonus || 0) + Number(tiers.tokenAmount),
    }, bonusObj1);

    console.log("amountWithGst", amountWithGst);
    console.log("gstAmount", gstAmount);
    console.log("tiers.tokenAmount", tiers.tokenAmount);

    const updatedUser = await userModel.findOneAndUpdate(
      { _id: paymentData.userid },
      { $inc: { "userbalance.balance": amountWithGst, "userbalance.bonus": Number(gstAmount) + Number(tiers.tokenAmount) } },
      { new: true }
    );

    if (gstAmount > 0) {
      await gstModel.create({
        gstAmount,
        totalAmount: amountWithGst,
        userid: updatedUser._id,
      });

      const cashbackData = await cashbackModel.create({
        userid: updatedUser._id,
        bonus: gstAmount,
        type: "gst",
        transaction_id: paymentData.txnid,
        deposit_id: paymentData._id,
        expiresAt: expiresAt,
      });

      if (cashbackData) {
        await this.addAmountTransaction(updatedUser, gstAmount, "Bonus", "bonus", gstTxnId);
      }
    }

    await this.addAmountTransaction(updatedUser, tiers.tokenAmount, "Gems Bonus", "bonus", gemsTxnId);

    let processedPayment = await depositModel.findOneAndUpdate(
      { orderid: txnid },
      {
        status: "SUCCESS",
        pay_id: paymentEntity.id,
        utr: paymentEntity.acquirer_data?.utr || "",
        gst_amount: gstAmount,
        bonus_txn: gstTxnId,
        gems_txn: gemsTxnId,
        tierAmount: tiers?.tokenAmount || 0,
      },
      { new: true }
    );

    await this.addAmountTransaction(updatedUser, amountWithGst, "Cash added", "fund", paymentData.txnid);

    // ✅ Offer Bonus Section
    if (paymentData.offerid) {
      const offer = await specialOfferModel.findOne({ _id: mongoose.Types.ObjectId(paymentData.offerid) });

      const alreadyUsed = await appliedOfferModel.countDocuments({
        user_id: paymentData.userid,
        offer_id: paymentData.offerid,
      });

      if (alreadyUsed < offer.user_time) {
        const bonusAmount = offer.offer_type === "flat"
          ? offer.bonus
          : (paymentData.amount * (offer.bonus / 100));

        const bonusField = offer.type === "rs" ? "userbalance.balance" : "userbalance.bonus";

        const updatedUserOffer = await userModel.findOneAndUpdate(
          { _id: paymentData.userid },
          { $inc: { [bonusField]: bonusAmount } },
          { new: true }
        );

        const transaction_id_offer = `${global.constant.APP_SHORT_NAME}-OFFER-${Date.now()}`;

        const walletUpdateOffer = {
          bonus: Number(userBalance.bonus || 0) + Number(bonusAmount),
        };

        const offerObj = {
          txnid: transaction_id_offer,
          transaction_id: transaction_id_offer,
          transaction_type: "Credit",
          userid: paymentData.userid,
          type: "Offer bonus",
          amount: bonusAmount,
        };

        await redisUser.saveTransactionToRedis(paymentData.userid, walletUpdateOffer, offerObj);
        await this.addAmountTransaction(updatedUserOffer, bonusAmount, "Offer bonus", "bonus", transaction_id_offer);
        await appliedOfferModel.create({
          user_id: paymentData.userid,
          offer_id: paymentData.offerid,
          transaction_id_offer,
        });
      }
    }

    let depositKey = `userid:${paymentData.userid}-deposit:${processedPayment._id}`;
    await redisPayment.redis.hset(depositKey, processedPayment);

    let tdsWallet = {
      successPayment: Number(paymentDataRedis.successPayment) + Number(paymentData.amount),
      successWithdraw: paymentDataRedis.successWithdraw,
      tdsPaid: paymentDataRedis.tdsPaid
    }

    await redisPayment.updateTDSdata(paymentData.userid, tdsWallet);

    return { status: true, message: "Payment processed successfully" };

  } catch (error) {
    console.error("Webhook error:", error);
    return { status: false, message: "Webhook processing failed", error };
  }
};

exports.spinAndWin = async (req) => {
  try {
    const { deposit_id } = req.body;
    const userId = req.user._id;

    const deposit = await depositModel.findOne({
      txnid: deposit_id,
      userid: userId
    });

    if (!deposit) {
      return { status: false, message: "Deposit not found" };
    }

    if (deposit.mystery_status !== 'pending') {
      return { status: false, message: "Spin already used or expired" };
    }

    const minWin = Math.ceil(deposit.mystery_amount * 0.2);
    const maxWin = deposit.mystery_amount;

    const winAmount =
      Math.floor(Math.random() * (maxWin - minWin + 1)) + minWin;

    await userModel.updateOne(
      { _id: userId },
      { $inc: { 'userbalance.bonus': winAmount } }
    );

    const spinTxnId = `SPIN-${Date.now()}`;

    await this.addAmountTransaction(
      { _id: userId },
      winAmount,
      "Spin & Win Bonus",
      "bonus",
      spinTxnId
    );

    await depositModel.updateOne(
      { txnid: deposit_id },
      {
        mystery_status: 'claimed',
        mystery_win_amount: winAmount,
        mystery_claimed_at: new Date()
      }
    );

    return {
      status: true,
      message: "Spin successful",
      data: {
        winAmount,
        maxPossible: deposit.mystery_amount
      }
    };

  } catch (error) {
    console.error("Spin error:", error);
    return { status: false, message: "Spin failed" };
  }
};

// exports.razorPayCallback = async (req) => {
//   try {
//     console.log("-------------razorpay_Webhook---------------", req.body);

//     const eventType = req.body?.event;
//     const paymentEntity = req.body?.payload?.payment?.entity;

//     if (!paymentEntity || eventType !== "payment.captured") {
//       return { status: false, message: "Invalid webhook event" };
//     }

//     const txnid = paymentEntity.order_id; 

//     const paymentData = await depositModel.findOne({ orderid: txnid, status: global.constant.PAYMENT_STATUS_TYPES.PENDING });

//     await razorpayLogsModel.create({
//       userid: paymentData.userid,
//       txnid: paymentData.txnid,
//       amount: paymentData.amount,
//       status: "PAYMENT_SUCCESS",
//       data: paymentEntity,
//     });

//     if (!paymentData) {
//       return { status: false, message: "Transaction not found" };
//     }


//     const addAmount = paymentData.amount;
//     const appSettingData = await redisMain.getkeydata("appSettingData");
//     let gstAmount = 0;

//     if (appSettingData?.gst == 1) {
//       gstAmount = ((21.88 / 100) * addAmount).toFixed(2);
//     }

//     const amountWithGst = addAmount - gstAmount;
//     const userWalletKey = `wallet:{${paymentData.userid}}`;
//     let userBalance = await redisUser.redis.hgetall(userWalletKey);

//     if (!userBalance) {
//       await redisUser.setDbtoRedisWallet(paymentData.userid);
//       userBalance = await redisUser.redis.hgetall(userWalletKey);
//     }

//     const transactionObj = {
//       txnid: txnid,
//       transaction_id: txnid,
//       type: "Cash added",
//       transaction_type: "Credit",
//       amount: amountWithGst,
//       userid: paymentData.userid,
//       paymentstatus: "success",
//       paymentmethod: paymentData.paymentmethod,
//       utr: paymentEntity.acquirer_data?.utr || "",
//       gst_amount: gstAmount,
//     };

//     await redisUser.saveTransactionToRedis(paymentData.userid, {
//       balance: Number(userBalance.balance || 0) + Number(amountWithGst),
//     }, transactionObj);

//     const randomStr = randomstring.generate({ length: 8, charset: "alphabetic", capitalization: "uppercase" });
//     let expiresAt = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);

//     if (process.env.secretManager === "dev") {
//       expiresAt = new Date(Date.now() + 2 * 60 * 1000);
//     }

//     const gstTxnId = `CASHBACK-GST-${Date.now()}-${randomStr}`;
//     const bonusObj = {
//       txnid: gstTxnId,
//       transaction_id: gstTxnId,
//       type: "Bonus",
//       transaction_type: "Credit",
//       userid: paymentData.userid,
//       amount: gstAmount,
//       expiresAt: moment(expiresAt).format("YYYY-MM-DD HH:mm:ss"),
//     };

//     await redisUser.saveTransactionToRedis(paymentData.userid, {
//       bonus: Number(userBalance.bonus || 0) + Number(gstAmount),
//     }, bonusObj);

//     console.log("amountWithGst", amountWithGst);
//     console.log("gstAmount", gstAmount);

//     const updatedUser = await userModel.findOneAndUpdate(
//       { _id: paymentData.userid },
//       { $inc: { "userbalance.balance": amountWithGst, "userbalance.bonus": Number(gstAmount) } },
//       { new: true }
//     );

//     if (gstAmount > 0) {
//       await gstModel.create({
//         gstAmount,
//         totalAmount: amountWithGst,
//         userid: updatedUser._id,
//       });

//       const cashbackData = await cashbackModel.create({
//         userid: updatedUser._id,
//         bonus: gstAmount,
//         type: "gst",
//         transaction_id: paymentData.txnid,
//         deposit_id: paymentData._id,
//         expiresAt: expiresAt,
//       });

//       if (cashbackData) {
//         await this.addAmountTransaction(updatedUser, gstAmount, "Bonus", "bonus", gstTxnId);
//       }
//     }

//     await depositModel.findOneAndUpdate(
//       { orderid: txnid },
//       {
//         status: "SUCCESS",
//         pay_id: paymentEntity.id,
//         utr: paymentEntity.acquirer_data?.utr || "",
//         gst_amount: gstAmount,
//         bonus_txn: gstTxnId,
//       },
//       { new: true }
//     );

//     await this.addAmountTransaction(updatedUser, amountWithGst, "Cash added", "fund", txnid);

//     // ✅ Offer Bonus Section
//     if (paymentData.offerid) {
//       const offer = await specialOfferModel.findOne({ _id: mongoose.Types.ObjectId(paymentData.offerid) });

//       const alreadyUsed = await appliedOfferModel.countDocuments({
//         user_id: paymentData.userid,
//         offer_id: paymentData.offerid,
//       });

//       if (alreadyUsed < offer.user_time) {
//         const bonusAmount = offer.offer_type === "flat"
//           ? offer.bonus
//           : (paymentData.amount * (offer.bonus / 100));

//         const bonusField = offer.type === "rs" ? "userbalance.balance" : "userbalance.bonus";

//         const updatedUserOffer = await userModel.findOneAndUpdate(
//           { _id: paymentData.userid },
//           { $inc: { [bonusField]: bonusAmount } },
//           { new: true }
//         );

//         const transaction_id_offer = `${global.constant.APP_SHORT_NAME}-OFFER-${Date.now()}`;

//         const walletUpdateOffer = {
//           bonus: Number(userBalance.bonus || 0) + Number(bonusAmount),
//         };

//         const offerObj = {
//           txnid: transaction_id_offer,
//           transaction_id: transaction_id_offer,
//           transaction_type: "Credit",
//           userid: paymentData.userid,
//           type: "Offer bonus",
//           amount: bonusAmount,
//         };

//         await redisUser.saveTransactionToRedis(paymentData.userid, walletUpdateOffer, offerObj);
//         await this.addAmountTransaction(updatedUserOffer, bonusAmount, "Offer bonus", "bonus", transaction_id_offer);
//         await appliedOfferModel.create({
//           user_id: paymentData.userid,
//           offer_id: paymentData.offerid,
//           transaction_id_offer,
//         });
//       }
//     }

//     return { status: true, message: "Payment processed successfully" };

//   } catch (error) {
//     console.error("Webhook error:", error);
//     return { status: false, message: "Webhook processing failed", error };
//   }
// };

exports.phonePayCallback = async (req) => {
  try {
    console.log("-------------phonePe_Webhook---------------", req.body);

    // const PHONE_PAY_HOST_URL = "https://api.phonepe.com/apis/hermes";
    // const SALT_KEY = "277b175e-5ba1-493a-8127-3806e34862ba";
    // const SALT_INDEX = 1;
    // const MERCHANT_ID = "M22K6D3WC5AWJ";

    const receivedChecksum = req.body.response;
    const decodedResponse = Buffer.from(receivedChecksum, "base64").toString("utf-8");
    const callbackData = JSON.parse(decodedResponse);
    console.log("Decoded Callback Data:", callbackData);

    let phonePeResponse = callbackData.data;

    let paymentData = await depositModel.findOne({ txnid: phonePeResponse.merchantTransactionId });

    await phonepeLogsModel.create({
      userid: paymentData.userid,
      txnid: paymentData.txnid,
      amount: paymentData.amount,
      status: callbackData.code,
      data: phonePeResponse,
    });

    if (paymentData) {
      if (callbackData.code === "PAYMENT_SUCCESS") {
        console.log(`Transaction ${phonePeResponse.merchantTransactionId} successful.`);

        let addAmount = paymentData.amount;
        let keyname = `appSettingData`;
        let getGetAmountDeductStatus = await redisMain.getkeydata(keyname);
        let getGstAmount = 0;

        // console.log("getGetAmountDeductStatus", getGetAmountDeductStatus);

        if (getGetAmountDeductStatus.gst == 1) {
          getGstAmount = ((21.88 / 100) * addAmount).toFixed(2);
        }

        let amoutWithGst = addAmount - getGstAmount;
        console.log("amount", addAmount);
        console.log("getGstAmount", getGstAmount);
        console.log("amoutWithGst", amoutWithGst);
        let transaction_id = paymentData.txnid;

        let userbalanceFromRedis = await redisUser.redis.hgetall(`wallet:{${paymentData.userid}}`);
        if (!userbalanceFromRedis) {
          await redisUser.setDbtoRedisWallet(paymentData.userid);
          userbalanceFromRedis = await redisUser.redis.hgetall(`wallet:{${paymentData.userid}}`);
        }

        // let transactionObjToDb = {
        //   transaction_id: transaction_id,
        //   transaction_by: global.constant.TRANSACTION_BY.APP_NAME,
        //   userid: paymentData.userid,
        //   type: "Cash added",
        //   amount: addAmount,
        //   paymentstatus: "confirmed",
        //   bal_fund_amt: balance,
        //   bal_win_amt: winning,
        //   bal_bonus_amt: bonus,
        //   addfund_amt: addAmount,
        //   bonus_amt: 0,
        //   win_amt: 0,
        //   total_available_amt: balance + winning + bonus,
        //   paymentmethod: paymentData.paymentmethod,
        //   utr: phonePeResponse.paymentInstrument.utr,
        //   gst_amount: getGstAmount
        // };

        let transactionObj = {
          txnid: transaction_id,
          transaction_id: transaction_id,
          type: "Cash added",
          transaction_type: "Credit",
          amount: amoutWithGst,
          userid: paymentData.userid,
          paymentstatus: "success",
          paymentmethod: paymentData.paymentmethod,
          utr: phonePeResponse.paymentInstrument.utr,
          gst_amount: getGstAmount
        };

        // Updating in Redis
        const walletUpdate = {
          balance: Number(userbalanceFromRedis.balance) + amoutWithGst,
        };

        await redisUser.saveTransactionToRedis(paymentData.userid, walletUpdate, transactionObj);

        const randomStr = randomstring.generate({
          length: 8,
          charset: "alphabetic",
          capitalization: "uppercase",
        });

        let expiresAt = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000); // 28 days from now

        if (process.env.secretManager == "dev") {
          // Override to 2 minutes in dev environment
          expiresAt = new Date(Date.now() + 2 * 60 * 1000);
        }

        console.log("createdAt:", new Date());
        console.log("expiresAt:", expiresAt);
        console.log("expiresAt (formatted):", moment(expiresAt).format("YYYY-MM-DD HH:mm:ss"));

        const transaction_id_GST = `CASHBACK-GST-${Date.now()}-${randomStr}`;
        let cashbackObj = {
          txnid: transaction_id_GST,
          transaction_id: transaction_id_GST,
          type: "Bonus",
          transaction_type: "Credit",
          userid: paymentData.userid,
          amount: getGstAmount,
          expiresAt: moment(expiresAt).format("YYYY-MM-DD HH:mm:ss")
        };

        // Updating in Redis
        const walletUpdateAfterBonus = {
          bonus: Number(userbalanceFromRedis.bonus) + Number(getGstAmount),
        };

        await redisUser.saveTransactionToRedis(paymentData.userid, walletUpdateAfterBonus, cashbackObj);

        const updateUserBalance = await userModel.findOneAndUpdate(
          { _id: paymentData.userid },
          { $inc: { "userbalance.balance": amoutWithGst } },
          { new: true }
        );

        let processedPayment;
        if (updateUserBalance) {
          // let transaction_id = paymentData.txnid;
          if (getGstAmount > 0) {
            const gstDataObj = {
              gstAmount: getGstAmount,
              totalAmount: amoutWithGst,
              userid: updateUserBalance._id,
            };
            await gstModel.create(gstDataObj);
            const cashbackData = await cashbackModel.create({
              userid: updateUserBalance._id,
              bonus: getGstAmount,
              type: "gst",
              transaction_id: transaction_id,
              deposit_id: paymentData._id,
              expiresAt: expiresAt // 28 days from now
              // expiresAt: new Date(Date.now() + 5 * 60 * 1000)
            });
            if (cashbackData) {
              // const expiresAt = cashbackData.expiresAt;
              // const formattedExpiresAt = `${expiresAt.getFullYear()}-${String(expiresAt.getMonth() + 1).padStart(2, '0')}-${String(expiresAt.getDate()).padStart(2, '0')} ${String(expiresAt.getHours()).padStart(2, '0')}:${String(expiresAt.getMinutes()).padStart(2, '0')}:${String(expiresAt.getSeconds()).padStart(2, '0')}`;

              console.log("cashback data added successfully", cashbackData._id);
              await this.addAmountTransaction(
                updateUserBalance,
                getGstAmount,
                "Bonus",
                "bonus",
                transaction_id_GST,
              );
            }
            await userModel.findOneAndUpdate(
              { _id: paymentData.userid },
              { $inc: { "userbalance.bonus": getGstAmount } },
              { new: true }
            );
          }

          processedPayment = await depositModel.findOneAndUpdate(
            { txnid: phonePeResponse.merchantTransactionId },
            { status: "SUCCESS", pay_id: phonePeResponse.transactionId, utr: phonePeResponse.paymentInstrument.utr, gst_amount: getGstAmount, bonus_txn: transaction_id_GST },
            { new: true }
          );

          await this.addAmountTransaction(
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

          let transaction_id_offer = `${global.constant.APP_SHORT_NAME}-OFFER-${Date.now()}`;


          let userbalanceRedis = await redisUser.redis.hgetall(`wallet:{${paymentData.userid}}`);

          // Updating in Redis
          const walletUpdateAfterOffer = {
            bonus: Number(userbalanceRedis.bonus + amountt)
          };

          let offerObj = {
            txnid: transaction_id_offer,
            transaction_id: transaction_id_offer,
            transaction_type: "Credit",
            userid: paymentData.userid,
            type: "Offer bonus",
            amount: amountt,
          };

          await redisUser.saveTransactionToRedis(paymentData.userid, walletUpdateAfterOffer, offerObj);

          await this.addAmountTransaction(
            updatedBalance,
            amountt,
            "Offer bonus",
            "bonus",
            transaction_id_offer
          );

          await appliedOfferModel.create({
            user_id: paymentData.userid,
            offer_id: paymentData.offerid,
            transaction_id_offer,
          });
        }

        let depositKey = `userid:${paymentData.userid}-deposit:${processedPayment._id}`;
        await redisPayment.redis.hset(depositKey, processedPayment);

        let paymentDataRedis = await redisPayment.getTDSdata(paymentData.userid);

        let tdsWallet = {
          successPayment: Number(paymentDataRedis.successPayment) + Number(paymentData.amount),
          successWithdraw: paymentDataRedis.successWithdraw,
          tdsPaid: paymentDataRedis.tdsPaid
        }

        await redisPayment.updateTDSdata(paymentData.userid, tdsWallet);

      } else {
        console.log(`Transaction ${phonePeResponse.merchantTransactionId} failed or pending.`);
        await depositModel.findOneAndUpdate(
          { txnid: phonePeResponse.merchantTransactionId },
          { status: phonePeResponse.state, pay_id: phonePeResponse.transactionId },
          { new: true }
        );
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

  } catch (error) {
    console.error("Error processing PhonePe callback:", error.message);
    return {
      status: false,
      message: "Internal server error",
    };
  }
}

//Live
// exports.phonePayCallback = async(req) => {
//   try {
//     console.log("-------------phonePe_Webhook---------------", req.body);

//     // const PHONE_PAY_HOST_URL = "https://api.phonepe.com/apis/hermes";
//     // const SALT_KEY = "277b175e-5ba1-493a-8127-3806e34862ba";
//     // const SALT_INDEX = 1;
//     // const MERCHANT_ID = "M22K6D3WC5AWJ";

//     const receivedChecksum = req.body.response;
//     const decodedResponse = Buffer.from(receivedChecksum, "base64").toString("utf-8");
//     const callbackData = JSON.parse(decodedResponse);
//     console.log("Decoded Callback Data:", callbackData);

//     let phonePeResponse = callbackData.data;

//     let paymentData = await depositModel.findOne({ txnid: phonePeResponse.merchantTransactionId });

//     await phonepeLogsModel.create({
//       userid: paymentData.userid,
//       txnid: paymentData.txnid,
//       amount: paymentData.amount,
//       status: callbackData.code,
//       data: phonePeResponse,
//     });

//     if (paymentData) {
//       if (callbackData.code === "PAYMENT_SUCCESS") {
//         console.log(`Transaction ${phonePeResponse.merchantTransactionId} successful.`);

//         let addAmount = paymentData.amount;
//         let getGetAmountDeductStatus = await redisMain.getkeydata(keyname);
//         let getGstAmount = 0;

//         if (getGetAmountDeductStatus.gst == 1) {
//           getGstAmount = ((21.88 / 100) * addAmount).toFixed(2);
//         }

//         let amoutWithGst = addAmount - getGstAmount;

//         const updateUserBalance = await userModel.findOneAndUpdate(
//           { _id: paymentData.userid },
//           { $inc: { "userbalance.balance": amoutWithGst } },
//           { new: true }
//         );

//         if (updateUserBalance) {
//           let transaction_id = paymentData.txnid;
//           if (getGstAmount > 0) {
//             const gstDataObj = {
//               gstAmount: getGstAmount,
//               totalAmount: amoutWithGst,
//               userid: updateUserBalance._id,
//             };
//             await gstModel.create(gstDataObj);
//             const cashbackData = await cashbackModel.create({
//               userid: updateUserBalance._id,
//               bonus: getGstAmount,
//               type: "gst",
//               transaction_id: transaction_id,
//               deposit_id: paymentData._id,
//               expiresAt: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000) // 28 days from now
//               // expiresAt: new Date(Date.now() + 5 * 60 * 1000)
//             });
//             if(cashbackData){
//               console.log("cashback data added successfully", cashbackData._id);
//             }
//             await userModel.findOneAndUpdate(
//               { _id: paymentData.userid },
//               { $inc: { "userbalance.bonus": getGstAmount } },
//               { new: true }
//             );
//             await this.addAmountTransaction(
//               updateUserBalance,
//               getGstAmount,
//               "Bonus",
//               "bonus",
//               transaction_id
//             );
//           }

//           await depositModel.findOneAndUpdate(
//             { txnid: phonePeResponse.merchantTransactionId },
//             { status: "SUCCESS", pay_id: phonePeResponse.transactionId, utr: phonePeResponse.paymentInstrument.utr },
//             { new: true }
//           );

//           await this.addAmountTransaction(
//             updateUserBalance,
//             amoutWithGst,
//             "Cash added",
//             "fund",
//             transaction_id
//           );

//         }

//           // Offer Bonus Logic
//           if (paymentData.offerid) {
//           let findOffer = await specialOfferModel.findOne({ _id: mongoose.Types.ObjectId(paymentData.offerid) });

//           // Check if the offer is already used
//           let alreadyUsed = await appliedOfferModel.find({
//             user_id: mongoose.Types.ObjectId(paymentData.userid),
//             offer_id: mongoose.Types.ObjectId(paymentData.offerid)
//           });

//           if (alreadyUsed.length >= findOffer.user_time) {
//               console.log("Offer already used. Skipping update.");
//               return; 
//           }

//           let amountt;
//           if(findOffer.offer_type == "flat"){
//             amountt = findOffer.bonus;
//           } else if (findOffer.offer_type == "percent") {
//             amountt = paymentData.amount * (findOffer.bonus / 100);
//           } 

//           let updatedBalance;
//           if (findOffer.type == "rs") {
//             updatedBalance = await userModel.findOneAndUpdate(
//               { _id: mongoose.Types.ObjectId(paymentData.userid) },
//               { $inc: { "userbalance.balance": amountt } },
//               { new: true }
//             );
//           } else {
//             updatedBalance = await userModel.findOneAndUpdate(
//               { _id: mongoose.Types.ObjectId(paymentData.userid) },
//               { $inc: { "userbalance.bonus": amountt } },
//               { new: true }
//             );
//           }

//           let transaction_id = `${global.constant.APP_SHORT_NAME}-Offer-${Date.now()}`;
//           await this.addAmountTransaction(
//             updatedBalance,
//             amountt,
//             "Offer bonus",
//             "bonus",
//             transaction_id
//           );

//           await appliedOfferModel.create({
//             user_id: paymentData.userid,
//             offer_id: paymentData.offerid,
//             transaction_id,
//           });
//         }
//       } else {
//         console.log(`Transaction ${phonePeResponse.merchantTransactionId} failed or pending.`);
//         await depositModel.findOneAndUpdate(
//           { txnid: phonePeResponse.merchantTransactionId },
//           { status: phonePeResponse.state, pay_id: phonePeResponse.transactionId, utr: phonePeResponse.paymentInstrument.utr },
//           { new: true }
//         );
//       }

//       return {
//         status: true,
//         message: "Callback processed successfully."
//       }
//     } else {
//       return {
//         status: false,
//         message: "Payment in database not found."
//       }
//     }

//   } catch (error) {
//     console.error("Error processing PhonePe callback:", error.message);
//     return {
//       status: false,
//       message: "Internal server error",
//     };
//   }
// }

exports.phonePeCallbackKafka = async (req) => {
  try {
    console.log("-------------phonePe_Webhook---------------", req.body);

    // const PHONE_PAY_HOST_URL = "https://api.phonepe.com/apis/hermes";
    // const SALT_KEY = "277b175e-5ba1-493a-8127-3806e34862ba";
    // const SALT_INDEX = 1;
    // const MERCHANT_ID = "M22K6D3WC5AWJ";

    const receivedChecksum = req.body.response;
    const decodedResponse = Buffer.from(receivedChecksum, "base64").toString("utf-8");
    const callbackData = JSON.parse(decodedResponse);
    console.log("Decoded Callback Data:", callbackData);

    let phonePeResponse = callbackData.data;

    sendToQueue('phonepe-webhook-topic',
      {
        callbackData: callbackData
      }
    );

    return {
      status: true,
      message: "Callback processed successfully."
    }

  } catch (error) {
    console.error("Error processing PhonePe callback:", error.message);
    return {
      status: false,
      message: "Internal server error",
    };
  }
};

exports.yesBankCallback = async (req) => {
  try {
    console.log("-------------YesBank_Webhook---------------", req.body);
    // Respond to yesBank with success
    return {
      status: true,
      message: "Callback processed successfully",
    }
  } catch (error) {
    console.log('Error: ', error);
    return {
      status: false,
      message: 'Internal server error.'
    }
  }
}


exports.watchPayCallback = async (req) => {
  try {
    console.log("-------------watchpay callback---------------", req.body);
    const phonePeResponse = req.body;

    let paymentData = await depositModel.findOne({ txnid: phonePeResponse.mchOrderNo });
    await phonepeLogsModel.create({
      userid: paymentData.userid,
      txnid: paymentData.txnid,
      amount: paymentData.amount,
      status: phonePeResponse.tradeResult,
      data: phonePeResponse,
    });

    if (paymentData) {
      if (phonePeResponse.tradeResult === "1" && paymentData.status != "SUCCESS") {
        let addAmount = paymentData.amount;
        let keyname = `appSettingData`;
        let getGetAmountDeductStatus = await redisMain.getkeydata(keyname);
        let getGstAmount = 0;

        // console.log("getGetAmountDeductStatus", getGetAmountDeductStatus);

        if (getGetAmountDeductStatus.gst == 1) {
          getGstAmount = ((21.88 / 100) * addAmount).toFixed(2);
        }

        let amoutWithGst = addAmount - getGstAmount;
        let transaction_id = paymentData.txnid;

        let userbalanceFromRedis = await redisUser.redis.hgetall(`wallet:{${paymentData.userid}}`);
        if (!userbalanceFromRedis) {
          await redisUser.setDbtoRedisWallet(paymentData.userid);
          userbalanceFromRedis = await redisUser.redis.hgetall(`wallet:{${paymentData.userid}}`);
        }

        let transactionObj = {
          txnid: transaction_id,
          transaction_id: transaction_id,
          type: "Cash added",
          transaction_type: "Credit",
          amount: amoutWithGst,
          userid: paymentData.userid,
          paymentstatus: "success",
          paymentmethod: paymentData.paymentmethod,
          utr: '',
          gst_amount: getGstAmount
        };

        const walletUpdate = {
          balance: Number(userbalanceFromRedis.balance) + amoutWithGst,
        };

        await redisUser.saveTransactionToRedis(paymentData.userid, walletUpdate, transactionObj);

        const randomStr = randomstring.generate({
          length: 8,
          charset: "alphabetic",
          capitalization: "uppercase",
        });

        let expiresAt = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000); // 28 days from now

        if (process.env.secretManager == "dev") {
          expiresAt = new Date(Date.now() + 2 * 60 * 1000);
        }
        const transaction_id_GST = `CASHBACK-GST-${Date.now()}-${randomStr}`;
        if (getGstAmount > 0) {
          let cashbackObj = {
            txnid: transaction_id_GST,
            transaction_id: transaction_id_GST,
            type: "Bonus",
            transaction_type: "Credit",
            userid: paymentData.userid,
            amount: getGstAmount,
            expiresAt: moment(expiresAt).format("YYYY-MM-DD HH:mm:ss")
          };
          // Updating in Redis
          const walletUpdateAfterBonus = {
            bonus: Number(userbalanceFromRedis.bonus) + Number(getGstAmount),
          };

          await redisUser.saveTransactionToRedis(paymentData.userid, walletUpdateAfterBonus, cashbackObj);
        }

        const updateUserBalance = await userModel.findOneAndUpdate(
          { _id: paymentData.userid },
          { $inc: { "userbalance.balance": amoutWithGst } },
          { new: true }
        );

        let processedPayment;
        if (updateUserBalance) {
          if (getGstAmount > 0) {
            const gstDataObj = {
              gstAmount: getGstAmount,
              totalAmount: amoutWithGst,
              userid: updateUserBalance._id,
            };
            await gstModel.create(gstDataObj);
            const cashbackData = await cashbackModel.create({
              userid: updateUserBalance._id,
              bonus: getGstAmount,
              type: "gst",
              transaction_id: transaction_id,
              deposit_id: paymentData._id,
              expiresAt: expiresAt // 28 days from now
              // expiresAt: new Date(Date.now() + 5 * 60 * 1000)
            });
            if (cashbackData) {
              // const expiresAt = cashbackData.expiresAt;
              // const formattedExpiresAt = `${expiresAt.getFullYear()}-${String(expiresAt.getMonth() + 1).padStart(2, '0')}-${String(expiresAt.getDate()).padStart(2, '0')} ${String(expiresAt.getHours()).padStart(2, '0')}:${String(expiresAt.getMinutes()).padStart(2, '0')}:${String(expiresAt.getSeconds()).padStart(2, '0')}`;

              console.log("cashback data added successfully", cashbackData._id);
              await this.addAmountTransaction(
                updateUserBalance,
                getGstAmount,
                "Bonus",
                "bonus",
                transaction_id_GST,
              );
            }
            await userModel.findOneAndUpdate(
              { _id: paymentData.userid },
              { $inc: { "userbalance.bonus": getGstAmount } },
              { new: true }
            );
          }

          processedPayment = await depositModel.findOneAndUpdate(
            { txnid: phonePeResponse.mchOrderNo },
            { status: "SUCCESS", pay_id: phonePeResponse.orderNo, utr: '', gst_amount: getGstAmount, bonus_txn: transaction_id_GST },
            { new: true }
          );

          await this.addAmountTransaction(
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

          let transaction_id_offer = `${global.constant.APP_SHORT_NAME}-OFFER-${Date.now()}`;


          let userbalanceRedis = await redisUser.redis.hgetall(`wallet:{${paymentData.userid}}`);

          // Updating in Redis
          const walletUpdateAfterOffer = {
            bonus: Number(userbalanceRedis.bonus + amountt)
          };

          let offerObj = {
            txnid: transaction_id_offer,
            transaction_id: transaction_id_offer,
            transaction_type: "Credit",
            userid: paymentData.userid,
            type: "Offer bonus",
            amount: amountt,
          };

          await redisUser.saveTransactionToRedis(paymentData.userid, walletUpdateAfterOffer, offerObj);

          await this.addAmountTransaction(
            updatedBalance,
            amountt,
            "Offer bonus",
            "bonus",
            transaction_id_offer
          );

          await appliedOfferModel.create({
            user_id: paymentData.userid,
            offer_id: paymentData.offerid,
            transaction_id_offer,
          });
        }

        let depositKey = `userid:${paymentData.userid}-deposit:${processedPayment._id}`;
        await redisPayment.redis.hset(depositKey, processedPayment);

        let paymentDataRedis = await redisPayment.getTDSdata(paymentData.userid);

        let tdsWallet = {
          successPayment: Number(paymentDataRedis.successPayment) + Number(paymentData.amount),
          successWithdraw: paymentDataRedis.successWithdraw,
          tdsPaid: paymentDataRedis.tdsPaid
        }

        await redisPayment.updateTDSdata(paymentData.userid, tdsWallet);

      } else {
        console.log(`Transaction ${phonePeResponse.mchOrderNo} failed or pending.`);
        await depositModel.findOneAndUpdate(
          { txnid: phonePeResponse.mchOrderNo },
          { pay_id: phonePeResponse.orderNo },
          { new: true }
        );
      }
    }
    return {
      status: true,
      message: "Callback processed successfully."
    }
  } catch (error) {
    console.log('Error: ', error);
    return {
      status: false,
      message: 'Internal server error.'
    }
  }
}




// exports.winningToDepositTransfer = async (req) => {
//   try {

//  let appSettingdata = await redisMain.getkeydata('appSettingData');

//     if (appSettingdata) {
//       if (!appSettingdata?.selftransfer?.status) {
//         return {
//           status: false,
//           message: "Wallet transfer is temporarily unavailable.",
//         };
//       }
//     } else {
//       // If not found in Redis, fetch from DB
//       appSettingdata = await configModel.findOne(
//         { _id: mongoose.Types.ObjectId("667e5cf5cf5d2cc4d3353ecc") },
//         { "selftransfer.status": 1 }
//       ).lean();

//       if (!appSettingdata?.selftransfer?.status) {
//         return {
//           status: false,
//           message: "Wallet transfer is temporarily unavailable.",
//         };
//       }
//     }

//     if (!req.user?._id) {
//       return { 
//         message: "User not authenticated", 
//         status: false, 
//         data: {}
//        };
//     }

//     if (!req.body?.amount) {
//       return { 
//         message: "Amount is required", 
//         status: false, 
//         data: {} 
//       };
//     }

//     const userId = req.user._id;
//     const transferAmount = Number(req.body.amount);

//     if (isNaN(transferAmount)) {
//       return { 
//         message: "Invalid amount format", 
//         status: false, 
//         data: {}
//        };
//     }

//     if (transferAmount <= 0) {
//       return { 
//         message: "Transfer amount must be positive", 
//         status: false, 
//         data: {}
//        };
//     }

//     // const userDetails = await userModel.findOne({ _id: userId }, { 'userbalance.winning': 1 }).lean();

//     let userbalanceFromRedis = await redisUser.redis.hgetall(`wallet:{${userId}}`);
//     if (!userbalanceFromRedis) {
//         await redisUser.setDbtoRedisWallet(userId);
//         userbalanceFromRedis = await redisUser.redis.hgetall(`wallet:{${userId}}`);
//     }

//     const winningBalance = Number(userbalanceFromRedis?.winning) || 0;
//     const balance = Number(userbalanceFromRedis?.balance) || 0;
//     const bonus  = Number(userbalanceFromRedis?.bonus) || 0;

//     if (transferAmount > winningBalance) {
//       return { 
//         message: "Insufficient winning balance", 
//         status: false, 
//         data: {}
//        };
//     }

//     let appSetting = await redisMain.getkeydata('appSettingData');
//     if (!appSetting) {
//       appSetting = await configModel.findOne().lean();
//       if (appSetting) {
//         await redisMain.setkeydata('appSettingData', appSetting, 86400);
//       }
//     }

//     const bonusPercentage = appSetting?.winning_to_deposit || 0;
//     const rewardAmount = transferAmount * bonusPercentage / 100;
//     const amoutToAdd = transferAmount + rewardAmount;



//       const walletUpdateAfterTxn={ 
//         "balance": balance + amoutToAdd,
//         "winning": winningBalance-transferAmount,
//         "bonus": bonus
//       }

//       const winningTransactionId = new mongoose.Types.ObjectId();
//       const depositTransactionId = new mongoose.Types.ObjectId();
//       const selfTransactionId = new mongoose.Types.ObjectId();

//       const selfTxnData = {
//         _id: selfTransactionId,
//         user_id: userId,
//         requestedAmount: transferAmount,
//         totalAmount: amoutToAdd,
//         rewardAmount: rewardAmount,
//         winningTransactionId: winningTransactionId,
//         depositTransactionId: depositTransactionId
//       };
//     // await this.addAmountTransaction(
//     //   updateUserBalance,
//     //   amoutToAdd,
//     //   "Winning to Deposit Transfer",
//     //   "fund",
//     //   `${global.constant.APP_SHORT_NAME}-Offer-${Date.now()}`
//     // );

//     let randomStr = randomstring.generate({
//       length: 8,
//       charset: "alphabetic",
//       capitalization: "uppercase",
//     });
//     let randomStr2 = randomstring.generate({
//       length: 8,
//       charset: "alphabetic",
//       capitalization: "uppercase",
//     });
//     const transaction_id = `SelfTransfer-${Date.now()}-${randomStr}`;
//     const transaction_id2 = `SelfTransfer-${Date.now()}-${randomStr2}`;

//     const commonTransactionProps = {
//       transaction_by: global.constant.TRANSACTION_BY.APP_NAME,
//       userid: userId,
//       paymentstatus: global.constant.PAYMENT_STATUS_TYPES.CONFIRMED,
//       addfund_amt: amoutToAdd,
//       bal_fund_amt: walletUpdateAfterTxn.balance,
//       bal_win_amt: walletUpdateAfterTxn.winning,
//       bal_bonus_amt: walletUpdateAfterTxn.bonus,
//       selfTransactionId: selfTransactionId,
//       total_available_amt: walletUpdateAfterTxn.balance +  walletUpdateAfterTxn.winning +  walletUpdateAfterTxn.bonus
//     };

//     const commonTransactionPropsWinning = {
//       transaction_by: global.constant.TRANSACTION_BY.APP_NAME,
//       userid: userId,
//       paymentstatus: global.constant.PAYMENT_STATUS_TYPES.CONFIRMED,
//       win_amt: amoutToAdd,
//       bal_fund_amt: walletUpdateAfterTxn.balance,
//       bal_win_amt: walletUpdateAfterTxn.winning,
//       bal_bonus_amt: walletUpdateAfterTxn.bonus,
//       selfTransactionId: selfTransactionId,
//       total_available_amt: walletUpdateAfterTxn.balance +  walletUpdateAfterTxn.winning +  walletUpdateAfterTxn.bonus
//     };

//     // let txnrObj = {
//     //   txnid: transaction_id,
//     //   transaction_id: transaction_id,
//     //   transaction_type: "Credit",
//     //   userid: userId,
//     //   type: "Self Deposit",
//     //   paymentstatus:global.constant.PAYMENT_STATUS_TYPES.SUCCESS,
//     //   selfTransactionId: selfTransactionId,
//     //   amount: amoutToAdd,
//     //   wnningAmount : transferAmount
//     // };

//     // let txnr2Obj = {
//     //   txnid: transaction_id2,
//     //   transaction_id: transaction_id2,
//     //   transaction_type: "Debit",
//     //   userid: userId,
//     //   type: "Self Winning",
//     //   paymentstatus:global.constant.PAYMENT_STATUS_TYPES.SUCCESS,
//     //   selfTransactionId: selfTransactionId,
//     //   amount: transferAmount
//     // };

//     let txnrObj = {
//       txnid: transaction_id,
//       transaction_id: transaction_id,
//       transaction_type: "Credit",
//       userid: userId,
//       type: "Self Transfer",
//       paymentstatus:global.constant.PAYMENT_STATUS_TYPES.SUCCESS,
//       selfTransactionId: selfTransactionId,
//       amount: amoutToAdd,
//       wnningAmount : transferAmount,
//       cashback: rewardAmount
//     };

//     // const paymentProcessData = {
//     //   amount: amoutToAdd,
//     //   userid: userId,
//     //   paymentmethod: "Self Deposit",
//     //   orderid: transaction_id,
//     //   txnid: `${selfTransactionId}`,
//     //   payment_type: "Self Deposit",
//     //   status: "SUCCESS",
//     // }

//     await redisUser.saveTransactionToRedis(userId, walletUpdateAfterTxn, txnrObj);
//     // await redisUser.saveTransactionToRedis(userId, {}, txnr2Obj);


//     await Promise.all([
//       TransactionModel.create({
//         _id: depositTransactionId,
//         ...commonTransactionProps,
//         transaction_id : transaction_id2,
//         type: "Self Deposit",
//         amount: amoutToAdd
//       }),
//       TransactionModel.create({
//         _id: winningTransactionId,
//         ...commonTransactionPropsWinning,
//         transaction_id ,
//         type: "Self Winning",
//         amount: transferAmount
//       }),
//       await selfTransferModel.create(selfTxnData),
//       await userModel.findOneAndUpdate(
//         { _id: userId },
//         { 
//           $inc: { 
//             "userbalance.balance": amoutToAdd,
//             "userbalance.winning": -transferAmount
//           } 
//         },
//         { new: true }
//       ),
//       // depositModel.create(paymentProcessData)
//     ]);

//     let userData = await redisUser.redis.hgetall(`user:${userId}`);
//     if(!userData) {
//       userData = await userModel.findById(userId);
//       await redisUser.redis.hset(`user:${userId}`, userData);
//     }

//     return { 
//       data: {
//         name: userData.data.username,
//         mobile: userData.mobile,
//         winningTransactionId: transaction_id,
//         depositTransactionId: transaction_id2,
//         transferredAmount: transferAmount,
//         tds: 0,
//         cashback: rewardAmount,
//         receivedAmount: amoutToAdd,
//         dateTime:  moment().format("D MMM YYYY, hh:mm a")
//       },
//       status: true, 
//       message: "Amount transferred successfully"
//     };

//   } catch (error) {
//     console.log(error)
//     console.error("Error in winningToDepositTransfer:", error.message);
//     return { status: false, message: "Internal server error" };
//   }
// };




exports.winningToDepositTransfer = async (req) => {
  try {

    let appSettingdata = await redisMain.getkeydata('appSettingData');

    if (appSettingdata) {
      if (!appSettingdata?.selftransfer?.status) {
        return {
          status: false,
          message: "Wallet transfer is temporarily unavailable.",
        };
      }
    } else {
      // If not found in Redis, fetch from DB
      appSettingdata = await configModel.findOne(
        { _id: mongoose.Types.ObjectId("667e5cf5cf5d2cc4d3353ecc") },
        { "selftransfer.status": 1 }
      ).lean();

      if (!appSettingdata?.selftransfer?.status) {
        return {
          status: false,
          message: "Wallet transfer is temporarily unavailable.",
        };
      }
    }

    if (!req.user?._id) {
      return {
        message: "User not authenticated",
        status: false,
        data: {}
      };
    }

    if (!req.body?.amount) {
      return {
        message: "Amount is required",
        status: false,
        data: {}
      };
    }

    const userId = req.user._id;
    const transferAmount = Number(req.body.amount);

    if (isNaN(transferAmount)) {
      return {
        message: "Invalid amount format",
        status: false,
        data: {}
      };
    }

    if (transferAmount <= 0) {
      return {
        message: "Transfer amount must be positive",
        status: false,
        data: {}
      };
    }

    // const userDetails = await userModel.findOne({ _id: userId }, { 'userbalance.winning': 1 }).lean();

    let userbalanceFromRedis = await redisUser.redis.hgetall(`wallet:{${userId}}`);
    if (!userbalanceFromRedis) {
      await redisUser.setDbtoRedisWallet(userId);
      userbalanceFromRedis = await redisUser.redis.hgetall(`wallet:{${userId}}`);
    }

    const winningBalance = Number(userbalanceFromRedis?.winning) || 0;
    const balance = Number(userbalanceFromRedis?.balance) || 0;
    const bonus = Number(userbalanceFromRedis?.bonus) || 0;

    if (transferAmount > winningBalance) {
      return {
        message: "Insufficient winning balance",
        status: false,
        data: {}
      };
    }

    let appSetting = await redisMain.getkeydata('appSettingData');
    if (!appSetting) {
      appSetting = await configModel.findOne().lean();
      if (appSetting) {
        await redisMain.setkeydata('appSettingData', appSetting, 86400);
      }
    }

    const bonusPercentage = appSetting?.winning_to_deposit || 0;
    const rewardAmount = transferAmount * bonusPercentage / 100;
    const amoutToAdd = transferAmount + rewardAmount;



    const walletUpdateAfterTxn = {
      "balance": balance + amoutToAdd,
      "winning": winningBalance - transferAmount,
      "bonus": bonus
    }

    const winningTransactionId = new mongoose.Types.ObjectId();
    const depositTransactionId = new mongoose.Types.ObjectId();
    const selfTransactionId = new mongoose.Types.ObjectId();

    const selfTxnData = {
      _id: selfTransactionId,
      user_id: userId,
      requestedAmount: transferAmount,
      totalAmount: amoutToAdd,
      rewardAmount: rewardAmount,
      winningTransactionId: winningTransactionId,
      depositTransactionId: depositTransactionId
    };
    // await this.addAmountTransaction(
    //   updateUserBalance,
    //   amoutToAdd,
    //   "Winning to Deposit Transfer",
    //   "fund",
    //   `${global.constant.APP_SHORT_NAME}-Offer-${Date.now()}`
    // );

    let randomStr = randomstring.generate({
      length: 8,
      charset: "alphabetic",
      capitalization: "uppercase",
    });
    let randomStr2 = randomstring.generate({
      length: 8,
      charset: "alphabetic",
      capitalization: "uppercase",
    });
    const transaction_id = `SelfTransfer-${Date.now()}-${randomStr}`;
    const transaction_id2 = `SelfTransfer-${Date.now()}-${randomStr2}`;

    const commonTransactionProps = {
      transaction_by: global.constant.TRANSACTION_BY.APP_NAME,
      userid: userId,
      paymentstatus: global.constant.PAYMENT_STATUS_TYPES.CONFIRMED,
      addfund_amt: amoutToAdd,
      bal_fund_amt: walletUpdateAfterTxn.balance,
      bal_win_amt: walletUpdateAfterTxn.winning,
      bal_bonus_amt: walletUpdateAfterTxn.bonus,
      selfTransactionId: selfTransactionId,
      total_available_amt: walletUpdateAfterTxn.balance + walletUpdateAfterTxn.winning + walletUpdateAfterTxn.bonus
    };

    const commonTransactionPropsWinning = {
      transaction_by: global.constant.TRANSACTION_BY.APP_NAME,
      userid: userId,
      paymentstatus: global.constant.PAYMENT_STATUS_TYPES.CONFIRMED,
      win_amt: amoutToAdd,
      bal_fund_amt: walletUpdateAfterTxn.balance,
      bal_win_amt: walletUpdateAfterTxn.winning,
      bal_bonus_amt: walletUpdateAfterTxn.bonus,
      selfTransactionId: selfTransactionId,
      total_available_amt: walletUpdateAfterTxn.balance + walletUpdateAfterTxn.winning + walletUpdateAfterTxn.bonus
    };

    // let txnrObj = {
    //   txnid: transaction_id,
    //   transaction_id: transaction_id,
    //   transaction_type: "Credit",
    //   userid: userId,
    //   type: "Self Deposit",
    //   paymentstatus:global.constant.PAYMENT_STATUS_TYPES.SUCCESS,
    //   selfTransactionId: selfTransactionId,
    //   amount: amoutToAdd,
    //   wnningAmount : transferAmount
    // };

    // let txnr2Obj = {
    //   txnid: transaction_id2,
    //   transaction_id: transaction_id2,
    //   transaction_type: "Debit",
    //   userid: userId,
    //   type: "Self Winning",
    //   paymentstatus:global.constant.PAYMENT_STATUS_TYPES.SUCCESS,
    //   selfTransactionId: selfTransactionId,
    //   amount: transferAmount
    // };

    let txnrObj = {
      txnid: transaction_id,
      transaction_id: transaction_id,
      transaction_type: "Credit",
      userid: userId,
      type: "Self Transfer",
      paymentstatus: global.constant.PAYMENT_STATUS_TYPES.SUCCESS,
      selfTransactionId: selfTransactionId,
      amount: amoutToAdd,
      wnningAmount: transferAmount,
      cashback: rewardAmount
    };

    // const paymentProcessData = {
    //   amount: amoutToAdd,
    //   userid: userId,
    //   paymentmethod: "Self Deposit",
    //   orderid: transaction_id,
    //   txnid: `${selfTransactionId}`,
    //   payment_type: "Self Deposit",
    //   status: "SUCCESS",
    // }

    await redisUser.saveTransactionToRedis(userId, walletUpdateAfterTxn, txnrObj);
    // await redisUser.saveTransactionToRedis(userId, {}, txnr2Obj);


    // await Promise.all([
    await sendToQueue('selftransfer-topic', {
      depositTransactionId: depositTransactionId,
      winningTransactionId: winningTransactionId,
      selfTransactionId: selfTransactionId,
      userId: userId,
      amoutToAdd: amoutToAdd,
      transferAmount: transferAmount,
      transaction_id: transaction_id,
      transaction_id2: transaction_id2,
      commonTransactionProps: commonTransactionProps,
      commonTransactionPropsWinning: commonTransactionPropsWinning,
      selfTxnData: selfTxnData
    })
    // TransactionModel.create({
    //   _id: depositTransactionId,
    //   ...commonTransactionProps,
    //   transaction_id : transaction_id2,
    //   type: "Self Deposit",
    //   amount: amoutToAdd
    // }),
    // TransactionModel.create({
    //   _id: winningTransactionId,
    //   ...commonTransactionPropsWinning,
    //   transaction_id ,
    //   type: "Self Winning",
    //   amount: transferAmount
    // }),
    // await selfTransferModel.create(selfTxnData),
    // await userModel.findOneAndUpdate(
    //   { _id: userId },
    //   { 
    //     $inc: { 
    //       "userbalance.balance": amoutToAdd,
    //       "userbalance.winning": -transferAmount
    //     } 
    //   },
    //   { new: true }
    // ),
    // // depositModel.create(paymentProcessData)
    // ]);

    let userData = await redisUser.redis.hgetall(`user:${userId}`);
    if (!userData) {
      userData = await userModel.findById(userId);
      await redisUser.redis.hset(`user:${userId}`, userData);
    }

    return {
      data: {
        name: userData.data.username,
        mobile: userData.mobile,
        winningTransactionId: transaction_id,
        depositTransactionId: transaction_id2,
        transferredAmount: transferAmount,
        tds: 0,
        cashback: rewardAmount,
        receivedAmount: amoutToAdd,
        dateTime: moment().format("D MMM YYYY, hh:mm a")
      },
      status: true,
      message: "Amount transferred successfully"
    };

  } catch (error) {
    console.log(error)
    console.error("Error in winningToDepositTransfer:", error.message);
    return { status: false, message: "Internal server error" };
  }
};
