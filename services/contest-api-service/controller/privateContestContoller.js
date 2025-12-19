const { privateContestPriceCard, createPrivateContest } = require("../services/privateContest");

exports.privateContestPriceCard = async (req, res, next) => {
  try {
    let { entryFees, totalPlayers } = req.body;
    entryFees = Number(entryFees);
    totalPlayers = Number(totalPlayers);
    let winners;
    // let winnersArray = [5000, 2000, 1000, 500, 250, 100, 50, 25, 15, 10, 7, 5, 4, 3, 2, 1];
    let winnersArray = [1, 2, 3, 4, 5, 7, 10, 15, 25, 50, 100, 250, 500, 1000, 2000, 5000]
    for (const numberOfwinners of winnersArray) {
      if (totalPlayers >= numberOfwinners) {
        winners = totalPlayers / 2;
        break;  
      }
    }
    if (entryFees == 0) {
      let zeroEntrydata = [{
        "PriceCard": [
          {
            "rank": 1,
            "prize": 0,
            "min": 0,
            "max": 1
          }
        ],
        "details": {
          "fristPrice": 0,
          "totalWiningAmount": 0
        },
        "winner": 1
      }]
      return res.status(200).json(Object.assign({ success: "success" }, { status: true, message: 'Data fetched successfully', data: zeroEntrydata }));
    }
    winners = Math.floor(winners)
    let arrR = []

    console.log("winners", winners);
    for (const iterator of winnersArray) {
      if (winners >= iterator) {
        const data = await privateContestPriceCard(entryFees, totalPlayers, iterator);
        if (data.data) {
          data.data.winner = iterator
          arrR.push(data.data)
        }
      }

    }
    return res.status(200).json(Object.assign({ success: "success" }, { status: true, message: 'Data fetched successfully', data: arrR }));
  } catch (error) {
    next(error);
  };
};

exports.createPrivateContest = async (req, res, next) => {
  try {
    // console.log(`here`, req.user._id);
    const data = await createPrivateContest(req);
    return res.status(200).json(Object.assign({ success: true }, data));
  } catch (error) {
    next(error);
  }
}