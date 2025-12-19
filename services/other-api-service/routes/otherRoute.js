const express = require('express');
const router = express.Router();
const otherController = require('../controller/otherController');
const auth = require("../../../middlewares/apiauth.js");

router.use((req, res, next) => {
    console.log(`Route Hit: ${req.method} ${req.originalUrl}`);
    next();
});

router.get("/db-health-check", otherController.dbCheck);

// pdf create 
router.get("/create-pdf", otherController.createPdf);
router.get("/create-pdf-new", otherController.createPdfNew);
router.get("/contest-pdf-download", otherController.contestPdfDownload);

// banner
router.get("/fetch-main-banner", otherController.fetchMainBanner);

// popup notify
router.get("/fetch-popup-notify", otherController.fetchPopupNotify);

// user story
router.get("/fetch-user-story", auth, otherController.fetchUserStory);

// user notification
router.get("/fetch-notifications", auth, otherController.fetchNotifications);

// series 
router.get('/upcoming-matches-series', auth, otherController.upcomingMatchesSeries);
router.get("/fetch-all-series", auth, otherController.fetchAllSeries);
router.get("/fetch-leaderboard-data/:series_id?", auth, otherController.fetchLeaderboardData);

// promoter
router.post("/post-promoter-data", auth, otherController.postPromoterData);
router.get("/fetch-promoter-data", auth, otherController.fetchPromoterData);

// investor
router.get("/fetch-investor-category", auth, otherController.fetchInvestorCategory);
router.get("/fetch-investor-user-data", auth, otherController.fetchInvestorUserData);


router.get("/expert-advice-list", auth, otherController.expertAdviceList);
module.exports = router;