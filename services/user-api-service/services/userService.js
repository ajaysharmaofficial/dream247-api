const mongoose = require("mongoose");
const axios = require("axios");
const HTTP_STATUS = require("http-status-codes");
const randomstring = require("randomstring");
const jwt = require("jsonwebtoken");
const moment = require("moment");
const mailgun = require("mailgun-js");

const userModel = require("../../../models/userModel");
const promoterCommissionLogsModel = require("../../../models/promoterCommissionLogsModel.js");
const configModel = require("../../../models/configModel.js");
const walletTransactionModel = require("../../../models/walletTransactionModel.js");
const adminModel = require("../../../models/adminModel");
const fantasyTypeModel = require("../../../models/fantasyModels.js");
// const playingLevelModel = require("../../../models/playingLevel");
const affiliatorModel = require("../../../models/affiliatorModel.js");
const resultSummaryModel = require("../../../models/resultSummaryModel.js");
const customerSupportModel = require("../../../models/customerSupportModel.js");
const redisMain = require("../../../utils/redis/redisMain");
const redisUser = require("../../../utils/redis/redisUser");
const redisTransaction = require("../../../utils/redis/redisTransaction");
const { sendToQueue } = require("../../../utils/kafka.js");
const qs = require("querystring");

const GetBonus = require("../../../utils/getBonus");
// const { promisify } = require("util");
// const signAsync = promisify(jwt.sign);
// const { SignJWT } = require('jose');

/**
 * @function genrateReferCode
 * @description using this function to generate refercode for user
 * @param {mobile}
 * @author
 */
// async function genrateReferCode(mobile) {
//   const char = String(mobile).substring(0, 4);
//   const coupon = randomstring.generate({
//     charset: "alphanumeric",
//     length: 4,
//   });
//   let referCode = `${global.constant.APP_SHORT_NAME}${char}${coupon.toUpperCase()}`;
//   const checkReferCode = await userModel.findOne({
//     refer_code: referCode.toUpperCase(),
//   });
//   if (checkReferCode) {
//     await genrateReferCode(mobile);
//   }
//   return referCode;
// };
async function genrateReferCode(mobile) {
  const { v4: uuidv4 } = require("uuid");
  const prefix = global.constant.APP_SHORT_NAME; // Default prefix if not defined

  const numericPart = String(Date.now()).slice(-6); // Last 6 digits of timestamp (e.g., "119351")

  const uniqueId = uuidv4().replace(/-/g, "").substring(0, 4).toUpperCase(); // 4 random alphanumeric characters (e.g., "HEVL")

  return `${prefix}${numericPart}${uniqueId}`;
}
// async function generateTeamName(mobile) {
//   const char = String(mobile).substring(0, 4);
//   const uniqueStr = randomstring.generate({
//     charset: "alphanumeric",
//     length: 6,
//   });
//   let teamName = `${char}${uniqueStr.toUpperCase()}`;
//   const checkForDupName = await userModel.findOne({
//     team: teamName.toUpperCase(),
//   });
//   if (checkForDupName) {
//     await generateTeamName(mobile);
//   }
//   return teamName;
// }
async function generateTeamName(mobile) {
  const mobileStr = String(mobile);
  const first3 = mobileStr.substring(0, 3);
  const last2 = mobileStr.substring(mobileStr.length - 2);

  while (true) {
    const part1 = randomstring
      .generate({
        charset: "alphanumeric",
        length: 5,
      })
      .toUpperCase();

    const part2 = randomstring
      .generate({
        charset: "alphanumeric",
        length: 5,
      })
      .toUpperCase();

    const teamName = `${first3}${part1}${last2}${part2}`;

    const checkForDupName = await userModel.findOne({ team: teamName });
    if (!checkForDupName) {
      return teamName;
    }
  }
}

exports.dbCheck = async () => {
  try {
    const TIMEOUT_DURATION = 3000; // 3 seconds timeout

    // Helper function for timeout handling
    const withTimeout = (promise, ms, timeoutMessage) =>
      Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(timeoutMessage)), ms)
        ),
      ]);

    let mongoConnected = false;
    let redisConnected = false;

    try {
      // MongoDB Health Check
      mongoConnected = await withTimeout(
        new Promise((resolve) => resolve(mongoose.connection.readyState === 1)),
        TIMEOUT_DURATION,
        "MongoDB check timed out"
      );
    } catch (error) {
      console.error("❌ MongoDB Error:", error.message);
    }

    try {
      // Redis Health Check
      redisConnected = await withTimeout(
        redisMain.healthCheck().then((res) => res === "PONG"),
        TIMEOUT_DURATION,
        "Redis check timed out"
      );
    } catch (error) {
      console.error("❌ Redis Error:", error.message);
    }

    // Determine overall health status
    const isHealthy = mongoConnected && redisConnected;

    return {
      status: isHealthy,
      database: {
        status: mongoConnected,
        message: mongoConnected
          ? "✅ MongoDB is connected."
          : "❌ MongoDB is not connected.",
      },
      redis: {
        status: redisConnected,
        message: redisConnected
          ? "✅ Redis is connected."
          : "❌ Redis is not responding.",
      },
    };
  } catch (error) {
    return {
      status: false,
      database: {
        status: false,
        message: "Database health check failed.",
        error: error.message.includes("MongoDB") ? error.message : undefined,
      },
      redis: {
        status: false,
        message: "Redis health check failed.",
        error: error.message.includes("Redis") ? error.message : undefined,
      },
    };
  }
};
const sendEventToGA = async () => {
  try {
    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${global.constant.MEASUREMENT_KEY}&api_secret=${global.constant.GA_SECRET_KEY}`;

    const data = {
      client_id: "123456", // Any random unique ID (or from frontend)
      events: [
        {
          name: "purchase",
          params: {
            currency: "USD",
            value: 9.99,
          },
        },
      ],
    };

    const response = await axios.post(url, data);
    console.log("GA Event Sent", response.status);
  } catch (error) {
    console.log("error", error);
  }
};
exports.getVersion = async (req) => {
  try {
    let pdfURL = `${global.constant.IMAGE_URL}pdfs`;
    let keyname = `getversion`;
    redisMain.deletedata(keyname);
    let redisdata = await redisMain.getkeydata(keyname);
    if (redisdata) {
      const authHeader = req.header("Authorization");
      if (authHeader) {
        const token = authHeader.replace("Bearer ", "");
        const decoded = jwt.verify(token, global.constant.SECRET_TOKEN);
        if (!decoded) {
          throw new Error("Invalid token payload");
        }

        return redisdata;
      } else {
        return redisdata;
        // return {
        //   message: "Android Version Details...!",
        //   status: true,
        //   data: {
        //     androidversion: redisdata.data.androidversion,
        //     version: redisdata.data.version,
        //     point: redisdata.data.point,
        //     iOSversion: redisdata.data.iOSversion,
        //     maintenance: redisdata.data.maintenance,
        //     iOSmaintenance: redisdata.data.iOSmaintenance,
        //     apkname: redisdata.data.apkname,
        //     androidappurl: redisdata.data.androidappurl
        //   }
        // }
      }
    } else {
      let adminData = await adminModel.aggregate([
        {
          $match: {
            role: "0",
          },
        },
        {
          $unwind: {
            path: "$sidebanner",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            // _id: 0,
            type: "$sidebanner.type",
            url: "$sidebanner.url",
            bannerType: "$sidebanner.bannerType",
            image: {
              $concat: [`${global.constant.IMAGE_URL}`, "$sidebanner.image"],
            },
            sliderid: "$sidebanner._id",
            androidversion: "$androidversion",
            general_tabs: "$general_tabs",
            popup_notify_image: "$popup_notify_image",
          },
        },
        {
          $group: {
            _id: "$_id",
            bannerData: {
              $push: {
                type: "$type",
                bannerType: "$bannerType",
                image: "$image",
                sliderid: "$sliderid",
              },
            },
            androidversion: { $first: "$androidversion" },
            general_tabs: { $first: "$general_tabs" },
            popup_notify_image: { $first: "$popup_notify_image" },
          },
        },
      ]);

      let appSettingData = await configModel.aggregate([
        {
          $project: {
            supportmobile: 1,
            supportemail: 1,
            updatePoints: 1,
            minwithdraw: {
              $toInt: "$minwithdraw",
            },
            maxwithdraw: {
              $toInt: "$maxwithdraw",
            },
            version: {
              $toInt: "$version",
            },
            androidversion: {
              $toInt: "$androidversion",
            },
            iOSversion: {
              $toInt: "$iOSversion",
            },
            maintenance: {
              $toInt: "$maintenance",
            },
            iOSmaintenance: {
              $toInt: "$iOSmaintenance",
            },
            minadd: {
              $toInt: "$minadd",
            },
            disableWithdraw: {
              $toInt: "$disableWithdraw",
            },
            seriesLeaderboard: 1,
            investmentLeaderboard: 1,
            privateContest: 1,
            guruTeam: 1,
            isSabPaisa: 1,
            isRazorPay: 1,
            isCashFree: 1,
            isPhonePe: 1,
            isYesBank: 1,
            isPaySprint: 1,
            tds: 1,
            winning_to_deposit: 1,
            androidpaymentgateway: 1,
            iospaymentgateway: 1,
            myjoinedContest: 1,
            viewcompletedmatches: 1,
            verificationOnJoinContest: 1,
            selftransfer: 1,
            ptoptransfer: 1,
            transactionDetails: 1,
            joinContest: 1,
            p_to_p: 1,
            gst: 1,
            cricketgame: 1,
            dualgame: 1,
            flexibleContest: 1,
            applyForGuru: 1,
          },
        },
      ]);
      const games = await fantasyTypeModel
        .find(
          { status: "enable" },
          { fantasyName: 1, image: 1, type: 1, sport_category: 1 }
        )
        .sort({ order: 1 });
      console.log(adminData, "adminDiatataiiiiiiiiiiiiiiiiiii");
      if (!adminData[0]?.androidversion)
        return {
          status: false,
          message: "Something went wrong",
          data: { status: "", point: "" },
        };
      let referBonus = adminData[0].general_tabs.find(
        (item) => item.type === "refer_bonus"
      )?.amount;
      // console.log('appSettingData', appSettingData);
      let data = {
        message: "Android Version Details...!",
        status: true,
        data: {
          androidpaymentgateway: appSettingData[0].androidpaymentgateway,
          iospaymentgateway: appSettingData[0].iospaymentgateway,
          version: appSettingData[0].version,
          point: adminData[0].androidversion.updation_points,
          appstatus: "1",
          androidversion: appSettingData[0].androidversion,
          winning_to_deposit: appSettingData[0].winning_to_deposit,
          iOSversion: appSettingData[0].iOSversion,
          maintenance: appSettingData[0].maintenance,
          iOSmaintenance: appSettingData[0].iOSmaintenance,
          referurl: `${global.constant.REFERAL_URL}%REFERCODE%`,
          apkname: `${global.constant.APP_SHORT_NAME}.apk`,
          androidappurl: `${global.constant.APK_URL}`,
          refermessage: `🎉 Refer and Earn Rewards!  🎉 Refer a friend and earn ₹ ${referBonus} for the referrer, and the referred user receives ₹ ${referBonus} upon downloading using this link: ${global.constant.REFERAL_URL}%REFERCODE% .Don't forget to use the referral code: %REFERCODE% .`,
          contestsharemessage:
            "⚔️ %TeamName% challenged you for a fantasy contest in %Team1% vs %Team2% match on %AppName%. Visit for Android 📱: %url_share% to accept the challenge. 🏆 Alternatively, you can also copy code %inviteCode% to join the contest. 🚀 ",
          minwithdraw: appSettingData[0].minwithdraw,
          maxwithdraw: appSettingData[0].maxwithdraw,
          refer_bonus: referBonus,
          signup_bonus: adminData[0].general_tabs.find(
            (item) => item.type === "mobile_bonus"
          ).amount,
          minadd: appSettingData[0].minadd,
          supportmobile: appSettingData[0].supportmobile,
          supportemail: appSettingData[0].supportemail,
          disableWithdraw: appSettingData[0].disableWithdraw,
          updationmessage: appSettingData[0].updatePoints,
          games,
          bannerData: adminData[0].bannerData,
          // phonePe: appSettingData[0].phonePe === "enabled" ? true : false,
          // sabPaisa: appSettingData[0].sabPaisa === "enabled" ? true : false,
          // razorPay: appSettingData[0].razorPay === "enabled" ? true : false,
          // cashFree: appSettingData[0].cashFree === "enabled" ? true : false,
          // yesBank: appSettingData[0].yesBank === "enabled" ? true : false,
          // paySprint: appSettingData[0].paySprint === "enabled" ? true : false,
          isPhonePe: appSettingData[0].isPhonePe,
          isSabPaisa: appSettingData[0].isSabPaisa,
          isRazorPay: appSettingData[0].isRazorPay,
          isCashFree: appSettingData[0].isCashFree,
          isYesBank: appSettingData[0].isYesBank,
          isPaySprint: appSettingData[0].isPaySprint,
          seriesLeaderboard: appSettingData[0].seriesLeaderboard,
          investmentLeaderboard: appSettingData[0].investmentLeaderboard,
          privateContest: appSettingData[0].privateContest,
          guruTeam: appSettingData[0].guruTeam,
          tds: appSettingData[0].tds,
          s3Folder: process.env.secretManager,
          popup_notify_image: adminData[0]?.popup_notify_image
            ? `${global.constant.IMAGE_URL}${adminData[0].popup_notify_image}`
            : "",
          myjoinedContest: appSettingData[0].myjoinedContest,
          viewcompletedmatches: appSettingData[0].viewcompletedmatches,
          verificationOnJoinContest:
            appSettingData[0].verificationOnJoinContest,
          selftransfer: appSettingData[0].selftransfer,
          ptoptransfer: appSettingData[0].ptoptransfer,
          transactionDetails: appSettingData[0].transactionDetails,
          joinContest: appSettingData[0].joinContest,
          p_to_p: appSettingData[0].p_to_p,
          gst: appSettingData[0].gst,
          pdfURL: pdfURL,
          flexibleContest: appSettingData[0].flexibleContest,
          dualgame: appSettingData[0].dualgame,
          cricketgame: appSettingData[0].cricketgame,
          applyForGuru: appSettingData[0].applyForGuru,
          playerJsonUrl: `${global.constant.IMAGE_URL}playerFiles/`,
        },
      };
      // console.log('data', JSON.stringify(data));
      await redisMain.setkeydata(keyname, data, 60 * 60 * 60 * 24);
      return data;
    }
  } catch (error) {
    console.error("Get Version Error:", error);
    return {
      status: false,
      message: "Something went wrong. Please try again after some time.",
      error: error.message,
    };
  }
};

