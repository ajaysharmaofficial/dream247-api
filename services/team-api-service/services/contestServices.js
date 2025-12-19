const mongoose = require('mongoose');
const userLeagueModel = require('../../../models/userLeagueModel');
const userTeamModel = require('../../../models/userTeamModel');
const userLeaderBoardModel = require('../../../models/userLeaderBoardModel');
const matchServices = require('./matchServices');
const matchesModel = require('../../../models/matchesModel');
const { getkeydata, setkeydata } = require('../../../utils/redis/redisjoinTeams');
const redisLiveJoinTeams = require('../../../utils/redis/redisLiveJoinTeams');
const { storeSortedSet, hgetData } = require('../../../utils/redis/redisLeaderboard');
const redisLiveLeaderboard = require('../../../utils/redis/redisLiveLeaderboard');
const { matchTimeDifference, matchRemTimeDifference } = require("../../../utils/matchTimeDiffrence");
const { sendToQueue } = require('../../../utils/kafka');

class contestServices {
    constructor() {
        return {
            changeTeams: this.changeTeams.bind(this),

        }
    }
    async changeTeams(req) {
        try {
            const { matchkey, switchteam, leaderBoardId, challengeId } = req.body;
            let keyname = `listMatchesModel-${matchkey}`
            let match = await getkeydata(keyname);
            if (!match) {
                match = await matchesModel.findOne({ _id: mongoose.Types.ObjectId(matchkey) });
                setkeydata(keyname, match, 20 * 24 * 60 * 60);
            }
            //comment for redis-->const match = matchesModel.findOne({ _id: mongoose.Types.ObjectId(matchkey) });
            if (!match) return { message: 'Match Not Found', status: false, data: {} };
            const matchTime = await matchServices.getMatchTime(match.start_date);
            if (matchTime === false) return { message: 'Match has been closed.', status: false, data: {} };
            let newData = switchteam
            for (let key of newData) {
                // let joinTeam = await userTeamModel.findOne({ _id: key.newjointeamid });

                let teamkey = `match:${matchkey}:user:${req.user._id}:teams`;

                let joinTeams = await getkeydata(teamkey);
                let joinTeam = joinTeams.find(team => team._id.toString() === key.newjointeamid.toString());
                if (!joinTeam) joinTeam = await userTeamModel.findOne({ _id: key.newjointeamid });

                // await userLeagueModel.findOneAndUpdate({ _id: key.joinleaugeid }, { teamid: key.newjointeamid, teamnumber: joinTeam.teamnumber }, { new: true });
                // let userLeaderBoard = await userLeaderBoardModel.findOneAndUpdate({ joinId: key.joinleaugeid }, { teamnumber: joinTeam.teamnumber, teamId: key.newjointeamid }, { new: true });

                const leaderBoardKey = `liveRanksLeaderboard_${challengeId}_data`;
                let userLeaderBoard = await hgetData(leaderBoardKey, leaderBoardId.toString());
                if (!userLeaderBoard) userLeaderBoard = await userLeaderBoardModel.findOne({ joinId: key.joinleaugeid });

                let redisLeaderboard = {
                    "_id": `${userLeaderBoard._id.toString()}`,
                    "getcurrentrank": userLeaderBoard.joinNumber,
                    "usernumber": 0,
                    "joinleaugeid": key.joinleaugeid, //userLeaderBoard.joinId,
                    "joinTeamNumber": joinTeam.teamnumber,
                    "jointeamid": joinTeam._id,
                    "userid": req.user._id,
                    "team": userLeaderBoard.user_team,
                    "image": `${process.env.IMAGE_URL}avtar1.png`,
                    "teamnumber": joinTeam.teamnumber
                }
                // let keyChallengeLeaderBoard = `match:${matchkey}:challenge:${userLeaderBoard.challengeid}:challengeLeaderBoard`;
                var expRedisTime = await matchTimeDifference(matchkey);
                // await storeSortedSet(keyChallengeLeaderBoard, redisLeaderboard, expRedisTime);
                redisLeaderboard._id = `${userLeaderBoard._id.toString()}-${req.user._id}`;
                let keyLeaderBoard = `match:${matchkey}:challenge:${userLeaderBoard.challengeid}:user:${req.user._id}:userLeaderBoard`;
                await storeSortedSet(keyLeaderBoard, redisLeaderboard, expRedisTime);
                const redisleaderBoardData = {
                    _id: `${userLeaderBoard._id.toString()}`,
                    points: 0,
                    getcurrentrank: 1,
                    matchkey: matchkey,
                    challengeid: userLeaderBoard.challengeid,
                    lastUpdate: false,
                    teamnumber: Number(joinTeam.teamnumber),
                    userno: "0",
                    userjoinid: userLeaderBoard.joinId,
                    userid: req.user._id,
                    jointeamid: joinTeam._id,
                    teamname: userLeaderBoard.user_team,
                    joinNumber: userLeaderBoard.joinNumber,
                    image: `${global.constant.IMAGE_URL}avtar1.png`,
                    player_type: "classic",
                    winingamount: "",
                    contest_winning_type: "price",
                };

                const keyChallengeLeaderBoardNew = `liveRanksLeaderboard_${userLeaderBoard.challengeid}`;
                await storeSortedSet(keyChallengeLeaderBoardNew, redisleaderBoardData, expRedisTime);



                const fieldsToUpdate = {
                    teamid: key.newjointeamid,
                    teamnumber: joinTeam.teamnumber
                }

                const fieldsToUpdateLeaderBoard = {
                    teamnumber: joinTeam.teamnumber,
                    teamId: key.newjointeamid
                }


                await Promise.all([
                    sendToQueue('updateQueue', {
                        filter: { _id: key.joinleaugeid },
                        payload: fieldsToUpdate,
                        modelName: 'userleague'
                    }),
                    sendToQueue('updateQueue', {
                        filter: { joinId: key.joinleaugeid },
                        payload: fieldsToUpdateLeaderBoard,
                        modelName: 'userleaderboard'
                    })
                ]);
            }
            return { message: 'Team Updated ', status: true, data: {} }
        } catch (error) {
            console.log(error);
            throw error;
        }
    }
}
module.exports = new contestServices();