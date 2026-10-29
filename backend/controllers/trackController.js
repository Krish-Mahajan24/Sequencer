const Track = require('../models/Track');

const DEFAULT_SEEDS = [
  {
    trackId: 't1',
    title: 'Low Tide',
    artist: 'Nightbound',
    bpm: 68,
    energy: 2,
    mood: 1,
    genre: 'Ambient',
    artwork: '',
    previewUrl: '',
    liked: false,
  },
  {
    trackId: 't2',
    title: 'Slow Static',
    artist: 'Nightbound',
    bpm: 78,
    energy: 3,
    mood: 3,
    genre: 'Electronic',
    artwork: '',
    previewUrl: '',
    liked: false,
  },
  {
    trackId: 't3',
    title: 'Half Light',
    artist: 'Reverie',
    bpm: 96,
    energy: 5,
    mood: 5,
    genre: 'Electronic',
    artwork: '',
    previewUrl: '',
    liked: false,
  },
  {
    trackId: 't4',
    title: 'Wire & Wave',
    artist: 'Reverie',
    bpm: 112,
    energy: 7,
    mood: 7,
    genre: 'R&B/Soul',
    artwork: '',
    previewUrl: '',
    liked: false,
  },
  {
    trackId: 't5',
    title: 'Redline',
    artist: 'Kilo Sun',
    bpm: 128,
    energy: 9,
    mood: 9,
    genre: 'Electronic',
    artwork: '',
    previewUrl: '',
    liked: false,
  },
];