// Helper function to send OTP - HSP SMS
async function sendOTPOld(mobile, otp) {
  try {
    const HSPSMS_USERNAME = process.env.HSPSMS_USERNAME;
    const HSPSMS_API_KEY = process.env.HSPSMS_API_KEY;
    const HSPSMS_SENDERID = process.env.HSPSMS_SENDERID;

    const message = `${otp} is the OTP for your account. Do not share this with anyone. we will never call or message asking for OTP. ADVAYA INNOVATION PRIVATE LIMITED.`;

    const params = {
      username: HSPSMS_USERNAME,
      apikey: HSPSMS_API_KEY,
      sendername: HSPSMS_SENDERID,
      smstype: "TRANS",
      numbers: `91${mobile}`, // ensure country code
      message,
    };

    const url = `http://sms.hspsms.com/sendSMS?${qs.stringify(params)}`;

    const response = await axios.get(url);
    console.log("HSPSMS Response:", response.data);

    if (
      Array.isArray(response.data) &&
      response.data[0]?.responseCode?.includes("SuccessFully")
    ) {
      return true;
    }
    return false;
  } catch (error) {
    console.error(
      "OTP sending failed (HSPSMS):",
      error.response?.data || error.message
    );
    return false;
  }
}

async function sendOTP(mobile, otp) {
  try {
    // console.log(mobile, "----mobile---->>")
    // const SMS_AUTH_KEY = process.env.SMS_AUTH_KEY;
    // const SMS_SENDERID = process.env.SMS_SENDERID;
    // const DLT_TE_ID = process.env.DLT_TE_ID;

    const message = `${otp} Login OTP. Please do not share with anyone Xam Tech`;

    const params = {
      authkey: SMS_AUTH_KEY,
      mobiles: `91${mobile}`,
      sender: SMS_SENDERID,
      route: 4,
      country: 0,
      DLT_TE_ID,
      message,
    };

    console.log(params, "----params---");

    const url = `https://m.xsms.in/api/sendhttp.php?${qs.stringify(params)}`;

    const response = await axios.get(url);
    console.log(response.data, "<<<<------------XSMS Response:--------");

    // xsms returns string: "MessageID..." or "Error..."
    if (
      typeof response.data === "string" &&
      !response.data.toLowerCase().includes("error")
    ) {
      return true;
    }

    return false;
  } catch (error) {
    console.error(
      "OTP sending failed (XSMS):",
      error.response?.data || error.message
    );
    return false;
  }
}

// // Helper function to send OTP - TWO FACTOR API
// async function sendOTP(mobile, otp) {
//   try {
//     let TWO_FACTOR_API_KEY = global.constant.TWO_FACTOR_API_KEY;
//     let OTP_TEMPLATE = global.constant.OTP_TEMPLATE;
//     const mobileNumber = Number(mobile);
//     const url = `https://2factor.in/API/V1/${TWO_FACTOR_API_KEY}/SMS/${mobileNumber}/${otp}/${OTP_TEMPLATE}`;
//     const response = await axios.get(url);
//     return response.data.Status === "Success";
//   } catch (error) {
//     console.error('OTP sending failed:', error);
//     return false;
//   }
// }

async function sendOtpthroughF2s(mobile, otp) {
  try {
    let fast2smsapi_key = global.constant.YOUR_FAST2SMS_API_KEY;
    const response = await axios.post(
      "https://www.fast2sms.com/dev/bulkV2",
      {
        route: "otp",
        variables_values: otp,
        numbers: mobile,
      },
      {
        headers: {
          authorization: fast2smsapi_key, // Replace with your Fast2SMS API key
          "Content-Type": "application/json",
        },
      }
    );

    console.log("OTP sent successfully:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error sending OTP:", error.response?.data || error.message);
    throw error;
  }
}

/**
 * @deprecated - OTP verification is now handled by Shop backend
 * Fantasy app receives verified users via /internal/sync-user or /login endpoints
 */
exports.addTempUser = async (req) => {
  try {
    const { mobile: reqMobile, refercode } = req.body;
    // console.log("mobile---------", reqMobile);
    // Check for existing user
    if (reqMobile) {
      let keyMobile = `user-${reqMobile}`;
      let userId = await redisUser.getkeydata(keyMobile);
      let existingUser = null;
      if (!userId) {
        // console.log("userId not found");
        // Fetch user from DB if not in Redis
        existingUser = await userModel.findOne({ mobile: reqMobile });
        // console.log("existingUser", existingUser);
        if (existingUser) {
          userId = existingUser._id.toString();
          await redisUser.setUser(existingUser);
          await redisUser.setkeydata(keyMobile, userId, 60 * 60 * 60); // Store mobile -> userId mapping
        }
      }

      if (userId && !existingUser) {
        existingUser = await redisUser.getUser(userId);
        if (!existingUser) {
          existingUser = await userModel.findById(userId);
          if (existingUser) await redisUser.setUser(existingUser);
        }
      }
      // console.log("existingUser final------", existingUser);
      if (existingUser) return this.loginUser(req, existingUser);
    }

    // Validate referral code
    let referId;
    if (refercode) {
      const referrer = await userModel.findOne({ refer_code: refercode });
      if (!referrer)
        return { message: "Invalid refer code", status: false, data: "" };
      referId = referrer._id;
    }

    // Generate OTP
    let otp =
      process.env.secretManager === "prod"
        ? Math.floor(100000 + Math.random() * 900000)
        : 123456;

    // if (reqMobile == "9462636977") {
    otp = 123456;
    // }

    // if (process.env.secretManager === "prod") {
    //   const smsResponse = await sendOTP(reqMobile, otp);
    //   if (!smsResponse)
    //     return {
    //       status: false,
    //       message: "Failed to send OTP. Please try again.",
    //       data: [],
    //     };
    // }

    // Update or create temp user
    // const tempUser = await tempuserModel.findOneAndUpdate(
    //   { mobile: reqMobile },
    //   { mobile: reqMobile, refer_id: referId, code: otp },
    //   { new: true, upsert: true }
    // );

    const tempUser = {
      mobile: reqMobile,
      refer_id: referId,
    };

    const keyMobile = `tempuser:${reqMobile}`;
    const otpMobile = `otp-${reqMobile}`;
    let otpData = { code: otp };
    await redisUser.setkeydata(otpMobile, otpData, 60 * 60);
    await redisUser.setkeydata(keyMobile, tempUser, 60 * 60);

    return {
      message: "OTP has been sent to your mobile number.",
      status: true,
      data: { tempUser: keyMobile },
    };
  } catch (error) {
    console.error("addTemporaryUser Error:", error);
    return {
      status: false,
      message: "Something went wrong. Please try again after some time.",
    };
  }
};

exports.loginUser = async (req, user) => {
  try {
    const { mobile } = user;
    if (!mobile) {
      return {
        status: false,
        message: "Mobile number is required",
        data: {},
      };
    }

    // Check user existence
    // const user = await userModel.findOne({ mobile });
    // if (!user) {
    //   return {
    //     status: false,
    //     message: "This mobile number is not registered.",
    //     data: {}
    //   };
    // }

    // Check account status
    if (user.status.toLowerCase() === "blocked") {
      return {
        status: false,
        message: "Account blocked. Please contact administrator.",
        data: {},
      };
    }

    // Generate OTP
    let otp =
      process.env.secretManager === "prod"
        ? Math.floor(100000 + Math.random() * 900000)
        : 123456;

    // if (mobile == "9462636977") {
    otp = 123456;
    // }

    // if (process.env.secretManager === "prod") {
    //   const smsResponse = await sendOTP(mobile, otp);

    //   if (!smsResponse)
    //     return {
    //       status: false,
    //       message: "Failed to send OTP. Please try again.",
    //       data: [],
    //     };
    // }
    let keyname = `otp-${mobile}`;
    let otpData = { code: otp };
    redisUser.setkeydata(keyname, otpData, 60 * 60);

    // Update user with new OTP
    // const updatedUser = await userModel.updateOne(
    //   { mobile },
    //   { code: otp }
    // );

    return {
      status: true,
      message: "OTP has been sent to your mobile number.",
      data: { userId: user._id },
    };
  } catch (error) {
    console.error("loginUser Error:", error);
    return {
      status: false,
      message: "Something went wrong. Please try again after some time.",
    };
  }
};

// exports.verifyLoginOtp = async(req) => {
//   try {
//     const { BONUS_TYPES, BONUS, APP_SHORT_NAME, SECRET_TOKEN, USER_TYPE } = global.constant;
//     const { tempUser, otp, mobile, appid } = req.body;
//     let user = null;

//     // Temp user registration flow
//     if (tempUser) {
//       const tempUserRecord = await tempuserModel.findOne({ _id: tempUser, code: otp });
//       if (!tempUserRecord) return { status: false, message: "Invalid OTP", data: {} };

//       // Get bonuses in parallel
//       const [mobileBonus, signupReward] = await Promise.all([
//         new GetBonus().getBonus(BONUS_TYPES.MOBILE_BONUS, false),
//         new GetBonus().getBonus(BONUS_TYPES.SIGNUP_BONUS, false)
//       ]);

//       // Create new user
//       user = await userModel.create({
//         ...tempUserRecord.toObject(),
//         refer_code: await this.genrateReferCode(tempUserRecord.mobile),
//         team: await this.generateTeamName(tempUserRecord.mobile),
//         userbalance: { bonus: mobileBonus + signupReward, balance: 0 },
//         app_key: appid || "",
//         user_verify: { mobile_verify: 1, signupbonus: 1 }
//       });

//       // Process referral and transactions
//       if (tempUserRecord.refer_id) {
//         const [referrer, adminConfig] = await Promise.all([
//           userModel.findById(tempUserRecord.refer_id),
//           adminModel.findOne({ role: "0" })
//         ]);

//         if (referrer && adminConfig) {
//           const referBonus = adminConfig.general_tabs.find(t => t.type === BONUS_TYPES.REFER_BONUS);
//           if (referBonus) {
//             await userModel.updateOne(
//               { _id: referrer._id },
//               { $inc: { "userbalance.bonus": referBonus.amount, totalreferAmount: referBonus.amount, totalrefercount: 1 } }
//             );
//             await walletTransactionModel.create({
//               userid: referrer._id,
//               type: BONUS.REFER_BONUS,
//               transaction_id: `${APP_SHORT_NAME}-EBONUS-${Date.now()}`,
//               amount: referBonus.amount,
//               bonus_amt: referBonus.amount,
//               bal_bonus_amt: referrer.userbalance.bonus + referBonus.amount,
//               total_available_amt: referrer.userbalance.bonus + referrer.userbalance.balance + referBonus.amount,
//               referredUser: user._id
//             });
//           }
//         }
//       }

//       // Finalize user creation
//       const token = jwt.sign({ _id: user._id }, SECRET_TOKEN);
//       await Promise.all([
//         tempuserModel.deleteOne({ _id: tempUser }),
//         userModel.updateOne({ _id: user._id }, { auth_key: token }),
//         walletTransactionModel.insertMany([
//           {
//             userid: user._id,
//             type: BONUS.SIGNUP_BONUS,
//             transaction_id: `${APP_SHORT_NAME}-${BONUS_TYPES.SIGNUP_BONUS}-${Date.now()}`,
//             amount: signupReward,
//             bonus_amt: signupReward,
//             bal_bonus_amt: signupReward,
//             total_available_amt: signupReward
//           },
//           {
//             userid: user._id,
//             type: BONUS.MOBILE_BONUS,
//             transaction_id: `${APP_SHORT_NAME}-${BONUS_TYPES.MOBILE_BONUS}-${Date.now()}`,
//             amount: mobileBonus,
//             bonus_amt: mobileBonus + signupReward,
//             bal_bonus_amt: mobileBonus + signupReward,
//             total_available_amt: mobileBonus + signupReward
//           }
//         ])
//       ]);

//     } else { // Existing user login
//       user = await userModel.findOne({ mobile, code: otp });
//       if (!user) return { status: false, message: "Invalid OTP", data: {} };
//       if (user.status.toLowerCase() === 'blocked') {
//         return { status: false, message: "Account blocked. Contact administrator.", data: {} };
//       }

//       const token = jwt.sign({ _id: user._id }, SECRET_TOKEN);
//       await userModel.findByIdAndUpdate(user._id, {
//         auth_key: token,
//         app_key: appid || "",
//         $addToSet: { device_id: req.body.device_id }
//       });
//     }

//     if (!user) return { status: false, message: "Authentication failed", data: {} };

//     return {
//       status: true,
//       message: "Login successful",
//       data: {
//         token: user.auth_key,
//         auth_key: user.auth_key,
//         userid: user._id,
//         type: user.type ? `${user.type} ${USER_TYPE.USER}` : USER_TYPE.NORMAL_USER
//       }
//     };
//   } catch (error) {
//     console.error("verifyLoginOtp Error:", error);
//     return {
//       status: false,
//       message: "Something went wrong. Please try again after some time."
//     };
//   }
// }

/**
 * @deprecated - OTP verification is now handled by Shop backend
 * Use /login endpoint after user is synced via /internal/sync-user
 */
