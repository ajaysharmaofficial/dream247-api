const mongoose = require('mongoose');
const axios = require("axios");
const userModel = require('../../../models/userModel');
const randomstring = require('randomstring');
const configModel = require("../../../models/configModel");
const TransactionModel = require("../../../models/walletTransactionModel");
const moment = require('moment');
const GetBonus = require("../../../utils/getBonus.js");
// const sendboxapi = require("../../../utils/sendboxapi.js");
const verificationapi = require("../../../utils/verificationapi.js");
const NotificationModel = require("../../../models/alertModel");
const referralRewardModel = require("../../../models/referralRewardModel.js");
const IndianStateModel = require("../../../models/IndianStateModel.js");
const redisMain = require("../../../utils/redis/redisMain");
const redisUser = require("../../../utils/redis/redisUser");
const { sendToQueue } = require('../../../utils/kafka.js');

exports.dbCheck = async () => {
  try {
    // MongoDB Health Check
    const mongoConnected = mongoose.connection.readyState === 1; // 1 means connected
    // const mongoConnected = true; // 1 means connected

    // Redis Health Check
    const redisPing = await redisMain.healthCheck();
    const redisConnected = redisPing === "PONG";

    // Determine overall health status
    const isHealthy = mongoConnected;

    return {
      status: isHealthy,
      database: { status: mongoConnected, message: mongoConnected ? "MongoDB is connected." : "MongoDB is not connected." },
      redis: { status: redisConnected, message: redisConnected ? "Redis is connected." : "Redis is not responding." }
    };
  } catch (error) {
    return {
      status: false,
      database: { status: false, message: "Database health check failed.", error: error.message },
      redis: { status: false, message: "Redis health check failed.", error: error.message }
    };
  }
};

exports.socialAuthenticate = async (req) => {
  try {
    const url = "https://www.googleapis.com/oauth2/v1/userinfo";
    let userDataByAuth = await axios
      .get(url, {
        headers: {
          Authorization: `Bearer ${req.body.email}`,
        },
      })
      .then((response) => {
        return response.data;
      })
      .catch((error) => {
        console.error("Error fetching user info:", error.message);
        return "error";
      });
    if (userDataByAuth == "error") {
      return {
        message: "wrong token.",
        status: false,
        data: {},
      };
    }

    const existingUser = await userModel.find({
      _id: { $ne: req.user._id },
      email: userDataByAuth.email,
    });

    if (existingUser && existingUser.length > 0) {
      return {
        message: "Email is already in use by another account.",
        status: false,
        data: {},
      };
    }

    const emailBonus = await new GetBonus().getBonus(
      global.constant.BONUS_TYPES.EMAIL_BONUS,
      global.constant.PROFILE_VERIFY_BONUS_TYPES_VALUES.FALSE
    );

    await sendToQueue("email-verification-topic",
      {
        emailBonus: emailBonus,
        userId: req.user._id,
        email: userDataByAuth.email
      }
    );

    return {
      status: true,
      message: "Email verify successfully",
    };

  } catch (error) {
    console.error("Database Health Check Error:", error);
    return {
      status: false,
      message: "Internal Server Error.",
      error: error.message
    };
  }
};

exports.adharCardSentOtp = async (req) => {
  try {
    const aadharNumber = req.body.aadharnumber;

    // Check if Aadhaar is already used in another account
    const user = await userModel.findOne({
      "aadharcard.aadhar_number": aadharNumber,
      "aadharcard.status": 1,
    });

    if (user) {
      return {
        message: "This Aadhaar is already registered with another Account.",
        status: false,
        data: {},
      };
    }

    let currentUser = await redisUser.getUser(req.user._id);

    if (!currentUser) {
      currentUser = await userModel.findById(req.user._id);
    } else {
      // Convert plain object to Mongoose document without inserting
      currentUser = userModel.hydrate(currentUser);
    }

    // console.log("currentUser", currentUser);

    if (!currentUser) {
      return {
        message: "User not found.",
        status: false,
        data: {},
      };
    }
    // Save the user record in MongoDB
    const updatedUser = await currentUser.save();

    // Update user data in Redis
    await redisUser.setUser(updatedUser);

    // console.log("updatedUser", updatedUser);

    // Send OTP
    let response = await verificationapi.aadhaarGenerateOtp(req);

    if (response.status === "SUCCESS") {
      return response;
    } else {
      return {
        message: `Attempt failed.`,
        status: false,
        data: response.data || {},
      };
    }
  } catch (error) {
    console.error("Error:", error);
    return {
      status: false,
      message: "Internal Server Error.",
      error: error.message,
    };
  }
};

