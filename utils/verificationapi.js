const axios = require("axios");
const userModel = require("../models/userModel");
const branchInfoModel = require("../models/branchInfoModel");
const redisMain = require("./redis/redisMain");

const SANDBOX_TOKEN_KEY = "sandbox_auth_token";
const SANDBOX_TOKEN_TTL = 55 * 60; // 55 minutes

async function getSandboxToken() {
  try {
    const cachedToken = await redisMain.getkeydata(SANDBOX_TOKEN_KEY);
    if (cachedToken) {
      return cachedToken;
    }
    const response = await axios.post(
      "https://api.sandbox.co.in/authenticate",
      {},
      {
        headers: {
          "x-api-key": global.constant.sanboxclientid,
          "x-api-secret": global.constant.sanboxclientsecret,
          "Content-Type": "application/json",
        },
      }
    );
    const token = response.data.access_token;

    await redisMain.setkeydata(SANDBOX_TOKEN_KEY, token, SANDBOX_TOKEN_TTL);
    return token;
  } catch (error) {
    console.error(
      "Sandbox Auth Token Error:",
      error?.response?.data || error.message
    );
    throw new Error("Failed to generate Sandbox auth token");
  }
}


exports.aadhaarGenerateOtp = async (req, res) => {
  try {
    const { aadharnumber } = req.body;

    if (!aadharnumber) {
      return {
        status: false,
        message: "Aadhaar number is required",
        data: {},
      };
    }

    const token = await getSandboxToken();
    const response = await axios.post(
      "https://api.sandbox.co.in/kyc/aadhaar/okyc/otp",
      {
        "@entity": "in.co.sandbox.kyc.aadhaar.okyc.otp.request",
        aadhaar_number: aadharnumber,
        consent: "Y",
        reason: "Aadhaar verification",
      },
      {
        headers: {
          Authorization: token,
          "x-api-key": global.constant.sanboxclientid,
          "Content-Type": "application/json",
        },
      }
    );
    return {
      status: true,
      message: "Aadhaar OTP sent successfully",
      data: response.data,
    };

  } catch (error) {
    return {
      status: false,
      message: error?.response?.data?.message || "OTP generation failed",
      data: error?.response?.data || {},
    };
  }
};


exports.aadhaarVerifyOtp = async (req, res) => {
  try {
    const { ref_id, otp } = req.body;

    if (!ref_id || !otp) {
      return {
        status: false,
        message: "ref_id and otp are required",
        data: {},
      };
    }

    const token = await getSandboxToken();

    const response = await axios.post(
      "https://api.sandbox.co.in/kyc/aadhaar/okyc/otp/verify",
      {
        "@entity": "in.co.sandbox.kyc.aadhaar.okyc.request",
        reference_id: ref_id,
        otp,
      },
      {
        headers: {
          Authorization: token,
          "x-api-key": global.constant.sanboxclientid,
          "Content-Type": "application/json",
        },
      }
    );
    return {
      status: true,
      message: "Aadhaar verified successfully",
      data: response.data,
    };

  } catch (error) {
    return {
      status: false,
      message: error?.response?.data?.message || "OTP verification failed",
      data: error?.response?.data || {},
    };
  }
};

exports.pancardVerify = async (req, res) => {
  try {
    const { pannumber, name, dob } = req.body;

    if (!pannumber || !name || !dob) {
      return {
        status: false,
        message: "PAN number, name and DOB are required",
        data: {},
      };
    }

    const token = await getSandboxToken();

    const response = await axios.post(
      "https://api.sandbox.co.in/kyc/pan/verify",
      {
        "@entity": "in.co.sandbox.kyc.pan_verification.request",
        pan: pannumber,
        name_as_per_pan: name,
        date_of_birth: dob,
        consent: "Y",
        reason: "PAN KYC verification",
      },
      {
        headers: {
          Authorization: token,
          "x-api-key": global.constant.sanboxclientid,
          "Content-Type": "application/json",
        },
      }
    );
    return {
      status: true,
      message: "PAN verification successful",
      data: response.data,
    };

  } catch (error) {
    return {
      status: false,
      message: error?.response?.data?.message || "PAN verification failed",
      data: error?.response?.data || {},
    };
  }
};

exports.bankRequest = async (req) => {
  try {
    const { accno, ifsc } = req.body;

    if (!accno || !ifsc) {
      return {
        status: false,
        message: "Bank account number and IFSC are required",
      };
    }

    const token = await getSandboxToken();

    const response = await axios.post(
      "https://api.sandbox.co.in/kyc/bank/verify",
      {
        "@entity": "in.co.sandbox.kyc.bank_verification.request",
        bank_account_number: accno,
        bank_ifsc_code: ifsc,
        consent: "Y",
        reason: "Bank account verification"
      },
      {
        headers: {
          Authorization: token,
          "x-api-key": global.constant.sanboxclientid,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      status: true,
      message: "Bank verification successful",
      data: response.data,
    };

  } catch (error) {
    console.error(
      "Sandbox Bank Verification Error:",
      error?.response?.data || error.message
    );

    return {
      status: false,
      message: error?.response?.data?.message || "Bank verification failed",
      data: error?.response?.data || {},
    };
  }
};