exports.verifyOtp = async (req) => {
  try {
    // console.log("-----req.body----", req.body)
    let user = {};
    let data = {};
    let token = null;
    let refreshToken = null;
    if (req.body.tempUser) {
      // const findTempUser = await tempuserModel.find({
      //   _id: req.body.tempUser,
      //   code: req.body.otp,
      // });
      const keyMobile = `tempuser:${req.body.mobile}`;

      const tempUser = await redisUser.getkeydata(keyMobile);
      // console.log(tempUser, "pppppp")

      if (!tempUser) {
        return {
          status: false,
          message: "Invalid temporary user ID",
          data: {},
        };
      }

      let keyname = `otp-${req.body.mobile}`;
      let getOtp = await redisUser.getkeydata(keyname);
      // console.log("getOtp", getOtp, req.body.otp);
      if (getOtp.code == req.body.otp) {
        let mobileBonus = await new GetBonus().getBonus(
          global.constant.BONUS_TYPES.MOBILE_BONUS,
          global.constant.PROFILE_VERIFY_BONUS_TYPES_VALUES.FALSE
        );

        let signupReward = await new GetBonus().getBonus(
          global.constant.BONUS_TYPES.SIGNUP_BONUS,
          global.constant.PROFILE_VERIFY_BONUS_TYPES_VALUES.FALSE
        );
        const getReferCode = await genrateReferCode(req.body.mobile);
        const crypto = await import("node:crypto");
        if (!globalThis.crypto) {
          globalThis.crypto = crypto.webcrypto;
        }
        const team = await generateTeamName(tempUser.mobile);
        const newUserId = new mongoose.Types.ObjectId();
        console.log(newUserId, "ppppppppp");
        // console.log("newUserId", newUserId);
        // console.log("newUserId", newUserId.toString());
        const getNewbalance = mobileBonus + signupReward;
        const { SignJWT } = await import("jose"); // Dynamic import
        const secret = Buffer.from(global.constant.SECRET_TOKEN);
        
        // Generate short-lived access token (15 minutes)
        const accessToken = await new SignJWT({ 
          _id: newUserId.toString(),
          userId: newUserId.toString(),
          mobile: req.body.mobile,
          modules: ['shop', 'fantasy'],
          shop_enabled: true,
          fantasy_enabled: true
        })
          .setProtectedHeader({ alg: "HS256" })
          .setExpirationTime('15m')  // Short-lived for security
          .setIssuedAt()
          .sign(secret);
        
        // Generate long-lived refresh token (30 days)
        refreshToken = await new SignJWT({
          userId: newUserId.toString(),
          type: 'refresh',
          mobile: req.body.mobile
        })
          .setProtectedHeader({ alg: "HS256" })
          .setExpirationTime('30d')  // Long-lived
          .setIssuedAt()
          .sign(secret);
        
        token = accessToken;
        data["_id"] = newUserId.toString();
        data["mobile"] = req.body.mobile;
        data["shop_enabled"] = true;
        data["fantasy_enabled"] = true;
        data["modules"] = ['shop', 'fantasy'];
        data["refer_code"] = getReferCode;
        data["refer_id"] = tempUser.refer_id;
        data["team"] = team;
        data["auth_key"] = accessToken;
        data["refresh_token"] = refreshToken;
        data["user_verify"] = { mobile_verify: 1, signupbonus: 1 };
        data["userbalance"] = {
          bonus: Number(getNewbalance),
          balance: 0,
        };
        data["app_key"] = req.body.appid || "";
        data["createdAt"] = new Date();
        // console.log("data", data);
        await redisUser.setUser(data);
        const msg = {
          payload: data,
          modelName: "user",
          extraData: {
            mobileBonus: mobileBonus,
            signupReward: signupReward,
          },
        };
        sendToQueue("registerNewUser", msg);
      } else {
        return {
          status: false,
          message: "Invalid OTP",
          data: { auth_key: 0, userid: 0 },
        };
      }
    } else {
      let keyname = `otp-${req.body.mobile}`;
      let getOtp = await redisUser.getkeydata(keyname);
      if (getOtp && getOtp?.code == req.body.otp) {
        redisUser.deletedata(keyname);
        let keyMobile = `user-${req.body.mobile}`;
        let userId = await redisUser.getkeydata(keyMobile);
        if (!userId) {
          // Fetch user from DB if not in Redis
          user = await userModel.findOne({ mobile: req.body.mobile });
          if (user) {
            userId = user._id.toString();
            await redisUser.setUser(user);
            await redisUser.setkeydata(keyMobile, userId, 60 * 60 * 60); // Store mobile -> userId mapping
          }
        }
        if (userId && Object.keys(user).length === 0) {
          user = await redisUser.getUser(userId);
          if (!user) {
            user = await userModel.findById(userId);
            if (user) await redisUser.setUser(user);
          }
        }
      } else {
        return {
          status: false,
          message: "Invalid OTP",
          data: { auth_key: 0, userid: 0 },
        };
      }
      // console.log('user', user);
      if (!user || Object.keys(user).length === 0) {
        let keyMobile = `user-${req.body.mobile}`;
        let userId = await redisUser.getkeydata(keyMobile);
        if (!userId) {
          // Fetch user from DB if not in Redis
          user = await userModel.findOne({ mobile: req.body.mobile });
          if (user) {
            userId = user._id.toString();
            await redisUser.setUser(user);
            await redisUser.setkeydata(keyMobile, userId, 60 * 60 * 60); // Store mobile -> userId mapping
          }
        }
        if (userId) {
          user = await redisUser.getUser(userId);
          if (!user) {
            user = await userModel.findById(userId);
            if (user) await redisUser.setUser(user);
          }
        }
      }
      if (!user || Object.keys(user).length === 0) {
        return {
          message: "Invalid OTP.",
          status: false,
          data: { auth_key: 0, userid: 0 },
        };
      }
      if (user.status.toLowerCase() == "blocked") {
        return {
          message:
            "You cannot login now in this account. Please contact to administartor.",
          status: false,
          data: { auth_key: 0, userid: 0 },
        };
      }
      const crypto = await import("node:crypto");
      if (!globalThis.crypto) {
        globalThis.crypto = crypto.webcrypto;
      }

      const { SignJWT } = await import("jose"); // Dynamic import
      const secret = Buffer.from(global.constant.SECRET_TOKEN);
      
      // Generate short-lived access token (15 minutes)
      const accessToken = await new SignJWT({ 
        _id: user._id.toString(),
        userId: user._id.toString(),
        mobile: user.mobile,
        modules: user.modules || ['shop', 'fantasy'],
        // Use !== false to treat undefined/null as enabled (defaults to true in schema)
        shop_enabled: user.shop_enabled !== false,
        fantasy_enabled: user.fantasy_enabled !== false
      })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime('15m')  // Short-lived for security
        .setIssuedAt()
        .sign(secret);
      
      // Generate long-lived refresh token (30 days)
      refreshToken = await new SignJWT({
        userId: user._id.toString(),
        type: 'refresh',
        mobile: user.mobile
      })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime('30d')  // Long-lived
        .setIssuedAt()
        .sign(secret);
      
      token = accessToken;
      data["auth_key"] = accessToken;
      data["refresh_token"] = refreshToken;
      data["app_key"] = req.body.appid || "";
      user.auth_key = accessToken;
      user.refresh_token = refreshToken;
      await redisUser.setUser(user);
      const msg = {
        filter: { _id: user._id },
        payload: data,
        modelName: "user",
      };
      sendToQueue("loginUser", msg);
      // const saveApp_key = await userModel.findOneAndUpdate({ _id: user._id }, { app_key: req.body.appid }, { new: true })
    }
    // console.log("token", token);
    return {
      message: "Login Successfully.",
      status: true,
      data: {
        token: token,
        auth_key: token,
        refresh_token: refreshToken,
      },
    };
  } catch (error) {
    console.log(error);
  }
};

exports.logout = async (req) => {
  try {
    const { _id } = req.user;

    const updatedUser = await userModel.findByIdAndUpdate(
      _id,
      { $set: { app_key: "" } },
      { new: true, lean: true }
    );

    await redisUser.setUser(updatedUser);

    if (!updatedUser) {
      return {
        status: false,
        message: "User not found.",
        data: {},
      };
    }

    return {
      status: true,
      message: "Logged out successfully!",
      data: {},
    };
  } catch (error) {
    console.error("Logout error:", error);
    return {
      status: false,
      message: "Logout failed.",
      data: {},
    };
  }
};

/**
 * @deprecated - OTP verification is now handled by Shop backend
 * OTP resend is no longer needed in Fantasy app
 */
exports.otpResend = async (req) => {
  try {
    const { tempuser, mobile, username } = req.body;
    let targetMobile, user;

    // Handle temp user case
    if (tempuser) {
      // const tempUser = await tempuserModel.findById(tempuser);
      const keyMobile = `tempuser:${mobile}`;
      const tempUser = await redisUser.getkeydata(keyMobile);
      if (!tempUser) {
        return {
          status: false,
          message: "Invalid temporary user ID",
          data: {},
        };
      }
      targetMobile = tempUser.mobile;
    }
    // Handle regular user case
    else if (mobile || username) {
      let keyMobile = `user-${mobile}`;
      let userId = await redisUser.getkeydata(keyMobile);

      if (!userId) {
        // Fetch user from DB if not found in Redis
        user = await userModel.findOne({ mobile: mobile });

        if (user) {
          userId = user._id.toString();
          await redisUser.setUser(user);
          await redisUser.setkeydata(keyMobile, userId, 60 * 60 * 60); // Store mobile -> userId mapping
        }
      } else {
        // Fetch user from Redis
        user = await userModel.findById(userId);
      }

      if (!user) {
        return { status: false, message: "User not found", data: {} };
      }

      targetMobile = user.mobile;
    } else {
      return {
        status: false,
        message: "Missing required parameters",
        data: {},
      };
    }

    // Generate OTP
    let otp =
      process.env.secretManager === "prod"
        ? Math.floor(100000 + Math.random() * 900000)
        : 123456;

    if (mobile === 9462636977) {
      otp = 123456;
    }

    if (process.env.secretManager === "prod") {
      const smsResponse = await sendOTP(mobile, otp);

      if (!smsResponse)
        return {
          status: false,
          message: "Failed to send OTP. Please try again.",
          data: [],
        };
    }

    // Update relevant record
    if (tempuser) {
      // await tempuserModel.updateOne({ _id: tempuser }, { code: otp });
      const keyMobile = `otp-${mobile}`;
      let otpData = { code: otp };
      await redisUser.setkeydata(keyMobile, otpData, 60 * 60);
    } else {
      const keyMobile = `otp-${mobile}`;
      let otpData = { code: otp };
      await redisUser.setkeydata(keyMobile, otpData, 60 * 60);
    }

    return {
      status: true,
      message: "OTP has been sent to your mobile number.",
      data: { [tempuser ? "tempUser" : "userId"]: tempuser || user._id },
    };
  } catch (error) {
    console.error("Resend OTP Error:", error);
    return {
      status: false,
      message: "Something went wrong. Please try again after some time.",
      data: {},
    };
  }
};

