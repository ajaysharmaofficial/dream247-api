
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

router.get("/db-health-check", MatchController.dbCheck);

router.get("/fetch-completed-matches-list", auth, MatchController.fetchCompletedMatchData);

router.get("/fetch-completed-duo-match-list", auth, MatchController.fetchCompletedDuoMatches);

router.get("/fetch-completed-match-data", auth, MatchController.fetchCompletedMatchData);

router.get("/updated-completed-match-redis", auth, MatchController.updatedCompltedMatchRedis);

router.get("/players-fantasy-score-cards", auth, MatchController.playersFantasyScoreCard);

router.get("/match-players-team-data", auth, MatchController.matchPlayerTeamsDataRedis);

router.get("/fetch-fantasy-score-cards", auth, MatchController.fetchFantasyScoreCardsRedis);

router.get("/fetch-recent-winner", auth, MatchController.fetchRecentWinner);


router.get("/fetch-recent-winner-without-redis", MatchController.fetchRecentWinnerWithoutRedis);

router.get("/fetch-point-system-data", auth, MatchController.fetchPointSystemData);

router.get("/fetch-recent-Contest/:matchkey/:matchchallengeid", auth, MatchController.fetchRecentContest);

router.get("/fetch-user-recent-matches", auth, MatchController.fetchUserRecentMatches);

router.get("/fetch-user-recent-matches-new", auth, MatchController.fetchUserRecentMatchesNew);

router.get("/fantasy-score-card-redis", auth, MatchController.fantasyScoreCardRedis);

router.get("/match-players-team-data-redis", auth, MatchController.matchPlayerTeamsDataRedis);

router.get("/leaderboard-of-completed-match", auth, MatchController.leaderboardOfCompletedMatch);

router.get("/add-completed-match-in-redis", auth, MatchController.addCompletedMatchInRedis);


module.exports = router;
