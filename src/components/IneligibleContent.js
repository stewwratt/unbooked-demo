import React from "react";

export const IneligibleContent = () => (
  <div>
    <p className="text-muted mb-4">
      You are currently outside our service area.
    </p>
    <button className="w-full px-4 py-2 bg-secondary text-text rounded-full hover:bg-primary transition-colors">
      Get Notified When We Expand
    </button>
  </div>
);
