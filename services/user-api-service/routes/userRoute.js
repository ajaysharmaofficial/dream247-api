const express = require('express');
const router = express.Router();
const userController = require('../controller/userController.js');
const auth = require("../../../middlewares/apiauth.js");
const upload = require("../../../utils/multerS3.js");

router.use((req, res, next) => {
    console.log(`Route Hit: ${req.method} ${req.originalUrl}`);
    next();
});

router.get("/db-health-check", userController.dbCheck);

// ONBOARDING APIS
router.get("/get-version", userController.getVersion);

router.post("/add-temporary-user", userController.addTempUser);

router.post("/verify-otp", userController.verifyOtp);

router.post("/logout-user", auth, userController.logout);

router.post("/otp-resend", userController.otpResend);

router.get("/user-complete-details", auth, userController.userCompleteDetails);

router.post("/upload-user-image", auth, upload.single("image"), userController.uploadUserProfileImage);

router.get("/user-refferals", auth, userController.userRefferals);

router.get("/get-all-user-refer-codes", auth, userController.getUserReferCode);

router.post("/edit-user-profile", auth, userController.editUserProfile);

router.get("/my-redis-transaction", auth, userController.userOwnTransactions);

router.get("/my-transactions", auth, userController.userOwnTransactions);

router.get("/my-detailed-transactions", auth, userController.myDetailedTransactions);

router.post("/edit-user-team-name", auth, userController.editUserTeamName);

router.get("/contest-won-update", auth, userController.contestWonUpdate);

router.get("/fetch-user-level-data", auth, userController.fetchUserLevelData);

router.post("/help-desk-mail", auth, upload.single("image"), userController.helpDeskMail);

router.get("/update-user-data-in-redis", userController.updateUserDataInRedis);

router.get("/user-wallet-details", auth, userController.userWalletDetails);

router.get("/user-detailed-transactions", auth, userController.usersDetailedTransaction);

router.get("/update-all-user-balance", userController.updateAllUserBalnace);

router.get("/maintenance-check", auth, userController.MaintenanceCheck);

module.exports = router;