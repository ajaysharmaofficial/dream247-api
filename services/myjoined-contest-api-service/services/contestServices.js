const mongoose = require('mongoose');
const randomstring = require("randomstring");

const matchchallengesModel = require('../../../models/matchContestModel');
// const dualgamematchChallengersModel = require('../../../models/dualgamematchChallengersModel');
const userLeagueModel = require('../../../models/userLeagueModel');
// const JoinDuoLeaugeModel = require('../../../models/JoinDuoLeaugeModel');
const userLeaderBoardModel = require('../../../models/userLeaderBoardModel');
// const duoleaderBoardModel = require('../../../models/duoleaderBoardModel');
const priceCardModel = require('../../../models/contestPriceCardModel');
const configModel = require("../../../models/configModel");
const matchesModel = require('../../../models/matchesModel');

const { healthCheck } = require('../../../utils/redis/redisMain');
const { getMyLeaderBoard, storeSortedSet, retrieveSortedSet, redis, particularUserLeaderBoard, getMyLeaderBoardNew } = require('../../../utils/redis/redisLeaderboard');
const redisjoinTeams = require('../../../utils/redis/redisjoinTeams');
const redisContest = require('../../../utils/redis/redisContest');
const redisLiveContest = require('../../../utils/redis/redisLiveContest');
const redisLiveJoinTeams = require('../../../utils/redis/redisLiveJoinTeams');
const redisLiveLeaderboard = require('../../../utils/redis/redisLiveLeaderboard');
const { matchTimeDifference } = require("../../../utils/matchTimeDiffrence");


