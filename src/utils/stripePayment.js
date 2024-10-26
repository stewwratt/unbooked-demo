import axios from "axios";

export const createPaymentRequest = (stripe, setPaymentRequest, slot) => {
  if (!stripe) return;

  const paymentRequest = stripe.paymentRequest({
    country: "AU", // Country code for Australia
    currency: "aud", // Australian Dollars
    total: {
      label: "Booking Payment",
      amount: 10000, // Amount in cents
    },
    requestPayerName: true,
    requestPayerEmail: true,
  });

  // Check if the Payment Request is available (e.g., Apple Pay supported)
  paymentRequest.canMakePayment().then((result) => {
    if (result) {
      setPaymentRequest(paymentRequest);
    }
  });

  paymentRequest.on("paymentmethod", async (event) => {
    try {
      // Create a Payment Intent on your server
      const response = await axios.post(
        `${process.env.REACT_APP_API_BASE_URL}/create-payment-intent`,
        {
          amount: 10000, // Amount in cents
          currency: "aud",
          slotID: slot.id,
        }
      );

      const { clientSecret } = response.data;

      // Confirm the Payment Intent using the payment method provided by the user
      const { error: stripeError } = await stripe.confirmCardPayment(
        clientSecret,
        { payment_method: event.paymentMethod.id },
        { handleActions: false }
      );

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      // If successful, complete the payment
      event.complete("success");
      return { success: true };
    } catch (err) {
      event.complete("fail");
      return { error: err.message || "Failed to process payment." };
    }
  });

  return paymentRequest;
};
