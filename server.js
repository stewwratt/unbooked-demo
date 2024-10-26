const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { google } = require("googleapis");
const bodyParser = require("body-parser");
const { oauth2Client, getAuthUrl, getAccessToken } = require("./google-auth");
const fs = require("fs").promises;
const Stripe = require("stripe");
const twilio = require("twilio");

require("dotenv").config();

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = new twilio(accountSid, authToken);

app.use(cors());
app.use(bodyParser.json());

// Load tokens at startup
async function loadTokens() {
  try {
    const tokens = JSON.parse(await fs.readFile("tokens.json", "utf8"));
    oauth2Client.setCredentials(tokens);

    // Check token validity and refresh if necessary
    if (tokens.expiry_date < Date.now()) {
      console.log("Token has expired. Refreshing token...");
      await ensureAuthenticated();
    }
  } catch (error) {
    console.log("No stored tokens found. Please authenticate.");
  }
}

loadTokens();

// Utility function to ensure the user is authenticated
async function ensureAuthenticated() {
  if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
    throw new Error("Not authenticated. Please authorize the application.");
  }

  // Check if the access token has expired and refresh it if necessary
  if (oauth2Client.credentials.expiry_date < Date.now()) {
    try {
      const newTokens = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(newTokens.credentials);
      await fs.writeFile("tokens.json", JSON.stringify(newTokens.credentials));
    } catch (error) {
      console.error("Error refreshing access token:", error);
      throw new Error("Authentication error: Please re-authenticate.");
    }
  }
}

// Function to send SMS notification
async function sendOfferNotification(bookingHolderPhone, offerDetails) {
  try {
    const message = await twilioClient.messages.create({
      body: `You have received a new offer of $${offerDetails.offerAmount} for your booking. Respond within the next 30 minutes to accept or decline.`,
      from: process.env.TWILIO_PHONE_NUMBER, // Twilio phone number
      to: bookingHolderPhone, // Original booking holder's phone number
    });

    console.log("SMS sent:", message.sid);
    return message.sid;
  } catch (error) {
    console.error("Error sending SMS:", error);
    throw new Error("Failed to send SMS notification");
  }
}

app.post("/api/twilio-webhook", (req, res) => {
  const { Body, From } = req.body;

  // Handle the response from the original booking holder
  const response = Body.trim().toLowerCase();
  if (response === "yes") {
    // Logic for accepting the offer
    console.log(`Offer accepted by ${From}`);
    // Update the booking in Google Calendar, capture partial payment, etc.
  } else if (response === "no") {
    // Logic for rejecting the offer
    console.log(`Offer rejected by ${From}`);
  }

  res.send(
    `<Response><Message>Thank you for your response.</Message></Response>`
  );
});

// Eligibility check endpoint
app.get("/api/check-eligibility", async (req, res) => {
  const { lat, lon } = req.query;

  try {
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/distancematrix/json",
      {
        params: {
          origins: `${process.env.TARGET_LAT},${process.env.TARGET_LON}`,
          destinations: `${lat},${lon}`,
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
      }
    );

    if (
      !response.data.rows ||
      !response.data.rows[0] ||
      !response.data.rows[0].elements
    ) {
      throw new Error("Unexpected response structure from Distance Matrix API");
    }

    const distanceData = response.data.rows[0].elements[0];
    if (distanceData.status !== "OK") {
      throw new Error(`Distance Matrix API error: ${distanceData.status}`);
    }

    const distance = distanceData.distance.value; // in meters
    const maxDistance = 25000; // 25 km radius

    const isEligible = distance <= maxDistance;
    res.json({ eligible: isEligible });

    console.log("Distance data:", distanceData);
  } catch (error) {
    console.error(
      "Error fetching distance:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({ error: error.message });
  }
});

// Google OAuth routes
app.get("/auth", (req, res) => {
  const authUrl = getAuthUrl();
  res.redirect(authUrl);
});

app.get("/oauth2callback", async (req, res) => {
  const { code } = req.query;
  try {
    const tokens = await getAccessToken(code);
    oauth2Client.setCredentials(tokens);
    await fs.writeFile("tokens.json", JSON.stringify(tokens));
    res.send("Authentication successful! You can now use the calendar API.");
  } catch (error) {
    console.error("Error getting access token:", error);
    res.status(500).send("Authentication failed");
  }
});

// Mytime slots endpoint
app.get("/api/mytime-slots", async (req, res) => {
  try {
    await ensureAuthenticated(); // Ensure OAuth2 client is authenticated before proceeding

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: "startTime",
      q: "Complete Barber Services",
    });

    const mytimeEvents = response.data.items.filter(
      (event) => event.summary.includes("Complete Barber Services")
      // Here we could also list events with other summarys/names that are not "mytime"
    );

    const formattedEvents = mytimeEvents.map((event) => ({
      id: event.id,
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date,
      summary: event.summary,
      description: event.description, // include description to get price
    }));

    res.json(formattedEvents);
  } catch (error) {
    console.error("Error fetching mytime slots:", error);
    res.status(500).json({ error: "Failed to fetch mytime slots" });
  }
});

