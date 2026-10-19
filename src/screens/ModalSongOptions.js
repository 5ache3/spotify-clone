import * as React from 'react';
import PropTypes from 'prop-types';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, gStyle } from '../constants';

// components
import Artwork from '../components/Artwork';
import LineItemCategory from '../components/LineItemCategory';

// context
import { useLibrary } from '../context/LibraryState';
import { usePlayer } from '../context/PlayerState';

// actions for one song (params.playlistId when opened from a playlist)
function ModalSongOptions({ navigation, route }) {
  const { playlistId = null, songId } = route.params;
  const { deleteSong, getPlaylist, removeFromPlaylist, songs, toggleLike } =
    useLibrary();
  const { addToQueue } = usePlayer();
  const insets = useSafeAreaInsets();

  const song = songs[songId];
  const playlist = playlistId ? getPlaylist(playlistId) : null;

  if (!song) return null;

  const close = () => navigation.goBack();

  const options = [
    {
      icon: song.liked ? 'heart' : 'heart-o',
      lib: 'FontAwesome',
      onPress: () => {
        toggleLike(song.id);
        close();
      },
      title: song.liked ? 'Remove from Liked Songs' : 'Like'
    },
    {
      icon: 'queue-music',
      lib: 'MaterialIcons',
      onPress: () => {
        close();
        navigation.navigate('ModalAddToPlaylist', { songId: song.id });
      },
      title: 'Add to playlist'
    },
    playlist && {
      icon: 'minus-circle',
      lib: 'Feather',
      onPress: () => {
        removeFromPlaylist(playlist.id, song.id);
        close();
      },
      title: `Remove from ${playlist.name}`
    },
    {
      icon: 'playlist-add',
      lib: 'MaterialIcons',
      onPress: () => {
        addToQueue(song.id);
        close();
      },
      title: 'Play next'
    },
    {
      icon: 'trash-2',
      lib: 'Feather',
      onPress: () =>
        Alert.alert(
          'Delete download?',
          `"${song.title}" will be removed from this phone and from all playlists.`,
          [
            { style: 'cancel', text: 'Cancel' },
            {
              onPress: () => {
                close();
                deleteSong(song.id);
              },
              style: 'destructive',
              text: 'Delete'
            }
          ]
        ),
      title: 'Delete from device'
    }
  ].filter(Boolean);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 64 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.containerSong}>
          <Artwork artwork={song.artwork} size={148} />
          <Text ellipsizeMode="tail" numberOfLines={2} style={styles.title}>
            {song.title}
          </Text>
          <Text style={styles.artist}>{song.artist}</Text>
        </View>

        {options.map((item) => (
          <LineItemCategory
            key={item.title}
            disableRightSide
            icon={item.icon}
            iconLibrary={item.lib}
            onPress={item.onPress}
            title={item.title}
          />
        ))}
      </ScrollView>

      <TouchableWithoutFeedback onPress={close}>
        <View
          style={[
            styles.containerButton,
            { paddingBottom: insets.bottom + 16 }
          ]}
        >
          <Text style={styles.buttonText}>Cancel</Text>
        </View>
      </TouchableWithoutFeedback>
    </View>
  );
}

ModalSongOptions.propTypes = {
  // required
  navigation: PropTypes.object.isRequired,
  route: PropTypes.object.isRequired
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.blackBlur,
    flex: 1
  },
  content: {
    paddingBottom: 24
  },
  containerSong: {
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 24
  },
  title: {
    ...gStyle.textSpotifyBold20,
    color: colors.white,
    marginTop: 16,
    textAlign: 'center'
  },
  artist: {
    ...gStyle.textSpotify12,
    color: colors.greyInactive,
    marginTop: 8
  },
  containerButton: {
    alignItems: 'center',
    paddingTop: 16
  },
  buttonText: {
    color: colors.white,
    fontSize: 18
  }
});

export default ModalSongOptions;
