const jwt = require('jsonwebtoken');
const userModel = require("../models/userModel");
const constant = require('../config/const_credential');
const configModel = require('../models/configModel');
const redisUser = require('../utils/redis/redisUser');
const redisMain = require('../utils/redis/redisMain');
const auth = async (req, res, next) => {
    try {
        const keyname = 'appSettingData';
        let appSetting = await redisMain.getkeydata(keyname);
        if (!appSetting) {
            appSetting = await configModel.findOne();
            redisMain.setkeydata(keyname, appSetting, 60 * 60 * 60 * 24);
        }

        const authHeader = req.header('Authorization');
        if (!authHeader) {
            return res.status(401).json({ success: false, status: false, msg: 'No token provided' });
        }
        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, global.constant.SECRET_TOKEN);
        if (!decoded) {
            throw new Error('Invalid token payload');
        }

        const userData = await redisUser.getUser(decoded._id);
        const platform = req.header('platform')?.toLowerCase();

        const isUserAllowed = appSetting?.mobileData?.includes(userData?.mobile);

        // Global Maintenance Check
        if (appSetting?.maintenance == 1 && !isUserAllowed) {
            return res.status(503).json({ success: false, status: false, msg: 'Maintenance Mode' });
        }

        // iOS-specific Maintenance Check
        if (platform === 'ios' && appSetting?.iOSmaintenance == 1 && !isUserAllowed) {
            return res.status(503).json({ success: false, status: false, msg: 'Maintenance Mode' });
        }

        // Session Validation
        if (userData?.auth_key !== token) {
            return res.status(401).json({ success: false, status: false, msg: 'User is already logged in on another device' });
        }

        // Admin Associated
        decoded.adminAssociated = userData?.adminAssociated || false;

        // Blocked User Check
        if (userData?.status === 'blocked') {
            return res.status(401).json({ success: false, status: false, msg: 'User is blocked' });
        }

        req.user = decoded;
        next();

    } catch (e) {
        console.log(e);
        return res.status(401).json({ success: false, status: false, msg: 'Invalid Token' });
    }
};

module.exports = auth;