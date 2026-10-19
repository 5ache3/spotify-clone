import * as React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// screens
import PlaylistScreen from '../screens/Playlist';
import LibraryScreen from '../screens/Library';

const Stack = createNativeStackNavigator();

function StackLibrary() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Library"
        component={LibraryScreen}
        options={{
          headerShown: false
        }}
      />
      <Stack.Screen
        name="Playlist"
        component={PlaylistScreen}
        options={{
          headerShown: false
        }}
      />
    </Stack.Navigator>
  );
}

export default StackLibrary;
