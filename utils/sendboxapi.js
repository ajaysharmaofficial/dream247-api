const axios = require("axios");
const userModel = require("../models/userModel");
const branchInfoModel = require("../models/branchInfoModel");
const redisMain = require("../utils/redis/redisMain");

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
        "x-client-id": `${global.constant.cashfreeclientid}`,
        "x-client-secret": `${global.constant.cashfreexclientsecret}`,
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
        "x-client-id": global.constant.cashfreeclientid,
        "x-client-secret": global.constant.cashfreexclientsecret,
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

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: "https://api.cashfree.com/verification/pan",
      headers: {
        "x-client-id": global.constant.cashfreeclientid,
        "x-client-secret": global.constant.cashfreexclientsecret,
        "Content-Type": "application/json",
      },
      data: data,
    };

    // Hit the PAN verification API
    let response = await axios.request(config);
    // console.log("PAN Request Response:", response.data);

    // Check if PAN is successfully verified
    if (response.data.valid) {
      const panresponse = response.data;

      // Generate a random verification ID
      const randomString = "ABC" + Math.random().toString(36).substr(2, 5).toUpperCase();

      // Prepare data for name match verification
      let nameMatchData = JSON.stringify({
        verification_id: randomString,
        name_1: response.data.registered_name, // Name from PAN API response
        name_2: req.body.name, // Name from the request body
      });

      let nameMatchConfig = {
        method: "post",
        maxBodyLength: Infinity,
        url: "https://api.cashfree.com/verification/name-match",
        headers: {
          "x-client-id": global.constant.cashfreeclientid,
          "x-client-secret": global.constant.cashfreexclientsecret,
          "Content-Type": "application/json",
        },
        data: nameMatchData,
      };

      // Hit the Name Match API
      const nameCheck = await axios.request(nameMatchConfig);
      // console.log("Name Match Response:", nameCheck);

      // Handle name match response
      if (nameCheck.data.score >= 0.5) {
        return {
          status: true,
          message: "PAN verification successful.",
          data: {
            pan_response: panresponse,
            name_match_score: nameCheck.data.score,
          },
        };
      } else {
        return {
          status: false,
          reason: nameCheck?.data?.reason,
        };
      }
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
//         "x-client-id": global.constant.cashfreeclientid,
//         "x-client-secret": global.constant.cashfreexclientsecret,
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
//           "x-client-id": global.constant.cashfreeclientid,
//           "x-client-secret": global.constant.cashfreexclientsecret,
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
//           "x-client-id": global.constant.cashfreeclientid,
//           "x-client-secret": global.constant.cashfreexclientsecret,
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
//           "x-client-id": global.constant.cashfreeclientid,
//           "x-client-secret": global.constant.cashfreexclientsecret,
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
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: "https://payout-api.cashfree.com/payout/v1/authorize",
      headers: {
        "x-client-id": global.constant.cashfreeclientid,
        "x-client-secret": global.constant.cashfreexclientsecret,
      },
    };

    let responseauth = await axios.request(config);
    // console.log(responseauth, "--------bank--------responseauthorize--------");

    if (responseauth) {
      let data = "";

      // Step 1: Validate IFSC Code using Cashfree's IFSC validation API
      let ifscValidationConfig = {
        method: "get",
        maxBodyLength: Infinity,
        // url: `https://payout-api.cashfree.com/payout/v1/ifsc/${req.body.ifsc}`,
        url: `https://ifsc.razorpay.com/${req.body.ifsc}`, // verifying from razorpay instead of cashfree
        // headers: {
        //   "x-client-id": global.constant.cashfreeclientid,
        //   "x-client-secret": global.constant.cashfreexclientsecret,
        //   Authorization: `Bearer ${responseauth.data.data.token}`,
        // },
        // data: data,
      };

      let ifscResponse;
      try {
        ifscResponse = await axios.request(ifscValidationConfig);
        // console.log("------------validation/ifsc-------------", ifscResponse.data);
      
        // Check if IFSC validation is successful
        if (!ifscResponse.data || ifscResponse.data === "Not Found") {
          return {
            status: false,
            message: `IMPS or NEFT mode is not available on your bank account.`,
            data: {},
          };
        }
      } catch (error) {
        // Handle specific 404 or any other error during IFSC validation
        if (error.response && error.response.status === 404) {
          return {
            status: false,
            message: `IMPS or NEFT mode is not available on your bank account.`,
            data: {},
          };
        } else {
          console.error("IFSC validation failed:", error.message);
          return {
            status: false,
            message: `Failed to validate IFSC code. Please try again later.`,
            data: {},
          };
        }
      }      

      if (ifscResponse.data.IMPS || ifscResponse.data.NEFT) {
        let obj = {
          bank: ifscResponse.data.BANK.toUpperCase(),
          ifsc: ifscResponse.data.IFSC,
          neft: ifscResponse.data.NEFT,
          imps: ifscResponse.data.IMPS,
          rtgs: ifscResponse.data.RTGS,
          upi: ifscResponse.data.UPI,
          address: ifscResponse.data.ADDRESS,
          city: ifscResponse.data.CITY,
          state: ifscResponse.data.STATE,
          branch: ifscResponse.data.BRANCH
        };
      // if (ifscResponse.data.data.imps == 'Live' || ifscResponse.data.data.neft === 'Live') {
      //   let obj = {
      //     bank: ifscResponse.data.data.bank,
      //     ifsc: ifscResponse.data.data.ifsc,
      //     neft: ifscResponse.data.data.neft === 'Live',
      //     imps: ifscResponse.data.data.imps === 'Live',
      //     rtgs: ifscResponse.data.data.rtgs === 'Live',
      //     upi: ifscResponse.data.data.upi === 'Live',
      //     address: ifscResponse.data.data.address,
      //     city: ifscResponse.data.data.city,
      //     state: ifscResponse.data.data.state,
      //     branch: ifscResponse.data.data.branch
      //   };
        
        let keyname = `bank-branches`;
        let redisdata = await redisMain.getkeydata(keyname);
        
        let branches = redisdata ? JSON.parse(redisdata) : [];
        
        let existsInRedis = branches.some(item =>
          item.ifsc === obj.ifsc && item.branch === obj.branch
        );
        
        if (!existsInRedis) {
          let existingBranch = await branchInfoModel.findOne({ ifsc: obj.ifsc });
        
          if (!existingBranch) {
            let bb = await branchInfoModel.create(obj);
            console.log("await branchInfoModel.create(obj);", bb);
          }
        
          branches.push(obj);
        
          await redisMain.setkeydata(keyname, JSON.stringify(branches), 432000);
        }
        
      } else {
        return {
          status: false,
          message: "IMPS and NEFT payment modes are not available for your bank branch. Please try with a different bank.",
          data: {}
        };
      }      
        
      let config1 = {
        method: "get",
        maxBodyLength: Infinity,
        url: `https://payout-api.cashfree.com/payout/v1.2/validation/bankDetails?&bankAccount=${req.body.accno}&ifsc=${req.body.ifsc}`,
        headers: {
          "x-client-id": global.constant.cashfreeclientid,
          "x-client-secret": global.constant.cashfreexclientsecret,
          Authorization: `Bearer ${responseauth.data.data.token}`,
        },
        data: data,
      };

      let response = await axios.request(config1);
      // console.log("------------validation/bankDetails-------------", response);

      if (!response.data || response.data.accountStatusCode == "INVALID_BANK_ACCOUNT") {
        return {
          status: false,
          message: `${response.data.message}`,
          data: {},
        };
      }

      const { bankName, branch, micr } = response.data.data;

      // Check for invalid IFSC code or bank details
      if (bankName === "NOT_AVAILABLE" || branch === "NOT_AVAILABLE") {
        return {
          status: false,
          message: "Invalid IFSC code or bank details",
          data: response.data,
        };
      }

      const user = await userModel.findOne({ _id: req.user._id });
      const randomString =
        "ABC" + Math.random().toString(36).substr(2, 5).toUpperCase();

      let data11 = JSON.stringify({
        verification_id: randomString,
        name_1: response.data.data.nameAtBank,
        name_2: user.aadharcard.aadhar_name,
      });

      let config111 = {
        method: "post",
        maxBodyLength: Infinity,
        url: "https://api.cashfree.com/verification/name-match",
        headers: {
          "x-client-id": global.constant.cashfreeclientid,
          "x-client-secret": global.constant.cashfreexclientsecret,
          "Content-Type": "application/json",
        },
        data: data11,
      };

      const nameCheck = await axios.request(config111);

      // console.log("nameCheck",nameCheck);

      if (nameCheck.data.score >= 0.5) {
        return response.data;
      } else {
        let resp = { subCode: 400, nameMatching: false };
        return resp;
      }
    }
    return { subCode: 400, message: "Authorization failed." };
  } catch (error) {
    console.error(error);
    return {
      status: false,
      message: "An error occurred while validating bank details. Please try again later.",
      data: {},
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
//         "x-client-id": global.constant.cashfreeclientid,
//         "x-client-secret": global.constant.cashfreexclientsecret,
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
//           "x-client-id": global.constant.cashfreeclientid,
//           "x-client-secret": global.constant.cashfreexclientsecret,
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
//           "x-client-id": global.constant.cashfreeclientid,
//           "x-client-secret": global.constant.cashfreexclientsecret,
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
//           "x-client-id": global.constant.cashfreeclientid,
//           "x-client-secret": global.constant.cashfreexclientsecret,
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


