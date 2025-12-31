const mongoose = require('mongoose');
const moment = require("moment")
const axios = require("axios");
const userModel = require('../../../models/userModel');
const randomstring = require('randomstring');
const configModel = require("../../../models/configModel");
const walletTransactionModel = require("../../../models/walletTransactionModel");
const redisMain = require("../../../utils/redis/redisMain");
const adminModel = require("../../../models/adminModel.js")
const affiliatorModel = require("../../../models/affiliatorModel");
const highlightModel = require("../../../models/highlightModel.js");
const NotificationModel = require("../../../models/alertModel.js");
const seriesModel = require("../../../models/matchSeriesModel.js");
const seriesPriceCardModel = require("../../../models/seriesPriceCardModel.js");
const listmatchModel = require("../../../models/matchesModel.js");
const expertAdviceModel = require("../../../models/expertAdvice-model.js");

exports.dbCheck = async () => {
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


exports.upcomingMatchesSeries = async (req, res, next) => {
  try {

    let date = moment().format("YYYY-MM-DD HH:mm:ss");
    let EndDate = moment().add(25, "days").format("YYYY-MM-DD HH:mm:ss");

    console.log("date", date, "EndDate", EndDate);
    const seriesData = await seriesModel.aggregate([
      {
        $match: {
          launch_status: "launched",
          start_date: { $gt: date },
          start_date: { $lt: EndDate }
        }
      },
      {
        $project: {
          _id: 0,
          seriesName: "$seriesData.name",
          seriesId: "$seriesData.seriesId"
        }
      },
      {
        $group: {
          _id: "$seriesId",
          seriesName: { $first: "$seriesName" }
        }
      }
    ]);

    if (seriesData.length > 0) {
      return {
        status: true,
        message: "Upcoming Matches Series Data...!",
        data: seriesData
      };
    } else {
      return {
        status: false,
        message: "No Upcoming Matches Series Found...!",
        data: []
      };
    }
  } catch (error) {
    console.error("upcomingMatchesSeries Error:", error);
    return {
      status: false,
      message: "upcomingMatchesSeries error.",
      error: error.message
    };
  }
}


exports.fetchMainBanner = async (req) => {
  try {
    let image;
    let keyname = `getversion`;
    redisMain.deletedata(keyname);
    let bannerData = await redisMain.getkeydata(keyname);
    if (bannerData) {
      image = bannerData.data?.bannerData;
    } else {
      const superAdmin = await adminModel.findOne({
        role: global.constant.ADMIN.SUPER_ADMIN,
      });
      // console.log(superAdmin,">>>>>>>>>>>>>>>")
      let images;
      if (superAdmin) {
        images = superAdmin.sidebanner
          ? superAdmin.sidebanner.filter(
            (item) => item.type == global.constant.SIDE_BANNER_TYPES.APP_TYPE
          )
          : [];
      } else {
        image = [];
      }
      image = await images.map((item) => {
        let url = "";
        let image = "";
        if (item.url) {
          url = item.url;
        }
        if (item.image) {
          image = `${global.constant.IMAGE_URL}${item.image}`;
        }
        console.log("image", image);
        return {
          // image_local: `${global.constant.IMAGE_URL}${item.image}`,
          // type: type,
          url: url,
          image: image,
          bannerType: item.bannerType,
        };
      });
    }
    return {
      message: "Main Banner...!",
      status: true,
      data: image,
    };

  } catch (error) {
    console.error("fetchMainBanner Error:", error);
    return {
      status: false,
      message: "fetchMainBanner error.",
      error: error.message
    };
  }
}

exports.fetchPopupNotify = async (req) => {
  try {
    let image;
    let keyname = `getversion`;
    let getversion = await redisMain.getkeydata(keyname);
    let popup_notify_image = "";
    let popup_notify_title = ''
    if (getversion?.data) {
      popup_notify_image = getversion.data?.popup_notify_image;
      popup_notify_title = '';
    } else {
      const get_popup = await adminModel.findOne(
        { role: 0 },
        { popup_notify_title: 1, popup_notify_image: 1 }
      );
      let url = global.constant.IMAGE_URL;

      if (get_popup.popup_notify_image) {
        popup_notify_image = `${url}${get_popup.popup_notify_image}`;
      }
      if (get_popup.popup_notify_title) {
        popup_notify_title = get_popup.popup_notify_title;
      }
    }
    return {
      message: "popup nofify....",
      status: true,
      data: {
        popup_notify_title: popup_notify_title,
        popup_notify_image: popup_notify_image,
      },
    };

  } catch (error) {
    console.error("fetchPopupNotify Error:", error);
    return {
      status: false,
      message: "fetchPopupNotify error.",
      error: error.message
    };
  }
}

// exports.fetchUserStory = async (req) => {
//   try {
//     const key = "userStory"
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.perPage) || 10;
//     const skip = (page - 1) * limit;

