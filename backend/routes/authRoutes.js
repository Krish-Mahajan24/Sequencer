const express = require('express');
const router = express.Router();
const {
  signup,
  login,
  getMe,
  updateProfile,
  changePassword,
  deleteAccount,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const oauth = require('../controllers/oauthController');
router.post('/oauth/exchange', oauth.exchange);
router.post('/:provider(google|github)/link', protect, oauth.start);
router.get('/:provider(google|github)/callback', oauth.callback);
router.get('/:provider(google|github)', oauth.start);

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);
router.delete('/account', protect, deleteAccount);

module.exports = router;
