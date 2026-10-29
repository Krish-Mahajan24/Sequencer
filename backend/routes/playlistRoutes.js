const express = require('express');
const router = express.Router();
const {
  getPlaylists,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  batchSyncPlaylists,
} = require('../controllers/playlistController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getPlaylists);
router.post('/', protect, createPlaylist);
router.post('/batch', protect, batchSyncPlaylists);
router.put('/:id', protect, updatePlaylist);
router.delete('/:id', protect, deletePlaylist);

module.exports = router;
