const contestservices = require("../services/contestServices");

class contestController {
  constructor() {
    return {
      changeTeams: this.changeTeams.bind(this)
    };
  }

  async changeTeams(req, res, next) {
    try {
      // console.log(`here`, req.user._id);
      const data = await contestservices.changeTeams(req);
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
