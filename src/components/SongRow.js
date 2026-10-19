import * as React from 'react';
import PropTypes from 'prop-types';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { colors, func, gStyle } from '../constants';

// components
import Artwork from './Artwork';

// a downloaded song in a list
function SongRow({
  active = false,
  onMore = null,
  onPress,
  right = null,
  song
}) {
  const titleColor = active ? colors.brandPrimary : colors.white;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={gStyle.activeOpacity}
        onPress={() => onPress(song)}
        style={styles.containerMain}
      >
        <Artwork artwork={song.artwork} size={48} />
        <View style={styles.containerText}>
          <Text
            ellipsizeMode="tail"
            numberOfLines={1}
            style={[styles.title, { color: titleColor }]}
          >
            {song.title}
          </Text>
          <View style={gStyle.flexRowCenterAlign}>
            <View style={styles.circleDownloaded}>
              <Ionicons color={colors.blackBg} name="arrow-down" size={10} />
            </View>
            {song.liked && (
              <Ionicons
                color={colors.brandPrimary}
                name="heart"
                size={12}
                style={gStyle.mR1}
              />
            )}
            <Text ellipsizeMode="tail" numberOfLines={1} style={styles.artist}>
              {song.duration
                ? `${song.artist} · ${func.formatTime(song.duration)}`
                : song.artist}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {right}
      {onMore && (
        <TouchableOpacity
          activeOpacity={gStyle.activeOpacity}
          hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
          onPress={() => onMore(song)}
          style={styles.containerRight}
        >
          <Feather color={colors.greyLight} name="more-horizontal" size={20} />
        </TouchableOpacity>
      )}
    </View>
  );
}

SongRow.propTypes = {
  // required
  onPress: PropTypes.func.isRequired,
  song: PropTypes.shape({
    artist: PropTypes.string,
    artwork: PropTypes.string,
    duration: PropTypes.number,
    liked: PropTypes.bool,
    title: PropTypes.string
  }).isRequired,

  // optional
  active: PropTypes.bool,
  onMore: PropTypes.func,
  right: PropTypes.element
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    width: '100%'
  },
  containerMain: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row'
  },
  containerText: {
    flex: 1,
    marginLeft: 12
  },
  title: {
    ...gStyle.textSpotify16,
    marginBottom: 4
  },
  circleDownloaded: {
    alignItems: 'center',
    backgroundColor: colors.brandPrimary,
    borderRadius: 6,
    height: 12,
    justifyContent: 'center',
    marginRight: 6,
    width: 12
  },
  artist: {
    ...gStyle.textSpotify12,
    color: colors.greyInactive,
    flex: 1
  },
  containerRight: {
    alignItems: 'flex-end',
    paddingLeft: 16
  }
});

export default SongRow;
