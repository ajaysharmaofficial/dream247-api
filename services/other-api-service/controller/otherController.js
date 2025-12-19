const otherService = require('../services/otherService.js');
const userLeagueModel = require("../../../models/userLeagueModel.js");
// const matchchallengersModel = require("../../../models/matchchallengersModel.js");
const userLeaderBoardModel = require("../../../models/userLeaderBoardModel.js");
const mongoose = require('mongoose');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const { renderFile } = require('ejs');
const AWS = require('aws-sdk');
const util = require('util');
const axios = require('axios');

// AWS.config.update({
//     accessKeyId: global.constant.AWAWS_ACCESS_KEY_ID_NEW,
//     secretAccessKey: global.constant.AWS_SECRET_ACCESS_KEY_NEW,
//     region: global.constant.REGION,
//   });

// const s3 = new AWS.S3();

exports.dbCheck = async (req, res) => {
  try {
    const data = await otherService.dbCheck();

    if (data && data.status) {
      return res.status(200).json({ data });
    } else {
      return res.status(200).json({ data });
    }
  } catch (error) {
    console.error("Error:", error);
    return res.status(200).json({ data });
  }
}

exports.upcomingMatchesSeries = async (req, res) => {
  try {
    const data = await otherService.upcomingMatchesSeries();

    if (data && data.status) {
      return res.status(200).json({ data });
    } else {
      return res.status(200).json({ data });
    }
  } catch (error) {
    console.error("Error:", error);
    return res.status(200).json({ data });
  }
}

exports.createPdf = async (req, res, next) => {
  try {
    function chunkArray(arr, size) {
      const chunks = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    }

    const chunkSize = 20000;

    const pipeline = [
      {
        '$match': {
          'challengeid': new mongoose.Types.ObjectId(req.query.challengeid)
        }
      },
      {
        '$project': {
          'teamid': 1,
          'userid': 1
        }
      },
      {
        '$lookup': {
          'from': 'jointeams',
          'localField': 'teamid',
          'foreignField': '_id',
          'as': 'teamData'
        }
      },
      {
        '$unwind': {
          'path': '$teamData'
        }
      },
      {
        '$replaceRoot': {
          'newRoot': '$teamData'
        }
      },
      {
        '$project': {
          'players': 1,
          'userid': 1,
          'captain': 1,
          'vicecaptain': 1,
          'teamnumber': 1
        }
      },
      {
        '$lookup': {
          'from': 'users',
          'localField': 'userid',
          'foreignField': '_id',
          'as': 'team'
        }
      },
      {
        '$unwind': {
          'path': '$team',
        }
      },
      {
        '$addFields': {
          'team': '$team.team'
        }
      },
      {
        '$lookup': {
          'from': 'players',
          'localField': 'players',
          'foreignField': '_id',
          'as': 'players'
        }
      },
      {
        $sort: {
          team: 1
        }
      },
    ];

    const data = await userLeagueModel.aggregate(pipeline);
    const chunkedData = chunkArray(data, chunkSize);

    const renderFile = util.promisify(ejs.renderFile);

    const requestedIndex = parseInt(req.query.index);
    if (isNaN(requestedIndex) || requestedIndex < 0 || requestedIndex >= chunkedData.length) {
      return res.status(400).send('Invalid index provided.');
    }

    const selectedChunk = chunkedData[requestedIndex];

    const ejsData = {
      title: 'Team Players',
      message: 'This PDF contains team players information.',
      data: selectedChunk,
    };

    const htmlContent = await renderFile(path.join(__dirname, '../views/createPdf.ejs'), ejsData);

    console.log('HTML Content Path:', path.join(__dirname, '../views/createPdf.ejs'));

    const createPdfBuffer = async (htmlContent) => {
      // const browser = await puppeteer.launch({
      //   // executablePath: '/usr/lib/chromium',
      //   headless: true,
      //   // executablePath: puppeteer.executablePath(),
      //   // args: [ '--disable-gpu', '--disable-setuid-sandbox', '--no-sandbox', '--no-zygote' ]
      //   args: ['--no-sandbox', '--disable-setuid-sandbox'],
      // });
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage', // Prevents crashes in Docker with limited shared memory
          '--disable-software-rasterizer',
          '--disable-gpu', // Disable GPU acceleration
          '--disable-extensions',
          '--disable-features=VizDisplayCompositor', // Further reduces GPU dependencies
        ],
        dumpio: true, // Outputs logs to the console
      });
      // const browser = await puppeteer.launch({
      //   headless: true,
      //   args: ['--no-sandbox', '--disable-setuid-sandbox'],
      //   dumpio: true, // Outputs logs to the console
      // });

      const page = await browser.newPage();
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        if (['stylesheet', 'font', 'image'].includes(req.resourceType())) {
          req.abort();
        } else {
          req.continue();
        }
      });
      await page.setContent(htmlContent, { waitUntil: 'domcontentloaded', timeout: 0 });
      const pdfBuffer = await page.pdf({ format: 'A4' });
      await browser.close();
      return pdfBuffer;
    };

    const pdfBuffer = await createPdfBuffer(htmlContent);

    const s3Params = {
      Bucket: global.constant.BUCKET_NAME,
      Key: `pdfs/team-players-${requestedIndex}.pdf`,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      // ACL: 'public-read',
    };

    const upload = new AWS.S3.ManagedUpload({
      params: s3Params,
    });
    const s3Response = await upload.promise();

    const readableStream = new stream.PassThrough();
    readableStream.end(pdfBuffer);

    // Set headers
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="generated-document.pdf"',
      'Content-Length': pdfBuffer.length,
    });

    // Pipe the stream to the response
    readableStream.pipe(res);
    // res.send(s3Response.Location);
    // res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating or uploading PDF:', error);
    res.status(500).send('Error generating or uploading PDF');
  }
};

