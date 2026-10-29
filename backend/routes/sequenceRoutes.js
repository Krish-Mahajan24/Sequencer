const express = require('express');
const router = express.Router();
const {
  getSequences,
  createSequence,
  deleteSequence,
  batchSyncSequences,
} = require('../controllers/sequenceController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getSequences);
router.post('/', protect, createSequence);
router.post('/batch', protect, batchSyncSequences);
router.delete('/:id', protect, deleteSequence);

module.exports = router;
