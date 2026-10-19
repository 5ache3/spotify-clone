import * as React from 'react';
import PropTypes from 'prop-types';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { colors, device, gStyle } from '../constants';

// components
import TouchIcon from './TouchIcon';

function ScreenHeader({ right = null, showBack = false, title }) {
  const navigation = useNavigation();

  return (
    <BlurView tint="dark" intensity={95} style={styles.container}>
      {(showBack || right) && (
        <View style={styles.left}>
          {showBack && (
            <TouchIcon
              icon={<Feather color={colors.white} name="chevron-left" />}
              onPress={() => navigation.goBack(null)}
            />
          )}
        </View>
      )}

      <View style={styles.containerText}>
        <Text style={styles.text}>{title}</Text>
      </View>

      {(showBack || right) && <View style={styles.right}>{right}</View>}
    </BlurView>
  );
}

ScreenHeader.propTypes = {
  // required
  title: PropTypes.string.isRequired,

  // optional
  right: PropTypes.element,
  showBack: PropTypes.bool
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 16,
    paddingHorizontal: 24,
    paddingTop: device.iPhoneNotch ? 48 : 24
  },
  containerText: {
    ...gStyle.flex5,
    alignItems: 'center',
    justifyContent: 'center'
  },
  text: {
    ...gStyle.textSpotifyBold16,
    color: colors.white,
    textAlign: 'center'
  },
  left: {
    ...gStyle.flex1,
    alignItems: 'flex-start'
  },
  right: {
    ...gStyle.flex1,
    alignItems: 'flex-end'
  }
});

export default ScreenHeader;
