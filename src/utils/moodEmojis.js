// src/utils/moodEmojis.js

/**
 * Returns an emoji corresponding to the given mood value.
 * @param {number} value - Mood value between 1 and 10.
 * @returns {string} - Emoji representing the mood.
 */
export const getMoodEmoji = (value) => {
  switch (value) {
    case 1:
      return "😞"; // Sad
    case 2:
      return "😕"; // Disappointed
    case 3:
      return "😐"; // Neutral
    case 4:
      return "🙂"; // Slightly Happy
    case 5:
      return "😃"; // Excited
    default:
      return "😐"; // Neutral
  }
};
