/** Only explicit loopback origins are accepted by the local runner. */
export function loopbackOrigin(value = 'http://127.0.0.1:8787') {
  if (!/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(value) || Number(value.split(':').at(-1)) > 65535)
    throw new Error('Set EXTERNAL_LEADS_API_ORIGIN to http://127.0.0.1:<Wrangler port>, without a path.');
  return value;
}

export function stateDirectory(profile = '') {
  if (!/^[a-z0-9_-]{0,40}$/.test(profile)) throw new Error('Invalid EXTERNAL_LOCAL_PROFILE');
  return profile ? `data/external-profiles/${profile}` : 'data';
}
