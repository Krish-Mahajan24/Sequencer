const mongoose = require('mongoose');

const historySchema = new mongoose.Schema(
  {
    clientId: { type: String },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'History entry must belong to a user'],
    },
    trackId: {
      type: String,
      default: '',
    },
    title: {
      type: String,
      required: [true, 'Track title is required'],
      trim: true,
    },
    artist: {
      type: String,
      default: 'Unknown Artist',
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
    playedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret.clientId || ret._id.toString();
        delete ret.__v;
        return ret;
      },
    },
  }
);

historySchema.index({ userId: 1, playedAt: -1 });

const History = mongoose.model('History', historySchema);
module.exports = History;
