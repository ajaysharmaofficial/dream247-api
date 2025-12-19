const mongoose = require("mongoose");
require("../../../models/contestModel");
require("../../../models/teamPlayerModel");
require("../../../models/teamModel");
const moment = require("moment");

const matchchallengesModel = require("../../../models/matchContestModel");
const matchesModel = require("../../../models/matchesModel");
const matchPlayersModel = require("../../../models/matchPlayersModel");
const userLeagueModel = require("../../../models/userLeagueModel");
const userTeamModel = require("../../../models/userTeamModel");
const configModel = require("../../../models/configModel");
const redisjoinTeams = require("../../../utils/redis/redisjoinTeams");
// const redisLiveJoinTeams = require("../../../utils/redis/redisLiveJoinTeams");
const redisLeaderboard = require("../../../utils/redis/redisLeaderboard");
// const redisLiveLeaderboard = require("../../../utils/redis/redisLiveLeaderboard");
const redisContest = require("../../../utils/redis/redisContest");
// const redisLiveContest = require("../../../utils/redis/redisLiveContest");
const redisMain = require("../../../utils/redis/redisMain");
const redisBotUser = require("../../../utils/redis/redisBotUser");
const redisUser = require("../../../utils/redis/redisUser");
// const { getMatchPlayrs } = require("../../../utils/s3");
const { sendToQueue } = require("../../../utils/kafka");
const { matchTimeDifference, matchRemTime } = require("../../../utils/matchTimeDiffrence");

