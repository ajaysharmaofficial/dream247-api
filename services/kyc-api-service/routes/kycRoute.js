const express = require('express');
const router = express.Router();
const kycController = require('../controller/kycController.js');
const auth = require("../../../middlewares/apiauth.js");

router.use((req, res, next) => {
    console.log(`Route Hit: ${req.method} ${req.originalUrl}`);
    next();
});

router.get("/db-health-check", kycController.dbCheck);

router.post("/social-authenticate", auth, kycController.socialAuthenticate);

router.post("/adharcard-send-otp", auth, kycController.adharCardSentOtp);

router.post("/adharcard-verify-otp", auth, kycController.adharcardVeifyOtp);
// router.get("/getaadharDetails", auth, kycController.aadharDetails);
router.post("/pan-verification", auth, kycController.panVerfication);
// router.get("/getpandetails", auth, kycController.panDetails);
router.post("/bank-verfication-req", auth, kycController.bankVerificationReq);
router.get("/fetch-bank-details", auth, kycController.fetchBankDetails);
router.get("/kyc-full-detail", auth, kycController.kycFullDetails);

module.exports = router;