exports.adharcardVeifyOtp = async (req) => {
  try {
    let user = await redisUser.getUser(req.user._id);
    if (!user) {
      user = await userModel.findOne({ id: req.user._id });
    }

    const data = await verificationapi.aadhaarVerifyOtp(req);
    // console.log("dataaaaaaaaaaaaaaadhaaaaaaaarrrrrr", data);
    if (data.status !== "VALID") {
      console.log("Aadhaar verification failed:", data.message);
      return {
        status: false,
        message: data.message || "Aadhaar verification failed."
      };
    }
    const update = {};
    let gender = "Male";
    if (data.gender != "M") {
      gender = "Female";
    }
    update["$set"] = {
      "user_verify.aadhar_verify":
        global.constant.PROFILE_VERIFY_AADHAR_BANK.APPROVE,
    };

    update["aadharcard"] = {
      state: data.split_address.state,
      aadhar_number: req.body.aadharnumber,
      aadhar_dob: data.dob,
      aadhar_name: data.name.toUpperCase(),
      status: global.constant.AADHARCARD.APPROVED,
      created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      updated_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      address: data.address,
      city: data.split_address.dist,
      gender: gender,
      pincode: data.split_address.pincode,
      state: data.split_address.state,
      frontimage: data.photo_link,
    };

    let data1 = {
      dob: data.dob,
      address: data.address,
      city: data.split_address.dist,
      gender: gender,
      pincode: data.split_address.pincode,
      state: data.split_address.state,
      username: data.name,
      aadharcard: update["aadharcard"],
      user_verify: update["user_verify"]
    };

    await sendToQueue("aadhar-verification-topic",
      {
        userId: req.user._id,
        obj: data1
      }
    );

    // await NotificationModel.create({
    //   title: "Your aadhar card successfully verify.",
    //   userid: req.user._id,
    // });

    return {
      message: "Your aadhar card successfully verify.",
      status: true,
      data: { userid: req.user._id },
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      status: false,
      message: "Internal Server Error.",
      error: error.message
    };
  }
}

// async function aadhar_Details(req) {
//   try {
//     let abc;
//     // Check if the bankstatus is 1 (indicating the bank verification is successful)

//     if (req.body.aadhar_verify == 1) {
//       // Get the bank bonus amount
//       const aadharBonus = await new GetBonus().getBonus(
//         global.constant.BONUS_TYPES.AADHAR_BONUS,
//         global.constant.PROFILE_VERIFY_AADHAR_BANK.SUBMITED
//       );
//       // Give the bank bonus to the user and update their verification status
//       abc = await givebonusToUser(
//         aadharBonus,
//         req.user._id,
//         global.constant.PROFILE_VERIFY_BONUS_TYPES.AADHAR_BONUS,
//         global.constant.USER_VERIFY_TYPES.AADHAR_VERIFY
//       );
//     } else if (req.body.aadhar_verify == 2) {
//       // Check if the bankstatus is 2 (indicating the bank verification is rejected)
//       // Update the user's bank status, bank verification status, and add an optional comment
//       const panCredentials = await userModel.findOneAndUpdate(
//         { _id: req.user._id },
//         {
//           $set: {
//             "aadharcard.status": req.body.aadhar_verify,
//             "user_verify.aadhar_verify": req.body.aadhar_verify
//           },
//         },
//         { new: true }
//       );
//       // If the update fails, return an error message

//       if (!panCredentials) {
//         return {
//           status: false,
//           message: "pan status can not update..error",
//         };
//       } else {
//         return {
//           status: true,
//           message: "pan rejected successfully ...",
//           data: panCredentials,
//         };
//       }
//     }
//     // If abc is truthy (indicating the bank bonus was given successfully or bank verification status was updated)
//     if (abc) {
//       // Update the user's bank status, bank verification status, and add an optional comment
//       const aadharcardCredentials = await userModel.findOneAndUpdate(
//         { _id: req.user._id },
//         {
//           $set: {
//             "aadharcard.status": req.body.pan_verify,
//             "user_verify.pan_verify": req.body.pan_verify,
//             "bank.comment": req.body.comment || "",
//           },
//         },
//         { new: true }
//       );
//       // If the update fails, return an error message

