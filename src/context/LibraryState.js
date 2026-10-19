import * as React from 'react';
import PropTypes from 'prop-types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';

import {
  artworkPath,
  copyInto,
  deleteFile,
  downloadTo,
  extensionOf,
  musicPath
} from '../lib/files';
import {
  canDownloadOnPhone,
  initPhone,
  isOfflineError,
  makeDownloader,
  MODE_PHONE,
  MODE_SERVER
} from '../lib/downloader';
import {
  defaultServerUrl,
  isDirectAudioUrl,
  normalizeServerUrl
} from '../lib/server';

// library = downloaded songs + user playlists, persisted on the device
// /////////////////////////////////////////////////////////////////////////////
const LIBRARY_KEY = 'spotifyclone.library.v1';
const SERVER_KEY = 'spotifyclone.serverUrl';
const MODE_KEY = 'spotifyclone.downloadMode';

// virtual playlists
export const ALL_SONGS = 'all';
export const LIKED_SONGS = 'liked';

const LibraryContext = React.createContext(null);

export const useLibrary = () => React.useContext(LibraryContext);

const normalize = (text) =>
  (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// a spotify import left mid-download when the app closed starts over
const resetImports = (playlists) =>
  playlists.map((p) =>
    p.import
      ? {
          ...p,
          import: {
            ...p.import,
            tracks: p.import.tracks.map((t) =>
              t.status === 'downloading' ? { ...t, status: 'pending' } : t
            )
          }
        }
      : p
  );

// "Artist - Title.mp3" -> { artist, title }
const parseFileName = (name) => {
  const base = decodeURIComponent(name || 'Unknown')
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/_/g, ' ')
    .trim();
  const parts = base.split(' - ');

  if (parts.length >= 2) {
    return {
      artist: parts[0].trim(),
      title: parts.slice(1).join(' - ').trim()
    };
  }

  return { artist: 'Unknown artist', title: base };
};

