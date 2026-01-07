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
    console.log(response.data);
    const token = response.data.token;

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
          Authorization: `Bearer ${token}`,
          "x-api-key": global.constant.sanboxclientid,
          "Content-Type": "application/json",
        },
      }
    );
    console.log(response.data);
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
          Authorization: `Bearer ${token}`,
          "x-api-key": global.constant.sanboxclientid,
          "Content-Type": "application/json",
        },
      }
    );
    console.log(response.data);
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
          Authorization: `Bearer ${token}`,
          "x-api-key": global.constant.sanboxclientid,
          "Content-Type": "application/json",
        },
      }
    );
    console.log(response.data);
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

    const payload = {
      task_id: "bank_verify_" + Date.now(),
      group_id: "bank_group_" + Date.now(),
      data: {
        bank_account_no: accno,
        bank_ifsc_code: ifsc,
        nf_verification: false, // optional
      },
    };

    const config = {
      method: "post",
      url: "https://eve.idfy.com/v3/tasks/async/verify_with_source/bank_account",
      headers: {
        "x-client-id": global.constant.idfyaccountid,
        "x-client-secret": global.constant.idfyaccountsecret,
        "Content-Type": "application/json",
      },
      data: payload,
    };

    const response = await axios.request(config);
    console.log("response", response);
    return {
      status: true,
      message: "Bank verification request submitted successfully",
      data: response.data,
    };

  } catch (error) {
    console.error(
      "Bank Verification Error:",
      error?.response?.data || error.message
    );

    return {
      status: false,
      message: "Bank verification failed",
      error: error?.response?.data || error.message,
    };
  }
};

