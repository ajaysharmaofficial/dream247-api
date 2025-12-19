const mongoose = require("mongoose");
const moment = require("moment");
const fs = require("fs");
require("../../../models/contestModel");
require("../../../models/teamPlayerModel");
require("../../../models/teamModel");

const matchesModel = require("../../../models/matchesModel");
const matchPlayersModel = require("../../../models/matchPlayersModel");
const userLeagueModel = require("../../../models/userLeagueModel");
const contestCategory = require("../../../models/contestcategoryModel");
const matchrunModel = require("../../../models/matchRunModel");
// const dualgamematchChallengersModel = require("../../../models/dualgamematchChallengersModel");
// const duoleaderBoardModel = require("../../../models/duoleaderBoardModel");
const userLeaderBoardModel = require("../../../models/userLeaderBoardModel");
const userTeamModel = require("../../../models/userTeamModel");
const EntityApiController = require("../controller/cricketApiController");
const matchScoreModel = require("../../../models/matchScoreModel");
// const commentaryModel = require("../../../models/commentaryModel");
const redisjoinTeams = require("../../../utils/redis/redisjoinTeams");
const redisLiveJoinTeams = require("../../../utils/redis/redisLiveJoinTeams");
const redisCompletedMatch = require("../../../utils/redis/redisCompletedMatch");
const { healthCheck, storeLiveMatches, retrieveLiveSortedSet } = require("../../../utils/redis/redisMain");
const { getMyLeaderBoard, storeSortedSet, retrieveSortedSet, redis } = require('../../../utils/redis/redisLeaderboard');
const redisLiveLeaderboard = require("../../../utils/redis/redisLiveLeaderboard");
const redisContest = require('../../../utils/redis/redisContest');
const redisLiveContest = require('../../../utils/redis/redisLiveContest');
const RedisUpdateChallenge = require('../../../utils/redisUpdateChallenge');
const redisUpdateChallenge = new RedisUpdateChallenge();
const { matchTimeDifference } = require("../../../utils/matchTimeDiffrence");
class matchServices {
  constructor() {
    return {
      dbCheck: this.dbCheck.bind(this),
      fetchLiveScores: this.fetchLiveScores.bind(this),
      fetchMatchLiveScoreData: this.fetchMatchLiveScoreData.bind(this),
      fetchLiveMatchData: this.fetchLiveMatchData.bind(this),
      fetchLiveMatches: this.fetchLiveMatches.bind(this),
      fetchDuoLiveMatch: this.fetchDuoLiveMatch.bind(this),
      fetchLiveCommentary: this.fetchLiveCommentary.bind(this),
      fetchMatchLiveScore: this.fetchMatchLiveScore.bind(this),
      updateLiveMatchRedis: this.updateLiveMatchRedis.bind(this),
      fetchLiveMatchJoinedData: this.fetchLiveMatchJoinedData.bind(this),
    };
  }

