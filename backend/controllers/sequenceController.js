const Sequence = require('../models/Sequence');

// @desc    Get all sequences for logged in user
// @route   GET /api/sequences
// @access  Private
const getSequences = async (req, res, next) => {
  try {
    const sequences = await Sequence.find({ userId: req.user._id }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: sequences.length,
      data: sequences,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Save a sequence
// @route   POST /api/sequences
// @access  Private
const createSequence = async (req, res, next) => {
  try {
    const { name, tracks, flowStats, settings } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Sequence name is required',
      });
    }

    const sequence = await Sequence.create({
      userId: req.user._id,
      name: name.trim(),
      tracks: Array.isArray(tracks) ? tracks : [],
      flowStats: flowStats || {},
      settings: settings || {},
    });

    res.status(201).json({
      success: true,
      data: sequence,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a sequence
// @route   DELETE /api/sequences/:id
// @access  Private
const deleteSequence = async (req, res, next) => {
  try {
    const { id } = req.params;

    const sequence = await Sequence.findOneAndDelete({
      _id: id,
      userId: req.user._id,
    });

    if (!sequence) {
      return res.status(404).json({
        success: false,
        message: 'Sequence not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Sequence deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Batch sync sequences
// @route   POST /api/sequences/batch
// @access  Private
const batchSyncSequences = async (req, res, next) => {
  try {
    const { sequences } = req.body;
    if (!Array.isArray(sequences)) {
      return res.status(400).json({
        success: false,
        message: 'Sequences array is required',
      });
    }

    const userId = req.user._id;

    const prepared = sequences.map((s) => ({
      userId,
      clientId: s.id || s.clientId,
      trackIds: Array.isArray(s.trackIds) ? s.trackIds : [],
      tempo: s.tempo,
      transitions: s.transitions,
      smoothness: s.smoothness,
      name: s.name || 'Untitled Sequence',
      tracks: Array.isArray(s.tracks) ? s.tracks : [],
      flowStats: s.flowStats || {},
      settings: s.settings || {},
      createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
    }));

    await Promise.all(prepared.map(data => new Sequence(data).validate()));
    const ids = [];
    const inserted = [];
    for (const data of prepared) {
      const filter = data.clientId ? { userId, clientId: data.clientId } : { userId, _id: new (require('mongoose').Types.ObjectId)() };
      const document = await Sequence.findOneAndUpdate(filter, { $set: data }, { upsert: true, new: true, runValidators: true });
      ids.push(document._id);
      inserted.push(document);
    }
    await Sequence.deleteMany({ userId, _id: { $nin: ids } });

    res.status(200).json({
      success: true,
      count: inserted.length,
      data: inserted,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSequences,
  createSequence,
  deleteSequence,
  batchSyncSequences,
};
