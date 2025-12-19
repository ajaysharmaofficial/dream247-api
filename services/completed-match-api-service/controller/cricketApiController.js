const { default: axios } = require("axios");
const mongoose = require("mongoose");
const listMatchModel = require("../../models/matchesModel");
const teamModel = require("../../models/teamModel");
const seriesModel = require("../../models/matchSeriesModel");
const playersModel = require("../../models/teamPlayerModel");
const matchPlayersModel = require("../../models/matchPlayersModel");
const moment = require("moment");
const Redis = require("../../utils/redis");
const { uploadPlayers } = require("../../utils/s3");
const download = require("image-downloader");
const appSettings = require("../../models/configModel");

const path = require('path');
const fs = require('fs');

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const s3 = new S3Client({
  region: global.constant.REGION,
  credentials: {
    accessKeyId: global.constant.AWS_ACCESS_KEY_ID,
    secretAccessKey: global.constant.AWS_SECRET_ACCESS_KEY,
  },
});

const tempDir = path.join(__dirname, "temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}
async function downloadAndUploadToS3(url, folder) {
  if (!url) {
    console.error("Image URL is missing, cannot download.");
    return null; // Return null if URL is missing
  }

  const localFilePath = path.join(tempDir, `${Date.now()}-${path.basename(url)}`);
  const options = { url: url, dest: localFilePath };

  try {
    const { filename } = await download.image(options);
    const fileStream = fs.createReadStream(filename);

    const s3Key = `${folder}/${path.basename(filename)}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: global.constant.BUCKET_NAME,
        Key: s3Key,
        Body: fileStream,
        ContentType: "image/jpeg", // Adjust based on image type if needed
      })
    );

    fileStream.close();
    fs.unlinkSync(filename); // Delete local file after upload

    return s3Key; // Return S3 path for database
  } catch (error) {
    console.error("Error uploading image to S3:", error);
    return url; // Fallback to original URL if upload fails
  }
}

const status = {
  1: "notstarted",
  2: "completed",
  3: "started",
  4: "completed",
};
const format = {
  1: "one-day",
  2: "test",
  3: "t20",
  4: "one-day",
  5: "test",
  6: "t20",
  7: "one-day",
  8: "t20",
  9: "one-day",
  10: "t20",
  17: "t10",
  18: "the-hundred",
  19: "the-hundred",
};
const toss_decision = {
  0: null,
  1: "batting",
  2: "bowling",
};
const role = {
  bowl: "bowler",
  bat: "batsman",
  all: "allrounder",
  wk: "keeper",
  wkbat: "keeper",
  cap: "allrounder",
  squad: "allrounder",
};

async function getCricketAPIToken() {
  try {
    const cricketToken = await appSettings.findOne(
      { _id: new mongoose.Types.ObjectId('667e5cf5cf5d2cc4d3353ecc') },
      { token: 1 }
    );

    if (cricketToken?.token) {
      return cricketToken.token;
    }

    return null;
  } catch (error) {
    console.error("Error fetching cricket API token:", error);
  }
}


class cricketApiController {
  constructor() {
    return {
      listOfMatches: this.listOfMatches.bind(this),
      listOfMatches_entity: this.listOfMatches_entity.bind(this),
      fetchPlayerByMatch_entity: this.fetchPlayerByMatch_entity.bind(this),
      getmatchscore: this.getmatchscore.bind(this),
      fetchPlayerByMatch_entity_seriesbymatch:
        this.fetchPlayerByMatch_entity_seriesbymatch.bind(this),
      //child_fetchPlayerByMatch_entity: this.child_fetchPlayerByMatch_entity.bind(this)
      overData: this.overData.bind(this),
      fetchPlayerByMatch_entity_Upcoming_Matches: this.fetchPlayerByMatch_entity_Upcoming_Matches.bind(this),
      importExtraPlayers: this.importExtraPlayers.bind(this)
    };
  }
  async listOfMatches(req, res) {
    try {
      let cricketToken = await getCricketAPIToken();
      console.log("cricketToken", cricketToken);
      let url = `https://rest.entitysport.com/v2/matches/?status=1&token=${cricketToken}&per_page=70&&paged=1`;
      axios.get(url).then(async (result) => {
        // this.newMethod(result);
      });
      res.send({ success: true });
    } catch (error) {
      console.log(error);
      req.flash("error", "something is wrong please try again letter");
      res.redirect("/");
    }
  }

  newMethod(result) {
    for (let obkey1 of Object.values(result.data)) {
      obkey1.matches.flatMap(async (Obj) => {
        // console.log("x..........",Obj)
        const checkMatchkey = await listMatchModel.find({
          real_matchkey: Obj.matchkey,
        });
        let cricketToken = await getCricketAPIToken();
        // console.log("cricketToken", cricketToken);
        if (checkMatchkey.length == 0) {
          let url = `http://rest.entitysport.com/v2/matches/${Obj.matchkey}/info?token=${cricketToken}`;
          await axios.get(url).then(async (matchData) => {
            let matchDATA = JSON.parse(matchData.data.matchdata);
            // console.log("matchDATA----->", matchDATA);
            if (matchDATA) {
              if (
                moment(
                  moment(matchDATA.data.card.start_date.iso).format()
                ).isAfter(moment().format())
              ) {
                let insertTeam1 = new teamModel({
                  fantasy_type: "Cricket",
                  teamName: matchDATA.data.card.teams.a.name,
                  team_key: matchDATA.data.card.teams.a.key,
                  short_name: matchDATA.data.card.teams.a.short_name,
                });
                let temaData1 = await insertTeam1.save();
                let insertTeam2 = new teamModel({
                  fantasy_type: "Cricket",
                  teamName: matchDATA.data.card.teams.b.name,
                  team_key: matchDATA.data.card.teams.b.key,
                  short_name: matchDATA.data.card.teams.a.short_name,
                });
                let temaData2 = await insertTeam2.save();

                let insertListmatch = new listMatchModel({
                  fantasy_type: "Cricket",
                  name: matchDATA.data.card.name,
                  team1Id: temaData1._id,
                  team2Id: temaData2._id,
                  real_matchkey: matchDATA.data.card.key,
                  start_date: moment(matchDATA.data.card.start_date.iso).format(
                    "YYYY-MM-DD hh:mm:ss"
                  ),
                  status: matchDATA.data.card.status,
                  format: matchDATA.data.card.format,
                  launch_status: "pending",
                  final_status: "pending",
                  status_overview: matchDATA.data.card.status_overview,
                });
                let insertMatchList = await insertListmatch.save();
              }
            }
          });
        } else {
          let url = `http://rest.entitysport.com/v2/matches/${Obj.matchkey}/info?token=${cricketToken}`;
          await axios.get(url).then(async (matchData) => {
            let matchDATA = JSON.parse(matchData.data.matchdata);
            // console.log("matchDATA----->", matchDATA);
            if (matchDATA) {
              if (
                moment(
                  moment(matchDATA.data.card.start_date.iso).format()
                ).isAfter(moment().format())
              ) {
                let insertTeam1 = new teamModel({
                  fantasy_type: "Cricket",
                  teamName: matchDATA.data.card.teams.a.name,
                  team_key: matchDATA.data.card.teams.a.key,
                  short_name: matchDATA.data.card.teams.a.short_name,
                });
                let temaData1 = await insertTeam1.save();
                let insertTeam2 = new teamModel({
                  fantasy_type: "Cricket",
                  teamName: matchDATA.data.card.teams.b.name,
                  team_key: matchDATA.data.card.teams.b.key,
                  short_name: matchDATA.data.card.teams.a.short_name,
                });
                let temaData2 = await insertTeam2.save();
                const updateListMatch = await listMatchModel.findOneAndUpdate(
                  { real_matchkey: matchDATA.data.card.key },
                  {
                    $set: {
                      name: matchDATA.data.card.name,
                      team1Id: temaData1._id,
                      team2Id: temaData2._id,
                      start_date: moment(
                        matchDATA.data.card.start_date.iso
                      ).format("YYYY-MM-DD HH:mm:ss"),
                      status: matchDATA.data.card.status,
                      format: matchDATA.data.card.format,
                      status_overview: matchDATA.data.card.status_overview,
                    },
                  }
                );
              }
            }
          });
        }
      });
    }
  }
  async listOfMatches_entity(req, res) {
    try {
      let pageno = 1;
      let cricketToken = await getCricketAPIToken();
      // console.log("cricketToken", cricketToken);
      let url = `https://rest.entitysport.com/v2/matches/?status=1&token=${cricketToken}&per_page=70&&paged=1`;
      axios.get(url).then(async (matchData) => {
        // console.log('matchData.response-->',matchData.data.response)
        await this.child_listOfMatches_entity(matchData.data.response.items);
        res.redirect("/view_AllUpcomingMatches");
      });
    } catch (error) {
      console.log("error", error);
      next(error);
    }
  }

  //import match, series and teams
  async child_listOfMatches_entity(items) {
    for (let mymatch of items) {
      // let mymatch= JSON.parse(match.matchdata);
      const checkMatchkey = await listMatchModel.find({
        real_matchkey: mymatch.match_id,
      });
      if (checkMatchkey.length == 0) {
        if (
          moment(moment(mymatch.date_start_ist).format()).isAfter(
            moment().format()
          )
        ) {
          let temaData1, temaData2, series;
          if (await teamModel.findOne({ team_key: mymatch.teama.team_id })) {
            temaData1 = await teamModel.findOneAndUpdate(
              { team_key: mymatch.teama.team_id },
              {
                $set: {
                  teamName: mymatch.teama.name,
                  short_name: mymatch.teama.short_name,
                },
              },
              { new: true }
            );
          } else {
            let insertTeam1 = new teamModel({
              fantasy_type: "Cricket",
              teamName: mymatch.teama.name,
              team_key: mymatch.teama.team_id,
              short_name: mymatch.teama.short_name,
            });
            temaData1 = await insertTeam1.save();
          }

          if (await teamModel.findOne({ team_key: mymatch.teamb.team_id })) {
            temaData2 = await teamModel.findOneAndUpdate(
              { team_key: mymatch.teamb.team_id },
              {
                $set: {
                  teamName: mymatch.teamb.name,
                  short_name: mymatch.teamb.short_name,
                },
              },
              { new: true }
            );
          } else {
            let insertTeam2 = new teamModel({
              fantasy_type: "Cricket",
              teamName: mymatch.teamb.name,
              team_key: mymatch.teamb.team_id,
              short_name: mymatch.teamb.short_name,
            });
            temaData2 = await insertTeam2.save();
          }
          //import series
          if (
            await seriesModel.findOne({ series_key: mymatch.competition.cid })
          ) {
            series = await seriesModel.findOneAndUpdate(
              { series_key: mymatch.competition.cid },
              {
                $set: {
                  name: mymatch.competition.title,
                  status: "opened",
                  start_date: `${mymatch.competition.datestart} 00:00:00`,
                  end_date: `${mymatch.competition.dateend} 23:59:59`,
                },
              },
              { new: true }
            );
          } else {
            let seriesData = new seriesModel({
              fantasy_type: "Cricket",
              name: mymatch.competition.title,
              series_key: mymatch.competition.cid,
              status: "opened",
              start_date: `${mymatch.competition.datestart} 00:00:00`,
              end_date: `${mymatch.competition.dateend} 23:59:59`,
            });
            series = await seriesData.save();
          }
          let insertListmatch = new listMatchModel({
            fantasy_type: "Cricket",
            name: mymatch.title,
            short_name: mymatch.short_title,
            team1Id: temaData1._id,
            team2Id: temaData2._id,
            series: series._id,
            real_matchkey: mymatch.match_id,
            start_date: mymatch.date_start_ist,
            status: status[mymatch.status],
            format: format[mymatch.format],
            launch_status: "pending",
            final_status: "pending",
            tosswinner_team:
              mymatch.toss.winner != 0 ? mymatch.toss.winner : '',
            toss_decision: toss_decision[mymatch.toss.decision],
          });
          let insertMatchList = await insertListmatch.save();
        }
      } else {
        if (
          moment(moment(mymatch.date_start_ist).format()).isAfter(
            moment().format()
          )
        ) {
          let temaData1, temaData2, series;
          let getTeam1 = await teamModel.findOne({
            team_key: mymatch.teama.team_id,
          });

          // if (getTeam1) {
          //   const options = {
          //     url: mymatch.teama.logo_url,
          //     dest: `${global.constant.IMAGE_URL}teams`, // will be saved to /path/to/dest/image.jpg
          //   };
          //   let getImage;
          //   let path;
          //   let logoImage;
          //   if (options.url) {
          //     getImage = await download.image(options);
          //     path = getImage.filename.split("/").pop();
          //     path = path.split("\\").pop();
          //     logoImage = `teams/${path}`;
          //   } else {
          //     logoImage = mymatch.teama.logo_url;
          //   }

          //   temaData1 = await teamModel.findOneAndUpdate(
          //     { team_key: mymatch.teama.team_id },
          //     {
          //       $set: {
          //         teamName: mymatch.teama.name,
          //         short_name: mymatch.teama.short_name,
          //         logo: logoImage,
          //       },
          //     },
          //     { new: true }
          //   );
          // } else {
          //   const options = {
          //     url: mymatch.teama.logo_url,
          //     dest: `${global.constant.IMAGE_URL}teams`, // will be saved to /path/to/dest/image.jpg
          //   };
          //   let getImage;
          //   let path;
          //   let logoImage;
          //   if (options.url) {
          //     getImage = await download.image(options);
          //     path = getImage.filename.split("/").pop();
          //     path = path.split("\\").pop();
          //     logoImage = `teams/${path}`;
          //   } else {
          //     logoImage = mymatch.teama.logo_url;
          //   }
          //   let insertTeam1 = new teamModel({
          //     fantasy_type: "Cricket",
          //     teamName: mymatch.teama.name,
          //     team_key: mymatch.teama.team_id,
          //     short_name: mymatch.teama.short_name,
          //     logo: logoImage,
          //   });
          //   temaData1 = await insertTeam1.save();
          // }
          // let getTeam2 = await teamModel.findOne({
          //   team_key: mymatch.teamb.team_id,
          // });

          // if (getTeam2) {
          //   const options2 = {
          //     url: mymatch.teamb.logo_url,
          //     dest: `${global.constant.IMAGE_URL}teams`, // will be saved to /path/to/dest/image.jpg
          //   };

          //   let getImage;
          //   let path;
          //   let logoImage2;

          //   if (options2.url) {
          //     getImage = await download.image(options2);
          //     path = getImage.filename.split("/").pop();
          //     path = path.split("\\").pop();
          //     logoImage2 = `teams/${path}`;
          //   } else {
          //     logoImage2 = mymatch.teamb.logo_url;
          //   }

          //   temaData2 = await teamModel.findOneAndUpdate(
          //     { team_key: mymatch.teamb.team_id },
          //     {
          //       $set: {
          //         teamName: mymatch.teamb.name,
          //         short_name: mymatch.teamb.short_name,
          //         logo: logoImage2,
          //       },
          //     },
          //     { new: true }
          //   );
          // } else {
          //   const options2 = {
          //     url: mymatch.teamb.logo_url,
          //     dest: `${global.constant.IMAGE_URL}teams`, // will be saved to /path/to/dest/image.jpg
          //   };

          //   let getImage;
          //   let path;
          //   let logoImage2;

          //   if (options2.url) {
          //     getImage = await download.image(options2);
          //     path = getImage.filename.split("/").pop();
          //     path = path.split("\\").pop();
          //     logoImage2 = `teams/${path}`;
          //   } else {
          //     logoImage2 = mymatch.teamb.logo_url;
          //   }

          //   let insertTeam2 = new teamModel({
          //     fantasy_type: "Cricket",
          //     teamName: mymatch.teamb.name,
          //     team_key: mymatch.teamb.team_id,
          //     short_name: mymatch.teamb.short_name,
          //     logo: logoImage2,
          //   });
          //   temaData2 = await insertTeam2.save();
          // }

          if (getTeam1) {
            const logoImage = await downloadAndUploadToS3(mymatch.teama.logo_url, "teams");

            temaData1 = await teamModel.findOneAndUpdate(
              { team_key: mymatch.teama.team_id },
              {
                $set: {
                  teamName: mymatch.teama.name,
                  short_name: mymatch.teama.short_name,
                  logo: logoImage,
                },
              },
              { new: true }
            );
          } else {
            const logoImage = await downloadAndUploadToS3(mymatch.teama.logo_url, "teams");

            let insertTeam1 = new teamModel({
              fantasy_type: "Cricket",
              teamName: mymatch.teama.name,
              team_key: mymatch.teama.team_id,
              short_name: mymatch.teama.short_name,
              logo: logoImage,
            });
            temaData1 = await insertTeam1.save();
          }

          let getTeam2 = await teamModel.findOne({
            team_key: mymatch.teamb.team_id,
          });

          if (getTeam2) {
            const logoImage2 = await downloadAndUploadToS3(mymatch.teamb.logo_url, "teams");

            temaData2 = await teamModel.findOneAndUpdate(
              { team_key: mymatch.teamb.team_id },
              {
                $set: {
                  teamName: mymatch.teamb.name,
                  short_name: mymatch.teamb.short_name,
                  logo: logoImage2,
                },
              },
              { new: true }
            );
          } else {
            const logoImage2 = await downloadAndUploadToS3(mymatch.teamb.logo_url, "teams");

            let insertTeam2 = new teamModel({
              fantasy_type: "Cricket",
              teamName: mymatch.teamb.name,
              team_key: mymatch.teamb.team_id,
              short_name: mymatch.teamb.short_name,
              logo: logoImage2,
            });
            temaData2 = await insertTeam2.save();
          }

          if (
            await seriesModel.findOne({ series_key: mymatch.competition.cid })
          ) {
            series = await seriesModel.findOneAndUpdate(
              { series_key: mymatch.competition.cid },
              {
                $set: {
                  name: mymatch.competition.title,
                  status: "opened",
                  start_date: `${mymatch.competition.datestart} 00:00:00`,
                  end_date: `${mymatch.competition.dateend} 23:59:59`,
                },
              },
              { new: true }
            );
          } else {
            let seriesData = new seriesModel({
              fantasy_type: "Cricket",
              name: mymatch.competition.title,
              series_key: mymatch.competition.cid,
              status: "opened",
              start_date: `${mymatch.competition.datestart} 00:00:00`,
              end_date: `${mymatch.competition.dateend} 23:59:59`,
            });
            series = await seriesData.save();
          }
          const updateListMatch = await listMatchModel.findOneAndUpdate(
            { real_matchkey: mymatch.match_id },
            {
              $set: {
                name: mymatch.title,
                short_name: mymatch.short_title,
                team1Id: temaData1._id,
                team2Id: temaData2._id,
                series: series._id,
                real_matchkey: mymatch.match_id,
                start_date: mymatch.date_start_ist,
                tosswinner_team:
                  mymatch.toss.winner != 0 ? mymatch.toss.winner : null,
                toss_decision: toss_decision[mymatch.toss.decision],
              },
            },
            { new: true }
          );
        }
      }
    }
  }

  async fetchPlayerByMatch_entity_Upcoming_Matches(req, res) {
    try {
      // console.log("req.params.matchkey",req.params.matchkey);
      const fantasyTypeMOdel = require("../../models/fantasyModels.js");
      const getSportName = await fantasyTypeMOdel.findOne(
        { status: "enable" },
        { fantasyName: 1 }
      );
      req.query.fantasy_type = getSportName.fantasyName;
      let cricketToken = await getCricketAPIToken();
      // console.log("cricketToken", cricketToken);
      axios
        .get(
          `https://rest.entitysport.com/v2/competitions/${req.query.seriesKey}/squads/${req.params.matchkey}?token=${cricketToken}`
        )
        .then(async (matchData) => {
          if (matchData.data) {
            let listmatch = await listMatchModel.findOne({
              real_matchkey: req.params.matchkey,
              fantasy_type: req.query.fantasy_type,
            });

            await this.child_fetchPlayerByMatch_entity(
              matchData.data,
              listmatch._id,
              req.params.matchkey,
              listmatch
            );
            res.redirect(`/view_AllUpcomingMatches`);
          }
        });
      // axios
      //   .get(
      //     `http://rest.entitysport.com/v2/matches/${req.params.matchkey}/squads?token=1&token=0930876c70b22c531c1e27d6bf2bd8a5`
      //   )
      //   .then(async (matchData) => {
      //     // fs.writeFileSync('matchPlayers.json', JSON.stringify(matchData.data, null, 2), 'utf-8');
      //     if (matchData.data) {
      //       let listmatch = await listMatchModel.findOne({
      //         real_matchkey: req.params.matchkey,
      //         fantasy_type: req.query.fantasy_type,
      //       });

      //       await this.child_fetchPlayerByMatch_entity(
      //         matchData.data,
      //         listmatch._id,
      //         req.params.matchkey
      //       );
      //       res.redirect(`/view_AllUpcomingMatches`);
      //     }
      //   });
    } catch (error) {
      console.log(error);
    }
  }

  async fetchPlayerByMatch_entity(req, res) {
    try {
      // console.log("req.params.matchkey",req.params.matchkey);
      const fantasyTypeMOdel = require("../../models/fantasyModels.js");
      const getSportName = await fantasyTypeMOdel.findOne(
        { status: "enable" },
        { fantasyName: 1 }
      );
      req.query.fantasy_type = getSportName.fantasyName;
      let cricketToken = await getCricketAPIToken();
      console.log("cricketToken", cricketToken);
      axios
        .get(
          `http://rest.entitysport.com/v2/matches/${req.params.matchkey}/squads?token=1&token=${cricketToken}`
        )
        .then(async (matchData) => {
          // fs.writeFileSync('matchPlayers.json', JSON.stringify(matchData.data, null, 2), 'utf-8');
          if (matchData.data) {
            let listmatch = await listMatchModel.findOne({
              real_matchkey: req.params.matchkey,
              fantasy_type: req.query.fantasy_type,
            });

            await this.child_fetchPlayerByMatch_entity(
              matchData.data,
              listmatch._id,
              req.params.matchkey
            );
            res.redirect(`/launch-match/${listmatch._id}`);
          }
        });
    } catch (error) {
      console.log(error);
    }
  }
  async fetchPlayerByMatch_entity_seriesbymatch(req, realMatchKey) {
    try {
      // console.log('realMatchKey', realMatchKey);
      const fantasyTypeMOdel = require("../../models/fantasyModels.js");
      const getSportName = await fantasyTypeMOdel.findOne(
        { status: "enable" },
        { fantasyName: 1 }
      );
      req.query.fantasy_type = getSportName.fantasyName;
      let cricketToken = await getCricketAPIToken();
      console.log("cricketToken", cricketToken);
      axios
        .get(
          `http://rest.entitysport.com/v2/matches/${realMatchKey}/squads?token=1&token=${cricketToken}`
        )
        .then(async (matchData) => {
          // console.log("------------matchData---------------", matchData);
          // fs.writeFileSync('matchPlayers.json', JSON.stringify(matchData.data, null, 2), 'utf-8');
          if (matchData.data) {

            let listmatch = await listMatchModel.findOne({
              real_matchkey: realMatchKey,
              fantasy_type: req.query.fantasy_type,
            });
            // console.log(realMatchKey, '>>>>>>>>>>>>>>>>>>>>1234567890');
            // console.log('req 2222222>>>>>>>>', realMatchKey);
            const response = await this.child_fetchPlayerByMatch_entity(
              matchData.data,
              listmatch._id,
              realMatchKey
            );

            console.log("-----------responseresponse------------", response);

            if (!response) {
              return {
                message: `players not imported`,
                status: false,
              };
            }
            return {
              message: `player import`,
              status: true,
            };
          }
        });
    } catch (error) {
      console.log(error);
    }
  }

  async child_fetchPlayerByMatch_entity(myresponse, matchkey, real_matchkey, listmatch, type = null) {
    let response = myresponse.response;
    console.log('response?.squads', response?.squads);
    if (response?.squads.length > 0) {
      let playersData = [];
      for (let squad of response.squads) {
        let playersData11 = await this.importPlayer(squad.team_id, squad, matchkey, squad.team, listmatch, type);
        playersData = playersData.concat(playersData11);
      }
      const keyName = `playerList-matchkey-${listmatch.real_matchkey}`;
      await Redis.setkeydata(keyName, playersData, 60 * 60 * 48);
      // console.log('playersData', JSON.stringify(playersData));
      if (type == null) {
        let filePath = `playserList-${listmatch.real_matchkey}.json`
        fs.writeFileSync(`${filePath}`, JSON.stringify(playersData, null, 2), 'utf-8');
        // console.log("playersData:", JSON.stringify(playersData));
        await uploadPlayers(`./${filePath}`, `matchPlayer/${filePath}`);
      }
    }

    return true;
  }

  async importPlayer(teamId, squad, matchkey, team, listmatch, type) {
    const { players: allPlayers, last_match_played: lastMatchPlayed } = squad;

    let playersData = [];
    const teamData = await teamModel.findOne({ team_key: teamId });
    if (!teamData) {
      console.error(`Team with team_key ${teamId} not found`);
      return false;
    }

    for (const player of allPlayers) {
      if (!player.title) continue; // Skip players with no name

      // const playerInfo = allPlayers.find((item) => item.pid === player.pid);
      const lastMatchInfo = lastMatchPlayed.find((item) => Number(item.player_id) === player.pid);
      const checkPlayersKey = allPlayers.find(
        (o) => o.pid === Number(player.pid) && o.playing_role !== undefined
      );

      const playerRole =
        checkPlayersKey && role[checkPlayersKey.playing_role]
          ? role[checkPlayersKey.playing_role]
          : "allrounder";

      const insertPlayer = await playersModel.findOneAndUpdate(
        { players_key: player.pid, team: teamData._id },
        {
          $set: {
            fantasy_type: "Cricket",
            player_name: player.title,
            players_key: player.pid,
            credit: player?.fantasy_player_rating || 9,
            team: teamData._id,
            role: playerRole,
            fullname: player.title,
          },
        },
        { upsert: true, new: true }
      );
      if (insertPlayer) {
        let obj = {
          matchkey,
          playerid: insertPlayer._id,
          credit: insertPlayer.credit,
          name: player.title,
          role: playerRole,
          legal_name: player.title,
          fantasy_total_points: player.fantasy_total_points,
          lastMatchPlayed: !!lastMatchInfo,
        }
        // console.log('response?.obj', obj);
        const matchPlayerData = await matchPlayersModel.findOneAndUpdate(
          {
            matchkey,
            playerid: insertPlayer._id,
          },
          obj,
          { upsert: true, new: true }
        );
        let team = 'team1'
        if (teamData._id.toString() === listmatch.team2Id.toString()) {
          team = 'team2'
        }
        let matchPlayers = {
          "captain_selection_percentage": 0,
          "credit": 8.5,
          "name": player.title,
          "playingstatus": matchPlayerData.playingstatus,
          "points": 0,
          "role": playerRole,
          "totalSelected": 0,
          "vice_captain_selection_percentage": 0,
          "vplaying": 0,
          "captainSelected": 0,
          "vicecaptainSelected": 0,
          "playerid": insertPlayer._id,
          "p_id": matchPlayerData._id,
          "lastMatchPlayed": matchPlayerData.lastMatchPlayed,
          "players_key": player.pid,
          "image": insertPlayer?.image || `${global.constant.IMAGE_URL}avtar1.png`,
          "teamName": teamData.teamName,
          "teamid": teamData._id,
          "teamcolor": teamData.teamColor,
          "team_logo": teamData?.logo || `${process.env.IMAGE_URL}avtar1.png`,
          "team_short_name": teamData.short_name,
          "totalpoints": `${player.fantasy_total_points}`,
          "team": team,
          "player_selection_percentage": 0,
          "isSelectedPlayer": false
        }
        playersData.push(matchPlayers);

        // Cache the player data in Redis
        const keyName = `matchkey-${matchkey}-playerid-${insertPlayer._id}`;
        await Redis.setkeydata(keyName, matchPlayerData, 60 * 60 * 48);
      }
    }

    return playersData;
  }
  async getmatchscore(real_matchkey) {
    try {
      let cricketToken = await getCricketAPIToken();
      console.log("cricketToken", cricketToken);
      let matchData = await axios.get(
        `http://rest.entitysport.com/v2/matches/${real_matchkey}/scorecard?token=1&token=${cricketToken}`
      );
      return matchData.data.response;
    } catch (error) {
      console.log(error);
    }
  }
  async overData(real_matchkey, inning) {
    try {
      let cricketToken = await getCricketAPIToken();
      console.log("cricketToken", cricketToken);
      let matchData = await axios.get(
        `https://rest.entitysport.com/v2/matches/${real_matchkey}/innings/${inning}/commentary?token=${cricketToken}`
      );
      // let matchData = await axios.get(
      //   `https://rest.entitysport.com/v2/matches/65008/innings/1/commentary?token=${cricketToken}`
      //   );
      return matchData;
    } catch (error) {
      console.log(error);
    }
  }
  async importExtraPlayers(seriesKey, listmatch) {
    try {
      // console.log("req.params.matchkey",req.params.matchkey);
      const fantasyTypeMOdel = require("../../models/fantasyModels.js");
      const getSportName = await fantasyTypeMOdel.findOne(
        { status: "enable" },
        { fantasyName: 1 }
      );
      axios
        .get(
          `https://rest.entitysport.com/v2/competitions/${seriesKey}/squads/${listmatch.real_matchkey}?token=0930876c70b22c531c1e27d6bf2bd8a5`
        )
        .then(async (matchData) => {
          if (matchData.data) {
            await this.child_fetchPlayerByMatch_entity(
              matchData.data,
              listmatch._id,
              listmatch.real_matchkey,
              listmatch,
              'importExtraPlayers'
            );
            return true
          }
        });
    } catch (error) {
      console.log(error);
    }
  }
}


module.exports = new cricketApiController();