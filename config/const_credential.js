const AWS = require("aws-sdk");
require("dotenv").config();
// let obj = { region: process.env.REGION };
// let secretsManager;
// if (process.env.redisEnv == 'dev') {
//   AWS.config.update({
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID_NEW,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_NEW,
//     region: process.env.REGION,
//   });

//   secretsManager = new AWS.SecretsManager();
// } else {
//   secretsManager = new AWS.SecretsManager(obj);
// }


// Function to fetch secrets from AWS Secrets Manager
// const getSecret = async (secretName) => {
//   try {
//     const data = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
//     if (data.SecretString) {
//       return JSON.parse(data.SecretString); // Parse JSON secret
//     } else {
//       return Buffer.from(data.SecretBinary, "base64").toString("ascii");
//     }
//   } catch (error) {
//     console.error("Error fetching secret:", error);
//     throw error;
//   }
// };

// Export constants after fetching secrets
// const initializeConstants = async () => {
//   console.log('process.env.secretManager', process.env.secretManager);
const secret = process.env;
const credentials = {
  DB_URL: secret.DB_URL || "mongodb://127.0.0.1:27017/",
  NODE_ENV: secret.NODE_ENV,
  DB_NAME: secret.DB_NAME,
  appName: secret.APP_NAME,
  SECRET_TOKEN: secret.SECRET_TOKEN,
  ADMIN_URL: secret.ADMIN_URL,
  WEBSITE_URL: secret.WEBSITE_URL,
  REFERAL_URL: secret.REFERAL_URL,
  APK_URL: secret.APK_URL,
  APP_SHORT_NAME: secret.APP_SHORT_NAME,
  API_PORT: secret.API_PORT,
  ADMIN_PORT: secret.ADMIN_PORT,
  CRON_PORT: secret.CRON_PORT,
  APP_NAME: secret.APP_NAME,
  IMAGE_URL: secret.IMAGE_URL,
  USER_IMAGE_URL: secret.USER_IMAGE_URL,
  CALLBACK_URL: secret.CALLBACK_URL,
  DEFAULT_IMAGE_FOR_PRODUCT: "default_product.png",
  DEFAULT_IMAGE_FOR_TICKET: "default_product.png",
  TEAM_LIMIT: secret.TEAM_LIMIT,
  CASHFREE_PAYOUT_CLIENT_ID: secret.CASHFREE_PAYOUT_CLIENT_ID,
  CASHFREE_PAYOUT_SECRETKEY: secret.CASHFREE_PAYOUT_SECRETKEY,
  CASHFREE_SECRETKEY: secret.CASHFREE_SECRETKEY,
  CASHFREE_CLIENT_ID: secret.CASHFREE_CLIENT_ID,
  REDIS_HOST: secret.REDIS_HOST,
  REDIS_LEADERBOARD: secret.REDIS_LEADERBOARD,
  REDIS_JOINTEAMS: secret.REDIS_JOINTEAMS,
  REDIS_USER: secret.REDIS_USER,
  REDIS_TRANSACTION: secret.REDIS_TRANSACTION,
  //Google Analytics details
  GA_SECRET_KEY: secret.GA_SECRET_KEY,
  MEASUREMENT_KEY: secret.MEASUREMENT_KEY,
  // test
  RAZORPAY_KEY_ID_TEST: secret.RAZORPAY_KEY_ID_TEST,
  RAZORPAY_KEY_SECRET_TEST: secret.RAZORPAY_KEY_SECRET_TEST,
  RAZORPAY_ACC_TEST: secret.RAZORPAY_ACC_TEST,
  // RAZORPAY_KEY_ID:secret.RAZORPAY_KEY_ID,
  // RAZORPAY_ACC:secret.RAZORPAY_ACC,
  BUCKET_NAME: secret.BUCKET_NAME,
  AWS_ACCESS_KEY_ID: secret.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: secret.AWS_SECRET_ACCESS_KEY,
  REGION: secret.REGION,

  // live
  RAZORPAY_KEY_ID_LIVE: secret.RAZORPAY_KEY_ID_LIVE,
  RAZORPAY_KEY_SECRET_LIVE: secret.RAZORPAY_KEY_SECRET_LIVE,
  RAZORPAY_ACC_LIVE: secret.RAZORPAY_ACC_LIVE,
  RAZORPAY_X_ACCOUNT_NUMBER: "",

  privateKey: secret.privateKey,
  SENDGRID_API_KEY: secret.SENDGRID_API_KEY,
  SENDGRID_EMAIL: secret.SENDGRID_EMAIL,
  FCM_SERVER_KEY: secret.FCM_SERVER_KEY,
  SMS_AUTH_KEY: secret.SMS_AUTH_KEY,
  SMS_ROUTE: secret.SMS_ROUTE,
  SMS_SENDER: secret.SMS_SENDER,
  publicKey: '',
  BONUS: {
    REFER_BONUS: "Refer Bonus",
    PAN_BONUS: "Pan Bonus",
    BANK_BONUS: "Bank Bonus",
    MOBILE_BONUS: "Mobile Bonus",
    EMAIL_BONUS: "Email Bonus",
    SIGNUP_BONUS: "Signup Bonus",
    SPECIAL_BONUS: "Special Bonus",
    CASH_ADDED: "Cash Added",
    OFFER_CASH: "Offer Cash",
    Level_Reward: "Level Reward"
  },
  BONUS_NAME: {
    referbonus: "Refer Bonus",
    aadharbonus: "Aadhar Bonus",
    panbonus: "Pan Bonus",
    bankbonus: "Bank Bonus",
    mobilebonus: "Mobile Bonus",
    emailbonus: "Email Bonus",
    signupbonus: "Signup Bonus",
    androidbonus: "Application download bonus",
    withdraw: "Amount Withdraw",
  },
  BONUS_TYPES: {
    REFER_BONUS: "refer_bonus",
    PAN_BONUS: "pan_bonus",
    AADHAR_BONUS: "aadhar_bonus",
    BANK_BONUS: "bank_bonus",
    MOBILE_BONUS: "mobile_bonus",
    EMAIL_BONUS: "email_bonus",
    SIGNUP_BONUS: "signup_bonus",
    Level_Reward: "Level_Reward"
  },
  PROFILE_VERIFY_BONUS_TYPES_VALUES: {
    TRUE: 1,
    FALSE: 0,
  },
  MAILGUN: {
    MAIL_DRIVER: secret.MAIL_DRIVER,
    MAILGUN_DOMAIN: secret.MAILGUN_DOMAIN,
    MAIL_APP_KEY: secret.MAIL_APP_KEY,
    MAIL_FROM: secret.MAIL_FROM2,
    MAIL_FROM_NAME: secret.MAIL_FROM_NAME,
  },
  PROFILE_VERIFY_BONUS_TYPES: {
    REFER_BONUS: "referbonus",
    AADHAR_BONUS: "aadharbonus",
    PAN_BONUS: "panbonus",
    BANK_BONUS: "bankbonus",
    MOBILE_BONUS: "mobilebonus",
    EMAIL_BONUS: "emailbonus",
    SIGNUP_BONUS: "signupbonus",
    ANDROID_BONUS: "androidbonus",
  },
  AMOUNT_TYPE: {
    PRIZE: "prize",
    PRICE: "price",
  },
  TRANSACTION_BY: {
    WALLET: "wallet",
    APP_NAME: secret.APP_NAME,
  },
  PAYMENT_STATUS_TYPES: {
    CONFIRMED: "confirmed",
    PENDING: "pending",
    SUCCESS: "success",
    FAILED: "failed",
  },
  PUSH_SENDING_TYPE: {
    SNS: 1,
    FCM: 2,
    APNS: 3,
  },
  USER_TYPE: {
    USER: "user",
    NORMAL_USER: "normal user",
    YOUTUBER: "youtuber",
  },
  ADMIN: {
    SUPER_ADMIN: 0,
    SUB_ADMIN: 1,
    ADMIN: 2,
  },
  SIDE_BANNER_TYPES: {
    SIDE_TYPE: "side",
    WEB_TYPE: "web",
    APP_TYPE: "app",
  },
  PROFILE_VERIFY_EMAIL_MOBILE: {
    PENDING: 0,
    VERIFY: 1,
  },
  USER_VERIFY_TYPES: {
    AADHAR_VERIFY: "aadhar_verify",
    PAN_VERIFY: "pan_verify",
    BANK_VERIFY: "bank_verify",
    MOBILE_VERIFY: "mobile_verify",
    EMAIL_VERIFY: "email_verify",
  },
  PROFILE_VERIFY_PAN_BANK: {
    PENDING: -1,
    SUBMITED: 0,
    APPROVE: 1,
    REJECTED: 2,
  },
  PROFILE_VERIFY_AADHAR_BANK: {
    PENDING: -1,
    SUBMITED: 0,
    APPROVE: 1,
    REJECTED: 2,
  },
  PROFILE_VERIFY: {
    TRUE: 1,
    FALSE: 0,
  },
  HAS_LEADERBOARD: {
    YES: "yes",
    NO: "no",
  },
  FREEZE: {
    TRUE: 1,
    FALSE: 0,
  },
  DOWNLOAD_APK: {
    TRUE: 1,
    FALSE: 0,
  },
  SERIES_STATUS: {
    OPENED: "opened",
    CLOSED: "closed",
  },
  ADMIN_WALLET_TYPE: {
    ADD_FUND: "addfund",
    WINNING: "winning",
    BONUS: "bonus",
  },
  PLAYER_TYPE: {
    CLASSIC: "classic",
  },
  REFER_BONUS_TO_REFER: {
    REFER_AMOUNT: 100,
  },
  ROLE: {
    BOWL: "bowler",
    BAT: "batsman",
    ALL: "allrounder",
    WK: "keeper",
    WKBAT: "keeper",
    CAP: "allrounder",
    SQUAD: "allrounder",
  },
  USER_STATUS: {
    ACTIVATED: "activated",
    BLOCKED: "blocked",
  },
  PANCARD: {
    NOTUPLOAD: -1,
    PENDING: 0,
    APPROVED: 1,
    REJECT: 2,
  },
  AADHARCARD: {
    NOTUPLOAD: -1,
    PENDING: 0,
    APPROVED: 1,
    REJECT: 2,
  },
  BANK: {
    NOTUPLOAD: -1,
    PENDING: 0,
    APPROVED: 1,
    REJECT: 2,
  },
  WITHDRAW: {
    MINIMUM_WITHDRAW_AMOUNT: 100,
    MAXIMUM_WITHDRAW_AMOUNT: 10000,
  },
  WITHDRAW_STATUS: {
    APPROVED: "Approved",
    PENDING: "Pending",
  },
  FANTASY_TYPE: {
    CRICKET: "Cricket",
    FOOTBALL: "Football",
  },
  MATCH_FINAL_STATUS: {
    WINNER_DECLARED: "winnerdeclared",
    IS_REVIEWED: "IsReviewed",
    IS_ABANDONED: "IsAbandoned",
    IS_CANCELED: "IsCanceled",
    PENDING: "pending",
  },
  MATCH_LAUNCH_STATUS: {
    LAUNCHED: "launched",
    PENDING: "pending",
  },
  MATCHES_STATUS: {
    PENDING: "pending",
    NOT_STARTED: "notstarted",
    STARTED: "started",
    COMPLETED: "completed",
    REFUND: "refunding",
  },
  MATCH_CHALLENGE_BONUS_TYPE: {
    PERCENTAGE: "Percentage",
    AMOUNT: "Amount",
  },
  TEAM_DEFAULT_COLOR: {
    DEF1: "#ffffff",
  },
  MATCH_CHALLENGE_STATUS: {
    CANCELED: "canceled",
  },
  CONTEST_C_TYPE: {
    CLASSIC: "classic",
    BATTING: "batting",
    BOWLING: "bowling",
    REVERSE: "reverse",
  },
  ORDER_STATUS_TYPES: {
    CONFIRMED: "1",
    SUBMITED: "0",
    REJECTED: "2",
  },
  PAYMENT_TYPE: {
    ADD_CASH: "add_cash",
    ADD_PASS: "add_pass",
  },

  AFFILIATE: { DESC: "Promotion Winning", PROMOTER: "PROMO" },

  RAZORPAY_PAYOUT_STATUS_TOSAVE_IN_DB: {
    FAILED: 9,
    TRANSECTION_CREATED: 8,
    REVERSED: 7,
    CANCELLED: 6,
    QUEUED: 5,
    PENDING: 4,
    REJECTED: 2,
    PROCESSING: 3,
    PROCESSED: 1,
  },
  RAZORPAY_PAYOUT_STATUS_TO_SHOW_IN_UI: {
    9: "failed",
    8: "transaction.created",
    7: "reversed",
    6: "cancelled",
    5: "queued",
    4: "pending",
    3: "processing",
    2: "rejected",
    1: "processed",
  },
  RAZORPAY_ADDCASH_PAYMENT: {
    PAYOUT_UPDATED: "payout.updated",
    PAYOUT_REVERSED: "payout.reversed",
    PAYMENT_AUTHORIZED: "payment.authorized",
    PAYMENT_CAPTURED: "payment.captured",
    PAYMENT_FAILED: "payment.failed",
    PAYMENT_DISPUTE_CREATED: "payment.dispute.created",
    PAYMENT_DISPUTE_WON: "payment.dispute.won",
    PAYMENT_DISPUTE_LOST: "payment.dispute.lost",
  },
  RAZORPAY_X_PAYOUT_STATUS: {
    PAYOUT_CREATED: "payout.created",
    PAYOUT_UPDATED: "payout.updated",
    PAYOUT_PROCESSED: "payout.processed",
    PAYOUT_REVERSED: "payout.reversed",
    PAYOUT_FAILED: "payout.failed"
  },


  TICKET_STATUS: {
    PENDING: "pending",
    CONFIRMED: "confirmed",
  },
  JWT_ExpireTime: "29 days",
  // g-recaptcha
  SECRETKEY: secret.SECRETKEY,
  SITEKEY: secret.SITEKEY,
  RAZORPAY_TRANSACTION_WEBHOOK_EVENT: {
    TRANSACTION_CREATED: "transaction.created",
    PAYOUT_FAILED: "payout.failed",
    PAYOUT_REVERSED: "payout.reversed",
    PAYOUT_UPDATED: "payout.updated",
    PAYOUT_PROCESSED: "payout.processed",
    PAYOUT_INITIATED: "payout.initiated",
    PAYOUT_QUEUED: "payout.queued",
    PAYOUT_REJECTED: "payout.rejected",
    PAYOUT_PENDING: "payout.pending",
  },
  PLAYERROLE: {
    "keeper": "WK",
    "batsman": "BAT",
    "allrounder": "ALL",
    "bowler": "BWL",
    "Goalkeeper": "GK",
    "Defender": "DEF",
    "Midfielder": "MID",
    "Forward": "ST",
    "Point guard": "PG",
    "Shooting guard": "SG",
    "Small forward": "SF",
    "Power forward": "PF",
    "Center": "C",
    "raider": "RAI",
    "all rounder": "ALL",
    "defender": "DEF"
  },
  ModelMapMachRun: {
    Cricket: "matchruns",
    Football: "footballmatchscores",
    Basketball: "basketballmatchscores",
    Kabaddi: "kabaddimatchscores"
  },
  rabbitMQConfig: {
    protocol: secret.RABBITMQ_PROTOCOL || "amqp",
    hostname: secret.RABBITMQ_HOSTNAME || "134.209.158.211",
    port: secret.RABBITMQ_PORT || 5672,
    username: secret.RABBITMQ_USERNAME || "guest",
    password: secret.RABBITMQ_PASSWORD || "guest",
    // ca: [fs.readFileSync('aws-ca.pem')], 
  },
  cashfreeclientid: secret.cashfreeclientid,
  cashfreexclientsecret: secret.cashfreexclientsecret,
  TWO_FACTOR_API_KEY: secret.TWO_FACTOR_API_KEY,
  OTP_TEMPLATE: secret.OTP_TEMPLATE,
  RAZORPAY_X_KEY_ID_LIVE: secret.RAZORPAY_X_KEY_ID_LIVE,
  RAZORPAY_X_KEY_SECRET_LIVE: secret.RAZORPAY_X_KEY_SECRET_LIVE,
  kafka1: secret.KAFKA1,
  kafka2: secret.KAFKA2,
  kafka3: secret.KAFKA3,

  HSPSMS_USERNAME: secret.HSPSMS_USERNAME,
  HSPSMS_API_KEY: secret.HSPSMS_API_KEY,
  HSPSMS_SENDERID: secret.HSPSMS_SENDERID,
  WATCHPAY_MERCHANT_KEY: secret.WATCHPAY_MERCHANT_KEY,
  WATCHPAY_PAYMENT_KEY: secret.WATCHPAY_PAYMENT_KEY,
  WATCHPAY_URL: secret.WATCHPAY_URL,
  WATCHPAY_PAYOUT_KEY: secret.WATCHPAY_PAYOUT_KEY,
  idfyaccountid: secret.idfyaccountid,
  idfyapikey: secret.idfyapikey,
  sanboxclientid: secret.sanboxclientid,
  sanboxclientsecret: secret.sanboxclientsecret
};
// return credentials;
// };

module.exports = credentials;