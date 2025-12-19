const redisContest = require("../utils/redis/redisContest");
const { matchTimeDifference } = require("../utils/matchTimeDiffrence");
const redisLiveContest = require("../utils/redis/redisLiveContest");
class redisUpdateChallenge {

    async insertRedisFields(matchkey, categoryId, challengeId, fieldsToUpdate) {
        try {
            const keyName = `match:${matchkey}:challenges`;
            const expRedisTime = await matchTimeDifference(matchkey);

            // Prepare Redis data
            let existingChallenge = await redisContest.hgetData(keyName, challengeId);
            if (existingChallenge) {
                existingChallenge = {
                    ...existingChallenge,
                    ...fieldsToUpdate,
                };
                console.log(`✅ Challenge ${challengeId} updated.`);
            } else {
                existingChallenge = {
                    _id: challengeId,
                    contest_cat: categoryId,
                    ...fieldsToUpdate,
                };
                console.log(`🆕 Challenge ${challengeId} added.`);
            }

            console.log("fieldsToUpdate", fieldsToUpdate);

            // Save to Redis hashes
            await redisContest.hsetData(keyName, challengeId, existingChallenge, expRedisTime);

            // Only proceed if all signature fields exist and are valid
            if (
                fieldsToUpdate.entryfee !== undefined &&
                fieldsToUpdate.win_amount !== undefined &&
                fieldsToUpdate.maximum_user !== undefined
            ) {
                const signature = `${fieldsToUpdate.entryfee}_${fieldsToUpdate.win_amount}_${fieldsToUpdate.maximum_user}`;
                const signatureSetKey = `match:${matchkey}:category:${categoryId}:signatures`;
                const uniqueListKey = `match:${matchkey}:category:${categoryId}:unique_challenges`;

                const isNewSignature = await redisContest.redis.sadd(signatureSetKey, signature);
                if (isNewSignature === 1) {
                    await redisContest.redis.rpush(uniqueListKey, JSON.stringify(existingChallenge));
                    await redisContest.redis.expire(signatureSetKey, expRedisTime);
                    await redisContest.redis.expire(uniqueListKey, expRedisTime);
                    console.log(`🌟 Unique challenge added: ${signature}`);
                } else {
                    console.log(`⚠️ Duplicate signature skipped: ${signature}`);
                }
            } else {
                console.warn("🚫 Signature not created: missing required fields.");
            }

            console.log(`🚀 Data saved in Redis Hash: ${keyName} -> ${challengeId}`);
            return true;
        } catch (error) {
            console.error("❌ Error updating Redis fields:", error);
            return false;
        }
    }

    async insertDuoGameRedisFields(matchkey, challengeId, fieldsToUpdate, prefix = 'duochallenges') {
        try {
            // Get expiration time upfront
            const expRedisTime = await matchTimeDifference(matchkey);
            const keyName = `match:${matchkey}:${prefix}`;

            // Start pipeline
            const pipeline = redisContest.redis.pipeline();

            // Get existing Redis challenge (only once)
            let existingChallenge = await redisContest.hgetData(keyName, challengeId);
            const isNewChallenge = !existingChallenge;

            if (isNewChallenge) {
                existingChallenge = { _id: challengeId, ...fieldsToUpdate };
                console.log(`🆕 New challenge: ${challengeId}`);
            } else {
                existingChallenge = { ...existingChallenge, ...fieldsToUpdate };
                console.log(`✅ Updated challenge: ${challengeId}`);
            }

            pipeline.hset(keyName, challengeId, JSON.stringify(existingChallenge));

            pipeline.expire(keyName, expRedisTime);

            const { entryfee, win_amount, maximum_user, status } = existingChallenge;
            if (entryfee !== undefined && win_amount !== undefined && maximum_user !== undefined) {
                const signature = `${entryfee}_${win_amount}_${maximum_user}`;
                // const matchGroupsKey = `match:${matchkey}:${prefix}:groups`;
                // const groupExists = await redisContest.hgetData(matchGroupsKey, signature);
                // if (!groupExists) {
                //     pipeline.hset(matchGroupsKey, signature, JSON.stringify(existingChallenge));
                //     pipeline.expire(matchGroupsKey, expRedisTime);
                // }

                const groupListKey = `contest_group:${matchkey}:${prefix}:${signature}:ids`;
                const groupOpenedKey = `contest_group:${matchkey}:${prefix}:${signature}:opened_ids`;

                pipeline.sadd(groupListKey, challengeId);
                pipeline.expire(groupListKey, expRedisTime);

                if (status === 'opened') {
                    pipeline.sadd(groupOpenedKey, challengeId);
                    pipeline.expire(groupOpenedKey, expRedisTime);
                } else if (status === 'closed') {
                    pipeline.srem(groupOpenedKey, challengeId);
                }
            } else {
                console.warn("🚫 Skipping group logic: missing entryfee, win_amount, or maximum_user");
            }

            // Execute pipeline
            await pipeline.exec();
            console.log(`🚀 Saved challenge in Redis: ${keyName} → ${challengeId}`);
            return true;

        } catch (err) {
            console.error("❌ Redis insert error:", err);
            return false;
        }
    }

}

module.exports = redisUpdateChallenge;