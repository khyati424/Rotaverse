const mongoose = require('mongoose');

/** A person (app user) saved by another user. `personId` is the saved user's `id`. */
const favoriteSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    personId: {
      type: String,
      required: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

favoriteSchema.index({ userId: 1, personId: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
