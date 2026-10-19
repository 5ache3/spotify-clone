import * as React from 'react';
import PropTypes from 'prop-types';
import { StyleSheet, Text, View } from 'react-native';
import { Feather, FontAwesome, MaterialIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { colors, device, func, gStyle } from '../constants';

// components
import Artwork from '../components/Artwork';
import ModalHeader from '../components/ModalHeader';
import TouchIcon from '../components/TouchIcon';

// context
import { useLibrary } from '../context/LibraryState';
import { usePlayer, usePlayerStatus } from '../context/PlayerState';

function ModalMusicPlayer({ navigation }) {
  const { toggleLike } = useLibrary();
  const {
    currentSong,
    cycleRepeat,
    next,
    previous,
    repeat,
    seekTo,
    shuffle,
    sourceName,
    togglePlay,
    toggleShuffle
  } = usePlayer();
  const status = usePlayerStatus();

  // while dragging the slider, show the dragged position
  const [seeking, setSeeking] = React.useState(null);

  if (!currentSong) {
    return (
      <View style={[gStyle.container, gStyle.flexCenter]}>
        <Text style={styles.artist}>Nothing playing</Text>
        <View style={gStyle.spacer2} />
        <TouchIcon
          icon={<Feather color={colors.greyLight} name="chevron-down" />}
          onPress={() => navigation.goBack(null)}
        />
      </View>
    );
  }

  // ui state
  const favoriteColor = currentSong.liked ? colors.brandPrimary : colors.white;
  const favoriteIcon = currentSong.liked ? 'heart' : 'heart-o';
  const iconPlay = status.playing ? 'pause-circle' : 'play-circle';
  const duration = status.duration || currentSong.duration || 0;
  const position = seeking ?? status.currentTime;
  const timePast = func.formatTime(position);
  const timeLeft = func.formatTime(Math.max(duration - position, 0));
  const shuffleColor = shuffle ? colors.brandPrimary : colors.greyLight;
  const repeatColor = repeat !== 'off' ? colors.brandPrimary : colors.greyLight;

  return (
    <View style={gStyle.container}>
      <ModalHeader
        left={<Feather color={colors.greyLight} name="chevron-down" />}
        leftPress={() => navigation.goBack(null)}
        right={<Feather color={colors.greyLight} name="more-horizontal" />}
        rightPress={() =>
          navigation.navigate('ModalSongOptions', { songId: currentSong.id })
        }
        text={sourceName || 'Now playing'}
      />

      <View style={gStyle.p3}>
        <Artwork
          artwork={currentSong.artwork}
          size={device.width - 48}
          style={styles.image}
        />

        <View style={[gStyle.flexRowSpace, styles.containerDetails]}>
          <View style={styles.containerSong}>
            <Text ellipsizeMode="tail" numberOfLines={1} style={styles.song}>
              {currentSong.title}
            </Text>
            <Text ellipsizeMode="tail" numberOfLines={1} style={styles.artist}>
              {currentSong.artist}
            </Text>
          </View>
          <View style={styles.containerFavorite}>
            <TouchIcon
              icon={<FontAwesome color={favoriteColor} name={favoriteIcon} />}
              onPress={() => toggleLike(currentSong.id)}
            />
          </View>
        </View>

        <View style={styles.containerVolume}>
          <Slider
            maximumTrackTintColor={colors.grey3}
            maximumValue={duration || 1}
            minimumTrackTintColor={colors.white}
            minimumValue={0}
            onSlidingComplete={async (value) => {
              await seekTo(value);
              setSeeking(null);
            }}
            onValueChange={setSeeking}
            thumbTintColor={colors.white}
            value={position}
          />
          <View style={styles.containerTime}>
            <Text style={styles.time}>{timePast}</Text>
            <Text style={styles.time}>{`-${timeLeft}`}</Text>
          </View>
        </View>

        <View style={styles.containerControls}>
          <TouchIcon
            icon={<Feather color={shuffleColor} name="shuffle" />}
            onPress={toggleShuffle}
          />
          <View style={gStyle.flexRowCenterAlign}>
            <TouchIcon
              icon={<FontAwesome color={colors.white} name="step-backward" />}
              iconSize={32}
              onPress={previous}
            />
            <View style={gStyle.pH3}>
              <TouchIcon
                icon={<FontAwesome color={colors.white} name={iconPlay} />}
                iconSize={64}
                onPress={togglePlay}
              />
            </View>
            <TouchIcon
              icon={<FontAwesome color={colors.white} name="step-forward" />}
              iconSize={32}
              onPress={next}
            />
          </View>
          <View>
            <TouchIcon
              icon={<Feather color={repeatColor} name="repeat" />}
              onPress={cycleRepeat}
            />
            {repeat === 'one' && <Text style={styles.repeatOne}>1</Text>}
          </View>
        </View>

        <View style={styles.containerBottom}>
          <View />
          <TouchIcon
            icon={
              <MaterialIcons color={colors.greyLight} name="playlist-add" />
            }
            onPress={() =>
              navigation.navigate('ModalAddToPlaylist', {
                songId: currentSong.id
              })
            }
          />
        </View>
      </View>
    </View>
  );
}

ModalMusicPlayer.propTypes = {
  // required
  navigation: PropTypes.object.isRequired
};

const styles = StyleSheet.create({
  image: {
    marginVertical: device.iPhoneNotch ? 36 : 8
  },
  containerDetails: {
    marginBottom: 16
  },
  containerSong: {
    flex: 6
  },
  song: {
    ...gStyle.textSpotifyBold24,
    color: colors.white
  },
  artist: {
    ...gStyle.textSpotify18,
    color: colors.greyInactive
  },
  containerFavorite: {
    alignItems: 'flex-end',
    flex: 1,
    justifyContent: 'center'
  },
  containerTime: {
    ...gStyle.flexRowSpace
  },
  time: {
    ...gStyle.textSpotify10,
    color: colors.greyInactive
  },
  containerControls: {
    ...gStyle.flexRowSpace,
    marginTop: device.iPhoneNotch ? 24 : 8
  },
  repeatOne: {
    ...gStyle.textSpotifyBold12,
    color: colors.brandPrimary,
    fontSize: 9,
    position: 'absolute',
    right: -8,
    top: -6
  },
  containerBottom: {
    ...gStyle.flexRowSpace,
    marginTop: device.iPhoneNotch ? 32 : 8
  }
});

export default ModalMusicPlayer;
