const { startCreateRegisterGroup, startUpdateLoginGroup } = require("./userConsumer.js");
const { startClosedGroup, startRunningCreate } = require("./contestConsumer.js")
const { processAddCash, processPhonepeWebhook, processPaymentsTransactions, processSelfTransfer } = require("./depositConsumer.js")
const { startGroupCreateJoinContest, startContestUpdateGroup, startUpdateUserGroup } = require("./joincontestConsumer.js")
const { processEmailVerification, processAadharVerification, processPanVerification, processBankVerification } = require("./kycConsumer.js")
const { processPayouts, processP2Ptxns } = require("./withdrawConsumer.js");
const { startCreateTeamGroup } = require('./createTeamConsumer.js');

async function startAllConsumers() {

    // user consumer
    await startCreateRegisterGroup()
    await startUpdateLoginGroup()

    // contest conumer
    await startClosedGroup()
    await startRunningCreate()

    // deposit consumer
    await processAddCash()
    // await processPhonepeWebhook()
    // await processPaymentsTransactions()
    // await processSelfTransfer()

    // kyc consumer
    // await processEmailVerification()
    // await processAadharVerification()
    // await processPanVerification()
    await processBankVerification()

    // create team consumer
    await startCreateTeamGroup()

    // joined contest
    await startGroupCreateJoinContest()
    await startContestUpdateGroup()
    await startUpdateUserGroup()

    // withdraw consumer
    await processPayouts()
    // await processP2Ptxns()

    console.log("All consumers started");
}

module.exports = startAllConsumers;
