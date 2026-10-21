const mongoose = require('mongoose');

const citySchema = new mongoose.Schema(
  {
    id: {
      type: String,
      unique: true,
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    // Main state (by name)
    state: {
      type: String,
      default: 'Gujarat',
      trim: true
    },
    // A city or village on a border is also managed under these states (names), e.g. a town on the
    // Gujarat/Maharashtra border has state "Gujarat" and otherStates ["Maharashtra"].
    otherStates: {
      type: [String],
      default: []
    },
    imageUrl: {
      type: String,
      default: ''
    },
    businessCount: {
      type: String,
      default: '0+'
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

module.exports = mongoose.model('City', citySchema);
