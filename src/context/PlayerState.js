import * as React from 'react';
import PropTypes from 'prop-types';
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus
} from 'expo-audio';

import { uriFor } from '../lib/files';
import { useLibrary } from './LibraryState';

// playback of downloaded songs: queue, shuffle, repeat
// /////////////////////////////////////////////////////////////////////////////
const PlayerContext = React.createContext(null);
// progress updates often, so it lives in its own context
const PlayerStatusContext = React.createContext(null);

export const usePlayer = () => React.useContext(PlayerContext);
export const usePlayerStatus = () => React.useContext(PlayerStatusContext);

export const REPEAT_MODES = ['off', 'all', 'one'];

const shuffled = (list) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
};

function PlayerState({ children }) {
  const { songs, updateSong } = useLibrary();
  const player = useAudioPlayer(null, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);

  // queue holds song ids; `order` is the unshuffled queue
  const [queue, setQueue] = React.useState([]);
  const [order, setOrder] = React.useState([]);
  const [index, setIndex] = React.useState(-1);
  const [shuffle, setShuffle] = React.useState(false);
  const [repeat, setRepeat] = React.useState('off');
  const [sourceName, setSourceName] = React.useState(null);

  const currentId = queue[index] || null;
  const currentSong = currentId ? songs[currentId] || null : null;

  React.useEffect(() => {
    setAudioModeAsync({
      interruptionMode: 'doNotMix',
      playsInSilentMode: true,
      shouldPlayInBackground: true
    }).catch(() => null);
  }, []);

  // load a song whenever the current queue slot changes
  const loadedId = React.useRef(null);
  const lockScreenActive = React.useRef(false);
  React.useEffect(() => {
    if (!currentSong || loadedId.current === currentSong.id) return;
    loadedId.current = currentSong.id;

    player.replace({ uri: uriFor(currentSong.file) });
    player.play();

    const metadata = {
      albumTitle: sourceName || undefined,
      artist: currentSong.artist,
      artworkUrl: uriFor(currentSong.artwork) || undefined,
      title: currentSong.title
    };
    try {
      // activating rebuilds the media session (the notification disappears
      // and comes back), so only do it once and just swap metadata after
      if (lockScreenActive.current) {
        player.updateLockScreenMetadata(metadata);
      } else {
        player.setActiveForLockScreen(true, metadata);
        lockScreenActive.current = true;
      }
    } catch (e) {
      // lock screen controls are unavailable in some environments
    }
  }, [currentSong, player, sourceName]);

  // imported files have no known length until the player reads them
  React.useEffect(() => {
    if (currentSong && !currentSong.duration && status.duration > 0) {
      updateSong(currentSong.id, { duration: Math.round(status.duration) });
    }
  }, [currentSong, status.duration, updateSong]);

  // a song in the queue got deleted from the library
  React.useEffect(() => {
    if (currentId && !songs[currentId]) {
      player.pause();
      loadedId.current = null;
      setQueue((q) => q.filter((id) => songs[id]));
      setOrder((q) => q.filter((id) => songs[id]));
      setIndex(-1);
    }
  }, [currentId, player, songs]);

  const goTo = React.useCallback(
    (nextIndex) => {
      if (nextIndex === index) {
        player.seekTo(0);
        player.play();
      } else {
        setIndex(nextIndex);
      }
    },
    [index, player]
  );

  const next = React.useCallback(
    (auto = false) => {
      if (queue.length === 0) return;
      if (auto && repeat === 'one') {
        goTo(index);
      } else if (index + 1 < queue.length) {
        goTo(index + 1);
      } else if (repeat !== 'off' || !auto) {
        goTo(0);
      } else {
        player.pause();
        player.seekTo(0);
      }
    },
    [goTo, index, player, queue.length, repeat]
  );

  // restarts the song when more than 3s in, like the buttons in other players;
  // { force: true } (swiping) always goes to the previous song
  const previous = React.useCallback(
    (options) => {
      if (queue.length === 0) return;
      const force = options?.force === true;
      if (!force && player.currentTime > 3) {
        player.seekTo(0);
      } else if (index > 0) {
        goTo(index - 1);
      } else if (force && repeat === 'all') {
        goTo(queue.length - 1);
      } else {
        player.seekTo(0);
      }
    },
    [goTo, index, player, queue.length, repeat]
  );

  // next/previous from the notification, lock screen or headset buttons
  // (android; needs the expo-audio patch in patches/)
  const remote = React.useRef({ next, previous });
  remote.current = { next, previous };
  React.useEffect(() => {
    const subscription = player.addListener('remoteCommand', ({ command }) => {
      if (command === 'next') remote.current.next(false);
      if (command === 'previous') remote.current.previous();
    });

    return () => subscription.remove();
  }, [player]);

  // advance when a song ends
  React.useEffect(() => {
    if (status.didJustFinish) next(true);
  }, [status.didJustFinish]);

  // play a list of song ids starting at `startId`
  const playSongs = React.useCallback(
    (ids, startId = null, options = {}) => {
      const list = ids.filter((id) => songs[id]);
      if (list.length === 0) return;

      const useShuffle = options.shuffle ?? shuffle;
      const first = startId && list.includes(startId) ? startId : null;
      let nextQueue = list;
      if (useShuffle) {
        const rest = shuffled(list.filter((id) => id !== first));
        nextQueue = first ? [first, ...rest] : rest;
      }

      setShuffle(useShuffle);
      setOrder(list);
      setQueue(nextQueue);
      setSourceName(options.name || null);

      const startIndex = first ? nextQueue.indexOf(first) : 0;
      setIndex(startIndex);

      // same song picked again: start it over
      if (nextQueue[startIndex] === loadedId.current) {
        player.seekTo(0);
        player.play();
      }
    },
    [player, shuffle, songs]
  );

  const toggleShuffle = React.useCallback(() => {
    setShuffle((on) => {
      if (currentId) {
        if (on) {
          setQueue(order);
          setIndex(order.indexOf(currentId));
        } else {
          const rest = shuffled(order.filter((id) => id !== currentId));
          setQueue([currentId, ...rest]);
          setIndex(0);
        }
      }

      return !on;
    });
  }, [currentId, order]);

  const cycleRepeat = React.useCallback(() => {
    setRepeat(
      (mode) =>
        REPEAT_MODES[(REPEAT_MODES.indexOf(mode) + 1) % REPEAT_MODES.length]
    );
  }, []);

  const togglePlay = React.useCallback(() => {
    if (!currentSong) return;
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  }, [currentSong, player]);

  const addToQueue = React.useCallback(
    (songId) => {
      if (queue.length === 0) {
        playSongs([songId]);

        return;
      }
      setQueue((q) => [
        ...q.slice(0, index + 1),
        songId,
        ...q.slice(index + 1)
      ]);
      setOrder((q) => [...q, songId]);
    },
    [index, playSongs, queue.length]
  );

  const value = React.useMemo(
    () => ({
      addToQueue,
      currentSong,
      cycleRepeat,
      next: () => next(false),
      playSongs,
      previous,
      queue,
      repeat,
      seekTo: (seconds) => player.seekTo(seconds),
      shuffle,
      sourceName,
      togglePlay,
      toggleShuffle
    }),
    [
      addToQueue,
      currentSong,
      cycleRepeat,
      next,
      playSongs,
      player,
      previous,
      queue,
      repeat,
      shuffle,
      sourceName,
      togglePlay,
      toggleShuffle
    ]
  );

  return (
    <PlayerContext.Provider value={value}>
      <PlayerStatusContext.Provider value={status}>
        {children}
      </PlayerStatusContext.Provider>
    </PlayerContext.Provider>
  );
}

PlayerState.propTypes = {
  // required
  children: PropTypes.node.isRequired
};

export default PlayerState;
