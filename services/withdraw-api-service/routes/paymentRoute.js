const express = require('express');
const router = express.Router();
const paymentController = require('../controller/paymentController');
const auth = require("../../../middlewares/apiauth.js");

router.use((req, res, next) => {
    console.log(`Route Hit: ${req.method} ${req.originalUrl}`);
    next();
});

router.get("/healthcheck", paymentController.dbHealthCheck);
router.post("/requestwithdraw", auth, paymentController.requestWithdrawNewKafkaJune); //2
router.post("/requestwithdrawTesting", auth, paymentController.requestWithdrawTesting);
router.post("/requestwithdrawKafka", auth, paymentController.requestWithdrawKafka);
router.post("/webhookDetail", paymentController.webhookDetailNew);//3
router.get("/razorpayXpayoutStatus/:payoutId", auth, paymentController.razorpayXpayoutStatus);
router.get("/razorpayXpayoutStatusCheck/:payoutId", auth, paymentController.razorpayXpayoutStatusCheck);
router.post("/withdraw-with-tds", auth, paymentController.withdrawWithTDSdeduction);
router.post("/tds-deduction-details", auth, paymentController.tdsDeductionDetailsNew); //1
// router.post("/tds-deduction-details", paymentController.tdsDeductionDetails);
router.post("/financial-tds-deduction", paymentController.financialTDSdeduction);
router.get("/tds-dashboard", auth, paymentController.tdsDashboard);
router.get("/tds-history", auth, paymentController.tdsHistory);

router.get("/withdraw-p2p-validation", auth, paymentController.withdrawP2Pvalidation);
router.get("/send-otp-p2p", auth, paymentController.sendOTPP2p);
router.post("/withdraw-p2p-transfer",auth, paymentController.withdrawP2PtransferNew);

// NEW
router.post("/tds-deduction-details-new", auth, paymentController.tdsDeductionDetailsNew); // new-1
router.post("/request-withdraw-new", auth, paymentController.requestWithdrawNewKafkaJune); // new-2 
router.post("/webhookDetailNew", paymentController.webhookDetailNew); // new-3

// NEW-P2P
router.post("/withdraw-p2p-transfer-new",auth, paymentController.withdrawP2PtransferNew);


// for admin only
router.get("/refunding-suspicious-withdrawals", paymentController.refundSuspiciousWithdraw);

module.exports = router;