//       if (!aadharcardCredentials) {
//         return {
//           status: false,
//           message: "aadharcard status can not update..error",
//         };
//       } else {
//         return {
//           status: true,
//           message: "update successfully ..",
//           data: aadharcardCredentials,
//         };
//       }
//     }
//   } catch (error) {
//     console.log(error);
//     throw error;
//   }
// }

async function updateUserBalanceAndUserVerify(data) {
  // console.log(`data----------------------------------`, data);
  const update = {};
  update["$inc"] = { "userbalance.bonus": data.bonusamount };
  if (data.type == global.constant.PROFILE_VERIFY_BONUS_TYPES.SIGNUP_BONUS)
    update["$inc"]["userbalance.balance"] = data.banlance;
  update["code"] = "";
  if (data.verifyType != "") update[`user_verify.${data.verifyType}`] = 1;
  if (data.type != global.constant.PROFILE_VERIFY_BONUS_TYPES.REFER_BONUS)
    update[`user_verify.${data.type}`] = 1;
  return await userModel.findOneAndUpdate({ _id: data.userId }, update, {
    new: true,
  });
}

exports.givebonusToUser = async (
  bonusamount = 0,
  userId,
  type,
  verifyType = "",
  referUser
) => {
  console.log("hititng 22222222222222222222222222222222");
  try {
    if (!referUser) {
      referUser = null;
    }
    console.log(
      bonusamount,
      "------------",
      userId,
      "-----------------",
      type,
      "----------",
      verifyType
    );
    const transaction_id = `${global.constant.APP_SHORT_NAME}-EBONUS-${Date.now()}`;
    const balanceUpdate = await updateUserBalanceAndUserVerify({
      bonusamount,
      type,
      verifyType,
      userId,
    });
    if (Number(bonusamount) > 0) {
      await TransactionModel.create({
        userid: userId,
        type: global.constant.BONUS_NAME[type],
        transaction_id,
        transaction_by: global.constant.TRANSACTION_BY.APP_NAME,
        amount: bonusamount,
        paymentstatus: global.constant.PAYMENT_STATUS_TYPES.CONFIRMED,
        challengeid: null,
        seriesid: null,
        joinid: null,
        bonus_amt: bonusamount,
        win_amt: 0,
        addfund_amt: 0,
        bal_bonus_amt: balanceUpdate.userbalance.bonus || 0,
        bal_win_amt: balanceUpdate.userbalance.balance || 0,
        bal_fund_amt: balanceUpdate.userbalance.winning || 0,
        total_available_amt:
          balanceUpdate.userbalance.balance ||
          0 + balanceUpdate.userbalance.winning ||
          0 + balanceUpdate.userbalance.bonus ||
          0,
        withdraw_amt: 0,
        challenge_join_amt: 0,
        cons_bonus: 0,
        cons_win: 0,
        cons_amount: 0,
      });
      let bonus_refered = {};
      bonus_refered["userid"] = referUser;
      bonus_refered["fromid"] = userId;
      bonus_refered["amount"] = 51;
      bonus_refered["type"] = "signup bonus";
      bonus_refered["txnid"] = transaction_id;

      let bonusRefModel = await referralRewardModel.create(bonus_refered);
      // console.log("---bonusRefModel--->--", bonusRefModel);

      if (type == global.constant.PROFILE_VERIFY_BONUS_TYPES.REFER_BONUS) {
        const dataToSave = {
          $push: {
            bonusRefered: {
              userid: mongoose.Types.ObjectId(referUser),
              amount: bonusamount,
              txnid: transaction_id,
            },
          },
        };
        await userModel.findOneAndUpdate({ _id: userId }, dataToSave, {
          new: true,
        });
      }

      if (!balanceUpdate.app_key) {
        return true;
      }
      // await notification.PushNotifications(notificationObject);
    }

    return true;
  } catch (error) {
    console.log(error);
  }
}

