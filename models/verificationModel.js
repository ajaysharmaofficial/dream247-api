const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema(
  {
    userid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user',
    },
    aadhar: {
      aadharname: {
        type: String,
        default: ''
      },
      aadharnumber: {
        type: String,
        default: ''
      },
      aadhardob: {
        type: String,
        default: ''
      },
      frontimage: {
        type: String,
        default: ''
      },
      backimage: {
        type: String,
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
      address: {
        type: String,
        default: ''
      },
      gender: {
        type: String,
        default: ''
      },
      pincode: {
        type: String,
        default: ''
      },
      status: {
        type: Number,
        default: -1
      },
      createdAt: {
        type: Date,
        default: Date.now
      },
      updatedAt: {
        type: Date,
        default: Date.now
      }
    },
    pan: {
      panname: {
        type: String,
        default: ''
      },
      pannumber: {
        type: String,
        default: ''
      },
      pandob: {
        type: String,
        default: ''
      },
      status: {
        type: Number,
        default: -1
      },
      createdAt: {
        type: Date,
        default: Date.now
      },
      updatedAt: {
        type: Date,
        default: Date.now
      }
    },
    bank: {
      accholdername: {
        type: String,
        default: ''
      },
      accountnumber: {
        type: String,
        default: ''
      },
      ifsc: {
        type: String,
        default: ''
      },
      bankname: {
        type: String,
        default: ''
      },
      branchname: {
        type: String,
        default: ''
      },
      status: {
        type: Number,
        default: -1
      },
      createdAt: {
        type: Date,
        default: Date.now
      },
      updatedAt: {
        type: Date,
        default: Date.now
      }
    },
  },
  {
    timestamps: true,
    versionKey: false
  }
);

verificationSchema.pre('save', function (next) {
  const kyc = this;

  if (kyc.isModified('aadhar')) {
    kyc.aadhar.updatedAt = Date.now();
    if (!kyc.aadhar.createdAt) {
      kyc.aadhar.createdAt = Date.now();
    }
  }

  if (kyc.isModified('pan')) {
    kyc.pan.updatedAt = Date.now();
    if (!kyc.pan.createdAt) {
      kyc.pan.createdAt = Date.now();
    }
  }

  if (kyc.isModified('bank')) {
    kyc.bank.updatedAt = Date.now();
    if (!kyc.bank.createdAt) {
      kyc.bank.createdAt = Date.now();
    }
  }

  next();
});

const manualKycModel = mongoose.model('verification', verificationSchema);

module.exports = manualKycModel;
