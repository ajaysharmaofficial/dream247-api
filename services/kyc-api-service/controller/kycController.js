const kycService = require('../services/kycService.js');

exports.dbCheck = async(req, res) => {
    try {
        const data = await kycService.dbCheck();

        if (data && data.status) {
            return res.status(200).json({ data });
        } else {
            return res.status(200).json({ data });
        }
    } catch (error) {
        console.error("Error:", error);
        return res.status(200).json({ data });
    }
}

exports.socialAuthenticate = async(req, res) => {
    try {
        const data = await kycService.socialAuthenticate(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data, 
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}

exports.adharCardSentOtp = async(req, res) => {
    try {
        const data = await kycService.adharCardSentOtp(req);
      if (data.status == "SUCCESS") {
        data.status = true;
      } else {
        data.status = false;
      }
      return res
        .status(200)
        .json(Object.assign({ success: true, status: true }, data));
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}

exports.adharcardVeifyOtp = async(req, res) => {
    try {
        const data = await kycService.adharcardVeifyOtp(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data, 
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}

exports.aadharDetails = async(req, res) => {
    try {
        const data = await kycService.aadharDetails(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data, 
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}

exports.panVerfication = async(req, res) => {
    try {
        const data = await kycService.panVerfication(req);
        return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}

exports.panDetails = async(req, res) => {
    try {
        const data = await kycService.panDetails(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data, 
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}

exports.bankVerificationReq = async(req, res) => {
    try {
        const data = await kycService.bankVerificationReq(req);
        return res.status(200).json(Object.assign({ success: true }, data));
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}

exports.fetchBankDetails = async(req, res) => {
    try {
        const data = await kycService.fetchBankDetails(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data, 
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}

exports.kycFullDetails = async(req, res) => {
    try {
        const data = await kycService.kycFullDetails(req);

        if (data && data.status) {
            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data, 
            });
        } else {
            return res.status(200).json({
                success: false,
                message: data.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
}
