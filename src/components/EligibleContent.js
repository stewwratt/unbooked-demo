import React, { useState, useEffect } from "react";
import axios from "axios";
import BookingTile from "./BookingTile";
import OfferTile from "./OfferTile";
import { parseJSONSafely } from "../utils/jsonUtils"; // Import the utility function

export const EligibleContent = () => {
  const [mytimeEvents, setMytimeEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_BASE_URL}/api/mytime-slots`
      );
      setMytimeEvents(response.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching mytime events:", error);
      setError("Failed to fetch available time slots");
      setLoading(false);
    }
  };

  // Function to determine the status of the slot
  const getSlotStatus = (slot) => {
    if (slot.description && slot.description.trim() !== "") {
      const descriptionJSON = parseJSONSafely(slot.description);
      if (descriptionJSON && descriptionJSON.status) {
        return descriptionJSON.status;
      }
    }
    return "unknown";
  };

  // Function to get the appropriate price for each slot
  const getDisplayPrice = (slot) => {
    if (slot.description && slot.description.trim() !== "") {
      const descriptionJSON = parseJSONSafely(slot.description);
      if (descriptionJSON) {
        if (
          descriptionJSON.status === "booked" &&
          descriptionJSON.recommendedPrice
        ) {
          return descriptionJSON.recommendedPrice;
        }
        if (
          descriptionJSON.status === "available" &&
          descriptionJSON.originalPrice
        ) {
          return descriptionJSON.originalPrice;
        }
      }
    }
    return null;
  };

  return (
    <div>
      <p className="text-green-400 mb-4">You are eligible for our service!</p>
      {loading ? (
        <p>Loading available time slots...</p>
      ) : error ? (
        <p className="text-red-400">{error}</p>
      ) : mytimeEvents.length > 0 ? (
        <div>
          {mytimeEvents.map((event) => {
            const slotStatus = getSlotStatus(event);
            const displayPrice = getDisplayPrice(event);

            return slotStatus === "available" ? (
              <BookingTile
                key={event.id}
                slot={event}
                displayPrice={displayPrice}
              />
            ) : slotStatus === "booked" ? (
              <OfferTile
                key={event.id}
                slot={event}
                displayPrice={displayPrice}
              />
            ) : (
              <div
                key={event.id}
                className="mb-4 p-4 bg-darkCard rounded-lg shadow-lg"
              >
                <p>Error loading this slot.</p>
              </div>
            );
          })}
        </div>
      ) : (
        <p>No available Mytime slots at the moment.</p>
      )}
    </div>
  );
};

export default EligibleContent;