class matchServices {
  constructor() {
    return {
      dbCheck: this.dbCheck.bind(this),
      createUserTeam: this.createUserTeam.bind(this),
      createUserTeamTest: this.createUserTeamTest.bind(this),
      generateUniqueObjectId: this.generateUniqueObjectId(this),
      fetchUserTeams: this.fetchUserTeams.bind(this),
      getUserTeamData: this.getUserTeamData.bind(this),
      getJoinleague: this.getJoinleague.bind(this),
      checkForDuplicateTeam: this.checkForDuplicateTeam.bind(this),
      getMatchTime: this.getMatchTime.bind(this),
      fetchUserTeamsNew: this.fetchUserTeamsNew.bind(this),
      setRedisTeam: this.setRedisTeam.bind(this),
      syncTeamRedisToDb: this.syncTeamRedisToDb.bind(this),
      fetchLiveUserTeams: this.fetchLiveUserTeams.bind(this),
      getUserLiveTeamData: this.getUserLiveTeamData.bind(this)
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

  async getMatchTime(start_date) {
    const currentdate = new Date();
    const ISTTime = moment().format("YYYY-MM-DD HH:mm:ss");
    if (ISTTime >= start_date) {
      return false;
    } else {
      return true;
    }
  };


  // async createUserTeam(req) {
  //   try {
  //     const {
  //       matchkey,
  //       teamnumber,
  //       players,
  //       captain,
  //       vicecaptain,
  //       guruTeamId,
  //       is_guru,
  //     } = req.body;

  //     if (vicecaptain === captain) {
  //       return {
  //         message: "Captain and Vice Captain can not be same.",
  //         status: false,
  //         data: {},
  //       };
  //     }
  //     const playerArray = players.split(",");
  //     const allIdsAreSame = playerArray.every(id => id === playerArray[0]);

  //     if (allIdsAreSame) {
  //       return {
  //         message: "Selected same players.",
  //         status: false,
  //         data: {},
  //       };
  //     }
  //     let keyname = `listMatchesModel-${matchkey}`
  //     let redisdata = await redisjoinTeams.getkeydata(keyname);
  // var expRedisTime = await matchTimeDifference(matchkey);
  //     let listmatchData;
  //     if (redisdata) {
  //       listmatchData = redisdata;
  //     }
  //     else {
  //       listmatchData = await matchesModel.findOne({ _id: mongoose.Types.ObjectId(matchkey) }).lean();

  //       redisjoinTeams.setkeydata(keyname, listmatchData || {},expRedisTime);
  //     }

  //     const keyName = `playerList-matchkey-${listmatchData.real_matchkey}`;
  //     let matchPlayersData = await redisjoinTeams.getkeydata(keyName);
  //     if (!matchPlayersData || matchPlayersData.length <= 0 || matchPlayersData == null) {
  //       let filePath = `matchPlayer/playserList-${matchkey}.json`;
  //       matchPlayersData = await getMatchPlayrs(`${filePath}`);
  //       if (!matchPlayersData || matchPlayersData?.length == 0) matchPlayersData = await matchPlayersModel.find({ matchkey: matchkey }).lean();
  //       await redisjoinTeams.setkeydata(keyName, matchPlayersData, expRedisTime);
  //     }

  //     let credit = 0;
  //     let captainData = {}, viceCaptainData = {};
  //     let playersData = [];
  //     if (matchPlayersData.length > 0) {
  //       const playerSet = new Set(playerArray);

  //       for (let playerData of matchPlayersData) {
  //         if (!playerData || !playerData.playerid) continue;
  //         const playerIdStr = playerData.playerid.toString();
  //         if (playerSet.has(playerIdStr)) {
  //           credit += playerData.credit;
  //           const playerDetails = {
  //             playerId: playerData.playerid,
  //             matchPlayerId: playerData.p_id,
  //             playerName: playerData.name,
  //             playerKey: playerData.players_key,
  //             team: playerData.teamid,
  //             credit: playerData.credit,
  //             role: playerData.role,
  //             image: playerData.image,
  //           };
  //           playersData.push(playerDetails);
  //           if (playerIdStr === captain) captainData = playerDetails;
  //           if (playerIdStr === vicecaptain) viceCaptainData = playerDetails;
  //         }
  //       }
  //     }

  //     if (credit > 100) {
  //       return {
  //         message: "Credit exceeded.",
  //         status: false,
  //         data: {},
  //       };
  //     }


  //     const joinlist = await userTeamModel.find({
  //       matchkey: matchkey,
  //       userid: req.user._id,
  //     }).sort({ teamnumber: -1 }).select('players captain vicecaptain teamnumber');

  //     const duplicateData = await this.checkForDuplicateTeam(joinlist, captain, vicecaptain, playerArray, teamnumber);

  //     if (duplicateData == false) {
  //       return {
  //         message: "You cannot create the same team.",
  //         status: false,
  //         data: {},
  //       };
  //     }
  //     const matchTime = await this.getMatchTime(listmatchData.start_date);
  //     if (matchTime === false) {
  //       return {
  //         message: "Match has been closed, You cannot create or edit team now",
  //         status: false,
  //         data: {},
  //       };
  //     }
  //     const data = {
  //       userid: req.user._id,
  //       user_team: req.user.user_team,
  //       matchkey: matchkey,
  //       teamnumber: teamnumber,
  //       players: playerArray,
  //       player_type: "classic",
  //       captain: captain,
  //       vicecaptain: vicecaptain,
  //       matchData: {
  //         matchkey: listmatchData._id,
  //         name: listmatchData.name,
  //         shortName: listmatchData.short_name,
  //         type: listmatchData.fantasy_type,
  //         realMatchkey: listmatchData.real_matchkey,
  //         startDate: listmatchData.start_date
  //       },
  //       captainData,
  //       viceCaptainData,
  //       playersData
  //     };
  //     if (req.body.guruTeamId) {
  //       data["guruTeamId"] = guruTeamId;
  //       data["is_guru"] = is_guru;


  //       const msg = {
  //         filter: { _id: guruTeamId },
  //         payload: { $inc: { count_copied: 1 } },
  //         modelName: "jointeam"
  //       };

  //       // sendToQueue('updateQueue', msg);
  //       // await userTeamModel.findByIdAndUpdate(guruTeamId, { $inc: { count_copied: 1 } }, { new: true });
  //     }

  //     const joinTeam = await userTeamModel.findOne({
  //       matchkey: matchkey,
  //       teamnumber: parseInt(teamnumber),
  //       userid: req.user._id,
  //     }).sort({ teamnumber: -1 });

  //     if (joinTeam) {
  //       data["user_type"] = 0;

  //       const msg = {
  //         filter: { _id: joinTeam._id },
  //         payload: data,
  //         modelName: "jointeam"
  //       };

  //       // sendToQueue('updateQueue', msg);

  //       const updatedTeam = await userTeamModel.findOneAndUpdate(
  //         { _id: joinTeam._id },
  //         data,
  //         { new: true }
  //       );

  //       return {
  //         message: "Team Updated Successfully",
  //         status: true,
  //         data: {
  //           teamid: joinTeam._id,
  //         },
  //       };

  //     } else {
  //       const joinTeamCount = await userTeamModel.countDocuments({
  //         matchkey: matchkey,
  //         userid: req.user._id,
  //       });
  //       if (joinTeamCount < 99) {
  //         data["teamnumber"] = joinTeamCount + 1;
  //         data["user_type"] = 0;

  //         // const teamId = mongoose.Types.ObjectId();
  //         // data["_id"] = teamId;
  //         // const msg = {
  //         //   payload: data,
  //         //   modelName: "jointeam"
  //         // }
  //         // sendToQueue('createQueue', msg);

  //         const newJoinTeam = await userTeamModel.create(data);
  //         if (newJoinTeam) {
  //           return {
  //             message: "Team Created Successfully",
  //             status: true,
  //             data: {
  //               teamid: newJoinTeam._id,
  //             },
  //           };
  //         }
  //       } else {
  //         return {
  //           message: "You Cannot Create More Teams",
  //           status: false,
  //           data: {},
  //         };
  //       }
  //     }

  //   } catch (error) {
  //     throw error;
  //   }
  // }


  async generateUniqueObjectId() {
    let teamId;
    let existingTeam;

    do {
      teamId = new mongoose.Types.ObjectId();
      existingTeam = await userTeamModel.findById(teamId);
    } while (existingTeam);

    return teamId;
  }

  async createUserTeam(req) {
    try {
      const {
        matchkey,
        teamnumber,
        players,
        captain,
        vicecaptain,
        guruTeamId,
        is_guru,
        teamType
      } = req.body;

      if (vicecaptain === captain) {
        return {
          message: "Captain and Vice Captain can not be same.",
          status: false,
          data: {},
        };
      }
      const playerArray = players.split(",");
      const allIdsAreSame = playerArray.every(id => id === playerArray[0]);

      if (allIdsAreSame) {
        return {
          message: "Selected same players.",
          status: false,
          data: {},
        };
      }
      let keyname = `listMatchesModel-${matchkey}`
      let redisdata = await redisjoinTeams.getkeydata(keyname);
      let listmatchData;
      if (redisdata) {
        listmatchData = redisdata;
        redisjoinTeams.setkeydata(keyname, listmatchData || {}, 20 * 24 * 60 * 60); // for live join teams
      }
      else {
        listmatchData = await matchesModel.findOne({ _id: mongoose.Types.ObjectId(matchkey) }).lean();
        redisjoinTeams.setkeydata(keyname, listmatchData || {}, 20 * 24 * 60 * 60);
      }
      const keyName = `playerList-matchkey-${listmatchData.real_matchkey}`;
      let matchPlayersData = await redisjoinTeams.getkeydata(keyName);
      if (!matchPlayersData || matchPlayersData.length <= 0 || matchPlayersData == null) {
        let aggpipe = [];
        aggpipe.push({
          $match: { matchkey: new mongoose.Types.ObjectId(listmatchData._id) },
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
              listmatchData?.team2Id?.toString()
            ) {
              team = "team2";
            }
            let matchPlayers = {
              captain_selection_percentage: player.captain_selection_percentage,
              credit: player.credit,
              name: player.name,
              captain: player?.captain || false,
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

      let credit = 0;
      let captainData = {}, viceCaptainData = {};
      let playersData = [];
      if (matchPlayersData.length > 0) {
        const playerSet = new Set(playerArray);

        for (let playerData of matchPlayersData) {
          if (!playerData || !playerData.playerid) continue;
          const playerIdStr = playerData.playerid.toString();
          if (playerSet.has(playerIdStr)) {
            credit += playerData.credit;
            const playerDetails = {
              playerId: playerData.playerid,
              matchPlayerId: playerData.p_id,
              playerName: playerData.name,
              playerKey: playerData.players_key,
              team: playerData.teamid,
              credit: playerData.credit,
              role: playerData.role,
              image: playerData.image,
            };
            playersData.push(playerDetails);
            if (playerIdStr === captain) captainData = playerDetails;
            if (playerIdStr === vicecaptain) viceCaptainData = playerDetails;
          }
        }
      }

      if (credit > 100) {
        return {
          message: "Credit exceeded.",
          status: false,
          data: {},
        };
      }


      // const joinlist = await userTeamModel.find({
      //   matchkey: matchkey,
      //   userid: req.user._id,
      // }).sort({ teamnumber: -1 }).select('players captain vicecaptain teamnumber');

      const redisKey = `match:${matchkey}:user:${req.user._id}:teams`;
      let existingTeams = await redisjoinTeams.getkeydata(redisKey) || [];
      const duplicateData = await this.checkForDuplicateTeam(existingTeams, captain, vicecaptain, playerArray, teamnumber);

      if (duplicateData == false) {
        return {
          message: "You cannot create the same team.",
          status: false,
          data: {},
        };
      }
      const matchTime = await this.getMatchTime(listmatchData.start_date);
      if (matchTime === false) {
        return {
          message: "Match has been closed, You cannot create or edit team now",
          status: false,
          data: {},
        };
      }



      const data = {
        userid: req.user._id,
        user_team: req.user.user_team,
        matchkey: matchkey,
        teamnumber: teamnumber,
        players: playerArray,
        player_type: "classic",
        captain: captain,
        vicecaptain: vicecaptain,
        teamType: teamType,
        matchData: {
          matchkey: listmatchData._id,
          name: listmatchData.name,
          shortName: listmatchData.short_name,
          type: listmatchData.fantasy_type,
          realMatchkey: listmatchData.real_matchkey,
          startDate: listmatchData.start_date
        },
        captainData,
        viceCaptainData,
        playersData
      };
      if (req.body.guruTeamId) {
        data["guruTeamId"] = guruTeamId;
        data["is_guru"] = is_guru;
        data["updateStatus"] = true;


        const msg = {
          filter: { _id: guruTeamId },
          payload: { $inc: { count_copied: 1 } },
          modelName: "userteam"
        };

        sendToQueue('updateQueue', msg);
        // await userTeamModel.findByIdAndUpdate(guruTeamId, { $inc: { count_copied: 1 } }, { new: true });
      }

      // const joinTeam = await userTeamModel.findOne({
      //   matchkey: matchkey,
      //   teamnumber: parseInt(teamnumber),
      //   userid: req.user._id,
      // }).sort({ teamnumber: -1 });

      const joinTeam = existingTeams.find(team => (team.teamnumber == parseInt(teamnumber)));
      // console.log(joinTeam)

      if (joinTeam) {
        data["user_type"] = 0;
        data["updateStatus"] = true;

        const msg = {
          filter: { _id: joinTeam._id },
          payload: data,
          modelName: "userteam"
        };
        sendToQueue('updateTeamQueue', msg);

        const updatedData = { ...data, _id: joinTeam._id };
        existingTeams = existingTeams.map(team => {
          if (!team || !team._id) return team;
          if (!joinTeam || !joinTeam._id) return team;
          return team._id.toString() === joinTeam._id.toString() ? updatedData : team;
        });
        var expRedisTime = await matchTimeDifference(matchkey);
        await redisjoinTeams.setkeydata(redisKey, existingTeams, expRedisTime);
        if (redisdata?.playing11_status == 1) {
          const joinedBotKey = `bot:user:${matchkey}`;
          const botUserIds = await redisBotUser.redis.srandmember(joinedBotKey, 2);
          if (botUserIds.length >= 2) {
            await this.createAITeamWithCustomLogic(matchkey, data, botUserIds[0], "swap");
            await this.createAITeamWithCustomLogic(matchkey, data, botUserIds[1], "random_vice");
          } else if (botUserIds.length == 1) {
            await this.createAITeamWithCustomLogic(matchkey, data, botUserIds[0], "swap");
          }
        }

        // if (remTime > 0 && remTime < 1800) {
        //   redisLiveJoinTeams.setkeydata(redisKey, existingTeams, expRedisTime); // for live join teams
        // }

        // const updatedTeam = await userTeamModel.findOneAndUpdate(
        //   { _id: joinTeam._id },
        //   data,
        //   { new: true }
        // );

        return {
          message: "Team Updated Successfully",
          status: true,
          data: {
            teamid: joinTeam._id,
          },
        };

      } else {
        // const joinTeamCount = await userTeamModel.countDocuments({
        //   matchkey: matchkey,
        //   userid: req.user._id,
        // });
        // let redisKey = `match:${matchkey}:user:${req.user._id}:teams`;
        // let existingTeams = await redisjoinTeams.getkeydata(redisKey) || [];

        const joinTeamCount = existingTeams.length;
        let compareTeamCount = 30;
        if (process.env.secretManager === 'dev') {
          compareTeamCount = 500;
        }
        if (joinTeamCount < Number(compareTeamCount)) {
          data["teamnumber"] = joinTeamCount + 1;
          data["user_type"] = 0;

          const teamId = await this.generateUniqueObjectId();
          data["_id"] = teamId;
          const msg = {
            payload: data,
            modelName: "userteam"
          }

          sendToQueue('createTeamQueue', msg);

          const redisKey = `match:${matchkey}:user:${req.user._id}:teams`;
          let existingTeams = await redisjoinTeams.getkeydata(redisKey) || [];

          existingTeams.push(data);
          var expRedisTime = await matchTimeDifference(matchkey);
          await redisjoinTeams.setkeydata(redisKey, existingTeams, expRedisTime);

          if (redisdata?.playing11_status == 1) {
            const joinedBotKey = `bot:user:${matchkey}`;
            const botUserIds = await redisBotUser.redis.srandmember(joinedBotKey, 2);
            if (botUserIds.length >= 2) {
              await this.createAITeamWithCustomLogic(matchkey, data, botUserIds[0], "swap");
              await this.createAITeamWithCustomLogic(matchkey, data, botUserIds[1], "random_vice");
            } else if (botUserIds.length == 1) {
              await this.createAITeamWithCustomLogic(matchkey, data, botUserIds[0], "swap");
            }
          }

          const remTime = await matchRemTime(matchkey);
          // if (remTime > 0 && remTime < 1800) {
          //   redisLiveJoinTeams.setkeydata(redisKey, existingTeams, expRedisTime); // for live join teams
          // }
          return {
            message: "Team Created Successfully",
            status: true,
            data: {
              teamid: teamId,
            },
          };

          // const newJoinTeam = await userTeamModel.create(data);
          // if (newJoinTeam) {
          //   return {
          //     message: "Team Created Successfully",
          //     status: true,
          //     data: {
          //       teamid: newJoinTeam._id,
          //     },
          //   };
          // }
        } else {
          return {
            message: "You Cannot Create More Teams",
            status: false,
            data: {},
          };
        }
      }

    } catch (error) {
      throw error;
    }
  }



  async createAITeamWithCustomLogic(matchkey, AIjointeam, userId, type = "swap") {
    try {
      const playerArray = AIjointeam.players;
      const redisKey = `match:${matchkey}:user:${userId}:teams`;
      await redisBotUser.redis.srem(`bot:user:${matchkey}`, userId);
      let existingTeams = (await redisjoinTeams.getkeydata(redisKey)) || [];
      const userData = await redisUser.getUser(userId);
      const captain = AIjointeam.captain;
      const vicecaptain = AIjointeam.vicecaptain;

      let finalCaptain = captain;
      let finalViceCaptain = vicecaptain;

      if (type === "swap") {
        finalCaptain = vicecaptain;
        finalViceCaptain = captain;
      } else if (type === "random_vice") {
        const remainingPlayers = playerArray.filter(p => p !== captain);
        finalViceCaptain = remainingPlayers[Math.floor(Math.random() * remainingPlayers.length)];
      }

      const captainData = AIjointeam.playersData.find(p => p.playerId.toString() === finalCaptain);
      const viceCaptainData = AIjointeam.playersData.find(p => p.playerId.toString() === finalViceCaptain);

      const joinTeam = existingTeams.find(team => team.teamnumber == 1);
      const data = {
        userid: userId,
        user_team: userData?.team,
        matchkey: matchkey,
        teamnumber: 1,
        players: playerArray,
        player_type: "classic",
        captain: finalCaptain,
        vicecaptain: finalViceCaptain,
        matchData: AIjointeam.matchData,
        captainData,
        viceCaptainData,
        playersData: AIjointeam.playersData,
      };

      if (joinTeam) {
        data["user_type"] = 1;
        data["updateStatus"] = true;

        const updatedData = { ...data, _id: joinTeam._id };
        existingTeams = existingTeams.map((team) => {
          if (!team || !team._id) return team;
          return team._id.toString() === joinTeam._id.toString() ? updatedData : team;
        });

        const expRedisTime = await matchTimeDifference(matchkey);
        await redisjoinTeams.setkeydata(redisKey, existingTeams, expRedisTime);

        const msg = {
          filter: { _id: joinTeam._id },
          payload: data,
          modelName: "userteam",
        };
        sendToQueue("updateQueue", msg);

        return {
          message: "Team Updated Successfully",
          status: true,
          data: {
            teamid: joinTeam._id,
          },
        };
      } else {
        const joinTeamCount = existingTeams.length;
        let compareTeamCount = 30;
        if (process.env.secretManager === "dev") compareTeamCount = 500;

        if (joinTeamCount < compareTeamCount) {
          data["teamnumber"] = joinTeamCount + 1;
          data["user_type"] = 1;

          const teamId = await generateUniqueObjectId();
          data["_id"] = teamId;

          existingTeams.push(data);
          const expRedisTime = await matchTimeDifference(matchkey);
          await redisjoinTeams.setkeydata(redisKey, existingTeams, expRedisTime);

          const msg = {
            payload: data,
            modelName: "userteam",
          };
          sendToQueue("createQueue", msg);
          return {
            message: "Team Created Successfully",
            status: true,
            data: {
              teamid: teamId,
            },
          };
        } else {
          return {
            message: "Bot Cannot Create More Teams",
            status: false,
            data: {},
          };
        }
      }
    } catch (error) {
      throw error;
    }
  }



  async createUserTeamTest(req) {
    try {
      const {
        matchkey,
        teamnumber,
        players,
        captain,
        vicecaptain,
        guruTeamId,
        is_guru
      } = req.body;

      // Convert player list to an array
      const playerArray = players.split(",");

      // Prepare data to be inserted
      const data = {
        userid: req.user._id,
        user_team: req.user.user_team,
        matchkey: matchkey,
        teamnumber: teamnumber,
        players: playerArray,
        player_type: "classic",
        captain: captain,
        vicecaptain: vicecaptain,
        guruTeamId: guruTeamId || null,
        is_guru: is_guru || false
      };

      const msg = {
        payload: data,
        modelName: "userteam"
      }

      sendToQueue('updateTeamQueue', msg);

      return {
        message: "Team Created Successfully",
        status: true
      };
    } catch (error) {
      console.error("❌ Error inserting team:", error);
      return {
        message: "Error creating team",
        status: false,
        error: error.message
      };
    }
  }

  async setRedisTeam(req) {
    try {
      const { matchkey, limit, skip } = req.query;

      if (!matchkey) {
        return { message: "Matchkey is required", status: false };
      }

      console.log(`Updating Redis with latest team data for matchkey: ${matchkey} from DB...`);

      let matchkeyQuery;
      if (mongoose.Types.ObjectId.isValid(matchkey)) {
        matchkeyQuery = new mongoose.Types.ObjectId(matchkey);
      } else {
        matchkeyQuery = matchkey;
      }

      const allTeams = await userTeamModel.find({ matchkey: matchkeyQuery }).skip(Number(skip)).limit(Number(limit)).lean();

      if (!allTeams || allTeams.length === 0) {
        console.log(`No team data found in DB for matchkey: ${matchkey}`);
        return { message: "No teams found for the given matchkey", status: false };
      }

      const redisData = {};

      for (const team of allTeams) {
        const redisKey = `match:${team.matchkey}:user:${team.userid}:teams`;

        if (!redisData[redisKey]) {
          redisData[redisKey] = [];
        }
        redisData[redisKey].push(team);
      }

      var expRedisTime = await matchTimeDifference(matchkey);
      const redisPromises = Object.entries(redisData).map(async ([key, teams]) => {
        redisjoinTeams.setkeydata(key, teams, expRedisTime);

        const remTime = await matchRemTime(matchkey);
        // if (remTime > 0 && remTime < 1800) {
        //   redisLiveJoinTeams.setkeydata(key, teams, expRedisTime); // for live join teams
        // }

      });


      await Promise.all(redisPromises);
      console.log(`✅ Redis updated successfully for matchkey: ${matchkey} with ${allTeams.length} teams.`);
      return { message: "Redis updated successfully", status: true, totalTeams: allTeams.length };

    } catch (error) {
      console.error("❌ Error updating Redis with team data:", error);
      return { message: "Error updating Redis", status: false, error };
    }
  }

  async syncTeamRedisToDb(req) {
    try {
      const { matchkey } = req.query;
      if (!matchkey) {
        console.log("❌ Matchkey is required.");
        return { message: "Matchkey is required", status: false };
      }

      console.log(`⏳ Fetching team data from Redis for matchkey: ${matchkey} to update MongoDB...`);
      const redisPattern = `match:${matchkey}:user:*:teams`;

      // ✅ Step 1: Fetch Redis keys in batches (SCAN)
      const redisKeys = await redisjoinTeams.getAllKeys(redisPattern);
      if (!redisKeys || redisKeys.length === 0) {
        console.log(`✅ No team data found in Redis for matchkey: ${matchkey}`);
        return { message: "No team data found in Redis", status: false };
      }

      console.log(`✅ Found ${redisKeys.length} keys. Fetching data in batches...`);

      let allTeams = [];
      const batchSize = 1000; // Process Redis in chunks of 1000 keys
      for (let i = 0; i < redisKeys.length; i += batchSize) {
        const batchKeys = redisKeys.slice(i, i + batchSize);

        // ❌ Replace MGET with individual GETs (works with Redis Cluster)
        const batchData = await Promise.all(
          batchKeys.map((key) => redisjoinTeams.redis.get(key))
        );

        const teams = batchData.flat().filter(team => team);
        allTeams.push(...teams);

        console.log(`✅ Processed batch ${i / batchSize + 1}/${Math.ceil(redisKeys.length / batchSize)} | Total teams fetched: ${allTeams.length}`);
      }

      if (allTeams.length === 0) {
        console.log(`✅ No valid team data found in Redis for matchkey: ${matchkey}`);
        return { message: "No valid team data found", status: false };
      }

      console.log(`✅ Found ${allTeams.length} teams in Redis for matchkey: ${matchkey}. Updating MongoDB...`);

      // ✅ Step 2: Bulk insert/update in MongoDB in chunks
      const mongoBatchSize = 5000; // Process MongoDB in chunks of 5000
      let totalUpdated = 0, totalInserted = 0;

      for (let i = 0; i < allTeams.length; i += mongoBatchSize) {
        const batchTeams = allTeams.slice(i, i + mongoBatchSize);

        const bulkOperations = batchTeams.map(team => ({
          updateOne: {
            filter: { _id: team._id }, // Match existing document in DB
            update: { $set: { ...team, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
            upsert: true // Insert if not found, otherwise update
          }
        }));

        const result = await userTeamModel.bulkWrite(bulkOperations);
        totalUpdated += result.modifiedCount;
        totalInserted += result.upsertedCount;

        console.log(`✅ MongoDB Batch ${i / mongoBatchSize + 1}/${Math.ceil(allTeams.length / mongoBatchSize)} | Updated: ${result.modifiedCount}, Inserted: ${result.upsertedCount}`);
      }

      // ✅ Step 3: Bulk delete Redis keys (if needed)
      // const deleteBatchSize = 5000;
      // for (let i = 0; i < redisKeys.length; i += deleteBatchSize) {
      //   const batchKeys = redisKeys.slice(i, i + deleteBatchSize);
      //   await redisjoinTeams.redis.del(batchKeys);
      //   console.log(`✅ Deleted batch ${i / deleteBatchSize + 1}/${Math.ceil(redisKeys.length / deleteBatchSize)} keys from Redis`);
      // }

      return {
        message: "Teams successfully synced from Redis to MongoDB",
        status: true,
        updatedTeams: totalUpdated,
        insertedTeams: totalInserted
      };

    } catch (error) {
      console.error("❌ Error syncing teams from Redis to MongoDB:", error);
      return { message: "Error syncing data", status: false, error };
    }
  }



  async findArrayIntersection(playerSet, previousPlayers) {
    const intersection = previousPlayers.filter(player => playerSet.has(player.toString()));
    return intersection;
  }

  async checkForDuplicateTeam(joinlist, captain, vicecaptain, playerArray, teamnumber) {
    if (joinlist.length === 0) return true;

    const playerSet = new Set(playerArray);
    const results = await Promise.all(joinlist.map(async (list) => {
      if (captain === list.captain.toString() && vicecaptain === list.vicecaptain.toString() && teamnumber !== list.teamnumber) {
        const playerscount = await this.findArrayIntersection(playerSet, list.players);
        return playerscount.length === playerArray.length;
      }
      return false;
    }));
    return !results.includes(true);
  }

  async getJoinleague(userId, matchkey) {
    const total_joinedcontestData = await userLeagueModel.aggregate([
      {
        $match: {
          // userid: mongoose.Types.ObjectId(userId),
          matchkey: mongoose.Types.ObjectId(matchkey),
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

  async setPlayersInRedis(matchkey, team2Id, real_matchkey) {
    let aggpipe = [];
    aggpipe.push({ $match: { matchkey: mongoose.Types.ObjectId(matchkey) } });
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
    let playersData = await matchPlayersModel.aggregate(aggpipe);
    if (playersData.length >= 0) {
      let play = [];
      for (let player of playersData) {

        let team = 'team1'
        // console.log(player.playerdata[0].teamid.toString(), team1Id.toString());
        if (player.playerdata[0].teamid.toString() === team2Id.toString()) {
          team = 'team2'
        }
        // console.log(player.playerdata[0].teamid.toString() === team2Id._id.toString());
        // console.log(player.playerdata[0].teamid.toString(), team2Id._id.toString());
        let matchPlayers = {
          "captain_selection_percentage": player.captain_selection_percentage,
          "credit": player.credit,
          "name": player.name,
          "playingstatus": player.playingstatus,
          "points": player.points,
          "role": player.role,
          "totalSelected": player.totalSelected,
          "vice_captain_selection_percentage": Number(player.vice_captain_selection_percentage),
          "vplaying": player.vplaying,
          "captainSelected": Number(player.captainSelected),
          "vicecaptainSelected": Number(player.vicecaptainSelected),
          "playerid": player.playerid,
          "p_id": player._id,
          "lastMatchPlayed": player.lastMatchPlayed,
          "players_key": Number(player.playerdata[0].players_key),
          "image": player?.image || `${global.constant.IMAGE_URL}avtar1.png`,
          "teamName": player.playerdata[0].teamName,
          "teamid": player.playerdata[0].teamid,
          "teamcolor": player.playerdata[0].teamColor,
          "team_logo": player.playerdata[0]?.logo || `${global.constant.IMAGE_URL}avtar1.png`,
          "team_short_name": player.playerdata[0].short_name,
          "totalpoints": `${player.fantasy_total_points}`,
          "team": team,
          "player_selection_percentage": 0,
          "isSelectedPlayer": false
        }
        play.push(matchPlayers);
      }

      const keyName = `playerList-matchkey-${real_matchkey}`;
      var expRedisTime = await matchTimeDifference(matchkey);
      await redisjoinTeams.setkeydata(keyName, play, expRedisTime);
      return play;
    }
    return false
  }

  async setPlayersInRedisLive(matchkey, team2Id, real_matchkey) {
    let aggpipe = [];
    aggpipe.push({ $match: { matchkey: mongoose.Types.ObjectId(matchkey) } });
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
    let playersData = await matchPlayersModel.aggregate(aggpipe);
    if (playersData.length >= 0) {
      let play = [];
      for (let player of playersData) {

        let team = 'team1'
        // console.log(player.playerdata[0].teamid.toString(), team1Id.toString());
        if (player.playerdata[0].teamid.toString() === team2Id.toString()) {
          team = 'team2'
        }
        // console.log(player.playerdata[0].teamid.toString() === team2Id._id.toString());
        // console.log(player.playerdata[0].teamid.toString(), team2Id._id.toString());
        let matchPlayers = {
          "captain_selection_percentage": player.captain_selection_percentage,
          "credit": player.credit,
          "name": player.name,
          "playingstatus": player.playingstatus,
          "points": player.points,
          "role": player.role,
          "totalSelected": player.totalSelected,
          "vice_captain_selection_percentage": Number(player.vice_captain_selection_percentage),
          "vplaying": player.vplaying,
          "captainSelected": Number(player.captainSelected),
          "vicecaptainSelected": Number(player.vicecaptainSelected),
          "playerid": player.playerid,
          "p_id": player._id,
          "lastMatchPlayed": player.lastMatchPlayed,
          "players_key": Number(player.playerdata[0].players_key),
          "image": player?.image || `${global.constant.IMAGE_URL}avtar1.png`,
          "teamName": player.playerdata[0].teamName,
          "teamid": player.playerdata[0].teamid,
          "teamcolor": player.playerdata[0].teamColor,
          "team_logo": player.playerdata[0]?.logo || `${global.constant.IMAGE_URL}avtar1.png`,
          "team_short_name": player.playerdata[0].short_name,
          "totalpoints": `${player.fantasy_total_points}`,
          "team": team,
          "player_selection_percentage": 0,
          "isSelectedPlayer": false
        }
        play.push(matchPlayers);
      }

      const keyName = `playerList-matchkey-${real_matchkey}`;
      var expRedisTime = await matchTimeDifference(matchkey);
      await redisjoinTeams.setkeydata(keyName, play, expRedisTime);
      return play;
    }
    return false
  }


  // async fetchUserTeams(req) {
  //   try {
  //     let finalData = [];

  //     const { team1Id, team2Id } = await matchesModel
  //       .findOne({ _id: req.query.matchkey })
  //       .populate([
  //         { path: "team1Id", select: "short_name", options: { lean: true } },
  //         { path: "team2Id", select: "short_name", options: { lean: true } },
  //       ])
  //       .lean();

  //     if (!team1Id) {
  //       return {
  //         status: false,
  //         message: "listmatch not Found",
  //       };
  //     }
  //     let aggPipe = [];
  //     aggPipe.push({
  //       $match: {
  //         userid: mongoose.Types.ObjectId(req.user._id),
  //         matchkey: mongoose.Types.ObjectId(req.query.matchkey),
  //       },
  //     });

  //     aggPipe.push({
  //       $lookup: {
  //         from: "players",
  //         localField: "captain",
  //         foreignField: "_id",
  //         as: "captain",
  //       },
  //     });
  //     aggPipe.push({
  //       $lookup: {
  //         from: "players",
  //         localField: "vicecaptain",
  //         foreignField: "_id",
  //         as: "vicecaptain",
  //       },
  //     });

  //     aggPipe.push({
  //       $unwind: {
  //         path: "$vicecaptain",
  //       },
  //     });
  //     aggPipe.push({
  //       $unwind: {
  //         path: "$captain",
  //       },
  //     });
  //     aggPipe.push(
  //       {
  //         $lookup: {
  //           from: "matchplayers",
  //           let: {
  //             pid: "$players",
  //             matchkey: "$matchkey",
  //             captain_id: "$captain._id",
  //             vicecaptain_id: "$vicecaptain._id",
  //           },
  //           pipeline: [
  //             {
  //               $match: {
  //                 $expr: {
  //                   $and: [
  //                     {
  //                       $eq: ["$$matchkey", "$matchkey"],
  //                     },
  //                     {
  //                       $in: ["$playerid", "$$pid"],
  //                     },
  //                   ],
  //                 },
  //               },
  //             },
  //             {
  //               $lookup: {
  //                 from: "players",
  //                 localField: "playerid",
  //                 foreignField: "_id",
  //                 as: "getplayerdata",
  //               },
  //             },
  //             {
  //               $unwind: {
  //                 path: "$getplayerdata",
  //               },
  //             },
  //             {
  //               $project: {
  //                 _id: 0,
  //                 id: "$getplayerdata._id",
  //                 playerimg: "$getplayerdata.image",
  //                 team: "$getplayerdata.team",
  //                 name: "$getplayerdata.player_name",
  //                 role: "$role",
  //                 credit: "$credit",
  //                 playingstatus: "$playingstatus",
  //                 image1: "",
  //                 points: { $toString: "$points" },
  //                 captain: "0",
  //                 vicecaptain: "0",
  //               },
  //             },
  //           ],
  //           as: "players",
  //         },
  //       },
  //       {
  //         $unwind: {
  //           path: "$players",
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "listmatches",
  //           localField: "players.team",
  //           foreignField: "team1Id",
  //           pipeline: [
  //             {
  //               $match: {
  //                 _id: mongoose.Types.ObjectId(req.query.matchkey),
  //               },
  //             },
  //           ],
  //           as: "matchedTeams1",
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "listmatches",
  //           localField: "players.team",
  //           foreignField: "team2Id",
  //           pipeline: [
  //             {
  //               $match: {
  //                 _id: mongoose.Types.ObjectId(req.query.matchkey),
  //               },
  //             },
  //           ],
  //           as: "matchedTeams2",
  //         },
  //       },
  //       {
  //         $addFields: {
  //           "players.team": {
  //             $cond: {
  //               if: {
  //                 $in: ["$players.team", "$matchedTeams1.team1Id"],
  //               },
  //               then: {
  //                 team: "team1",
  //               },
  //               else: {
  //                 $cond: {
  //                   if: {
  //                     $in: ["$players.team", "$matchedTeams2.team2Id"],
  //                   },
  //                   then: {
  //                     team: "team2",
  //                   },
  //                   else: "$players.team",
  //                 },
  //               },
  //             },
  //           },
  //         },
  //       },
  //       {
  //         $addFields: {
  //           "players.team": "$players.team.team",
  //           "players.teamid": "$players.team",
  //           "players.vicecaptain": {
  //             $cond: {
  //               if: {
  //                 $eq: ["$players.id", "$vicecaptain._id"],
  //               },
  //               then: 1,
  //               else: 0,
  //             },
  //           },
  //           "players.captain": {
  //             $cond: {
  //               if: {
  //                 $eq: ["$players.id", "$captain._id"],
  //               },
  //               then: 1,
  //               else: 0,
  //             },
  //           },
  //         },
  //       },
  //       {
  //         $group: {
  //           _id: "$_id",
  //           data: {
  //             $first: "$$ROOT",
  //           },
  //           player: {
  //             $push: "$players",
  //           },
  //         },
  //       },
  //       {
  //         $addFields: {
  //           "data.players": "$player",
  //         },
  //       },
  //       {
  //         $replaceRoot: {
  //           newRoot: "$data",
  //         },
  //       }
  //     );
  //     // console.log(JSON.stringify(aggPipe), ">>>>>>>>>>>>>>>");
  //     const createTeams = await userTeamModel.aggregate(aggPipe);
  //     // console.log(createTeams.length, ">>>>>>>>>>>>>>>");
  //     //   console.log("createTeams", createTeams);
  //     if (createTeams.length == 0) {
  //       return {
  //         message: "Teams Not Available",
  //         status: false,
  //         data: [],
  //       };
  //     }
  //     let [matchchallenges, total_teams, count_JoinContest] = await Promise.all(
  //       [
  //         matchchallengesModel.find({
  //           matchkey: mongoose.Types.ObjectId(req.query.matchkey),
  //           status: "opened",
  //         }),
  //         userTeamModel.countDocuments({
  //           userid: req.user._id,
  //           matchkey: req.query.matchkey,
  //         }),
  //         this.getJoinleague(req.user._id, req.query.matchkey),
  //       ]
  //     );
  //     // ---------------------//
  //     // console.log('createTeams', JSON.stringify(createTeams));
  //     let i = 0;
  //     for (let element of createTeams) {
  //       i++;
  //       let team1count = 0,
  //         team2count = 0,
  //         batsCount = 0,
  //         blowCount = 0,
  //         wicketKeeperCount = 0,
  //         allCount = 0;
  //       // const players = [];
  //       let totalPoints = 0;
  //       for (let p of element.players) {
  //         let im;
  //         //   console.log("ppp", p);
  //         if (p.id && p.playerimg != "" && p.playerimg != null && p.playerimg != undefined) {
  //           if (p.playerimg.startsWith("/p") || element.captain.image.startsWith("p")) {
  //             im = `${global.constant.IMAGE_URL}${p.playerimg}`;
  //           } else {
  //             im = p.playerimg;
  //           }
  //         } else {
  //           if (team1Id._id.toString() == p.team.toString()) {
  //             im = `${global.constant.IMAGE_URL}white_team1.png`;
  //           } else {
  //             im = `${global.constant.IMAGE_URL}black_team1.png`;
  //           }
  //         }
  //         p.points = Number(p.points);
  //         let playerPoints = Number(p.points)
  //         p.playerimg = im;
  //         if (p.id.toString() === element.captain._id.toString()) {
  //           playerPoints *= 2;
  //         }
  //         if (p.id.toString() === element.vicecaptain._id.toString()) {
  //           playerPoints *= 1.5;
  //         }


  //         totalPoints += playerPoints;
  //         wicketKeeperCount += p.role === 'keeper' ? 1 : 0;
  //         allCount += p.role === 'allrounder' ? 1 : 0;
  //         batsCount += p.role === 'batsman' ? 1 : 0;
  //         blowCount += p.role === 'bowler' ? 1 : 0;
  //         team1count += p.team == 'team1' ? 1 : 0;
  //         team2count += p.team == 'team2' ? 1 : 0;
  //       }
  //       let Capimage, viceCapimage;
  //       // ----Inserting Captian image ---------
  //       if (
  //         element.captain._id &&
  //         element.captain.image != "" &&
  //         element.captain.image != null &&
  //         element.captain.image != undefined
  //       ) {
  //         if (
  //           element.captain.image.startsWith("/p") ||
  //           element.captain.image.startsWith("p")
  //         ) {
  //           Capimage = `${global.constant.IMAGE_URL}${element.captain.image}`;
  //         } else {
  //           Capimage = element.captain.image;
  //         }
  //       } else {
  //         // Capimage = `${global.constant.IMAGE_URL}avtar1.png`;
  //         if (team1Id._id.toString() == element.captain.team.toString()) {
  //           Capimage = `${global.constant.IMAGE_URL}white_team1.png`;
  //         } else {
  //           Capimage = `${global.constant.IMAGE_URL}black_team1.png`;
  //         }
  //       }

  //       // ----Inserting Vice-Captian image ---------
  //       if (
  //         element.vicecaptain._id &&
  //         element.vicecaptain.image != "" &&
  //         element.vicecaptain.image != null &&
  //         element.vicecaptain.image != undefined
  //       ) {
  //         if (
  //           element.vicecaptain.image.startsWith("/p") ||
  //           element.vicecaptain.image.startsWith("p")
  //         ) {
  //           viceCapimage = `${global.constant.IMAGE_URL}${element.vicecaptain.image}`;
  //         } else {
  //           viceCapimage = element.vicecaptain.image;
  //         }
  //       } else {
  //         // viceCapimage = `${global.constant.IMAGE_URL}avtar1.png`;

  //         if (team1Id._id.toString() == element.vicecaptain.team.toString()) {
  //           viceCapimage = `${global.constant.IMAGE_URL}white_team1.png`;
  //         } else {
  //           viceCapimage = `${global.constant.IMAGE_URL}black_team1.png`;
  //         }
  //       }

  //       const tempObj = {
  //         status: 1,
  //         userid: req.user._id,
  //         teamnumber: element.teamnumber,
  //         jointeamid: element._id,
  //         team1_name: team1Id.short_name,
  //         team2_name: team2Id.short_name,
  //         player_type: global.constant.PLAYER_TYPE.CLASSIC,
  //         captain: element.captain._id
  //           ? element.captain.player_name
  //           : "",
  //         vicecaptain: element.vicecaptain._id
  //           ? element.vicecaptain.player_name
  //           : "",
  //         captainimage: Capimage,
  //         vicecaptainimage: viceCapimage,
  //         captainimage1: "",
  //         vicecaptainimage1: "",
  //         isSelected: false,
  //       };

  //       if (matchchallenges.length != 0 && req.query.matchchallengeid) {
  //         for await (const challenges of matchchallenges) {
  //           if (
  //             challenges._id.toString() == req.query.matchchallengeid.toString()
  //           ) {
  //             const joindata = await userLeagueModel.findOne({
  //               challengeid: req.query.matchchallengeid,
  //               teamid: element._id,
  //               userid: req.user._id,
  //             });
  //             if (joindata) tempObj["isSelected"] = true;
  //           }
  //         }
  //       }
  //       let captainTeam = element.captain.team.toString() == team1Id._id.toString() ? 'team1' : 'team2';
  //       let viceCaptainTeam = element.vicecaptain.team.toString() == team1Id._id.toString() ? 'team1' : 'team2';

  //       (tempObj["captin_name"] = element.captain._id
  //         ? element.captain.player_name
  //         : ""),
  //         (tempObj["viceCaptain_name"] = element.vicecaptain._id
  //           ? element.vicecaptain.player_name
  //           : ""),
  //         (tempObj["team1count"] = team1count);
  //       tempObj["captain_id"] = element.captain._id;
  //       tempObj["vicecaptain_id"] = element.vicecaptain._id;
  //       tempObj["team2count"] = team2count;
  //       tempObj["batsmancount"] = batsCount;
  //       tempObj["bowlercount"] = blowCount;
  //       tempObj["wicketKeeperCount"] = wicketKeeperCount;
  //       tempObj["allroundercount"] = allCount;
  //       tempObj["total_teams"] = total_teams;
  //       tempObj["total_joinedcontest"] = count_JoinContest;
  //       tempObj["totalpoints"] = totalPoints;
  //       tempObj["team1Id"] = team1Id._id;
  //       tempObj["team2Id"] = team2Id._id;
  //       tempObj["captainTeam"] = captainTeam;
  //       tempObj["viceCaptainTeam"] = viceCaptainTeam;
  //       // tempObj["player"] = element.players;
  //       finalData.push(tempObj);

  //       if (i == createTeams.length) {
  //         finalData.sort((a, b) => {
  //           return a.teamnumber - b.teamnumber;
  //         });
  //         return {
  //           message: "Team Data",
  //           status: true,
  //           data: finalData,
  //           // sport_category,
  //         };
  //       }
  //     }
  //   } catch (error) {
  //     console.log(error);
  //     throw error;
  //   }
  // }

  async fetchUserTeamsNew(req) {
    try {
      const { matchkey, matchchallengeid } = req.query;
      const userId = mongoose.Types.ObjectId(req.user._id);
      let keyname = `listMatchesModel-${matchkey}`
      let match = await redisjoinTeams.getkeydata(keyname);
      if (!match) {
        match = await matchesModel.findOne({ _id: matchkey }).lean();
        await redisjoinTeams.setkeydata(keyname, match, 20 * 24 * 60 * 60);

        const remTime = await matchRemTime(matchkey);
        // if (remTime > 0 && remTime < 1800) {
        //   redisLiveJoinTeams.setkeydata(keyname, match, 20 * 24 * 60 * 60); // for live join teams
        // }

      }

      if (!match) {
        return { status: false, message: "Match not found" };
      }
      const { team1Id, team2Id, real_matchkey } = match;
      const redisKey = `match:${matchkey}:user:${req.user._id}:teams`;
      let teams = await redisjoinTeams.getkeydata(redisKey) || [];
      if (!teams || !teams.length || teams.length === 0) {
        teams = await this.setTeamsInRedis(req.user._id, matchkey);
      }
      if (!teams.length) {
        return { message: "Teams not available", status: false, data: [] };
      }
      let matchChallenges = [];
      if (matchchallengeid) {
        matchChallenges = await matchchallengesModel.find({
          matchkey: mongoose.Types.ObjectId(matchkey),
          status: "opened",
        });
      }
      // const joinedContestCount = await this.getJoinleague(req.user._id, matchkey);
      const keyName = `playerList-matchkey-${real_matchkey}`;
      let playersData = await redisjoinTeams.getkeydata(keyName);
      // if (!playersData || playersData?.length === 0) {
      playersData = await this.setPlayersInRedis(matchkey, team2Id, real_matchkey);
      // }
      const playersMap = playersData.reduce((acc, player) => {
        acc[player.playerid] = player;
        return acc;
      }, {});
      const finalData = await Promise.all(
        teams.map(async (team) => {
          let totalpoints = 0;
          let team1count = 0, team2count = 0, allroundercount = 0, wicketKeeperCount = 0, batsmancount = 0, bowlercount = 0;
          const players = team.players.map(async (playerId) => {
            let player = playersMap[playerId.toString()];
            let playerPoints = 0;
            if (!player) {
              playersData = await this.setPlayersInRedis(matchkey, team2Id, real_matchkey);
              return this.fetchUserTeams(req);
            } else {
              player.captain_selection_percentage = Number(player.captain_selection_percentage);
              player.vice_captain_selection_percentage = Number(player.vice_captain_selection_percentage);
              player.totalSelected = Number(player.totalSelected);
              playerPoints = Number(player.points);
              if (playerId.toString() === team.captain.toString()) {
                playerPoints *= 2;
              }
              if (playerId.toString() === team.vicecaptain.toString()) {
                playerPoints *= 1.5;
              }
              team1count += player?.teamid?.toString() == team1Id.toString() ? 1 : 0;
              team2count += player?.teamid?.toString() == team2Id.toString() ? 1 : 0;
            }
            totalpoints += playerPoints;
            wicketKeeperCount += player.role === 'keeper' ? 1 : 0;
            allroundercount += player.role === 'allrounder' ? 1 : 0;
            batsmancount += player.role === 'batsman' ? 1 : 0;
            bowlercount += player.role === 'bowler' ? 1 : 0;
            return {
              ...player,
              captain: playerId.toString() === team.captain.toString() ? 1 : 0,
              vicecaptain: playerId.toString() === team.vicecaptain.toString() ? 1 : 0,
              playerimg: `${global.constant.IMAGE_URL}black_team1.png`,

            };
          });
          const captain = (team?.captain?.toString()) ? playersMap[team.captain.toString()] : {} || {};
          const viceCaptain = (team?.vicecaptain?.toString()) ? playersMap[team.vicecaptain.toString()] : {} || {};

          let selected = false;
          if (matchchallengeid) {
            for (const challenge of matchChallenges) {
              if (challenge._id.toString() === matchchallengeid.toString()) {
                let keyLeaderBoard = `match:${req.query.matchkey}:challenge:${challenge._id}:user:${req.user._id}:userLeaderBoard`;
                let userLeaderboard = await redisLeaderboard.getMyLeaderBoard(keyLeaderBoard, req.user._id);

                // console.log('userLeaderboard', userLeaderboard);
                // const exists = await userLeagueModel.exists({
                //   challengeid: matchchallengeid,
                //   teamid: team._id,
                //   userid: userId,
                // });
                if (userLeaderboard.length >= 0) {
                  for (const user of userLeaderboard) {
                    if (user.jointeamid.toString() === team._id.toString()) {
                      selected = true;
                      break;
                    }
                  }
                }
              }
            }
          }
          let captainTeam = (captain?.teamid?.toString() == team1Id?.toString()) ? 'team1' : 'team2';
          let viceCaptainTeam = (viceCaptain?.teamid?.toString() == team1Id?.toString()) ? 'team1' : 'team2';
          return {
            captainTeam,
            viceCaptainTeam,
            captainimage1: "",
            vicecaptainimage1: "",
            captin_name: captain.name,
            viceCaptain_name: viceCaptain.name,
            team1count,
            captain_id: captain.playerid,
            vicecaptain_id: viceCaptain.playerid,
            team2count,
            batsmancount,
            bowlercount,
            wicketKeeperCount,
            allroundercount,
            totalpoints: totalpoints,
            team1Id: team1Id._id,
            team2Id: team2Id._id,
            status: 1,
            userid: req.user._id,
            teamnumber: team.teamnumber,
            jointeamid: team._id,
            team1_name: team1Id.short_name,
            team2_name: team2Id.short_name,
            player_type: global.constant.PLAYER_TYPE.CLASSIC,
            captain: captain.name || "",
            vicecaptain: viceCaptain.name || "",
            captainimage: captain.image || "",
            vicecaptainimage: viceCaptain.image || "",
            isSelected: selected,
            total_teams: teams.length,
            total_joinedcontest: 0,
            // player: players,
          };
        })
      );

      return {
        message: "Team Data",
        status: true,
        data: finalData,
        // sport_category: sport_category,
      };
    } catch (error) {
      console.error("Error in fetchUserTeams:", error);
      throw error;
    }
  }


  async setTeamsInRedis(userId, matchkey) {
    try {
      const redisKey = `match:${matchkey}:user:${userId}:teams`;
      const teams = await userTeamModel.find({
        userid: userId,
        matchkey: matchkey,
      }).lean();
      // var expRedisTime = await matchTimeDifference(matchkey);
      // await redisjoinTeams.setkeydata(redisKey, teams, expRedisTime);
      // redisLiveJoinTeams.setkeydata(redisKey, teams, expRedisTime); // for live join teams

      var expRedisTime = await matchTimeDifference(matchkey);
      await redisjoinTeams.setkeydata(redisKey, teams, expRedisTime);

      const remTime = await matchRemTime(matchkey);
      // if (remTime > 0 && remTime < 1800) {
      //   redisLiveJoinTeams.setkeydata(redisKey, teams, expRedisTime); // for live join teams
      // }

      return teams;
    } catch (error) {
      console.error("Error in setTeamsInRedis:", error);
      throw error;
    }
  }

  async fetchUserTeams(req) {
    try {
      const { matchkey, matchchallengeid } = req.query;
      const userId = mongoose.Types.ObjectId(req.user._id);
      let keyname = `listMatchesModel-${matchkey}`
      let match = await redisjoinTeams.getkeydata(keyname);
      if (!match) {
        match = await matchesModel.findOne({ _id: matchkey }).lean();
        await redisjoinTeams.setkeydata(keyname, match, 20 * 24 * 60 * 60);
      }

      if (!match) {
        return { status: false, message: "Match not found" };
      }
      const { team1Id, team2Id, real_matchkey } = match;
      const redisKey = `match:${matchkey}:user:${req.user._id}:teams`;
      let teams = await redisjoinTeams.getkeydata(redisKey) || [];
      // console.log('teams', teams);
      if (!teams || !teams.length || teams.length === 0) {
        // teams = await this.setTeamsInRedis(req.user._id, matchkey);
        teams = [];
      }
      if (!teams.length) {
        return { message: "Teams not available", status: false, data: [] };
      }
      let matchChallenges = [];
      if (matchchallengeid) {
        const matchKeyData = `match:${req.query.matchkey}:challenges`;
        matchChallenges = Object.values(await redisContest.hgetAllData(matchKeyData) || {}).filter(mc => mc?.status == "opened");
        // matchChallenges = await matchchallengesModel.find({
        //   matchkey: mongoose.Types.ObjectId(matchkey),
        //   status: "opened",
        // });
      }
      // const joinedContestCount = await this.getJoinleague(req.user._id, matchkey);
      const keyName = `playerList-matchkey-${real_matchkey}`;
      let playersData = await redisjoinTeams.getkeydata(keyName);
      if (!playersData || playersData?.length === 0) {
        // playersData = await this.setPlayersInRedis(matchkey, team2Id, real_matchkey);
        playersData = [];
      }
      const playersMap = playersData.reduce((acc, player) => {
        acc[player.playerid] = player;
        return acc;
      }, {});
      const finalData = await Promise.all(
        teams.map(async (team) => {
          let totalpoints = 0;
          let team1count = 0, team2count = 0, allroundercount = 0, wicketKeeperCount = 0, batsmancount = 0, bowlercount = 0;
          const players = team.players.map(async (playerId) => {
            let player = playersMap[playerId.toString()];
            let playerPoints = 0;
            if (!player) {
              playersData = [];
              return this.fetchUserTeams(req);
            } else {
              player.captain_selection_percentage = Number(player.captain_selection_percentage);
              player.vice_captain_selection_percentage = Number(player.vice_captain_selection_percentage);
              player.totalSelected = Number(player.totalSelected);
              playerPoints = Number(player.points);
              if (playerId.toString() === team.captain) {
                playerPoints *= 2;
              }
              if (playerId.toString() === team.vicecaptain) {
                playerPoints *= 1.5;
              }
              team1count += player?.teamid?.toString() == team1Id.toString() ? 1 : 0;
              team2count += player?.teamid?.toString() == team2Id.toString() ? 1 : 0;
            }
            totalpoints += playerPoints;
            wicketKeeperCount += player.role === 'keeper' ? 1 : 0;
            allroundercount += player.role === 'allrounder' ? 1 : 0;
            batsmancount += player.role === 'batsman' ? 1 : 0;
            bowlercount += player.role === 'bowler' ? 1 : 0;
            return {
              ...player,
              captain: playerId.toString() === team.captain ? 1 : 0,
              vicecaptain: playerId.toString() === team.vicecaptain ? 1 : 0,
              playerimg: `${global.constant.IMAGE_URL}black_team1.png`,

            };
          });
          const captain = (team?.captain?.toString()) ? playersMap[team.captain.toString()] : {} || {};
          const viceCaptain = (team?.vicecaptain?.toString()) ? playersMap[team.vicecaptain.toString()] : {} || {};

          let selected = false;
          if (matchchallengeid) {
            for (const challenge of matchChallenges) {
              if (challenge._id.toString() === matchchallengeid.toString()) {
                let keyLeaderBoard = `match:${req.query.matchkey}:challenge:${challenge._id}:user:${req.user._id}:userLeaderBoard`;
                let userLeaderboard = await redisLeaderboard.getMyLeaderBoard(keyLeaderBoard, req.user._id);

                // console.log('userLeaderboard', userLeaderboard);
                // const exists = await userLeagueModel.exists({
                //   challengeid: matchchallengeid,
                //   teamid: team._id,
                //   userid: userId,
                // });
                if (userLeaderboard.length >= 0) {
                  for (const user of userLeaderboard) {
                    if (user.jointeamid.toString() === team._id.toString()) {
                      selected = true;
                      break;
                    }
                  }
                }
              }
            }
          }
          // console.log('selected', selected);
          let captainTeam = (captain?.teamid?.toString() == team1Id?.toString()) ? 'team1' : 'team2';
          let viceCaptainTeam = (viceCaptain?.teamid?.toString() == team1Id?.toString()) ? 'team1' : 'team2';
          return {
            captainTeam,
            viceCaptainTeam,
            captainimage1: "",
            vicecaptainimage1: "",
            captin_name: captain.name,
            viceCaptain_name: viceCaptain.name,
            team1count,
            captain_id: captain.playerid,
            vicecaptain_id: viceCaptain.playerid,
            team2count,
            batsmancount,
            bowlercount,
            wicketKeeperCount,
            allroundercount,
            totalpoints: totalpoints,
            team1Id: team1Id._id,
            team2Id: team2Id._id,
            status: 1,
            userid: req.user._id,
            teamnumber: team.teamnumber,
            jointeamid: team._id,
            teamType: team.teamType || "10-1",
            team1_name: team1Id.short_name,
            team2_name: team2Id.short_name,
            player_type: global.constant.PLAYER_TYPE.CLASSIC,
            captain: captain.name || "",
            vicecaptain: viceCaptain.name || "",
            captainimage: captain.image || "",
            vicecaptainimage: viceCaptain.image || "",
            isSelected: selected,
            total_teams: teams.length,
            total_joinedcontest: 0,
            // player: players,
          };
        })
      );

      return {
        message: "Team Data",
        status: true,
        data: finalData,
        // sport_category: sport_category,
      };
    } catch (error) {
      console.error("Error in fetchUserTeams:", error);
      throw error;
    }
  }

  async fetchLiveUserTeams(req) {
    try {
      const { matchkey, matchchallengeid } = req.query;
      const userId = mongoose.Types.ObjectId(req.user._id);
      let keyname = `listMatchesModel-${matchkey}`
      let match = await redisjoinTeams.getkeydata(keyname);
      if (!match) {
        match = await matchesModel.findOne({ _id: matchkey }).lean();
        redisjoinTeams.setkeydata(keyname, match, 20 * 24 * 60 * 60); // for live join teams
      }

      if (!match) {
        return { status: false, message: "Match not found" };
      }
      const { team1Id, team2Id, real_matchkey } = match;
      const redisKey = `match:${matchkey}:user:${req.user._id}:teams`;
      // let teams = await redisjoinTeams.getkeydata(redisKey) || [];
      let teams = await redisjoinTeams.getkeydata(redisKey) || [];
      // console.log('teams', teams);
      if (!teams || !teams.length || teams.length === 0) {
        // teams = await this.setTeamsInRedis(req.user._id, matchkey);
        teams = [];
      }
      if (!teams.length) {
        return await this.completeMatchGetMyTeams(req)
        // return { message: "Teams not available", status: false, data: [] };
      }
      let matchChallenges = [];
      if (matchchallengeid) {
        const matchKeyData = `match:${req.query.matchkey}:challenges`;
        matchChallenges = Object.values(await redisContest.hgetAllData(matchKeyData) || {}).filter(mc => mc?.status == "opened");
        // matchChallenges = Object.values(await redisLiveContest.hgetAllData(matchKeyData) || {}).filter(mc => mc?.status == "opened");
        // matchChallenges = await matchchallengesModel.find({
        //   matchkey: mongoose.Types.ObjectId(matchkey),
        //   status: "opened",
        // });
      }
      // const joinedContestCount = await this.getJoinleague(req.user._id, matchkey);
      const keyName = `playerList-matchkey-${real_matchkey}`;
      let playersData = await redisjoinTeams.getkeydata(keyName);
      if (!playersData || playersData?.length === 0) {
        // playersData = await this.setPlayersInRedis(matchkey, team2Id, real_matchkey);
        playersData = [];
      }
      const playersMap = playersData.reduce((acc, player) => {
        acc[player.playerid] = player;
        return acc;
      }, {});
      const finalData = await Promise.all(
        teams.map(async (team) => {
          let totalpoints = 0;
          let team1count = 0, team2count = 0, allroundercount = 0, wicketKeeperCount = 0, batsmancount = 0, bowlercount = 0;
          const players = team.players.map(async (playerId) => {
            let player = playersMap[playerId.toString()];
            let playerPoints = 0;
            if (!player) {
              playersData = [];
              return this.fetchLiveUserTeams(req);
            } else {
              player.captain_selection_percentage = Number(player.captain_selection_percentage);
              player.vice_captain_selection_percentage = Number(player.vice_captain_selection_percentage);
              player.totalSelected = Number(player.totalSelected);
              playerPoints = Number(player.points);
              if (playerId.toString() === team.captain) {
                playerPoints *= 2;
              }
              if (playerId.toString() === team.vicecaptain) {
                playerPoints *= 1.5;
              }
              team1count += player?.teamid?.toString() == team1Id.toString() ? 1 : 0;
              team2count += player?.teamid?.toString() == team2Id.toString() ? 1 : 0;
            }
            totalpoints += playerPoints;
            wicketKeeperCount += player.role === 'keeper' ? 1 : 0;
            allroundercount += player.role === 'allrounder' ? 1 : 0;
            batsmancount += player.role === 'batsman' ? 1 : 0;
            bowlercount += player.role === 'bowler' ? 1 : 0;
            return {
              ...player,
              captain: playerId.toString() === team.captain ? 1 : 0,
              vicecaptain: playerId.toString() === team.vicecaptain ? 1 : 0,
              playerimg: `${global.constant.IMAGE_URL}black_team1.png`,

            };
          });
          const captain = (team?.captain?.toString()) ? playersMap[team.captain.toString()] : {} || {};
          const viceCaptain = (team?.vicecaptain?.toString()) ? playersMap[team.vicecaptain.toString()] : {} || {};

          let selected = false;
          if (matchchallengeid) {
            for (const challenge of matchChallenges) {
              if (challenge._id.toString() === matchchallengeid.toString()) {
                let keyLeaderBoard = `match:${req.query.matchkey}:challenge:${challenge._id}:user:${req.user._id}:userLeaderBoard`;
                let userLeaderboard = await redisLeaderboard.getMyLeaderBoard(keyLeaderBoard, req.user._id);
                // let userLeaderboard = await redisLiveLeaderboard.getMyLeaderBoard(keyLeaderBoard, req.user._id);

                // console.log('userLeaderboard', userLeaderboard);
                // const exists = await userLeagueModel.exists({
                //   challengeid: matchchallengeid,
                //   teamid: team._id,
                //   userid: userId,
                // });
                if (userLeaderboard.length >= 0) {
                  for (const user of userLeaderboard) {
                    if (user.jointeamid.toString() === team._id.toString()) {
                      selected = true;
                      break;
                    }
                  }
                }
              }
            }
          }
          console.log('selected', selected);
          let captainTeam = (captain?.teamid?.toString() == team1Id?.toString()) ? 'team1' : 'team2';
          let viceCaptainTeam = (viceCaptain?.teamid?.toString() == team1Id?.toString()) ? 'team1' : 'team2';
          return {
            captainTeam,
            viceCaptainTeam,
            captainimage1: "",
            vicecaptainimage1: "",
            captin_name: captain.name,
            viceCaptain_name: viceCaptain.name,
            team1count,
            captain_id: captain.playerid,
            vicecaptain_id: viceCaptain.playerid,
            team2count,
            batsmancount,
            bowlercount,
            wicketKeeperCount,
            allroundercount,
            totalpoints: totalpoints,
            team1Id: team1Id._id,
            team2Id: team2Id._id,
            status: 1,
            userid: req.user._id,
            teamnumber: team.teamnumber,
            teamType: team.teamType || "10-1",
            jointeamid: team._id,
            team1_name: team1Id.short_name,
            team2_name: team2Id.short_name,
            player_type: global.constant.PLAYER_TYPE.CLASSIC,
            captain: captain.name || "",
            vicecaptain: viceCaptain.name || "",
            captainimage: captain.image || "",
            vicecaptainimage: viceCaptain.image || "",
            isSelected: selected,
            total_teams: teams.length,
            total_joinedcontest: 0,
            // player: players,
          };
        })
      );

      return {
        message: "Team Data",
        status: true,
        data: finalData,
        // sport_category: sport_category,
      };
    } catch (error) {
      console.error("Error in fetchUserTeams:", error);
      throw error;
    }
  }

  async getUserTeamData(req) {
    try {
      const { matchkey, joinTeamId } = req.query;
      const userId = mongoose.Types.ObjectId(req.user._id);

      let keyname = `listMatchesModel-${matchkey}`
      let match = await redisjoinTeams.getkeydata(keyname);
      if (!match) {
        match = await matchesModel.findOne({ _id: matchkey }).lean();
        await redisjoinTeams.setkeydata(keyname, match, 20 * 24 * 60 * 60);
      }

      if (!match) {
        return { status: false, message: "Match not found" };
      }

      const { team1Id, team2Id, real_matchkey } = match;
      const redisKey = `match:${matchkey}:user:${req.user._id}:teams`;
      let teams = await redisjoinTeams.getkeydata(redisKey) || [];
      if (!teams || !teams.length || teams.length === 0) {
        // teams = await this.setTeamsInRedis(req.user._id, matchkey);
        teams = [];
      }
      if (!teams.length) {
        return { message: "Teams not available", status: false, data: [] };
      }
      teams = await teams.find(item => item._id.toString() === joinTeamId.toString());

      // const teams = await userTeamModel.aggregate([
      //   {
      //     $match: {
      //       _id: mongoose.Types.ObjectId(joinTeamId),
      //       matchkey: mongoose.Types.ObjectId(matchkey)
      //     },
      //   },
      // ]);
      if (!teams) {
        return { message: "Teams not available", status: false, data: [] };
      }
      teams = [teams];
      const keyName = `playerList-matchkey-${real_matchkey}`;
      let playersData = await redisjoinTeams.getkeydata(keyName);
      if (!playersData || playersData?.length === 0) {
        playersData = await this.setPlayersInRedis(matchkey, team2Id, real_matchkey);
      }

      const playersMap = playersData.reduce((acc, player) => {
        acc[player.playerid] = player;
        return acc;
      }, {});
      const finalData = await Promise.all(
        teams.map(async (team) => {
          const players = team.players.map((playerId) => {
            const player = playersMap[playerId.toString()];
            player.captain_selection_percentage = Number(player.captain_selection_percentage);
            player.vice_captain_selection_percentage = Number(player.vice_captain_selection_percentage);
            player.totalSelected = Number(player.totalSelected);
            // if (playerId.toString() === team.captain.toString()) {
            //   player.points = Number(player.points) * 2
            // }
            // if (playerId.toString() === team.vicecaptain.toString()) {
            //   player.points = Number(player.points) * 1.5
            // }
            return {
              ...player,
              captain: playerId.toString() === team.captain.toString() ? 1 : 0,
              vicecaptain: playerId.toString() === team.vicecaptain.toString() ? 1 : 0,
              playerimg: `${global.constant.IMAGE_URL}black_team1.png`,

            };
          });

          const captain = playersMap[team.captain.toString()] || {};
          const viceCaptain = playersMap[team.vicecaptain.toString()] || {};


          return {
            player: players,
          };
        })
      );


      return {
        message: "Team Data",
        status: true,
        data: finalData,
        // sport_category: sport_category,
      };
    } catch (error) {
      console.error("Error in fetchUserTeams:", error);
      throw error;
    }
  }

  async getUserLiveTeamData(req) {
    try {
      const { matchkey, joinTeamId } = req.query;
      const userId = mongoose.Types.ObjectId(req.user._id);

      let keyname = `listMatchesModel-${matchkey}`
      let match = await redisjoinTeams.getkeydata(keyname);
      if (!match) {
        match = await matchesModel.findOne({ _id: matchkey }).lean();
        await redisjoinTeams.setkeydata(keyname, match, 20 * 24 * 60 * 60);
      }

      if (!match) {
        return { status: false, message: "Match not found" };
      }

      const { team1Id, team2Id, real_matchkey } = match;
      const redisKey = `match:${matchkey}:user:${req.user._id}:teams`;
      let teams = await redisjoinTeams.getkeydata(redisKey) || [];
      if (!teams || !teams.length || teams.length === 0) {
        // teams = await this.setTeamsInRedis(req.user._id, matchkey);
        teams = [];
      }
      if (!teams.length) {
        return { message: "Teams not available", status: false, data: [] };
      }
      teams = await teams.find(item => item._id.toString() === joinTeamId.toString());

      // const teams = await userTeamModel.aggregate([
      //   {
      //     $match: {
      //       _id: mongoose.Types.ObjectId(joinTeamId),
      //       matchkey: mongoose.Types.ObjectId(matchkey)
      //     },
      //   },
      // ]);
      if (!teams) {
        return { message: "Teams not available", status: false, data: [] };
      }
      teams = [teams];
      const keyName = `playerList-matchkey-${real_matchkey}`;
      let playersData = await redisjoinTeams.getkeydata(keyName);
      if (!playersData || playersData?.length === 0) {
        playersData = await this.setPlayersInRedis(matchkey, team2Id, real_matchkey);
      }

      const playersMap = playersData.reduce((acc, player) => {
        acc[player.playerid] = player;
        return acc;
      }, {});
      const finalData = await Promise.all(
        teams.map(async (team) => {
          const players = team.players.map((playerId) => {
            const player = playersMap[playerId.toString()];
            player.captain_selection_percentage = Number(player.captain_selection_percentage);
            player.vice_captain_selection_percentage = Number(player.vice_captain_selection_percentage);
            player.totalSelected = Number(player.totalSelected);
            // if (playerId.toString() === team.captain.toString()) {
            //   player.points = Number(player.points) * 2
            // }
            // if (playerId.toString() === team.vicecaptain.toString()) {
            //   player.points = Number(player.points) * 1.5
            // }
            return {
              ...player,
              captain: playerId.toString() === team.captain.toString() ? 1 : 0,
              vicecaptain: playerId.toString() === team.vicecaptain.toString() ? 1 : 0,
              playerimg: `${global.constant.IMAGE_URL}black_team1.png`,

            };
          });

          const captain = playersMap[team.captain.toString()] || {};
          const viceCaptain = playersMap[team.vicecaptain.toString()] || {};


          return {
            player: players,
          };
        })
      );


      return {
        message: "Team Data",
        status: true,
        data: finalData,
        // sport_category: sport_category,
      };
    } catch (error) {
      console.error("Error in fetchUserTeams:", error);
      throw error;
    }
  }

  async completeMatchGetMyTeams(req) {
    try {
      let finalData = [];

      const { team1Id, team2Id } = await matchesModel
        .findOne({ _id: req.query.matchkey })
        .populate([
          { path: "team1Id", select: "short_name", options: { lean: true } },
          { path: "team2Id", select: "short_name", options: { lean: true } },
        ])
        .lean();

      if (!team1Id) {
        return {
          status: false,
          message: "listmatch not Found",
        };
      }
      let aggPipe = [];
      aggPipe.push({
        $match: {
          userid: mongoose.Types.ObjectId(req.user._id),
          matchkey: mongoose.Types.ObjectId(req.query.matchkey),
        },
      });

      aggPipe.push({
        $lookup: {
          from: "teamplayers",
          localField: "captain",
          foreignField: "_id",
          as: "captain",
        },
      });
      aggPipe.push({
        $lookup: {
          from: "teamplayers",
          localField: "vicecaptain",
          foreignField: "_id",
          as: "vicecaptain",
        },
      });

      aggPipe.push({
        $unwind: {
          path: "$vicecaptain",
        },
      });
      aggPipe.push({
        $unwind: {
          path: "$captain",
        },
      });
      aggPipe.push(
        {
          $lookup: {
            from: "matchplayers",
            let: {
              pid: "$players",
              matchkey: "$matchkey",
              captain_id: "$captain._id",
              vicecaptain_id: "$vicecaptain._id",
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
                        $in: ["$playerid", "$$pid"],
                      },
                    ],
                  },
                },
              },
              {
                $lookup: {
                  from: "teamplayers",
                  localField: "playerid",
                  foreignField: "_id",
                  as: "getplayerdata",
                },
              },
              {
                $unwind: {
                  path: "$getplayerdata",
                },
              },
              {
                $project: {
                  _id: 0,
                  id: "$getplayerdata._id",
                  playerimg: "$getplayerdata.image",
                  team: "$getplayerdata.team",
                  name: "$getplayerdata.player_name",
                  role: "$role",
                  credit: "$credit",
                  playingstatus: "$playingstatus",
                  image1: "",
                  points: { $toString: "$points" },
                  captain: "0",
                  vicecaptain: "0",
                },
              },
            ],
            as: "players",
          },
        },
        {
          $unwind: {
            path: "$players",
          },
        },
        {
          $lookup: {
            from: "matches",
            localField: "players.team",
            foreignField: "team1Id",
            pipeline: [
              {
                $match: {
                  _id: mongoose.Types.ObjectId(req.query.matchkey),
                },
              },
            ],
            as: "matchedTeams1",
          },
        },
        {
          $lookup: {
            from: "matches",
            localField: "players.team",
            foreignField: "team2Id",
            pipeline: [
              {
                $match: {
                  _id: mongoose.Types.ObjectId(req.query.matchkey),
                },
              },
            ],
            as: "matchedTeams2",
          },
        },
        {
          $addFields: {
            "players.team": {
              $cond: {
                if: {
                  $in: ["$players.team", "$matchedTeams1.team1Id"],
                },
                then: {
                  team: "team1",
                },
                else: {
                  $cond: {
                    if: {
                      $in: ["$players.team", "$matchedTeams2.team2Id"],
                    },
                    then: {
                      team: "team2",
                    },
                    else: "$players.team",
                  },
                },
              },
            },
          },
        },
        {
          $addFields: {
            "players.team": "$players.team.team",
            "players.teamid": "$players.team",
            "players.vicecaptain": {
              $cond: {
                if: {
                  $eq: ["$players.id", "$vicecaptain._id"],
                },
                then: 1,
                else: 0,
              },
            },
            "players.captain": {
              $cond: {
                if: {
                  $eq: ["$players.id", "$captain._id"],
                },
                then: 1,
                else: 0,
              },
            },
          },
        },
        {
          $group: {
            _id: "$_id",
            data: {
              $first: "$$ROOT",
            },
            player: {
              $push: "$players",
            },
          },
        },
        {
          $addFields: {
            "data.players": "$player",
          },
        },
        {
          $replaceRoot: {
            newRoot: "$data",
          },
        }
      );
      // console.log(JSON.stringify(aggPipe), ">>>>>>>>>>>>>>>");
      const createTeams = await userTeamModel.aggregate(aggPipe);
      // console.log(createTeams.length, ">>>>>>>>>>>>>>>");
      //   console.log("createTeams", createTeams);
      if (createTeams.length == 0) {
        return {
          message: "Teams Not Available",
          status: false,
          data: [],
        };
      }
      let [matchchallenges, total_teams, count_JoinContest] = await Promise.all(
        [
          matchchallengesModel.find({
            matchkey: mongoose.Types.ObjectId(req.query.matchkey),
            status: "opened",
          }),
          userTeamModel.countDocuments({
            userid: req.user._id,
            matchkey: req.query.matchkey,
          }),
          this.getJoinleague(req.user._id, req.query.matchkey),
        ]
      );
      // ---------------------//

      let i = 0;
      for (let element of createTeams) {
        i++;
        let team1count = 0,
          team2count = 0,
          batsCount = 0,
          blowCount = 0,
          wicketKeeperCount = 0,
          allCount = 0;
        // const players = [];
        let totalPoints = 0;
        for (let p of element.players) {
          let im;
          //   console.log("ppp", p);
          if (p.id && p.playerimg != "" && p.playerimg != null && p.playerimg != undefined) {
            if (p.playerimg.startsWith("/p") || element.captain.image.startsWith("p")) {
              im = `${global.constant.IMAGE_URL}${p.playerimg}`;
            } else {
              im = p.playerimg;
            }
          } else {
            if (team1Id._id.toString() == p.team.toString()) {
              im = `${global.constant.IMAGE_URL}white_team1.png`;
            } else {
              im = `${global.constant.IMAGE_URL}black_team1.png`;
            }
          }
          p.points = Number(p.points);
          let playerPoints = Number(p.points)
          p.playerimg = im;
          if (p.id.toString() === element.captain._id.toString()) {
            playerPoints *= 2;
          }
          if (p.id.toString() === element.vicecaptain._id.toString()) {
            playerPoints *= 1.5;
          }


          totalPoints += playerPoints;
          wicketKeeperCount += p.role === 'keeper' ? 1 : 0;
          allCount += p.role === 'allrounder' ? 1 : 0;
          batsCount += p.role === 'batsman' ? 1 : 0;
          blowCount += p.role === 'bowler' ? 1 : 0;
          team1count += p.team == 'team1' ? 1 : 0;
          team2count += p.team == 'team2' ? 1 : 0;
        }
        let Capimage, viceCapimage;
        // ----Inserting Captian image ---------
        let captainTeam = element.captain.team.toString() == team1Id._id.toString() ? 'team1' : 'team2';
        let viceCaptainTeam = element.vicecaptain.team.toString() == team1Id._id.toString() ? 'team1' : 'team2';
        if (
          element.captain._id &&
          element.captain.image != "" &&
          element.captain.image != null &&
          element.captain.image != undefined
        ) {
          if (
            element.captain.image.startsWith("/p") ||
            element.captain.image.startsWith("p")
          ) {
            Capimage = `${global.constant.IMAGE_URL}${element.captain.image}`;
          } else {
            Capimage = element.captain.image;
          }
        } else {
          // Capimage = `${global.constant.IMAGE_URL}avtar1.png`;
          if (team1Id._id.toString() == element.captain.team.toString()) {
            Capimage = `${global.constant.IMAGE_URL}white_team1.png`;
          } else {
            Capimage = `${global.constant.IMAGE_URL}black_team1.png`;
          }
        }

        // ----Inserting Vice-Captian image ---------
        if (
          element.vicecaptain._id &&
          element.vicecaptain.image != "" &&
          element.vicecaptain.image != null &&
          element.vicecaptain.image != undefined
        ) {
          if (
            element.vicecaptain.image.startsWith("/p") ||
            element.vicecaptain.image.startsWith("p")
          ) {
            viceCapimage = `${global.constant.IMAGE_URL}${element.vicecaptain.image}`;
          } else {
            viceCapimage = element.vicecaptain.image;
          }
        } else {
          // viceCapimage = `${global.constant.IMAGE_URL}avtar1.png`;

          if (team1Id._id.toString() == element.vicecaptain.team.toString()) {
            viceCapimage = `${global.constant.IMAGE_URL}white_team1.png`;
          } else {
            viceCapimage = `${global.constant.IMAGE_URL}black_team1.png`;
          }
        }
        const tempObj = {
          status: 1,
          userid: req.user._id,
          teamnumber: element.teamnumber,
          jointeamid: element._id,
          team1_name: team1Id.short_name,
          team2_name: team2Id.short_name,
          player_type: global.constant.PLAYER_TYPE.CLASSIC,
          captain: element.captain._id
            ? element.captain.player_name
            : "",
          vicecaptain: element.vicecaptain._id
            ? element.vicecaptain.player_name
            : "",
          captainimage: Capimage,
          vicecaptainimage: viceCapimage,
          captainimage1: "",
          vicecaptainimage1: "",
          isSelected: false,
          captainTeam: captainTeam,
          viceCaptainTeam: viceCaptainTeam,
        };

        if (matchchallenges.length != 0 && req.query.matchchallengeid) {
          for await (const challenges of matchchallenges) {
            if (
              challenges._id.toString() == req.query.matchchallengeid.toString()
            ) {
              const joindata = await userLeagueModel.findOne({
                challengeid: req.query.matchchallengeid,
                teamid: element._id,
                userid: req.user._id,
              });
              if (joindata) tempObj["isSelected"] = true;
            }
          }
        }


        (tempObj["captin_name"] = element.captain._id
          ? element.captain.player_name
          : ""),
          (tempObj["viceCaptain_name"] = element.vicecaptain._id
            ? element.vicecaptain.player_name
            : ""),
          (tempObj["team1count"] = team1count);
        tempObj["captain_id"] = element.captain._id;
        tempObj["vicecaptain_id"] = element.vicecaptain._id;
        tempObj["team2count"] = team2count;
        tempObj["batsmancount"] = batsCount;
        tempObj["bowlercount"] = blowCount;
        tempObj["wicketKeeperCount"] = wicketKeeperCount;
        tempObj["allroundercount"] = allCount;
        tempObj["total_teams"] = total_teams;
        tempObj["total_joinedcontest"] = count_JoinContest;
        tempObj["totalpoints"] = totalPoints;
        tempObj["team1Id"] = team1Id._id;
        tempObj["team2Id"] = team2Id._id;
        tempObj["player"] = element.players;
        finalData.push(tempObj);

        if (i == createTeams.length) {
          finalData.sort((a, b) => {
            return a.teamnumber - b.teamnumber;
          });
          return {
            message: "Team Data",
            status: true,
            data: finalData,
            // sport_category,
          };
        }
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}

module.exports = new matchServices();
