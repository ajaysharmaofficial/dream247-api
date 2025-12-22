const mongoose = require('mongoose');
const randomstring = require("randomstring");
const moment = require("moment");
const matchchallengesModel = require('../../../models/matchContestModel');
// const dualgamematchChallengersModel = require('../../../models/dualgamematchChallengersModel');
const userLeagueModel = require('../../../models/userLeagueModel');
const userModel = require('../../../models/userModel');
const TransactionModel = require('../../../models/walletTransactionModel');
const JoinedReferModel = require('../../../models/JoinedReferModel');
const userLeaderBoardModel = require('../../../models/userLeaderBoardModel');
const matchesModel = require('../../../models/matchesModel');
// const contestPromoCode = require('../../../models/contestPromoCode');
const { sendToQueue } = require('../../../utils/kafka');
const userTeamModel = require('../../../models/userTeamModel');
const configModel = require("../../../models/configModel");
const { getkeydata, setkeydata, redis } = require('../../../utils/redis/redisjoinTeams');
const redisjoinTeams = require('../../../utils/redis/redisjoinTeams');
// const { getMatchPlayrs } = require("../../../utils/s3");
const redisLeaderboards = require('../../../utils/redis/redisLeaderboard');
const redisContest = require('../../../utils/redis/redisContest');
const redisUser = require('../../../utils/redis/redisUser');
const redisMain = require('../../../utils/redis/redisMain');
const RedisUpdateChallenge = require('../../../utils/redisUpdateChallenge');
const redisUpdateChallenge = new RedisUpdateChallenge();
const { matchTimeDifference, matchRemTime } = require("../../../utils/matchTimeDiffrence");


