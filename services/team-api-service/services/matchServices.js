const mongoose = require("mongoose");
require("../../../models/contestModel");
require("../../../models/teamPlayerModel");
require("../../../models/teamModel");
const moment = require("moment");

const matchchallengesModel = require("../../../models/matchContestModel");
const matchesModel = require("../../../models/matchesModel");
const teamModel = require("../../../models/teamModel");
const resultPoint = require("../../../models/resultPointModel");
const seriesModel = require("../../../models/matchSeriesModel");
const matchPlayersModel = require("../../../models/matchPlayersModel");
const userLeagueModel = require("../../../models/userLeagueModel");
const userTeamModel = require("../../../models/userTeamModel");
const configModel = require("../../../models/configModel");
const redisjoinTeams = require("../../../utils/redis/redisjoinTeams");
const redisLiveJoinTeams = require("../../../utils/redis/redisLiveJoinTeams");
const redisLeaderboard = require("../../../utils/redis/redisLeaderboard");
const redisLiveLeaderboard = require("../../../utils/redis/redisLiveLeaderboard");
const { healthCheck } = require("../../../utils/redis/redisMain");
// const { getMatchPlayrs } = require("../../../utils/s3");
const { sendToQueue } = require("../../../utils/kafka");
const { matchTimeDifference } = require("../../../utils/matchTimeDiffrence");
const redisCompletedMatch = require("../../../utils/redis/redisCompletedMatch");

