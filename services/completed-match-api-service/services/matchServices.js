const mongoose = require("mongoose");
const moment = require("moment");
require("../../../models/contestModel");
require("../../../models/teamPlayerModel");
require("../../../models/teamModel");

const matchFormatModel = require("../../../models/formatModel");
const matchesModel = require("../../../models/matchesModel");
const matchPlayersModel = require("../../../models/matchPlayersModel");
const resultMatchModel = require("../../../models/resultMatchModel");
const matchContestModel = require("../../../models/matchContestModel");
// const dualgamematchChallengersModel = require("../../../models/dualgamematchChallengersModel");
const userLeagueModel = require("../../../models/userLeagueModel");
// const JoinDuoLeaugeModel = require("../../../models/JoinDuoLeaugeModel");
const userTeamModel = require("../../../models/userTeamModel");
const userLeaderBoardModel = require("../../../models/userLeaderBoardModel");
// const duoleaderBoardModel = require("../../../models/duoleaderBoardModel");
const configModel = require("../../../models/configModel");
const redisMain = require("../../../utils/redis/redisMain");
const redisLeaderboard = require("../../../utils/redis/redisLeaderboard");
const redisLiveLeaderboard = require("../../../utils/redis/redisLiveLeaderboard");
const redisjoinTeams = require("../../../utils/redis/redisjoinTeams");
const redisLiveJoinTeams = require("../../../utils/redis/redisLiveJoinTeams");
const redisContest = require("../../../utils/redis/redisContest");
const redisUser = require("../../../utils/redis/redisUser");
const redisCompletedMatch = require("../../../utils/redis/redisCompletedMatch");
const resultPointModel = require("../../../models/resultPointModel");
const { matchTimeDifference } = require("../../../utils/matchTimeDiffrence");
// const { kafka } = require('../../../utils/kafkaConsumers')
// const Aerospike = require('aerospike');
// const { PartitionFilter } = Aerospike;
// const initAerospike = require('../../../utils/aeroSpike')
class matchServices {
  constructor() {
    return {
      dbCheck: this.dbCheck.bind(this),
      fetchCompletedMatchesList: this.fetchCompletedMatchesList.bind(this),
      fetchCompletedDuoMatches: this.fetchCompletedDuoMatches.bind(this),
      fetchCompletedMatchData: this.fetchCompletedMatchData.bind(this),
      updatedCompltedMatchRedis: this.updatedCompltedMatchRedis.bind(this),
      playersFantasyScoreCard:
        this.playersFantasyScoreCard.bind(this),
      matchPlayerTeamsData:
        this.matchPlayerTeamsData.bind(this),
      fantasyScoreCardRedis: this.fantasyScoreCardRedis.bind(this),
      fetchRecentWinner: this.fetchRecentWinner.bind(this),
      withoutRedisGetMatchList: this.withoutRedisGetMatchList.bind(this),
      fetchRecentWinnerWithoutRedis: this.fetchRecentWinnerWithoutRedis.bind(this),
      fetchPointSystemData: this.fetchPointSystemData.bind(this),
      fetchRecentContest: this.fetchRecentContest.bind(this),
      fetchUserRecentMatches: this.fetchUserRecentMatches.bind(this),
      fetchUserRecentMatchesNew: this.fetchUserRecentMatchesNew.bind(this),
      fetchFantasyScoreCardsRedis: this.fetchFantasyScoreCardsRedis.bind(this),
      matchPlayerTeamsDataRedis: this.matchPlayerTeamsDataRedis.bind(this),
      AllNewCompletedMatches: this.AllNewCompletedMatches.bind(this),
      addCompletedMatchInRedis: this.addCompletedMatchInRedis.bind(this),
      leaderboardOfCompletedMatch: this.leaderboardOfCompletedMatch.bind(this),

    };
  }

  // async dbHealthCheck() {
  //   try {
  //     const TIMEOUT_DURATION = 3000; // 3 seconds timeout

  //     // Helper function for timeout handling
  //     const withTimeout = (promise, ms, timeoutMessage) =>
  //       Promise.race([
  //         promise,
  //         new Promise((_, reject) =>
  //           setTimeout(() => reject(new Error(timeoutMessage)), ms)
  //         )
  //       ]);

  //     let mongoConnected = true;
  //     let redisConnected = false;

  //     try {
  //       // MongoDB Health Check
  //       mongoConnected = await withTimeout(
  //         new Promise((resolve) => resolve(mongoose.connection.readyState === 1)),
  //         TIMEOUT_DURATION,
  //         "MongoDB check timed out"
  //       );
  //     } catch (error) {
  //       console.error("❌ MongoDB Error:", error.message);
  //     }

  //     try {
  //       // Redis Health Check
  //       redisConnected = await withTimeout(
  //         redisMain.healthCheck().then((res) => res === "PONG"),
  //         TIMEOUT_DURATION,
  //         "Redis check timed out"
  //       );
  //     } catch (error) {
  //       console.error("❌ Redis Error:", error.message);
  //     }

  //     // Determine overall health status
  //     const isHealthy = mongoConnected && redisConnected;

  //     return {
  //       status: isHealthy,
  //       database: {
  //         status: mongoConnected,
  //         message: mongoConnected ? "✅ MongoDB is connected." : "❌ MongoDB is not connected."
  //       },
  //       redis: {
  //         status: redisConnected,
  //         message: redisConnected ? "✅ Redis is connected." : "❌ Redis is not responding."
  //       }
  //     };
  //   } catch (error) {
  //     return {
  //       status: false,
  //       database: {
  //         status: false,
  //         message: "Database health check failed.",
  //         error: error.message.includes("MongoDB") ? error.message : undefined
  //       },
  //       redis: {
  //         status: false,
  //         message: "Redis health check failed.",
  //         error: error.message.includes("Redis") ? error.message : undefined
  //       }
  //     };
  //   }
  // };

