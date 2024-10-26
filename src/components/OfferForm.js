import React, { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  useStripe,
  useElements,
  CardElement,
} from "@stripe/react-stripe-js";
import axios from "axios";

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

function OfferForm({ slot, onClose }) {
  const stripe = useStripe();
  const elements = useElements();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    location: "",
  });
  const [offerAmount, setOfferAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [bookingPrice, setBookingPrice] = useState(10000); // Default booking price (in cents)

  // Fetch the slot's booking price from the backend (API call to get slot price)
  useEffect(() => {
    const fetchSlotPrice = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_API_BASE_URL}/api/get-slot-price`,
          { params: { slotId: slot.id } }
        );
        setBookingPrice(response.data.price); // Price should be in cents
      } catch (error) {
        console.error("Error fetching slot price:", error);
      }
    };

    fetchSlotPrice();
  }, [slot.id]);

  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevState) => ({ ...prevState, [name]: value }));
  };

  const handleOfferChange = (e) => {
    setOfferAmount(e.target.value);
  };

  // Handle the offer submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return; // Stripe.js has not loaded yet

    setLoading(true);
    setError(null);

    try {
      // Convert offerAmount to cents for proper calculation
      const offerAmountInCents = Math.round(offerAmount * 100);

      // Ensure bookingPrice and offerAmountInCents are in the same unit (cents)
      const overflow = offerAmountInCents - bookingPrice;

      // If there's no overflow (e.g., the offer is lower or equal to booking price), handle error
      if (overflow <= 0) {
        setError("Offer must be higher than the original booking price.");
        setLoading(false);
        return;
      }

      // Calculate the partial and full payment amounts based on the overflow
      const partialPaymentAmount = Math.floor(overflow / 2); // 50% of the overflow
      const fullPaymentAmount = offerAmountInCents - partialPaymentAmount; // Remaining amount goes to the service provider
      const offerValidUntil = new Date(
        new Date().getTime() + 30 * 60000
      ).toISOString(); // Offer valid for 30 minutes

      // Create payment intent for the full amount (offerAmountInCents)
      const response = await axios.post(
        `${process.env.REACT_APP_API_BASE_URL}/create-payment-intent`,
        {
          amount: offerAmountInCents, // Amount in cents
          currency: "aud",
          slotID: slot.id,
        }
      );

      const { clientSecret } = response.data;

      // Confirm payment via Stripe
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

      // Notify backend about the offer and split the payment
      await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/add-offer`, {
        slotId: slot.id,
        offerData: {
          offerAmount: offerAmountInCents, // Offer in cents
          offerBy: formData.email,
          phone: formData.phone,
          location: formData.location, // Include location in the offer
          partialPaymentAmount, // Partial amount to the original booker
          fullPaymentAmount, // Remaining amount to the service provider
          offerValidUntil, // Offer valid for 30 minutes
          name: formData.name, // Capture offer maker's name
        },
      });

      alert(
        `Thank you for your offer of $${offerAmount}. The payment will be processed according to the terms outlined.`
      );

      onClose();
    } catch (err) {
      setError(err.message || "Failed to process payment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .location-placeholder::placeholder {
          color: #a0a0a0;
          font-size: 0.75rem;
          opacity: 0.6;
        }

        .location-placeholder::-ms-input-placeholder {
          color: #a0a0a0;
        }
      `}</style>
      <form className="mt-4" onSubmit={handleSubmit}>
        <div className="mb-4">
          <p className="text-green-500">
            This slot is currently booked. You may make an offer to take over
            the booking.
          </p>
        </div>

        <div className="mb-4">
          <label
            htmlFor="name"
            className="block text-sm font-medium text-muted mb-1"
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
            required
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
            className="location-placeholder w-full px-3 py-2 bg-secondary border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-accent text-text"
            style={{ fontSize: "0.875rem" }}
          />
        </div>
        <div className="mb-4">
          <label
            htmlFor="offer"
            className="block text-sm font-medium text-muted mb-1"
          >
            Your Offer Amount (in AUD)
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

        {confirmationVisible && (
          <div className="mb-4">
            <p className="text-green-500">
              By proceeding, you are authorizing a partial payment to the
              original booking holder upon their acceptance, and the remaining
              amount will be authorized but captured 3 hours before the service
              delivery.
            </p>
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
                {loading ? "Processing..." : "Confirm and Submit Offer"}
              </button>
            </div>
          </div>
        )}

        {!confirmationVisible && (
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted bg-secondary rounded-md hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-accent"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setConfirmationVisible(true)}
              className={`px-4 py-2 text-sm font-medium text-text bg-accent rounded-md hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-accent ${
                loading ? "opacity-50 cursor-not-allowed" : ""
              }`}
              disabled={loading}
            >
              {loading ? "Processing..." : "Submit Offer"}
            </button>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
      </form>
    </>
  );
}

export default function OfferPage({ slot, onClose }) {
  return (
    <Elements stripe={stripePromise}>
      <OfferForm slot={slot} onClose={onClose} />
    </Elements>
  );
}
