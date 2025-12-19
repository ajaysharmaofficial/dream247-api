const AdminModel = require('../models/adminModel');

module.exports = class GetBonus {
    async getBonus(type, verify) {
        let getBouns;
        const superadmin = await AdminModel.findOne({ role: '0' });
        // console.log(`superadmin`, superadmin, `------type-------${type}-------------, ${verify}`);
        getBouns = superadmin.general_tabs;

        const bonus = getBouns.find((item) => item.type === type);
        console.log(`bonus`, getBouns, type);
        return bonus && verify == 0 ? bonus.amount : 0;
    }
    async getSignupReward(type, verify) {
        let getBouns;
        const superadmin = await AdminModel.findOne({ role: '0' });
        // console.log(`superadmin`, superadmin, `------type-------${type}-------------, ${verify}`);
        getBouns = superadmin.general_tabs;
        console.log(`bonus1`, getBouns, type, '2');
        const bonus = getBouns.find((item) => item.type === type);
        return bonus && verify == 0 ? { Balance: Number(bonus.amount), Bonus: Number(bonus.amount) } : 0;
    }
}