const mongoose = require('mongoose');

const trackSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false, // Optional so default seed tracks can be shared or imported
    },
    trackId: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Track title is required'],
      trim: true,
    },
    artist: {
      type: String,
      required: [true, 'Artist name is required'],
      trim: true,
    },
    bpm: {
      type: Number,
      default: 120,
      min: [20, 'BPM must be at least 20'],
      max: [300, 'BPM cannot exceed 300'],
    },
    energy: {
      type: Number,
      default: 5,
      min: 1,
      max: 10,
    },
    mood: {
      type: Number,
      default: 5,
      min: 1,
      max: 10,
    },
    genre: {
      type: String,
      default: 'Electronic',
      trim: true,
    },
    artwork: {
      type: String,
      default: '',
    },
    previewUrl: {
      type: String,
      default: '',
    },
    liked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret.trackId || ret._id.toString();
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes for fast lookup
trackSchema.index({ userId: 1, trackId: 1 });

const Track = mongoose.model('Track', trackSchema);
module.exports = Track;
