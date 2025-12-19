const contestservices = require("../services/contestServices");

class contestController {
  constructor() {
    return {
      dbCheck: this.dbCheck.bind(this),
      myJoinedContests: this.myJoinedContests.bind(this),
      userJoinContest: this.userJoinContest.bind(this),
      joinUserUpdate: this.joinUserUpdate.bind(this),
      userJoinContestOld: this.userJoinContestOld.bind(this),
      userJoinContestRedisNew: this.userJoinContestRedisNew.bind(this),
      userJoinDuoContest: this.userJoinDuoContest.bind(this),

    };
  }

  async dbCheck(req, res, next) {
    try {
      const data = await contestservices.dbCheck(req);
      return res
        .status(200)
        .json(Object.assign({ success: data.status }, data));
    } catch (error) {
      next(error);
    }
  }

  async myJoinedContests(req, res, next) {
    try {
      // console.log(`here`, req.user._id);
      const data = await contestservices.myJoinedContests(req);
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

  async userJoinContest(req, res, next) {
    try {
      // console.log(`here`, req.user._id);
      const data = await contestservices.userJoinContest(req);
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

  async userJoinDuoContest(req, res, next) {
    try {
      // console.log(`here`, req.user._id);
      const data = await contestservices.userJoinDuoContest(req);
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

  async userJoinContestRedisNew(req, res, next) {
    try {
      // console.log(`here`, req.user._id);
      const data = await contestservices.userJoinContestRedisNew(req);
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
  async userJoinContestOld(req, res, next) {
    try {
      // console.log(`here`, req.user._id);
      const data = await contestservices.userJoinContestOld(req);
      console.log('data', data);
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

  async joinUserUpdate(req, res, next) {
    try {
      // console.log(`here`, req.user._id);
      const data = await contestservices.joinUserUpdate(req);
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

};

module.exports = new contestController();
