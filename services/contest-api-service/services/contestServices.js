const mongoose = require('mongoose');
const randomstring = require("randomstring");
const moment = require("moment");
const userLeagueModel = require('../../../models/userLeagueModel');
const userTeamModel = require('../../../models/userTeamModel');
const userModel = require('../../../models/userModel');
const priceCardModel = require('../../../models/contestPriceCardModel.js');
const JoinedReferModel = require('../../../models/JoinedReferModel');
const userLeaderBoardModel = require('../../../models/userLeaderBoardModel.js');
const fantasytypes = require('../../../models/fantasyModels.js');
const permissionModel = require('../../../models/adminPermissionModel.js');
const resultSummaryModel = require('../../../models/resultSummaryModel');
// const userPermissionModel = require('../../../models/userPermissionModel');
const matchServices = require('./matchServices');
const matchesModel = require('../../../models/matchesModel');
// const contestPromoCode = require('../../../models/contestPromoCode');
const contestCategory = require('../../../models/contestcategoryModel');
const configModel = require("../../../models/configModel");
const matchPlayersModel = require('../../../models/matchPlayersModel');
const { sendToQueue } = require('../../../utils/kafka');
// const { getkeydata, setkeydata, deletedata, getKeyOnly } = require('../../../utils/redis/redisjoinTeams');
const redisjoinTeams = require('../../../utils/redis/redisjoinTeams');
const { getMyLeaderBoard, storeSortedSet, retrieveSortedSet, redis } = require('../../../utils/redis/redisLeaderboard');
const redisMain = require('../../../utils/redis/redisMain');
const redisUser = require('../../../utils/redis/redisUser');
const redisContest = require('../../../utils/redis/redisContest');
const RedisUpdateChallenge = require('../../../utils/redisUpdateChallenge');
const redisUpdateChallenge = new RedisUpdateChallenge();
const RedisClonedContest = require('../../../utils/redisClonedContest');
const redisClonedContest = new RedisClonedContest();
const { matchTimeDifference } = require("../../../utils/matchTimeDiffrence");
const matchContestModel = require("../../../models/matchContestModel.js")

class contestServices {
    constructor() {
        return {
            dbCheck: this.dbCheck.bind(this),
            fetchAllContests: this.fetchAllContests.bind(this),
            fetchContest: this.fetchContest.bind(this),
            myJoinedContests: this.myJoinedContests.bind(this),
            userLeaderboard: this.userLeaderboard.bind(this),
            JoinedUsersUpdate: this.JoinedUsersUpdate.bind(this),
            contestPriceUpdate: this.contestPriceUpdate.bind(this),
            updateJoineduserswithredis: this.updateJoineduserswithredis.bind(this),
            updateJoinedUsersWithRedisForChecking: this.updateJoinedUsersWithRedisForChecking.bind(this),
            switchTeams: this.switchTeams.bind(this),
            fetchUsableBalance: this.fetchUsableBalance.bind(this),
            fetchContestWithoutCategory: this.fetchContestWithoutCategory.bind(this),
            privateContestCreate: this.privateContestCreate.bind(this),
            joinContestByCode: this.joinContestByCode.bind(this),
            getJoinleague: this.getJoinleague.bind(this),
            getAllNewContests: this.getAllNewContests.bind(this),
            getAllNewContestsRedis: this.getAllNewContestsRedis.bind(this),
            contestFromRedisToDb: this.contestFromRedisToDb.bind(this),
            fetchAllNewContest: this.fetchAllNewContest.bind(this),
            fetchAllDuoContests: this.fetchAllDuoContests.bind(this),
            fetchAllFantasy: this.fetchAllFantasy.bind(this),
            substitutePlayerReplace: this.substitutePlayerReplace.bind(this),
            oldMyJoinedContests: this.oldMyJoinedContests.bind(this),
            userSelfLeaderboard: this.userSelfLeaderboard.bind(this),
            getContestRedis: this.getContestRedis.bind(this),
            fetchAllNewContestRedisForChecking: this.fetchAllNewContestRedisForChecking.bind(this),
            fetchAllNewContestsRedisJmeter: this.fetchAllNewContestsRedisJmeter.bind(this)

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
                    redisMain.healthCheck().then((res) => res === "PONG"),
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

    // async getAllNewContests(req) {
    //     try {
    //         await this.updateJoinedusers(req);
    //         let finalData = [], contest_arr = [], aggpipe = [];
    //         aggpipe.push({
    //             $lookup: {
    //                 from: "matchchallenges",
    //                 let: {
    //                     contestcat: "$_id",
    //                     matchkey: mongoose.Types.ObjectId(req.query.matchkey),
    //                 },
    //                 pipeline: [
    //                     {
    //                         $match: {
    //                             $expr: {
    //                                 $and: [
    //                                     {
    //                                         $eq: ["$$matchkey", "$matchkey"],
    //                                     },
    //                                     {
    //                                         $eq: [
    //                                             "$$contestcat",
    //                                             "$contest_cat",
    //                                         ],
    //                                     }, {
    //                                         $eq: ["opened", "$status"],
    //                                     },
    //                                     {
    //                                         $eq: [0, '$is_private'],
    //                                     }
    //                                 ],
    //                             },
    //                         },
    //                     },
    //                     {
    //                         $lookup: {
    //                             from: "joinedleauges",
    //                             let: {
    //                                 challengeId: "$_id",
    //                                 matchkey: '$matchkey',
    //                                 userId: mongoose.Types.ObjectId(req.user._id),
    //                             },
    //                             pipeline: [
    //                                 {
    //                                     $match: {
    //                                         $expr: {
    //                                             $and: [
    //                                                 {
    //                                                     $eq: [
    //                                                         "$$matchkey",
    //                                                         "$matchkey",
    //                                                     ],
    //                                                 },
    //                                                 {
    //                                                     $eq: [
    //                                                         "$$challengeId",
    //                                                         "$challengeid",
    //                                                     ],
    //                                                 },

    //                                                 {
    //                                                     $eq: [
    //                                                         "$$userId",
    //                                                         "$userid",
    //                                                     ],
    //                                                 },
    //                                             ],
    //                                         },
    //                                     },
    //                                 }, {
    //                                     $project: {
    //                                         refercode: 1
    //                                     }
    //                                 },
    //                             ],
    //                             as: 'joinedleauge'
    //                         },
    //                     },
    //                     {
    //                         $sort: { win_amount: -1 },
    //                     },
    //                 ],
    //                 as: "contest",
    //             }
    //         });
    //         aggpipe.push({
    //             $addFields: {
    //                 challengeSize: {
    //                     $size: "$contest"
    //                 }
    //             }
    //         })
    //         aggpipe.push({
    //             $match: {
    //                 challengeSize: { $gt: 0 }
    //             }
    //         })
    //         aggpipe.push(
    //             {
    //                 $unwind: {
    //                     path: "$contest",
    //                 },
    //             },
    //             {
    //                 $match: {
    //                     $expr: {
    //                         $cond: {
    //                             if: {
    //                                 $eq: [
    //                                     {
    //                                         $type: "$contest.contestStatus",
    //                                     },
    //                                     "missing",
    //                                 ],
    //                             },
    //                             then: true,
    //                             else: {
    //                                 $eq: ["$contest.contestStatus", true],
    //                             },
    //                         },
    //                     },
    //                 },
    //             },
    //             // {
    //             //     $group:
    //             //     /**
    //             //      * _id: The id of the group.
    //             //      * fieldN: The first field name.
    //             //      */
    //             //     {
    //             //         _id: "$contest.matchkey",
    //             //         fantasy_type: {
    //             //             $first: "$fantasy_type",
    //             //         },
    //             //         name: {
    //             //             $first: "$name",
    //             //         },
    //             //         sub_title: {
    //             //             $first: "$sub_title",
    //             //         },
    //             //         image: {
    //             //             $first: "$image",
    //             //         },
    //             //         tbl_order: {
    //             //             $first: "$tbl_order",
    //             //         },
    //             //         has_leaderBoard: {
    //             //             $first: "$has_leaderBoard",
    //             //         },
    //             //         createdAt: {
    //             //             $first: "$createdAt",
    //             //         },
    //             //         updatedAt: {
    //             //             $first: "$updatedAt",
    //             //         },
    //             //         Order: {
    //             //             $first: "$Order",
    //             //         },
    //             //         challengeSize: {
    //             //             $first: "$challengeSize",
    //             //         },
    //             //         contest: {
    //             //             $push: "$contest",
    //             //         },
    //             //     },
    //             // }
    //         )

    //         aggpipe.push({
    //             $sort: {
    //                 Order: 1
    //             }
    //         })
    //         // aggpipe.push({
    //         //     $unwind:{
    //         //         path:"$contest"
    //         //     }
    //         // })
    //         const categoryData = await contestCategory.aggregate(aggpipe);
    //         if (categoryData.length == 0) {
    //             return {
    //                 message: "No Challenge Available For This Match",
    //                 status: true,
    //                 data: []
    //             }
    //         }
    //         let [total_teams, total_joinedcontestData] = await Promise.all([
    //             userTeamModel.countDocuments({ userid: req.user._id, matchkey: req.query.matchkey }),
    //             this.getJoinleague(req.user._id, req.query.matchkey)
    //         ]);
    //         let a = [];
    //         for (let cat of categoryData) {
    //             cat.type = "category";
    //             cat.contest = [cat.contest]
    //             let i = 0;
    //             cat.catid = cat._id;
    //             cat.cat_order = cat.Order;
    //             cat.catname = cat.name;
    //             cat.image = cat.image ? `${global.constant.IMAGE_URL}${cat.image}` : `${global.constant.IMAGE_URL}logo.png`;
    //             for (let matchchallenge of cat.contest) {
    //                 cat.startDate = matchchallenge.startDate;
    //                 cat.endDate = matchchallenge.endDate;
    //                 cat.discount_fee = matchchallenge.discount_fee;
    //                 cat.subscription_fee = matchchallenge.subscription_fee;

    //                 let totalwinners = 0
    //                 for await (const priceCard of matchchallenge.matchpricecards) {
    //                     totalwinners += Number(priceCard.winners);
    //                 }
    //                 if (totalwinners == 0) {
    //                     totalwinners = 1;

    //                 }
    //                 matchchallenge.type = "contest";
    //                 i++;
    //                 let isselected = false,
    //                     refercode = '',
    //                     winners = 0;
    //                 const price_card = [];
    //                 if (matchchallenge?.joinedleauge && matchchallenge.joinedleauge.length > 0) {
    //                     refercode = matchchallenge?.joinedleauge[0].refercode;
    //                     if (matchchallenge.multi_entry == 1 && matchchallenge.joinedleauge.length < matchchallenge.team_limit) {
    //                         if (matchchallenge.contest_type == 'Amount') {
    //                             if (matchchallenge.joinedleauge.length == matchchallenge.team_limit || matchchallenge.joinedusers == matchchallenge.maximum_user)
    //                                 isselected = true;
    //                         } else if (matchchallenge.contest_type == 'Percentage') {
    //                             if (matchchallenge.joinedleauge.length == matchchallenge.team_limit) isselected = true;
    //                         } else isselected = false;
    //                     } else isselected = true;
    //                 }
    //                 matchchallenge.gift_image = "";
    //                 matchchallenge.gift_type = "amount";
    //                 let find_gift = matchchallenge.matchpricecards.find(function (x) { return x.gift_type == "gift" });
    //                 if (find_gift) {
    //                     matchchallenge.gift_image = `${global.constant.IMAGE_URL}${find_gift.image}`;
    //                     matchchallenge.gift_type = find_gift.gift_type;
    //                 }
    //                 let team_limits;
    //                 if (matchchallenge.multi_entry == 0) {
    //                     team_limits = 1
    //                 } else {
    //                     team_limits = matchchallenge.team_limit
    //                 }
    //                 matchchallenge.isselected = isselected;
    //                 matchchallenge.team_limit = team_limits;
    //                 matchchallenge.refercode = refercode;
    //                 matchchallenge.matchchallengeid = matchchallenge._id;
    //                 matchchallenge.status = 1;
    //                 matchchallenge.joinedleauges = matchchallenge.joinedleauge.length;
    //                 matchchallenge.total_joinedcontest = total_joinedcontestData || 0;
    //                 matchchallenge.total_teams = total_teams || 0;
    //                 matchchallenge.totalwinners = totalwinners
    //                 //cat.contest=Object.assign({}, ...cat.contest);

    //             }
    //             //cat.contest=Object.assign({}, ...cat.contest);
    //             a.push({ ...cat, contest: undefined }, ...cat.contest);
    //         }

    //         return {
    //             message: 'Contest of A Perticular Match',
    //             status: true,
    //             data: a
    //         }
    //     } catch (error) {
    //         console.log('error', error);
    //     }
    // }

    async getAllNewContests(req) {
        try {
            await this.updateJoinedusers(req);
            let finalData = [], contest_arr = [], aggpipe = [];
            aggpipe.push({
                $lookup: {
                    from: "matchcontests",
                    let: {
                        contestcat: "$_id",
                        matchkey: mongoose.Types.ObjectId(req.query.matchkey),
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        {
                                            $eq: ["$$matchkey", "$matchkey"],
                                        },
                                        {
                                            $eq: [
                                                "$$contestcat",
                                                "$contest_cat",
                                            ],
                                        }, {
                                            $eq: ["opened", "$status"],
                                        },
                                        {
                                            $eq: [0, '$is_private'],
                                        }
                                    ],
                                },
                            },
                        },
                        {
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
                                                                        "$matchpricecards.winners",
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
                        },
                        {
                            $lookup: {
                                from: "userleagues",
                                let: {
                                    challengeId: "$_id",
                                    matchkey: '$matchkey',
                                    userId: mongoose.Types.ObjectId(req.user._id),
                                },
                                pipeline: [
                                    {
                                        $match: {
                                            $expr: {
                                                $and: [
                                                    {
                                                        $eq: [
                                                            "$$matchkey",
                                                            "$matchkey",
                                                        ],
                                                    },
                                                    {
                                                        $eq: [
                                                            "$$challengeId",
                                                            "$challengeid",
                                                        ],
                                                    },
                                                    {
                                                        $eq: [
                                                            "$$userId",
                                                            "$userid",
                                                        ],
                                                    },
                                                ],
                                            },
                                        },
                                    }, {
                                        $project: {
                                            refercode: 1
                                        }
                                    },
                                ],
                                as: 'joinedleauge'
                            },
                        },
                        {
                            $sort: { win_reward: -1 },
                        },
                        {
                            $project: {
                                matchData: 0,
                                contestCategory: 0,
                                created_by: 0,
                                team1players: 0,
                                team2players: 0,
                                contest_cat: 0,
                                matchkey: 0,
                                fantasy_type: 0,
                                multiple_entryfee: 0,
                                status: 0,
                                isWinning: 0,
                                expert_name: 0,
                                contest_name: 0,
                                startDate: 0,
                                endDate: 0,
                                image: 0,
                                is_private: 0,
                                is_running: 0,
                                is_expert: 0,
                                is_duplicated: 0,
                                is_deleted: 0,
                                is_recent: 0,
                                createdAt: 0,
                                updatedAt: 0,
                                subscription_fee: 0,
                            }
                        }
                    ],
                    as: "contest",
                }
            });
            aggpipe.push({
                $addFields: {
                    challengeSize: {
                        $size: "$contest"
                    }
                }
            })
            aggpipe.push({
                $match: {
                    challengeSize: { $gt: 0 }
                }
            })
            aggpipe.push({
                $sort: {
                    Order: 1
                }
            });

            aggpipe.push({
                $project: {
                    _id: 1,
                    contest: 1,
                    challengeSize: 1,
                    name: 1,
                    sub_title: 1
                }
            });


