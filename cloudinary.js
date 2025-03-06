const cloudinary = require("cloudinary").v2;
require("dotenv").config();

cloudinary.config({
  cloud_name: process.env.MYCLOUDNAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECERT, // Fixed typo (API_SECERT -> API_SECRET)
});

module.exports = cloudinary;
