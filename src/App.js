import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CheckEligibility from "./components/CheckEligibility";
import LoadingSpinner from "./components/LoadingSpinner";
// Import the logo
import logo from "./resources/logoV1-green-white.png";

function App() {
  const [eligibilityStatus, setEligibilityStatus] = useState("checking");
  const [selectedSlot, setSelectedSlot] = useState(null);

  useEffect(() => {
    checkEligibility();
  }, []);

  const checkEligibility = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          fetch(`/api/check-eligibility?lat=${latitude}&lon=${longitude}`)
            .then((response) => response.json())
            .then((data) => {
              setEligibilityStatus(data.eligible ? "eligible" : "ineligible");
            })
            .catch((error) => {
              console.error("Error checking eligibility:", error);
              setEligibilityStatus("error");
            });
        },
        (error) => {
          console.error("Error getting location:", error);
          setEligibilityStatus("error");
        }
      );
    } else {
      console.error("Geolocation is not supported by this browser.");
      setEligibilityStatus("error");
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.5,
        when: "beforeChildren",
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  return (
    <div className="min-h-screen bg-background text-text font-sans">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="container mx-auto px-4 py-8"
      >
        <motion.header variants={itemVariants} className="text-center mb-12">
          <img
            src={logo}
            alt="mytime logo"
            className="mx-auto mb-2" // Changed from w-1/2 to w-2/3
          />
          <p className="text-lg">
            Book your personal slot with just one click.
          </p>
          <p className="text-muted">
            Uncompromising client focused barber services delivered to your door
          </p>
        </motion.header>

        <main className="max-w-md mx-auto bg-primary rounded-lg shadow-lg p-6">
          <AnimatePresence mode="wait">
            {eligibilityStatus === "checking" ? (
              <motion.div
                key="loading"
                initial={{ rotateY: 0 }}
                animate={{ rotateY: 360 }}
                exit={{ rotateY: 0, opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                <LoadingSpinner />
              </motion.div>
            ) : (
              <motion.div
                key="result"
                initial={{ rotateY: -90 }}
                animate={{ rotateY: 0 }}
                exit={{ rotateY: 90, opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                <CheckEligibility status={eligibilityStatus} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </motion.div>
    </div>
  );
}

export default App;