exports.createPdfNew = async (req, res, next) => {
  try {
    console.log("req.query.challengeid", req.query.challengeid);
    const pipeline = [
      {
        '$match': {
          'challengeid': new mongoose.Types.ObjectId(req.query.challengeid)
        }
      },
      {
        '$project': {
          'teamid': 1,
          'userid': 1
        }
      },
      {
        '$lookup': {
          'from': 'jointeams',
          'localField': 'teamid',
          'foreignField': '_id',
          'as': 'teamData'
        }
      },
      {
        '$unwind': {
          'path': '$teamData'
        }
      },
      {
        '$replaceRoot': {
          'newRoot': '$teamData'
        }
      },
      {
        '$project': {
          'players': 1,
          'userid': 1,
          'captain': 1,
          'vicecaptain': 1,
          teamnumber: 1
        }
      },
      {
        '$lookup': {
          'from': 'users',
          'localField': 'userid',
          'foreignField': '_id',
          'as': 'team'
        }
      },
      {
        '$unwind': {
          'path': '$team',
          'preserveNullAndEmptyArrays': true
        }
      },
      {
        '$addFields': {
          'team': '$team.team'
        }
      },
      {
        '$lookup': {
          'from': 'players',
          'localField': 'players',
          'foreignField': '_id',
          'as': 'players'
        }
      },
      {
        $sort: {
          team: 1
        }
      }
    ];
    const data = await userLeagueModel.aggregate(pipeline);

    function chunkArray(arr, size) {
      const chunks = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    }
    const chunkSize = 20000;
    const pipe = [
      {
        '$match': {
          'challengeid': new mongoose.Types.ObjectId(req.query.challengeid)
        }
      },
      {
        '$project': {
          'teamid': 1,
          'userid': 1
        }
      },
      {
        '$lookup': {
          'from': 'jointeams',
          'localField': 'teamid',
          'foreignField': '_id',
          'as': 'teamData'
        }
      },
      {
        '$unwind': {
          'path': '$teamData'
        }
      },
      {
        '$replaceRoot': {
          'newRoot': '$teamData'
        }
      },
      {
        '$project': {
          'players': 1,
          'userid': 1,
          'captain': 1,
          'vicecaptain': 1,
          'teamnumber': 1
        }
      },
      {
        '$lookup': {
          'from': 'users',
          'localField': 'userid',
          'foreignField': '_id',
          'as': 'team'
        }
      },
      {
        '$unwind': {
          'path': '$team',

        }
      },
      {
        '$addFields': {
          'team': '$team.team'
        }
      },
      {
        '$lookup': {
          'from': 'players',
          'localField': 'players',
          'foreignField': '_id',
          'as': 'players'
        }
      },
      {
        $project: {
          players: 0
        }
      },
      {
        $sort: {
          team: 1
        }
      },

    ];
    const chunksdata = await userLeagueModel.aggregate(pipe);
    const chunkedData = chunkArray(data, chunkSize);
    let result = [];
    let index = 0
    const extractValidChar = (str) => {
      const match = str.match(/[a-zA-Z0-9]/);
      return match ? match[0] : '';
    };

    for (let a = 0; a < chunkedData.length; a++) {
      const chunk = chunkedData[a];
      // console.log("chunk", chunk[chunk.length - 1].team);

      const min = (a === 0)
        ? '0'
        : extractValidChar(chunk[0].team); // Extract first valid character from first item in chunk

      const max = extractValidChar(chunk[chunk.length - 1].team); // Extract first valid character from last item in chunk
      // console.log("max", max);

      result.push({ min, max, index });
      index++;
    }
    // res.send(result);
    res.status(200).json({
      data: result
    });
  } catch (error) {
    console.log(error);
    res.status(500).send('An error occurred during PDF generation.');
  }
};

