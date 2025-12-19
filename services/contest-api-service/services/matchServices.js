
const moment = require("moment");

class matchServices {
  constructor() {
    return {
      getMatchTime: this.getMatchTime.bind(this),
    };
  }
  

  async getMatchTime(start_date) {
    const currentdate = new Date();
    const ISTTime = moment().format("YYYY-MM-DD HH:mm:ss");
    if (ISTTime >= start_date) {
      return false;
    } else {
      return true;
    }
  }

}

module.exports = new matchServices();
