// Loaded only by the OAuth integration test; production uses real provider APIs.
const original = global.fetch;
global.fetch = async (url, options) => {
  const value = String(url);
  let body;
  if (value === 'https://oauth2.googleapis.com/token' || value === 'https://github.com/login/oauth/access_token') body = { access_token: 'test-provider-access-token' };
  else if (value === 'https://openidconnect.googleapis.com/v1/userinfo') body = { sub: 'google-integration-user', email: 'google-oauth-test@example.com', email_verified: true, given_name: 'Google', family_name: 'Tester' };
  else if (value === 'https://api.github.com/user') body = { id: 123456789, login: 'github-tester', name: 'GitHub Tester' };
  else if (value === 'https://api.github.com/user/emails') body = [{ email: 'github-oauth-test@example.com', primary: true, verified: true }];
  else return original(url, options);
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
