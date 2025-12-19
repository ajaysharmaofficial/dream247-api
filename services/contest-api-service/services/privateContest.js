const { default: mongoose } = require('mongoose');
// const subscribeModel = require('../../../models/subscribeModel');
const matchchallengesModel = require('../../../models/matchContestModel');

const RedisUpdateChallenge = require('../../../utils/redisUpdateChallenge');
const redisUpdateChallenge = new RedisUpdateChallenge();

exports.privateContestPriceCard = async (entryFees, totalPlayers, winners) => {
    try {
        let obj = {};

        if (entryFees && totalPlayers && winners) {
            const winnerPercentage = (winners / totalPlayers) * 100;
            console.log(entryFees, totalPlayers, winners);
            let prizeDistribution;

            switch (winners) {
                case 1:
                    prizeDistribution = [{ winningPrice: 80, rank: 1, min: 0, max: 1 }];
                    break;
                case 2:
                    prizeDistribution = [
                        { winningPrice: 48, rank: 1, min: 0, max: 1 },
                        { winningPrice: 32, rank: 2, min: 1, max: 2 },
                    ];
                    break;
                case 3:
                    prizeDistribution = [
                        { winningPrice: 40, rank: 1, min: 0, max: 1 },
                        { winningPrice: 24, rank: 2, min: 1, max: 2 },
                        { winningPrice: 16, rank: 3, min: 2, max: 3 },
                    ];
                    break;
                case 4:
                    prizeDistribution = [
                        { winningPrice: 40, rank: 1, min: 0, max: 1 },
                        { winningPrice: 20, rank: 2, min: 1, max: 2 },
                        { winningPrice: 12, rank: 3, min: 2, max: 3 },
                        { winningPrice: 8, rank: 4, min: 3, max: 4 },
                    ];
                    break;
                case 5:
                    prizeDistribution = [
                        { winningPrice: 36, rank: 1, min: 0, max: 1 },
                        { winningPrice: 20, rank: 2, min: 1, max: 2 },
                        { winningPrice: 12, rank: 3, min: 2, max: 3 },
                        { winningPrice: 8, rank: 4, min: 3, max: 4 },
                        { winningPrice: 4, rank: 5, min: 4, max: 5 },
                    ];
                    break;
                case 6:
                    prizeDistribution = [
                        { winningPrice: 24, rank: 1, min: 0, max: 1 },
                        { winningPrice: 16, rank: 2, min: 1, max: 2 },
                        { winningPrice: 14, rank: 3, min: 2, max: 3 },
                        { winningPrice: 10, rank: 4, min: 3, max: 4 },
                        { winningPrice: 8, rank: 5, min: 4, max: 5 },
                        { winningPrice: 8, rank: 6, min: 5, max: 6 },
                    ];
                    break;
                default:
                    prizeDistribution = [
                        { winningPrice: 36, rank: 1, min: 0, max: 1 },
                        { winningPrice: 20, rank: 2, min: 1, max: 2 },
                        { winningPrice: 12, rank: 3, min: 2, max: 3 },
                        { winningPrice: 8, rank: 4, min: 3, max: 4 },
                        { winningPrice: 4, rank: 5, min: 4, max: 5 },
                    ];
                    let hello = winners - 5;
                    for (let i = 6; i <= winners; i++) {
                        prizeDistribution.push({ winningPrice: 8 / hello, rank: i });
                    }
                    break;
            }

            const totalPrize = entryFees * totalPlayers;
            console.log(totalPrize);

            const prizeAmounts = prizeDistribution.map(({ winningPrice, rank, min, max }) => ({
                rank,
                prize: Number(((winningPrice / 100) * totalPrize).toFixed(2)),
                min,
                max,
            }));

            obj.totalWiningAmount = (totalPrize / 100) * 80;

            // Handle winners >= 7 with a specific prize distribution and correct first prize
            if (winners >= 7) {
                prizeDistribution = [
                    { winningPrice: 24, rank: 1, min: 0, max: 1 },
                    { winningPrice: 16, rank: 2, min: 1, max: 2 },
                    { winningPrice: 14, rank: 3, min: 2, max: 3 },
                    { winningPrice: 10, rank: 4, min: 3, max: 4 },
                    { winningPrice: 8, rank: 5, min: 4, max: 5 },
                ];

                let remainingWinning = (totalPrize / 100) * 8;
                const newPrizeAmounts = prizeDistribution.map(({ winningPrice, rank, min, max }) => ({
                    rank,
                    prize: Number(((winningPrice / 100) * totalPrize).toFixed(2)),
                    min,
                    max,
                }));

                const amountToDistribute = (remainingWinning / (winners - 5)).toFixed(2);

                newPrizeAmounts.push({ rank: `6 to ${winners}`, prize: amountToDistribute, min: 5, max: winners });

                // Correct first prize based on the updated prize distribution
                obj.fristPrice = (totalPrize / 100) * prizeDistribution[0].winningPrice;

                return {
                    status: true,
                    message: 'Data fetched successfully',
                    data: { PriceCard: newPrizeAmounts, details: obj },
                };
            }

            // Correct first prize for winners less than 7
            obj.fristPrice = (totalPrize / 100) * prizeDistribution[0].winningPrice;

            return {
                status: true,
                message: 'Data fetched successfully',
                data: { PriceCard: prizeAmounts, details: obj },
            };
        } else {
            return {
                status: false,
                message: 'Provide request data (entryFees, totalPlayers, winners)',
            };
        }
    } catch (error) {
        console.error(error);
        return {
            status: false,
            message: error.message,
        };
    }
};

