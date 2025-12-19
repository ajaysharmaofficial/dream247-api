const redisContest = require("./redis/redisContest");
const matchContestModel = require("../models/matchContestModel");
const { matchTimeDifference } = require("../utils/matchTimeDiffrence");
const mongoose = require("mongoose");

class redisClonedContest {
    async insertClonedData(matchkey, categoryId, challengeId, fieldsToUpdate) {
        try {
            const matchChallengeData = await matchContestModel.findOne({ _id: mongoose.Types.ObjectId(challengeId) });

            if (!matchChallengeData) {
                console.error("❌ Challenge not found in DB.");
                return false;
            }

            if (matchChallengeData.is_running == 1) {
                const { entryfee, win_amount, maximum_user } = matchChallengeData;
                const cloneKey = `match:${matchkey}:entry:${entryfee}:win:${win_amount}:max:${maximum_user}:cloned_challenges`;

                // Get all existing cloned contests under this key
                const existingClones = await redisContest.hgetAllData(cloneKey);
                const existingCloneIds = existingClones ? Object.keys(existingClones) : [];
                var ttlInSeconds = await matchTimeDifference(matchkey);
                if (existingCloneIds.length > 0) {
                    // 🛠 Update existing cloned contests
                    for (const id of existingCloneIds) {
                        const updatedClone = {
                            ...existingClones[id],
                            ...fieldsToUpdate,
                            contest_cat: categoryId,
                            is_running: 1,
                            joinedusers: 0,
                            is_duplicated: 1,
                            status: "opened"
                        };

                        await redisContest.hsetData(cloneKey, id, updatedClone, ttlInSeconds);
                        console.log(`🔁 Updated clone: ${id}`);
                    }
                    console.log(`✅ All existing ${existingCloneIds.length} cloned contests updated under: ${cloneKey}`);
                } else {
                    // ✨ Create new cloned contests
                    for (let i = 1; i <= matchChallengeData.setCount; i++) {
                        const cloneId = new mongoose.Types.ObjectId();
                        const clonedChallenge = {
                            ...fieldsToUpdate,
                            _id: cloneId,
                            contest_cat: categoryId,
                            is_running: 1,
                            matchchallengeid: cloneId,
                            clonedChallenge: challengeId,
                            joinedusers: 0,
                            is_duplicated: 1,
                            status: "opened"
                        };

                        await redisContest.hsetData(cloneKey, cloneId.toString(), clonedChallenge, ttlInSeconds);
                        console.log(`➕ New Clone ${i} stored in Redis: ${cloneKey}`);
                    }

                    console.log(`🎯 ${matchChallengeData.setCount} new cloned contests created under: ${cloneKey}`);
                }

                return true;
            } else {
                console.log("ℹ️ Base contest is not running. Clones not created.");
                return false;
            }
        } catch (error) {
            console.error("❌ Error in insertClonedData:", error);
            return false;
        }
    }

    async insertDuoClonedData(matchkey, challengeId, fieldsToUpdate) {
        try {
            const matchChallengeData = await dualgamematchChallengersModel.findOne({
                _id: mongoose.Types.ObjectId(challengeId)
            });

            if (!matchChallengeData) {
                console.error("❌ Challenge not found in DB.");
                return false;
            }

            if (matchChallengeData.is_running !== 1) {
                console.log("ℹ️ Base contest is not running. Clones not created.");
                return false;
            }

            const { entryfee, win_amount, maximum_user, setCount = 50 } = matchChallengeData;

            const cloneKey = `match:duogame:${matchkey}:entry:${entryfee}:win:${win_amount}:max:${maximum_user}:cloned_challenges`;

            const existingClones = await redisContest.hgetAllData(cloneKey);
            const existingCloneIds = existingClones ? Object.keys(existingClones) : [];

            const ttlInSeconds = await matchTimeDifference(matchkey);

            const neededClones = setCount - existingCloneIds.length;

            if (neededClones <= 0) {
                // ✅ Update existing cloned contests
                for (const id of existingCloneIds) {
                    try {
                        const existingData = typeof existingClones[id] === 'string'
                            ? JSON.parse(existingClones[id])
                            : existingClones[id];

                        const updatedClone = {
                            ...existingData,
                            ...fieldsToUpdate,
                            is_running: 1,
                            joinedusers: 0,
                            is_duplicated: 1,
                            status: "opened"
                        };

                        await redisContest.hsetData(cloneKey, id, updatedClone, ttlInSeconds);
                        console.log(`🔁 Updated clone: ${id}`);
                    } catch (err) {
                        console.error(`❌ Error updating clone ${id}:`, err);
                    }
                }

                console.log(`✅ All existing ${existingCloneIds.length} cloned contests updated under: ${cloneKey}`);
            } else {
                // ➕ Create only missing clones
                for (let i = 0; i < neededClones; i++) {
                    try {
                        const cloneId = new mongoose.Types.ObjectId();

                        const clonedChallenge = {
                            ...fieldsToUpdate,
                            is_running: 1,
                            joinedusers: 0,
                            is_duplicated: 1,
                            status: "opened"
                        };

                        // ✅ Force correct IDs
                        clonedChallenge._id = cloneId;
                        clonedChallenge.matchchallengeid = cloneId;
                        clonedChallenge.clonedChallenge = challengeId;

                        await redisContest.hsetData(cloneKey, cloneId.toString(), clonedChallenge, ttlInSeconds);
                        console.log(`➕ New Clone stored: ${cloneId}`);
                    } catch (err) {
                        console.error(`❌ Error creating clone ${i + 1}:`, err);
                    }
                }
                console.log(`🎯 ${neededClones} new cloned contests created under: ${cloneKey}`);
            }

            return true;

        } catch (error) {
            console.error("❌ Error in insertDuoClonedData:", error);
            return false;
        }
    }
}

module.exports = redisClonedContest;