exports.aadharDetails = async (req) => {
  try {
    let user = await redisUser.getUser(req.user._id);
    if (!user) {
      user = await userModel.findOne(
        { _id: req.user._id },
        { aadharcard: 1, user_verify: 1 }
      );
    }
    // console.log(`user`, user);
    if (!user || !user["aadharcard"]) {
      return {
        message: "aadharcard Informtion not submited yet",
        status: false,
        data: {},
      };
    }

    // console.log("user", user);

    if (user.user_verify.aadhar_verify == 0) {
      const manualAadhar = await manualKycModel.findOne({ userid: mongoose.Types.ObjectId(req.user._id) });

      if (manualAadhar) {
        return {
          status: true,
          message: "Aadhar card not verified yet.",
          data: {
            status: true,
            aadharnumber: manualAadhar.aadhar.aadharnumber || "",
            aadharname: manualAadhar.aadhar.aadharname || "",
            aadhar_dob: manualAadhar.aadhar.aadhardob || "",
            state: manualAadhar.aadhar.state || "",
            address: manualAadhar.aadhar.address || "",
            city: manualAadhar.aadhar.city || "",
            gender: manualAadhar.aadhar.gender || "",
            pincode: manualAadhar.aadhar.pincode || "",
            //aadhardob: moment(manualAadhar.aadhar.aadhar_dob).format("DD MMM ,YYYY"),
            //comment: manualAadhar.aadhar.comment || "",
            frontimage: manualAadhar.aadhar.frontimage
              ? `${global.constant.IMAGE_URL}${manualAadhar.aadhar.frontimage}`
              : "",
            backimage: manualAadhar.aadhar.backimage
              ? `${global.constant.IMAGE_URL}${manualAadhar.aadhar.backimage}`
              : "",
            // imagetype: manualAadhar.aadhar.image
            //   ? path.extname(manualAadhar.aadhar.image) == "pdf"
            //     ? "pdf"
            //     : "image"
            //   : "",
          },
        }
      }
    } else {
      return {
        message: "",
        status: true,
        data: {
          status: true,

          aadharnumber: user["aadharcard"].aadhar_number || "",
          aadharname: user["aadharcard"].aadhar_name || "",
          aadhar_dob: user["aadharcard"].aadhar_dob || "",
          state: user["aadharcard"].state || "",
          address: user["aadharcard"].address || "",
          city: user["aadharcard"].gender || "",
          gender: user["aadharcard"].gender || "",
          pincode: user["aadharcard"].pincode || "",
          //aadhardob: moment(user["aadharcard"].aadhar_dob).format("DD MMM ,YYYY"),
          //comment: user["aadharcard"].comment || "",
          frontimage: user["aadharcard"].frontimage
            ? `${global.constant.IMAGE_URL}${user["aadharcard"].frontimage}`
            : "",
          backimage: user["aadharcard"].backimage
            ? `${global.constant.IMAGE_URL}${user["aadharcard"].backimage}`
            : "",
          // imagetype: user["aadharcard"].image
          //   ? path.extname(user["aadharcard"].image) == "pdf"
          //     ? "pdf"
          //     : "image"
          //   : "",
        },
      };
    }
  } catch (error) {
    console.error("Error:", error);
    return {
      status: false,
      message: "Internal Server Error.",
      error: error.message
    };
  }
}

