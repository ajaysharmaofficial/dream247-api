const express = require('express');
const path = require('path');
const initializeConstants = require("./config/const_credential.js");
const { connectDB } = require("./db/dbconnection");

// Initialize Express
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "/public")));

// Default Route
app.get('/', (req, res) => {
  res.send('IMG Fantasy API Gateway running ✅');
});

// Start Server
const startServer = async () => {
  try {
    global.constant = initializeConstants;
    connectDB(global.constant.DB_URL);
    // Register Routes
    require('./routes')(app);
    const startAllConsumers = require("./utils/kafkaConsumer/indexConsumer.js")

    startAllConsumers();

    const port = process.env.API_PORT;
    app.listen(port, () => {
      console.log(`✅ Server started on port ${port}`);
    });

  } catch (error) {
    console.error("❌ Failed to start the server:", error);
    process.exit(1);
  }
};

startServer();
