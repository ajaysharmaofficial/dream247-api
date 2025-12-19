const mongoose = require("mongoose");
const moment = require("moment");
const fs = require("fs");
require("../../../models/contestModel");
require("../../../models/teamPlayerModel");
require("../../../models/teamModel");

const matchesModel = require("../../../models/matchesModel");
const SeriesModel = require("../../../models/matchSeriesModel");
const matchPlayersModel = require("../../../models/matchPlayersModel");
const userLeagueModel = require("../../../models/userLeagueModel");
const userTeamModel = require("../../../models/userTeamModel");
const EntityApiController = require("../controller/cricketApiController");
const resultPointModel = require("../../../models/resultPointModel");
const userLeaderBoardModel = require("../../../models/userLeaderBoardModel");
const redisjoinTeams = require("../../../utils/redis/redisjoinTeams");
const redisLiveJoinTeams = require("../../../utils/redis/redisLiveJoinTeams");
const redisContest = require("../../../utils/redis/redisContest");
const Redis = require("../../../utils/redis/redisLiveLeaderboard");
const redisLiveLeaderboard = require("../../../utils/redis/redisLiveLeaderboard");
const { healthCheck } = require("../../../utils/redis/redisMain");
const redisMain = require("../../../utils/redis/redisMain");
// const { getMatchPlayrs } = require("../../../utils/s3");
const { matchTimeDifference } = require("../../../utils/matchTimeDiffrence");
const teamTypeModel = require("../../../models/teamTypeModel");
class matchServices {
  constructor() {
    return {
      dbCheck: this.dbCheck.bind(this),
      fetchMatchList: this.fetchMatchList.bind(this),
      fetchUpcomingMatchesWithoutRedis: this.fetchUpcomingMatchesWithoutRedis.bind(this),
      fetchNewJoinedMatches: this.fetchNewJoinedMatches.bind(this),
      NewJoinedMatches: this.NewJoinedMatches.bind(this),
      fetchMatchDetails: this.fetchMatchDetails.bind(this),
      fetchAllPlayers: this.fetchAllPlayers.bind(this),
      fetchAllPlayerspot: this.fetchAllPlayerspot.bind(this),
      fetchPlayerInfo: this.fetchPlayerInfo.bind(this),
      fetchMegaWinners: this.fetchMegaWinners.bind(this),
      getMatchTime: this.getMatchTime.bind(this),
      leaderboardLiveRank: this.leaderboardLiveRank.bind(this),
      matchlivedata: this.matchlivedata.bind(this),
      playersWithPlayingStatus:
        this.playersWithPlayingStatus.bind(this),
      updateTotalPoints: this.updateTotalPoints.bind(this),
      playerMatchInfoData: this.playerMatchInfoData.bind(this),
      getJoinleague: this.getJoinleague.bind(this),
      fetchMatchListWithoutRedis: this.fetchMatchListWithoutRedis.bind(this),
      recentWinnerWithoutRedis: this.recentWinnerWithoutRedis.bind(this),
      leaderboardSelfLiveRanks: this.leaderboardSelfLiveRanks.bind(this),
      leaderboardCompletedMatch: this.leaderboardCompletedMatch.bind(this),
      getRecentContestData: this.getRecentContestData.bind(this),
      teamTypes: this.teamTypes.bind(this),

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

  async fetchUpcomingMatchesWithoutRedis(req, res) {
    try {

      let date = moment().format("YYYY-MM-DD HH:mm:ss");

      console.log(date, "-----currentDate+++++");

      const result = await matchesModel.find({
        start_date: { $gt: date }
      });

      return result;

    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async teamTypes(req, res) {
    try {
      console.log('test');
      const teamType = await teamTypeModel.find({ status: "active" });
      console.log('teamType', teamType);
      return teamType;
    }
    catch (error) {
      console.log(error);
      throw error;
    }
  }
  async fetchMatchListWithoutRedis(req, res) {
    try {
      let keyname = `matchkes-upcoming-today`;

      let fantasy = "Cricket";
      let matchpipe = [];
      let date = moment().format("YYYY-MM-DD HH:mm:ss");
      let EndDate = moment().add(25, "days").format("YYYY-MM-DD HH:mm:ss");
      const fantasy_type = fantasy;
      matchpipe.push({
        $match: {
          fantasy_type: fantasy_type,
        },
      });
      matchpipe.push({
        $match: {
          $and: [
            { status: "notstarted" },
            { launch_status: "launched" },
            { start_date: { $gt: date } },
            { start_date: { $lt: EndDate } },
          ],
          final_status: { $nin: ["IsCanceled", "IsAbandoned"] },
        },
      });
      matchpipe.push({
        $match: { "seriesData.status": "opened" },
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
          'series': ["$seriesData"],
          team1: ["$teamA"],
          team2: ["$teamB"],
        },
      });
      matchpipe.push({
        $match: {
          $expr: {
            $and: [
              {
                $gte: ["$date", today],
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
          second_inning_status: 1,
          team1Id: 1,
          team2Id: 1,
          series: { $arrayElemAt: ["$series.seriesId", 0] },
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
          locktime: EndDate,
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
            { $sort: { win_amount: -1 } },
            {
              $match: {
                "contestCategory.name": {
                  $ne: 'Giveaway Contest'
                }
              }
            }, { $limit: 1 },
            {
              $project: {
                win_amount: 1
              }
            }
          ],
          as: "mega"
        },
      });
      matchpipe.push(
        {
          $lookup: {
            from: "matchcontests",
            localField: "id",
            foreignField: "matchkey",
            pipeline: [
              { $sort: { win_amount: -1 } },
              {
                $match: {
                  "contestCategory.name": {
                    $regex: "Giveaway Contest",
                    $options: "i"
                  }
                }
              },
              {
                $addFields: {
                  giveAwayContest: 1
                }
              },
              {
                $project: {
                  win_amount: 1,
                  giveAwayContest: 1
                }
              }
            ],
            as: "giveawaycontestData"
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
      // matchpipe.push({
      //   $addFields: {
      //     WinningpriceAndPrize: {
      //       $getField: {
      //         input: {
      //           $arrayElemAt: [
      //             {
      //               $sortArray: {
      //                 input: "$mega",
      //                 sortBy: {
      //                   win_amount: -1,
      //                 },
      //               },
      //             },
      //             0,
      //           ],
      //         },
      //         field: "WinningpriceAndPrize",
      //       },
      //     },
      //   },
      // });
      matchpipe.push({
        $addFields: {
          mega: {
            $getField: {
              input: {
                $arrayElemAt: [
                  "$mega",
                  0
                ]
              },
              field: "win_amount"
            }
          }
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
          WinningpriceAndPrize: ""
        },
      });
      // console.log('matchpipe', JSON.stringify(matchpipe));

      let result = await matchesModel.aggregate(matchpipe);
      if (result.length > 0) {
        for (let match of result) {
          const keyName = `playerList-matchkey-${match.real_matchkey}`;
          // let matchPlayersData = await redisjoinTeams.getkeydata(keyName);
          // console.log('matchPlayersData', JSON.stringify(matchPlayersData));
          let matchPlayersData = 0;
          if (!matchPlayersData || matchPlayersData.length <= 0 || matchPlayersData == null) {
            let aggpipe = [];
            aggpipe.push({
              $match: { matchkey: new mongoose.Types.ObjectId(match.id) },
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
                      players_key: 1,
                      captain: 1,
                      teamName: { $arrayElemAt: ["$team.teamName", 0] },
                      teamid: { $arrayElemAt: ["$team._id", 0] },
                      teamColor: { $arrayElemAt: ["$team.teamColor", 0] },
                      logo: { $arrayElemAt: ["$team.logo", 0] },
                      short_name: { $arrayElemAt: ["$team.short_name", 0] },
                    },
                  },
                ],
                as: "playerdata",
              },
            });
            let matchPlayerData = await matchPlayersModel.aggregate(aggpipe);
            let playersData = [];
            if (matchPlayerData.length > 0) {
              for (let player of matchPlayerData) {
                let team = "team1";
                // console.log(player.playerdata[0].teamid.toString(), team1Id.toString());
                if (
                  player?.playerdata[0]?.teamid.toString() ===
                  match?.team2Id?.toString()
                ) {
                  team = "team2";
                }
                let matchPlayers = {
                  captain_selection_percentage: player.captain_selection_percentage,
                  credit: player.credit,
                  name: player.name,
                  captain: player.playerdata[0].captain || false,
                  playingstatus: player.playingstatus,
                  points: player.points,
                  role: player.role,
                  totalSelected: player.totalSelected,
                  vice_captain_selection_percentage: Number(
                    player.vice_captain_selection_percentage
                  ),
                  vplaying: player.vplaying,
                  captainSelected: Number(player.captainSelected),
                  vicecaptainSelected: Number(player.vicecaptainSelected),
                  playerid: player.playerid,
                  p_id: player._id,
                  lastMatchPlayed: player.lastMatchPlayed,
                  players_key: Number(player.playerdata[0].players_key),
                  image: (player.playerdata[0].image) ? `${global.constant.IMAGE_URL}${player.playerdata[0].image}` : `${global.constant.IMAGE_URL}avtar1.png`,
                  teamName: player.playerdata[0].teamName,
                  teamid: player.playerdata[0].teamid,
                  teamcolor: player.playerdata[0].teamColor,
                  team_logo: player.playerdata[0].logo,
                  team_short_name: player.playerdata[0].short_name,
                  totalpoints: `${player.fantasy_total_points}`,
                  team: team,
                  player_selection_percentage: 0,
                  isSelectedPlayer: false,
                };
                playersData.push(matchPlayers);
              }
              var expRedisTime = await matchTimeDifference(match.id.toString());
              await redisjoinTeams.setkeydata(keyName, playersData, expRedisTime);
            }
            matchPlayersData = playersData;
          }
          const matchplayersid = matchPlayersData.find(
            item =>
              item.teamid?.toString() === match.team1Id?.toString() &&
              item.captain === true
          );
          let capTeam1Image = '';
          if (matchplayersid) {
            capTeam1Image = matchplayersid?.image || '';
          }
          match.capTeam1Image = capTeam1Image;

          const matchplayersid1 = matchPlayersData.find(
            item =>
              item.teamid?.toString() === match.team2Id?.toString() &&
              item.captain === true
          );
          let capTeam2Image = '';
          if (matchplayersid) {
            capTeam2Image = matchplayersid1?.image || '';
          }
          match.capTeam2Image = capTeam2Image
        }
        redisjoinTeams.setkeydata(keyname, result, 20 * 24 * 60 * 60);
        return result;
      }

    } catch (error) {
      console.log(error);
      throw error;
    }
  }
  /**
   * @function getMatchList
   * @description Get All Match List
   * @param { }
   * @author
   */
  // async fetchMatchList(req, res) {
  //   try {
  //     let keyname = `matchkes-upcoming-today`;
  //     let redisdata = await redisjoinTeams.getkeydata(keyname);

  //     if (redisdata && Array.isArray(redisdata) && redisdata.length > 0) {
  //       let filterDate = moment().format("YYYY-MM-DD HH:mm:ss");
  //       const filteredAndSortedMatches = redisdata
  //         .filter(match => {
  //           const matchDate = moment(match.time_start).format("YYYY-MM-DD HH:mm:ss");
  //           return matchDate > filterDate; // Filter matches earlier than filterDate
  //         })
  //         .sort((a, b) => new Date(a.match_order) - new Date(b.match_order))

  //       return filteredAndSortedMatches;
  //     } else {
  //       let fantasy = "Cricket";
  //       let matchpipe = [];
  //       let date = moment().format("YYYY-MM-DD HH:mm:ss");
  //       let EndDate = moment().add(25, "days").format("YYYY-MM-DD HH:mm:ss");
  //       const fantasy_type = fantasy;
  //       matchpipe.push({
  //         $match: {
  //           fantasy_type: fantasy_type,
  //         },
  //       });
  //       matchpipe.push({
  //         $match: {
  //           $and: [
  //             { status: "notstarted" },
  //             { launch_status: "launched" },
  //             { start_date: { $gt: date } },
  //             { start_date: { $lt: EndDate } },
  //           ],
  //           final_status: { $nin: ["IsCanceled", "IsAbandoned"] },
  //         },
  //       });
  //       matchpipe.push({
  //         $match: { "seriesData.status": "opened" },
  //       });
  //       let today = new Date();
  //       today.setHours(today.getHours() + 5);
  //       today.setMinutes(today.getMinutes() + 30);
  //       // console.log("---today------", today)
  //       matchpipe.push({
  //         $addFields: {
  //           date: {
  //             $dateFromString: {
  //               dateString: "$start_date",
  //               timezone: "-00:00",
  //             },
  //           },
  //           curDate: today,
  //           'series': ["$seriesData"],
  //           team1: ["$teamA"],
  //           team2: ["$teamB"],
  //         },
  //       });
  //       matchpipe.push({
  //         $match: {
  //           $expr: {
  //             $and: [
  //               {
  //                 $gte: ["$date", today],
  //               },
  //             ],
  //           },
  //         },
  //       });

  //       matchpipe.push({
  //         $sort: {
  //           match_order: -1,
  //           date: 1,
  //         },
  //       });

  //       matchpipe.push({
  //         $project: {
  //           _id: 0,
  //           id: "$_id",
  //           name: 1,
  //           format: 1,
  //           notify: 1,
  //           order_status: 1,
  //           series: { $arrayElemAt: ["$series.seriesId", 0] },
  //           seriesname: { $arrayElemAt: ["$series.name", 0] },
  //           team1name: { $arrayElemAt: ["$team1.short_name", 0] },
  //           team2name: { $arrayElemAt: ["$team2.short_name", 0] },
  //           teamfullname1: { $arrayElemAt: ["$team1.teamName", 0] },
  //           teamfullname2: { $arrayElemAt: ["$team2.teamName", 0] },
  //           matchkey: 1,
  //           fantasy_type: "$fantasy_type",
  //           winnerstatus: "$final_status",
  //           playing11_status: 1,
  //           team1color: {
  //             $ifNull: [
  //               { $arrayElemAt: ["$team1.color", 0] },
  //               global.constant.TEAM_DEFAULT_COLOR.DEF1,
  //             ],
  //           },
  //           team2color: {
  //             $ifNull: [
  //               { $arrayElemAt: ["$team2.color", 0] },
  //               global.constant.TEAM_DEFAULT_COLOR.DEF1,
  //             ],
  //           },
  //           team1logo: {
  //             $ifNull: [
  //               {
  //                 $cond: {
  //                   if: {
  //                     $or: [
  //                       {
  //                         $eq: [
  //                           {
  //                             $substr: [
  //                               { $arrayElemAt: ["$team1.logo", 0] },
  //                               0,
  //                               1,
  //                             ],
  //                           },
  //                           "/",
  //                         ],
  //                       },
  //                       {
  //                         $eq: [
  //                           {
  //                             $substr: [
  //                               { $arrayElemAt: ["$team1.logo", 0] },
  //                               0,
  //                               1,
  //                             ],
  //                           },
  //                           "t",
  //                         ],
  //                       },
  //                     ],
  //                   },
  //                   then: {
  //                     $concat: [
  //                       `${global.constant.IMAGE_URL}`,
  //                       "",
  //                       { $arrayElemAt: ["$team1.logo", 0] },
  //                     ],
  //                   },
  //                   else: { $arrayElemAt: ["$team1.logo", 0] },
  //                 },
  //               },
  //               `${global.constant.IMAGE_URL}team_image.png`,
  //             ],
  //           },
  //           team2logo: {
  //             $ifNull: [
  //               {
  //                 $cond: {
  //                   if: {
  //                     $or: [
  //                       {
  //                         $eq: [
  //                           {
  //                             $substr: [
  //                               { $arrayElemAt: ["$team2.logo", 0] },
  //                               0,
  //                               1,
  //                             ],
  //                           },
  //                           "/",
  //                         ],
  //                       },
  //                       {
  //                         $eq: [
  //                           {
  //                             $substr: [
  //                               { $arrayElemAt: ["$team2.logo", 0] },
  //                               0,
  //                               1,
  //                             ],
  //                           },
  //                           "t",
  //                         ],
  //                       },
  //                     ],
  //                   },
  //                   then: {
  //                     $concat: [
  //                       `${global.constant.IMAGE_URL}`,
  //                       "",
  //                       { $arrayElemAt: ["$team2.logo", 0] },
  //                     ],
  //                   },
  //                   else: { $arrayElemAt: ["$team2.logo", 0] },
  //                 },
  //               },
  //               `${global.constant.IMAGE_URL}team_image.png`,
  //             ],
  //           },
  //           matchopenstatus: {
  //             $cond: {
  //               if: {
  //                 $lte: ["$start_date", moment().format("YYYY-MM-DD HH:mm:ss")],
  //               },
  //               then: "closed",
  //               else: "opened",
  //             },
  //           },
  //           time_start: "$start_date",
  //           launch_status: 1,
  //           locktime: EndDate,
  //           createteamnumber: "1",
  //           status: "true",
  //           info_center: 1,
  //           match_order: 1,
  //           textNote: { $ifNull: ["$textNote", ""] },
  //           real_matchkey: "$real_matchkey",
  //           contestType: "$contestType",

  //           popular_status: "$popular_status",
  //           recommended_status: "$recommended_status"
  //         },
  //       });
  //       matchpipe.push({
  //         $lookup: {
  //           from: "matchcontests",
  //           localField: "id",
  //           foreignField: "matchkey",
  //           pipeline: [
  //             { $sort: { win_amount: -1 } },
  //             {
  //               $match: {
  //                 "contestCategory.name": {
  //                   $ne: 'Giveaway Contest'
  //                 }
  //               }
  //             }, { $limit: 1 },
  //             {
  //               $project: {
  //                 win_amount: 1
  //               }
  //             }
  //           ],
  //           as: "mega"
  //         },
  //       });
  //       matchpipe.push(
  //         {
  //           $lookup: {
  //             from: "matchcontests",
  //             localField: "id",
  //             foreignField: "matchkey",
  //             pipeline: [
  //               { $sort: { win_amount: -1 } },
  //               {
  //                 $match: {
  //                   "contestCategory.name": {
  //                     $regex: "Giveaway Contest",
  //                     $options: "i"
  //                   }
  //                 }
  //               },
  //               {
  //                 $addFields: {
  //                   giveAwayContest: 1
  //                 }
  //               },
  //               {
  //                 $project: {
  //                   win_amount: 1,
  //                   giveAwayContest: 1
  //                 }
  //               }
  //             ],
  //             as: "giveawaycontestData"
  //           },
  //         },
  //         {
  //           $addFields: {
  //             giveawaycontest: {
  //               $cond: {
  //                 if: {
  //                   $eq: [
  //                     {
  //                       $size: "$giveawaycontestData",
  //                     },
  //                     1,
  //                   ],
  //                 },
  //                 then: 1,
  //                 else: 0,
  //               },
  //             },
  //             giveawaycontestAmount: {
  //               $cond: {
  //                 if: {
  //                   $eq: [
  //                     {
  //                       $size: "$giveawaycontestData",
  //                     },
  //                     1,
  //                   ],
  //                 },
  //                 then: {
  //                   $first: "$giveawaycontestData.win_amount",
  //                 },
  //                 else: 0,
  //               },
  //             },

  //           },
  //         }
  //       );
  //       // matchpipe.push({
  //       //   $addFields: {
  //       //     WinningpriceAndPrize: {
  //       //       $getField: {
  //       //         input: {
  //       //           $arrayElemAt: [
  //       //             {
  //       //               $sortArray: {
  //       //                 input: "$mega",
  //       //                 sortBy: {
  //       //                   win_amount: -1,
  //       //                 },
  //       //               },
  //       //             },
  //       //             0,
  //       //           ],
  //       //         },
  //       //         field: "WinningpriceAndPrize",
  //       //       },
  //       //     },
  //       //   },
  //       // });
  //       matchpipe.push({
  //         $addFields: {
  //           mega: {
  //             $getField: {
  //               input: {
  //                 $arrayElemAt: [
  //                   "$mega",
  //                   0
  //                 ]
  //               },
  //               field: "win_amount"
  //             }
  //           }
  //         },
  //       });

  //       matchpipe.push({
  //         $addFields: {
  //           mega: {
  //             $ifNull: ["$mega", 0],
  //           },
  //         },
  //       });
  //       matchpipe.push({
  //         $addFields: {
  //           image: "",
  //           WinningpriceAndPrize: ""
  //         },
  //       });

  //       let result = await matchesModel.aggregate(matchpipe);
  //       redisjoinTeams.setkeydata(keyname, result, 20 * 24 * 60 * 60);
  //       return result;
  //     }
  //   } catch (error) {
  //     console.log(error);
  //     throw error;
  //   }
  // }

  async fetchMatchList(req, res) {
    try {
      let keyname = `matchkes-upcoming-today`;
      let redisdata = await redisjoinTeams.getkeydata(keyname);
      console.log("req.query", req.query);
      // query flags
      const isRecommended = req.query.filter === "recommended";
      const isPopular = req.query.filter === "popular";

      if (redisdata && Array.isArray(redisdata) && redisdata.length > 0) {
        let filterDate = moment().format("YYYY-MM-DD HH:mm:ss");
        let filteredAndSortedMatches = redisdata
          .filter(match => {
            const matchDate = moment(match.time_start).format("YYYY-MM-DD HH:mm:ss");
            return matchDate > filterDate;
          })
          .sort((a, b) => new Date(a.match_order) - new Date(b.match_order));

        // apply query filters
        if (isRecommended) {
          filteredAndSortedMatches = filteredAndSortedMatches.filter(m => m.recommended_status === true);
        } else if (isPopular) {
          filteredAndSortedMatches = filteredAndSortedMatches.filter(m => m.popular_status === true);
        }

        return filteredAndSortedMatches;
      } else {
        let fantasy = "Cricket";
        let matchpipe = [];
        let date = moment().format("YYYY-MM-DD HH:mm:ss");
        let EndDate = moment().add(25, "days").format("YYYY-MM-DD HH:mm:ss");
        const fantasy_type = fantasy;

        matchpipe.push({
          $match: { fantasy_type }
        });
        matchpipe.push({
          $match: {
            $and: [
              { status: "notstarted" },
              { launch_status: "launched" },
              { start_date: { $gt: date } },
              { start_date: { $lt: EndDate } },
            ],
            final_status: { $nin: ["IsCanceled", "IsAbandoned"] },
          },
        });
        matchpipe.push({ $match: { "seriesData.status": "opened" } });

        let today = new Date();
        today.setHours(today.getHours() + 5);
        today.setMinutes(today.getMinutes() + 30);

        matchpipe.push({
          $addFields: {
            date: {
              $dateFromString: {
                dateString: "$start_date",
                timezone: "-00:00",
              },
            },
            curDate: today,
            'series': ["$seriesData"],
            team1: ["$teamA"],
            team2: ["$teamB"],
          },
        });
        matchpipe.push({
          $match: {
            $expr: { $and: [{ $gte: ["$date", today] }] },
          },
        });

        // ✅ Apply filters for recommended or popular
        if (isRecommended) {
          matchpipe.push({ $match: { recommended_status: 1 } });
        } else if (isPopular) {
          matchpipe.push({ $match: { popular_status: 1 } });
        }

        matchpipe.push({
          $project: {
            _id: 0,
            id: "$_id",
            name: 1,
            format: 1,
            notify: 1,
            order_status: 1,
            second_inning_status: 1,
            team1Id: 1,
            team2Id: 1,
            series: { $arrayElemAt: ["$series.seriesId", 0] },
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
            locktime: EndDate,
            createteamnumber: "1",
            status: "true",
            info_center: 1,
            match_order: 1,
            textNote: { $ifNull: ["$textNote", ""] },
            real_matchkey: "$real_matchkey",
            contestType: "$contestType",

            popular_status: "$popular_status",
            recommended_status: "$recommended_status"
          },
        });
        matchpipe.push({
          $lookup: {
            from: "matchcontests",
            localField: "id",
            foreignField: "matchkey",
            pipeline: [
              { $sort: { win_amount: -1 } },
              {
                $match: {
                  "contestCategory.name": {
                    $ne: 'Giveaway Contest'
                  }
                }
              }, { $limit: 1 },
              {
                $project: {
                  win_amount: 1
                }
              }
            ],
            as: "mega"
          },
        });
        matchpipe.push(
          {
            $lookup: {
              from: "matchcontests",
              localField: "id",
              foreignField: "matchkey",
              pipeline: [
                { $sort: { win_amount: -1 } },
                {
                  $match: {
                    "contestCategory.name": {
                      $regex: "Giveaway Contest",
                      $options: "i"
                    }
                  }
                },
                {
                  $addFields: {
                    giveAwayContest: 1
                  }
                },
                {
                  $project: {
                    win_amount: 1,
                    giveAwayContest: 1
                  }
                }
              ],
              as: "giveawaycontestData"
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
        // matchpipe.push({
        //   $addFields: {
        //     WinningpriceAndPrize: {
        //       $getField: {
        //         input: {
        //           $arrayElemAt: [
        //             {
        //               $sortArray: {
        //                 input: "$mega",
        //                 sortBy: {
        //                   win_amount: -1,
        //                 },
        //               },
        //             },
        //             0,
        //           ],
        //         },
        //         field: "WinningpriceAndPrize",
        //       },
        //     },
        //   },
        // });
        matchpipe.push({
          $addFields: {
            mega: {
              $getField: {
                input: {
                  $arrayElemAt: [
                    "$mega",
                    0
                  ]
                },
                field: "win_amount"
              }
            }
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
            WinningpriceAndPrize: ""
          },
        });

        let result = await matchesModel.aggregate(matchpipe);
        if (result.length > 0) {
          for (let match of result) {
            const keyName = `playerList-matchkey-${match.real_matchkey}`;
            let matchPlayersData = await redisjoinTeams.getkeydata(keyName);
            if (!matchPlayersData || matchPlayersData.length <= 0 || matchPlayersData == null) {
              let aggpipe = [];
              aggpipe.push({
                $match: { matchkey: new mongoose.Types.ObjectId(match.id) },
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
                        players_key: 1,
                        captain: 1,
                        teamName: { $arrayElemAt: ["$team.teamName", 0] },
                        teamid: { $arrayElemAt: ["$team._id", 0] },
                        teamColor: { $arrayElemAt: ["$team.teamColor", 0] },
                        logo: { $arrayElemAt: ["$team.logo", 0] },
                        short_name: { $arrayElemAt: ["$team.short_name", 0] },
                      },
                    },
                  ],
                  as: "playerdata",
                },
              });
              let matchPlayerData = await matchPlayersModel.aggregate(aggpipe);
              let playersData = [];
              if (matchPlayerData.length > 0) {
                for (let player of matchPlayerData) {
                  let team = "team1";
                  // console.log(player.playerdata[0].teamid.toString(), team1Id.toString());
                  if (
                    player?.playerdata[0]?.teamid.toString() ===
                    match?.team2Id?.toString()
                  ) {
                    team = "team2";
                  }
                  let matchPlayers = {
                    captain_selection_percentage: player.captain_selection_percentage,
                    credit: player.credit,
                    name: player.name,
                    captain: player.playerdata[0].captain || false,
                    playingstatus: player.playingstatus,
                    points: player.points,
                    role: player.role,
                    totalSelected: player.totalSelected,
                    vice_captain_selection_percentage: Number(
                      player.vice_captain_selection_percentage
                    ),
                    vplaying: player.vplaying,
                    captainSelected: Number(player.captainSelected),
                    vicecaptainSelected: Number(player.vicecaptainSelected),
                    playerid: player.playerid,
                    p_id: player._id,
                    lastMatchPlayed: player.lastMatchPlayed,
                    players_key: Number(player.playerdata[0].players_key),
                    image: (player.playerdata[0].image) ? `${global.constant.IMAGE_URL}${player.playerdata[0].image}` : `${global.constant.IMAGE_URL}avtar1.png`,
                    teamName: player.playerdata[0].teamName,
                    teamid: player.playerdata[0].teamid,
                    teamcolor: player.playerdata[0].teamColor,
                    team_logo: player.playerdata[0].logo,
                    team_short_name: player.playerdata[0].short_name,
                    totalpoints: `${player.fantasy_total_points}`,
                    team: team,
                    player_selection_percentage: 0,
                    isSelectedPlayer: false,
                  };
                  playersData.push(matchPlayers);
                }
                var expRedisTime = await matchTimeDifference(match.id.toString());
                await redisjoinTeams.setkeydata(keyName, playersData, expRedisTime);
              }
              matchPlayersData = playersData;
            }
            const matchplayersid = matchPlayersData.find(
              item =>
                item.teamid?.toString() === match.team1Id?.toString() &&
                item.captain === true
            );
            let capTeam1Image = '';
            if (matchplayersid) {
              capTeam1Image = matchplayersid?.image || '';
            }
            match.capTeam1Image = capTeam1Image;
            const matchplayersid1 = matchPlayersData.find(
              item =>
                item.teamid?.toString() === match.team2Id?.toString() &&
                item.captain === true
            );
            let capTeam2Image = '';
            if (matchplayersid1) {
              capTeam2Image = matchplayersid1?.image || '';
            }
            match.capTeam2Image = capTeam2Image;
          }
          redisjoinTeams.setkeydata(keyname, result, 20 * 24 * 60 * 60);
          return result;
        }
        return [];
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }


  /**
   * @function fetchNewJoinedMatches
   * @description User Joiend latest 5 Upcoming and live match
   * @param { }
   * @author
   */
  async fetchNewJoinedMatches(req) {
    try {
      let fantasy = req.query.fantasy_type || "Cricket";

      let keyname = `matchkes-upcoming-today`;
      let redisdata = await redisjoinTeams.getkeydata(keyname);
      // console.log('redisdata----length>>', redisdata);
      if (!redisdata) {
        return {
          message: "No Data Found1..",
          status: false,
          data: [],
        };
      }

      let filterDate = moment().format("YYYY-MM-DD HH:mm:ss");
      const filteredAndSortedMatches = redisdata
        .filter(match => moment(match.time_start).format("YYYY-MM-DD HH:mm:ss") > filterDate)
        .sort((a, b) => new Date(a.time_start) - new Date(b.time_start));
      // console.log('filteredAndSortedMatches----length>>', filteredAndSortedMatches.length);
      let joinedMatches = [];
      for (let match of filteredAndSortedMatches) {

        let keyUserJoinedChallenge = `match:${match.id}:user:${req.user._id}:joinedContests`;
        let userContest = await Redis.getMatchMyLeaderBoard(keyUserJoinedChallenge, req.user._id, 'contest');

        if (userContest == false && userContest?.length <= 0) {
          // const matchKey = `match:${match.id}:challenges`;
          // const matchAllChallenges = await redisContest.hgetAllData(matchKey);
          // let filteredMatchChallenges = Object.values(matchAllChallenges || {});
          // if (filteredMatchChallenges && filteredMatchChallenges.length <= 0) {
          //   filteredMatchChallenges = await matchContestModel.find({
          //     matchkey: new mongoose.Types.ObjectId(match.id),
          //   });
          // }
          // if (filteredMatchChallenges && filteredMatchChallenges.length > 0) {
          //   await Promise.all(
          //     filteredMatchChallenges.map(async (challenge) => {
          //       const userChallengeCounterKey = `match:${match.id}:challenge:${challenge._id}:user:${req.user._id}:joinedTeams`;
          //       let userTeamCount = await redisjoinTeams.getkeydata(userChallengeCounterKey);
          //       if (userTeamCount > 0) {
          //         let redisUserChallenge = {
          //           _id: `${challenge._id.toString()}`,
          //           getcurrentrank: userTeamCount,
          //           matchkey: match.id,
          //         };
          //         await Redis.storeSortedSet(keyUserJoinedChallenge, redisUserChallenge, 60 * 60 * 24 * 30);
          //       } else {
          //         userTeamCount = await userLeaderBoardModel.find({
          //           matchkey: new mongoose.Types.ObjectId(match.id),
          //           challengeid: new mongoose.Types.ObjectId(challenge._id),
          //           userId: new mongoose.Types.ObjectId(req.user._id)
          //         });
          //         if (userTeamCount > 0) {
          //           let redisUserChallenge = {
          //             _id: `${challenge._id.toString()}`,
          //             getcurrentrank: userTeamCount,
          //             matchkey: match.id,
          //           };
          //           await Redis.storeSortedSet(keyUserJoinedChallenge, redisUserChallenge, 60 * 60 * 24 * 30);
          //         }
          //       }
          //     })
          //   );
          // }
          // userContest = await Redis.getMyLeaderBoard(keyUserJoinedChallenge, req.user._id, "contest");
          return false;
        }
        if (userContest && userContest.length > 0) {
          const redisKey = `match:${match.id}:user:${req.user._id}:teams`;
          let cachedTeams = await redisjoinTeams.getkeydata(redisKey);
          if (userContest && userContest.length > 0) {
            const status = moment(match.start_date).isBefore(moment()) ? "closed" : "opened";

            let data = {
              matchkey: match.id,
              date: match.time_start,
              curDate: moment().format("YYYY-MM-DD HH:mm:ss"),
              matchname: match.name,
              team1ShortName: match.team1name,
              team2ShortName: match.team2name,
              team1fullname: match.teamfullname1,
              team2fullname: match.teamfullname2,
              second_inning_status: match.second_inning_status,
              team1color: "#D5EF8A",
              team2color: "#52A860",
              start_date: match.time_start,
              total_teams: cachedTeams?.length || 1,
              team1logo: match.team1logo,
              team2logo: match.team2logo,
              status: status,
              launch_status: match.launched,
              final_status: match.final_status,
              series_name: match.seriesname,
              type: match.fantasy_type,
              series_id: match.series,
              available_status: 1,
              joinedcontest: userContest.length,
              playing11_status: match.playing11_status,
              textNote: match.textNote,
              real_matchkey: match.real_matchkey,
              contestType: "old",
              mega: match.mega,
              WinningpriceAndPrize: "",
              image: ""
            };

            joinedMatches.push(data);
          }
        }
      }

      if (joinedMatches.length > 0) {
        return {
          message: "User joined latest 5 Upcoming and live match data..",
          status: true,
          data: joinedMatches,
        };
      } else {
        return {
          message: "No Data Found..",
          status: false,
          data: [],
        };
      }
    } catch (error) {
      console.log('error', error);
    }
  }

  async NewJoinedMatches(req) {
    let fantasy;
    if (req.query.fantasy_type) {
      fantasy = req.query.fantasy_type;
    } else {
      fantasy = "Cricket";
    }
    const aggPipe = [];
    aggPipe.push({
      $match: {
        userid: new mongoose.Types.ObjectId(req.user._id),
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
      },
    });
    aggPipe.push({
      $match: {
        $and: [{ "match.final_status": "pending" }],
      },
    });
    aggPipe.push({
      $lookup: {
        from: "userteams",
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
        as: "jointeamsData",
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
    aggPipe.push({
      $unwind: {
        path: "$joinedleauges",
      },
    });
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
      $group: {
        _id: "$matchkey",
        joinedleaugeId: { $first: "$joinedleaugeId" },
        matchkey: { $first: "$matchkey" },
        jointeamid: { $first: "$jointeamid" },
        match: { $first: "$match" },
        jointeamsData: { $first: "$jointeamsData" },
        count: { $sum: 1 },
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
              $gte: ["$date", today],
            },
          ],
        },
      },
    });

    aggPipe.push({
      $sort: {
        date: 1,
      },
    });
    aggPipe.push({
      $project: {
        _id: 0,
        date: 1,
        curDate: 1,
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
        total_teams: { $size: "$jointeamsData" },
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
        playing11_status: { $ifNull: ["$match.playing11_status", 1] },
        textNote: { $ifNull: ["$match.textNote", 1] },
        real_matchkey: { $ifNull: ["$match.real_matchkey", 1] },
        contestType: { $ifNull: ["$match.contestType", 1] },
      }
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
    // console.log('aggPipe', JSON.stringify(aggPipe));
    const JoiendMatches = await userLeagueModel.aggregate(aggPipe);
    // const JoiendMatches = []
    if (JoiendMatches.length > 0) {
      return {
        message: "User Joiend latest 5 Upcoming and live match data..",
        status: true,
        data: JoiendMatches,
      };
    } else {
      return {
        message: "No Data Found..",
        status: false,
        data: [],
      };
    }
  }
  /**
   * @function fetchMatchDetails
   * @description Give matches detailed listing
   * @param { matchkey }
   * @author
   */
  async fetchMatchDetails(req) {
    try {
      const matchPipe = [];
      matchPipe.push({
        $match: { _id: new mongoose.Types.ObjectId(req.params.matchId) },
      });
      matchPipe.push({
        $lookup: {
          from: "matchseries",
          localField: "series",
          foreignField: "_id",
          as: "series",
        },
      });
      matchPipe.push({
        $lookup: {
          from: "teams",
          localField: "team1Id",
          foreignField: "_id",
          as: "team1",
        },
      });
      matchPipe.push({
        $lookup: {
          from: "teams",
          localField: "team2Id",
          foreignField: "_id",
          as: "team2",
        },
      });
      matchPipe.push({
        $project: {
          _id: 0,
          id: "$_id",
          name: 1,
          format: 1,
          order_status: 1,
          series: { $arrayElemAt: ["$series._id", 0] },
          seriesname: { $arrayElemAt: ["$series.name", 0] },
          team1name: { $arrayElemAt: ["$team1.short_name", 0] },
          team2name: { $arrayElemAt: ["$team2.short_name", 0] },
          teamfullname1: { $arrayElemAt: ["$team1.teamName", 0] },
          teamfullname2: { $arrayElemAt: ["$team2.teamName", 0] },
          matchkey: 1,
          type: "$fantasy_type",
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
          time_start: "$start_date",
          matchstatus: {
            $cond: {
              if: { $ne: ["$status", "notstarted"] },
              then: {
                $cond: {
                  if: { $eq: ["$status", "started"] },
                  then: "$status",
                  else: "$final_status",
                },
              },
              else: {
                $cond: {
                  if: {
                    $lte: [
                      "$start_date",
                      moment().format("YYYY-MM-DD HH:mm:ss"),
                    ],
                  },
                  then: "started",
                  else: "notstarted",
                },
              },
            },
          },
          // totalcontest: {
          //     $size: {
          //         $filter: {
          //             input: '$matchchallenges',
          //             as: 'challange',
          //             cond: { $eq: ['$$challange.status', 'opened'] },
          //         },
          //     },
          // },
          launch_status: 1,
        },
      });
      const result = await matchesModel.aggregate(matchPipe);
      if (result.length > 0) {
        return {
          message: "Details of a perticular match",
          status: true,
          data: result,
        };
      } else {
        return {
          message: "Not Able To Find Details of a perticular match.....!",
          status: false,
          data: [],
        };
      }
    } catch (error) {
      throw error;
    }
  }
  async updateTotalPoints(req) {
    try {
      // redis
      let keyname = `listMatchesModel-${req.params.matchId}`;
      let getseries;
      if (!getseries) {
        getseries = await matchesModel.findOne({ _id: req.params.matchId });
      }
      const listMatchSeries = await matchesModel.aggregate(
        [
          {
            $match: { series: getseries.series, status: { $ne: "notstarted" } },
          },
          {
            $group: {
              _id: null,
              matchIds: { $push: "$$ROOT._id" },
            },
          },
        ],
        { _id: 1 }
      );
      return listMatchSeries?.[0]?.matchIds || [];
    } catch (error) {
      throw error;
    }
  }

  /**
   * @function fetchAllPlayers
   * @description  Get Match All Players
   * @param { matchkey }
   * @author
   */

  async fetchAllPlayers(req) {
    try {
      // let keyname = `match:${req.params.matchId}:listmatchData`;
      let keyname = `listMatchesModel-${req.params.matchId}`
      let redisdata = await redisjoinTeams.getkeydata(keyname);
      let listmatchData;
      if (redisdata) {
        listmatchData = redisdata;
      }
      else {
        listmatchData = await matchesModel.findOne({ _id: new mongoose.Types.ObjectId(req.params.matchId) }).lean();
        redisjoinTeams.setkeydata(keyname, listmatchData || {}, 20 * 24 * 60 * 60);
      }
      const keyName = `playerList-matchkey-${listmatchData.real_matchkey}`;
      let matchPlayersData = await redisjoinTeams.getkeydata(keyName);
      if (!matchPlayersData || matchPlayersData.length <= 0 || matchPlayersData == null) {
        let filePath = `matchPlayer/playserList-${matchkey}.json`;
        // matchPlayersData = await getMatchPlayrs(`${filePath}`);
        // if (!matchPlayersData || matchPlayersData?.length == 0) matchPlayersData = await matchPlayersModel.find({ matchkey: matchkey }).lean();
        // var expRedisTime = await matchTimeDifference(matchkey);
        // await redisjoinTeams.setkeydata(keyName, matchPlayersData, expRedisTime);
        if (!matchPlayersData || matchPlayersData?.length == 0) {
          // let matchPlayersData = await matchPlayersModel.find({ matchkey: listmatchData._id }).lean();
          let aggpipe = [];
          aggpipe.push({
            $match: { matchkey: new mongoose.Types.ObjectId(listmatchData._id) },
          });
          aggpipe.push({
            $lookup: {
              from: "players",
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
                    players_key: 1,
                    teamName: { $arrayElemAt: ["$team.teamName", 0] },
                    teamid: { $arrayElemAt: ["$team._id", 0] },
                    teamColor: { $arrayElemAt: ["$team.teamColor", 0] },
                    logo: { $arrayElemAt: ["$team.logo", 0] },
                    short_name: { $arrayElemAt: ["$team.short_name", 0] },
                  },
                },
              ],
              as: "playerdata",
            },
          });
          let matchPlayerData = await matchPlayersModel.aggregate(aggpipe);
          let playersData = [];
          if (matchPlayerData.length > 0) {
            for (let player of matchPlayerData) {
              let team = "team1";
              // console.log(player.playerdata[0].teamid.toString(), team1Id.toString());
              if (
                player?.playerdata[0]?.teamid.toString() ===
                listmatchData?.team2Id?.toString()
              ) {
                team = "team2";
              }
              let matchPlayers = {
                captain_selection_percentage: player.captain_selection_percentage,
                credit: player.credit,
                name: player.name,
                playingstatus: player.playingstatus,
                points: player.points,
                role: player.role,
                totalSelected: player.totalSelected,
                vice_captain_selection_percentage: Number(
                  player.vice_captain_selection_percentage
                ),
                vplaying: player.vplaying,
                captainSelected: Number(player.captainSelected),
                vicecaptainSelected: Number(player.vicecaptainSelected),
                playerid: player.playerid,
                p_id: player._id,
                lastMatchPlayed: player.lastMatchPlayed,
                players_key: Number(player.playerdata[0].players_key),
                image: `${global.constant.IMAGE_URL}avtar1.png`,
                teamName: player.playerdata[0].teamName,
                teamid: player.playerdata[0].teamid,
                teamcolor: player.playerdata[0].teamColor,
                team_logo: player.playerdata[0].logo,
                team_short_name: player.playerdata[0].short_name,
                totalpoints: `${player.fantasy_total_points}`,
                team: team,
                player_selection_percentage: 0,
                isSelectedPlayer: false,
              };
              playersData.push(matchPlayers);
            }
            var expRedisTime = await matchTimeDifference(req.params.matchId);
            await redisjoinTeams.setkeydata(keyName, playersData, expRedisTime);
          }
          matchPlayersData = playersData;
        }
      }
      if (matchPlayersData && matchPlayersData.length > 0) {
        return {
          message: "Players List By Match",
          status: true,
          data: matchPlayersData,
          sport_category: {
            id: 2,
            name: "T20",
            max_players: 11,
            max_credits: 100,
            min_players_per_team: 1,
            icon: "",
            category: "cricket",
            player_positions: [
              {
                id: 9,
                sport_category_id: 2,
                name: "WK",
                full_name: "Wicket-Keepers",
                code: "keeper",
                icon: "img/wk.png",
                min_players_per_team: 1,
                max_players_per_team: 8,
              },
              {
                id: 10,
                sport_category_id: 2,
                name: "BAT",
                full_name: "Batsmen",
                code: "batsman",
                icon: "img/bat.png",
                min_players_per_team: 1,
                max_players_per_team: 8,
              },
              {
                id: 11,
                sport_category_id: 2,
                name: "ALL",
                full_name: "All-Rounders",
                code: "allrounder",
                icon: "img/all.png",
                min_players_per_team: 1,
                max_players_per_team: 8,
              },
              {
                id: 12,
                sport_category_id: 2,
                name: "BWL",
                full_name: "Bowlers",
                code: "bowler",
                icon: "img/bowler.png",
                min_players_per_team: 1,
                max_players_per_team: 8,
              },
            ],
          },
        };
      }
      let playerPipe = [];
      playerPipe.push({
        $match: { matchkey: new mongoose.Types.ObjectId(req.params.matchId) },
      });
      playerPipe.push({
        $lookup: {
          from: "teamplayers",
          localField: "playerid",
          foreignField: "_id",
          as: "playersData",
        },
      });
      playerPipe.push({
        $lookup: {
          from: "matches",
          localField: "matchkey",
          foreignField: "_id",
          as: "listmatches",
        },
      });
      playerPipe.push({
        $unwind: { path: "$playersData" },
      });
      playerPipe.push({
        $unwind: { path: "$listmatches" },
      });
      playerPipe.push({
        $lookup: {
          from: "teams",
          localField: "playersData.team",
          foreignField: "_id",
          as: "team",
        },
      });
      playerPipe.push({
        $lookup: {
          from: "seriesplayerpoints",
          let: {
            playerId: "$playersData._id",
            seriesKey: "$listmatches.series"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$playerId", "$$playerId"] },
                    { $eq: ["$seriesId", "$$seriesKey"] }
                  ]
                }
              }
            },
            {
              $addFields: {
                totalMatchPoints: {
                  $reduce: {
                    input: { $objectToArray: "$matchPoints" },
                    initialValue: 0,
                    in: { $add: ["$$value", "$$this.v"] }
                  }
                }
              }
            }
          ],
          as: "seriesplayerpoint"
        },
      });
      playerPipe.push({
        $addFields: {
          seriesplayerpoint: { $arrayElemAt: ["$seriesplayerpoint", 0] },
        },
      });
      playerPipe.push({
        $addFields: {
          seriesplayerpoint: {
            $ifNull: ["$seriesplayerpoint", {}], // Ensure empty object if no data
          },
        },
      });
      playerPipe.push({
        $addFields: {
          lastMatchPlayed: false,
          captainSelected: 0,
          vicecaptainSelected: 0,
        },
      });
      playerPipe.push({
        $project: {
          _id: 0,
          playerid: "$playerid",
          p_id: "$_id",
          points: 1,
          role: 1,
          credit: 1,
          name: 1,
          playingstatus: 1,
          seriesplayerpoint: "$seriesplayerpoint",
          vplaying: 1,
          lastMatchPlayed: "$lastMatchPlayed",
          players_key: { $toInt: "$playersData.players_key" },
          image: {
            $ifNull: [
              {
                $cond: {
                  if: {
                    $or: [
                      { $eq: [{ $substr: ["$playersData.image", 0, 1] }, "/"] },
                      { $eq: [{ $substr: ["$playersData.image", 0, 1] }, "p"] },
                    ],
                  },
                  then: {
                    $concat: [`${global.constant.IMAGE_URL}`, "", "$playersData.image"],
                  },
                  else: {
                    $cond: {
                      if: { $eq: ["$playersData.image", ""] },
                      then: {
                        $cond: {
                          if: {
                            $eq: ["$playersData.team", "$listmatches.team1Id"],
                          },
                          then: `${global.constant.IMAGE_URL}white_team1.png`,
                          else: {
                            $cond: {
                              if: {
                                $eq: [
                                  "$playersData.team",
                                  "$listmatches.team2Id",
                                ],
                              },
                              then: `${global.constant.IMAGE_URL}black_team1.png`,
                              else: `${global.constant.IMAGE_URL}black_team1.png`,
                            },
                          },
                        },
                      },
                      else: "$playersData.image",
                    },
                  },
                },
              },
              `${global.constant.IMAGE_URL}black_team1.png`,
            ],
          },
          teamName: { $arrayElemAt: ["$team.teamName", 0] },
          teamid: { $arrayElemAt: ["$team._id", 0] },
          teamcolor: {
            $ifNull: [
              { $arrayElemAt: ["$team.color", 0] },
              global.constant.TEAM_DEFAULT_COLOR.DEF1,
            ],
          },
          team_logo: {
            $ifNull: [
              {
                $cond: {
                  if: {
                    $or: [
                      {
                        $eq: [
                          {
                            $substr: [
                              { $arrayElemAt: ["$team.logo", 0] },
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
                              { $arrayElemAt: ["$team.logo", 0] },
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
                      { $arrayElemAt: ["$team.logo", 0] },
                    ],
                  },
                  else: { $arrayElemAt: ["$team.logo", 0] },
                },
              },
              `${global.constant.IMAGE_URL}team_image.png`,
            ],
          },
          team_short_name: { $arrayElemAt: ["$team.short_name", 0] },
          totalpoints: "0",
          team: {
            $cond: {
              if: { $eq: ["$playersData.team", "$listmatches.team1Id"] },
              then: "team1",
              else: {
                $cond: {
                  if: { $eq: ["$playersData.team", "$listmatches.team2Id"] },
                  then: "team2",
                  else: "",
                },
              },
            },
          },
          totalSelected: 1,
          vicecaptainSelected: 1,
          captainSelected: 1,
          captain_selection_percentage: 1,
          vice_captain_selection_percentage: 1,
          totalpoints: "$fantasy_total_points"
        },
      });
      playerPipe.push({
        $addFields: {
          player_selection_percentage: "$totalSelected",
          captain_selection_percentage: "$captain_selection_percentage",
          vice_captain_selection_percentage:
            "$vice_captain_selection_percentage",
        },
      });
      let [data] = await Promise.all([
        matchPlayersModel.aggregate(playerPipe)
      ]);
      let getTeam;
      if (req.query?.teamId) {
        getTeam = await userTeamModel.findOne({ _id: req.query.teamId });
      }
      let myArray = [];
      let i = 0;
      let ttlCridit = 0;
      if (data.length > 0) {
        for await (let pkey of data) {
          pkey.isSelectedPlayer = false;

          if (getTeam) {
            if (getTeam.players.includes(pkey.playerid.toString())) {
              pkey.isSelectedPlayer = true;
              ttlCridit = ttlCridit + pkey.credit;
            }
          }
          pkey.totalpoints = pkey.fantasy_total_points.toString();
          pkey.players_key = Number(pkey.players_key);
          pkey.points = Number(pkey.seriesplayerpoint?.totalMatchPoints || 0);
          myArray.push(pkey);
          i++;
          if (i == data.length) {

            const lastmatchplayerdata = await matchesModel.aggregate([
              {
                $match: {
                  _id: new mongoose.Types.ObjectId(req.params.matchId),
                },
              },
              {
                $lookup: {
                  from: "matchplayers",
                  localField: "_id",
                  foreignField: "matchkey",
                  pipeline: [
                    {
                      $match: {
                        playingstatus: 1,
                      },
                    },
                    {
                      $group: {
                        _id: "$playerid",
                        fieldN: {
                          $push: "$$ROOT",
                        },
                      },
                    },
                  ],
                  as: "players",
                },
              },
              {
                $unwind: {
                  path: "$players",
                  includeArrayIndex: "string",
                },
              },
              {
                $addFields: {
                  players: {
                    $arrayElemAt: ["$players.fieldN", 0],
                  },
                },
              },
              {
                $addFields: {
                  start_date: {
                    $toDate: "$start_date",
                  },
                },
              },
              {
                $lookup: {
                  from: "matches",
                  localField: "team1Id",
                  foreignField: "team1Id",
                  let: {
                    date: "$start_date",
                  },
                  pipeline: [
                    {
                      $addFields: {
                        start_date: {
                          $toDate: "$start_date",
                        },
                      },
                    },
                    {
                      $match: {
                        $expr: {
                          $lt: ["$start_date", "$$date"],
                        },
                      },
                    },
                    {
                      $sort: {
                        start_date: -1,
                      },
                    },
                    {
                      $limit: 1,
                    },
                    {
                      $lookup: {
                        from: "matchplayers",
                        localField: "_id",
                        foreignField: "matchkey",
                        pipeline: [
                          {
                            $match: {
                              playingstatus: 1,
                            },
                          },
                          {
                            $group: {
                              _id: null,
                              fieldN: {
                                $addToSet: "$playerid",
                              },
                            },
                          },
                        ],
                        as: "players",
                      },
                    },
                    {
                      $addFields: {
                        players: {
                          $arrayElemAt: ["$players.fieldN", 0],
                        },
                      },
                    },
                  ],
                  as: "team1Iddata",
                },
              },
              {
                $lookup: {
                  from: "matches",
                  localField: "team2Id",
                  foreignField: "team2Id",
                  let: {
                    date: "$start_date",
                  },
                  pipeline: [
                    {
                      $addFields: {
                        start_date: {
                          $toDate: "$start_date",
                        },
                      },
                    },
                    {
                      $match: {
                        $expr: {
                          $lt: ["$start_date", "$$date"],
                        },
                      },
                    },
                    {
                      $sort: {
                        start_date: -1,
                      },
                    },
                    {
                      $limit: 1,
                    },
                    {
                      $lookup: {
                        from: "matchplayers",
                        localField: "_id",
                        foreignField: "matchkey",
                        pipeline: [
                          {
                            $match: {
                              playingstatus: 1,
                            },
                          },
                          {
                            $group: {
                              _id: null,
                              fieldN: {
                                $addToSet: "$playerid",
                              },
                            },
                          },
                        ],
                        as: "players",
                      },
                    },
                    {
                      $addFields: {
                        players: {
                          $arrayElemAt: ["$players.fieldN", 0],
                        },
                      },
                    },
                  ],
                  as: "team2Iddata",
                },
              },
              {
                $addFields: {
                  previcePlar: {
                    $concatArrays: [
                      {
                        $arrayElemAt: ["$team1Iddata.players", 0],
                      },
                      {
                        $arrayElemAt: ["$team2Iddata.players", 0],
                      },
                    ],
                  },
                },
              },
              {
                $sort: {
                  start_date: 1,
                },
              },
              {
                $project: {
                  oldplayersid: "$players._id",
                  _id: 0,
                },
              },
            ]);
            for (const iterator1 of lastmatchplayerdata) {
              for (const myArray11 of myArray) {
                if (
                  iterator1.oldplayersid.toString() == myArray11.p_id.toString()
                ) {
                  myArray11.lastMatchPlayed = true;
                }
              }
            }

            return {
              message: "Players List By Match",
              status: true,
              data: myArray,
              ttlCridit: ttlCridit,
              // sport_category: {
              //   id: 2,
              //   name: "T20",
              //   max_players: 11,
              //   max_credits: 100,
              //   min_players_per_team: 1,
              //   icon: "",
              //   category: "cricket",
              //   player_positions: [
              //     {
              //       id: 9,
              //       sport_category_id: 2,
              //       name: "WK",
              //       full_name: "Wicket-Keepers",
              //       code: "keeper",
              //       icon: "img/wk.png",
              //       min_players_per_team: 1,
              //       max_players_per_team: 8,
              //     },
              //     {
              //       id: 10,
              //       sport_category_id: 2,
              //       name: "BAT",
              //       full_name: "Batsmen",
              //       code: "batsman",
              //       icon: "img/bat.png",
              //       min_players_per_team: 1,
              //       max_players_per_team: 8,
              //     },
              //     {
              //       id: 11,
              //       sport_category_id: 2,
              //       name: "ALL",
              //       full_name: "All-Rounders",
              //       code: "allrounder",
              //       icon: "img/all.png",
              //       min_players_per_team: 1,
              //       max_players_per_team: 8,
              //     },
              //     {
              //       id: 12,
              //       sport_category_id: 2,
              //       name: "BWL",
              //       full_name: "Bowlers",
              //       code: "bowler",
              //       icon: "img/bowler.png",
              //       min_players_per_team: 1,
              //       max_players_per_team: 8,
              //     },
              //   ],
              // },
            };
          }
        }
      } else {
        return {
          message: "Players List Not available By Match",
          status: false,
          data: [],
        };
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }



  async fetchAllPlayerspot(req) {
    try {
      // await updatePlayersCount(req);
      let playerPipe = [];
      playerPipe.push({
        $match: { matchkey: new mongoose.Types.ObjectId(req.params.matchId) },
      });
      playerPipe.push({
        $lookup: {
          from: "teamplayers",
          localField: "playerid",
          foreignField: "_id",
          as: "playersData",
        },
      });
      playerPipe.push({
        $lookup: {
          from: "matches",
          localField: "matchkey",
          foreignField: "_id",
          as: "listmatches",
        },
      });
      playerPipe.push({
        $unwind: { path: "$playersData" },
      });
      playerPipe.push({
        $unwind: { path: "$listmatches" },
      });
      playerPipe.push({
        $lookup: {
          from: "teams",
          localField: "playersData.team",
          foreignField: "_id",
          as: "team",
        },
      });
      playerPipe.push({
        $project: {
          _id: 0,
          // id: '$_id',
          playerid: "$playerid", //'$_id'
          p_id: "$_id", //'$playerid'
          points: 1,
          role: 1,
          credit: 1,
          name: 1,
          playingstatus: 1,
          vplaying: 1,
          players_key: "$playersData.players_key",
          image: {
            $ifNull: [
              {
                $cond: {
                  if: {
                    $or: [
                      { $eq: [{ $substr: ["$playersData.image", 0, 1] }, "/"] },
                      { $eq: [{ $substr: ["$playersData.image", 0, 1] }, "p"] },
                    ],
                  },
                  then: {
                    $concat: [`${global.constant.IMAGE_URL}`, "", "$playersData.image"],
                  },
                  else: {
                    $cond: {
                      if: { $eq: ["$playersData.image", ""] },
                      then: {
                        $cond: {
                          if: {
                            $eq: ["$playersData.team", "$listmatches.team1Id"],
                          },
                          then: `${global.constant.IMAGE_URL}white_team1.png`,
                          else: {
                            $cond: {
                              if: {
                                $eq: [
                                  "$playersData.team",
                                  "$listmatches.team2Id",
                                ],
                              },
                              then: `${global.constant.IMAGE_URL}black_team1.png`,
                              else: `${global.constant.IMAGE_URL}black_team1.png`,
                            },
                          },
                        },
                      },
                      else: "$playersData.image",
                    },
                  },
                },
              },
              `${global.constant.IMAGE_URL}black_team1.png`,
            ],
          },
          teamName: { $arrayElemAt: ["$team.teamName", 0] },
          teamcolor: {
            $ifNull: [
              { $arrayElemAt: ["$team.color", 0] },
              global.constant.TEAM_DEFAULT_COLOR.DEF1,
            ],
          },
          team_logo: {
            $ifNull: [
              {
                $cond: {
                  if: {
                    $or: [
                      {
                        $eq: [
                          {
                            $substr: [
                              { $arrayElemAt: ["$team.logo", 0] },
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
                              { $arrayElemAt: ["$team.logo", 0] },
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
                      { $arrayElemAt: ["$team.logo", 0] },
                    ],
                  },
                  else: { $arrayElemAt: ["$team.logo", 0] },
                },
              },
              `${global.constant.IMAGE_URL}team_image.png`,
            ],
          },
          team_short_name: { $arrayElemAt: ["$team.short_name", 0] },
          totalpoints: "0",
          team: {
            $cond: {
              if: { $eq: ["$playersData.team", "$listmatches.team1Id"] },
              then: "team1",
              else: {
                $cond: {
                  if: { $eq: ["$playersData.team", "$listmatches.team2Id"] },
                  then: "team2",
                  else: "",
                },
              },
            },
          },
          totalSelected: 1,
          vicecaptainSelected: 1,
          captainSelected: 1,
        },
      });
      playerPipe.push({
        $addFields: {
          player_selection_percentage: "$totalSelected",
          captain_selection_percentage: "$captainSelected",
          vice_captain_selection_percentage: "$vicecaptainSelected",
        },
      });

      let [data, totalteam, listMatchSeries] = await Promise.all([
        matchPlayersModel.aggregate(playerPipe),
        userTeamModel.countDocuments({ matchkey: req.params.matchId }),
        this.updateTotalPoints(req),
      ]);
      //console.log("data",data,"listMatchSeries",listMatchSeries);
      let myArray = {
        batsman: [],
        bowler: [],
        allrounder: [],
        keeper: [],
      };
      let i = 0;
      // last player

      // let last_matches_of_teams=await matchesModel.aggregate([
      //     {
      //       '$match': {
      //         '_id': new mongoose.Types.ObjectId(req.params.matchId)
      //       }
      //     }, {
      //       '$lookup': {
      //         'from': 'listmatches',
      //         'let': {
      //           't1': '$team1Id',
      //           't2': '$team2Id'
      //         },
      //         'pipeline': [
      //           {
      //             '$match': {
      //               '$expr': {
      //                 '$or': [
      //                   {
      //                     '$eq': [
      //                       '$team1Id', '$$t1'
      //                     ]
      //                   }, {
      //                     '$eq': [
      //                       '$team2Id', '$$t1'
      //                     ]
      //                   }
      //                 ]
      //               },
      //               'status': 'completed'
      //             }
      //           }, {
      //             '$sort': {
      //               'start_date': -1
      //             }
      //           }
      //         ],
      //         'as': 'result'
      //       }
      //     }, {
      //       '$lookup': {
      //         'from': 'listmatches',
      //         'let': {
      //           't1': '$team1Id',
      //           't2': '$team2Id'
      //         },
      //         'pipeline': [
      //           {
      //             '$match': {
      //               '$expr': {
      //                 '$or': [
      //                   {
      //                     '$eq': [
      //                       '$team1Id', '$$t2'
      //                     ]
      //                   }, {
      //                     '$eq': [
      //                       '$team2Id', '$$t2'
      //                     ]
      //                   }
      //                 ]
      //               },
      //               'status': 'completed'
      //             }
      //           }, {
      //             '$sort': {
      //               'start_date': -1
      //             }
      //           }
      //         ],
      //         'as': 'result2'
      //       }
      //     }
      //   ])
      //             const matchId = new mongoose.Types.ObjectId(req.params.matchId);

      // const pipeline = [
      //   {
      //     $match: { _id: matchId }
      //   },
      //   {
      //     $lookup: {
      //       from: "listmatches",
      //       let: { t1: "$team1Id", t2: "$team2Id" },
      //       pipeline: [
      //         {
      //           $match: {
      //             $expr: {
      //               $or: [
      //                 { $eq: ["$team1Id", "$$t1"] },
      //                 { $eq: ["$team2Id", "$$t1"] }
      //               ]
      //             },
      //             status: "completed",
      //             _id: { $ne: matchId }
      //           }
      //         },
      //         { $sort: { start_date: -1 } },
      //         { $limit: 1 }
      //       ],
      //       as: "result"
      //     }
      //   },
      //   {
      //     $lookup: {
      //       from: "listmatches",
      //       let: { t1: "$team1Id", t2: "$team2Id" },
      //       pipeline: [
      //         {
      //           $match: {
      //             $expr: {
      //               $or: [
      //                 { $eq: ["$team1Id", "$$t2"] },
      //                 { $eq: ["$team2Id", "$$t2"] }
      //               ]
      //             },
      //             status: "completed",
      //             _id: { $ne: matchId }
      //           }
      //         },
      //         { $sort: { start_date: -1 } },
      //         { $limit: 1 }
      //       ],
      //       as: "result2"
      //     }
      //   }
      // ];

      // const last_matches_of_teams = await matchesModel.aggregate(pipeline);

      // const play = [];
      // const team1lastmatch = last_matches_of_teams[0].result[0]._id;
      // const team2lastmatch = last_matches_of_teams[0].result2[0]._id;

      // const lastteam1players = await matchPlayersModel.find({ matchkey: team1lastmatch, playingstatus: 1 });
      // const lastteam2players = await matchPlayersModel.find({ matchkey: team2lastmatch, playingstatus: 1 });
      // const teamplayers = await matchPlayersModel.find({ matchkey: req.params.matchId });

      // teamplayers.forEach((newteamplayer) => {
      //   let sign = 0;
      //   const lastteamplayers = [...lastteam1players, ...lastteam2players];
      //   lastteamplayers.forEach((lastteamplayer) => {
      //     if (newteamplayer.playerid.toString() === lastteamplayer.playerid.toString()) {
      //       sign = lastteam1players.includes(lastteamplayer) ? 1 : 2;
      //       play.push({ playerid: newteamplayer.playerid, lastplaystatus: 1 });
      //     }
      //   });
      //   if (sign !== 1 && sign !== 2) {
      //     play.push({ playerid: newteamplayer.playerid, lastplaystatus: 0 });
      //   }
      // });

      //       let play=[]
      //       let team1lastmatch=last_matches_of_teams[0].result[0]._id;
      //       let team2lastmatch=last_matches_of_teams[0].result2[0]._id;
      //      // console.log("team1lastmatch",team1lastmatch)

      //   let lastteam1players= await matchPlayersModel.find({matchkey:team1lastmatch,playingstatus:1})
      //  let lastteam2players=  await matchPlayersModel.find({matchkey:team2lastmatch,playingstatus:1})
      //  let teamplayers=await  matchPlayersModel.find({matchkey:req.params.matchId})
      //  let sign=0;
      //console.log("lastteam1players",lastteam1players)
      //console.log("lastteam1players",lastteam2players)
      //console.log("64135c274ad09b0822a3e533     match=642a340abb5a72b5bc827536lastteam1players",lastteam1players,"lastteam2players",lastteam1players,"teamplayers",teamplayers)
      //  for(let newteamplayer of teamplayers)
      //  {
      //     for(let lastteam1player of lastteam1players)
      //     {if(newteamplayer.playerid.toString()=="64135c274ad09b0822a3e547"){
      //         console.log("newteamplayer.playerid",newteamplayer.playerid,"lastteam1player.playerid",lastteam1player.playerid,newteamplayer.playerid.toString()==lastteam1player.playerid.toString())
      //     }
      //         if(newteamplayer.playerid.toString()==lastteam1player.playerid.toString())
      //         {//console.log("newteamplayer.playerid",newteamplayer.playerid)
      //             sign=1;
      //             play.push({playerid:newteamplayer.playerid,lastplaystatus:1})
      //             //console.log("play",play)

      //        }

      //     }
      //     for(let lastteam2player of lastteam2players)
      //     {if(newteamplayer.playerid.toString()==lastteam2player.playerid.toString())
      //         {sign=2;
      //             play.push({playerid:newteamplayer.playerid,lastplaystatus:1})

      //        }

      //     }
      //     if(sign!=1&&sign!=2)
      //        {
      //         play.push({playerid:newteamplayer.playerid,lastplaystatus:0})
      //        }
      //        sign=0;

      //  }
      //let signts=0
      //  for(let newteamplayer of teamplayers)
      //  {
      //     for(let lastteam2player of lastteam2players)
      //     {if(newteamplayer.playerid.toString()==lastteam2player.playerid.toString())
      //         {signts=1;
      //             play.push({playerid:newteamplayer.playerid,lastplaystatus:1})

      //        }

      //     }
      //     if(signts!=1)
      //        {
      //         play.push({playerid:newteamplayer.playerid,lastplaystatus:0})
      //        }
      //        signts=0;

      //  }
      let sk = 0;

      //  last player end
      if (data.length > 0) {
        for await (const pkey of data) {
          // const player = play.find(p => p.playerid.toString() === pkey.playerid.toString());
          // if (player) {
          //   pkey.lastmatchplayer = player.lastplaystatus;
          // }
          // for await(let dataa of play)
          // {
          //     if(dataa.playerid.toString()==pkey.playerid.toString())
          //     {
          //         pkey.lastmatchplayer = dataa.lastplaystatus;
          //     }
          // }

          // if (pkey.totalSelected != 0) { pkey.player_selection_percentage = Number(pkey.totalSelected); }
          // { pkey.captain_selection_percentage = Number(pkey.captainSelected); }
          // { pkey.vice_captain_selection_percentage = Number(pkey.vicecaptainSelected); }
          // { pkey.totalSelected = Number(pkey.totalSelected); }
          // { pkey.captainSelected = Number(pkey.captainSelected); }
          // { pkey.vicecaptainSelected = Number(pkey.vicecaptainSelected); }

          if (listMatchSeries.length > 0) {
            // redis
            let getPoints = [];
            for (let matchkey of listMatchSeries) {
              let keyname = `matchkey-${matchkey}-playerid-${pkey.playerid}`;
              let redisdata = await redisjoinTeams.getkeydata(keyname);

              if (redisdata) {
                getPoints.push(redisdata);
              } else {
                getPoints = await matchPlayersModel.find(
                  {
                    matchkey: { $in: listMatchSeries },
                    playerid: pkey.playerid,
                  },
                  { points: 1 }
                );
                //let redisdata=redisjoinTeams.setkeydata(keyname,getPoints,60*60*4);
                break;
              }
            }
            // redis end
            //comment for redis-->const getPoints = await matchPlayersModel.find({ matchkey: { $in: listMatchSeries }, playerid: pkey.playerid }, { points: 1 });
            if ((getPoints || []).length > 0) {
              getPoints.forEach((ele) => {
                pkey.totalpoints =
                  Number(pkey?.totalpoints || 0) + Number(ele?.points || 0);
              });
            }
            // redis
            let dataaa = [];
            for (let matchkey of listMatchSeries) {
              let keyname = `matchkey-${matchkey}-playerid-${pkey.playerid}`;
              let redisdata = await redisjoinTeams.getkeydata(keyname);

              if (redisdata) {
                dataaa.push(redisdata);
              } else {
                dataaa = await matchPlayersModel
                  .find({
                    matchkey: { $in: listMatchSeries },
                    playerid: pkey.playerid,
                  })
                  .sort({ createdAt: -1 })
                  .limit(1);
                //let redisdata=redisjoinTeamssetkeydata(keyname,getPoints,60*60*4);
                break;
              }
            }
            // redis end
            //cooment for redis--> const dataaa=await matchPlayersModel.find({  matchkey: { $in: listMatchSeries },playerid: pkey.playerid }).sort({createdAt:-1}).limit(1);
            //console.log("dataaa",dataaa)
            if (dataaa.length > 0) {
              if (dataaa[0]?.playingstatus == 1) {
                //console.log("datapre",data)
                // sk=1
                pkey.lasthplayer = 1;
              } else if (dataaa[0]?.playingstatus == 0) {
                //console.log("elseifdataaa------->",dataaa[0].matchkey,"dataaa[0]?.playingstatus",dataaa[0]?.playingstatus)
                pkey.lasthplayer = 0;
              } else {
                //console.log("dataaa------->",dataaa[0].matchkey,"dataaa[0]?.playingstatus",dataaa[0]?.playingstatus)
                pkey.lasthplayer = 0;
              }
            }
          }
          //console.log("datapost",data)

          // if(pkey.role=="batsman"){myArray["batsman"].push(pkey);}
          // else if(pkey.role=="allrounder"){myArray["allrounder"].push(pkey);}
          // else if(pkey.role=="bowler"){myArray["bowler"].push(pkey);}
          // else{myArray["keeper"].push(pkey);}
          switch (pkey.role) {
            case "batsman":
              myArray.batsman.push(pkey);
              break;
            case "allrounder":
              myArray.allrounder.push(pkey);
              break;
            case "bowler":
              myArray.bowler.push(pkey);
              break;
            default:
              myArray.keeper.push(pkey);
              break;
          }

          i++;
          if (i == data.length) {
            return {
              message: "Players List By Match",
              status: true,
              data: myArray,
              //  play:play
            };
          }
        }
      } else {
        return {
          message: "Players List Not available By Match",
          status: false,
          data: [],
        };
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }


  /**
   * @function fetchPlayerInfo
   * @description  Get a player Information
   * @param { matchkey,playerid }
   * @author
   */
  async fetchPlayerInfo(req) {
    try {
      // let playerPipe = []
      // if(req.query.playerid){
      //     playerPipe.push({
      //         $match: { _id: new mongoose.Types.ObjectId(req.query.playerid) }
      //     },);
      // }
      // if (req.query.playerid) {
      //     playerPipe.push({
      //         $match: { playerid: new mongoose.Types.ObjectId(req.query.playerid) }
      //     });
      // }
      // if (req.query.matchkey) {
      //     playerPipe.push({
      //         $match: { matchkey: new mongoose.Types.ObjectId(req.query.matchkey) }
      //     });
      // }

      // playerPipe.push({
      //     $lookup: {
      //         from: 'listmatches',
      //         localField: 'matchkey',
      //         foreignField: '_id',
      //         as: 'listmatches'
      //     }
      // });
      // playerPipe.push({
      //     $unwind: {
      //         path: "$listmatches",
      //     }
      // })
      // playerPipe.push({
      //     $lookup: {
      //         from: 'listmatches',
      //         localField: 'listmatches.series',
      //         foreignField: 'series',
      //         as: 'allMatches'
      //     }
      // });
      // playerPipe.push({
      //     $lookup: {
      //         from: 'players',
      //         localField: 'playerid',
      //         foreignField: '_id',
      //         as: 'playersData'
      //     }
      // });
      // playerPipe.push({
      //     $unwind: { path: "$playersData" }
      // });
      // playerPipe.push({
      //     $lookup: {
      //         from: 'teams',
      //         localField: 'playersData.team',
      //         foreignField: '_id',
      //         as: 'team'
      //     }
      // });
      // playerPipe.push({
      //     $unwind: { path: "$team" }
      // });
      // playerPipe.push({
      //     $project: {
      //         _id: 0,
      //         playerid: '$playerid',
      //         matchPlayerId: '$_id',
      //         playerpoints: '$playersData.points',
      //         playername: '$name',
      //         playercredit: '$credit',
      //         battingstyle: '$playersData.battingstyle',
      //         bowlingstyle: '$playersData.bowlingstyle',
      //         playercountry: '$playersData.country',
      //         playerdob: '$playersData.dob',
      //         team: '$team.teamName',
      //         teamShort_name: '$team.short_name',
      //         playerimage: {
      //             $ifNull: [{
      //                 $cond: {
      //                     if: { $or: [{ $eq: [{ $substr: ['$playersData.image', 0, 1] }, '/'] }, { $eq: [{ $substr: ['$playersData.image', 0, 1] }, 'p'] }] },
      //                     then: { $concat: [`${global.constant.IMAGE_URL}`, '', '$playersData.image'] },
      //                     else: {
      //                         $cond: {
      //                             if: { $eq: ['$playersData.image', ''] },
      //                             then: {
      //                                 $cond: {
      //                                     if: { $eq: ['$playersData.team', '$listmatches.team1Id'] },
      //                                     then: `${global.constant.IMAGE_URL}black_team1.png`,
      //                                     else: {
      //                                         $cond: {
      //                                             if: { $eq: ['$playersData.team', '$listmatches.team2Id'] },
      //                                             then: `${global.constant.IMAGE_URL}white_team1.png`,
      //                                             else: `${global.constant.IMAGE_URL}white_team1.png`
      //                                         }
      //                                     }
      //                                 }
      //                             },
      //                             else: '$playersData.image'
      //                         }
      //                     }
      //                 }
      //             }, `${global.constant.IMAGE_URL}player.png`]
      //         },
      //         playerrole: '$role',
      //         matches: '$allMatches'

      //     }
      // })
      // let point = "0";

      // let data = await matchPlayersModel.aggregate(playerPipe);
      // // console.log('data',data);
      // if (data.length > 0) {
      //     if (data[0].matches.length > 0) {
      //         let temparr = [];
      //         for (let memb of data[0].matches) {
      //             // redis
      //             let keyname = `matchkey-${memb._id}-playerid-${data[0].playerid}`
      //             let redisdata = await redisjoinTeams.getkeydata(keyname);
      //             let resData;
      //             if (redisdata) {
      //                 resData = redisdata;
      //             }
      //             else {
      //                 resData = await matchPlayersModel.findOne({ matchkey: new mongoose.Types.ObjectId(memb._id), playerid: new mongoose.Types.ObjectId(data[0].playerid) });
      //                 let redisdata = redisjoinTeams.setkeydata(keyname, resData, 60 * 60 * 4);
      //             }

      //             // redis end
      //             //comment for redis--> let resData = await matchPlayersModel.findOne({ matchkey: new mongoose.Types.ObjectId(memb._id), playerid: new mongoose.Types.ObjectId(data[0].playerid) });
      //             if (moment(moment().format("YYYY-MM-DD HH:mm:ss")).isAfter(memb.start_date)) {
      //                 if (resData) {
      //                     let tempObj = {}
      //                     tempObj.total_points = `${0}`;
      //                     point += resData.points;
      //                     tempObj.total_points = `${resData.points}`;
      //                     tempObj.matchdate = moment(memb.start_date).format("DD MMMM, YYYY");
      //                     tempObj.selectper = `${resData.totalSelected}%`;
      //                     tempObj.playerid = data[0].playerid;
      //                     tempObj.name = memb.name;
      //                     tempObj.short_name = memb.short_name;
      //                     temparr.push(tempObj);
      //                     data[0].playerpoints = `${point}`;
      //                 }
      //             }
      //         }
      //         data[0].matches = temparr;
      //         return {
      //             message: 'Player Info',
      //             status: true,
      //             data: data[0]
      //         }
      //     } else {
      //         return {
      //             message: 'Player Info without matches',
      //             status: true,
      //             data: data[0]
      //         }
      //     }
      // } else {
      //     return {
      //         message: 'Player Info Not Found',
      //         status: false,
      //         data: {}
      //     }
      // }
      let newPipe = [
        {
          $match: {
            _id: new mongoose.Types.ObjectId(req.query.seriesid),
          },
        },
        {
          $lookup: {
            from: "matches",
            localField: "_id",
            foreignField: "series",
            as: "matchdata",
          },
        },
        {
          $unwind: {
            path: "$matchdata",
          },
        },
        {
          $project: {
            matchkey: "$matchdata._id",
            matchdata: "$matchdata",
          },
        },
        {
          $lookup: {
            from: "matchplayers",
            localField: "matchkey",
            foreignField: "matchkey",
            pipeline: [
              {
                $match: {
                  playerid: new mongoose.Types.ObjectId(req.query.playerid),
                },
              },
            ],
            as: "playerdata",
          },
        },
        {
          $unwind: {
            path: "$playerdata",
          },
        },
        {
          $project: {
            fantasy_type: 1,
            matchname: "$matchdata.name",
            matchshortname: "$matchdata.short_name",
            points: "$playerdata.points",
            playerid: "$playerdata.playerid",
            totalSelected: "$playerdata.totalSelected",
            toss_decision: "$matchdata.toss_decision",
            tosswinner_team: "$matchdata.tosswinner_team",
            start_date: "$matchdata.start_date",
            short_name: "$matchdata.short_name",
          },
        },
        {
          $lookup: {
            from: "teamplayers",
            localField: "playerid",
            foreignField: "_id",
            as: "player",
          },
        },
        {
          $unwind: {
            path: "$player",
          },
        },
        {
          $addFields: {
            credit: "$player.credit",
          },
        },
        {
          $project: {
            _id: 0,
          },
        },
        {
          $project: {
            total_points: "$points",
            toss_decision: "$toss_decision",
            tosswinner_team: "$tosswinner_team",
            selectper: "$totalSelected",
            start_date: "$start_date",

            short_name: "$short_name",
            credit: "$credit",
            player: "$player",
          },
        },
        {
          $group: {
            _id: "$player._id",
            data: {
              $first: "$player",
            },
            matches: {
              $push: "$$ROOT",
            },
          },
        },
        {
          $lookup: {
            from: "teams",
            localField: "data.team",
            foreignField: "_id",
            as: "teamdata",
          },
        },
        {
          $unwind: {
            path: "$teamdata",
          },
        },
        {
          $addFields: {
            "data.team": "$teamdata.short_name",
            // "data.image": `${global.constant.IMAGE_URL}black_team1.png`,
            "data.image": `${global.constant.IMAGE_URL}avtar1.png`,
          },
        },
        {
          $project: {
            teamdata: 0,
          },
        },
      ];
      const data = await SeriesModel.aggregate(newPipe);
      if (data.length > 0) {
        let matches = data[0].matches;
        return {
          message: "Player Info without matches",
          status: true,
          data: data[0].data,
          matches,
        };
      }
      return {
        message: "Player Info Not Found",
        status: false,
        data: {},
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * @function getMatchTime
   * @description Check the match time
   * @param { matchkey}
   * @author
   */
  async getMatchTime(start_date) {
    const currentdate = new Date();
    const ISTTime = moment().format("YYYY-MM-DD HH:mm:ss");
    if (ISTTime >= start_date) {
      return false;
    } else {
      return true;
    }
  }

  //winners
  async fetchMegaWinners(req) {
    try {
      let data = {};
      let winnersData = [];
      let dataa = [
        {
          seriesname: "English T20 Blast",
          start_date: "2023-06-21 23:00:00",
          team1name: "Northamptonshire",
          team2name: "Derbyshire",
          short_name_team1: "NOR",
          short_name_team2: "DER",
          image_team1: `${global.constant.IMAGE_URL}teams/1684920486440.png`,
          image_team2: `${global.constant.IMAGE_URL}teams/1684404536868.png`,
          prizepool: 1000,
          userinfo: [
            {
              _id: "6493cf05d1ff3c64e7cafe9a",
              userid: "646a0cf768b16bc003083454",
              challengeid: "6491da2a598f3fdcd8cbbf0c",
              amount: 1000,
              rank: 1,
              user: {
                _id: "646a0cf768b16bc003083454",
                email: "thakorhitesh389@gmail.com",
                image: `${global.constant.IMAGE_URL}avtar1.png`,
                team: "Heet1234",
              },
            },
            {
              _id: "640f5caf329d101a5a512a7d",
              userid: "63c7e5203ea3aa29defd7a78",
              challengeid: "6491da2a598f3fdcd8cbbf0c",
              amount: 3,
              rank: 2,
              user: {
                _id: "63c7e5203ea3aa29defd7a78",
                email: "ajaysinghchauhan.indr@gmail.com",
                image: `${global.constant.IMAGE_URL}avtar1.png`,
                team: "Yuvraj Singh",
              },
            },
            {
              _id: "640f5caf329d101a5a512a85",
              userid: "63d115ca428f03d4632271cd",
              challengeid: "6491da2a598f3fdcd8cbbf0c",
              amount: 3,
              rank: 3,
              user: {
                _id: "63d115ca428f03d4632271cd",
                email: "pushkar.img@gmail.com",
                image: `${global.constant.IMAGE_URL}avtar1.png`,
                team: "Gjfjfjfuk",
              },
            },
          ],
        },
      ];
      let winnerdata;
      if (req.query.user != 1) {
        winnerdata = await matchesModel.aggregate([
          {
            $match: {
              final_status: "winnerdeclared",
            },
          },
          {
            $sort: {
              start_date: -1,
            },
          },
          {
            $limit: 10,
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
                      $ne: "canceled",
                    },
                    win_amount: {
                      $gt: 0,
                    },
                  },
                },
                {
                  $sort: {
                    win_amount: -1,
                  },
                },
                {
                  $limit: 1,
                },
              ],
              as: "matchchallenge",
            },
          },
          {
            $unwind: {
              path: "$matchchallenge",
            },
          },
          {
            $lookup: {
              from: "resultsummary",
              localField: "matchchallenge._id",
              foreignField: "challengeid",
              pipeline: [
                {
                  $match: {
                    amount: {
                      $gt: 0,
                    },
                  },
                },
                {
                  $sort: {
                    rank: 1,
                  },
                },
                {
                  $limit: 10,
                },
                {
                  $project: {
                    _id: 1,
                    userid: 1,
                    amount: 1,
                    rank: 1,
                    challengeid: 1,
                  },
                },
                {
                  $lookup: {
                    from: "users",
                    localField: "userid",
                    foreignField: "_id",
                    pipeline: [
                      {
                        $project: {
                          team: 1,
                          image: 1,
                          email: 1,
                          _id: 1,
                        },
                      },
                    ],
                    as: "user",
                  },
                },
                {
                  $unwind: "$user",
                },
              ],
              as: "ranks",
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
            $unwind: {
              path: "$team1",
            },
          },
          {
            $unwind: {
              path: "$team2",
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
            $unwind: {
              path: "$series",
            },
          },
        ]);
      } else {
        winnerdata = await matchesModel.aggregate([
          {
            $match: {
              final_status: "winnerdeclared",
            },
          },
          {
            $lookup: {
              from: "userleagues",
              let: {
                match_key: "$_id",
              },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        {
                          $eq: ["$matchkey", "$$match_key"],
                        },
                        {
                          $eq: [
                            "$userid",
                            new mongoose.Types.ObjectId(req.user._id),
                          ],
                        },
                      ],
                    },
                  },
                },
                {
                  $lookup: {
                    from: "matchcontests",
                    localField: "challengeid",
                    foreignField: "_id",
                    as: "matchchallenges",
                  },
                },
                {
                  $unwind: {
                    path: "$matchchallenges",
                  },
                },
                {
                  $match: {
                    "matchchallenges.status": {
                      $ne: "canceled",
                    },
                  },
                },
              ],
              as: "filter",
            },
          },
          {
            $match: {
              "filter.0": {
                $exists: true,
              },
            },
          },
          {
            $sort: {
              start_date: -1,
            },
          },
          {
            $limit: 10,
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
                      $ne: "canceled",
                    },
                    win_amount: {
                      $gt: 0,
                    },
                  },
                },
                {
                  $sort: {
                    win_amount: -1,
                  },
                },
                {
                  $limit: 1,
                },
              ],
              as: "matchchallenge",
            },
          },
          {
            $unwind: {
              path: "$matchchallenge",
            },
          },
          {
            $lookup: {
              from: "resultsummary",
              localField: "matchchallenge._id",
              foreignField: "challengeid",
              pipeline: [
                {
                  $match: {
                    amount: {
                      $gt: 0,
                    },
                  },
                },
                {
                  $sort: {
                    rank: 1,
                  },
                },
                {
                  $limit: 10,
                },
                {
                  $project: {
                    _id: 1,
                    userid: 1,
                    amount: 1,
                    rank: 1,
                    challengeid: 1,
                  },
                },
                {
                  $lookup: {
                    from: "users",
                    localField: "userid",
                    foreignField: "_id",
                    pipeline: [
                      {
                        $project: {
                          team: 1,
                          image: 1,
                          email: 1,
                          _id: 1,
                        },
                      },
                    ],
                    as: "user",
                  },
                },
                {
                  $unwind: "$user",
                },
              ],
              as: "ranks",
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
            $unwind: {
              path: "$team1",
            },
          },
          {
            $unwind: {
              path: "$team2",
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
            $unwind: {
              path: "$series",
            },
          },
        ]);
      }

      for (let match of winnerdata) {
        data.seriesname = match.series.name;
        data.start_date = match.start_date;
        data.team1name = match.team1.teamName;
        data.team2name = match.team2.teamName;
        data.short_name_team1 = match.team1.short_name;
        data.short_name_team2 = match.team2.short_name;
        data.image_team1 =
          match.team1.logo != ""
            ? `${global.constant.IMAGE_URL}${match.team1.logo}`
            : `${global.constant.IMAGE_URL}team_image.png`;
        data.image_team2 =
          match.team2.logo != ""
            ? `${global.constant.IMAGE_URL}${match.team2.logo}`
            : `${global.constant.IMAGE_URL}team_image.png`;
        data.short_name_team2 = match.team2.short_name;
        data.prizepool = match.matchchallenge.win_amount;
        for (let userdata of match.ranks) {
          userdata.user.image =
            userdata.user.image != ""
              ? userdata.user.image
              : `${global.constant.IMAGE_URL}avtar1.png`;
        }
        data.userinfo = match.ranks;
        winnersData.push(data);
      }

      if (winnersData.length == 0) {
        return {
          message: "Data not found !!",
          status: false,
          // data: dataa,
        };
      }

      return {
        message: "Winners Data",
        status: true,
        data: winnersData,
      };
    } catch (error) { }
  }
  //winners end
  async getJoinleague(userId, matchkey) {
    const total_joinedcontestData = await userLeagueModel.aggregate([
      {
        $match: {
          // userid: new mongoose.Types.ObjectId(userId),
          matchkey: new mongoose.Types.ObjectId(matchkey),
        },
      },
      {
        $group: {
          _id: "$challengeid",
        },
      },
      {
        $count: "total_count",
      },
    ]);
    return total_joinedcontestData[0]?.total_count;
  }

  async liveRanksLeaderboardPipeline(req, skip, limit, userId = null, type) {
    let aggPipe = [];
    aggPipe.push({
      $match: {
        matchkey: new mongoose.Types.ObjectId(req.query.matchkey),
        challengeid: new mongoose.Types.ObjectId(req.query.matchchallengeid),
      },
    });
    if (userId && type == 'self') {
      aggPipe.push({
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
        },
      });
    }
    if (userId && type == 'other') {
      aggPipe.push({
        $match: {
          userId: { $ne: new mongoose.Types.ObjectId(userId) },
        },
      });
    }
    aggPipe.push({
      $sort: {
        rank: 1,
      },
    });
    aggPipe.push({
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
      },
    });

    aggPipe.push({
      $addFields: {
        userno: {
          $cond: {
            if: {
              $and: [
                {
                  $eq: ["$userId", new mongoose.Types.ObjectId(req.user._id)],
                },
              ],
            },
            then: "-1",
            else: "0",
          },
        },
      },
    });

    // aggPipe.push({
    //   $lookup: {
    //     from: "leaderboards",
    //     localField: "_id",
    //     foreignField: "joinId",
    //     // 'pipeline': [
    //     //     {
    //     //         '$project': {
    //     //             'rank': 1,
    //     //             'points': 1
    //     //         }
    //     //     }
    //     // ],
    //     as: "leaderboards",
    //   },
    // });
    // aggPipe.push({
    //   $match: {
    //     rank: { $ne: 0 }
    //   }
    // });

    aggPipe.push({
      $project: {
        _id: 1,
        userjoinid: "$joinId",
        userid: "$userId",
        jointeamid: "$teamId",
        teamnumber: 1,
        challengeid: 1,
        userno: 1,
        points: "$points",
        getcurrentrank: "$rank",
        image: {
          $cond: {
            if: {
              $eq: [
                {
                  $getField: {
                    field: "image",
                    input: {
                      $arrayElemAt: ["$user", 0],
                    },
                  },
                },
                "",
              ],
            },
            then: "/avtar1.png",
            else: {
              $getField: {
                field: "image",
                input: {
                  $arrayElemAt: ["$user", 0],
                },
              },
            },
          },
        },
        player_type: "classic",
        winingamount: "$amount",
        contest_winning_type: "$contest_winning_type",
        "challengeData": "price",
        teamname: "$user_team"
      }
    });



    aggPipe.push({
      $facet: {
        data: [{ $skip: skip }, { $limit: limit }],
      },
    });
    // console.log(JSON.stringify(aggPipe))
    const finalData = await userLeaderBoardModel.aggregate(aggPipe);

    let total_joined_teams = 0;
    if (skip == 0) {
      total_joined_teams = await userLeagueModel.countDocuments({
        matchkey: new mongoose.Types.ObjectId(req.query.matchkey),
        challengeid: new mongoose.Types.ObjectId(req.query.matchchallengeid),
      });
    }
    if (finalData[0].data.length > 0) {
      return {
        message: "Live score lederbord of match",
        status: true,
        data: {
          team_number_get: finalData[0].data[0].teamnumber,
          userrank: finalData[0].data[0].getcurrentrank,
          pdfname: "",
          jointeams: finalData[0].data ? finalData[0].data : [],
        },
        total_joined_teams,
      };
    } else {
      return {
        message: "Live score lederbord of match Not Found",
        status: false,
        data: {},
      };
    }
  }
  /**
   * @function leaderboardLiveRank
   * @description Live score lederbord of match
   * @param { matchkey,challengeid }
   * @author
   */
  async leaderboardLiveRank(req) {
    try {
      let skip = req.query?.skip ? Number(req.query.skip) : 0;
      let limit = req.query?.limit ? Number(req.query.limit) : 10;
      // console.log('req.query?.final_status------------>>>>>>>', req.query?.final_status);
      // if (req.query?.final_status !== "winnerdeclared") {
      if (skip !== 0) {
        skip = skip + 300;
      }
      if (!(req.query.matchchallengeid)) {
        return ({ status: false, message: "matchchallengeid is required" })
      }
      let keyChallengeLeaderBoard = 'liveRanksLeaderboard_' + req.query.matchchallengeid.toString();
      let retrieveSortedSet = await redisLiveLeaderboard.retrieveSortedSet(keyChallengeLeaderBoard, req.user._id, skip, 300);
      // console.log('retrieveSortedSet', retrieveSortedSet);
      if (retrieveSortedSet && retrieveSortedSet.length > 0) {
        let totalJointeams = `match:${req.query.matchkey}:challenge:${req.query.matchchallengeid}:joinedTeams`
        totalJointeams = await redisLiveJoinTeams.getkeydata(totalJointeams);
        if (!totalJointeams) {
          totalJointeams = await userLeaderBoardModel.countDocuments({ challengeid: req.query.matchchallengeid });
        }
        return {
          message: "Live score lederbord of match",
          status: true,
          data: {
            team_number_get: 1,
            userrank: 1,
            pdfname: "",
            jointeams: retrieveSortedSet
          },
          total_joined_teams: totalJointeams,
        };
      } else {
        return this.liveRanksLeaderboardPipeline(req, skip, limit, req.user._id, 'other');
      }

      // } else {
      //   return this.liveRanksLeaderboardPipeline(req, skip, limit, req.user._id, 'other');
      // }
    } catch (error) {
      throw error;
    }
  }