// Endpoint to get slot price from Google Calendar
app.get("/api/get-slot-price", async (req, res) => {
  const { slotId } = req.query;

  try {
    await ensureAuthenticated();

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const event = await calendar.events.get({
      calendarId: "primary",
      eventId: slotId,
    });

    const price = parseInt(event.data.description.split("Price: ")[1]) || 10000; // Extract price from description or default to 10000 cents
    res.json({ price });
  } catch (error) {
    console.error("Error fetching slot price:", error);
    res.status(500).json({ error: "Failed to fetch slot price" });
  }
});

// // Update slot after booking using JSON format
app.post("/api/update-slot-after-booking", async (req, res) => {
  const { slotId, bookingData, latestBookingPrice, recommendedPrice } =
    req.body;

  try {
    await ensureAuthenticated();

    // Fetch the existing event from Google Calendar
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const event = await calendar.events.get({
      calendarId: "primary",
      eventId: slotId,
    });

    // Parse the existing description as JSON or initialize with default structure
    let descriptionJSON = {
      status: "available",
      originalPrice: 10000,
      latestBookingPrice: null,
      recommendedPrice: null,
      bookings: [],
    };

    try {
      descriptionJSON = JSON.parse(event.data.description);
    } catch (error) {
      console.log(
        "Description is not in JSON format. Initializing new booking data."
      );
    }

    // Ensure bookings array exists
    if (!descriptionJSON.bookings) {
      descriptionJSON.bookings = [];
    }

    // Update top-level fields
    descriptionJSON.status = "booked";
    descriptionJSON.latestBookingPrice = latestBookingPrice;
    descriptionJSON.recommendedPrice = recommendedPrice;

    // Append new booking to the array
    descriptionJSON.bookings.push(bookingData);

    // Update the Google Calendar event with the new JSON description
    await calendar.events.patch({
      calendarId: "primary",
      eventId: slotId,
      requestBody: {
        description: JSON.stringify(descriptionJSON), // Retain old data and add new
      },
    });

    res.sendStatus(200);
  } catch (error) {
    console.error("Error updating slot after booking:", error);
    res.status(500).json({ error: "Unable to update slot after booking" });
  }
});

