const Playlist = require('../models/Playlist');

// @desc    Get all playlists for logged in user
// @route   GET /api/playlists
// @access  Private
const getPlaylists = async (req, res, next) => {
  try {
    const playlists = await Playlist.find({ userId: req.user._id }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: playlists.length,
      data: playlists,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new playlist
// @route   POST /api/playlists
// @access  Private
const createPlaylist = async (req, res, next) => {
  try {
    const { name, description, trackIds, tracks } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Playlist name is required',
      });
    }

    const playlist = await Playlist.create({
      userId: req.user._id,
      name: name.trim(),
      description: description ? description.trim() : '',
      trackIds: Array.isArray(trackIds) ? trackIds : [],
      tracks: Array.isArray(tracks) ? tracks : [],
    });

    res.status(201).json({
      success: true,
      data: playlist,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update playlist
// @route   PUT /api/playlists/:id
// @access  Private
const updatePlaylist = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, trackIds, tracks } = req.body;

    const playlist = await Playlist.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: 'Playlist not found',
      });
    }

    if (name) playlist.name = name.trim();
    if (description !== undefined) playlist.description = description.trim();
    if (trackIds) playlist.trackIds = trackIds;
    if (tracks) playlist.tracks = tracks;

    await playlist.save();

    res.status(200).json({
      success: true,
      data: playlist,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete playlist
// @route   DELETE /api/playlists/:id
// @access  Private
const deletePlaylist = async (req, res, next) => {
  try {
    const { id } = req.params;

    const playlist = await Playlist.findOneAndDelete({
      _id: id,
      userId: req.user._id,
    });

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: 'Playlist not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Playlist deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Batch sync playlists
// @route   POST /api/playlists/batch
// @access  Private
const batchSyncPlaylists = async (req, res, next) => {
  try {
    const { playlists } = req.body;
    if (!Array.isArray(playlists)) {
      return res.status(400).json({
        success: false,
        message: 'Playlists array is required',
      });
    }

    const userId = req.user._id;

    const prepared = playlists.map((p) => ({
      userId,
      clientId: p.id || p.clientId,
      name: p.name || 'Untitled Playlist',
      description: p.description || '',
      trackIds: Array.isArray(p.trackIds) ? p.trackIds : [],
      tracks: Array.isArray(p.tracks) ? p.tracks : [],
      createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
    }));

    await Promise.all(prepared.map(data => new Playlist(data).validate()));
    const ids = [];
    const inserted = [];
    for (const data of prepared) {
      const filter = data.clientId ? { userId, clientId: data.clientId } : { userId, _id: new (require('mongoose').Types.ObjectId)() };
      const document = await Playlist.findOneAndUpdate(filter, { $set: data }, { upsert: true, new: true, runValidators: true });
      ids.push(document._id);
      inserted.push(document);
    }
    await Playlist.deleteMany({ userId, _id: { $nin: ids } });

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
  getPlaylists,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  batchSyncPlaylists,
};