  /**
   * @function leaderboardCompletedMatch
   * @description Live score lederbord of match
   * @param { matchkey,challengeid }
   * @author
   */
  async leaderboardCompletedMatch(req) {
    try {
      let skip = req.query?.skip ? Number(req.query.skip) : 0;
      let limit = req.query?.limit ? Number(req.query.limit) : 10;
      // console.log('req.query?.final_status------------>>>>>>>', req.query?.final_status);
      // if (req.query?.final_status !== "winnerdeclared") {
      if (skip !== 0) {
        skip = skip + 300;
      }
      let keyChallengeLeaderBoard = 'liveRanksLeaderboard_' + req.query.matchchallengeid.toString();
      let retrieveSortedSet = await redisLiveLeaderboard.retrieveSortedSet(keyChallengeLeaderBoard, req.user._id, skip, 300);
      console.log('retrieveSortedSet', retrieveSortedSet.length);
      if (retrieveSortedSet && retrieveSortedSet.length > 0) {
        let totalJointeams = `match:${req.query.matchkey}:challenge:${req.query.matchchallengeid}:joinedTeams`
        totalJointeams = await redisLiveJoinTeams.getkeydata(totalJointeams);
        if (!totalJointeams) {
          totalJointeams = await userLeaderBoardModel.countDocuments({ challengeid: req.query.matchchallengeid });
        }
        return {
          message: "Live score lederbord of match",
          status: true,
          data: {
            team_number_get: 1,
            userrank: 1,
            pdfname: "",
            jointeams: retrieveSortedSet
          },
          total_joined_teams: totalJointeams,
        };
      } else {
        return {
          message: "Live score lederbord of match",
          status: true,
          data: {
            team_number_get: 1,
            userrank: 1,
            pdfname: "",
            jointeams: []
          },
          total_joined_teams: 0,
        };
        // return this.liveRanksLeaderboardPipeline(req, skip, limit, req.user._id, 'other');
      }

      // } else {
      //   return this.liveRanksLeaderboardPipeline(req, skip, limit, req.user._id, 'other');
      // }
    } catch (error) {
      throw error;
    }
  }
  /**
 * @function leaderboardSelfLiveRanks
 * @description Live score lederbord of match
 * @param { matchkey,challengeid }
 * @author
 */
  async leaderboardSelfLiveRanks(req) {
    try {
      let skip = req.query?.skip ? Number(req.query.skip) : 0;
      let limit = req.query?.limit ? Number(req.query.limit) : 10;
      // console.log('req.query?.final_status------------>>>>>>>', req.query?.final_status);
      // if (req.query?.final_status !== "winnerdeclared") {
      let membersData = [];
      let keyLeaderBoard = `match:${req.query.matchkey}:challenge:${req.query.matchchallengeid}:user:${req.user._id}:userLeaderBoard`;
      let userLeaderboard = await Redis.getMyLeaderBoard(keyLeaderBoard, req.user._id);

      if (userLeaderboard.length > 0) {
        membersData = userLeaderboard.map(item => item._id.split('-')[0]);
      } else {
        let aggPipe = [];
        aggPipe.push({
          $match: {
            userId: new mongoose.Types.ObjectId(req.user._id)
          }
        });
        aggPipe.push({
          $project: {
            _id: { $toString: "$_id" }
          }
        }, {
          $group: {
            _id: null,
            data: {
              $push: "$_id"
            }
          }
        });
        const members = await userLeaderBoardModel.aggregate(aggPipe);
        membersData = members[0]?.data || [];
      }

      let keyChallengeLeaderBoard = 'liveRanksLeaderboard_' + req.query.matchchallengeid.toString();
      console.log('membersData', membersData)
      userLeaderboard = await redisLiveLeaderboard.particularUserLeaderBoard(keyChallengeLeaderBoard, req.user._id, '', membersData);
      if (!userLeaderboard || userLeaderboard.length === 0) {
        return this.liveRanksLeaderboardPipeline(req, skip, limit, req.user._id, 'self');
      }
      return {
        message: "Live score lederbord of match",
        status: true,
        data: {
          team_number_get: 1,
          userrank: 1,
          pdfname: "",
          jointeams: userLeaderboard
        }
      };
      // } else {
      //   return this.liveRanksLeaderboardPipeline(req, skip, limit, req.user._id, 'self');
      // }
    } catch (error) {
      throw error;
    }
  }