class matchServices {
  constructor() {
    return {
      dbCheck: this.dbCheck.bind(this),
      updatedMatchData: this.updatedMatchData.bind(this),
      showTeam: this.showTeam.bind(this),
      showLiveTeam: this.showLiveTeam.bind(this),
      joinTeamPlayerDetails: this.joinTeamPlayerDetails.bind(this),
      compareTeam: this.compareTeam.bind(this),
      fetchGuruTeam: this.fetchGuruTeam.bind(this),
      fetchDreamTeam: this.fetchDreamTeam.bind(this),
      fetchMyCompleteMatchTeam: this.fetchMyCompleteMatchTeam.bind(this),
      fetchMyTeam: this.fetchMyTeam.bind(this),
      getJoinleague: this.getJoinleague.bind(this),
      getMatchTime: this.getMatchTime.bind(this),
      showTeamNew: this.showTeamNew.bind(this),
      getUserContestTeamCount: this.getUserContestTeamCount.bind(this)
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

  async updatedMatchData() {
    try {
      const items = await matchesModel.find();
      let updatedCount = 0;

      for (const mymatch of items) {
        const checkMatchkey = await matchesModel.findOne({ real_matchkey: mymatch.real_matchkey });

        const [teamData1, teamData2, series] = await Promise.all([
          teamModel.findOne({ _id: mymatch.team1Id }),
          teamModel.findOne({ _id: mymatch.team2Id }),
          seriesModel.findOne({ _id: mymatch.series })
        ]);

        if (!teamData1 || !teamData2 || !series) {
          console.log(`Skipping match ${mymatch.real_matchkey} due to missing data.`);
          continue;
        }

        const teamOne = {
          teamId: teamData1._id.toString(),
          teamName: teamData1.teamName,
          short_name: teamData1.short_name,
          fantasyType: "Cricket",
          logo: teamData1.logo || "",
          team_key: teamData1.team_id
        };

        const teamTwo = {
          teamId: teamData2._id.toString(),
          teamName: teamData2.teamName,
          short_name: teamData2.short_name,
          fantasyType: "Cricket",
          logo: teamData2.logo || "",
          team_key: teamData2.team_id
        };

        const seriesObj = {
          seriesId: series._id.toString(),
          fantasyType: "Cricket",
          name: series.name,
          seriesKey: series.series_key,
          status: series.status,
          startDate: `${series.start_date}`,
          endDate: `${series.end_date}`,
          hasLeaderboard: series.has_leaderboard,
          winningStatus: series.winningStatus
        };

        const result = await matchesModel.findOneAndUpdate(
          { real_matchkey: mymatch.real_matchkey }, // Match condition
          {
            teamA: teamOne,
            teamB: teamTwo,
            seriesData: seriesObj
          },
          { new: true, upsert: true } // अगर मैच नहीं मिलता तो नया डॉक्यूमेंट बना देगा
        );

        if (result) updatedCount++;
      }

      return {
        success: true,
        message: `${updatedCount} matches updated successfully`,
        updatedMatches: updatedCount
      };

    } catch (error) {
      console.error("Error updating match data:", error);
      return { success: false, error: error.message };
    }
  }



  async getMatchTime(start_date) {
    const currentdate = new Date();
    const ISTTime = moment().format("YYYY-MM-DD HH:mm:ss");
    if (ISTTime >= start_date) {
      return false;
    } else {
      return true;
    }
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
          "image": player?.image || `${process.env.IMAGE_URL}avtar1.png`,
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


  async fetchMyTeam(req) {
    try {
      const { matchkey, matchchallengeid } = req.query;
      const userId = mongoose.Types.ObjectId(req.user._id);

      const match = await matchesModel
        .findOne({ _id: matchkey })
        .populate([
          { path: "team1Id", select: "short_name", options: { lean: true } },
          { path: "team2Id", select: "short_name", options: { lean: true } },
        ])
        .lean();

      if (!match) {
        return { status: false, message: "Match not found" };
      }
      const { team1Id, team2Id, real_matchkey } = match;
      const teams = await userTeamModel.aggregate([
        {
          $match: {
            userid: userId,
            matchkey: mongoose.Types.ObjectId(matchkey),
          },
        },
      ]);
      if (!teams.length) {
        return { message: "Teams not available", status: false, data: [] };
      }

      const [matchChallenges, totalTeams, joinedContestCount] = await Promise.all([
        matchchallengesModel.find({
          matchkey: mongoose.Types.ObjectId(matchkey),
          status: "opened",
        }),
        userTeamModel.countDocuments({ userid: req.user._id, matchkey }),
        this.getJoinleague(req.user._id, matchkey),
      ]);

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
          let totalpoints = 0;
          let team1count = 0, team2count = 0, allroundercount = 0, wicketKeeperCount = 0, batsmancount = 0, bowlercount = 0;
          const players = team.players.map(async (playerId) => {
            let player = playersMap[playerId.toString()];
            let playerPoints = 0;
            if (!player) {
              player = await matchPlayersModel.findOne({ playerid: playerId, matchkey: matchkey });
              player.captain_selection_percentage = player?.captain_selection_percentage || 0;
              player.vice_captain_selection_percentage = player?.vice_captain_selection_percentage || 0;
              player.totalSelected = player?.totalSelected || 0;
              let playerPoints = Number(player.points);
              playersMap[playerId.toString()] = player;
              if (playerId.toString() === team.captain.toString()) {
                playerPoints *= 2;
              }
              if (playerId.toString() === team.vicecaptain.toString()) {
                playerPoints *= 1.5;
              }
              team1count = 7;
              team2count = 4;
            } else {
              player.captain_selection_percentage = Number(player.captain_selection_percentage);
              player.vice_captain_selection_percentage = Number(player.vice_captain_selection_percentage);
              player.totalSelected = Number(player.totalSelected);
              let playerPoints = Number(player.points);
              if (playerId.toString() === team.captain.toString()) {
                playerPoints *= 2;
              }
              if (playerId.toString() === team.vicecaptain.toString()) {
                playerPoints *= 1.5;
              }
              team1count += player.teamid.toString() == team1Id._id.toString() ? 1 : 0;
              team2count += player.teamid.toString() == team2Id._id.toString() ? 1 : 0;
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
          const captain = playersMap[team.captain.toString()] || {};
          const viceCaptain = playersMap[team.vicecaptain.toString()] || {};

          let selected = false;
          if (matchchallengeid) {
            for (const challenge of matchChallenges) {
              if (challenge._id.toString() === matchchallengeid.toString()) {
                const exists = await userLeagueModel.exists({
                  challengeid: matchchallengeid,
                  teamid: team._id,
                  userid: userId,
                });
                if (exists) {
                  selected = true;
                  break;
                }
              }
            }
          }
          let captainTeam = captain.teamid.toString() == team1Id._id.toString() ? 'team1' : 'team2';
          let viceCaptainTeam = viceCaptain.teamid.toString() == team1Id._id.toString() ? 'team1' : 'team2';

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
            total_teams: totalTeams,
            total_joinedcontest: joinedContestCount,
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
      console.error("Error in getMyTeams:", error);
      throw error;
    }
  }

  async fetchMyCompleteMatchTeam(req) {
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

  async joinTeamPlayerDetails(req) {
    try {
      let aggpipe = [];
      aggpipe.push({
        $match: { _id: mongoose.Types.ObjectId(req.query.jointeamid) },
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
        $lookup: {
          from: "teamplayers",
          localField: "players",
          foreignField: "_id",
          as: "PlayerData",
        },
      });
      aggpipe.push({
        $unwind: {
          path: "$PlayerData",
          preserveNullAndEmptyArrays: true,
        },
      });
      aggpipe.push({
        $lookup: {
          from: "teams",
          localField: "PlayerData.team",
          foreignField: "_id",
          as: "teamData",
        },
      });
      aggpipe.push({
        $lookup: {
          from: "matchplayers",
          localField: "players",
          foreignField: "playerid",
          as: "matchPlayerData",
        },
      });
      // aggpipe.push({
      //   $unwind:{path:"$matchPlayerData",
      //   preserveNullAndEmptyArrays: true}
      // })
      aggpipe.push({
        $lookup: {
          from: "resultmatches",
          let: { matchkey: "$matchkey", playerid: "$PlayerData._id" },
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
          as: "resulMatchtData",
        },
      });
      aggpipe.push({
        $lookup: {
          from: "resultpoints",
          let: { matchkey: "$matchkey", playerid: "$PlayerData._id" },
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
          as: "resultpointData",
        },
      });
      aggpipe.push({
        $project: {
          _id: 0,
          joinTeamId: "$_id",
          matchname: "$matchname",
          playerid: "$PlayerData._id",
          playerrole: "$PlayerData.role",
          credit: "$PlayerData.credit",
          duck: {
            $ifNull: [{ $arrayElemAt: ["$resulMatchtData.duck", 0] }, 0],
          },
          innings: {
            $ifNull: [{ $arrayElemAt: ["$resulMatchtData.innings", 0] }, 0],
          },
          teamShortName: 1,
          startingpoints: {
            $ifNull: [
              { $arrayElemAt: ["$resultpointData.startingpoints", 0] },
              0,
            ],
          },
          runs: {
            $ifNull: [{ $arrayElemAt: ["$resultpointData.runs", 0] }, 0],
          },
          fours: {
            $ifNull: [{ $arrayElemAt: ["$resultpointData.fours", 0] }, 0],
          },
          wicket: {
            $ifNull: [{ $arrayElemAt: ["$resultpointData.wickets", 0] }, 0],
          },
          sixs: {
            $ifNull: [{ $arrayElemAt: ["$resultpointData.sixs", 0] }, 0],
          },
          strike_rate: {
            $ifNull: [{ $arrayElemAt: ["$resultpointData.strike_rate", 0] }, 0],
          },
          century: {
            $sum: [
              {
                $ifNull: [{ $arrayElemAt: ["$resultpointData.century", 0] }, 0],
              },
              {
                $ifNull: [
                  { $arrayElemAt: ["$resultpointData.halfcentury", 0] },
                  0,
                ],
              },
            ],
          },
          // wickets: { $ifNull: [{ $arrayElemAt: ['$resultpointData.wickets', 0] },0]},
          maidens: {
            $ifNull: [{ $arrayElemAt: ["$resultpointData.maidens", 0] }, 0],
          },
          economy_rate: {
            $ifNull: [
              { $arrayElemAt: ["$resultpointData.economy_rate", 0] },
              0,
            ],
          },
          thrower: {
            $ifNull: [{ $arrayElemAt: ["$resultpointData.thrower", 0] }, 0],
          },
          hitter: {
            $ifNull: [{ $arrayElemAt: ["$resultpointData.hitter", 0] }, 0],
          },
          catch: {
            $ifNull: [{ $arrayElemAt: ["$resultpointData.catch", 0] }, 0],
          },
          catchpoints: {
            $ifNull: [{ $arrayElemAt: ["$resultpointData.catch", 0] }, 0],
          },
          stumping: {
            $sum: [
              {
                $ifNull: [
                  { $arrayElemAt: ["$resultpointData.stumping", 0] },
                  0,
                ],
              },
              {
                $ifNull: [{ $arrayElemAt: ["$resultpointData.thrower", 0] }, 0],
              },
              {
                $ifNull: [{ $arrayElemAt: ["$resultpointData.hitter", 0] }, 0],
              },
            ],
          },
          bonus: {
            $ifNull: [{ $arrayElemAt: ["$resultpointData.bonus", 0] }, 0],
          },
          halfcentury: {
            $ifNull: [{ $arrayElemAt: ["$resultpointData.halfcentury", 0] }, 0],
          },
          negative: {
            $ifNull: [{ $arrayElemAt: ["$resultpointData.negative", 0] }, 0],
          },
          total: {
            $ifNull: [{ $arrayElemAt: ["$resultpointData.total", 0] }, 0],
          },
          wicketbonuspoint: {
            $ifNull: [
              { $arrayElemAt: ["$resultpointData.wicketbonuspoint", 0] },
              0,
            ],
          },
          selectper: { $ifNull: ["$matchPlayerData.totalSelected", "0"] },
        },
      });

      const joinTeamPlayerData = await userTeamModel.aggregate(aggpipe);
      let i = 0;
      let Selectper = [];
      for (i = 0; i < joinTeamPlayerData.length; i++) {
        joinTeamPlayerData[i].selectper = joinTeamPlayerData[i].selectper[i];
      }
      //             joinTeamPlayerData[i].forEach(Selectperobj=>
      // {Selectperobj.selectper.forEach(item=>
      //     {Selectperobj.selectper=i

      //     })

      //     i++;                //Selectper.push(item)
      //                     // joinTeamPlayerData[i].selectper=item;
      //                     // console.log("item"+item)
      //                     // i++;

      //                 //joinTeamPlayerData[0].selectper=
      // })
      // const captain_TeamPlayerData = await userTeamModel.aggregate(conditionsCaptain);
      // const voice_captain_TeamPlayerData = await userTeamModel.aggregate(conditionsVoiceCaptain);
      if (joinTeamPlayerData.length > 0) {
        return {
          message: "Join Team Player Info Of A Match...",
          status: true,
          data: joinTeamPlayerData,
        };
      } else {
        return {
          message: "Join Team Player Info not found...",
          status: false,
          data: [],
        };
      }
    } catch (error) {
      throw error;
    }
  }

  async showTeam(req) {
    try {
      console.log("-showTeam-");
      const finalData = [];
      const matchKey = req.query.matchkey;
      const teamNumber = parseInt(req.query.teamnumber);
      const joinTeamId = req.query.jointeamid;

      if (!matchKey) {
        return { message: "Match key is required", status: false, data: [] };
      }

      if (!joinTeamId && isNaN(teamNumber)) {
        return { message: "Either joinTeamId or teamNumber is required", status: false, data: [] };
      }
      // Fetch match data from Redis or database
      const redisKey = `listMatchesModel-${matchKey}`;
      let listMatchData = await redisjoinTeams.getkeydata(redisKey);
      if (!listMatchData) {
        listMatchData = await matchesModel.findOne({ _id: matchKey });
        if (!listMatchData) throw new Error("Match not found");
        await redisjoinTeams.setkeydata(redisKey, listMatchData, 20 * 24 * 60 * 60);
      }

      // Build aggregation pipeline for team data
      const pipeline = [
        { $match: { matchkey: mongoose.Types.ObjectId(matchKey), _id: mongoose.Types.ObjectId(joinTeamId), teamnumber: teamNumber } },
        { $lookup: { from: "teamplayers", localField: "players", foreignField: "_id", as: "getplayersdata" } },
        { $lookup: { from: "teamplayers", localField: "captain", foreignField: "_id", as: "captain" } },
        { $lookup: { from: "teamplayers", localField: "vicecaptain", foreignField: "_id", as: "vicecaptain" } },
        { $unwind: "$vicecaptain" },
        { $unwind: "$captain" }
      ];

      const createTeam = await userTeamModel.aggregate(pipeline);
      if (createTeam.length === 0) {
        return { message: "Team Not Available", status: false, data: [] };
      }

      // Fetch player data from Redis or database
      const playersRedisKey = `playerList-matchkey-${listMatchData.real_matchkey}`;
      let matchPlayersData = await redisjoinTeams.getkeydata(playersRedisKey);
      if (!matchPlayersData) {
        const filePath = `matchPlayer/playserList-${matchKey}.json`;
        matchPlayersData = await this.setPlayersInRedis(matchKey, listMatchData.team2Id, listMatchData.real_matchkey);
        await redisjoinTeams.setkeydata(playersRedisKey, matchPlayersData, 60 * 60 * 48);
      }

      // Process each player in the team
      for (const playerData of createTeam[0].getplayersdata) {
        const filterData = matchPlayersData.find(item => item.playerid.toString() === playerData._id.toString());
        if (!filterData) {
          return { status: false, message: "Match player not found", data: [] };
        }

        const teamImage = (listMatchData?.team1Id?.toString() === playerData?.team?.toString())
          ? `${global.constant.IMAGE_URL}white_team1.png`
          : `${global.constant.IMAGE_URL}black_team1.png`;

        const playerImage = playerData.image
          ? (playerData.image.startsWith("/p") || playerData.image.startsWith("p"))
            ? `${global.constant.IMAGE_URL}${playerData.image}`
            : playerData.image
          : teamImage;

        const points = createTeam[0]?.captain?._id?.toString() === playerData?._id?.toString()
          ? parseFloat(filterData.points).toFixed(2) * 2
          : createTeam[0]?.vicecaptain?._id?.toString() === playerData?._id?.toString()
            ? parseFloat(filterData.points).toFixed(2) * 1.5
            : filterData.points;

        finalData.push({
          id: playerData._id,
          playerid: playerData._id,
          name: playerData.player_name,
          role: filterData.role,
          credit: filterData.credit,
          playingstatus: filterData.playingstatus,
          team: listMatchData?.team1Id?.toString() === playerData?.team?.toString() ? "team1" : "team2",
          image: playerImage,
          captain: createTeam[0]?.captain?._id?.toString() === playerData?._id?.toString() ? 1 : 0,
          vicecaptain: createTeam[0]?.vicecaptain?._id?.toString() === playerData?._id?.toString() ? 1 : 0,
          points,
          isSelected: false
        });
      }

      if (finalData.length === createTeam[0].players.length) {
        return {
          message: "User Particular Team Data",
          status: true,
          data: finalData,
          // sport_category: {
          //   id: 2,
          //   name: "T20",
          //   max_players: 11,
          //   max_credits: 100,
          //   min_players_per_team: 4,
          //   icon: "",
          //   category: "cricket",
          //   player_positions: [
          //     { id: 9, sport_category_id: 2, name: "WK", full_name: "Wicket-Keepers", code: "keeper", icon: "img/wk.png", min_players_per_team: 1, max_players_per_team: 4 },
          //     { id: 10, sport_category_id: 2, name: "BAT", full_name: "Batsmen", code: "batsman", icon: "img/bat.png", min_players_per_team: 3, max_players_per_team: 6 },
          //     { id: 11, sport_category_id: 2, name: "ALL", full_name: "All-Rounders", code: "allrounder", icon: "img/all.png", min_players_per_team: 1, max_players_per_team: 4 },
          //     { id: 12, sport_category_id: 2, name: "BWL", full_name: "Bowlers", code: "bowler", icon: "img/bowler.png", min_players_per_team: 3, max_players_per_team: 6 }
          //   ]
          // }
          // pipeline,
        };
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async showLiveTeam(req) {
    try {
      const finalData = [];
      const matchKey = req.query.matchkey;
      const teamNumber = parseInt(req.query.teamnumber);
      const joinTeamId = req.query.jointeamid;

      if (!matchKey) {
        return { message: "Match key is required", status: false, data: [] };
      }

      if (!joinTeamId && isNaN(teamNumber)) {
        return { message: "Either joinTeamId or teamNumber is required", status: false, data: [] };
      }
      // Fetch match data from Redis or database
      const redisKey = `listMatchesModel-${matchKey}`;
      // let listMatchData = await redisjoinTeams.getkeydata(redisKey);
      let listMatchData = await redisjoinTeams.getkeydata(redisKey);
      console.log(listMatchData, "listMatchData")
      if (!listMatchData) {
        listMatchData = await matchesModel.findOne({ _id: matchKey });
        if (!listMatchData) throw new Error("Match not found");
        // await redisjoinTeams.setkeydata(redisKey, listMatchData, 20 * 24 * 60 * 60);
        await redisjoinTeams.setkeydata(redisKey, listMatchData, 20 * 24 * 60 * 60);
      }

      // Build aggregation pipeline for team data
      const pipeline = [
        { $match: { _id: mongoose.Types.ObjectId(joinTeamId) } },
        // { $lookup: { from: "players", localField: "players", foreignField: "_id", as: "getplayersdata" } },
        // { $lookup: { from: "players", localField: "captain", foreignField: "_id", as: "captain" } },
        // { $lookup: { from: "players", localField: "vicecaptain", foreignField: "_id", as: "vicecaptain" } },
        // { $unwind: "$vicecaptain" },
        // { $unwind: "$captain" }
      ];
      // return { message: "Team Not Available", status: false, data: [] };
      const createTeam = await userTeamModel.aggregate(pipeline);
      console.log(createTeam, "createTeam")
      if (createTeam.length === 0) {
        return { message: "Team Not Available", status: false, data: [] };
      }

      // Fetch player data from Redis or database
      const playersRedisKey = `playerList-matchkey-${listMatchData.real_matchkey}`;
      let matchPlayersData = await redisjoinTeams.getkeydata(playersRedisKey);
      if (!matchPlayersData) {
        const filePath = `matchPlayer/playserList-${matchKey}.json`;
        matchPlayersData = await this.setPlayersInRedis(matchKey, listMatchData.team2Id, listMatchData.real_matchkey);
        await redisjoinTeams.setkeydata(playersRedisKey, matchPlayersData, 60 * 60 * 48);
      }

      // Process each player in the team
      for (const playerData of createTeam[0]?.playersData || []) {
        const filterData = matchPlayersData.find(item => item.playerid.toString() === playerData.playerId.toString());
        if (!filterData) {
          return { status: false, message: "Match player not found", data: [] };
        }

        const teamImage = (listMatchData?.team1Id?.toString() === playerData?.team?.toString())
          ? `${global.constant.IMAGE_URL}white_team1.png`
          : `${global.constant.IMAGE_URL}black_team1.png`;

        const playerImage = playerData.image
          ? (playerData.image.startsWith("/p") || playerData.image.startsWith("p"))
            ? `${global.constant.IMAGE_URL}${playerData.image}`
            : playerData.image
          : teamImage;

        const points = createTeam[0]?.captain?.toString() === playerData?.playerId?.toString()
          ? parseFloat(filterData.points).toFixed(2) * 2
          : createTeam[0]?.vicecaptain?.toString() === playerData?.playerId?.toString()
            ? parseFloat(filterData.points).toFixed(2) * 1.5
            : filterData.points;

        finalData.push({
          id: playerData._id,
          playerid: playerData.playerId,
          name: playerData.playerName,
          role: filterData.role,
          credit: filterData.credit,
          playingstatus: filterData.playingstatus,
          team: listMatchData?.team1Id?.toString() === playerData?.team?.toString() ? "team1" : "team2",
          image: playerImage,
          captain: createTeam[0]?.captain?.toString() === playerData?.playerId?.toString() ? 1 : 0,
          vicecaptain: createTeam[0]?.vicecaptain?.toString() === playerData?.playerId?.toString() ? 1 : 0,
          points,
          isSelected: false
        });
      }

      if (finalData.length === createTeam[0].players.length) {
        return {
          message: "User Particular Team Data",
          status: true,
          data: finalData,
          // sport_category: {
          //   id: 2,
          //   name: "T20",
          //   max_players: 11,
          //   max_credits: 100,
          //   min_players_per_team: 4,
          //   icon: "",
          //   category: "cricket",
          //   player_positions: [
          //     { id: 9, sport_category_id: 2, name: "WK", full_name: "Wicket-Keepers", code: "keeper", icon: "img/wk.png", min_players_per_team: 1, max_players_per_team: 4 },
          //     { id: 10, sport_category_id: 2, name: "BAT", full_name: "Batsmen", code: "batsman", icon: "img/bat.png", min_players_per_team: 3, max_players_per_team: 6 },
          //     { id: 11, sport_category_id: 2, name: "ALL", full_name: "All-Rounders", code: "allrounder", icon: "img/all.png", min_players_per_team: 1, max_players_per_team: 4 },
          //     { id: 12, sport_category_id: 2, name: "BWL", full_name: "Bowlers", code: "bowler", icon: "img/bowler.png", min_players_per_team: 3, max_players_per_team: 6 }
          //   ]
          // }
          // pipeline,
        };
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  }


  async showTeamNew(req) {
    try {
      const matchkey = req.query.matchkey;
      const teamNumber = parseInt(req.query.teamnumber);
      const joinTeamId = req.query.jointeamid;
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
      // const redisKey = `match:${matchkey}:user:${req.user._id}:teams`;
      // let teams = await redisjoinTeams.getkeydata(redisKey) || [];
      // if (!teams || !teams.length || teams.length === 0) {
      //   // teams = await this.setTeamsInRedis(req.user._id, matchkey);
      //   teams = [];
      // }
      const teams = await userTeamModel.aggregate([
        {
          $match: {
            _id: mongoose.Types.ObjectId(joinTeamId)
          },
        },
      ]);
      if (!teams.length) {
        return { message: "Teams not available", status: false, data: [] };
      }
      // teams = await teams.find(item => item._id.toString() === joinTeamId.toString());


      // if (!teams) {
      //   return { message: "Teams not available", status: false, data: [] };
      // }
      // teams = [teams];
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
            if (playerId.toString() === team.captain.toString()) {
              player.points = Number(player.points) * 2
            }
            if (playerId.toString() === team.vicecaptain.toString()) {
              player.points = Number(player.points) * 1.5
            }
            let obj = {
              id: player.playerid,
              playerid: player.playerid,
              name: player.name,
              role: player.role,
              credit: player.credit,
              playingstatus: player.playingstatus,
              team: player.team,
              image: `${global.constant.IMAGE_URL}black_team1.png`,
              captain: playerId.toString() === team.captain.toString() ? 1 : 0,
              vicecaptain: playerId.toString() === team.vicecaptain.toString() ? 1 : 0,
              points: player.points,
              isSelected: false
            }
            return obj;
            // return {
            //   ...player,
            //   captain: playerId.toString() === team.captain.toString() ? 1 : 0,
            //   vicecaptain: playerId.toString() === team.vicecaptain.toString() ? 1 : 0,
            //   playerimg: `${global.constant.IMAGE_URL}black_team1.png`,

            // };
          });

          const captain = playersMap[team.captain.toString()] || {};
          const viceCaptain = playersMap[team.vicecaptain.toString()] || {};


          return players;
        })
      );


      return {
        message: "Team Data",
        status: true,
        data: finalData[0],
        // sport_category: sport_category,
      };
    } catch (error) {
      console.error("Error in getMyTeams:", error);
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
      await redisLiveJoinTeams.setkeydata(redisKey, teams, 60 * 60 * 48);
      return teams;
    } catch (error) {
      console.error("Error in setTeamsInRedis:", error);
      throw error;
    }
  }
  async compareTeam(req) {
    try {
      const key = `match:${req.query.matchkey}:user:${req.user._id}:teams`;
      let teamData1 = await redisLiveJoinTeams.getkeydata(key);

      if (!teamData1 || teamData1.length <= 0) {
        teamData1 = await this.setTeamsInRedis(req.user._id, req.query.matchkey);
      }


      let teamData32 = teamData1.find(item => item._id.toString() == req.query.team1id) || null;
      const key1 = `match:${req.query.matchkey}:user:${req.query.team2UserId}:teams`;
      let teamData2 = await redisLiveJoinTeams.getkeydata(key1);
      if (!teamData2 || teamData2.length <= 0) {
        teamData2 = await this.setTeamsInRedis(req.query.team2UserId, req.query.matchkey);
      }
      let teamData23 = teamData2.find(item => item._id.toString() == req.query.team2id) || null;
      let teams = [teamData32, teamData23];
      let captain = [];
      let vicecaptain = [];

      let matched = [];
      let unmatched = [];
      let userTeamData = [];

      let keyChallengeLeaderBoard = 'liveRanksLeaderboard_' + req.query.challengeId.toString();
      let l1Data = await redisLiveLeaderboard.particularUserLeaderBoard(keyChallengeLeaderBoard, req.user._id, '', [req.query.l1]);
      let l2Data = await redisLiveLeaderboard.particularUserLeaderBoard(keyChallengeLeaderBoard, req.user._id, '', [req.query.l2]);
      if (l1Data.length > 0 && l2Data.length > 0) {
        // let team1, team2;
        // if (req.query.team1id === l1Data[0].jointeamid) {
        //   team1 = 1
        // }
        // if (req.query.team2id === l2Data[0].jointeamid) {
        //   team2 = 2
        // }
        let l1 = {
          "_id": l1Data[0].userid,
          "points": l1Data[0].points,
          "teams": 1,
          "image": l1Data[0].image,
          "teamName": l1Data[0].teamname
        }
        let l2 = {
          "_id": l2Data[0].userid,
          "points": l2Data[0].points,
          "teams": 2,
          "image": l2Data[0].image,
          "teamName": l2Data[0].teamname
        }
        userTeamData = [l1, l2]
      }
      if (userTeamData.length <= 0) {
        userTeamData = await userTeamModel.aggregate([
          {
            $match: {
              _id: {
                $in: [
                  new mongoose.Types.ObjectId(req.query.team2id),
                  new mongoose.Types.ObjectId(req.query.team1id),
                ],
              },
              matchkey: new mongoose.Types.ObjectId(req.query.matchkey),
            },
          },
          {
            $lookup: {
              from: "users",
              localField: "userid",
              foreignField: "_id",
              as: "users",
            },
          },
          { $unwind: "$users" },
          {
            $lookup: {
              from: "userleaderboard",
              localField: "_id",
              foreignField: "teamId",
              as: "leaderboardData",
            },
          },
          {
            $addFields: {
              points: {
                $ifNull: [{ $arrayElemAt: ["$leaderboardData.points", 0] }, 0],
              },
              teams: {
                $cond: {
                  if: { $eq: ["$_id", new mongoose.Types.ObjectId(req.query.team1id)] },
                  then: 1,
                  else: 2,
                },
              },
              image: {
                $cond: {
                  if: { $eq: ["$users.image", ""] },
                  then: { $concat: [`${global.constant.IMAGE_URL}`, "avtar1.png"] },
                  else: { $concat: [`${global.constant.IMAGE_URL}`, "$users.image"] },
                },
              },
            },
          },
          {
            $project: {
              teamName: "$users.team",
              points: 1,
              image: 1,
              teams: 1,
            },
          },
        ]);
      }
      const keyResultName = `resultPoint-${req.query.matchkey}`;
      let playersPoint = await redisLiveJoinTeams.getkeydata(keyResultName);
      playersPoint = (!playersPoint || playersPoint.length <= 0) ? await this.getPlayerPoints(req.query.matchkey) : playersPoint;
      let playersData = [];
      for (const iterator of teams) {
        let cap = playersPoint[0][iterator.captainData.playerId];
        let vicecap = playersPoint[0][iterator.viceCaptainData.playerId];
        iterator.captainData.image =
          `${global.constant.IMAGE_URL}avtar1.png`;
        if (iterator._id == req.query.team1id) {
          iterator.captainData.teams = 1;
          iterator.captainData.points = cap * 2
        }
        if (iterator._id == req.query.team2id) {
          iterator.captainData.teams = 2;
          iterator.captainData.points = cap * 2
        }
        iterator.viceCaptainData.image =
          `${global.constant.IMAGE_URL}avtar1.png`;
        if (iterator._id == req.query.team1id) {
          iterator.viceCaptainData.teams = 1;
          iterator.viceCaptainData.points = vicecap * 1.5
        }
        if (iterator._id == req.query.team2id) {
          iterator.viceCaptainData.teams = 2;
          iterator.viceCaptainData.points = vicecap * 1.5
        }

        captain.push(iterator.captainData);
        vicecaptain.push(iterator.viceCaptainData);
        for (const player of iterator.playersData) {
          let points = playersPoint[0][player.playerId];
          player.image =
            `${global.constant.IMAGE_URL}avtar1.png`;
          if (iterator._id == req.query.team2id) {
            player.teams = 2;
            player.points = points;
          }
          if (iterator._id == req.query.team1id) {
            player.teams = 1;
            player.points = points;
          }
          matched.push(player);
        }
        playersData.push(iterator.playersData);
      }
      function findUnion(arr1, arr2) {
        let newArr = [];
        let newArr2 = [];
        let FArr = [...arr1];
        if (arr2) {
          FArr = [...arr1, ...arr2];
        }


        for (const item of FArr) {
          if (!newArr.includes(item.playerId.toString())) {
            newArr.push(item.playerId.toString());
          } else {
            newArr2.push(item.playerId.toString());
          }
        }

        let differant = [];
        for (const item of newArr) {
          if (!newArr2.includes(item)) {
            differant.push(item);
          }
        }
        let matchedData = newArr2;
        return {
          matchedData,
          differant,
        };
      }
      function findUnionTT(arr1, arr2, ids) {
        let newArr = [];
        let FArr = [...arr1, ...arr2];

        for (const item of FArr) {
          if (ids.includes(item.playerId)) {
            newArr.push(item);
          }
        }

        return newArr;
      }

      // function findIntersection(arr1, arr2) {
      //   const set1 = new Set(arr1.map((obj) => obj.playerid));
      //   const intersection = arr2.filter((obj) => set1.has(obj.playerid));
      // }
      // Example arrays
      const union = findUnion(playersData[0], playersData[1]);
      // 
      unmatched = findUnionTT(playersData[0], playersData[1], union.differant);
      let Common = findUnionTT(playersData[0], playersData[1], union.matchedData);
      let uniqueIds = {};

      // Filter out duplicate objects based on "_id" property
      let data11 = Common.filter((obj) => {
        if (!uniqueIds[obj.playerId]) {
          uniqueIds[obj.playerId] = true;
          return true;
        }
        return false;
      });
      Common = [];
      Common = data11;
      let newData = { userTeamData, captain, vicecaptain, Common, unmatched };
      console.log('Fetch Data Successfully');
      return {
        message: "Fetch Data Successfully",
        status: true,
        data: newData,
      };
    } catch (error) {
      console.log(error);
    }
  }


  async fetchDreamTeam(req) {
    try {
      let { matchkey } = req.params
      let keyname = `dreamTeam:${matchkey}`


      let dreamEleData = await redisCompletedMatch.getkeydata(keyname);
      // let dreamEleData;
      if (!dreamEleData) {
        const playersData = await matchesModel.aggregate([
          {
            $match: {
              final_status: "winnerdeclared",
              _id: new mongoose.Types.ObjectId(matchkey),
            },
          },
          {
            $project: {
              name: 1,
              matchkey: "$_id",
              _id: 0,
              short_name: 1,
              format: 1,
              team1Id: 1,
              team2Id: 1,
            },
          },
          {
            $lookup: {
              from: "matchplayers",
              localField: "matchkey",
              foreignField: "matchkey",
              pipeline: [
                {
                  $match: {
                    playingstatus: 1,
                  },
                },
                {
                  $addFields: {
                    image: {
                      $concat: [`${global.constant.IMAGE_URL}`, 'avtar1.png']
                    },
                  },
                },
                {
                  $lookup: {
                    from: "teamplayers",
                    localField: "playerid",
                    foreignField: "_id",
                    pipeline: [
                      {
                        $lookup: {
                          from: "teams",
                          localField: "team",
                          foreignField: "_id",
                          as: "teamdata",
                        },
                      },
                    ],
                    as: "teamname",
                  },
                },
              ],
              as: "matchplayer",
            },
          },

          {
            $unwind: {
              path: "$matchplayer",
            },
          },
          {
            $unwind: {
              path: "$matchplayer.teamname",
            },
          },
          {
            $unwind: {
              path: "$matchplayer.teamname.teamdata",
            },
          },
          {
            $addFields: {
              "matchplayer.teamShortName": "$matchplayer.teamname.teamdata.short_name",
              "matchplayer.team": {
                $cond: [
                  { $eq: ["$matchplayer.teamname.teamdata._id", "$team1Id"] },
                  "team1",
                  {
                    $cond: [
                      { $eq: ["$matchplayer.teamname.teamdata._id", "$team2Id"] },
                      "team2",
                      "unknown"
                    ]
                  }
                ]
              }
            },
          },
          {
            $project: {
              "matchplayer.teamname": 0,
            },
          },
          {
            $sort: {
              "matchplayer.points": -1,
            },
          },
          {
            $group: {
              _id: "$matchplayer.role",
              data: {
                $push: "$matchplayer",
              },
              highestPoints: {
                $max: "$matchplayer.points",
              },
            },
          },
          {
            $addFields: {
              top: {
                $reduce: {
                  input: "$data",
                  initialValue: 0,
                  in: {
                    $cond: {
                      if: {
                        $eq: ["$$this.points", "$highestPoints"],
                      },
                      then: "$$this",
                      else: "$$value",
                    },
                  },
                },
              },
            },
          },
          {
            $group: {
              _id: null,
              highest: {
                $push: "$top",
              },
              otherSeven: {
                $push: "$data",
              },
            },
          },
          {
            $unwind: "$otherSeven",
          },
          {
            $unwind: "$otherSeven",
          },
          {
            $set: {
              status: {
                $cond: {
                  if: {
                    $in: ["$otherSeven._id", "$highest._id"],
                  },
                  then: "yes",
                  else: "no",
                },
              },
            },
          },
          {
            $group: {
              _id: "$status",
              top: {
                $first: "$highest",
              },
              otherSeven: {
                $push: {
                  $cond: {
                    if: {
                      $ne: ["$otherSeven._id", "$highest"],
                    },
                    then: "$otherSeven",
                    else: 0,
                  },
                },
              },
            },
          },
          {
            $match: {
              _id: "no",
            },
          },
          {
            $unwind: "$otherSeven",
          },
          {
            $sort: {
              "otherSeven.points": -1,
            },
          },
          {
            $limit: 7,
          },
          {
            $group: {
              _id: null,
              top: {
                $first: "$top",
              },
              otherSeven: {
                $push: "$otherSeven",
              },
            },
          },
          {
            $set: {
              dreamELe: {
                $concatArrays: ["$top", "$otherSeven"],
              },
            },
          },
        ]);

        // console.log(playersData)
        // dreamEleData = playersData
        dreamEleData = playersData[0]?.dreamELe || [];

        const rrrr = await redisCompletedMatch.setkeydata(keyname, dreamEleData, 60 * 60 * 24 * 60);

        // console.log("rrrr", rrrr);
      }
      // console.log("getDatagetData",dreamEleData);
      // let bowler = global.constant.bowler;
      // let keeper = global.constant.keeper;
      // let allrounder = global.constant.allrounder;
      // let batsman = global.constant.batsman;
      // let playersData = [];
      // // console.log(bowler, keeper, allrounder, batsman)
      // for (const iterator of playerdata) {
      //     if (iterator._id == "batsman") {
      //         for (let i = 1; i <= batsman; i++) {
      //             playersData.push(iterator.data[i])
      //             iterator.data.splice(i, 1);
      //         }
      //     }
      //     if (iterator._id == "keeper") {
      //         for (let i = 1; i <= keeper; i++) {
      //             playersData.push(iterator.data[i])
      //             iterator.data.splice(i, 1);
      //         }
      //     }
      //     if (iterator._id == "allrounder") {
      //         for (let i = 1; i <= allrounder; i++) {
      //             playersData.push(iterator.data[i])
      //             iterator.data.splice(i, 1);
      //         }
      //     }
      //     if (iterator._id == "bowler") {
      //         for (let i = 1; i <= bowler; i++) {
      //             playersData.push(iterator.data[i])
      //             iterator.data.splice(i, 1);
      //         }
      //     }
      // }
      // playerdata.sort((a, b) => b.highestPoints - a.highestPoints);
      // playersData.push(playerdata[0].data[0], playerdata[1].data[1], playerdata[2].data[2])
      return {
        message: "Fetch Data Successfully",
        status: true,
        // data: playersData[0].dreamELe,
        data: dreamEleData,

      };
    } catch (error) {
      console.log(error);
    }
  }

  /**
 * Fetches guru teams for a match with Redis caching.
 * 
 * - First checks Redis cache for team data
 * - If not cached, queries DB for match details and team info
 * - Processes player data (roles, images, stats)
 * - Checks if teams are selected for challenges
 * - Caches results in Redis
 * 
 * @param {Object} req - Request with matchkey, user ID
 * @returns {Object} Team data with players, captains, stats
 * @throws {Error} On DB/processing failures
 */
  async fetchGuruTeam(req) {
    try {
      // let sport_category = {
      //   id: 2,
      //   name: "T20",
      //   max_players: 11,
      //   max_credits: 100,
      //   min_players_per_team: 1,
      //   icon: "",
      //   category: "cricket",
      //   player_positions: [
      //     {
      //       id: 9,
      //       sport_category_id: 2,
      //       name: "WK",
      //       full_name: "Wicket-Keepers",
      //       code: "keeper",
      //       icon: "img/wk.png",
      //       min_players_per_team: 1,
      //       max_players_per_team: 8,
      //     },
      //     {
      //       id: 10,
      //       sport_category_id: 2,
      //       name: "BAT",
      //       full_name: "Batsmen",
      //       code: "batsman",
      //       icon: "img/bat.png",
      //       min_players_per_team: 1,
      //       max_players_per_team: 8,
      //     },
      //     {
      //       id: 11,
      //       sport_category_id: 2,
      //       name: "ALL",
      //       full_name: "All-Rounders",
      //       code: "allrounder",
      //       icon: "img/all.png",
      //       min_players_per_team: 1,
      //       max_players_per_team: 8,
      //     },
      //     {
      //       id: 12,
      //       sport_category_id: 2,
      //       name: "BWL",
      //       full_name: "Bowlers",
      //       code: "bowler",
      //       icon: "img/bowler.png",
      //       min_players_per_team: 1,
      //       max_players_per_team: 8,
      //     },
      //   ],
      // };
      // let userGuruTeamData = await userModel.find({ "guruTeamNumber": { gt: 1 } });
      // if (userGuruTeamData.length == 0) {
      //     return {
      //         message: 'Guru Team Not Found !!',
      //         status: false,
      //         data: {}
      //     }
      // }

      // let keyname = `getmyteams-matchkey-${req.query.matchkey}-userid-${req.user._id}`;
      // let redisdata = await redisjoinTeams.getkeydata(keyname);
      let getkeyname = `getmyteams-matchkey-${req.query.matchkey}-userid-${req.user._id}`
      let getGuruTeamFromRedis = await redisjoinTeams.getkeydata(getkeyname);

      if (getGuruTeamFromRedis) {
        // if (false) {
        console.log("data from redis")
        return {
          message: "Team Data",
          status: true,
          data: getGuruTeamFromRedis,
          // sport_category,
        };
      } else {
        console.log("data from database")
        await matchesModel.findOne({
          _id: req.query.matchkey,
        });
        // if (!redisdata || matchstatus.status == "notstarted") {
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

        aggPipe.push(
          {
            $lookup: {
              from: "users",
              localField: "userid",
              foreignField: "_id",
              as: "userdata",
            },
          },
          {
            $unwind: {
              path: "$userdata",
            },
          },
          {
            $addFields: {
              guruTeamNumber: "$userdata.guruTeamNumber",
              teamteam: "$userdata.team",
              image: "$userdata.image",
            },
          },
          {
            $match: {
              guruTeamNumber: {
                $gt: 0,
              },
            },
          },
          {
            $lookup: {
              from: "userteam",
              localField: "_id",
              foreignField: "guruTeamId",
              as: "result"
            }
          },

          {
            $lookup: {
              from: "userteam",
              localField: "_id",
              foreignField: "guruTeamId",
              as: "result"
            }
          },
          {
            $addFields: {
              count_copied: { $size: "$result" }
            }
          },
          {
            $match: {
              matchkey: mongoose.Types.ObjectId(req.query.matchkey),
            },
          }
        );

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
                    points: "$point",
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
                    _id: new mongoose.Types.ObjectId(req.query.matchkey),
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
                    _id: new mongoose.Types.ObjectId(req.query.matchkey),
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
            $sort: {
              count_copied: -1,
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
            $addFields: {
              "data.guruTeamId": "$guruTeamId"
            }
          },
          {
            $replaceRoot: {
              newRoot: "$data",
            },
          },
          {
            $sort: {
              createdAt: 1,
            },
          },
          {
            $group: {
              _id: "$userid",
              docs: {
                $push: "$$ROOT",
              },
              guruTeamNumber: {
                $first: "$guruTeamNumber",
              },
            },
          },
          // {
          //   $project: {
          //     docs: {
          //       $slice: ["$docs", "$guruTeamNumber"],
          //     },
          //   },
          // },
          // {
          //   $unwind: {
          //     path: "$docs",
          //   },
          // },
          // {
          //   $replaceRoot: {
          //     newRoot: "$docs",
          //   },
          // }
          {
            $project: {
              docs: {
                $filter: {
                  input: "$docs",
                  as: "doc",
                  cond: {
                    $in: ["$$doc.teamnumber", "$guruTeamNumber"]
                  }
                }
              }
            }
          },
          {
            $unwind: "$docs"
          },
          {
            $replaceRoot: {
              newRoot: "$docs"
            }
          }
        );

        const createTeams = await userTeamModel.aggregate(aggPipe);
        // console.log(createTeams,"createTeams")
        if (createTeams.length == 0) {
          return {
            message: "Teams Not Available",
            status: false,
            data: [],
          };
        }
        // if (createTeams.length > 0) {
        //   const guruTeamIds = createTeams.map(team => team.guruTeamId).filter(id => id);

        //   if (guruTeamIds.length > 0) {
        //     await userTeamModel.updateMany(
        //       {
        //         _id: { $in: guruTeamIds },
        //         matchkey: mongoose.Types.ObjectId(req.query.matchkey)
        //       },
        //       {
        //         $inc: { count_copied: 1 }
        //       }
        //     );
        //   }
        // }
        if (createTeams.length > 0) {
          for (let team of createTeams) {

            if (team.guruTeamId) {
              await userTeamModel.updateOne(
                {
                  _id: team.guruTeamId,
                  matchkey: new mongoose.Types.ObjectId(req.query.matchkey)
                },
                { $inc: { count_copied: 1 } }
              );
            }
          }
        }

        let [matchchallenges, total_teams, count_JoinContest] =
          await Promise.all([
            matchchallengesModel.find({
              matchkey: new mongoose.Types.ObjectId(req.query.matchkey),
              status: "opened",
            }),
            userTeamModel.countDocuments({
              userid: req.user._id,
              matchkey: req.query.matchkey,
            }),
            this.getJoinleague(req.user._id, req.query.matchkey),
          ]);

        let i = 0;
        for (let element of createTeams) {
          i++;
          for (let p of element.players) {
            let im;
            if (
              p.id &&
              p.playerimg != "" &&
              p.playerimg != null &&
              p.playerimg != undefined
            ) {
              if (
                p.playerimg.startsWith("/p") ||
                element.captain.image.startsWith("p")
              ) {
                im = `${global.constant.IMAGE_URL}${p.playerimg}`;
              } else {
                im = p.playerimg;
              }
            } else {
              // Capimage = `${global.constant.IMAGE_URL}avtar1.png`;
              if (team1Id._id.toString() == p.team.toString()) {
                im = `${global.constant.IMAGE_URL}white_team1.png`;
              } else {
                im = `${global.constant.IMAGE_URL}black_team1.png`;
              }
            }
            p.playerimg = im;
          }
          let Capimage, viceCapimage;
          // ----Inserting Captian image ---------
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
            count_copied: element.count_copied,
            team1_name: team1Id.short_name,
            team2_name: team2Id.short_name,
            player_type: global.constant.PLAYER_TYPE.CLASSIC,
            captain: element.captain.playerid
              ? element.captain.playerid.player_name
              : "",
            vicecaptain: element.vicecaptain.playerid
              ? element.vicecaptain.playerid.player_name
              : "",
            captainimage: Capimage,
            vicecaptainimage: viceCapimage,
            captainimage1: "",
            vicecaptainimage1: "",
            isSelected: false,
          };

          if (matchchallenges.length != 0 && req.query.matchchallengeid) {
            for await (const challenges of matchchallenges) {
              if (
                challenges._id.toString() ==
                req.query.matchchallengeid.toString()
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
          let team1count = 0,
            team2count = 0,
            batsCount = 0,
            blowCount = 0,
            wicketKeeperCount = 0,
            allCount = 0;
          // const players = [];S
          let totalPoints = 0;

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
          tempObj["guruTeamNumber"] = element.guruTeamNumber;
          tempObj["team"] = element.teamteam;
          tempObj["userImage"] = element.image;
          tempObj["player"] = element.players;
          tempObj['count_copied'] = element.count_copied;

          finalData.push(tempObj);

          if (i == createTeams.length) {
            // redis
            let keyname = `getmyteams-matchkey-${req.query.matchkey}-userid-${req.user._id}`;
            // 
            // let redisdata=await redisjoinTeams.getkeydata(keyname);
            // let filterData;
            // if(redisdata)
            // {
            //     filterData=redisdata;
            // }
            // else
            // {
            // filterData = await matchPlayersModel.findOne({ playerid: playerData._id, matchkey: req.query.matchkey });
            // var expRedisTime = await matchTimeDifference(req.query.matchkey);
            let expRedisTime = 60; // expire time in seconds (1 minute)

            let redisdata = redisjoinTeams.setkeydata(keyname, finalData, expRedisTime);
            redisLiveJoinTeams.setkeydata(keyname, finalData, expRedisTime);
            //}
            let newData = [];
            // for (const finalTeamData of finalData) {
            //     // console.log("data>>>>>>>>>>>>>>>>", finalTeamData, "data>>>>>>>>>>>>>>>>")

            // }
            // console.log(finalData.length, '>>>>>>>>>>>>>>>>>>>>>>')
            // redis end
            return {
              message: "Team Data",
              status: true,
              data: finalData,
              // sport_category,
            };
          }
        }
      }
      // return {
      //     message: 'Team Data',
      //     status: true,
      //     data: createTeams
      // }
      // } else {
      //   let keyname = `getmyteams-matchkey-${req.query.matchkey}-userid-${req.user._id}`;
      //   let redisdata = await redisjoinTeams.getkeydata(keyname);
      //   let finalData;
      //   if (redisdata) {
      //     finalData = redisdata;

      //     return {
      //       message: "Team Data",
      //       status: true,
      //       data: finalData,
      //       // sport_category,
      //     };
      //   }
      // }
    } catch (error) {
      console.log(error)
      throw error;
    }
  }


  async getPlayerPoints(matchkey) {
    console.log('matchkey', matchkey);
    let pipe = [
      {
        $match: {
          matchkey: mongoose.Types.ObjectId(matchkey)
        }
      },
      {
        $project: {
          _id: 1,
          total: 1,
          player_id: 1
        }
      },
      {
        $addFields: {
          playerid: {
            $toString: "$player_id"
          }
        }
      },
      {
        $group: {
          _id: null,
          result: {
            $push: {
              k: "$playerid",
              v: "$total"
            }
          }
        }
      },
      {
        $replaceRoot: {
          newRoot: {
            $arrayToObject: "$result"
          }
        }
      }
    ]
    const getResultPointData = await resultPoint.aggregate(pipe);
    let bulkUpdateOperations = [];

    if (getResultPointData?.length) {
      const keyResultName = `resultPoint-${matchkey}`;
      await redisjoinTeams.setkeydata(keyResultName, getResultPointData, 60 * 60 * 24);
      return getResultPointData;
    }
    return false
  }

  async getUserContestTeamCount(req) {
    try {
      const keynameExpMatch = `listMatchesModel-${req.query.matchkey}`;
      const matchDataForExpire = await redisjoinTeams.getkeydata(keynameExpMatch);

      if (!matchDataForExpire || !matchDataForExpire.start_date) {
        return { message: "Match Started No Challenge Available", status: true, data: [] };
      }

      const keyUserJoinedChallenge = `match:${req.query.matchkey}:user:${req.user._id}:joinedContests`;
      let userContest = await redisLeaderboard.getMyLeaderBoard(keyUserJoinedChallenge, req.user._id, "contest");
      const redisKey = `match:${req.query.matchkey}:user:${req.user._id}:teams`;
      let existingTeams = await redisjoinTeams.getkeydata(redisKey) || [];
      if (!existingTeams.length) existingTeams = [];
      return {
        message: "Get contest and team count", status: true, data:
        {
          total_joinedcontest: userContest?.length || 0,
          total_teams: existingTeams?.length || 0
        }
      };
    } catch (error) {
      console.log(error);
    }
  }
}

module.exports = new matchServices();
