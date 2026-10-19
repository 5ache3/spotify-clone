import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

import YtDlp from '../../modules/yt-dlp';
import { artworkPath, downloadTo, fileFor, musicPath } from './files';
import {
  createJob,
  fetchSpotify as fetchSpotifyFromServer,
  getJob,
  isConnectionError,
  matchTrack as matchTrackOnServer,
  searchYouTube as searchOnServer
} from './server';

// two ways to get music, same interface:
//  - "phone": yt-dlp runs inside the app (android build only)
//  - "server": the companion server on your computer (server/)
// /////////////////////////////////////////////////////////////////////////////
export const canDownloadOnPhone = YtDlp != null;

export const MODE_PHONE = 'phone';
export const MODE_SERVER = 'server';

const UPDATED_KEY = 'spotifyclone.ytdlpUpdatedAt';
const UPDATE_EVERY_MS = 24 * 60 * 60 * 1000;

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

// shared helpers
// /////////////////////////////////////////////////////////////////////////////
const stripTopic = (name) => (name || '').replace(/\s+-\s+Topic$/, '').trim();

// "(Official Video)", "[Lyrics]", "(HD)"... removed from titles we split
const NOISE_RE =
  /\s*[([][^)\]]*(official|lyrics?|video|audio|visualizer|hd|4k|remaster(ed)?)[^)\]]*[)\]]/gi;

// title/artist from a yt-dlp info dict (same rules as the server)
const songMeta = (info) => {
  let title;
  let artist;
  if (info.track) {
    title = info.track;
    artist =
      info.artist || info.creator || stripTopic(info.uploader || info.channel);
  } else {
    title = info.title || info.id || 'Unknown';
    artist = stripTopic(info.uploader || info.channel);
    const split = title.indexOf(' - ');
    if (split > 0) {
      const left = title.slice(0, split).trim();
      const right = title.slice(split + 3).trim();
      if (left && right) {
        artist = left;
        title = right.replace(NOISE_RE, '').trim() || right;
      }
    }
  }

  return {
    artist: artist || 'Unknown artist',
    duration: info.duration ? Math.round(info.duration) : 0,
    sourceId: info.id || null,
    title
  };
};