//     const redisUserStoryData = await redisMain.getkeydata(key)
//     let data
//     let totalRecords
//     // console.log(redisUserStoryData, "redis datat")
//     if (redisUserStoryData && Object.keys(redisUserStoryData).length > 0) {
//       data = Object.values(redisUserStoryData)
//       totalRecords = data.length;
//       data = data.slice(skip, skip + limit)
//       // console.log("redis block")
//     }
//     else {
//       const pipeline = [
//         {
//           $project: {
//             storyProfileImage: { $concat: [`${global.constant.IMAGE_URL}`, "$image"] },
//             title: "$storyName",
//             storyData: "$story",
//             is_active: 1,
//             sortBy: 1,
//             createdAt: 1,
//             updatedAt: 1,
//           },
//         },
//         {
//           $match: {
//             is_active: true,
//           },
//         },
//         {
//           $sort: {
//             sortBy: 1,
//           },
//         },
//         {
//           $unwind: "$storyData"
//         },
//         {
//           $addFields: {
//             "storyData.url": { $concat: [`${global.constant.IMAGE_URL}`, "$storyData.url"] }
//           }
//         },
//         {
//           $group: {
//             _id: "$_id",
//             is_active: { $first: "$is_active" },
//             sortBy: { $first: "$sortBy" },
//             storyProfileImage: { $first: "$storyProfileImage" },
//             title: { $first: "$title" },
//             storyData: { $push: "$storyData" },
//           }
//         }
//       ]
//       let paginatedPipeline = await highlightModel.aggregate([...pipeline, {
//         $facet: {
//           data: [
//             { $skip: skip }, { $limit: limit }
//           ],
//           totalCount: [
//             { $count: "count" }
//           ]
//         }
//       }]);
//       data = paginatedPipeline[0]?.data || [];
//       totalRecords = paginatedPipeline[0]?.totalCount?.[0]?.count || 0;

//       let redisData = {}
//       data.map((story) => {
//         redisData[story._id] = story
//       })
//       await redisMain.setkeydata(key, redisData, 30 * 24 * 60 * 60)
//     }
//     if (data.length > 0) {
//       return {
//         message: "Data Fetch successfully",
//         status: true,
//         data: {
//           "pagination": {
//             "totalRecord": totalRecords,
//             "currentPage": page,
//             "perPage": limit
//           },
//           data
//         }
//       };
//     }

