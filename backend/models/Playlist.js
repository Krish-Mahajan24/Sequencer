const mongoose = require('mongoose');

const playlistSchema = new mongoose.Schema(
  {
    clientId: { type: String },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Playlist must belong to a user'],
    },
    name: {
      type: String,
      required: [true, 'Playlist name is required'],
      trim: true,
      maxlength: [100, 'Playlist name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [300, 'Description cannot exceed 300 characters'],
    },
    trackIds: [
      {
        type: String,
      },
    ],
    tracks: [
      {
        type: mongoose.Schema.Types.Mixed,
      },
    ],
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

playlistSchema.index({ userId: 1 });

const Playlist = mongoose.model('Playlist', playlistSchema);
module.exports = Playlist;
