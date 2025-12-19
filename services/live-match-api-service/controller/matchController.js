const matchServices = require("../services/matchServices");
class matchController {
  constructor() {
    return {
      dbCheck: this.dbCheck.bind(this),
      fetchLiveScores: this.fetchLiveScores.bind(this),
      fetchMatchLiveScoreData: this.fetchMatchLiveScoreData.bind(this),
      fetchMatchLiveScore: this.fetchMatchLiveScore.bind(this),
      fetchLiveCommentary: this.fetchLiveCommentary.bind(this),
      fetchLiveMatches: this.fetchLiveMatches.bind(this),
      fetchLiveMatchJoinedData: this.fetchLiveMatchJoinedData.bind(this),
      fetchLiveMatchData: this.fetchLiveMatchData.bind(this),
      updateLiveMatchRedis: this.updateLiveMatchRedis.bind(this),
      fetchDuoLiveMatch: this.fetchDuoLiveMatch.bind(this),
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

  async fetchLiveScores(req, res, next) {
    try {
      const data = await matchServices.fetchLiveScores(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };

  async fetchMatchLiveScoreData(req, res, next) {
    try {
      const data = await matchServices.fetchMatchLiveScoreData(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };

  async updateLiveMatchRedis(req, res, next) {
    try {
      const data = await matchServices.updateLiveMatchRedis(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };


  async fetchLiveMatches(req, res, next) {
    try {
      const data = await matchServices.fetchLiveMatches(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };

  async fetchDuoLiveMatch(req, res, next) {
    try {
      const data = await matchServices.fetchDuoLiveMatch(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };

  async fetchLiveMatchJoinedData(req, res, next) {
    try {
      const data = await matchServices.fetchLiveMatchJoinedData(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };



  async fetchLiveMatchData(req, res, next) {
    try {
      const data = await matchServices.fetchLiveMatchData(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };

  async fetchMatchLiveScore(req, res, next) {
    try {
      const data = await matchServices.fetchMatchLiveScore(req);
      return res.status(200).send(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };

  async fetchLiveCommentary(req, res, next) {
    try {
      const data = await matchServices.fetchLiveCommentary(req);
      return res.status(200).send(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };
  async fantasyScoreCards(req, res, next) {
    try {
      const data = await matchServices.fantasyScoreCards(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };
};

module.exports = new matchController();
