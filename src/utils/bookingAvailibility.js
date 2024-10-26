export const isBookingAvailable = () => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  // Check if it's Sunday (0) and the time is between 12:00 PM and 12:59 PM
  return dayOfWeek === 0 && hours === 12 && minutes >= 0 && minutes <= 59;
};
