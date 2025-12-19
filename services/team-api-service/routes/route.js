//Required Packages
const express = require("express");
const router = express.Router();
const MatchController = require("../controller/matchController");
const ContestController = require("../controller/ContestController");

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
router.get("/fetch-my-teams", auth, MatchController.fetchMyTeam);

router.get("/fetch-my-complete-match-teams", auth, MatchController.fetchMyCompleteMatchTeam);

router.get("/compare-team", auth, MatchController.compareTeam);

router.get("/fetch-dream-team/:matchkey", auth, MatchController.fetchDreamTeam);

router.get("/show-team", auth, MatchController.showTeam);
router.get("/live-show-team", auth, MatchController.showLiveTeam);

router.get("/fetch-guru-team", auth, MatchController.fetchGuruTeam);


// Get Join Team Player Info
router.get("/join-team-player-details", auth, MatchController.joinTeamPlayerDetails);

//Replace With Another Team In Ongoing JoinedContest
router.post("/change-team", auth, ContestController.changeTeams);

router.get("/updated-match-data", MatchController.updatedMatchData);

router.get("/show-team-new", auth, MatchController.showTeamNew);
router.get("/user-contest-team-count", auth, MatchController.getUserContestTeamCount);

module.exports = router;
