import * as React from 'react';
import PropTypes from 'prop-types';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, func, gStyle } from '../constants';

// components
import Artwork from '../components/Artwork';
import SheetHeader from '../components/SheetHeader';

// context
import { useLibrary } from '../context/LibraryState';

// put one song into any of your playlists
function ModalAddToPlaylist({ navigation, route }) {
  const { songId } = route.params;
  const { playlists, songs, togglePlaylistSong } = useLibrary();
  const song = songs[songId];

  return (
    <View style={gStyle.container}>
      <SheetHeader
        right="Done"
        rightPress={() => navigation.goBack()}
        title={song ? `Add "${song.title}"` : 'Add to playlist'}
      />

      <FlatList
        data={playlists}
        keyExtractor={({ id }) => id}
        ListHeaderComponent={
          <TouchableOpacity
            activeOpacity={gStyle.activeOpacity}
            onPress={() => {
              navigation.goBack();
              navigation.navigate('ModalPlaylistEdit', { addSongId: songId });
            }}
            style={styles.row}
          >
            <Artwork icon="plus" size={56} />
            <Text style={styles.title}>New playlist</Text>
          </TouchableOpacity>
        }
        renderItem={({ item }) => {
          const added = item.songIds.includes(songId);
          const cover =
            (item.artwork && item) ||
            item.songIds.map((id) => songs[id]).find((s) => s?.artwork);

          return (
            <TouchableOpacity
              activeOpacity={gStyle.activeOpacity}
              onPress={() => togglePlaylistSong(item.id, songId)}
              style={styles.row}
            >
              <Artwork artwork={cover?.artwork || null} size={56} />
              <View style={gStyle.flex1}>
                <Text
                  ellipsizeMode="tail"
                  numberOfLines={1}
                  style={styles.title}
                >
                  {item.name}
                </Text>
                <Text style={styles.subtitle}>
                  {func.plural(item.songIds.length, 'song')}
                </Text>
              </View>
              <Feather
                color={added ? colors.brandPrimary : colors.greyInactive}
                name={added ? 'check-circle' : 'circle'}
                size={24}
              />
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

ModalAddToPlaylist.propTypes = {
  // required
  navigation: PropTypes.object.isRequired,
  route: PropTypes.object.isRequired
};

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  title: {
    ...gStyle.textSpotify16,
    color: colors.white,
    marginLeft: 12
  },
  subtitle: {
    ...gStyle.textSpotify12,
    color: colors.greyInactive,
    marginLeft: 12,
    marginTop: 4
  }
});

export default ModalAddToPlaylist;
