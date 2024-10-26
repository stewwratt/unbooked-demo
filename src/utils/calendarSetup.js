import { google } from "googleapis";
import fs from "fs";

const TOKEN_PATH = "token.json";
const CREDENTIALS_PATH = "../credentials.json";

let oauth2Client = null;

export const setupCalendar = async () => {
  if (oauth2Client) return oauth2Client;

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  try {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
    oauth2Client.setCredentials(token);
  } catch (error) {
    await getNewToken(oauth2Client);
  }

  return oauth2Client;
};

const getNewToken = async (oauth2Client) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/calendar.readonly"],
  });

  console.log("Authorize this app by visiting this url:", authUrl);

  // Here, you would typically use a server to handle the OAuth flow
  // For simplicity, we'll use a manual process
  const code = await new Promise((resolve) => {
    const readline = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    readline.question("Enter the code from that page here: ", (code) => {
      readline.close();
      resolve(code);
    });
  });

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  console.log("Token stored to", TOKEN_PATH);
};

export const getMytimeEvents = async () => {
  const auth = await setupCalendar();
  const calendar = google.calendar({ version: "v3", auth });

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date().toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: "startTime",
    q: "Complete Barber Services",
  });

  return res.data.items.filter((event) =>
    event.summary.toLowerCase().includes("Complete Barber Services")
  );
};
