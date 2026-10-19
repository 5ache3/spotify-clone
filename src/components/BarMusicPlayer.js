import * as React from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome } from '@expo/vector-icons';
import { colors, device, gStyle } from '../constants';

// components
import Artwork from './Artwork';

// context
import { useLibrary } from '../context/LibraryState';
import { usePlayer, usePlayerStatus } from '../context/PlayerState';

// how far (px) or fast the song has to be swiped to change it
const SWIPE_DISTANCE = 80;
const SWIPE_VELOCITY = 0.6;

function BarMusicPlayer() {
  const navigation = useNavigation();
  const { toggleLike } = useLibrary();
  const { currentSong: song, next, previous, togglePlay } = usePlayer();
  const status = usePlayerStatus();

  // swipe the song left (next) or right (previous)
  const translateX = React.useRef(new Animated.Value(0)).current;
  const actions = React.useRef({ next, previous });
  actions.current = { next, previous };

  const pan = React.useRef(
    PanResponder.create({
      // only horizontal drags; taps still open the player
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => translateX.setValue(g.dx),
      onPanResponderRelease: (_, g) => {
        const toNext = g.dx < -SWIPE_DISTANCE || g.vx < -SWIPE_VELOCITY;
        const toPrevious = g.dx > SWIPE_DISTANCE || g.vx > SWIPE_VELOCITY;
        if (!toNext && !toPrevious) {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true
          }).start();

          return;
        }

        // slide out, change song, slide the new one in from the other side
        const out = toNext ? -device.width : device.width;
        Animated.timing(translateX, {
          duration: 150,
          toValue: out,
          useNativeDriver: true
        }).start(() => {
          if (toNext) {
            actions.current.next();
          } else {
            actions.current.previous({ force: true });
          }
          translateX.setValue(-out);
          Animated.spring(translateX, {
            bounciness: 0,
            toValue: 0,
            useNativeDriver: true
          }).start();
        });
      },
      onPanResponderTerminate: () =>
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true
        }).start()
    })
  ).current;

  if (!song) return null;

  const favoriteColor = song.liked ? colors.brandPrimary : colors.white;
  const favoriteIcon = song.liked ? 'heart' : 'heart-o';
  const iconPlay = status.playing ? 'pause-circle' : 'play-circle';
  const duration = status.duration || song.duration || 0;
  const progress =
    duration > 0 ? Math.min(status.currentTime / duration, 1) : 0;

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => navigation.navigate('ModalMusicPlayer')}
      style={styles.container}
    >
      <View style={styles.containerContent}>
        <View style={styles.containerSwipe}>
          <Animated.View
            {...pan.panHandlers}
            style={[styles.containerSong, { transform: [{ translateX }] }]}
          >
            <Artwork artwork={song.artwork} size={40} />
            <View style={styles.containerText}>
              <Text ellipsizeMode="tail" numberOfLines={1} style={styles.title}>
                {song.title}
              </Text>
              <Text
                ellipsizeMode="tail"
                numberOfLines={1}
                style={styles.artist}
              >
                {song.artist}
              </Text>
            </View>
          </Animated.View>
        </View>

        <TouchableOpacity
          activeOpacity={gStyle.activeOpacity}
          hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
          onPress={() => toggleLike(song.id)}
          style={styles.containerIcon}
        >
          <FontAwesome color={favoriteColor} name={favoriteIcon} size={20} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={gStyle.activeOpacity}
          hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
          onPress={togglePlay}
          style={styles.containerIcon}
        >
          <FontAwesome color={colors.white} name={iconPlay} size={28} />
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityLabel="Next song"
          activeOpacity={gStyle.activeOpacity}
          hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
          onPress={() => next()}
          style={styles.containerIcon}
        >
          <FontAwesome color={colors.white} name="step-forward" size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    backgroundColor: colors.grey,
    borderBottomColor: colors.blackBg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    width: '100%'
  },
  containerContent: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 8
  },
  containerIcon: {
    ...gStyle.flexCenter,
    width: 44
  },
  containerSwipe: {
    flex: 1,
    overflow: 'hidden'
  },
  containerSong: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingLeft: 8
  },
  containerText: {
    flex: 1,
    marginLeft: 12
  },
  title: {
    ...gStyle.textSpotifyBold12,
    color: colors.white
  },
  artist: {
    ...gStyle.textSpotify12,
    color: colors.greyLight
  },
  progressTrack: {
    backgroundColor: colors.greyOff,
    height: 2,
    width: '100%'
  },
  progressFill: {
    backgroundColor: colors.white,
    height: 2
  }
});

export default BarMusicPlayer;