exports.panVerfication = async (req) => {
  try {
    const pannumber = req.body.pannumber;

    // Check if Aadhaar is already used in another account
    const findUser = await userModel.findOne({
      "pancard.pan_number": pannumber,
      "pancard.status": 1,
    });

    if (findUser) {
      return {
        message: "This Pan is already registered with another Account.",
        status: false,
        data: {},
      };
    }

    // let allStates = await redisMain.getkeydata("getStates");

    // if (!allStates) {
    //   // If not found in Redis, fetch from MongoDB
    //   const states = await IndianStateModel.find().select("name status");

    //   if (states.length > 0) {
    //     allStates = states.map(state => ({
    //       name: state.name.toUpperCase(),
    //       status: state.status
    //     }));

    //     // Store in Redis without expiry
    //     await redisMain.setkeydata("getStates", JSON.stringify(allStates), 432000);
    //   }
    // } else {
    //   // Parse the Redis string into an array
    //   allStates = JSON.parse(allStates);
    // }

    // // Extract banned state names
    // const bannedStateNames = allStates
    //   .filter(state => !state.status) // Filter only banned states (status: false)
    //   .map(state => state.name);

    // // Retrieve user from Redis
    let currentUser = await redisUser.getUser(req.user._id);

    if (!currentUser) {
      currentUser = await userModel.findById(req.user._id);
    } else {
      // Convert plain object to Mongoose document without inserting
      currentUser = userModel.hydrate(currentUser);
    }

    // if (bannedStateNames.includes(currentUser.state.toUpperCase())) {
    //   return {
    //     message: "You're from a Banned or Restricted State, that's why you can't Verify Further.",
    //     status: false,
    //     data: {},
    //   };
    // }

    // Check if user is below 18
    const dobParts = currentUser.dob.split("-"); // Split 'DD-MM-YYYY'
    const dobDate = new Date(`${dobParts[2]}-${dobParts[1]}-${dobParts[0]}`); // Convert to 'YYYY-MM-DD'
    const today = new Date();
    let age = today.getFullYear() - dobDate.getFullYear();

    // Adjust age if birthday hasn't occurred yet this year
    const monthDiff = today.getMonth() - dobDate.getMonth();
    const dayDiff = today.getDate() - dobDate.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age--;
    }

    if (age < 18) {
      return {
        message: "You must be at least 18 years old to verify.",
        status: false,
        data: {},
      };
    }

    if (!currentUser) {
      currentUser = await userModel.findById(req.user._id);
    } else {
      // Convert plain object to Mongoose document without inserting
      currentUser = userModel.hydrate(currentUser);
    }

    if (currentUser) {
      req.body.name = currentUser.aadharcard.aadhar_name;

      // Initialize daily limit data if not present
      if (!currentUser?.pancard?.dailyLimit) {
        currentUser.pancard = {
          dailyLimit: {
            count: 0,
            lastAttemptDate: null,
          }
        }
      }

      const { dailyLimit } = currentUser.pancard;
      const currentDate = moment();
      const lastAttemptDate = dailyLimit.lastAttemptDate ? moment(dailyLimit.lastAttemptDate) : null;

      // Check if the last attempt is within the same day
      const isSameDay = lastAttemptDate && lastAttemptDate.isSame(currentDate, "day");
      const maxAttempts = 3;
      const remainingAttempts = maxAttempts - dailyLimit.count;

      if (isSameDay && dailyLimit.count >= maxAttempts) {
        return {
          message: "You have reached today's limit. Please try again tomorrow.",
          status: false,
          data: {},
        };
      }

      // 5-Minute Gap Check
      if (lastAttemptDate && currentDate.diff(lastAttemptDate, "minutes") < 5) {
        const remainingTime = 5 - currentDate.diff(lastAttemptDate, "minutes");
        return {
          message: `Please try again in ${remainingTime} minutes.`,
          status: false,
          data: {},
        };
      }

      // Reset the counter if the day has changed
      if (!isSameDay) {
        dailyLimit.count = 0;
        dailyLimit.lastAttemptDate = currentDate;
      }

      // Increment the counter and update the last attempt date
      dailyLimit.count += 1;
      dailyLimit.lastAttemptDate = currentDate;

      // Save the user record
      const updatedUser = await currentUser.save();
      await redisUser.setUser(updatedUser);

      let responseapi;
      if (updatedUser) {
        req.body.name = updatedUser.aadharcard.aadhar_name;
        req.body.dob = updatedUser.dob;
        responseapi = await verificationapi.pancardVerify(req);
        // console.log("responseapi", responseapi);
      }

      if (responseapi == undefined || responseapi.status === false || responseapi === false) {
        if (responseapi?.reason) {
          let reason = responseapi?.reason;

          switch (reason) {
            case 'NO_MATCH':
              return {
                status: false,
                message: `Your Pan Name is not matching your Aadhar Name. ${remainingAttempts - 1} attempt left.`,
              };
            case 'POOR_PARTIAL_MATCH':
              return {
                status: false,
                message: `Your Pan Name is not matching your Aadhar Name. ${remainingAttempts - 1} attempt left.`,
              };
            case 'MIDDLE_NAME_MISSING':
              return {
                status: false,
                message: `Your Aadhar Name is missing a middle name that is present in your Pan Name. ${remainingAttempts - 1} attempt left.`,
              };
            case 'PARTIAL_MATCH':
              return {
                status: false,
                message: `Your Pan Name is partially matching your Aadhar Name. ${remainingAttempts - 1} attempt left.`,
              };
            case 'MISSING_LAST_NAME':
              return {
                status: false,
                message: `The last name is missing from the Pan Name. ${remainingAttempts - 1} attempt left.`,
              };
            case 'INVALID_PAN':
              return {
                status: false,
                message: `Invalid PAN. ${remainingAttempts - 1} attempt left.`,
              };
            default:
              return {
                status: false,
                message: `Invalid PAN. ${remainingAttempts - 1} attempt left.`,
              };
          }
        } else {
          return {
            status: false,
            message: `${responseapi.message}. Contact Support Team.`
          }
        }
      }

      if (responseapi.status) {
        req.body.pan_verify = 1;
        // await pancard_Details(req);
        const update = {};
        update['$set'] = {
          'user_verify.pan_verify': 1,
        };
        update['pancard'] = {
          pan_number: responseapi.data.pan_response.pan,
          pan_name: responseapi.data.pan_response.registered_name,
          status: global.constant.PANCARD.APPROVED,
          comment: req.body.comment ? req.body.comment : '',
          created_at: moment().format('YYYY-MM-DD HH:mm:ss'),
          updated_at: moment().format('YYYY-MM-DD HH:mm:ss'),
        };

        await sendToQueue("pan-verification-topic",
          {
            userId: req.user._id,
            obj: update
          }
        );
        // await userModel.updateOne({ _id: req.user._id }, update, { new: true });

        return {
          message: 'Your pan card request has been successfully verified.',
          status: true,
          data: { userid: req.user._id },
        };
      }
    }
  } catch (error) {
    console.error("Error:", error);
    return {
      status: false,
      message: "Internal Server Error.",
      error: error.message
    };
  }
}

