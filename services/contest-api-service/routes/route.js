//Required Packages
const express = require("express");
const router = express.Router();
const ContestController = require("../controller/ContestController");
const privateContestContoller = require('../controller/privateContestContoller');


const auth = require("../../../middlewares/apiauth");


router.use((req, res, next) => {
  console.log(`Route Hit: ${req.method} ${req.originalUrl}`);
  next();
});


router.get("/", (req, res) => {
  res.send("working");
});

router.get("/db-health-check", ContestController.dbCheck);

router.get("/fetch-all-contest", auth, ContestController.fetchAllContests);

router.get("/fetch-all-duo-contest", auth, ContestController.fetchAllDuoContests);

router.get("/fetch-all-new-contest", auth, ContestController.fetchAllNewContest);

router.get("/fetch-all-new-contest-redis", auth, ContestController.fetchAllNewContest);

router.get("/fetch-all-new-contest-redis-jmeter", auth, ContestController.fetchAllNewContestsRedisJmeter);

router.get("/contest-from-redis-to-db", auth, ContestController.contestFromRedisToDb);

router.get("/update-joined-user-with-redis", auth, ContestController.updateJoinedUsersWithRedisForChecking);

router.get("/fetch-all-new-contest-for-checking", auth, ContestController.fetchAllNewContestRedisForChecking);


router.post("/substitute-player-replace", auth, ContestController.substitutePlayerReplace);

router.get("/fetch-contest-details", auth, ContestController.fetchContest);


router.get("/fetch-all-fantasy", auth, ContestController.fetchAllFantasy);

router.get("/user-leaderboard", auth, ContestController.userLeaderboard);

router.get("/user-self-leaderboard", auth, ContestController.userSelfLeaderboard);

router.get("/joined-user-update", auth, ContestController.JoinedUsersUpdate);

router.get("/contest-price-update", ContestController.contestPriceUpdate);

router.get("/fetch-contest-without-category", auth, ContestController.fetchContestWithoutCategory);

router.post("/private-contest-create", auth, ContestController.privateContestCreate);

router.post("/private-contest-price-card", auth, privateContestContoller.privateContestPriceCard);

router.post("/create-private-contest", auth, privateContestContoller.createPrivateContest);

router.get("/fetch-usable-balance", auth, ContestController.fetchUsableBalance);
router.post("/fetch-usable-balance", auth, ContestController.fetchUsableBalance);


module.exports = router;
