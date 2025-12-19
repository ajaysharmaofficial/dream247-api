const mongoose = require("mongoose");
const moment = require("moment");
const matchesModel = require("../models/matchesModel");
const redisJoinTeams = require("./redis/redisjoinTeams");


exports.matchTimeDifference = async function (matchkey) {
    try {
        let keynameExpMatch = `listMatchesModel-${matchkey}`;
        let matchDataForExpire = await redisJoinTeams.getkeydata(keynameExpMatch);

        if (!matchDataForExpire) {
            let data = await matchesModel.findOne(
                { _id: mongoose.Types.ObjectId(matchkey) }
            );

            if (!data) {
                console.error("Match not found in DB.");
                return null;
            }

            await redisJoinTeams.setkeydata(keynameExpMatch, data, 20 * 24 * 60 * 60);
            matchDataForExpire = data;
        }

        let matchExpStartDate = moment(matchDataForExpire.start_date, "YYYY-MM-DD HH:mm:ss").add(3, "days");
        let currentExTime = moment();
        let expireTime = matchExpStartDate.diff(currentExTime, "seconds");

        if (expireTime <= 0) {
            expireTime = 60 * 60 * 24 * 2;
        }
        return expireTime;
    } catch (error) {
        console.error("Error in matchTimeDifference:", error);
        return 20 * 24 * 60 * 60;
    }
};

exports.matchRemTime = async function (matchkey) {
    try {
        let keynameExpMatch = `listMatchesModel-${matchkey}`;
        let matchDataForExpire = await redisJoinTeams.getkeydata(keynameExpMatch);

        if (!matchDataForExpire) {
            let data = await matchesModel.findOne(
                { _id: mongoose.Types.ObjectId(matchkey) }
            );

            if (!data) {
                console.error("Match not found in DB.");
                return null;
            }

            await redisJoinTeams.setkeydata(keynameExpMatch, data, 20 * 24 * 60 * 60);
            matchDataForExpire = data;
        }

        let matchExpStartDate = moment(matchDataForExpire.start_date, "YYYY-MM-DD HH:mm:ss");
        let currentExTime = moment();
        let expireTime = matchExpStartDate.diff(currentExTime, "seconds");
        return expireTime;
    } catch (error) {
        console.error("Error in matchTimeDifference:", error);
        return 20 * 24 * 60 * 60;
    }
};