exports.userCompleteDetails = async (req) => {
  try {
    let promoterData;
    // var userData = await userModel.findOne({
    //   _id: new mongoose.Types.ObjectId(req.user._id),
    // });
    let userData = await redisUser.getUser(req.user._id);
    if (userData.promoter_verify === 1) {
      promoterData = await affiliatorModel.findOne({
        userid: mongoose.Types.ObjectId(req.user._id),
      });
    }
    // if length of userData is equal to 0
    if (!userData) {
      return {
        message: "User Not Found.",
        status: false,
        data: {},
      };
    }
    let verified = global.constant.PROFILE_VERIFY.FALSE;
    // chack all cond
    if (
      userData.user_verify.mobile_verify ==
      global.constant.PROFILE_VERIFY_EMAIL_MOBILE.VERIFY &&
      userData.user_verify.email_verify ==
      global.constant.PROFILE_VERIFY_EMAIL_MOBILE.VERIFY &&
      userData.user_verify.pan_verify ==
      global.constant.PROFILE_VERIFY_PAN_BANK.APPROVE &&
      userData.user_verify.bank_verify ==
      global.constant.PROFILE_VERIFY_PAN_BANK.APPROVE &&
      userData.user_verify.aadhar_verify ==
      global.constant.PROFILE_VERIFY_AADHAR_BANK.APPROVE
    ) {
      verified = 1;
    } else {
      verified = 0;
    }
    let DofB = " ";
    if (userData.dob) {
      DofB = userData.dob;
    }
    if (moment(userData.dob, "dd-mm-yyyy")) {
    }
    // return data with message
    const totalwalletAmount = 0;

    const userwalletamountConvert = parseFloat(totalwalletAmount.toFixed(2));
    // console.log(userData, "userDataaaaa")
    const normalDate = new Date(userData.createdAt);
    // console.log(normalDate, "pppppp")
    const formattedDate = normalDate.toISOString().split("T")[0];
    let totalwinning = Number(userData.userbalance.winning).toFixed(2);
    let gettotalwinning = parseFloat(totalwinning);
    return {
      message: "User Full Details..!",
      status: true,

      data: {
        id: userData._id,
        username: userData.username || "",
        name: userData.username || "",
        joining_date: formattedDate || "",
        mobile: userData.mobile,
        email: userData.email,
        promoter_verify: userData.promoter_verify,
        isPromoterBlocked: promoterData?.isBlocked || false,
        pincode: userData.pincode || "",
        address: userData.address || "",
        dob: userData.dob,
        DayOfBirth: userData.dob
          ? moment(userData.dob, "dd-mm-yyyy").format("DD")
          : "12",
        MonthOfBirth: userData.dob
          ? moment(userData.dob, "dd-mm-yyyy").format("MM")
          : "10",
        YearOfBirth: userData.dob
          ? moment(userData.dob, "dd-mm-yyyy").format("YYYY")
          : "1970",
        gender: userData.gender || "",
        image:
          userData.image && userData.image != ""
            ? `${global.constant.USER_IMAGE_URL}${userData.image}`
            : `${global.constant.IMAGE_URL}avtar1.png`,
        activation_status: userData.status || "",
        state: userData.state || "",
        city: userData.city || "",
        team: userData.team || "",
        teamfreeze:
          userData.team != ""
            ? global.constant.FREEZE.TRUE
            : global.constant.FREEZE.FALSE,
        signupReward: userData.refer_code || "",
        totalbalance: Number(userData.userbalance.balance).toFixed(2),
        totalwon: Number(userData.userbalance.winning).toFixed(2),
        totalbonus: Number(userData.userbalance.bonus).toFixed(2),
        totalExtraCash: Number(userData.userbalance.extraCash).toFixed(2),
        totalCoin: Number(userData.userbalance.coin).toFixed(2),
        totalticket: Number(userData.userbalance.ticket).toFixed(2),
        // totalcrown: Number(userData.userbalance.crown),
        totalpasses: Number(userData.userbalance.passes).toFixed(2),
        level: Number(userData.level),
        nextLevel: Number(userData.nextLevel),
        // addcashamount: Number(userData.userbalance.balance).toFixed(2),
        // winningamount: Number(userData.userbalance.winning).toFixed(2),
        // bonusamount: Number(userData.userbalance.bonus).toFixed(2),
        walletamaount: userwalletamountConvert,
        verified: verified,
        downloadapk:
          userData.download_apk || global.constant.DOWNLOAD_APK.FALSE,
        emailfreeze:
          userData.email != "" &&
            userData.user_verify.email_verify ==
            global.constant.PROFILE_VERIFY_EMAIL_MOBILE.VERIFY
            ? global.constant.FREEZE.TRUE
            : global.constant.FREEZE.FALSE,
        mobilefreeze:
          userData.mobile != "" &&
            userData.user_verify.mobile_verify ==
            global.constant.PROFILE_VERIFY_EMAIL_MOBILE.VERIFY
            ? global.constant.FREEZE.TRUE
            : global.constant.FREEZE.FALSE,
        mobileVerified: userData.user_verify.mobile_verify,
        emailVerified: userData.user_verify.email_verify,
        PanVerified: userData.user_verify.pan_verify,
        BankVerified: userData.user_verify.bank_verify,
        AadharVerified: userData.user_verify.aadhar_verify,
        statefreeze:
          userData.user_verify.bank_verify ==
            global.constant.PROFILE_VERIFY_PAN_BANK.APPROVE
            ? global.constant.FREEZE.TRUE
            : global.constant.FREEZE.FALSE,
        dobfreeze:
          userData.user_verify.pan_verify ==
            global.constant.PROFILE_VERIFY_PAN_BANK.APPROVE
            ? global.constant.FREEZE.TRUE
            : global.constant.FREEZE.FALSE,
        totalrefers: userData.totalrefercount, //#ReferUserCount of the join application throw referId

        //totalwinning: parseFloat(userData.userbalance.winning).toFixed(2), //# FinalResult model user Total Amount
        totalwinning: gettotalwinning,
        totalchallenges: userData.totalchallenges, //# All over how many contest it was palyed not was total joining
        totalmatches: userData.totalmatches, // # Total Matches it's played(match.matchchallenges.joinleauge or user.totalChallengs)
        totalseries: userData.totalseries, //# Total Series it was played(match.matchchallenges.joinleauge in distinct or user.totalChallengs)
        teamNameUpdateStatus: userData.teamNameUpdateStatus,
      },
    };
    // end of code
  } catch (error) {
    console.error("User Full Details Error:", error);
    return {
      status: false,
      message: "Something went wrong. Please try again after some time.",
      data: {},
    };
  }
};

exports.uploadUserProfileImage = async (req) => {
  try {
    if (!req.file?.filename) {
      return {
        status: false,
        message: "Something went wrong. Please try again after some time.",
        data: {},
      };
    }
    const image = req.file?.filename;
    const payload = await userModel.findOneAndUpdate(
      { _id: req.user._id },
      { image: `uploads/${image}` },
      { new: true }
    );
    let keyname = `userimage-${req.user._id}`;
    await redisUser.setkeydata(keyname, image, 60 * 60 * 4);
    await redisUser.setUser(payload);
    return {
      message: "Your profile has been updated successfully!",
      status: true,
      data: {
        image_url: `${global.constant.USER_IMAGE_URL}${payload.image}`,
      },
    };
  } catch (error) {
    console.error("Uploading User Profile Error:", error);
    return {
      status: false,
      message: "Something went wrong. Please try again after some time.",
      data: {},
    };
  }
};

