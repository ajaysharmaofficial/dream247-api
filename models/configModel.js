const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let configSchema = new Schema({
    token: {
        type: String
    },
    supportemail: {
        type: String,

    },
    supportmobile: {
        type: String,

    },
    maxwithdraw: {
        type: Number,
    },
    minwithdraw: {
        type: String,

    },
    androidversion: {
        type: String,
    },
    iOSversion: {
        type: String,
    },
    version: {
        type: String,
    },
    maintenance: {
        type: Number,
        default: 0
    },
    iOSmaintenance: {
        type: Number,
        default: 0
    },
    withdrawal_threshold_limit: {
        type: Number,
        default: 0
    },
    minadd: {
        type: Number,
        default: 1
    },
    disableWithdraw: {
        type: Number,
        default: 0
    },
    updatePoints: {
        type: String
    },
    gst: {
        type: Number,
        default: 0
    },
    tds: {
        type: Number,
        default: 0
    },
    image: {
        type: String,
        default: ''
    },
    seriesLeaderboard: {
        type: Number,
        default: 0
    },
    investmentLeaderboard: {
        type: Number,
        default: 0
    },
    privateContest: {
        type: Number,
        default: 0
    },
    guruTeam: {
        type: Number,
        default: 0
    },
    joinContest: {
        type: Boolean,
        default: true
    },
    cricketgame: {
        type: Boolean,
        default: true
    },
    dualgame: {
        type: Boolean,
        default: true
    },
    applyForGuru: {
        type: Boolean,
        default: true
    },
    winning_to_deposit: {
        type: Number,
        default: 0
    },
    flexibleContest: {
        type: Number,
        default: 0
    },
    p_to_p: {
        type: Number,
        default: 0
    },
    myjoinedContest: {
        type: Boolean,
        default: true
    },
    transactionDetails: {
        type: Boolean,
        default: true
    },
    sendingNullWithdrawalstoRazorpayX: {
        type: Boolean,
        default: true
    },
    updatePhonePeStatus: {
        type: Boolean,
        default: true
    },
    // ptoptransfer: {
    //     type: Boolean,
    //     default: true
    // },
    // selftransfer: {
    //     type: Boolean,
    //     default: true
    // },
    ptoptransfer: {
        status: { type: Boolean, default: true },
        min: { type: Number, default: 0 },
        max: { type: Number, default: 0 }
    },
    selftransfer: {
        status: { type: Boolean, default: true },
        min: { type: Number, default: 0 },
        max: { type: Number, default: 0 }
    },
    verificationOnJoinContest: {
        type: Boolean,
        default: true
    },
    viewcompletedmatches: {
        type: Boolean,
        default: true
    },
    androidpaymentgateway: {
        isSabPaisa: {
            status: { type: Boolean, default: false },
            min: { type: String, default: "0" },
            max: { type: String, default: "0" }
        },
        isRazorPay: {
            status: { type: Boolean, default: false },
            min: { type: String, default: "0" },
            max: { type: String, default: "0" }
        },
        isCashFree: {
            status: { type: Boolean, default: false },
            min: { type: String, default: "0" },
            max: { type: String, default: "0" }
        },
        isPhonePe: {
            status: { type: Boolean, default: false },
            min: { type: String, default: "0" },
            max: { type: String, default: "0" }
        },
        isYesBank: {
            status: { type: Boolean, default: false },
            min: { type: String, default: "0" },
            max: { type: String, default: "0" }
        },
        isPaySprint: {
            status: { type: Boolean, default: false },
            min: { type: String, default: "0" },
            max: { type: String, default: "0" }
        },
        isWatchPay: {
            status: { type: Boolean, default: false },
            min: { type: String, default: "0" },
            max: { type: String, default: "0" }
        }
    },
    iospaymentgateway: {
        isSabPaisa: {
            status: { type: Boolean, default: false },
            min: { type: String, default: "0" },
            max: { type: String, default: "0" }
        },
        isRazorPay: {
            status: { type: Boolean, default: false },
            min: { type: String, default: "0" },
            max: { type: String, default: "0" }
        },
        isCashFree: {
            status: { type: Boolean, default: false },
            min: { type: String, default: "0" },
            max: { type: String, default: "0" }
        },
        isPhonePe: {
            status: { type: Boolean, default: false },
            min: { type: String, default: "0" },
            max: { type: String, default: "0" }
        },
        isYesBank: {
            status: { type: Boolean, default: false },
            min: { type: String, default: "0" },
            max: { type: String, default: "0" }
        },
        isPaySprint: {
            status: { type: Boolean, default: false },
            min: { type: String, default: "0" },
            max: { type: String, default: "0" }
        },
        isWatchPay: {
            status: { type: Boolean, default: false },
            min: { type: String, default: "0" },
            max: { type: String, default: "0" }
        }
    },
    pdf: {
        type: String,
        deafult: ""
    }

},
    {
        timestamps: true,
        versionKey: false
    })
module.exports = mongoose.model('config', configSchema);