function LibraryState({ children }) {
  const [loaded, setLoaded] = React.useState(false);
  const [songs, setSongs] = React.useState({});
  const [playlists, setPlaylists] = React.useState([]);
  const [serverUrl, setServerUrlState] = React.useState('');
  const [downloads, setDownloads] = React.useState({});
  const [downloadMode, setDownloadModeState] = React.useState(
    canDownloadOnPhone ? MODE_PHONE : MODE_SERVER
  );

  // search / download / spotify through the phone or the computer server
  const downloader = React.useMemo(
    () => makeDownloader(downloadMode, serverUrl),
    [downloadMode, serverUrl]
  );

  // load from storage
  React.useEffect(() => {
    (async () => {
      try {
        const [raw, savedServer, savedMode] = await Promise.all([
          AsyncStorage.getItem(LIBRARY_KEY),
          AsyncStorage.getItem(SERVER_KEY),
          AsyncStorage.getItem(MODE_KEY)
        ]);
        if (savedMode === MODE_SERVER || savedMode === MODE_PHONE) {
          setDownloadModeState(savedMode);
        }
        const data = raw ? JSON.parse(raw) : {};
        setSongs(data.songs || {});
        setPlaylists(resetImports(data.playlists || []));
        setServerUrlState(savedServer || defaultServerUrl());
      } catch (e) {
        setServerUrlState(defaultServerUrl());
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // save to storage
  React.useEffect(() => {
    if (!loaded) return;

    AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify({ playlists, songs }));
  }, [loaded, playlists, songs]);

  // get the phone downloader ready in the background (first run unpacks it)
  React.useEffect(() => {
    if (downloadMode === MODE_PHONE) initPhone().catch(() => null);
  }, [downloadMode]);

  const setDownloadMode = React.useCallback(async (mode) => {
    setDownloadModeState(mode);
    await AsyncStorage.setItem(MODE_KEY, mode);
  }, []);

  const setServerUrl = React.useCallback(async (url) => {
    const value = normalizeServerUrl(url);
    setServerUrlState(value);
    await AsyncStorage.setItem(SERVER_KEY, value);

    return value;
  }, []);

  // songs
  // ///////////////////////////////////////////////////////////////////////////
  const songList = React.useMemo(
    () => Object.values(songs).sort((a, b) => b.addedAt - a.addedAt),
    [songs]
  );

  const addSong = React.useCallback((song) => {
    setSongs((prev) => ({ ...prev, [song.id]: song }));

    return song;
  }, []);

  const updateSong = React.useCallback((id, patch) => {
    setSongs((prev) =>
      prev[id] ? { ...prev, [id]: { ...prev[id], ...patch } } : prev
    );
  }, []);

  const toggleLike = React.useCallback((id) => {
    setSongs((prev) =>
      prev[id]
        ? { ...prev, [id]: { ...prev[id], liked: !prev[id].liked } }
        : prev
    );
  }, []);

  const deleteSong = React.useCallback((id) => {
    setSongs((prev) => {
      const song = prev[id];
      if (!song) return prev;

      deleteFile(song.file);
      deleteFile(song.artwork);
      const next = { ...prev };
      delete next[id];

      return next;
    });
    setPlaylists((prev) =>
      prev.map((p) =>
        p.songIds.includes(id)
          ? { ...p, songIds: p.songIds.filter((sid) => sid !== id) }
          : p
      )
    );
  }, []);

  const findBySource = React.useCallback(
    (sourceId) =>
      sourceId
        ? Object.values(songs).find((s) => s.sourceId === sourceId) || null
        : null,
    [songs]
  );

  // playlists
  // ///////////////////////////////////////////////////////////////////////////
  const createPlaylist = React.useCallback((name, songIds = [], extra = {}) => {
    const now = Date.now();
    const playlist = {
      ...extra,
      createdAt: now,
      id: Crypto.randomUUID(),
      name: name.trim() || 'My Playlist',
      songIds,
      updatedAt: now
    };
    setPlaylists((prev) => [playlist, ...prev]);

    return playlist.id;
  }, []);

  const updatePlaylist = React.useCallback((id, patch) => {
    setPlaylists((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p
      )
    );
  }, []);

  const renamePlaylist = React.useCallback(
    (id, name) => updatePlaylist(id, { name: name.trim() || 'My Playlist' }),
    [updatePlaylist]
  );

  const deletePlaylist = React.useCallback((id) => {
    setPlaylists((prev) => {
      deleteFile(prev.find((p) => p.id === id)?.artwork);

      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const togglePlaylistSong = React.useCallback((playlistId, songId) => {
    setPlaylists((prev) =>
      prev.map((p) => {
        if (p.id !== playlistId) return p;
        const has = p.songIds.includes(songId);

        return {
          ...p,
          songIds: has
            ? p.songIds.filter((sid) => sid !== songId)
            : [...p.songIds, songId],
          updatedAt: Date.now()
        };
      })
    );
  }, []);

  const removeFromPlaylist = React.useCallback((playlistId, songId) => {
    setPlaylists((prev) =>
      prev.map((p) =>
        p.id === playlistId
          ? {
              ...p,
              songIds: p.songIds.filter((sid) => sid !== songId),
              updatedAt: Date.now()
            }
          : p
      )
    );
  }, []);

  // resolves real + virtual playlists to { id, name, songs }
  const getPlaylist = React.useCallback(
    (id) => {
      if (id === ALL_SONGS) {
        return { id, name: 'Downloaded songs', songs: songList, virtual: true };
      }
      if (id === LIKED_SONGS) {
        return {
          id,
          name: 'Liked Songs',
          songs: songList.filter((s) => s.liked),
          virtual: true
        };
      }
      const playlist = playlists.find((p) => p.id === id);
      if (!playlist) return null;

      return {
        ...playlist,
        songs: playlist.songIds.map((sid) => songs[sid]).filter(Boolean)
      };
    },
    [playlists, songList, songs]
  );

  // downloads
  // ///////////////////////////////////////////////////////////////////////////
  const setDownload = (key, patch) =>
    setDownloads((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const clearDownload = (key) =>
    setDownloads((prev) => {
      const next = { ...prev };
      delete next[key];

      return next;
    });

  // youtube (and anything else yt-dlp supports), on the phone or the server
  const downloadWithYtDlp = async (key, url, hint) => {
    const id = Crypto.randomUUID();
    const { artwork, file, meta } = await downloader.download(url, {
      id,
      onProgress: (patch) => setDownload(key, patch)
    });

    // same video saved meanwhile (e.g. pasted link of a song we have)
    const existing = findBySource(meta.sourceId);
    if (existing) {
      deleteFile(file);
      deleteFile(artwork);

      return existing;
    }

    return addSong({
      addedAt: Date.now(),
      artist: hint?.keepMeta
        ? hint.artist
        : meta.artist || hint?.artist || 'Unknown artist',
      artwork,
      duration: meta.duration || hint?.duration || 0,
      file,
      id,
      liked: false,
      source: 'youtube',
      sourceId: meta.sourceId,
      sourceUrl: url,
      title: hint?.keepMeta
        ? hint.title
        : meta.title || hint?.title || 'Unknown'
    });
  };

  // straight from a link to an audio file, no server needed
  const downloadDirect = async (key, url) => {
    const id = Crypto.randomUUID();
    const fileName = url.split(/[?#]/)[0].split('/').pop();
    const { artist, title } = parseFileName(fileName);
    const file = await downloadTo(
      url,
      musicPath(`${id}.${extensionOf(fileName)}`),
      (p) => setDownload(key, { progress: p, status: 'Downloading' })
    );

    return addSong({
      addedAt: Date.now(),
      artist,
      artwork: null,
      duration: 0,
      file,
      id,
      liked: false,
      source: 'url',
      sourceId: url,
      sourceUrl: url,
      title
    });
  };

  // hint: optional search result ({ id, title, artist, duration })
  // resolves to the saved song, or throws
  const downloadFromLink = async (rawUrl, hint = null) => {
    const url = rawUrl.trim();
    const key = hint?.id || url;

    const existing = findBySource(hint?.id) || findBySource(url);
    if (existing) return existing;
    if (downloads[key]?.status && !downloads[key]?.error) return null;

    setDownload(key, {
      error: null,
      progress: 0,
      status: 'Starting',
      title: hint?.title || url
    });

    try {
      const song = isDirectAudioUrl(url)
        ? await downloadDirect(key, url)
        : await downloadWithYtDlp(key, url, hint);
      clearDownload(key);

      return song;
    } catch (e) {
      setDownload(key, { error: e.message, status: 'Failed' });
      throw e;
    }
  };

  // pick audio files from the phone
  const importFromDevice = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: true,
      type: 'audio/*'
    });
    if (result.canceled) return [];

    const imported = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const asset of result.assets) {
      const id = Crypto.randomUUID();
      // eslint-disable-next-line no-await-in-loop
      const file = await copyInto(
        asset.uri,
        musicPath(`${id}.${extensionOf(asset.name)}`)
      );
      imported.push(
        addSong({
          addedAt: Date.now(),
          artwork: null,
          duration: 0,
          file,
          id,
          liked: false,
          source: 'file',
          sourceId: null,
          ...parseFileName(asset.name)
        })
      );
    }

    return imported;
  };

  // spotify import: a playlist with `import.tracks` that get matched on
  // youtube and downloaded one at a time, in order
  // ///////////////////////////////////////////////////////////////////////////
  const [importError, setImportError] = React.useState(null);
  const importing = React.useRef(false);
  // bumped after each track so the worker looks for the next one
  const [importTick, setImportTick] = React.useState(0);

  const updateImport = React.useCallback((playlistId, fn) => {
    setPlaylists((prev) =>
      prev.map((p) =>
        p.id === playlistId && p.import
          ? { ...p, ...fn(p), updatedAt: Date.now() }
          : p
      )
    );
  }, []);

  const setTrack = React.useCallback(
    (playlistId, key, patch) =>
      updateImport(playlistId, (p) => ({
        import: {
          ...p.import,
          tracks: p.import.tracks.map((t) =>
            t.key === key ? { ...t, ...patch } : t
          )
        }
      })),
    [updateImport]
  );

  const importSpotify = async (url) => {
    const data = await downloader.fetchSpotify(url);
    if (!data.tracks || data.tracks.length === 0) {
      throw new Error('That playlist has no tracks.');
    }

    const id = createPlaylist(data.name, [], {
      import: {
        owner: data.owner,
        paused: false,
        source: url.trim(),
        total: data.total,
        tracks: data.tracks.map((t, i) => ({
          ...t,
          key: `${i}-${t.spotifyId || ''}`,
          status: 'pending'
        })),
        truncated: data.truncated
      }
    });
    setImportError(null);

    if (data.cover) {
      downloadTo(data.cover, artworkPath(`playlist-${id}.jpg`))
        .then((artwork) => updatePlaylist(id, { artwork }))
        .catch(() => null);
    }

    return { ...data, count: data.tracks.length, id };
  };

  const setImportPaused = (playlistId, paused) => {
    if (!paused) setImportError(null);
    updateImport(playlistId, (p) => ({ import: { ...p.import, paused } }));
  };

  const retryFailed = (playlistId) => {
    setImportError(null);
    updateImport(playlistId, (p) => ({
      import: {
        ...p.import,
        paused: false,
        tracks: p.import.tracks.map((t) =>
          t.status === 'failed' ? { ...t, error: null, status: 'pending' } : t
        )
      }
    }));
  };

  // stop importing: forget tracks that aren't downloaded yet
  const finishImport = (playlistId) =>
    updateImport(playlistId, (p) => ({
      import: {
        ...p.import,
        tracks: p.import.tracks.filter((t) => t.status === 'done')
      }
    }));

  const findByTrack = (track) => {
    const title = normalize(track.title);
    const artist = normalize((track.artist || '').split(',')[0]);

    return (
      Object.values(songs).find(
        (s) =>
          normalize(s.title) === title && normalize(s.artist).includes(artist)
      ) || null
    );
  };

  // the import worker: runs whenever playlists change and nothing is running
  React.useEffect(() => {
    if (!loaded || importing.current || importError) return;

    const playlist = playlists.find(
      (p) =>
        p.import &&
        !p.import.paused &&
        p.import.tracks.some((t) => t.status === 'pending')
    );
    if (!playlist) return;

    const track = playlist.import.tracks.find((t) => t.status === 'pending');
    importing.current = true;
    setTrack(playlist.id, track.key, { error: null, status: 'downloading' });

    (async () => {
      try {
        let song = findByTrack(track);
        if (!song) {
          const match = await downloader.match(track);
          if (!match) throw new Error('No match found on YouTube');
          song = await downloadFromLink(match.url, {
            ...match,
            artist: track.artist,
            duration: track.duration || match.duration,
            keepMeta: true,
            title: track.title
          });
        }
        if (!song) throw new Error('Already downloading');

        const songId = song.id;
        updateImport(playlist.id, (p) => ({
          import: {
            ...p.import,
            tracks: p.import.tracks.map((t) =>
              t.key === track.key ? { ...t, songId, status: 'done' } : t
            )
          },
          songIds: p.songIds.includes(songId)
            ? p.songIds
            : [...p.songIds, songId]
        }));
      } catch (e) {
        if (isOfflineError(e)) {
          // server gone: pause everything instead of failing every track
          setTrack(playlist.id, track.key, { status: 'pending' });
          setImportError(e.message);
        } else {
          setTrack(playlist.id, track.key, {
            error: e.message,
            status: 'failed'
          });
        }
      } finally {
        importing.current = false;
        setImportTick((n) => n + 1);
      }
    })();
  }, [importError, importTick, loaded, playlists]);

  // functions close over the latest state, so this changes with it anyway
  // eslint-disable-next-line react/jsx-no-constructed-context-values
  const value = {
    addSong,
    clearDownload,
    createPlaylist,
    deletePlaylist,
    deleteSong,
    downloader,
    downloadFromLink,
    downloadMode,
    downloads,
    findBySource,
    finishImport,
    getPlaylist,
    importError,
    importSpotify,
    retryFailed,
    setImportError,
    setDownloadMode,
    setImportPaused,
    importFromDevice,
    loaded,
    playlists,
    removeFromPlaylist,
    renamePlaylist,
    serverUrl,
    setServerUrl,
    songList,
    songs,
    toggleLike,
    togglePlaylistSong,
    updatePlaylist,
    updateSong
  };

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
}

LibraryState.propTypes = {
  // required
  children: PropTypes.node.isRequired
};

export default LibraryState;