// @desc    Get all tracks for the current user
// @route   GET /api/tracks
// @access  Public / Optional Auth
const getTracks = async (req, res, next) => {
  try {
    const userId = req.user ? req.user._id : null;

    let tracks = [];
    if (userId) {
      tracks = await Track.find({ userId }).sort({ createdAt: 1 });
    }

    // If user has no tracks yet, return default seed tracks
    if (!userId) {
      const formattedSeeds = DEFAULT_SEEDS.map((t) => ({
        id: t.trackId,
        trackId: t.trackId,
        title: t.title,
        artist: t.artist,
        bpm: t.bpm,
        energy: t.energy,
        mood: t.mood,
        genre: t.genre,
        artwork: t.artwork,
        previewUrl: t.previewUrl,
        liked: t.liked,
      }));
      return res.status(200).json({
        success: true,
        count: formattedSeeds.length,
        data: formattedSeeds,
      });
    }

    const formattedTracks = tracks.map((t) => ({
      id: t.trackId || t._id.toString(),
      _id: t._id,
      trackId: t.trackId || t._id.toString(),
      title: t.title,
      artist: t.artist,
      bpm: t.bpm,
      energy: t.energy,
      mood: t.mood,
      genre: t.genre,
      artwork: t.artwork,
      previewUrl: t.previewUrl,
      liked: t.liked,
      createdAt: t.createdAt,
    }));

    res.status(200).json({
      success: true,
      count: formattedTracks.length,
      data: formattedTracks,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new track
// @route   POST /api/tracks
// @access  Private
const createTrack = async (req, res, next) => {
  try {
    const {
      id,
      trackId,
      title,
      artist,
      bpm,
      energy,
      mood,
      genre,
      artwork,
      previewUrl,
      liked,
    } = req.body;

    if (!title || !artist) {
      return res.status(400).json({
        success: false,
        message: 'Track title and artist are required',
      });
    }

    const newTrack = await Track.create({
      userId: req.user._id,
      trackId: trackId || id || `t_${Date.now()}`,
      title: title.trim(),
      artist: artist.trim(),
      bpm: Number(bpm) || 120,
      energy: Number(energy) || 5,
      mood: Number(mood) || 5,
      genre: genre || 'Electronic',
      artwork: artwork || '',
      previewUrl: previewUrl || '',
      liked: Boolean(liked),
    });

    res.status(201).json({
      success: true,
      data: {
        id: newTrack.trackId,
        _id: newTrack._id,
        trackId: newTrack.trackId,
        title: newTrack.title,
        artist: newTrack.artist,
        bpm: newTrack.bpm,
        energy: newTrack.energy,
        mood: newTrack.mood,
        genre: newTrack.genre,
        artwork: newTrack.artwork,
        previewUrl: newTrack.previewUrl,
        liked: newTrack.liked,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Batch sync/upload tracks
// @route   POST /api/tracks/batch
// @access  Private
const batchSyncTracks = async (req, res, next) => {
  try {
    const { tracks } = req.body;

    if (!Array.isArray(tracks)) {
      return res.status(400).json({
        success: false,
        message: 'Tracks array is required',
      });
    }

    const userId = req.user._id;

    // Remove existing user tracks and replace with batch

    const preparedTracks = tracks.map((t, idx) => ({
      userId,
      trackId: t.trackId || t.id || `t_${Date.now()}_${idx}`,
      title: t.title || 'Untitled',
      artist: t.artist || 'Unknown',
      bpm: Number(t.bpm) || 120,
      energy: Number(t.energy) || 5,
      mood: Number(t.mood) || 5,
      genre: t.genre || 'Electronic',
      artwork: t.artwork || '',
      previewUrl: t.previewUrl || '',
      liked: Boolean(t.liked),
    }));

    await Promise.all(preparedTracks.map(data => new Track(data).validate()));
    const ids = [];
    const inserted = [];
    for (const data of preparedTracks) {
      const filter = data.trackId ? { userId, trackId: data.trackId } : { userId, _id: new (require('mongoose').Types.ObjectId)() };
      const document = await Track.findOneAndUpdate(filter, { $set: data }, { upsert: true, new: true, runValidators: true });
      ids.push(document._id);
      inserted.push(document);
    }
    await Track.deleteMany({ userId, _id: { $nin: ids } });

    res.status(200).json({
      success: true,
      message: `Successfully synced ${inserted.length} tracks to MongoDB Atlas`,
      count: inserted.length,
      data: inserted.map((t) => ({
        id: t.trackId,
        _id: t._id,
        trackId: t.trackId,
        title: t.title,
        artist: t.artist,
        bpm: t.bpm,
        energy: t.energy,
        mood: t.mood,
        genre: t.genre,
        artwork: t.artwork,
        previewUrl: t.previewUrl,
        liked: t.liked,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a track
// @route   PUT /api/tracks/:id
// @access  Private
const updateTrack = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Search by trackId or _id
    let track = await Track.findOne({
      userId,
      $or: [{ trackId: id }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])],
    });

    if (!track) {
      // If updating a seed track that wasn't saved in user's collection yet, create it
      const { title, artist, bpm, energy, mood, genre, artwork, previewUrl, liked } = req.body;
      track = await Track.create({
        userId,
        trackId: id,
        title: title || 'Untitled',
        artist: artist || 'Unknown',
        bpm: bpm || 120,
        energy: energy || 5,
        mood: mood || 5,
        genre: genre || 'Electronic',
        artwork: artwork || '',
        previewUrl: previewUrl || '',
        liked: Boolean(liked),
      });

      return res.status(200).json({
        success: true,
        data: track,
      });
    }

    const updates = ['title', 'artist', 'bpm', 'energy', 'mood', 'genre', 'artwork', 'previewUrl', 'liked'];
    updates.forEach((field) => {
      if (req.body[field] !== undefined) {
        track[field] = req.body[field];
      }
    });

    await track.save();

    res.status(200).json({
      success: true,
      data: {
        id: track.trackId || track._id.toString(),
        _id: track._id,
        trackId: track.trackId,
        title: track.title,
        artist: track.artist,
        bpm: track.bpm,
        energy: track.energy,
        mood: track.mood,
        genre: track.genre,
        artwork: track.artwork,
        previewUrl: track.previewUrl,
        liked: track.liked,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle like status of a track
// @route   PATCH /api/tracks/:id/like
// @access  Private
const toggleLike = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    let track = await Track.findOne({
      userId,
      $or: [{ trackId: id }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])],
    });

    if (!track) {
      // Create track if not already in DB
      const { title, artist, bpm, energy, mood, genre, artwork, previewUrl } = req.body;
      track = await Track.create({
        userId,
        trackId: id,
        title: title || 'Untitled Track',
        artist: artist || 'Unknown Artist',
        bpm: bpm || 120,
        energy: energy || 5,
        mood: mood || 5,
        genre: genre || 'Electronic',
        artwork: artwork || '',
        previewUrl: previewUrl || '',
        liked: true,
      });
    } else {
      track.liked = !track.liked;
      await track.save();
    }

    res.status(200).json({
      success: true,
      liked: track.liked,
      data: track,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a track
// @route   DELETE /api/tracks/:id
// @access  Private
const deleteTrack = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const result = await Track.findOneAndDelete({
      userId,
      $or: [{ trackId: id }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])],
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Track not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Track removed from library',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTracks,
  createTrack,
  batchSyncTracks,
  updateTrack,
  toggleLike,
  deleteTrack,
};
