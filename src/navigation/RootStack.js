import * as React from 'react';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// navigation
import TabNavigation from './TabNavigation';

// screens
import ModalAddSongs from '../screens/ModalAddSongs';
import ModalAddToPlaylist from '../screens/ModalAddToPlaylist';
import ModalImportSpotify from '../screens/ModalImportSpotify';
import ModalMoreOptions from '../screens/ModalMoreOptions';
import ModalMusicPlayer from '../screens/ModalMusicPlayer';
import ModalPlaylistEdit from '../screens/ModalPlaylistEdit';
import ModalSongOptions from '../screens/ModalSongOptions';
import Settings from '../screens/Settings';

const Stack = createNativeStackNavigator();

const sheet = {
  headerShown: false,
  presentation: 'modal'
};

const overlay = {
  animation: 'slide_from_bottom',
  headerShown: false,
  presentation: 'transparentModal'
};

function RootStack() {
  return (
    <NavigationContainer theme={DarkTheme}>
      <Stack.Navigator
        screenOptions={{
          presentation: 'fullScreenModal'
        }}
      >
        <Stack.Screen
          name="TabNavigation"
          component={TabNavigation}
          options={{
            headerShown: false
          }}
        />

        <Stack.Screen
          name="ModalMusicPlayer"
          component={ModalMusicPlayer}
          options={{
            animation: 'slide_from_bottom',
            headerShown: false
          }}
        />
        <Stack.Screen
          name="ModalMoreOptions"
          component={ModalMoreOptions}
          options={overlay}
        />
        <Stack.Screen
          name="ModalSongOptions"
          component={ModalSongOptions}
          options={overlay}
        />
        <Stack.Screen
          name="ModalAddToPlaylist"
          component={ModalAddToPlaylist}
          options={sheet}
        />
        <Stack.Screen
          name="ModalAddSongs"
          component={ModalAddSongs}
          options={sheet}
        />
        <Stack.Screen
          name="ModalPlaylistEdit"
          component={ModalPlaylistEdit}
          options={sheet}
        />
        <Stack.Screen
          name="ModalImportSpotify"
          component={ModalImportSpotify}
          options={sheet}
        />
        <Stack.Screen name="Settings" component={Settings} options={sheet} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default RootStack;
