import React, { useState } from "react";
import BookingForm from "./BookingForm";
import { formatDistanceToNow, format } from "date-fns";

const BookingTile = ({ slot, displayPrice }) => {
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
    <div className="mb-4 p-4 bg-darkCard rounded-lg shadow-lg">
      <div className="flex flex-col space-y-4">
        <div>
          <p className="text-muted">{slot.summary}</p>
          <p>{`${formattedDate} at ${formattedTime}`}</p>
          <p>{distanceToNow}</p>
          <p className="text-muted">${displayPrice / 100} AUD</p>
        </div>
        {isExpanded ? (
          <BookingForm slot={slot} onClose={handleExpand} />
        ) : (
          <button
            onClick={handleExpand}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-[#6d4eaa] rounded-md shadow-sm hover:bg-[#5b4190] focus:outline-none focus:ring-2 focus:ring-[#6d4eaa]"
          >
            Book This Slot
          </button>
        )}
      </div>
    </div>
  );
};

export default BookingTile;
