import * as React from 'react';
import PropTypes from 'prop-types';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, gStyle } from '../constants';

// components
import SheetHeader from '../components/SheetHeader';
import SongRow from '../components/SongRow';
import TouchText from '../components/TouchText';

// context
import { useLibrary } from '../context/LibraryState';

// tick downloaded songs to add/remove them from a playlist
function ModalAddSongs({ navigation, route }) {
  const { playlistId } = route.params;
  const { getPlaylist, songList, togglePlaylistSong } = useLibrary();
  const [query, setQuery] = React.useState('');

  const playlist = getPlaylist(playlistId);
  if (!playlist) return <View style={gStyle.container} />;

  const q = query.trim().toLowerCase();
  const data = q
    ? songList.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.artist.toLowerCase().includes(q)
      )
    : songList;

  return (
    <View style={gStyle.container}>
      <SheetHeader
        right="Done"
        rightPress={() => navigation.goBack()}
        title={`Add to ${playlist.name}`}
      />

      <View style={styles.containerSearch}>
        <Feather color={colors.greyInactive} name="search" size={16} />
        <TextInput
          onChangeText={setQuery}
          placeholder="Search your downloads"
          placeholderTextColor={colors.greyInactive}
          selectionColor={colors.brandPrimary}
          style={styles.input}
          value={query}
        />
      </View>

      <FlatList
        data={data}
        keyboardShouldPersistTaps="handled"
        keyExtractor={({ id }) => id}
        ListEmptyComponent={
          <View style={styles.containerEmpty}>
            <Text style={styles.empty}>
              {songList.length === 0
                ? 'You have no downloaded songs yet.'
                : 'No matches.'}
            </Text>
            {songList.length === 0 && (
              <TouchText
                onPress={() => {
                  navigation.goBack();
                  navigation.navigate('TabNavigation', {
                    screen: 'StackSearch'
                  });
                }}
                style={styles.btn}
                styleText={styles.btnText}
                text="Find music"
              />
            )}
          </View>
        }
        renderItem={({ item }) => {
          const added = playlist.songIds.includes(item.id);

          return (
            <SongRow
              onPress={() => togglePlaylistSong(playlist.id, item.id)}
              right={
                <Feather
                  color={added ? colors.brandPrimary : colors.greyInactive}
                  name={added ? 'check-circle' : 'plus-circle'}
                  onPress={() => togglePlaylistSong(playlist.id, item.id)}
                  size={24}
                  style={gStyle.mL2}
                />
              }
              song={item}
            />
          );
        }}
      />
    </View>
  );
}

ModalAddSongs.propTypes = {
  // required
  navigation: PropTypes.object.isRequired,
  route: PropTypes.object.isRequired
};

const styles = StyleSheet.create({
  containerSearch: {
    alignItems: 'center',
    backgroundColor: colors.grey,
    borderRadius: 6,
    flexDirection: 'row',
    marginBottom: 8,
    marginHorizontal: 16,
    paddingHorizontal: 12
  },
  input: {
    ...gStyle.textSpotify14,
    color: colors.white,
    flex: 1,
    marginLeft: 8,
    paddingVertical: 10
  },
  containerEmpty: {
    alignItems: 'center',
    paddingTop: 48
  },
  empty: {
    ...gStyle.textSpotify14,
    color: colors.greyInactive
  },
  btn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: 20,
    height: 40,
    marginTop: 16,
    paddingHorizontal: 24
  },
  btnText: {
    ...gStyle.textSpotifyBold12,
    color: colors.white,
    letterSpacing: 1,
    textTransform: 'uppercase'
  }
});

export default ModalAddSongs;
