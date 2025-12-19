//Required Packages
const express = require("express");
const router = express.Router();
const MatchController = require("../controller/matchController");

const auth = require("../../../middlewares/apiauth");

router.get("/db-health-check", MatchController.dbCheck);
router.get("/fetch-match-live-score/:matchId", auth, MatchController.fetchMatchLiveScore);
router.get("/fetch-live-commentary/:matchId", auth, MatchController.fetchLiveCommentary);

// User Joiend latest 5 live match
router.get("/fetch-live-matches", auth, MatchController.fetchLiveMatches);

router.get("/fetch-live-match-data", auth, MatchController.fetchLiveMatchData);

router.get("/fetch-live-matches-joined-data", auth, MatchController.fetchLiveMatchJoinedData);

router.get("/fetch-live-scores", auth, MatchController.fetchLiveScores);

router.get("/fetch-match-live-score-data", auth, MatchController.fetchMatchLiveScoreData);

router.get("/update-live-match-redis", auth, MatchController.updateLiveMatchRedis);
// router.get("/fantasyScoreCards", auth, MatchController.fantasyScoreCards);

router.get("/fetch-duo-live-match", auth, MatchController.fetchDuoLiveMatch);

module.exports = router;
