const History = require('../models/History');

// @desc    Get user play history
// @route   GET /api/history
// @access  Private
const getHistory = async (req, res, next) => {
  try {
    const history = await History.find({ userId: req.user._id })
      .sort({ playedAt: -1 })
      .limit(100);

    res.status(200).json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add track to play history
// @route   POST /api/history
// @access  Private
const addHistory = async (req, res, next) => {
  try {
    const { trackId, title, artist, artwork, previewUrl } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Track title is required',
      });
    }

    const entry = await History.create({
      userId: req.user._id,
      trackId: trackId || '',
      title: title.trim(),
      artist: artist ? artist.trim() : 'Unknown Artist',
      artwork: artwork || '',
      previewUrl: previewUrl || '',
      playedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      data: entry,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Clear play history
// @route   DELETE /api/history
// @access  Private
const clearHistory = async (req, res, next) => {
  try {
    await History.deleteMany({ userId: req.user._id });

    res.status(200).json({
      success: true,
      message: 'Play history cleared',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Batch sync history
// @route   POST /api/history/batch
// @access  Private
const batchSyncHistory = async (req, res, next) => {
  try {
    const { history } = req.body;
    if (!Array.isArray(history)) {
      return res.status(400).json({
        success: false,
        message: 'History array is required',
      });
    }

    const userId = req.user._id;

    const prepared = history.slice(0, 100).map((h, index) => ({
      clientId: h.clientId || h.id || `${h.trackId || "track"}_${h.playedAt || "unknown"}_${index}`,
      userId,
      trackId: h.trackId || h.id || '',
      title: h.title || 'Untitled',
      artist: h.artist || 'Unknown Artist',
      artwork: h.artwork || '',
      previewUrl: h.previewUrl || '',
      playedAt: h.playedAt ? new Date(h.playedAt) : new Date(),
    }));

    await Promise.all(prepared.map(data => new History(data).validate()));
    const inserted = [];
    for (const data of prepared) {
      inserted.push(await History.findOneAndUpdate({ userId, clientId: data.clientId }, { $set: data }, { upsert: true, new: true, runValidators: true }));
    }
    await History.deleteMany({ userId, _id: { $nin: inserted.map(doc => doc._id) } });

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
  getHistory,
  addHistory,
  clearHistory,
  batchSyncHistory,
};