/**
 * @function createPrivateContest
 * @description create private Contest
 * @param { matchkey, maximum_user, win_amount, entryfee, multi_entry, contestName }
 * @author 
 */
exports.createPrivateContest = async (req) => {
    try {
        let { matchkey, entryFees, winners, totalPlayers, multi_entry, contestName, fantasy_type } = req.body;
        let winnerPercentage = (winners / totalPlayers) * 100;
        // if (winnerPercentage > 25) {
        //     return {
        //         status: false,
        //         message: 'Percentage of winners cannot exceed 25%',
        //     };
        // };
        entryFees = Number(entryFees);
        totalPlayers = Number(totalPlayers);
        winners = Number(winners);
        multi_entry = Number(multi_entry);
        const createPriceCard = await this.privateContestPriceCard(entryFees, totalPlayers, winners);
        if (totalPlayers < 2) {
            return {
                message: 'Invalid league details. You cannot create a league with less then two members.',
                status: false,
                data: {},
            };
        }
        // console.log(createPriceCard, 'createPriceCard.datacreatePriceCard.datacreatePriceCard.data')
        // const challengeid = new mongoose.Types.ObjectId();
        const priceCardArray = [];
        for (const item of createPriceCard.data.PriceCard) {
            let total = Number(((item.prize) * (item.rank)));
            if (typeof item.rank == 'string') total = Math.abs(Number(((item.prize) * Number(5 - winners))))
            priceCardArray.push({
                "matchkey": mongoose.Types.ObjectId(matchkey),
                "prize_name": "",
                "image": "",
                "winners": item.rank,
                "price": Number(item.prize),
                "min_position": Number(item.min),
                "max_position": Number(item.max),
                "total": total,
                "type": 'Amount',
                "gift_type": "amount"
            })
        }
        let contestCode = Array.from({ length: 10 }, () => Math.random().toString(36)[2]).join('');
        let obj = {
            fantasy_type: fantasy_type,
            matchkey: mongoose.Types.ObjectId(matchkey),
            entryfee: Number(entryFees),
            win_amount: Number(createPriceCard.data.details.totalWiningAmount),
            maximum_user: Number(totalPlayers),
            minimum_user: 2,
            contestCode: contestCode,
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
            matchpricecards: priceCardArray,
        }

        let matchChallengeData = await matchchallengesModel.create(obj);

        if (matchChallengeData) {
            const priceDetails = matchChallengeData.matchpricecards[0];

            totalwinners =
                matchChallengeData.matchpricecards.reduce(
                    (acc, item) => acc + Number(item.winners),
                    0
                ) ||
                Number(priceDetails.winners) ||
                1;

            price_card = {
                total: priceDetails.total.toString(),
                price:
                    priceDetails.type === "Percentage"
                        ? (priceDetails.total / totalwinners).toFixed(2)
                        : matchChallengeData.amount_type === "prize"
                            ? priceDetails.prize_name
                            : Number(priceDetails.price).toFixed(2),
                price_percent: priceDetails.price_percent
                    ? `${priceDetails.price_percent}%`
                    : undefined,
                gift_type: priceDetails.gift_type || "amount",
                image:
                    matchChallengeData.amount_type === "prize"
                        ? `${global.constant.IMAGE_URL}${priceDetails.image}`
                        : "",
            };
            const fieldsToUpdate = {
                type: "contest",
                is_PromoCode_Contest: matchChallengeData.is_PromoCode_Contest || false,
                challenge_id: matchChallengeData.challenge_id || null,
                matchchallengeid: matchChallengeData._id,
                status: matchChallengeData.status || "opened",
                entryfee: matchChallengeData.entryfee,
                win_amount: matchChallengeData.win_amount,
                maximum_user: matchChallengeData.maximum_user,
                joinedusers: matchChallengeData.joinedusers || 0,
                contest_type: matchChallengeData.contest_type,
                winning_percentage: matchChallengeData.winning_percentage,
                is_bonus: matchChallengeData.is_bonus,
                bonus_percentage: matchChallengeData.bonus_percentage,
                confirmed_challenge: matchChallengeData.confirmed_challenge,
                multi_entry: matchChallengeData.multi_entry,
                team_limit: matchChallengeData.team_limit,
                discount_fee: matchChallengeData.discount_fee,
                price_card,
                extrapricecard: matchChallengeData.extrapricecards || [],
                totalwinners,
                flexible_contest: matchChallengeData.flexible_contest || "0",
                pdfDownloadStatus: matchChallengeData.pdfDownloadStatus || null,
                conditional_contest: matchChallengeData.conditional_contest || 0,
                mandatoryContest: matchChallengeData.mandatoryContest || null,
                bonus_type: matchChallengeData.bonus_type,
                amount_type: matchChallengeData.amount_type,
                mega_status: matchChallengeData.mega_status,
                minimum_user: matchChallengeData.minimum_user || 0,
                pricecard_type: matchChallengeData.pricecard_type,
                c_type: matchChallengeData.c_type || "",
                WinningpriceAndPrize: matchChallengeData.WinningpriceAndPrize || "",
                compress: matchChallengeData.compress || false,
                textNote: matchChallengeData.textNote || "",
                is_running: matchChallengeData.is_running || 0,
                is_duplicated: matchChallengeData.is_duplicated || false,
                setCount: matchChallengeData.setCount || 20,
                is_recent: matchChallengeData.is_recent || false,
                is_private: matchChallengeData.is_private || 0,
                fantasy_type: matchChallengeData.fantasy_type || fantasy_type,
                contest_name: matchChallengeData.contest_name || contestName,
                team_type_id: matchChallengeData?.team_type_id || null,
                team_type_name: matchChallengeData?.team_type_name || "10-1",
            };
            let contest_cat = null;
            // console.log("fieldsToUpdate.status =>", fieldsToUpdate);
            await redisUpdateChallenge.insertRedisFields(
                matchkey,
                contest_cat,
                matchChallengeData._id,
                fieldsToUpdate
            );


            return {
                message: 'Challenge successfully Created.',
                status: true,
                data: {
                    matchchallengeid: matchChallengeData._id,
                    contestCode: contestCode,
                    entryfee: entryFees,
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
        throw error;
    }
};