//     return {
//       message: "Data Not Found !!",
//       status: false,
//     };
//   } catch (error) {
//     console.error("fetchUserStory Error:", error);
//     return {
//       status: false,
//       message: "fetchUserStory error.",
//       error: error.message
//     };
//   }
// }
exports.fetchUserStory = async (req) => {
  try {
    const key = "userStory";

    const redisUserStoryData = await redisMain.getkeydata(key);
    let data;

    if (redisUserStoryData && Object.keys(redisUserStoryData).length > 0) {
      // ✅ Use Redis cache
      data = Object.values(redisUserStoryData);
    } else {
      // ✅ Fetch from MongoDB
      const pipeline = [
        {
          $project: {
            storyProfileImage: { $concat: [`${global.constant.IMAGE_URL}`, "$image"] },
            title: "$storyName",
            storyData: "$story",
            is_active: 1,
            sortBy: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
        { $match: { is_active: true } },
        { $sort: { sortBy: 1 } },
        { $unwind: "$storyData" },
        {
          $addFields: {
            "storyData.url": { $concat: [`${global.constant.IMAGE_URL}`, "$storyData.url"] }
          }
        },
        {
          $group: {
            _id: "$_id",
            is_active: { $first: "$is_active" },
            sortBy: { $first: "$sortBy" },
            storyProfileImage: { $first: "$storyProfileImage" },
            title: { $first: "$title" },
            storyData: { $push: "$storyData" },
          }
        }
      ];

      data = await highlightModel.aggregate(pipeline);

      // ✅ Store full dataset in Redis (cache for 30 days)
      let redisData = {};
      data.forEach((story) => {
        redisData[story._id] = story;
      });
      await redisMain.setkeydata(key, redisData, 30 * 24 * 60 * 60);
    }

    if (data && data.length > 0) {
      return {
        message: "Data Fetch successfully",
        status: true,
        data
      };
    }

    return {
      message: "Data Not Found !!",
      status: false,
    };
  } catch (error) {
    console.error("fetchUserStory Error:", error);
    return {
      status: false,
      message: "fetchUserStory error.",
      error: error.message
    };
  }
};


exports.fetchNotifications = async (req) => {
  try {
    let notificationdata = await NotificationModel.find({
      userid: req.user._id,
    }).sort({ createdAt: -1 });
    await NotificationModel.updateMany(
      { userid: req.user._id, seen: 0 },
      { seen: 1 }
    );
    if (notificationdata.length == 0) {
      return {
        message: "Notification of user for previous and today Not Found...",
        status: false,
        data: [],
      };
    }
    let newNotification = [];

    for await (let key of notificationdata) {
      let Obj = {};
      Obj._id = key._id;
      Obj.userid = key.userid;
      Obj.title = key.title;
      Obj.description = key.transaction_id;
      Obj.seen = key.seen;
      Obj.module = "";
      Obj.createdAt = new Date(
        key.createdAt.getTime() + (5 * 60 + 30) * 60 * 1000
      );
      Obj.updatedAt = new Date(
        key.updatedAt.getTime() + (5 * 60 + 30) * 60 * 1000
      );
      newNotification.push(Obj);
    }
    return {
      message: "Get Notification of user for previous and today",
      status: true,
      data: newNotification,
    };
  } catch (error) {
    console.error("fetchNotifications Error:", error);
    return {
      status: false,
      message: "fetchNotifications error.",
      error: error.message
    };
  }
}

exports.fetchAllSeries = async (req) => {
  try {
    // const curDate = moment().format("YYYY-MM-DD HH:mm:ss");
    let mypipline = [];
    mypipline.push({
      $match: {
        status: "opened",
        // end_date: { $gte: curDate },
        has_leaderboard: "yes",
      },
    });
    mypipline.push({
      $lookup: {
        from: "matches",
        let: { seriesId: "$_id", launch_status: "launched" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$series", "$$seriesId"] },
                  { $eq: ["$launch_status", "$$launch_status"] },
                ],
              },
            },
          },
        ],
        as: "listmatcheData",
      },
    });
    mypipline.push({
      $lookup: {
        from: 'seriesresults',
        localField: '_id',
        foreignField: 'seriesid',
        as: 'seriesResults'
      }
    },
      {
        $addFields: {
          totalPoints: {
            $sum: "$seriesResults.points"
          }
        }
      },
      {
        $project: {
          // listmatcheData: 0,
          seriesResults: 0
        }
      });
    const seriesData = await seriesModel.aggregate(mypipline);
    let mySeries = [];
    if (seriesData.length > 0) {
      for await (let series of seriesData) {
        let obj = {};
        obj.id = series._id;
        obj.name = series.name;
        obj.winningStatus = series.winningStatus;
        obj.totalPoints = series.totalPoints;
        obj.status = 1;
        obj.startdate = moment(series.start_date).format("DD MMM YYYY");
        obj.starttime = moment(series.start_date).format("h:mm a");
        obj.enddate = moment(series.end_date).format("DD MMM YYYY");
        obj.endtime = moment(series.end_date).format("h:mm a");
        obj.startdatetime = moment(series.start_date).format(
          "YYYY-MM-DD h:mm:ss"
        );
        obj.enddatetime = moment(series.end_date).format(
          "YYYY-MM-DD h:mm:ss"
        );
        obj.has_leaderboard = series.has_leaderboard;
        const seriesPriceCardData = await seriesPriceCardModel.find({
          seriesId: new mongoose.Types.ObjectId(series._id),
        });
        let seriesPiceCard = [];
        if (seriesPriceCardData.length > 0) {
          let winners = 0;
          for await (let prc of seriesPriceCardData) {
            let prcObj = {};
            prcObj.min_position = prc.min_position;
            prcObj.max_position = prc.max_position;
            if (prc.price == 0) {
              let totalPirce = prc.total / prc.winners;
              prcObj.price = totalPirce;
              prcObj.price_percent = `${prc.price_percent}%`;
            } else {
              prcObj.price = prc.price;
            }
            prcObj.winners = prc.winners;
            winners += Number(prc.winners);

            //console.log("--Number(prc.min_position+1) != (prc.max_position)--", Number(prc.min_position + 1) != (prc.max_position))
            if (Number(prc.min_position + 1) != prc.max_position) {
              prcObj.start_position = `${prc.min_position + 1}-${prc.max_position
                }`;
            } else {
              prcObj.start_position = `${prc.max_position}`;
            }
            prcObj.totalwinners = winners;
            seriesPiceCard.push(prcObj);
          }
        }
        obj.price_card = seriesPiceCard;
        mySeries.push(obj);
      }
      return {
        status: true,
        message: "Series Data...!",
        data: mySeries,
      };
    } else {
      return {
        sttaus: true,
        message: "No Series Found...!",
        data: [],
      };
    }
  } catch (error) {
    console.error("fetchAllSeries Error:", error);
    return {
      status: false,
      message: "fetchAllSeries error.",
      error: error.message
    };
  }
}