const getBase64ImageFromURL = async (imageUrl) => {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer'
    });
    return `data:image/png;base64,${Buffer.from(response.data, 'binary').toString('base64')}`;
  } catch (error) {
    console.error("Error fetching image:", error);
    return ''; // Return an empty string if the image fails to load
  }
};

exports.contestPdfDownload = async (req, res, next) => {
  try {
    const matchChallenges = await matchchallengersModel.find(
      {
        matchkey: new mongoose.Types.ObjectId(req.query.matchkey), status: { $in: ['opened', 'closed'] },
        entryfee: 0
        // '_id': mongoose.Types.ObjectId('67a3bfdf9cc772b41a4b8316')
      }
    );

    if (matchChallenges.length > 0) {
      for (let challenge of matchChallenges) {
        console.log('challenge------->>>>>>', challenge);
        const pipeline = [
          {
            '$match': {
              'challengeid': new mongoose.Types.ObjectId(challenge._id)
            }
          },
          {
            '$lookup': {
              from: "players",
              localField: "playersData",
              foreignField: "_id",
              as: "players"
            }
          },
          // {
          //   $sort: {
          //     user_team: 1
          //   }
          // },
          // {
          //   $limit: 8000
          // }
        ];

        const data = await userLeaderBoardModel.aggregate(pipeline);
        // console.log('data', data);
        // sdfdsf
        if (data.length === 0) continue;

        const logoUrl = `${global.constant.IMAGE_URL}logo.png`;

        const base64Logo = await getBase64ImageFromURL(logoUrl);

        const ejsData = {
          title: 'Team Players',
          message: 'This PDF contains team players information.',
          data: data,
          base64Logo: base64Logo
        };

        const htmlContent = await renderFile(path.join(__dirname, '../views/createPdf.ejs'), ejsData);

        const createPdfBuffer = async (htmlContent) => {
          const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            dumpio: true, // Outputs logs to the console
            timeout: 100000
          });

          const page = await browser.newPage();
          await page.setRequestInterception(true);
          page.on('request', (req) => {
            if (['stylesheet', 'font', 'image'].includes(req.resourceType())) {
              req.abort();
            } else {
              req.continue();
            }
          });
          await page.setContent(htmlContent, { waitUntil: 'domcontentloaded', timeout: 0 });
          const pdfBuffer = await page.pdf({ format: 'A4' });
          await browser.close();
          return pdfBuffer;
        };

        const pdfBuffer = await createPdfBuffer(htmlContent);

        // Upload to S3
        const fileName = `challenge_${challenge._id}`;

        const params = {
          Bucket: global.constant.BUCKET_NAME,
          Key: `pdfs/${process.env.secretManager}/matchkey_${req.query.matchkey}/${fileName}.pdf`,
          Body: pdfBuffer,
          ContentType: 'application/pdf'
        };

        try {
          const uploadResult = await s3.upload(params).promise();
          console.log("uploadResult.Location", uploadResult.Location);
          continue;
        } catch (error) {
          console.error('Error uploading PDF to S3:', error);
          continue;
        }
      }
      return {
        status: true,
        message: "File pdf uploaded successfully."
      }
    } else {
      return {
        status: false,
        message: "No contests found."
      }
    }
  } catch (error) {
    console.error("Error:", error);

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred. Please try again later.",
    });
  }
};