exports.userRefferals = async (req) => {
  try {
    if (!req.user || !req.user._id) {
      return {
        status: false,
        message: "Unauthorized access",
        data: {}
      };
    }

    const promoterId = new mongoose.Types.ObjectId(req.user._id);

    /* ================= PROMOTER BALANCE ================= */
    const promoter = await userModel
      .findById(promoterId)
      .select("userbalance.promoter_balance");

    if (!promoter) {
      return {
        status: false,
        message: "User not found",
        data: {}
      };
    }

    const promoterBalance =
      promoter.userbalance?.promoter_balance || 0;

    /* ================= REFERRED USERS ================= */
    const referredUsers = await userModel.aggregate([
      {
        $match: { refer_id: promoterId }
      },
      {
        $project: {
          fullname: 1,
          username: 1,
          mobile: 1,
          email: 1,
          image: {
            $cond: {
              if: {
                $and: [
                  { $ne: ["$image", ""] },
                  { $ne: ["$image", null] }
                ]
              },
              then: "$image",
              else: "/avtar1.png"
            }
          },
          createdAt: 1
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    /* ================= ALL LEDGER TRANSACTIONS ================= */
    const transactions = await promoterCommissionLogsModel
      .find({ promoterId })
      .select(
        "fromUserId amount percentage transactionType reason balanceBefore balanceAfter referenceTxnId status createdAt"
      )
      .populate("fromUserId", "fullname username mobile email")
      .sort({ createdAt: -1 });

    /* ================= TOTAL COMMISSION (ONLY CREDIT) ================= */
    const totalCommissionAgg = await promoterCommissionLogsModel.aggregate([
      {
        $match: {
          promoterId,
          transactionType: "CREDIT",
          reason: "COMMISSION"
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);

    const totalCommission =
      totalCommissionAgg.length > 0 ? totalCommissionAgg[0].total : 0;

    return {
      status: true,
      message: "Referral dashboard fetched successfully",
      data: {
        promoterBalance,
        totalReferrals: referredUsers.length,
        totalCommission,
        referredUsers,
        transactions
      }
    };
  } catch (error) {
    console.error("Referral Dashboard Error:", error);
    return {
      status: false,
      message: "Something went wrong. Please try again later.",
      data: {}
    };
  }
};



exports.getUserReferCode = async (req) => {
  try {
    const data = await walletTransactionModel.aggregate([
      {
        $match: {
          type: global.constant.BONUS.REFER_BONUS,
          userid: mongoose.Types.ObjectId(req.user._id),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "referredUser",
          foreignField: "_id",
          as: "referredUsers",
        },
      },
      {
        $unwind: "$referredUsers",
      },
      {
        $project: {
          _id: "$referredUser",
          team: "$referredUsers.team",
          refer_code: "$referredUsers.refer_code",
          username: "$referredUsers.username",
          image: "$referredUsers.image",
          totalrefercount: "$referredUsers.totalrefercount",
          totalreferAmount: "$amount",
        },
      },
    ]);
    if (data.length > 0) {
      return {
        message: "Data Fetch Successfully !!",
        status: true,
        data: data,
      };
    }
    return {
      message: "Data Not Found !!",
      status: false,
      data: {},
    };
  } catch (error) {
    console.error("All User Refer Code Error:", error);
    return {
      status: false,
      message: "Something went wrong. Please try again after some time.",
      data: {},
    };
  }
};

exports.editUserProfile = async (req) => {
  try {
    const restrictarray = [
      "madar",
      "bhosadi",
      "bhosd",
      "aand",
      "jhaant",
      "jhant",
      "fuck",
      "chut",
      "chod",
      "gand",
      "gaand",
      "choot",
      "faad",
      "loda",
      "Lauda",
      "maar",
      "sex",
      "porn",
      "xxx",
    ];
    if (restrictarray.includes(req.body.team)) {
      return {
        message: "You cannot use abusive words in your team name..!",
        status: false,
        data: {},
      };
    }
    // const user = await userModel.findOne({
    //   team: req.body.team,
    //   _id: { $ne: req.user._id },
    // });
    if (!req.body.team || req.body.team == undefined) {
      return {
        status: false,
        message: "Team Name Undefined.",
      };
    } else {
      const trimmedTeam = req.body.team.trim();

      const user = await userModel.aggregate([
        {
          $match: {
            team: {
              $regex: trimmedTeam,
              $options: "i",
            },
          },
        },
      ]);

      const userD = await userModel.findById(req.user._id);

      if (userD.teamNameUpdateStatus == 1) {
        return {
          message: "You cannot update the team name more than once.",
          status: false,
          data: {},
        };
      }

      if (user.length > 0) {
        return {
          message:
            "This Team Name Already Exists. Please use a different name for your team.",
          status: false,
          data: {},
        };
      }

      req.body.teamNameUpdateStatus = true;
      const updatedProfile = await userModel.findOneAndUpdate(
        { _id: req.user._id },
        req.body
      );
      await redisUser.setUser(updatedProfile);
      if (updatedProfile) {
        return {
          message: "Profile updated successfully",
          status: true,
          data: { userid: req.user._id },
        };
      } else {
        return {
          message: "Team not updated. Please try again.",
          status: false,
          data: {},
        };
      }
    }
  } catch (error) {
    console.error("All User Refer Code Error:", error);
    return {
      status: false,
      message: "Something went wrong. Please try again after some time.",
      data: {},
    };
  }
};

exports.userOwnTransactions = async (req) => {
  try {
    let pipeline = [];
    let totalCount;

    pipeline.push(
      {
        $match: {
          userid: mongoose.Types.ObjectId(req.user._id),
        },
      },
      {
        $addFields: {
          year: {
            $dateToString: {
              date: "$createdAt",
              format: "%Y",
            },
          },
        },
      },
      {
        $addFields: {
          month: {
            $let: {
              vars: {
                months: [
                  "",
                  "January",
                  "February",
                  "March",
                  "April",
                  "May",
                  "June",
                  "July",
                  "August",
                  "September",
                  "October",
                  "November",
                  "December",
                ],
              },
              in: {
                $arrayElemAt: [
                  "$$months",
                  {
                    $month: "$createdAt",
                  },
                ],
              },
            },
          },
        },
      },
      {
        $addFields: {
          yearMonth: {
            $concat: [
              {
                $toString: "$year",
              },
              "-",
              "$month",
            ],
          },
        },
      }
    );

    if (req.query.type === "credit") {
      pipeline.push(
        {
          $match: {
            type: {
              $in: [
                "Add Fund Adjustments",
                "Bonus Adjustments",
                "Winning Adjustment",
                "Challenge Winning Amount",
                "Refund",
                "Refund amount",
                "Series Winning Amount",
                "investing Winning Amount",
                "Unfreeze Fund",
                "Unfreeze Bonus",
                "Unfreeze Winning",
                "Spin & Win Bonus",
                "Gems Bonus",
              ],
            },
            amount: { $ne: 0 },
          },
        },
        {
          $lookup: {
            from: "matchcontests",
            localField: "challengeid",
            foreignField: "_id",
            as: "matchchallenges",
          },
        },
        {
          $unwind: {
            path: "$matchchallenges",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "matches",
            localField: "matchchallenges.matchkey",
            foreignField: "_id",
            as: "match",
          },
        },
        {
          $unwind: {
            path: "$match",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            matchName: "$match.short_name",
          },
        },
        {
          $project: {
            match: 0,
            matchchallenges: 0,
          },
        },
        {
          $project: {
            id: "$_id",
            transaction_type: "Credit",
            type: 1,
            amount: {
              $cond: {
                if: { $eq: [{ $type: "$amount" }, "double"] },
                then: {
                  $toString: {
                    $round: ["$amount", 2],
                  },
                },
                else: {
                  $toString: "$amount",
                },
              },
            },
            date_time: {
              $dateToString: {
                format: "%Y-%m-%d %H:%M:%S",
                date: {
                  $dateAdd: {
                    startDate: "$createdAt",
                    unit: "minute",
                    amount: 330, // 5 hours * 60 + 30 minutes = 330 minutes
                  },
                },
              },
            },
            txnid: "$transaction_id",
            matchName: 1,
            createdAt: 1,
          },
        }
      );
    } else if (req.query.type === "debit") {
      pipeline.push(
        {
          $match: {
            type: {
              $in: [
                "Deduct Fund",
                "Deduct Bonus Amount",
                "Deduct Winning Amount",
                "Contest Joining Fee",
                "Freezed Bonus",
                "Freezed Deposit",
                "Freezed Winning",
              ],
            },
            amount: { $ne: 0 },
          },
        },
        {
          $lookup: {
            from: "matchcontests",
            localField: "challengeid",
            foreignField: "_id",
            as: "matchchallenges",
          },
        },
        {
          $unwind: {
            path: "$matchchallenges",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "matches",
            localField: "matchchallenges.matchkey",
            foreignField: "_id",
            as: "match",
          },
        },
        {
          $unwind: {
            path: "$match",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            matchName: "$match.short_name",
          },
        },
        {
          $project: {
            match: 0,
            matchchallenges: 0,
          },
        },
        {
          $project: {
            id: "$_id",
            transaction_type: "Debit",
            type: 1,
            amount: {
              $cond: {
                if: { $eq: [{ $type: "$amount" }, "double"] },
                then: {
                  $toString: {
                    $round: ["$amount", 2],
                  },
                },
                else: {
                  $toString: "$amount",
                },
              },
            },
            date_time: {
              $dateToString: {
                format: "%Y-%m-%d %H:%M:%S",
                date: {
                  $dateAdd: {
                    startDate: "$createdAt",
                    unit: "minute",
                    amount: 330, // 5 hours * 60 + 30 minutes = 330 minutes
                  },
                },
              },
            },
            txnid: "$transaction_id",
            matchName: 1,
            createdAt: 1,
          },
        }
      );
    } else if (req.query.type === "reward") {
      pipeline.push(
        {
          $match: {
            type: {
              $in: [
                "Mobile Bonus",
                "Email Bonus",
                "Aadhar Bonus",
                "Pan Bonus",
                "Bank Bonus",
                "TDS Amount",
                "Offer bonus",
                "Signup Bonus",
                "Level 1 Reward",
                "Level 2 Reward",
                "Level 3 Reward",
                "Level 4 Reward",
                "Level 5 Reward",
                "Level 6 Reward",
                "Level 7 Reward",
                "Level 8 Reward",
                "Level 9 Reward",
                "Level 10 Reward",
                "Level 11 Reward",
                "Level 12 Reward",
                "Level 13 Reward",
                "Level 14 Reward",
                "Level 15 Reward",
                "Level 16 Reward",
                "Level 17 Reward",
                "Level 18 Reward",
                "Level 19 Reward",
                "Level 20 Reward",
                "Level 21 Reward",
                "Level 22 Reward",
                "Level 23 Reward",
                "Level 24 Reward",
                "Level 25 Reward",
                "Level 26 Reward",
                "Level 27 Reward",
                "Level 28 Reward",
                "Level 29 Reward",
                "Level 30 Reward",
                "Level 31 Reward",
                "Level 32 Reward",
                "Bonus",
                "tds",
                "Refer Bonus",
                "Application download bonus",
                "Cashback Bonus Expired",
                "p2p cashback",
                "P2P Cashback",
              ],
            },
            amount: { $ne: 0 },
          },
        },
        {
          $lookup: {
            from: "depositcashback",
            localField: "transaction_id",
            foreignField: "transaction_id",
            as: "cashbackData",
          },
        },
        {
          $unwind: {
            path: "$cashbackData",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            id: "$_id",
            transaction_type: "Credit",
            type: 1,
            amount: {
              $cond: {
                if: { $eq: [{ $type: "$amount" }, "double"] },
                then: {
                  $toString: {
                    $round: ["$amount", 2],
                  },
                },
                else: {
                  $toString: "$amount",
                },
              },
            },
            date_time: {
              $dateToString: {
                format: "%Y-%m-%d %H:%M:%S",
                date: {
                  $dateAdd: {
                    startDate: "$createdAt",
                    unit: "minute",
                    amount: 330, // 5 hours * 60 + 30 minutes = 330 minutes
                  },
                },
              },
            },
            txnid: "$transaction_id",
            matchName: 1,
            createdAt: 1,
            expiresAt: {
              $dateToString: {
                format: "%Y-%m-%d %H:%M:%S",
                date: {
                  $dateAdd: {
                    startDate: "$cashbackData.expiresAt",
                    unit: "minute",
                    amount: 330, // 5 hours * 60 + 30 minutes = 330 minutes
                  },
                },
              },
            },
          },
        }
      );
    } else if (req.query.type === "promotion") {
      pipeline.push(
        {
          $match: {
            type: {
              $in: ["Promotion Winning"],
            },
            amount: { $ne: 0 },
          },
        },
        {
          $lookup: {
            from: "matchcontests",
            localField: "challengeid",
            foreignField: "_id",
            as: "matchchallenges",
          },
        },
        {
          $unwind: {
            path: "$matchchallenges",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "matches",
            localField: "matchchallenges.matchkey",
            foreignField: "_id",
            as: "match",
          },
        },
        {
          $unwind: {
            path: "$match",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            matchName: "$match.short_name",
          },
        },
        {
          $project: {
            match: 0,
            matchchallenges: 0,
          },
        },
        {
          $project: {
            id: "$_id",
            transaction_type: "Credit",
            type: 1,
            amount: {
              $cond: {
                if: { $eq: [{ $type: "$amount" }, "double"] },
                then: {
                  $toString: {
                    $round: ["$amount", 2],
                  },
                },
                else: {
                  $toString: "$amount",
                },
              },
            },
            date_time: {
              $dateToString: {
                format: "%Y-%m-%d %H:%M:%S",
                date: {
                  $dateAdd: {
                    startDate: "$createdAt",
                    unit: "minute",
                    amount: 330, // 5 hours * 60 + 30 minutes = 330 minutes
                  },
                },
              },
            },
            txnid: "$transaction_id",
            matchName: 1,
            createdAt: 1,
          },
        }
      );
    } else {
      let queryStatus;
      if (req.query.status == "failed") {
        queryStatus = ["failed", "FAILED", "cancelled", "reversed", "ABORTED"];
      } else if (req.query.status == "pending") {
        queryStatus = ["pending", "PENDING", ""];
      } else if (req.query.status == "success") {
        queryStatus = ["success", "SUCCESS"];
      } else {
        queryStatus = [];
      }
      // console.log("statusssssssss--------", status);
      pipeline.push(
        {
          $match: {
            userid: mongoose.Types.ObjectId(req.user._id),
            type: {
              $in: [
                "Amount Withdraw",
                "Amount Withdraw Refund",
                "Cash added",
                "Govt TDS Deduction",
                "p2p deposit",
                "p2p withdrawal",
                "P2P Withdrawal",
                "P2P Deposit",
                "Self Transfer",
                "Spin & Win Bonus",
                "Gems Bonus",
              ],
            },
            amount: { $ne: 0 },
          },
        },
        {
          $lookup: {
            from: "payouts",
            localField: "transaction_id",
            foreignField: "transfer_id",
            as: "withdrawData",
          },
        },
        {
          $unwind: {
            path: "$withdrawData",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            amount: {
              $add: ["$withdrawData.amount", "$withdrawData.tds_amount"],
            },
          },
        },
        {
          $project: {
            id: "$_id",
            transaction_type: {
              $cond: {
                if: {
                  $in: [
                    "$type",
                    [
                      "Amount Withdraw",
                      "p2p withdrawal",
                      "Self Winning",
                      "P2P Withdrawal",
                    ],
                  ],
                },
                then: "Debit",
                else: "Credit",
              },
            },
            type: 1,
            amount: {
              $cond: {
                if: {
                  $eq: [{ $type: "$amount" }, "double"],
                },
                then: {
                  $toString: {
                    $round: ["$amount", 2],
                  },
                },
                else: {
                  $toString: "$amount",
                },
              },
            },
            date_time: {
              $dateToString: {
                format: "%Y-%m-%d %H:%M:%S",
                date: {
                  $dateAdd: {
                    startDate: "$createdAt",
                    unit: "minute",
                    amount: 330, // 5 hours * 60 + 30 minutes = 330 minutes
                  },
                },
              },
            },
            txnid: "$transaction_id",
            paymentstatus: {
              $cond: {
                if: {
                  $or: [
                    {
                      $eq: ["$withdrawData.status_description", "processing"],
                    },
                    {
                      $eq: ["$withdrawData.status_description", "queued"],
                    },
                  ],
                },
                then: "pending",
                else: {
                  $cond: {
                    if: {
                      $eq: ["$withdrawData.status_description", "processed"],
                    },
                    then: "success",
                    else: "$withdrawData.status_description",
                  },
                },
              },
            },
            paymentmethod: "$paymentmethod",
            status_description: "$status_description",
            utr: "$withdrawData.utr",
            withdrawfrom: "$withdrawfrom",
            createdAt: 1,
            userid: 1,
            tds_amount: { $round: ["$withdrawData.tds_amount", 2] },
          },
        },
        {
          $sort: {
            createdAt: -1,
          },
        },
        // {
        //   $skip: req.query.skip ? Number(req.query.skip) : 0
        // },
        // {
        //   $limit: req.query.limit ? Number(req.query.limit) : 20
        // },
        {
          $group: {
            _id: "$userid",
            withdrawals: { $push: "$$ROOT" },
          },
        },
        {
          $lookup: {
            from: "deposits",
            localField: "_id",
            foreignField: "userid",
            pipeline: [
              {
                $lookup: {
                  from: "wallettransactions",
                  localField: "txnid",
                  foreignField: "transaction_id",
                  pipeline: [
                    {
                      $match: {
                        type: "Bonus",
                      },
                    },
                  ],
                  as: "transactionData",
                },
              },
              {
                $unwind: {
                  path: "$transactionData",
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $project: {
                  _id: "$_id",
                  type: {
                    $cond: {
                      if: {
                        $in: [
                          "$type",
                          [
                            "Amount Withdraw",
                            "Amount Withdraw Refund",
                            "p2p withdrawal",
                            "P2P Withdrawal",
                            "P2P Deposit",
                          ],
                        ],
                      },
                      then: "$type",
                      else: "Cash added",
                    },
                  },
                  createdAt: "$createdAt",
                  id: "$_id",
                  transaction_type: {
                    $cond: {
                      if: {
                        $in: ["$type", ["Cash added", "P2P Deposit", "Spin & Win Bonus",
                          "Gems Bonus",]],
                      },
                      then: "Credit",
                      else: "Debit",
                    },
                  },
                  amount: {
                    $cond: {
                      if: {
                        $eq: [{ $type: "$amount" }, "double"],
                      },
                      then: {
                        $toString: {
                          $round: ["$amount", 2],
                        },
                      },
                      else: {
                        $toString: "$amount",
                      },
                    },
                  },
                  txnid: 1,
                  status: 1,
                  paymentmethod: 1,
                  date_time: {
                    $dateToString: {
                      format: "%Y-%m-%d %H:%M:%S",
                      date: {
                        $dateAdd: {
                          startDate: "$createdAt",
                          unit: "minute",
                          amount: 330, // 5 hours * 60 + 30 minutes = 330 minutes
                        },
                      },
                    },
                  },
                  paymentstatus: {
                    $cond: {
                      if: {
                        $eq: ["$status", "SUCCESS"],
                      },
                      then: "success",
                      else: "$status",
                    },
                  },
                  utr: "$utr",
                  gst_amount: { $round: ["$transactionData.amount", 2] },
                },
              },
              {
                $sort: {
                  createdAt: -1,
                },
              },
              // {
              //   $skip: req.query.skip ? Number(req.query.skip) : 0
              // },
              // {
              //   $limit: req.query.limit ? Number(req.query.limit) : 20
              // }
            ],
            as: "addedCash",
          },
        },
        {
          $addFields: {
            allTransactions: {
              $setUnion: ["$withdrawals", "$addedCash"],
            },
          },
        },
        {
          $project: {
            _id: 0, // Exclude the _id field if not needed
            userid: "$_id",
            allTransactions: 1,
          },
        },
        {
          $unwind: "$allTransactions",
        },
        {
          $group: {
            _id: "$allTransactions.txnid", // Group by txnid to remove duplicates
            allTransactions: {
              $first: "$allTransactions",
            }, // Keep the first occurrence
          },
        },
        {
          $addFields: {
            _id: "$allTransactions._id",
            type: "$allTransactions.type",
            createdAt: "$allTransactions.createdAt",
            id: "$allTransactions.id",
            transaction_type: {
              $cond: {
                if: {
                  $in: [
                    "$allTransactions.type",
                    [
                      "Amount Withdraw",
                      "p2p withdrawal",
                      "Self Winning",
                      "P2P Withdrawal",
                    ],
                  ],
                  // $eq: ["$allTransactions.type", "Amount Withdraw"]
                },
                then: "Debit",
                else: "Credit",
              },
            },
            amount: "$allTransactions.amount",
            date_time: "$allTransactions.date_time",
            txnid: "$allTransactions.txnid",
            paymentstatus: "$allTransactions.paymentstatus",
            paymentmethod: "$allTransactions.paymentmethod",
            utr: "$allTransactions.utr",
            gst_amount: "$allTransactions.gst_amount",
            tds_amount: "$allTransactions.tds_amount",
          },
        },
        {
          $project: {
            allTransactions: 0,
          },
        },
        {
          $match: {
            paymentstatus: { $in: queryStatus },
          },
        }
      );
    }

    pipeline.push({
      $sort: { createdAt: -1 },
    });

    totalCount = await walletTransactionModel.aggregate(pipeline);

    pipeline.push(
      {
        $skip: req.query.skip ? Number(req.query.skip) : 0,
      },
      {
        $limit: req.query.limit ? Number(req.query.limit) : 20,
      }
    );

    let myTransactions = await walletTransactionModel.aggregate(pipeline);

    if (myTransactions.length == 0) {
      return {
        status: false,
        message: "User Transaction Not Found",
        data: [],
      };
    }

    return {
      status: true,
      message: "User Transactions Detail.",
      data: {
        transactions: myTransactions,
        totalCount: totalCount?.length,
      },
    };
  } catch (error) {
    console.error("MyTransactions Error:", error);
    return {
      status: false,
      message: "Something went wrong. Please try again after some time.",
      data: {},
    };
  }
};

exports.myRedisTransaction = async (req) => {
  const userId = req.user._id;
  const listKey = `user_transactions:{${userId}}`;
  const page = parseInt(req.query.skip) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const start = (page - 1) * limit;
  const end = start + limit - 1;
  const type = req.query.type;

  const creditTypes = [
    "Add Fund Adjustments",
    "Bonus Adjustments",
    "Winning Adjustment",
    "Challenge Winning Amount",
    "Refund",
    "Refund amount",
    "Series Winning Amount",
    "investing Winning Amount",
    "Unfreeze Fund",
    "Unfreeze Bonus",
    "Unfreeze Winning",
    // "Self Winning",
    // "Self Transfer"
  ];

  const debitTypes = [
    "Deduct Fund",
    "Deduct Bonus Amount",
    "Deduct Winning Amount",
    "Contest Joining Fee",
    "Freezed Bonus",
    "Freezed Deposit",
    "Freezed Winning",
  ];

  const rewardTypes = [
    "Mobile Bonus",
    "Email Bonus",
    "Aadhar Bonus",
    "Pan Bonus",
    "Bank Bonus",
    "TDS Amount",
    "Offer bonus",
    "Signup Bonus",
    "Level 1 Reward",
    "Level 2 Reward",
    "Level 3 Reward",
    "Level 4 Reward",
    "Level 5 Reward",
    "Level 6 Reward",
    "Level 7 Reward",
    "Level 8 Reward",
    "Level 9 Reward",
    "Level 10 Reward",
    "Level 11 Reward",
    "Level 12 Reward",
    "Level 13 Reward",
    "Level 14 Reward",
    "Level 15 Reward",
    "Level 16 Reward",
    "Level 17 Reward",
    "Level 18 Reward",
    "Level 19 Reward",
    "Level 20 Reward",
    "Level 21 Reward",
    "Level 22 Reward",
    "Level 23 Reward",
    "Level 24 Reward",
    "Level 25 Reward",
    "Level 26 Reward",
    "Level 27 Reward",
    "Level 28 Reward",
    "Level 29 Reward",
    "Level 30 Reward",
    "Level 31 Reward",
    "Level 32 Reward",
    "Bonus",
    "tds",
    "Refer Bonus",
    "Application download bonus",
    "Cashback Bonus Expired",
    "p2p cashback",
    "P2P Cashback",
  ];

  const promotionTypes = ["Promotion Winning"];

  // 1. Get list of transactionIds
  // const transactionIds = await redisTransaction.redis.lrange(listKey, 0, -1);
  const transactionIds = await redisTransaction.redis.zrange(listKey, 0, -1, "REV");
  // const transactionIds = await redisTransaction.redis.zrevrange(listKey, 0, -1); // latest first
  // console.log("transactionIds", transactionIds);
  // 2. Fetch corresponding transactions from hashes
  const transactions = [];
  for (const txId of transactionIds) {
    const txKey = `transaction:{${userId}}:${txId}`;
    const txData = await redisTransaction.redis.hgetall(txKey);
    if (Object.keys(txData).length) {
      // Convert numeric fields and parse JSON fields if any
      if (txData.createdAt) txData.createdAt = new Date(txData.createdAt);
      if (txData.amount) txData.amount = parseFloat(txData.amount).toFixed(2);
      transactions.push(txData);
    }
  }
  // console.log("type", type);
  // 3. Filter based on query type
  let filtered = transactions;
  if (type === "credit") {
    filtered = transactions.filter(
      (t) => creditTypes.includes(t.type) && parseFloat(t.amount || 0) !== 0
    );
  } else if (type === "debit") {
    filtered = transactions.filter(
      (t) => debitTypes.includes(t.type) && parseFloat(t.amount || 0) !== 0
    );
  } else if (type === "reward") {
    filtered = transactions.filter(
      (t) => rewardTypes.includes(t.type) && parseFloat(t.amount || 0) !== 0
    );
  } else if (type === "promotion") {
    filtered = transactions.filter(
      (t) => promotionTypes.includes(t.type) && parseFloat(t.amount || 0) !== 0
    );
  } else {
    let queryStatus = [];
    let dipoWith = [
      "Amount Withdraw",
      "Amount Withdraw Refund",
      "Cash added",
      "p2p withdrawal",
      "P2P Withdrawal",
      "P2P Deposit",
      "p2p deposit",
      "Self Transfer",
    ];

    // Step 1: Filter by type and non-zero amount
    let initialFiltered = transactions.filter(
      (t) => dipoWith.includes(t.type) && parseFloat(t.amount || 0) !== 0
    );

    // Step 2: Set queryStatus based on requested status
    if (req.query.status == "failed") {
      queryStatus = ["failed", "FAILED", "cancelled", "reversed", "ABORTED"];
    } else if (req.query.status == "pending") {
      queryStatus = ["pending", "PENDING", ""];
    } else if (req.query.status == "success") {
      queryStatus = ["success", "SUCCESS"];
    } else {
      queryStatus = []; // No status filter
    }

    // Step 3: Filter initialFiltered again based on payment status
    filtered = initialFiltered.filter(
      (t) => queryStatus.length === 0 || queryStatus.includes(t.paymentstatus)
    );
  }

  // 5. Paginate
  const paginated = filtered.slice(start, end + 1);
  // console.log("paginated", paginated);
  return {
    status: true,
    message: "User Transactions Detail.",
    data: {
      transactions: paginated,
      totalCount: paginated?.length,
    },
  };
};

exports.myDetailedTransactions = async (req) => {
  try {
  } catch (error) {
    console.error("myTransactionsDetail Error:", error);
    return {
      status: false,
      message: "Something went wrong. Please try again after some time.",
      data: {},
    };
  }
};

exports.editUserTeamName = async (req) => {
  try {
    const { teamNameUpdateStatus } = req.body;

    if (req.body.teamNameUpdateStatus) {
      const findUser = await userModel.findOne({ _id: req.user._id });

      if (findUser.teamNameUpdateStatus) {
        return {
          status: false,
          message: "You cannot edit your team name more than once.",
        };
      }

      const userUpdated = await userModel.findOneAndUpdate(
        { _id: req.user._id },
        req.body,
        { new: true }
      );

      await redisUser.setUser(userUpdated);

      if (userUpdated) {
        // console.log("userUpdated", userUpdated);
        return {
          status: true,
          message: "Team Name Updated.",
        };
      } else {
        return {
          status: false,
          message: "Team Name Not Updated.",
        };
      }
    }
  } catch (error) {
    console.error("editTeamName Error:", error);
    return {
      status: false,
      message: "Something went wrong. Please try again after some time.",
      data: {},
    };
  }
};

exports.contestWonUpdate = async (req) => {
  let winPip = [];
  // match user
  winPip.push({
    $match: {
      userid: mongoose.Types.ObjectId(req.user._id),
    },
  });
  // group data
  winPip.push({
    $group: {
      _id: "$challengeid",
      count: {
        $sum: 1,
      },
    },
  });
  // count data
  winPip.push({
    $count: "total",
  });

  const winContestData = await resultSummaryModel.aggregate(winPip);
  // const winContestData=[];

  try {
    // console.log('winContestData',winContestData);
    // if length of winContestData is more then 0
    if (winContestData.length > 0) {
      var userData = await userModel.findOneAndUpdate(
        { _id: mongoose.Types.ObjectId(req.user._id) },
        {
          totalwoncontest: winContestData[0].total,
        }
      );
      await redisUser.setUser(userData);
    }
    return {
      message: "User Updated!",
      status: true,

      data: {},
    };
    // end of code
  } catch (error) {
    console.log(error);
  }
};

exports.fetchUserLevelData = async (req) => {
  try {
    const userData = await userModel.aggregate([
      {
        $match: {
          // '_id':  mongoose.Types.ObjectId(req.user._id)
          _id: mongoose.Types.ObjectId(req.user._id),
        },
      },
      {
        $project: {
          mobile: 1,
          team: 1,
          level: 1,
          nextLevel: 1,
        },
      },
      {
        $lookup: {
          from: "userleagues",
          localField: "_id",
          foreignField: "userid",
          pipeline: [
            {
              $lookup: {
                from: "matchcontests",
                localField: "challengeid",
                foreignField: "_id",
                as: "matchchallenges",
              },
            },
          ],
          as: "joinedleauges",
        },
      },
      {
        $unwind: {
          path: "$joinedleauges",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          winning: "$joinedleauges.leaugestransaction.winning",
          challengeid: "$joinedleauges.challengeid",
        },
      },
      {
        $lookup: {
          from: "matchcontests",
          localField: "challengeid",
          foreignField: "_id",
          as: "matchchallenges",
        },
      },
      {
        $unwind: {
          path: "$matchchallenges",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          entryfee: "$matchchallenges.entryfee",
        },
      },
      {
        $group: {
          _id: "$_id",
          count: {
            $sum: 1,
          },
          documents: {
            $push: "$$ROOT",
          },
        },
      },
      {
        $unwind: {
          path: "$documents",
        },
      },
      {
        $project: {
          joinContest: "$count",
          mobile: "$documents.mobile",
          team: "$documents.team",
          winning: "$documents.winning",
          level: "$documents.level",
          level: "$documents.level",
          entryfee: "$documents.entryfee",
        },
      },
      {
        $group: {
          _id: "$_id",
          totalWinContest: {
            $sum: {
              $cond: {
                if: {
                  $gt: ["$winning", 1],
                },
                then: 1,
                else: 0,
              },
            },
          },
          documents: {
            $push: "$$ROOT",
          },
          userid: {
            $first: "$_id",
          },
          joinContest: {
            $first: "$joinContest",
          },
          team: {
            $first: "$team",
          },
          mobile: {
            $first: "$mobile",
          },
          entryfee: {
            $first: "$entryfee",
          },
          level: {
            $first: "$level",
          },
        },
      },
      {
        $project: {
          documents: 0,
          _id: 0,
        },
      },
    ]);

    // console.log("userData",userData);
    const nextLevel = userData[0]?.level + 1;
    const nextleveldata = await playingLevelModel.findOne({
      level: nextLevel,
    });

    if (!nextleveldata) {
      return {
        message: "This is your last level!!",
        status: true,
        data: {
          allLevelCompleted: true,
          // currentLevel: userData[0].level,
          // nextLevel: "nextLevel",
          // totalPlayContest: 0,
          // NumberOfWinningContest: "0",
          // totalWinningContest: userData[0].totalWinContest,
          // nextLevelReward: 0,
          // rewardType: "No Reward",
        },
      };
    }
    let obj = {
      allLevelCompleted: false,
      currentLevel: userData[0].level,
      nextLevel: nextLevel,
      totalPlayContest: nextleveldata.contest,
      NumberOfWinningContest: nextleveldata.winnings,
      totalWinningContest: userData[0].totalWinContest,
      nextLevelReward: Number(nextleveldata.rewardAmount),
      // "processForNext": 20,
      rewardType: nextleveldata.rewardType,
    };
    return {
      message: "Data Fetch Successfully !!",
      status: true,
      data: obj,
    };
  } catch (error) {
    console.error("getUserLevelData Error:", error);
    return {
      status: false,
      message: "Something went wrong. Please try again after some time.",
      data: {},
    };
  }
};

exports.helpDeskMail = async (req) => {
  try {
    const lastTicket = await customerSupportModel
      .findOne()
      .sort({ ticketId: -1 })
      .exec();

    const image = req.file?.filename || "";

    const nextTicketId = lastTicket ? lastTicket.ticketId + 1 : 11111111;
    const data = await customerSupportModel.create({
      ...req.body,
      ticketId: nextTicketId,
      image: `/uploads/support/${image}`,
    });

    return {
      message: "Ticket raised successfully.",
      status: true,
    };

    // if (data) {
    //   const mg = mailgun({
    //     apiKey: global.constant.MAILGUN.MAIL_APP_KEY,
    //     domain: global.constant.MAILGUN.MAILGUN_DOMAIN
    //   });

    //   const sendHelpdeskEmail = async (toEmail, ticketId, issueTitle, issueDescription, mobileNumber) => {

    //     const adminEmailData = {
    //       from: `Helpdesk Notifications <support@test.com>`,
    //       to: toEmail,
    //       subject: `New Support Ticket #${ticketId}: ${issueTitle}`,
    //       html: `
    //         <h3>New Support Ticket #${ticketId}: ${issueTitle}</h3>
    //         <p>A new support ticket has been raised with the following details: </p>
    //         <p><strong>Issue Description:</strong></p>
    //         <blockquote>${issueDescription}</blockquote>
    //         <p><strong>Customer Mobile Number:</strong> ${mobileNumber}</p>
    //         <p><strong>Customer Email:</strong> ${req.body.email}</p>
    //         <p>Please review and take appropriate action.</p>
    //         <p>Best Regards,<br>Helpdesk System</p>
    //       `,
    //     };

    //     try {
    //       const data = await mg.messages().send(adminEmailData);
    //       console.log('Helpdesk email sent successfully to admin.');

    //     } catch (error) {
    //       console.error('Failed to raise ticket:', error);
    //       throw error;
    //     }
    //   };

    //   await sendHelpdeskEmail(
    //     'support@test.com',
    //     nextTicketId,
    //     req.body.issue,
    //     req.body.message,
    //     req.body.mobile
    //   );

    //   return {
    //     message: 'Ticket raised successfully.',
    //     status: true
    //   };

    // } else {
    //   return {
    //     message: 'Error occurred while inserting data.',
    //     status: false
    //   };
    // }
  } catch (error) {
    console.error("helpdeskmail Error:", error);
    return {
      status: false,
      message: "Something went wrong. Please try again after some time.",
      data: {},
    };
  }
};

exports.updateUserDataInRedis = async (req, res) => {
  try {
    const allUsers = await userModel.find({});
    await redisUser.setUserInRedis(allUsers);
    return {
      message: "User data set in Redis successfully.",
      status: true,
    };
  } catch (error) {
    console.error("setUserDataInRedis Error:", error);
    return {
      status: false,
      message: "Something went wrong. Please try again later.",
      data: {},
    };
  }
};

// exports.userWalletBalance = async (req, res) => {
//   try {
//     let hasUser = await userModel.findOne(
//       { _id: req.user._id },
//       {
//         userbalance: 1,
//         user_verify: 1,
//         totalwinning: 1,
//         totalchallenges: 1,
//         totalmatches: 1,
//         totalseries: 1,
//         totalwoncontest: 1,
//       }
//     );
//     if (!hasUser)
//       return { message: "User Not Found", status: false, data: {} };
//     const totalAmount =
//       parseFloat(hasUser.userbalance.balance.toFixed(2)) +
//       parseFloat(hasUser.userbalance.winning.toFixed(2)) +
//       parseFloat(hasUser.userbalance.bonus.toFixed(2));
//     return {
//       message: "User Wallet And Verify Details",
//       status: true,
//       data: {
//         balance: Number(hasUser.userbalance.balance).toFixed(2),
//         winning: Number(hasUser.userbalance.winning).toFixed(2),
//         bonus: Number(hasUser.userbalance.bonus).toFixed(2),
//         totalamount: Number(totalAmount).toFixed(2),
//         allverify:
//           hasUser.user_verify.mobile_verify == 1 &&
//             hasUser.user_verify.email_verify == 1 &&
//             hasUser.user_verify.pan_verify == 1 &&
//             hasUser.user_verify.bank_verify == 1
//             ? 1
//             : 0,
//         totalamountwon: hasUser.totalwinning, //# FinalResult Table user Total Amount,
//         totaljoinedcontest: hasUser.totalchallenges, //# All over how many contest it was palyed not was total joining,
//         totaljoinedmatches: hasUser.totalmatches, //# Total Matches it's played(match.matchchallenges.joinleauge or user.totalChallengs),
//         totaljoinedseries: hasUser.totalseries, //# Total Series it was played(match.matchchallenges.joinleauge in distinct or user.totalChallengs),
//         totalwoncontest: hasUser.totalwoncontest, ///# Total Contset Count it was win,
//       },
//     };
//   } catch (error) {
//     console.error("userWalletBalance Error:", error);
//     return {
//       status: false,
//       message: "Something went wrong. Please try again later.",
//       data: {}
//     };
//   }
// };
exports.usersDetailedTransaction = async (req, res) => {
  try {
    let transactionId = req.query.transactionId;
    const adjustmentTypes = [
      "Deduct Fund",
      "Deduct Winning",
      "Deduct Bonus",
      "Add Fund Adjustments",
      "Winning Adjustment",
      "Bonus Adjustments",
    ];
    const contestTypes = [
      // "Contest Joining Fee",
      "Refund",
      "Challenge Winning Amount",
    ];
    const bonusTypes = [
      "Signup Bonus",
      "Mobile Bonus",
      "Email Bonus",
      "Bonus",
      "Aadhar Bonus",
      "Pan Bonus",
      "Bank Bonus",
    ];
    let aggpipe = [];
    aggpipe.push({
      $match: {
        transaction_id: transactionId,
      },
    });
    if (req.query.type === "Contest Joining Fee") {
      aggpipe.push(
        {
          $lookup: {
            from: "userleagues",
            localField: "transaction_id",
            foreignField: "transaction_id",
            as: "joinedleaugesData",
          },
        },
        {
          $unwind: {
            path: "$joinedleaugesData",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "matchcontests",
            let: { challengeId: "$challengeid" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$_id", "$$challengeId"],
                  },
                },
              },
              {
                $lookup: {
                  from: "matches",
                  let: { matchKey: "$matchkey" },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $eq: ["$_id", "$$matchKey"],
                        },
                      },
                    },
                    {
                      $addFields: {
                        team1: {
                          $arrayElemAt: [
                            {
                              $split: ["$short_name", " vs "],
                            },
                            0,
                          ],
                        },
                        team2: {
                          $arrayElemAt: [
                            {
                              $split: ["$short_name", " vs "],
                            },
                            1,
                          ],
                        },
                      },
                    },
                    {
                      $lookup: {
                        from: "teams",
                        localField: "team1Id",
                        foreignField: "_id",
                        pipeline: [
                          {
                            $project: {
                              logo: 1,
                              teamName: 1,
                            },
                          },
                        ],
                        as: "team1Data",
                      },
                    },
                    {
                      $lookup: {
                        from: "teams",
                        localField: "team2Id",
                        foreignField: "_id",
                        pipeline: [
                          {
                            $project: {
                              logo: 1,
                              teamName: 1,
                            },
                          },
                        ],
                        as: "team2Data",
                      },
                    },
                    {
                      $unwind: {
                        path: "$team1Data",
                      },
                    },
                    {
                      $unwind: {
                        path: "$team2Data",
                      },
                    },
                    {
                      $project: {
                        short_name: 1,
                        team1: 1,
                        team2: 1,
                        team1logo: "$team1Data.logo",
                        team2logo: "$team2Data.logo",
                        teamName1: "$team1Data.teamName",
                        teamName2: "$team2Data.teamName",
                      },
                    },
                  ],
                  as: "matchData",
                },
              },

              { $unwind: "$matchData" },
            ],
            as: "matchchallengesData",
          },
        },
        {
          $unwind: "$matchchallengesData",
        },
        {
          $project: {
            transaction_id: 1,
            userid: 1,
            amount: 1,
            teamName1: "$matchchallengesData.matchData.teamName1",
            teamName2: "$matchchallengesData.matchData.teamName2",
            deposit: {
              $ifNull: ["$joinedleaugesData.leaugestransaction.balance", 0],
            },
            winning: {
              $ifNull: ["$joinedleaugesData.leaugestransaction.winning", 0],
            },
            bonus: {
              $ifNull: ["$joinedleaugesData.leaugestransaction.bonus", 0],
            },
            paymentstatus: 1,
            totalEntry: {
              $add: [
                {
                  $ifNull: ["$joinedleaugesData.leaugestransaction.balance", 0],
                },
                {
                  $ifNull: ["$joinedleaugesData.leaugestransaction.winning", 0],
                },
                { $ifNull: ["$joinedleaugesData.leaugestransaction.bonus", 0] },
              ],
            },

            Date: {
              $dateToString: {
                format: "%d %b %Y %H:%M",
                date: "$joinedleaugesData.leaugestransaction.updatedAt",
                timezone: "Asia/Kolkata",
              },
            },
            spots: { $ifNull: ["$matchchallengesData.maximum_user", 0] },
            entryFee: { $ifNull: ["$matchchallengesData.entryfee", 0] },
            prizePool: { $ifNull: ["$matchchallengesData.win_amount", 0] },
            matchName: "$matchchallengesData.matchData.short_name",
            team1: "$matchchallengesData.matchData.team1",
            team2: "$matchchallengesData.matchData.team2",
            team1Logo: {
              $cond: {
                if: {
                  $ifNull: ["$matchchallengesData.matchData.team1logo", false],
                },
                then: {
                  $concat: [
                    `${global.constant.IMAGE_URL}`,
                    "$matchchallengesData.matchData.team1logo",
                  ],
                },
                else: `${global.constant.IMAGE_URL}uploads/team/logo.png`,
              },
            },
            team2Logo: {
              $cond: {
                if: {
                  $ifNull: ["$matchchallengesData.matchData.team2logo", false],
                },
                then: {
                  $concat: [
                    `${global.constant.IMAGE_URL}`,
                    "$matchchallengesData.matchData.team2logo",
                  ],
                },
                else: `${global.constant.IMAGE_URL}uploads/team/logo.png`,
              },
            },
          },
        }
      );
    } else if (adjustmentTypes.includes(req.query.type)) {
      aggpipe.push({
        $project: {
          amount: 1,
          transaction_id: 1,
          Date: {
            $dateToString: {
              format: "%d %b %Y %H:%M",
              date: "$updatedAt",
              timezone: "Asia/Kolkata",
            },
          },
          paymentstatus: 1,
          transaction_id: 1,
          deposit: {
            $cond: {
              if: {
                $or: [
                  { $eq: [req.query.type, "Deduct Fund"] },
                  { $eq: [req.query.type, "Add Fund Adjustments"] },
                ],
              },
              then: "$amount",
              else: 0,
            },
          },
          winning: {
            $cond: {
              if: {
                $or: [
                  { $eq: [req.query.type, "Deduct Winning"] },
                  { $eq: [req.query.type, "Winning Adjustment"] },
                ],
              },
              then: "$amount",
              else: 0,
            },
          },
          bonus: {
            $cond: {
              if: {
                $or: [
                  { $eq: [req.query.type, "Deduct Bonus"] },
                  { $eq: [req.query.type, "Bonus Adjustments"] },
                ],
              },
              then: "$amount",
              else: 0,
            },
          },
          totalEntry: "$amount",
        },
      });
    } else if (bonusTypes.includes(req.query.type)) {
      aggpipe.push({
        $project: {
          amount: 1,
          transaction_id: 1,
          Date: {
            $dateToString: {
              format: "%d %b %Y %H:%M",
              date: "$updatedAt",
              timezone: "Asia/Kolkata",
            },
          },
          paymentstatus: 1,
          transaction_id: 1,
          bonus: "$amount",
          totalEntry: "$amount",
        },
      });
    } else if (req.query.type === "Amount Withdraw") {
      aggpipe.push({
        $project: {
          amount: 1,
          transaction_id: 1,
          Date: {
            $dateToString: {
              format: "%d %b %Y %H:%M",
              date: "$updatedAt",
              timezone: "Asia/Kolkata",
            },
          },
          paymentstatus: 1,
          transaction_id: 1,
          winning:
            req.query.type === "Amount Withdraw" ? "$amount" : { $literal: 0 },
          deposit:
            req.query.type === "Cash added" ? "$amount" : { $literal: 0 },
          bonus: { $literal: 0 },
          // deposit: req.query.type === "Cash added" ? { $multiply: ["$amount", 0.82] } : { $literal: 0 },
          // bonus: "Bonus" ?"$amount": { $literal: 0 },
          totalEntry: "$amount",
        },
      });
    } else if (req.query.type === "Cash added") {
      aggpipe.push({
        $group: {
          _id: "$transaction_id",
          amount: {
            $sum: {
              $cond: [{ $eq: ["$type", "Cash added"] }, "$amount", 0],
            },
          },
          transaction_id: { $first: "$transaction_id" },
          updatedAt: { $first: "$updatedAt" },
          paymentstatus: { $first: "$paymentstatus" },
          deposit: {
            $sum: {
              $cond: [{ $eq: ["$type", "Cash added"] }, "$amount", 0],
            },
          },
          bonus: {
            $sum: {
              $cond: [{ $eq: ["$type", "Bonus"] }, "$amount", 0],
            },
          },
          totalEntry: {
            $ifNull: [{ $sum: "$amount" }, 0],
          },
        },
      });

      aggpipe.push({
        $project: {
          amount: 1,
          transaction_id: 1,
          Date: {
            $dateToString: {
              format: "%d %b %Y %H:%M",
              date: "$updatedAt",
              timezone: "Asia/Kolkata",
            },
          },
          paymentstatus: 1,
          deposit: 1,
          bonus: 1,
          winning: { $literal: 0 },
          totalEntry: 1,
        },
      });
    } else if (contestTypes.includes(req.query.type)) {
      aggpipe.push(
        {
          $lookup: {
            from: "matchcontests",
            let: { challengeId: "$challengeid" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$_id", "$$challengeId"],
                  },
                },
              },
              {
                $lookup: {
                  from: "matches",
                  let: { matchKey: "$matchkey" },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $eq: ["$_id", "$$matchKey"],
                        },
                      },
                    },
                    {
                      $addFields: {
                        team1: {
                          $arrayElemAt: [
                            {
                              $split: ["$short_name", " vs "],
                            },
                            0,
                          ],
                        },
                        team2: {
                          $arrayElemAt: [
                            {
                              $split: ["$short_name", " vs "],
                            },
                            1,
                          ],
                        },
                      },
                    },
                    {
                      $lookup: {
                        from: "teams",
                        localField: "team1Id",
                        foreignField: "_id",
                        pipeline: [
                          {
                            $project: {
                              logo: 1,
                              teamName: 1,
                            },
                          },
                        ],
                        as: "team1Data",
                      },
                    },
                    {
                      $lookup: {
                        from: "teams",
                        localField: "team2Id",
                        foreignField: "_id",
                        pipeline: [
                          {
                            $project: {
                              logo: 1,
                              teamName: 1,
                            },
                          },
                        ],
                        as: "team2Data",
                      },
                    },
                    {
                      $unwind: {
                        path: "$team1Data",
                      },
                    },
                    {
                      $unwind: {
                        path: "$team2Data",
                      },
                    },
                    {
                      $project: {
                        short_name: 1,
                        team1: 1,
                        team2: 1,
                        teamName1: "$team1Data.teamName",
                        teamName2: "$team2Data.teamName",
                        name: 1,
                        team1logo: "$team1Data.logo",
                        team2logo: "$team2Data.logo",
                      },
                    },
                  ],
                  as: "matchData",
                },
              },

              { $unwind: "$matchData" },
            ],
            as: "matchchallengesData",
          },
        },
        {
          $unwind: "$matchchallengesData",
        },
        {
          $project: {
            userid: 1,
            transaction_id: 1,
            amount: 1,
            teamName1: "$matchchallengesData.matchData.teamName1",
            teamName2: "$matchchallengesData.matchData.teamName2",
            deposit: { $ifNull: ["$addfund_amt", 0] },
            winning: { $ifNull: ["$win_amt", 0] },
            bonus: { $ifNull: ["$bonus_amt", 0] },
            paymentstatus: 1,
            totalEntry: {
              $add: [
                { $ifNull: ["$addfund_amt", 0] },
                { $ifNull: ["$win_amt", 0] },
                { $ifNull: ["$bonus_amt", 0] },
              ],
            },
            Date: {
              $dateToString: {
                format: "%d %b %Y %H:%M",
                date: "$matchchallengesData.updatedAt",
                timezone: "Asia/Kolkata",
              },
            },

            spots: { $ifNull: ["$matchchallengesData.maximum_user", 0] },
            entryFee: { $ifNull: ["$matchchallengesData.entryfee", 0] },
            prizePool: "$matchchallengesData.win_amount",
            matchName: "$matchchallengesData.matchData.short_name",
            team1: "$matchchallengesData.matchData.team1",
            team2: "$matchchallengesData.matchData.team2",
            team1Logo: {
              $cond: {
                if: {
                  $ifNull: ["$matchchallengesData.matchData.team1logo", false],
                },
                then: {
                  $concat: [
                    `${global.constant.IMAGE_URL}`,
                    "$matchchallengesData.matchData.team1logo",
                  ],
                },
                else: `${global.constant.IMAGE_URL}uploads/team/logo.png`,
              },
            },
            team2Logo: {
              $cond: {
                if: {
                  $ifNull: ["$matchchallengesData.matchData.team2logo", false],
                },
                then: {
                  $concat: [
                    `${global.constant.IMAGE_URL}`,
                    "$matchchallengesData.matchData.team2logo",
                  ],
                },
                else: `${global.constant.IMAGE_URL}uploads/team/logo.png`,
              },
            },
          },
        }
      );
    }
    let finalData = await walletTransactionModel.aggregate(aggpipe);

    if (finalData.length == 0) {
      return {
        status: true,
        message: "No Data Found",
        data: {},
      };
    }
    return {
      status: true,
      message: "Data Found",
      data: finalData[0],
    };
  } catch (error) {
    console.log(error);
    return {
      status: false,
      message: "Something went wrong",
    };
  }
};
exports.userWalletDetails = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    // Fetch wallet data from Redis
    const wallet = await redisUser.redis.hgetall(`wallet:{${userId}}`);
    if (!wallet || Object.keys(wallet).length === 0) {
      return {
        message: "Wallet not found in Redis",
        status: false,
        data: {},
      };
    }

    // Fetch user base info from Redis
    const user = await redisUser.redis.hget(`user:${userId}`, "data");
    if (!user) {
      return {
        message: "User data not found in Redis",
        status: false,
        data: {},
      };
    }

    // console.log(user, "userrrrr")
    const parsedUser = typeof user === "string" ? JSON.parse(user) : user;

    // Parse wallet values
    const balance = parseFloat(wallet.balance || 0);
    const winning = parseFloat(wallet.winning || 0);
    const bonus = parseFloat(wallet.bonus || 0);
    const totalAmount = balance + winning + bonus;

    // Parse user verification and stat data
    const verify = parsedUser.user_verify || {};
    const allverify =
      verify.mobile_verify == 1 &&
        verify.email_verify == 1 &&
        verify.pan_verify == 1 &&
        verify.bank_verify == 1
        ? 1
        : 0;

    return {
      message: "User Wallet And Verify Details",
      status: true,
      data: {
        balance: balance.toFixed(2),
        winning: winning.toFixed(2),
        bonus: bonus.toFixed(2),
        totalamount: totalAmount.toFixed(2),
        allverify,
        totalamountwon: parsedUser.totalwinning || 0,
        totaljoinedcontest: parsedUser.totalchallenges || 0,
        totaljoinedmatches: parsedUser.totalmatches || 0,
        totaljoinedseries: parsedUser.totalseries || 0,
        totalwoncontest: parsedUser.totalwoncontest || 0,
      },
    };
  } catch (error) {
    console.error("userWalletBalance Error:", error);
    return {
      status: false,
      message: "Something went wrong. Please try again later.",
      data: {},
    };
  }
};