exports.fetchLeaderboardData = async (req) => {
  try {
    let mypip = [];
    // console.log(req.params,"req.paramsreq.params")
    // if (req.params.series_id) {
    //   console.log(req.params.series_id,"aaaaaaaaaaaaaaaaaaaaa")
    //   mypip.push({
    //     $match: {
    //       series: new mongoose.Types.ObjectId(req.params.series_id),
    //     },
    //   });
    // }
    if (
      req.params.series_id &&
      new mongoose.Types.ObjectId.isValid(req.params.series_id)
    ) {
      // console.log(req.params.series_id, "Valid series_id");
      mypip.push({
        $match: {
          series: new mongoose.Types.ObjectId(req.params.series_id),
        },
      });
    } else {
      // console.error("Invalid series_id:", req.params.series_id);
    }
    mypip.push({
      $match: {
        launch_status: "launched",
        final_status: { $ne: "IsAbandoned" },
        final_status: { $ne: "IsCanceled" },
        //status: { $ne: "notstarted" },
      },
    });
    mypip.push({
      $lookup: {
        from: "userteam",
        localField: "_id",
        foreignField: "matchkey",
        as: "joinTeamData",
      },
    });
    mypip.push({
      $unwind: {
        path: "$joinTeamData",
      },
    });
    mypip.push({
      $lookup: {
        from: "userleagues",
        localField: "joinTeamData._id",
        foreignField: "teamid",
        as: "joinedleaugesData",
      },
    });
    mypip.push({
      $unwind: {
        path: "$joinedleaugesData",
      },
    });
    mypip.push({
      $lookup: {
        from: "users",
        localField: "joinTeamData.userid",
        foreignField: "_id",
        as: "userData",
      },
    });
    mypip.push({
      $unwind: {
        path: "$userData",
      },
    });
    mypip.push({
      $lookup: {
        from: "matchcontests",
        localField: "joinedleaugesData.challengeid",
        foreignField: "_id",
        pipeline: [
          {
            $match: {
              is_recent: "true",
            },
          },
        ],
        as: "result",
      },
    });
    mypip.push({
      $lookup: {
        from: "contestcategories",
        localField: "result.contest_cat",
        foreignField: "_id",
        as: "catData",
      },
    });
    mypip.push({
      $unwind: {
        path: "$catData",
      },
    });
    mypip.push({
      $addFields: {
        has_leader_cat: "$catData.has_leaderBoard",
      },
    });
    mypip.push({
      $match: {
        has_leader_cat: "yes",
      },
    });
    mypip.push({
      $group: {
        _id: {
          userid: "$joinedleaugesData.userid",
          matchkey: "$_id",
        },
        allTeams: {
          $push: "$$ROOT",
        },
      },
    });
    mypip.push({
      $addFields: {
        maxScore: {
          $max: {
            $map: {
              input: "$allTeams.joinTeamData.points",
              in: { $max: "$$this" },
            },
          },
        },
      },
    });
    mypip.push({
      $project: {
        allTeams: {
          $filter: {
            input: "$allTeams",
            as: "mtdata",
            cond: { $eq: ["$$mtdata.joinTeamData.points", "$maxScore"] },
          },
        },
        maxScore: "$maxScore",
      },
    });
    mypip.push({
      $group: {
        _id: "$_id.userid",
        sumTotal: {
          $sum: "$maxScore",
        },
        userTeam: { $first: "$allTeams.userData.team" },
        matchkey: { $first: "$allTeams._id" },
        matchName: { $first: "$allTeams.name" },
        image: { $first: "$allTeams.userData.image" },
        series: { $first: "$allTeams.series" },
      },
    });
    mypip.push({
      $sort: {
        sumTotal: -1,
      },
    });

    const data = await listmatchModel.aggregate(mypip);
    const seriesPricecard = await seriesPriceCardModel.find({
      seriesId: new mongoose.Types.ObjectId(req.params.series_id),
    });
    let myArray = [];
    let Rank = 1;
    for await (let key of data) {
      let Obj = {};

      Obj.rank = Rank;
      Obj.totalpoints = key.sumTotal;
      Obj.teamName = key.userTeam[0];
      if (key._id == req.user._id) {
        Obj.user_id = key._id;
        Obj.status = true;
      } else {
        Obj.user_id = key._id;
        Obj.status = false;
      }
      Obj.series_id = key.series[0];
      if (key.image == "" || !key.image) {
        Obj.image = `${global.constant.IMAGE_URL}team_image.png`;
      } else {
        Obj.image = key.image[0];
      }
      myArray.push(Obj);
      Rank++;

      for (let i = 0; i < myArray.length; i++) {
        let rank = myArray[i].rank;
        for (let j = 0; j < seriesPricecard.length; j++) {
          if (
            rank > seriesPricecard[j].min_position &&
            rank <= seriesPricecard[j].max_position
          ) {
            myArray[i].amount = seriesPricecard[j].price;
            break;
          }
        }
      }
    }
    // console.log(myArray,"myArraymyArray")
    let newone = myArray.findIndex(
      (x) => x.user_id.toString() === req.user._id
    );
    // console.log("---newone---", newone)
    if (newone > -1) {
      let element = myArray[newone];
      myArray.splice(newone, 1);
      myArray.splice(0, 0, element);
    }
    return {
      status: true,
      message: "leader board data ",
      data: myArray,
      //mypip
    };
  } catch (error) {
    console.error("series fetchLeaderboardData Error:", error);
    return {
      status: false,
      message: "series fetchLeaderboardData error.",
      error: error.message
    };
  }
}

