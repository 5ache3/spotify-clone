import * as React from 'react';
import PropTypes from 'prop-types';
import { Image, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../constants';
import { uriFor } from '../lib/files';

// cover art for a song/playlist, or a placeholder icon when there is none
function Artwork({
  artwork = null,
  icon = 'music',
  round = false,
  size,
  style = {}
}) {
  const shape = {
    borderRadius: round ? size / 2 : 4,
    height: size,
    width: size
  };

  if (artwork) {
    return <Image source={{ uri: uriFor(artwork) }} style={[shape, style]} />;
  }

  return (
    <View style={[styles.placeholder, shape, style]}>
      <Feather color={colors.greyInactive} name={icon} size={size * 0.4} />
    </View>
  );
}

Artwork.propTypes = {
  // required
  size: PropTypes.number.isRequired,

  // optional
  artwork: PropTypes.string,
  icon: PropTypes.string,
  round: PropTypes.bool,
  style: PropTypes.oneOfType([
    PropTypes.array,
    PropTypes.number,
    PropTypes.object
  ])
};

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    backgroundColor: colors.greyOff,
    justifyContent: 'center'
  }
});

export default Artwork;
