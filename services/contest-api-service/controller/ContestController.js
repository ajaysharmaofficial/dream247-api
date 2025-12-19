const contestservices = require("../services/contestServices");

class contestController {
  constructor() {
    return {
      dbCheck: this.dbCheck.bind(this),
      fetchAllContests: this.fetchAllContests.bind(this),
      fetchContest: this.fetchContest.bind(this),
      myJoinedContests: this.myJoinedContests.bind(this),
      userLeaderboard: this.userLeaderboard.bind(this),
      JoinedUsersUpdate: this.JoinedUsersUpdate.bind(this),
      contestPriceUpdate: this.contestPriceUpdate.bind(this),
      fetchContestWithoutCategory: this.fetchContestWithoutCategory.bind(this),
      privateContestCreate: this.privateContestCreate.bind(this),
      joinContestByCode: this.joinContestByCode.bind(this),
      getAllNewContests: this.getAllNewContests.bind(this),
      getAllNewContestsRedis: this.getAllNewContestsRedis.bind(this),
      updateJoinedUsersWithRedisForChecking: this.updateJoinedUsersWithRedisForChecking.bind(this),
      contestFromRedisToDb: this.contestFromRedisToDb.bind(this),
      fetchAllNewContest: this.fetchAllNewContest.bind(this),
      fetchAllDuoContests: this.fetchAllDuoContests.bind(this),
      fetchAllFantasy: this.fetchAllFantasy.bind(this),
      substitutePlayerReplace: this.substitutePlayerReplace.bind(this),
      userSelfLeaderboard: this.userSelfLeaderboard.bind(this),
      fetchUsableBalance: this.fetchUsableBalance.bind(this),
      getContestRedis: this.getContestRedis.bind(this),
      fetchAllNewContestRedisForChecking: this.fetchAllNewContestRedisForChecking.bind(this),
      fetchAllNewContestsRedisJmeter: this.fetchAllNewContestsRedisJmeter.bind(this),



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

  async getAllNewContestsRedis(req, res, next) {
    try {
      const data = await contestservices.getAllNewContestsRedis(req);
      // console.log(`data`, data);
      if (data.status === false) {
        return res.status(200).json(Object.assign({ success: true }, data));
      } else {
        return res.status(200).json(Object.assign({ success: true }, data));
      }
    } catch (error) {
      console.log(error);
      next(error);
    }
  };

  async updateJoinedUsersWithRedisForChecking(req, res, next) {
    try {
      const data = await contestservices.updateJoinedUsersWithRedisForChecking(req);
      // console.log(`data`, data);
      if (data.status === false) {
        return res.status(200).json(Object.assign({ success: true }, data));
      } else {
        return res.status(200).json(Object.assign({ success: true }, data));
      }
    } catch (error) {
      console.log(error);
      next(error);
    }
  };

  async fetchAllNewContest(req, res, next) {
    try {
      const data = await contestservices.fetchAllNewContest(req);
      if (data.status === false) {
        return res.status(200).json(Object.assign({ success: true }, data));
      } else {
        return res.status(200).json(Object.assign({ success: true }, data));
      }
    } catch (error) {
      console.log(error);
      next(error);
    }
  };

  async fetchAllDuoContests(req, res, next) {
    try {
      const data = await contestservices.fetchAllDuoContests(req);
      // console.log(`data`, data);
      if (data.status === false) {
        return res.status(200).json(Object.assign({ success: true }, data));
      } else {
        return res.status(200).json(Object.assign({ success: true }, data));
      }
    } catch (error) {
      console.log(error);
      next(error);
    }
  };

  async fetchAllNewContestsRedisJmeter(req, res, next) {
    try {
      const data = await contestservices.fetchAllNewContestsRedisJmeter(req);
      // console.log(`data`, data);
      if (data.status === false) {
        return res.status(200).json(Object.assign({ success: true }, data));
      } else {
        return res.status(200).json(Object.assign({ success: true }, data));
      }
    } catch (error) {
      console.log(error);
      next(error);
    }
  };

  async fetchAllNewContestRedisForChecking(req, res, next) {
    try {
      const data = await contestservices.fetchAllNewContestRedisForChecking(req);
      // console.log(`data`, data);
      if (data.status === false) {
        return res.status(200).json(Object.assign({ success: true }, data));
      } else {
        return res.status(200).json(Object.assign({ success: true }, data));
      }
    } catch (error) {
      console.log(error);
      next(error);
    }
  };

  async contestFromRedisToDb(req, res, next) {
    try {
      const data = await contestservices.contestFromRedisToDb(req);
      // console.log(`data`, data);
      if (data.status === false) {
        return res.status(200).json(Object.assign({ success: true }, data));
      } else {
        return res.status(200).json(Object.assign({ success: true }, data));
      }
    } catch (error) {
      console.log(error);
      next(error);
    }
  };

  async getAllNewContests(req, res, next) {
    try {
      const data = await contestservices.getAllNewContests(req);
      // console.log(`data`, data);
      if (data.status === false) {
        return res.status(200).json(Object.assign({ success: true }, data));
      } else {
        return res.status(200).json(Object.assign({ success: true }, data));
      }
    } catch (error) {
      console.log(error);
      next(error);
    }
  };

  async fetchUsableBalance(req, res, next) {
    try {
      // console.log(`here`, req.user._id);
      const data = await contestservices.fetchUsableBalance(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      console.log(error);
      next(error);
    }
  };

  async fetchAllContests(req, res, next) {
    try {
      // contestservices.fetchAllContests(req);
      const data = await contestservices.fetchAllContests(req);
      // console.log(`data`, data);
      if (data.status === false) {
        return res.status(200).json(Object.assign({ success: true }, data));
      } else {
        return res.status(200).json(Object.assign({ success: true }, data));
      }
    } catch (error) {
      console.log(error);
      next(error);
    }
  };

  async fetchContest(req, res, next) {
    try {
      const data = await contestservices.fetchContest(req);
      if (data.status === false) {
        return res.status(200).json(Object.assign({ success: true }, data));
      } else {
        return res.status(200).json(Object.assign({ success: true }, data));
      }
    } catch (error) {
      console.log(error);
      next(error);
    }
  };

  async getContestRedis(req, res, next) {
    try {
      const data = await contestservices.getContestRedis(req);
      if (data.status === false) {
        return res.status(200).json(Object.assign({ success: true }, data));
      } else {
        return res.status(200).json(Object.assign({ success: true }, data));
      }
    } catch (error) {
      console.log(error);
      next(error);
    }
  };



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


  async userLeaderboard(req, res, next) {
    try {
      // console.log(`here`, req.user._id);
      const data = await contestservices.userLeaderboard(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      console.log(error);
      next(error);
    }
  };
  async userSelfLeaderboard(req, res, next) {
    try {
      // console.log(`here`, req.user._id);
      const data = await contestservices.userSelfLeaderboard(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      console.log(error);
      next(error);
    }
  };

  async JoinedUsersUpdate(req, res, next) {
    try {
      // console.log(`here`, req.user._id);
      const data = await contestservices.JoinedUsersUpdate(req);
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


  async contestPriceUpdate(req, res, next) {
    try {
      // console.log(`here`, req.user._id);
      const data = await contestservices.contestPriceUpdate(req);
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



  async fetchContestWithoutCategory(req, res, next) {
    try {
      // console.log(`here`, req.user._id);
      const data = await contestservices.fetchContestWithoutCategory(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      console.log(error);
      next(error);
    }
  };

  async privateContestCreate(req, res, next) {
    try {
      // console.log(`here`, req.user._id);
      const data = await contestservices.privateContestCreate(req);
      return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
      console.log(error);
      next(error);
    }
  };

  /**
* route: /fetchAllFantasy
*its controller is used to get All New Contests
* @param {object} req http request object
* @returns {object} result
*/
  async fetchAllFantasy(req, res, next) {
    try {
      const data = await contestservices.fetchAllFantasy(req);
      // console.log(`data`, data);
      if (data.status === false) {
        return res.status(200).json(Object.assign({ success: true }, data));
      } else {
        return res.status(200).json(Object.assign({ success: true }, data));
      }
    } catch (error) {
      console.log(error);
      next(error);
    }
  };

  async joinContestByCode(req, res, next) {
    try {

      const data = await contestservices.joinContestByCode(req);
      return res
        .status(200)
        .json(Object.assign({ success: data.status }, data));
    } catch (error) {
      console.log(error);
      next(error);
    }
  };

  async substitutePlayerReplace(req, res, next) {
    try {
      const data = await contestservices.substitutePlayerReplace(req);
      return res
        .status(200)
        .json(Object.assign({ success: data.status }, data));
    } catch (error) {
      console.log(error);
    }
  };

};

module.exports = new contestController();