exports.postPromoterData = async (req) => {
  try {
    if (
      !req.body.channelurl ||
      !req.body.channelName ||
      !req.body.channelType
    ) {
      return {
        message: "missing any key :[channelurl,channelName,channelType]",
        status: false,
        data: {},
      };
    }
    const checkuserindb = await userModel.findOne({ _id: req.user._id });
    if (!checkuserindb) {
      return {
        message: "user not found!!",
        status: false,
        data: {},
      };
    }
    const checkUserData = await affiliatorModel.findOne({
      userid: req.user._id,
    });
    if (checkUserData) {
      return {
        message: "user already exists !!",
        status: false,
        data: {},
      };
    }
    req.body.userid = req.user._id;
    const data = await affiliatorModel.create(req.body);
    await userModel.findByIdAndUpdate(
      { _id: req.user._id },
      { promoter_verify: 0 },
      { new: true }
    );
    if (!data) {
      return {
        message: "Error to insert Data !!",
        status: false,
        data: {},
      };
    }
    return {
      message: "Data Insert Succsessfully!!",
      status: true,
      data: data,
    };
  } catch (error) {
    console.error("postPromoterData Error:", error);
    return {
      status: false,
      message: "postPromoterData error.",
      error: error.message
    };
  }
}

exports.fetchPromoterData = async (req) => {
  try {
    const startDate = new Date(
      moment(req.query.startdate, "DD-MM-YYYY").format("YYYY-MM-DD")
    );
    const endDate = new Date(
      moment(req.query.enddate, "DD-MM-YYYY").format("YYYY-MM-DD")
    );
    let matchQuery = {};
    if (req.query.startdate && req.query.enddate) {
      matchQuery = {
        $expr: {
          $and: [
            { $gte: ["$createdAt", startDate] },
            { $lte: ["$createdAt", endDate] },
          ],
        },
      };
    }

    // let pipeline = [
    //   {
    //     $match: {
    //       _id: new mongoose.Types.ObjectId(req.query.id),
    //     },
    //   },
    //   {
    //     $lookup: {
    //       from: "users",
    //       localField: "_id",
    //       foreignField: "refer_id",
    //       as: "referUser",
    //     },
    //   },
    //   {
    //     $unwind: "$referUser",
    //   },
    //   {
    //     $lookup: {
    //       from: "joinedleauges",
    //       localField: "referUser._id",
    //       foreignField: "userid",
    //       pipeline: [
    //         {
    //           $addFields: {
    //             date: {
    //               $dateToString: {
    //                 format: "%Y-%m-%d",
    //                 date: "$createdAt",
    //               },
    //             },
    //           },
    //         },
    //         {
    //           $match: matchQuery,
    //         },
    //         {
    //           $lookup: {
    //             from: "listmatches",
    //             localField: "matchkey",
    //             foreignField: "_id",
    //             pipeline: [
    //               {
    //                 $match: {
    //                   $expr: {
    //                     $and: [
    //                       { $eq: ["$status", "completed"] },
    //                       { $eq: ["$final_status", "winnerdeclared"] },
    //                     ],
    //                   },
    //                 },
    //               },
    //               {
    //                 $project: {
    //                   _id: 1,
    //                 },
    //               },
    //             ],
    //             as: "listmatches",
    //           },
    //         },
    //         {
    //           $unwind: "$listmatches",
    //         },
    //         {
    //           $lookup: {
    //             from: "matchchallenges",
    //             localField: "challengeid",
    //             foreignField: "_id",
    //             as: "matchChallengeData",
    //           },
    //         },
    //         {
    //           $unwind: "$matchChallengeData",
    //         },
    //         {
    //           $group: {
    //             _id: "$challengeid",
    //             listmatches: { $first: "$listmatches" },
    //             matchChallengeData: { $first: "$matchChallengeData" },
    //             matchkey: { $first: "$matchkey" },
    //             count: { $sum: 1 },
    //           },
    //         },
    //       ],
    //       as: "joinedleauges",
    //     },
    //   },
    //   {
    //     $lookup: {
    //       from: "promoters",
    //       localField: "_id",
    //       foreignField: "userid",
    //       as: "promoterData",
    //     },
    //   },
    //   {
    //     $unwind: "$promoterData",
    //   },
    //   {
    //     $lookup: {
    //       from: "joinedleauges",
    //       localField: "referUser._id",
    //       foreignField: "userid",
    //       pipeline: [
    //         {
    //           $addFields: {
    //             date: {
    //               $dateToString: {
    //                 format: "%Y-%m-%d",
    //                 date: "$createdAt",
    //               },
    //             },
    //           },
    //         },
    //         {
    //           $match: matchQuery,
    //         },
    //         {
    //           $group: {
    //             _id: "$matchkey",
    //           },
    //         },
    //       ],
    //       as: "referuserjoinmatch",
    //     },
    //   },
    //   {
    //     $addFields: {
    //       referuserjoinmatch: { $size: "$referuserjoinmatch" },
    //     },
    //   },
    //   {
    //     $addFields: {
    //       totalContest: { $size: "$joinedleauges" },
    //       totalMatches: "$referuserjoinmatch",
    //       totalEarning: "$promoterData.newTotalAmount",
    //     },
    //   },
    //   {
    //     $group: {
    //       _id: "$refer_id",
    //       totalContest: { $first: "$totalContest" },
    //       totalMatches: { $first: "$totalMatches" },
    //       totalEarning: { $first: "$totalEarning" },
    //       totalReferal: { $push: "$$ROOT" },
    //       id: { $first: "$_id" },
    //       joinedleauges: { $first: "$joinedleauges" },
    //       promoterData: { $first: "$promoterData" },
    //     },
    //   },
    //   {
    //     $addFields: {
    //       totalReferal: { $size: "$totalReferal" },
    //     },
    //   },
    // ];

    // Run the pipeline
    // const startDate = new Date(req.query.startdate);
    // const endDate = new Date(req.query.enddate);
    // let matchQuery = {};
    // if (req.query.startdate && req.query.enddate) {
    //   matchQuery = {
    //     $expr: {
    //       $and: [
    //         { $gte: ["$createdAt", startDate] },
    //         { $lte: ["$createdAt", endDate] },
    //       ],
    //     },
    //   };
    // }

    let pipeline = [
      {
        $match: {
          _id: new mongoose.Types.ObjectId(req.query.id),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "refer_id",
          as: "referUser",
        },
      },
      {
        $unwind: "$referUser",
      },
      {
        $lookup: {
          from: "userleagues",
          localField: "referUser._id",
          foreignField: "userid",
          pipeline: [
            {
              $addFields: {
                date: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: "$createdAt",
                  },
                },
              },
            },
            {
              $match: matchQuery,
            },
            {
              $lookup: {
                from: "matches",
                localField: "matchkey",
                foreignField: "_id",
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          {
                            $eq: ["$status", "completed"],
                          },
                          {
                            $eq: ["$final_status", "winnerdeclared"],
                          },
                        ],
                      },
                    },
                  },
                  {
                    $project: {
                      _id: 1,
                    },
                  },
                ],
                as: "listmatches",
              },
            },
            {
              $unwind: "$listmatches",
            },
            {
              $lookup: {
                from: "matchcontests",
                localField: "challengeid",
                foreignField: "_id",
                as: "matchChallengeData",
              },
            },
            {
              $unwind: "$matchChallengeData",
            },
            {
              $group: {
                _id: "$challengeid",
                listmatches: {
                  $first: "$listmatches",
                },
                matchChallengeData: {
                  $first: "$matchChallengeData",
                },
                matchkey: {
                  $first: "$matchkey",
                },
                count: {
                  $sum: 1,
                },
              },
            },
          ],
          as: "joinedleauges",
        },
      },
      {
        $lookup: {
          from: "affiliator",
          localField: "_id",
          foreignField: "userid",
          as: "promoterData",
        },
      },
      {
        $unwind: "$promoterData",
      },
      {
        $lookup: {
          from: "userleagues",
          localField: "referUser._id",
          foreignField: "userid",
          pipeline: [
            {
              $addFields: {
                date: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: "$createdAt",
                  },
                },
              },
            },
            {
              $match: matchQuery,
            },
            {
              $lookup: {
                from: "matches",
                localField: "matchkey",
                foreignField: "_id",
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          {
                            $eq: ["$status", "completed"],
                          },
                          {
                            $eq: ["$final_status", "winnerdeclared"],
                          },
                        ],
                      },
                    },
                  },
                ],
                as: "matchessssssssss",
              },
            },
            {
              $unwind: "$matchessssssssss",
            },
            {
              $group: {
                _id: "$matchkey",
              },
            },
          ],
          as: "referuserjoinmatch",
        },
      },
      {
        $addFields: {
          referuserjoinmatch: {
            $size: "$referuserjoinmatch",
          },
        },
      },
      {
        $addFields: {
          totalContest: {
            $size: "$joinedleauges",
          },
          totalMatches: "$referuserjoinmatch",
          totalEarning: "$promoterData.newTotalAmount",
          joinedleague: "$joinedleauges",
        },
      },
      {
        $group: {
          _id: null,
          totalContest: {
            $sum: {
              $size: "$joinedleauges",
            },
          },
          totalMatches: {
            $sum: "$totalMatches",
          },
          totalEarning: {
            $first: "$totalEarning",
          },
          totalReferal: {
            $push: "$$ROOT",
          },
          id: {
            $first: "$_id",
          },
          joinedleauges: {
            $push: "$joinedleauges",
          },
          promoterData: {
            $first: "$promoterData",
          },
        },
      },
      {
        $addFields: {
          totalReferal: {
            $size: "$totalReferal",
          },
        },
      },
    ];

    // Run the pipeline
    let data = await userModel.aggregate(pipeline);
    let totalWinning = 0;
    let matchkeyArr = [];
    let contestArr = [];
    if (data.length > 0) {
      for (let item of data[0]?.joinedleauges) {
        for (let element of item) {
          let promoterMargin = 0;
          let entryfee =
            Number(element.matchChallengeData.entryfee) -
            Number(element.matchChallengeData.discount_fee);
          let win_amount = Number(element.matchChallengeData.win_amount);
          let joinedusers = Number(element.matchChallengeData.joinedusers);
          let overallAmount = entryfee * Number(joinedusers);

          if (overallAmount > win_amount) {
            let difference = Number(overallAmount) - Number(win_amount);
            let promotersReferredUsersData =
              (difference / joinedusers) * element.count;
            promoterMargin +=
              promotersReferredUsersData *
              (Number(data[0].promoterData.percentage) / 100);
          }
          totalWinning += promoterMargin;

          if (!matchkeyArr.includes(element.matchkey.toString())) {
            matchkeyArr.push(element.matchkey.toString());
          }
          if (!contestArr.includes(element.matchChallengeData._id.toString())) {
            contestArr.push(element.matchChallengeData._id.toString());
          }
        }
      }
    }
    let data2 = [];
    let newtotal = data[0]?.promoterData?.newTotalAmount;
    data2.push({
      totalContest: contestArr.length,
      totalMatches: matchkeyArr.length,
      totalEarning: newtotal,
      winning: totalWinning,
      totalReferal: data[0]?.totalReferal,
      id: data[0]?.id,
    });

    return {
      message: "Data Fetch Successfully!",
      status: true,
      data: data2,
    };
  } catch (error) {
    console.error("fetchPromoterData Error:", error);
    return {
      status: false,
      message: "fetchPromoterData error.",
      error: error.message
    };
  }
}

