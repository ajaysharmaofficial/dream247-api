const axios = require("axios");
const userModel = require("../models/userModel");
const branchInfoModel = require("../models/branchInfoModel");
const redisMain = require("./redis/redisMain");

exports.aadhaarSendOtp = async (req, res) => {
  try {
    let data = JSON.stringify({
      aadhaar_number: req.body.aadharnumber,
    });

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: "https://api.cashfree.com/verification/offline-aadhaar/otp",
      headers: {
        "x-client-id": `${global.constant.idfyaccountid}`,
        "x-client-secret": `${global.constant.idfyaccountid}`,
        "Content-Type": "application/json",
      },
      data: data,
    };

    let response = await axios.request(config);
    return response.data;
  } catch (error) {
    console.log(error);
    if (error.response) {
      // The request was made and the server responded with a status code
      // outside the range of 2xx
      console.error("Third-party API Error:", error.response.data);
      return {
        message: `${error.response.data.message}.` || "Third-party API error.",
        status: false,
        data: {},
      };
    } else if (error.request) {
      // The request was made but no response was received
      console.error("No response received from third-party API:", error.request);
      return {
        message: "No response received from third-party API. Please try again later.",
        status: false,
        data: {},
      };
    } else {
      // Something else happened while setting up the request
      console.error("Unexpected Error:", error.message);
      return {
        message: "An unexpected error occurred. Please try again.",
        status: false,
        data: {},
      };
    }
  }
};

exports.aadhaarSendOtpVerify = async (req, res) => {
  try {
    let data = JSON.stringify({
      otp: req.body.otp,
      ref_id: req.body.ref_id,
    });

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: "https://api.cashfree.com/verification/offline-aadhaar/verify",
      headers: {
        "x-client-id": global.constant.idfyaccountid,
        "x-client-secret": global.constant.idfyaccountid,
        "Content-Type": "application/json",
      },
      data: data,
    };

    let response = await axios.request(config);
    // console.log("-----aadharotpverify------", response.data);

    // Handle specific statuses and messages
    if (response.data.status !== "VALID") {
      return {
        message: response.data.message || "OTP verification failed.",
        status: false,
        data: response.data,
      };
    }

    return response.data;
  } catch (error) {
    console.log(error);

    // Differentiating error cases
    if (error.response) {
      console.error("Third-party API Error:", error.response.data);
      return {
        message: `${error.response.data.message}.` || "Third-party API error.",
        status: false,
        data: error.response.data,
      };
    } else if (error.request) {
      console.error("No response received from third-party API:", error.request);
      return {
        message: "No response received from the Aadhaar verification service. Please try again later.",
        status: false,
        data: {},
      };
    } else {
      console.error("Unexpected Error:", error.message);
      return {
        message: "An unexpected error occurred. Please try again.",
        status: false,
        data: {},
      };
    }
  }
};

exports.pancardVerify = async (req, res) => {
  try {
    // Prepare the data for PAN verification
    let data = JSON.stringify({
      pan: req.body.pannumber,
      name: req.body.name,
      value: {
        pan: req.body.pannumber,
        name: req.body.name,
      },
    });

    const payload = {
      task_id: "pan_verification_" + Date.now(),
      group_id: "pan_group_" + Date.now(),
      data: {
        id_number: pannumber,
        full_name: name,
        dob: dob, // yyyy-mm-dd
      },
    };

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: "https://eve.idfy.com/v3/tasks/async/verify_with_source/ind_pan",
      headers: {
        "account-d": global.constant.idfyaccountid,
        "api-key": global.constant.idfyapikey,
        "Content-Type": "application/json",
      },
      data: payload,
    };

    // Hit the PAN verification API
    let response = await axios.request(config);
    console.log("PAN Request Response:", response);

    // Check if PAN is successfully verified
    if (response.data.valid) {
      const panresponse = response.data;
        return {
          status: true,
          message: "PAN verification successful.",
          data: {
            pan_response: panresponse,
          },
        };
    } else {
      return {
        status: false,
        message: `Enter valid PAN.`,
        data: response.data,
      };
    }
  } catch (error) {
    console.log("PAN Verification Error:", error);
  }
};

// exports.bankRequest = async (req) => {
//   try {
//     let config = {
//       method: "post",
//       maxBodyLength: Infinity,
//       url: "https://payout-api.cashfree.com/payout/v1/authorize",
//       headers: {
//         "x-client-id": global.constant.idfyaccountid,
//         "x-client-secret": global.constant.idfyaccountid,
//       },
//     };

//     let responseauth = await axios.request(config);
//     // console.log(responseauth, "--------bank--------responseauthorize--------");

//     if (responseauth) {
//       let data = "";

//       // Step 1: Validate IFSC Code using Cashfree's IFSC validation API
//       let ifscValidationConfig = {
//         method: "get",
//         maxBodyLength: Infinity,
//         url: `https://payout-api.cashfree.com/payout/v1/ifsc/${req.body.ifsc}`,
//         headers: {
//           "x-client-id": global.constant.idfyaccountid,
//           "x-client-secret": global.constant.idfyaccountid,
//           Authorization: `Bearer ${responseauth.data.data.token}`,
//         },
//         data: data,
//       };