  async dbCheck() {
    try {
      const TIMEOUT_DURATION = 3000; // 3 seconds timeout

      // Helper function for timeout handling
      const withTimeout = (promise, ms, timeoutMessage) =>
        Promise.race([
          promise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(timeoutMessage)), ms)
          )
        ]);

      let mongoConnected = false;
      let redisConnected = false;

      try {
        // MongoDB Health Check
        mongoConnected = await withTimeout(
          new Promise((resolve) => resolve(mongoose.connection.readyState === 1)),
          TIMEOUT_DURATION,
          "MongoDB check timed out"
        );
      } catch (error) {
        console.error("❌ MongoDB Error:", error.message);
      }

      try {
        // Redis Health Check
        redisConnected = await withTimeout(
          await healthCheck().then((res) => res === "PONG"),
          TIMEOUT_DURATION,
          "Redis check timed out"
        );
      } catch (error) {
        console.error("❌ Redis Error:", error.message);
      }

      // Determine overall health status
      const isHealthy = mongoConnected && redisConnected;

      return {
        status: isHealthy,
        database: {
          status: mongoConnected,
          message: mongoConnected ? "✅ MongoDB is connected." : "❌ MongoDB is not connected."
        },
        redis: {
          status: redisConnected,
          message: redisConnected ? "✅ Redis is connected." : "❌ Redis is not responding."
        }
      };
    } catch (error) {
      return {
        status: false,
        database: {
          status: false,
          message: "Database health check failed.",
          error: error.message.includes("MongoDB") ? error.message : undefined
        },
        redis: {
          status: false,
          message: "Redis health check failed.",
          error: error.message.includes("Redis") ? error.message : undefined
        }
      };
    }
  };

  async fetchLiveScores(req) {
    try {
      console.log(
        "---------------------------fetchLiveScores--------------------------"
      );
      // redis
      let keyname = `listMatchesModel-${req.query.matchkey}`;
      let listMatch = await redisjoinTeams.getkeydata(keyname);
      if (!listMatch) {
        listMatch = await matchesModel.findOne({
          _id: mongoose.Types.ObjectId(req.query.matchkey),
        });
        redisjoinTeams.setkeydata(keyname, listMatch, 30 * 24 * 60 * 60);
      }

      let keyMatchRun = `listMatchesRunModel-${req.query.matchkey}`;
      let matchrunData = await redisLiveJoinTeams.getkeydata(keyMatchRun);
      if (!matchrunData) {
        console.log("dd");
        matchrunData = await matchrunModel.findOne({
          matchkey: mongoose.Types.ObjectId(req.query.matchkey),
        });
        if (!matchrunData || !matchrunData.overs1 == undefined) {
          return {
            message: "Match Live score Not Found",
            status: false,
            data: {
              Team1: "",
              Team2: "",
              Team1_Totalovers1: 0,
              Team1_Totalovers2: 0,
              Team1_Totalruns1: 0,
              Team1_Totalruns2: 0,
              Team1_Totalwickets1: 0,
              Team1_Totalwickets2: 0,
              Team2_Totalwickets1: 0,
              Team2_Totalwickets2: 0,
              Team2_Totalovers1: 0,
              Team2_Totalovers2: 0,
              Team2_Totalruns1: 0,
              Team2_Totalruns2: 0,
              Winning_Status: "",
            },
          };
        }
        redisjoinTeams.setkeydata(keyMatchRun, matchrunData, 30 * 24 * 60 * 60);
      }

      const over1 = matchrunData.overs1.split(",");
      const over2 = matchrunData.overs2.split(",");
      const wicket1 = matchrunData.wickets1.split(",");
      const wicket2 = matchrunData.wickets2.split(",");
      const runs1 = matchrunData.runs1.split(",");
      const runs2 = matchrunData.runs2.split(",");
      let matchrundata = await matchesModel.aggregate([
        {
          $match: {
            _id: mongoose.Types.ObjectId(req.query.matchkey),
          },
        },
        {
          $lookup: {
            from: "matchseries",
            localField: "series",
            foreignField: "_id",
            as: "series",
          },
        },
        {
          $lookup: {
            from: "teams",
            localField: "team1Id",
            foreignField: "_id",
            as: "team1",
          },
        },
        {
          $lookup: {
            from: "teams",
            localField: "team2Id",
            foreignField: "_id",
            as: "team2",
          },
        },
        {
          $lookup: {
            from: "userleagues",
            localField: "_id",
            foreignField: "matchkey",
            pipeline: [
              {
                $lookup: {
                  from: "matchcontests",
                  localField: "challengeid",
                  foreignField: "_id",
                  pipeline: [
                    {
                      $match: {
                        status: {
                          $ne: "cancelled",
                        },
                        entryfee: {
                          $gt: 0,
                        },
                      },
                    },
                  ],
                  as: "con",
                },
              },
            ],
            as: "contest",
          },
        },
        {
          $lookup: {
            from: "userteam",
            localField: "_id",
            foreignField: "matchkey",
            as: "jointeams",
          },
        },
        {
          $lookup: {
            from: "matchcontests",
            localField: "_id",
            foreignField: "matchkey",
            pipeline: [
              {
                $match: {
                  status: {
                    $ne: "cancelled",
                  },
                  entryfee: {
                    $gt: 0,
                  },
                },
              },
            ],
            as: "resultdata",
          },
        },
      ]);

      matchrunData = {
        Team1: matchrunData.teams1.toUpperCase() || "",
        Team2: matchrunData.teams2.toUpperCase() || "",
        Team1_Totalovers1:
          over1[0] &&
            over1[0] != null &&
            over1[0] != undefined &&
            over1[0] != ""
            ? over1[0]
            : matchrunData.overs1,
        Team1_Totalovers2:
          over1[1] &&
            over1[1] != null &&
            over1[1] != undefined &&
            over1[1] != ""
            ? over1[1]
            : "0",
        Team1_Totalruns1:
          runs1[0] &&
            runs1[0] != null &&
            runs1[0] != undefined &&
            runs1[0] != ""
            ? runs1[0]
            : matchrunData.runs1,
        Team1_Totalruns2:
          runs1[1] &&
            runs1[1] != null &&
            runs1[1] != undefined &&
            runs1[1] != ""
            ? runs1[1]
            : "0",
        Team1_Totalwickets1:
          wicket1[0] &&
            wicket1[0] != null &&
            wicket1[0] != undefined &&
            wicket1[0] != ""
            ? wicket1[0]
            : matchrunData.wickets1,
        Team1_Totalwickets2:
          wicket1[1] &&
            wicket1[1] != null &&
            wicket1[1] != undefined &&
            wicket1[1] != ""
            ? wicket1[1]
            : "0",
        Team2_Totalwickets1:
          wicket2[0] &&
            wicket2[0] != null &&
            wicket2[0] != undefined &&
            wicket2[0] != ""
            ? wicket2[0]
            : matchrunData.wickets2,
        Team2_Totalwickets2:
          wicket2[1] &&
            wicket2[1] != null &&
            wicket2[1] != undefined &&
            wicket2[1] != ""
            ? wicket2[1]
            : "0",
        Team2_Totalovers1:
          over2[0] &&
            over2[0] != null &&
            over2[0] != undefined &&
            over2[0] != ""
            ? over2[0]
            : matchrunData.overs2,
        Team2_Totalovers2:
          over2[1] &&
            over2[1] != null &&
            over2[1] != undefined &&
            over2[1] != ""
            ? over2[1]
            : "0",
        Team2_Totalruns1:
          runs2[0] &&
            runs2[0] != null &&
            runs2[0] != undefined &&
            runs2[0] != ""
            ? runs2[0]
            : matchrunData.runs2,
        Team2_Totalruns2:
          runs2[1] &&
            runs2[1] != null &&
            runs2[1] != undefined &&
            runs2[1] != ""
            ? runs2[1]
            : "0",
        Winning_Status:
          matchrunData.winning_status != "0"
            ? matchrunData.winning_status != "No result"
              ? matchrunData.winning_status
              : ""
            : "",
        totalcontest: matchrundata[0].resultdata.length,
        totalteam: matchrundata[0].jointeams.length,
        seriesname: matchrundata[0].series[0].name,
        start_date: matchrundata[0].start_date,
        status: matchrundata[0].status,
        Win_amount: 0,
        name: matchrundata[0].name,
        team1logo: matchrundata[0].team1[0].image
          ? `${global.constant.IMAGE_URL}${matchrundata[0].matchData[0].team1[0].image}`
          : `${global.constant.IMAGE_URL}teams/team_image.png`,
        team2logo: matchrundata[0].team2[0].image
          ? `${global.constant.IMAGE_URL}${matchrundata[0].matchData[0].team2[0].image}`
          : `${global.constant.IMAGE_URL}teams/team_image.png`,
      };
      return {
        message: "Match Live score",
        status: true,
        data: matchrunData,
      };
    } catch (error) {
      throw error;
    }
  }

  async fetchMatchLiveScoreData(req) {
    try {
      let inningarr = [];
      // redis
      let keyname = `listMatchesModel-${req.query.matchkey}`;
      let redisdata = await redisjoinTeams.getkeydata(keyname);
      let match;
      if (redisdata) {
        match = redisdata;
      } else {
        match = await matchesModel.findOne({
          _id: mongoose.Types.ObjectId(req.query.matchkey),
        });
        redisjoinTeams.setkeydata(keyname, match, 20 * 24 * 60 * 60);
      }

      // redis end
      //comment for redis--> let match = await matchesModel.findOne({ _id: mongoose.Types.ObjectId(req.query.matchkey) });
      if (match) {
        if (req.query.fantasy_type == "Football") {
          const data = await fs.promises.readFile(
            "matchStat-football.json",
            "utf8"
          );
          let matchData = JSON.parse(data);
          // return matchData.response
          let matchScoreData = matchData.response;
          let inningObj = {};

          if (matchScoreData?.items?.match_info) {
            const homeData = {
              name: matchScoreData?.items?.match_info[0].teams["home"].tname,
              scores: matchScoreData?.items?.match_info[0].result.home
                ? matchScoreData?.items?.match_info[0].result.home
                : 0,
            };
            const awayData = {
              name: matchScoreData?.items?.match_info[0].teams["away"].tname,
              scores: matchScoreData?.items?.match_info[0].result.home
                ? matchScoreData?.items?.match_info[0].result.away
                : 0,
            };

            matchScoreData.items.statistics.forEach((statistic, index) => {
              const key = `${statistic.name.replace(/ /g, "")}`;

              homeData[key] = statistic.home ? statistic.home : 0;
              awayData[key] = statistic.away ? statistic.away : 0;
            });

            const result = [homeData, awayData];

            if (Object.keys(homeData).length > 0) {
              return {
                message: "match live score in brief",
                status: true,
                data: result,
              };
            } else {
              return {
                message: "match live score in brief is not avialable",
                status: true,
                data: [],
              };
            }
          }
        } else if (req.query.fantasy_type == "Basketball") {
          const data = await fs.promises.readFile(
            "validBasketball/bas-matchStat.json",
            "utf8"
          );
          let matchData = JSON.parse(data);
          // return matchData.response
          let matchScoreData = matchData.response;

          if (matchScoreData?.items?.match_info) {
            const homeData = {
              name: matchScoreData?.items?.match_info.teams["home"].tname,
              scores: matchScoreData?.items?.match_info.result.home
                ? matchScoreData?.items?.match_info.result.home
                : 0,
            };
            const awayData = {
              name: matchScoreData?.items?.match_info.teams["away"].tname,
              scores: matchScoreData?.items?.match_info.result.home
                ? matchScoreData?.items?.match_info.result.away
                : 0,
            };

            Object.keys(matchScoreData?.items?.team_stats.home).forEach(
              (key) => {
                const homeValue = matchScoreData?.items.team_stats.home[key];
                const awayValue = matchScoreData?.items.team_stats.away[key];

                // Handle cases where values are not available or empty (save them as 0)
                const homeNumericValue =
                  isNaN(homeValue) || homeValue === "" ? 0 : homeValue;
                const awayNumericValue =
                  isNaN(awayValue) || awayValue === "" ? 0 : awayValue;

                homeData[key] = homeNumericValue;
                awayData[key] = awayNumericValue;
              }
            );

            const result = [homeData, awayData];
            if (Object.keys(homeData).length > 0) {
              return {
                message: "match live score in brief",
                status: true,
                data: result,
              };
            } else {
              return {
                message: "match live score in brief is not avialable",
                status: true,
                data: [],
              };
            }
          }
        } else {
          let matchScoreData = await EntityApiController.getmatchscore(
            match.real_matchkey
          );
          const data = await fs.promises.readFile("scorecard.json", "utf8");
          let matchData = JSON.parse(data);
          req.query.matchkey == "64f871eb35f523dab4e0dea3"
            ? (matchScoreData = matchData.response)
            : "";

          if (matchScoreData) {
            if (matchScoreData.innings.length > 0) {
              for (let innings of matchScoreData.innings) {
                let inningObj = {};
                inningObj.name = innings.name;
                inningObj.short_name = innings.short_name;
                inningObj.scores = innings.scores_full;

                //  Inserting Batsmen Of That Inning------------------------
                if (innings.batsmen.length > 0) {
                  let batsmenarr = [];
                  let i = 0;
                  for (let batsmen of innings.batsmen) {
                    i++;
                    let batsmenObj = {};
                    batsmenObj.name = batsmen.name;
                    batsmenObj.role = batsmen.role;
                    batsmenObj.how_out = batsmen.how_out;
                    batsmenObj.runs = batsmen.runs;
                    batsmenObj.balls = batsmen.balls_faced;
                    batsmenObj.fours = batsmen.fours;
                    batsmenObj.sixes = batsmen.sixes;
                    batsmenObj.strike_rate = batsmen.strike_rate;
                    batsmenObj.batting = batsmen.batting;
                    batsmenObj.dismissal = batsmen.dismissal;
                    batsmenarr.push(batsmenObj);
                    if (i == innings.batsmen.length) {
                      inningObj.batsmen = batsmenarr;
                    }
                  }
                } else {
                  inningObj.batsmen = [];
                }
                inningObj.extra_runs = innings.extra_runs; // extras
                inningObj.equations = innings.equations; // total

                //  concatenate name of batsmen that not bat Of That Inning------------------------
                inningObj.did_not_bat = "";
                let i = 0;
                if (innings.did_not_bat.length > 0) {
                  for (let did_not_bat of innings.did_not_bat) {
                    i++;
                    if (innings.did_not_bat.length == i) {
                      inningObj.did_not_bat += `${did_not_bat.name}`;
                    } else {
                      inningObj.did_not_bat += `${did_not_bat.name},`;
                    }
                  }
                }

                //  Inserting Bowlers Of That Inning------------------------
                if (innings.bowlers.length > 0) {
                  let bowlersarr = [];
                  let i = 0;
                  for (let bowlers of innings.bowlers) {
                    i++;
                    let bowlersObj = {};
                    bowlersObj.name = bowlers.name;
                    bowlersObj.overs = bowlers.overs;
                    bowlersObj.maidens = bowlers.maidens;
                    bowlersObj.runs = bowlers.runs_conceded;
                    bowlersObj.balls = bowlers.balls_faced;
                    bowlersObj.wickets = bowlers.wickets;
                    bowlersObj.economy_rate = bowlers.econ;
                    bowlersObj.bowling = bowlers.bowling;
                    bowlersarr.push(bowlersObj);
                    if (i == innings.bowlers.length) {
                      inningObj.bowlers = bowlersarr;
                    }
                  }
                } else {
                  inningObj.bowlers = [];
                }
                console.log("hii");

                //  Inserting Fall Of Wickets Of That Inning------------------------
                if (innings.fows.length > 0) {
                  let fowsarr = [];
                  let i = 0;
                  for (let fows of innings.fows) {
                    i++;
                    let fowsObj = {};
                    fowsObj.name = fows.name;
                    fowsObj.runs = fows.runs;
                    fowsObj.balls = fows.balls;
                    fowsObj.score_at_dismissal = String(
                      fows.score_at_dismissal
                    );
                    fowsObj.overs_at_dismissal = fows.overs_at_dismissal;
                    fowsObj.number = fows.number;
                    fowsObj.dismissal = fows.dismissal;
                    fowsarr.push(fowsObj);
                    if (i == innings.fows.length) {
                      inningObj.fall_of_wickets = fowsarr;
                    }
                  }
                } else {
                  inningObj.fall_of_wickets = [];
                }

                //  Inserting Inning------------------------
                inningarr.push(inningObj);
              }
            }
            if (matchScoreData.innings.length == inningarr.length) {
              return {
                message: "match live score in brief",
                status: true,
                data: inningarr,
              };
            }
          }
          // return {
          //     message: 'match live score in brief',
          //     status: true,
          //     // data: inningarr,
          //     matchData
          // }
        }
      }
    } catch (error) {
      console.log("Error: ", error);
    }
  }

  async fetchLiveMatchData(req) {
    let fantasy;
    if (req.query.fantasy_type) {
      fantasy = req.query.fantasy_type;
    } else {
      fantasy = "Cricket";
    }
    const aggPipe = [];
    aggPipe.push({
      $match: {
        userid: mongoose.Types.ObjectId(req.user._id),
      },
    });
    aggPipe.push({
      $group: {
        _id: "$matchkey",
        matchkey: { $first: "$matchkey" },
        joinedleaugeId: { $first: "$_id" },
        userid: { $first: "$userid" },
        matchchallengeid: { $first: "$challengeid" },
        jointeamid: { $first: "$teamid" },
      },
    });
    aggPipe.push({
      $lookup: {
        from: "matches",
        localField: "matchkey",
        foreignField: "_id",
        as: "match",
      },
    });
    aggPipe.push({
      $unwind: {
        path: "$match",
      },
    });

    aggPipe.push({
      $match: {
        "match.fantasy_type": fantasy,
        "match.launch_status": "launched"
      },
    });
    aggPipe.push({
      $match: {
        $or: [
          { "match.final_status": "pending" },
          { "match.final_status": "IsReviewed" },
        ],
      },
    });

    aggPipe.push({
      $lookup: {
        from: "userleagues",
        let: { matchkey: "$matchkey", userid: "$userid" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $eq: ["$matchkey", "$$matchkey"],
                  },
                  {
                    $eq: ["$userid", "$$userid"],
                  },
                ],
              },
            },
          },
        ],
        as: "joinedleauges",
      },
    });

    aggPipe.push(
      {
        $lookup: {
          from: "userteam",
          let: {
            matchkey: "$matchkey",
            userid: "$userid"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: ["$matchkey", "$$matchkey"]
                    },
                    { $eq: ["$userid", "$$userid"] }
                  ]
                }
              }
            }
          ],
          as: "jointeamsData"
        }
      },
    );

    aggPipe.push({
      $group: {
        _id: "$joinedleauges.challengeid",
        // matchchallengeid: { $first: '$joinedleauges.challengeid' },
        joinedleaugeId: { $first: "$joinedleauges._id" },
        matchkey: { $first: "$matchkey" },
        jointeamid: { $first: "$jointeamid" },
        userid: { $first: "$userid" },
        match: { $first: "$match" },
        jointeamsData: { $first: "$jointeamsData" },
      },
    });

    aggPipe.push({
      $lookup: {
        from: "matchcontests",
        localField: "_id",
        foreignField: "_id",
        as: "matchchallenge",
      },
    });
    aggPipe.push({
      $unwind: {
        path: "$matchchallenge",
        preserveNullAndEmptyArrays: true,
      },
    });
    aggPipe.push({
      $match: {
        "matchchallenge.status": { $ne: "canceled" },
      },
    });
    aggPipe.push({
      $group: {
        _id: "$matchkey",
        joinedleaugeId: { $first: "$joinedleaugeId" },
        matchkey: { $first: "$matchkey" },
        jointeamid: { $first: "$jointeamid" },
        match: { $first: "$match" },
        count: { $sum: 1 },
        jointeamsData: { $first: "$jointeamsData" },
      },
    });
    aggPipe.push({
      $lookup: {
        from: "matchseries",
        localField: "match.series",
        foreignField: "_id",
        as: "series",
      },
    });
    aggPipe.push({
      $lookup: {
        from: "teams",
        localField: "match.team1Id",
        foreignField: "_id",
        as: "team1",
      },
    });
    aggPipe.push({
      $lookup: {
        from: "teams",
        localField: "match.team2Id",
        foreignField: "_id",
        as: "team2",
      },
    });
    aggPipe.push({
      $unwind: {
        path: "$series",
      },
    });
    aggPipe.push({
      $unwind: {
        path: "$team1",
      },
    });
    aggPipe.push({
      $unwind: {
        path: "$team2",
      },
    });
    let today = new Date();
    today.setHours(today.getHours() + 5);
    today.setMinutes(today.getMinutes() + 30);
    aggPipe.push({
      $addFields: {
        date: {
          $dateFromString: {
            dateString: "$match.start_date",
            timezone: "-00:00",
          },
        },
        curDate: today,
      },
    });
    aggPipe.push({
      $match: {
        $expr: {
          $and: [
            {
              $lte: ["$date", today],
            },
          ],
        },
      },
    });

    aggPipe.push({
      $sort: {
        date: -1,
      },
    });
    aggPipe.push({
      $project: {
        _id: 0,
        matchkey: 1,
        matchname: { $ifNull: ["$match.name", ""] },
        team1ShortName: { $ifNull: ["$team1.short_name", ""] },
        team2ShortName: { $ifNull: ["$team2.short_name", ""] },
        team1fullname: { $ifNull: ["$team1.teamName", ""] },
        team2fullname: { $ifNull: ["$team2.teamName", ""] },
        team1color: {
          $ifNull: ["$team1.color", global.constant.TEAM_DEFAULT_COLOR.DEF1],
        },
        team2color: {
          $ifNull: ["$team2.color", global.constant.TEAM_DEFAULT_COLOR.DEF1],
        },
        team1color: "#D5EF8A",
        team2color: "#52A860",
        start_date: "$match.start_date",
        team1logo: {
          $ifNull: [
            {
              $cond: {
                if: {
                  $or: [
                    { $eq: [{ $substr: ["$team1.logo", 0, 1] }, "/"] },
                    { $eq: [{ $substr: ["$team1.logo", 0, 1] }, "t"] },
                  ],
                },
                then: { $concat: [`${global.constant.IMAGE_URL}`, "", "$team1.logo"] },
                else: "$team1.logo",
              },
            },
            `${global.constant.IMAGE_URL}team_image.png`,
          ],
        },
        team2logo: {
          $ifNull: [
            {
              $cond: {
                if: {
                  $or: [
                    { $eq: [{ $substr: ["$team2.logo", 0, 1] }, "/"] },
                    { $eq: [{ $substr: ["$team2.logo", 0, 1] }, "t"] },
                  ],
                },
                then: { $concat: [`${global.constant.IMAGE_URL}`, "", "$team2.logo"] },
                else: "$team2.logo",
              },
            },
            `${global.constant.IMAGE_URL}team_image.png`,
          ],
        },
        start_date: { $ifNull: ["$match.start_date", "0000-00-00 00:00:00"] },
        start_date1: {
          $toDate: { $ifNull: ["$match.start_date", "0000-00-00 00:00:00"] },
        },
        status: {
          $ifNull: [
            {
              $cond: {
                if: {
                  $lt: [
                    "$match.start_date",
                    moment().format("YYYY-MM-DD HH:mm:ss"),
                  ],
                },
                then: "closed",
                else: "opened",
              },
            },
            "opened",
          ],
        },
        launch_status: { $ifNull: ["$match.launch_status", ""] },
        final_status: { $ifNull: ["$match.final_status", ""] },
        series_name: { $ifNull: ["$series.name", ""] },
        type: { $ifNull: ["$match.fantasy_type", "Cricket"] },
        series_id: { $ifNull: ["$series._id", ""] },
        available_status: { $ifNull: [1, 1] },
        joinedcontest: { $ifNull: ["$count", 0] },
        playing11_status: { $ifNull: ["$playing11_status", 1] },
        total_teams: { $size: '$jointeamsData' },
        teama: "$match.teama",
        teamb: "$match.teamb"
      },
    });
    aggPipe.push(
      {
        $limit: 20,
      },
      {
        $lookup: {
          from: "matchcontests",
          localField: "matchkey",
          foreignField: "matchkey",
          as: "mega",
        },
      },
      {
        $addFields: {
          WinningpriceAndPrize: {
            $getField: {
              input: {
                $arrayElemAt: [
                  {
                    $sortArray: {
                      input: "$mega",
                      sortBy: {
                        win_amount: -1,
                      },
                    },
                  },
                  0,
                ],
              },
              field: "WinningpriceAndPrize",
            },
          },
        },
      },
      {
        $addFields: {
          mega: {
            $getField: {
              input: {
                $arrayElemAt: [
                  {
                    $sortArray: {
                      input: "$mega",
                      sortBy: {
                        win_amount: -1,
                      },
                    },
                  },
                  0,
                ],
              },
              field: "win_amount",
            },
          },
        },
      },
      {
        $addFields: {
          image: "",
        },
      }
    );
    const JoiendMatches = await userLeagueModel.aggregate(aggPipe);
    if (JoiendMatches.length > 0) {
      return {
        message: "User Joiend latest 5 Upcoming and live match data..",
        status: true,
        data: JoiendMatches,
        // aggPipe
      };
    } else {
      return {
        message: "No Data Found..",
        status: false,
        data: [],
      };
    }
  }
  async fetchLiveMatches(req) {
    try {
      let fantasy = req.query.fantasy_type || "Cricket";
      let keyname = `live-matches`;
      let redisdata = await retrieveLiveSortedSet(keyname);

      if (!redisdata || redisdata.length === 0) {
        return { message: "No Data Found", status: false, data: [] };
      }

      let joinedMatches = [];

      // Parallel execution to optimize performance
      await Promise.all(
        redisdata.map(async (matchid) => {
          let keyMatchRun = `listMatchesModel-${matchid}`;
          let match = await redisjoinTeams.getkeydata(keyMatchRun);

          if (!match) {
            match = await matchesModel.findOne({
              _id: mongoose.Types.ObjectId(matchid),
            });
            if (match) {
              await redisjoinTeams.setkeydata(keyMatchRun, match, 30 * 24 * 60 * 60);
            } else {
              return;
            }
          }

          let keyUserJoinedChallenge = `match:${matchid}:user:${req.user._id}:joinedContests`;
          let userContest = await getMyLeaderBoard(keyUserJoinedChallenge, req.user._id, "contest");
          // if (userContest == false) {
          //   const matchKey = `match:${matchid}:challenges`;
          //   const matchAllChallenges = await redisContest.hgetAllData(matchKey);
          //   let filteredMatchChallenges = Object.values(matchAllChallenges || {});
          //   if (filteredMatchChallenges && filteredMatchChallenges.length <= 0) {
          //     filteredMatchChallenges = await matchContestModel.find({
          //       matchkey: new mongoose.Types.ObjectId(matchid),
          //     });
          //   }
          //   if (filteredMatchChallenges && filteredMatchChallenges.length > 0) {
          //     await Promise.all(
          //       filteredMatchChallenges.map(async (challenge) => {
          //         const userChallengeCounterKey = `match:${matchid}:challenge:${challenge._id}:user:${req.user._id}:joinedTeams`;
          //         let userTeamCount = await redisjoinTeams.getkeydata(userChallengeCounterKey);
          //         if (userTeamCount > 0) {
          //           let redisUserChallenge = {
          //             _id: `${challenge._id.toString()}`,
          //             getcurrentrank: userTeamCount,
          //             matchkey: matchid,
          //           };
          //           var expRedisTime = await matchTimeDifference(matchid);
          //           await storeSortedSet(keyUserJoinedChallenge, redisUserChallenge, expRedisTime);
          //         } else {
          //           userTeamCount = await userLeaderBoardModel.find({
          //             matchkey: new mongoose.Types.ObjectId(matchid),
          //             challengeid: new mongoose.Types.ObjectId(challenge._id),
          //             userId: new mongoose.Types.ObjectId(req.user._id)
          //           });
          //           if (userTeamCount > 0) {
          //             let redisUserChallenge = {
          //               _id: `${challenge._id.toString()}`,
          //               getcurrentrank: userTeamCount,
          //               matchkey: matchid,
          //             };
          //             var expRedisTime = await matchTimeDifference(matchid);
          //             await storeSortedSet(keyUserJoinedChallenge, redisUserChallenge, expRedisTime);
          //           }
          //         }
          //       })
          //     );
          //   }
          //   userContest = await getMyLeaderBoard(keyUserJoinedChallenge, req.user._id, "contest");
          // }
          // Redis cache check for teams
          if (userContest) {
            var expRedisTime = await matchTimeDifference(matchid);
            const redisKey = `match:${matchid}:user:${req.user._id}:teams`;
            let cachedTeams = await redisjoinTeams.getkeydata(redisKey);
            cachedTeams = cachedTeams || [];

            if (cachedTeams.length > 0) {
              cachedTeams = cachedTeams || [];
            } else {
              cachedTeams = await userTeamModel.find({
                userid: new mongoose.Types.ObjectId(req.user._id),
                matchkey: new mongoose.Types.ObjectId(matchid),
              }).lean();

              await redisjoinTeams.setkeydata(redisKey, cachedTeams, expRedisTime);
            }

            if (match.status == "completed") {

              const redisCompletedContestKey = `match:${matchid}:user:${req.user._id}:total`;
              let totalUserContest = await redisCompletedMatch.getkeydata(redisCompletedContestKey);
              // const redisCompletedContestKey = `match:${matchid}:user:${req.user._id}:totalContest`;
              // let totalUserContest = await redisCompletedMatch.redis.get(redisCompletedContestKey);
              // if (!totalUserContest) {
              //   await redisCompletedMatch.redis.set(redisCompletedContestKey, Number(userContest.length), 'EX', expRedisTime)
              // }
              // const redisCompletedKey = `match:${matchid}:user:${req.user._id}:totalTeams`;
              // let totalUserTeams = await redisCompletedMatch.redis.get(redisCompletedKey);
              // if (!totalUserTeams) {
              //   await redisCompletedMatch.redis.set(redisCompletedKey, Number(cachedTeams.length), 'EX', expRedisTime)
              // }
              if (!totalUserContest) {
                let data = {
                  totalTeams: cachedTeams.length,
                  totalContest: userContest.length,
                  totalAmount: ''
                }
                await redisCompletedMatch.setkeydata(redisCompletedContestKey, data, expRedisTime * 3);
              }
            }
            let keyname = `user:${req.user._id.toString()}:completed_all_matches`;
            // const isProcessed = await redisCompletedMatch.redis.call("zscore", keyname, matchid.toString());
            const isProcessed = await redisCompletedMatch.redis.zscore(keyname, matchid.toString());

            //  await redisCompletedMatch.redis.call("sismember", keyname, matchid.toString());
            let total = 1;
            if (!isProcessed) {
              // total = await redisCompletedMatch.redis.zcard(keyname);
              // total = total || 1;
              // await redisCompletedMatch.redis.zadd(keyname, Number(total), matchid.toString());
              // await redisCompletedMatch.redis.expire(keyname, 60 * 60 * 24 * 3); // 3Days
            }

            if (userContest && userContest.length > 0 && cachedTeams.length > 0) {
              const status = moment(match.start_date).isBefore(moment()) ? "closed" : "opened";

              let data = {
                matchkey: match._id,
                date: match.start_date,
                curDate: moment().format("YYYY-MM-DD HH:mm:ss"),
                matchname: match.name,
                team1ShortName: match.teamA?.short_name || "N/A",
                team2ShortName: match.teamB?.short_name || "N/A",
                team1fullname: match.teamA?.teamName || "N/A",
                team2fullname: match.teamB?.teamName || "N/A",
                team1color: "#D5EF8A",
                team2color: "#52A860",
                start_date: match.start_date,
                second_inning_status: match.second_inning_status,
                total_teams: cachedTeams.length || 0,
                team1logo: `${global.constant.IMAGE_URL}${match.teamA?.logo || "default_team1.png"}`,
                team2logo: `${global.constant.IMAGE_URL}${match.teamB?.logo || "default_team2.png"}`,
                status: status,
                launch_status: match.launch_status,
                final_status: match.final_status,
                series_name: match.seriesData?.name || "Unknown",
                type: match.fantasy_type,
                series_id: match.series,
                available_status: 1,
                joinedcontest: userContest.length,
                playing11_status: match.playing11_status,
                textNote: match.textNote || "",
                real_matchkey: match.real_matchkey,
                contestType: "old",
                mega: match?.mega || 0,
                WinningpriceAndPrize: "",
                image: "",
              };
              joinedMatches.push(data);
            }
          }
        })
      );
      joinedMatches.sort((a, b) => moment(b.start_date) - moment(a.start_date));

      return joinedMatches.length > 0
        ? { message: "User joined latest 5 Upcoming and live match data..", status: true, data: joinedMatches }
        : { message: "No Data Found..", status: false, data: [] };
    } catch (error) {
      console.error("Error in fetchLiveMatches:", error);
      return { message: "Something went wrong!", status: false, error: error.message };
    }
  }

  async fetchDuoLiveMatch(req) {
    try {
      let fantasy = req.query.fantasy_type || "Cricket";
      let keyname = `live-matches`;
      let redisdata = await retrieveLiveSortedSet(keyname);

      if (!redisdata || redisdata.length === 0) {
        return { message: "No Data Found", status: false, data: [] };
      }

      let joinedMatches = [];

      // Parallel execution to optimize performance
      await Promise.all(
        redisdata.map(async (matchid) => {
          let keyMatchRun = `listMatchesModel-${matchid}`;
          let match = await redisjoinTeams.getkeydata(keyMatchRun);

          if (!match) {
            match = await matchesModel.findOne({
              _id: mongoose.Types.ObjectId(matchid),
            });
            if (match) {
              await redisjoinTeams.setkeydata(keyMatchRun, match, 30 * 24 * 60 * 60);
            } else {
              return;
            }
          }

          let keyUserJoinedChallenge = `match:${matchid}:user:${req.user._id}:joinedDuoContests`;
          let userContest = await getMyLeaderBoard(keyUserJoinedChallenge, req.user._id, "contest");
          if (userContest == false) {
            const matchKey = `match:${matchid}:duochallenges`;
            const matchAllChallenges = await redisContest.hgetAllData(matchKey);
            let filteredMatchChallenges = Object.values(matchAllChallenges || {});
            if (filteredMatchChallenges && filteredMatchChallenges.length <= 0) {
              filteredMatchChallenges = await dualgamematchChallengersModel.find({
                matchkey: new mongoose.Types.ObjectId(matchid),
              });
            }
            if (filteredMatchChallenges && filteredMatchChallenges.length > 0) {
              await Promise.all(
                filteredMatchChallenges.map(async (challenge) => {
                  const userChallengeCounterKey = `match:${matchid}:challenge:${challenge._id}:user:${req.user._id}:joinedPlayer`;
                  let userTeamCount = await redisjoinTeams.getkeydata(userChallengeCounterKey);
                  if (userTeamCount > 0) {
                    let redisUserChallenge = {
                      _id: `${challenge._id.toString()}`,
                      getcurrentrank: userTeamCount,
                      matchkey: matchid,
                    };
                    var expRedisTime = await matchTimeDifference(matchid);
                    await storeSortedSet(keyUserJoinedChallenge, redisUserChallenge, expRedisTime);
                  } else {
                    userTeamCount = await duoleaderBoardModel.find({
                      matchkey: new mongoose.Types.ObjectId(matchid),
                      challengeid: new mongoose.Types.ObjectId(challenge._id),
                      userId: new mongoose.Types.ObjectId(req.user._id)
                    });
                    if (userTeamCount > 0) {
                      let redisUserChallenge = {
                        _id: `${challenge._id.toString()}`,
                        getcurrentrank: userTeamCount,
                        matchkey: matchid,
                      };
                      var expRedisTime = await matchTimeDifference(matchid);
                      await storeSortedSet(keyUserJoinedChallenge, redisUserChallenge, expRedisTime);
                    }
                  }
                })
              );
            }
            userContest = await getMyLeaderBoard(keyUserJoinedChallenge, req.user._id, "contest");
          }
          if (userContest && userContest.length > 0) {
            const status = moment(match.start_date).isBefore(moment()) ? "closed" : "opened";

            let data = {
              matchkey: match._id,
              date: match.start_date,
              curDate: moment().format("YYYY-MM-DD HH:mm:ss"),
              matchname: match.name,
              team1ShortName: match.teamA?.short_name || "N/A",
              team2ShortName: match.teamB?.short_name || "N/A",
              team1fullname: match.teamA?.teamName || "N/A",
              team2fullname: match.teamB?.teamName || "N/A",
              team1color: "#D5EF8A",
              team2color: "#52A860",
              start_date: match.start_date,
              team1logo: `${global.constant.IMAGE_URL}${match.teamA?.logo || "default_team1.png"}`,
              team2logo: `${global.constant.IMAGE_URL}${match.teamB?.logo || "default_team2.png"}`,
              status: status,
              launch_status: match.launch_status,
              final_status: match.final_status,
              series_name: match.seriesData?.name || "Unknown",
              type: match.fantasy_type,
              series_id: match.series,
              available_status: 1,
              joinedcontest: userContest.length,
              playing11_status: match.playing11_status,
              textNote: match.textNote || "",
              real_matchkey: match.real_matchkey,
              contestType: "old",
              mega: match?.mega || 0,
              WinningpriceAndPrize: "",
              image: "",
            };
            joinedMatches.push(data);
          }
        })
      );
      joinedMatches.sort((a, b) => moment(b.start_date) - moment(a.start_date));
      return joinedMatches.length > 0
        ? { message: "User joined latest 5 Upcoming and live match data..", status: true, data: joinedMatches }
        : { message: "No Data Found..", status: false, data: [] };
    } catch (error) {
      console.error("Error in fetchLiveMatches:", error);
      return { message: "Something went wrong!", status: false, error: error.message };
    }
  }



  async fetchLiveMatchJoinedData(req) {
    try {
      let fantasy = req.query.fantasy_type || "Cricket";
      let keyname = `live-matches`;
      let redisdata = await retrieveLiveSortedSet(keyname);

      if (!redisdata || redisdata.length === 0) {
        return { message: "No Data Found", status: false, data: [] };
      }

      let joinedMatches = [];

      // Parallel execution to optimize performance
      await Promise.all(
        redisdata.map(async (matchid) => {
          let keyMatchRun = `listMatchesModel-${matchid}`;
          let match = await redisjoinTeams.getkeydata(keyMatchRun);
          if (!match) {
            match = await matchesModel.findOne({
              _id: mongoose.Types.ObjectId(matchid),
            });
            if (match) {
              await redisjoinTeams.setkeydata(keyMatchRun, match, 30 * 24 * 60 * 60);
            } else {
              return;
            }
          }

          let keyUserJoinedChallenge = `match:${matchid}:user:${req.user._id}:joinedContests`;
          // let userContest = await getMyLeaderBoard(keyUserJoinedChallenge, req.user._id, "contest");
          let userContest = await redisLiveLeaderboard.getMyLeaderBoard(keyUserJoinedChallenge, req.user._id, "contest"); // redisLiveLeaderboard

          if (userContest) {
            // Redis cache check for teams
            const redisKey = `match:${matchid}:user:${req.user._id}:teams`;
            // let cachedTeams = await redisjoinTeams.getkeydata(redisKey);
            let cachedTeams = await redisLiveJoinTeams.getkeydata(redisKey); // redisLiveJoinTeams
            cachedTeams = cachedTeams || [];

            if (cachedTeams.length > 0) {
              cachedTeams = cachedTeams || [];
            } else {
              cachedTeams = await userTeamModel.find({
                userid: new mongoose.Types.ObjectId(req.user._id),
                matchkey: new mongoose.Types.ObjectId(matchid),
              }).lean();
              var expRedisTime = await matchTimeDifference(matchid);
              // await redisjoinTeams.setkeydata(redisKey, cachedTeams, expRedisTime);
              await redisLiveJoinTeams.setkeydata(redisKey, cachedTeams, expRedisTime); // redisLiveJoinTeams
            }
            if (userContest && userContest.length > 0 && cachedTeams.length > 0) {
              const status = moment(match.start_date).isBefore(moment()) ? "closed" : "opened";

              let data = {
                matchkey: match._id,
                date: match.start_date,
                curDate: moment().format("YYYY-MM-DD HH:mm:ss"),
                matchname: match.name,
                team1ShortName: match.teamA?.short_name || "N/A",
                team2ShortName: match.teamB?.short_name || "N/A",
                team1fullname: match.teamA?.teamName || "N/A",
                team2fullname: match.teamB?.teamName || "N/A",
                team1color: "#D5EF8A",
                team2color: "#52A860",
                start_date: match.start_date,
                total_teams: cachedTeams.length || 0,
                team1logo: `${global.constant.IMAGE_URL}${match.teamA?.logo || "default_team1.png"}`,
                team2logo: `${global.constant.IMAGE_URL}${match.teamB?.logo || "default_team2.png"}`,
                status: status,
                launch_status: match.launch_status,
                final_status: match.final_status,
                series_name: match.seriesData?.name || "Unknown",
                type: match.fantasy_type,
                series_id: match.series,
                available_status: 1,
                joinedcontest: userContest.length,
                playing11_status: match.playing11_status,
                textNote: match.textNote || "",
                real_matchkey: match.real_matchkey,
                contestType: "old",
                mega: match?.mega || 0,
                WinningpriceAndPrize: "",
                image: "",
              };
              joinedMatches.push(data);
            }
          }
        })

      );
      joinedMatches.sort((a, b) => moment(b.start_date) - moment(a.start_date));
      return joinedMatches.length > 0
        ? { message: "User joined latest 5 Upcoming and live match data..", status: true, data: joinedMatches }
        : { message: "No Data Found..", status: false, data: [] };
    } catch (error) {
      console.error("Error in fetchLiveMatches:", error);
      return { message: "Something went wrong!", status: false, error: error.message };
    }
  }

  async updateLiveMatchRedis(req, res) {
    try {
      // console.log('rrrrrrrrrgfyugyggggggggggggg')
      // let keyname = `matchkes-live-today`;

      let fantasy = "Cricket";
      let matchpipe = [];
      const fantasy_type = fantasy;
      matchpipe.push({
        $match: {
          fantasy_type: fantasy_type,
        },
      });
      matchpipe.push({
        $match: {
          $and: [
            { launch_status: "launched" },
          ],
          final_status: { $in: ["pending", "IsReviewed"] },
        },
      });
      matchpipe.push({
        $lookup: {
          from: "teams",
          localField: "team1Id",
          foreignField: "_id",
          as: "team1",
        },
      });
      matchpipe.push({
        $lookup: {
          from: "teams",
          localField: "team2Id",
          foreignField: "_id",
          as: "team2",
        },
      });
      matchpipe.push({
        $lookup: {
          from: "matchseries",
          localField: "series",
          foreignField: "_id",
          as: "series",
        },
      });
      matchpipe.push({
        $match: { "series.status": "opened" },
      });
      let today = new Date();
      today.setHours(today.getHours() + 5);
      today.setMinutes(today.getMinutes() + 30);
      // console.log("---today------", today)
      matchpipe.push({
        $addFields: {
          date: {
            $dateFromString: {
              dateString: "$start_date",
              timezone: "-00:00",
            },
          },
          curDate: today,
        },
      });
      matchpipe.push({
        $match: {
          $expr: {
            $and: [
              {
                $lte: ["$date", today],
              },
            ],
          },
        },
      });

      matchpipe.push({
        $sort: {
          match_order: -1,
          date: 1,
        },
      });

      matchpipe.push({
        $project: {
          _id: 0,
          id: "$_id",
          name: 1,
          format: 1,
          notify: 1,
          order_status: 1,
          series: { $arrayElemAt: ["$series._id", 0] },
          seriesname: { $arrayElemAt: ["$series.name", 0] },
          team1name: { $arrayElemAt: ["$team1.short_name", 0] },
          team2name: { $arrayElemAt: ["$team2.short_name", 0] },
          teamfullname1: { $arrayElemAt: ["$team1.teamName", 0] },
          teamfullname2: { $arrayElemAt: ["$team2.teamName", 0] },
          matchkey: 1,
          fantasy_type: "$fantasy_type",
          winnerstatus: "$final_status",
          playing11_status: 1,
          team1color: {
            $ifNull: [
              { $arrayElemAt: ["$team1.color", 0] },
              global.constant.TEAM_DEFAULT_COLOR.DEF1,
            ],
          },
          team2color: {
            $ifNull: [
              { $arrayElemAt: ["$team2.color", 0] },
              global.constant.TEAM_DEFAULT_COLOR.DEF1,
            ],
          },
          team1logo: {
            $ifNull: [
              {
                $cond: {
                  if: {
                    $or: [
                      {
                        $eq: [
                          {
                            $substr: [
                              { $arrayElemAt: ["$team1.logo", 0] },
                              0,
                              1,
                            ],
                          },
                          "/",
                        ],
                      },
                      {
                        $eq: [
                          {
                            $substr: [
                              { $arrayElemAt: ["$team1.logo", 0] },
                              0,
                              1,
                            ],
                          },
                          "t",
                        ],
                      },
                    ],
                  },
                  then: {
                    $concat: [
                      `${global.constant.IMAGE_URL}`,
                      "",
                      { $arrayElemAt: ["$team1.logo", 0] },
                    ],
                  },
                  else: { $arrayElemAt: ["$team1.logo", 0] },
                },
              },
              `${global.constant.IMAGE_URL}team_image.png`,
            ],
          },
          team2logo: {
            $ifNull: [
              {
                $cond: {
                  if: {
                    $or: [
                      {
                        $eq: [
                          {
                            $substr: [
                              { $arrayElemAt: ["$team2.logo", 0] },
                              0,
                              1,
                            ],
                          },
                          "/",
                        ],
                      },
                      {
                        $eq: [
                          {
                            $substr: [
                              { $arrayElemAt: ["$team2.logo", 0] },
                              0,
                              1,
                            ],
                          },
                          "t",
                        ],
                      },
                    ],
                  },
                  then: {
                    $concat: [
                      `${global.constant.IMAGE_URL}`,
                      "",
                      { $arrayElemAt: ["$team2.logo", 0] },
                    ],
                  },
                  else: { $arrayElemAt: ["$team2.logo", 0] },
                },
              },
              `${global.constant.IMAGE_URL}team_image.png`,
            ],
          },
          matchopenstatus: {
            $cond: {
              if: {
                $lte: ["$start_date", moment().format("YYYY-MM-DD HH:mm:ss")],
              },
              then: "closed",
              else: "opened",
            },
          },
          time_start: "$start_date",
          launch_status: 1,
          createteamnumber: "1",
          status: "true",
          info_center: 1,
          match_order: 1,
          textNote: { $ifNull: ["$textNote", ""] },
          real_matchkey: "$real_matchkey",
          contestType: "$contestType",
        },
      });
      matchpipe.push({
        $lookup: {
          from: "matchcontests",
          localField: "id",
          foreignField: "matchkey",
          pipeline: [
            {
              $match: {
                is_private: 0
              }
            }
          ],
          as: "mega",
        },
      });
      matchpipe.push(
        {
          $lookup: {
            from: "matchcontests",
            localField: "id",
            foreignField: "matchkey",
            pipeline: [
              {
                $lookup: {
                  from: "contestcategories",
                  localField: "contest_cat",
                  foreignField: "_id",
                  pipeline: [
                    {
                      $project: {
                        name: 1,
                      },
                    },
                  ],
                  as: "contest_category_data",
                },
              },
              {
                $unwind: {
                  path: "$contest_category_data",
                },
              },
              {
                $addFields: {
                  contestName: "$contest_category_data.name",
                },
              },
              {
                $match: {
                  contestName: {
                    $regex: "Giveaway Contest",
                    $options: "i",
                  },
                },
              },
              {
                $addFields: {
                  giveAwayContest: 1,
                },
              },
              {
                $project: {
                  win_amount: 1,
                  giveAwayContest: 1,
                },
              },
            ],
            as: "giveawaycontestData",
          },
        },
        {
          $addFields: {
            giveawaycontest: {
              $cond: {
                if: {
                  $eq: [
                    {
                      $size: "$giveawaycontestData",
                    },
                    1,
                  ],
                },
                then: 1,
                else: 0,
              },
            },
            giveawaycontestAmount: {
              $cond: {
                if: {
                  $eq: [
                    {
                      $size: "$giveawaycontestData",
                    },
                    1,
                  ],
                },
                then: {
                  $first: "$giveawaycontestData.win_amount",
                },
                else: 0,
              },
            },
          },
        }
      );
      matchpipe.push({
        $addFields: {
          WinningpriceAndPrize: {
            $getField: {
              input: {
                $arrayElemAt: [
                  {
                    $sortArray: {
                      input: "$mega",
                      sortBy: {
                        win_amount: -1,
                      },
                    },
                  },
                  0,
                ],
              },
              field: "WinningpriceAndPrize",
            },
          },
        },
      });
      matchpipe.push({
        $addFields: {
          mega: {
            $getField: {
              input: {
                $arrayElemAt: [
                  {
                    $sortArray: {
                      input: "$mega",
                      sortBy: {
                        win_amount: -1,
                      },
                    },
                  },
                  0,
                ],
              },
              field: "win_amount",
            },
          },
        },
      });

      matchpipe.push({
        $addFields: {
          mega: {
            $ifNull: ["$mega", 0],
          },
        },
      });
      matchpipe.push({
        $addFields: {
          image: "",
        },
      });
      // console.log(JSON.stringify(matchpipe));

      let result = await matchesModel.aggregate(matchpipe);
      if (result.length > 0) {
        // **Redis Loop Format for Storing Matches**
        for (let match of result) {
          let matchKeyName = `live-matches`;
          let data = {
            _id: match.id,
            order: 1
          }
          var expRedisTime = await matchTimeDifference(match.id);
          await storeLiveMatches(matchKeyName, data, expRedisTime);
        }
      }
      // redisjoinTeams.setkeydata(keyname, result, 60 * 10);
      return result;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async fetchLiveCommentary(req) {
    try {
      const pageSize = Number(req.query.pageSize) || 10;
      const pageNumber = req.query.pageNumber || 1;
      const skipCount = (pageNumber - 1) * pageSize;
      const pipe = [
        {
          $lookup: {
            from: "matches",
            localField: "real_matchkey",
            foreignField: "real_matchkey",
            pipeline: [
              {
                $match: {
                  _id: mongoose.Types.ObjectId(req.params.matchId),
                },
              },
            ],
            as: "match",
          },
        },
        {
          $unwind: {
            path: "$match",
          },
        },
        {
          $addFields: {
            matchkey: "$match._id",
          },
        },
        {
          $project: {
            inning1: 1,
            inning2: 1,
            matchkey: 1,
            real_matchkey: 1,
          },
        },
        {
          $project: {
            inning1: {
              $reverseArray: "$inning1",
            },
            inning2: {
              $reverseArray: "$inning2",
            },
            matchkey: 1,
          },
        },
        {
          $addFields: {
            inning: {
              $concatArrays: ["$inning2", "$inning1"],
            },
          },
        },
        {
          $project: {
            inning: 1,
            matchkey: 1,
          },
        },
        {
          $unwind: {
            path: "$inning",
          },
        },
        {
          $addFields: {
            "inning.matchkey": "$matchkey",
          },
        },
        {
          $replaceRoot: {
            newRoot: "$inning",
          },
        },
        {
          $project: {
            bowls: 0,
            bats: 0,
          },
        },
        {
          $skip: skipCount,
        },
        {
          $limit: pageSize,
        },
        {
          $addFields: {
            score: {
              $toString: "$score",
            },
            runs: {
              $toString: "$runs",
            },
            over: {
              $toString: "$over",
            },
          },
        },
      ];
      const data = await commentaryModel.aggregate(pipe);

      // Process 'data' further as needed

      if (data.length == 0) {
        return {
          message: "Data Not Found !!",
          status: false,
        };
      }
      return {
        message: " Data Fetch Successfully",
        status: true,
        data: data,
      };
    } catch (error) {
      console.log(error);
    }
  }

  async fetchMatchLiveScore(req) {
    try {
      let keyMatchRun = `listMatchesRunModel-${req.params.matchId}`;
      let liveScore = await redisjoinTeams.getkeydata(keyMatchRun);
      if (liveScore) {
        return {
          message: " Data Fetch Successfully",
          status: true,
          data: [liveScore],
        };
      } else {
        const data = await matchScoreModel.aggregate([
          {
            $match: {
              matchkey: mongoose.Types.ObjectId(req.params.matchId),
            },
          },
          {
            $project: {
              matchkey: 1,
              teama: 1,
              teamb: 1,
              teams: 1,
              status_note: 1,
              // 'currentOverData': 1
            },
          },
          {
            $unwind: {
              path: "$teams",
              preserveNullAndEmptyArrays: true
            },
          },
        ]);

        if (data.length == 0) {
          return {
            message: "Data Not Found !!",
            status: false,
          };
        }
        return {
          message: " Data Fetch Successfully",
          status: true,
          data: data,
        };
      }
      return {
        message: "Data Not Found !!",
        status: false,
      };
    } catch (error) {
      console.log(error);
    }
  }
  /**
     * @function fantasyScoreCards
     * @description Match Player stats shows up
     * @param { matchkey }
     * @author
     */
  async fantasyScoreCards(req) {
    try {
      let finalData = [],
        aggpipe = [],
        ends = ["th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th"];
      // const joinData = await userTeamModel.find({ matchkey: req.query.matchkey });
      // const matchplayer = await matchPlayersModel.find({ matchkey: req.query.matchkey }).populate({
      //     path: 'matchkey',
      //     select: 'name, '
      // });
      aggpipe.push({
        $match: {
          matchkey: mongoose.Types.ObjectId(req.query.matchkey),
          playingstatus: 1,
        },
      });
      aggpipe.push({
        $lookup: {
          from: "matches",
          localField: "matchkey",
          foreignField: "_id",
          as: "match",
        },
      });
      aggpipe.push({
        $addFields: { matchname: { $arrayElemAt: ["$match.name", 0] } },
      });
      aggpipe.push({
        $project: {
          _id: 0,
          matchplayerid: "$_id",
          matchkey: 1,
          playerid: 1,
          role: 1,
          credit: 1,
          name: 1,
          legal_name: 1,
          battingstyle: 1,
          bowlingstyle: 1,
          playingstatus: 1,
          vplaying: 1,
          players_count: 1,
          matchname: 1,
          totalSelected: 1,
        },
      });
      aggpipe.push({
        $lookup: {
          from: "teamplayers",
          let: { playerid: "$playerid" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$playerid"],
                },
              },
            },
            {
              $lookup: {
                from: "teams",
                localField: "team",
                foreignField: "_id",
                as: "team",
              },
            },
            {
              $project: {
                _id: 0,
                image: 1,
                role: 1,
                team: { $arrayElemAt: ["$team.short_name", 0] },
              },
            },
          ],
          as: "playerimage",
        },
      });
      aggpipe.push({
        $addFields: {
          teamShortName: { $arrayElemAt: ["$playerimage.team", 0] },
          playerimage: { $arrayElemAt: ["$playerimage.image", 0] },
          playerrole: { $arrayElemAt: ["$playerimage.role", 0] },
          playerCredit: { $arrayElemAt: ["$playerimage.credit", 0] },
        },
      });
      aggpipe.push({
        $lookup: {
          from: "resultmatches",
          let: { matchkey: "$matchkey", playerid: "$playerid" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$matchkey", "$$matchkey"] },
                    { $eq: ["$player_id", "$$playerid"] },
                  ],
                },
              },
            },
          ],
          as: "result",
        },
      });
      aggpipe.push({
        $lookup: {
          from: "resultpoints",
          let: { matchkey: "$matchkey", playerid: "$playerid" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$matchkey", "$$matchkey"] },
                    { $eq: ["$player_id", "$$playerid"] },
                  ],
                },
              },
            },
          ],
          as: "resultpoint",
        },
      });
      aggpipe.push({
        $project: {
          playername: "$name",
          // playerimage: {
          //     $ifNull: [{
          //         $cond: {
          //             if: { $or: [{ $eq: [{ $substr: ['$playerimage', 0, 1] }, '/'] }, { $eq: [{ $substr: ['$playerimage', 0, 1] }, 'p'] }] },
          //             then: { $concat: [`${global.constant.IMAGE_URL}`, '', '$playerimage'] },
          //             else: {
          //                 $cond: {
          //                     if: { $eq: ['$playerimage', ''] },
          //                     then: `${global.constant.IMAGE_URL}player.png`,
          //                     else: '$playerimage'
          //                 }
          //             },
          //         }
          //     }, `${global.constant.IMAGE_URL}player.png`]
          // },
          playerimage: {
            $cond: {
              if: {
                $and: [
                  { $ne: ["$playerimage", "null"] },
                  { $ne: ["$playerimage", ""] },
                ],
              },
              then: { $concat: [`${global.constant.IMAGE_URL}`, " ", "$playerimage"] },
              else: {
                $cond: {
                  if: { $eq: ["$playerimage", ""] },
                  then: {
                    $cond: {
                      if: { $eq: ["$playerimage", "$match.team1Id"] },
                      then: `${global.constant.IMAGE_URL}white_team1.png`,
                      else: {
                        $cond: {
                          if: { $eq: ["$playersData.team", "$match.team2Id"] },
                          then: `${global.constant.IMAGE_URL}black_team1.png`,
                          else: `${global.constant.IMAGE_URL}black_team1.png`,
                        },
                      },
                    },
                  },
                  else: `${global.constant.IMAGE_URL}black_team1.png`,
                },
              },
            },
          },
          matchname: 1,
          playerid: 1,
          playerrole: 1,
          credit: 1,
          duck: { $arrayElemAt: ["$result.duck", 0] },
          innings: { $arrayElemAt: ["$result.innings", 0] },
          teamShortName: 1,
          startingpoints: { $arrayElemAt: ["$resultpoint.startingpoints", 0] },
          runs: { $arrayElemAt: ["$resultpoint.runs", 0] },
          fours: { $arrayElemAt: ["$resultpoint.fours", 0] },
          thirtypoints: { $arrayElemAt: ["$resultpoint.thirtypoints", 0] },
          sixs: { $arrayElemAt: ["$resultpoint.sixs", 0] },
          runouts: { $arrayElemAt: ["$result.runouts", 0] },
          strike_rate: { $arrayElemAt: ["$resultpoint.strike_rate", 0] },
          century: {
            $sum: [
              { $arrayElemAt: ["$resultpoint.century", 0] },
              { $arrayElemAt: ["$resultpoint.halfcentury", 0] },
            ],
          },
          wickets: { $arrayElemAt: ["$resultpoint.wickets", 0] },
          maidens: { $arrayElemAt: ["$resultpoint.maidens", 0] },
          economy_rate: { $arrayElemAt: ["$resultpoint.economy_rate", 0] },
          thrower: { $arrayElemAt: ["$resultpoint.thrower", 0] },
          hitter: { $arrayElemAt: ["$resultpoint.hitter", 0] },
          catch: { $arrayElemAt: ["$resultpoint.catch", 0] },
          catchpoints: { $arrayElemAt: ["$resultpoint.catch", 0] },
          stumping: {
            $sum: [
              { $arrayElemAt: ["$resultpoint.stumping", 0] },
              { $arrayElemAt: ["$resultpoint.thrower", 0] },
              { $arrayElemAt: ["$resultpoint.hitter", 0] },
            ],
          },
          bonus: { $arrayElemAt: ["$resultpoint.bonus", 0] },
          halfcentury: { $arrayElemAt: ["$resultpoint.halfcentury", 0] },
          negative: { $arrayElemAt: ["$resultpoint.negative", 0] },
          total: { $arrayElemAt: ["$resultpoint.total", 0] },
          wicketbonuspoint: {
            $arrayElemAt: ["$resultpoint.wicketbonuspoint", 0],
          },
          selectper: { $ifNull: ["$totalSelected", "0"] },
        },
      });
      const matchplayer = await matchPlayersModel.aggregate(aggpipe);
      if (matchplayer.length > 0) {
        return {
          message: "Match Player stats data...",
          status: true,
          data: matchplayer,
        };
      } else {
        return {
          message: "Match Player stats data not found...",
          status: false,
          data: [],
        };
      }
    } catch (error) {
      throw error;
    }
  }
}



module.exports = new matchServices();