exports.fetchInvestorCategory = async (req) => {
  try {
    const data = await investorContestModel.aggregate([
      {
        $match: {
          is_active: true,
          is_deleted: false,
        },
      },
      {
        $lookup: {
          from: "investorpricecards",
          localField: "_id",
          foreignField: "contestId",
          as: "priceCard",
        },
      },
      {
        $project: {
          name: 1,
          start_date: 1,
          end_date: 1,
          priceCard: 1,
          winner_declare_status: {
            $cond: {
              if: { $eq: ["$winner_declare_status", true] },
              then: "winnerdeclared",
              else: "pending"
            }
          }
        },
      },
    ]);
    if (data.length > 0) {
      return {
        message: `Data Fetch Successfully !!`,
        status: true,
        data: data,
      };
    }
    return {
      message: `Data Not Found!!`,
      status: false,
      data: [],
    };
  } catch (error) {
    console.error("fetchInvestorCategory Error:", error);
    return {
      status: false,
      message: "fetchInvestorCategory error.",
      error: error.message
    };
  }
};

exports.fetchInvestorUserData = async (req) => {
  try {
    // console.log(req.query, '>>>>>', JSON.stringify({
    // 	'$match': {
    // 		'status': 'SUCCESS',
    // 		$expr: {
    // 			$and: [
    // 				{
    // 					$gte: ['$createdAt', new Date(req.query.startDate)]
    // 				},
    // 				{
    // 					$lt: ['$createdAt', new Date(req.query.endDate)]
    // 				}
    // 			]

    // 		},
    // 	}
    // }));\
    console.log(req.query, ">>>>>");
    const pipe = [
      {
        $match: {
          paymentstatus: "confirmed",
          type: "Cash added",
          $expr: {
            $and: [
              { $gte: ["$createdAt", new Date(req.query.startDate)] },
              { $lt: ["$createdAt", new Date(req.query.endDate)] },
            ],
          },
        },
      },
      {
        $group: {
          _id: "$userid",
          totalAmount: { $sum: "$amount" },
        },
      },
      {
        $sort: { totalAmount: -1 },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: { path: "$user" },
      },
      {
        $project: {
          username: "$user.team",
          mobile: "$user.mobile",
          image: "$user.image",
          totalEarning: "$totalAmount",
        },
      },
      {
        $sort: { totalEarning: -1 },
      },
      {
        $setWindowFields: {
          partitionBy: "$state",
          sortBy: { totalEarning: -1 },
          output: {
            rank: { $rank: {} },
          },
        },
      },
      {
        $limit: 30,
      },
    ];
    const data = await walletTransactionModel.aggregate(pipe);
    if (data.length > 0) {
      return {
        message: `Data Fetch Successfully !!`,
        status: true,
        data: data,
      };
    }
    return {
      message: `Data Not Found!!`,
      status: false,
      data: [],
    };
  } catch (error) {
    console.error("fetchInvestorUserData Error:", error);
    return {
      status: false,
      message: "fetchInvestorUserData error.",
      error: error.message
    };
  }
}

exports.expertAdviceList = async (req) => {
  try {
    const data = await expertAdviceModel.find({ status: true });
    if (data.length > 0) {
      return {
        message: `Data Fetch Successfully !!`,
        status: true,
        data: data,
      };
    }
    return {
      message: `Data Not Found!!`,
      status: false,
      data: [],
    };
  } catch (error) {
    console.error("expertAdviceList Error:", error);
    return {
      status: false,
      message: "expertAdviceList error.",
      error: error.message
    };
  }
}