const delay = async (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
class contestServices {
    constructor() {
        return {
            dbCheck: this.dbCheck.bind(this),
            joinContest: this.joinContest.bind(this),
            contestJoin: this.contestJoin.bind(this),
            duoContestJoined: this.duoContestJoined.bind(this),
            closedJoinDuoContest: this.closedJoinDuoContest.bind(this),
            replaceDuoPlayer: this.replaceDuoPlayer.bind(this),
            joinContestNew: this.joinContestNew.bind(this),
            closedJoinContest: this.closedJoinContest.bind(this),
            contestJoinedByCode: this.contestJoinedByCode.bind(this),
            updateContestCount: this.updateContestCount.bind(this)
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
                    await redisMain.healthCheck().then((res) => res === "PONG"),
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



    async getMatchTime(start_date) {
        const currentdate = new Date();
        const ISTTime = moment().format("YYYY-MM-DD HH:mm:ss");
        if (ISTTime >= start_date) {
            return false;
        } else {
            return true;
        }
    }

    async deductBalanceForChallenge(challengeDetails, userBalances, count) {
        try {
            let { bonus, winning, balance } = userBalances;
            let totalBonusUsed = 0;
            let totalWinningUsed = 0;
            let totalBalanceUsed = 0;

            for (let i = 0; i < count; i++) {

                let remainingFee = challengeDetails.entryfee - Number(challengeDetails.discount_fee);
                let bonusUseAmount = 0;

                if (remainingFee > 0 && bonus >= remainingFee) {
                    bonusUseAmount = remainingFee;
                    bonus -= remainingFee;
                    remainingFee = 0;
                } else if (remainingFee > 0) {
                    bonusUseAmount = bonus;
                    remainingFee -= bonus;
                    bonus = 0;
                }

                if (remainingFee > 0) {
                    return {
                        status: i > 0 ? true : false,
                        finalBalances: { bonus, winning, balance },
                        finalUsedBalances: {
                            bonusUsed: bonusUseAmount,
                            winningUsed: 0,
                            balanceUsed: 0,
                        },
                        count: i,
                    };
                }

                totalBonusUsed += bonusUseAmount;
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
    async updateContestCount(req) {
        try {
            const { matchkey } = req.query;
            const matchchallengesData = await matchchallengesModel.find({ matchkey }, { _id: 1 });
            if (matchchallengesData.length) {
                for (let contest of matchchallengesData) {
                    const challengeCounterKey = `match:${matchkey}:challenge:${contest._id.toString()}:joinedTeams`;
                    const userChallengeCounterKey = `match:${matchkey}:challenge:${contest._id.toString()}:user:${req.user._id.toString()}:joinedTeams`;

                    let currentChallengeCount = await userLeagueModel.countDocuments({
                        'matchkey': mongoose.Types.ObjectId(matchkey),
                        'challengeid': mongoose.Types.ObjectId(contest._id.toString())
                    });


                    console.log('currentChallengeCount---', currentChallengeCount);
                    if (currentChallengeCount) {
                        await redis.set(challengeCounterKey, currentChallengeCount);
                        await matchchallengesModel.findOneAndUpdate({ _id: contest._id }, { 'joinedusers': currentChallengeCount });
                    }

                    // }
                    // if (!currentUserCount) {
                    let currentUserCount = await userLeagueModel.countDocuments({
                        'matchkey': mongoose.Types.ObjectId(matchkey),
                        'challengeid': mongoose.Types.ObjectId(contest._id.toString()),
                        'userid': mongoose.Types.ObjectId(req.user._id.toString())
                    });
                    console.log('currentUserCount---', currentUserCount);
                    if (currentUserCount) {
                        await redis.set(userChallengeCounterKey, currentUserCount);
                    }
                }
            }
            return {
                status: true,
            };
        } catch (e) {
            console.log(e)
        }
    }


    async joinContest(req) {
        try {
            const { matchchallengeid, jointeamid, discount_fee } = req.body;
            const userId = req.user._id;
            let totalchallenges = 0,
                totalmatches = 0,
                totalseries = 0,
                joinedTeams = 0,
                aggpipe = [];

            delay(10)
            aggpipe.push(
                { $match: { _id: mongoose.Types.ObjectId(matchchallengeid), } },
                {
                    $addFields: {
                        entryfee: { $subtract: ['$entryfee', '$discount_fee'] },
                    },
                },
                {
                    $lookup: {
                        from: 'matches',
                        localField: 'matchkey',
                        foreignField: '_id',
                        as: 'listmatch',
                    },
                }
            );

            const matchchallengesData = await matchchallengesModel.aggregate(aggpipe);

            if (!matchchallengesData.length) {
                return {
                    message: 'Match  Challenge Not Found',
                    status: false,
                    data: {}
                };
            }

            const [matchchallenge] = matchchallengesData;
            if (matchchallenge.status == 'closed') {
                return {
                    message: 'Match Challenge has been closed',
                    status: false,
                    data: {}
                };
            }

            const { _id: matchchallengesDataId, listmatch, multi_entry, entryfee } = matchchallenge;
            const [{ _id: listmatchId, series: seriesId, start_date: matchStartDate }] = listmatch;

            const challengeCounterKey = `match:${listmatchId}:challenge:${matchchallengeid}:joinedTeams`;
            const userChallengeCounterKey = `match:${listmatchId}:challenge:${matchchallengeid}:user:${userId}:joinedTeams`;


            // const matchTime = await this.getMatchTime(matchStartDate);

            const matchTime = await this.getMatchTime(matchStartDate);

            if (!matchTime) {
                return {
                    message: 'Match has been closed, You cannot join league now.',
                    status: false,
                    data: {}
                };
            }

            const jointeamids = jointeamid.split(',').map(id => id.trim());
            // Redis Key for storing teams
            const redisKey = `match:${listmatchId}:user:${userId}:teams`;

            let cachedTeams = await getkeydata(redisKey);
            var expRedisTime = await matchTimeDifference(listmatchId);
            // if (!cachedTeams) {
            //     cachedTeams = await userTeamModel.find({ listmatchId, userid: userId }).lean();
            //     await setkeydata(redisKey, cachedTeams, expRedisTime); // Cache for 12 hours
            // }


            if (!Array.isArray(cachedTeams) || cachedTeams.length === 0) {
                cachedTeams = [];
            }

            const cachedTeamIds = new Set(cachedTeams.map(team => team._id.toString()));

            const missingTeamIds = jointeamids.filter(id => !cachedTeamIds.has(id));

            if (missingTeamIds.length > 0) {
                const missingTeams = await userTeamModel.find({ _id: { $in: missingTeamIds }, matchkey: listmatchId, userid: userId }).lean();
                cachedTeams = [...cachedTeams, ...missingTeams];
                await setkeydata(redisKey, cachedTeams, expRedisTime);
            }
            const validTeamsCount = cachedTeams.filter(team => jointeamids.includes(team._id.toString()));
            let keyLeaderBoard = `match:${listmatchId}:challenge:${matchchallengeid}:user:${req.user._id}:userLeaderBoard`;
            let joinedLeauges = await redisLeaderboards.getMyLeaderBoard(keyLeaderBoard, req.user._id);
            if (joinedLeauges == false) {
                joinedLeauges = [];
            }
            if (!joinedLeauges || joinedLeauges.length <= 0) {
                let aggPipe = [];
                aggPipe.push({
                    $match: {
                        matchkey: mongoose.Types.ObjectId(listmatchId),
                        userId: mongoose.Types.ObjectId(req.user._id),
                        challengeid: mongoose.Types.ObjectId(matchchallengeid)
                    }
                });
                const joinData = await userLeaderBoardModel.aggregate(aggPipe);
                if (joinData.length > 0) {
                    let user = [];
                    for (let join of joinData) {
                        let redisLeaderboard = {
                            "_id": `${join._id.toString()}-${req.user._id}`,
                            "getcurrentrank": join?.joinNumber ? join.joinNumber : 11000,
                            "usernumber": 0,
                            "joinleaugeid": join.joinId,
                            "joinTeamNumber": join.teamnumber,
                            "jointeamid": join.teamId,
                            "userid": req.user._id,
                            "team": join.user_team,
                            "image": `${global.constant.IMAGE_URL}avtar1.png`,
                            "teamnumber": join.teamnumber,
                            "refercode": join.refercode
                        }
                        user.push(redisLeaderboard);
                        let keyLeaderBoard = `match:${listmatchId}:challenge:${matchchallengeid}:user:${req.user._id}:userLeaderBoard`;
                        await redisLeaderboards.storeSortedSet(keyLeaderBoard, redisLeaderboard, expRedisTime);
                    }
                    joinedLeauges = user;
                }
            }

            const [user] = await Promise.all([
                // userTeamModel.find({ _id: { $in: jointeamids } }),
                // userLeagueModel.find({
                //     matchkey: listmatchId,
                //     challengeid: matchchallenge._id,
                //     userid: userId,
                // }),
                userModel.findOne({ _id: userId }).select('userbalance user_verify team')
                // getUserData(userId)
            ]);

            if (jointeamids.length === 1 && joinedLeauges.length === 1 && jointeamid === joinedLeauges[0]?.jointeamid.toString()) {
                return { message: 'Contest Already joined', status: false, data: {} };
            }

            if (validTeamsCount.length !== jointeamids.length) {
                return {
                    message: 'Invalid Team',
                    status: false,
                    data: {}
                };
            }

            if (jointeamids.length == 1 && joinedLeauges.length == 1 && jointeamid === joinedLeauges[0]?.jointeamid.toString()) {
                return {
                    message: 'Contest Already joined',
                    status: false,
                    data: {}
                };
            }


            if (multi_entry === 0) {

                if (joinedLeauges.length > 0 || jointeamids.length > 1) {
                    return {
                        message: 'Contest Already joined or You can only join once.',
                        status: false,
                        data: {}
                    };
                }
            } else {

                if (joinedLeauges.length >= matchchallenge.team_limit) {
                    return {
                        message: 'You cannot join with more teams now.',
                        status: false,
                        data: {}
                    };
                }
            }

            if (!user?.userbalance) {
                return { message: 'Insufficient balance', status: false, data: {} };
            }

            const parseBalance = (value) => parseFloat(value.toFixed(2));
            let { bonus, balance, winning, extraCash } = user?.userbalance;
            const totalBalance = parseBalance(bonus) + parseBalance(balance) + parseBalance(winning) + parseBalance(extraCash);
            let tranid = '';
            let mainbal = 0, mainbonus = 0, mainwin = 0;

            const updateUserBalance = async (userId, balance, bonus, extraCash, winning, increment = {}) => {
                // const userObj = {
                //     'userbalance.balance': balance,
                //     'userbalance.bonus': bonus,
                //     'userbalance.extraCash': extraCash,
                //     'userbalance.winning': winning,
                //     $inc: increment,
                // };
                // await userModel.findOneAndUpdate({ _id: userId }, userObj, { new: true });

                // const redisKey = `user:${userId}`;
                // const redisUserObj = {
                //     userbalance: {
                //         balance,
                //         bonus,
                //         extraCash,
                //         winning,
                //     },
                //     user_verify: user?.user_verify || null,
                //     team: user?.team || ""
                // };

                // setkeydata(redisKey, redisUserObj, expRedisTime);
                const userObj = {
                    'userbalance.balance': balance,
                    'userbalance.bonus': bonus,
                    'userbalance.extraCash': extraCash,
                    'userbalance.winning': winning,
                    $inc: increment,
                };
                const msg = {
                    filter: { _id: userId },
                    payload: userObj,
                    modelName: "user"
                }
                sendToQueue('updateQueue', msg);
            };

            const createTransaction = async (userId, entryfee, totalBalance, matchchallengeid, balances, tranid, count) => {


                // const transactionData = {
                //     type: 'Contest Joining Fee',
                //     contestdetail: `${entryfee}-${count}`,
                //     amount: entryfee * count,
                //     total_available_amt: totalBalance - entryfee * count,
                //     transaction_by: global.constant.TRANSACTION_BY.WALLET,
                //     challengeid: matchchallengeid,
                //     userid: userId,
                //     paymentstatus: global.constant.PAYMENT_STATUS_TYPES.CONFIRMED,
                //     bal_bonus_amt: balances.bonus,
                //     bal_win_amt: balances.winning,
                //     bal_fund_amt: balances.balance,
                //     extra_fund_amt: balances?.extraCash || 0,
                //     cons_amount: mainbal,
                //     cons_bonus: mainbonus,
                //     cons_win: mainwin,
                //     transaction_id: tranid,
                // };

                // await TransactionModel.create(transactionData);

                const transactionData = {
                    type: 'Contest Joining Fee',
                    contestdetail: `${entryfee}-${count}`,
                    amount: entryfee * count,
                    total_available_amt: totalBalance - entryfee * count,
                    transaction_by: constant.TRANSACTION_BY.WALLET,
                    challengeid: matchchallengeid,
                    userid: userId,
                    paymentstatus: constant.PAYMENT_STATUS_TYPES.CONFIRMED,
                    bal_bonus_amt: balances.bonus,
                    bal_win_amt: balances.winning,
                    bal_fund_amt: balances.balance,
                    extra_fund_amt: balances?.extraCash || 0,
                    cons_amount: balances.mainbal,
                    cons_bonus: balances.mainbonus,
                    cons_win: balances.mainwin,
                    transaction_id: tranid,
                };
                const msg = {
                    payload: transactionData,
                    modelName: "wallettransactions"
                }
                sendToQueue('createQueue', msg);
            };

            if (entryfee > 0) {
                const randomStr = randomstring.generate({ charset: 'alphanumeric', length: 4, });
                tranid = `${global.constant.APP_SHORT_NAME}-${Date.now()}-${randomStr}`;
            }

            const coupon = randomstring.generate({ charset: 'alphanumeric', length: 4, });
            let referCode = `${global.constant.APP_SHORT_NAME}-${Date.now()}${coupon}`;
            let shouldBreakLoop = false;


            // const results = await userLeagueModel.find({
            //     userid: userId,
            //     $or: [
            //         { seriesid: seriesId },
            //         { listmatchId: listmatchId },
            //         { challengeid: matchchallengeid }
            //     ]
            // }).lean();
            // const isSeriesJoined = results.some(result => result.seriesid.toString() === seriesId.toString());
            // const isMatchJoined = results.some(result => result?.matchkey.toString() === listmatchId.toString());
            // const isChallengeJoined = results.some(result => result.challengeid.toString() === matchchallengeid.toString());

            for (const jointeam of validTeamsCount) {

                let [currentChallengeCount, currentUserCount] = await Promise.all([
                    redis.get(challengeCounterKey),
                    redis.get(userChallengeCounterKey)
                ]);
                // if (!currentChallengeCount) {
                // currentChallengeCount = await userLeagueModel.countDocuments({
                //     'matchkey': mongoose.Types.ObjectId(listmatchId),
                //     'challengeid': mongoose.Types.ObjectId(matchchallengeid)
                // });
                // console.log('currentChallengeCount---', currentChallengeCount);
                // if (currentChallengeCount) {
                //     await redis.incrby(challengeCounterKey, currentChallengeCount);
                // }

                // // }
                // // if (!currentUserCount) {
                // currentUserCount = await userLeagueModel.countDocuments({
                //     'matchkey': mongoose.Types.ObjectId(listmatchId),
                //     'challengeid': mongoose.Types.ObjectId(matchchallengeid),
                //     'userid': mongoose.Types.ObjectId(userId)
                // });
                // console.log('currentUserCount---', currentUserCount);
                // if (currentUserCount) {
                //     await redis.incrby(userChallengeCounterKey, currentUserCount);
                // }
                // }

                const challengeMaxTeamCount = parseInt(currentChallengeCount || '0');
                const userTeamCount = parseInt(currentUserCount || '0');
                if (multi_entry > 0 && userTeamCount >= matchchallenge.team_limit) {
                    break;
                }
                const isTeamJoined = joinedLeauges.some(item => item.jointeamid.toString() == jointeam._id);
                if (!isTeamJoined) {
                    if (matchchallenge.contest_type == 'Amount' && challengeMaxTeamCount >= matchchallenge.maximum_user) {
                        // totalchallenges = (!isChallengeJoined && joinedTeams > 0) ? 1 : 0;
                        // totalmatches = (!isMatchJoined && joinedTeams > 0) ? 1 : 0;
                        // totalseries = (!isSeriesJoined && joinedTeams > 0) ? 1 : 0;

                        totalchallenges = 0;
                        totalmatches = 0;
                        totalseries = 0;


                        let updateOperations = [
                            matchchallengesModel.findOneAndUpdate(
                                { _id: mongoose.Types.ObjectId(matchchallengeid) },
                                { status: 'closed' },
                                { new: true }
                            )
                        ];

                        if (entryfee > 0) {
                            updateOperations.push(
                                createTransaction(userId, entryfee, totalBalance, matchchallengeid, { bonus, balance, winning }, tranid, joinedTeams),
                                updateUserBalance(userId, balance, bonus, extraCash, winning, { totalchallenges, totalmatches, totalseries })
                            );
                        }

                        await Promise.all(updateOperations);


                        // await Promise.all([
                        //     createTransaction(userId, entryfee, totalBalance, matchchallengeid, { bonus, balance, winning }, tranid, joinedTeams),
                        //     updateUserBalance(userId, balance, bonus, extraCash, winning, { totalchallenges, totalmatches, totalseries }),
                        //     matchchallengesModel.findOneAndUpdate({ _id: mongoose.Types.ObjectId(matchchallengeid) }, { status: 'closed' }, { new: true })
                        // ]);
                        shouldBreakLoop = true;
                        break;
                    }

                    const { status, finalBalances, finalUsedBalances, count: successfulChallenges } = await this.deductBalanceForChallenge(
                        matchchallenge,
                        { bonus, balance, winning },
                        1
                    );

                    if (joinedTeams == 0 && !status) {
                        return { message: 'Insufficient balance', status: false, data: {} };
                    }

                    mainbal += finalUsedBalances?.balanceUsed || 0;
                    mainbonus += finalUsedBalances?.bonusUsed || 0;
                    mainwin += finalUsedBalances?.winningUsed || 0;

                    bonus = finalBalances?.bonus || 0;
                    balance = finalBalances?.balance || 0;
                    winning = finalBalances?.winning || 0;
                    if (status && successfulChallenges > 0) {
                        await redis.incr(challengeCounterKey);
                        await redis.incr(userChallengeCounterKey);

                        // const joinLeaugeResult = await userLeagueModel.create({
                        //     userid: req.user._id,
                        //     challengeid: matchchallengesDataId,
                        //     teamid: jointeam._id,
                        //     matchkey: listmatchId,
                        //     seriesid: seriesId,
                        //     transaction_id: tranid,
                        //     refercode: referCode,
                        //     teamnumber: jointeam.teamnumber,
                        //     leaugestransaction: {
                        //         user_id: userId,
                        //         bonus: finalUsedBalances?.bonusUsed || 0,
                        //         balance: finalUsedBalances?.balanceUsed || 0,
                        //         winning: finalUsedBalances?.winningUsed || 0
                        //     },
                        //     userData: {
                        //         userId: req.user._id,
                        //         image: "",
                        //         team: req.user.user_team,
                        //     },
                        //     matchData: {
                        //         matchkey: matchchallenge.matchData.matchkey,
                        //         realMatchkey: matchchallenge.matchData.realMatchkey,
                        //         startDate: matchchallenge.matchData.startDate,
                        //         status: "",
                        //     }
                        // });

                        // const userLeaderBoard = await userLeaderBoardModel.create({
                        //     userId: req.user._id,
                        //     challengeid: matchchallengesDataId,
                        //     teamId: jointeam._id,
                        //     matchkey: listmatchId,
                        //     user_team: user.team,
                        //     teamnumber: jointeam.teamnumber,
                        //     captain: jointeam.captain,
                        //     vicecaptain: jointeam.vicecaptain,
                        //     playersData: jointeam.players,
                        //     joinId: joinLeaugeResult._id,
                        //     contest_winning_type: matchchallenge.amount_type,
                        //     joinNumber: challengeMaxTeamCount,
                        //     userData: {
                        //         userId: req.user._id,
                        //         image: "",
                        //         team: req.user.user_team,
                        //     },
                        //     matchData: {
                        //         matchkey: matchchallenge.matchData.matchkey,
                        //         realMatchkey: matchchallenge.matchData.realMatchkey,
                        //         startDate: matchchallenge.matchData.startDate,
                        //         status: "",
                        //     }
                        // });
                        let leaderBoardId = new mongoose.Types.ObjectId();
                        let joinId = new mongoose.Types.ObjectId();
                        let redisLeaderboard = {
                            "_id": `${leaderBoardId.toString()}`,
                            "getcurrentrank": challengeMaxTeamCount,
                            "usernumber": 0,
                            "joinleaugeid": joinId,
                            "joinTeamNumber": Number(jointeam.teamnumber),
                            "jointeamid": jointeam._id,
                            "userid": req.user._id,
                            "team": user.team,
                            "image": `${global.constant.IMAGE_URL}team_image.png`,
                            "teamnumber": jointeam.teamnumber,
                            "refercode": referCode
                        }

                        const msg = {
                            leagueData: {
                                _id: joinId,
                                userid: req.user._id,
                                challengeid: matchchallengesDataId,
                                teamid: jointeam._id,
                                matchkey: listmatchId,
                                seriesid: seriesId,
                                transaction_id: tranid,
                                refercode: referCode,
                                teamnumber: jointeam.teamnumber,
                                leaugestransaction: {
                                    user_id: userId,
                                    bonus: finalUsedBalances?.bonusUsed || 0,
                                    balance: finalUsedBalances?.balanceUsed || 0,
                                    winning: finalUsedBalances?.winningUsed || 0
                                }
                            },
                            leaderBoardData: {
                                _id: leaderBoardId,
                                userId: req.user._id,
                                challengeid: matchchallengesDataId,
                                teamId: jointeam._id,
                                matchkey: listmatchId,
                                user_team: user.team,
                                teamnumber: jointeam.teamnumber,
                                captain: jointeam.captain,
                                vicecaptain: jointeam.vicecaptain,
                                playersData: jointeam.players,
                                joinId: joinId,
                                contest_winning_type: matchchallenge.amount_type,
                                joinNumber: challengeMaxTeamCount
                            },
                            matchchallengeid,
                            userId,
                            listmatchId,
                            teamnumber: jointeam.teamnumber,
                            redisLeaderboard
                        }

                        let redisUserChallenge = {
                            "_id": `${matchchallengeid.toString()}`,
                            "getcurrentrank": userTeamCount + 1,
                            "matchkey": listmatchId
                        }
                        var expRedisTime = await matchTimeDifference(listmatchId);
                        let keyUserJoinedChallenge = `match:${listmatchId}:user:${userId}:joinedContests`;
                        await redisLeaderboards.storeSortedSet(keyUserJoinedChallenge, redisUserChallenge, expRedisTime);

                        let keyChallengeLeaderBoard = `match:${listmatchId}:challenge:${matchchallengeid}:challengeLeaderBoard`;
                        await redisLeaderboards.storeSortedSet(keyChallengeLeaderBoard, redisLeaderboard, expRedisTime);
                        redisLeaderboard._id = `${leaderBoardId.toString()}-${userId}`;
                        let keyLeaderBoard = `match:${listmatchId}:challenge:${matchchallengeid}:user:${userId}:userLeaderBoard`;
                        await redisLeaderboards.storeSortedSet(keyLeaderBoard, redisLeaderboard, expRedisTime);

                        sendToQueue('createLeaderBoard', msg);
                        // userLeaderBoardArr.push(redisLeaderboard);
                        joinedTeams++;
                    }
                }
            }


            if (shouldBreakLoop) {
                return { message: 'League is Closed', status: false, data: {} };
            }

            totalchallenges = 0;
            totalmatches = 0;
            totalseries = 0;

            const totalChallengeJoined = await redis.get(challengeCounterKey);

            let updateOperations = [
                matchchallengesModel.findOneAndUpdate({ _id: mongoose.Types.ObjectId(matchchallengeid) }, { joinedusers: totalChallengeJoined }),
            ];

            if (entryfee > 0) {
                updateOperations.push(
                    createTransaction(userId, entryfee, totalBalance, matchchallengeid, { bonus, balance, winning }, tranid, joinedTeams),
                    updateUserBalance(userId, balance, bonus, extraCash, winning, { totalchallenges, totalmatches, totalseries })
                );
            }

            await Promise.all(updateOperations);

            // await Promise.all([
            //     matchchallengesModel.findOneAndUpdate({ _id: mongoose.Types.ObjectId(matchchallengeid) }, { joinedusers: totalChallengeJoined }),
            //     createTransaction(userId, entryfee, totalBalance, matchchallengeid, { bonus, balance, winning }, tranid, joinedTeams),
            //     updateUserBalance(userId, balance, bonus, extraCash, winning, { totalchallenges, totalmatches, totalseries })
            // ]);

            sendToQueue('createQueue', { payload: { title: `Contest Joined`, userid: userId }, modelName: "notification" }),
                sendToQueue('updateQueue', {
                    filter: { _id: matchchallengeid },
                    payload: { joinedusers: totalChallengeJoined },
                    modelName: "matchcontest"
                })

            return {
                message: 'Contest Joined',
                status: true,
                data: {
                    joinedusers: totalChallengeJoined,
                    referCode: referCode
                }
            };

        } catch (e) {
            console.log(e)
            throw e;
        }
    }

    async contestJoin(req) {
        try {
            const { matchchallengeid, jointeamid, discount_fee, matchkey } = req.body;
            const userId = req.user._id;
            let totalchallenges = 0,
                totalmatches = 0,
                totalseries = 0,
                joinedTeams = 0,
                aggpipe = [];
            let appKey = "appSettingData";
            let appSetting = await redisMain.getkeydata(appKey);
            if (!appSetting?.joinContest) {
                return {
                    message: 'Contest joining is disabled right now',
                    status: false,
                    data: {}
                };
            }
            // let listMatchKey = `challengeId_${matchchallengeid}`;
            // matchkey = await redisContest.getkeydata(listMatchKey);
            const keyName = `match:${matchkey}:challenges`; // Redis Hash key
            const matchchallenge = await redisContest.hgetData(keyName, matchchallengeid);
            if (!matchchallenge) {
                return {
                    message: 'Match  Challenge Not Found',
                    status: false,
                    data: {}
                };
            }

            const { _id: matchchallengesDataId, multi_entry, contest_cat, win_amount, maximum_user } = matchchallenge;
            let entryfee = matchchallenge.entryfee - discount_fee;
            if (matchchallenge.status == 'closed' || matchchallenge.joinedusers == maximum_user) {
                if (matchchallenge.is_running == 1) {
                    return {
                        message: 'Match Challenge has been closed',
                        status: false,
                        is_closed: true,
                        data: { is_running: 1, entryfee: entryfee, win_amount: win_amount, maximum_user: maximum_user, jointeamid: jointeamid, discount_fee: discount_fee, matchkey: matchkey }
                    };
                } else {
                    return {
                        message: 'Match Challenge has been closed',
                        status: false,
                        data: {}
                    };
                }
            }

            let keyname = `listMatchesModel-${matchkey}`
            let listmatch = await getkeydata(keyname);
            if (!listmatch) {
                listmatch = await matchesModel.findOne({ _id: new mongoose.Types.ObjectId(req.params.matchId) }).lean();
                await setkeydata(keyname, listmatch || {}, 20 * 24 * 60 * 60);
            }
            const { _id: listmatchId, series: seriesId, start_date: matchStartDate } = listmatch;

            const challengeCounterKey = `match:${listmatchId}:challenge:${matchchallengeid}:joinedTeams`;
            const userChallengeCounterKey = `match:${listmatchId}:challenge:${matchchallengeid}:user:${userId}:joinedTeams`;

            const totalChallengeJoinedUser = await redis.get(challengeCounterKey);



            // If contest is full, update status to "closed"
            if (totalChallengeJoinedUser >= maximum_user) {
                let fieldsToUpdateData = {
                    joinedusers: totalChallengeJoinedUser,
                    status: 'closed'
                };
                await redisUpdateChallenge.insertRedisFields(listmatchId, contest_cat, matchchallengeid, fieldsToUpdateData);
                sendToQueue('contestClosed', {
                    filter: { _id: matchchallengeid },
                    payload: fieldsToUpdateData,
                    modelName: 'matchcontest'
                });

                return {
                    message: 'Contest has been closed, You cannot join now.',
                    status: false,
                    data: {}
                };
            }


            // const matchTime = await this.getMatchTime(matchStartDate);

            const matchTime = await this.getMatchTime(matchStartDate);

            if (!matchTime) {
                return {
                    message: 'Match has been closed, You cannot join league now.',
                    status: false,
                    data: {}
                };
            }

            const jointeamids = jointeamid.split(',').map(id => id.trim());
            // Redis Key for storing teams
            const redisKey = `match:${listmatchId}:user:${userId}:teams`;

            let cachedTeams = await getkeydata(redisKey);
            // if (!cachedTeams) {
            //     cachedTeams = await userTeamModel.find({ listmatchId, userid: userId }).lean();
            //     await setkeydata(redisKey, cachedTeams, expRedisTime); // Cache for 12 hours
            // }


            if (!Array.isArray(cachedTeams) || cachedTeams.length === 0) {
                cachedTeams = [];
            }

            const cachedTeamIds = new Set(cachedTeams.map(team => team._id.toString()));

            const missingTeamIds = jointeamids.filter(id => !cachedTeamIds.has(id));

            if (missingTeamIds.length > 0) {
                const missingTeams = await userTeamModel.find({ _id: { $in: missingTeamIds }, matchkey: listmatchId, userid: userId }).lean();
                cachedTeams = [...cachedTeams, ...missingTeams];
                await setkeydata(redisKey, cachedTeams, expRedisTime);
            }
            const validTeamsCount = cachedTeams.filter(team => jointeamids.includes(team._id.toString()));
            let keyLeaderBoard = `match:${listmatchId}:challenge:${matchchallengeid}:user:${req.user._id}:userLeaderBoard`;
            let joinedLeauges = await redisLeaderboards.getMyLeaderBoard(keyLeaderBoard, req.user._id);
            if (joinedLeauges == false) {
                joinedLeauges = [];
            }


            if (jointeamids.length === 1 && joinedLeauges.length === 1 && jointeamid === joinedLeauges[0]?.jointeamid.toString()) {
                return { message: 'Contest Already joined', status: false, data: {} };
            }

            if (validTeamsCount.length !== jointeamids.length) {
                return {
                    message: 'Invalid Team',
                    status: false,
                    data: {}
                };
            }

            if (jointeamids.length == 1 && joinedLeauges.length == 1 && jointeamid === joinedLeauges[0]?.jointeamid.toString()) {
                return {
                    message: 'Contest Already joined',
                    status: false,
                    data: {}
                };
            }


            if (multi_entry === 0) {

                if (joinedLeauges.length > 0 || jointeamids.length > 1) {
                    return {
                        message: 'Contest Already joined or You can only join once.',
                        status: false,
                        data: {}
                    };
                }
            } else {

                if (joinedLeauges.length >= matchchallenge.team_limit) {
                    return {
                        message: 'You cannot join with more teams now.',
                        status: false,
                        data: {}
                    };
                }
            }
            const user = await redisUser.getUser(userId);


            let userbalance = await redisUser.redis.hgetall(`wallet:{${userId}}`);


            if (!userbalance) {
                await redisUser.setDbtoRedisWallet(userId);
                userbalance = await redisUser.redis.hgetall(`wallet:{${userId}}`);
            }
            //remove this
            // const user = await userModel.findOne({ _id: userId }).select('userbalance user_verify team')


            if (!userbalance) {
                return { message: 'Insufficient balance', status: false, data: {} };
            }

            // 
            let bonus = Number(userbalance.bonus);
            let balance = Number(userbalance.balance);
            let winning = Number(userbalance.winning);
            let extraCash = 0;
            // let { bonus, balance, winning, extraCash } = userbalance;
            const parseBalance = (value) => parseFloat(value.toFixed(2));
            const totalBalance = parseBalance(bonus) + parseBalance(balance) + parseBalance(winning) + extraCash;
            let tranid = '';
            let mainbal = 0, mainbonus = 0, mainwin = 0;
            // const createTransaction = async (userId, entryfee, totalBalance, matchchallengeid, balances, tranid, count) => {
            const createTransaction = async (userId, balance, bonus, extraCash, winning, increment = {}, entryfee, totalBalance, matchchallengeid, balances,
                tranid,
                count
            ) => {
                // 1. Prepare balance update message
                const userUpdateMsg = {
                    filter: { _id: userId },
                    payload: {
                        'userbalance.balance': balance,
                        'userbalance.bonus': bonus,
                        'userbalance.winning': winning,
                        'userbalance.extraCash': extraCash,
                        $inc: increment,
                    },
                    modelName: "user"
                };
                // 2. Prepare transaction message
                const transactionData = {
                    type: 'Contest Joining Fee',
                    contestdetail: `${entryfee}-${count}`,
                    amount: entryfee * count,
                    total_available_amt: totalBalance - entryfee * count,
                    transaction_by: constant.TRANSACTION_BY.WALLET,
                    challengeid: matchchallengeid,
                    userid: userId,
                    paymentstatus: constant.PAYMENT_STATUS_TYPES.CONFIRMED,
                    bal_bonus_amt: balances.bonus,
                    bal_win_amt: balances.winning,
                    bal_fund_amt: balances.balance,
                    extra_fund_amt: balances?.extraCash || 0,
                    cons_amount: balances.mainbal,
                    cons_bonus: balances.mainbonus,
                    cons_win: balances.mainwin,
                    transaction_id: tranid,
                };

                const transactionMsg = {
                    payload: transactionData,
                    modelName: "wallettransactions"
                };
                const walletUpdate = {
                    balance: balance,
                    bonus: bonus,
                    winning: winning,
                    extraCash: extraCash
                };
                transactionData.match_name = listmatch.short_name;
                transactionData.transaction_type = 'Debit';

                await redisUser.saveTransactionToRedis(userId, walletUpdate, transactionData);

                // 3. Send to respective queues
                sendToQueue('updateUserQueue', userUpdateMsg);
                sendToQueue('createTransactionQueue', transactionMsg);
            };

            if (entryfee > 0) {
                const randomStr = randomstring.generate({ charset: 'alphanumeric', length: 4, });
                tranid = `${global.constant.APP_SHORT_NAME}-${Date.now()}-${randomStr}`;
            }

            const coupon = randomstring.generate({ charset: 'alphanumeric', length: 4, });
            let referCode = `${global.constant.APP_SHORT_NAME}-${Date.now()}${coupon}`;
            let shouldBreakLoop = false;

            for (const jointeam of validTeamsCount) {

                let [currentChallengeCount, currentUserCount] = await Promise.all([
                    redis.get(challengeCounterKey),
                    redis.get(userChallengeCounterKey)
                ]);

                const challengeMaxTeamCount = parseInt(currentChallengeCount || '0');
                const userTeamCount = parseInt(currentUserCount || '0');
                if (multi_entry > 0 && userTeamCount >= matchchallenge.team_limit) {
                    break;
                }
                const isTeamJoined = joinedLeauges.some(item => item.jointeamid.toString() == jointeam._id);
                if (!isTeamJoined) {
                    if (matchchallenge.contest_type == 'Amount' && challengeMaxTeamCount >= matchchallenge.maximum_user) {
                        totalchallenges = 0;
                        totalmatches = 0;
                        totalseries = 0;


                        let updateOperations = [
                            matchchallengesModel.findOneAndUpdate(
                                { _id: mongoose.Types.ObjectId(matchchallengeid) },
                                { status: 'closed' },
                                { new: true }
                            )
                        ];

                        if (entryfee > 0) {
                            updateOperations.push(
                                createTransaction(userId, balance, bonus, extraCash, winning, { totalchallenges, totalmatches, totalseries }, entryfee, totalBalance, matchchallengeid, { bonus, balance, winning, mainbal, mainbonus, mainwin }, tranid, joinedTeams),
                                // updateUserBalance(userId, balance, bonus, extraCash, winning, { totalchallenges, totalmatches, totalseries })
                            );
                        }
                        console.log('updateOperations', updateOperations);

                        await Promise.all(updateOperations);
                        shouldBreakLoop = true;
                        break;
                    }

                    const { status, finalBalances, finalUsedBalances, count: successfulChallenges } = await this.deductBalanceForChallenge(
                        matchchallenge,
                        { bonus, balance, winning },
                        1
                    );

                    if (joinedTeams == 0 && !status) {
                        return { message: 'Insufficient balance', status: false, data: {} };
                    }

                    mainbal += finalUsedBalances?.balanceUsed || 0;
                    mainbonus += finalUsedBalances?.bonusUsed || 0;
                    mainwin += finalUsedBalances?.winningUsed || 0;
                    bonus = finalBalances?.bonus || 0;
                    balance = finalBalances?.balance || 0;
                    winning = finalBalances?.winning || 0;
                    if (status && successfulChallenges > 0) {
                        await redis.incr(challengeCounterKey);
                        await redis.incr(userChallengeCounterKey);
                        let leaderBoardId = new mongoose.Types.ObjectId();
                        let joinId = new mongoose.Types.ObjectId();
                        let redisLeaderboard = {
                            "_id": `${leaderBoardId.toString()}`,
                            "getcurrentrank": challengeMaxTeamCount,
                            "usernumber": 0,
                            "joinleaugeid": joinId,
                            "joinTeamNumber": Number(jointeam.teamnumber),
                            "jointeamid": jointeam._id,
                            "userid": req.user._id,
                            "team": user.team,
                            "image": `${global.constant.IMAGE_URL}team_image.png`,
                            "teamnumber": jointeam.teamnumber,
                            "refercode": referCode
                        }

                        const msg = {
                            leagueData: {
                                _id: joinId,
                                userid: req.user._id,
                                challengeid: matchchallengesDataId,
                                teamid: jointeam._id,
                                matchkey: listmatchId,
                                seriesid: seriesId,
                                transaction_id: tranid,
                                refercode: referCode,
                                teamnumber: jointeam.teamnumber,
                                leaugestransaction: {
                                    user_id: userId,
                                    bonus: finalUsedBalances?.bonusUsed || 0,
                                    balance: finalUsedBalances?.balanceUsed || 0,
                                    winning: finalUsedBalances?.winningUsed || 0
                                }
                            },
                            leaderBoardData: {
                                _id: leaderBoardId,
                                userId: req.user._id,
                                challengeid: matchchallengesDataId,
                                teamId: jointeam._id,
                                matchkey: listmatchId,
                                user_team: user.team,
                                teamnumber: jointeam.teamnumber,
                                captain: jointeam.captain,
                                vicecaptain: jointeam.vicecaptain,
                                playersData: jointeam.players,
                                joinId: joinId,
                                contest_winning_type: matchchallenge.amount_type,
                                joinNumber: challengeMaxTeamCount
                            },
                            matchchallengeid,
                            userId,
                            listmatchId,
                            teamnumber: jointeam.teamnumber,
                            redisLeaderboard
                        }

                        const redisleaderBoardData = {
                            _id: `${leaderBoardId.toString()}`,
                            points: 0,
                            getcurrentrank: 1,
                            challengeid: matchchallengeid.toString(),
                            matchkey: listmatchId,
                            lastUpdate: false,
                            teamnumber: Number(jointeam.teamnumber),
                            userno: "0",
                            userjoinid: joinId,
                            userid: req.user._id,
                            jointeamid: jointeam._id,
                            teamname: user.team,
                            joinNumber: challengeMaxTeamCount,
                            image: `${global.constant.IMAGE_URL}avtar1.png`,
                            player_type: "classic",
                            winingamount: "",
                            contest_winning_type: "price",
                        };

                        const keyChallengeLeaderBoardNew = `liveRanksLeaderboard_${matchchallengeid.toString()}`;
                        var expRedisTime = await matchTimeDifference(listmatchId);
                        await redisLeaderboards.storeSortedSet(keyChallengeLeaderBoardNew, redisleaderBoardData, expRedisTime);

                        let redisUserChallenge = {
                            "_id": `${matchchallengeid.toString()}`,
                            "getcurrentrank": userTeamCount + 1,
                            "matchkey": listmatchId
                        }
                        let keyUserJoinedChallenge = `match:${listmatchId}:user:${userId}:joinedContests`;
                        await redisLeaderboards.storeSortedSet(keyUserJoinedChallenge, redisUserChallenge, expRedisTime);
                        let redisUserMatch = {
                            "_id": `${listmatchId.toString()}`,
                            "getcurrentrank": 1,
                            "matchkey": listmatchId
                        }
                        let keyUserJoinedMatches = `user:${userId}:matches`;
                        await redisLeaderboards.storeSortedSet(keyUserJoinedMatches, redisUserMatch, expRedisTime);

                        redisLeaderboard._id = `${leaderBoardId.toString()}-${userId}`;
                        let keyLeaderBoard = `match:${listmatchId}:challenge:${matchchallengeid}:user:${userId}:userLeaderBoard`;
                        await redisLeaderboards.storeSortedSet(keyLeaderBoard, redisLeaderboard, expRedisTime);

                        var remRedisTime = await matchRemTime(listmatchId);
                        // console.log('remRedisTime========>', remRedisTime);
                        // if (remRedisTime > 0 && remRedisTime < 1800) {
                        // await redisLiveLeaderboard.storeSortedSet(keyChallengeLeaderBoardNew, redisleaderBoardData, expRedisTime);
                        // await redisLiveLeaderboard.storeSortedSet(keyUserJoinedChallenge, redisUserChallenge, expRedisTime);
                        // await redisLiveLeaderboard.storeSortedSet(keyUserJoinedMatches, redisUserMatch, expRedisTime);
                        // await redisLiveLeaderboard.storeSortedSet(keyLeaderBoard, redisLeaderboard, expRedisTime);
                        // }

                        sendToQueue('createContestLeaderboard', msg);
                        // userLeaderBoardArr.push(redisLeaderboard);
                        joinedTeams++;
                    }
                }
            }
            if (shouldBreakLoop) {
                if (matchchallenge.is_running == 1) {
                    return {
                        message: 'Match Challenge has been closed',
                        status: false,
                        is_closed: true,
                        data: { is_running: 1, entryfee: entryfee, win_amount: win_amount, maximum_user: maximum_user, jointeamid: jointeamid, discount_fee: discount_fee, matchkey: matchkey }
                    };
                } else {
                    return {
                        message: 'Match Challenge has been closed',
                        status: false,
                        data: {}
                    };
                }
            }

            totalchallenges = 0;
            totalmatches = 0;
            totalseries = 0;

            const totalChallengeJoined = await redis.get(challengeCounterKey);
            //remove this query
            let updateOperations = [
                // matchchallengesModel.findOneAndUpdate({ _id: mongoose.Types.ObjectId(matchchallengeid) }, { joinedusers: totalChallengeJoined }),
            ];

            if (entryfee > 0) {
                updateOperations.push(
                    createTransaction(userId, balance, bonus, extraCash, winning, { totalchallenges, totalmatches, totalseries }, entryfee, totalBalance, matchchallengeid, { bonus, balance, winning, mainbal, mainbonus, mainwin }, tranid, joinedTeams),
                    // updateUserBalance(userId, balance, bonus, extraCash, winning, { totalchallenges, totalmatches, totalseries })
                );
            }
            let fieldsToUpdate = {
                joinedusers: totalChallengeJoined
            };

            // If contest is full, update status to "closed"
            if (totalChallengeJoined == maximum_user) {
                fieldsToUpdate.status = 'closed';
            }

            // Update Redis fields
            await redisUpdateChallenge.insertRedisFields(listmatchId, contest_cat, matchchallengeid, fieldsToUpdate);

            // Perform any pending database update operations
            await Promise.all(updateOperations);

            // Send notification to queue if needed
            sendToQueue('createNotificationQueue', {
                payload: { title: 'Contest Joined', userid: userId },
                modelName: 'alert'
            });

            // Notify system that contest is closed (or updated)
            sendToQueue('contestClosed', {
                filter: { _id: matchchallengeid },
                payload: fieldsToUpdate,
                modelName: 'matchcontest'
            });

            return {
                message: 'Contest Joined',
                status: true,
                data: {
                    joinedusers: totalChallengeJoined,
                    referCode: referCode
                }
            };

        } catch (e) {
            console.log(e)
            throw e;
        }
    }

    async closedJoinContest(req) {
        try {
            const { entryfee, win_amount, maximum_user, jointeamid, discount_fee, matchkey } = req.body;
            const userId = req.user._id;
            let totalchallenges = 0,
                totalmatches = 0,
                totalseries = 0,
                joinedTeams = 0,
                aggpipe = [];
            let appKey = "appSettingData";
            let appSetting = await redisMain.getkeydata(appKey);
            if (!appSetting?.joinContest) {
                return {
                    message: 'Contest joining is disabled right now',
                    status: false,
                    data: {}
                };
            }

            delay(10)
            // let listMatchKey = `challengeId_${matchchallengeid}`;
            // matchkey = await redisContest.getkeydata(listMatchKey);
            const matchKeyData = `match:${matchkey}:challenges`;
            let allChallenges = await redisContest.hgetAllData(matchKeyData);
            const matchEntryFee = Number(entryfee);
            const matchWinAmount = Number(win_amount);
            const matchMaxUser = Number(maximum_user);

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
            let matchchallengeid;
            if (similar) {
                matchchallengeid = similar._id;
            } else {
                let hashKey = `match:${matchkey}:entry:${entryfee}:win:${win_amount}:max:${maximum_user}:cloned_challenges`;
                let existingChallenges = await redisContest.hgetAllData(hashKey);
                if (existingChallenges && Object.keys(existingChallenges).length > 0) {
                    const firstKey = Object.keys(existingChallenges)[0];
                    const firstChallenge = existingChallenges[firstKey];
                    matchchallengeid = firstChallenge._id;
                    const keyName = `match:${matchkey}:challenges`;
                    const ttlInSeconds = await matchTimeDifference(matchkey);
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
                } else {
                    return {
                        message: 'Not able to join from here',
                        status: false,
                        data: {}
                    };
                }
            }
            const keyName = `match:${matchkey}:challenges`;
            const matchchallenge = await redisContest.hgetData(keyName, matchchallengeid);
            if (!matchchallenge) {
                return {
                    message: 'Match Challenge Not Found',
                    status: false,
                    data: {}
                };
            }

            const { _id: matchchallengesDataId, multi_entry, contest_cat } = matchchallenge;

            if (matchchallenge.status == 'closed' || matchchallenge.joinedusers == maximum_user) {
                if (matchchallenge.is_running == 1) {
                    return {
                        message: 'Match Challenge has been closed',
                        status: false,
                        is_closed: true,
                        data: { is_running: 1, entryfee: entryfee, win_amount: win_amount, maximum_user: maximum_user, jointeamid: jointeamid, discount_fee: discount_fee, matchkey: matchkey }
                    };
                } else {
                    return {
                        message: 'Match Challenge has been closed',
                        status: false,
                        data: {}
                    };
                }
            }

            let keyname = `listMatchesModel-${matchkey}`
            let listmatch = await getkeydata(keyname);
            if (!listmatch) {
                listmatch = await matchesModel.findOne({ _id: new mongoose.Types.ObjectId(req.params.matchId) }).lean();
                await setkeydata(keyname, listmatch || {}, 20 * 24 * 60 * 60);
            }
            const { _id: listmatchId, series: seriesId, start_date: matchStartDate } = listmatch;

            const challengeCounterKey = `match:${listmatchId}:challenge:${matchchallengeid}:joinedTeams`;
            const userChallengeCounterKey = `match:${listmatchId}:challenge:${matchchallengeid}:user:${userId}:joinedTeams`;


            // const matchTime = await this.getMatchTime(matchStartDate);

            const matchTime = await this.getMatchTime(matchStartDate);

            if (!matchTime) {
                return {
                    message: 'Match has been closed, You cannot join league now.',
                    status: false,
                    data: {}
                };
            }

            const jointeamids = jointeamid.split(',').map(id => id.trim());
            // Redis Key for storing teams
            const redisKey = `match:${listmatchId}:user:${userId}:teams`;

            let cachedTeams = await getkeydata(redisKey);
            // if (!cachedTeams) {
            //     cachedTeams = await userTeamModel.find({ listmatchId, userid: userId }).lean();
            //     await setkeydata(redisKey, cachedTeams, expRedisTime); // Cache for 12 hours
            // }


            if (!Array.isArray(cachedTeams) || cachedTeams.length === 0) {
                cachedTeams = [];
            }

            const cachedTeamIds = new Set(cachedTeams.map(team => team._id.toString()));

            const missingTeamIds = jointeamids.filter(id => !cachedTeamIds.has(id));

            if (missingTeamIds.length > 0) {
                const missingTeams = await userTeamModel.find({ _id: { $in: missingTeamIds }, matchkey: listmatchId, userid: userId }).lean();
                cachedTeams = [...cachedTeams, ...missingTeams];
                await setkeydata(redisKey, cachedTeams, expRedisTime);
            }
            const validTeamsCount = cachedTeams.filter(team => jointeamids.includes(team._id.toString()));
            let keyLeaderBoard = `match:${listmatchId}:challenge:${matchchallengeid}:user:${req.user._id}:userLeaderBoard`;
            let joinedLeauges = await redisLeaderboards.getMyLeaderBoard(keyLeaderBoard, req.user._id);
            if (joinedLeauges == false) {
                joinedLeauges = [];
            }


            if (jointeamids.length === 1 && joinedLeauges.length === 1 && jointeamid === joinedLeauges[0]?.jointeamid.toString()) {
                return { message: 'Contest Already joined', status: false, data: {} };
            }

            if (validTeamsCount.length !== jointeamids.length) {
                return {
                    message: 'Invalid Team',
                    status: false,
                    data: {}
                };
            }

            if (jointeamids.length == 1 && joinedLeauges.length == 1 && jointeamid === joinedLeauges[0]?.jointeamid.toString()) {
                return {
                    message: 'Contest Already joined',
                    status: false,
                    data: {}
                };
            }


            if (multi_entry === 0) {

                if (joinedLeauges.length > 0 || jointeamids.length > 1) {
                    return {
                        message: 'Contest Already joined or You can only join once.',
                        status: false,
                        data: {}
                    };
                }
            } else {

                if (joinedLeauges.length >= matchchallenge.team_limit) {
                    return {
                        message: 'You cannot join with more teams now.',
                        status: false,
                        data: {}
                    };
                }
            }
            const user = await redisUser.getUser(userId);


            let userbalance = await redisUser.redis.hgetall(`wallet:{${userId}}`);


            if (!userbalance) {
                await redisUser.setDbtoRedisWallet(userId);
                userbalance = await redisUser.redis.hgetall(`wallet:{${userId}}`);
            }
            //remove this
            // const user = await userModel.findOne({ _id: userId }).select('userbalance user_verify team')


            if (!userbalance) {
                return { message: 'Insufficient balance', status: false, data: {} };
            }

            // 
            let bonus = Number(userbalance.bonus);
            let balance = Number(userbalance.balance);
            let winning = Number(userbalance.winning);
            let extraCash = 0;
            // let { bonus, balance, winning, extraCash } = userbalance;
            const parseBalance = (value) => parseFloat(value.toFixed(2));
            const totalBalance = parseBalance(bonus) + parseBalance(balance) + parseBalance(winning) + extraCash;
            let tranid = '';
            let mainbal = 0, mainbonus = 0, mainwin = 0;
            // const createTransaction = async (userId, entryfee, totalBalance, matchchallengeid, balances, tranid, count) => {
            const createTransaction = async (userId, balance, bonus, extraCash, winning, increment = {}, entryfee, totalBalance, matchchallengeid, balances,
                tranid,
                count
            ) => {
                // 1. Prepare balance update message
                const userUpdateMsg = {
                    filter: { _id: userId },
                    payload: {
                        'userbalance.balance': balance,
                        'userbalance.bonus': bonus,
                        'userbalance.winning': winning,
                        'userbalance.extraCash': extraCash,
                        $inc: increment,
                    },
                    modelName: "user"
                };
                // 2. Prepare transaction message
                const transactionData = {
                    type: 'Contest Joining Fee',
                    contestdetail: `${entryfee}-${count}`,
                    amount: entryfee * count,
                    total_available_amt: totalBalance - entryfee * count,
                    transaction_by: constant.TRANSACTION_BY.WALLET,
                    challengeid: matchchallengeid,
                    userid: userId,
                    paymentstatus: constant.PAYMENT_STATUS_TYPES.CONFIRMED,
                    bal_bonus_amt: balances.bonus,
                    bal_win_amt: balances.winning,
                    bal_fund_amt: balances.balance,
                    extra_fund_amt: balances?.extraCash || 0,
                    cons_amount: balances.mainbal,
                    cons_bonus: balances.mainbonus,
                    cons_win: balances.mainwin,
                    transaction_id: tranid,
                };

                const transactionMsg = {
                    payload: transactionData,
                    modelName: "wallettransactions"
                };
                const walletUpdate = {
                    balance: balance,
                    bonus: bonus,
                    winning: winning,
                    extraCash: extraCash
                };
                transactionData.match_name = listmatch.short_name;
                transactionData.transaction_type = 'Debit';

                await redisUser.saveTransactionToRedis(userId, walletUpdate, transactionData);

                // 3. Send to respective queues
                sendToQueue('updateUserQueue', userUpdateMsg);
                sendToQueue('createTransactionQueue', transactionMsg);
            };

            if (entryfee > 0) {
                const randomStr = randomstring.generate({ charset: 'alphanumeric', length: 4, });
                tranid = `${global.constant.APP_SHORT_NAME}-${Date.now()}-${randomStr}`;
            }

            const coupon = randomstring.generate({ charset: 'alphanumeric', length: 4, });
            let referCode = `${global.constant.APP_SHORT_NAME}-${Date.now()}${coupon}`;
            let shouldBreakLoop = false;

            for (const jointeam of validTeamsCount) {

                let [currentChallengeCount, currentUserCount] = await Promise.all([
                    redis.get(challengeCounterKey),
                    redis.get(userChallengeCounterKey)
                ]);

                const challengeMaxTeamCount = parseInt(currentChallengeCount || '0');
                const userTeamCount = parseInt(currentUserCount || '0');
                if (multi_entry > 0 && userTeamCount >= matchchallenge.team_limit) {
                    break;
                }
                const isTeamJoined = joinedLeauges.some(item => item.jointeamid.toString() == jointeam._id);
                if (!isTeamJoined) {
                    if (matchchallenge.contest_type == 'Amount' && challengeMaxTeamCount >= matchchallenge.maximum_user) {
                        totalchallenges = 0;
                        totalmatches = 0;
                        totalseries = 0;


                        let updateOperations = [
                            // matchchallengesModel.findOneAndUpdate(
                            //     { _id: mongoose.Types.ObjectId(matchchallengeid) },
                            //     { status: 'closed' },
                            //     { new: true }
                            // )
                        ];

                        if (entryfee > 0) {
                            updateOperations.push(
                                createTransaction(userId, balance, bonus, extraCash, winning, { totalchallenges, totalmatches, totalseries }, entryfee, totalBalance, matchchallengeid, { bonus, balance, winning, mainbal, mainbonus, mainwin }, tranid, joinedTeams),
                                // updateUserBalance(userId, balance, bonus, extraCash, winning, { totalchallenges, totalmatches, totalseries })
                            );
                        }

                        await Promise.all(updateOperations);
                        shouldBreakLoop = true;
                        break;
                    }

                    const { status, finalBalances, finalUsedBalances, count: successfulChallenges } = await this.deductBalanceForChallenge(
                        matchchallenge,
                        { bonus, balance, winning },
                        1
                    );

                    if (joinedTeams == 0 && !status) {
                        return { message: 'Insufficient balance', status: false, data: {} };
                    }

                    mainbal += finalUsedBalances?.balanceUsed || 0;
                    mainbonus += finalUsedBalances?.bonusUsed || 0;
                    mainwin += finalUsedBalances?.winningUsed || 0;
                    bonus = finalBalances?.bonus || 0;
                    balance = finalBalances?.balance || 0;
                    winning = finalBalances?.winning || 0;
                    if (status && successfulChallenges > 0) {
                        await redis.incr(challengeCounterKey);
                        await redis.incr(userChallengeCounterKey);
                        let leaderBoardId = new mongoose.Types.ObjectId();
                        let joinId = new mongoose.Types.ObjectId();
                        let redisLeaderboard = {
                            "_id": `${leaderBoardId.toString()}`,
                            "getcurrentrank": challengeMaxTeamCount,
                            "usernumber": 0,
                            "joinleaugeid": joinId,
                            "joinTeamNumber": Number(jointeam.teamnumber),
                            "jointeamid": jointeam._id,
                            "userid": req.user._id,
                            "team": user.team,
                            "image": `${global.constant.IMAGE_URL}team_image.png`,
                            "teamnumber": jointeam.teamnumber,
                            "refercode": referCode
                        }

                        const msg = {
                            leagueData: {
                                _id: joinId,
                                userid: req.user._id,
                                challengeid: matchchallengesDataId,
                                teamid: jointeam._id,
                                matchkey: listmatchId,
                                seriesid: seriesId,
                                transaction_id: tranid,
                                refercode: referCode,
                                teamnumber: jointeam.teamnumber,
                                leaugestransaction: {
                                    user_id: userId,
                                    bonus: finalUsedBalances?.bonusUsed || 0,
                                    balance: finalUsedBalances?.balanceUsed || 0,
                                    winning: finalUsedBalances?.winningUsed || 0
                                }
                            },
                            leaderBoardData: {
                                _id: leaderBoardId,
                                userId: req.user._id,
                                challengeid: matchchallengesDataId,
                                teamId: jointeam._id,
                                matchkey: listmatchId,
                                user_team: user.team,
                                teamnumber: jointeam.teamnumber,
                                captain: jointeam.captain,
                                vicecaptain: jointeam.vicecaptain,
                                playersData: jointeam.players,
                                joinId: joinId,
                                contest_winning_type: matchchallenge.amount_type,
                                joinNumber: challengeMaxTeamCount
                            },
                            matchchallengeid,
                            userId,
                            listmatchId,
                            teamnumber: jointeam.teamnumber,
                            redisLeaderboard
                        }

                        const redisleaderBoardData = {
                            _id: `${leaderBoardId.toString()}`,
                            points: 0,
                            getcurrentrank: 1,
                            challengeid: matchchallengeid.toString(),
                            matchkey: listmatchId,
                            lastUpdate: false,
                            teamnumber: Number(jointeam.teamnumber),
                            userno: "0",
                            userjoinid: joinId,
                            userid: req.user._id,
                            jointeamid: jointeam._id,
                            teamname: user.team,
                            joinNumber: challengeMaxTeamCount,
                            image: `${global.constant.IMAGE_URL}avtar1.png`,
                            player_type: "classic",
                            winingamount: "",
                            contest_winning_type: "price",
                        };

                        const keyChallengeLeaderBoardNew = `liveRanksLeaderboard_${matchchallengeid.toString()}`;
                        var expRedisTime = await matchTimeDifference(listmatchId);
                        await redisLeaderboards.storeSortedSet(keyChallengeLeaderBoardNew, redisleaderBoardData, expRedisTime);

                        let redisUserChallenge = {
                            "_id": `${matchchallengeid.toString()}`,
                            "getcurrentrank": userTeamCount + 1,
                            "matchkey": listmatchId
                        }
                        let keyUserJoinedChallenge = `match:${listmatchId}:user:${userId}:joinedContests`;
                        await redisLeaderboards.storeSortedSet(keyUserJoinedChallenge, redisUserChallenge, expRedisTime);
                        let redisUserMatch = {
                            "_id": `${listmatchId.toString()}`,
                            "getcurrentrank": 1,
                            "matchkey": listmatchId
                        }
                        let keyUserJoinedMatches = `user:${userId}:matches`;
                        await redisLeaderboards.storeSortedSet(keyUserJoinedMatches, redisUserMatch, expRedisTime);

                        // let keyChallengeLeaderBoard = `match:${listmatchId}:challenge:${matchchallengeid}:challengeLeaderBoard`;
                        // await redisLeaderboards.storeSortedSet(keyChallengeLeaderBoard, redisLeaderboard, expRedisTime);

                        redisLeaderboard._id = `${leaderBoardId.toString()}-${userId}`;
                        let keyLeaderBoard = `match:${listmatchId}:challenge:${matchchallengeid}:user:${userId}:userLeaderBoard`;
                        await redisLeaderboards.storeSortedSet(keyLeaderBoard, redisLeaderboard, expRedisTime);

                        sendToQueue('createContestLeaderboard', msg);
                        // userLeaderBoardArr.push(redisLeaderboard);
                        joinedTeams++;
                    }
                }
            }


            // if (shouldBreakLoop) {
            //     return { message: 'League is Closed', status: false, data: {} };
            // }

            if (shouldBreakLoop) {
                req._retryCount = (req._retryCount || 0) + 1;
                if (req._retryCount > 2) {
                    return { message: 'Retry limit exceeded', status: false, data: {} };
                }
                return await this.closedJoinContest(req);
            }




            totalchallenges = 0;
            totalmatches = 0;
            totalseries = 0;

            const totalChallengeJoined = await redis.get(challengeCounterKey);
            //remove this query
            let updateOperations = [
                // matchchallengesModel.findOneAndUpdate({ _id: mongoose.Types.ObjectId(matchchallengeid) }, { joinedusers: totalChallengeJoined }),
            ];

            if (entryfee > 0) {
                updateOperations.push(
                    createTransaction(userId, balance, bonus, extraCash, winning, { totalchallenges, totalmatches, totalseries }, entryfee, totalBalance, matchchallengeid, { bonus, balance, winning, mainbal, mainbonus, mainwin }, tranid, joinedTeams),
                    // updateUserBalance(userId, balance, bonus, extraCash, winning, { totalchallenges, totalmatches, totalseries })
                );
            }

            let fieldsToUpdate = {
                joinedusers: totalChallengeJoined
            };

            // If contest is full, update status to "closed"
            if (totalChallengeJoined == maximum_user) {
                fieldsToUpdate.status = 'closed';
            }
            // Update Redis fields
            await redisUpdateChallenge.insertRedisFields(listmatchId, contest_cat, matchchallengeid, fieldsToUpdate);

            // Perform any pending database update operations
            await Promise.all(updateOperations);

            // Send notification to queue if needed
            sendToQueue('createNotificationQueue', {
                payload: { title: 'Contest Joined', userid: userId },
                modelName: 'alert'
            });

            // Notify system that contest is closed (or updated)
            sendToQueue('contestClosed', {
                filter: { _id: matchchallengeid },
                payload: fieldsToUpdate,
                modelName: 'matchcontest'
            });

            return {
                message: 'Contest Joined',
                status: true,
                data: {
                    joinedusers: totalChallengeJoined,
                    referCode: referCode
                }
            };

        } catch (e) {
            console.log(e)
            throw e;
        }
    }


    async duoContestJoined(req) {
        try {
            const { matchchallengeid, playerId, discount_fee, matchkey } = req.body;
            const userId = req.user._id;
            let totalchallenges = 0,
                totalmatches = 0,
                totalseries = 0;
            let appKey = "appSettingData";
            let appSetting = await redisMain.getkeydata(appKey);
            if (!appSetting?.joinContest) {
                return {
                    message: 'Contest joining is disabled right now',
                    status: false,
                    data: {}
                };
            }
            const keyName = `match:${matchkey}:duochallenges`;
            const matchchallenge = await redisContest.hgetData(keyName, matchchallengeid);
            if (!matchchallenge) {
                return {
                    message: 'Match  Challenge Not Found',
                    status: false,
                    data: {}
                };
            }

            const { _id: matchchallengesDataId, entryfee, win_amount, maximum_user } = matchchallenge;

            if (matchchallenge.status == 'closed' || matchchallenge.joinedusers == maximum_user) {
                if (matchchallenge.is_running == 1) {
                    return {
                        message: 'Match Challenge has been closed',
                        status: false,
                        is_closed: true,
                        data: { is_running: 1, entryfee: entryfee, win_amount: win_amount, maximum_user: maximum_user, playerId: playerId, discount_fee: discount_fee, matchkey: matchkey }
                    };
                } else {
                    return {
                        message: 'Match Challenge has been closed',
                        status: false,
                        data: {}
                    };
                }
            }

            let keyname = `listMatchesModel-${matchkey}`
            let listmatch = await getkeydata(keyname);
            if (!listmatch) {
                listmatch = await matchesModel.findOne({ _id: new mongoose.Types.ObjectId(req.params.matchId) }).lean();
                await setkeydata(keyname, listmatch || {}, 20 * 24 * 60 * 60);
            }
            const { _id: listmatchId, series: seriesId, start_date: matchStartDate } = listmatch;

            const challengeCounterKey = `match:${matchkey}:challenge:${matchchallengeid}:joinedPlayer`;
            const userChallengeCounterKey = `match:${matchkey}:challenge:${matchchallengeid}:user:${userId}:joinedPlayer`;

            const [totalJoined, alreadyJoined] = await Promise.all([
                redis.get(challengeCounterKey),
                redis.get(userChallengeCounterKey)
            ]);



            // If contest is full, update status to "closed"
            if (totalJoined >= maximum_user) {
                let fieldsToUpdateData = {
                    joinedusers: totalJoined,
                    status: 'closed'
                };
                await redisUpdateChallenge.insertDuoGameRedisFields(listmatchId, matchchallengeid, fieldsToUpdateData);
                sendToQueue('contestClosed', {
                    filter: { _id: matchchallengeid },
                    payload: fieldsToUpdateData,
                    modelName: 'dualgamematchchallenge'
                });

                return {
                    message: 'Contest has been closed, You cannot join now.',
                    status: false,
                    data: {}
                };
            }

            const matchTime = await this.getMatchTime(matchStartDate);

            if (!matchTime) {
                return {
                    message: 'Match has been closed, You cannot join league now.',
                    status: false,
                    data: {}
                };
            }

            if (Number(alreadyJoined) >= 1) {
                return { message: 'You have already joined this contest', status: false, data: {} };
            }

            const playerUsed = await redisLeaderboards.hgetData(`selectedPlayerLeaderboard_${matchchallengeid.toString()}_data`, playerId);
            if (playerUsed) {
                return {
                    message: `Player already selected by another user`,
                    status: false,
                };
            }

            const MatchPlayersKeyName = `playerList-matchkey-${listmatch.real_matchkey}`;
            let matchPlayersData = await redisjoinTeams.getkeydata(MatchPlayersKeyName);
            if (!matchPlayersData || matchPlayersData.length <= 0 || matchPlayersData == null) {
                let filePath = `matchPlayer/playserList-${matchkey}.json`;
                matchPlayersData = await getMatchPlayrs(`${filePath}`);
                if (!matchPlayersData || matchPlayersData?.length == 0) matchPlayersData = await matchPlayersModel.find({ matchkey: matchkey }).lean();
                var expRedisTime = await matchTimeDifference(matchkey);
                await redisjoinTeams.setkeydata(MatchPlayersKeyName, matchPlayersData, expRedisTime);
            }
            let singlePlayerData = null;
            let playerDetails = {}
            if (matchPlayersData.length > 0) {
                singlePlayerData = matchPlayersData.find(p => p?.playerid?.toString() === playerId);
            }

            if (singlePlayerData) {
                playerDetails = {
                    playerId: singlePlayerData.playerid,
                    matchPlayerId: singlePlayerData.p_id,
                    playerName: singlePlayerData.name,
                    playerKey: singlePlayerData.players_key,
                    team: singlePlayerData.teamid,
                    credit: singlePlayerData.credit,
                    role: singlePlayerData.role,
                    image: singlePlayerData.image,
                    teamName: singlePlayerData.team_short_name,
                    player_short_name: singlePlayerData.name
                };
            } else {
                return {
                    status: false,
                    message: "Player not found"
                };
            }

            const user = await redisUser.getUser(userId);


            let userbalance = await redisUser.redis.hgetall(`wallet:{${userId}}`);


            if (!userbalance) {
                await redisUser.setDbtoRedisWallet(userId);
                userbalance = await redisUser.redis.hgetall(`wallet:{${userId}}`);
            }

            if (!userbalance) {
                return { message: 'Insufficient balance', status: false, data: {} };
            }

            // 
            let bonus = Number(userbalance.bonus);
            let balance = Number(userbalance.balance);
            let winning = Number(userbalance.winning);
            let extraCash = 0;
            const parseBalance = (value) => parseFloat(value.toFixed(2));
            const totalBalance = parseBalance(bonus) + parseBalance(balance) + parseBalance(winning) + extraCash;
            let tranid = '';
            let mainbal = 0, mainbonus = 0, mainwin = 0;
            const createTransaction = async (userId, balance, bonus, extraCash, winning, increment = {}, entryfee, totalBalance, matchchallengeid, balances,
                tranid,
                count
            ) => {
                const userUpdateMsg = {
                    filter: { _id: userId },
                    payload: {
                        'userbalance.balance': balance,
                        'userbalance.bonus': bonus,
                        'userbalance.winning': winning,
                        'userbalance.extraCash': extraCash,
                        $inc: increment,
                    },
                    modelName: "user"
                };
                const transactionData = {
                    type: 'Contest Joining Fee',
                    contestdetail: `${entryfee}-1`,
                    amount: entryfee,
                    total_available_amt: totalBalance - entryfee,
                    transaction_by: constant.TRANSACTION_BY.WALLET,
                    challengeid: matchchallengeid,
                    userid: userId,
                    paymentstatus: constant.PAYMENT_STATUS_TYPES.CONFIRMED,
                    bal_bonus_amt: balances.bonus,
                    bal_win_amt: balances.winning,
                    bal_fund_amt: balances.balance,
                    extra_fund_amt: balances?.extraCash || 0,
                    cons_amount: balances.mainbal,
                    cons_bonus: balances.mainbonus,
                    cons_win: balances.mainwin,
                    transaction_id: tranid,
                };

                const transactionMsg = {
                    payload: transactionData,
                    modelName: "wallettransactions"
                };
                const walletUpdate = {
                    balance: balance,
                    bonus: bonus,
                    winning: winning,
                    extraCash: extraCash
                };
                transactionData.match_name = listmatch.short_name;
                transactionData.transaction_type = 'Debit';

                await redisUser.saveTransactionToRedis(userId, walletUpdate, transactionData);

                // 3. Send to respective queues
                sendToQueue('updateUserQueue', userUpdateMsg);
                sendToQueue('createTransactionQueue', transactionMsg);
            };

            if (entryfee > 0) {
                const randomStr = randomstring.generate({ charset: 'alphanumeric', length: 4, });
                tranid = `${global.constant.APP_SHORT_NAME}-${Date.now()}-${randomStr}`;
            }


            const challengeMaxTeamCount = parseInt(totalJoined || '0');

            if (matchchallenge.contest_type == 'Amount' && challengeMaxTeamCount >= matchchallenge.maximum_user) {
                totalchallenges = 0;
                totalmatches = 0;
                totalseries = 0;


                let updateOperations = [
                    dualgamematchChallengersModel.findOneAndUpdate(
                        { _id: mongoose.Types.ObjectId(matchchallengeid) },
                        { status: 'closed' },
                        { new: true }
                    )
                ];

                if (entryfee > 0) {
                    updateOperations.push(
                        createTransaction(userId, balance, bonus, extraCash, winning, { totalchallenges, totalmatches, totalseries }, entryfee, totalBalance, matchchallengeid, { bonus, balance, winning, mainbal, mainbonus, mainwin }, tranid, 1)
                    );
                }

                await Promise.all(updateOperations);
            }

            const { status, finalBalances, finalUsedBalances, count: successfulChallenges } = await this.deductBalanceForChallenge(
                matchchallenge,
                { bonus, balance, winning },
                1
            );

            if (!status) {
                return { message: 'Insufficient balance', status: false, data: {} };
            }

            mainbal += finalUsedBalances?.balanceUsed || 0;
            mainbonus += finalUsedBalances?.bonusUsed || 0;
            mainwin += finalUsedBalances?.winningUsed || 0;
            bonus = finalBalances?.bonus || 0;
            balance = finalBalances?.balance || 0;
            winning = finalBalances?.winning || 0;
            if (status && successfulChallenges > 0) {
                await redis.incr(challengeCounterKey);
                await redis.incr(userChallengeCounterKey);
                let leaderBoardId = new mongoose.Types.ObjectId();
                let joinId = new mongoose.Types.ObjectId();
                let redisLeaderboard = {
                    "_id": `${leaderBoardId.toString()}`,
                    "getcurrentrank": challengeMaxTeamCount,
                    "usernumber": 0,
                    "joinleaugeid": joinId,
                    "joinplayerid": playerId,
                    "userid": req.user._id,
                    "team": user.team,
                    "image": `${global.constant.IMAGE_URL}team_image.png`,
                    "playerDetails": playerDetails
                }

                const msg = {
                    leagueData: {
                        _id: joinId,
                        userid: req.user._id,
                        challengeid: matchchallengesDataId,
                        joinplayerid: playerId,
                        matchkey: listmatchId,
                        seriesid: seriesId,
                        transaction_id: tranid,
                        leaugestransaction: {
                            user_id: userId,
                            bonus: finalUsedBalances?.bonusUsed || 0,
                            balance: finalUsedBalances?.balanceUsed || 0,
                            winning: finalUsedBalances?.winningUsed || 0
                        },
                        playerDetails: playerDetails
                    },
                    leaderBoardData: {
                        _id: leaderBoardId,
                        userId: req.user._id,
                        challengeid: matchchallengesDataId,
                        joinplayerid: playerId,
                        matchkey: listmatchId,
                        user_team: user.team,
                        contest_winning_type: matchchallenge.amount_type,
                        joinNumber: challengeMaxTeamCount,
                        playerDetails: playerDetails,
                        joinId: joinId,
                    },
                    matchchallengeid,
                    userId,
                    listmatchId,
                    redisLeaderboard
                }

                const redisleaderBoardData = {
                    _id: `${leaderBoardId.toString()}`,
                    points: 0,
                    getcurrentrank: 1,
                    challengeid: matchchallengeid.toString(),
                    matchkey: listmatchId,
                    lastUpdate: false,
                    joinplayerid: playerId,
                    userno: "0",
                    userjoinid: joinId,
                    userid: req.user._id,
                    teamname: user.team,
                    joinNumber: challengeMaxTeamCount,
                    image: `${global.constant.IMAGE_URL}avtar1.png`,
                    player_type: "classic",
                    winingamount: "",
                    contest_winning_type: "price",
                    playerDetails: playerDetails
                };

                const keyChallengeLeaderBoardNew = `liveRanksDuoLeaderboard_${matchchallengeid.toString()}`;
                var expRedisTime = await matchTimeDifference(listmatchId);
                const userSelectedPlayerDetails = {
                    _id: `${playerId.toString()}`,
                    playerDetails: playerDetails,
                    getcurrentrank: 1
                };
                await redisLeaderboards.storeSortedSet(keyChallengeLeaderBoardNew, redisleaderBoardData, expRedisTime);
                const userSelectedPlayer = `selectedPlayerLeaderboard_${matchchallengeid.toString()}`;
                await redisLeaderboards.storeSortedSet(userSelectedPlayer, userSelectedPlayerDetails, expRedisTime);
                let redisUserChallenge = {
                    "_id": `${matchchallengeid.toString()}`,
                    "getcurrentrank": 1,
                    "matchkey": listmatchId,
                }
                let keyUserJoinedChallenge = `match:${listmatchId}:user:${userId}:joinedDuoContests`;
                await redisLeaderboards.storeSortedSet(keyUserJoinedChallenge, redisUserChallenge, expRedisTime);
                let redisUserMatch = {
                    "_id": `${listmatchId.toString()}`,
                    "getcurrentrank": 1,
                    "matchkey": listmatchId
                }
                let keyUserJoinedMatches = `user:${userId}:matches`;
                await redisLeaderboards.storeSortedSet(keyUserJoinedMatches, redisUserMatch, expRedisTime);

                redisLeaderboard._id = `${leaderBoardId.toString()}-${userId}`;
                let keyLeaderBoard = `match:${listmatchId}:challenge:${matchchallengeid}:user:${userId}:userDuoLeaderBoard`;
                await redisLeaderboards.storeSortedSet(keyLeaderBoard, redisLeaderboard, expRedisTime);

                sendToQueue('createduoContestLeaderboard', msg);
            }


            totalchallenges = 0;
            totalmatches = 0;
            totalseries = 0;

            const totalChallengeJoined = await redis.get(challengeCounterKey);
            //remove this query
            let updateOperations = [
                // matchchallengesModel.findOneAndUpdate({ _id: mongoose.Types.ObjectId(matchchallengeid) }, { joinedusers: totalChallengeJoined }),
            ];

            if (entryfee > 0) {
                updateOperations.push(
                    createTransaction(userId, balance, bonus, extraCash, winning, { totalchallenges, totalmatches, totalseries }, entryfee, totalBalance, matchchallengeid, { bonus, balance, winning, mainbal, mainbonus, mainwin }, tranid, 1)
                );
            }
            let fieldsToUpdate = {
                joinedusers: totalChallengeJoined
            };

            // If contest is full, update status to "closed"
            if (totalChallengeJoined == maximum_user) {
                fieldsToUpdate.status = 'closed';
            }

            // Update Redis fields
            await redisUpdateChallenge.insertDuoGameRedisFields(listmatchId, matchchallengeid, fieldsToUpdate);

            // Perform any pending database update operations
            await Promise.all(updateOperations);

            sendToQueue('contestClosed', {
                filter: { _id: matchchallengeid },
                payload: fieldsToUpdate,
                modelName: 'dualgamematchchallenge'
            });

            return {
                message: 'Contest Joined',
                status: true,
                data: {
                    joinedusers: totalChallengeJoined
                }
            };

        } catch (e) {
            console.log(e)
            throw e;
        }
    }

    async closedJoinDuoContest(req) {
        try {
            const { entryfee, win_amount, maximum_user, playerId, discount_fee, matchkey } = req.body;
            const userId = req.user._id;
            let totalchallenges = 0,
                totalmatches = 0,
                totalseries = 0;
            let appKey = "appSettingData";
            let appSetting = await redisMain.getkeydata(appKey);
            if (!appSetting?.joinContest) {
                return {
                    message: 'Contest joining is disabled right now',
                    status: false,
                    data: {}
                };
            }

            const pipeline = redisContest.redis.pipeline();
            const signature = `${entryfee}_${win_amount}_${maximum_user}`;
            const openedKey = `contest_group:${matchkey}:duochallenges:${signature}:opened_ids`;

            pipeline.smembers(openedKey);

            const challengeIdsResult = await pipeline.exec();

            let matchchallengeid;
            const openedIds = challengeIdsResult[0]?.[1] || [];
            const hashKey = `match:${matchkey}:duochallenges`;
            let matchchallenge;

            if (openedIds.length > 0) {
                const rawChallenges = await redisContest.redis.hmget(hashKey, ...openedIds);
                const allParsed = rawChallenges
                    .map(item => {
                        try { return JSON.parse(item); } catch { return null; }
                    })
                    .filter(c => c && c.status === 'opened');
                matchchallenge = allParsed.find(c => c.joinedusers < c.maximum_user);
            }
            if (!matchchallenge) {
                const clonedHashKey = `match:duogame:${matchkey}:entry:${entryfee}:win:${win_amount}:max:${maximum_user}:cloned_challenges`;
                const existingChallenges = await redisContest.hgetAllData(clonedHashKey);
                if (existingChallenges && Object.keys(existingChallenges).length > 0) {
                    const firstKey = Object.keys(existingChallenges)[0];
                    const firstChallenge = existingChallenges[firstKey];
                    const lockKey = `contest:${firstKey}:lock`;
                    const lockAcquired = await redisContest.redis.setnx(lockKey, 'locked');
                    if (lockAcquired) {
                        await redisContest.redis.expire(lockKey, 5);
                        var expRedisTime = await matchTimeDifference(matchkey);
                        try {
                            await redisContest.redis.sadd(`contest_group:${matchkey}:duochallenges:${signature}:opened_ids`, firstKey);
                            await redisContest.redis.sadd(`contest_group:${matchkey}:duochallenges:${signature}:ids`, firstKey);
                            await redisContest.hsetData(hashKey, firstKey, firstChallenge, expRedisTime);
                            const insertMsg = {
                                filter: { _id: firstChallenge.clonedChallenge },
                                payload: {
                                    _id: firstChallenge._id
                                },
                                modelName: "dualgamematchchallenge"
                            };
                            sendToQueue('contestInsert', insertMsg);
                            await redisContest.hdelData(clonedHashKey, firstKey);
                            console.log(`🚀 Promoted cloned contest ${firstKey} for signature ${signature}`);
                        } finally {
                            await redisContest.redis.del(lockKey);
                        }
                    }
                    matchchallenge = firstChallenge;
                }
            }
            if (!matchchallenge) {
                return {
                    message: 'Match Challenge Not Found',
                    status: false,
                    data: {}
                };
            }

            const { _id: matchchallengesDataId } = matchchallenge;

            matchchallengeid = matchchallenge._id;

            if (matchchallenge.status == 'closed' || matchchallenge.joinedusers == maximum_user) {
                if (matchchallenge.is_running == 1) {
                    return {
                        message: 'Match Challenge has been closed',
                        status: false,
                        is_closed: true,
                        data: { is_running: 1, entryfee: entryfee, win_amount: win_amount, maximum_user: maximum_user, playerId: playerId, discount_fee: discount_fee, matchkey: matchkey }
                    };
                } else {
                    return {
                        message: 'Match Challenge has been closed',
                        status: false,
                        data: {}
                    };
                }
            }

            let keyname = `listMatchesModel-${matchkey}`
            let listmatch = await getkeydata(keyname);
            if (!listmatch) {
                listmatch = await matchesModel.findOne({ _id: new mongoose.Types.ObjectId(req.params.matchId) }).lean();
                await setkeydata(keyname, listmatch || {}, 20 * 24 * 60 * 60);
            }
            const { _id: listmatchId, series: seriesId, start_date: matchStartDate } = listmatch;

            const challengeCounterKey = `match:${matchkey}:challenge:${matchchallengeid}:joinedPlayer`;
            const userChallengeCounterKey = `match:${matchkey}:challenge:${matchchallengeid}:user:${userId}:joinedPlayer`;

            const [totalJoined, alreadyJoined] = await Promise.all([
                redis.get(challengeCounterKey),
                redis.get(userChallengeCounterKey)
            ]);
            // If contest is full, update status to "closed"
            if (totalJoined >= maximum_user) {
                let fieldsToUpdateData = {
                    joinedusers: totalJoined,
                    status: 'closed'
                };
                await redisUpdateChallenge.insertDuoGameRedisFields(listmatchId, matchchallengeid, fieldsToUpdateData);
                sendToQueue('contestClosed', {
                    filter: { _id: matchchallengeid },
                    payload: fieldsToUpdateData,
                    modelName: 'dualgamematchchallenge'
                });

                return {
                    message: 'Contest has been closed, You cannot join now.',
                    status: false,
                    data: {}
                };
            }

            const matchTime = await this.getMatchTime(matchStartDate);

            if (!matchTime) {
                return {
                    message: 'Match has been closed, You cannot join league now.',
                    status: false,
                    data: {}
                };
            }

            if (Number(alreadyJoined) >= 1) {
                return { message: 'You have already joined this contest', status: false, data: {} };
            }

            const playerUsed = await redisLeaderboards.hgetData(`selectedPlayerLeaderboard_${matchchallengeid.toString()}_data`, playerId);
            if (playerUsed) {
                return {
                    message: `Player already selected by another user`,
                    status: false,
                };
            }

            const user = await redisUser.getUser(userId);


            let userbalance = await redisUser.redis.hgetall(`wallet:{${userId}}`);


            if (!userbalance) {
                await redisUser.setDbtoRedisWallet(userId);
                userbalance = await redisUser.redis.hgetall(`wallet:{${userId}}`);
            }

            if (!userbalance) {
                return { message: 'Insufficient balance', status: false, data: {} };
            }

            // 
            let bonus = Number(userbalance.bonus);
            let balance = Number(userbalance.balance);
            let winning = Number(userbalance.winning);
            let extraCash = 0;
            const parseBalance = (value) => parseFloat(value.toFixed(2));
            const totalBalance = parseBalance(bonus) + parseBalance(balance) + parseBalance(winning) + extraCash;
            let tranid = '';
            let mainbal = 0, mainbonus = 0, mainwin = 0;
            const createTransaction = async (userId, balance, bonus, extraCash, winning, increment = {}, entryfee, totalBalance, matchchallengeid, balances,
                tranid,
                count
            ) => {
                const userUpdateMsg = {
                    filter: { _id: userId },
                    payload: {
                        'userbalance.balance': balance,
                        'userbalance.bonus': bonus,
                        'userbalance.winning': winning,
                        'userbalance.extraCash': extraCash,
                        $inc: increment,
                    },
                    modelName: "user"
                };
                const transactionData = {
                    type: 'Contest Joining Fee',
                    contestdetail: `${entryfee}-1`,
                    amount: entryfee,
                    total_available_amt: totalBalance - entryfee,
                    transaction_by: constant.TRANSACTION_BY.WALLET,
                    challengeid: matchchallengeid,
                    userid: userId,
                    paymentstatus: constant.PAYMENT_STATUS_TYPES.CONFIRMED,
                    bal_bonus_amt: balances.bonus,
                    bal_win_amt: balances.winning,
                    bal_fund_amt: balances.balance,
                    extra_fund_amt: balances?.extraCash || 0,
                    cons_amount: balances.mainbal,
                    cons_bonus: balances.mainbonus,
                    cons_win: balances.mainwin,
                    transaction_id: tranid,
                };

                const transactionMsg = {
                    payload: transactionData,
                    modelName: "wallettransactions"
                };
                const walletUpdate = {
                    balance: balance,
                    bonus: bonus,
                    winning: winning,
                    extraCash: extraCash
                };
                transactionData.match_name = listmatch.short_name;
                transactionData.transaction_type = 'Debit';

                await redisUser.saveTransactionToRedis(userId, walletUpdate, transactionData);

                // 3. Send to respective queues
                sendToQueue('updateUserQueue', userUpdateMsg);
                sendToQueue('createTransactionQueue', transactionMsg);
            };

            if (entryfee > 0) {
                const randomStr = randomstring.generate({ charset: 'alphanumeric', length: 4, });
                tranid = `${global.constant.APP_SHORT_NAME}-${Date.now()}-${randomStr}`;
            }


            const challengeMaxTeamCount = parseInt(totalJoined || '0');

            if (matchchallenge.contest_type == 'Amount' && challengeMaxTeamCount >= matchchallenge.maximum_user) {
                totalchallenges = 0;
                totalmatches = 0;
                totalseries = 0;


                let updateOperations = [
                    dualgamematchChallengersModel.findOneAndUpdate(
                        { _id: mongoose.Types.ObjectId(matchchallengeid) },
                        { status: 'closed' },
                        { new: true }
                    )
                ];

                if (entryfee > 0) {
                    updateOperations.push(
                        createTransaction(userId, balance, bonus, extraCash, winning, { totalchallenges, totalmatches, totalseries }, entryfee, totalBalance, matchchallengeid, { bonus, balance, winning, mainbal, mainbonus, mainwin }, tranid, 1)
                    );
                }

                await Promise.all(updateOperations);
            }

            const { status, finalBalances, finalUsedBalances, count: successfulChallenges } = await this.deductBalanceForChallenge(
                matchchallenge,
                { bonus, balance, winning },
                1
            );

            if (!status) {
                return { message: 'Insufficient balance', status: false, data: {} };
            }

            mainbal += finalUsedBalances?.balanceUsed || 0;
            mainbonus += finalUsedBalances?.bonusUsed || 0;
            mainwin += finalUsedBalances?.winningUsed || 0;
            bonus = finalBalances?.bonus || 0;
            balance = finalBalances?.balance || 0;
            winning = finalBalances?.winning || 0;
            if (status && successfulChallenges > 0) {
                await redis.incr(challengeCounterKey);
                await redis.incr(userChallengeCounterKey);
                let leaderBoardId = new mongoose.Types.ObjectId();
                let joinId = new mongoose.Types.ObjectId();
                const keyName = `playerList-matchkey-${listmatch.real_matchkey}`;
                let matchPlayersData = await redisjoinTeams.getkeydata(keyName);
                if (!matchPlayersData || matchPlayersData.length <= 0 || matchPlayersData == null) {
                    let filePath = `matchPlayer/playserList-${matchkey}.json`;
                    matchPlayersData = await getMatchPlayrs(`${filePath}`);
                    if (!matchPlayersData || matchPlayersData?.length == 0) matchPlayersData = await matchPlayersModel.find({ matchkey: matchkey }).lean();
                    var expRedisTime = await matchTimeDifference(matchkey);
                    await redisjoinTeams.setkeydata(keyName, matchPlayersData, expRedisTime);
                }
                let singlePlayerData = null;
                let playerDetails = {}
                if (matchPlayersData.length > 0) {
                    singlePlayerData = matchPlayersData.find(p => p?.playerid?.toString() === playerId);
                }

                if (singlePlayerData) {
                    playerDetails = {
                        playerId: singlePlayerData.playerid,
                        matchPlayerId: singlePlayerData.p_id,
                        playerName: singlePlayerData.name,
                        playerKey: singlePlayerData.players_key,
                        team: singlePlayerData.teamid,
                        credit: singlePlayerData.credit,
                        role: singlePlayerData.role,
                        image: singlePlayerData.image,
                        teamName: singlePlayerData.team_short_name,
                        player_short_name: singlePlayerData.name
                    };
                } else {
                    return {
                        status: false,
                        message: "Player not found"
                    };
                }
                let redisLeaderboard = {
                    "_id": `${leaderBoardId.toString()}`,
                    "getcurrentrank": challengeMaxTeamCount,
                    "usernumber": 0,
                    "joinleaugeid": joinId,
                    "joinplayerid": playerId,
                    "userid": req.user._id,
                    "team": user.team,
                    "image": `${global.constant.IMAGE_URL}team_image.png`,
                    "playerDetails": playerDetails
                }

                const msg = {
                    leagueData: {
                        _id: joinId,
                        userid: req.user._id,
                        challengeid: matchchallengesDataId,
                        joinplayerid: playerId,
                        matchkey: listmatchId,
                        seriesid: seriesId,
                        transaction_id: tranid,
                        leaugestransaction: {
                            user_id: userId,
                            bonus: finalUsedBalances?.bonusUsed || 0,
                            balance: finalUsedBalances?.balanceUsed || 0,
                            winning: finalUsedBalances?.winningUsed || 0
                        },
                        playerDetails: playerDetails
                    },
                    leaderBoardData: {
                        _id: leaderBoardId,
                        userId: req.user._id,
                        challengeid: matchchallengesDataId,
                        joinplayerid: playerId,
                        matchkey: listmatchId,
                        user_team: user.team,
                        contest_winning_type: matchchallenge.amount_type,
                        joinNumber: challengeMaxTeamCount,
                        playerDetails: playerDetails,
                        joinId: joinId,
                    },
                    matchchallengeid,
                    userId,
                    listmatchId,
                    redisLeaderboard
                }

                const redisleaderBoardData = {
                    _id: `${leaderBoardId.toString()}`,
                    points: 0,
                    getcurrentrank: 1,
                    challengeid: matchchallengeid.toString(),
                    matchkey: listmatchId,
                    lastUpdate: false,
                    joinplayerid: playerId,
                    userno: "0",
                    userjoinid: joinId,
                    userid: req.user._id,
                    teamname: user.team,
                    joinNumber: challengeMaxTeamCount,
                    image: `${global.constant.IMAGE_URL}avtar1.png`,
                    player_type: "classic",
                    winingamount: "",
                    contest_winning_type: "price",
                    playerDetails: playerDetails
                };

                const keyChallengeLeaderBoardNew = `liveRanksDuoLeaderboard_${matchchallengeid.toString()}`;
                var expRedisTime = await matchTimeDifference(listmatchId);
                const userSelectedPlayerDetails = {
                    _id: `${playerId.toString()}`,
                    playerDetails: playerDetails,
                    getcurrentrank: 1
                };
                await redisLeaderboards.storeSortedSet(keyChallengeLeaderBoardNew, redisleaderBoardData, expRedisTime);
                const userSelectedPlayer = `selectedPlayerLeaderboard_${matchchallengeid.toString()}`;
                await redisLeaderboards.storeSortedSet(userSelectedPlayer, userSelectedPlayerDetails, expRedisTime);
                let redisUserChallenge = {
                    "_id": `${matchchallengeid.toString()}`,
                    "getcurrentrank": 1,
                    "matchkey": listmatchId,
                }
                let keyUserJoinedChallenge = `match:${listmatchId}:user:${userId}:joinedDuoContests`;
                await redisLeaderboards.storeSortedSet(keyUserJoinedChallenge, redisUserChallenge, expRedisTime);
                let redisUserMatch = {
                    "_id": `${listmatchId.toString()}`,
                    "getcurrentrank": 1,
                    "matchkey": listmatchId
                }
                let keyUserJoinedMatches = `user:${userId}:matches`;
                await redisLeaderboards.storeSortedSet(keyUserJoinedMatches, redisUserMatch, expRedisTime);

                redisLeaderboard._id = `${leaderBoardId.toString()}-${userId}`;
                let keyLeaderBoard = `match:${listmatchId}:challenge:${matchchallengeid}:user:${userId}:userDuoLeaderBoard`;
                await redisLeaderboards.storeSortedSet(keyLeaderBoard, redisLeaderboard, expRedisTime);

                sendToQueue('createduoContestLeaderboard', msg);
            }


            totalchallenges = 0;
            totalmatches = 0;
            totalseries = 0;

            const totalChallengeJoined = await redis.get(challengeCounterKey);
            //remove this query
            let updateOperations = [
                // matchchallengesModel.findOneAndUpdate({ _id: mongoose.Types.ObjectId(matchchallengeid) }, { joinedusers: totalChallengeJoined }),
            ];

            if (entryfee > 0) {
                updateOperations.push(
                    createTransaction(userId, balance, bonus, extraCash, winning, { totalchallenges, totalmatches, totalseries }, entryfee, totalBalance, matchchallengeid, { bonus, balance, winning, mainbal, mainbonus, mainwin }, tranid, 1)
                );
            }
            let fieldsToUpdate = {
                joinedusers: totalChallengeJoined
            };

            // If contest is full, update status to "closed"
            if (totalChallengeJoined == maximum_user) {
                fieldsToUpdate.status = 'closed';
            }

            // Update Redis fields
            await redisUpdateChallenge.insertDuoGameRedisFields(listmatchId, matchchallengeid, fieldsToUpdate);

            // Perform any pending database update operations
            await Promise.all(updateOperations);

            sendToQueue('contestClosed', {
                filter: { _id: matchchallengeid },
                payload: fieldsToUpdate,
                modelName: 'dualgamematchchallenge'
            });

            return {
                message: 'Contest Joined',
                status: true,
                data: {
                    joinedusers: totalChallengeJoined
                }
            };

        } catch (e) {
            console.log(e)
            throw e;
        }
    }

    async replaceDuoPlayer(req) {
        try {
            const { matchchallengeid, oldPlayerId, newPlayerId, matchkey } = req.body;
            const userId = req.user._id;

            const keyName = `match:${matchkey}:duochallenges`;
            const matchchallenge = await redisContest.hgetData(keyName, matchchallengeid);
            if (!matchchallenge) {
                return {
                    message: 'Match Challenge Not Found',
                    status: false,
                    data: {}
                };
            }

            let keyname = `listMatchesModel-${matchkey}`
            let listmatch = await getkeydata(keyname);
            if (!listmatch) {
                listmatch = await matchesModel.findOne({ _id: new mongoose.Types.ObjectId(req.params.matchId) }).lean();
                await setkeydata(keyname, listmatch || {}, 20 * 24 * 60 * 60);
            }
            const expRedisTime = await matchTimeDifference(matchkey);
            const userChallengeCounterKey = `match:${matchkey}:challenge:${matchchallengeid}:user:${userId}:joinedPlayer`;
            const alreadyJoined = await redis.get(userChallengeCounterKey);
            if (Number(alreadyJoined) < 1) {
                return {
                    message: 'You have not joined this contest yet',
                    status: false,
                    data: {}
                };
            }

            const playerUsed = await redisLeaderboards.hgetData(`selectedPlayerLeaderboard_${matchchallengeid.toString()}_data`, newPlayerId);
            if (playerUsed) {
                return {
                    message: `Player already selected by another user`,
                    status: false,
                };
            }

            const keyPlayerList = `playerList-matchkey-${listmatch.real_matchkey}`;
            let matchPlayersData = await redisjoinTeams.getkeydata(keyPlayerList);
            if (!matchPlayersData || matchPlayersData.length <= 0) {
                let filePath = `matchPlayer/playserList-${matchkey}.json`;
                matchPlayersData = await getMatchPlayrs(`${filePath}`);
                if (!matchPlayersData || matchPlayersData?.length == 0) {
                    matchPlayersData = await matchPlayersModel.find({ matchkey: matchkey }).lean();
                }
                await redisjoinTeams.setkeydata(keyPlayerList, matchPlayersData, expRedisTime);
            }

            // Prepare new player details
            let singlePlayerData = matchPlayersData.find(p => p?.playerid?.toString() === newPlayerId);
            if (!singlePlayerData) {
                return {
                    status: false,
                    message: "New player not found"
                };
            }

            const playerDetails = {
                playerId: singlePlayerData.playerid,
                matchPlayerId: singlePlayerData.p_id,
                playerName: singlePlayerData.name,
                playerKey: singlePlayerData.players_key,
                team: singlePlayerData.teamid,
                credit: singlePlayerData.credit,
                role: singlePlayerData.role,
                image: singlePlayerData.image,
                teamName: singlePlayerData.team_short_name,
                player_short_name: singlePlayerData.name
            };


            const userSelectedPlayer = `selectedPlayerLeaderboard_${matchchallengeid.toString()}`;
            await redisLeaderboards.removeSortedSet(userSelectedPlayer, oldPlayerId);

            // Add new player to selectedPlayerLeaderboard
            const userSelectedPlayerDetails = {
                _id: `${newPlayerId.toString()}`,
                playerDetails: playerDetails,
                getcurrentrank: 1
            };
            await redisLeaderboards.storeSortedSet(userSelectedPlayer, userSelectedPlayerDetails, expRedisTime);

            const keyLeaderBoard = `match:${matchkey}:challenge:${matchchallengeid.toString()}:user:${userId}:userDuoLeaderBoard`;
            const userLeaderBoard = await redisLeaderboards.getMyLeaderBoard(keyLeaderBoard, userId);
            let userLeaderBoardObj = Array.isArray(userLeaderBoard) ? userLeaderBoard[0] : userLeaderBoard;
            if (userLeaderBoardObj) {
                userLeaderBoardObj.joinplayerid = newPlayerId;
                userLeaderBoardObj.playerDetails = playerDetails;
                await redisLeaderboards.updateSortedSetHashOnly(keyLeaderBoard, userLeaderBoardObj, expRedisTime);
            }

            const keyChallengeLeaderBoardNew = `liveRanksDuoLeaderboard_${matchchallengeid.toString()}`;
            const challengeLeaderBoard = await redisLeaderboards.getMyLeaderBoard(keyChallengeLeaderBoardNew, userId);
            let challengeLeaderBoardObj = Array.isArray(challengeLeaderBoard) ? challengeLeaderBoard[0] : challengeLeaderBoard;
            if (challengeLeaderBoardObj) {
                challengeLeaderBoardObj.joinplayerid = newPlayerId;
                challengeLeaderBoardObj.playerDetails = playerDetails;
                await redisLeaderboards.updateSortedSetHashOnly(keyChallengeLeaderBoardNew, challengeLeaderBoardObj, expRedisTime);
            }

            let fieldsToUpdate = {
                joinplayerid: newPlayerId,
                playerDetails: playerDetails
            };

            sendToQueue('playerChanged', {
                filter: { _id: challengeLeaderBoardObj._id },
                payload: fieldsToUpdate,
                modelName: 'duoleaderboard'
            });

            return {
                message: 'Player changed successfully',
                status: true,
                data: {
                    newPlayerId,
                    playerDetails
                }
            };

        } catch (e) {
            console.log(e);
            throw e;
        }
    }






    /**
     * @function contestJoinedByCode
     * @description Contest Join By ContestCode
     * @param { getcode, matchkey }
     * @author 
     */
    async contestJoinedByCode(req) {
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
            var expRedisTime = await matchTimeDifference(matchkey);
            let keyname = `joinContestByCode-${matchchallengeid}`;
            let redisdata = await getkeydata(keyname);
            let matchchallenge;
            if (redisdata) {
                matchchallenge = redisdata;
            } else {
                matchchallenge = await matchchallengesModel.findOne({ _id: mongoose.Types.ObjectId(matchchallengeid) });
                setkeydata(keyname, matchchallenge, expRedisTime);
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

    async joinContestNew(req) {
        try {
            const { matchchallengeid, jointeamid, discount_fee, matchkey } = req.body;
            const userId = req.user._id;
            let totalchallenges = 0,
                totalmatches = 0,
                totalseries = 0,
                joinedTeams = 0,
                aggpipe = [];
            let appKey = "appSettingData";
            let appSetting = await redisMain.getkeydata(appKey);
            if (!appSetting?.joinContest) {
                return {
                    message: 'Contest joining is disabled right now',
                    status: false,
                    data: {}
                };
            }
            await delay(10)
            const keyName = `match:${matchkey}:challenges`; // Redis Hash key
            const matchchallenge = await redisContest.hgetData(keyName, matchchallengeid);
            if (!matchchallenge) {
                return {
                    message: 'Match  Challenge Not Found',
                    status: false,
                    data: {}
                };
            }

            const { _id: matchchallengesDataId, multi_entry, entryfee, contest_cat, win_amount, maximum_user } = matchchallenge;

            if (matchchallenge.status == 'closed' || matchchallenge.joinedusers == maximum_user) {
                if (matchchallenge.is_running == 1) {
                    return {
                        message: 'Match Challenge has been closed',
                        status: false,
                        is_closed: true,
                        data: { is_running: 1, entryfee: entryfee, win_amount: win_amount, maximum_user: maximum_user, jointeamid: jointeamid, discount_fee: discount_fee, matchkey: matchkey }
                    };
                } else {
                    return {
                        message: 'Match Challenge has been closed',
                        status: false,
                        data: {}
                    };
                }
            }

            let keyname = `listMatchesModel-${matchkey}`
            let listmatch = await getkeydata(keyname);
            if (!listmatch) {
                listmatch = await matchesModel.findOne({ _id: new mongoose.Types.ObjectId(req.params.matchId) }).lean();
                await setkeydata(keyname, listmatch || {}, 20 * 24 * 60 * 60);
            }
            const { _id: listmatchId, series: seriesId, start_date: matchStartDate } = listmatch;

            const challengeCounterKey = `match:${listmatchId}:challenge:${matchchallengeid}:joinedTeams`;
            const userChallengeCounterKey = `match:${listmatchId}:challenge:${matchchallengeid}:user:${userId}:joinedTeams`;
            const matchTime = await this.getMatchTime(matchStartDate);
            if (!matchTime) {
                return {
                    message: 'Match has been closed, You cannot join league now.',
                    status: false,
                    data: {}
                };
            }

            const jointeamids = jointeamid.split(',').map(id => id.trim());
            // Redis Key for storing teams
            const redisKey = `match:${listmatchId}:user:${userId}:teams`;

            let cachedTeams = await getkeydata(redisKey);
            // if (!cachedTeams) {
            //     cachedTeams = await userTeamModel.find({ listmatchId, userid: userId }).lean();
            //     await setkeydata(redisKey, cachedTeams, expRedisTime); // Cache for 12 hours
            // }


            if (!Array.isArray(cachedTeams) || cachedTeams.length === 0) {
                cachedTeams = [];
            }

            const cachedTeamIds = new Set(cachedTeams.map(team => team._id.toString()));

            const missingTeamIds = jointeamids.filter(id => !cachedTeamIds.has(id));

            if (missingTeamIds.length > 0) {
                const missingTeams = await userTeamModel.find({ _id: { $in: missingTeamIds }, matchkey: listmatchId, userid: userId }).lean();
                cachedTeams = [...cachedTeams, ...missingTeams];
                await setkeydata(redisKey, cachedTeams, expRedisTime);
            }
            const validTeamsCount = cachedTeams.filter(team => jointeamids.includes(team._id.toString()));
            let keyLeaderBoard = `match:${listmatchId}:challenge:${matchchallengeid}:user:${req.user._id}:userLeaderBoard`;
            let joinedLeauges = await redisLeaderboards.getMyLeaderBoard(keyLeaderBoard, req.user._id);
            if (joinedLeauges == false) {
                joinedLeauges = [];
            }


            if (jointeamids.length === 1 && joinedLeauges.length === 1 && jointeamid === joinedLeauges[0]?.jointeamid.toString()) {
                return { message: 'Contest Already joined', status: false, data: {} };
            }

            if (validTeamsCount.length !== jointeamids.length) {
                return {
                    message: 'Invalid Team',
                    status: false,
                    data: {}
                };
            }

            if (multi_entry === 0) {
                if (joinedLeauges.length > 0 || jointeamids.length > 1) {
                    return {
                        message: 'Contest Already joined or You can only join once.',
                        status: false,
                        data: {}
                    };
                }
            } else {

                if (joinedLeauges.length >= matchchallenge.team_limit) {
                    return {
                        message: 'You cannot join with more teams now.',
                        status: false,
                        data: {}
                    };
                }
            }
            const user = await redisUser.getUser(userId);


            let userbalance = await redisUser.redis.hgetall(`wallet:{${userId}}`);
            if (!userbalance) {
                await redisUser.setDbtoRedisWallet(userId);
                userbalance = await redisUser.redis.hgetall(`wallet:{${userId}}`);
            }


            if (!userbalance) {
                return { message: 'Insufficient balance', status: false, data: {} };
            }

            // 
            let bonus = Number(userbalance.bonus);
            let balance = Number(userbalance.balance);
            let winning = Number(userbalance.winning);
            let extraCash = 0;

            const parseBalance = (value) => parseFloat(value.toFixed(2));
            const totalBalance = parseBalance(bonus) + parseBalance(balance) + parseBalance(winning) + extraCash;
            let tranid = '';
            let mainbal = 0, mainbonus = 0, mainwin = 0;

            const createTransaction = async (userId, balance, bonus, extraCash, winning, increment = {}, entryfee, totalBalance, matchchallengeid, balances,
                tranid,
                count
            ) => {
                // 1. Prepare balance update message
                const userUpdateMsg = {
                    filter: { _id: userId },
                    payload: {
                        'userbalance.balance': balance,
                        'userbalance.bonus': bonus,
                        'userbalance.winning': winning,
                        'userbalance.extraCash': extraCash,
                        $inc: increment,
                    },
                    modelName: "user"
                };
                // 2. Prepare transaction message
                const transactionData = {
                    type: 'Contest Joining Fee',
                    contestdetail: `${entryfee}-${count}`,
                    amount: entryfee * count,
                    total_available_amt: totalBalance - entryfee * count,
                    transaction_by: constant.TRANSACTION_BY.WALLET,
                    challengeid: matchchallengeid,
                    userid: userId,
                    paymentstatus: constant.PAYMENT_STATUS_TYPES.CONFIRMED,
                    bal_bonus_amt: balances.bonus,
                    bal_win_amt: balances.winning,
                    bal_fund_amt: balances.balance,
                    extra_fund_amt: balances?.extraCash || 0,
                    cons_amount: balances.mainbal,
                    cons_bonus: balances.mainbonus,
                    cons_win: balances.mainwin,
                    transaction_id: tranid,
                };

                const transactionMsg = {
                    payload: transactionData,
                    modelName: "wallettransactions"
                };
                const walletUpdate = {
                    balance: balance,
                    bonus: bonus,
                    winning: winning,
                    extraCash: extraCash
                };
                transactionData.match_name = listmatch.short_name;
                transactionData.transaction_type = 'Debit';

                await redisUser.saveTransactionToRedis(userId, walletUpdate, transactionData);

                // 3. Send to respective queues
                sendToQueue('updateUserQueue', userUpdateMsg);
                sendToQueue('createTransactionQueue', transactionMsg);
            };

            if (entryfee > 0) {
                const randomStr = randomstring.generate({ charset: 'alphanumeric', length: 4, });
                tranid = `${global.constant.APP_SHORT_NAME}-${Date.now()}-${randomStr}`;
            }

            const coupon = randomstring.generate({ charset: 'alphanumeric', length: 4, });
            let referCode = `${global.constant.APP_SHORT_NAME}-${Date.now()}${coupon}`;
            let shouldBreakLoop = false;

            for (const jointeam of validTeamsCount) {

                let [currentChallengeCount, currentUserCount] = await Promise.all([
                    redis.get(challengeCounterKey),
                    redis.get(userChallengeCounterKey)
                ]);

                const challengeMaxTeamCount = parseInt(currentChallengeCount || '0');
                const userTeamCount = parseInt(currentUserCount || '0');
                if (multi_entry > 0 && userTeamCount >= matchchallenge.team_limit) {
                    break;
                }
                const isTeamJoined = joinedLeauges.some(item => item.jointeamid.toString() == jointeam._id);
                if (!isTeamJoined) {
                    if (matchchallenge.contest_type == 'Amount' && challengeMaxTeamCount >= matchchallenge.maximum_user) {
                        totalchallenges = 0;
                        totalmatches = 0;
                        totalseries = 0;
                        let updateOperations = [
                            matchchallengesModel.findOneAndUpdate(
                                { _id: mongoose.Types.ObjectId(matchchallengeid) },
                                { status: 'closed' },
                                { new: true }
                            )
                        ];
                        if (entryfee > 0) {
                            updateOperations.push(
                                createTransaction(userId, balance, bonus, extraCash, winning, { totalchallenges, totalmatches, totalseries }, entryfee, totalBalance, matchchallengeid, { bonus, balance, winning, mainbal, mainbonus, mainwin }, tranid, joinedTeams),
                            );
                        }
                        await Promise.all(updateOperations);
                        shouldBreakLoop = true;
                        break;
                    }

                    const { status, finalBalances, finalUsedBalances, count: successfulChallenges } = await this.deductBalanceForChallenge(
                        matchchallenge,
                        { bonus, balance, winning },
                        1
                    );

                    if (joinedTeams == 0 && !status) {
                        return { message: 'Insufficient balance', status: false, data: {} };
                    }

                    mainbal += finalUsedBalances?.balanceUsed || 0;
                    mainbonus += finalUsedBalances?.bonusUsed || 0;
                    mainwin += finalUsedBalances?.winningUsed || 0;
                    bonus = finalBalances?.bonus || 0;
                    balance = finalBalances?.balance || 0;
                    winning = finalBalances?.winning || 0;
                    if (status && successfulChallenges > 0) {
                        await redis.incr(challengeCounterKey);
                        await redis.incr(userChallengeCounterKey);
                        let leaderBoardId = new mongoose.Types.ObjectId();
                        let joinId = new mongoose.Types.ObjectId();
                        let redisLeaderboard = {
                            "_id": `${leaderBoardId.toString()}`,
                            "getcurrentrank": challengeMaxTeamCount,
                            "usernumber": 0,
                            "joinleaugeid": joinId,
                            "joinTeamNumber": Number(jointeam.teamnumber),
                            "jointeamid": jointeam._id,
                            "userid": req.user._id,
                            "team": user.team,
                            "image": `${global.constant.IMAGE_URL}team_image.png`,
                            "teamnumber": jointeam.teamnumber,
                            "refercode": referCode
                        }

                        const msg = {
                            leagueData: {
                                _id: joinId,
                                userid: req.user._id,
                                challengeid: matchchallengesDataId,
                                teamid: jointeam._id,
                                matchkey: listmatchId,
                                seriesid: seriesId,
                                transaction_id: tranid,
                                refercode: referCode,
                                teamnumber: jointeam.teamnumber,
                                leaugestransaction: {
                                    user_id: userId,
                                    bonus: finalUsedBalances?.bonusUsed || 0,
                                    balance: finalUsedBalances?.balanceUsed || 0,
                                    winning: finalUsedBalances?.winningUsed || 0
                                }
                            },
                            leaderBoardData: {
                                _id: leaderBoardId,
                                userId: req.user._id,
                                challengeid: matchchallengesDataId,
                                teamId: jointeam._id,
                                matchkey: listmatchId,
                                user_team: user.team,
                                teamnumber: jointeam.teamnumber,
                                captain: jointeam.captain,
                                vicecaptain: jointeam.vicecaptain,
                                playersData: jointeam.players,
                                joinId: joinId,
                                contest_winning_type: matchchallenge.amount_type,
                                joinNumber: challengeMaxTeamCount
                            },
                            matchchallengeid,
                            userId,
                            listmatchId,
                            teamnumber: jointeam.teamnumber,
                            redisLeaderboard
                        }

                        const redisleaderBoardData = {
                            _id: `${leaderBoardId.toString()}`,
                            points: 0,
                            getcurrentrank: 1,
                            challengeid: matchchallengeid.toString(),
                            matchkey: listmatchId,
                            lastUpdate: false,
                            teamnumber: Number(jointeam.teamnumber),
                            userno: "0",
                            userjoinid: joinId,
                            userid: req.user._id,
                            jointeamid: jointeam._id,
                            teamname: user.team,
                            joinNumber: challengeMaxTeamCount,
                            image: `${global.constant.IMAGE_URL}avtar1.png`,
                            player_type: "classic",
                            winingamount: "",
                            contest_winning_type: "price",
                        };

                        const keyChallengeLeaderBoardNew = `liveRanksLeaderboard_${matchchallengeid.toString()}`;
                        var expRedisTime = await matchTimeDifference(listmatchId);
                        await redisLeaderboards.storeSortedSet(keyChallengeLeaderBoardNew, redisleaderBoardData, expRedisTime);
                        // await redisLiveLeaderboard.storeSortedSet(keyChallengeLeaderBoardNew, redisleaderBoardData, expRedisTime);

                        let redisUserChallenge = {
                            "_id": `${matchchallengeid.toString()}`,
                            "getcurrentrank": userTeamCount + 1,
                            "matchkey": listmatchId
                        }
                        let keyUserJoinedChallenge = `match:${listmatchId}:user:${userId}:joinedContests`;
                        await redisLeaderboards.storeSortedSet(keyUserJoinedChallenge, redisUserChallenge, expRedisTime);
                        // await redisLiveLeaderboard.storeSortedSet(keyUserJoinedChallenge, redisUserChallenge, expRedisTime);
                        let redisUserMatch = {
                            "_id": `${listmatchId.toString()}`,
                            "getcurrentrank": 1,
                            "matchkey": listmatchId
                        }
                        let keyUserJoinedMatches = `user:${userId}:matches`;
                        await redisLeaderboards.storeSortedSet(keyUserJoinedMatches, redisUserMatch, expRedisTime);
                        // await redisLiveLeaderboard.storeSortedSet(keyUserJoinedMatches, redisUserMatch, expRedisTime);

                        redisLeaderboard._id = `${leaderBoardId.toString()}-${userId}`;
                        let keyLeaderBoard = `match:${listmatchId}:challenge:${matchchallengeid}:user:${userId}:userLeaderBoard`;
                        await redisLeaderboards.storeSortedSet(keyLeaderBoard, redisLeaderboard, expRedisTime);
                        // await redisLiveLeaderboard.storeSortedSet(keyLeaderBoard, redisLeaderboard, expRedisTime);

                        sendToQueue('createContestLeaderboard', msg);
                        joinedTeams++;
                    }
                }
            }
            if (shouldBreakLoop) {
                if (matchchallenge.is_running == 1) {
                    return {
                        message: 'Match Challenge has been closed',
                        status: false,
                        is_closed: true,
                        data: { is_running: 1, entryfee: entryfee, win_amount: win_amount, maximum_user: maximum_user, jointeamid: jointeamid, discount_fee: discount_fee, matchkey: matchkey }
                    };
                } else {
                    return {
                        message: 'Match Challenge has been closed',
                        status: false,
                        data: {}
                    };
                }
            }

            totalchallenges = 0;
            totalmatches = 0;
            totalseries = 0;

            const totalChallengeJoined = await redis.get(challengeCounterKey);
            //remove this query
            let updateOperations = [];

            if (entryfee > 0) {
                updateOperations.push(
                    createTransaction(userId, balance, bonus, extraCash, winning, { totalchallenges, totalmatches, totalseries }, entryfee, totalBalance, matchchallengeid, { bonus, balance, winning, mainbal, mainbonus, mainwin }, tranid, joinedTeams)
                );
            }
            let fieldsToUpdate = {
                joinedusers: totalChallengeJoined
            };

            // If contest is full, update status to "closed"
            if (totalChallengeJoined == maximum_user) {
                fieldsToUpdate.status = 'closed';
            }

            // Update Redis fields
            await redisUpdateChallenge.insertRedisFields(listmatchId, contest_cat, matchchallengeid, fieldsToUpdate);

            await Promise.all(updateOperations);

            sendToQueue('contestClosed', {
                filter: { _id: matchchallengeid },
                payload: fieldsToUpdate,
                modelName: 'matchcontest'
            });

            return {
                message: 'Contest Joined',
                status: true,
                data: {
                    joinedusers: totalChallengeJoined,
                    referCode: referCode
                }
            };

        } catch (e) {
            console.log(e)
            throw e;
        }
    }

}
module.exports = new contestServices();
