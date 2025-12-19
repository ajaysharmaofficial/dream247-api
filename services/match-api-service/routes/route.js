
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

router.get("/fetch-match-list", auth, MatchController.fetchMatchList);
router.get("/team-types", MatchController.teamTypes);

router.get("/matches-list-without-redis", auth, MatchController.upcomingMatchWithouRedis);


router.get("/fetch-match-list-without-redis", MatchController.fetchMatchListWithoutRedis);

router.get("/match-particular-player-info/:matchkey/:playerid", auth, MatchController.playerMatchInfoData);

router.get("/fetch-match-details/:matchId", auth, MatchController.fetchMatchDetails);

router.get("/fetch-all-players/:matchId", auth, MatchController.fetchAllPlayers);

router.get("/fetch-all-players-spot/:matchId", auth, MatchController.fetchAllPlayerspot);

router.get("/fetch-player-info", auth, MatchController.fetchPlayerInfo);

router.get("/fetch-mega-winners", auth, MatchController.fetchMegaWinners);

router.get("/fetch-recent-winner-without-redis", MatchController.recentWinnerWithoutRedis);

router.get("/fetch-new-joined-matches", auth, MatchController.fetchNewJoinedMatches);

router.get("/new-joined-matches", auth, MatchController.NewJoinedMatches);

router.get("/players-playing-status/:matchId", auth, MatchController.playersWithPlayingStatus);


const cricketcontrollerfun = require("../controller/cricketApiController");


router.get("/import-match-players/:matchkey", cricketcontrollerfun.importMatchPlayers);

router.get("/leaderboard-live-ranks", auth, MatchController.leaderboardLiveRank);

router.get("/leaderboard-self-live-ranks", auth, MatchController.leaderboardSelfLiveRanks);


router.get("/leaderboard-completed-match", auth, MatchController.leaderboardCompletedMatch);



module.exports = router;