  /**
   * @function matchlivedata
   * @description match live score
   * @param { matchkey(query) }
   * @author
   */
  async matchlivedata(req) {
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
          _id: new mongoose.Types.ObjectId(req.query.matchkey),
        });
        redisjoinTeams.setkeydata(keyname, match, 20 * 24 * 60 * 60);
      }

      // redis end
      //comment for redis--> let match = await matchesModel.findOne({ _id: new mongoose.Types.ObjectId(req.query.matchkey) });
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

  async playersWithPlayingStatus(req) {
    try {
      let playerPipe = [];
      playerPipe.push({
        $match: { matchkey: new mongoose.Types.ObjectId(req.params.matchId) },
      });
      playerPipe.push({
        $lookup: {
          from: "teamplayers",
          localField: "playerid",
          foreignField: "_id",
          as: "playersData",
        },
      });
      playerPipe.push({
        $lookup: {
          from: "matches",
          localField: "matchkey",
          foreignField: "_id",
          as: "listmatches",
        },
      });
      playerPipe.push({
        $unwind: { path: "$playersData" },
      });
      playerPipe.push({
        $unwind: { path: "$listmatches" },
      });
      playerPipe.push({
        $lookup: {
          from: "teams",
          localField: "playersData.team",
          foreignField: "_id",
          as: "team",
        },
      });
      playerPipe.push({
        $project: {
          _id: 0,
          id: "$_id",
          playerid: 1,
          points: 1,
          role: 1,
          credit: 1,
          name: 1,
          playingstatus: 1,
          vplaying: 1,
          players_key: "$playersData.players_key",
          image: {
            $ifNull: [
              {
                $cond: {
                  if: {
                    $or: [
                      { $eq: [{ $substr: ["$playersData.image", 0, 1] }, "/"] },
                      { $eq: [{ $substr: ["$playersData.image", 0, 1] }, "p"] },
                    ],
                  },
                  then: {
                    $concat: [`${global.constant.IMAGE_URL}`, "", "$playersData.image"],
                  },
                  else: {
                    $cond: {
                      if: { $eq: ["$playersData.image", ""] },
                      then: {
                        $cond: {
                          if: {
                            $eq: ["$playersData.team", "$listmatches.team1Id"],
                          },
                          then: `${global.constant.IMAGE_URL}white_team1.png`,
                          else: {
                            $cond: {
                              if: {
                                $eq: [
                                  "$playersData.team",
                                  "$listmatches.team2Id",
                                ],
                              },
                              then: `${global.constant.IMAGE_URL}black_team1.png`,
                              else: `${global.constant.IMAGE_URL}black_team1.png`,
                            },
                          },
                        },
                      },
                      else: "$playersData.image",
                    },
                  },
                },
              },
              `${global.constant.IMAGE_URL}black_team1.png`,
            ],
          },
          teamName: { $arrayElemAt: ["$team.teamName", 0] },
          teamcolor: {
            $ifNull: [
              { $arrayElemAt: ["$team.color", 0] },
              global.constant.TEAM_DEFAULT_COLOR.DEF1,
            ],
          },
          team_logo: {
            $ifNull: [
              {
                $cond: {
                  if: {
                    $or: [
                      {
                        $eq: [
                          {
                            $substr: [
                              { $arrayElemAt: ["$team.logo", 0] },
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
                              { $arrayElemAt: ["$team.logo", 0] },
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
                      { $arrayElemAt: ["$team.logo", 0] },
                    ],
                  },
                  else: { $arrayElemAt: ["$team.logo", 0] },
                },
              },
              `${global.constant.IMAGE_URL}team_image.png`,
            ],
          },
          team_short_name: { $arrayElemAt: ["$team.short_name", 0] },
          totalpoints: "0",
          team: {
            $cond: {
              if: { $eq: ["$playersData.team", "$listmatches.team1Id"] },
              then: "team1",
              else: {
                $cond: {
                  if: { $eq: ["$playersData.team", "$listmatches.team2Id"] },
                  then: "team2",
                  else: "",
                },
              },
            },
          },
          captain_selection_percentage: "0",
          vice_captain_selection_percentage: "0",
          player_selection_percentage: "0",
        },
      });
      playerPipe.push({
        $match: { playingstatus: 1 },
      });
      let data = await matchPlayersModel.aggregate(playerPipe);
      return {
        message: "Players List By Match",
        status: true,
        data,
      };
    } catch (error) {
      throw error;
    }
  }

  async recentWinnerWithoutRedis() {
    try {
      let aggPipe = [
        {
          $match: {
            status: "completed",
            launch_status: "launched",
            final_status: "winnerdeclared"
          }
        },
        {
          $sort: {
            start_date: -1
          }
        },
        {
          $limit: 15
        },
        {
          $lookup: {
            from: "teams",
            localField: "team1Id",
            foreignField: "_id",
            as: "team1Id"
          }
        },
        {
          $lookup: {
            from: "teams",
            localField: "team2Id",
            foreignField: "_id",
            as: "team2Id"
          }
        },
        {
          $lookup: {
            from: "matchseries",
            localField: "series",
            foreignField: "_id",
            as: "series"
          }
        },
        {
          $lookup: {
            from: "matchcontests",
            localField: "_id",
            foreignField: "matchkey",
            pipeline: [
              {
                $sort: {
                  win_amount: -1
                }
              },
              {
                $match: {
                  is_recent: "true"
                }
              },
              {
                $project: {
                  challenge_id: 1,
                  matchkey: 1,
                  fantasy_type: "$fantasy_type",
                  win_amount: "$win_amount",
                  contest_name: "$contest_name",
                  is_recent: "$is_recent",
                  joinedusers: "$joinedusers"
                }
              },
              {
                $match: {
                  joinedusers: {
                    $gt: 0
                  }
                }
              }
            ],
            as: "matchchallenges"
          }
        },
        {
          $match: {
            $expr: {
              $gte: [
                {
                  $size: "$matchchallenges"
                },
                1
              ]
            } // Matches documents where "items" has 2 or more elements
          }
        },
        {
          $project: {
            seriesName: {
              $arrayElemAt: ["$series.name", 0]
            },
            teamAName: {
              $arrayElemAt: ["$team1Id.teamName", 0]
            },
            teamBName: {
              $arrayElemAt: ["$team2Id.teamName", 0]
            },
            teamAShortName: {
              $arrayElemAt: ["$team1Id.short_name", 0]
            },
            teamBShortName: {
              $arrayElemAt: ["$team2Id.short_name", 0]
            },
            teamAImage: {
              $arrayElemAt: ["$team1Id.logo", 0]
            },
            teamBImage: {
              $arrayElemAt: ["$team2Id.logo", 0]
            },
            startDate: "$start_date",
            fantasyType: 1,
            matchkey: "$_id",
            totalWin: {
              $arrayElemAt: [
                "$matchchallenges.win_amount",
                0
              ]
            },
            matchchallenges: 1,
            challengeId: {
              $arrayElemAt: ["$matchchallenges._id", 0]
            },
            firstContesWinAmount: {
              $arrayElemAt: [
                "$matchchallenges.win_amount",
                0
              ]
            },
            convertedStartDate: "$start_date"
          }
        },
        {
          $addFields: {
            teamAImage: {
              $concat: [
                `${global.constant.IMAGE_URL}`,
                "$teamAImage"
              ]
            },
            teamBImage: {
              $concat: [
                `${global.constant.IMAGE_URL}`,
                "$teamBImage"
              ]
            }
          }
        },
        {
          $lookup: {
            from: "userleaderboard",
            let: {
              challengeId: "$challengeId"
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: [
                      "$challengeid",
                      "$$challengeId"
                    ]
                  }
                }
              },
              {
                $sort: {
                  rank: 1
                }
              },
              {
                $limit: 10
              },
              {
                $lookup: {
                  from: "users",
                  localField: "userId",
                  foreignField: "_id",
                  as: "userData"
                }
              },
              {
                $project: {
                  _id: 1,
                  joinId: 1,
                  userId: 1,
                  points: 1,
                  rank: 1,
                  userTeamName: "$user_team",
                  username: {
                    $arrayElemAt: [
                      "$userData.username",
                      0
                    ]
                  },
                  userImage: {
                    $arrayElemAt: ["$userData.image", 0]
                  },
                  state: {
                    $arrayElemAt: ["$userData.state", 0]
                  },
                  amount: 1,
                  prize: 1
                }
              }
            ],
            as: "firstcontestData"
          }
        }
      ]
      let recentWinners = await matchesModel.aggregate(aggPipe);
      const RedisKey = `recentWinnerList`;
      await redisMain.setkeydata(RedisKey, recentWinners, 60 * 60 * 48);
      return recentWinners;
      // axios.get(`${url}/api/withoutRedisRecentWinner`).then(async (result) => {
      //     // this.newMethod(result);
      //     console.log('result====');
      // });
      // return true
    } catch (error) {
      console.error('Error uploading file:', error);
      return true
    }
  };

  async getRecentContestData(req) {
    try {
      const pipeline = [
        {
          $match: {
            matchkey: new mongoose.Types.ObjectId(req.params.matchkey),
            challengeid: new mongoose.Types.ObjectId(req.params.matchchallengeid),
          },
        },
        {
          $project: {
            rank: 1,
            points: 1,
            userId: 1,
            joinId: 1,
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  image: 1,
                  team: 1,
                  username: 1,
                  name: 1,
                  state: 1,
                },
              },
            ],
            as: "userData",
          },
        },
        {
          $unwind: {
            path: "$userData",
          },
        },
        {
          $addFields: {
            userImage: "$userData.image",
            userTeamName: "$userData.team",
            username: "$userData.username",
            state: "$userData.state",
            name: "$userData.name",
          },
        },
        {
          $project: {
            userData: 0,
          },
        },
        {
          $lookup: {
            from: "resultsummary",
            localField: "userId",
            let: {
              joinId: "$joinId",
            },
            foreignField: "userid",
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$joinedid", "$$joinId"],
                  },
                },
              },
            ],
            as: "amountData",
          },
        },
        {
          $unwind: {
            path: "$amountData",
          },
        },
        {
          $addFields: {
            amount: "$amountData.amount",
            prize: "$amountData.prize",
          },
        },
        {
          $project: {
            amountData: 0,
          },
        },
        {
          $sort: {
            rank: 1,
          },
        },
        {
          $limit: 10,
        },
      ];
      const data = await userLeaderBoardModel.aggregate(pipeline);
      if (data.length == 0) {
        return {
          message: " Data Not Found !!",
          status: false,
          data: [],
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

  async playerMatchInfoData(req) {
    try {
      // const keyResultPoints = `match:${req.params.matchkey}:resultPoints`;
      // const keyChallengeLeaderBoard = `liveRanksLeaderboard_${challenge._id.toString()}`;
      // let resultPoints = await retrieveSortedSet(keyChallengeLeaderBoard, '', 0, -1);
      // if (!resultPoints || resultPoints.length <= 0) {
      //   resultPoints = await resultPointModel.find({ matchkey: req.params.matchkey });
      //   resultPoints._doc.getcurrentrank = Number(resultPoints.total);
      //   resultPoints._doc._id = resultPoints.resultmatch_id;
      //   const keyResultPoints = `match:${matchKey.toString()}:resultPoints`;
      //   await redisMain.storeSortedSet(keyResultPoints, resultPoints, 60 * 60 * 72);
      // }
      // let pipe = [
      //     {
      //         '$match': {
      //             'matchkey': new mongoose.Types.ObjectId(req.params.matchkey),
      //             'player_id': new mongoose.Types.ObjectId(req.params.playerid)
      //         }
      //     }, {
      //         '$lookup': {
      //             'from': 'matchplayers',
      //             'localField': 'player_id',
      //             'foreignField': 'playerid',
      //             'as': 'playerData'
      //         }
      //     }, {
      //         '$unwind': {
      //             'path': '$playerData'
      //         }
      //     }, {
      //         '$match': {
      //             'playerData.matchkey': new mongoose.Types.ObjectId(req.params.matchkey)
      //         }
      //     },

      //     {
      //         '$addFields': {
      //             'playerinfo.totalSelected': '$playerData.totalSelected',
      //             'playerinfo.name': '$playerData.name',
      //             'playerinfo.points': '$playerData.points',
      //             "playerinfo.role": "$playerData.role",
      //             'playerinfo.credit': '$playerData.credit',
      //             'playerinfo.image': `${global.constant.IMAGE_URL}black_team1.png`,
      //             'catchPoints': "$catch"
      //         }
      //     }, {
      //         '$project': {
      //             'playerData': 0,
      //             'createdAt': 0,
      //             'updatedAt': 0,
      //             'matchkey': 0,
      //             'player_id': 0,
      //             'resultmatch_id': 0,
      //             'catch': 0
      //         }
      //     }
      // ]
      let pipe = [
        {
          $match: {
            matchkey: new mongoose.Types.ObjectId(req.params.matchkey),
            player_id: new mongoose.Types.ObjectId(req.params.playerid),
          },
        },
        {
          $lookup: {
            from: "matchplayers",
            let: {
              matchkey: "$matchkey",
              player_id: "$player_id",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {
                        $eq: ["$matchkey", "$$matchkey"],
                      },
                      {
                        $eq: ["$playerid", "$$player_id"],
                      },
                    ],
                  },
                },
              },
            ],
            as: "matchPlayers",
          },
        },
        {
          $unwind: "$matchPlayers",
        },
        {
          $lookup: {
            from: "resultmatches",
            let: {
              matchkey: "$matchkey",
              player_id: "$player_id",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {
                        $eq: ["$matchkey", "$$matchkey"],
                      },
                      {
                        $eq: ["$player_id", "$$player_id"],
                      },
                    ],
                  },
                },
              },
            ],
            as: "playerScorecard",
          },
        },
        {
          $unwind: "$playerScorecard",
        },
        {
          $addFields: {
            image: `${global.constant.IMAGE_URL}black_team1.png`,
            credit: "$matchPlayers.credit",
            totalSelected: "$matchPlayers.totalSelected",
            card: [
              {
                type: "6's",
                actual: "$playerScorecard.six",
                points: "$sixs",
              },
              {
                type: "4's",
                actual: "$playerScorecard.fours",
                points: "$fours",
              },
              {
                type: "Runs",
                actual: "$playerScorecard.runs",
                points: "$runs",
              },
              {
                type: "Catch Points",
                actual: "$playerScorecard.catch",
                points: "$catch",
              },
              {
                type: "Strike Rate",
                actual: "$playerScorecard.strike_rate",
                points: "$strike_rate",
              },
              {
                type: "30/50/100",
                actual: {
                  $cond: {
                    if: {
                      $gt: ["$thirtypoints", 0],
                    },
                    then: "30+",
                    else: {
                      $cond: {
                        if: {
                          $gt: ["$halfcentury", 0],
                        },
                        then: "50+",
                        else: {
                          $cond: {
                            if: {
                              $gt: ["$century", 0],
                            },
                            then: "100+",
                            else: 0,
                          },
                        },
                      },
                    },
                  },
                },
                points: {
                  $cond: {
                    if: {
                      $gt: ["$thirtypoints", 0],
                    },
                    then: "$thirtypoints",
                    else: {
                      $cond: {
                        if: {
                          $gt: ["$halfcentury", 0],
                        },
                        then: "$halfcentury",
                        else: {
                          $cond: {
                            if: {
                              $gt: ["$century", 0],
                            },
                            then: "$century",
                            else: 0,
                          },
                        },
                      },
                    },
                  },
                },
              },
              {
                type: "Wickets",
                actual: "$playerScorecard.wicket",
                points: "$wickets",
              },
              {
                type: "Maiden Over",
                actual: "$playerScorecard.maiden_over",
                points: "$maidens",
              },
              {
                type: "Economy Rate",
                actual: "$playerScorecard.economy_rate",
                points: "$economy_rate",
              },
              {
                type: "Runout",
                actual: "$playerScorecard.runouts",
                points: "$runouts",
              },
              {
                type: "Stumping",
                actual: "$playerScorecard.stumbed",
                points: "$stumping",
              },
              {
                type: "Thrower",
                actual: "$playerScorecard.thrower",
                points: "$thrower",
              },
              {
                type: "Hitter",
                actual: "$playerScorecard.hitter",
                points: "$hitter",
              },
              {
                type: "Bonus",
                actual: "$bonus",
                points: "$bonus",
              },
              {
                type: "Duck",
                actual: "$playerScorecard.negative_points",
                points: "$negative",
              },
              {
                type: "LBW",
                actual: "0",
                points: "$wicketbonuspoint",
              },
              {
                type: "Starting Point",
                actual: "$startingpoints",
                points: "$startingpoints",
              },
              {
                type: "Total",
                actual: "$playerScorecard.total_points",
                points: "$total",
              },
            ],
          },
        },
        {
          $project: {
            total: 1,
            role: "$matchPlayers.role",
            name: "$matchPlayers.name",
            card: 1,
            image: 1,
            credit: 1,
            totalSelected: 1,
          },
        },
      ];
      const data = await resultPointModel.aggregate(pipe);
      if (data.length > 0) {
        return {
          message: "Data Found Successfully !!",
          status: true,
          data,
        };
      }
      return {
        message: "Data Not Found !!",
        status: false,
        data: [],
      };
    } catch (error) {
      console.log(error);
    }
  }


}

module.exports = new matchServices();