// async function pancard_Details(req) {
//   try {
//     let abc;
//     // Check if the bankstatus is 1 (indicating the bank verification is successful)

//     if (req.body.pan_verify == 1) {
//       // Get the bank bonus amount
//       const panBonus = await new GetBonus().getBonus(
//         global.constant.BONUS_TYPES.PAN_BONUS,
//         global.constant.PROFILE_VERIFY_PAN_BANK.SUBMITED
//       );
//       // Give the bank bonus to the user and update their verification status
//       abc = await givebonusToUser(
//         panBonus,
//         req.user._id,
//         global.constant.PROFILE_VERIFY_BONUS_TYPES.PAN_BONUS,
//         global.constant.USER_VERIFY_TYPES.PROFILE_VERIFY_PAN_BANK
//       );
//     } else if (req.body.pan_verify == 2) {
//       // Check if the bankstatus is 2 (indicating the bank verification is rejected)
//       // Update the user's bank status, bank verification status, and add an optional comment
//       const panCredentials = await userModel.findOneAndUpdate(
//         { _id: req.user._id },
//         {
//           $set: {
//             "pancard.status": req.body.pan_verify,
//             "user_verify.pan_verify": req.body.pan_verify,
//             "bank.comment": req.body.comment || "",
//           },
//         },
//         { new: true }
//       );
//       // If the update fails, return an error message

//       if (!panCredentials) {
//         return {
//           status: false,
//           message: "pan status can not update..error",
//         };
//       } else {
//         return {
//           status: true,
//           message: "pan rejected successfully ...",
//           data: panCredentials,
//         };
//       }
//     }
//     // If abc is truthy (indicating the bank bonus was given successfully or bank verification status was updated)
//     if (abc) {
//       // Update the user's bank status, bank verification status, and add an optional comment
//       const panCredentials = await userModel.findOneAndUpdate(
//         { _id: req.user._id },
//         {
//           $set: {
//             "pancard.status": req.body.pan_verify,
//             "user_verify.pan_verify": req.body.pan_verify,
//             "bank.comment": req.body.comment || "",
//           },
//         },
//         { new: true }
//       );
//       // If the update fails, return an error message

//       if (!panCredentials) {
//         return {
//           status: false,
//           message: "pan status can not update..error",
//         };
//       } else {
//         return {
//           status: true,
//           message: "update successfully ..",
//           data: panCredentials,
//         };
//       }
//     }
//   } catch (error) {
//     console.log(error);
//     throw error;
//   }
// }