//       let ifscResponse = await axios.request(ifscValidationConfig);
//       // console.log("------------validation/ifsc-------------", ifscResponse);

//       // Check if IFSC validation is successful
//       if (!ifscResponse.data || ifscResponse.data.status !== "SUCCESS") {
//         return {
//           status: false,
//           message: `${ifscResponse.data.message}`,
//           data: {},
//         };
//       }

//       if (ifscResponse.data.data.imps == 'Live' || ifscResponse.data.data.neft === 'Live') {
//         let obj = {
//           bank: ifscResponse.data.data.bank,
//           ifsc: ifscResponse.data.data.ifsc,
//           neft: ifscResponse.data.data.neft === 'Live',
//           imps: ifscResponse.data.data.imps === 'Live',
//           rtgs: ifscResponse.data.data.rtgs === 'Live',
//           upi: ifscResponse.data.data.upi === 'Live',
//           address: ifscResponse.data.data.address,
//           city: ifscResponse.data.data.city,
//           state: ifscResponse.data.data.state,
//           branch: ifscResponse.data.data.branch
//         };
        
//         let keyname = `bank-branches`;
//         let redisdata = await redisMain.getkeydata(keyname);
        
//         let branches = redisdata ? JSON.parse(redisdata) : [];
        
//         let existsInRedis = branches.some(item =>
//           item.ifsc === obj.ifsc && item.branch === obj.branch
//         );
        
//         if (!existsInRedis) {
//           let existingBranch = await branchInfoModel.findOne({ ifsc: obj.ifsc });
        
//           if (!existingBranch) {
//             let bb = await branchInfoModel.create(obj);
//             console.log("await branchInfoModel.create(obj);", bb);
//           }
        
//           branches.push(obj);
        
//           await redisMain.setkeydata(keyname, JSON.stringify(branches), 432000);
//         }
        
//       } else {
//         return {
//           status: false,
//           message: "IMPS and NEFT payment modes are not available for your bank branch. Please try with a different bank.",
//           data: {}
//         };
//       }      
        
//       let config1 = {
//         method: "get",
//         maxBodyLength: Infinity,
//         url: `https://payout-api.cashfree.com/payout/v1.2/validation/bankDetails?&bankAccount=${req.body.accno}&ifsc=${req.body.ifsc}`,
//         headers: {
//           "x-client-id": global.constant.idfyaccountid,
//           "x-client-secret": global.constant.idfyaccountid,
//           Authorization: `Bearer ${responseauth.data.data.token}`,
//         },
//         data: data,
//       };

//       let response = await axios.request(config1);
//       // console.log("------------validation/bankDetails-------------", response);

//       if (!response.data || response.data.accountStatusCode == "INVALID_BANK_ACCOUNT") {
//         return {
//           status: false,
//           message: `${response.data.message}`,
//           data: {},
//         };
//       }

//       const { bankName, branch, micr } = response.data.data;

//       // Check for invalid IFSC code or bank details
//       if (bankName === "NOT_AVAILABLE" || branch === "NOT_AVAILABLE") {
//         return {
//           status: false,
//           message: "Invalid IFSC code or bank details",
//           data: response.data,
//         };
//       }

//       const user = await userModel.findOne({ _id: req.user._id });
//       const randomString =
//         "ABC" + Math.random().toString(36).substr(2, 5).toUpperCase();

//       let data11 = JSON.stringify({
//         verification_id: randomString,
//         name_1: response.data.data.nameAtBank,
//         name_2: user.aadharcard.aadhar_name,
//       });

//       let config111 = {
//         method: "post",
//         maxBodyLength: Infinity,
//         url: "https://api.cashfree.com/verification/name-match",
//         headers: {
//           "x-client-id": global.constant.idfyaccountid,
//           "x-client-secret": global.constant.idfyaccountid,
//           "Content-Type": "application/json",
//         },
//         data: data11,
//       };

//       const nameCheck = await axios.request(config111);

//       // console.log("nameCheck",nameCheck);

//       if (nameCheck.data.score >= 0.5) {
//         return response.data;
//       } else {
//         let resp = { subCode: 400, nameMatching: false };
//         return resp;
//       }
//     }
//     return { subCode: 400, message: "Authorization failed." };
//   } catch (error) {
//     console.error(error);
//     return {
//       status: false,
//       message: "An error occurred while validating bank details. Please try again later.",
//       data: {},
//     };
//   }
// };

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


// exports.bankRequest = async (req) => {
//   try {
//     let config = {
//       method: "post",
//       maxBodyLength: Infinity,
//       url: "https://payout-api.cashfree.com/payout/v1/authorize",
//       headers: {
//         "x-client-id": global.constant.idfyaccountid,
//         "x-client-secret": global.constant.idfyaccountid,
//       },
//     };

//     let responseauth = await axios.request(config);
//     // console.log(responseauth, "--------bank--------responseauthorize--------");

