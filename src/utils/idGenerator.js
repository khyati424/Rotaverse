const crypto = require('crypto');

const generateRandomNumberString = (length = 6) => {
  let str = '';
  for (let i = 0; i < length; i++) {
    str += Math.floor(Math.random() * 10);
  }
  return str;
};

const generateTicketId = () => {
  return `TIC-${Math.floor(1000 + Math.random() * 9000)}`;
};

const generateInitials = (name = '') => {
  if (!name) return 'BI';
  // Strip titles like Dr., Mr., Mrs., etc. for initials or take major capital initials
  const cleaned = name.replace(/^(Dr\.|Mr\.|Mrs\.|Ms\.|Prof\.)\s*/i, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

module.exports = {
  generateRandomNumberString,
  generateTicketId,
  generateInitials
};
