const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  digest: { type: String, required: true, unique: true },
  challenge: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
});
module.exports = mongoose.model('OAuthTicket', schema);