exports.MaintenanceCheck = async (req) => {
  try {
    let keyname = `getversion`;
    let redisdata = await redisMain.getkeydata(keyname);

    if (!redisdata) {
      redisdata = await configModel.findOne({}, { maintenance: 1 });

      return {
        status: true,
        message: "Hello maintenance!!",
        data: {
          maintenance: redisdata.maintenance,
        },
      };
    }

    return {
      status: true,
      message: "Hello maintenance!!",
      data: {
        maintenance: redisdata.data.maintenance,
      },
    };
  } catch (error) {
    console.error("checkMaintenance Error:", error);
    return {
      status: false,
      message: "Something went wrong. Please try again later.",
      data: {},
    };
  }
};

/**
 * @deprecated - OTP verification is now handled by Shop backend
 * Use /login endpoint after user is synced via /internal/sync-user
 */
exports.verifyPhoneAndGetToken = async (req) => {
  try {
    const { phoneNumber } = req.body;

    // Validate input
    if (!phoneNumber) {
      return {
        status: false,
        message: "Phone number is required",
        data: {},
      };
    }

    let user = null;
    let isNewUser = false;

    // Check for existing user in Redis first
    let keyMobile = `user-${phoneNumber}`;
    let userId = await redisUser.getkeydata(keyMobile);

    if (!userId) {
      // Fetch user from DB if not in Redis
      user = await userModel.findOne({ mobile: phoneNumber });
      if (user) {
        userId = user._id.toString();
        await redisUser.setUser(user);
        await redisUser.setkeydata(keyMobile, userId, 60 * 60 * 60);
      }
    } else {
      // Fetch user from Redis
      user = await redisUser.getUser(userId);
      if (!user) {
        user = await userModel.findById(userId);
        if (user) await redisUser.setUser(user);
      }
    }

    // Create new user if not found
    if (!user) {
      isNewUser = true;
      const refer_code = await genrateReferCode(phoneNumber);
      const team = await generateTeamName(phoneNumber);
      const newUserId = new mongoose.Types.ObjectId();

      user = new userModel({
        _id: newUserId,
        mobile: phoneNumber,
        refer_code: refer_code,
        team: team,
        status: "activated",
        user_verify: {
          mobile_verify: 1,
        },
        userbalance: {
          balance: 0,
          winning: 0,
          bonus: 0,
          coin: 0,
          ticket: 0,
          promoter_balance: 0,
          passes: 0,
          extraCash: 0,
        },
      });

      await user.save();
      await redisUser.setUser(user);
      await redisUser.setkeydata(keyMobile, newUserId.toString(), 60 * 60 * 60);
    }

    // Check if user is blocked
    if (user.status && user.status.toLowerCase() === "blocked") {
      return {
        status: false,
        message: "Account blocked. Please contact administrator.",
        data: {},
      };
    }

    // Generate JWT token using the same method as verifyOtp
    const crypto = await import("node:crypto");
    if (!globalThis.crypto) {
      globalThis.crypto = crypto.webcrypto;
    }

    const { SignJWT } = await import("jose");
    const secret = Buffer.from(global.constant.SECRET_TOKEN);
    const token = await new SignJWT({ 
      _id: user._id.toString(),
      userId: user._id.toString(),
      mobile: user.mobile,
      modules: user.modules || ['shop', 'fantasy'],
      shop_enabled: user.shop_enabled !== undefined ? user.shop_enabled : true,
      fantasy_enabled: user.fantasy_enabled !== undefined ? user.fantasy_enabled : true
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .sign(secret);

    // Update user's auth_key in database first
    await userModel.updateOne({ _id: user._id }, { auth_key: token });
    
    // Update in memory and cache in Redis
    user.auth_key = token;
    await redisUser.setUser(user);

    return {
      status: true,
      message: isNewUser
        ? "New user created successfully"
        : "User logged in successfully",
      data: {
        auth_key: token,
        userid: user._id.toString(),
        mobile: user.mobile,
        team: user.team,
        refer_code: user.refer_code,
      },
    };
  } catch (error) {
    console.error("verifyPhoneAndGetToken Error:", error);
    return {
      status: false,
      message: "Something went wrong. Please try again after some time.",
      data: {},
    };
  }
};

exports.syncUserFromShop = async (req) => {
  const { 
    mobile_number, 
    hygraph_user_id, 
    first_name,
    last_name,
    username, 
    name, 
    shopTokens,
    totalSpentTokens,
    wallet_balance,
    shop_enabled, 
    fantasy_enabled 
  } = req.body;
  
  try {
    // Validate required fields
    if (!mobile_number || !hygraph_user_id) {
      return { 
        status: false, 
        message: 'mobile_number and hygraph_user_id are required' 
      };
    }

    // Find user by hygraph_user_id first (primary lookup)
    let user = await userModel.findOne({ hygraph_user_id });
    
    // Fallback to mobile_number lookup
    if (!user) {
      user = await userModel.findOne({ mobile_number });
    }
    
    if (!user) {
      // Create new user
      const referCode = await genrateReferCode(mobile_number);
      const teamName = await generateTeamName(mobile_number);
      
      user = await userModel.create({
        mobile_number,
        mobile: parseInt(mobile_number) || 0,
        hygraph_user_id,
        first_name: first_name || '',
        last_name: last_name || '',
        name: name || `${first_name || ''} ${last_name || ''}`.trim(),
        username: username || '',
        shop_enabled: shop_enabled !== undefined ? shop_enabled : true,
        fantasy_enabled: fantasy_enabled !== undefined ? fantasy_enabled : true,
        modules: ['shop', 'fantasy'],
        refer_code: referCode,
        team: teamName,
        status: 'activated',
        shopTokens: shopTokens || 0,
        totalSpentTokens: totalSpentTokens || 0,
        wallet_balance: wallet_balance || 0,
        user_verify: {
          mobile_verify: 1
        },
        userbalance: {
          balance: wallet_balance || 0,
          winning: 0,
          bonus: 0
        }
      });
    } else {
      // Update existing user with shop data
      const updateData = {
        hygraph_user_id: hygraph_user_id || user.hygraph_user_id,
        shop_enabled: shop_enabled !== undefined ? shop_enabled : user.shop_enabled,
        fantasy_enabled: fantasy_enabled !== undefined ? fantasy_enabled : user.fantasy_enabled,
        modules: user.modules || ['shop', 'fantasy']
      };

      // Update name fields if provided
      if (first_name && first_name !== user.first_name) {
        updateData.first_name = first_name;
      }
      if (last_name && last_name !== user.last_name) {
        updateData.last_name = last_name;
      }
      if (name && name !== user.name) {
        updateData.name = name;
      }
      if (username && username !== user.username) {
        updateData.username = username;
      }

      // Update token fields from Hygraph
      if (shopTokens !== undefined) {
        updateData.shopTokens = shopTokens;
      }
      if (totalSpentTokens !== undefined) {
        updateData.totalSpentTokens = totalSpentTokens;
      }
      if (wallet_balance !== undefined) {
        updateData.wallet_balance = wallet_balance;
      }

      await userModel.updateOne(
        { _id: user._id },
        updateData
      );
      user = await userModel.findOne({ _id: user._id });
    }
    
    // Update Redis cache
    await redisUser.setUser(user);
    
    return { 
      status: true, 
      message: 'User synced successfully', 
      user_id: user._id 
    };
  } catch (error) {
    console.error('Sync user error:', error);
    return { status: false, message: 'User sync failed' };
  }
};

exports.internalLogout = async (req) => {
  const { user_id, token } = req.body;
  
  try {
    // Clear Redis cache
    await redisUser.deletedata(`user:${user_id}`);
    
    // Update user's auth_key and refresh_token to invalidate both tokens
    await userModel.updateOne({ _id: user_id }, { auth_key: null, refresh_token: '' });
    
    return { status: true, message: 'User logged out successfully' };
  } catch (error) {
    console.error('Internal logout error:', error);
    return { status: false, message: 'Logout failed' };
  }
};
exports.shopVerifiedLogin = async (req) => {
  const { hygraph_user_id, mobile_number, first_name, last_name, username, name, shopTokens, totalSpentTokens, wallet_balance } = req.body;
  
  try {
    if (!hygraph_user_id || !mobile_number) {
      return { 
        status: false, 
        message: 'hygraph_user_id and mobile_number are required' 
      };
    }

    // Find user by hygraph_user_id (primary) or mobile_number (fallback)
    let user = await userModel.findOne({ hygraph_user_id });
    
    if (!user) {
      user = await userModel.findOne({ mobile_number });
    }

    if (!user) {
      return { 
        status: false, 
        message: 'User not found. Please sign up first.' 
      };
    }

    // Verify user is active
    if (user.status && user.status.toLowerCase() === 'blocked') {
      return { 
        status: false, 
        message: 'Account is blocked. Please contact support.' 
      };
    }

    // Update user data with shop info
    const updateData = {
      hygraph_user_id: hygraph_user_id || user.hygraph_user_id,
    };
    
    if (first_name && first_name !== user.first_name) {
      updateData.first_name = first_name;
    }
    if (last_name && last_name !== user.last_name) {
      updateData.last_name = last_name;
    }
    if (name && name !== user.name) {
      updateData.name = name;
    }
    if (username && username !== user.username) {
      updateData.username = username;
    }
    
    // Sync token/wallet data from Hygraph
    if (shopTokens !== undefined) {
      updateData.shopTokens = shopTokens;
    }
    if (totalSpentTokens !== undefined) {
      updateData.totalSpentTokens = totalSpentTokens;
    }
    if (wallet_balance !== undefined) {
      updateData.wallet_balance = wallet_balance;
    }

    if (Object.keys(updateData).length > 1) {
      user = await userModel.findByIdAndUpdate(user._id, updateData, { new: true });
    }

    // Generate tokens
    const { SignJWT } = await import("jose");
    const secret = Buffer.from(global.constant.SECRET_TOKEN);
    
    // Generate short-lived access token (15 minutes)
    const accessToken = await new SignJWT({ 
      _id: user._id.toString(),
      userId: user._id.toString(),
      mobile_number: user.mobile_number,
      modules: user.modules || ['shop', 'fantasy'],
      shop_enabled: user.shop_enabled !== false,
      fantasy_enabled: user.fantasy_enabled !== false
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime('15m')
      .setIssuedAt()
      .sign(secret);
    
    // Generate long-lived refresh token (30 days)
    const refreshToken = await new SignJWT({
      userId: user._id.toString(),
      type: 'refresh',
      mobile_number: user.mobile_number
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime('30d')
      .setIssuedAt()
      .sign(secret);

    // Update user with new tokens
    await userModel.updateOne(
      { _id: user._id }, 
      { 
        auth_key: accessToken,
        refresh_token: refreshToken
      }
    );

    // Cache user in Redis
    user.auth_key = accessToken;
    user.refresh_token = refreshToken;
    await redisUser.setUser(user);

    return { 
      status: true, 
      message: 'Login successful',
      user_id: user._id.toString(),
      auth_key: accessToken,
      refresh_token: refreshToken,
      user: {
        _id: user._id,
        mobile_number: user.mobile_number,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        name: user.name,
        hygraph_user_id: user.hygraph_user_id,
        modules: user.modules,
        shop_enabled: user.shop_enabled,
        fantasy_enabled: user.fantasy_enabled,
        shopTokens: user.shopTokens,
        totalSpentTokens: user.totalSpentTokens,
        wallet_balance: user.wallet_balance
      }
    };
  } catch (error) {
    console.error('Shop verified login error:', error);
    return { status: false, message: 'Login failed' };
  }
};