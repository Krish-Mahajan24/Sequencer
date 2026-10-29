const mongoose = require('mongoose');

const sequenceSchema = new mongoose.Schema(
  {
    clientId: { type: String },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sequence must belong to a user'],
    },
    trackIds: [{ type: String }],
    tempo: { type: Number },
    transitions: { type: mongoose.Schema.Types.Mixed },
    smoothness: { type: Number },
    name: {
      type: String,
      required: [true, 'Sequence name is required'],
      trim: true,
      maxlength: [100, 'Sequence name cannot exceed 100 characters'],
    },
    tracks: [
      {
        type: mongoose.Schema.Types.Mixed,
      },
    ],
    flowStats: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    settings: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
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

sequenceSchema.index({ userId: 1 });

const Sequence = mongoose.model('Sequence', sequenceSchema);
module.exports = Sequence;