class contestServices {
    constructor() {
        return {
            dbCheck: this.dbCheck.bind(this),
            myJoinedContests: this.myJoinedContests.bind(this),
            myDuoCompletedJoinedContests: this.myDuoCompletedJoinedContests.bind(this),
            userJoinContest: this.userJoinContest.bind(this),
            joinUserUpdate: this.joinUserUpdate.bind(this),
            userJoinContestOld: this.userJoinContestOld.bind(this),
            userJoinContestRedisNew: this.userJoinContestRedisNew.bind(this),
            userJoinDuoContest: this.userJoinDuoContest.bind(this),
        }
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

    async userJoinContestOld(req) {
        try {
            const { matchkey } = req.query;
            let skip = (req.query?.skip) ? Number(req.query.skip) : 0;
            let limit = (req.query?.limit) ? Number(req.query.limit) : 10;
            const aggPipe = [];
            aggPipe.push({

                $match: {
                    userid: mongoose.Types.ObjectId(req.user._id),
                    matchkey: mongoose.Types.ObjectId(matchkey),
                }
            });
            aggPipe.push({
                $group: {
                    _id: '$challengeid',
                    joinedleaugeId: { $first: '$_id' },
                    matchkey: { $first: '$matchkey' },
                    jointeamid: { $first: '$teamid' },
                    userid: { $first: '$userid' },
                    createdAt: { $first: "$createdAt" }
                },
            });
            aggPipe.push({
                $lookup: {
                    from: 'matchcontest',
                    localField: '_id',
                    foreignField: '_id',
                    // pipeline: [
                    //     {
                    //         $match: {
                    //             status: { $ne: 'canceled' }
                    //         }
                    //     }
                    // ],
                    as: 'matchchallenge'
                }
            });
            aggPipe.push({
                $unwind: {
                    path: "$matchchallenge"
                }
            })
            aggPipe.push({
                $addFields: { "matchchallengestatus": "$matchchallenge.status" }
            });
            aggPipe.push({
                $lookup: {
                    from: "userleagues",
                    let: {
                        matchchallengeid: "$matchchallenge._id"
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: [
                                        "$challengeid",
                                        "$$matchchallengeid"
                                    ]
                                }
                            }
                        },
                        {
                            $lookup: {
                                from: "userleaderboard",
                                let: { joinid: "$_id" },
                                pipeline: [
                                    {
                                        $match: {
                                            $expr: {
                                                $eq: ["$joinId", "$$joinid"]
                                            }
                                        }
                                    },
                                    {
                                        $lookup: {
                                            from: "resultsummary",
                                            pipeline: [
                                                {
                                                    $match: {
                                                        $expr: {
                                                            $eq: [
                                                                "$joinedid",
                                                                "$$joinid"
                                                            ]
                                                        }
                                                    }
                                                }
                                            ],
                                            as: "winnerD"
                                        }
                                    },
                                    {
                                        $addFields: {
                                            amount: {
                                                $ifNull: [
                                                    {
                                                        $first: "$winnerD.amount"
                                                    },
                                                    0
                                                ]
                                            }
                                        }
                                    }

                                    // { $unwind: "$winnerD" },
                                ],
                                as: "jointeam"
                            }
                        },

                        {
                            $unwind: {
                                path: "$jointeam",
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        { $sort: { "jointeam.rank": 1 } }

                    ],
                    as: "jointeamids"
                }
            });

            aggPipe.push({
                $lookup: {
                    from: "resultsummary",
                    let: { matchchallengeid: "$matchchallenge._id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        {
                                            $eq: [
                                                "$$matchchallengeid",
                                                "$challengeid",
                                            ],
                                        },
                                        {
                                            $eq: [
                                                "$userid",
                                                mongoose.Types.ObjectId(req.user._id),
                                            ],
                                        },
                                    ],
                                },
                            },
                        },
                        {
                            $group: {
                                _id: null,
                                amount: { $sum: "$amount" },
                            },
                        },
                    ],
                    as: "finalresults",
                }
            });

            aggPipe.push({
                $sort: {
                    'win_amount': -1,
                }
            });

            aggPipe.push({
                $lookup: {
                    from: "matches",
                    localField: "matchkey",
                    foreignField: "_id",
                    as: "listmatch",
                }
            });

            aggPipe.push({
                $project: {
                    jointeamid: 1,
                    createdAt: 1,
                    expert_name: "$matchchallenge.expert_name",
                    challenge_id: "$matchchallenge.challenge_id",
                    is_expert: "$matchchallenge.is_expert",
                    image: "$matchchallenge.image",
                    startDate: "$matchchallenge.startDate",
                    endDate: "$matchchallenge.endDate",
                    discount_fee: "$matchchallenge.discount_fee",
                    subscription_fee: "$matchchallenge.subscription_fee",
                    WinningpriceAndPrize: "$matchchallenge.WinningpriceAndPrize",
                    matchchallengeid: "$matchchallenge._id",
                    flexible_contest: "$matchchallenge.flexible_contest",
                    userid: 1,
                    joinedleaugeId: 1,
                    win_amount: "$matchchallenge.win_amount",
                    contest_cat: "$matchchallenge.contest_cat",
                    is_bonus: {
                        $ifNull: ["$matchchallenge.is_bonus", 0],
                    },
                    bonus_percentage: {
                        $ifNull: [
                            "$matchchallenge.bonus_percentage",
                            0,
                        ],
                    },
                    is_private: {
                        $ifNull: ["$matchchallenge.is_private", 0],
                    },
                    winning_percentage:
                        "$matchchallenge.winning_percentage",
                    contest_type: {
                        $ifNull: ["$matchchallenge.contest_type", ""],
                    },
                    multi_entry: {
                        $ifNull: ["$matchchallenge.multi_entry", ""],
                    },
                    contest_name: {
                        $ifNull: ["$matchchallenge.contest_name", ""],
                    },
                    confirmed: {
                        $ifNull: [
                            "$matchchallenge.confirmed_challenge",
                            0,
                        ],
                    },
                    matchkey: {
                        $ifNull: ["$matchchallenge.matchkey", 0],
                    },
                    joinedusers: {
                        $ifNull: ["$matchchallenge.joinedusers", 0],
                    },
                    entryfee: {
                        $ifNull: ["$matchchallenge.entryfee", 0],
                    },
                    pricecard_type: {
                        $ifNull: [
                            "$matchchallenge.pricecard_type",
                            0,
                        ],
                    },
                    maximum_user: {
                        $ifNull: ["$matchchallenge.maximum_user", 0],
                    },
                    team_limit: {
                        $ifNull: ["$matchchallenge.team_limit", 11],
                    },
                    matchFinalstatus: {
                        $ifNull: [
                            {
                                $arrayElemAt: [
                                    "$listmatch.final_status",
                                    0,
                                ],
                            },
                            "",
                        ],
                    },
                    matchpricecards:
                        "$matchchallenge.matchpricecards",
                    //-------------Comment for bleow commented code----------//
                    matchChallengeStatus: "$matchchallenge.status",
                    jointeams: {
                        $filter: {
                            input: "$jointeamids.jointeam",
                            as: "team",
                            cond: {
                                $eq: [
                                    "$$team.userId",
                                    mongoose.Types.ObjectId(req.user._id),
                                ],
                            },
                        },
                    },
                    bonus_date: "",
                    totaljointeams: "$jointeamids.jointeam",
                    jointeamids: "$jointeamids",
                    refercode: {
                        $ifNull: [
                            {
                                $arrayElemAt: [
                                    "$jointeamids.refercode",
                                    0,
                                ],
                            },
                            0,
                        ],
                    },
                    finalresultsAmount: {
                        $ifNull: [
                            {
                                $arrayElemAt: ["$finalresults.amount", 0],
                            },
                            0,
                        ],
                    },
                    amount_type: { $ifNull: ["$matchchallenge.amount_type", ""] },
                    is_PromoCode_Contest: "$matchchallenge.is_PromoCode_Contest",
                    textNote: { $ifNull: ["$matchchallenge.textNote", ""] },
                }
            });
            aggPipe.push({
                $lookup: {
                    from: "userteam",
                    let: { joinIds: "$userteam.teamId" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $in: ["$_id", "$$joinIds"] },
                            },
                        },
                        {
                            $lookup: {
                                from: "teamplayers",
                                localField: "captain",
                                foreignField: "_id",
                                as: "cap",
                            },
                        },
                        {
                            $lookup: {
                                from: "teamplayers",
                                localField: "vicecaptain",
                                foreignField: "_id",
                                as: "vice",
                            },
                        }, {
                            $unwind: {
                                path: "$cap"
                            }
                        }, {
                            $unwind: {
                                path: "$vice"
                            }
                        },
                        {
                            $project: {
                                teamId: "$_id",
                                captain: "$cap.player_name",
                                vicecaptain: "$vice.player_name",
                                points: "$points",
                                teamnumber: "$teamnumber"

                            }
                        }
                    ],
                    as: "userTeams",
                }
            });

            aggPipe.push({
                $sort:
                /**
                 * Provide any number of field/order pairs.
                 */
                {
                    createdAt: 1,
                },
            },);
            aggPipe.push({
                $addFields: {
                    winning_percentage: {
                        $round: [{
                            $multiply: [
                                {
                                    $divide: [
                                        {
                                            $toInt: {
                                                $ifNull: [
                                                    {
                                                        $arrayElemAt: [
                                                            "$matchpricecards.max_position",
                                                            {
                                                                $subtract: [
                                                                    {
                                                                        $size:
                                                                            "$matchpricecards"
                                                                    },
                                                                    1
                                                                ]
                                                            }
                                                        ]
                                                    }, 1
                                                ]
                                            }
                                        },
                                        "$maximum_user"
                                    ]
                                },
                                100
                            ]
                        }, 0]
                    }
                }
            },)
            // console.log(JSON.stringify(aggPipe), "---------------------")
            let total_joined_contests = await (await userLeagueModel.aggregate(aggPipe)).length;
            aggPipe.push({
                $facet: {
                    data: [{ $skip: skip }, { $limit: limit }]
                }
            });
            // console.log(JSON.stringify(aggPipe), "---------------------")
            const JoinContestData = await userLeagueModel.aggregate(aggPipe);

            // console.log("JoinContestData---->>", JoinContestData[0].data);

            let i = 0;
            const finalData = [];
            if (JoinContestData[0].data.length == 0) return { message: 'Data Not Found', status: true, data: [] };
            for await (const challanges of JoinContestData[0].data) {
                let is_recent = false
                if (challanges.is_recent == 'true' && challanges.matchtstatus == 'completed') {
                    is_recent = true
                }
                let getTotalWinners = 1;
                if (challanges.matchpricecards.length > 0) {
                    getTotalWinners = challanges.matchpricecards[challanges.matchpricecards.length - 1].max_position
                }
                const /* The above code is declaring a variable named "tmpObj" in JavaScript. */

                    tmpObj = {
                        userrank: challanges.jointeams[0].rank,
                        userpoints: challanges.jointeams[0].points,
                        userteamnumber: challanges.jointeams[0].teamnumber,
                        win_amount_str: challanges.win_amount != 0 ? `Win ₹${challanges.win_amount}` : '',
                        jointeamid: challanges.jointeamid,
                        joinedleaugeId: challanges.joinedleaugeId,
                        matchchallengeid: challanges.matchchallengeid,
                        _id: challanges.matchchallengeid,
                        matchkey: challanges.matchkey,
                        is_recent: is_recent,
                        challenge_id: challanges.challangeid,
                        expert_name: challanges.expert_name,
                        is_expert: challanges.is_expert,
                        image: challanges.image,
                        subscription_fee: challanges.subscription_fee,
                        discount_fee: challanges.discount_fee,
                        flexible_contest: challanges.flexible_contest,
                        endDate: challanges.endDate,
                        startDate: challanges.startDate,
                        refercode: challanges.refercode,
                        WinningpriceAndPrize: challanges.WinningpriceAndPrize,
                        challenge_id: challanges.challenge_id,
                        contest_name: challanges.contest_name,
                        win_amount: challanges.win_amount != 0 ? challanges.win_amount : 0,
                        is_private: challanges.is_private != 0 ? challanges.is_private : 0,
                        is_bonus: challanges.is_bonus != 0 ? challanges.is_bonus : 0,
                        bonus_percentage: challanges.bonus_percentage != 0 ? challanges.bonus_percentage : 0,
                        winning_percentage: challanges.winning_percentage != 0 ? challanges.winning_percentage : 0,
                        contest_type: challanges.contest_type != '' ? challanges.contest_type : '',
                        confirmed_challenge: challanges.confirmed != 0 ? challanges.confirmed : 0,
                        multi_entry: challanges.multi_entry != 0 ? challanges.multi_entry : 0,
                        joinedusers: challanges.joinedusers != 0 ? challanges.joinedusers : 0,
                        entryfee: challanges.entryfee != 0 ? challanges.entryfee : 0,
                        pricecard_type: challanges.pricecard_type != 0 ? challanges.pricecard_type : 0,
                        maximum_user: challanges.maximum_user != 0 ? challanges.maximum_user : 0,
                        matchFinalstatus: challanges.matchFinalstatus,
                        matchChallengeStatus: challanges.matchChallengeStatus,
                        totalwinning: Number(challanges.finalresultsAmount).toFixed(2),
                        isselected: true,
                        totalwinners: getTotalWinners,
                        matchpricecards: [],
                        pricecardstatus: 0,
                        userTeams: challanges.jointeams,
                        is_PromoCode_Contest: challanges.is_PromoCode_Contest,
                        textNote: challanges.textNote
                    };
                if (challanges.multi_entry != 0) {
                    tmpObj['team_limit'] = challanges.team_limit;
                    tmpObj['plus'] = '+';
                }
                let k = 0,
                    winners = 0;
                const price_card = [];
                tmpObj['amount_type'] = `${challanges.amount_type}`;
                let gift_image = "";
                let gift_type = "amount";
                let prize_name = "";
                let find_gift = challanges.matchpricecards.find(function (x) { return x.gift_type == "gift" });
                if (find_gift) {
                    gift_image = `${global.constant.IMAGE_URL}${find_gift.image}`;
                    gift_type = find_gift.gift_type;
                    prize_name = find_gift.prize_name;
                }
                tmpObj.gift_image = gift_image;
                tmpObj.gift_type = gift_type;
                tmpObj.prize_name = prize_name;

                tmpObj.matchpricecards = challanges.matchpricecards;
                //------------------------------------------Hide Is selected value alway send true-------------------//
                if (challanges.contest_type == 'Percentage') {
                    tmpObj['isselected'] = challanges.jointeams ?
                        challanges.multi_entry == 1 && challanges.jointeams.length < challanges.team_limit ?
                            false :
                            true :
                        false;
                } else {
                    tmpObj['isselected'] = challanges.jointeams ?
                        challanges.multi_entry == 1 &&
                            challanges.jointeams.length < challanges.team_limit &&
                            challanges.totaljointeams.length < challanges.maximum_user ?
                            false :
                            true :
                        false;
                }

                // const total_joinedcontestData = await userLeagueModel.aggregate(dataa);

                tmpObj['total_teams'] = challanges.userTeams.length || 0;
                tmpObj['total_joinedcontest'] = challanges.totaljointeams.length || 0;
                finalData.push(JSON.parse(JSON.stringify(tmpObj)));
                i++;

                if (i == JoinContestData[0].data.length) return {
                    message: 'Join Contest Data...!',
                    status: true,
                    data: finalData,
                    total_joined_contests
                };
            }
        } catch (error) {
            console.log("Error: ", error);
        }
    }
    async myJoinedContests(req) {
        try {
            const { matchkey, matchStatus } = req.query;
            let { skip = 0, limit = 10 } = req.query;
            const userId = req.user._id;

            skip = isNaN(Number(skip)) ? 0 : Number(skip);
            limit = isNaN(Number(limit)) ? 10 : Number(limit);

            // const getKey = `match:${matchkey}:user:${userId}:userJoinedContests`;
            // let myJoinedContestData = await getkeydata(getKey);

            // if (myJoinedContestData && matchStatus=='ENDED or Something'){
            //     myJoinedContestData = JSON.parse(myJoinedContestData);

            //     return {
            //         message: 'Join Contest Data...!',
            //         status: true,
            //         data: myJoinedContestData
            //     };
            // }

            let totalinvestment = 0;
            let totalwon = 0;
            let aggPipe = [];
            aggPipe = [
                {
                    $match: {
                        userid: mongoose.Types.ObjectId(userId),
                        matchkey: mongoose.Types.ObjectId(matchkey)
                    }
                },
                {
                    $group: {
                        _id: "$challengeid",
                        joinedleaugeId: {
                            $first: "$_id"
                        },
                        matchkey: {
                            $first: "$matchkey"
                        },
                        jointeamid: {
                            $first: "$teamid"
                        },
                        userid: {
                            $first: "$userid"
                        },
                        createdAt: {
                            $first: "$createdAt"
                        },
                        refercode: {
                            $first: "$refercode"
                        }
                    }
                },
                {
                    $lookup: {
                        from: "matchcontests",
                        localField: "_id",
                        foreignField: "_id",
                        as: "matchchallenge"
                    }
                },
                {
                    $unwind: {
                        path: "$matchchallenge",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $addFields: {
                        matchchallengestatus:
                            "$matchchallenge.status"
                    }
                },
                {
                    $lookup: {
                        from: "matches",
                        localField: "matchkey",
                        foreignField: "_id",
                        as: "listmatch"
                    }
                },
                {
                    $lookup: {
                        from: "userleaderboard",
                        localField: "joinedleaugeId",
                        foreignField: "joinId",
                        as: "leaderboardData"
                    }
                },
                {
                    $unwind: {
                        path: "$leaderboardData",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $addFields: {
                        finalresults: "$leaderboardData.amount"
                    }
                },
                {
                    $project: {
                        jointeamid: 1,
                        createdAt: 1,
                        expert_name: "$matchchallenge.expert_name",
                        challenge_id:
                            "$matchchallenge.challenge_id",
                        is_expert: "$matchchallenge.is_expert",
                        image: "$matchchallenge.image",
                        startDate: "$matchchallenge.startDate",
                        endDate: "$matchchallenge.endDate",
                        discount_fee:
                            "$matchchallenge.discount_fee",
                        subscription_fee:
                            "$matchchallenge.subscription_fee",
                        WinningpriceAndPrize:
                            "$matchchallenge.WinningpriceAndPrize",
                        matchchallengeid: "$matchchallenge._id",
                        flexible_contest:
                            "$matchchallenge.flexible_contest",
                        userid: 1,
                        joinedleaugeId: 1,
                        win_amount: "$matchchallenge.win_amount",
                        contest_cat: "$matchchallenge.contest_cat",
                        is_bonus: {
                            $ifNull: ["$matchchallenge.is_bonus", 0]
                        },
                        bonus_percentage: {
                            $ifNull: [
                                "$matchchallenge.bonus_percentage",
                                0
                            ]
                        },
                        is_private: {
                            $ifNull: ["$matchchallenge.is_private", 0]
                        },
                        winning_percentage:
                            "$matchchallenge.winning_percentage",
                        contest_type: {
                            $ifNull: [
                                "$matchchallenge.contest_type",
                                ""
                            ]
                        },
                        multi_entry: {
                            $ifNull: [
                                "$matchchallenge.multi_entry",
                                ""
                            ]
                        },
                        contest_name: {
                            $ifNull: [
                                "$matchchallenge.contest_name",
                                ""
                            ]
                        },
                        confirmed: {
                            $ifNull: [
                                "$matchchallenge.confirmed_challenge",
                                0
                            ]
                        },
                        matchkey: {
                            $ifNull: ["$matchchallenge.matchkey", 0]
                        },
                        joinedusers: {
                            $ifNull: [
                                "$matchchallenge.joinedusers",
                                0
                            ]
                        },
                        entryfee: {
                            $ifNull: ["$matchchallenge.entryfee", 0]
                        },
                        pricecard_type: {
                            $ifNull: [
                                "$matchchallenge.pricecard_type",
                                0
                            ]
                        },
                        maximum_user: {
                            $ifNull: [
                                "$matchchallenge.maximum_user",
                                0
                            ]
                        },
                        team_limit: {
                            $ifNull: [
                                "$matchchallenge.team_limit",
                                11
                            ]
                        },
                        matchFinalstatus: {
                            $ifNull: [
                                {
                                    $arrayElemAt: [
                                        "$listmatch.final_status",
                                        0
                                    ]
                                },
                                ""
                            ]
                        },
                        matchpricecards:
                            "$matchchallenge.matchpricecards",
                        matchChallengeStatus:
                            "$matchchallenge.status",
                        jointeams: {
                            $filter: {
                                input: "$jointeamids.jointeam",
                                as: "team",
                                cond: {
                                    $eq: [
                                        "$$team.userId",
                                        mongoose.Types.ObjectId(req.user._id)
                                    ]
                                }
                            }
                        },
                        bonus_date: "",
                        totaljointeams: "$jointeamids.jointeam",
                        jointeamids: "$jointeamids",
                        refercode: "$refercode",
                        finalresultsAmount: "$finalresults",
                        amount_type: {
                            $ifNull: [
                                "$matchchallenge.amount_type",
                                ""
                            ]
                        },
                        is_PromoCode_Contest: "$matchchallenge.is_PromoCode_Contest",
                        extrapricecard: "$matchchallenge.extrapricecard"
                    }
                },

                {
                    $sort: {
                        createdAt: 1
                    }
                },
            ];
            let total_joined_contests = await (await userLeagueModel.aggregate(aggPipe)).length;
            aggPipe.push({
                $facet: {
                    data: [{ $skip: skip }, { $limit: limit }]
                }
            });
            // console.log('aggPipe----->>>>', JSON.stringify(aggPipe));
            const JoinContestData = await userLeagueModel.aggregate(aggPipe);
            if (JoinContestData[0].data.length === 0) return { message: 'Data Not Found', status: true, data: [] };
            const finalData = [];

            for (const challanges of JoinContestData[0].data) {
                let ttlJointeam = await userLeagueModel.countDocuments({ challengeid: challanges._id, userid: mongoose.Types.ObjectId(req.user._id) });
                const tmpObj = {
                    userrank: 1,
                    userpoints: 1,
                    userteamnumber: 1,
                    win_amount_str: challanges.win_amount !== 0 ? `Win ₹${challanges.win_amount}` : '',
                    jointeamid: challanges.jointeamid,
                    joinedleaugeId: challanges.joinedleaugeId,
                    matchchallengeid: challanges.matchchallengeid,
                    _id: challanges.matchchallengeid,
                    matchkey: challanges.matchkey,
                    is_recent: challanges.is_recent === 'true' && challanges.matchtstatus === 'completed',
                    challengeId: challanges.challangeid,
                    expert_name: challanges.expert_name,
                    is_expert: challanges.is_expert,
                    image: challanges.image,
                    subscription_fee: challanges.subscription_fee,
                    discountFee: challanges.discount_fee,
                    flexibleContest: challanges.flexible_contest,
                    endDate: challanges.endDate,
                    startDate: challanges.startDate,
                    refercode: challanges.refercode,
                    WinningpriceAndPrize: challanges.WinningpriceAndPrize,
                    contest_name: challanges.contest_name,
                    winAmount: challanges.win_amount !== 0 ? challanges.win_amount : 0,
                    isPrivate: challanges.is_private !== 0 ? challanges.is_private : 0,
                    isBonus: challanges.is_bonus !== 0 ? challanges.is_bonus : 0,
                    bonusPercentage: challanges.bonus_percentage !== 0 ? challanges.bonus_percentage : 0,
                    winningPercentage: challanges.winning_percentage !== 0 ? challanges.winning_percentage : 0,
                    contestType: challanges.contest_type !== '' ? challanges.contest_type : '',
                    confirmedChallenge: challanges.confirmed !== 0 ? challanges.confirmed : 0,
                    multiEntry: challanges.multi_entry !== 0 ? challanges.multi_entry : 0,
                    joinedusers: challanges.joinedusers !== 0 ? challanges.joinedusers : 0,
                    entryfee: challanges.entryfee !== 0 ? challanges.entryfee : 0,
                    pricecard_type: challanges.pricecard_type !== 0 ? challanges.pricecard_type : 0,
                    maximumUser: challanges.maximum_user !== 0 ? challanges.maximum_user : 0,
                    matchFinalstatus: challanges.matchFinalstatus,
                    matchChallengeStatus: challanges.matchChallengeStatus,
                    totalwinning: Number(challanges.finalresultsAmount).toFixed(2),
                    isselected: true,
                    totalwinners: challanges.matchpricecards.length > 0
                        ? challanges.matchpricecards[challanges.matchpricecards.length - 1].max_position
                        : 1,
                    matchpricecards: [],
                    pricecardstatus: 0,
                    userTeams: [],
                    isPromoCodeContest: challanges.is_PromoCode_Contest,
                    extrapricecard: challanges?.extrapricecard || []
                };

                if (challanges.multi_entry !== 0) {
                    tmpObj.teamLimit = challanges.team_limit;
                    tmpObj.plus = '+';
                }


                tmpObj.amount_type = `${challanges.amount_type}`;


                const find_gift = challanges.matchpricecards.find(x => x.gift_type === "gift");
                if (find_gift) {
                    tmpObj.gift_image = `${global.constant.IMAGE_URL}${find_gift.image}`;
                    tmpObj.gift_type = find_gift.gift_type;
                    tmpObj.prize_name = find_gift.prize_name;
                } else {
                    tmpObj.gift_image = "";
                    tmpObj.gift_type = "amount";
                    tmpObj.prize_name = "";
                }

                tmpObj.matchpricecards = challanges.matchpricecards;

                if (challanges.contest_type === 'Percentage') {
                    tmpObj.isselected = challanges.jointeams
                        ? (challanges.multi_entry === 1 && ttlJointeam < challanges.team_limit)
                            ? false
                            : true
                        : false;
                } else {
                    tmpObj.isselected = ttlJointeam
                        ? (challanges.multi_entry === 1 && ttlJointeam < challanges.team_limit
                            // && challanges.totaljointeams.length < challanges.maximum_user
                        )
                            ? false
                            : true
                        : false;
                }


                tmpObj.totalTeams = 0;
                tmpObj.totalJoinedcontest = total_joined_contests || 0;
                if (challanges?.status != 'canceled') {
                    totalinvestment = totalinvestment + (challanges?.entryfee * ttlJointeam);
                    totalwon = totalwon + challanges.finalresultsAmount;
                }
                finalData.push(JSON.parse(JSON.stringify(tmpObj)));

            }

            return {
                message: 'Join Contest Data...!',
                status: true,
                data: finalData,
                total_joined_contests, totalinvestment, totalwon
            };

        } catch (error) {
            console.log("Error: ", error);
        }
    }

    async oldUpdateJoinedusers(req) {
        try {
            console.log("--joinUserUpdate----");
            let aggPipe = [];
            aggPipe.push({
                $match: {
                    matchkey: mongoose.Types.ObjectId(req.query.matchkey),
                    contest_type: 'Amount',
                    status: 'opened'
                }
            });
            aggPipe.push({
                $lookup: {
                    from: "userleagues",
                    localField: "_id",
                    foreignField: "challengeid",
                    as: "joinedleauges"
                }
            });
            aggPipe.push({
                $addFields: {
                    joinedleauges: {
                        $size: "$joinedleauges"
                    }
                }
            });
            const matchchallengesData = await matchchallengesModel.aggregate(aggPipe);
            for (const matchchallenge of matchchallengesData) {
                if (matchchallenge.maximum_user === matchchallenge.joinedleauges) {
                    const update = {
                        $set: {
                            status: 'closed',
                            is_duplicated: 1,
                            joinedusers: matchchallenge.joinedleauges,
                        },
                    };

                    if (matchchallenge.is_running === 1 && matchchallenge.is_duplicated !== 1) {
                        const newMatchChallenge = {
                            joinedusers: 0,
                            contestid: matchchallenge.contestid,
                            contest_cat: matchchallenge.contest_cat,
                            challenge_id: matchchallenge.challenge_id,
                            matchkey: matchchallenge.matchkey,
                            fantasy_type: matchchallenge.fantasy_type,
                            entryfee: matchchallenge.entryfee,
                            win_amount: matchchallenge.win_amount,
                            multiple_entryfee: matchchallenge.multiple_entryfee,
                            expert_teamid: matchchallenge.expert_teamid,
                            maximum_user: matchchallenge.maximum_user,
                            status: matchchallenge.status,
                            created_by: matchchallenge.created_by,
                            contest_type: matchchallenge.contest_type,
                            expert_name: matchchallenge.expert_name,
                            contest_name: matchchallenge.contest_name || '',
                            amount_type: matchchallenge.amount_type,
                            mega_status: matchchallenge.mega_status,
                            winning_percentage: matchchallenge.winning_percentage,
                            is_bonus: matchchallenge.is_bonus,
                            bonus_percentage: matchchallenge.bonus_percentage,
                            pricecard_type: matchchallenge.pricecard_type,
                            minimum_user: matchchallenge.minimum_user,
                            confirmed_challenge: matchchallenge.confirmed_challenge,
                            multi_entry: matchchallenge.multi_entry,
                            team_limit: matchchallenge.team_limit,
                            image: matchchallenge.image,
                            c_type: matchchallenge.c_type,
                            is_private: matchchallenge.is_private,
                            is_running: matchchallenge.is_running,
                            is_expert: matchchallenge.is_expert,
                            bonus_percentage: matchchallenge.bonus_percentage,
                            matchpricecards: matchchallenge.matchpricecards,
                            team1players: matchchallenge.team1players,
                            team2players: matchchallenge.team2players,
                        };

                        const data = await matchchallengesModel.findOne({
                            matchkey: matchchallenge.matchkey,
                            fantasy_type: matchchallenge.fantasy_type,
                            entryfee: matchchallenge.entryfee,
                            win_amount: matchchallenge.win_amount,
                            maximum_user: matchchallenge.maximum_user,
                            joinedusers: 0,
                            status: matchchallenge.status,
                            is_duplicated: { $ne: 1 }
                        });

                        if (!data) {
                            const createNewContest = new matchchallengesModel(newMatchChallenge);
                            const mynewContest = await createNewContest.save();
                        }
                    }

                    await matchchallengesModel.updateOne({ _id: mongoose.Types.ObjectId(matchchallenge._id) }, update);
                }
            }
            return true;
        } catch (error) {
            throw error;
        }
    }
    async joinUserUpdate(req) {
        try {
            console.log("--joinUserUpdate--");

            const matchkey = mongoose.Types.ObjectId(req.query.matchkey);

            // Aggregate challenges with the required data
            const matchChallengesData = await matchchallengesModel.aggregate([
                {
                    $match: {
                        matchkey,
                        contest_type: 'Amount',
                        status: 'opened'
                    }
                },
                {
                    $lookup: {
                        from: "userleagues",
                        localField: "_id",
                        foreignField: "challengeid",
                        pipeline: [
                            {
                                $project: {
                                    joineduser: 1
                                }
                            }
                        ],
                        as: "joinedleauges"
                    }
                },
                {
                    $addFields: {
                        joinedleauges: { $size: "$joinedleauges" }
                    }
                },
                {
                    $project: {
                        _id: 1,
                        maximum_user: 1,
                        joinedleauges: 1,
                        is_running: 1,
                        is_duplicated: 1,
                        contestid: 1,
                        contest_cat: 1,
                        challenge_id: 1,
                        matchkey: 1,
                        fantasy_type: 1,
                        entryfee: 1,
                        win_amount: 1,
                        multiple_entryfee: 1,
                        expert_teamid: 1,
                        status: 1,
                        created_by: 1,
                        contest_type: 1,
                        expert_name: 1,
                        contest_name: 1,
                        amount_type: 1,
                        mega_status: 1,
                        winning_percentage: 1,
                        is_bonus: 1,
                        bonus_percentage: 1,
                        pricecard_type: 1,
                        minimum_user: 1,
                        confirmed_challenge: 1,
                        multi_entry: 1,
                        team_limit: 1,
                        image: 1,
                        c_type: 1,
                        is_private: 1,
                        is_expert: 1,
                        matchpricecards: 1,
                        team1players: 1,
                        team2players: 1,
                    }
                }
            ]);

            // Prepare bulk operations
            const bulkOps = [];
            const newChallenges = [];

            // console.log("matchChallengesData", matchChallengesData);

            for (const matchChallenge of matchChallengesData) {
                const { _id, joinedleauges, maximum_user, is_running, is_duplicated } = matchChallenge;

                if (joinedleauges === maximum_user) {
                    // Update the current challenge
                    bulkOps.push({
                        updateOne: {
                            filter: { _id },
                            update: {
                                $set: {
                                    status: 'closed',
                                    is_duplicated: 1,
                                    joinedusers: joinedleauges
                                }
                            }
                        }
                    });

                    // Check if a duplicate challenge needs to be created
                    if (is_running === 1 && is_duplicated !== 1) {
                        const existingChallenge = await matchchallengesModel.findOne({
                            matchkey,
                            fantasy_type: matchChallenge.fantasy_type,
                            entryfee: matchChallenge.entryfee,
                            win_amount: matchChallenge.win_amount,
                            maximum_user: matchChallenge.maximum_user,
                            joinedusers: 0,
                            status: matchChallenge.status,
                            is_duplicated: { $ne: 1 }
                        }).lean();

                        if (!existingChallenge) {
                            const newChallenge = {
                                ...matchChallenge,
                                joinedusers: 0,
                                is_duplicated: 0,
                                status: 'opened'
                            };
                            delete newChallenge._id; // Avoid ID conflict
                            newChallenges.push(newChallenge);
                        }
                    }
                }
            }

            // Execute bulk updates
            if (bulkOps.length > 0) {
                await matchchallengesModel.bulkWrite(bulkOps);
            }

            // Insert new challenges if needed
            if (newChallenges.length > 0) {
                await matchchallengesModel.insertMany(newChallenges);
            }

            return true;
        } catch (error) {
            console.error("Error in joinUserUpdate:", error);
            throw error;
        }
    }


    async userJoinContest(req) {
        try {
            const { matchkey, matchStatus } = req.query;
            let { skip = 0, limit = 10 } = req.query;
            const userId = req.user._id;

            skip = isNaN(Number(skip)) ? 0 : Number(skip);
            limit = isNaN(Number(limit)) ? 10 : Number(limit);
            let keyname = `listMatchesModel-${matchkey}`
            let match = await redisjoinTeams.getkeydata(keyname);
            if (!match) {
                match = await matchesModel.findOne({ _id: mongoose.Types.ObjectId(matchkey) });
                redisjoinTeams.setkeydata(keyname, match, 60 * 60 * 4);
            }
            if (match.final_status == 'winnerdeclared' || match.final_status == 'IsCanceled' || match.final_status == 'IsAbandoned') {
                return this.myJoinedContests(req);
            }
            if (match?.status != "notstarted") {
                return this.myJoinedContestsLiveRedis(req);
            }
            let keyUserJoinedChallenge = `match:${matchkey}:user:${userId}:joinedContests`;
            let myJoinedContestData = await getMyLeaderBoard(keyUserJoinedChallenge, req.user._id, 'contest');
            let totalinvestment = 0;
            let totalwon = 0;
            if (myJoinedContestData == false) return { message: 'Data Not Found', status: true, data: [], total_joined_contests: 0 };
            const finalData = [];
            for (const challanges of myJoinedContestData) {
                if (challanges?._id) {
                    const redisKey = `match:${matchkey}:user:${userId}:teams`;
                    let cachedTeams = await redisjoinTeams.getkeydata(redisKey);
                    let keyLeaderBoard = `match:${matchkey}:challenge:${challanges._id}:user:${userId}:userLeaderBoard`;
                    let userLeaderboard = await getMyLeaderBoard(keyLeaderBoard, userId);
                    if (userLeaderboard?.length > 0) {
                        const ChallengeKey = `match:${matchkey}:challenges`;
                        var challengeData = await redisContest.hgetData(ChallengeKey, challanges._id);

                        if (!challengeData) {
                            var challengeData = await matchchallengesModel.findOne({ _id: challanges._id }).lean();
                        }
                        // let membersData = [];
                        // if (userLeaderboard.length > 0) {
                        //     membersData = userLeaderboard.map(item => item._id.split('-')[0]);
                        // } else {
                        //     let aggPipe = [];
                        //     aggPipe.push({
                        //         $match: {
                        //             userId: new mongoose.Types.ObjectId(req.user._id)
                        //         }
                        //     });
                        //     aggPipe.push({
                        //         $project: {
                        //             _id: { $toString: "$_id" }
                        //         }
                        //     }, {
                        //         $group: {
                        //             _id: null,
                        //             data: {
                        //                 $push: "$_id"
                        //             }
                        //         }
                        //     });
                        //     const members = await userLeaderBoardModel.aggregate(aggPipe);
                        //     membersData = members[0]?.data;
                        // }
                        // let keyChallengeLeaderBoard = 'liveRanksLeaderboard_' + challanges._id;
                        // let userLeaderboardAmount = await particularUserLeaderBoard(keyChallengeLeaderBoard, req.user._id, '', membersData);
                        let totalWinningAmount = 0;
                        let highestRankData = [];
                        let top4Teams = [];
                        // if (Array.isArray(userLeaderboardAmount) && userLeaderboardAmount.length > 0) {
                        //     // Sort by getcurrentrank (lower rank is better, so ascending)
                        //     userLeaderboardAmount.sort((a, b) => a.getcurrentrank - b.getcurrentrank);

                        //     // Get top 4 teams
                        //     top4Teams = userLeaderboardAmount.slice(0, 4);

                        //     // Calculate total winning amount for top 4 teams
                        //     totalWinningAmount = userLeaderboardAmount.reduce((sum, item) => sum + (item.amount || 0), 0);

                        //     // Optional: Get teams with the highest rank (i.e., the worst performance)
                        //     const maxRank = Math.max(...userLeaderboardAmount.map(item => item.getcurrentrank));
                        //     highestRankData = userLeaderboardAmount.filter(item => item.getcurrentrank === maxRank);
                        // }

                        const tmpObj = {
                            userrank: 1,
                            userpoints: highestRankData[0]?.getcurrentrank,
                            userteamnumber: highestRankData[0]?.teamnumber,
                            win_amount_str: challengeData?.win_amount !== 0 ? `Win ₹${challengeData?.win_amount}` : '',
                            jointeamid: userLeaderboard[0].jointeamid,
                            joinedleaugeId: userLeaderboard[0].joinedleaugeId,
                            matchchallengeid: challanges._id,
                            _id: challanges._id,
                            matchkey: matchkey,
                            is_recent: challengeData?.is_recent === 'true' && challengeData?.matchtstatus === 'completed',
                            challengeId: challengeData?.matchchallengeid,
                            expert_name: challengeData?.expert_name,
                            is_expert: challengeData?.is_expert,
                            team_type_name: challengeData?.team_type_name,
                            image: challengeData?.image,
                            subscription_fee: challengeData?.subscription_fee,
                            discountFee: challengeData?.discount_fee,
                            flexibleContest: challengeData?.flexible_contest,
                            endDate: challengeData?.endDate,
                            bonus_type: challengeData?.bonus_type,
                            startDate: challengeData?.startDate,
                            refercode: userLeaderboard[0].refercode,
                            WinningpriceAndPrize: challengeData?.WinningpriceAndPrize,
                            contest_name: challengeData?.contest_name,
                            winAmount: challengeData?.win_amount !== 0 ? challengeData?.win_amount : 0,
                            isPrivate: challengeData?.is_private !== 0 ? challengeData?.is_private : 0,
                            isBonus: challengeData?.is_bonus !== 0 ? challengeData?.is_bonus : 0,
                            bonusPercentage: challengeData?.bonus_percentage !== 0 ? challengeData?.bonus_percentage : 0,
                            winningPercentage: challengeData?.winning_percentage !== 0 ? challengeData?.winning_percentage : 0,
                            contestType: challengeData?.contest_type !== '' ? challengeData?.contest_type : '',
                            confirmedChallenge: challengeData?.confirmed !== 0 ? challengeData?.confirmed : 0,
                            multiEntry: challengeData?.multi_entry !== 0 ? challengeData?.multi_entry : 0,
                            joinedusers: challengeData?.joinedusers !== 0 ? Number(challengeData?.joinedusers) : 0,
                            entryfee: challengeData?.entryfee !== 0 ? challengeData?.entryfee : 0,
                            pricecard_type: challengeData?.pricecard_type !== 0 ? challengeData?.pricecard_type : 0,
                            maximumUser: challengeData?.maximum_user !== 0 ? challengeData?.maximum_user : 0,
                            matchFinalstatus: match.final_status,
                            matchChallengeStatus: challengeData?.status,
                            totalwinning: Number(totalWinningAmount).toFixed(2),
                            isselected: true,
                            totalwinners: challengeData?.totalwinners,
                            pricecardstatus: 0,
                            userTeams: [],
                            isPromoCodeContest: challengeData?.is_PromoCode_Contest,
                            compress: challengeData?.compress || false,
                            extrapricecard: challengeData?.extrapricecard
                        };

                        if (challengeData?.multi_entry !== 0) {
                            tmpObj.teamLimit = challengeData?.team_limit;
                            tmpObj.plus = '+';
                        }
                        tmpObj.extrapricecard = challengeData?.extrapricecard || [];
                        tmpObj.amount_type = `${challengeData?.amount_type}`;
                        let price_card = [], matchpricecard = [];
                        if (challengeData?.compress == false) {
                            let keyPricecard = `challengePricecard:${challanges._id}`;
                            matchpricecard = await redisContest.getkeydata(keyPricecard);
                            if (!matchpricecard || matchpricecard.length <= 0) {
                                const challengeData = await matchchallengesModel.findById(challanges._id);
                                matchpricecard = challengeData?.matchpricecards || [];
                                await redisContest.setkeydata(keyPricecard, matchpricecard, 60 * 60 * 24 * 10);
                            }
                        } else {
                            matchpricecard = challengeData?.matchpricecard || [];
                        }
                        let winners = 0;
                        if (matchpricecard.length > 0) {
                            for await (const priceCard of matchpricecard) {
                                price_card.push({
                                    winners: Number(priceCard.winners),
                                    image: priceCard.image,
                                    price: priceCard.price,
                                    min_position: priceCard.min_position,
                                    max_position: priceCard.max_position,
                                    total: priceCard.total,
                                    gift_type: priceCard.gift_type,
                                    amount_type: priceCard.type
                                })
                                winners += Number(priceCard.winners);
                            }
                        } else {
                            price_card.push({
                                winners: 1,
                                image: "",
                                price: challengeData.win_amount,
                                total: challengeData.win_amount,
                                amount_type: challengeData.amount_type,
                                min_position: 0,
                                max_position: 1,
                            });
                            winners = 1;
                        }

                        tmpObj.matchpricecards = price_card;

                        if (userLeaderboard.length > 0) {
                            if (challengeData?.multi_entry == 1 && userLeaderboard.length < challengeData?.team_limit) {
                                if (challengeData?.contest_type == 'Amount') {
                                    tmpObj.isselected = userLeaderboard.length == challengeData?.team_limit || challengeData?.joinedusers == challengeData?.maximum_user;
                                } else if (challengeData?.contest_type == 'Percentage') {
                                    tmpObj.isselected = userLeaderboard.length == challengeData?.team_limit;
                                } else {
                                    tmpObj.isselected = false;
                                }
                            } else {
                                tmpObj.isselected = true;
                            }
                        }

                        tmpObj.totalTeams = cachedTeams.length;
                        tmpObj.totalJoinedcontest = challanges.getcurrentrank || 0;
                        if (challengeData?.status != 'canceled') {
                            totalinvestment = totalinvestment + (challengeData?.entryfee * challanges.getcurrentrank);
                            totalwon = totalwon + totalWinningAmount;
                        }
                        finalData.push(JSON.parse(JSON.stringify(tmpObj)));
                    }
                }

            }

            return {
                message: 'Join Contest Data...!',
                status: true,
                data: finalData,
                total_joined_contests: myJoinedContestData.length,
                totalinvestment, totalwon
                // total_joined_contests
            };

        } catch (error) {
            console.log("Error: ", error);
        }
    }
    async myJoinedContestsLiveRedis(req) {
        try {
            let { skip = 0, limit = 10, matchkey, matchStatus } = req.query;
            const userId = req.user._id;

            skip = isNaN(Number(skip)) ? 0 : Number(skip);
            limit = isNaN(Number(limit)) ? 10 : Number(limit);
            let keyname = `listMatchesModel-${matchkey}`
            let match = await redisjoinTeams.getkeydata(keyname);
            if (!match) {
                match = await matchesModel.findOne({ _id: mongoose.Types.ObjectId(matchkey) });
                setkeydata(keyname, match, 60 * 60 * 4);
            }
            let keyUserJoinedChallenge = `match:${matchkey}:user:${userId}:joinedContests`;
            let myJoinedContestData = await redisLiveLeaderboard.getMyLeaderBoard(keyUserJoinedChallenge, req.user._id, 'contest');
            let totalinvestment = 0;
            let totalwon = 0;
            if (myJoinedContestData == false) return { message: 'Data Not Found', status: true, data: [], total_joined_contests: 0 };
            const finalData = [];
            for (const challanges of myJoinedContestData) {
                if (challanges?._id) {
                    const redisKey = `match:${matchkey}:user:${userId}:teams`;
                    let cachedTeams = await redisLiveJoinTeams.getkeydata(redisKey);
                    let keyLeaderBoard = `match:${matchkey}:challenge:${challanges._id}:user:${userId}:userLeaderBoard`;
                    let userLeaderboard = await redisLiveLeaderboard.getMyLeaderBoard(keyLeaderBoard, userId);
                    if (userLeaderboard?.length > 0) {
                        const ChallengeKey = `match:${matchkey}:challenges`;
                        var challengeData = await redisLiveContest.hgetData(ChallengeKey, challanges._id);
                        if (!challengeData) {
                            var challengeData = await matchchallengesModel.findOne({ _id: challanges._id }).lean();
                        }
                        let totalWinningAmount = 0;
                        let highestRankData = [];
                        let top4Teams = [];
                        const tmpObj = {
                            userrank: 1,
                            userpoints: highestRankData[0]?.getcurrentrank,
                            userteamnumber: highestRankData[0]?.teamnumber,
                            win_amount_str: challengeData?.win_amount !== 0 ? `Win ₹${challengeData?.win_amount}` : '',
                            jointeamid: userLeaderboard[0].jointeamid,
                            joinedleaugeId: userLeaderboard[0].joinedleaugeId,
                            matchchallengeid: challanges._id,
                            _id: challanges._id,
                            matchkey: matchkey,
                            is_recent: challengeData?.is_recent === 'true' && challengeData?.matchtstatus === 'completed',
                            challengeId: challengeData?.matchchallengeid,
                            expert_name: challengeData?.expert_name,
                            is_expert: challengeData?.is_expert,
                            image: challengeData?.image,
                            subscription_fee: challengeData?.subscription_fee,
                            discountFee: challengeData?.discount_fee,
                            flexibleContest: challengeData?.flexible_contest,
                            endDate: challengeData?.endDate,
                            startDate: challengeData?.startDate,
                            refercode: userLeaderboard[0].refercode,
                            WinningpriceAndPrize: challengeData?.WinningpriceAndPrize,
                            contest_name: challengeData?.contest_name,
                            winAmount: challengeData?.win_amount !== 0 ? challengeData?.win_amount : 0,
                            isPrivate: challengeData?.is_private !== 0 ? challengeData?.is_private : 0,
                            isBonus: challengeData?.is_bonus !== 0 ? challengeData?.is_bonus : 0,
                            bonusPercentage: challengeData?.bonus_percentage !== 0 ? challengeData?.bonus_percentage : 0,
                            winningPercentage: challengeData?.winning_percentage !== 0 ? challengeData?.winning_percentage : 0,
                            contestType: challengeData?.contest_type !== '' ? challengeData?.contest_type : '',
                            confirmedChallenge: challengeData?.confirmed !== 0 ? challengeData?.confirmed : 0,
                            multiEntry: challengeData?.multi_entry !== 0 ? challengeData?.multi_entry : 0,
                            joinedusers: challengeData?.joinedusers !== 0 ? Number(challengeData?.joinedusers) : 0,
                            entryfee: challengeData?.entryfee !== 0 ? challengeData?.entryfee : 0,
                            pricecard_type: challengeData?.pricecard_type !== 0 ? challengeData?.pricecard_type : 0,
                            maximumUser: challengeData?.maximum_user !== 0 ? challengeData?.maximum_user : 0,
                            matchFinalstatus: match.final_status,
                            matchChallengeStatus: challengeData?.status,
                            totalwinning: Number(totalWinningAmount).toFixed(2),
                            isselected: true,
                            totalwinners: challengeData?.totalwinners,
                            pricecardstatus: 0,
                            userTeams: [],
                            isPromoCodeContest: challengeData?.is_PromoCode_Contest
                        };

                        if (challengeData?.multi_entry !== 0) {
                            tmpObj.teamLimit = challengeData?.team_limit;
                            tmpObj.plus = '+';
                        }
                        tmpObj.extrapricecard = challengeData?.extrapricecard || [];
                        tmpObj.amount_type = `${challengeData?.amount_type}`;
                        let price_card = [], matchpricecard = [];
                        // console.log('challengeData', JSON.stringify(challengeData));
                        // console.log('challengeData?.compress', challengeData?.compress);
                        if (challengeData?.compress == false) {
                            let keyPricecard = `challengePricecard:${challanges._id}`;
                            matchpricecard = await redisContest.getkeydata(keyPricecard);
                            if (!matchpricecard || matchpricecard.length <= 0) {
                                const challengeData = await matchchallengesModel.findById(challanges._id);
                                matchpricecard = challengeData?.matchpricecards || [];
                                await redisContest.setkeydata(keyPricecard, matchpricecard, 60 * 60 * 24 * 10);
                            }
                        } else {
                            const challengeData = await matchchallengesModel.findById(challanges._id);
                            matchpricecard = challengeData?.matchpricecards || [];
                        }
                        // console.log('matchpricecard', matchpricecard);
                        let winners = 0;
                        if (matchpricecard.length > 0) {
                            for await (const priceCard of matchpricecard) {
                                price_card.push({
                                    winners: Number(priceCard.winners),
                                    image: priceCard.image,
                                    price: priceCard.price,
                                    min_position: priceCard.min_position,
                                    max_position: priceCard.max_position,
                                    total: priceCard.total,
                                    gift_type: priceCard.gift_type,
                                    amount_type: priceCard.type
                                })
                                winners += Number(priceCard.winners);
                            }
                        } else {
                            price_card.push({
                                winners: 1,
                                image: "",
                                price: challengeData.win_amount,
                                total: challengeData.win_amount,
                                amount_type: challengeData.amount_type,
                                min_position: 0,
                                max_position: 1,
                            });
                            winners = 1;
                        }

                        tmpObj.matchpricecards = price_card;

                        if (userLeaderboard.length > 0) {
                            if (challengeData?.multi_entry == 1 && userLeaderboard.length < challengeData?.team_limit) {
                                if (challengeData?.contest_type == 'Amount') {
                                    tmpObj.isselected = userLeaderboard.length == challengeData?.team_limit || challengeData?.joinedusers == challengeData?.maximum_user;
                                } else if (challengeData?.contest_type == 'Percentage') {
                                    tmpObj.isselected = userLeaderboard.length == challengeData?.team_limit;
                                } else {
                                    tmpObj.isselected = false;
                                }
                            } else {
                                tmpObj.isselected = true;
                            }
                        }

                        tmpObj.totalTeams = cachedTeams.length;
                        tmpObj.totalJoinedcontest = challanges.getcurrentrank || 0;
                        if (challengeData?.status != 'canceled') {
                            totalinvestment = totalinvestment + (challengeData?.entryfee * challanges.getcurrentrank);
                            totalwon = totalwon + totalWinningAmount;
                        }
                        finalData.push(JSON.parse(JSON.stringify(tmpObj)));
                    }
                }

            }

            return {
                message: 'Join Contest Data...!',
                status: true,
                data: finalData,
                total_joined_contests: myJoinedContestData.length,
                totalinvestment, totalwon
                // total_joined_contests
            };

        } catch (error) {
            console.log("Error: ", error);
        }
    }
    async userJoinContestRedisNew(req) {
        try {
            const { matchkey, matchStatus } = req.query;
            let { skip = 0, limit = 10 } = req.query;
            const userId = req.user._id;

            skip = isNaN(Number(skip)) ? 0 : Number(skip);
            limit = isNaN(Number(limit)) ? 10 : Number(limit);

            let keyname = `listMatchesModel-${matchkey}`
            let match = await redisjoinTeams.getkeydata(keyname);
            if (!match) {
                match = await matchesModel.findOne({ _id: mongoose.Types.ObjectId(matchkey) });
                setkeydata(keyname, match, 60 * 60 * 4);
            }

            if (match?.status == "completed") {
                return this.myJoinedContests(req);
            }
            let keyUserJoinedChallenge = `match:${matchkey}:user:${userId}:joinedContests`;
            let myJoinedContestData = await getMyLeaderBoardNew(keyUserJoinedChallenge, req.user._id, 'contest');


            let totalinvestment = 0;
            let totalwon = 0;
            if (myJoinedContestData == false) return { message: 'Data Not Found', status: true, data: [], total_joined_contests: 0 };
            const finalData = [];
            for (const challanges of myJoinedContestData) {
                if (challanges?._id) {
                    const redisKey = `match:${matchkey}:user:${userId}:teams`;
                    let cachedTeams = await redisjoinTeams.getkeydata(redisKey);

                    let keyLeaderBoard = `match:${matchkey}:challenge:${challanges._id}:user:${userId}:userLeaderBoard`;
                    let userLeaderboard = await getMyLeaderBoard(keyLeaderBoard, userId);
                    // console.log('userLeaderboard---->>>>>>>', userLeaderboard);
                    // sss
                    if (userLeaderboard?.length > 0) {
                        const ChallengeKey = `match:${matchkey}:challenges`;
                        var challengeData = await redisContest.hgetData(ChallengeKey, challanges._id);
                        if (!challengeData) {
                            var challengeData = await matchchallengesModel.findOne({ _id: challanges._id }).lean();
                        }

                        let membersData = [];
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
                            membersData = members[0]?.data;
                        }
                        let keyChallengeLeaderBoard = 'liveRanksLeaderboard_' + challanges._id;
                        let userLeaderboardAmount = await particularUserLeaderBoard(keyChallengeLeaderBoard, req.user._id, '', membersData);
                        let totalWinningAmount = 0;
                        let highestRankData = [];
                        let top4Teams = [];
                        // if (Array.isArray(userLeaderboardAmount) && userLeaderboardAmount.length > 0) {
                        //     // Sort by getcurrentrank (lower rank is better, so ascending)
                        //     userLeaderboardAmount.sort((a, b) => a.getcurrentrank - b.getcurrentrank);

                        //     // Get top 4 teams
                        //     top4Teams = userLeaderboardAmount.slice(0, 4);

                        //     // Calculate total winning amount for top 4 teams
                        //     totalWinningAmount = userLeaderboardAmount.reduce((sum, item) => sum + (item.amount || 0), 0);

                        //     // Optional: Get teams with the highest rank (i.e., the worst performance)
                        //     const maxRank = Math.max(...userLeaderboardAmount.map(item => item.getcurrentrank));
                        //     highestRankData = userLeaderboardAmount.filter(item => item.getcurrentrank === maxRank);
                        // }

                        const tmpObj = {
                            userrank: 1,
                            userpoints: highestRankData[0]?.getcurrentrank,
                            userteamnumber: highestRankData[0]?.teamnumber,
                            win_amount_str: challengeData?.win_amount !== 0 ? `Win ₹${challengeData?.win_amount}` : '',
                            jointeamid: userLeaderboard[0].jointeamid,
                            joinedleaugeId: userLeaderboard[0].joinedleaugeId,
                            matchchallengeid: challanges._id,
                            _id: challanges._id,
                            matchkey: matchkey,
                            is_recent: challengeData?.is_recent === 'true' && challengeData?.matchtstatus === 'completed',
                            challengeId: challengeData?.matchchallengeid,
                            expert_name: challengeData?.expert_name,
                            is_expert: challengeData?.is_expert,
                            image: challengeData?.image,
                            subscription_fee: challengeData?.subscription_fee,
                            discountFee: challengeData?.discount_fee,
                            flexibleContest: challengeData?.flexible_contest,
                            endDate: challengeData?.endDate,
                            startDate: challengeData?.startDate,
                            refercode: userLeaderboard[0].refercode,
                            WinningpriceAndPrize: challengeData?.WinningpriceAndPrize,
                            contest_name: challengeData?.contest_name,
                            winAmount: challengeData?.win_amount !== 0 ? challengeData?.win_amount : 0,
                            isPrivate: challengeData?.is_private !== 0 ? challengeData?.is_private : 0,
                            isBonus: challengeData?.is_bonus !== 0 ? challengeData?.is_bonus : 0,
                            bonusPercentage: challengeData?.bonus_percentage !== 0 ? challengeData?.bonus_percentage : 0,
                            winningPercentage: challengeData?.winning_percentage !== 0 ? challengeData?.winning_percentage : 0,
                            contestType: challengeData?.contest_type !== '' ? challengeData?.contest_type : '',
                            confirmedChallenge: challengeData?.confirmed !== 0 ? challengeData?.confirmed : 0,
                            multiEntry: challengeData?.multi_entry !== 0 ? challengeData?.multi_entry : 0,
                            joinedusers: challengeData?.joinedusers !== 0 ? Number(challengeData?.joinedusers) : 0,
                            entryfee: challengeData?.entryfee !== 0 ? challengeData?.entryfee : 0,
                            pricecard_type: challengeData?.pricecard_type !== 0 ? challengeData?.pricecard_type : 0,
                            maximumUser: challengeData?.maximum_user !== 0 ? challengeData?.maximum_user : 0,
                            matchFinalstatus: match.final_status,
                            matchChallengeStatus: challengeData?.status,
                            totalwinning: Number(totalWinningAmount).toFixed(2),
                            isselected: true,
                            totalwinners: challengeData?.totalwinners,
                            pricecardstatus: 0,
                            userTeams: [],
                            isPromoCodeContest: challengeData?.is_PromoCode_Contest
                        };

                        if (challengeData?.multi_entry !== 0) {
                            tmpObj.teamLimit = challengeData?.team_limit;
                            tmpObj.plus = '+';
                        }

                        tmpObj.amount_type = `${challengeData?.amount_type}`;
                        const price_card = [];
                        let keyPricecard = `challengePricecard:${challanges._id}`;
                        let matchpricecard = await redisContest.getkeydata(keyPricecard);
                        if (!matchpricecard || matchpricecard.length <= 0) {
                            const challengeData = await matchchallengesModel.findById(challanges._id);
                            matchpricecard = challengeData?.matchpricecards || [];
                            await redisContest.setkeydata(keyPricecard, matchpricecard, 60 * 60 * 24 * 10);
                        }
                        let winners = 0;
                        if (matchpricecard.length > 0) {
                            for await (const priceCard of matchpricecard) {
                                price_card.push({
                                    winners: Number(priceCard.winners),
                                    image: priceCard.image,
                                    price: priceCard.price,
                                    min_position: priceCard.min_position,
                                    max_position: priceCard.max_position,
                                    total: priceCard.total,
                                    gift_type: priceCard.gift_type,
                                    amount_type: priceCard.type
                                })
                                winners += Number(priceCard.winners);
                            }
                        } else {
                            price_card.push({
                                winners: 1,
                                image: "",
                                price: challengeData.win_amount,
                                total: challengeData.win_amount,
                                amount_type: challengeData.amount_type,
                                min_position: 0,
                                max_position: 1,
                            });
                            winners = 1;
                        }

                        tmpObj.matchpricecards = price_card;

                        if (userLeaderboard.length > 0) {
                            if (challengeData?.multi_entry == 1 && userLeaderboard.length < challengeData?.team_limit) {
                                if (challengeData?.contest_type == 'Amount') {
                                    tmpObj.isselected = userLeaderboard.length == challengeData?.team_limit || challengeData?.joinedusers == challengeData?.maximum_user;
                                } else if (challengeData?.contest_type == 'Percentage') {
                                    tmpObj.isselected = userLeaderboard.length == challengeData?.team_limit;
                                } else {
                                    tmpObj.isselected = false;
                                }
                            } else {
                                tmpObj.isselected = true;
                            }
                        }

                        tmpObj.totalTeams = cachedTeams.length;
                        tmpObj.totalJoinedcontest = challanges.getcurrentrank || 0;
                        if (challengeData?.status != 'canceled') {
                            totalinvestment = totalinvestment + (challengeData?.entryfee * challanges.getcurrentrank);
                            totalwon = totalwon + totalWinningAmount;
                        }
                        finalData.push(JSON.parse(JSON.stringify(tmpObj)));
                    }
                }

            }

            return {
                message: 'Join Contest Data...!',
                status: true,
                data: finalData,
                total_joined_contests: myJoinedContestData.length,
                totalinvestment, totalwon
                // total_joined_contests
            };

        } catch (error) {
            console.log("Error: ", error);
        }
    }

    async userJoinDuoContest(req) {
        try {
            const { matchkey, matchStatus } = req.query;
            let { skip = 0, limit = 10 } = req.query;
            const userId = req.user._id;

            skip = isNaN(Number(skip)) ? 0 : Number(skip);
            limit = isNaN(Number(limit)) ? 10 : Number(limit);

            const keyMatch = `listMatchesModel-${matchkey}`;
            let match = await redisjoinTeams.getkeydata(keyMatch);
            if (!match) {
                match = await matchesModel.findOne({ _id: mongoose.Types.ObjectId(matchkey) });
                await setkeydata(keyMatch, match, 60 * 60 * 4);
            }
            console.log('match----->', match);
            if (match.final_status == 'winnerdeclared' || match.final_status == 'IsCanceled' || match.final_status == 'IsAbandoned') {
                return this.myDuoCompletedJoinedContests(req);
            }

            const keyUserJoinedChallenge = `match:${matchkey}:user:${userId}:joinedDuoContests`;
            const myJoinedContestData = await getMyLeaderBoard(keyUserJoinedChallenge, userId, 'contest');

            if (!myJoinedContestData || myJoinedContestData.length === 0) {
                return { message: 'Data Not Found', status: true, data: [], total_joined_contests: 0 };
            }

            let totalinvestment = 0;
            let totalwon = 0;
            const finalData = [];

            for (const challanges of myJoinedContestData) {
                if (!challanges?._id) continue;

                const challengeId = challanges._id;
                const keyUserLB = `match:${matchkey}:challenge:${challengeId}:user:${userId}:userDuoLeaderBoard`;
                const userLeaderboard = await getMyLeaderBoard(keyUserLB, userId);

                if (!userLeaderboard || userLeaderboard.length === 0) continue;

                const ChallengeKey = `match:${matchkey}:duochallenges`;
                let challengeData = await redisContest.hgetData(ChallengeKey, challengeId);
                if (!challengeData) {
                    challengeData = await dualgamematchChallengersModel.findOne({ _id: challengeId }).lean();
                }
                if (!challengeData) continue;

                const keyChallengeLeaderBoardNew = `liveRanksDuoLeaderboard_${challengeId}`;
                const challengeLeaderBoard = await retrieveSortedSet(keyChallengeLeaderBoardNew, '', 0, 10);

                const maximum_user = challengeData?.maximum_user || 2; // fallback value

                const usersData = [];
                for (let i = 0; i < maximum_user; i++) {
                    const data = challengeLeaderBoard[i] || {};
                    usersData.push({
                        userNo: i + 1,
                        userName: data.userName || '',
                        points: data.points || 0,
                        teamName: data.teamname || '',
                        teamShortName: data?.playerDetails?.teamName || '',
                        playerId: data?.playerDetails?.playerId || '',
                        playerName: data?.playerDetails?.playerName || '',
                        image: data?.playerDetails?.image || '',
                        winingamount: data.winingamount || 0
                    });
                }

                const tmpObj = {
                    ...challengeData,
                    usersData,
                    isselected: userLeaderboard.length > 0,
                    total_joinedcontest: myJoinedContestData?.length || 0
                };

                if (challengeData?.status !== 'canceled') {
                    totalinvestment += (challengeData?.entryfee || 0) * (challanges?.getcurrentrank || 1);
                    totalwon += challanges?.totalWinningAmount || 0;
                }

                finalData.push(tmpObj);
            }

            return {
                message: 'Join Contest Data...!',
                status: true,
                data: finalData,
                total_joined_contests: myJoinedContestData.length,
                totalinvestment,
                totalwon
            };

        } catch (error) {
            console.error("Error in userJoinDuoContest:", error);
            return {
                message: 'Something went wrong',
                status: false,
                data: []
            };
        }
    }

    async myDuoCompletedJoinedContests(req) {
        try {
            const { matchkey, matchStatus } = req.query;
            let { skip = 0, limit = 10 } = req.query;
            const userId = req.user._id;

            skip = isNaN(Number(skip)) ? 0 : Number(skip);
            limit = isNaN(Number(limit)) ? 10 : Number(limit);

            const keyMatch = `listMatchesModel-${matchkey}`;
            let match = await redisjoinTeams.getkeydata(keyMatch);
            if (!match) {
                match = await matchesModel.findOne({ _id: mongoose.Types.ObjectId(matchkey) });
                await setkeydata(keyMatch, match, 60 * 60 * 4);
            }


            const aggPipe = [
                {
                    $match: {
                        userid: mongoose.Types.ObjectId(userId),
                        matchkey: mongoose.Types.ObjectId(matchkey)
                    }
                },
                {
                    $group: {
                        _id: "$challengeid",
                        joinedleaugeId: { $first: "$_id" },
                        matchkey: { $first: "$matchkey" },
                        joinplayerid: { $first: "$joinplayerid" },
                        playerDetails: { $first: "$playerDetails" },
                        userid: { $first: "$userid" },
                        createdAt: { $first: "$createdAt" }
                    }
                },
                {
                    $lookup: {
                        from: "dualgamematchchallenges",
                        localField: "_id",
                        foreignField: "_id",
                        as: "matchchallenge"
                    }
                },
                { $unwind: "$matchchallenge" },
                {
                    $addFields: {
                        matchchallengestatus: "$matchchallenge.status"
                    }
                },
                {
                    $lookup: {
                        from: "matches",
                        localField: "matchkey",
                        foreignField: "_id",
                        as: "listmatch"
                    }
                },
                {
                    $lookup: {
                        from: "duoleaderboards",
                        localField: "joinedleaugeId",
                        foreignField: "joinId",
                        as: "leaderboardData"
                    }
                },
                { $unwind: { path: "$leaderboardData", preserveNullAndEmptyArrays: true } },
                {
                    $addFields: {
                        finalresults: "$leaderboardData.amount"
                    }
                },
                {
                    $project: {
                        joinplayerid: 1,
                        createdAt: 1,
                        challenge_id: "$matchchallenge.challenge_id",
                        discount_fee: "$matchchallenge.discount_fee",
                        WinningpriceAndPrize: "$matchchallenge.WinningpriceAndPrize",
                        matchchallengeid: "$matchchallenge._id",
                        userid: 1,
                        joinedleaugeId: 1,
                        win_amount: "$matchchallenge.win_amount",
                        is_bonus: { $ifNull: ["$matchchallenge.is_bonus", 0] },
                        bonus_percentage: { $ifNull: ["$matchchallenge.bonus_percentage", 0] },
                        winning_percentage: "$matchchallenge.winning_percentage",
                        contest_type: { $ifNull: ["$matchchallenge.contest_type", ""] },
                        contest_name: { $ifNull: ["$matchchallenge.contest_name", ""] },
                        matchkey: { $ifNull: ["$matchchallenge.matchkey", 0] },
                        joinedusers: { $ifNull: ["$matchchallenge.joinedusers", 0] },
                        entryfee: { $ifNull: ["$matchchallenge.entryfee", 0] },
                        maximum_user: { $ifNull: ["$matchchallenge.maximum_user", 0] },
                        matchFinalstatus: {
                            $ifNull: [
                                { $arrayElemAt: ["$listmatch.final_status", 0] },
                                ""
                            ]
                        },
                        matchChallengeStatus: "$matchchallenge.status",
                        bonus_type: { $ifNull: ["$matchchallenge.bonus_type", ""] },
                        is_running: { $ifNull: ["$matchchallenge.is_running", ""] },
                        status: { $ifNull: ["$matchchallenge.status", ""] },
                        totalwinners: { $ifNull: ["$matchchallenge.totalwinners", 0] },
                        finalresultsAmount: "$finalresults",
                        amount_type: { $ifNull: ["$matchchallenge.amount_type", ""] }
                    }
                },
                { $sort: { createdAt: 1 } },
                {
                    $facet: {
                        data: [{ $skip: skip }, { $limit: limit }]
                    }
                }
            ];

            const aggResult = await JoinDuoLeaugeModel.aggregate(aggPipe);
            const JoinContestData = aggResult[0]?.data || [];

            if (JoinContestData.length === 0) {
                return {
                    message: 'Data Not Found',
                    status: true,
                    data: [],
                    total_joined_contests: 0
                };
            }

            let totalinvestment = 0;
            let totalwon = 0;
            const finalData = [];
            for (const chall of JoinContestData) {
                if (!chall?._id) continue;
                const maximum_user = chall?.maximum_user || 2;
                const usersData = [];

                const duoleaderBoardData = await duoleaderBoardModel.find({ challengeid: chall._id }) || [];
                const maxUsers = chall.maximum_user || 2;

                for (let i = 0; i < maxUsers; i++) {
                    const entry = duoleaderBoardData[i] || {};
                    usersData.push({
                        userNo: i + 1,
                        userName: entry.userName || '',
                        points: Number(entry.points) || 0,
                        rank: entry.rank || 0,
                        teamName: entry.user_team || '',
                        teamShortName: entry.playerDetails?.teamName || '',
                        playerId: entry.playerDetails?.matchPlayerId || '',
                        playerName: entry.playerDetails?.playerName || '',
                        image: entry.playerDetails?.image || '',
                        winingamount: Number(entry.amount) || 0
                    });
                }

                const tmpObj = {
                    ...chall,
                    usersData,
                    isselected: true,
                    total_joinedcontest: JoinContestData.length
                };

                if (chall?.matchChallengeStatus !== 'canceled') {
                    totalinvestment += (chall?.entryfee || 0);
                    totalwon += chall?.finalresultsAmount || 0;
                }

                finalData.push(tmpObj);
            }

            return {
                message: 'Join Contest Data...!',
                status: true,
                data: finalData,
                total_joined_contests: JoinContestData.length,
                totalinvestment,
                totalwon
            };

        } catch (error) {
            console.error("Error in userJoinDuoContest:", error);
            return {
                message: 'Something went wrong',
                status: false,
                data: []
            };
        }
    }

}
module.exports = new contestServices();