  async dbCheck() {
    try {
      const TIMEOUT_DURATION = 3000; // 3 seconds timeout

      const withTimeout = (promise, ms, timeoutMessage) =>
        Promise.race([
          promise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(timeoutMessage)), ms)
          )
        ]);

      let mongoConnected = false;
      let redisConnected = false;
      let kafkaConnected = false;

      // MongoDB Health Check
      try {
        mongoConnected = await withTimeout(
          new Promise((resolve) => resolve(mongoose.connection.readyState === 1)),
          TIMEOUT_DURATION,
          "MongoDB check timed out"
        );
      } catch (error) {
        console.error("❌ MongoDB Error:", error.message);
      }

      // Redis Health Check
      try {
        redisConnected = await withTimeout(
          new Promise(async (resolve) => resolve(await redisMain.healthCheck() === "PONG")),
          TIMEOUT_DURATION,
          "Redis check timed out"
        );
      } catch (error) {
        console.error("❌ Redis Error:", error.message);
      }

      // Kafka Health Check
      try {
        const admin = kafka.admin();
        await withTimeout(
          admin.connect(),
          TIMEOUT_DURATION,
          "Kafka connect timed out"
        );
        const topics = await admin.listTopics();
        kafkaConnected = Array.isArray(topics); // check if topics list is received
        await admin.disconnect();
      } catch (error) {
        console.error("❌ Kafka Error:", error.message);
      }

      const isHealthy = mongoConnected && redisConnected && kafkaConnected;

      return {
        status: isHealthy,
        database: {
          status: mongoConnected,
          message: mongoConnected ? "✅ MongoDB is connected." : "❌ MongoDB is not connected."
        },
        redis: {
          status: redisConnected,
          message: redisConnected ? "✅ Redis is connected." : "❌ Redis is not responding."
        },
        kafka: {
          status: kafkaConnected,
          message: kafkaConnected ? "✅ Kafka is connected." : "❌ Kafka is not connected."
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
        },
        kafka: {
          status: false,
          message: "Kafka health check failed.",
          error: error.message.includes("Kafka") ? error.message : undefined
        }
      };
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

  // async AllCompletedMatches(req) {
  //   try {
  //     const aggPipe = [];
  //     aggPipe.push({
  //       $match: {
  //         userid: new mongoose.Types.ObjectId(req.user._id),
  //       },
  //     });
  //     aggPipe.push({
  //       $group: {
  //         _id: "$matchkey",
  //         matchkey: { $first: "$matchkey" },
  //         joinedleaugeId: { $first: "$_id" },
  //         userid: { $first: "$userid" },
  //         matchchallengeid: { $first: "$challengeid" },
  //         jointeamid: { $first: "$teamid" },
  //       },
  //     });
  //     aggPipe.push({
  //       $lookup: {
  //         from: "listmatches",
  //         localField: "matchkey",
  //         foreignField: "_id",
  //         as: "match",
  //       },
  //     });
  //     aggPipe.push({
  //       $unwind: {
  //         path: "$match",
  //       },
  //     });
  //     let formattedCurrentDate = new Date()
  //       .toISOString()
  //       .slice(0, 19)
  //       .replace("T", " ");
  //     req.query.fantasy_type = "Cricket";
  //     aggPipe.push({
  //       $match: {
  //         "match.fantasy_type": req.query.fantasy_type,
  //         // 'match.start_date': { $gte: formattedCurrentDate }
  //       },
  //     });
  //     // aggPipe.push({
  //     //     $match: { 'match.final_status': { "$in": ["IsReviewed", "IsCanceled", "IsAbandoned", "winnerdeclared"] } },
  //     // });
  //     aggPipe.push({
  //       $match: {
  //         "match.final_status": {
  //           $in: ["IsCanceled", "IsAbandoned", "winnerdeclared"],
  //         },
  //         "match.launch_status": "launched"
  //       },
  //     });

  //     aggPipe.push({
  //       $lookup: {
  //         from: "finalresults",
  //         let: { matchkey: "$matchkey" },
  //         pipeline: [
  //           {
  //             $match: {
  //               $expr: {
  //                 $and: [
  //                   { $eq: ["$$matchkey", "$matchkey"] },
  //                   { $eq: ["$userid", new mongoose.Types.ObjectId(req.user._id)] },
  //                 ],
  //               },
  //             },
  //           },
  //           {
  //             $group: {
  //               _id: null,
  //               amount: { $sum: "$amount" },
  //             },
  //           },
  //         ],
  //         as: "finalresultsTotalAmount",
  //       },
  //     });
  //     // aggPipe.push({
  //     //     $unwind: { path: '$finalresultsTotalAmount' }
  //     // });
  //     aggPipe.push({
  //       $lookup: {
  //         from: "joinedleauges",
  //         let: { matchkey: "$matchkey", userid: "$userid" },
  //         pipeline: [
  //           {
  //             $match: {
  //               $expr: {
  //                 $and: [
  //                   {
  //                     $eq: ["$matchkey", "$$matchkey"],
  //                   },
  //                   {
  //                     $eq: ["$userid", "$$userid"],
  //                   },
  //                 ],
  //               },
  //             },
  //           },
  //         ],
  //         as: "joinedleauges",
  //       },
  //     });
  //     aggPipe.push({
  //       $unwind: {
  //         path: "$joinedleauges",
  //       },
  //     });
  //     // aggPipe.push({
  //     //   $lookup: {
  //     //     from: "matchruns",
  //     //     localField: "matchkey",
  //     //     foreignField: "matchkey",
  //     //     as: "winingData",
  //     //   },
  //     // });
  //     // aggPipe.push({
  //     //   $unwind: { path: "$winingData" },
  //     // });
  //     aggPipe.push({
  //       $group: {
  //         _id: "$joinedleauges.challengeid",
  //         joinedleaugeId: { $first: "$joinedleauges._id" },
  //         matchkey: { $first: "$matchkey" },
  //         jointeamid: { $first: "$jointeamid" },
  //         match: { $first: "$match" },
  //         finalresultsTotalAmount: { $first: "$finalresultsTotalAmount" },
  //       },
  //     });
  //     aggPipe.push({
  //       $lookup: {
  //         from: "matchchallenges",
  //         localField: "_id",
  //         foreignField: "_id",
  //         pipeline: [
  //           {
  //             $match: {
  //               status: { $ne: "canceled" }
  //             }
  //           }
  //         ],
  //         as: "matchchallenge",
  //       },
  //     });
  //     aggPipe.push({
  //       $unwind: {
  //         path: "$matchchallenge",
  //         // preserveNullAndEmptyArrays: true,
  //       },
  //     });
  //     // aggPipe.push({
  //     //     $match: {
  //     //         'matchchallenge.status': { $ne: "canceled" }
  //     //     }
  //     // });
  //     aggPipe.push({
  //       $group: {
  //         _id: "$matchkey",
  //         joinedleaugeId: { $first: "$joinedleaugeId" },
  //         matchkey: { $first: "$matchkey" },
  //         jointeamid: { $first: "$jointeamid" },
  //         match: { $first: "$match" },
  //         finalresultsTotalAmount: { $first: "$finalresultsTotalAmount" },
  //         count: { $sum: 1 },
  //       },
  //     });
  //     aggPipe.push({
  //       $lookup: {
  //         from: "series",
  //         localField: "match.series",
  //         foreignField: "_id",
  //         as: "series",
  //       },
  //     });
  //     aggPipe.push({
  //       $lookup: {
  //         from: "teams",
  //         localField: "match.team1Id",
  //         foreignField: "_id",
  //         as: "team1",
  //       },
  //     });
  //     aggPipe.push({
  //       $lookup: {
  //         from: "teams",
  //         localField: "match.team2Id",
  //         foreignField: "_id",
  //         as: "team2",
  //       },
  //     });
  //     aggPipe.push({
  //       $unwind: {
  //         path: "$series",
  //       },
  //     });
  //     aggPipe.push({
  //       $unwind: {
  //         path: "$team1",
  //       },
  //     });
  //     aggPipe.push({
  //       $unwind: {
  //         path: "$team2",
  //       },
  //     });
  //     let today = new Date();
  //     today.setHours(today.getHours() + 5);
  //     today.setMinutes(today.getMinutes() + 30);
  //     aggPipe.push({
  //       $addFields: {
  //         date: {
  //           $dateFromString: {
  //             dateString: "$match.start_date",
  //             timezone: "-00:00",
  //           },
  //         },
  //         curDate: today,
  //       },
  //     });
  //     // aggPipe.push({
  //     //     $match: {
  //     //         $expr: {
  //     //             $and: [{
  //     //                 $lte: ['$date', today],
  //     //             },
  //     //             ],
  //     //         },
  //     //     }
  //     // });

  //     aggPipe.push({
  //       $sort: {
  //         date: -1,
  //       },
  //     });

  //     aggPipe.push({
  //       $limit: 20,
  //     });
  //     aggPipe.push({
  //       $project: {
  //         _id: 0,
  //         matchkey: 1,
  //         matchname: { $ifNull: ["$match.name", ""] },
  //         format: "$match.format",
  //         winning_status: '',
  //         team1ShortName: { $ifNull: ["$team1.short_name", ""] },
  //         team2ShortName: { $ifNull: ["$team2.short_name", ""] },
  //         team1fullname: { $ifNull: ["$team1.teamName", ""] },
  //         team2fullname: { $ifNull: ["$team2.teamName", ""] },
  //         // team1color: { $ifNull: ['$team1.color', global.constant.TEAM_DEFAULT_COLOR.DEF1] },
  //         // team2color: { $ifNull: ['$team2.color', global.constant.TEAM_DEFAULT_COLOR.DEF1] },
  //         team1color: "#D5EF8A",
  //         team2color: "#52A860",
  //         team1logo: {
  //           $ifNull: [
  //             {
  //               $cond: {
  //                 if: {
  //                   $or: [
  //                     { $eq: [{ $substr: ["$team1.logo", 0, 1] }, "/"] },
  //                     { $eq: [{ $substr: ["$team1.logo", 0, 1] }, "t"] },
  //                   ],
  //                 },
  //                 then: {
  //                   $concat: [`${global.constant.IMAGE_URL}`, "", "$team1.logo"],
  //                 },
  //                 else: "$team1.logo",
  //               },
  //             },
  //             `${global.constant.IMAGE_URL}team_image.png`,
  //           ],
  //         },
  //         team2logo: {
  //           $ifNull: [
  //             {
  //               $cond: {
  //                 if: {
  //                   $or: [
  //                     { $eq: [{ $substr: ["$team2.logo", 0, 1] }, "/"] },
  //                     { $eq: [{ $substr: ["$team2.logo", 0, 1] }, "t"] },
  //                   ],
  //                 },
  //                 then: {
  //                   $concat: [`${global.constant.IMAGE_URL}`, "", "$team2.logo"],
  //                 },
  //                 else: "$team2.logo",
  //               },
  //             },
  //             `${global.constant.IMAGE_URL}team_image.png`,
  //           ],
  //         },
  //         start_date: { $ifNull: ["$match.start_date", "0000-00-00 00:00:00"] },
  //         status: {
  //           $ifNull: [
  //             {
  //               $cond: {
  //                 if: {
  //                   $lt: [
  //                     "$match.start_date",
  //                     moment().format("YYYY-MM-DD HH:mm:ss"),
  //                   ],
  //                 },
  //                 then: "closed",
  //                 else: "opened",
  //               },
  //             },
  //             "opened",
  //           ],
  //         },
  //         // totalWinningAmount: { $ifNull: ["$finalresultsTotalAmount.amount", 0] },
  //         totalWinningAmount: {
  //           $ifNull: [
  //             { $arrayElemAt: ["$finalresultsTotalAmount.amount", 0] },
  //             0,
  //           ],
  //         },
  //         launch_status: { $ifNull: ["$match.launch_status", ""] },
  //         final_status: { $ifNull: ["$match.final_status", ""] },
  //         series_name: { $ifNull: ["$series.name", ""] },
  //         type: { $ifNull: ["$match.fantasy_type", "Cricket"] },
  //         series_id: { $ifNull: ["$series._id", ""] },
  //         available_status: { $ifNull: [1, 1] },
  //         joinedcontest: { $ifNull: ["$count", 0] },
  //       },
  //     });
  //     // console.log(JSON.stringify(aggPipe))
  //     const JoiendMatches = await userLeagueModel.aggregate(aggPipe);
  //     for (let data of JoiendMatches) {
  //       let total_teams = await Promise.all([
  //         userTeamModel.countDocuments({
  //           userid: req.user._id,
  //           matchkey: data.matchkey,
  //         }),
  //       ]);

  //       data.total_teams = total_teams[0];
  //     }

  //     if (JoiendMatches.length > 0) {
  //       return {
  //         message: "User Joiend All Completed Matches Data..",
  //         status: true,
  //         data: JoiendMatches,
  //       };
  //     } else {
  //       return {
  //         message: "No Data Found..",
  //         status: false,
  //         data: [],
  //       };
  //     }
  //   } catch (error) {
  //     console.log(error);
  //     throw error;
  //   }
  // }

  async fetchCompletedMatchData(req) {
    try {
      let skip = Number(req.query?.skip) || 0;
      let limit = Number(req.query?.skip) || 10;
      const aggPipe = [
        {
          '$match': {
            'userId': new mongoose.Types.ObjectId(req.user._id),
          }
        }, {
          '$group': {
            '_id': '$matchkey',
            'data': {
              '$push': '$$ROOT'
            },
            // 'joinedcontest': {
            //   '$sum': 1
            // },
            'finalresultsTotalAmount': {
              '$sum': '$amount'
            },
            'joinedcontest': { $addToSet: "$challengeid" }
          }
        },
        {
          $addFields: {
            joinedcontest: { $size: "$joinedcontest" } // Count unique challenge IDs
          }
        }, {
          '$lookup': {
            'from': 'matches',
            'localField': '_id',
            'foreignField': '_id',
            'as': 'match'
          }
        }, {
          '$unwind': {
            'path': '$match'
          }
        }, {
          '$sort': {
            'joinedcontest': -1
          }
        }, {
          '$match': {
            'match.final_status': {
              '$in': [
                'IsCanceled', 'IsAbandoned', 'winnerdeclared'
              ]
            },
            'match.fantasy_type': 'Cricket',
            'match.launch_status': 'launched'
          }
        }, {
          '$lookup': {
            'from': 'userteam',
            'let': {
              'matchkey': '$_id'
            },
            'pipeline': [
              {
                '$match': {
                  '$expr': {
                    '$and': [
                      {
                        '$eq': [
                          '$userid', new mongoose.Types.ObjectId(req.user._id)
                        ]
                      }, {
                        '$eq': [
                          '$matchkey', '$$matchkey'
                        ]
                      }
                    ]
                  }
                }
              }, {
                '$count': 'totalJointeam'
              }
            ],
            'as': 'total_teams'
          }
        },
        {
          $addFields: {
            "match_start_date": { $toDate: "$match.start_date" } // Convert string to MongoDB ISODate
          }
        },
        {
          $sort: {
            'match_start_date': -1
          }
        },
        {
          '$project': {
            'total_teams': {
              '$cond': {
                'if': {
                  '$gt': [
                    {
                      '$size': '$total_teams'
                    }, 0
                  ]
                },
                'then': {
                  '$arrayElemAt': [
                    '$total_teams.totalJointeam', 0
                  ]
                },
                'else': 0
              }
            },
            'matchkey': '$_id',
            'matchname': '$match.name',
            'format': '$match.format',
            'winning_status': {
              $cond: {
                if: {
                  $ifNull: ["$match.winning_status", null]
                },
                then: "$match.winning_status",
                else: ""
              }
            },
            'team1ShortName': '$match.teamA.short_name',
            'team2ShortName': '$match.teamB.short_name',
            'team1fullname': '$match.teamA.teamName',
            'team2fullname': '$match.teamB.teamName',
            'team1color': {
              '$cond': {
                'if': {
                  '$ifNull': [
                    '$match.teamA.color', ''
                  ]
                },
                'then': '$match.teamA.color',
                'else': ''
              }
            },
            'team2color': {
              '$cond': {
                'if': {
                  '$ifNull': [
                    '$match.teamB.name', ''
                  ]
                },
                'then': '$match.teamB.color',
                'else': ''
              }
            },
            'team1logo': {
              '$ifNull': [
                {
                  '$cond': {
                    'if': {
                      '$or': [
                        {
                          '$eq': [
                            {
                              '$substr': [
                                '$match.teamA.logo', 0, 1
                              ]
                            }, '/'
                          ]
                        }, {
                          '$eq': [
                            {
                              '$substr': [
                                '$match.teamA.logo', 0, 1
                              ]
                            }, 't'
                          ]
                        }
                      ]
                    },
                    'then': {
                      '$concat': [
                        `${global.constant.IMAGE_URL}`, '', '$match.teamA.logo'
                      ]
                    },
                    'else': '$match.teamA.logo'
                  }
                }, `${global.constant.IMAGE_URL}team_image.png`
              ]
            },
            'team2logo': {
              '$ifNull': [
                {
                  '$cond': {
                    'if': {
                      '$or': [
                        {
                          '$eq': [
                            {
                              '$substr': [
                                '$match.teamB.logo', 0, 1
                              ]
                            }, '/'
                          ]
                        }, {
                          '$eq': [
                            {
                              '$substr': [
                                '$match.teamB.logo', 0, 1
                              ]
                            }, 't'
                          ]
                        }
                      ]
                    },
                    'then': {
                      '$concat': [
                        `${global.constant.IMAGE_URL}`, '', '$match.teamB.logo'
                      ]
                    },
                    'else': '$match.teamB.logo'
                  }
                }, `${global.constant.IMAGE_URL}team_image.png`
              ]
            },
            'start_date': '$match.start_date',
            'status': '$match.status',
            'totalWinningAmount': '$finalresultsTotalAmount',
            'launch_status': '$match.launch_status',
            'final_status': '$match.final_status',
            'series_name': '$match.seriesData.name',
            'type': '$match.fantasy_type',
            'series_id': '$match.series',
            'available_status': { $toInt: '1' },
            // 'joinedcontest': '$joinedcontest',
            'joinedcontest': 1
          }
        },
        {
          $skip: skip
        }, {
          $limit: limit
        }
      ];
      // console.log(JSON.stringify(aggPipe));
      const JoiendMatches = await userLeaderBoardModel.aggregate(aggPipe);
      if (JoiendMatches.length === 0) {
        return {
          message: "No Data Found..",
          status: false,
          data: [],
        };
      }
      return {
        message: "User Joiend All Completed Matches Data..",
        status: true,
        data: JoiendMatches,
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async fetchCompletedMatchesList(req) {
    try {
      let fantasy = req.query.fantasy_type || "Cricket";
      // let keyname = `completed-matches`;
      let cursor = req.query?.cursor || 0;
      let keyname = `user:${req.user._id}:completed_new_matches_xyz_y`;
      let limit = Number(req.query?.limit) || 20;
      // let redisdata = await redisCompletedMatch.getKeysPaginated(keyname, number(req.query.limit), number(req.query.skip));
      // console.log(keyname,"popopop")
      const result = await redisCompletedMatch.getKeysPaginated(keyname, 0, limit);
      cursor = result.nextCursor;
      if (!result.redisdata || result.redisdata.length === 0) {
        let obj = [
          {
            $match: {
              userId: new mongoose.Types.ObjectId(req.user._id),
            }
          },
          {
            $group: {
              _id: "$matchkey"
            }
          },
          {
            $lookup: {
              from: "matches",
              localField: "_id",
              foreignField: "_id",
              pipeline: [
                {
                  $match: {
                    final_status: "winnerdeclared"
                  }
                },
                {
                  $project: {
                    start_date: 1
                  }
                }
              ],
              as: "matchdata"
            }
          },
          {
            $unwind: {
              path: "$matchdata"
            }
          },
          {
            $sort: {
              "matchdata.start_date": -1
            }
          }, {
            $limit: 100
          },
          {
            $sort: {
              "matchdata.start_date": 1
            }
          }
        ]
        let userContest = await userLeaderBoardModel.aggregate(obj);
        console.log('userContest', userContest.length);
        if (userContest.length > 0) {
          let total = 1;
          for (let match of userContest) {
            total = await redisCompletedMatch.redis.zcard(keyname);
            await redisCompletedMatch.redis.zadd(
              keyname,
              { score: Number(total), member: match._id }
            );
            // await redisCompletedMatch.redis.zadd(keyname, Number(total), match._id);
            await redisCompletedMatch.redis.expire(keyname, 60 * 60 * 24 * 3); // 1 hour
          }
        } else {
          return { message: "No Data Found", status: false, data: [] };
        }
        let data = await redisCompletedMatch.retrieveSortedSet(keyname, 0, limit);
        nextCursor = data?.nextCursor || '';
        redisdata = data.redisdata;
        hasMore = data?.hasMore || '';
      }

      let joinedMatches = [];
      let totalWinningAmount = 0;
      await Promise.all(
        redisdata.map(async (matchdata) => {
          let matchid = matchdata;
          if (matchid) {
            let keyMatchRun = `listMatchesModel-${matchid}`;
            let match = await redisjoinTeams.getkeydata(keyMatchRun);

            if (!match) {
              match = await matchesModel.findOne({
                _id: new mongoose.Types.ObjectId(matchid),
              });
              if (match) {
                await redisjoinTeams.setkeydata(keyname, keyMatchRun, 3 * 24 * 60 * 60);
              } else {
                return;
              }
            }

            if (match.final_status == 'winnerdeclared' || match.final_status == 'IsCanceled' || match.final_status == 'IsAbandoned') {
              const redisCompletedContestKey = `match:${matchid}:user:${req.user._id}:totalContest`;
              let totalUserContest = await redisCompletedMatch.redis.get(redisCompletedContestKey);

              let userContest = false;
              var expRedisTime = await matchTimeDifference(matchid);
              if (!totalUserContest) {
                let obj = { userId: new mongoose.Types.ObjectId(req.user._id), matchkey: matchid };
                userContest = await userLeaderBoardModel.find(obj).lean();
                (userContest && userContest.length > 0) ? await redisCompletedMatch.redis.set(redisCompletedContestKey, Number(userContest.length), { "ex": expRedisTime * 30 }) : [];
                totalUserContest = Number(userContest.length);
              }
              const redisCompletedKey = `match:${matchid}:user:${req.user._id}:totalTeams`;
              let totalUserTeams = await redisCompletedMatch.redis.get(redisCompletedKey);

              if (!totalUserTeams) {
                let cachedTeams = await userTeamModel.find({
                  userid: new mongoose.Types.ObjectId(req.user._id),
                  matchkey: new mongoose.Types.ObjectId(matchid),
                }).lean();
                (cachedTeams && cachedTeams.length > 0) ? await redisCompletedMatch.redis.set(redisCompletedKey, Number(cachedTeams.length), { "ex": expRedisTime }) : []
                totalUserTeams = cachedTeams.length;
              }
              if (totalUserContest <= 0) {
                return;
              }
              if (totalUserContest && totalUserContest > 0) {
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
                  total_teams: Number(totalUserTeams),
                  second_inning_status: match.second_inning_status,
                  team1logo: `${global.constant.IMAGE_URL}${match.teamA?.logo || "default_team1.png"}`,
                  team2logo: `${global.constant.IMAGE_URL}${match.teamB?.logo || "default_team2.png"}`,
                  status: status,
                  launch_status: match.launch_status,
                  final_status: match.final_status,
                  series_name: match.seriesData?.name || "Unknown",
                  type: match.fantasy_type,
                  series_id: match.series,
                  available_status: 1,
                  joinedcontest: Number(totalUserContest),
                  playing11_status: match.playing11_status,
                  textNote: match.textNote || "",
                  real_matchkey: match.real_matchkey,
                  contestType: "old",
                  mega: match?.mega || 0,
                  WinningpriceAndPrize: "",
                  image: "",
                  totalWinningAmount: totalWinningAmount
                };
                joinedMatches.push(data);
              }
            }
          }
        })

      );
      joinedMatches.sort((a, b) => moment(b.start_date) - moment(a.start_date));
      return joinedMatches.length > 0
        ? { message: "User joined latest 5 Upcoming and live match data..", status: true, data: joinedMatches, cursor }
        : { message: "No Data Found..", status: false, data: [] };
    } catch (error) {
      console.error("Error in NewjoinedmatchesLive:", error);
      return { message: "Something went wrong!", status: false, error: error.message };
    }
  }
  async AllNewCompletedMatches(req) {
    try {
      let fantasy = req.query.fantasy_type || "Cricket";
      // let keyname = `completed-matches`;
      // let redisdata = await redisMain.retrieveLiveSortedSet(keyname);
      // // console.log('redisdata', redisdata);
      // if (!redisdata || redisdata.length === 0) {
      //   return { message: "No Data Found", status: false, data: [] };
      // }
      let cursor = req.query?.cursor || 0;
      let keyname = `user:${req.user._id}:completed_all_matches`;
      let limit = Number(req.query?.limit) || 20;
      // let redisdata = await redisCompletedMatch.getKeysPaginated(keyname, number(req.query.limit), number(req.query.skip));
      let { nextCursor, redisdata, hasMore } = await redisCompletedMatch.retrieveSortedSet(keyname, Number(cursor), limit);
      cursor = nextCursor;
      if (!redisdata || redisdata.length === 0) {
        let obj = [
          {
            $match: {
              userId: new mongoose.Types.ObjectId(req.user._id),
            }
          },
          {
            $group: {
              _id: "$matchkey"
            }
          },
          {
            $lookup: {
              from: "matches",
              localField: "_id",
              foreignField: "_id",
              pipeline: [
                {
                  $match: {
                    final_status: "winnerdeclared"
                  }
                },
                {
                  $project: {
                    start_date: 1
                  }
                }
              ],
              as: "matchdata"
            }
          },
          {
            $unwind: {
              path: "$matchdata"
            }
          },
          {
            $sort: {
              "matchdata.start_date": -1
            }
          }, {
            $limit: 100
          },
          {
            $sort: {
              "matchdata.start_date": 1
            }
          }
        ]
        let userContest = await userLeaderBoardModel.aggregate(obj);
        if (userContest.length > 0) {
          let total = 1;
          for (let match of userContest) {
            total = await redisCompletedMatch.redis.zcard(keyname);
            await redisCompletedMatch.redis.zadd(keyname, Number(total), match._id);
            await redisCompletedMatch.redis.expire(keyname, 60 * 60 * 24 * 3); // 1 hour
          }
        } else {
          return { message: "No Data Found", status: false, data: [] };
        }
        let data = await redisCompletedMatch.retrieveSortedSet(keyname, Number(cursor), limit);
        nextCursor = data?.nextCursor || '';
        redisdata = data.redisdata;
        hasMore = data?.hasMore || '';
      }
      if (!redisdata || redisdata.length <= 0) {
        return { message: "No Data Found", status: false, data: [] };
      }
      // console.log('redisdata', redisdata);
      let joinedMatches = [];
      // Parallel execution to optimize performance
      let totalWinningAmount = 0;
      await Promise.all(
        redisdata.map(async (matchdata) => {
          let matchid = matchdata;
          if (matchid) {
            let keyMatch = `completedMatchesSet`;
            // let match = await redisjoinTeams.getkeydata(keyMatchRun);
            // let match = await redisCompletedMatch.hgetNewAllData('completedMatchesSet');

            let match1 = Object.values(await redisCompletedMatch.hgetNewAllData(keyMatch) || {}).filter(mc => mc?._id == matchid);
            let match = match1[0];

            if (!match) {
              match = await matchesModel.findOne({
                _id: new mongoose.Types.ObjectId(matchid),
              });
              if (match) {
                await redisCompletedMatch.storeSortedSet(keyMatch, match, 60 * 60 * 24 * 90);
              } else {
                return;
              }
            }


            if (match.final_status == 'winnerdeclared' || match.final_status == 'IsCanceled' || match.final_status == 'IsAbandoned') {
              const redisCompletedContestKey = `match:${matchid}:user:${req.user._id}:total`;
              let totalUserContest = await redisCompletedMatch.getkeydata(redisCompletedContestKey);
              let userContest = false;
              var expRedisTime = await matchTimeDifference(matchid);
              if (!totalUserContest) {
                let obj = [
                  {
                    $match: {
                      userId: new mongoose.Types.ObjectId(req.user._id),
                      matchkey: new mongoose.Types.ObjectId(matchid)
                    }
                  },
                  {
                    $group:
                    {
                      _id: null,
                      totalSize: {
                        $addToSet: "$challengeid"
                      },
                      totalAmount: {
                        $sum: "$amount"
                      }
                    }
                  }
                ]
                userContest = await userLeaderBoardModel.aggregate(obj);

                if (userContest && userContest.length > 0) {
                  let cachedTeams = await userTeamModel.find({
                    userid: new mongoose.Types.ObjectId(req.user._id),
                    matchkey: new mongoose.Types.ObjectId(matchid),
                  }).lean();
                  let data = {
                    totalTeams: cachedTeams.length,
                    totalContest: userContest[0].totalSize.length,
                    totalAmount: userContest[0].totalAmount
                  }
                  await redisCompletedMatch.setkeydata(redisCompletedContestKey, data, expRedisTime * 3);
                  totalUserContest = data;
                }
              }
              if (!totalUserContest) {
                return;
              }
              if (totalUserContest && totalUserContest?.totalContest > 0) {
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
                  total_teams: Number(totalUserContest.totalTeams) || 1,
                  team1logo: `${global.constant.IMAGE_URL}${match.teamA?.logo || "default_team1.png"}`,
                  team2logo: `${global.constant.IMAGE_URL}${match.teamB?.logo || "default_team2.png"}`,
                  status: status,
                  launch_status: match.launch_status,
                  final_status: match.final_status,
                  series_name: match.seriesData?.name || "Unknown",
                  type: match.fantasy_type,
                  series_id: match.series,
                  available_status: 1,
                  joinedcontest: Number(totalUserContest.totalContest) || 1,
                  playing11_status: match.playing11_status,
                  textNote: match.textNote || "",
                  real_matchkey: match.real_matchkey,
                  contestType: "old",
                  mega: match?.mega || 0,
                  WinningpriceAndPrize: "",
                  image: "",
                  totalWinningAmount: totalUserContest?.totalAmount || 0
                };
                joinedMatches.push(data);
              }
            }
          }
        })

      );
      joinedMatches.sort((a, b) => moment(b.start_date) - moment(a.start_date));
      return joinedMatches.length > 0
        ? { message: "User joined latest 5 Upcoming and live match data..", status: true, data: joinedMatches }
        : { message: "No Data Found..", status: false, data: [] };
    } catch (error) {
      console.error("Error in NewjoinedmatchesLive:", error);
      return { message: "Something went wrong!", status: false, error: error.message };
    }
  }

  async fetchCompletedDuoMatches(req) {
    try {
      let fantasy = req.query.fantasy_type || "Cricket";
      let keyname = `completed-matches`;
      let redisdata = await redisMain.retrieveLiveSortedSet(keyname);
      // console.log('redisdata', redisdata);
      if (!redisdata || redisdata.length === 0) {
        return { message: "No Data Found", status: false, data: [] };
      }

      let joinedMatches = [];
      let totalWinningAmount = 0;
      await Promise.all(
        redisdata.map(async (matchdata) => {
          let matchid = matchdata;
          if (matchid) {
            let keyMatchRun = `listMatchesModel-${matchid}`;
            let match = await redisjoinTeams.getkeydata(keyMatchRun);

            if (!match) {
              match = await matchesModel.findOne({
                _id: new mongoose.Types.ObjectId(matchid),
              });
              if (match) {
                await redisjoinTeams.setkeydata(keyname, keyMatchRun, 3 * 24 * 60 * 60);
              } else {
                return;
              }
            }

            if (match.final_status == 'winnerdeclared' || match.final_status == 'IsCanceled' || match.final_status == 'IsAbondoned') {
              const redisCompletedContestKey = `match:${matchid}:user:${req.user._id}:joinedDuoContests`;
              let totalUserContest = await redisCompletedMatch.redis.get(redisCompletedContestKey);
              let userContest = false;
              var expRedisTime = await matchTimeDifference(matchid);
              if (!totalUserContest) {
                userContest = await duoleaderBoardModel.find({ userId: new mongoose.Types.ObjectId(req.user._id), matchkey: matchid });
                (userContest && userContest.length > 0) ? await redisCompletedMatch.redis.set(redisCompletedContestKey, Number(userContest.length), { "ex": expRedisTime * 30 }) : [];
                totalUserContest = Number(userContest.length);
              }

              if (totalUserContest <= 0) {
                return;
              }
              if (totalUserContest && totalUserContest > 0) {
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
                  joinedcontest: Number(totalUserContest),
                  playing11_status: match.playing11_status,
                  textNote: match.textNote || "",
                  real_matchkey: match.real_matchkey,
                  contestType: "old",
                  mega: match?.mega || 0,
                  WinningpriceAndPrize: "",
                  image: "",
                  totalWinningAmount: totalWinningAmount
                };
                joinedMatches.push(data);
              }
            }
          }
        })

      );
      joinedMatches.sort((a, b) => moment(b.start_date) - moment(a.start_date));
      return joinedMatches.length > 0
        ? { message: "User joined latest 5 Upcoming and live match data..", status: true, data: joinedMatches }
        : { message: "No Data Found..", status: false, data: [] };
    } catch (error) {
      console.error("Error in NewjoinedmatchesLive:", error);
      return { message: "Something went wrong!", status: false, error: error.message };
    }
  }

  async updatedCompltedMatchRedis(req, res) {
    try {
      let fantasy = "Cricket";
      let matchpipe = [];
      const fantasy_type = fantasy;

      matchpipe.push({
        $match: {
          fantasy_type: fantasy_type,
          final_status: { $in: ['IsCanceled', 'IsAbandoned', 'winnerdeclared'] },
          launch_status: "launched",
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

      matchpipe.push({
        $addFields: {
          date: {
            $dateFromString: {
              dateString: "$start_date",
              timezone: "-00:00",
            },
          },
        },
      });

      matchpipe.push({
        $match: {
          $expr: {
            $lte: ["$date", today],
          },
        },
      });

      matchpipe.push({
        $sort: {
          date: -1, // हाल के मैच पहले दिखाने के लिए
        },
      });

      matchpipe.push({
        $limit: 15, // केवल अंतिम 15 मैच प्राप्त करने के लिए
      });

      let result = await matchesModel.aggregate(matchpipe);

      if (result.length > 0) {
        for (let match of result) {
          let matchKeyName = `completed-matches`;
          let data = {
            _id: match._id,
            order: 1
          };
          await redisMain.storeLiveMatches(matchKeyName, data, 60 * 60 * 24 * 30);
        }
      }

      return result;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async matchPlayerFantasyScoreCards1(req) {
    try {
      console.log("hello");
      let finalData = [],
        aggpipe = [],
        ends = ["th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th"];
      aggpipe.push({
        $match: {
          matchkey: new mongoose.Types.ObjectId(req.query.matchkey),
          playingstatus: 1,
          // playerid: new mongoose.Types.ObjectId(req.query.playerid),
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
                      then: `${global.constant.IMAGE_URL}players/white_team1.png`,
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
          //duck: { $arrayElemAt: ['$result.duck', 0] },
          duck: { $arrayElemAt: ["$resultpoint.negative", 0] }, //by
          innings: { $arrayElemAt: ["$result.innings", 0] },
          teamShortName: 1,
          startingpoints: { $arrayElemAt: ["$resultpoint.startingpoints", 0] },
          runs: { $arrayElemAt: ["$resultpoint.runs", 0] },
          fours: { $arrayElemAt: ["$resultpoint.fours", 0] },
          sixs: { $arrayElemAt: ["$resultpoint.six", 0] },
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
          thrower: {
            $sum: [
              {
                $convert: {
                  input: { $arrayElemAt: ["$resultpoint.thrower", 0] },
                  to: "int",
                  onError: 0,
                  onNull: 0,
                },
              },
              {
                $convert: {
                  input: { $arrayElemAt: ["$resultpoint.hitter", 0] },
                  to: "int",
                  onError: 0,
                  onNull: 0,
                },
              },
            ],
          },
          hitter: { $arrayElemAt: ["$resultpoint.hitter", 0] },
          catch: { $arrayElemAt: ["$resultpoint.catch", 0] },
          catchpoints: { $arrayElemAt: ["$resultpoint.catch", 0] },
          stumping: { $arrayElemAt: ["$resultpoint.stumping", 0] },
          bonus: { $arrayElemAt: ["$resultpoint.bonus", 0] },
          halfcentury: { $arrayElemAt: ["$resultpoint.halfcentury", 0] },
          negative: { $arrayElemAt: ["$resultpoint.negative", 0] },
          total: { $arrayElemAt: ["$resultpoint.total", 0] },
          wicketbonuspoint: {
            $arrayElemAt: ["$resultpoint.wicketbonuspoint", 0],
          },
          selectper: { $ifNull: ["$totalSelected", "0"] },
          thirty: { $arrayElemAt: ["$resultpoint.thirtypoints", 0] },
        },
      });
      aggpipe.push({
        $addFields: {
          stumping: { $sum: ["$stumping", "$thrower"] },
        },
      });
      const matchplayer = await matchPlayersModel.aggregate(aggpipe);
      // console.log("matchplayer" + JSON.stringify(matchplayer));
      // matchplayer[0].thirty=0;
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

  async playersFantasyScoreCard(req) {
    try {
      let matchKey = req.query.matchkey;
      console.log("matchKey", matchKey);
      let keyMatchRun = `listMatchesModel-${req.query.matchkey}`;
      let match = await redisjoinTeams.getkeydata(keyMatchRun);

      if (!match) {
        match = await matchesModel.findOne({
          _id: new mongoose.Types.ObjectId(req.query.matchkey),
        });
        if (match) {
          await redisjoinTeams.setkeydata(keyMatchRun, match, 3 * 24 * 60 * 60);
        } else {
          return;
        }
      }

      let scoreDataArray = await redisCompletedMatch.hgetAllDataResult(`match:${matchKey.toString()}:resultMatches_data`);
      if (!scoreDataArray || scoreDataArray.length <= 0) {
        scoreDataArray = await resultMatchModel.find({ matchkey: new mongoose.Types.ObjectId(matchKey) });
      }

      let pointKeyArray = await redisCompletedMatch.hgetAllDataResult(`match:${matchKey.toString()}:resultPoints_data`);
      if (!pointKeyArray || pointKeyArray.length <= 0) {
        pointKeyArray = await resultPointModel.find({ matchkey: new mongoose.Types.ObjectId(matchKey) });
      }

      const keyName = `playerList-matchkey-${match.real_matchkey}`;
      let getMatchPlayers = await redisjoinTeams.getkeydata(keyName) || [];
      let playersData = [];
      if (getMatchPlayers.length > 0) {
        for (let player of getMatchPlayers) {
          if (player.playingstatus == 1) {
            // const scoreKey = `match:${matchKey.toString()}:resultMatches_data`;
            // const pointKey = `match:${matchKey.toString()}:resultPoints_data`;
            // let [scoreData, pointData] = await Promise.all([
            //   redisLiveJoinTeams.hgetData(scoreKey, player.playerid),
            //   redisLiveJoinTeams.hgetData(pointKey, player.playerid)
            // ]);
            let scoreData, pointData;
            if (scoreDataArray.length > 0) {
              scoreData = scoreDataArray.find(
                (entry) => entry.player_id?.toString() === player.playerid.toString()
              );
            }
            if (pointKeyArray.length > 0) {
              pointData = pointKeyArray.find(
                (entry) => entry.player_id?.toString() === player.playerid.toString()
              );
            }
            let actual = '0';
            let points = 0;

            if (pointData?.twentyFivePoints > 0) {
              actual = "25+";
              points = Number(pointData?.twentyFivePoints);
            } else if (pointData?.thirtypoints > 0) {
              actual = "30+";
              points = Number(pointData?.thirtypoints);
            } else if (pointData?.halfcentury > 0) {
              actual = "50+";
              points = Number(pointData?.halfcentury);
            } else if (pointData?.seventyFivePoints > 0) {
              actual = "75+";
              points = Number(pointData?.seventyFivePoints);
            } else if (pointData?.century > 0) {
              actual = "100+";
              points = Number(pointData?.century);
            } else if (pointData?.oneTwoFivePoints > 0) {
              actual = "100+";
              points = Number(pointData?.oneTwoFivePoints);
            }
            let wicketActual = 0;
            let wicketPoints = 0;

            if (pointData?.twoWicketPoints > 0) {
              wicketPoints += Number(pointData?.twoWicketPoints);
            } else if (pointData?.threeWicketPoints > 0) {
              wicketPoints += Number(pointData?.threeWicketPoints);
            } else if (pointData?.fourWicketPoints > 0) {
              wicketPoints += Number(pointData?.fourWicketPoints);
            } else if (pointData?.fiveWicketPoints > 0) {
              wicketPoints += Number(pointData?.fiveWicketPoints);
            } else if (pointData?.sixWicketPoints > 0) {
              wicketPoints += Number(pointData?.sixWicketPoints);
            }
            const card = [
              { type: "6's", actual: scoreData?.six || 0, points: Number(pointData?.sixs) || 0 },
              { type: "4's", actual: scoreData?.fours || 0, points: Number(pointData?.fours) || 0 },
              { type: "Runs", actual: scoreData?.runs || 0, points: Number(pointData?.runs) || 0 },
              { type: "Catch Points", actual: scoreData?.catch || 0, points: Number(pointData?.catch) || 0 },
              { type: "Strike Rate", actual: scoreData?.strike_rate || 0, points: Number(pointData?.strike_rate) || 0 },
              { type: "Dot Ball", actual: scoreData?.balldots || 0, points: Number(pointData?.dotball) || 0 },
              { type: "Ball Faced", actual: scoreData?.bball || 0, points: 0 },//-100 frontend show NA
              {
                type: "25/30/50/100",
                actual,
                points
              },
              {
                type: "2/3/5 Wicket Bonus",
                actual: scoreData?.wicket || 0,
                points: wicketPoints
              },
              { type: "Wickets", actual: scoreData?.wicket || 0, points: Number(pointData?.wickets) || 0 },
              { type: "Maiden Over", actual: scoreData?.maiden_over || 0, points: Number(pointData?.maidens) || 0 },
              { type: "Economy Rate", actual: scoreData?.economy_rate || 0, points: Number(pointData?.economy_rate) || 0 },
              { type: "Runout", actual: scoreData?.runouts || 0, points: Number(pointData?.runouts) || 0 },
              { type: "Stumping", actual: scoreData?.stumbed || 0, points: Number(pointData?.stumping) || 0 },
              { type: "Thrower", actual: scoreData?.thrower || 0, points: Number(pointData?.thrower) || 0 },
              { type: "Hitter", actual: scoreData?.hitter || 0, points: Number(pointData?.hitter) || 0 },
              { type: "Bonus", actual: Number(pointData?.bonus) || 0, points: Number(pointData?.bonus) || 0 },
              { type: "Duck", actual: scoreData?.negative_points || 0, points: Number(pointData?.negative) || 0 },
              { type: "LBW", actual: 0, points: Number(pointData?.wicketbonuspoint) || 0 },
              { type: "Starting Point", actual: Number(pointData?.startingpoints) || 0, points: Number(pointData?.startingpoints) || 0 },
              { type: "Total", actual: scoreData?.total_points || 0, points: Number(pointData?.total) || 0 }
            ];
            let playerData = {
              "_id": player.playerid,
              "credit": player.credit,
              teamShortName: player.team_short_name,
              "totalSelected": player.totalSelected,
              "image": player.image,
              "total": player.points,
              "role": player.role,
              "name": player.name,
              card
            }
            playersData.push(playerData);
          }
        }
      }

      if (playersData.length > 0) {
        return {
          message: "Data Found Successfully !!",
          status: true,
          data: playersData,
        };
      } else {
        return {
          message: "Match Players stats data not found...",
          status: false,
          data: [],
        };
      }
    } catch (error) {
      throw error;
    }
  }

  async matchPlayerTeamsDataRedis(req) {
    let teamId = req.query.teamid;
    let matchkey = req.query.matchkey;
    let keyMatchRun = `listMatchesModel-${matchkey}`;

    let match = await redisjoinTeams.getkeydata(keyMatchRun);

    if (!match) {
      match = await matchesModel.findOne({ _id: new mongoose.Types.ObjectId(matchkey) });
      if (match) {
        await redisjoinTeams.setkeydata(keyMatchRun, match, 3 * 24 * 60 * 60);
      } else {
        return { message: "Match not found", status: false, data: [] };
      }
    }

    const redisKey = `match:${matchkey}:user:${req.user._id}:teams`;
    let teams = await redisjoinTeams.getkeydata(redisKey) || [];

    if (!teams.length) {
      // teams = await this.setTeamsInRedis(req.user._id, matchkey);
      return { message: "Teams not available", status: false, data: [] };
    }

    const team = teams.find(item => item._id.toString() === teamId.toString());

    if (!team) {
      return { message: "Team not found", status: false, data: [] };
    }

    const keyName = `playerList-matchkey-${match.real_matchkey}`;
    let playersData = await redisjoinTeams.getkeydata(keyName);

    if (!playersData || playersData.length === 0) {
      playersData = await this.setPlayersInRedis(matchkey, match.team2Id, match.real_matchkey);
    }

    const playersMap = playersData.reduce((acc, player) => {
      acc[player.playerid] = player;
      return acc;
    }, {});

    let scoreDataArray = await redisCompletedMatch.hgetAllDataResult(`match:${matchkey.toString()}:resultMatches_data`);

    if (!scoreDataArray || scoreDataArray.length <= 0) {
      scoreDataArray = await resultMatchModel.find({ matchkey: new mongoose.Types.ObjectId(matchkey) });
    }

    let pointKeyArray = await redisCompletedMatch.hgetAllDataResult(`match:${matchkey.toString()}:resultPoints_data`);;
    if (!pointKeyArray || pointKeyArray.length <= 0) {
      pointKeyArray = await resultPointModel.find({ matchkey: new mongoose.Types.ObjectId(matchkey) });
    }
    // console.log('scoreDataArray', scoreDataArray);
    const players = await Promise.all(
      team.players.map(async (playerId) => {
        const player = playersMap[playerId.toString()];
        // const scoreKey = `match:${matchkey}:resultMatches_data`;
        // const pointKey = `match:${matchkey}:resultPoints_data`;

        // const [scoreData, pointData] = await Promise.all([
        //   redisLiveJoinTeams.hgetData(scoreKey, player.playerid),
        //   redisLiveJoinTeams.hgetData(pointKey, player.playerid)
        // ]);
        let scoreData, pointData;
        if (scoreDataArray.length > 0) {
          scoreData = scoreDataArray.find(
            (entry) => entry.player_id?.toString() === player.playerid.toString()
          );
        }
        if (pointKeyArray.length > 0) {
          pointData = pointKeyArray.find(
            (entry) => entry.player_id?.toString() === player.playerid.toString()
          );
        }
        if (playerId.toString() === team.captain.toString()) {
          player.points = Number(player.points) * 2
        }
        if (playerId.toString() === team.vicecaptain.toString()) {
          player.points = Number(player.points) * 1.5
        }
        let actual = '0';
        let points = 0;

        if (pointData?.twentyFivePoints > 0) {
          actual = "25+";
          points = Number(pointData?.twentyFivePoints);
        } else if (pointData?.thirtypoints > 0) {
          actual = "30+";
          points = Number(pointData?.thirtypoints);
        } else if (pointData?.halfcentury > 0) {
          actual = "50+";
          points = Number(pointData?.halfcentury);
        } else if (pointData?.seventyFivePoints > 0) {
          actual = "75+";
          points = Number(pointData?.seventyFivePoints);
        } else if (pointData?.century > 0) {
          actual = "100+";
          points = Number(pointData?.century);
        } else if (pointData?.oneTwoFivePoints > 0) {
          actual = "100+";
          points = Number(pointData?.oneTwoFivePoints);
        }
        let wicketActual = 0;
        let wicketPoints = 0;

        if (pointData?.twoWicketPoints > 0) {
          wicketPoints += Number(pointData?.twoWicketPoints);
        } else if (pointData?.threeWicketPoints > 0) {
          wicketPoints += Number(pointData?.threeWicketPoints);
        } else if (pointData?.fourWicketPoints > 0) {
          wicketPoints += Number(pointData?.fourWicketPoints);
        } else if (pointData?.fiveWicketPoints > 0) {
          wicketPoints += Number(pointData?.fiveWicketPoints);
        } else if (pointData?.sixWicketPoints > 0) {
          wicketPoints += Number(pointData?.sixWicketPoints);
        }

        const card = [
          { type: "6's", actual: scoreData?.six || 0, points: Number(pointData?.sixs) || 0 },
          { type: "4's", actual: scoreData?.fours || 0, points: Number(pointData?.fours) || 0 },
          { type: "Runs", actual: scoreData?.runs || 0, points: Number(pointData?.runs) || 0 },
          { type: "Catch Points", actual: scoreData?.catch || 0, points: Number(pointData?.catch) || 0 },
          { type: "Strike Rate", actual: scoreData?.strike_rate || 0, points: Number(pointData?.strike_rate) || 0 },
          { type: "Dot Ball", actual: scoreData?.balldots || 0, points: Number(pointData?.dotball) || 0 },
          { type: "Ball Faced", actual: scoreData?.bball || 0, points: 0 },//-100 frontend show NA
          {
            type: "25/30/50/100",
            actual,
            points
          },
          {
            type: "2/3/5 Wicket Bonus",
            actual: scoreData?.wicket || 0,
            points: wicketPoints
          },
          { type: "Wickets", actual: scoreData?.wicket || 0, points: Number(pointData?.wickets) || 0 },
          { type: "Maiden Over", actual: scoreData?.maiden_over || 0, points: Number(pointData?.maidens) || 0 },
          { type: "Economy Rate", actual: scoreData?.economy_rate || 0, points: Number(pointData?.economy_rate) || 0 },
          { type: "Runout", actual: scoreData?.runouts || 0, points: Number(pointData?.runouts) || 0 },
          { type: "Stumping", actual: scoreData?.stumbed || 0, points: Number(pointData?.stumping) || 0 },
          { type: "Thrower", actual: scoreData?.thrower || 0, points: Number(pointData?.thrower) || 0 },
          { type: "Hitter", actual: scoreData?.hitter || 0, points: Number(pointData?.hitter) || 0 },
          { type: "Bonus", actual: Number(pointData?.bonus) || 0, points: Number(pointData?.bonus) || 0 },
          { type: "Duck", actual: scoreData?.negative_points || 0, points: Number(pointData?.negative) || 0 },
          { type: "LBW", actual: 0, points: Number(pointData?.wicketbonuspoint) || 0 },
          { type: "Starting Point", actual: Number(pointData?.startingpoints) || 0, points: Number(pointData?.startingpoints) || 0 },
          { type: "Total", actual: scoreData?.total_points || 0, points: Number(pointData?.total) || 0 }
        ];

        return {
          _id: player.playerid,
          credit: player.credit,
          totalSelected: player.totalSelected,
          image: player.image,
          total: player.points,
          role: player.role,
          name: player.name,
          teamShortName: player.team_short_name,
          card
        };
      })
    );

    return {
      message: "Player data fetched",
      status: true,
      data: players
    };
  }

  async allMatchPlayerDetails(matchkey) {
    try {
      let pipe = [
        {
          $match: {
            matchkey: new mongoose.Types.ObjectId(
              matchkey
            ),
          }
        },
        {
          $unwind: "$playersData"
        },
        {
          $lookup: {
            from: "matchplayers",
            let: {
              matchkey: "$matchkey",
              player_id: "$playersData.playerId"
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {
                        $eq: ["$matchkey", "$$matchkey"]
                      },
                      {
                        $eq: [
                          "$playerid",
                          "$$player_id"
                        ]
                      }
                    ]
                  }
                }
              }
            ],
            as: "playerDetails"
          }
        },
        {
          $unwind: {
            path: "$playerDetails",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: "resultmatches",
            let: {
              matchkey: "$matchkey",
              player_id: "$playersData.playerId"
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {
                        $eq: ["$matchkey", "$$matchkey"]
                      },
                      {
                        $eq: [
                          "$player_id",
                          "$$player_id"
                        ]
                      }
                    ]
                  }
                }
              }
            ],
            as: "playerScorecard"
          }
        },
        {
          $unwind: {
            path: "$playerScorecard",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: "resultpoints",
            let: {
              matchkey: "$matchkey",
              player_id: "$playersData.playerId"
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {
                        $eq: ["$matchkey", "$$matchkey"]
                      },
                      {
                        $eq: [
                          "$player_id",
                          "$$player_id"
                        ]
                      }
                    ]
                  }
                }
              }
            ],
            as: "playerPoints"
          }
        },
        {
          $unwind: {
            path: "$playerPoints",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $addFields: {
            image: `${global.constant.IMAGE_URL}black_team1.png`,
            credit: "$playersData.credit",
            totalSelected: "$playerDetails.totalSelected",
            card: [
              {
                type: "6's",
                actual: "$playerScorecard.six",
                points: "$playerPoints.sixs"
              },
              {
                type: "4's",
                actual: "$playerScorecard.fours",
                points: "$playerPoints.fours"
              },
              {
                type: "Runs",
                actual: "$playerScorecard.runs",
                points: "$playerPoints.runs"
              },
              {
                type: "Catch Points",
                actual: "$playerScorecard.catch",
                points: "$playerPoints.catch"
              },
              {
                type: "Strike Rate",
                actual: "$playerScorecard.strike_rate",
                points: "$playerPoints.strike_rate"
              },
              {
                type: "30/50/100",
                actual: {
                  $cond: {
                    if: {
                      $gt: [
                        "$playerPoints.thirtypoints",
                        0
                      ]
                    },
                    then: "30+",
                    else: {
                      $cond: {
                        if: {
                          $gt: [
                            "$playerPoints.halfcentury",
                            0
                          ]
                        },
                        then: "50+",
                        else: {
                          $cond: {
                            if: {
                              $gt: [
                                "$playerPoints.century",
                                0
                              ]
                            },
                            then: "100+",
                            else: 0
                          }
                        }
                      }
                    }
                  }
                },
                points: {
                  $cond: {
                    if: {
                      $gt: [
                        "$playerPoints.thirtypoints",
                        0
                      ]
                    },
                    then: "$playerPoints.thirtypoints",
                    else: {
                      $cond: {
                        if: {
                          $gt: [
                            "$playerPoints.halfcentury",
                            0
                          ]
                        },
                        then: "$playerPoints.halfcentury",
                        else: {
                          $cond: {
                            if: {
                              $gt: [
                                "$playerPoints.century",
                                0
                              ]
                            },
                            then: "$playerPoints.century",
                            else: 0
                          }
                        }
                      }
                    }
                  }
                }
              },
              {
                type: "Wickets",
                actual: "$playerScorecard.wicket",
                points: "$playerPoints.wickets"
              },
              {
                type: "Maiden Over",
                actual: "$playerScorecard.maiden_over",
                points: "$playerPoints.maidens"
              },
              {
                type: "Economy Rate",
                actual: "$playerScorecard.economy_rate",
                points: "$playerPoints.economy_rate"
              },
              {
                type: "Runout",
                actual: "$playerScorecard.runouts",
                points: "$playerPoints.runouts"
              },
              {
                type: "Stumping",
                actual: "$playerScorecard.stumbed",
                points: "$playerPoints.stumping"
              },
              {
                type: "Thrower",
                actual: "$playerScorecard.thrower",
                points: "$playerPoints.thrower"
              },
              {
                type: "Hitter",
                actual: "$playerScorecard.hitter",
                points: "$playerPoints.hitter"
              },
              {
                type: "Bonus",
                actual: "$playerPoints.bonus",
                points: "$playerPoints.bonus"
              },
              {
                type: "Duck",
                actual:
                  "$playerScorecard.negative_points",
                points: "$playerPoints.negative"
              },
              {
                type: "LBW",
                actual: "0",
                points: "$playerPoints.wicketbonuspoint"
              },
              {
                type: "Starting Point",
                actual: "$playerPoints.startingpoints",
                points: "$playerPoints.startingpoints"
              },
              {
                type: "Total",
                actual: "$playerScorecard.total_points",
                points: "$playerPoints.total"
              }
            ]
          }
        },
        {
          $project: {
            total: "$playerScorecard.total_points",
            playerId: "$playersData.playerId",
            role: "$playersData.role",
            name: "$playersData.playerName",
            card: 1,
            image: 1,
            credit: 1,
            totalSelected: 1
          }
        }
      ];
      const data = await userTeamModel.aggregate(pipe);
      if (data.length > 0) {
        return {
          message: "Data Found Successfully !!",
          status: true,
          data,
        };
      } else {
        return {
          message: "Match Players stats data not found...",
          status: false,
          data: [],
        };
      }
    } catch (error) {
      throw error;
    }
  }

  async matchPlayerTeamsData(req) {
    try {
      let pipe = [
        {
          $match: {
            _id: new mongoose.Types.ObjectId(
              req.query.teamid
            ),
          }
        },
        {
          $unwind: "$playersData"
        },
        {
          $lookup: {
            from: "matchplayers",
            let: {
              matchkey: "$matchkey",
              player_id: "$playersData.playerId"
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {
                        $eq: ["$matchkey", "$$matchkey"]
                      },
                      {
                        $eq: [
                          "$playerid",
                          "$$player_id"
                        ]
                      }
                    ]
                  }
                }
              }
            ],
            as: "playerDetails"
          }
        },
        {
          $unwind: {
            path: "$playerDetails",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: "resultmatches",
            let: {
              matchkey: "$matchkey",
              player_id: "$playersData.playerId"
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {
                        $eq: ["$matchkey", "$$matchkey"]
                      },
                      {
                        $eq: [
                          "$player_id",
                          "$$player_id"
                        ]
                      }
                    ]
                  }
                }
              }
            ],
            as: "playerScorecard"
          }
        },
        {
          $unwind: {
            path: "$playerScorecard",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: "resultpoints",
            let: {
              matchkey: "$matchkey",
              player_id: "$playersData.playerId"
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {
                        $eq: ["$matchkey", "$$matchkey"]
                      },
                      {
                        $eq: [
                          "$player_id",
                          "$$player_id"
                        ]
                      }
                    ]
                  }
                }
              }
            ],
            as: "playerPoints"
          }
        },
        {
          $unwind: {
            path: "$playerPoints",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $addFields: {
            image: `${global.constant.IMAGE_URL}black_team1.png`,
            credit: "$playersData.credit",
            totalSelected: "$playerDetails.totalSelected",
            card: [
              {
                type: "6's",
                actual: "$playerScorecard.six",
                points: "$playerPoints.sixs"
              },
              {
                type: "4's",
                actual: "$playerScorecard.fours",
                points: "$playerPoints.fours"
              },
              {
                type: "Runs",
                actual: "$playerScorecard.runs",
                points: "$playerPoints.runs"
              },
              {
                type: "Catch Points",
                actual: "$playerScorecard.catch",
                points: "$playerPoints.catch"
              },
              {
                type: "Strike Rate",
                actual: "$playerScorecard.strike_rate",
                points: "$playerPoints.strike_rate"
              },
              {
                type: "30/50/100",
                actual: {
                  $cond: {
                    if: {
                      $gt: [
                        "$playerPoints.thirtypoints",
                        0
                      ]
                    },
                    then: "30+",
                    else: {
                      $cond: {
                        if: {
                          $gt: [
                            "$playerPoints.halfcentury",
                            0
                          ]
                        },
                        then: "50+",
                        else: {
                          $cond: {
                            if: {
                              $gt: [
                                "$playerPoints.century",
                                0
                              ]
                            },
                            then: "100+",
                            else: 0
                          }
                        }
                      }
                    }
                  }
                },
                points: {
                  $cond: {
                    if: {
                      $gt: [
                        "$playerPoints.thirtypoints",
                        0
                      ]
                    },
                    then: "$playerPoints.thirtypoints",
                    else: {
                      $cond: {
                        if: {
                          $gt: [
                            "$playerPoints.halfcentury",
                            0
                          ]
                        },
                        then: "$playerPoints.halfcentury",
                        else: {
                          $cond: {
                            if: {
                              $gt: [
                                "$playerPoints.century",
                                0
                              ]
                            },
                            then: "$playerPoints.century",
                            else: 0
                          }
                        }
                      }
                    }
                  }
                }
              },
              {
                type: "Wickets",
                actual: "$playerScorecard.wicket",
                points: "$playerPoints.wickets"
              },
              {
                type: "Maiden Over",
                actual: "$playerScorecard.maiden_over",
                points: "$playerPoints.maidens"
              },
              {
                type: "Economy Rate",
                actual: "$playerScorecard.economy_rate",
                points: "$playerPoints.economy_rate"
              },
              {
                type: "Runout",
                actual: "$playerScorecard.runouts",
                points: "$playerPoints.runouts"
              },
              {
                type: "Stumping",
                actual: "$playerScorecard.stumbed",
                points: "$playerPoints.stumping"
              },
              {
                type: "Thrower",
                actual: "$playerScorecard.thrower",
                points: "$playerPoints.thrower"
              },
              {
                type: "Hitter",
                actual: "$playerScorecard.hitter",
                points: "$playerPoints.hitter"
              },
              {
                type: "Bonus",
                actual: "$playerPoints.bonus",
                points: "$playerPoints.bonus"
              },
              {
                type: "Duck",
                actual:
                  "$playerScorecard.negative_points",
                points: "$playerPoints.negative"
              },
              {
                type: "LBW",
                actual: "0",
                points: "$playerPoints.wicketbonuspoint"
              },
              {
                type: "Starting Point",
                actual: "$playerPoints.startingpoints",
                points: "$playerPoints.startingpoints"
              },
              {
                type: "Total",
                actual: "$playerScorecard.total_points",
                points: "$playerPoints.total"
              }
            ]
          }
        },
        {
          $project: {
            total: "$playerScorecard.total_points",
            playerId: "$playersData.playerId",
            role: "$playersData.role",
            name: "$playersData.playerName",
            card: 1,
            image: 1,
            credit: 1,
            totalSelected: 1
          }
        }
      ];
      const data = await userTeamModel.aggregate(pipe);
      if (data.length > 0) {
        return {
          message: "Data Found Successfully !!",
          status: true,
          data,
        };
      } else {
        return {
          message: "Match Players stats data not found...",
          status: false,
          data: [],
        };
      }
    } catch (error) {
      throw error;
    }
  }


  async fetchFantasyScoreCardsRedis(req) {
    try {
      const matchKey = req.query.matchkey;
      const keyMatchRun = `listMatchesModel-${matchKey}`;

      let match = await redisjoinTeams.getkeydata(keyMatchRun);

      if (!match) {
        match = await matchesModel.findOne({
          _id: new mongoose.Types.ObjectId(matchKey),
        });

        if (match) {
          // Cache for 3 days
          await redisjoinTeams.setkeydata(keyMatchRun, match, 3 * 24 * 60 * 60);
        } else {
          return []; // Return empty array if match not found
        }
      }

      const keyName = `playerList-matchkey-${match.real_matchkey}`;
      const getMatchPlayers = await redisjoinTeams.getkeydata(keyName) || [];

      const playersData = [];

      if (getMatchPlayers.length > 0) {
        const pointKey = `match:${matchKey.toString()}:resultPoints_data`;
        for (const player of getMatchPlayers) {
          if (player.playingstatus === 1) {
            let pointData = await redisLiveJoinTeams.hgetData(pointKey, player.playerid);
            const obj = {
              playerid: player.playerid,
              credit: player.credit,
              matchname: match.name,
              teamShortName: player.team_short_name,
              playerrole: player.role,
              playername: player.name,
              playerimage: player.image,
              duck: Number(pointData.negative) || 0,
              innings: 1,
              startingpoints: Number(pointData.startingpoints) || 0,
              runs: 0,
              fours: 0,
              sixs: 0,
              runouts: 0,
              strike_rate: 0,
              wickets: 0,
              maidens: 0,
              economy_rate: 0,
              thrower: 0,
              hitter: "0",
              catch: 0,
              catchpoints: 0,
              stumping: 0,
              bonus: 0,
              halfcentury: 0,
              negative: 0,
              total: Number(pointData.total),
              wicketbonuspoint: 0,
              selectper: 0,
              century: 0,
              thirtypoints: 0
            };
            playersData.push(obj);
          }
        }
      }
      return {
        message: "Match Player stats data...",
        status: true,
        data: playersData,
      };

    } catch (error) {
      console.error("❌ Error in fetchFantasyScoreCardsRedis:", error.message);
      return []; // Safe return in case of error
    }
  }

  async fantasyScoreCardRedis(req) {
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
          matchkey: new mongoose.Types.ObjectId(req.query.matchkey),
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

  async fetchRecentWinner(req) {
    try {
      const limit = req.query.limit || 10;
      const pageNumber = req.query.pageNumber || 1;
      const skip = (pageNumber - 1) * limit;
      const RedisKey = `recentWinnerList`;
      let recentWinners = await redisMain.getkeydata(RedisKey);
      if (!recentWinners) {
        recentWinners = await this.fetchRecentWinnerWithoutRedis();
      }
      if (recentWinners.length == 0) {
        return {
          message: " Data Not Found !!",
          status: false,
        };
      }
      return {
        message: " Data Fetch Successfully",
        status: true,
        data: recentWinners,
      };
    } catch (error) {
      console.log(error);
    }
  }

  async withoutRedisGetMatchList(req, res) {
    try {
      // console.log('rrrrrrrrrgfyugyggggggggggggg')
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
      redisjoinTeams.setkeydata(keyname, result, 30 * 24 * 60 * 60);
      return result;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async fetchRecentWinnerWithoutRedis(req) {
    let pipe = [
      {
        $match: {
          status: "completed",
          launch_status: "launched",
          final_status: "winnerdeclared",
        },
      },
      {
        $sort: {
          start_date: -1,
        },
      },
      {
        $skip: 0,
      },
      {
        $limit: 20,
      },
      {
        $project: {
          _id: 1,
        },
      },
      {
        $lookup: {
          from: "userleaderboard",
          localField: "_id",
          foreignField: "matchkey",
          as: "leaderboards",
        },
      },
      {
        $unwind: {
          path: "$leaderboards",
        },
      },
      {
        $replaceRoot: {
          newRoot: "$leaderboards",
        },
      },
      {
        $sort: {
          points: -1,
        },
      },
      {
        $lookup: {
          from: "matches",
          localField: "matchkey",
          foreignField: "_id",
          pipeline: [
            {
              $match: {
                status: "completed",
                final_status: "winnerdeclared",
              },
            },
            {
              $lookup: {
                from: "teams",
                localField: "team1Id",
                foreignField: "_id",
                as: "team1Id",
              },
            },
            {
              $lookup: {
                from: "teams",
                localField: "team2Id",
                foreignField: "_id",
                as: "team2Id",
              },
            },
            {
              $unwind: {
                path: "$team1Id",
              },
            },
            {
              $unwind: {
                path: "$team2Id",
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
          ],
          as: "matchData",
        },
      },
      {
        $unwind: {
          path: "$matchData",
        },
      },
      {
        $addFields: {
          seriesName: "$matchData.series.name",
          startDate: "$matchData.start_date",
          teamAName: "$matchData.team1Id.teamName",
          teamAShortName: "$matchData.team1Id.short_name",
          teamAImage: {
            $concat: [`${global.constant.IMAGE_URL}`, "$matchData.team1Id.logo"],
          },
          teamBName: "$matchData.team2Id.teamName",
          teamBShortName: "$matchData.team2Id.short_name",
          teamBImage: {
            $concat: [`${global.constant.IMAGE_URL}`, "$matchData.team2Id.logo"],
          },
        },
      },
      {
        $group: {
          _id: "$matchkey",
          data: {
            $push: "$$ROOT",
          },
          seriesName: {
            $first: "$seriesName",
          },
          startDate: {
            $first: "$startDate",
          },
          teamAName: {
            $first: "$teamAName",
          },
          teamAShortName: {
            $first: "$teamAShortName",
          },
          teamAImage: {
            $first: "$teamAImage",
          },
          teamBName: {
            $first: "$teamBName",
          },
          teamBShortName: {
            $first: "$teamBShortName",
          },
          teamBImage: {
            $first: "$teamBImage",
          },
          matchkey: {
            $first: "$matchkey",
          },
          matchchallengeid: {
            $first: "$challengeid",
          },
          joinId: {
            $first: "$joinId",
          },
        },
      },
      {
        $lookup: {
          from: "matchcontests",
          localField: "_id",
          foreignField: "matchkey",
          pipeline: [
            {
              $sort: {
                win_amount: -1,
              },
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
                joinedusers: "$joinedusers",
              },
            },
            {
              $match: { joinedusers: { $gt: 0 } },
            },
          ],
          as: "matchchallenges",
        },
      },
      {
        $project: {
          data: 0,
        },
      },
      {
        $unwind: {
          path: "$matchchallenges",
        },
      },
      {
        $addFields: {
          "matchchallenges.matchkey": "$matchkey",
          fantasyType: "Cricket",
        },
      },
      {
        $group: {
          _id: "$_id",
          totalWin: {
            $sum: "$matchchallenges.win_amount",
          },
          matchkey: {
            $first: "$matchkey",
          },
          fantasyType: {
            $first: "$fantasyType",
          },
          seriesName: {
            $first: "$seriesName",
          },
          matchchallengeid: {
            $first: "$matchchallengeid",
          },
          startDate: {
            $first: "$startDate",
          },
          teamAName: {
            $first: "$teamAName",
          },
          teamAShortName: {
            $first: "$teamAShortName",
          },
          teamAImage: {
            $first: "$teamAImage",
          },
          teamBName: {
            $first: "$teamBName",
          },
          teamBShortName: {
            $first: "$teamBShortName",
          },
          teamBImage: {
            $first: "$teamBImage",
          },
          firstContestData: {
            $first: "$matchchallenges",
          },
          matchchallenges: {
            $push: "$matchchallenges",
          },
          joinId: {
            $first: "$joinId",
          },
        },
      },
      {
        $lookup: {
          from: "userleaderboard",
          localField: "firstContestData._id",
          let: {
            joinId: "$joinId",
          },
          foreignField: "challengeid",
          pipeline: [
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
                let: {
                  joinId: "$joinId",
                },
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
              $unwind: "$amountData",
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
              $limit: 20,
            },
          ],
          as: "firstcontestData",
        },
      },
      {
        $addFields: {
          firstContesWinAmount: "$firstContestData.win_amount",
        },
      },
      {
        $project: {
          firstContestData: 0,
        },
      },
      {
        $match: {
          $expr: {
            $gt: [
              {
                $size: "$firstcontestData",
              },
              0,
            ],
          },
        },
      },
      {
        $addFields: {
          firstcontestData: {
            $sortArray: {
              input: "$firstcontestData",
              sortBy: {
                points: -1,
              },
            },
          },
          convertedStartDate: {
            $dateFromString: {
              dateString: "$startDate",
              format: "%Y-%m-%d %H:%M:%S",
            },
          },
        },
      },
      {
        $sort: {
          convertedStartDate: -1,
        },
      },
      {
        $skip: 0,
      },
      {
        $limit: 20,
      },
    ];
    let recentWinners = await matchesModel.aggregate(pipe);
    const RedisKey = `recentWinnerList`;
    await redisMain.setkeydata(RedisKey, recentWinners, 60 * 60 * 48);
    return recentWinners;
  }

  async fetchPointSystemData(req) {
    try {
      const RedisKey = `pointSystemData`;
      let pointSystemDataa = await redisMain.getkeydata(RedisKey);
      if (pointSystemDataa) {
        return {
          message: "Fetch Data Successfully",
          status: true,
          data: pointSystemDataa,
        };
      } else {
        const data = await matchFormatModel.aggregate([
          {
            $lookup: {
              from: "matchroles",
              localField: "_id",
              foreignField: "formatid",
              pipeline: [
                {
                  $lookup: {
                    from: "fantasypoints",
                    localField: "_id",
                    foreignField: "roll_id",
                    as: "pointData",
                  },
                },
              ],
              as: "action",
            },
          },
          {
            $unwind: {
              path: "$action",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $unwind: {
              path: "$action.pointData",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              format_name: "$name",
              role_name: "$action.type",
              actions: "$action.pointData.pointdata",
              rules: "$action.pointData.rules",
            },
          },
          {
            $group: {
              _id: "$_id",
              format_name: {
                $addToSet: "$format_name",
              },
              Format: {
                $push: "$$ROOT",
              },
            },
          },
          {
            $unwind: {
              path: "$format_name",
            },
          },
          {
            $project: {
              _id: 0,
            },
          },
        ]);

        await redisMain.setkeydata(RedisKey, data, 60 * 60 * 48 * 10);
        return {
          message: "Fetch Data Successfully",
          status: true,
          data: data,
        };
      }
    } catch (error) {
      console.log(error);
    }
  }

  async fetchRecentContest(req) {
    try {
      // return {
      //   message: "Data Not Found !!",
      //   status: false,
      //   data: [],
      // };
      let key = `getRecentContestData:${req.params.matchchallengeid}`;
      let data = await redisCompletedMatch.getkeydata(key);
      if (!data || data.length <= 0) {
        const pipeline = [
          {
            $match: {
              // matchkey: new mongoose.Types.ObjectId(req.params.matchkey),
              challengeid: new mongoose.Types.ObjectId(req.params.matchchallengeid),
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
              rank: 1,
              points: 1,
              userId: 1,
              joinId: 1,
              amount: 1,
              prize: 1
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
            $addFields: {
              userImage: { $arrayElemAt: ["$userData.image", 0] },
              userTeamName: { $arrayElemAt: ["$userData.team", 0] },
              username: { $arrayElemAt: ["$userData.username", 0] },
              state: { $arrayElemAt: ["$userData.state", 0] },
              name: { $arrayElemAt: ["$userData.name", 0] },
            },
          },
          {
            $project: {
              userData: 0
            }
          },

        ];
        data = await userLeaderBoardModel.aggregate(pipeline);
        if (data.length == 0) {
          return {
            message: " Data Not Found !!",
            status: false,
            data: [],
          };
        }
        await redisCompletedMatch.setkeydata(key, data, 60 * 60 * 24 * 3);
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

  async fetchUserRecentMatchesNew(req) {
    try {
      let fantasy = req.query.fantasy_type || "Cricket";
      // let keyname = `completed-matches`;
      // let redisdata = await redisMain.retrieveLiveSortedSet(keyname);
      return { message: "No Data Found", status: false, data: [] };
      // if (!redisdata || redisdata.length === 0) {
      //   return { message: "No Data Found", status: false, data: [] };
      // }
      let keyname = `user:${req.user._id.toString()}:matches`;
      let redisdata = await redisLeaderboard.getMyLeaderBoard(keyname, req.user._id, "contest");
      if (!redisdata || redisdata.length === 0) {
        const data = await userLeagueModel.aggregate([
          {
            $match: {
              userid: new mongoose.Types.ObjectId(req.user._id),
            },
          },
          {
            $group: {
              _id: "$matchkey",
              userid: {
                $first: "$userid",
              },
              createdAt: {
                $first: "$createdAt",
              },
              challengeid: {
                $first: "$challengeid",
              },
            },
          },
          {
            $project: {
              matchkey: "$_id",
              createdAt: -1
            },
          },
          {
            $sort: {
              createdAt: -1,
            },
          }, {
            $limit: 5
          }
        ]);
        if (data.length > 0) {
          for (let match of data) {
            let redisUserMatch = {
              "_id": `${match._id.toString()}`,
              "getcurrentrank": 1,
              "matchkey": match._id
            }
            var expRedisTime = await matchTimeDifference(match._id);
            let keyUserJoinedMatches = `user:${req.user._id.toString()}:matches`;
            await redisLeaderboard.storeSortedSet(keyUserJoinedMatches, redisUserMatch, expRedisTime);
          }
          redisdata = await redisLeaderboard.getMyLeaderBoard(keyname, req.user._id, "contest");
        } else {
          return { message: "No Data Found", status: false, data: [] };
        }
      }

      let joinedMatches = [];
      // console.log('redisdata---', redisdata.length);
      // Parallel execution to optimize performance
      let totalWinningAmount = 0;
      await Promise.all(
        redisdata.map(async (matchdata) => {
          let matchid = matchdata._id;
          let keyMatchRun = `listMatchesModel-${matchid}`;
          let match = await redisjoinTeams.getkeydata(keyMatchRun);

          if (!match) {
            match = await matchesModel.findOne({
              _id: new mongoose.Types.ObjectId(matchid),
            });
            if (match) {
              await redisjoinTeams.setkeydata(keyMatchRun, match, 20 * 24 * 60 * 60);
            } else {
              return;
            }
          }
          if (match.final_status == 'winnerdeclared') {

            let keyUserJoinedChallenge = `match:${matchid}:user:${req.user._id}:joinedContests`;
            let userContest = await redisLeaderboard.getMyLeaderBoard(keyUserJoinedChallenge, req.user._id, "contest");
            if (userContest == false) {
              const matchKey = `match:${matchid}:challenges`;
              const matchAllChallenges = await redisContest.hgetAllDataResult(matchKey);
              let filteredMatchChallenges = Object.values(matchAllChallenges || {});
              if (filteredMatchChallenges && filteredMatchChallenges.length <= 0) {
                filteredMatchChallenges = await matchContestModel.find({
                  matchkey: new mongoose.Types.ObjectId(matchid),
                });
              }
              if (filteredMatchChallenges && filteredMatchChallenges.length > 0) {
                await Promise.all(
                  filteredMatchChallenges.map(async (challenge) => {
                    const userChallengeCounterKey = `match:${matchid}:challenge:${challenge._id}:user:${req.user._id}:joinedTeams`;
                    let userTeamCount = await redisjoinTeams.getkeydata(userChallengeCounterKey);
                    let membersData = [];
                    // let keyLeaderBoard = `match:${matchid}:challenge:${challenge._id}:user:${req.user._id}:userLeaderBoard`;
                    // let userLeaderboard = await redisLeaderboard.getMyLeaderBoard(keyLeaderBoard, req.user._id);

                    // if (userLeaderboard.length > 0) {
                    //   membersData = userLeaderboard.map(item => item._id.split('-')[0]);
                    // } else {
                    //   let aggPipe = [];
                    //   aggPipe.push({
                    //     $match: {
                    //       userId: new mongoose.Types.ObjectId(req.user._id)
                    //     }
                    //   });
                    //   aggPipe.push({
                    //     $project: {
                    //       _id: { $toString: "$_id" }
                    //     }
                    //   }, {
                    //     $group: {
                    //       _id: null,
                    //       data: {
                    //         $push: "$_id"
                    //       }
                    //     }
                    //   });
                    //   const members = await userLeaderBoardModel.aggregate(aggPipe);
                    //   membersData = members[0]?.data;
                    // }
                    // let keyChallengeLeaderBoard = 'liveRanksLeaderboard_' + challenge._id.toString();
                    // userLeaderboard = await redisLeaderboard.particularUserLeaderBoard(keyChallengeLeaderBoard, req.user._id, '', membersData);
                    // console.log("userLeaderboard", userLeaderboard)
                    // console.log("keyChallengeLeaderBoard", keyChallengeLeaderBoard)
                    if (userTeamCount > 0) {
                      let redisUserChallenge = {
                        _id: `${challenge._id.toString()}`,
                        getcurrentrank: userTeamCount,
                        matchkey: matchid,
                      };
                      var expRedisTime = await matchTimeDifference(matchid);
                      await redisLeaderboard.storeSortedSet(keyUserJoinedChallenge, redisUserChallenge, expRedisTime);
                    } else {
                      userTeamCount = await userLeaderBoardModel.find({
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
                        await redisLeaderboard.storeSortedSet(keyUserJoinedChallenge, redisUserChallenge, expRedisTime);
                      }
                    }
                  })
                );
              }
              userContest = await redisLeaderboard.getMyLeaderBoard(keyUserJoinedChallenge, req.user._id, "contest");
            }
            // Redis cache check for teams
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
              var expRedisTime = await matchTimeDifference(matchid);
              await redisjoinTeams.setkeydata(redisKey, cachedTeams, expRedisTime);
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
                totalWinningAmount: totalWinningAmount
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
      console.error("Error in NewjoinedmatchesLive:", error);
      return { message: "Something went wrong!", status: false, error: error.message };
    }
  }

  // async userRecentMatches(req) {
  //   try {
  //     // return { message: "No Data Found", status: false, data: [] };
  //     let fantasy = req.query.fantasy_type || "Cricket";
  //     let keyname = `user:${req.user._id.toString()}:matches`;
  //     let redisdata = await redisLeaderboard.getMyLeaderBoard(keyname, req.user._id, "contest");
  //     if (!redisdata || redisdata.length === 0) {
  //       return { message: "No Data Found", status: false, data: [] };
  //     }
  //     let joinedMatches = [];
  //     // Parallel execution to optimize performance
  //     let totalWinningAmount = 0;
  //     await Promise.all(
  //       redisdata.map(async (matchData) => {
  //         let matchid = matchData?._id;
  //         let keyMatchRun = `listMatchesModel-${matchid}`;
  //         let match = await redisjoinTeams.getkeydata(keyMatchRun);

  //         if (!match) {
  //           match = await matchesModel.findOne({
  //             _id: new mongoose.Types.ObjectId(matchid),
  //           });
  //           if (match) {
  //             await redisjoinTeams.setkeydata(keyname, match, 20 * 24 * 60 * 60);
  //           } else {
  //             return;
  //           }
  //         }
  //         if (match.status == 'started' || match.status == 'notstarted') {
  //           let keyUserJoinedChallenge = `match:${matchid}:user:${req.user._id}:joinedContests`;
  //           let userContest = await redisLeaderboard.getMyLeaderBoard(keyUserJoinedChallenge, req.user._id, "contest");
  //           if (userContest == false) {
  //             return;
  //             // const matchKey = `match:${matchid}:challenges`;
  //             // const matchAllChallenges = await redisContest.hgetAllDataResult(matchKey);
  //             // let filteredMatchChallenges = Object.values(matchAllChallenges || {});
  //             // if (filteredMatchChallenges && filteredMatchChallenges.length <= 0) {
  //             //   filteredMatchChallenges = await matchContestModel.find({
  //             //     matchkey: new mongoose.Types.ObjectId(matchid),
  //             //   });
  //             // }
  //             // if (filteredMatchChallenges && filteredMatchChallenges.length > 0) {
  //             //   await Promise.all(
  //             //     filteredMatchChallenges.map(async (challenge) => {
  //             //       const userChallengeCounterKey = `match:${matchid}:challenge:${challenge._id}:user:${req.user._id}:joinedTeams`;
  //             //       let userTeamCount = await redisjoinTeams.getkeydata(userChallengeCounterKey);
  //             //       if (userTeamCount > 0) {
  //             //         let redisUserChallenge = {
  //             //           _id: `${challenge._id.toString()}`,
  //             //           getcurrentrank: userTeamCount,
  //             //           matchkey: matchid,
  //             //         };
  //             //         var expRedisTime = await matchTimeDifference(matchid);
  //             //         await redisLeaderboard.storeSortedSet(keyUserJoinedChallenge, redisUserChallenge, expRedisTime);
  //             //       } else {
  //             //         userTeamCount = await userLeaderBoardModel.find({
  //             //           matchkey: new mongoose.Types.ObjectId(matchid),
  //             //           challengeid: new mongoose.Types.ObjectId(challenge._id),
  //             //           userId: new mongoose.Types.ObjectId(req.user._id)
  //             //         });
  //             //         if (userTeamCount > 0) {
  //             //           let redisUserChallenge = {
  //             //             _id: `${challenge._id.toString()}`,
  //             //             getcurrentrank: userTeamCount,
  //             //             matchkey: matchid,
  //             //           };
  //             //           var expRedisTime = await matchTimeDifference(matchid);
  //             //           await redisLeaderboard.storeSortedSet(keyUserJoinedChallenge, redisUserChallenge, expRedisTime);
  //             //         }
  //             //       }
  //             //     })
  //             //   );
  //             // }
  //             // userContest = await redisLeaderboard.getMyLeaderBoard(keyUserJoinedChallenge, req.user._id, "contest");
  //           }
  //           // Redis cache check for teams
  //           const redisKey = `match:${matchid}:user:${req.user._id}:teams`;
  //           let cachedTeams = await redisjoinTeams.getkeydata(redisKey);
  //           cachedTeams = cachedTeams || [];

  //           if (cachedTeams.length > 0) {
  //             cachedTeams = cachedTeams || [];
  //           } else {
  //             cachedTeams = []
  //             // cachedTeams = await userTeamModel.find({
  //             //   userid: new mongoose.Types.ObjectId(req.user._id),
  //             //   matchkey: new mongoose.Types.ObjectId(matchid),
  //             // }).lean();
  //             // var expRedisTime = await matchTimeDifference(matchid);
  //             // await redisjoinTeams.setkeydata(redisKey, cachedTeams, expRedisTime);
  //           }
  //           if (userContest && userContest.length > 0 && cachedTeams.length > 0) {
  //             const status = moment(match.start_date).isBefore(moment()) ? "closed" : "opened";
  //             let data = {
  //               "_id": match._id,
  //               "matchkey": match._id,
  //               "real_matchkey": match.real_matchkey,
  //               "textNote": match?.textNote || "",
  //               "fantasy_type": match.fantasy_type,
  //               "playing11_status": match.playing11_status,
  //               "short_name": match.short_name,
  //               "name": match.name,
  //               "start_date": match.start_date,
  //               "status": match.status,
  //               "final_status": match.final_status,
  //               "team1": match.teamA?.teamName || "N/A",
  //               "team1_short_name": match.teamA?.short_name || "N/A",
  //               "team1logo": `${global.constant.IMAGE_URL}${match.teamA?.logo || "default_team1.png"}`,
  //               "team2": match.teamB?.teamName || "N/A",
  //               "team2_short_name": match.teamB?.short_name || "N/A",
  //               "team2logo": `${global.constant.IMAGE_URL}${match.teamB?.logo || "default_team2.png"}`,
  //               "totalJoinTeam": cachedTeams.length || 0,
  //               "totalJoinedContest": userContest.length,
  //               "series": match.series,
  //               "totalWinningAmount": totalWinningAmount
  //             }
  //             joinedMatches.push(data);
  //           }
  //         }
  //       })
  //     );
  //     joinedMatches.sort((a, b) => moment(b.start_date) - moment(a.start_date));
  //     return joinedMatches.length > 0
  //       ? { message: "User joined latest 5 Upcoming and live match data..", status: true, data: joinedMatches }
  //       : { message: "No Data Found..", status: false, data: [] };
  //   } catch (error) {
  //     console.log("error", error);
  //     return { message: "No Data Found", status: false, data: [] };
  //   }
  // }
  async fetchUserRecentMatches(req) {
    try {
      // return { message: "No Data Found", status: false, data: [] };
      let fantasy = req.query.fantasy_type || "Cricket";
      let keyname = `user:${req.user._id.toString()}:matches`;
      let redisdata = await redisLeaderboard.getMyLeaderBoard(keyname, req.user._id, "contest");
      if (!redisdata || redisdata.length === 0) {
        return { message: "No Data Found", status: false, data: [] };
      }
      let joinedMatches = [];
      // Parallel execution to optimize performance
      let totalWinningAmount = 0;
      await Promise.all(
        redisdata.map(async (matchData) => {
          let matchid = matchData?._id;
          let keyMatchRun = `listMatchesModel-${matchid}`;
          let match = await redisjoinTeams.getkeydata(keyMatchRun);

          if (!match) {
            match = await matchesModel.findOne({
              _id: new mongoose.Types.ObjectId(matchid),
            });
            if (match) {
              await redisjoinTeams.setkeydata(keyMatchRun, match, 20 * 24 * 60 * 60);
            } else {
              return;
            }
          }
          let userContest = false;
          if (match.status == 'started' || match.status == 'notstarted') {
            let keyUserJoinedChallenge = `match:${matchid}:user:${req.user._id}:joinedContests`;
            userContest = await redisLeaderboard.getMyLeaderBoard(keyUserJoinedChallenge, req.user._id, "contest");
          }
          if (userContest == false) {
            return;
            // const matchKey = `match:${matchid}:challenges`;
            // const matchAllChallenges = await redisContest.hgetAllDataResult(matchKey);
            // let filteredMatchChallenges = Object.values(matchAllChallenges || {});
            // if (filteredMatchChallenges && filteredMatchChallenges.length <= 0) {
            //   filteredMatchChallenges = await matchContestModel.find({
            //     matchkey: new mongoose.Types.ObjectId(matchid),
            //   });
            // }
            // if (filteredMatchChallenges && filteredMatchChallenges.length > 0) {
            //   await Promise.all(
            //     filteredMatchChallenges.map(async (challenge) => {
            //       const userChallengeCounterKey = `match:${matchid}:challenge:${challenge._id}:user:${req.user._id}:joinedTeams`;
            //       let userTeamCount = await redisjoinTeams.getkeydata(userChallengeCounterKey);
            //       if (userTeamCount > 0) {
            //         let redisUserChallenge = {
            //           _id: `${challenge._id.toString()}`,
            //           getcurrentrank: userTeamCount,
            //           matchkey: matchid,
            //         };
            //         var expRedisTime = await matchTimeDifference(matchid);
            //         await redisLeaderboard.storeSortedSet(keyUserJoinedChallenge, redisUserChallenge, expRedisTime);
            //       } else {
            //         userTeamCount = await userLeaderBoardModel.find({
            //           matchkey: new mongoose.Types.ObjectId(matchid),
            //           challengeid: new mongoose.Types.ObjectId(challenge._id),
            //           userId: new mongoose.Types.ObjectId(req.user._id)
            //         });
            //         if (userTeamCount > 0) {
            //           let redisUserChallenge = {
            //             _id: `${challenge._id.toString()}`,
            //             getcurrentrank: userTeamCount,
            //             matchkey: matchid,
            //           };
            //           var expRedisTime = await matchTimeDifference(matchid);
            //           await redisLeaderboard.storeSortedSet(keyUserJoinedChallenge, redisUserChallenge, expRedisTime);
            //         }
            //       }
            //     })
            //   );
            // }
            // userContest = await redisLeaderboard.getMyLeaderBoard(keyUserJoinedChallenge, req.user._id, "contest");
          }
          // Redis cache check for teams
          const redisKey = `match:${matchid}:user:${req.user._id}:teams`;
          let cachedTeams = await redisjoinTeams.getkeydata(redisKey);
          cachedTeams = cachedTeams || [];

          if (cachedTeams.length > 0) {
            cachedTeams = cachedTeams || [];
          } else {
            cachedTeams = []
            // cachedTeams = await userTeamModel.find({
            //   userid: new mongoose.Types.ObjectId(req.user._id),
            //   matchkey: new mongoose.Types.ObjectId(matchid),
            // }).lean();
            // var expRedisTime = await matchTimeDifference(matchid);
            // await redisjoinTeams.setkeydata(redisKey, cachedTeams, expRedisTime);
          }
          if (userContest && userContest.length > 0 && cachedTeams.length > 0) {
            const status = moment(match.start_date).isBefore(moment()) ? "closed" : "opened";
            let data = {
              "_id": match._id,
              "matchkey": match._id,
              "real_matchkey": match.real_matchkey,
              "textNote": match?.textNote || "",
              "fantasy_type": match.fantasy_type,
              "playing11_status": match.playing11_status,
              "short_name": match.short_name,
              "name": match.name,
              "start_date": match.start_date,
              "status": match.status,
              "final_status": match.final_status,
              "team1": match.teamA?.teamName || "N/A",
              "team1_short_name": match.teamA?.short_name || "N/A",
              "team1logo": `${global.constant.IMAGE_URL}${match.teamA?.logo || "default_team1.png"}`,
              "team2": match.teamB?.teamName || "N/A",
              "team2_short_name": match.teamB?.short_name || "N/A",
              "team2logo": `${global.constant.IMAGE_URL}${match.teamB?.logo || "default_team2.png"}`,
              "totalJoinTeam": cachedTeams.length || 0,
              "totalJoinedContest": userContest.length,
              "series": match.series,
              "totalWinningAmount": totalWinningAmount
            }
            joinedMatches.push(data);
          }
        })
      );
      joinedMatches.sort((a, b) => moment(b.start_date) - moment(a.start_date));

      return joinedMatches.length > 0
        ? { message: "User joined latest 5 Upcoming and live match data..", status: true, data: joinedMatches }
        : { message: "No Data Found..", status: false, data: [] };
    } catch (error) {
      console.log("error", error);
      return { message: "No Data Found", status: false, data: [] };
    }
  }

  async leaderboardOfCompletedMatch(req) {
    // const { matchchallengeid, skip = 0, limit = 20 } = req.query;
    // const client = await initAerospike();

    // const namespace = 'test';
    // const set = 'leaderboard';
    // return await this.paginateUsingPartitions('test', set, 1, 10)
    // const query = client.query(namespace, set);
    // // If you have filtering support in Aerospike Secondary Index (SI), uncomment this:
    // query.where(Aerospike.filter.equal('cid', matchchallengeid));

    // const users = [];

    // return new Promise((resolve, reject) => {
    //   const stream = query.foreach(); ``
    //   stream.on('data', (record) => {
    //     users.push(record.bins);
    //     if (users.length >= limit) {
    //       stream.abort(); // Stop early if limit reached
    //     }
    //   });

    //   stream.on('error', (error) => {
    //     client.close();
    //     console.error("❌ Stream error:", error);
    //     reject({
    //       message: "Error fetching leaderboard",
    //       status: false,
    //       error,
    //     });
    //   });

    //   stream.on('end', () => {
    //     client.close();
    //     resolve({
    //       message: "✅ Completed match leaderboard",
    //       status: true,
    //       data: {
    //         team_number_get: 1,
    //         userrank: 1,
    //         pdfname: "",
    //         jointeams: users,
    //       },
    //       total_joined_teams: users.length,
    //     });
    //   });
    // });
  }

  async paginateUsingPartitions(namespace, setName, pageNumber, partitionsPerPage) {
    const client = await initAerospike();
    const totalPartitions = 4096;
    const startPartition = (pageNumber - 1) * partitionsPerPage;
    const endPartition = startPartition + partitionsPerPage - 1;

    const scan = client.scan(namespace, setName);

    // Correct way to apply partition filter
    const partitionFilter = Aerospike.PartitionFilter.range(startPartition, endPartition);

    // const partitionFilter = Aerospike.partitionFilter.range(startPartition, endPartition);
    scan.applyPartitionFilter(partitionFilter); // <-- Use applyPartitionFilter()

    const records = [];
    const query = scan.foreach();
    await new Promise((resolve, reject) => {
      query.on('data', (record) => records.push(record));
      query.on('error', reject);
      query.on('end', resolve);
    });

    await client.close();
    return records;
  }

  async paginateQuery(ns, set, filters, pageSize, offset, client) {
    const query = client.query(ns, set)
    filters.forEach(filter => query.where(filter));
    query.maxRecords = pageSize;
    query.offset = offset;
    const records = []
    const stream = query.execute()

    stream.on('data', record => {
      records.push(record)
    })

    await new Promise((resolve, reject) => {
      stream.on('end', resolve)
      stream.on('error', reject)
    })

    return records
  }
  async addCompletedMatchInRedis(req) {
    try {
      let getAllmatches = await matchesModel.find({ final_status: 'winnerdeclared' });
      // Check if there are any matches
      if (!getAllmatches || getAllmatches.length === 0) {
        return { message: "No Data Found", status: false, data: [] };
      }
      console.log('getAllmatches', getAllmatches.length);
      for (let match of getAllmatches) {
        let data = await redisCompletedMatch.storeSortedSet('completedMatchesSet', match, 60 * 60 * 24 * 90);
      }
      return { message: "Data saved to Redis successfully", status: true, data: getAllmatches };
    } catch (error) {
      console.log("error", error);
      return { message: "No Data Found", status: false, data: [] };
    }
  }
}

module.exports = new matchServices();