//     if (responseauth) {
//       let data = "";

//       // Step 1: Validate IFSC Code using Cashfree's IFSC validation API
//       let ifscValidationConfig = {
//         method: "get",
//         maxBodyLength: Infinity,
//         url: `https://payout-api.cashfree.com/payout/v1/ifsc/${req.body.ifsc}`,
//         headers: {
//           "x-client-id": global.constant.idfyaccountid,
//           "x-client-secret": global.constant.idfyaccountid,
//           Authorization: `Bearer ${responseauth.data.data.token}`,
//         },
//         data: data,
//       };

//       let ifscResponse = await axios.request(ifscValidationConfig);
//       // console.log("------------validation/ifsc-------------", ifscResponse);

//       // Check if IFSC validation is successful
//       if (!ifscResponse.data || ifscResponse.data.status !== "SUCCESS") {
//         return {
//           status: false,
//           message: `${ifscResponse.data.message}`,
//           data: {},
//         };
//       }

//       if (ifscResponse.data.data.imps == 'Live' || ifscResponse.data.data.neft === 'Live') {
//         let obj = {
//           bank: ifscResponse.data.data.bank,
//           ifsc: ifscResponse.data.data.ifsc,
//           neft: ifscResponse.data.data.neft === 'Live',
//           imps: ifscResponse.data.data.imps === 'Live',
//           rtgs: ifscResponse.data.data.rtgs === 'Live',
//           upi: ifscResponse.data.data.upi === 'Live',
//           address: ifscResponse.data.data.address,
//           city: ifscResponse.data.data.city,
//           state: ifscResponse.data.data.state,
//           branch: ifscResponse.data.data.branch
//         };
        
//         let keyname = `bank-branches`;
//         let redisdata = await redisMain.getkeydata(keyname);
        
//         let branches = redisdata ? JSON.parse(redisdata) : [];
        
//         let existsInRedis = branches.some(item =>
//           item.ifsc === obj.ifsc && item.branch === obj.branch
//         );
        
//         if (!existsInRedis) {
//           let existingBranch = await branchInfoModel.findOne({ ifsc: obj.ifsc });
        
//           if (!existingBranch) {
//             let bb = await branchInfoModel.create(obj);
//             console.log("await branchInfoModel.create(obj);", bb);
//           }
        
//           branches.push(obj);
        
//           await redisMain.setkeydata(keyname, JSON.stringify(branches), 432000);
//         }
        
//       } else {
//         return {
//           status: false,
//           message: "IMPS and NEFT payment modes are not available for your bank branch. Please try with a different bank.",
//           data: {}
//         };
//       }      
        
//       let config1 = {
//         method: "get",
//         maxBodyLength: Infinity,
//         url: `https://payout-api.cashfree.com/payout/v1.2/validation/bankDetails?&bankAccount=${req.body.accno}&ifsc=${req.body.ifsc}`,
//         headers: {
//           "x-client-id": global.constant.idfyaccountid,
//           "x-client-secret": global.constant.idfyaccountid,
//           Authorization: `Bearer ${responseauth.data.data.token}`,
//         },
//         data: data,
//       };

//       let response = await axios.request(config1);
//       // console.log("------------validation/bankDetails-------------", response);

//       if (!response.data || response.data.accountStatusCode == "INVALID_BANK_ACCOUNT") {
//         return {
//           status: false,
//           message: `${response.data.message}`,
//           data: {},
//         };
//       }

//       const { bankName, branch, micr } = response.data.data;

//       // Check for invalid IFSC code or bank details
//       if (bankName === "NOT_AVAILABLE" || branch === "NOT_AVAILABLE") {
//         return {
//           status: false,
//           message: "Invalid IFSC code or bank details",
//           data: response.data,
//         };
//       }

//       const user = await userModel.findOne({ _id: req.user._id });
//       const randomString =
//         "ABC" + Math.random().toString(36).substr(2, 5).toUpperCase();

//       let data11 = JSON.stringify({
//         verification_id: randomString,
//         name_1: response.data.data.nameAtBank,
//         name_2: user.aadharcard.aadhar_name,
//       });

//       let config111 = {
//         method: "post",
//         maxBodyLength: Infinity,
//         url: "https://api.cashfree.com/verification/name-match",
//         headers: {
//           "x-client-id": global.constant.idfyaccountid,
//           "x-client-secret": global.constant.idfyaccountid,
//           "Content-Type": "application/json",
//         },
//         data: data11,
//       };

//       const nameCheck = await axios.request(config111);

//       // console.log("nameCheck",nameCheck);

//       if (nameCheck.data.score >= 0.5) {
//         return response.data;
//       } else {
//         let resp = { subCode: 400, nameMatching: false };
//         return resp;
//       }
//     }
//     return { subCode: 400, message: "Authorization failed." };
//   } catch (error) {
//     console.error(error);
//     return {
//       status: false,
//       message: "An error occurred while validating bank details. Please try again later.",
//       data: {},
//     };
//   }
// };


