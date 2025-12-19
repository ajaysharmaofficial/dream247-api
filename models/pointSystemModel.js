const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let pointSystemModel = Schema({
    fantasy_type: {
        type: String,
        default: 'Cricket',
    },
    format: {
        type: String,
    },
    type: {
        batting: {
            run: {
                type: String,
                default: '0'
            },
            boundary_bouns: {
                type: String,
                default: '0'
            },
            six_bonus: {
                type: String,
                default: '0'
            },
            half_century_bonus: {
                type: String,
                default: '0'
            },
            century_bonus: {
                type: String,
                default: '0'
            },
            dismissal_for_aDuck: {
                type: String,
                default: '0'
            },
        },
        bowling: {
            wicket: {
                type: String,
                default: '0'
            },
            wicket4_haul_bonus: {
                type: String,
                default: '0'
            },
            wicket5_haul_bonus: {
                type: String,
                default: '0'
            },
            maiden_over: {
                type: String,
                default: '0'
            },
        },
        fielding: {
            catchs: {
                type: String,
                default: '0'
            },
            stumping_run_out: {
                type: String,
                default: '0'
            },
            run_out_thrower: {
                type: String,
                default: '0'
            },
            run_out_catcher: {
                type: String,
                default: '0'
            },
        },
        others: {
            captain: {
                type: String,
                default: '0'
            },
            vice_captain: {
                type: String,
                default: '0'
            },
            in_starting_11: {
                type: String,
                default: '0'
            }
        },
        economy_rate: {
            economy_rate11: {
                type: String,
                default: '0'
            },
            economy_rate22: {
                type: String,
                default: '0'
            },
            economy_rate33: {
                type: String,
                default: '0'
            },
            economy_rate44: {
                type: String,
                default: '0'
            },
            economy_rate55: {
                type: String,
                default: '0'
            },
            economy_rate66: {
                type: String,
                default: '0'
            },
        },
        strike_rate: {
            strikeRate11: {
                type: String,
                default: '0'
            },
            strikeRate22: {
                type: String,
                default: '0'
            },
            strikeRate33: {
                type: String,
                default: '0'
            }
        }
    }
}, {
    timestamps: true,
    versionKey: false
});
module.exports = mongoose.model('pointSystems', pointSystemModel);






