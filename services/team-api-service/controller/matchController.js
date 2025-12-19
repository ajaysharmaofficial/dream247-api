const matchServices = require("../services/matchServices");

class matchController {
  constructor() {
    return {
      dbCheck: this.dbCheck.bind(this),
      updatedMatchData: this.updatedMatchData.bind(this),
      showTeam: this.showTeam.bind(this),
      joinTeamPlayerDetails: this.joinTeamPlayerDetails.bind(this),
      compareTeam: this.compareTeam.bind(this),
      fetchDreamTeam: this.fetchDreamTeam.bind(this),
      fetchGuruTeam: this.fetchGuruTeam.bind(this),
      fetchMyTeam: this.fetchMyTeam.bind(this),
      fetchMyCompleteMatchTeam: this.fetchMyCompleteMatchTeam.bind(this),
      showTeamNew: this.showTeamNew.bind(this),
      showLiveTeam: this.showLiveTeam.bind(this),
      getUserContestTeamCount: this.getUserContestTeamCount.bind(this)
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

  async updatedMatchData(req, res, next) {
    try {
      const data = await matchServices.updatedMatchData(req);
      return res
        .status(200)
        .json(Object.assign({ success: data.status }, data));
    } catch (error) {
      next(error);
    }
  }

  async fetchMyTeam(req, res, next) {
    try {
      const data = await matchServices.fetchMyTeam(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };

  async showTeam(req, res, next) {
    try {
      const data = await matchServices.showTeam(req);
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

  async showLiveTeam(req, res, next) {
    try {
      const data = await matchServices.showLiveTeam(req);
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



  async joinTeamPlayerDetails(req, res, next) {
    try {
      const data = await matchServices.joinTeamPlayerDetails(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };

  async compareTeam(req, res, next) {
    try {
      const data = await matchServices.compareTeam(req);
      return res.status(200).send(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  }

  async fetchDreamTeam(req, res, next) {
    try {
      const data = await matchServices.fetchDreamTeam(req);
      return res.status(200).send(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  }

  async getUserContestTeamCount(req, res, next) {
    try {
      const data = await matchServices.getUserContestTeamCount(req);
      return res.status(200).send(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  }

  async fetchGuruTeam(req, res, next) {
    try {
      const data = await matchServices.fetchGuruTeam(req);
      return res.status(200).send(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }

  };

  async fetchMyCompleteMatchTeam(req, res, next) {
    try {
      const data = await matchServices.fetchMyCompleteMatchTeam(req);
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

  async showTeamNew(req, res, next) {
    try {
      const data = await matchServices.showTeamNew(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      next(error);
    }
  };
};

module.exports = new matchController();
