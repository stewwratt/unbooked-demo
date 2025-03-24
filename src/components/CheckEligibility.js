import React, { useState, useEffect } from "react";
// import { motion } from "framer-motion";
import { geolocationCheck } from "../utils/geolocationCheck";
import { EligibleContent } from "./EligibleContent";
import { IneligibleContent } from "./IneligibleContent";

export const CheckEligibility = () => {
  const [status, setStatus] = useState("checking");
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkEligibility = async () => {
      try {
        const eligible = await geolocationCheck();
        setStatus(eligible ? "eligible" : "ineligible");
      } catch (err) {
        setError(
          err.message || "An error occurred while checking eligibility."
        );
        setStatus("error");
      }
    };

    checkEligibility();
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-semibold text-text mb-4">
        Eligibility Check
      </h2>
      {status === "checking" ? (
        <p className="text-muted">Checking eligibility...</p>
      ) : status === "eligible" ? (
        <EligibleContent />
      ) : status === "ineligible" ? (
        <IneligibleContent />
      ) : (
        <p className="text-danger">{error}</p>
      )}
    </div>
  );
};

export default CheckEligibility;
