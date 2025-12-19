//Required Packages
const express = require("express");
const router = express.Router();
const ContestController = require("../controller/ContestController");
const auth = require("../../../middlewares/apiauth");


router.use((req, res, next) => {
  console.log(`Route Hit: ${req.method} ${req.originalUrl}`);
  next();
});


router.get("/", (req, res) => {
  res.send("working");
});

router.get("/db-health-check", ContestController.dbCheck);

router.post("/contest-join", auth, ContestController.contestJoin);

router.post("/join-contest-new", auth, ContestController.joinContestNew);

router.post("/closed-join-contest", auth, ContestController.closedJoinContest);

router.post("/join-contest-by-code", auth, ContestController.contestJoinedByCode);

router.get("/update-contest-count", auth, ContestController.updateContestCount);

router.post("/duo-contest-join", auth, ContestController.duoContestJoined);

router.post("/closed-join-duo-contest", auth, ContestController.closedJoinDuoContest);

router.post("/replace-duo-player", auth, ContestController.replaceDuoPlayer);

module.exports = router;
