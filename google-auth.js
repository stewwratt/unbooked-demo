const { google } = require("googleapis");
const fs = require("fs").promises;
require("dotenv").config();

const credentials = require("./credentials.json");

const { client_secret, client_id, redirect_uris } = credentials.web;
const oauth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0]
);

function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/calendar"],
  });
}

async function getAccessToken(code) {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

module.exports = {
  oauth2Client,
  getAuthUrl,
  getAccessToken,
};