const normalize = (text) =>
  (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// words that mean "not the studio recording", unless the real title has them
const ALT_VERSION_WORDS = [
  'live',
  'cover',
  'karaoke',
  'instrumental',
  'remix',
  'sped up',
  'slowed',
  '8d',
  'reverb',
  'nightcore',
  '1 hour',
  'acapella',
  'reaction',
  'tutorial',
  'lesson',
  'mashup',
  'extended'
];

const hasWord = (text, word) => new RegExp(`\\b${word}\\b`).test(text);

// best search result for a known track (same scoring as the server)
const pickBest = (results, { artist, duration, title }) => {
  const mainArtist = (artist || '').split(',')[0].trim();
  const wantTitle = normalize(title);
  const wantArtist = normalize(mainArtist);
  // "Song (feat. X) - Remastered 2011" -> "song"
  const coreTitle = normalize((title || '').split(/\s[-([]/)[0]) || wantTitle;

  let best = null;
  let bestScore = null;
  results.forEach((r, rank) => {
    const gotTitle = normalize(r.title);
    const gotArtist = normalize(r.artist);
    let score = -rank * 2;
    if (coreTitle && gotTitle.includes(coreTitle)) score += 20;
    if (
      wantArtist &&
      (gotTitle.includes(wantArtist) || gotArtist.includes(wantArtist))
    ) {
      score += 12;
    }
    if (
      wantArtist &&
      (gotArtist === wantArtist || gotArtist.endsWith('vevo'))
    ) {
      score += 10;
    }
    if (gotTitle.includes('official audio') || hasWord(gotTitle, 'audio')) {
      score += 4;
    }
    if (gotTitle.includes('lyric') && !wantTitle.includes('lyric')) score -= 3;
    if (duration && r.duration) {
      const diff = Math.abs(r.duration - duration);
      score += diff <= 3 ? 12 : -Math.min(diff, 90) / 2;
    } else if (!r.duration) {
      score -= 10;
    }
    ALT_VERSION_WORDS.forEach((word) => {
      if (hasWord(gotTitle, word) && !hasWord(wantTitle, word)) score -= 25;
    });
    if (bestScore === null || score > bestScore) {
      best = r;
      bestScore = score;
    }
  });

  return best && bestScore >= 0 ? best : null;
};

// spotify public embed page -> track list (first 100 tracks)
const fetchSpotifyDirect = async (url) => {
  const match =
    /(?:open\.spotify\.com\/(?:intl-[a-z-]+\/)?|spotify:)(playlist|album)[/:]([A-Za-z0-9]{22})/.exec(
      url || ''
    );
  if (!match) {
    throw new Error("That doesn't look like a Spotify playlist or album link");
  }
  const [, kind, id] = match;
  const headers = { 'User-Agent': 'Mozilla/5.0' };

  const response = await fetch(`https://open.spotify.com/embed/${kind}/${id}`, {
    headers
  });
  if (response.status === 404) {
    throw new Error("Spotify couldn't find that playlist. Is it public?");
  }
  if (!response.ok) throw new Error(`Spotify returned HTTP ${response.status}`);
  const html = await response.text();
  const data =
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(
      html
    );
  let entity;
  try {
    entity = JSON.parse(data[1]).props.pageProps.state.data.entity;
  } catch (e) {
    throw new Error(
      "Couldn't read the Spotify page (its format may have changed)"
    );
  }

  const tracks = (entity.trackList || [])
    .filter((t) => t.title && (t.entityType || 'track') === 'track')
    .map((t) => ({
      artist: (t.subtitle || '').replace(/\u00a0/g, ' ').trim(),
      duration: Math.round((t.duration || 0) / 1000) || null,
      spotifyId: (t.uri || '').split(':').pop(),
      title: t.title.trim()
    }));
  const sources = entity.coverArt?.sources || [];
  const cover = sources.length
    ? sources.reduce((a, b) => ((b.width || 0) > (a.width || 0) ? b : a)).url
    : null;

  // the embed stops at 100 tracks; the full page says how many there are
  let total = tracks.length;
  try {
    const page = await (
      await fetch(`https://open.spotify.com/${kind}/${id}`, { headers })
    ).text();
    const count = /<meta name="music:song_count" content="(\d+)"/.exec(page);
    if (count) total = Math.max(total, parseInt(count[1], 10));
  } catch (e) {
    // keep the embed count
  }

  return {
    cover,
    id,
    kind,
    name: entity.name || entity.title || 'Spotify import',
    owner: entity.subtitle || '',
    total,
    tracks,
    truncated: total > tracks.length
  };
};

// on the phone
// /////////////////////////////////////////////////////////////////////////////
let initPromise = null;

// unpacks python/ffmpeg the first time, then keeps yt-dlp updated daily
export const initPhone = () => {
  if (!canDownloadOnPhone) return Promise.resolve(null);
  if (!initPromise) {
    initPromise = YtDlp.init()
      .then(async (version) => {
        const last = parseInt(
          (await AsyncStorage.getItem(UPDATED_KEY)) || '0',
          10
        );
        if (Date.now() - last > UPDATE_EVERY_MS) {
          // eslint-disable-next-line no-use-before-define
          updatePhoneDownloader().catch(() => null);
        }

        return version;
      })
      .catch((e) => {
        initPromise = null;
        throw e;
      });
  }

  return initPromise;
};

// fetches the latest yt-dlp release; YouTube breaks old versions often
export const updatePhoneDownloader = async () => {
  await YtDlp.init();
  const status = await YtDlp.update();
  await AsyncStorage.setItem(UPDATED_KEY, String(Date.now()));

  return { status, version: YtDlp.version() };
};

export const phoneDownloaderVersion = () =>
  canDownloadOnPhone ? YtDlp.version() : null;

const searchOnPhone = async (query, limit = 15) => {
  await initPhone();
  const data = JSON.parse(await YtDlp.search(query, limit));

  return (data.entries || [])
    .filter((e) => e.id)
    .map((e) => {
      const thumbs = e.thumbnails || [];

      return {
        artist: stripTopic(e.channel || e.uploader),
        duration: e.duration ? Math.round(e.duration) : null,
        id: e.id,
        thumbnail:
          e.thumbnail ||
          thumbs[thumbs.length - 1]?.url ||
          `https://i.ytimg.com/vi/${e.id}/hqdefault.jpg`,
        title: e.title || e.id,
        url: `https://www.youtube.com/watch?v=${e.id}`
      };
    });
};

let progressListeners = {};
let progressSubscription = null;

const onPhoneProgress = (id, listener) => {
  if (!progressSubscription) {
    progressSubscription = YtDlp.addListener('onProgress', (event) => {
      progressListeners[event.id]?.(event);
    });
  }
  progressListeners[id] = listener;

  return () => {
    const { [id]: removed, ...rest } = progressListeners;
    progressListeners = rest;
  };
};

const downloadOnPhone = async (url, { id, onProgress }) => {
  await initPhone();
  const musicDir = new Directory(Paths.document, 'music');
  if (!musicDir.exists) musicDir.create({ intermediates: true });

  const stop = onPhoneProgress(id, ({ converting, progress }) =>
    onProgress({
      progress: converting ? 0.97 : Math.min(progress, 1) * 0.95,
      status: converting ? 'Converting' : 'Downloading'
    })
  );
  let result;
  try {
    result = await YtDlp.download(url, musicDir.uri, id, id);
  } finally {
    stop();
  }

  // cover goes next to the other artwork
  let artwork = null;
  if (result.thumbnailPath) {
    try {
      const artworkDir = new Directory(Paths.document, 'artwork');
      if (!artworkDir.exists) artworkDir.create({ intermediates: true });
      const target = fileFor(artworkPath(`${id}.jpg`));
      if (target.exists) target.delete();
      await new File(`file://${result.thumbnailPath}`).move(target);
      artwork = artworkPath(`${id}.jpg`);
    } catch (e) {
      artwork = null;
    }
  }

  let info = {};
  try {
    info = JSON.parse(result.info);
  } catch (e) {
    // metadata is optional
  }

  return { artwork, file: musicPath(`${id}.m4a`), meta: songMeta(info) };
};

// through the computer server
// /////////////////////////////////////////////////////////////////////////////
const downloadOnServer = async (serverUrl, url, { id, onProgress }) => {
  const jobId = await createJob(serverUrl, url);
  const started = Date.now();
  let job;

  // poll the server until it has converted the audio (max 15 min)
  /* eslint-disable no-await-in-loop */
  while (Date.now() - started < 15 * 60 * 1000) {
    await sleep(1000);
    job = await getJob(serverUrl, jobId);
    onProgress({
      progress: (job.progress || 0) * 0.8,
      status: job.status === 'converting' ? 'Converting' : 'Downloading'
    });
    if (job.status === 'done' || job.status === 'error') break;
  }
  /* eslint-enable no-await-in-loop */
  if (!job || job.status !== 'done') {
    throw new Error(job?.error || 'The download server timed out.');
  }

  const { song } = job;
  onProgress({ progress: 0.8, status: 'Saving to phone' });
  const file = await downloadTo(
    `${serverUrl}${song.audioPath}`,
    musicPath(`${id}.m4a`),
    (p) => onProgress({ progress: 0.8 + p * 0.2 })
  );

  let artwork = null;
  if (song.artworkPath) {
    artwork = await downloadTo(
      `${serverUrl}${song.artworkPath}`,
      artworkPath(`${id}.jpg`)
    ).catch(() => null);
  }

  return {
    artwork,
    file,
    meta: {
      artist: song.artist,
      duration: song.duration || 0,
      sourceId: song.sourceId,
      title: song.title
    }
  };
};

// pick a backend
// /////////////////////////////////////////////////////////////////////////////
export const makeDownloader = (mode, serverUrl) => {
  if (mode === MODE_PHONE && canDownloadOnPhone) {
    return {
      download: downloadOnPhone,
      fetchSpotify: fetchSpotifyDirect,
      match: async (track) => {
        const main = (track.artist || '').split(',')[0].trim();

        return pickBest(
          await searchOnPhone(`${main} - ${track.title}`, 8),
          track
        );
      },
      mode: MODE_PHONE,
      search: searchOnPhone
    };
  }

  return {
    download: (url, options) => downloadOnServer(serverUrl, url, options),
    fetchSpotify: (url) => fetchSpotifyFromServer(serverUrl, url),
    match: (track) => matchTrackOnServer(serverUrl, track),
    mode: MODE_SERVER,
    search: (query, limit) => searchOnServer(serverUrl, query, limit)
  };
};

// "can't do anything right now" errors pause spotify imports instead of
// failing every track
export const isOfflineError = (error) =>
  isConnectionError(error) ||
  /Unable to download (webpage|API page)|Failed to resolve|Network is unreachable|No address associated|timed out|Network request failed/i.test(
    error?.message || ''
  );
