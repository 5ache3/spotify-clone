import * as React from 'react';
import PropTypes from 'prop-types';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, gStyle } from '../constants';

// components
import BarMusicPlayer from './BarMusicPlayer';

// context
import Context from '../context';

// https://reactnavigation.org/docs/5.x/bottom-tab-navigator/#tabbar
function CustomTabBar({ descriptors, navigation, state }) {
  // get main app state
  const { showMusicBar } = React.useContext(Context);
  const insets = useSafeAreaInsets();

  const focusedOptions = descriptors[state.routes[state.index].key].options;

  if (focusedOptions.tabBarVisible === false) {
    return null;
  }

  return (
    <React.Fragment>
      {showMusicBar && <BarMusicPlayer />}

      <View
        style={[
          styles.container,
          { paddingBottom: Math.max(insets.bottom, 12) }
        ]}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];

          // default label
          const defaultLabl =
            options.title !== undefined ? options.title : route.name;
          // label set
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : defaultLabl;

          const isFocused = state.index === index;
          const color = isFocused ? colors.white : colors.greyInactive;

          // custom icon
          const Icon = options.tabBarIcon;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key
            });
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              activeOpacity={gStyle.activeOpacity}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.containerTab}
            >
              <Icon active={isFocused} />
              <Text style={[styles.label, { color }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </React.Fragment>
  );
}

CustomTabBar.propTypes = {
  // required
  descriptors: PropTypes.object.isRequired,
  navigation: PropTypes.object.isRequired,
  state: PropTypes.object.isRequired
};

const styles = StyleSheet.create({
  container: {
    ...gStyle.flexRowCenterAlign,
    backgroundColor: colors.grey,
    paddingTop: 12
  },
  containerTab: {
    ...gStyle.flex1,
    ...gStyle.flexCenter
  },
  label: {
    ...gStyle.textSpotify12,
    paddingTop: 4
  }
});

export default CustomTabBar;
