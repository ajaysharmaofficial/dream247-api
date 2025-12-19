const matchServices = require("../services/matchServices");
class matchController {
  constructor() {
    return {
      dbCheck: this.dbCheck.bind(this),
      fetchMatchList: this.fetchMatchList.bind(this),
      fetchMegaWinners: this.fetchMegaWinners.bind(this),
      fetchMatchDetails: this.fetchMatchDetails.bind(this),
      fetchAllPlayers: this.fetchAllPlayers.bind(this),
      fetchAllPlayerspot: this.fetchAllPlayerspot.bind(this),
      fetchPlayerInfo: this.fetchPlayerInfo.bind(this),
      fetchNewJoinedMatches: this.fetchNewJoinedMatches.bind(this),
      NewJoinedMatches: this.NewJoinedMatches.bind(this),
      leaderboardLiveRank: this.leaderboardLiveRank.bind(this),
      playersWithPlayingStatus:
        this.playersWithPlayingStatus.bind(this),
      playerMatchInfoData: this.playerMatchInfoData.bind(this),
      fetchMatchListWithoutRedis: this.fetchMatchListWithoutRedis.bind(this),
      recentWinnerWithoutRedis: this.recentWinnerWithoutRedis.bind(this),
      leaderboardSelfLiveRanks: this.leaderboardSelfLiveRanks.bind(this),
      leaderboardCompletedMatch: this.leaderboardCompletedMatch.bind(this),
      matchlivedata: this.matchlivedata.bind(this),
      teamTypes: this.teamTypes.bind(this),
      upcomingMatchWithouRedis: this.upcomingMatchWithouRedis.bind(this),

    };
  }

  async dbCheck(req, res, next) {
    try {
      const data = await matchServices.dbCheck(req);
      const statusCode = data.status ? 200 : 500;
      return res
        .status(statusCode)
        .json(Object.assign({ success: data.status }, data));
    } catch (error) {
      next(error);
    }
  }

  async teamTypes(req, res, next) {
    try {
      const teamType = await matchServices.teamTypes(req, res);
      let final = {
        message: "All team type",
        status: true,
        data: teamType,
      };
      return res.status(200).json(Object.assign({ success: true }, final));
    } catch (error) {
      next(error);
    }
  };

  async upcomingMatchWithouRedis(req, res, next) {
    try {
      const matches = await matchServices.fetchUpcomingMatchesWithoutRedis(req, res);
      
       let final = {
        message: "all match data",
        status: true,
        data: {
          matches,
        },
      };
      return res.status(200).json(Object.assign({ success: true }, final));

    } catch (error) {
      next(error);
    }
  };

  async fetchMatchList(req, res, next) {
    try {
      const upcomingMatches = await matchServices.fetchMatchList(req, res);
      // const upcomingMatches = [];
      // console.log(`upcomingMatches`, upcomingMatches);
      // console.log("joinedMatches_-----------------",joinedMatches)

      let final = {
        message: "all match data",
        status: true,
        data: {
          upcomingMatches,
        },
      };
      return res.status(200).json(Object.assign({ success: true }, final));
    } catch (error) {
      next(error);
    }
  };
  async fetchMatchListWithoutRedis(req, res, next) {
    try {
      const upcomingMatches = await matchServices.fetchMatchListWithoutRedis(req, res);
      // const upcomingMatches = [];
      // console.log(`upcomingMatches`, upcomingMatches);
      // console.log("joinedMatches_-----------------",joinedMatches)

      let final = {
        message: "all match data",
        status: true,
        data: {
          upcomingMatches,
        },
      };
      return res.status(200).json(Object.assign({ success: true }, final));
    } catch (error) {
      next(error);
    }
  };

  async playerMatchInfoData(req, res) {
    try {
      const data = await matchServices.playerMatchInfoData(req);
      if (data.status === false) {
        return res
          .status(200)
          .json(Object.assign({ success: data.status }, data));
      } else {
        return res
          .status(200)
          .json(Object.assign({ success: data.status }, data));
      }
    } catch (error) {
      console.log(error);
    }
  }

  async fetchMatchDetails(req, res, next) {
    try {
      const data = await matchServices.fetchMatchDetails(req);
      if (data.status === false) {
        return res
          .status(200)
          .json(Object.assign({ success: data.status }, data));
      } else {
        return res
          .status(200)
          .json(Object.assign({ success: data.status }, data));
      }
    } catch (error) {
      next(error);
    }
  };

  async fetchAllPlayers(req, res, next) {
    try {
      const data = await matchServices.fetchAllPlayers(req);
      if (data.status === false) {
        return res
          .status(200)
          .json(Object.assign({ success: data.status }, data));
      } else {
        return res
          .status(200)
          .json(Object.assign({ success: data.status }, data));
      }
    } catch (error) {
      next(error);
    }
  };

  async fetchAllPlayerspot(req, res, next) {
    try {
      const data = await matchServices.fetchAllPlayerspot(req);
      if (data.status === false) {
        return res
          .status(200)
          .json(Object.assign({ success: data.status }, data));
      } else {
        return res
          .status(200)
          .json(Object.assign({ success: data.status }, data));
      }
    } catch (error) {
      next(error);
    }
  };


  async fetchPlayerInfo(req, res, next) {
    try {
      const data = await matchServices.fetchPlayerInfo(req);
      if (data.status === false) {
        return res
          .status(200)
          .json(Object.assign({ success: data.status }, data));
      } else {
        return res
          .status(200)
          .json(Object.assign({ success: data.status }, data));
      }
    } catch (error) {
      next(error);
    }
  };


  async fetchMegaWinners(req, res, next) {
    try {
      const data = await matchServices.fetchMegaWinners(req);

      if (data.status === false) {
        return res.status(200).json(Object.assign({ success: true }, data));
      } else {
        return res
          .status(200)
          .json(Object.assign({ success: data.status }, data));
      }
    } catch (error) {
      next(error);
    }
  };


  async fetchNewJoinedMatches(req, res, next) {
    try {
      const data = await matchServices.fetchNewJoinedMatches(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      console.log(error);
    }
  };


  async NewJoinedMatches(req, res, next) {
    try {
      const data = await matchServices.NewJoinedMatches(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      console.log(error);
    }
  };

  async leaderboardLiveRank(req, res, next) {
    try {
      const data = await matchServices.leaderboardLiveRank(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };



  async leaderboardSelfLiveRanks(req, res, next) {
    try {
      const data = await matchServices.leaderboardSelfLiveRanks(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };

  async matchlivedata(req, res, next) {
    try {
      const data = await matchServices.matchlivedata(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };

  async playersWithPlayingStatus(req, res, next) {
    try {
      const data = await matchServices.playersWithPlayingStatus(req);
      if (data.status === false) {
        return res
          .status(200)
          .json(Object.assign({ success: data.status }, data));
      } else {
        return res
          .status(200)
          .json(Object.assign({ success: data.status }, data));
      }
    } catch (error) {
      next(error);
    }
  };

  async recentWinnerWithoutRedis(req, res, next) {
    try {
      const data = await matchServices.recentWinnerWithoutRedis(req);
      return res.status(200).send(Object.assign({ success: true }));
    } catch (error) {
      next(error);
    }
  };
  async leaderboardCompletedMatch(req, res, next) {
    try {
      const data = await matchServices.leaderboardCompletedMatch(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };
};



module.exports = new matchController();
