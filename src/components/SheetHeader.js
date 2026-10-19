import * as React from 'react';
import PropTypes from 'prop-types';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, device, gStyle } from '../constants';

// header for modal sheets: [left action] title [right action]
function SheetHeader({
  left = null,
  leftPress = () => null,
  right = null,
  rightPress = () => null,
  title
}) {
  const insets = useSafeAreaInsets();
  // iOS modals are sheets below the status bar, android ones are full screen
  const paddingTop = device.iOS ? 16 : insets.top + 12;

  const action = (label, onPress, bold) => (
    <TouchableOpacity
      activeOpacity={gStyle.activeOpacity}
      disabled={!label}
      hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
      onPress={onPress}
      style={styles.action}
    >
      <Text style={bold ? styles.actionBold : styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop }]}>
      {action(left, leftPress, false)}
      <Text ellipsizeMode="tail" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <View style={styles.right}>{action(right, rightPress, true)}</View>
    </View>
  );
}

SheetHeader.propTypes = {
  // required
  title: PropTypes.string.isRequired,

  // optional
  left: PropTypes.string,
  leftPress: PropTypes.func,
  right: PropTypes.string,
  rightPress: PropTypes.func
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingBottom: 12,
    paddingHorizontal: 16
  },
  action: {
    minWidth: 64
  },
  actionText: {
    ...gStyle.textSpotify16,
    color: colors.white
  },
  actionBold: {
    ...gStyle.textSpotifyBold16,
    color: colors.brandPrimary,
    textAlign: 'right'
  },
  title: {
    ...gStyle.textSpotifyBold16,
    color: colors.white,
    flex: 1,
    textAlign: 'center'
  },
  right: {
    alignItems: 'flex-end',
    minWidth: 64
  }
});

export default SheetHeader;