exports.panDetails = async (req) => {
  try {
    let user = await redisUser.getUser(req.user._id);
    if (!user) {
      user = await userModel.findOne({ _id: req.user._id }, { pancard: 1, user_verify: 1 });
    }
    // console.log(`user`, user);
    if (!user || !user["pancard"]) {
      return {
        message: "Pancard Informtion not submited yet",
        status: false,
        data: {},
      };
    }

    // if (user.user_verify.pan_verify == 0) {
    //   const manualAadhar = await manualKycModel.findOne({ userid: mongoose.Types.ObjectId(req.user._id) });

    //   console.log("manualAadhar", manualAadhar);

    //   if (manualAadhar) {
    //     return {
    //       status: true,
    //       message: "Pan card not verified yet.",
    //       data: {
    //         status: true,
    //         panname: manualAadhar.pan.panname.toUpperCase(),
    //         pannumber: manualAadhar.pan.pannumber.toUpperCase(),
    //         pandob: moment(manualAadhar.pan.pandob, "DD/MM/YYYY").format("DD MMM, YYYY"),
    //         comment: manualAadhar.pan.comment || "",
    //         image: manualAadhar.pan.image
    //           ? `${global.constant.IMAGE_URL}${manualAadhar.pan.image}`
    //           : "",
    //         imagetype: manualAadhar.pan.image
    //           ? path.extname(manualAadhar.pan.image) === ".pdf"
    //             ? "pdf"
    //             : "image"
    //           : "",
    //       },
    //     };
    //   }
    // } else {
    return {
      message: "",
      status: true,
      data: {
        status: true,
        panname: user["pancard"].pan_name?.toUpperCase(),
        pannumber: user["pancard"].pan_number?.toUpperCase(),
        pandob: moment(user["pancard"].pan_dob).format("DD MMM ,YYYY"),
        comment: user["pancard"].comment || "",
        image: user["pancard"].image
          ? `${global.constant.IMAGE_URL}${user["pancard"].image}`
          : "" || "",
        imagetype: user["pancard"].image
          ? path.extname(user["pancard"].image) == "pdf"
            ? "pdf"
            : "image"
          : "",
      },
    };
    // }
  } catch (error) {
    console.error("Error:", error);
    return {
      status: false,
      message: "Internal Server Error.",
      error: error.message
    };
  }
}

exports.bankVerificationReq = async (req) => {
  try {
    const { accno, confirm_accno, ifsc, accountholder, bankName, city, state, type, comment } = req.body;
    if (!accno) return { message: "Please insert your account number.", status: false, data: {} };
    if (!confirm_accno) return { message: "Please insert your confirm account number.", status: false, data: {} };
    if (!ifsc) return { message: "Please insert your IFSC code.", status: false, data: {} };
    if (!accountholder) return { message: "Please insert account holder name.", status: false, data: {} };
    if (!bankName) return { message: "Please insert bank name.", status: false, data: {} };
    if (!city) return { message: "Please insert city.", status: false, data: {} };

    const existingUser = await userModel.findOne({ "bank.accno": accno, "bank.status": 1 });
    if (existingUser) {
      return {
        message: "This Bank Account is already registered with other Account.",
        status: false,
        data: {},
      };
    }

    // Retrieve user from Redis
    let currentUser = await redisUser.getUser(req.user._id);

    if (!currentUser) {
      currentUser = await userModel.findById(req.user._id);
    } else {
      // Convert plain object to Mongoose document without inserting
      currentUser = userModel.hydrate(currentUser);
    }

    if (currentUser) {
      req.body.name = req.body.accountholder;



      // Save the user record
      const updatedUser = await currentUser.save();
      await redisUser.setUser(updatedUser);

      const fetchBankDetails = {
        accountholder: req.body.accountholder.toUpperCase(),
        accno,
        ifsc: ifsc.toUpperCase(),
        bankname: req.body.bankName,
        bankbranch: req.body.bankName,
        state,
        city: req.body.city,
        confirm_accno,
        type,
        comment: comment || "",
        status: global.constant.BANK.APPROVED,
        created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        updated_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      };

      await sendToQueue('bank-verification-topic',
        {
          userId: req.user._id,
          obj: fetchBankDetails
        }
      )

      return {
        message: "Bank Request Successfully verified.",
        status: true,
        data: { userid: req.user._id },
      };
    }
  } catch (error) {
    console.error("Error:", error);
    return {
      status: false,
      message: "Internal Server Error.",
      error: error.message
    };
  }
}

