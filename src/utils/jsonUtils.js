export const parseJSONSafely = (jsonString) => {
  try {
    // Replace non-breaking spaces, HTML tags, and newlines, then trim the result
    const cleanedString = jsonString
      .replace(/<[^>]*>/g, "") // Remove any HTML tags
      .replace(/[\u200B-\u200D\uFEFF]/g, "") // Remove zero-width spaces
      .replace(/\u00A0/g, " ") // Replace non-breaking spaces with regular spaces
      .replace(/\n/g, "") // Remove newline characters
      .replace(/<br>/g, "") // Remove <br> tags
      .replace(/&quot;/g, '"') // Replace HTML-encoded quotes with actual quotes
      .replace(/&amp;/g, "&") // Replace &amp; with &
      .trim();
    return JSON.parse(cleanedString);
  } catch (error) {
    console.error("Error parsing JSON:", error);
    return null; // Return null if parsing fails
  }
};
