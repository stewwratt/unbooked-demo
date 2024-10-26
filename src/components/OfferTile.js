import React, { useState } from "react";
import OfferForm from "./OfferForm";
import { formatDistanceToNow, format } from "date-fns";
import "./OfferTile.css";

const OfferTile = ({ slot, displayPrice }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // Formatting the start date and time
  const startDate = new Date(slot.start);
  const formattedTime = format(startDate, "h:mm a");
  const formattedDate = format(startDate, "MMMM do, yyyy");
  const distanceToNow = formatDistanceToNow(startDate, { addSuffix: true });

  return (
    <div className="offer-tile mb-4 p-4 bg-darkCard rounded-lg shadow-lg">
      <div className="flex flex-col space-y-4">
        <div>
          <p className="text-muted">{slot.summary}</p>
          <p>{`${formattedDate} at ${formattedTime}`}</p>
          <p>{distanceToNow}</p>
          {displayPrice && (
            <p className="text-muted">
              Offer likely to be accepted: ${displayPrice / 100} AUD
            </p>
          )}
        </div>
        {isExpanded ? (
          <OfferForm
            slot={slot}
            displayPrice={displayPrice}
            onClose={handleExpand}
          />
        ) : (
          <button
            onClick={handleExpand}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-[#4ea065] rounded-md shadow-sm hover:bg-[#428a56] focus:outline-none focus:ring-2 focus:ring-[#4ea065]"
          >
            Make an Offer
          </button>
        )}
      </div>
    </div>
  );
};

export default OfferTile;
