const matchServices = require("../services/matchServices");
class matchController {
  constructor() {
    return {
      dbCheck: this.dbCheck.bind(this),
      fetchCompletedMatchesList: this.fetchCompletedMatchesList.bind(this),
      fetchCompletedDuoMatches: this.fetchCompletedDuoMatches.bind(this),
      fetchCompletedMatchData: this.fetchCompletedMatchData.bind(this),
      updatedCompltedMatchRedis: this.updatedCompltedMatchRedis.bind(this),
      playersFantasyScoreCard:
        this.playersFantasyScoreCard.bind(this),
      matchPlayerTeamsData:
        this.matchPlayerTeamsData.bind(this),
      fantasyScoreCardRedis: this.fantasyScoreCardRedis.bind(this),
      fetchRecentWinner: this.fetchRecentWinner.bind(this),
      fetchRecentWinnerWithoutRedis: this.fetchRecentWinnerWithoutRedis.bind(this),
      fetchPointSystemData: this.fetchPointSystemData.bind(this),
      fetchRecentContest: this.fetchRecentContest.bind(this),
      fetchUserRecentMatches: this.fetchUserRecentMatches.bind(this),
      fetchUserRecentMatchesNew: this.fetchUserRecentMatchesNew.bind(this),
      fetchFantasyScoreCardsRedis: this.fetchFantasyScoreCardsRedis.bind(this),
      matchPlayerTeamsDataRedis: this.matchPlayerTeamsDataRedis.bind(this),
      AllNewCompletedMatches: this.AllNewCompletedMatches.bind(this),
      addCompletedMatchInRedis: this.addCompletedMatchInRedis.bind(this),
      leaderboardOfCompletedMatch: this.leaderboardOfCompletedMatch.bind(this),
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

  async fetchCompletedMatchData(req, res, next) {
    try {
      const data = await matchServices.fetchCompletedMatchData(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };

  async fetchCompletedMatchesList(req, res, next) {
    try {
      const data = await matchServices.fetchCompletedMatchesList(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };

  async fetchCompletedDuoMatches(req, res, next) {
    try {
      const data = await matchServices.fetchCompletedDuoMatches(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };
  async AllNewCompletedMatches(req, res, next) {
    try {
      const data = await matchServices.AllNewCompletedMatches(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };
  async updatedCompltedMatchRedis(req, res, next) {
    try {
      const data = await matchServices.updatedCompltedMatchRedis(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };

  async playersFantasyScoreCard(req, res, next) {
    try {
      const data = await matchServices.playersFantasyScoreCard(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };

  async matchPlayerTeamsData(req, res, next) {
    try {
      const data = await matchServices.matchPlayerTeamsData(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };

  async matchPlayerTeamsDataRedis(req, res, next) {
    try {
      const data = await matchServices.matchPlayerTeamsDataRedis(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };
  async fantasyScoreCardRedis(req, res, next) {
    try {
      const data = await matchServices.fantasyScoreCardRedis(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };
  async fetchFantasyScoreCardsRedis(req, res, next) {
    try {
      const data = await matchServices.fetchFantasyScoreCardsRedis(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };

  async fetchRecentWinner(req, res, next) {
    try {
      const data = await matchServices.fetchRecentWinner(req);
      return res.status(200).send(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };

  async fetchRecentWinnerWithoutRedis(req, res, next) {
    try {
      const data = await matchServices.fetchRecentWinnerWithoutRedis(req);
      return res.status(200).send(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };

  async fetchPointSystemData(req, res, next) {
    try {
      const data = await matchServices.fetchPointSystemData(req);
      return res.status(200).send(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };

  async fetchRecentContest(req, res, next) {
    try {
      const data = await matchServices.fetchRecentContest(req);
      return res.status(200).send(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };

  async fetchUserRecentMatches(req, res) {
    try {
      const data = await matchServices.fetchUserRecentMatches(req);
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
  };
  async fetchUserRecentMatchesNew(req, res) {
    try {
      const data = await matchServices.fetchUserRecentMatchesNew(req);
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
  };
  async leaderboardOfCompletedMatch(req, res, next) {
    try {
      const data = await matchServices.leaderboardOfCompletedMatch(req);
      return res.status(200).send(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };

  async addCompletedMatchInRedis(req, res, next) {
    try {
      const data = await matchServices.addCompletedMatchInRedis(req);
      return res.status(200).send(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };
};



module.exports = new matchController();