exports.fetchMainBanner = async (req, res, next) => {
  try {
    const data = await otherService.fetchMainBanner(req);
    return res.status(200).json(Object.assign({ success: true }, data));
  } catch (error) {
    next(error);
  }
};

exports.fetchPopupNotify = async (req, res, next) => {
  try {
    const data = await otherService.fetchPopupNotify(req);
    return res
      .status(200)
      .json(Object.assign({ success: data.status }, data));
  } catch (error) {
    console.error("Error:", error);

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred. Please try again later.",
    });
  }
};

exports.fetchUserStory = async (req, res, next) => {
  try {
    const data = await otherService.fetchUserStory(req);
    return res
      .status(200)
      .json(Object.assign({ success: data.status }, data));
  } catch (error) {
    console.error("Error:", error);

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred. Please try again later.",
    });
  }
};

exports.fetchNotifications = async (req, res, next) => {
  try {
    const data = await otherService.fetchNotifications(req);
    return res
      .status(200)
      .json(Object.assign({ success: data.status }, data));
  } catch (error) {
    console.error("Error:", error);

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred. Please try again later.",
    });
  }
};

exports.fetchAllSeries = async (req, res, next) => {
  try {
    const data = await otherService.fetchAllSeries(req);
    // console.log("-----data---",data)
    return res
      .status(200)
      .json(Object.assign({ success: data.status }, data));
  } catch (error) {
    console.error("Error:", error);

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred. Please try again later.",
    });
  }
};

exports.fetchLeaderboardData = async (req, res, next) => {
  try {
    const data = await otherService.fetchLeaderboardData(req);
    // console.log("-----data---",data)
    return res
      .status(200)
      .json(Object.assign({ success: data.status }, data));
  } catch (error) {
    console.error("Error:", error);

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred. Please try again later.",
    });
  }
};

exports.postPromoterData = async (req, res, next) => {
  try {
    const data = await otherService.postPromoterData(req);
    // console.log("-----data---",data)
    return res
      .status(200)
      .json(Object.assign({ success: data.status }, data));
  } catch (error) {
    console.error("Error:", error);

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred. Please try again later.",
    });
  }
};

exports.fetchPromoterData = async (req, res, next) => {
  try {
    const data = await otherService.fetchPromoterData(req);
    // console.log("-----data---",data)
    return res
      .status(200)
      .json(Object.assign({ success: data.status }, data));
  } catch (error) {
    console.error("Error:", error);

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred. Please try again later.",
    });
  }
};

exports.fetchInvestorCategory = async (req, res, next) => {
  try {
    const data = await otherService.fetchInvestorCategory(req);
    // console.log("-----data---",data)
    return res
      .status(200)
      .json(Object.assign({ success: data.status }, data));
  } catch (error) {
    console.error("Error:", error);

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred. Please try again later.",
    });
  }
};

exports.fetchInvestorUserData = async (req, res, next) => {
  try {
    const data = await otherService.fetchInvestorUserData(req);
    // console.log("-----data---",data)
    return res
      .status(200)
      .json(Object.assign({ success: data.status }, data));
  } catch (error) {
    console.error("Error:", error);

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred. Please try again later.",
    });
  }
};

exports.expertAdviceList = async (req, res, next) => {
  try {
    const data = await otherService.expertAdviceList(req);
    // console.log("-----data---",data)
    return res
      .status(200)
      .json(Object.assign({ success: data.status }, data));
  } catch (error) {
    console.error("Error:", error);

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred. Please try again later.",
    });
  }
};

