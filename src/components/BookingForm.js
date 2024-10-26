import React, { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  useStripe,
  useElements,
  CardElement,
  PaymentRequestButtonElement,
} from "@stripe/react-stripe-js";
import axios from "axios";
import { parseJSONSafely } from "../utils/jsonUtils"; // Import the utility function

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

function BookingForm({ slot, onClose }) {
  const stripe = useStripe();
  const elements = useElements();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    location: "",
  });
  const [offerAmount, setOfferAmount] = useState(""); // Willing-to-accept offer
  const [price, setPrice] = useState(10000); // Default price in cents
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [useCardElement, setUseCardElement] = useState(true);

  // Fetch price from Google Calendar slot
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        if (slot.description) {
          const descriptionJSON = parseJSONSafely(slot.description);
          if (descriptionJSON.price) {
            setPrice(descriptionJSON.price);
          }
        } else {
          // If no price in the description, fetch from backend
          const response = await axios.get(
            `${process.env.REACT_APP_API_BASE_URL}/api/get-slot-price`,
            { params: { slotId: slot.id } }
          );
          setPrice(response.data.price);
        }
      } catch (err) {
        console.error("Error fetching price:", err);
      }
    };

    fetchPrice();
  }, [slot.description, slot.id]);

  // PaymentRequest setup for HTTPS environment
  useEffect(() => {
    if (stripe && window.location.protocol === "https:") {
      const pr = stripe.paymentRequest({
        country: "AU",
        currency: "aud",
        total: {
          label: "Booking Payment",
          amount: price,
        },
        requestPayerName: true,
        requestPayerEmail: true,
      });

      pr.canMakePayment().then((result) => {
        if (result) {
          setPaymentRequest(pr);
          setUseCardElement(false);
        }
      });

      pr.on("paymentmethod", async (event) => {
        setLoading(true);
        setError(null);

        try {
          const response = await axios.post(
            `${process.env.REACT_APP_API_BASE_URL}/create-payment-intent`,
            {
              amount: price,
              currency: "aud",
              slotID: slot.id,
            }
          );

          const { clientSecret } = response.data;

          const { error: stripeError } = await stripe.confirmCardPayment(
            clientSecret,
            { payment_method: event.paymentMethod.id },
            { handleActions: false }
          );

          if (stripeError) {
            throw new Error(stripeError.message);
          }

          event.complete("success");

          // Calculate recommended price
          const recommendedPrice = price + offerAmount * 100 * 2;

          // Update the Google Calendar slot after booking
          const newBooking = {
            bookingId: `booking_${Date.now()}`,
            price,
            paymentID: clientSecret,
            name: formData.name,
            contact: formData.email,
            phone: formData.phone,
            location: formData.location,
            amountAuthorisedForPayment: price,
            paymentAuthorised: true,
            paymentFulfilled: false,
            desiredOffer: offerAmount * 100,
            bookedAt: new Date().toISOString(),
          };

          // Send updated booking info as JSON
          await axios.post(
            `${process.env.REACT_APP_API_BASE_URL}/api/update-slot-after-booking`,
            {
              slotId: slot.id,
              bookingData: newBooking,
              latestBookingPrice: price,
              recommendedPrice,
            }
          );
        } catch (err) {
          setError(err.message || "Failed to process payment.");
          event.complete("fail");
        } finally {
          setLoading(false);
        }
      });
    }
  }, [stripe, price, slot.id, formData, offerAmount]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevState) => ({ ...prevState, [name]: value }));
  };

  const handleOfferChange = (e) => {
    setOfferAmount(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!useCardElement) return;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_BASE_URL}/create-payment-intent`,
        {
          amount: price,
          currency: "aud",
          slotID: slot.id,
        }
      );

      const { clientSecret } = response.data;

      const { error: stripeError } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: elements.getElement(CardElement),
            billing_details: {
              name: formData.name,
              email: formData.email,
            },
          },
        }
      );

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      // Calculate recommended price
      const recommendedPrice = price + offerAmount * 100 * 2;

      // Construct new booking data
      const newBooking = {
        bookingId: `booking_${Date.now()}`,
        price,
        paymentID: clientSecret,
        name: formData.name,
        contact: formData.email,
        phone: formData.phone,
        location: formData.location,
        amountAuthorisedForPayment: price,
        paymentAuthorised: true,
        paymentFulfilled: false,
        desiredOffer: offerAmount * 100,
        bookedAt: new Date().toISOString(),
      };

      // Send updated booking info and top-level fields as JSON
      await axios.post(
        `${process.env.REACT_APP_API_BASE_URL}/api/update-slot-after-booking`,
        {
          slotId: slot.id,
          bookingData: newBooking,
          latestBookingPrice: price,
          recommendedPrice,
        }
      );

      setLoading(false);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to process payment.");
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .location-placeholder::placeholder {
          color: #a0a0a0; /* Less bright placeholder color */
          font-size: 0.75rem; /* Smaller font size */
          opacity: 0.6; /* Firefox support */
        }
        
        .location-placeholder::-ms-input-placeholder {
          color: #a0a0a0; /* Less bright placeholder color for Edge */
        }
      `}</style>
      <form className="mt-4" onSubmit={handleSubmit}>
        <div className="mb-4">
          <p className="text-green-500">
            The booking price for this slot is: ${price / 100} AUD
          </p>
          <p className="text-green-500">
            Thank you for your interest in booking this slot. Your payment will
            not be executed until 3 hours before the service delivery or if
            someone offers you more for your slot and you choose to accept.
          </p>
          <label
            htmlFor="name"
            className="mt-4 block text-sm font-medium text-muted mb-1"
          >
            Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 bg-secondary border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-accent text-text"
          />
        </div>
        <div className="mb-4">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-muted mb-1"
          >
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 bg-secondary border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-accent text-text"
          />
        </div>
        <div className="mb-4">
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-muted mb-1"
          >
            Phone
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="w-full px-3 py-2 bg-secondary border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-accent text-text"
          />
        </div>
        <div className="mb-4">
          <label
            htmlFor="location"
            className="block text-sm font-medium text-muted mb-1"
          >
            Desired Service Location
          </label>
          <input
            type="text"
            id="location"
            name="location"
            value={formData.location}
            onChange={handleChange}
            required
            placeholder="Your address or other preferred location"
            className="w-full px-3 py-2 bg-secondary border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-accent text-text location-placeholder"
          />
        </div>
        <div className="mb-4">
          <label
            htmlFor="offer"
            className="block text-sm font-medium text-muted mb-1"
          >
            If someone offers to buy your slot, how much would you accept to
            give it up? (AUD)
          </label>
          <input
            type="number"
            id="offer"
            value={offerAmount}
            onChange={handleOfferChange}
            required
            className="w-full px-3 py-2 bg-secondary border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-accent text-text"
          />
        </div>
        {paymentRequest && !useCardElement && (
          <div className="mb-4">
            <PaymentRequestButtonElement options={{ paymentRequest }} />
          </div>
        )}

        {useCardElement && (
          <div className="mb-4">
            <label
              htmlFor="card-element"
              className="block text-sm font-medium text-muted mb-1"
            >
              Card Details
            </label>
            <CardElement
              id="card-element"
              className="w-full px-3 py-2 bg-secondary border border-gray-600 rounded-md"
            />
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted bg-secondary rounded-md hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-accent"
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`px-4 py-2 text-sm font-medium text-text bg-accent rounded-md hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-accent ${
              loading ? "opacity-50 cursor-not-allowed" : ""
            }`}
            disabled={loading}
          >
            {loading ? "Processing..." : "Confirm Booking"}
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
      </form>
    </>
  );
}

export default function BookingPage({ slot, onClose }) {
  return (
    <Elements stripe={stripePromise}>
      <BookingForm slot={slot} onClose={onClose} />
    </Elements>
  );
}
