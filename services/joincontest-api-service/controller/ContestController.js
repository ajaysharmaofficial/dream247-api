const contestservices = require("../services/contestServices");

class contestController {
  constructor() {
    return {
      dbCheck: this.dbCheck.bind(this),
      joinContest: this.joinContest.bind(this),
      contestJoin: this.contestJoin.bind(this),
      duoContestJoined: this.duoContestJoined.bind(this),
      closedJoinDuoContest: this.closedJoinDuoContest.bind(this),
      replaceDuoPlayer: this.replaceDuoPlayer.bind(this),
      joinContestNew: this.joinContestNew.bind(this),
      closedJoinContest: this.closedJoinContest.bind(this),
      contestJoinedByCode: this.contestJoinedByCode.bind(this),
      updateContestCount: this.updateContestCount.bind(this)

    };
  }
  async dbCheck(req, res, next) {
    try {
      const data = await contestservices.dbCheck(req);
      const statusCode = data.status ? 200 : 500;
      return res
        .status(statusCode)
        .json(Object.assign({ success: data.status }, data));
    } catch (error) {
      next(error);
    }
  }

  async joinContest(req, res, next) {
    try {
      // console.log(`here`, req.user._id);
      const data = await contestservices.joinContest(req);
      if (data.status === false) {
        return res
          .status(200)
          .json(Object.assign({ success: data.status }, data));
      } else {
        return res.status(200).json(Object.assign({ success: true }, data));
      }
    } catch (error) {
      console.log(error);
      next(error);
    }
  };
  async joinContest(req, res, next) {
    try {
      // console.log(`here`, req.user._id);
      const data = await contestservices.joinContest(req);
      if (data.status === false) {
        return res
          .status(200)
          .json(Object.assign({ success: data.status }, data));
      } else {
        return res.status(200).json(Object.assign({ success: true }, data));
      }
    } catch (error) {
      console.log(error);
      next(error);
    }
  };
  async contestJoin(req, res, next) {
    try {
      // console.log(`here`, req.user._id);
      const data = await contestservices.contestJoin(req);
      if (data.status === false) {
        return res
          .status(200)
          .json(Object.assign({ success: data.status }, data));
      } else {
        return res.status(200).json(Object.assign({ success: true }, data));
      }
    } catch (error) {
      console.log(error);
      next(error);
    }
  };

  async duoContestJoined(req, res, next) {
    try {
      // console.log(`here`, req.user._id);
      const data = await contestservices.duoContestJoined(req);
      if (data.status === false) {
        return res
          .status(200)
          .json(Object.assign({ success: data.status }, data));
      } else {
        return res.status(200).json(Object.assign({ success: true }, data));
      }
    } catch (error) {
      console.log(error);
      next(error);
    }
  };

  async closedJoinDuoContest(req, res, next) {
    try {
      // console.log(`here`, req.user._id);
      const data = await contestservices.closedJoinDuoContest(req);
      if (data.status === false) {
        return res
          .status(200)
          .json(Object.assign({ success: data.status }, data));
      } else {
        return res.status(200).json(Object.assign({ success: true }, data));
      }
    } catch (error) {
      console.log(error);
      next(error);
    }
  };

  async replaceDuoPlayer(req, res, next) {
    try {
      // console.log(`here`, req.user._id);
      const data = await contestservices.replaceDuoPlayer(req);
      if (data.status === false) {
        return res
          .status(200)
          .json(Object.assign({ success: data.status }, data));
      } else {
        return res.status(200).json(Object.assign({ success: true }, data));
      }
    } catch (error) {
      console.log(error);
      next(error);
    }
  };

  async joinContestNew(req, res, next) {
    try {
      // console.log(`here`, req.user._id);
      const data = await contestservices.joinContestNew(req);
      if (data.status === false) {
        return res
          .status(200)
          .json(Object.assign({ success: data.status }, data));
      } else {
        return res.status(200).json(Object.assign({ success: true }, data));
      }
    } catch (error) {
      console.log(error);
      next(error);
    }
  };

  async closedJoinContest(req, res, next) {
    try {
      // console.log(`here`, req.user._id);
      const data = await contestservices.closedJoinContest(req);
      if (data.status === false) {
        return res
          .status(200)
          .json(Object.assign({ success: data.status }, data));
      } else {
        return res.status(200).json(Object.assign({ success: true }, data));
      }
    } catch (error) {
      console.log(error);
      next(error);
    }
  };

  async contestJoinedByCode(req, res, next) {
    try {
      console.log(
        "-----------------------------contestJoinedByCode-------------------"
      );
      const data = await contestservices.contestJoinedByCode(req);
      return res
        .status(200)
        .json(Object.assign({ success: data.status }, data));
    } catch (error) {
      console.log(error);
      next(error);
    }
  };
  async updateContestCount(req, res, next) {
    try {
      console.log(
        "-----------------------------updateContestCount-------------------"
      );
      const data = await contestservices.updateContestCount(req);
      return res
        .status(200)
        .json(Object.assign({ success: data.status }, data));
    } catch (error) {
      console.log(error);
      next(error);
    }
  };
};

module.exports = new contestController();
