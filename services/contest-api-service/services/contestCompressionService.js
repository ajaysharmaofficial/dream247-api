const { default: mongoose } = require('mongoose');
const matchesModel = require('../../models/matchesModel');
const matchContestModel = require('../../models/matchContestModel');
const privateContest = require('../services/privateContest')


exports.contestCompression = async (req, res) => {
    try {
        const data = await matchesModel.aggregate([
            {
                '$match': {
                    'status': 'started',
                    'launch_status': 'launched',
                    'final_status': 'pending',
                }
            },
            {
                '$project': {
                    '_id': 0,
                    'matchkey': '$_id'
                }
            },
            {
                '$lookup': {
                    'from': 'matchcontest',
                    'localField': 'matchkey',
                    'foreignField': 'matchkey',
                    'pipeline': [
                        {
                            '$match': {
                                'compress': false,
                                "flexible_contest": "1",
                                "pricecard_type": "Amount"
                            }
                        }
                    ],
                    'as': 'data'
                }
            },
            {
                '$unwind': '$data'
            },
            {
                '$replaceRoot': {
                    'newRoot': '$data'
                }
            },
            {
                '$lookup': {
                    'from': 'userleague',
                    'localField': '_id',
                    'foreignField': 'challengeid',
                    'as': 'result'
                }
            },
            {
                '$addFields': {
                    'joinedusers': { '$size': '$result' }
                }
            },
            {
                '$project': {
                    'joinedusers': 1,
                    'matchkey': 1,
                    'entryfee': 1,
                    'win_amount': 1,
                    'maximum_user': 1,
                    'matchpricecards': 1
                }
            }
        ]);
        if (data.length > 0) {
            for (const contest of data) {
                if (contest.joinedusers > 1) {
                    let joinedUserPercentage = Number(((contest.joinedusers / contest.maximum_user) * 100).toFixed(2));
                    let newWinningAmount = Number(((joinedUserPercentage / 100) * contest.win_amount).toFixed(2));
                    let matchpricecard = [];

                    if (joinedUserPercentage > 50) {
                        // const lastIndexOfMatchPriceCard = contest.matchpricecards.length - 1;
                        let totalamount = 0;

                        for (const priceCard of contest.matchpricecards) {
                            let totalPercentOfWinningAmount = Number(((priceCard.total / contest.win_amount) * 100).toFixed(2));
                            let getNewTotalAmountOfPriceCard = Math.round(((totalPercentOfWinningAmount / 100) * newWinningAmount).toFixed(2));
                            if (priceCard.max_position > contest.joinedusers || newWinningAmount < totalamount + getNewTotalAmountOfPriceCard) break;
                            totalamount += getNewTotalAmountOfPriceCard;
                            priceCard.total = getNewTotalAmountOfPriceCard;
                            priceCard.price = getNewTotalAmountOfPriceCard / priceCard.winners;
                            matchpricecard.push(priceCard);
                        }

                        let getfirstwinning = Number(matchpricecard[0].price / matchpricecard[0].winners);
                        if (getfirstwinning < contest.entryfee) {
                            await matchContestModel.findOneAndUpdate({ matchkey: contest.matchkey, _id: contest._id }, { "flexible_contest": "0", 'compress': true });
                        }
                        await matchContestModel.findOneAndUpdate({ matchkey: contest.matchkey, _id: contest._id }, { "matchpricecards": matchpricecard, win_amount: newWinningAmount, 'compress': true });
                    } else {
                        if (contest.joinedusers <= 3) {
                            matchpricecard.push({ ...contest.matchpricecards[0], total: newWinningAmount, price: newWinningAmount, winners: 1 });
                        } else if (contest.joinedusers <= 5) {
                            matchpricecard.push({ ...contest.matchpricecards[0], total: newWinningAmount * 0.6, price: newWinningAmount * 0.6, winners: 1 });
                            matchpricecard.push({ ...contest.matchpricecards[1], total: newWinningAmount * 0.4, price: newWinningAmount * 0.4, winners: 1 });

                        } else if (contest.joinedusers <= 10) {
                            matchpricecard.push({ ...contest.matchpricecards[0], total: newWinningAmount * 0.5, price: newWinningAmount * 0.5, winners: 1 });
                            matchpricecard.push({ ...contest.matchpricecards[1], total: newWinningAmount * 0.3, price: newWinningAmount * 0.3, winners: 1 });
                            matchpricecard.push({ ...contest.matchpricecards[2], total: newWinningAmount * 0.2, price: newWinningAmount * 0.2, winners: 1 });
                        } else if (contest.joinedusers <= 20) {
                            matchpricecard.push({ ...contest.matchpricecards[0], total: newWinningAmount * 0.45, price: newWinningAmount * 0.45, winners: 1 });
                            matchpricecard.push({ ...contest.matchpricecards[1], total: newWinningAmount * 0.25, price: newWinningAmount * 0.25, winners: 1 });
                            matchpricecard.push({ ...contest.matchpricecards[2], total: newWinningAmount * 0.1, price: newWinningAmount * 0.1, winners: 1 });
                            matchpricecard.push({ ...contest.matchpricecards[3], total: newWinningAmount * 0.1, price: newWinningAmount * 0.1, winners: 1 });
                        } else {
                            let entryFees = Number(contest.entryfee);
                            let totalPlayers = Number(contest.joinedusers);
                            let winners = Math.floor(totalPlayers / 2);
                            const createPriceCard = await privateContest.getPriceCard(entryFees, totalPlayers, winners);

                            for (const item of createPriceCard.data.PriceCard) {
                                let total = Number(item.prize * item.rank);
                                if (typeof item.rank == 'string') total = Math.abs(Number(item.prize * (5 - winners)));
                                matchpricecard.push({
                                    "matchkey": mongoose.Types.ObjectId(contest.matchkey),
                                    "prize_name": "",
                                    "image": "",
                                    "winners": item.rank,
                                    "price": Number(item.prize),
                                    "min_position": Number(item.min),
                                    "max_position": Number(item.max),
                                    "total": total,
                                    "type": 'Amount',
                                    "gift_type": "amount"
                                });
                            }
                        }
                        await matchContestModel.findOneAndUpdate({ matchkey: contest.matchkey, _id: contest._id }, { "matchpricecards": matchpricecard, win_amount: newWinningAmount, 'compress': true });
                    }
                } else {
                    await matchContestModel.findOneAndUpdate({ matchkey: contest.matchkey, _id: contest._id }, { confirmed_challenge: 0, "flexible_contest": "0", 'compress': true });
                }
            }

            return {
                message: "Contest Compression",
                status: true,
                data: data
            }
        }
        return true;
    } catch (error) {
        console.log(error);
    }
}