            const categoryData = await contestCategory.aggregate(aggpipe);
            if (categoryData.length == 0) {
                return {
                    message: "No Challenge Available For This Match",
                    status: true,
                    data: []
                }
            }
            let [total_teams, total_joinedcontestData] = await Promise.all([
                userTeamModel.countDocuments({ userid: req.user._id, matchkey: req.query.matchkey }),
                userLeagueModel.distinct("challengeid", { userid: req.user._id, matchkey: req.query.matchkey }),
                // this.getJoinleague(req.user._id, req.query.matchkey)
            ]);
            let a = [];
            for (let cat of categoryData) {
                // console.log("cat", cat);
                cat.type = "category";
                let i = 0;
                cat.catid = cat._id;
                // cat.cat_order = cat.Order;
                // cat.catname = cat.name;
                // cat.image = cat.image ? `${constant.IMAGE_URL}${cat.image}` : `${constant.IMAGE_URL}logo.png`;
                for (let matchchallenge of cat.contest) {

                    let price_card = {};
                    let totalwinners = 0
                    if (matchchallenge?.matchpricecards && matchchallenge.matchpricecards.length > 0) {
                        const priceCard = matchchallenge.matchpricecards[0];
                        price_card.total = Number(priceCard.total).toFixed(2);
                        price_card.price = (priceCard.price && Number(priceCard.price) === 0) || priceCard.type === 'Percentage'
                            ? (Number(priceCard.total) / Number(priceCard.winners).toFixed(2))
                            : Number(priceCard.price).toFixed(2);
                        price_card.price_percent = priceCard.price_percent ? `${priceCard.price_percent}%` : undefined;
                        price_card.gift_type = priceCard.gift_type || "amount";
                        price_card.image = priceCard.image ? `${global.constant.IMAGE_URL}${priceCard.image}` : "";
                        for (let card of matchchallenge.matchpricecards) {
                            totalwinners += Number(card.winners);
                        }
                    } else {
                        price_card = {
                            price: Number(matchchallenge.win_amount).toFixed(2),
                            total: Number(matchchallenge.win_amount).toFixed(2),
                            image: "",
                            gift_type: "amount"
                        };
                        totalwinners = 1;
                    }

                    matchchallenge.type = "contest";
                    i++;
                    let isselected = false,
                        refercode = '',
                        winners = 0;
                    const point_card = [];
                    if (matchchallenge?.joinedleauge && matchchallenge.joinedleauge.length > 0) {
                        refercode = matchchallenge?.joinedleauge[0].refercode;
                        if (matchchallenge.multi_entry == 1 && matchchallenge.joinedleauge.length < matchchallenge.team_limit) {
                            if (matchchallenge.contest_type == 'Reward') {
                                if (matchchallenge.joinedleauge.length == matchchallenge.team_limit || matchchallenge.joinedusers == matchchallenge.maximum_user)
                                    isselected = true;
                            } else if (matchchallenge.contest_type == 'Percentage') {
                                if (matchchallenge.joinedleauge.length == matchchallenge.team_limit) isselected = true;
                            } else isselected = false;
                        } else isselected = true;
                    }
                    matchchallenge.gift_image = "";
                    matchchallenge.gift_type = "reward";
                    let find_gift = matchchallenge.matchpricecards.find(function (x) { return x.gift_type == "gift" });
                    if (find_gift) {
                        matchchallenge.gift_image = `${constant.IMAGE_URL}${find_gift.image}`;
                        matchchallenge.gift_type = find_gift.gift_type;
                    }
                    let team_limits;
                    if (matchchallenge.multi_entry == 0) {
                        team_limits = 1
                    } else {
                        team_limits = matchchallenge.team_limit
                    }
                    matchchallenge.isselected = isselected;
                    matchchallenge.team_limit = team_limits;
                    matchchallenge.refercode = refercode;
                    matchchallenge.matchchallengeid = matchchallenge._id;
                    // matchchallenge.status = 1;
                    // matchchallenge.joinedleauges = matchchallenge.joinedleauge.length;
                    matchchallenge.total_joinedcontest = total_joinedcontestData.length || 0;
                    matchchallenge.total_teams = total_teams || 0;
                    matchchallenge.totalwinners = totalwinners
                    matchchallenge.textNote = matchchallenge.textNote || ""
                    matchchallenge.price_card = price_card;

                    delete (matchchallenge.matchpricecards);
                    delete (matchchallenge.joinedleauge);
                }
                a.push({ ...cat, contest: undefined }, ...cat.contest);
            }
            return {
                message: 'Contest of A Perticular Match',
                status: true,
                data: a
            }
        } catch (error) {
            console.log('error', error);
        }
    }

    async setTeamsInRedis(userId, matchkey) {
        try {
            const redisKey = `match:${matchkey}:user:${userId}:teams`;
            const teams = await userTeamModel.find({
                userid: userId,
                matchkey: matchkey,
            }).lean();
            var expRedisTime = await matchTimeDifference(matchkey);
            await redisjoinTeams.setkeydata(redisKey, teams, expRedisTime);
            return teams;
        } catch (error) {
            console.error("Error in setTeamsInRedis:", error);
            throw error;
        }
    }

    async getAllNewContestsRedis(req) {
        await this.updateJoineduserswithredis(req);
        try {
            const matchKey = `match:${req.query.matchkey}:challenges`; // Redis Hash Key

            // Retrieve all match challenges from Redis using HGETALL
            const matchAllChallenges = await redisContest.hgetAllData(matchKey);

            const redisKey = `match:${req.query.matchkey}:user:${req.user._id}:teams`;
            let existingTeams = await redisjoinTeams.getkeydata(redisKey) || [];

            if (!existingTeams || !existingTeams.length || existingTeams.length === 0) {
                // existingTeams = await this.setTeamsInRedis(req.user._id, req.query.matchkey);
                existingTeams = [];
            }

            const category = `contestCategory`; // Redis Hash Key
            let categoryData = await redisContest.getkeydata(category) || [];
            if (!categoryData || categoryData.length <= 0) {
                const categoryD = await contestCategory.find().sort({ Order: 1 });
                categoryData = await redisContest.setkeydata(category, categoryD, 60 * 60 * 24 * 60);
            }
            if (!categoryData.length) {
                return {
                    message: "No Challenge Available For This Match",
                    status: true,
                    data: []
                };
            }

            let result = [];
            let allJoinedContest = 0;

            // 🔹 Use `for...of` instead of `reduce()`
            for (const cat of categoryData) {
                let contests = [];
                const filteredMatchChallenges = Object.values(matchAllChallenges || {}).filter(mc => mc?.contest_cat == cat._id);

                if (!filteredMatchChallenges.length) continue;

                const categoryDetails = {
                    ...cat,
                    type: "category",
                    catid: cat._id,
                };
                delete categoryDetails.fantasy_type;
                delete categoryDetails.Order;
                delete categoryDetails.tbl_order;
                delete categoryDetails.has_leaderBoard;
                delete categoryDetails.megaStatus;
                delete categoryDetails.createdAt;
                delete categoryDetails.updatedAt;
                delete categoryDetails.cat_order;
                delete categoryDetails.catname;

                for (const matchchallenge of filteredMatchChallenges) {
                    let keyLeaderBoard = `match:${req.query.matchkey}:challenge:${matchchallenge._id}:user:${req.user._id}:userLeaderBoard`;

                    // Await to get total joined contests per challenge
                    let total_joinedcontest = await getMyLeaderBoard(keyLeaderBoard, req.user._id);
                    let isselected = false;
                    if (total_joinedcontest.length > 0) {
                        if (matchchallenge.multi_entry == 1 && total_joinedcontest.length < matchchallenge.team_limit) {
                            if (matchchallenge.contest_type == 'Amount') {
                                isselected = total_joinedcontest.length == matchchallenge.team_limit || matchchallenge.joinedusers == matchchallenge.maximum_user;
                            } else if (matchchallenge.contest_type == 'Percentage') {
                                isselected = total_joinedcontest.length == matchchallenge.team_limit;
                            } else {
                                isselected = false;
                            }
                        } else {
                            isselected = true;
                        }
                        allJoinedContest = allJoinedContest + 1
                    }

                    if (matchchallenge.status !== "opened") {
                        continue;
                    }

                    let listMatchKey = `challengeId_${matchchallenge._id}`;
                    var expRedisTime = await matchTimeDifference(req.query.matchkey);
                    await redisContest.setkeydata(listMatchKey, req.query.matchkey, expRedisTime)

                    contests.push({
                        ...matchchallenge,
                        isselected: isselected,
                        refercode: total_joinedcontest?.[0]?.refercode || '',
                        total_joinedcontest: allJoinedContest,
                        total_teams: existingTeams.length,
                    });

                }

                result.push({ ...categoryDetails, contest: undefined }, ...contests);
            }

            return {
                message: 'Contest of A Particular Match',
                status: true,
                data: result
            };
        } catch (error) {
            console.error('❌ Error fetching contests:', error);
            return {
                message: 'Error retrieving contests',
                status: false,
                data: []
            };
        }
    }

    async fetchAllNewContest(req) {
        try {
            const keynameExpMatch = `listMatchesModel-${req.query.matchkey}`;
            const matchDataForExpire = await redisjoinTeams.getkeydata(keynameExpMatch);


            if (!matchDataForExpire || !matchDataForExpire.start_date) {
                return { message: "Match Started No Challenge Available", status: true, data: [] };
            }

            const matchExpStartDate = moment(matchDataForExpire.start_date, "YYYY-MM-DD HH:mm:ss");
            const currentExTime = moment();
            const expireTime = matchExpStartDate.diff(currentExTime, "seconds");

            if (expireTime <= 0) {
                return { message: "Match Started No Challenge Available", status: true, data: [] };
            }
            const matchKey = `match:${req.query.matchkey}:challenges`;
            let allChallenges = await redisContest.hgetAllData(matchKey);
            // console.log(allChallenges, "qwertyuiop   qwertyuiop")
            if (!allChallenges || Object.keys(allChallenges).length === 0) {
                const dbChallenges = await matchContestModel.find({ matchkey: req.query.matchkey });
                console.log(dbChallenges, "asdfghjkasdfghjksdfghjk")
                for (const matchChallengeData of dbChallenges) {
                    const matchkey = matchChallengeData.matchkey;
                    const challengeId = matchChallengeData._id;
                    const categoryId = matchChallengeData.contest_cat;
                    let totalwinners = 0;
                    if (matchChallengeData?.matchpricecards?.length) {
                        for (const winnerCount of matchChallengeData.matchpricecards) {
                            totalwinners += Number(winnerCount.winners);
                        }
                        const priceDetails = matchChallengeData.matchpricecards[0];
                        totalwinners = totalwinners || Number(priceDetails.winners) || 1;

                        if (priceDetails.price === 0 || priceDetails.type === 'Percentage') {
                            var price_card = {
                                total: priceDetails.total.toString(),
                                price: (priceDetails.total / totalwinners).toFixed(2),
                                price_percent: `${priceDetails.price_percent}%`
                            };
                        } else {
                            var price_card = {
                                total: priceDetails.total.toString(),
                                gift_type: priceDetails.gift_type,
                                price: matchChallengeData.amount_type === "prize"
                                    ? priceDetails.prize_name
                                    : Number(priceDetails.price).toFixed(2),
                                image: matchChallengeData.amount_type === "prize"
                                    ? `${global.constant.IMAGE_URL}${priceDetails.image}`
                                    : ''
                            };
                        }
                    } else {
                        var price_card = {
                            price: matchChallengeData.win_amount.toString(),
                            total: matchChallengeData.win_amount.toString(),
                            image: '',
                            gift_type: "amount"
                        };
                        totalwinners = 1;
                    }

                    const fieldsToUpdate = {
                        type: "contest",
                        is_PromoCode_Contest: matchChallengeData.is_PromoCode_Contest || false,
                        challenge_id: matchChallengeData.challenge_id || null,
                        matchchallengeid: matchChallengeData._id || null,
                        entryfee: matchChallengeData.entryfee || 0,
                        win_amount: matchChallengeData.win_amount || 0,
                        maximum_user: matchChallengeData.maximum_user || 0,
                        joinedusers: matchChallengeData.joinedusers || 0,
                        contest_type: matchChallengeData.contest_type || null,
                        winning_percentage: matchChallengeData.winning_percentage || 0,
                        is_bonus: matchChallengeData.is_bonus || 0,
                        bonus_percentage: matchChallengeData.bonus_percentage || 0,
                        confirmed_challenge: matchChallengeData.confirmed_challenge || 0,
                        multi_entry: matchChallengeData.multi_entry || 0,
                        team_limit: matchChallengeData.team_limit || 1,
                        discount_fee: matchChallengeData.discount_fee || 0,
                        price_card: price_card || 0,
                        totalwinners: totalwinners || 0,
                        flexible_contest: matchChallengeData.flexible_contest || "0",
                        pdfDownloadStatus: matchChallengeData.pdfDownloadStatus || null,
                        conditional_contest: matchChallengeData.conditional_contest || 0,
                        mandatoryContest: matchChallengeData.mandatoryContest || null,
                        status: matchChallengeData.status || "opened",
                        bonus_type: matchChallengeData.bonus_type || "",
                        amount_type: matchChallengeData.amount_type || "Amount",
                        mega_status: matchChallengeData.mega_status || "",
                        minimum_user: matchChallengeData.minimum_user || 0,
                        pricecard_type: matchChallengeData.pricecard_type || "Amount",
                        c_type: matchChallengeData.c_type || "",
                        WinningpriceAndPrize: matchChallengeData.WinningpriceAndPrize || "",
                        compress: matchChallengeData.compress || "",
                        textNote: matchChallengeData.textNote || "",
                        is_running: matchChallengeData.is_running || 0,
                        is_duplicated: matchChallengeData.is_duplicated,
                        team_type_id: matchChallengeData?.team_type_id,
                        team_type_name: matchChallengeData?.team_type_name || "10-1",
                    };
                    await redisUpdateChallenge.insertRedisFields(matchkey, categoryId, challengeId, fieldsToUpdate);
                }
                await new Promise(resolve => setTimeout(resolve, 100));
                allChallenges = await redisContest.hgetAllData(matchKey);
            }
            const redisKey = `match:${req.query.matchkey}:user:${req.user._id}:teams`;
            let existingTeams = await redisjoinTeams.getkeydata(redisKey) || [];
            if (!existingTeams.length) existingTeams = [];
            const categoryKey = `contestCategory`;
            let categoryData = await redisContest.getkeydata(categoryKey) || [];
            if (!categoryData.length) {
                const categoryD = await contestCategory.find().sort({ Order: 1 });
                categoryData = await redisContest.setkeydata(categoryKey, categoryD, 60 * 60 * 24 * 60);
            }
            if (!categoryData.length) {
                return { message: "No Challenge Available For This Match", status: true, data: [] };
            }

            let result = [];

            for (const cat of categoryData) {
                let contests = [];
                const uniqueChallengeKey = `match:${req.query.matchkey}:category:${cat._id}:unique_challenges`;
                const rawList = await redisContest.redis.lrange(uniqueChallengeKey, 0, -1);
                // const uniqueChallengeIds = rawList.map(item => JSON.parse(item));

                const uniqueChallengeIds = rawList.map(item => {
                    if (typeof item === "string") {
                        try {
                            return JSON.parse(item);
                        } catch {
                            return item; // keep as-is if parsing fails
                        }
                    }
                    return item; // already an object
                });

                if (!uniqueChallengeIds.length) continue;

                const categoryDetails = {
                    ...cat,
                    type: "category",
                    catid: cat._id,
                };
                delete categoryDetails.fantasy_type;
                delete categoryDetails.Order;
                delete categoryDetails.tbl_order;
                delete categoryDetails.has_leaderBoard;
                delete categoryDetails.megaStatus;
                delete categoryDetails.createdAt;
                delete categoryDetails.updatedAt;
                delete categoryDetails.cat_order;
                delete categoryDetails.catname;

                for (const matchchallenge of uniqueChallengeIds) {
                    const matchEntryFee = Number(matchchallenge.entryfee);
                    const matchWinAmount = Number(matchchallenge.win_amount);
                    const matchMaxUser = Number(matchchallenge.maximum_user);

                    const similar = Object.values(allChallenges)
                        .filter(c => {
                            const entryFee = Number(c.entryfee);
                            const winAmount = Number(c.win_amount);
                            const maxUser = Number(c.maximum_user);
                            const joined = Number(c.joinedusers || 0);

                            return (
                                c.status === "opened" &&
                                entryFee === matchEntryFee &&
                                winAmount === matchWinAmount &&
                                maxUser === matchMaxUser &&
                                joined < maxUser
                            );
                        })
                        .sort((a, b) => Number(b.joinedusers || 0) - Number(a.joinedusers || 0))
                    [0];

                    // console.log('similar--->>', similar);
                    let isselected = false;
                    let total_joinedcontest = [];
                    let userContest = [];

                    if (similar) {
                        const keyLeaderBoard = `match:${req.query.matchkey}:challenge:${similar._id}:user:${req.user._id}:userLeaderBoard`;
                        total_joinedcontest = await getMyLeaderBoard(keyLeaderBoard, req.user._id);

                        const keyUserJoinedChallenge = `match:${req.query.matchkey}:user:${req.user._id}:joinedContests`;
                        userContest = await getMyLeaderBoard(keyUserJoinedChallenge, req.user._id, "contest");

                        if (total_joinedcontest.length > 0) {
                            if (similar.multi_entry == 1 && total_joinedcontest.length < similar.team_limit) {
                                if (similar.contest_type === 'Amount') {
                                    isselected = total_joinedcontest.length === similar.team_limit || similar.joinedusers === similar.maximum_user;
                                } else if (similar.contest_type === 'Percentage') {
                                    isselected = total_joinedcontest.length === similar.team_limit;
                                }
                            } else {
                                isselected = true;
                            }
                        }

                        const listMatchKey = `challengeId_${similar._id}`;
                        const expRedisTime = await matchTimeDifference(req.query.matchkey);
                        await redisContest.setkeydata(listMatchKey, req.query.matchkey, expRedisTime);
                        if (similar._id == "682ddf0e9b3854131286a5be") {
                            var joinedusers = Number(similar.joinedusers) + 20000;
                        } else {
                            var joinedusers = Number(similar.joinedusers);
                        }
                        contests.push({
                            ...similar,
                            isselected,
                            joinedusers,
                            refercode: total_joinedcontest?.[0]?.refercode || '',
                            total_joinedcontest: userContest.length,
                            total_teams: existingTeams.length,
                        });
                    } else if (matchchallenge.is_running == 1) {
                        const hashKey = `match:${req.query.matchkey}:entry:${matchchallenge.entryfee}:win:${matchchallenge.win_amount}:max:${matchchallenge.maximum_user}:cloned_challenges`;
                        const existingChallenges = await redisContest.hgetAllData(hashKey);

                        if (existingChallenges && Object.keys(existingChallenges).length > 0) {
                            const firstKey = Object.keys(existingChallenges)[0];
                            const firstChallenge = existingChallenges[firstKey];

                            if (firstChallenge) {
                                const keyName = `match:${req.query.matchkey}:challenges`;
                                const ttlInSeconds = await matchTimeDifference(req.query.matchkey);
                                await redisContest.hsetData(keyName, firstChallenge._id, firstChallenge, ttlInSeconds);

                                const insertMsg = {
                                    filter: { _id: firstChallenge.clonedChallenge },
                                    payload: {
                                        _id: firstChallenge._id
                                    },
                                    modelName: "matchcontest"
                                };
                                sendToQueue('contestInsert', insertMsg);
                                await redisContest.hdelData(hashKey, firstKey);

                                const keyLeaderBoard = `match:${req.query.matchkey}:challenge:${firstChallenge._id}:user:${req.user._id}:userLeaderBoard`;
                                total_joinedcontest = await getMyLeaderBoard(keyLeaderBoard, req.user._id);

                                const keyUserJoinedChallenge = `match:${req.query.matchkey}:user:${req.user._id}:joinedContests`;
                                userContest = await getMyLeaderBoard(keyUserJoinedChallenge, req.user._id, "contest");

                                if (total_joinedcontest.length > 0) {
                                    if (firstChallenge.multi_entry == 1 && total_joinedcontest.length < firstChallenge.team_limit) {
                                        if (firstChallenge.contest_type === 'Amount') {
                                            isselected = total_joinedcontest.length === firstChallenge.team_limit || firstChallenge.joinedusers === firstChallenge.maximum_user;
                                        } else if (firstChallenge.contest_type === 'Percentage') {
                                            isselected = total_joinedcontest.length === firstChallenge.team_limit;
                                        }
                                    } else {
                                        isselected = true;
                                    }
                                }

                                contests.push({
                                    ...firstChallenge,
                                    isselected,
                                    refercode: total_joinedcontest?.[0]?.refercode || '',
                                    total_joinedcontest: userContest.length,
                                    total_teams: existingTeams.length,
                                });
                            }
                        } else {
                            const ttlInSeconds = await matchTimeDifference(req.query.matchkey);
                            const setCount = matchchallenge?.setCount ?? 20;
                            for (let i = 0; i < setCount; i++) {
                                const cloneId = new mongoose.Types.ObjectId();
                                const newClone = {
                                    ...matchchallenge,
                                    _id: cloneId,
                                    matchchallengeid: cloneId,
                                    joinedusers: 0,
                                    is_duplicated: 1,
                                    status: "opened",
                                    clonedChallenge: matchchallenge._id
                                };
                                await redisContest.hsetData(hashKey, cloneId.toString(), newClone, ttlInSeconds);
                            }
                        }
                    }
                }
                if (contests.length > 0) {
                    result.push({ ...categoryDetails, contest: undefined }, ...contests);
                }
            }
            return {
                message: 'Contest of A Particular Match',
                status: true,
                data: result
            };
        } catch (error) {
            console.error('❌ Error fetching contests:', error);
            return {
                message: 'Error retrieving contests',
                status: false,
                data: []
            };
        }
    }

    async fetchAllDuoContests(req) {
        try {
            const matchkey = req.query.matchkey;
            const userId = req.user._id;

            const keynameExpMatch = `listMatchesModel-${matchkey}`;
            const matchDataForExpire = await redisjoinTeams.getkeydata(keynameExpMatch);

            if (!matchDataForExpire?.start_date) {
                return { message: "Match Started No Challenge Available", status: true, data: [] };
            }

            const matchExpStartDate = moment(matchDataForExpire.start_date, "YYYY-MM-DD HH:mm:ss");
            const expireTime = matchExpStartDate.diff(moment(), "seconds");

            if (expireTime <= 0) {
                return { message: "Match Started No Challenge Available", status: true, data: [] };
            }

            const groupKey = `match:${matchkey}:duochallenges:groups`;
            const groupSignatures = await redisContest.redis.hkeys(groupKey);
            if (!groupSignatures.length) {
                return { message: "No contest groups available", status: true, data: [] };
            }

            const maxOpenedContests = 10;
            const contests = [];
            const pipeline = redisContest.redis.pipeline();

            // Step 1: Fetch all opened_ids per signature
            groupSignatures.forEach(signature => {
                const openedKey = `contest_group:${matchkey}:duochallenges:${signature}:opened_ids`;
                pipeline.smembers(openedKey);
            });

            const challengeIdsResult = await pipeline.exec();
            for (let i = 0; i < groupSignatures.length; i++) {
                const signature = groupSignatures[i];
                const [entryfee, win_amount, maximum_user_str] = signature.split('_');
                const maxUsers = parseInt(maximum_user_str) || 2;
                const openedIds = challengeIdsResult[i][1] || [];
                const hashKey = `match:${matchkey}:duochallenges`;
                let challenge;

                if (openedIds.length > 0) {
                    const rawChallenges = await redisContest.redis.hmget(hashKey, ...openedIds);
                    const allParsed = rawChallenges
                        .map(item => {
                            try { return JSON.parse(item); } catch { return null; }
                        })
                        .filter(c => c && c.status === 'opened');

                    challenge = allParsed.find(c => c.joinedusers < c.maximum_user);
                }
                // Step 2: Promote clone if needed
                if (!challenge) {
                    const clonedHashKey = `match:duogame:${matchkey}:entry:${entryfee}:win:${win_amount}:max:${maxUsers}:cloned_challenges`;
                    const cloned = await redisContest.hgetAllData(clonedHashKey);
                    if (cloned && Object.keys(cloned).length > 0) {
                        const cloneId = Object.keys(cloned)[0];
                        challenge = cloned[cloneId];

                        const lockKey = `contest:${cloneId}:lock`;
                        const lockAcquired = await redisContest.redis.setnx(lockKey, 'locked');
                        if (lockAcquired) {
                            await redisContest.redis.expire(lockKey, 5);
                            try {
                                await redisContest.redis.sadd(`contest_group:${matchkey}:duochallenges:${signature}:opened_ids`, cloneId);
                                await redisContest.redis.sadd(`contest_group:${matchkey}:duochallenges:${signature}:ids`, cloneId);
                                await redisContest.hsetData(hashKey, cloneId, challenge, expireTime);

                                // console.log("challenge._id", challenge._id);
                                // console.log("challenge.clonedChallenge", challenge.clonedChallenge);
                                const insertMsg = {
                                    filter: { _id: challenge.clonedChallenge },
                                    payload: {
                                        _id: challenge._id
                                    },
                                    modelName: "dualgamematchchallenge"
                                };
                                sendToQueue('contestInsert', insertMsg);
                                await redisContest.hdelData(clonedHashKey, cloneId);
                                console.log(`🚀 Promoted cloned contest ${cloneId} for signature ${signature}`);
                            } finally {
                                await redisContest.redis.del(lockKey);
                            }
                        }
                    } else {
                        const existingChallenge = await redisContest.redis.hget(
                            `match:${matchkey}:duochallenges:groups`,
                            signature
                        );
                        const challengeData = JSON.parse(existingChallenge);
                        const ttlInSeconds = await matchTimeDifference(req.query.matchkey);
                        const setCount = challengeData?.setCount ?? 20;
                        for (let i = 0; i < setCount; i++) {
                            const cloneId = new mongoose.Types.ObjectId();
                            const newClone = {
                                ...challengeData,
                                _id: cloneId,
                                matchchallengeid: cloneId,
                                joinedusers: 0,
                                is_duplicated: 1,
                                status: "opened",
                                clonedChallenge: challengeData._id
                            };
                            await redisContest.hsetData(clonedHashKey, cloneId.toString(), newClone, ttlInSeconds);
                        }
                    }
                }

                // Step 3: Add contest with leaderboard & user status
                if (challenge?.status === 'opened') {
                    const keyLeaderBoard = `match:${matchkey}:challenge:${challenge._id}:user:${userId}:userDuoLeaderBoard`;
                    const userLeaderBoard = await getMyLeaderBoard(keyLeaderBoard, userId);

                    const keyUserJoinedChallenge = `match:${matchkey}:user:${userId}:joinedDuoContests`;
                    const userContest = await getMyLeaderBoard(keyUserJoinedChallenge, userId, "contest");

                    const keyChallengeLeaderBoardNew = `liveRanksDuoLeaderboard_${challenge._id}`;
                    const challengeLeaderBoard = await retrieveSortedSet(keyChallengeLeaderBoardNew, userId, 0, 10);

                    const usersData = [];
                    for (let i = 0; i < maxUsers; i++) {
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

                    contests.push({
                        ...challenge,
                        usersData,
                        isselected: userLeaderBoard.length > 0,
                        total_joinedcontest: userContest.length
                    });
                }
            }

            return {
                message: 'Contest of A Particular Match',
                status: true,
                data: contests
            };
        } catch (error) {
            console.error('❌ Error fetching contests:', error);
            return {
                message: 'Error retrieving contests',
                status: false,
                data: []
            };
        }
    }


    async fetchAllNewContestsRedisJmeter(req) {
        try {
            const keynameExpMatch = `listMatchesModel-${req.query.matchkey}`;
            const matchDataForExpire = await redisjoinTeams.getkeydata(keynameExpMatch);

            if (!matchDataForExpire || !matchDataForExpire.start_date) {
                return { message: "Match Started No Challenge Available", status: true, data: [] };
            }

            const matchExpStartDate = moment(matchDataForExpire.start_date, "YYYY-MM-DD HH:mm:ss");
            const currentExTime = moment();
            const expireTime = matchExpStartDate.diff(currentExTime, "seconds");

            if (expireTime <= 0) {
                return { message: "Match Started No Challenge Available", status: true, data: [] };
            }
            const matchKey = `match:${req.query.matchkey}:challenges`;
            let allChallenges = await redisContest.hgetAllData(matchKey);
            if (!allChallenges || Object.keys(allChallenges).length === 0) {
                const dbChallenges = await matchContestModel.find({ matchkey: req.query.matchkey });

                for (const matchChallengeData of dbChallenges) {
                    const matchkey = matchChallengeData.matchkey;
                    const challengeId = matchChallengeData._id;
                    const categoryId = matchChallengeData.contest_cat;
                    let totalwinners = 0;
                    if (matchChallengeData?.matchpricecards?.length) {
                        for (const winnerCount of matchChallengeData.matchpricecards) {
                            totalwinners += Number(winnerCount.winners);
                        }
                        const priceDetails = matchChallengeData.matchpricecards[0];
                        totalwinners = totalwinners || Number(priceDetails.winners) || 1;

                        if (priceDetails.price === 0 || priceDetails.type === 'Percentage') {
                            var price_card = {
                                total: priceDetails.total.toString(),
                                price: (priceDetails.total / totalwinners).toFixed(2),
                                price_percent: `${priceDetails.price_percent}%`
                            };
                        } else {
                            var price_card = {
                                total: priceDetails.total.toString(),
                                gift_type: priceDetails.gift_type,
                                price: matchChallengeData.amount_type === "prize"
                                    ? priceDetails.prize_name
                                    : Number(priceDetails.price).toFixed(2),
                                image: matchChallengeData.amount_type === "prize"
                                    ? `${global.constant.IMAGE_URL}${priceDetails.image}`
                                    : ''
                            };
                        }
                    } else {
                        var price_card = {
                            price: matchChallengeData.win_amount.toString(),
                            total: matchChallengeData.win_amount.toString(),
                            image: '',
                            gift_type: "amount"
                        };
                        totalwinners = 1;
                    }

                    const fieldsToUpdate = {
                        type: "contest",
                        is_PromoCode_Contest: matchChallengeData.is_PromoCode_Contest || false,
                        challenge_id: matchChallengeData.challenge_id || null,
                        matchchallengeid: matchChallengeData._id || null,
                        entryfee: matchChallengeData.entryfee || 0,
                        win_amount: matchChallengeData.win_amount || 0,
                        maximum_user: matchChallengeData.maximum_user || 0,
                        joinedusers: matchChallengeData.joinedusers || 0,
                        contest_type: matchChallengeData.contest_type || null,
                        winning_percentage: matchChallengeData.winning_percentage || 0,
                        is_bonus: matchChallengeData.is_bonus || 0,
                        bonus_percentage: matchChallengeData.bonus_percentage || 0,
                        confirmed_challenge: matchChallengeData.confirmed_challenge || 0,
                        multi_entry: matchChallengeData.multi_entry || 0,
                        team_limit: matchChallengeData.team_limit || 1,
                        discount_fee: matchChallengeData.discount_fee || 0,
                        extrapricecard: matchChallengeData.extrapricecards || 0,
                        price_card: price_card || 0,
                        totalwinners: totalwinners || 0,
                        flexible_contest: matchChallengeData.flexible_contest || "0",
                        pdfDownloadStatus: matchChallengeData.pdfDownloadStatus || null,
                        conditional_contest: matchChallengeData.conditional_contest || 0,
                        mandatoryContest: matchChallengeData.mandatoryContest || null,
                        status: matchChallengeData.status || "opened",
                        bonus_type: matchChallengeData.bonus_type || "",
                        amount_type: matchChallengeData.amount_type || "Amount",
                        mega_status: matchChallengeData.mega_status || "",
                        minimum_user: matchChallengeData.minimum_user || 0,
                        pricecard_type: matchChallengeData.pricecard_type || "Amount",
                        c_type: matchChallengeData.c_type || "",
                        WinningpriceAndPrize: matchChallengeData.WinningpriceAndPrize || "",
                        compress: matchChallengeData.compress || "",
                        textNote: matchChallengeData.textNote || "",
                        is_running: matchChallengeData.is_running || 0,
                        is_duplicated: matchChallengeData.is_duplicated,
                        is_recent: matchChallengeData?.is_recent || false,
                        team_type_id: matchChallengeData?.team_type_id,
                        team_type_name: matchChallengeData?.team_type_name || "10-1",
                    };
                    await redisUpdateChallenge.insertRedisFields(matchkey, categoryId, challengeId, fieldsToUpdate);
                }
                await new Promise(resolve => setTimeout(resolve, 100));
                allChallenges = await redisContest.hgetAllData(matchKey);
            }
            const redisKey = `match:${req.query.matchkey}:user:${req.user._id}:teams`;
            let existingTeams = await redisjoinTeams.getkeydata(redisKey) || [];
            if (!existingTeams.length) existingTeams = [];
            const categoryKey = `contestCategory`;
            let categoryData = await redisContest.getkeydata(categoryKey) || [];
            if (!categoryData.length) {
                const categoryD = await contestCategory.find().sort({ Order: 1 });
                categoryData = await redisContest.setkeydata(categoryKey, categoryD, 60 * 60 * 24 * 60);
            }
            if (!categoryData.length) {
                return { message: "No Challenge Available For This Match", status: true, data: [] };
            }

            let result = [];

            for (const cat of categoryData) {
                let contests = [];
                const uniqueChallengeKey = `match:${req.query.matchkey}:category:${cat._id}:unique_challenges`;
                const rawList = await redisContest.redis.lrange(uniqueChallengeKey, 0, -1);
                const uniqueChallengeIds = rawList.map(item => JSON.parse(item));
                if (!uniqueChallengeIds.length) continue;

                const categoryDetails = {
                    ...cat,
                    type: "category",
                    catid: cat._id,
                };
                delete categoryDetails.fantasy_type;
                delete categoryDetails.Order;
                delete categoryDetails.tbl_order;
                delete categoryDetails.has_leaderBoard;
                delete categoryDetails.megaStatus;
                delete categoryDetails.createdAt;
                delete categoryDetails.updatedAt;
                delete categoryDetails.cat_order;
                delete categoryDetails.catname;

                for (const matchchallenge of uniqueChallengeIds) {
                    const matchEntryFee = Number(matchchallenge.entryfee);
                    const matchWinAmount = Number(matchchallenge.win_amount);
                    const matchMaxUser = Number(matchchallenge.maximum_user);

                    const similar = Object.values(allChallenges)
                        .filter(c => {
                            const entryFee = Number(c.entryfee);
                            const winAmount = Number(c.win_amount);
                            const maxUser = Number(c.maximum_user);
                            const joined = Number(c.joinedusers || 0);

                            return (
                                c.status === "opened" &&
                                entryFee === matchEntryFee &&
                                winAmount === matchWinAmount &&
                                maxUser === matchMaxUser &&
                                joined < maxUser
                            );
                        })
                        .sort((a, b) => Number(b.joinedusers || 0) - Number(a.joinedusers || 0))
                    [0];


                    let isselected = false;
                    let total_joinedcontest = [];
                    let userContest = [];

                    if (similar) {
                        const keyLeaderBoard = `match:${req.query.matchkey}:challenge:${similar._id}:user:${req.user._id}:userLeaderBoard`;
                        total_joinedcontest = await getMyLeaderBoard(keyLeaderBoard, req.user._id);

                        const keyUserJoinedChallenge = `match:${req.query.matchkey}:user:${req.user._id}:joinedContests`;
                        userContest = await getMyLeaderBoard(keyUserJoinedChallenge, req.user._id, "contest");

                        if (total_joinedcontest.length > 0) {
                            if (similar.multi_entry == 1 && total_joinedcontest.length < similar.team_limit) {
                                if (similar.contest_type === 'Amount') {
                                    isselected = total_joinedcontest.length === similar.team_limit || similar.joinedusers === similar.maximum_user;
                                } else if (similar.contest_type === 'Percentage') {
                                    isselected = total_joinedcontest.length === similar.team_limit;
                                }
                            } else {
                                isselected = true;
                            }
                        }

                        const listMatchKey = `challengeId_${similar._id}`;
                        const expRedisTime = await matchTimeDifference(req.query.matchkey);
                        await redisContest.setkeydata(listMatchKey, req.query.matchkey, expRedisTime);
                        if (matchchallengeid == "682ddf0e9b3854131286a5be") {
                            joinedusers = similar.joinedusers + 20000;
                        } else {
                            joinedusers = similar.joinedusers;
                        }
                        contests.push({
                            ...similar,
                            isselected,
                            joinedusers: joinedusers,
                            refercode: total_joinedcontest?.[0]?.refercode || '',
                            total_joinedcontest: userContest.length,
                            total_teams: existingTeams.length,
                        });
                    } else if (matchchallenge.is_running == 1) {
                        const hashKey = `match:${req.query.matchkey}:entry:${matchchallenge.entryfee}:win:${matchchallenge.win_amount}:max:${matchchallenge.maximum_user}:cloned_challenges`;
                        const existingChallenges = await redisContest.hgetAllData(hashKey);

                        if (existingChallenges && Object.keys(existingChallenges).length > 0) {
                            const firstKey = Object.keys(existingChallenges)[0];
                            const firstChallenge = existingChallenges[firstKey];

                            if (firstChallenge) {
                                const keyName = `match:${req.query.matchkey}:challenges`;
                                const ttlInSeconds = await matchTimeDifference(req.query.matchkey);
                                await redisContest.hsetData(keyName, firstChallenge._id, firstChallenge, ttlInSeconds);

                                const insertMsg = {
                                    filter: { _id: firstChallenge.clonedChallenge },
                                    payload: {
                                        _id: firstChallenge._id
                                    },
                                    modelName: "matchcontest"
                                };
                                sendToQueue('contestInsert', insertMsg);
                                await redisContest.hdelData(hashKey, firstKey);

                                const keyLeaderBoard = `match:${req.query.matchkey}:challenge:${firstChallenge._id}:user:${req.user._id}:userLeaderBoard`;
                                total_joinedcontest = await getMyLeaderBoard(keyLeaderBoard, req.user._id);

                                const keyUserJoinedChallenge = `match:${req.query.matchkey}:user:${req.user._id}:joinedContests`;
                                userContest = await getMyLeaderBoard(keyUserJoinedChallenge, req.user._id, "contest");

                                if (total_joinedcontest.length > 0) {
                                    if (firstChallenge.multi_entry == 1 && total_joinedcontest.length < firstChallenge.team_limit) {
                                        if (firstChallenge.contest_type === 'Amount') {
                                            isselected = total_joinedcontest.length === firstChallenge.team_limit || firstChallenge.joinedusers === firstChallenge.maximum_user;
                                        } else if (firstChallenge.contest_type === 'Percentage') {
                                            isselected = total_joinedcontest.length === firstChallenge.team_limit;
                                        }
                                    } else {
                                        isselected = true;
                                    }
                                }

                                contests.push({
                                    ...firstChallenge,
                                    isselected,
                                    refercode: total_joinedcontest?.[0]?.refercode || '',
                                    total_joinedcontest: userContest.length,
                                    total_teams: existingTeams.length,
                                });
                            }
                        } else {
                            const ttlInSeconds = await matchTimeDifference(req.query.matchkey);
                            const setCount = matchchallenge?.setCount ?? 20;
                            for (let i = 0; i < setCount; i++) {
                                const cloneId = new mongoose.Types.ObjectId();
                                const newClone = {
                                    ...matchchallenge,
                                    _id: cloneId,
                                    matchchallengeid: cloneId,
                                    joinedusers: 0,
                                    is_duplicated: 1,
                                    status: "opened",
                                    clonedChallenge: matchchallenge._id
                                };
                                await redisContest.hsetData(hashKey, cloneId.toString(), newClone, ttlInSeconds);
                            }
                        }
                    }
                }
                result.push(...contests);
            }

            return {
                message: 'Contest of A Particular Match',
                status: true,
                data: result
            };
        } catch (error) {
            console.error('❌ Error fetching contests:', error);
            return {
                message: 'Error retrieving contests',
                status: false,
                data: []
            };
        }
    }



    async fetchAllNewContestRedisForChecking(req) {
        try {
            const keynameExpMatch = `listMatchesModel-${req.query.matchkey}`;
            const matchDataForExpire = await redisjoinTeams.getkeydata(keynameExpMatch);

            if (!matchDataForExpire || !matchDataForExpire.start_date) {
                return { message: "Match Started No Challenge Available", status: true, data: [] };
            }

            const matchExpStartDate = moment(matchDataForExpire.start_date, "YYYY-MM-DD HH:mm:ss");
            const currentExTime = moment();
            const expireTime = matchExpStartDate.diff(currentExTime, "seconds");

            if (expireTime <= 0) {
                return { message: "Match Started No Challenge Available", status: true, data: [] };
            }
            const matchKey = `match:${req.query.matchkey}:challenges`;
            let allChallenges = await redisContest.hgetAllData(matchKey, 'opened');
            if (!allChallenges || Object.keys(allChallenges).length === 0) {
                const dbChallenges = await matchContestModel.find({ matchkey: req.query.matchkey });

                for (const matchChallengeData of dbChallenges) {
                    const matchkey = matchChallengeData.matchkey;
                    const challengeId = matchChallengeData._id;
                    const categoryId = matchChallengeData.contest_cat;
                    let totalwinners = 0;
                    if (matchChallengeData?.matchpricecards?.length) {
                        for (const winnerCount of matchChallengeData.matchpricecards) {
                            totalwinners += Number(winnerCount.winners);
                        }
                        const priceDetails = matchChallengeData.matchpricecards[0];
                        totalwinners = totalwinners || Number(priceDetails.winners) || 1;

                        if (priceDetails.price === 0 || priceDetails.type === 'Percentage') {
                            var price_card = {
                                total: priceDetails.total.toString(),
                                price: (priceDetails.total / totalwinners).toFixed(2),
                                price_percent: `${priceDetails.price_percent}%`
                            };
                        } else {
                            var price_card = {
                                total: priceDetails.total.toString(),
                                gift_type: priceDetails.gift_type,
                                price: matchChallengeData.amount_type === "prize"
                                    ? priceDetails.prize_name
                                    : Number(priceDetails.price).toFixed(2),
                                image: matchChallengeData.amount_type === "prize"
                                    ? `${global.constant.IMAGE_URL}${priceDetails.image}`
                                    : ''
                            };
                        }
                    } else {
                        var price_card = {
                            price: matchChallengeData.win_amount.toString(),
                            total: matchChallengeData.win_amount.toString(),
                            image: '',
                            gift_type: "amount"
                        };
                        totalwinners = 1;
                    }

                    const fieldsToUpdate = {
                        type: "contest",
                        is_PromoCode_Contest: matchChallengeData.is_PromoCode_Contest || false,
                        challenge_id: matchChallengeData.challenge_id || null,
                        matchchallengeid: matchChallengeData._id || null,
                        entryfee: matchChallengeData.entryfee || 0,
                        win_amount: matchChallengeData.win_amount || 0,
                        maximum_user: matchChallengeData.maximum_user || 0,
                        joinedusers: matchChallengeData.joinedusers || 0,
                        contest_type: matchChallengeData.contest_type || null,
                        winning_percentage: matchChallengeData.winning_percentage || 0,
                        is_bonus: matchChallengeData.is_bonus || 0,
                        bonus_percentage: matchChallengeData.bonus_percentage || 0,
                        confirmed_challenge: matchChallengeData.confirmed_challenge || 0,
                        multi_entry: matchChallengeData.multi_entry || 0,
                        team_limit: matchChallengeData.team_limit || 1,
                        discount_fee: matchChallengeData.discount_fee || 0,
                        price_card: price_card || 0,
                        extrapricecard: matchChallengeData.extrapricecards || 0,
                        totalwinners: totalwinners || 0,
                        flexible_contest: matchChallengeData.flexible_contest || "0",
                        pdfDownloadStatus: matchChallengeData.pdfDownloadStatus || null,
                        conditional_contest: matchChallengeData.conditional_contest || 0,
                        mandatoryContest: matchChallengeData.mandatoryContest || null,
                        status: matchChallengeData.status || "opened",
                        bonus_type: matchChallengeData.bonus_type || "",
                        amount_type: matchChallengeData.amount_type || "Amount",
                        mega_status: matchChallengeData.mega_status || "",
                        minimum_user: matchChallengeData.minimum_user || 0,
                        pricecard_type: matchChallengeData.pricecard_type || "Amount",
                        c_type: matchChallengeData.c_type || "",
                        WinningpriceAndPrize: matchChallengeData.WinningpriceAndPrize || "",
                        compress: matchChallengeData.compress || "",
                        textNote: matchChallengeData.textNote || "",
                        is_running: matchChallengeData.is_running || 0,
                        is_duplicated: matchChallengeData.is_duplicated,
                        is_recent: matchChallengeData?.is_recent || false,
                        team_type_id: matchChallengeData?.team_type_id,
                        team_type_name: matchChallengeData?.team_type_name || "10-1",
                    };
                    await redisUpdateChallenge.insertRedisFields(matchkey, categoryId, challengeId, fieldsToUpdate);
                }
                await new Promise(resolve => setTimeout(resolve, 100));
                allChallenges = await redisContest.hgetAllData(matchKey);
            }


            const redisKey = `match:${req.query.matchkey}:user:${req.user._id}:teams`;
            let existingTeams = await redisjoinTeams.getkeydata(redisKey) || [];
            if (!existingTeams.length) existingTeams = [];
            const categoryKey = `contestCategory`;
            let categoryData = await redisContest.getkeydata(categoryKey) || [];
            if (!categoryData.length) {
                const categoryD = await contestCategory.find().sort({ Order: 1 });
                categoryData = await redisContest.setkeydata(categoryKey, categoryD, 60 * 60 * 24 * 60);
            }
            if (!categoryData.length) {
                return { message: "No Challenge Available For This Match", status: true, data: [] };
            }

            let result = [];

            for (const cat of categoryData) {
                let contests = [];
                const uniqueChallengeKey = `match:${req.query.matchkey}:category:${cat._id}:unique_challenges`;
                const rawList = await redisContest.redis.lrange(uniqueChallengeKey, 0, -1);
                const uniqueChallengeIds = rawList.map(item => JSON.parse(item));
                if (!uniqueChallengeIds.length) continue;

                const categoryDetails = {
                    ...cat,
                    type: "category",
                    catid: cat._id,
                };
                delete categoryDetails.fantasy_type;
                delete categoryDetails.Order;
                delete categoryDetails.tbl_order;
                delete categoryDetails.has_leaderBoard;
                delete categoryDetails.megaStatus;
                delete categoryDetails.createdAt;
                delete categoryDetails.updatedAt;
                delete categoryDetails.cat_order;
                delete categoryDetails.catname;

                for (const matchchallenge of uniqueChallengeIds) {
                    const matchEntryFee = Number(matchchallenge.entryfee);
                    const matchWinAmount = Number(matchchallenge.win_amount);
                    const matchMaxUser = Number(matchchallenge.maximum_user);

                    const similar = Object.values(allChallenges)
                        .filter(c => {
                            const entryFee = Number(c.entryfee);
                            const winAmount = Number(c.win_amount);
                            const maxUser = Number(c.maximum_user);
                            const joined = Number(c.joinedusers || 0);

                            return (
                                c.status === "opened" &&
                                entryFee === matchEntryFee &&
                                winAmount === matchWinAmount &&
                                maxUser === matchMaxUser &&
                                joined < maxUser
                            );
                        })
                        .sort((a, b) => Number(b.joinedusers || 0) - Number(a.joinedusers || 0))
                    [0];


                    let isselected = false;
                    let total_joinedcontest = [];
                    let userContest = [];

                    if (similar) {
                        const keyLeaderBoard = `match:${req.query.matchkey}:challenge:${similar._id}:user:${req.user._id}:userLeaderBoard`;
                        total_joinedcontest = await getMyLeaderBoard(keyLeaderBoard, req.user._id);

                        const keyUserJoinedChallenge = `match:${req.query.matchkey}:user:${req.user._id}:joinedContests`;
                        userContest = await getMyLeaderBoard(keyUserJoinedChallenge, req.user._id, "contest");

                        if (total_joinedcontest.length > 0) {
                            if (similar.multi_entry == 1 && total_joinedcontest.length < similar.team_limit) {
                                if (similar.contest_type === 'Amount') {
                                    isselected = total_joinedcontest.length === similar.team_limit || similar.joinedusers === similar.maximum_user;
                                } else if (similar.contest_type === 'Percentage') {
                                    isselected = total_joinedcontest.length === similar.team_limit;
                                }
                            } else {
                                isselected = true;
                            }
                        }

                        const listMatchKey = `challengeId_${similar._id}`;
                        const expRedisTime = await matchTimeDifference(req.query.matchkey);
                        await redisContest.setkeydata(listMatchKey, req.query.matchkey, expRedisTime);

                        contests.push({
                            ...similar,
                            isselected,
                            refercode: total_joinedcontest?.[0]?.refercode || '',
                            total_joinedcontest: userContest.length,
                            total_teams: existingTeams.length,
                        });
                    } else if (matchchallenge.is_running == 1) {
                        const hashKey = `match:${req.query.matchkey}:entry:${matchchallenge.entryfee}:win:${matchchallenge.win_amount}:max:${matchchallenge.maximum_user}:cloned_challenges`;
                        const existingChallenges = await redisContest.hgetAllData(hashKey);

                        if (existingChallenges && Object.keys(existingChallenges).length > 0) {
                            const firstKey = Object.keys(existingChallenges)[0];
                            const firstChallenge = existingChallenges[firstKey];

                            if (firstChallenge) {
                                const keyName = `match:${req.query.matchkey}:challenges`;
                                const ttlInSeconds = await matchTimeDifference(req.query.matchkey);
                                await redisContest.hsetData(keyName, firstChallenge._id, firstChallenge, ttlInSeconds);

                                const insertMsg = {
                                    filter: { _id: firstChallenge.clonedChallenge },
                                    payload: {
                                        _id: firstChallenge._id
                                    },
                                    modelName: "matchcontest"
                                };
                                sendToQueue('contestInsert', insertMsg);
                                await redisContest.hdelData(hashKey, firstKey);

                                const keyLeaderBoard = `match:${req.query.matchkey}:challenge:${firstChallenge._id}:user:${req.user._id}:userLeaderBoard`;
                                total_joinedcontest = await getMyLeaderBoard(keyLeaderBoard, req.user._id);

                                const keyUserJoinedChallenge = `match:${req.query.matchkey}:user:${req.user._id}:joinedContests`;
                                userContest = await getMyLeaderBoard(keyUserJoinedChallenge, req.user._id, "contest");

                                if (total_joinedcontest.length > 0) {
                                    if (firstChallenge.multi_entry == 1 && total_joinedcontest.length < firstChallenge.team_limit) {
                                        if (firstChallenge.contest_type === 'Amount') {
                                            isselected = total_joinedcontest.length === firstChallenge.team_limit || firstChallenge.joinedusers === firstChallenge.maximum_user;
                                        } else if (firstChallenge.contest_type === 'Percentage') {
                                            isselected = total_joinedcontest.length === firstChallenge.team_limit;
                                        }
                                    } else {
                                        isselected = true;
                                    }
                                }

                                contests.push({
                                    ...firstChallenge,
                                    isselected,
                                    refercode: total_joinedcontest?.[0]?.refercode || '',
                                    total_joinedcontest: userContest.length,
                                    total_teams: existingTeams.length,
                                });
                            }
                        } else {
                            const ttlInSeconds = await matchTimeDifference(req.query.matchkey);
                            const setCount = matchchallenge?.setCount ?? 20;
                            for (let i = 0; i < setCount; i++) {
                                const cloneId = new mongoose.Types.ObjectId();
                                const newClone = {
                                    ...matchchallenge,
                                    _id: cloneId,
                                    matchchallengeid: cloneId,
                                    joinedusers: 0,
                                    is_duplicated: 1,
                                    status: "opened",
                                    clonedChallenge: matchchallenge._id
                                };
                                await redisContest.hsetData(hashKey, cloneId.toString(), newClone, ttlInSeconds);
                            }
                        }
                    }
                }
                result.push({ ...categoryDetails, contest: undefined }, ...contests);
            }

            return {
                message: 'Contest of A Particular Match',
                status: true,
                data: result
            };
        } catch (error) {
            console.error('❌ Error fetching contests:', error);
            return {
                message: 'Error retrieving contests',
                status: false,
                data: []
            };
        }
    }
    async fetchAllContests(req) {
        try {
            // console.time("getAllContestsExecutionTime");
            await this.updateJoinedusers(req);
            // Parallel fetch initial data
            const [categoryData, total_teams, total_joinedcontestData] = await Promise.all([
                contestCategory.find({}),
                userTeamModel.countDocuments({ userid: req.user._id, matchkey: req.query.matchkey }),
                userLeagueModel.countDocuments({ userid: req.user._id, matchkey: req.query.matchkey }),
            ]);

            // Early exit for no categories
            if (!categoryData?.length) {
                return { message: "No categories found.", status: false, data: [] };
            }

            // Redis keys operations
            const redisKeys = await redisjoinTeams.getKeyOnly(`match:${req.query.matchkey}:challenge:*`);

            console.log("redisKeys", redisKeys);
            if (!redisKeys?.length) {
                return { message: "No challenges found.", status: false, data: [] };
            }

            // Batch get all challenge data
            const challengeDataArray = await Promise.all(redisKeys.map(getkeydata));
            const validChallenges = challengeDataArray.filter(c => c?.contest_cat);

            // Extract IDs and prepare data for batch processing
            const challengeIds = validChallenges.map(c => c._id.toString());
            const userId = req.user._id.toString();
            const matchkey = req.query.matchkey;

            // Batch fetch user contest data
            const [joinedChallenges, leaderboardCounts] = await Promise.all([
                userLeagueModel.find({
                    userid: userId,
                    matchkey,
                    challengeid: { $in: challengeIds }
                }).distinct('challengeid'),
                this.getBatchLeaderboardCounts(validChallenges, userId, matchkey)
            ]);

            const joinedSet = new Set(joinedChallenges.map(id => id.toString()));
            const leaderboardMap = new Map(Object.entries(leaderboardCounts));

            // Process challenges in-memory
            validChallenges.forEach(challenge => {
                const isJoined = joinedSet.has(challenge._id.toString());
                const lbCount = leaderboardMap.get(challenge._id) || 0;

                challenge.isselected = isJoined || lbCount > 0;
                challenge.refercode = null;
                challenge.totalJoinedcontest = total_joinedcontestData;
                challenge.totalTeams = total_teams;
            });

            // Group challenges by category
            const categoryMap = new Map(categoryData.map(c => [c._id.toString(), c.toObject()]));
            const challengesByCategory = validChallenges.reduce((acc, challenge) => {
                const categoryId = challenge.contest_cat.toString();
                if (categoryMap.has(categoryId)) {
                    acc.set(categoryId, [...(acc.get(categoryId) || []), challenge]);
                }
                return acc;
            }, new Map());

            // Generate final sorted result
            const combinedResult = categoryData.flatMap(category => {
                const challenges = challengesByCategory.get(category._id.toString()) || [];
                return challenges.length ? [category, ...challenges] : [];
            });

            console.timeEnd("getAllContestsExecutionTime");

            return {
                message: "Contests for specified match.",
                status: true,
                data: combinedResult
            };

        } catch (error) {
            console.error("Error in fetchAllContests:", error);
            return {
                message: "Error fetching contests",
                status: false,
                error: error.message
            };
        }
    }

    async getBatchLeaderboardCounts(challenges, userId, matchkey) {
        try {
            const countsMap = {};
            const pipeline = redis.pipeline();
            const hashTag = `{${matchkey}}`; // Cluster hash tag

            challenges.forEach(challenge => {
                // Add hash tag to ensure same slot
                const key = `match:${hashTag}:challenge:${challenge._id}:user:${userId}:userLeaderBoard`;
                pipeline.scard(key);
            });

            // Execute pipeline
            const results = await pipeline.exec();

            challenges.forEach((challenge, index) => {
                const [err, count] = results[index] || [null, 0];
                countsMap[challenge._id] = err ? 0 : count;
            });

            return countsMap;
        } catch (error) {
            console.error("Error in batch leaderboard counts:", error);
            return {};
        }
    }


    /**
     * @function fetchAllContests
     * @description Gat All Contest Of A Match
     * @param { matchkey }
     * @author 
     */
    async fetchContestWithoutCategory(req) {
        try {
            let finalData = [],
                contest_arr = [],
                aggpipe = [];
            aggpipe.push({
                $match: { matchkey: mongoose.Types.ObjectId(req.query.matchkey) }
            });
            aggpipe.push({
                $match: {
                    $expr: {
                        $eq: ['$status', 'opened']
                    }
                }
            });
            if (req.query.catid) {
                aggpipe.push({
                    $match: { contest_cat: mongoose.Types.ObjectId(req.query.catid) }
                });
            }
            aggpipe.push({
                $sort: { 'win_amount': -1 }
            });
            const matchchallengesData = await matchContestModel.aggregate(aggpipe);
            // console.log(`matchchallengesData-------------------`, matchchallengesData);
            let i = 0;
            if (matchchallengesData.length == 0) {
                return {
                    message: "No Challenge Available For This Match",
                    status: true,
                    data: []
                }
            }
            for await (const matchchallenge of matchchallengesData) {
                i++;
                // const challenge = matchchallenge[0];
                // if ((matchchallenge.contest_type == 'Amount' && matchchallenge.joinedusers < matchchallenge.maximum_user) || matchchallenge.contest_type == 'Percentage') {
                //     if (matchchallenge.maximum_user >= 0 && matchchallenge.is_private != 1 && matchchallenge.status == 'opened') {
                let isselected = false,
                    refercode = '',
                    winners = 0;
                const price_card = [];
                const joinedleauge = await userLeagueModel.find({
                    matchkey: req.query.matchkey,
                    challengeid: matchchallenge._id,
                    userid: req.user._id,
                }).select('_id refercode');
                if (joinedleauge.length > 0) {
                    refercode = joinedleauge[0].refercode;
                    if (matchchallenge.multi_entry == 1 && joinedleauge.length < 11) {
                        if (matchchallenge.contest_type == 'Amount') {
                            if (joinedleauge.length == 11 || matchchallenge.joinedusers == matchchallenge.maximum_user)
                                isselected = true;
                        } else if (matchchallenge.contest_type == 'Percentage') {
                            if (joinedleauge.length == 11) isselected = true;
                        } else isselected = false;
                    } else isselected = true;
                }
                if (matchchallenge.matchpricecards) {
                    if (matchchallenge.matchpricecards.length > 0) {
                        for await (const priceCard of matchchallenge.matchpricecards) {
                            winners += Number(priceCard.winners);
                            const tmpObj = {
                                id: priceCard._id,
                                winners: priceCard.winners,
                                total: priceCard.total,
                            };
                            tmpObj.gift_type = priceCard.gift_type;
                            if (matchchallenge.amount_type == 'prize') {
                                if (priceCard.gift_type == "gift") {
                                    tmpObj.image = `${global.constant.IMAGE_URL}${priceCard.image}`;
                                    tmpObj.price = priceCard.prize_name;
                                } else {
                                    tmpObj.price = priceCard.price;
                                    tmpObj.image = '';
                                }
                            } else {
                                tmpObj.price = priceCard.price;
                                tmpObj.image = '';
                            }
                            if ((priceCard.price && Number(priceCard.price) == 0) || priceCard.type == 'Percentage') {
                                tmpObj['price'] = (Number(priceCard.total) / Number(priceCard.winners)).toFixed(2);
                                tmpObj['price_percent'] = `${priceCard.price_percent}%`;
                            } else {
                                tmpObj['price'] = Number(priceCard.price).toFixed(2);
                            }
                            if (priceCard.min_position + 1 != priceCard.max_position) tmpObj['start_position'] = `${Number(priceCard.min_position) + 1}-${priceCard.max_position}`;
                            else tmpObj['start_position'] = `${priceCard.max_position}`;
                            price_card.push(tmpObj);
                        }
                    } else {
                        price_card.push({
                            id: 0,
                            winners: 1,
                            price: matchchallenge.win_amount,
                            total: matchchallenge.win_amount,
                            start_position: 1,
                            image: "",
                            gift_type: "amount"
                        });
                        winners = 1;
                    }
                } else {
                    price_card.push({
                        id: 0,
                        winners: 1,
                        price: matchchallenge.win_amount,
                        total: matchchallenge.win_amount,
                        start_position: 1,
                        image: "",
                        gift_type: "amount"

                    });
                    winners = 1;
                }
                let gift_image = "";
                let gift_type = "amount";
                let find_gift = matchchallenge.matchpricecards.find(function (x) { return x.gift_type == "gift" });
                // console.log("---find_gift-------//---",find_gift)
                if (find_gift) {
                    gift_image = `${global.constant.IMAGE_URL}${find_gift.image}`;
                    gift_type = find_gift.gift_type;
                }
                let team_limits;
                if (matchchallenge.multi_entry == 0) {
                    team_limits = 1
                } else {
                    team_limits = matchchallenge.team_limit
                }
                finalData.push({
                    matchchallengeid: matchchallenge._id,
                    catid: matchchallenge.contest_cat,
                    contest_type: matchchallenge.contest_type,
                    winning_percentage: matchchallenge.winning_percentage,
                    entryfee: matchchallenge.entryfee,
                    win_amount: matchchallenge.win_amount,
                    maximum_user: matchchallenge.contest_type == 'Amount' ? matchchallenge.maximum_user : 0,
                    matchkey: req.query.matchkey,
                    joinedusers: matchchallenge.joinedusers,
                    multi_entry: matchchallenge.multi_entry,
                    confirmed_challenge: matchchallenge.confirmed_challenge,
                    is_running: matchchallenge.is_running,
                    is_bonus: matchchallenge.is_bonus,
                    team_limit: team_limits,
                    bonus_percentage: matchchallenge.bonus_percentage || 0,
                    pricecard_type: matchchallenge.pricecard_type,
                    isselected: isselected,
                    bonus_date: '',
                    isselectedid: '',
                    refercode: refercode,
                    totalwinners: winners,
                    price_card: price_card,
                    status: 1,
                    joinedleauges: team_limits,
                    total_joinedcontest: 0,
                    total_teams: 0,
                    gift_image: gift_image,
                    gift_type: gift_type
                });
                //     }
                // }
                if (i == matchchallengesData.length) {
                    finalData.sort(function (a, b) {
                        return b['win_amount'] - a['win_amount'];
                    });
                    return {
                        message: 'Contest of A Perticular Match Without Category',
                        status: true,
                        // data: matchchallengesData
                        data: finalData
                    }
                }
            }
        } catch (error) {
            throw error;
        }
    }

    /**
     * @function getContests
     * @description Gat A Perticular Contest 
     * @param { matchchallengeid }
     * @author 
     */
    async getContestRedis(req) {
        try {
            let finalData = {},
                aggpipe = [];
            aggpipe.push({
                $match: { _id: mongoose.Types.ObjectId(req.query.matchchallengeid) }
            });
            aggpipe.push({
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
                                                            "$matchpricecards.winners",
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
            });
            aggpipe.push({
                $sort: { 'win_amount': -1 }
            });
            const matchchallengesData = await matchContestModel.aggregate(aggpipe);
            let i = 0;
            if (matchchallengesData.length == 0) {
                return {
                    message: "No Challenge Available ..!",
                    status: true,
                    data: {}
                }
            }
            let isselected = false,
                refercode = '',
                winners = 0;
            const price_card = [];
            const joinedleauge = await userLeagueModel.find({
                // matchkey: req.query.matchkey,
                challengeid: req.query.matchchallengeid,
                userid: req.user._id,
            }).select('_id refercode');

            if (joinedleauge.length > 0) {
                refercode = joinedleauge[0].refercode;
                if (matchchallengesData[0].multi_entry == 1 && joinedleauge.length < matchchallengesData[0].team_limit) {
                    if (matchchallengesData[0].contest_type == 'Amount') {
                        if (joinedleauge.length == matchchallengesData[0].team_limit || matchchallengesData[0].joinedusers == matchchallengesData[0].maximum_user)
                            isselected = true;
                    } else if (matchchallengesData[0].contest_type == 'Percentage') {
                        if (joinedleauge.length == matchchallengesData[0].team_limit) isselected = true;
                    } else isselected = false;
                } else isselected = true;
            }
            if (matchchallengesData[0].matchpricecards && matchchallengesData[0].matchpricecards.length > 0) {
                for await (const priceCard of matchchallengesData[0].matchpricecards) {
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
                    price: matchchallengesData[0].win_amount,
                    total: matchchallengesData[0].win_amount,
                    amount_type: matchchallengesData[0].amount_type,
                    min_position: 0,
                    max_position: 1,
                });
                winners = 1;
            }
            let gift_image = "";
            let gift_type = "amount";
            let find_gift = matchchallengesData[0].matchpricecards.find(function (x) { return x.gift_type == "gift" });
            if (find_gift) {
                gift_image = `${global.constant.IMAGE_URL}${find_gift.image}`;
                gift_type = find_gift.gift_type;
            }

            const total_teams = await userTeamModel.countDocuments({ matchkey: req.query.matchkey, userid: req.user._id, });
            const total_joinedcontestData = await userLeagueModel.aggregate([
                {
                    $match: {
                        userid: mongoose.Types.ObjectId(req.user._id),
                        matchkey: mongoose.Types.ObjectId(req.query.matchkey)
                    }
                },
                {
                    $group: {
                        _id: "$challengeid",
                    }
                }, {
                    $count: "total_count"
                }
            ])
            let count_JoinTeam = total_joinedcontestData[0]?.total_count;
            let team_limits;
            if (matchchallengesData[0].multi_entry == 0) {
                team_limits = 1
            } else {
                team_limits = matchchallengesData[0].team_limit
            }
            finalData = {
                _id: matchchallengesData[0]._id,
                matchchallengeid: matchchallengesData[0]._id,
                contest_name: matchchallengesData[0].contest_name,
                fantasyType: matchchallengesData[0].fantasy_type,
                subTitle: "",
                createdAt: matchchallengesData[0].createdAt,
                updatedAt: matchchallengesData[0].updatedAt,
                contestType: matchchallengesData[0].contest_type,
                isPromoCodeContest: matchchallengesData[0].is_PromoCode_Contest,
                challengeId: matchchallengesData[0].challenge_id,
                matchkey: matchchallengesData[0].matchkey,
                entryfee: matchchallengesData[0].entryfee,
                winAmount: matchchallengesData[0].win_amount,
                maximumUser: matchchallengesData[0].maximum_user,
                joinedusers: matchchallengesData[0].joinedusers,
                contest_type: matchchallengesData[0].c_type,
                winningPercentage: matchchallengesData[0].winning_percentage,
                isBonus: matchchallengesData[0].is_bonus,
                bonusPercentage: matchchallengesData[0].bonus_percentage,
                confirmedChallenge: matchchallengesData[0].confirmed_challenge,
                multiEntry: matchchallengesData[0].multi_entry,
                teamLimit: team_limits,
                isPrivate: matchchallengesData[0].is_private,
                discountFee: matchchallengesData[0].discount_fee,
                isselected: isselected,
                refercode: refercode,
                matchchallengeid: matchchallengesData[0]._id,
                totalJoinedcontest: 0,
                totalTeams: total_teams,
                totalwinners: winners === 0 ? 1 : winners,
                flexibleContest: matchchallengesData[0].flexible_contest,
                conditionalContest: matchchallengesData[0].conditional_contest,
                mandatoryContest: matchchallengesData[0].mandatoryContest,
                textNote: matchchallengesData[0].textNote,
                matchpricecard: price_card,
                pricecard_type: matchchallengesData[0].pricecard_type,
                extrapricecard: matchchallengesData[0].extrapricecards,

                // matchchallengeid: matchchallengesData[0]._id,
                // winning_percentage: matchchallengesData[0].winning_percentage,
                // entryfee: matchchallengesData[0].entryfee,
                // win_amount: matchchallengesData[0].win_amount,
                // contest_type: matchchallengesData[0].contest_type,
                // maximum_user: matchchallengesData[0].contest_type == 'Amount' ? matchchallengesData[0].maximum_user : 0,
                // joinedusers: matchchallengesData[0].joinedusers,
                // is_expert: matchchallengesData[0].is_expert,
                // expert_name: matchchallengesData[0].expert_name,
                // multi_entry: matchchallengesData[0].multi_entry,
                // confirmed_challenge: matchchallengesData[0].confirmed_challenge,
                // is_running: matchchallengesData[0].is_running,
                // amount_type: matchchallengesData[0].amount_type,
                // is_bonus: matchchallengesData[0].is_bonus,
                // team_limit: matchchallengesData[0].team_limit,
                // joinedleauge: joinedleauge,  //matchchallengesData[0].joinedusers,     //matchchallengesData[0].team_limit,
                // joinedleauges: joinedleauge.length,
                // total_joinedcontest: 0,
                // total_teams: total_teams, //0,
                // bonus_percentage: matchchallengesData[0].bonus_percentage || 0,
                // pricecard_type: matchchallengesData[0].pricecard_type,
                // isselected: isselected,
                // bonus_date: '',
                // isselectedid: '',
                // refercode: refercode,
                // totalwinners: winners,
                // price_card: price_card,
                // status: 1,
                // gift_type: gift_type,
                // gift_image: gift_image
            }
            //     }
            // }
            return {
                message: "Match Challenge Data ..!",
                status: true,
                data: finalData
            }
        } catch (error) {
            throw error;
        }
    }
    /**
   * @function getContests
   * @description Gat A Perticular Contest 
   * @param { matchchallengeid }
   * @author 
   */
    async fetchContest(req) {
        try {
            let matchkey = req.query?.matchkey;
            if (!req.query?.matchkey) {
                let listMatchKey = `challengeId_${req.query.matchchallengeid}`;
                matchkey = await redisContest.getkeydata(listMatchKey);
            }

            const keyName = `match:${matchkey}:challenges`; // Redis Hash key
            // Get existing challenge data
            let finalData = await redisContest.hgetData(keyName, req.query.matchchallengeid);
            if (finalData) {
                let price_card = [];

                let keyPricecard = `challengePricecard:${req.query.matchchallengeid}`;
                let matchpricecard = await redisContest.getkeydata(keyPricecard);
                if (!matchpricecard || matchpricecard.length <= 0) {
                    keyPricecard = `challengePricecard:${req.query.matchchallengeid}`;
                    const challengeData = await matchContestModel.findById(finalData._id);
                    const pricecards = challengeData?.matchpricecards || [];
                    await redisContest.setkeydata(keyPricecard, pricecards, 60 * 60 * 24 * 90);
                    matchpricecard = await redisContest.getkeydata(keyPricecard);
                }
                // console.log('matchpricecard', matchpricecard);
                // if (!matchpricecard || matchpricecard.length <= 0) {
                //     // matchpricecard = await priceCardModel.find({ challengersId: finalData.challenge_id });
                //     // await redisContest.setkeydata(keyPricecard, matchpricecard, 60 * 60 * 24 * 90);
                //     matchpricecard = [];
                // }

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
                        price: finalData.win_amount,
                        total: finalData.win_amount,
                        amount_type: finalData.amount_type,
                        min_position: 0,
                        max_position: 1,
                    });
                    winners = 1;
                }
                const redisKey = `match:${matchkey}:user:${req.user._id}:teams`;
                let existingTeams = await redisjoinTeams.getkeydata(redisKey) || [];

                if (!existingTeams || !existingTeams.length || existingTeams.length === 0) {
                    // existingTeams = await this.setTeamsInRedis(req.user._id, matchkey);
                    existingTeams = [];
                }
                let keyLeaderBoard = `match:${matchkey}:challenge:${req.query.matchchallengeid}:user:${req.user._id}:userLeaderBoard`;

                // Await to get total joined contests per challenge
                let total_joinedcontest = await getMyLeaderBoard(keyLeaderBoard, req.user._id);
                let isselected = false;
                if (total_joinedcontest.length > 0) {
                    if (finalData.multi_entry == 1 && total_joinedcontest.length < finalData.team_limit) {
                        if (finalData.contest_type == 'Amount') {
                            isselected = total_joinedcontest.length == finalData.team_limit || finalData.joinedusers == finalData.maximum_user;
                        } else if (finalData.contest_type == 'Percentage') {
                            isselected = total_joinedcontest.length == finalData.team_limit;
                        } else {
                            isselected = false;
                        }
                    } else {
                        isselected = true;
                    }
                }
                let team_limits;
                if (finalData.multi_entry == 0) {
                    team_limits = 1
                } else {
                    team_limits = finalData.team_limit
                }
                if (finalData?._id == "682ddf0e9b3854131286a5be") {
                    var joinedusers = Number(finalData?.joinedusers) + 20000;
                } else {
                    var joinedusers = Number(finalData?.joinedusers);
                }
                let finalData2 = {
                    _id: finalData?._id,
                    matchchallengeid: finalData?._id,
                    contest_name: finalData?.contest_name || '',
                    fantasyType: finalData?.fantasy_type || 'cricket',
                    subTitle: "",
                    createdAt: '2025-04-09T14:19:52.702Z',
                    updatedAt: '2025-04-09T14:19:52.702Z',
                    contestType: finalData?.contest_type,
                    isPromoCodeContest: finalData?.is_PromoCode_Contest,
                    challengeId: finalData?.challenge_id,
                    matchkey: matchkey,
                    entryfee: finalData?.entryfee,
                    winAmount: finalData?.win_amount,
                    maximumUser: finalData?.maximum_user,
                    joinedusers: joinedusers,
                    contest_type: finalData?.c_type,
                    winningPercentage: finalData?.winning_percentage,
                    isBonus: finalData?.is_bonus,
                    bonusPercentage: finalData?.bonus_percentage,
                    confirmedChallenge: finalData?.confirmed_challenge,
                    multiEntry: finalData?.multi_entry,
                    teamLimit: team_limits,
                    isPrivate: finalData?.is_private || 0,
                    discountFee: finalData?.discount_fee,
                    isselected: isselected,
                    refercode: total_joinedcontest?.[0]?.refercode,
                    totalJoinedcontest: 0,
                    totalTeams: existingTeams.length,
                    totalwinners: winners === 0 ? 1 : winners,
                    flexibleContest: finalData?.flexible_contest,
                    conditionalContest: finalData?.conditional_contest,
                    mandatoryContest: finalData?.mandatoryContest,
                    textNote: finalData?.textNote,
                    matchpricecard: price_card,
                    pricecard_type: finalData?.pricecard_type,
                    extrapricecard: finalData?.extrapricecard
                }
                // finalData.matchpricecard = price_card
                // console.log('finalData', JSON.stringify(finalData2));
                return {
                    message: "Match Challenge Data ..!",
                    status: true,
                    data: finalData2
                }
            }
            return {
                message: "Match Challenge No Data ..!",
                status: false,
                data: []
            }

        } catch (error) {
            throw error;
        }
    }
    async getJoinleague(userId, matchkey) {
        const total_joinedcontestData = await userLeagueModel.aggregate([
            {
                $match: {
                    userid: mongoose.Types.ObjectId(userId),
                    matchkey: mongoose.Types.ObjectId(matchkey)
                }
            },
            {
                $group: {
                    _id: "$challengeid",
                }
            }, {
                $count: "total_count"
            }
        ])
        return total_joinedcontestData[0]?.total_count;
    }
    /**
     * @function joinContest
     * @description Contest Joining
     * @param { matchkey,challengeid,teamid }
     * @author 
     */


    async deductBalanceForChallenge(challengeDetails, userBalances, count) {
        try {
            let { bonus, winning, balance } = userBalances;
            let totalBonusUsed = 0;
            let totalWinningUsed = 0;
            let totalBalanceUsed = 0;

            // for (let i = 0; i < count; i++) {
            //     const totalChallengeBonus = (challengeDetails.bonus_percentage / 100) * challengeDetails.entryfee;
            //     let bonusUseAmount = 0;

            //     if (bonus >= totalChallengeBonus) {
            //         bonusUseAmount = totalChallengeBonus;
            //         bonus -= totalChallengeBonus;
            //     } else {
            //         bonusUseAmount = bonus;
            //         bonus = 0;
            //     }

            //     let remainingFee = challengeDetails.entryfee - bonusUseAmount;
            //     let winningUseAmount = 0;
            //     if (remainingFee > 0 && winning >= remainingFee) {
            //         winningUseAmount = remainingFee;
            //         winning -= remainingFee;
            //         remainingFee = 0;
            //     } else if (remainingFee > 0) {
            //         winningUseAmount = winning;
            //         remainingFee -= winning;
            //         winning = 0;
            //     }


            //     let balanceUseAmount = 0;
            //     if (remainingFee > 0 && balance >= remainingFee) {
            //         balanceUseAmount = remainingFee;
            //         balance -= remainingFee;
            //         remainingFee = 0;
            //     } else if (remainingFee > 0) {
            //         return {
            //             status: i > 0 ? true : false,
            //             finalBalances: { bonus, winning, balance },
            //             finalUsedBalances: {
            //                 bonusUsed: totalBonusUsed,
            //                 winningUsed: totalWinningUsed,
            //                 balanceUsed: totalBalanceUsed,
            //             },
            //             count: i,
            //         };
            //     }

            //     totalBonusUsed += bonusUseAmount;
            //     totalWinningUsed += winningUseAmount;
            //     totalBalanceUsed += balanceUseAmount;
            // }

            for (let i = 0; i < count; i++) {
                const totalChallengeBonus = (challengeDetails.bonus_percentage / 100) * challengeDetails.entryfee;
                let bonusUseAmount = 0;


                if (bonus >= totalChallengeBonus) {
                    bonusUseAmount = totalChallengeBonus;
                    bonus -= totalChallengeBonus;
                } else {
                    bonusUseAmount = bonus;
                    bonus = 0;
                }

                let remainingFee = challengeDetails.entryfee - bonusUseAmount;
                let balanceUseAmount = 0;


                if (remainingFee > 0 && balance >= remainingFee) {
                    balanceUseAmount = remainingFee;
                    balance -= remainingFee;
                    remainingFee = 0;
                } else if (remainingFee > 0) {
                    balanceUseAmount = balance;
                    remainingFee -= balance;
                    balance = 0;
                }

                let winningUseAmount = 0;

                if (remainingFee > 0 && winning >= remainingFee) {
                    winningUseAmount = remainingFee;
                    winning -= remainingFee;
                    remainingFee = 0;
                } else if (remainingFee > 0) {
                    winningUseAmount = winning;
                    remainingFee -= winning;
                    winning = 0;
                }


                if (remainingFee > 0) {
                    return {
                        status: i > 0 ? true : false,
                        finalBalances: { bonus, winning, balance },
                        finalUsedBalances: {
                            bonusUsed: totalBonusUsed,
                            winningUsed: totalWinningUsed,
                            balanceUsed: totalBalanceUsed,
                        },
                        count: i,
                    };
                }

                totalBonusUsed += bonusUseAmount;
                totalBalanceUsed += balanceUseAmount;
                totalWinningUsed += winningUseAmount;
            }



            return {
                status: true,
                finalBalances: { bonus, winning, balance },
                finalUsedBalances: {
                    bonusUsed: totalBonusUsed,
                    winningUsed: totalWinningUsed,
                    balanceUsed: totalBalanceUsed,
                },
                count,
            };
        } catch (e) {
            console.log(e)
        }
    }



    // async joinContest(req) {
    //     try {
    //         const { matchchallengeid, jointeamid, discount_fee } = req.body;
    //         const userId = req.user._id;
    //         let totalchallenges = 0,
    //             totalmatches = 0,
    //             totalseries = 0,
    //             joinedTeams = 0,
    //             aggpipe = [];

    //         aggpipe.push(
    //             { $match: { _id: mongoose.Types.ObjectId(matchchallengeid), } },
    //             {
    //                 $addFields: {
    //                     entryfee: { $subtract: ['$entryfee', '$discount_fee'] },
    //                 },
    //             },
    //             {
    //                 $lookup: {
    //                     from: 'listmatches',
    //                     localField: 'matchkey',
    //                     foreignField: '_id',
    //                     as: 'listmatch',
    //                 },
    //             }
    //         );

    //         const matchchallengesData = await matchContestModel.aggregate(aggpipe);

    //         if (!matchchallengesData.length) {
    //             return {
    //                 message: 'Match  callenge Not Found',
    //                 status: false,
    //                 data: {}
    //             };
    //         }

    //         const [matchchallenge] = matchchallengesData;
    //         if (matchchallenge.status == 'closed') {
    //             return {
    //                 message: 'Match callenge has been closed',
    //                 status: false,
    //                 data: {}
    //             };
    //         }

    //         const { _id: matchchallengesDataId, listmatch, multi_entry, entryfee } = matchchallenge;
    //         const [{ _id: listmatchId, series: seriesId, start_date: matchStartDate }] = listmatch;


    //         // const matchTime = await this.getMatchTime(matchStartDate);
    //         const matchTime = await matchServices.getMatchTime(matchStartDate);

    //         if (!matchTime) {
    //             return {
    //                 message: 'Match has been closed, You cannot join league now.',
    //                 status: false,
    //                 data: {}
    //             };
    //         }

    //         const jointeamids = jointeamid.split(',');


    //         const [validTeamsCount, joinedLeauges, user] = await Promise.all([
    //             userTeamModel.find({ _id: { $in: jointeamids } }),
    //             userLeagueModel.find({
    //                 matchkey: listmatchId,
    //                 challengeid: matchchallenge._id,
    //                 userid: userId,
    //             }),
    //             userModel.findOne({ _id: userId }).select('userbalance user_verify team')
    //             // getUserData(userId)
    //         ]);

    //         if (validTeamsCount.length !== jointeamids.length) {
    //             return {
    //                 message: 'Invalid Team',
    //                 status: false,
    //                 data: {}
    //             };
    //         }

    //         if (jointeamids.length == 1 && joinedLeauges.length == 1 && jointeamid === joinedLeauges[0]?.teamid.toString()) {
    //             return {
    //                 message: 'Contest Already joined',
    //                 status: false,
    //                 data: {}
    //             };
    //         }


    //         if (multi_entry === 0) {

    //             if (joinedLeauges.length > 0 || jointeamids.length > 1) {
    //                 return {
    //                     message: 'Contest Already joined or You can only join once.',
    //                     status: false,
    //                     data: {}
    //                 };
    //             }
    //         } else {

    //             if (joinedLeauges.length >= matchchallenge.team_limit) {
    //                 return {
    //                     message: 'You cannot join with more teams now.',
    //                     status: false,
    //                     data: {}
    //                 };
    //             }
    //         }

    //         if (!user?.userbalance) {
    //             return { message: 'Insufficient balance', status: false, data: {} };
    //         }

    //         const challengeCounterKey = `match:${listmatchId}:challenge:${matchchallengeid}:joinedTeams`;
    //         const userChallengeCounterKey = `match:${listmatchId}:challenge:${matchchallengeid}:user:${userId}:joinedTeams`;

    //         const parseBalance = (value) => parseFloat(value.toFixed(2));
    //         let { bonus, balance, winning, extraCash } = user?.userbalance;
    //         const totalBalance = parseBalance(bonus) + parseBalance(balance) + parseBalance(winning) + parseBalance(extraCash);
    //         let tranid = '';
    //         let mainbal = 0, mainbonus = 0, mainwin = 0;

    //         const updateUserBalance = async (userId, balance, bonus, extraCash, winning, increment = {}) => {
    //             const userObj = {
    //                 'userbalance.balance': balance,
    //                 'userbalance.bonus': bonus,
    //                 'userbalance.extraCash': extraCash,
    //                 'userbalance.winning': winning,
    //                 $inc: increment,
    //             };
    //             await userModel.findOneAndUpdate({ _id: userId }, userObj, { new: true });

    //             const redisKey = `user:${userId}`;
    //             const redisUserObj = {
    //                 userbalance: {
    //                     balance,
    //                     bonus,
    //                     extraCash,
    //                     winning,
    //                 },
    //                 user_verify: user?.user_verify || null,
    //                 team: user?.team || ""
    //             };

    //             setkeydata(redisKey, redisUserObj, 60 * 60 * 12);
    //             // const userObj = {
    //             //     'userbalance.balance': balance,
    //             //     'userbalance.bonus': bonus,
    //             //     'userbalance.extraCash': extraCash,
    //             //     'userbalance.winning': winning,
    //             //     $inc: increment,
    //             // };
    //             // const msg = {
    //             //     filter: { _id: userId },
    //             //     payload: userObj,
    //             //     modelName: "user"
    //             // }
    //             // sendToQueue('updateQueue', msg);
    //         };

    //         const createTransaction = async (userId, entryfee, totalBalance, matchchallengeid, balances, tranid, count) => {


    //             const transactionData = {
    //                 type: 'Contest Joining Fee',
    //                 contestdetail: `${entryfee}-${count}`,
    //                 amount: entryfee * count,
    //                 total_available_amt: totalBalance - entryfee * count,
    //                 transaction_by: global.constant.TRANSACTION_BY.WALLET,
    //                 challengeid: matchchallengeid,
    //                 userid: userId,
    //                 paymentstatus: global.constant.PAYMENT_STATUS_TYPES.CONFIRMED,
    //                 bal_bonus_amt: balances.bonus,
    //                 bal_win_amt: balances.winning,
    //                 bal_fund_amt: balances.balance,
    //                 extra_fund_amt: balances?.extraCash || 0,
    //                 cons_amount: mainbal,
    //                 cons_bonus: mainbonus,
    //                 cons_win: mainwin,
    //                 transaction_id: tranid,
    //             };

    //             await TransactionModel.create(transactionData);

    //             // const transactionData = {
    //             //     type: 'Contest Joining Fee',
    //             //     contestdetail: `${entryfee}-${count}`,
    //             //     amount: entryfee * count,
    //             //     total_available_amt: totalBalance - entryfee * count,
    //             //     transaction_by: constant.TRANSACTION_BY.WALLET,
    //             //     challengeid: matchchallengeid,
    //             //     userid: userId,
    //             //     paymentstatus: constant.PAYMENT_STATUS_TYPES.CONFIRMED,
    //             //     bal_bonus_amt: balances.bonus,
    //             //     bal_win_amt: balances.winning,
    //             //     bal_fund_amt: balances.balance,
    //             //     extra_fund_amt: balances?.extraCash || 0,
    //             //     cons_amount: balances.mainbal,
    //             //     cons_bonus: balances.mainbonus,
    //             //     cons_win: balances.mainwin,
    //             //     transaction_id: tranid,
    //             // };
    //             // const msg = {
    //             //     payload: transactionData,
    //             //     modelName: "transaction"
    //             // }
    //             // sendToQueue('createQueue', msg);
    //         };


    //         const randomStr = randomstring.generate({ charset: 'alphanumeric', length: 4, });
    //         tranid = `${global.constant.APP_SHORT_NAME}-${Date.now()}-${randomStr}`;
    //         const coupon = randomstring.generate({ charset: 'alphanumeric', length: 4, });
    //         let referCode = `${global.constant.APP_SHORT_NAME}-${Date.now()}${coupon}`;
    //         let shouldBreakLoop = false;


    //         // const results = await userLeagueModel.find({
    //         //     userid: userId,
    //         //     $or: [
    //         //         { seriesid: seriesId },
    //         //         { listmatchId: listmatchId },
    //         //         { challengeid: matchchallengeid }
    //         //     ]
    //         // }).lean();
    //         // const isSeriesJoined = results.some(result => result.seriesid.toString() === seriesId.toString());
    //         // const isMatchJoined = results.some(result => result?.matchkey.toString() === listmatchId.toString());
    //         // const isChallengeJoined = results.some(result => result.challengeid.toString() === matchchallengeid.toString());

    //         for (const jointeam of validTeamsCount) {

    //             const [currentChallengeCount, currentUserCount] = await Promise.all([
    //                 redis.get(challengeCounterKey),
    //                 redis.get(userChallengeCounterKey)
    //             ]);

    //             const challengeMaxTeamCount = parseInt(currentChallengeCount || '0');
    //             const userTeamCount = parseInt(currentUserCount || '0');
    //             if (multi_entry > 0 && userTeamCount >= matchchallenge.team_limit) {
    //                 break;
    //             }

    //             const isTeamJoined = joinedLeauges.some(item => item.teamid.toString() == jointeam._id);
    //             if (!isTeamJoined) {
    //                 if (matchchallenge.contest_type == 'Amount' && challengeMaxTeamCount >= matchchallenge.maximum_user) {
    //                     // totalchallenges = (!isChallengeJoined && joinedTeams > 0) ? 1 : 0;
    //                     // totalmatches = (!isMatchJoined && joinedTeams > 0) ? 1 : 0;
    //                     // totalseries = (!isSeriesJoined && joinedTeams > 0) ? 1 : 0;

    //                     totalchallenges = 0;
    //                     totalmatches = 0;
    //                     totalseries = 0;
    //                     await Promise.all([
    //                         createTransaction(userId, entryfee, totalBalance, matchchallengeid, { bonus, balance, winning }, tranid, joinedTeams),
    //                         updateUserBalance(userId, balance, bonus, extraCash, winning, { totalchallenges, totalmatches, totalseries }),
    //                         matchContestModel.findOneAndUpdate({ _id: mongoose.Types.ObjectId(matchchallengeid) }, { status: 'closed' }, { new: true })
    //                     ]);
    //                     shouldBreakLoop = true;
    //                     break;
    //                 }

    //                 const { status, finalBalances, finalUsedBalances, count: successfulChallenges } = await this.deductBalanceForChallenge(
    //                     matchchallenge,
    //                     { bonus, balance, winning },
    //                     1
    //                 );

    //                 if (joinedTeams == 0 && !status) {
    //                     return { message: 'Insufficient balance', status: false, data: {} };
    //                 }

    //                 mainbal += finalUsedBalances?.balanceUsed || 0;
    //                 mainbonus += finalUsedBalances?.bonusUsed || 0;
    //                 mainwin += finalUsedBalances?.winningUsed || 0;

    //                 bonus = finalBalances?.bonus || 0;
    //                 balance = finalBalances?.balance || 0;
    //                 winning = finalBalances?.winning || 0;
    //                 if (status && successfulChallenges > 0) {
    //                     await redis.incr(challengeCounterKey);
    //                     await redis.incr(userChallengeCounterKey);

    //                     const joinLeaugeResult = await userLeagueModel.create({
    //                         userid: req.user._id,
    //                         challengeid: matchchallengesDataId,
    //                         teamid: jointeam._id,
    //                         matchkey: listmatchId,
    //                         seriesid: seriesId,
    //                         transaction_id: tranid,
    //                         refercode: referCode,
    //                         teamnumber: jointeam.teamnumber,
    //                         leaugestransaction: {
    //                             user_id: userId,
    //                             bonus: finalUsedBalances?.bonusUsed || 0,
    //                             balance: finalUsedBalances?.balanceUsed || 0,
    //                             winning: finalUsedBalances?.winningUsed || 0
    //                         },
    //                         userData: {
    //                             userId: req.user._id,
    //                             image: "",
    //                             team: req.user.user_team,
    //                         },
    //                         matchData: {
    //                             matchkey: matchchallenge.matchData.matchkey,
    //                             realMatchkey: matchchallenge.matchData.realMatchkey,
    //                             startDate: matchchallenge.matchData.startDate,
    //                             status: "",
    //                         }
    //                     });

    //                     const userLeaderBoard = await userLeaderBoardModel.create({
    //                         userId: req.user._id,
    //                         challengeid: matchchallengesDataId,
    //                         teamId: jointeam._id,
    //                         matchkey: listmatchId,
    //                         user_team: user.team,
    //                         teamnumber: jointeam.teamnumber,
    //                         captain: jointeam.captain,
    //                         vicecaptain: jointeam.vicecaptain,
    //                         playersData: jointeam.players,
    //                         joinId: joinLeaugeResult._id,
    //                         contest_winning_type: matchchallenge.amount_type,
    //                         joinNumber: challengeMaxTeamCount,
    //                         userData: {
    //                             userId: req.user._id,
    //                             image: "",
    //                             team: req.user.user_team,
    //                         },
    //                         matchData: {
    //                             matchkey: matchchallenge.matchData.matchkey,
    //                             realMatchkey: matchchallenge.matchData.realMatchkey,
    //                             startDate: matchchallenge.matchData.startDate,
    //                             status: "",
    //                         }
    //                     });
    //                     let redisLeaderboard = {
    //                         "_id": `${userLeaderBoard._id.toString()}`,
    //                         "getcurrentrank": challengeMaxTeamCount,
    //                         "usernumber": 0,
    //                         "joinleaugeid": joinLeaugeResult._id,
    //                         "joinTeamNumber": jointeam.teamnumber,
    //                         "jointeamid": jointeam._id,
    //                         "userid": req.user._id,
    //                         "team": user.team,
    //                         "image": `${global.constant.IMAGE_URL}team_image.png`,
    //                         "teamnumber": jointeam.teamnumber
    //                     }

    //                     const msg = {
    //                         leagueData: {
    //                             userid: req.user._id,
    //                             challengeid: matchchallengesDataId,
    //                             teamid: jointeam._id,
    //                             matchkey: listmatchId,
    //                             seriesid: seriesId,
    //                             transaction_id: tranid,
    //                             refercode: referCode,
    //                             teamnumber: jointeam.teamnumber,
    //                             leaugestransaction: {
    //                                 user_id: userId,
    //                                 bonus: finalUsedBalances?.bonusUsed || 0,
    //                                 balance: finalUsedBalances?.balanceUsed || 0,
    //                                 winning: finalUsedBalances?.winningUsed || 0
    //                             }
    //                         },
    //                         leaderBoardData: {
    //                             userId: req.user._id,
    //                             challengeid: matchchallengesDataId,
    //                             teamId: jointeam._id,
    //                             matchkey: listmatchId,
    //                             user_team: user.team,
    //                             teamnumber: jointeam.teamnumber,
    //                             captain: jointeam.captain,
    //                             vicecaptain: jointeam.vicecaptain,
    //                             playersData: jointeam.players,
    //                             // joinId: joinLeaugeResult._id,
    //                             contest_winning_type: matchchallenge.amount_type,
    //                             joinNumber: challengeMaxTeamCount
    //                         },
    //                         matchchallengeid,
    //                         userId,
    //                         listmatchId,
    //                         redisLeaderboard
    //                     }

    //                     let keyChallengeLeaderBoard = `match:${listmatchId}:challenge:${matchchallengeid}:challengeLeaderBoard`;
    //                     await storeSortedSet(keyChallengeLeaderBoard, redisLeaderboard, 60 * 60 * 48);
    //                     redisLeaderboard._id = `${userLeaderBoard._id.toString()}-${userId}`;
    //                     let keyLeaderBoard = `match:${listmatchId}:challenge:${matchchallengeid}:user:${userId}:userLeaderBoard`;
    //                     await storeSortedSet(keyLeaderBoard, redisLeaderboard, 60 * 60 * 48);

    //                     // sendToQueue('createLeaderBoard', msg);
    //                     // userLeaderBoardArr.push(redisLeaderboard);
    //                     joinedTeams++;
    //                 }
    //             }
    //         }


    //         if (shouldBreakLoop) {
    //             return { message: 'League is Closed', status: false, data: {} };
    //         }

    //         totalchallenges = 0;
    //         totalmatches = 0;
    //         totalseries = 0;

    //         const totalChallengeJoined = await redis.get(challengeCounterKey);

    //         await Promise.all([
    //             matchContestModel.findOneAndUpdate({ _id: mongoose.Types.ObjectId(matchchallengeid) }, { joinedusers: totalChallengeJoined }),
    //             createTransaction(userId, entryfee, totalBalance, matchchallengeid, { bonus, balance, winning }, tranid, joinedTeams),
    //             updateUserBalance(userId, balance, bonus, extraCash, winning, { totalchallenges, totalmatches, totalseries })
    //         ]);
    //         // sendToQueue('createQueue', { payload: { title: `Contest Joined`, userid: userId }, modelName: "notification" }),
    //         // sendToQueue('updateQueue', {
    //         //     filter: { _id: matchchallengeid },
    //         //     payload: { joinedusers: totalChallengeJoined },
    //         //     modelName: "matchchallenge"
    //         // })

    //         return {
    //             message: 'Contest Joined',
    //             status: true,
    //             data: {
    //                 joinedusers: totalChallengeJoined,
    //                 referCode: referCode
    //             }
    //         };

    //     } catch (e) {
    //         console.log(e)
    //         throw e;
    //     }
    // }






    /**
     * @function findJoinLeaugeExist
     * @description Find Join League Exist
     * @param { matchkey, userId, teamId, challengeDetails }
     * @author 
     */
    async findJoinLeaugeExist(matchkey, userId, teamId, challengeDetails) {
        if (!challengeDetails || challengeDetails == null || challengeDetails == undefined) return 4;

        const joinedLeauges = await userLeagueModel.find({
            matchkey: matchkey,
            challengeid: challengeDetails._id,
            userid: userId,
        });
        if (joinedLeauges.length == 0) return 1;
        if (joinedLeauges.length > 0) {
            if (challengeDetails.multi_entry == 0) {
                return { message: 'Contest Already joined', status: false, data: {} };
            } else {
                if (joinedLeauges.length >= challengeDetails.team_limit) {
                    return { message: 'You cannot join with more teams now.', status: false, data: {} };
                } else {
                    const joinedLeaugesCount = joinedLeauges.filter(item => {
                        return item.teamid.toString() === teamId;
                    });
                    if (joinedLeaugesCount.length) return { message: 'Team already joined', status: false, data: {} };
                    else return 2;
                }
            }
        }
    }

    /**
     * @function findUsableBonusMoney
     * @description Join League bouns amount use
     * @param { challengeDetails, bonus, winning, balance }
     * @author 
     */
    async findUsableBonusMoney(challengeDetails, bonus, winning, balance) {
        if (challengeDetails.is_private == 1 && challengeDetails.is_bonus != 1)
            return { bonus: bonus, cons_bonus: 0, reminingfee: challengeDetails.entryfee };
        let totalChallengeBonus = 0;
        totalChallengeBonus = (challengeDetails.bonus_percentage / 100) * challengeDetails.entryfee;

        const finduserbonus = bonus;
        let findUsableBalance = winning + balance;
        let bonusUseAmount = 0;
        if (finduserbonus >= totalChallengeBonus)
            (findUsableBalance += totalChallengeBonus), (bonusUseAmount = totalChallengeBonus);
        else findUsableBalance += bonusUseAmount = finduserbonus;
        if (findUsableBalance < challengeDetails.entryfee) return false;
        if (bonusUseAmount >= challengeDetails.entryfee) {
            return {
                bonus: finduserbonus - challengeDetails.entryfee,
                cons_bonus: challengeDetails.entryfee || 0,
                reminingfee: 0,
            };
        } else {
            return {
                bonus: finduserbonus - bonusUseAmount,
                cons_bonus: bonusUseAmount,
                reminingfee: challengeDetails.entryfee - bonusUseAmount,
            };
        }
    }

    /**
     * @function findUsableBalanceMoney
     * @description Join League balance amount use
     * @param { resultForBonus,balance }
     * @author 
     */
    async findUsableBalanceMoney(resultForBonus, balance) {
        if (balance >= resultForBonus.reminingfee)
            return {
                balance: balance - resultForBonus.reminingfee,
                cons_amount: resultForBonus.reminingfee,
                reminingfee: 0,
            };
        else
            return { balance: 0, cons_amount: balance, reminingfee: resultForBonus.reminingfee - balance };
    }

    /**
     * @function findUsableWinningMoney
     * @description Join League winning amount use
     * @param { resultforbalance,winning }
     * @author 
     */
    async findUsableWinningMoney(resultForBalance, winning) {
        if (winning >= resultForBalance.reminingfee) {
            return {
                winning: winning - resultForBalance.reminingfee,
                cons_win: resultForBalance.reminingfee,
                reminingfee: 0,
            };
        } else { return { winning: 0, cons_win: winning, reminingfee: resultForBalance.reminingfee - winning }; }
    }

    /**
     * @function myJoinedContests
     * @description Contest Joining
     * @param { matchkey }
     * @author 
     */
    async oldMyJoinedContests(req) {
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
                    let: { joinIds: "$jointeams.teamId" },
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

            let total_joined_contests = await (await userLeagueModel.aggregate(aggPipe)).length;
            aggPipe.push({
                $facet: {
                    data: [{ $skip: skip }, { $limit: limit }]
                }
            });
            // console.log(JSON.stringify(aggPipe), "---------------------")
            const JoinContestData = await userLeagueModel.aggregate(aggPipe);

            console.log("JoinContestData---->>", JoinContestData[0].data);

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


            let aggPipe = [];
            aggPipe.push(
                {

                    $match: {
                        matchkey: mongoose.Types.ObjectId(matchkey),
                        userid: mongoose.Types.ObjectId(userId),
                    }
                },
                {
                    sort: {
                        challengeid: -1
                    }
                },
                {
                    $group: {
                        _id: '$challengeid',
                        joinedleaugeId: { $first: '$_id' },
                        matchkey: { $first: '$matchkey' },
                        jointeamid: { $first: '$teamid' },
                        userid: { $first: '$userid' },
                        createdAt: { $first: "$createdAt" }
                    },
                },
                {
                    $lookup: {
                        from: 'matchcontest',
                        localField: '_id',
                        foreignField: '_id',
                        pipeline: [
                            {
                                $match: {
                                    status: { $in: ["opened", 'closed'] }
                                }
                            }
                        ],
                        as: 'matchchallenge'
                    }
                },
                {
                    $unwind: {
                        path: "$matchchallenge"
                    }
                },
                {
                    $addFields: { "matchchallengestatus": "$matchchallenge.status" }
                }

            );

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
            },
                {
                    $sort: {
                        'win_amount': -1,
                    }
                },
                {
                    $lookup: {
                        from: "matches",
                        localField: "matchkey",
                        foreignField: "_id",
                        pipeline: [
                            {
                                $project: {
                                    final_status: 1
                                }
                            }
                        ],
                        as: "listmatch",
                    }
                },
                {
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
                        matchpricecards: "$matchchallenge.matchpricecards",
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
                        is_PromoCode_Contest: "$matchchallenge.is_PromoCode_Contest"
                    }
                },
                {
                    $sort: {
                        createdAt: 1,
                    },
                }
            );

            aggPipe.push(
                {
                    $addFields: {
                        winning_percentage: {
                            $round: [
                                {
                                    $multiply: [
                                        {
                                            $divide: [
                                                {
                                                    $toInt: {
                                                        $ifNull: [
                                                            { $arrayElemAt: ["$matchpricecards.max_position", -1] },
                                                            1
                                                        ]
                                                    }
                                                },
                                                "$maximum_user"
                                            ]
                                        },
                                        100
                                    ]
                                },
                                0
                            ]
                        }
                    }
                },
                {
                    $facet: {
                        data: [{ $skip: skip }, { $limit: limit }]
                    }
                }
            );
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
                        pipeline: [
                            {
                                $match: {
                                    status: {
                                        $ne: "canceled"
                                    }
                                }
                            }
                        ],
                        as: "matchchallenge"
                    }
                },
                {
                    $unwind: {
                        path: "$matchchallenge"
                    }
                },
                {
                    $addFields: {
                        matchchallengestatus:
                            "$matchchallenge.status"
                    }
                },
                // {
                //   $lookup: {
                //     from: "joinedleauges",
                //     let: {
                //       matchchallengeid: "$matchchallenge._id"
                //     },
                //     pipeline: [
                //       {
                //         $match: {
                //           $expr: {
                //             $eq: [
                //               "$challengeid",
                //               "$$matchchallengeid"
                //             ]
                //           }
                //         }
                //       },
                //       {
                //         $lookup: {
                //           from: "leaderboards",
                //           let: {
                //             joinid: "$_id"
                //           },
                //           pipeline: [
                //             {
                //               $match: {
                //                 $expr: {
                //                   $eq: ["$joinId", "$$joinid"]
                //                 }
                //               }
                //             },
                //             {
                //               $lookup: {
                //                 from: "finalresults",
                //                 pipeline: [
                //                   {
                //                     $match: {
                //                       $expr: {
                //                         $eq: [
                //                           "$joinedid",
                //                           "$$joinid"
                //                         ]
                //                       }
                //                     }
                //                   }
                //                 ],
                //                 as: "winnerD"
                //               }
                //             },
                //             {
                //               $addFields: {
                //                 amount: {
                //                   $ifNull: [
                //                     {
                //                       $first: "$winnerD.amount"
                //                     },
                //                     0
                //                   ]
                //                 }
                //               }
                //             }
                //           ],
                //           as: "jointeam"
                //         }
                //       },
                //       {
                //         $unwind: {
                //           path: "$jointeam",
                //           preserveNullAndEmptyArrays: true
                //         }
                //       },
                //       {
                //         $sort: {
                //           "jointeam.rank": 1
                //         }
                //       }
                //     ],
                //     as: "jointeamids"
                //   }
                // }
                {
                    $lookup: {
                        from: "resultsummary",
                        let: {
                            matchchallengeid: "$matchchallenge._id"
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            {
                                                $eq: [
                                                    "$$matchchallengeid",
                                                    "$challengeid"
                                                ]
                                            },
                                            {
                                                $eq: [
                                                    "$userid", mongoose.Types.ObjectId(req.user._id)
                                                ]
                                            }
                                        ]
                                    }
                                }
                            },
                            {
                                $group: {
                                    _id: null,
                                    amount: {
                                        $sum: "$amount"
                                    }
                                }
                            }
                        ],
                        as: "finalresults"
                    }
                },
                {
                    $sort: {
                        win_amount: -1
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
                        finalresultsAmount: {
                            $ifNull: [
                                {
                                    $arrayElemAt: [
                                        "$finalresults.amount",
                                        0
                                    ]
                                },
                                0
                            ]
                        },
                        amount_type: {
                            $ifNull: [
                                "$matchchallenge.amount_type",
                                ""
                            ]
                        },
                        is_PromoCode_Contest:
                            "$matchchallenge.is_PromoCode_Contest"
                    }
                },
                // {
                //   $lookup: {
                //     from: "jointeams",
                //     let: {
                //       joinIds: "$jointeams.teamId"
                //     },
                //     pipeline: [
                //       {
                //         $match: {
                //           $expr: {
                //             $in: ["$_id", "$$joinIds"]
                //           }
                //         }
                //       },
                //       {
                //         $lookup: {
                //           from: "players",
                //           localField: "captain",
                //           foreignField: "_id",
                //           as: "cap"
                //         }
                //       },
                //       {
                //         $lookup: {
                //           from: "players",
                //           localField: "vicecaptain",
                //           foreignField: "_id",
                //           as: "vice"
                //         }
                //       },
                //       {
                //         $unwind: {
                //           path: "$cap"
                //         }
                //       },
                //       {
                //         $unwind: {
                //           path: "$vice"
                //         }
                //       },
                //       {
                //         $project: {
                //           teamId: "$_id",
                //           captain: "$cap.player_name",
                //           vicecaptain: "$vice.player_name",
                //           points: "$points",
                //           teamnumber: "$teamnumber"
                //         }
                //       }
                //     ],
                //     as: "userTeams"
                //   }
                // }
                {
                    $sort: {
                        createdAt: 1
                    }
                },
                {
                    $addFields: {
                        winning_percentage: {
                            $round: [
                                {
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
                                                            },
                                                            1
                                                        ]
                                                    }
                                                },
                                                "$maximum_user"
                                            ]
                                        },
                                        100
                                    ]
                                },
                                0
                            ]
                        }
                    }
                }
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
                    isPromoCodeContest: challanges.is_PromoCode_Contest
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
                finalData.push(JSON.parse(JSON.stringify(tmpObj)));

            }

            // const postKey = `match:${matchkey}:user:${userId}:userJoinedContests`;
            // await Redis.setkeydata(postKey, finalData, 60 * 60 * 48);

            return {
                message: 'Join Contest Data...!',
                status: true,
                data: finalData,
                total_joined_contests
            };

        } catch (error) {
            console.log("Error: ", error);
        }
    }

    /**
     * @function getUserRank
     * @description Find rank for user
     * @param { rankArray }
     * @author 
     */
    async getUserRank(rankArray) {
        //console.log("rankArray",rankArray)
        // if (rankArray.length == 0) return [];
        // let lrsno = 0,
        //     uplus = 0,
        //     sno = 0;
        // const getUserRank = [];
        // for await (const rankData of rankArray) {
        //     const found = getUserRank.some((ele) => { 
        //         //console.log("ele",ele.points,"rankData.points",rankData.points,"==",ele.points == rankData.points)
        //         ele.points == rankData.points });
        //     //console.log("found",found)
        //     if (found) {
        //         console.log("a")
        //         uplus++;
        //     } else {
        //         console.log("b")
        //         lrsno++;
        //         //console.log("lrsno",lrsno,"uplus",uplus)
        //         lrsno = lrsno + uplus;

        //         uplus = 0;
        //     }
        //     //console.log("--->",lrsno)
        //     getUserRank.push({
        //         rank: lrsno,
        //         points: rankData.points,
        //         userid: rankData.userid,
        //         userjoinedleaugeId: rankData.userjoinedleaugeId,
        //         userTeamNumber: rankData.userTeamNumber,
        //     });
        //     sno++;
        //     if (sno == rankArray.length) {
        //         return getUserRank;
        //     }
        // }
        // rank code
        if (rankArray.length == 0) return [];
        let lrsno = 0,
            uplus = 0,
            sno = 0;
        const getUserRank = [];
        for await (const rankData of rankArray) {
            const found = getUserRank.some((ele) => {
                return ele.points == rankData.points && ele.rank <= lrsno;
            });
            if (found) {
                //console.log("a");
                uplus++;
            } else {
                //console.log("b");
                lrsno++;
                lrsno = lrsno + uplus;
                uplus = 0;
            }
            getUserRank.push({
                rank: lrsno,
                points: rankData.points,
                userid: rankData.userid,
                userjoinedleaugeId: rankData.userjoinedleaugeId,
                userTeamNumber: rankData.userTeamNumber,
            });
            sno++;
            if (sno == rankArray.length) {
                return getUserRank;
            }
        }

        // rank code end
        return true;
    };
    /**
    * @function userLeaderboard
    * @description Get Contest LeaderBard
    * @param { matchkey }
    * @author 
    */
    async userSelfLeaderboard(req) {
        try {
            let skip = (req.query?.skip) ? Number(req.query.skip) : 0;
            let limit = (req.query?.limit) ? Number(req.query.limit) : 10;
            const { matchchallengeid, matchkey } = req.query;
            let userLeaderboard1 = [];
            if (!matchchallengeid) {
                return {
                    message: "No Contest LeaderBard",
                    status: false,
                    data: []
                }
            }
            let keyLeaderBoard = `match:${matchkey}:challenge:${matchchallengeid}:user:${req.user._id}:userLeaderBoard`;
            let userLeaderboard = await getMyLeaderBoard(keyLeaderBoard, req.user._id);

            if (userLeaderboard?.length > 0) {
                userLeaderboard1 = userLeaderboard;
            } else {
                // let aggPipe = [];
                // aggPipe.push({
                //     $match: {
                //         matchkey: mongoose.Types.ObjectId(matchkey),
                //         userId: mongoose.Types.ObjectId(req.user._id),
                //         challengeid: mongoose.Types.ObjectId(matchchallengeid)
                //     }
                // });
                // const joinData = await userLeaderBoardModel.aggregate(aggPipe);
                // if (joinData.length > 0) {
                //     let user = [];
                //     for (let join of joinData) {
                //         let redisLeaderboard = {
                //             "_id": `${join._id.toString()}-${req.user._id}`,
                //             "getcurrentrank": join?.joinNumber ? join.joinNumber : 11000,
                //             "usernumber": 0,
                //             "joinleaugeid": join.joinId,
                //             "joinTeamNumber": join.teamnumber,
                //             "jointeamid": join.teamId,
                //             "userid": req.user._id,
                //             "team": join.user_team,
                //             "image": `${global.constant.IMAGE_URL}team_image.png`,
                //             "teamnumber": join.teamnumber,
                //             "refercode": join.refercode
                //         }
                //         user.push(redisLeaderboard);
                //         let keyLeaderBoard = `match:${matchkey}:challenge:${matchchallengeid}:user:${req.user._id}:userLeaderBoard`;
                //         var expRedisTime = await matchTimeDifference(matchkey);
                //         await storeSortedSet(keyLeaderBoard, redisLeaderboard, expRedisTime);
                //     }
                //     userLeaderboard1 = user;
                // }
            }
            let total_joined_teams = 0;
            const challengeCounterKey = `match:${matchkey}:challenge:${matchchallengeid}:joinedTeams`;

            let totalJointeams = await redisjoinTeams.redis.get(challengeCounterKey);
            // console.log('totalJointeams', totalJointeams);
            // if (!totalJointeams) {
            //     total_joined_teams = await userLeagueModel.countDocuments({
            //         'matchkey': mongoose.Types.ObjectId(req.query.matchkey),
            //         'challengeid': mongoose.Types.ObjectId(req.query.matchchallengeid)
            //     });
            //     var expRedisTime = await matchTimeDifference(req.query.matchkey);
            //     await redisjoinTeams.redis.set(challengeCounterKey, total_joined_teams, expRedisTime);
            // } else {
            //     total_joined_teams = Number(totalJointeams);
            // }
            total_joined_teams = Number(totalJointeams);
            if (matchchallengeid == "682ddf0e9b3854131286a5be") {
                total_joined_teams = total_joined_teams + 20000;
            }
            return {
                message: "Contest LeaderBard",
                status: true,
                data: userLeaderboard1,
                total_joined_teams
            }
        } catch (error) {
            throw error;
        }
    };
    /**
     * @function userLeaderboard
     * @description Get Contest LeaderBard
     * @param { matchkey }
     * @author 
     */
    // async myLeaderboard(req) {
    //     try {
    //         let skip = (req.query?.skip) ? Number(req.query.skip) : 0;
    //         let limit = (req.query?.limit) ? Number(req.query.limit) : 10;
    //         const { matchchallengeid, matchkey } = req.query;
    //         if (!matchchallengeid) {
    //             return {
    //                 message: "No Contest LeaderBard",
    //                 status: false,
    //                 data: []
    //             }
    //         }
    //         let keyChallengeLeaderBoard = `match:${matchkey}:challenge:${matchchallengeid}:challengeLeaderBoard`;
    //         let leaderboard = await retrieveSortedSet(keyChallengeLeaderBoard, req.user._id, skip, limit);
    //         // console.log('leaderboard---->>', leaderboard);
    //         let joinedleauge = [];
    //         if (leaderboard && leaderboard.length > 0) {
    //             joinedleauge = [...leaderboard];
    //         } else {
    //             const aggPipe = [];
    //             let sortarray = [];
    //             aggPipe.push({
    //                 $match: {
    //                     'matchkey': mongoose.Types.ObjectId(req.query.matchkey),
    //                     'challengeid': mongoose.Types.ObjectId(req.query.matchchallengeid),
    //                     userid: { $ne: mongoose.Types.ObjectId(req.user._id) }
    //                 }
    //             });
    //             aggPipe.push({
    //                 $lookup: {
    //                     from: "users",
    //                     localField: "userid",
    //                     foreignField: "_id",
    //                     as: "userdata",
    //                 }
    //             });
    //             aggPipe.push({
    //                 $unwind: {
    //                     path: "$userdata"
    //                 }
    //             });
    //             aggPipe.push({
    //                 $lookup: {
    //                     from: "leaderboards",
    //                     localField: "_id",
    //                     foreignField: "joinId",
    //                     as: "leaderboards",
    //                 }
    //             });
    //             aggPipe.push({
    //                 $unwind: {
    //                     path: "$leaderboards"
    //                 }
    //             });
    //             aggPipe.push({
    //                 $addFields: {
    //                     usernumber: {
    //                         $cond: {
    //                             if: {
    //                                 $eq: [
    //                                     "$userid",
    //                                     mongoose.Types.ObjectId(req.user._id),
    //                                 ],
    //                             },
    //                             then: 1,
    //                             else: 0,
    //                         },
    //                     },
    //                     image: {
    //                         $cond: {
    //                             if: {
    //                                 $and: [
    //                                     {
    //                                         $ne: ["$userdata.image", null],
    //                                     },
    //                                     {
    //                                         $ne: ["$userdata.image", ""],
    //                                     },
    //                                 ],
    //                             },
    //                             then: "$userdata.image",
    //                             else: `${global.constant.IMAGE_URL}team_image.png`,
    //                         },
    //                     },
    //                 }
    //             });
    //             aggPipe.push({
    //                 $sort: {
    //                     usernumber: -1,
    //                     userid: -1,
    //                     "leaderboards.teamnumber": 1,
    //                 }
    //             });
    //             ``
    //             aggPipe.push({
    //                 $project: {
    //                     joinleaugeid: "$_id",
    //                     _id: 0,
    //                     joinTeamNumber: {
    //                         $ifNull: ["$leaderboards.teamnumber", 0],
    //                     },
    //                     jointeamid: {
    //                         $ifNull: ["$teamid", ""],
    //                     },
    //                     userid: {
    //                         $ifNull: ["$userid", ""],
    //                     },
    //                     team: {
    //                         $ifNull: ["$userdata.team", ""],
    //                     },
    //                     image: {
    //                         $ifNull: [
    //                             "$image",
    //                             `${global.constant.IMAGE_URL}user.png`,
    //                         ],
    //                     },
    //                     teamnumber: {
    //                         $ifNull: ["$leaderboards.teamnumber", 0],
    //                     },
    //                     usernumber: 1,
    //                 }
    //             });

    //             aggPipe.push({
    //                 $facet: {
    //                     data: [{ $skip: skip }, { $limit: limit }]
    //                 }
    //             });
    //             joinedleauge = await userLeagueModel.aggregate(aggPipe);
    //             if (joinedleauge[0].data.length == 0) return { message: 'Contest LeaderBard Not Found', status: false, data: [] };
    //             joinedleauge = joinedleauge[0].data;
    //         }
    //         let total_joined_teams = 0;
    //         // console.log('skip', skip);
    //         if (skip == 0) {
    //             const challengeCounterKey = `match:${matchkey}:challenge:${matchchallengeid}:joinedTeams`;
    //             let totalJointeams = await redisjoinTeams.redis.get(challengeCounterKey);
    //             console.log('totalJointeams', totalJointeams);
    //             if (!totalJointeams) {
    //                 total_joined_teams = await userLeagueModel.countDocuments({
    //                     'matchkey': mongoose.Types.ObjectId(req.query.matchkey),
    //                     'challengeid': mongoose.Types.ObjectId(req.query.matchchallengeid)
    //                 });
    //                 var expRedisTime = await matchTimeDifference(req.query.matchkey);
    //                 await redisjoinTeams.redis.set(challengeCounterKey, total_joined_teams, expRedisTime);
    //             } else {
    //                 total_joined_teams = Number(totalJointeams);
    //             }

    //         }

    //         return {
    //             message: "Contest LeaderBard",
    //             status: true,
    //             data: joinedleauge,
    //             total_joined_teams

    //         }
    //     } catch (error) {
    //         throw error;
    //     }
    // };


    async userLeaderboard(req) {
        try {
            let skip = (req.query?.skip) ? Number(req.query.skip) : 0;
            let limit = (req.query?.limit) ? Number(req.query.limit) : 10;
            const { matchchallengeid, matchkey } = req.query;

            // let keyChallengeLeaderBoard = `match:${matchkey}:challenge:${matchchallengeid}:challengeLeaderBoard`;
            // let leaderboard = await retrieveSortedSet(keyChallengeLeaderBoard, req.user._id, skip, limit);
            // console.log('leaderboard---->>', leaderboard);
            let start = skip;
            if (start == 1) {
                start = 0;
            }
            const end = skip + limit - 1;
            let keyChallengeLeaderBoard = `liveRanksLeaderboard_${matchchallengeid}`;
            let leaderboard = await retrieveSortedSet(keyChallengeLeaderBoard, req.user._id, start, end);
            console.log('leaderboard', leaderboard.length);
            let joinedleauge = [];
            if (leaderboard && leaderboard.length > 0) {
                for (let join of leaderboard) {
                    let data = {
                        "_id": join._id,
                        "getcurrentrank": join.getcurrentrank,
                        "usernumber": 0,
                        "joinleaugeid": join.userjoinid,
                        "joinTeamNumber": join.joinNumber,
                        "jointeamid": join.jointeamid,
                        "userid": join.userid,
                        "team": join.teamname,
                        "image": join.image,
                        "teamnumber": join.teamnumber,
                        "refercode": ''
                    }
                    joinedleauge.push(data);
                }
            } else {
                joinedleauge = [];
                // const aggPipe = [];
                // let sortarray = [];
                // aggPipe.push({
                //     $match: {
                //         'matchkey': mongoose.Types.ObjectId(req.query.matchkey),
                //         'challengeid': mongoose.Types.ObjectId(req.query.matchchallengeid),
                //         userid: { $ne: mongoose.Types.ObjectId(req.user._id) }
                //     }
                // });
                // aggPipe.push({
                //     $lookup: {
                //         from: "users",
                //         localField: "userid",
                //         foreignField: "_id",
                //         as: "userdata",
                //     }
                // });
                // aggPipe.push({
                //     $unwind: {
                //         path: "$userdata"
                //     }
                // });
                // aggPipe.push({
                //     $lookup: {
                //         from: "leaderboards",
                //         localField: "_id",
                //         foreignField: "joinId",
                //         as: "leaderboards",
                //     }
                // });
                // aggPipe.push({
                //     $unwind: {
                //         path: "$leaderboards"
                //     }
                // });
                // aggPipe.push({
                //     $addFields: {
                //         usernumber: {
                //             $cond: {
                //                 if: {
                //                     $eq: [
                //                         "$userid",
                //                         mongoose.Types.ObjectId(req.user._id),
                //                     ],
                //                 },
                //                 then: 1,
                //                 else: 0,
                //             },
                //         },
                //         image: {
                //             $cond: {
                //                 if: {
                //                     $and: [
                //                         {
                //                             $ne: ["$userdata.image", null],
                //                         },
                //                         {
                //                             $ne: ["$userdata.image", ""],
                //                         },
                //                     ],
                //                 },
                //                 then: "$userdata.image",
                //                 else: `${global.constant.IMAGE_URL}team_image.png`,
                //             },
                //         },
                //     }
                // });
                // aggPipe.push({
                //     $sort: {
                //         usernumber: -1,
                //         userid: -1,
                //         "leaderboards.teamnumber": 1,
                //     }
                // });
                // ``
                // aggPipe.push({
                //     $project: {
                //         joinleaugeid: "$_id",
                //         _id: 0,
                //         joinTeamNumber: {
                //             $ifNull: ["$leaderboards.teamnumber", 0],
                //         },
                //         jointeamid: {
                //             $ifNull: ["$teamid", ""],
                //         },
                //         userid: {
                //             $ifNull: ["$userid", ""],
                //         },
                //         team: {
                //             $ifNull: ["$userdata.team", ""],
                //         },
                //         image: {
                //             $ifNull: [
                //                 "$image",
                //                 `${global.constant.IMAGE_URL}user.png`,
                //             ],
                //         },
                //         teamnumber: {
                //             $ifNull: ["$leaderboards.teamnumber", 0],
                //         },
                //         usernumber: 1,
                //     }
                // });

                // aggPipe.push({
                //     $facet: {
                //         data: [{ $skip: skip }, { $limit: limit }]
                //     }
                // });
                // joinedleauge = await userLeagueModel.aggregate(aggPipe);
                // if (joinedleauge[0].data.length == 0) return { message: 'Contest LeaderBard Not Found', status: false, data: [] };
                // joinedleauge = joinedleauge[0].data;
            }
            let total_joined_teams = 0;
            // console.log('skip', skip);
            if (skip == 0) {
                const challengeCounterKey = `match:${matchkey}:challenge:${matchchallengeid}:joinedTeams`;
                let totalJointeams = await redisjoinTeams.redis.get(challengeCounterKey);
                console.log('totalJointeams', totalJointeams);
                if (!totalJointeams) {
                    total_joined_teams = await userLeagueModel.countDocuments({
                        'matchkey': mongoose.Types.ObjectId(req.query.matchkey),
                        'challengeid': mongoose.Types.ObjectId(req.query.matchchallengeid)
                    });
                    var expRedisTime = await matchTimeDifference(req.query.matchkey);
                    await redisjoinTeams.redis.set(challengeCounterKey, total_joined_teams, { "ex": expRedisTime });
                } else {
                    total_joined_teams = Number(totalJointeams);
                }

            }

            return {
                message: "Contest LeaderBard",
                status: true,
                data: joinedleauge,
                total_joined_teams

            }
        } catch (error) {
            throw error;
        }
    };

    async liveRanksLeaderboardPipeline(req, skip, limit) {
        let aggPipe = [];
        aggPipe.push({
            $match: {
                matchkey: new mongoose.Types.ObjectId(req.query.matchkey),
                challengeid: new mongoose.Types.ObjectId(req.query.matchchallengeid),
            },
        });
        aggPipe.push({
            $lookup: {
                from: "users",
                localField: "userid",
                foreignField: "_id",
                as: "user",
            },
        });

        aggPipe.push({
            $addFields: {
                team: {
                    $ifNull: [
                        {
                            $arrayElemAt: ["$user.team", 0],
                        },
                        "",
                    ],
                },
                userno: {
                    $cond: {
                        if: {
                            $and: [
                                {
                                    $eq: ["$userid", new mongoose.Types.ObjectId(req.user._id)],
                                },
                            ],
                        },
                        then: "-1",
                        else: "0",
                    },
                },
            },
        });

        aggPipe.push({
            $lookup: {
                from: "userleaderboard",
                localField: "_id",
                foreignField: "joinId",
                as: "leaderboards",
            },
        });
        aggPipe.push({
            $project: {
                _id: 1,
                userjoinid: "$_id",
                userid: "$userid",
                jointeamid: "$teamid",
                teamnumber: 1,
                challengeid: 1,
                userno: 1,
                points: {
                    $ifNull: [
                        {
                            $arrayElemAt: ["$leaderboards.points", 0],
                        },
                        0,
                    ],
                },
                getcurrentrank: {
                    $ifNull: [
                        {
                            $arrayElemAt: ["$leaderboards.rank", 0],
                        },
                        0,
                    ],
                },
                teamname: {
                    $ifNull: ["$team", 0],
                },
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
                winingamount: {
                    $cond: {
                        if: {
                            $ne: [
                                {
                                    $arrayElemAt: ["$leaderboards.amount", 0],
                                },
                                0,
                            ],
                        },
                        then: {
                            $toString: {
                                $ifNull: [
                                    {
                                        $arrayElemAt: ["$leaderboards.amount", 0],
                                    },
                                    "",
                                ],
                            },
                        },
                        else: {
                            $toString: {
                                $ifNull: [
                                    {
                                        $arrayElemAt: ["$leaderboards.prize", 0],
                                    },
                                    "",
                                ],
                            },
                        },
                    },
                },
                contest_winning_type: {
                    $ifNull: [
                        {
                            $arrayElemAt: ["$leaderboards.contest_winning_type", 0],
                        },
                        '',
                    ],
                },
                "challengeData": "price",
            },
        });


        aggPipe.push({
            $sort: {
                userno: 1,
                getcurrentrank: 1,
            },
        });

        aggPipe.push({
            $facet: {
                data: [{ $skip: skip }, { $limit: limit }],
            },
        });
        // console.log(JSON.stringify(aggPipe))
        return await userLeagueModel.aggregate(aggPipe);
    }
    /**
     * @function updateJoinedusers
     * @description Is Running contest for join Querys
     * @param { matchkey }
     * @author 
     */
    // async updateJoinedusers(req) {
    //     try {
    //         console.log("--updateJoinedusers----")
    //         const query = {};
    //         query.matchkey = req.query.matchkey
    //         query.contest_type = 'Amount'

    //         query.status = 'opened'
    //         const matchchallengesData = await matchContestModel.find(query);
    //         if (matchchallengesData.length > 0) {
    //             for (let matchchallenge of matchchallengesData) {
    //                 const totalJoinedUserInLeauge = await userLeagueModel.find({ challengeid: mongoose.Types.ObjectId(matchchallenge._id) });
    //                 if (matchchallenge.maximum_user == totalJoinedUserInLeauge.length) {
    //                     const update = {
    //                         $set: {
    //                             'status': 'closed',
    //                             'is_duplicated': 1,
    //                             'joinedusers': totalJoinedUserInLeauge.length,
    //                         },
    //                     };
    //                     // console.log("--matchchallenge.is_running == 1 && matchchallenge.is_duplicated != 1--",matchchallenge.is_running == 1 && matchchallenge.is_duplicated != 1)
    //                     if (matchchallenge.is_running == 1 && matchchallenge.is_duplicated != 1) {
    //                         let newmatchchallenge = {};
    //                         // delete newmatchchallenge._id;
    //                         // delete newmatchchallenge.createdAt;
    //                         // delete newmatchchallenge.updatedAt;
    //                         newmatchchallenge.joinedusers = 0;
    //                         newmatchchallenge.contestid = matchchallenge.contestid
    //                         newmatchchallenge.contest_cat = matchchallenge.contest_cat
    //                         newmatchchallenge.challenge_id = matchchallenge.challenge_id
    //                         newmatchchallenge.matchkey = matchchallenge.matchkey
    //                         newmatchchallenge.fantasy_type = matchchallenge.fantasy_type
    //                         newmatchchallenge.entryfee = matchchallenge.entryfee
    //                         newmatchchallenge.win_amount = matchchallenge.win_amount
    //                         newmatchchallenge.multiple_entryfee = matchchallenge.multiple_entryfee
    //                         newmatchchallenge.expert_teamid = matchchallenge.expert_teamid
    //                         newmatchchallenge.maximum_user = matchchallenge.maximum_user
    //                         newmatchchallenge.status = matchchallenge.status
    //                         newmatchchallenge.created_by = matchchallenge.created_by
    //                         newmatchchallenge.contest_type = matchchallenge.contest_type
    //                         newmatchchallenge.expert_name = matchchallenge.expert_name
    //                         newmatchchallenge.contest_name = matchchallenge.contest_name || ''
    //                         newmatchchallenge.amount_type = matchchallenge.amount_type
    //                         newmatchchallenge.mega_status = matchchallenge.mega_status
    //                         newmatchchallenge.winning_percentage = matchchallenge.winning_percentage
    //                         newmatchchallenge.is_bonus = matchchallenge.is_bonus
    //                         newmatchchallenge.bonus_percentage = matchchallenge.bonus_percentage
    //                         newmatchchallenge.pricecard_type = matchchallenge.pricecard_type
    //                         newmatchchallenge.minimum_user = matchchallenge.minimum_user
    //                         newmatchchallenge.confirmed_challenge = matchchallenge.confirmed_challenge
    //                         newmatchchallenge.multi_entry = matchchallenge.multi_entry
    //                         newmatchchallenge.team_limit = matchchallenge.team_limit
    //                         newmatchchallenge.image = matchchallenge.image
    //                         newmatchchallenge.c_type = matchchallenge.c_type
    //                         newmatchchallenge.is_private = matchchallenge.is_private
    //                         newmatchchallenge.is_running = matchchallenge.is_running
    //                         newmatchchallenge.is_expert = matchchallenge.is_expert
    //                         newmatchchallenge.bonus_percentage = matchchallenge.bonus_percentage
    //                         newmatchchallenge.matchpricecards = matchchallenge.matchpricecards
    //                         newmatchchallenge.is_expert = matchchallenge.is_expert
    //                         newmatchchallenge.team1players = matchchallenge.team1players
    //                         newmatchchallenge.team2players = matchchallenge.team2players
    //                         // console.log("---newmatchchallenge--",newmatchchallenge)
    //                         let data = await matchContestModel.findOne({
    //                             matchkey: matchchallenge.matchkey,
    //                             fantasy_type: matchchallenge.fantasy_type,
    //                             entryfee: matchchallenge.entryfee,
    //                             win_amount: matchchallenge.win_amount,
    //                             maximum_user: matchchallenge.maximum_user,
    //                             joinedusers: 0,
    //                             status: matchchallenge.status,
    //                             is_duplicated: { $ne: 1 }
    //                         });
    //                         if (!data) {
    //                             let createNewContest = new matchContestModel(newmatchchallenge);
    //                             let mynewContest = await createNewContest.save();
    //                         }
    //                         // console.log("---createNewContest----",mynewContest)
    //                     }

    //                     await matchContestModel.updateOne({ _id: mongoose.Types.ObjectId(matchchallenge._id) }, update);
    //                 }
    //             }

    //         }
    //     } catch (error) {
    //         throw error;
    //     }

    // };
    async oldUpdateJoinedusers(req) {
        try {
            console.log("--updateJoinedusers----");
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
            const matchchallengesData = await matchContestModel.aggregate(aggPipe);
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

                        const data = await matchContestModel.findOne({
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
                            const createNewContest = new matchContestModel(newMatchChallenge);
                            const mynewContest = await createNewContest.save();
                        }
                    }

                    await matchContestModel.updateOne({ _id: mongoose.Types.ObjectId(matchchallenge._id) }, update);
                }
            }
            return true;
        } catch (error) {
            throw error;
        }
    }
    async JoinedUsersUpdate(req) {
        try {
            console.log("--JoinedUsersUpdate--");

            const matchkey = mongoose.Types.ObjectId(req.query.matchkey);

            // Aggregate challenges with the required data
            const matchChallengesData = await matchContestModel.aggregate([
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
                        const existingChallenge = await matchContestModel.findOne({
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
                await matchContestModel.bulkWrite(bulkOps);
            }

            // Insert new challenges if needed
            if (newChallenges.length > 0) {
                await matchContestModel.insertMany(newChallenges);
            }

            return true;
        } catch (error) {
            console.error("Error in JoinedUsersUpdate:", error);
            throw error;
        }
    }

    async updateJoineduserswithredis1(req) {
        try {
            console.log("--updateJoinedUsers--Ajay--");

            const matchkey = mongoose.Types.ObjectId(req.query.matchkey);
            const matchKeyData = `match:${req.query.matchkey}:challenges`;

            let filteredMatchChallenges = await redisContest.hgetAllData(matchKeyData);
            if (!filteredMatchChallenges || Object.keys(filteredMatchChallenges).length === 0) {
                const dbChallenges = await matchContestModel.find({ matchkey: req.query.matchkey });

                for (const matchChallengeData of dbChallenges) {
                    const matchkey = matchChallengeData.matchkey;
                    const challengeId = matchChallengeData._id;
                    const categoryId = matchChallengeData.contest_cat;
                    if (matchChallengeData?.matchpricecards?.length) {
                        const priceDetails = matchChallengeData.matchpricecards[0];
                        var totalwinners = Number(priceDetails.winners) || 1;

                        if (priceDetails.price === 0 || priceDetails.type === 'Percentage') {
                            var price_card = {
                                total: priceDetails.total.toString(),
                                price: (priceDetails.total / totalwinners).toFixed(2),
                                price_percent: `${priceDetails.price_percent}%`
                            };
                        } else {
                            var price_card = {
                                total: priceDetails.total.toString(),
                                gift_type: priceDetails.gift_type,
                                price: matchChallengeData.amount_type === "prize"
                                    ? priceDetails.prize_name
                                    : Number(priceDetails.price).toFixed(2),
                                image: matchChallengeData.amount_type === "prize"
                                    ? `${global.constant.IMAGE_URL}${priceDetails.image}`
                                    : ''
                            };
                        }
                    } else {
                        var price_card = {
                            price: matchChallengeData.win_amount.toString(),
                            total: matchChallengeData.win_amount.toString(),
                            image: '',
                            gift_type: "amount"
                        };
                        var totalwinners = 1;
                    }

                    const fieldsToUpdate = {
                        type: "contest",
                        is_PromoCode_Contest: matchChallengeData.is_PromoCode_Contest || false,
                        challenge_id: matchChallengeData.challenge_id || null,
                        matchchallengeid: matchChallengeData._id || null,
                        entryfee: matchChallengeData.entryfee || 0,
                        win_amount: matchChallengeData.win_amount || 0,
                        maximum_user: matchChallengeData.maximum_user || 0,
                        joinedusers: matchChallengeData.joinedusers || 0,
                        contest_type: matchChallengeData.contest_type || null,
                        winning_percentage: matchChallengeData.winning_percentage || 0,
                        is_bonus: matchChallengeData.is_bonus || 0,
                        bonus_percentage: matchChallengeData.bonus_percentage || 0,
                        confirmed_challenge: matchChallengeData.confirmed_challenge || 0,
                        multi_entry: matchChallengeData.multi_entry || 0,
                        team_limit: matchChallengeData.team_limit || 1,
                        discount_fee: matchChallengeData.discount_fee || 0,
                        price_card: price_card || 0,
                        extrapricecard: matchChallengeData.extrapricecards || 0,
                        totalwinners: totalwinners || 0,
                        flexible_contest: matchChallengeData.flexible_contest || "0",
                        pdfDownloadStatus: matchChallengeData.pdfDownloadStatus || null,
                        conditional_contest: matchChallengeData.conditional_contest || 0,
                        mandatoryContest: matchChallengeData.mandatoryContest || null,
                        status: matchChallengeData.status || "opened",
                        bonus_type: matchChallengeData.bonus_type || "",
                        amount_type: matchChallengeData.amount_type || "Amount",
                        mega_status: matchChallengeData.mega_status || "",
                        minimum_user: matchChallengeData.minimum_user || 0,
                        pricecard_type: matchChallengeData.pricecard_type || "Amount",
                        c_type: matchChallengeData.c_type || "",
                        WinningpriceAndPrize: matchChallengeData.WinningpriceAndPrize || "",
                        compress: matchChallengeData.compress || "",
                        textNote: matchChallengeData.textNote || "",
                        is_running: matchChallengeData.is_running || 0,
                        is_duplicated: matchChallengeData.is_duplicated,
                        is_recent: matchChallengeData?.is_recent || false,
                        team_type_id: matchChallengeData?.team_type_id,
                        team_type_name: matchChallengeData?.team_type_name || "10-1",
                    };
                    console.log("matchChallengeDataAjay", matchChallengeData.is_running)
                    await redisUpdateChallenge.insertRedisFields(matchkey, categoryId, challengeId, fieldsToUpdate);
                }
            }
            filteredMatchChallenges = await redisContest.hgetAllData(matchKeyData);
            // Ensure filteredMatchChallenges is an array
            if (!filteredMatchChallenges || Object.keys(filteredMatchChallenges).length === 0) {
                console.log("No match challenges found in Redis for matchkey:", matchkey);
                return false;
            }

            filteredMatchChallenges = Object.values(filteredMatchChallenges); // Convert object to array

            const bulkOps = [];
            const newChallenges = [];
            for (const matchchallenge of filteredMatchChallenges) {
                const challengeCounterKey = `match:${req.query.matchkey}:challenge:${matchchallenge._id}:joinedTeams`;
                let joinedleagues = await redisjoinTeams.redis.get(challengeCounterKey);
                if (joinedleagues == matchchallenge.maximum_user && matchchallenge.status != "closed") {
                    // Update the current challenge
                    // bulkOps.push({
                    //     updateOne: {
                    //         filter: { _id: matchchallenge._id },
                    //         update: {
                    //             $set: {
                    //                 status: 'closed',
                    //                 is_duplicated: 1,
                    //                 joinedusers: joinedleagues
                    //             }
                    //         }
                    //     }
                    // });

                    await matchContestModel.updateOne(
                        { _id: matchchallenge._id },
                        {
                            $set: {
                                status: 'closed',
                                is_duplicated: 1,
                                joinedusers: joinedleagues
                            }
                        }
                    );

                    let fieldsToUpdate = {
                        status: 'closed',
                        is_duplicated: 1,
                        joinedusers: joinedleagues
                    };

                    await redisUpdateChallenge.insertRedisFields(req.query.matchkey, matchchallenge.contest_cat, matchchallenge._id, fieldsToUpdate);

                    if (matchchallenge.is_running === 1 && matchchallenge.is_duplicated == 0) {
                        console.log("matchchallenge.is_running === 1 && matchchallenge.is_duplicated == 0", matchchallenge.is_running === 1 && matchchallenge.is_duplicated == 0);
                        const existingChallenge = await matchContestModel.findOne({
                            matchkey,
                            fantasy_type: matchchallenge.fantasy_type,
                            entryfee: matchchallenge.entryfee,
                            win_amount: matchchallenge.win_amount,
                            maximum_user: matchchallenge.maximum_user,
                            joinedusers: 0,
                            status: matchchallenge.status,
                            is_duplicated: { $ne: 1 }
                        }).lean();
                        let keyname = `challenge-running-${matchchallenge._id}`;
                        let checkContest = await redisjoinTeams.getkeydata(keyname);
                        if (!existingChallenge && !checkContest) {
                            const existChall = await matchContestModel.findOne({ _id: matchchallenge._id });
                            delete matchchallenge._id;
                            const newChallenge = {
                                ...matchchallenge,
                                matchpricecards: existChall.matchpricecards,
                                joinedusers: 0,
                                is_duplicated: 0,
                                status: 'opened',
                                matchkey: req.query.matchkey,
                                _id: new mongoose.Types.ObjectId(),
                                compress: matchchallenge.compress || "",
                            };
                            let obj = {
                                _id: matchchallenge._id
                            }
                            newChallenges.push(newChallenge);
                            await redisjoinTeams.setkeydata(keyname, obj, 60 * 60 * 4);
                        }
                    }
                }
            }
            // Execute bulk updates
            // if (bulkOps.length > 0) {
            //     // await matchContestModel.bulkWrite(bulkOps);
            // }
            // Insert new challenges if needed
            if (newChallenges.length > 0) {
                try {
                    for (const newChallenge of newChallenges) {
                        let insertedChallenge = await matchContestModel.create(newChallenge);
                        if (insertedChallenge?.matchpricecards?.length) {
                            const priceDetails = insertedChallenge.matchpricecards[0];
                            var totalwinners = Number(insertedChallenge.winners) || 1;

                            if (insertedChallenge.price === 0 || insertedChallenge.type === 'Percentage') {
                                var price_card = {
                                    total: insertedChallenge.total.toString(),
                                    price: (insertedChallenge.total / totalwinners).toFixed(2),
                                    price_percent: `${insertedChallenge.price_percent}%`
                                };
                            } else {
                                var price_card = {
                                    total: insertedChallenge.total.toString(),
                                    gift_type: insertedChallenge.gift_type,
                                    price: insertedChallenge.amount_type === "prize"
                                        ? insertedChallenge.prize_name
                                        : Number(insertedChallenge.price).toFixed(2),
                                    image: insertedChallenge.amount_type === "prize"
                                        ? `${global.constant.IMAGE_URL}${insertedChallenge.image}`
                                        : ''
                                };
                            }
                        } else {
                            var price_card = {
                                price: insertedChallenge.win_amount.toString(),
                                total: insertedChallenge.win_amount.toString(),
                                image: '',
                                gift_type: "amount"
                            };
                            var totalwinners = 1;
                        }
                        const fieldsToUpdate = {
                            type: "contest",
                            is_PromoCode_Contest: insertedChallenge.is_PromoCode_Contest || false,
                            challenge_id: insertedChallenge.challenge_id || null,
                            matchchallengeid: newChallenge._id || null,
                            entryfee: insertedChallenge.entryfee || 0,
                            win_amount: insertedChallenge.win_amount || 0,
                            maximum_user: insertedChallenge.maximum_user || 0,
                            joinedusers: 0,
                            contest_type: insertedChallenge.contest_type || null,
                            winning_percentage: insertedChallenge.winning_percentage || 0,
                            is_bonus: insertedChallenge.is_bonus || 0,
                            bonus_percentage: insertedChallenge.bonus_percentage || 0,
                            confirmed_challenge: insertedChallenge.confirmed_challenge || 0,
                            multi_entry: insertedChallenge.multi_entry || 0,
                            team_limit: insertedChallenge.team_limit || 1,
                            discount_fee: insertedChallenge.discount_fee || 0,
                            price_card: price_card || 0,
                            extrapricecard: insertedChallenge.extrapricecards || 0,
                            totalwinners: totalwinners || 0,
                            flexible_contest: insertedChallenge.flexible_contest || "0",
                            pdfDownloadStatus: insertedChallenge.pdfDownloadStatus || null,
                            conditional_contest: insertedChallenge.conditional_contest || 0,
                            mandatoryContest: insertedChallenge.mandatoryContest || null,
                            status: "opened",
                            bonus_type: insertedChallenge.bonus_type || "",
                            amount_type: insertedChallenge.amount_type || "Amount",
                            mega_status: insertedChallenge.mega_status || "",
                            minimum_user: insertedChallenge.minimum_user || 0,
                            pricecard_type: insertedChallenge.pricecard_type || "Amount",
                            c_type: insertedChallenge.c_type || "",
                            WinningpriceAndPrize: insertedChallenge.WinningpriceAndPrize || "",
                            compress: insertedChallenge.compress || "",
                            textNote: insertedChallenge.textNote || "",
                            is_running: insertedChallenge.is_running || 0,
                            is_duplicated: 0,
                            is_recent: insertedChallenge?.is_recent || false,
                            team_type_id: insertedChallenge?.team_type_id,
                            team_type_name: insertedChallenge?.team_type_name || "10-1",
                        };
                        await redisUpdateChallenge.insertRedisFields(
                            req.query.matchkey,
                            insertedChallenge.contest_cat,
                            insertedChallenge._id,
                            fieldsToUpdate
                        );
                    }
                } catch (err) {
                    console.error("Error while inserting new challenges:", err);
                }
            }

            return true;

        } catch (error) {
            console.error("Error in updateJoinedUsers:", error);
            throw error;
        }
    }

    async updateJoineduserswithredis(req) {
        try {
            console.log("--updateJoinedUsers--Ajay--");

            const matchkey = mongoose.Types.ObjectId(req.query.matchkey);
            const matchKeyData = `match:${req.query.matchkey}:challenges`;
            await new Promise(resolve => setTimeout(resolve, 100));
            let filteredMatchChallenges = await redisContest.hgetAllData(matchKeyData);
            if (!filteredMatchChallenges || Object.keys(filteredMatchChallenges).length === 0) {
                const dbChallenges = await matchContestModel.find({ matchkey: req.query.matchkey });

                for (const matchChallengeData of dbChallenges) {
                    const matchkey = matchChallengeData.matchkey;
                    const challengeId = matchChallengeData._id;
                    const categoryId = matchChallengeData.contest_cat;
                    let totalwinners = 0;
                    if (matchChallengeData?.matchpricecards?.length) {
                        for (const winnerCount of matchChallengeData.matchpricecards) {
                            totalwinners += Number(winnerCount.winners);
                        }
                        const priceDetails = matchChallengeData.matchpricecards[0];
                        totalwinners = totalwinners || Number(priceDetails.winners) || 1;

                        if (priceDetails.price === 0 || priceDetails.type === 'Percentage') {
                            var price_card = {
                                total: priceDetails.total.toString(),
                                price: (priceDetails.total / totalwinners).toFixed(2),
                                price_percent: `${priceDetails.price_percent}%`
                            };
                        } else {
                            var price_card = {
                                total: priceDetails.total.toString(),
                                gift_type: priceDetails.gift_type,
                                price: matchChallengeData.amount_type === "prize"
                                    ? priceDetails.prize_name
                                    : Number(priceDetails.price).toFixed(2),
                                image: matchChallengeData.amount_type === "prize"
                                    ? `${global.constant.IMAGE_URL}${priceDetails.image}`
                                    : ''
                            };
                        }
                    } else {
                        var price_card = {
                            price: matchChallengeData.win_amount.toString(),
                            total: matchChallengeData.win_amount.toString(),
                            image: '',
                            gift_type: "amount"
                        };
                        totalwinners = 1;
                    }

                    const fieldsToUpdate = {
                        type: "contest",
                        is_PromoCode_Contest: matchChallengeData.is_PromoCode_Contest || false,
                        challenge_id: matchChallengeData.challenge_id || null,
                        matchchallengeid: matchChallengeData._id || null,
                        entryfee: matchChallengeData.entryfee || 0,
                        win_amount: matchChallengeData.win_amount || 0,
                        maximum_user: matchChallengeData.maximum_user || 0,
                        joinedusers: matchChallengeData.joinedusers || 0,
                        contest_type: matchChallengeData.contest_type || null,
                        winning_percentage: matchChallengeData.winning_percentage || 0,
                        is_bonus: matchChallengeData.is_bonus || 0,
                        bonus_percentage: matchChallengeData.bonus_percentage || 0,
                        confirmed_challenge: matchChallengeData.confirmed_challenge || 0,
                        multi_entry: matchChallengeData.multi_entry || 0,
                        team_limit: matchChallengeData.team_limit || 1,
                        discount_fee: matchChallengeData.discount_fee || 0,
                        price_card: price_card || 0,
                        extrapricecard: matchChallengeData.extrapricecards || 0,
                        totalwinners: totalwinners || 0,
                        flexible_contest: matchChallengeData.flexible_contest || "0",
                        pdfDownloadStatus: matchChallengeData.pdfDownloadStatus || null,
                        conditional_contest: matchChallengeData.conditional_contest || 0,
                        mandatoryContest: matchChallengeData.mandatoryContest || null,
                        status: matchChallengeData.status || "opened",
                        bonus_type: matchChallengeData.bonus_type || "",
                        amount_type: matchChallengeData.amount_type || "Amount",
                        mega_status: matchChallengeData.mega_status || "",
                        minimum_user: matchChallengeData.minimum_user || 0,
                        pricecard_type: matchChallengeData.pricecard_type || "Amount",
                        c_type: matchChallengeData.c_type || "",
                        WinningpriceAndPrize: matchChallengeData.WinningpriceAndPrize || "",
                        compress: matchChallengeData.compress || "",
                        textNote: matchChallengeData.textNote || "",
                        is_running: matchChallengeData.is_running || 0,
                        is_duplicated: matchChallengeData.is_duplicated,
                        is_recent: matchChallengeData?.is_recent || false,
                    };
                    console.log("matchChallengeDataAjay", matchChallengeData.is_running)
                    await redisUpdateChallenge.insertRedisFields(matchkey, categoryId, challengeId, fieldsToUpdate);
                }
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            filteredMatchChallenges = await redisContest.hgetAllData(matchKeyData);
            // Ensure filteredMatchChallenges is an array
            if (!filteredMatchChallenges || Object.keys(filteredMatchChallenges).length === 0) {
                console.log("No match challenges found in Redis for matchkey:", matchkey);
                return false;
            }

            filteredMatchChallenges = Object.values(filteredMatchChallenges || {});

            for (const matchchallenge of filteredMatchChallenges) {
                const challengeCounterKey = `match:${req.query.matchkey}:challenge:${matchchallenge._id}:joinedTeams`;
                let joinedleagues = await redisjoinTeams.redis.get(challengeCounterKey);
                if (joinedleagues == matchchallenge.maximum_user && matchchallenge.status != "closed") {
                    let fieldsToUpdateClosed = {
                        status: 'closed',
                        is_duplicated: 1,
                        joinedusers: joinedleagues
                    };
                    await redisUpdateChallenge.insertRedisFields(req.query.matchkey, matchchallenge.contest_cat, matchchallenge._id, fieldsToUpdateClosed);


                    await matchContestModel.updateOne(
                        { _id: matchchallenge._id },
                        {
                            $set: {
                                status: 'closed',
                                is_duplicated: 1,
                                joinedusers: joinedleagues
                            }
                        }
                    );
                    // console.log("Ajay>>>", matchchallenge.is_running == 1 && matchchallenge.is_duplicated == 0)
                    if (matchchallenge.is_running == 1 && matchchallenge.is_duplicated == 0) {
                        // console.log("matchchallenge.is_running == 1 && matchchallenge.is_duplicated == 0", matchchallenge.is_running == 1 && matchchallenge.is_duplicated == 0)
                        const dbExist = await matchContestModel.find({
                            matchkey: matchkey,
                            entryfee: matchchallenge.entryfee,
                            win_amount: matchchallenge.win_amount,
                            maximum_user: matchchallenge.maximum_user,
                            joinedusers: 0,
                            status: "opened",
                            is_duplicated: { $ne: 1 }
                        }).lean();

                        if (dbExist.length > 0) {
                            console.log("Contest already exists with the same parameters. No need to create a new one.", dbExist);
                            return;
                        }

                        if (dbExist.length === 0) {
                            //remove this query
                            const existChall = await matchContestModel.findOne({ _id: matchchallenge._id });
                            //remove
                            delete matchchallenge._id;
                            const newChallenge = {
                                ...matchchallenge,
                                matchpricecards: existChall.matchpricecards || [],
                                joinedusers: 0,
                                is_duplicated: 0,
                                status: 'opened',
                                matchkey: matchkey,
                                _id: new mongoose.Types.ObjectId(),
                                compress: matchchallenge.compress || "",
                            };

                            const insertedChallenge = await matchContestModel.findOneAndUpdate(
                                {
                                    matchkey: newChallenge.matchkey,
                                    entryfee: newChallenge.entryfee,
                                    win_amount: newChallenge.win_amount,
                                    maximum_user: newChallenge.maximum_user,
                                    is_duplicated: { $ne: 1 },
                                    joinedusers: { $lt: matchchallenge.maximum_user },
                                    status: "opened"
                                },
                                {
                                    $setOnInsert: newChallenge
                                },
                                { upsert: true, new: true, lean: true }
                            );
                            console.log("insertedChallenge._id", insertedChallenge._id)
                            if (insertedChallenge) {
                                if (insertedChallenge?.matchpricecards?.length) {
                                    const priceDetails = insertedChallenge.matchpricecards[0];
                                    var totalwinners = Number(priceDetails.winners) || 1;

                                    if (priceDetails.price === 0 || priceDetails.type === 'Percentage') {
                                        var price_card = {
                                            total: priceDetails.total.toString(),
                                            price: (priceDetails.total / totalwinners).toFixed(2),
                                            price_percent: `${priceDetails.price_percent}%`
                                        };
                                    } else {
                                        var price_card = {
                                            total: priceDetails.total.toString(),
                                            gift_type: priceDetails.gift_type,
                                            price: insertedChallenge.amount_type === "prize"
                                                ? priceDetails.prize_name
                                                : Number(priceDetails.price).toFixed(2),
                                            image: insertedChallenge.amount_type === "prize"
                                                ? `${global.constant.IMAGE_URL}${priceDetails.image}`
                                                : ''
                                        };
                                    }
                                } else {
                                    var price_card = {
                                        price: insertedChallenge.win_amount.toString(),
                                        total: insertedChallenge.win_amount.toString(),
                                        image: '',
                                        gift_type: "amount"
                                    };
                                    var totalwinners = 1;
                                }

                                const fieldsToUpdate = {
                                    type: "contest",
                                    is_PromoCode_Contest: insertedChallenge.is_PromoCode_Contest || false,
                                    challenge_id: insertedChallenge.challenge_id || null,
                                    matchchallengeid: newChallenge._id || null,
                                    entryfee: insertedChallenge.entryfee || 0,
                                    win_amount: insertedChallenge.win_amount || 0,
                                    maximum_user: insertedChallenge.maximum_user || 0,
                                    joinedusers: 0,
                                    contest_type: insertedChallenge.contest_type || null,
                                    winning_percentage: insertedChallenge.winning_percentage || 0,
                                    is_bonus: insertedChallenge.is_bonus || 0,
                                    bonus_percentage: insertedChallenge.bonus_percentage || 0,
                                    confirmed_challenge: insertedChallenge.confirmed_challenge || 0,
                                    multi_entry: insertedChallenge.multi_entry || 0,
                                    team_limit: insertedChallenge.team_limit || 1,
                                    discount_fee: insertedChallenge.discount_fee || 0,
                                    price_card: price_card,
                                    totalwinners: totalwinners || 0,
                                    flexible_contest: insertedChallenge.flexible_contest || "0",
                                    pdfDownloadStatus: insertedChallenge.pdfDownloadStatus || null,
                                    conditional_contest: insertedChallenge.conditional_contest || 0,
                                    mandatoryContest: insertedChallenge.mandatoryContest || null,
                                    status: "opened",
                                    bonus_type: insertedChallenge.bonus_type || "",
                                    amount_type: insertedChallenge.amount_type || "Amount",
                                    mega_status: insertedChallenge.mega_status || "",
                                    minimum_user: insertedChallenge.minimum_user || 0,
                                    pricecard_type: insertedChallenge.pricecard_type || "Amount",
                                    c_type: insertedChallenge.c_type || "",
                                    WinningpriceAndPrize: insertedChallenge.WinningpriceAndPrize || "",
                                    compress: insertedChallenge.compress || "",
                                    textNote: insertedChallenge.textNote || "",
                                    is_running: insertedChallenge.is_running || 0,
                                    is_duplicated: 0,
                                    is_recent: insertedChallenge?.is_recent || false,
                                    team_type_id: insertedChallenge?.team_type_id,
                                    team_type_name: insertedChallenge?.team_type_name || "10-1",
                                };

                                await redisUpdateChallenge.insertRedisFields(
                                    req.query.matchkey,
                                    insertedChallenge.contest_cat,
                                    insertedChallenge._id,
                                    fieldsToUpdate
                                );
                            }
                        }
                    }
                }
            }
            return true;
        } catch (error) {
            console.error("Error in updateJoinedUsers:", error);
            throw error;
        }
    }

    async updateJoinedUsersWithRedisForChecking(req) {
        try {
            const matchkey = mongoose.Types.ObjectId(req.query.matchkey);
            const matchKeyData = `match:${req.query.matchkey}:challenges`;
            let filteredMatchChallenges = await redisContest.hgetAllData(matchKeyData);
            if (!filteredMatchChallenges || Object.keys(filteredMatchChallenges).length === 0) {
                const dbChallenges = await matchContestModel.find({ matchkey: req.query.matchkey });

                for (const matchChallengeData of dbChallenges) {
                    const matchkey = matchChallengeData.matchkey;
                    const challengeId = matchChallengeData._id;
                    const categoryId = matchChallengeData.contest_cat;
                    let totalwinners = 0;
                    if (matchChallengeData?.matchpricecards?.length) {
                        for (const winnerCount of matchChallengeData.matchpricecards) {
                            totalwinners += Number(winnerCount.winners);
                        }
                        const priceDetails = matchChallengeData.matchpricecards[0];
                        totalwinners = totalwinners || Number(priceDetails.winners) || 1;

                        if (priceDetails.price === 0 || priceDetails.type === 'Percentage') {
                            var price_card = {
                                total: priceDetails.total.toString(),
                                price: (priceDetails.total / totalwinners).toFixed(2),
                                price_percent: `${priceDetails.price_percent}%`
                            };
                        } else {
                            var price_card = {
                                total: priceDetails.total.toString(),
                                gift_type: priceDetails.gift_type,
                                price: matchChallengeData.amount_type === "prize"
                                    ? priceDetails.prize_name
                                    : Number(priceDetails.price).toFixed(2),
                                image: matchChallengeData.amount_type === "prize"
                                    ? `${global.constant.IMAGE_URL}${priceDetails.image}`
                                    : ''
                            };
                        }
                    } else {
                        var price_card = {
                            price: matchChallengeData.win_amount.toString(),
                            total: matchChallengeData.win_amount.toString(),
                            image: '',
                            gift_type: "amount"
                        };
                        totalwinners = 1;
                    }

                    const fieldsToUpdate = {
                        type: "contest",
                        is_PromoCode_Contest: matchChallengeData.is_PromoCode_Contest || false,
                        challenge_id: matchChallengeData.challenge_id || null,
                        matchchallengeid: matchChallengeData._id || null,
                        entryfee: matchChallengeData.entryfee || 0,
                        win_amount: matchChallengeData.win_amount || 0,
                        maximum_user: matchChallengeData.maximum_user || 0,
                        joinedusers: matchChallengeData.joinedusers || 0,
                        contest_type: matchChallengeData.contest_type || null,
                        winning_percentage: matchChallengeData.winning_percentage || 0,
                        is_bonus: matchChallengeData.is_bonus || 0,
                        bonus_percentage: matchChallengeData.bonus_percentage || 0,
                        confirmed_challenge: matchChallengeData.confirmed_challenge || 0,
                        multi_entry: matchChallengeData.multi_entry || 0,
                        team_limit: matchChallengeData.team_limit || 1,
                        discount_fee: matchChallengeData.discount_fee || 0,
                        price_card: price_card || 0,
                        extrapricecard: matchChallengeData.extrapricecards || 0,
                        totalwinners: totalwinners || 0,
                        flexible_contest: matchChallengeData.flexible_contest || "0",
                        pdfDownloadStatus: matchChallengeData.pdfDownloadStatus || null,
                        conditional_contest: matchChallengeData.conditional_contest || 0,
                        mandatoryContest: matchChallengeData.mandatoryContest || null,
                        status: matchChallengeData.status || "opened",
                        bonus_type: matchChallengeData.bonus_type || "",
                        amount_type: matchChallengeData.amount_type || "Amount",
                        mega_status: matchChallengeData.mega_status || "",
                        minimum_user: matchChallengeData.minimum_user || 0,
                        pricecard_type: matchChallengeData.pricecard_type || "Amount",
                        c_type: matchChallengeData.c_type || "",
                        WinningpriceAndPrize: matchChallengeData.WinningpriceAndPrize || "",
                        compress: matchChallengeData.compress || "",
                        textNote: matchChallengeData.textNote || "",
                        is_running: matchChallengeData.is_running || 0,
                        is_duplicated: matchChallengeData.is_duplicated,
                        is_recent: matchChallengeData?.is_recent || false,
                        team_type_id: matchChallengeData?.team_type_id,
                        team_type_name: matchChallengeData?.team_type_name || "10-1",
                    };
                    console.log("matchChallengeDataAjay", matchChallengeData.is_running)
                    await redisUpdateChallenge.insertRedisFields(matchkey, categoryId, challengeId, fieldsToUpdate);
                }
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            filteredMatchChallenges = await redisContest.hgetAllData(matchKeyData);
            // Ensure filteredMatchChallenges is an array
            if (!filteredMatchChallenges || Object.keys(filteredMatchChallenges).length === 0) {
                console.log("No match challenges found in Redis for matchkey:", matchkey);
                return false;
            }

            filteredMatchChallenges = Object.values(filteredMatchChallenges || {}).filter(mc => mc?.status == "opened");

            for (const matchchallenge of filteredMatchChallenges) {
                const challengeCounterKey = `match:${req.query.matchkey}:challenge:${matchchallenge._id}:joinedTeams`;
                let joinedleagues = await redisjoinTeams.redis.get(challengeCounterKey);
                if (Number(joinedleagues) == Number(matchchallenge.maximum_user) && matchchallenge.status != "closed") {
                    let fieldsToUpdateClosed = {
                        status: 'closed',
                        is_duplicated: 1,
                        joinedusers: joinedleagues
                    };
                    await redisUpdateChallenge.insertRedisFields(req.query.matchkey, matchchallenge.contest_cat, matchchallenge._id, fieldsToUpdateClosed);

                    const msg = {
                        filter: { _id: matchchallenge._id },
                        payload: fieldsToUpdateClosed,
                        modelName: "matchcontest"
                    }
                    await sendToQueue('contestClosed', msg);
                    // await new Promise(resolve => setTimeout(resolve, 10));
                    if (matchchallenge.is_running == 1 && matchchallenge.is_duplicated == 0) {
                        const redisChallenges = Object.values(await redisContest.hgetAllData(matchKeyData) || {}).filter(mc => mc?.status == "opened");
                        const similar = redisChallenges.find(c =>
                            Number(c.entryfee) === Number(matchchallenge.entryfee) &&
                            Number(c.win_amount) === Number(matchchallenge.win_amount) &&
                            Number(c.maximum_user) === Number(matchchallenge.maximum_user) &&
                            Number(c.joinedusers || 0) < Number(matchchallenge.maximum_user) &&
                            c.status === "opened" &&
                            Number(c.is_duplicated || 0) !== 1
                        );

                        if (!similar) {
                            let newChallengeId = new mongoose.Types.ObjectId();
                            const fieldsToUpdate = {
                                type: "contest",
                                is_PromoCode_Contest: matchchallenge.is_PromoCode_Contest || false,
                                challenge_id: matchchallenge.challenge_id || null,
                                matchchallengeid: newChallengeId || null,
                                entryfee: matchchallenge.entryfee || 0,
                                win_amount: matchchallenge.win_amount || 0,
                                maximum_user: matchchallenge.maximum_user || 0,
                                joinedusers: 0,
                                contest_type: matchchallenge.contest_type || null,
                                winning_percentage: matchchallenge.winning_percentage || 0,
                                is_bonus: matchchallenge.is_bonus || 0,
                                bonus_percentage: matchchallenge.bonus_percentage || 0,
                                confirmed_challenge: matchchallenge.confirmed_challenge || 0,
                                multi_entry: matchchallenge.multi_entry || 0,
                                team_limit: matchchallenge.team_limit || 1,
                                discount_fee: matchchallenge.discount_fee || 0,
                                price_card: matchchallenge.price_card,
                                totalwinners: matchchallenge.totalwinners || 0,
                                flexible_contest: matchchallenge.flexible_contest || "0",
                                pdfDownloadStatus: matchchallenge.pdfDownloadStatus || null,
                                conditional_contest: matchchallenge.conditional_contest || 0,
                                mandatoryContest: matchchallenge.mandatoryContest || null,
                                status: "opened",
                                bonus_type: matchchallenge.bonus_type || "",
                                amount_type: matchchallenge.amount_type || "Amount",
                                mega_status: matchchallenge.mega_status || "",
                                minimum_user: matchchallenge.minimum_user || 0,
                                pricecard_type: matchchallenge.pricecard_type || "Amount",
                                c_type: matchchallenge.c_type || "",
                                WinningpriceAndPrize: matchchallenge.WinningpriceAndPrize || "",
                                compress: matchchallenge.compress || "",
                                textNote: matchchallenge.textNote || "",
                                is_running: matchchallenge.is_running || 0,
                                is_duplicated: 0,
                                is_recent: matchchallenge?.is_recent || false,
                                team_type_id: matchchallenge?.team_type_id,
                                team_type_name: matchchallenge?.team_type_name || "10-1",

                            };

                            await redisUpdateChallenge.insertRedisFields(
                                req.query.matchkey,
                                matchchallenge.contest_cat,
                                newChallengeId,
                                fieldsToUpdate
                            );

                            const insertMsg = {
                                filter: { _id: matchchallenge._id },
                                payload: {
                                    _id: newChallengeId,
                                },
                                modelName: "matchcontest"
                            };
                            await sendToQueue('contestInsert', insertMsg);
                        } else {
                            console.log("Contest already exists with the same parameters. No need to create a new one.");
                        }
                    }
                }
            }
            return true;
        } catch (error) {
            console.error("Error in updateJoinedUsers:", error);
            throw error;
        }
    }

    async contestFromRedisToDb(req) {
        try {
            const matchkey = mongoose.Types.ObjectId(req.query.matchkey);
            const matchKeyData = `match:${req.query.matchkey}:challenges`;

            await new Promise(resolve => setTimeout(resolve, 10)); // Small delay if needed

            let filteredMatchChallenges = await redisContest.hgetAllData(matchKeyData);

            if (!filteredMatchChallenges || Object.keys(filteredMatchChallenges).length === 0) {
                console.log("No match challenges found in Redis for matchkey:", matchkey);
                return false;
            }

            // Filter only those with joined users > 0
            filteredMatchChallenges = Object.values(filteredMatchChallenges).filter(mc => mc?.joinedusers !== "0");
            console.log("filteredMatchChallenges", filteredMatchChallenges.length);
            for (const matchchallenge of filteredMatchChallenges) {
                const challengeCounterKey = `match:${req.query.matchkey}:challenge:${matchchallenge._id}:joinedTeams`;
                const joinedleagues = await redisjoinTeams.redis.get(challengeCounterKey);

                // Check if already exists in DB
                const existing = await matchContestModel.findOne({ _id: matchchallenge._id }).lean();

                if (!existing) {
                    // If it's not there, create it using info from Redis
                    const dbExist = await matchContestModel.findOne({
                        matchkey: req.query.matchkey,
                        entryfee: matchchallenge.entryfee,
                        win_amount: matchchallenge.win_amount,
                        maximum_user: matchchallenge.maximum_user
                    }).lean();

                    if (!dbExist) {
                        console.log(`⚠️ No matching DB contest found for Redis challenge ID: ${matchchallenge._id}`);
                        continue;
                    }

                    // Remove _id to avoid duplication
                    delete dbExist._id;

                    const newChallenge = {
                        ...dbExist,
                        joinedusers: Number(joinedleagues) || 0,
                        is_duplicated: matchchallenge.is_duplicated || 0,
                        status: matchchallenge.status || 'opened',
                        _id: matchchallenge._id,
                    };

                    await matchContestModel.create(newChallenge);
                    console.log(`✅ Inserted Redis challenge into DB: ${matchchallenge._id}`);
                } else {
                    console.log(`ℹ️ Challenge already exists in DB: ${matchchallenge._id}`);
                }
            }

            return true;
        } catch (error) {
            console.error("❌ Error in contestFromRedisToDb:", error);
            throw error;
        }
    }

    async contestPriceUpdate(req) {
        try {
            // सभी चैलेंज निकालें जिनमें `matchpricecards` खाली है
            const dbChallenges = await matchContestModel.find({ matchpricecards: [] });

            for (const challenge of dbChallenges) {
                // **matchkey को ObjectId में कन्वर्ट करें**
                const matchkeyObj = new mongoose.Types.ObjectId(challenge.matchkey);

                // पहले से मौजूद चैलेंज खोजें जिसमें `matchpricecards` हो
                const existChall = await matchContestModel.findOne({
                    matchkey: matchkeyObj, // ✅ ObjectId के रूप में कास्ट किया
                    entryfee: challenge.entryfee,
                    win_amount: challenge.win_amount,
                    maximum_user: challenge.maximum_user,
                    matchpricecards: { $ne: [] }
                });

                // अगर मिल गया तो `matchpricecards` अपडेट करें
                if (existChall) {
                    await matchContestModel.updateOne(
                        { _id: challenge._id },
                        { $set: { matchpricecards: existChall.matchpricecards } }
                    );
                }
            }

            console.log("✅ Challenge prices updated successfully.");
            return {
                message: "Challenge prices updated successfully.",
                status: true,
                data: dbChallenges
            };
        } catch (error) {
            console.error("❌ Error in contestPriceUpdate:", error);
            return {
                message: "Error updating challenge prices",
                status: false,
                error: error.message
            };
        }
    }


    /**
     * @function switchTeams
     * @description Contest Join replace with annother team
     * @param { matchkey,switchteam(joinleaugeid,newjointeamid) }
     * @author 
     */
    async switchTeams(req) {
        try {
            return { message: 'Temporary has been closed.', status: false, data: {} };

            const { matchkey, switchteam } = req.body;
            let keyname = `listMatchesModel-${matchkey}`
            let match = await redisjoinTeams.getkeydata(keyname);
            if (!match) {
                match = await listMatchesModel.findOne({ _id: mongoose.Types.ObjectId(matchkey) });
                redisjoinTeams.setkeydata(keyname, match, 60 * 60 * 4);
            }
            //comment for redis-->const match = listMatchesModel.findOne({ _id: mongoose.Types.ObjectId(matchkey) });
            if (!match) return { message: 'Match Not Found', status: false, data: {} };
            const matchTime = await matchServices.getMatchTime(match.start_date);
            if (matchTime === false) return { message: 'Match has been closed.', status: false, data: {} };
            let newData = switchteam

            for (let key of newData) {
                let joinTeam = await userTeamModel.findOne({ _id: key.newjointeamid });
                let updateData = await userLeagueModel.findOneAndUpdate({ _id: key.joinleaugeid }, { teamid: key.newjointeamid, teamnumber: joinTeam.teamnumber }, { new: true });
                await userLeaderBoardModel.findOneAndUpdate({ joinId: key.joinleaugeid }, { teamnumber: joinTeam.teamnumber, teamId: key.newjointeamid, }, { new: true });
            }
            return { message: 'Team Updated ', status: true, data: {} }
        } catch (error) {
            console.log(error);
            throw error;
        }
    }
    /**
     * @function fetchUsableBalance
     * @description Get amount to be used
     * @param { matchchallengeid }
     * @author 
     */
    async getUsableBalance1(req) {
        try {
            const { matchchallengeid, total_team_count, discount_fee } = req.query;

            let matchchallengesData = await matchContestModel.findOne({ _id: mongoose.Types.ObjectId(matchchallengeid) });
            // console.log(matchchallengesData, "ffffffffffffffffffffffff")

            // redis end
            //forrediscomment---> const matchchallengesData = await matchContestModel.findOne({ _id: mongoose.Types.ObjectId(matchchallengeid) });

            if (!matchchallengesData) {
                return {
                    message: 'Invalid details',
                    status: false,
                    data: {}
                }
            }
            req.query.matchkey = matchchallengesData.matchkey;
            // await this.updateJoinedusers(req);
            const user = await userModel.findOne({ _id: req.user._id }, { userbalance: 1, user_verify: 1 });
            const bonus = parseFloat(user.userbalance.bonus.toFixed(2)) || 0;
            const balance = parseFloat(user.userbalance.balance.toFixed(2)) || 0;
            const winning = parseFloat(user.userbalance.winning.toFixed(2)) || 0;
            const totalBalance = bonus + balance + winning;
            let findUsableBalance = balance + winning;
            // console.log(findUsableBalance, "findUsableBalance")
            let findBonusAmount = 0,
                usedBonus = 0;
            // console.log(matchchallengesData, 'matchchallengesData')
            if (matchchallengesData.is_bonus == 1 && matchchallengesData.bonus_percentage) findBonusAmount = ((matchchallengesData.bonus_percentage) * (total_team_count) / 100) * (matchchallengesData.entryfee);
            if (bonus >= findBonusAmount) usedBonus = findBonusAmount;
            else usedBonus = bonus;
            findUsableBalance = findUsableBalance + usedBonus
            // console.log(findUsableBalance,"findUsableBalancefindUsableBalancefindUsableBalance")
            matchchallengesData.entryfee = (((matchchallengesData.entryfee) * (total_team_count)) - ((discount_fee) * (total_team_count)));
            return {
                message: 'Get amount to be used',
                status: true,
                data: {
                    usablebalance: findUsableBalance.toFixed(2).toString(),
                    usertotalbalance: totalBalance.toFixed(2).toString(),
                    entryfee: matchchallengesData.entryfee.toFixed(2).toString(),
                    bonus: usedBonus.toFixed(2).toString(),
                    totalWinning: winning.toFixed(2).toString(),
                    totalBonus: bonus.toFixed(2).toString(),
                    totalDeposit: balance.toFixed(2).toString()
                    // discount_fee: ((discount_fee) * (total_team_count)).toString()
                }
            }
        } catch (error) {
            console.log(error)
            throw error;
        }
    }

    async fetchUsableBalance(req) {
        try {
            const { matchchallengeid, matchkey } = req.query;
            const total_team_count = req.query.total_team_count ? Number(req.query.total_team_count) : null;
            const discount_fee = req.query.discount_fee ? Number(req.query.discount_fee) : 0;

            const isDuo = !total_team_count; // If no team count, it's duo
            const keyName = isDuo
                ? `match:${matchkey}:duochallenges`
                : `match:${matchkey}:challenges`;

            const matchchallengesData = await redisContest.hgetData(keyName, matchchallengeid);

            if (!matchchallengesData) {
                return {
                    message: "Invalid details",
                    status: false,
                    data: {},
                };
            }

            req.query.matchkey = matchchallengesData.matchkey;

            const wallet = await redisUser.redis.hgetall(`wallet:{${req.user._id}}`);
            let bonus = parseFloat(Number(wallet.bonus || 0).toFixed(2));
            let balance = parseFloat(Number(wallet.balance || 0).toFixed(2));
            let winning = parseFloat(Number(wallet.winning || 0).toFixed(2));
            const totalBalance = bonus + balance + winning;

            let findUsableBalance = balance + winning;
            let findBonusAmount = 0;

            if (matchchallengesData.is_bonus == 1 && matchchallengesData.bonus_percentage) {
                const bonusPer = matchchallengesData.bonus_percentage;
                const entryFee = matchchallengesData.entryfee;
                const multiplier = total_team_count || 1;

                if (matchchallengesData.bonus_type === "flat") {
                    findBonusAmount = bonusPer * multiplier;
                } else {
                    findBonusAmount = ((bonusPer * multiplier) / 100) * entryFee;
                }
            }

            let usedBonus = Math.min(bonus, findBonusAmount);
            findUsableBalance += usedBonus;

            const multiplier = total_team_count || 1;
            let entryfee = matchchallengesData.entryfee * multiplier - discount_fee * multiplier;
            let remainingEntryFee = entryfee - usedBonus;

            let deductFromBalance = 0, deductFromWinning = 0, requiredAdditionalBalance = 0;

            if (findUsableBalance >= remainingEntryFee) {
                if (balance >= remainingEntryFee) {
                    deductFromBalance = remainingEntryFee;
                } else {
                    deductFromBalance = balance;
                    deductFromWinning = remainingEntryFee - balance;
                }
            } else {
                deductFromBalance = balance;
                deductFromWinning = winning;
                requiredAdditionalBalance = Math.max(0, remainingEntryFee - (balance + winning));
            }

            return {
                message: "Get amount to be used",
                status: true,
                data: {
                    usablebalance: findUsableBalance.toFixed(2),
                    usertotalbalance: totalBalance.toFixed(2),
                    entryfee: entryfee.toFixed(2),
                    bonus: usedBonus.toFixed(2),
                    totalWinning: winning.toFixed(2),
                    totalBonus: bonus.toFixed(2),
                    totalDeposit: balance.toFixed(2),
                    deductFromBalance: deductFromBalance.toFixed(2),
                    deductFromWinning: deductFromWinning.toFixed(2),
                    requiredAdditionalBalance: requiredAdditionalBalance.toFixed(2),
                },
            };
        } catch (error) {
            console.log(error);
            return {
                message: "Something went wrong",
                status: false,
                data: {},
            };
        }
    }


    /**
     * @function privateContestCreate
     * @description create private Contest
     * @param { matchkey, maximum_user, win_amount, entryfee, multi_entry, contestName }
     * @author 
     */
    async privateContestCreate(req) {
        try {
            const { matchkey, maximum_user, win_amount, entryfee, multi_entry, contestName } = req.body;
            if (maximum_user < 2) {
                return {
                    message: 'Invalid league details. You cannot create a league with less then two members.',
                    status: false,
                    data: {},
                };
            }
            // const challengeid = new mongoose.Types.ObjectId();
            let obj = {
                fantasy_type: 'Cricket',
                matchkey: mongoose.Types.ObjectId(matchkey),
                entryfee: Number(entryfee),
                win_amount: Number(win_amount),
                maximum_user: Number(maximum_user),
                minimum_user: 2,
                status: 'pending',
                contest_name: contestName || '',
                created_by: mongoose.Types.ObjectId(req.user._id),
                joinedusers: 0,
                bonus_type: '',
                pdf_created: 0,
                contest_type: 'Amount',
                megatype: 'normal',
                winning_percentage: 0,
                is_bonus: 0,
                bonus_percentage: 0,
                pricecard_type: 'Amount',
                confirmed_challenge: 0,
                is_running: 0,
                multi_entry: Number(multi_entry),
                is_private: 1,
                team_limit: 11,
                c_type: '',
                contest_cat: null,
                challenge_id: null,
                matchpricecards: [],
            }
            let challengeid = await matchContestModel.create(obj);
            if (challengeid) {
                return {
                    message: 'Challenge successfully Created.',
                    status: true,
                    data: {
                        matchchallengeid: challengeid._id,
                        entryfee: entryfee,
                        multi_entry: multi_entry
                    }
                };
            } else {
                return {
                    message: 'Error Occurred While Creating Challenge.',
                    status: false,
                    data: {}
                };
            }
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    /**
           * @function fetchAllFantasy
           * @description Gat All Contest Of A Match By there Category
           * @param { matchkey }
           * @author 
           */
    async fetchAllFantasy(req) {
        try {

            let data = await userPermissionModel.aggregate([
                {
                    $match:
                    {
                        //   userId:mongoose.Types.ObjectId(req.user.adminAssociate),
                        userId: mongoose.Types.ObjectId(req.user._id),
                    },
                },
                {
                    $lookup: {
                        from: "fantasytypes",
                        localField: "permission",
                        foreignField: "_id",
                        as: "data",
                    },
                },
                {
                    $addFields: {
                        data: {
                            $map: {
                                input: "$data",
                                as: "item",
                                in: {
                                    $mergeObjects: [
                                        "$$item",
                                        {
                                            fantasy_icon: {
                                                $concat: [
                                                    `${global.constant.IMAGE_URL}`,
                                                    "$$item.fantasy_icon",
                                                ],
                                            },
                                        },
                                        {
                                            fantasy_sportsbanner: {
                                                $concat: [
                                                    `${global.constant.IMAGE_URL}`,
                                                    "$$item.fantasy_sportsbanner",
                                                ],
                                            },
                                        },
                                        {
                                            fantasy_sportsWall: {
                                                $concat: [
                                                    `${global.constant.IMAGE_URL}`,
                                                    "$$item.fantasy_sportsWall",
                                                ],
                                            },
                                        },
                                    ],
                                },
                            },
                        },
                    },
                },
            ])
            //   return {
            //     message: 'fanatsy_types',
            //     status: true,
            //     data: data[0].data
            // }

            if (data.length == 0) {
                let category = await fantasytypes.aggregate([
                    {
                        '$match': {
                            'fantasyName': 'Cricket'
                        }
                    }, {
                        '$addFields': {
                            'fantasy_icon': {
                                '$concat': [
                                    `${global.constant.IMAGE_URL}`, '$fantasy_icon'
                                ]
                            },
                            'fantasy_sportsbanner': {
                                '$concat': [
                                    `${global.constant.IMAGE_URL}`, '$fantasy_sportsbanner'
                                ]
                            },
                            'fantasy_sportsWall': {
                                '$concat': [
                                    `${global.constant.IMAGE_URL}`, '$fantasy_sportsWall'
                                ]
                            }
                        }
                    }
                ]);
                return {
                    message: 'fanatsy_types',
                    status: true,
                    data: category
                }
            } else {
                return {
                    message: 'fanatsy_types',
                    status: true,
                    data: data[0].data
                }
            }

            // else{
            //     let category = await fantasytypes.aggregate([
            //         {
            //           '$match': {
            //             'fantasyName': 'Cricket'
            //           }
            //         }, {
            //           '$addFields': {
            //             'fantasy_icon': {
            //               '$concat': [
            //                 `${global.constant.IMAGE_URL}`, '$fantasy_icon'
            //               ]
            //                 },
            //                 'fantasy_sportsbanner': {
            //                     '$concat': [
            //                       `${global.constant.IMAGE_URL}`, '$fantasy_sportsbanner'
            //                     ]
            //                 },
            //                 'fantasy_sportsWall': {
            //                     '$concat': [
            //                       `${global.constant.IMAGE_URL}`, '$fantasy_sportsWall'
            //                     ]
            //                   }
            //           }
            //         }
            //       ]);
            //     return {
            //         message: 'fanatsy_types',
            //         status: true,
            //         data: category
            //     }
            // }
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    }

    /**
     * @function joinContestByCode
     * @description Contest Join By ContestCode
     * @param { getcode, matchkey }
     * @author 
     */
    async joinContestByCode(req) {
        try {
            const { getcode, matchkey } = req.body;
            let matchchallengeid, findReferCode;

            const code = getcode.split('-');

            if (req.body.is_PromoCode_Contest == 1) {
                let promocodeData = await contestPromoCode.findOne(
                    { "promocodes.code": req.body.getcode }
                );

                if (!promocodeData) {
                    return { message: 'This is invalid Coupon Code , Please enter valid Coupon Code', status: false, data: {} };
                }

                // Check if the promo code is already used or expired
                const promo = promocodeData.promocodes.find(promo => promo.code === req.body.getcode);
                if (promo.isUsed || promo.isExpired) {
                    return { message: 'Promo code has been already used.', status: false, data: {} };
                }

                // If valid, update promo code status to used
                promocodeData = await contestPromoCode.findOneAndUpdate(
                    { "promocodes.code": req.body.getcode },
                    {
                        $set: {
                            "promocodes.$.isUsed": true,
                            "promocodes.$.isExpired": true,
                            "promocodes.$.isUsedBy": req.user._id
                        }
                    },
                    { new: true }
                );

                matchchallengeid = promocodeData.matchchallengeid;

            } else {
                if (code[0] == 'CC$') {
                    findReferCode = await JoinedReferModel.findOne({ matchkey: matchkey, refercode: getcode });
                    if (!findReferCode) return { message: 'This is invalid Coupon Code , Please enter valid Coupon Code', status: false, data: {} };
                    matchchallengeid = findReferCode.challengeid;
                } else {
                    findReferCode = await userLeagueModel.findOne({ matchkey: matchkey, refercode: getcode });
                    if (!findReferCode) return { message: 'This is invalid Coupon Code , Please enter valid Coupon Code', status: false, data: {} };
                    matchchallengeid = findReferCode.challengeid;
                }
            }

            // Continue with the redis and challenge validation logic

            let keyname = `joinContestByCode-${matchchallengeid}`;
            let redisdata = await redisjoinTeams.getkeydata(keyname);
            let matchchallenge;
            if (redisdata) {
                matchchallenge = redisdata;
            } else {
                matchchallenge = await matchContestModel.findOne({ _id: mongoose.Types.ObjectId(matchchallengeid) });
                redisjoinTeams.setkeydata(keyname, matchchallenge, 60 * 60 * 4);
            }

            if (!matchchallenge) {
                return { message: 'This is invalid Coupon Code , Please enter valid Coupon Code', status: false, data: {} };
            }

            const joinLeagues = await userLeagueModel.find({
                userid: req.user._id,
                challengeid: matchchallenge._id,
            }).countDocuments();

            let teamLimit = matchchallenge.multi_entry == 0 ? 1 : matchchallenge.team_limit;

            if (matchchallenge.multi_entry == 1) {
                if (joinLeagues == matchchallenge.team_limit) {
                    return { message: 'Already used', status: false, data: { multi_entry: 1 } };
                } else if (matchchallenge.status == 'closed') {
                    return { message: 'Challenge closed', status: false, data: { matchchallengeid: '', entryfee: '', multi_entry: 1, team_limit: teamLimit } };
                } else {
                    return { message: 'Challenge opened', status: true, data: { matchchallengeid: matchchallenge._id, entryfee: matchchallenge.entryfee, multi_entry: 1, team_limit: teamLimit } };
                }
            } else {
                if (joinLeagues != 0) {
                    return { message: 'Already used', status: false, data: { multi_entry: 0 } };
                } else if (matchchallenge.status == 'closed') {
                    return { message: 'Challenge closed', status: false, data: { matchchallengeid: '', entryfee: '', multi_entry: 0, team_limit: teamLimit } };
                } else {
                    return { message: 'Challenge opened', status: true, data: { matchchallengeid: matchchallenge._id, entryfee: matchchallenge.entryfee, multi_entry: 0, team_limit: teamLimit } };
                }
            }

        } catch (error) {
            console.log('error', error);
        }
    }

    /**
   * @function substitutePlayerReplace
   * @description replaceSubstitutePlayer
   * @param { playerId, replaceSubstitutePlayerId }
   * @author 
   */
    async substitutePlayerReplace(req) {
        try {
            const { matchkey, fantasyType, playerId, SubstitutePlayerId, teamId } = req.body;
            const myJoinTeam = await userTeamModel.findOne({
                _id: teamId,
                type: { $regex: fantasyType, $options: 'i' },
                matchkey: matchkey,
                players: { $in: playerId }

            }, {
                updateStatus: 1
            });
            if (!myJoinTeam) {
                return {
                    message: 'Data not found !!',
                    status: false
                }
            };
            if (myJoinTeam.updateStatus == true) {
                return {
                    message: 'players already update!!',
                    status: false
                }
            };

            const updateplayers = await userTeamModel.findByIdAndUpdate(
                { _id: myJoinTeam._id },
                {
                    // $set: {
                    substitute_id: null,
                    updateStatus: true,
                    $pull: { players: new mongoose.Types.ObjectId(playerId) },
                },
                { new: true }
            );
            const updateplayers1 = await userTeamModel.findByIdAndUpdate(
                { _id: myJoinTeam._id },
                {

                    $push: { players: new mongoose.Types.ObjectId(SubstitutePlayerId) }
                },
                { new: true }
            );
            return {
                message: 'player update successfully',
                status: true,
                data: updateplayers1
            }
        } catch (error) {
            console.log(error)
        }
    }

}
module.exports = new contestServices();