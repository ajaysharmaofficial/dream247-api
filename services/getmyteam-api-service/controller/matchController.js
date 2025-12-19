const matchServices = require("../services/matchServices");

class matchController {
  constructor() {
    return {
      dbCheck: this.dbCheck.bind(this),
      createUserTeam: this.createUserTeam.bind(this),
      createUserTeamTest: this.createUserTeamTest.bind(this),
      fetchUserTeams: this.fetchUserTeams.bind(this),
      getUserTeamData: this.getUserTeamData.bind(this),
      fetchUserTeamsNew: this.fetchUserTeamsNew.bind(this),
      setRedisTeam: this.setRedisTeam.bind(this),
      syncTeamRedisToDb: this.syncTeamRedisToDb.bind(this),
      fetchLiveUserTeams: this.fetchLiveUserTeams.bind(this),
      getUserLiveTeamData: this.getUserLiveTeamData.bind(this),
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

  async createUserTeam(req, res, next) {
    try {
      const data = await matchServices.createUserTeam(req);
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

  async createUserTeamTest(req, res, next) {
    try {
      const data = await matchServices.createUserTeamTest(req);
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

  async fetchUserTeams(req, res, next) {
    try {
      const data = await matchServices.fetchUserTeams(req);
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

  async fetchLiveUserTeams(req, res, next) {
    try {
      const data = await matchServices.fetchLiveUserTeams(req);
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


  async setRedisTeam(req, res, next) {
    try {
      const data = await matchServices.setRedisTeam(req);
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

  async syncTeamRedisToDb(req, res, next) {
    try {
      const data = await matchServices.syncTeamRedisToDb(req);
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

  async getUserTeamData(req, res, next) {
    try {
      const data = await matchServices.getUserTeamData(req);
      return res.status(200).send(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }

  };

  async getUserLiveTeamData(req, res, next) {
    try {
      const data = await matchServices.getUserLiveTeamData(req);
      return res.status(200).send(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }

  };

  async fetchUserTeamsNew(req, res, next) {
    try {
      const data = await matchServices.fetchUserTeamsNew(req);
      return res.status(200).send(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };
};



module.exports = new matchController();
