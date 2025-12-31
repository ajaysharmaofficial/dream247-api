const mongoose = require("mongoose");
mongoose.set("strictQuery", true);

exports.connectDB = async () => {
    try {
        console.log(global.constant.DB_URL);
        const conn = await mongoose.connect(`${global.constant.DB_URL}`, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            readPreference: "secondaryPreferred", // Set default read preference for all queries
            writeConcern: { w: "majority" }, // Set write concern
        });
        console.log(`Database connected successfully on ${conn.connection.host}`);
    } catch (error) {
        console.log("Database not connected", error);
        // process.exit(1); // Exit process if the database connection fails
        return true;
    }
};

exports.disconnectDB = async () => {
    try {
        await mongoose.disconnect();
        console.log("Disconnected from MongoDB");
    } catch (error) {
        console.error("Error during disconnection:", error);
    }
};