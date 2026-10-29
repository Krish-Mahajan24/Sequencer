const express = require('express');
const router = express.Router();
const {
  getTracks,
  createTrack,
  batchSyncTracks,
  updateTrack,
  toggleLike,
  deleteTrack,
} = require('../controllers/trackController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');

router.get('/', optionalAuth, getTracks);
router.post('/', protect, createTrack);
router.post('/batch', protect, batchSyncTracks);
router.put('/:id', protect, updateTrack);
router.patch('/:id/like', protect, toggleLike);
router.delete('/:id', protect, deleteTrack);

module.exports = router;
