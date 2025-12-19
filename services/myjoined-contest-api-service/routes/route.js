//Required Packages
const express = require("express");
const router = express.Router();
const ContestController = require("../controller/ContestController");
const auth = require("../../../middlewares/apiauth");

/**
 *  @author
 *  @description user controller route
 */
router.use((req, res, next) => {
  console.log(`Route Hit: ${req.method} ${req.originalUrl}`);
  next();
});


router.get("/", (req, res) => {
  res.send("working");
});

router.get("/db-health-check", ContestController.dbCheck);

// User Joined Contests/Leauge
router.get("/user-join-contest", auth, ContestController.userJoinContest);
router.get("/user-join-contest-redis", auth, ContestController.userJoinContestRedisNew);
router.get("/user-join-contest-old", auth, ContestController.userJoinContestOld);

router.get("/user-join-duo-contest", auth, ContestController.userJoinDuoContest);

//Is Running contest for join Querys
router.get("/update-joined-user", auth, ContestController.joinUserUpdate);

module.exports = router;
