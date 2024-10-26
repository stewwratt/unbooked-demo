import axios from "axios";

export const geolocationCheck = async () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject("Geolocation is not supported by your browser.");
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          const response = await axios.get(
            `${process.env.REACT_APP_API_BASE_URL}/api/check-eligibility`,
            {
              params: {
                lat: latitude,
                lon: longitude,
              },
            }
          );

          resolve(response.data.eligible);
        } catch (error) {
          reject(error);
        }
      },
      (error) => {
        reject(error);
      }
    );
  });
};