// Modify the existing endpoint to send SMS notifications
app.post("/api/add-offer", async (req, res) => {
  const { slotId, offerData } = req.body;

  try {
    await ensureAuthenticated();

    // Fetch the existing event from Google Calendar
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const event = await calendar.events.get({
      calendarId: "primary",
      eventId: slotId,
    });

    // Parse the existing description as JSON
    let descriptionJSON = {};
    try {
      descriptionJSON = JSON.parse(event.data.description);
    } catch (error) {
      console.error("Description is not in JSON format.", error);
      return res
        .status(400)
        .json({ error: "Invalid event description format" });
    }

    // Ensure that there are bookings available
    if (!descriptionJSON.bookings || descriptionJSON.bookings.length === 0) {
      return res.status(400).json({ error: "No active bookings found" });
    }

    // Add the offer to the latest booking in the `bookings` array
    const latestBooking =
      descriptionJSON.bookings[descriptionJSON.bookings.length - 1];

    // Ensure the `offers` array exists in the booking
    if (!latestBooking.offers) {
      latestBooking.offers = [];
    }

    // Add the new offer to the list of offers
    const newOffer = {
      offerId: `offer_${Date.now()}`,
      offerAmount: offerData.offerAmount,
      offerBy: offerData.offerBy, // Offer maker's email
      phone: offerData.phone, // Offer maker's phone
      location: offerData.location, // Offer maker's location
      offerAt: new Date().toISOString(), // Time when the offer was made
      offerValidUntil: offerData.offerValidUntil, // Offer valid for 30 minutes
      offerAccepted: false,
      partialPaymentID: null, // Placeholder for when the offer is accepted
      partialPaymentAmount: offerData.partialPaymentAmount, // Amount to the original booker
      partialPaymentCaptured: false,
      fullPaymentID: null, // Placeholder for full payment
      fullPaymentAmount: offerData.fullPaymentAmount, // Remaining amount to the service provider
      fullPaymentAuthorized: false,
      fullPaymentFulfilled: false,
      paymentSplit: true,
    };
    latestBooking.offers.push(newOffer);

    // Update the Google Calendar event with the new offer
    await calendar.events.patch({
      calendarId: "primary",
      eventId: slotId,
      requestBody: {
        description: JSON.stringify(descriptionJSON),
      },
    });

    // Send SMS notification to the original booking holder
    const originalBookingHolderPhone = latestBooking.phone;
    await sendOfferNotification(originalBookingHolderPhone, newOffer);

    res
      .status(200)
      .json({ message: "Offer added and SMS notification sent successfully" });
  } catch (error) {
    console.error("Error adding offer:", error);
    res
      .status(500)
      .json({ error: "Failed to add offer or send SMS notification" });
  }
});

// Set offer amount for a slot (update JSON description correctly)
app.post("/api/set-offer-amount", async (req, res) => {
  const { slotId, offerAmount } = req.body;

  try {
    await ensureAuthenticated();

    // Fetch the existing event from Google Calendar
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const event = await calendar.events.get({
      calendarId: "primary",
      eventId: slotId,
    });

    // Parse the existing description as JSON or initialize an empty object
    let descriptionJSON = {};
    try {
      descriptionJSON = JSON.parse(event.data.description);
    } catch (error) {
      console.log(
        "Description is not in JSON format. Initializing new booking data."
      );
      descriptionJSON.bookings = [];
    }

    // Update the suggested offer
    descriptionJSON.suggestedOffer = offerAmount;

    // Update the Google Calendar event with the updated JSON description
    await calendar.events.patch({
      calendarId: "primary",
      eventId: slotId,
      requestBody: {
        description: JSON.stringify(descriptionJSON),
      },
    });

    res.sendStatus(200);
  } catch (error) {
    console.error("Error setting offer amount:", error);
    res.status(500).json({ error: "Unable to set offer amount" });
  }
});

// Stripe Payment Intent creation
app.post("/create-payment-intent", async (req, res) => {
  const { amount, currency, slotID } = req.body;

  try {
    // Create a PaymentIntent with the specified amount, currency, and slotID
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // In the smallest currency unit, e.g., cents
      currency: currency, // Currency passed from frontend, e.g., 'usd' or 'aud'
      payment_method_types: ["card"], // Default to card payment
      capture_method: "manual", // Create an authorization hold
      metadata: {
        slotID: slotID, // Attach slotID for reference
      },
    });

    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res.status(500).send("Unable to create Payment Intent");
  }
});

// Set offer amount for a slot
app.post("/api/set-offer-amount", async (req, res) => {
  const { slotId, offerAmount } = req.body;

  try {
    await ensureAuthenticated();

    // Update the Google Calendar event description to include the offer amount
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const event = await calendar.events.get({
      calendarId: "primary",
      eventId: slotId,
    });

    const updatedDescription = `${event.data.description}\nOffer Amount: ${offerAmount}`;
    await calendar.events.patch({
      calendarId: "primary",
      eventId: slotId,
      requestBody: {
        description: updatedDescription,
      },
    });

    res.sendStatus(200);
  } catch (error) {
    console.error("Error setting offer amount:", error);
    res.status(500).json({ error: "Unable to set offer amount" });
  }
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
