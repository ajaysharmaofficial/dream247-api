const mongoose = require('mongoose');
const { path } = require('pdfkit');
const Schema = mongoose.Schema;
let andriodVersion = new Schema({
  version: {
    type: Number,
    default: 1,
  },
  updation_points: {
    type: String,
    default: `<p>${process.env.APP_NAME} has updated the app to the latest version.</p>`
  },
});

let general_tabs = new Schema({
  type: {
    type: String,
  },
  amount: {
    type: Number,
  },
});

let sidebanner = new Schema({
  type: {
    type: String,
  },
  bannerType: {
    type: String,
  },
  image: {
    type: String,
  },
  url: {
    type: String,
  },
});

let permissions = new Schema({
  dashboard_manager: { type: Array },
  team_manager: { type: Array },
  series_manager: { type: Array },
  player_manager: { type: Array },
  match_manager: { type: Array },
  contest_manager: { type: Array },
  result_manager: { type: Array },
  full_series_details: { type: Array },
  banner_manager: { type: Array },
  playing_level_manager: { type: Array },
  point: { type: Array },
  popup_notifications: { type: Array },
  profit_loss_manager: { type: Array },
  support_manager: { type: Array },
  Rules_and_regulation_manager: { type: Array },
  Terms_conditions_manager: { type: Array },
  sub_admin_manager: { type: Array },
  user_manager: { type: Array },
  user_stories_manager: { type: Array },
  verification_manager: { type: Array },
  receive_fund_manager: { type: Array },
  notifications: { type: Array },
  general_tabs: { type: Array },
  offers_manager: { type: Array },
  youtuber_manager: { type: Array },
  point_system_manager: { type: Array },
  investor_manager: { type: Array },
  contest_promocode_manager: { type: Array },
  report_manager: { type: Array },
  dead_report_manager: { type: Array },
  security_setting_manager: { type: Array },

});


const permissionActionSchema = new Schema({
  view: { type: Boolean, default: false },
  create: { type: Boolean, default: false },
  edit: { type: Boolean, default: false },
  delete: { type: Boolean, default: false },
});

// const subModuleSchema = new Schema({
//   name: { type: String, required: true }, 
//   access: { type: Boolean, default: false },
//   icon: String,
//   path: String,
//   actions: permissionActionSchema,
//   sidebar:Boolean,
//   id:String,
//   items: [{  
//     name: String,
//     icon: String,
//     path: String,
//     access: Boolean,
//     actions: permissionActionSchema,
//     sidebar:Boolean,
//     id:String
//   }]
// });
const subModuleSchema = new Schema();
subModuleSchema.add({
  name: { type: String, required: true },
  access: { type: Boolean, default: false },
  icon: String,
  path: String,
  actions: permissionActionSchema,
  sidebar: Boolean,
  id: String,
  items: [subModuleSchema]
});


const permissionSchema = new Schema({
  modules: [{
    name: {
      type: String,
      required: true,
      enum: [
        'Dashboard',
        'States',
        'Banks',
        'Teams',
        'Team Manager',
        'Series Manager',
        'Player Manager',
        'Match Manager',
        'Contest Manager',
        'Result Manager',
        'full_series_details',
        'Banner Manager',
        'Playing Level Panager',
        'Point',
        'Popup Notifications',
        'Profit Loss Manager',
        'Support Manager',
        'Rules and Regulation Manager',
        'Terms Conditions Manager',
        'Sub Admin Manager',
        'User Manager',
        'User Stories Manager',
        'Verification Manager',
        'Receive Fund Manager',
        'Notifications',
        'General Tabs',
        'Offers Manager',
        'Youtuber Manager',
        'Point System Manager',
        'Investor Manager',
        'Contest Promocode Manager',
        'Report Manager',
        'Dead Report Manager'
      ]
    },
    path: { type: String },
    access: { type: Boolean, default: false },
    icon: String,
    actions: permissionActionSchema,
    // subModules: [subModuleSchema],
    subModules: [subModuleSchema],
    sidebar: Boolean,
    id: String
  }]
});





let adminSchema = new Schema(
  {
    name: {
      type: String,
    },
    email: {
      type: String,
    },
    password: {
      type: String,
    },
    mobile: {
      type: String,
      default: '',
    },
    image: {
      default: '',
      type: String,
    },
    role: {
      type: String,
      default: '0',
    },
    permissions: permissions,
    permissions_new: permissionSchema,
    remember_token: {
      type: String,
      default: '',
    },
    masterpassword: {
      type: String,
      default: '',
    },
    androidversion: andriodVersion,
    general_tabs: [general_tabs],
    sidebanner: [sidebanner],
    popup_notify_image: {
      type: String,
      default: ''
    },
    popup_notify_title: {
      type: String,
      default: ''
    },
    twofaSecret: {
      type: String,
      default: ''
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
    checkPermissions: {
      type: String,
    },
    is_active: {
      type: Boolean,
      default: true
    },
    sessionTokens: [[
      {
        token: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ]],
  },
  {
    timestamps: true,
    versionKey: false,
  },
);
module.exports = mongoose.model('admin', adminSchema);
