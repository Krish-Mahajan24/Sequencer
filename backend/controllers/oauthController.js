const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Ticket = require('../models/OAuthTicket');
const hash = value => crypto.createHash('sha256').update(value).digest('base64url');
const random = () => crypto.randomBytes(32).toString('base64url');
const providers = {
  google: { authorize: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', scope: 'openid email profile' },
  github: { authorize: 'https://github.com/login/oauth/authorize', token: 'https://github.com/login/oauth/access_token', scope: 'read:user user:email' },
};
function config(provider) {
  if (!providers[provider]) throw new Error('Unsupported sign-in provider.');
  const prefix = provider.toUpperCase();
  const clientId = process.env[prefix + '_CLIENT_ID'];
  const clientSecret = process.env[prefix + '_CLIENT_SECRET'];
  if (!clientId || !clientSecret) throw new Error(`${provider === 'google' ? 'Google' : 'GitHub'} sign-in is not configured yet.`);
  const backend = process.env.BACKEND_URL || 'http://localhost:5050';
  const app = process.env.APP_URL || 'http://localhost:5050/frontend';
  return { ...providers[provider], clientId, clientSecret, callback: backend.replace(/\/$/, '') + '/api/auth/' + provider + '/callback', app: app.replace(/\/$/, '') };
}
function secret() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET must be configured.');
  return process.env.JWT_SECRET;
}
function cookieOptions() {
  return { httpOnly: true, secure: (process.env.BACKEND_URL || '').startsWith('https:'), sameSite: 'lax', path: '/api/auth', maxAge: 10 * 60 * 1000 };
}
async function json(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('The sign-in provider could not verify your account. Please try again.');
  return response.json();
}
async function identity(provider, accessToken) {
  const headers = { Authorization: 'Bearer ' + accessToken, Accept: 'application/json', 'User-Agent': 'Sequencer' };
  if (provider === 'google') {
    const profile = await json('https://openidconnect.googleapis.com/v1/userinfo', { headers });
    if (!profile.sub || !profile.email || profile.email_verified !== true) throw new Error('A verified Google email address is required.');
    return { id: String(profile.sub), email: profile.email, name: profile.name, firstName: profile.given_name, lastName: profile.family_name };
  }
  const profile = await json('https://api.github.com/user', { headers });
  const emails = await json('https://api.github.com/user/emails', { headers });
  const email = emails.find(item => item.verified && item.primary) || emails.find(item => item.verified);
  if (!profile.id || !email) throw new Error('A verified GitHub email address is required.');
  return { id: String(profile.id), email: email.email, name: profile.name || profile.login };
}
async function account(provider, profile, linkUserId) {
  const field = provider + 'Id';
  let user = await User.findOne({ [field]: profile.id });
  if (linkUserId) {
    const owner = await User.findById(linkUserId);
    if (!owner) throw new Error('Your session expired. Sign in and try connecting again.');
    if (user && user._id.toString() !== owner._id.toString()) throw new Error('This provider is already connected to another account.');
    if (owner.email !== profile.email.trim().toLowerCase()) throw new Error('Use the provider account with the same email as your Sequencer account.');
    if (owner[field] && owner[field] !== profile.id) throw new Error('A different provider account is already connected.');
    owner[field] = profile.id;
    await owner.save();
    return owner;
  }
  if (user) return user;
  const email = profile.email.trim().toLowerCase();
  // identity() accepts only provider-verified emails. Attach the provider ID
  // to the existing document without replacing profile, password or music data.
  const existing = await User.findOne({ email });
  if (existing) {
    const linked = await User.findOneAndUpdate(
      { _id: existing._id, $or: [{ [field]: { $exists: false } }, { [field]: profile.id }] },
      { $set: { [field]: profile.id } },
      { new: true, runValidators: true }
    );
    if (!linked) throw new Error('A different provider account is already connected to this email.');
    return linked;
  }
  const parts = (profile.name || email.split('@')[0]).trim().split(/\s+/);
  return User.create({
    [field]: profile.id, email,
    firstName: String(profile.firstName || parts.shift() || 'Music').slice(0, 50),
    lastName: String(profile.lastName || parts.join(' ') || 'Listener').slice(0, 50),
  });
}
function start(req, res) {
  try {
    const provider = req.params.provider;
    const settings = config(provider);
    const input = req.method === 'POST' ? req.body : req.query;
    const challenge = input.challenge;
    if (typeof challenge !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) throw new Error('Start sign-in using the Google or GitHub button in Sequencer.');
    const state = random(), verifier = random();
    const next = req.user ? 'profile.html' : ['library.html', 'sequence.html', 'profile.html'].includes(input.next) ? input.next : 'index.html';
    res.cookie('sequencer_oauth_' + provider, jwt.sign({ state, verifier, challenge, next, provider, linkUserId: req.user?._id.toString() }, secret(), { expiresIn: '10m', audience: 'oauth-state' }), cookieOptions());
    const url = new URL(settings.authorize);
    for (const [key, value] of Object.entries({ client_id: settings.clientId, redirect_uri: settings.callback, response_type: 'code', scope: settings.scope, state, code_challenge: hash(verifier), code_challenge_method: 'S256' })) url.searchParams.set(key, value);
    res.set('Cache-Control', 'no-store');
    if (req.method === 'POST') res.json({ success: true, url: url.toString() });
    else res.redirect(url.toString());
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
}
async function callback(req, res) {
  const provider = req.params.provider;
  const app = (process.env.APP_URL || 'http://localhost:5050/frontend').replace(/\/$/, '');
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  try {
    const settings = config(provider);
    const name = 'sequencer_oauth_' + provider;
    const raw = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(name + '='));
    res.clearCookie(name, cookieOptions());
    if (!raw) throw new Error('Sign-in expired. Please try again.');
    const state = jwt.verify(decodeURIComponent(raw.slice(name.length + 1)), secret(), { audience: 'oauth-state', algorithms: ['HS256'] });
    if (state.provider !== provider || typeof req.query.state !== 'string' || state.state !== req.query.state) throw new Error('Invalid sign-in state. Please try again.');
    if (req.query.error) throw new Error('Sign-in was cancelled. Please try again.');
    if (typeof req.query.code !== 'string') throw new Error('Missing sign-in authorization code.');
    const tokens = await json(settings.token, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: req.query.code, client_id: settings.clientId, client_secret: settings.clientSecret, redirect_uri: settings.callback, code_verifier: state.verifier }) });
    if (!tokens.access_token || tokens.error) throw new Error('Unable to complete provider sign-in. Please try again.');
    const user = await account(provider, await identity(provider, tokens.access_token), state.linkUserId);
    const code = random();
    await Ticket.create({ digest: hash(code), challenge: state.challenge, userId: user._id, expiresAt: new Date(Date.now() + 60000) });
    res.redirect(app + '/auth.html#' + new URLSearchParams({ oauth_code: code, next: state.next }));
  } catch (error) {
    const message = error.code === 11000 ? 'This account already exists. Please try signing in again.' : (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') ? 'Sign-in expired. Please try again.' : error.message;
    res.redirect(app + '/auth.html#' + new URLSearchParams({ oauth_error: message }));
  }
}
async function exchange(req, res, next) {
  res.set('Cache-Control', 'no-store');
  try {
    const { code, verifier } = req.body;
    if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(code) || typeof verifier !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(verifier)) return res.status(400).json({ success: false, message: 'Invalid sign-in request.' });
    const ticket = await Ticket.findOneAndDelete({ digest: hash(code), challenge: hash(verifier), expiresAt: { $gt: new Date() } });
    if (!ticket) return res.status(401).json({ success: false, message: 'Sign-in expired or already used. Please try again.' });
    const user = await User.findById(ticket.userId);
    if (!user) return res.status(401).json({ success: false, message: 'Account no longer exists.' });
    const token = jwt.sign({ id: user._id }, secret(), { expiresIn: '30d' });
    res.json({ success: true, token, user: { id: user._id.toString(), firstName: user.firstName, lastName: user.lastName, email: user.email } });
  } catch (error) { next(error); }
}
module.exports = { start, callback, exchange, identity, account, hash };
