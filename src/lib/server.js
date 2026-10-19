import Constants from 'expo-constants';

// the companion download server (server/server.py) runs on your computer
// /////////////////////////////////////////////////////////////////////////////
export const SERVER_PORT = 8765;

// guess the server url from the Expo dev server host (same computer)
export const defaultServerUrl = () => {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    '';
  const host = hostUri.split(':')[0];
  if (host) return `http://${host}:${SERVER_PORT}`;

  // installed builds have no dev server: use the address baked into app.json
  return Constants.expoConfig?.extra?.serverUrl || '';
};

export const normalizeServerUrl = (url) => {
  let value = (url || '').trim().replace(/\/+$/, '');
  if (value && !/^https?:\/\//i.test(value)) value = `http://${value}`;

  return value;
};

const request = async (baseUrl, path, options = {}, timeoutMs = 15000) => {
  if (!baseUrl) {
    throw new Error(
      'No download server set. Start it on your computer and add its address in Settings.'
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: controller.signal
    });
  } catch (e) {
    throw new Error(
      `Can't reach the download server at ${baseUrl}. Is it running, and is your phone on the same Wi-Fi?`
    );
  } finally {
    clearTimeout(timer);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Server error (${response.status})`);
  }

  return body;
};

export const checkHealth = (baseUrl) =>
  request(baseUrl, '/api/health', {}, 5000);

export const searchYouTube = async (baseUrl, query, limit = 15) => {
  const q = encodeURIComponent(query);
  const { results } = await request(
    baseUrl,
    `/api/search?q=${q}&limit=${limit}`,
    {},
    30000
  );

  return results || [];
};

export const createJob = async (baseUrl, url) => {
  const { id } = await request(baseUrl, '/api/jobs', {
    body: JSON.stringify({ url }),
    method: 'POST'
  });

  return id;
};

export const getJob = (baseUrl, jobId) =>
  request(baseUrl, `/api/jobs/${jobId}`);

// url helpers
// /////////////////////////////////////////////////////////////////////////////
export const isUrl = (text) => /^https?:\/\/\S+$/i.test((text || '').trim());

export const isYouTubeUrl = (text) =>
  /^https?:\/\/([a-z0-9-]+\.)*(youtube\.com|youtu\.be)\//i.test(
    (text || '').trim()
  );

// direct links to audio files can be downloaded without the server
export const isDirectAudioUrl = (text) =>
  /^https?:\/\/[^?#]+\.(mp3|m4a|aac|wav|flac|ogg|opus)(\?|#|$)/i.test(
    (text || '').trim()
  );

// spotify import
// /////////////////////////////////////////////////////////////////////////////
export const isSpotifyUrl = (text) =>
  /(open\.spotify\.com\/(intl-[a-z-]+\/)?|spotify:)(playlist|album)[/:]/i.test(
    (text || '').trim()
  );

// { name, owner, cover, total, truncated, tracks: [{ title, artist, duration }] }
export const fetchSpotify = (baseUrl, url) =>
  request(
    baseUrl,
    `/api/spotify?url=${encodeURIComponent(url.trim())}`,
    {},
    60000
  );

// best youtube search result for a track, or null
export const matchTrack = async (baseUrl, { artist, duration, title }) => {
  const params = [
    `title=${encodeURIComponent(title)}`,
    `artist=${encodeURIComponent(artist || '')}`,
    `duration=${duration || 0}`
  ].join('&');
  const { result } = await request(baseUrl, `/api/match?${params}`, {}, 60000);

  return result || null;
};

// thrown by request() when the server can't be reached at all
export const isConnectionError = (error) =>
  /Can't reach the download server|No download server set/.test(
    error?.message || ''
  );
