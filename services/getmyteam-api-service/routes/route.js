//Required Packages
const express = require("express");
const router = express.Router();
const MatchController = require("../controller/matchController");

const auth = require("../../../middlewares/apiauth");
router.use((req, res, next) => {
  console.log(`Route Hit: ${req.method} ${req.originalUrl}`);
  next();
});

router.get("/", (req, res) => {
  res.send("working");
});

// Create Team for User to a perticular match
router.get("/db-health-check", MatchController.dbCheck);

router.post("/create-user-team", auth, MatchController.createUserTeam);

router.post("/create-user-team-test", auth, MatchController.createUserTeamTest);

router.get("/fetch-user-teams", auth, MatchController.fetchUserTeams);

router.get("/fetch-live-user-teams", auth, MatchController.fetchLiveUserTeams);

router.get("/get-user-team", auth, MatchController.getUserTeamData);

router.get("/get-user-live-team-data", auth, MatchController.getUserLiveTeamData);

router.get("/fetch-user-teams-new", auth, MatchController.fetchUserTeamsNew);

router.get("/set-redis-team", MatchController.setRedisTeam);

router.get("/sync-teams-redis-db", MatchController.syncTeamRedisToDb);

module.exports = router;