exports.fetchBankDetails = async (req) => {
  try {
    let user = await redisUser.getUser(req.user._id);
    if (!user) {
      user = await userModel.findOne(
        { _id: req.user._id },
        { bank: 1, user_verify: 1 }
      );
    }
    if (!user || !user["bank"]) {
      return {
        message: "Bank Informtion not submited yet",
        status: false,
        data: {},
      };
    }

    // console.log("user", user);

    // if (user.user_verify.bank_verify == 0) {
    //   const manualAadhar = await manualKycModel.findOne({ userid: mongoose.Types.ObjectId(req.user._id) });

    // if (manualAadhar) {
    //   return {
    //     status: true,
    //     message: "Bank not verified yet.",
    //     data: {
    //       status: true,
    //       accountholdername: manualAadhar.bank.accholdername,
    //       accno: manualAadhar.bank.accountnumber,
    //       ifsc: manualAadhar.bank.ifsc.toUpperCase(),
    //       // type: manualAadhar.bank.type,
    //       confirm_accno: manualAadhar.bank.accountnumber,
    //       bankname: manualAadhar.bank.bankname,
    //       bankbranch: manualAadhar.bank.branchname,
    //       // state: manualAadhar.bank.state,
    //       comment: manualAadhar.bank.comment || "",
    //       city: manualAadhar.bank.city || "",
    //       image: manualAadhar.bank.image
    //         ? `${global.constant.IMAGE_URL}${manualAadhar.bank.image}`
    //         : "",
    //       imagetype: manualAadhar.bank.image
    //         ? path.extname(manualAadhar.bank.image) == "pdf"
    //           ? "pdf"
    //           : "image"
    //         : "",
    //     }
    //   }
    // }
    // } else {
    return {
      message: "Bank Details",
      status: true,
      data: {
        status: true,
        accountholdername: user["bank"].accountholder,
        accno: user["bank"].accno,
        ifsc: user["bank"].ifsc.toUpperCase(),
        type: user["bank"].type,
        confirm_accno: user["bank"].confirm_accno,
        bankname: user["bank"].bankname,
        bankbranch: user["bank"].city,
        state: user["bank"].state,
        comment: user["bank"].comment || "",
        city: user["bank"].city || "",
        image: user["bank"].image
          ? `${global.constant.IMAGE_URL}${user["bank"].image}`
          : "",
        imagetype: user["bank"].image
          ? path.extname(user["bank"].image) == "pdf"
            ? "pdf"
            : "image"
          : "",
      },
    };
    // }

  } catch (error) {
    console.error("Error:", error);
    return {
      status: false,
      message: "Internal Server Error.",
      error: error.message
    };
  }
};


exports.kycFullDetails = async (req) => {
  try {
    const userId = req.user._id;

    // Check Redis for cached data
    let userKyc = await redisUser.getUser(userId);

    if (!userKyc) {
      // If not found in Redis, fetch from MongoDB
      userKyc = await userModel.aggregate([
        {
          $match: { _id: mongoose.Types.ObjectId(userId) }
        },
        {
          $project: {
            email: 1,
            mobile: 1,
            email_verify: "$user_verify.email_verify",
            mobile_verify: "$user_verify.mobile_verify",
            aadhar_verify: "$user_verify.aadhar_verify",
            pan_verify: "$user_verify.pan_verify",
            bank_verify: "$user_verify.bank_verify",
            aadharcard: 1,
            pancard: 1,
            bank: 1
          }
        }
      ]);

      if (userKyc.length > 0) {
        // Store in Redis (set expiry if needed)
        await redisUser.setUser(userKyc);

        return {
          status: true,
          message: "KYC Details",
          data: userKyc[0]
        };
      } else {
        return {
          status: false,
          message: "No KYC Details found",
          data: {}
        };
      }
    } else {
      // **Ensure userKyc is an object before using it**
      if (typeof userKyc === "string") {
        userKyc = JSON.parse(userKyc);
      }

      return {
        status: true,
        message: "KYC Details",
        data: {
          email: userKyc.email,
          mobile: userKyc.mobile,
          email_verify: userKyc.user_verify?.email_verify,
          mobile_verify: userKyc.user_verify?.mobile_verify,
          aadhar_verify: userKyc.user_verify?.aadhar_verify,
          pan_verify: userKyc.user_verify?.pan_verify,
          bank_verify: userKyc.user_verify?.bank_verify,
          aadharcard: userKyc.aadharcard,
          pancard: userKyc.pancard,
          bank: userKyc.bank
        }
      };
    }

  } catch (error) {
    console.error("Error:", error);
    return {
      status: false,
      message: "Internal Server Error.",
      error: error.message
    };
  }
};

