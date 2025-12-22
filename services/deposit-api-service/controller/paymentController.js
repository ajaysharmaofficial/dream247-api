const paymentServices = require('../services/paymentService');
const base64 = require("base-64");
const crypto = require("crypto");
const userModel = require('../../../models/userModel');
const randomstring = require('randomstring');
const express = require("express");
const app = express();
// app.set("view engine", "html");
// app.engine("html", require("ejs").renderFile);
const path = require('path');
const mongoose = require('mongoose');
const { sendToQueue } = require('../../../utils/kafka');

exports.dbCheck = async (req, res) => {
    try {
        const data = await paymentServices.dbCheck();

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

exports.fetchOffers = async (req, res) => {
    try {
        const data = await paymentServices.fetchOffers(req);

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

exports.getTiers = async (req, res) => {
    try {
        const data = await paymentServices.getTiers(req);

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

exports.newRequestAddCash = async (req, res, next) => {
    try {
        const data = await paymentServices.newRequestAddCash(req);

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
};

exports.AddCashNewRequestKafka = async (req, res, next) => {
    try {
        const data = await paymentServices.AddCashNewRequestKafka(req, res);

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
};

exports.sabPaisaCallback = async (req, res, next) => {
    try {
        const data = await paymentServices.sabPaisaCallback(req);

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
};

exports.sabPaisaCallbackWeb = async (req, res, next) => {
    try {
        const data = await paymentServices.sabPaisaCallbackWeb(req);

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
};

exports.razorPayCallback = async (req, res, next) => {
    try {
        const data = await paymentServices.razorPayCallback(req);

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
};

exports.yesBankCallback = async (req, res, next) => {
    try {
        const data = await paymentServices.yesBankCallback(req);

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
};

exports.phonePayCallback = async (req, res, next) => {
    try {
        const data = await paymentServices.phonePayCallback(req);

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
};

exports.phonePeCallbackKafka = async (req, res, next) => {
    try {
        const data = await paymentServices.phonePeCallbackKafka(req);

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
};

exports.winningToDepositTransfer = async (req, res, next) => {
    try {
        const data = await paymentServices.winningToDepositTransfer(req);

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
};

function encrypt(text) {
    const algorithm = "aes-128-cbc";
    var authKey = global.constant.SABPAISA_AUTHKEY;
    var authIV = global.constant.SABPAISA_AUTHIV;
    let cipher = crypto.createCipheriv(algorithm, Buffer.from(authKey), authIV);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return encrypted.toString("base64");
}

exports.initializeSabPaisa = async (req, res, next) => {
    try {
        const hasUser = await userModel.findOne({ _id: req.user._id });

        const randomStrrr = randomstring.generate({
            length: 8,
            charset: "alphabetic",
            capitalization: "uppercase",
        });

        const timestamp = Date.now(); // current time in ms

        let orderId = `SabPaisa_${timestamp}_${randomStrrr}`;

        let callbackUrl2 = "";
        if (process.env.secretManager == "prod") {
            callbackUrl2 = ""
        }

        var payerName = hasUser.username;
        var payerEmail = hasUser.email;
        var payerMobile = hasUser.mobile;
        var clientTxnId = orderId;
        var amount = 10;
        var clientCode = global.constant.SABPAISA_CLIENTCODE;       // Please use the credentials shared by your Account   Manager  If not, please contact your Account Manage
        var transUserName = global.constant.SABPAISA_TRANS_USERNAME;      // Please use the credentials shared by your Account   Manager  If not, please contact your Account Manage
        var transUserPassword = global.constant.SABPAISA_TRANS_USER_PASSWORD;   // Please use the credentials shared by your   Account Manager  If not, please contact your Account Manage
        const callbackUrl = callbackUrl2;
        const channelId = "W";
        const spURL = "https://stage-securepay.sabpaisa.in/SabPaisa/sabPaisaInit?v=1"; // Staging   environment

        var mcc = "5666";
        var transData = new Date();

        var stringForRequest =
            "payerName=" +
            payerName +
            "&payerEmail=" +
            payerEmail +
            "&payerMobile=" +
            payerMobile +
            "&clientTxnId=" +
            clientTxnId +
            "&amount=" +
            amount +
            "&clientCode=" +
            clientCode +
            "&transUserName=" +
            transUserName +
            "&transUserPassword=" +
            transUserPassword +
            "&callbackUrl=" +
            callbackUrl +
            "&channelId=" +
            channelId +
            "&mcc=" +
            mcc +
            "&transData=" +
            transData;

        console.log("stringForRequest :: " + stringForRequest);

        var encryptedStringForRequest = encrypt(stringForRequest);
        console.log("encryptedStringForRequest :: " + encryptedStringForRequest);

        const formData = {
            spURL: spURL,
            encData: encryptedStringForRequest,
            clientCode: clientCode,
        };

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Redirecting...</title>
        </head>
        <body onload="document.forms[0].submit();">
            <form method="POST" action="${formData.spURL}">
                <input type="hidden" name="encData" value="${formData.encData}" />
                <input type="hidden" name="clientCode" value="${formData.clientCode}" />
            </form>
            <p>Redirecting to payment...</p>
        </body>
        </html>
        `;

        let randomStr = randomstring.generate({
            length: 8,
            charset: "alphabetic",
            capitalization: "uppercase",
        });

        const txnid = `${global.constant.APP_SHORT_NAME}_add_${Date.now()}_${randomStr}`;

        // Save payment process record
        let checkData = {
            amount: amount,
            userid: req.user._id,
            paymentmethod: "SabPaisa",
            orderid: orderId,
            txnid: txnid,
            offerid: "",
            payment_type: global.constant.PAYMENT_TYPE.ADD_CASH,
        };

        sendToQueue('addcash-topic', { data: checkData });

        res.json({ status: true, data: htmlContent });


    } catch (error) {
        console.error("Error:", error);
        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
};

function decrypt(text) {
    // let iv = Buffer.from(text.iv, 'hex');
    // let encryptedText = Buffer.from(text.encryptedData, 'hex');
    const algorithm = "aes-128-cbc";
    var authKey = "kaY9AIhuJZNvKGp2";
    var authIV = "YN2v8qQcU3rGfA1y";
    let decipher = crypto.createDecipheriv(
        algorithm,
        Buffer.from(authKey),
        authIV
    );
    let decrypted = decipher.update(Buffer.from(text, "base64"));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

exports.sabPaisaResponseData = async (req, res) => {
    try {
        console.log("----------sabPaisaResponseData-----------");
        //   console.log("body------->", req.body);  
        //   console.log("params------->", req.params);  
        //   console.log("query------->", req.query);

        const { encResponse } = req.body;
        console.log("Encrypted Data from SabPaisa:", encResponse);

        if (!encResponse) {
            return res.status(400).json({ status: false, message: "encResponse is missing" });
        }

        const decryptedResponse = decrypt(decodeURIComponent(encResponse));
        const querystring = require('querystring');

        const jsonData = querystring.parse(decryptedResponse);
        //   console.log("jsonData Response:", jsonData);

        await paymentServices.sabPaisaCallbackWeb(jsonData);

        return res.status(200).json({
            status: true,
            data: jsonData,
        });

    } catch (error) {
        console.error("Error in sabPaisaResponseData:", error);
        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
};

//   exports.sabPaisaResponseData = async (req, res, next) => {
//     try {
//         console.log("----------sabPaisaResponseData-----------");
//         let body = "";
//         req.on("data", function (data) {
//           body += data;
//           console.log("sabpaisa response :: " + body);
//           var decryptedResponse = decrypt(
//             decodeURIComponent(body.split("&")[1].split("=")[1])
//           );
//           console.log("decryptedResponse :: " + decryptedResponse);

//         //   res.render(__dirname + "/pg-form-response.html", {
//         //     decryptedResponse: decryptedResponse,
//         //   });

//         return res.json({
//             status: true,
//             data: decryptedResponse
//         });

//         });
//     } catch (error) {
//         console.error("Error:", error);

//         return res.status(500).json({
//             success: false,
//             message: "An unexpected error occurred. Please try again later.",
//         });
//     }
// };




exports.watchPayCallback = async (req, res, next) => {
    try {
        const data = await paymentServices.watchPayCallback(req);

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
};