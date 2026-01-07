const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let userbalance = new Schema({
    balance: {
        type: Number,
        default: 0
    },
    coin: {
        type: Number,
        default: 0
    },
    winning: {
        type: Number,
        default: 0
    },
    bonus: {
        type: Number,
        default: 0
    },
    ticket: {
        type: Number,
        default: 0
    },

    passes: {
        type: Number,
        default: 0
    },
    extraCash: {
        type: Number,
        default: 0
    },
    created_at: {
        type: Date
    },
    updated_at: {
        type: Date
    }
});
// -------------------------------------------------------------//

let lockedbalance = new Schema({
    balance: {
        type: Number,
        default: 0
    },
    winning: {
        type: Number,
        default: 0
    },
    bonus: {
        type: Number,
        default: 0
    },
    reason: {
        type: String,
        default: ""
    },
    created_at: {
        type: Date
    },
    updated_at: {
        type: Date
    }
});
// -------------------------------------------------------------//
let user_verify = new Schema({
    profile_image_verify: {
        type: Number,
        default: 0
    },
    mobile_verify: {
        type: Number,
        default: 0
    },
    email_verify: {
        type: Number,
        default: 0
    },
    pan_verify: {
        type: Number,
        default: -1
    },
    aadhar_verify: {
        type: Number,
        default: -1
    },
    bank_verify: {
        type: Number,
        default: -1
    },
    mobilebonus: {
        type: Number,
        default: 0
    },
    androidbonus: {
        type: Number,
        default: 0
    },
    emailbonus: {
        type: Number,
        default: 0
    },
    panbonus: {
        type: Number,
        default: 0
    },
    bankbonus: {
        type: Number,
        default: 0
    },
    signupbonus: {
        type: Number,
        default: 0
    },
    referbonus: {
        type: Number,
        default: 0
    },
    created_at: {
        type: Date
    },
    updated_at: {
        type: Date
    }
});
// -------------------------------------------------------------//
let pancard = new Schema({
    pan_name: {
        type: String
    },
    pan_number: {
        type: String
    },
    pan_dob: {
        type: String
    },
    image: {
        type: String
    },
    status: {
        type: Number
    },
    comment: {
        type: String
    },
    created_at: {
        type: Date
    },
    updated_at: {
        type: Date
    }
});

// -------------------------------------------------------------//
//--------------------------------------------------------------//
let aadharcard = new Schema({
    aadhar_name: {
        type: String
    },
    aadhar_number: {
        type: String
    },
    state: {
        type: String
    },
    frontimage: {
        type: String
    },
    backimage: {
        type: String
    },
    aadhar_dob: {
        type: String
    },
    image: {
        type: [String]
    },
    dob: {
        type: String
    },
    status: {
        type: Number
    },
    comment: {
        type: String
    },
    state: {
        type: String
    },
    pincode: {
        type: String
    },
    gender: {
        type: String
    },
    city: {
        type: String
    },
    address: {
        type: mongoose.Schema.Types.Mixed
    },
    created_at: {
        type: Date
    },
    updated_at: {
        type: Date
    },
    manualKyc: {
        type: Boolean,
        default: false
    }
});
//--------------------------------------------------------------//
let bank = new Schema({
    accountholder: {
        type: String
    },
    accno: {
        type: String
    },
    ifsc: {
        type: String
    },
    bankname: {
        type: String
    },
    bankbranch: {
        type: String
    },
    state: {
        type: String
    },
    status: {
        type: Number
    },
    image: {
        type: String
    },
    comment: {
        type: String
    },
    type: {
        type: String
    },
    mobile: {
        type: Number
    },
    upi_id: {
        type: String
    },
    gname: {
        type: String
    },
    iagree: {
        type: String
    },
    cashfree_status: {
        type: Number
    },
    city: {
        type: String
    },
    created_at: {
        type: Date
    },
    updated_at: {
        type: Date
    }
});
// -------------------------------------------------------------//
let bonusRefered = new Schema({
    userid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    amount: {
        type: Number,
        default: 0
    },
    txnid: {
        type: String
    },
    created_at: {
        type: Date
    },
    updated_at: {
        type: Date
    }
});
// -------------------------------------------------------------//

// MAIN SCHEMA----------------------------------******************
let userSchema = new Schema({
    userid: {
        type: Number
    },
    fullname: {
        type: String,
        default: ''
    },
    email: {
        type: String,
        default: ''
    },
    mobile: {
        type: Number,
        default: 0
    },
    password: {
        type: String,
        default: ''
    },
    code: {
        type: String,
        default: ''
    },
    auth_key: {
        type: String,
        default: ''
    },
    app_key: {
        type: String,
        default: ''
    },
    decrypted_password: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        default: 'activated'
    },
    refer_code: {
        type: String,
        default: ''
    },
    refer_id: {
        type: mongoose.Types.ObjectId,
        ref: 'user',
    },
    name: {
        type: String
    },
    special_refer: {
        type: String,
        default: ''
    },
    username: {
        type: String,
        default: ''
    },
    dob: {
        type: String,
        default: ''
    },
    gender: {
        type: String,
        default: ''
    },
    image: {
        type: String,
        default: ''
    },
    comment: {
        type: String,
        default: ''
    },
    address: {
        type: mongoose.Schema.Types.Mixed,
        default: ''
    },
    city: {
        type: String,
        default: ''
    },
    state: {
        type: String,
        default: ''
    },
    pincode: {
        type: Number,
        default: 0
    },
    activation_status: {
        type: String,
        default: ''
    },
    team: {
        type: String,
        default: ''
    },
    type: {
        type: String,
        default: ''
    },
    percentage: {
        type: Number
    },
    download_apk: {
        type: Number
    },
    remember_token: {
        type: String,

    },
    user_status: {
        type: Number,
        default: 0
    },
    deviceid: {
        type: String
    },
    withdrawamount: {
        type: Number,
        default: 0
    },
    winstatus: {
        type: Number,
        default: 0
    },
    userbalance: userbalance,
    lockedbalance: lockedbalance,
    user_verify: user_verify,
    pancard: pancard,
    aadharcard: aadharcard,
    bank: bank,
    bonusRefered: [bonusRefered],
    totalrefercount: {
        type: Number,
        default: 0
    },
    totalreferAmount: {
        type: Number,
        default: 0
    },
    percentage: {
        type: Number,
        default: 0
    },
    teamNameUpdateStatus: {
        type: Boolean,
        default: false
    },
    totalchallenges: {
        type: Number,
        default: 0
    },
    totalmatches: {
        type: Number,
        default: 0
    },
    totalseries: {
        type: Number,
        default: 0
    },
    totalwinning: {
        type: Number,
        default: 0
    },
    totalwoncontest: {
        type: Number,
        default: 0
    },
    level: {
        type: Number,
        default: 1
    },
    nextLevel: {
        type: Number,
        default: 2
    },
    is_deleted: {
        type: Boolean,
        default: false
    },
    promoter_verify: {
        type: Number,
        default: -1
    },
    adminAssociated: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "admin"
    },

    guruTeamNumber: {
        type: [Number],
    },
    fund_account_id: {
        type: String
    },
    tdsStatus: {
        type: Boolean,
        default: false
    },
    tdsCheckStatus: {
        type: Boolean,
        default: false
    },
    withdraw_threshold_limit: {
        type: Number
    },
    withdrawals: {
        type: Boolean,
        default: true
    },
    checkStatus: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('user', userSchema);