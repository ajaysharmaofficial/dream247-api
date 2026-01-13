const express = require('express');
const cors = require('cors');
const path = require('path');
const initializeConstants = require("./config/const_credential.js");
const { connectDB } = require("./db/dbconnection");

// Initialize Express
const app = express();

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['*'];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'platform',
    'X-Requested-With',
    'Accept'
  ],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

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
