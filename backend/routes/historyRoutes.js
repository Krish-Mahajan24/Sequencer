const express = require('express');
const router = express.Router();
const {
  getHistory,
  addHistory,
  clearHistory,
  batchSyncHistory,
} = require('../controllers/historyController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getHistory);
router.post('/', protect, addHistory);
router.post('/batch', protect, batchSyncHistory);
router.delete('/', protect, clearHistory);

module.exports = router;
