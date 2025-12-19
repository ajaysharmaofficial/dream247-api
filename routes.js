// Import all microservice routes
const userRoutes = require('./services/user-api-service/routes/userRoute');
const matchRoutes = require('./services/match-api-service/routes/route');
const contestRoutes = require('./services/contest-api-service/routes/route.js');
const completedMatchRoutes = require('./services/completed-match-api-service/routes/route.js');
const depositRoutes = require('./services/deposit-api-service/routes/paymentRoute.js');
const getmyteamsRoutes = require('./services/getmyteam-api-service/routes/route.js');
const joincontestRoutes = require('./services/joincontest-api-service/routes/route.js');
const kycRoutes = require('./services/kyc-api-service/routes/kycRoute.js');
const liveMatchRoutes = require('./services/live-match-api-service/routes/route.js');
const myjoinedContestRoutes = require('./services/myjoined-contest-api-service/routes/route.js');
const otherRoutes = require('./services/other-api-service/routes/otherRoute.js');
const teamRoutes = require('./services/team-api-service/routes/route.js');
const withdrawRoutes = require('./services/withdraw-api-service/routes/paymentRoute.js');

// Function to register all routes
module.exports = (app) => {
  app.use('/user', userRoutes);
  app.use('/match', matchRoutes);
  app.use('/contest', contestRoutes);
  app.use('/completed-match', completedMatchRoutes);
  app.use('/deposit', depositRoutes);
  app.use('/getmyteams', getmyteamsRoutes);
  app.use('/joincontest', joincontestRoutes);
  app.use('/kyc', kycRoutes);
  app.use('/live-match', liveMatchRoutes);
  app.use('/myjoined-contest', myjoinedContestRoutes);
  app.use('/other', otherRoutes);
  app.use('/team', teamRoutes);
  app.use('/withdraw', withdrawRoutes);
};
