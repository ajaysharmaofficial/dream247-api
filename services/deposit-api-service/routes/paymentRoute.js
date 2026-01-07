const express = require('express');
const router = express.Router();
const paymentController = require('../controller/paymentController');
const auth = require("../../../middlewares/apiauth.js");

router.use((req, res, next) => {
    console.log(`Route Hit: ${req.method} ${req.originalUrl}`);
    next();
});

router.get("/db-health-check", paymentController.dbCheck);
router.get("/fetch-offers", auth, paymentController.fetchOffers);
router.get("/getTiers", auth, paymentController.getTiers);
// router.post("/newRequestAddCash", auth, paymentController.newRequestAddCash);
router.post("/add-cash-new-request", auth, paymentController.AddCashNewRequestKafka);

router.post("/sabPaisa-callback", auth, paymentController.sabPaisaCallback);
router.post("/sabPaisa-callback-web", auth, paymentController.sabPaisaCallbackWeb);
router.post("/spinandwin", auth, paymentController.spinAndWin);
router.post("/razorPay-callback", paymentController.razorPayCallback);
router.post("/razorPay-paymentverify", paymentController.razorPayPaymentVerify);
router.post("/yesbank-callback", paymentController.yesBankCallback);
router.post("/phonepay-callback/:merchantId", paymentController.phonePayCallback);
// router.post("/phonepe/callback/:merchantId", paymentController.phonePeCallbackKafka);
router.post("/winning-to-deposist-transfer", auth, paymentController.winningToDepositTransfer);
router.get("/initialize-sabPaisa", auth, paymentController.initializeSabPaisa);
router.post("/watchpay-callback", paymentController.watchPayCallback);
router.get('/pg-form-request', (req, res) => {
    const { spURL, encData, clientCod } = req.query;

    const formData = {
        spURL,
        encData,
        clientCode: clientCod  // match the HTML key
    };

    res.render('pg-form-request', { formData });
});
router.post("/sabPaisa-response-data", paymentController.sabPaisaResponseData);

module.exports = router;