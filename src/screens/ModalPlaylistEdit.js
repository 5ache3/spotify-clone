import * as React from 'react';
import PropTypes from 'prop-types';
import { StyleSheet, TextInput, View } from 'react-native';
import { colors, gStyle } from '../constants';

// components
import SheetHeader from '../components/SheetHeader';

// context
import { useLibrary } from '../context/LibraryState';

// create a playlist, or rename one (params.playlistId)
// params.addSongId: song to put in the new playlist right away
function ModalPlaylistEdit({ navigation, route }) {
  const { playlistId = null, addSongId = null } = route.params || {};
  const { createPlaylist, playlists, renamePlaylist } = useLibrary();

  const existing = playlists.find((p) => p.id === playlistId);
  const [name, setName] = React.useState(
    existing ? existing.name : `My Playlist #${playlists.length + 1}`
  );

  const onSave = () => {
    if (existing) {
      renamePlaylist(existing.id, name);
      navigation.goBack();

      return;
    }

    const id = createPlaylist(name, addSongId ? [addSongId] : []);
    if (addSongId) {
      navigation.goBack();
    } else {
      // straight into the new playlist to add songs
      navigation.goBack();
      navigation.navigate('ModalAddSongs', { playlistId: id });
    }
  };

  return (
    <View style={gStyle.container}>
      <SheetHeader
        left="Cancel"
        leftPress={() => navigation.goBack()}
        right={existing ? 'Save' : 'Create'}
        rightPress={onSave}
        title={existing ? 'Rename playlist' : 'Give your playlist a name'}
      />
      <View style={styles.container}>
        <TextInput
          autoFocus
          onChangeText={setName}
          onSubmitEditing={onSave}
          returnKeyType="done"
          selectTextOnFocus
          selectionColor={colors.brandPrimary}
          style={styles.input}
          value={name}
        />
      </View>
    </View>
  );
}

ModalPlaylistEdit.propTypes = {
  // required
  navigation: PropTypes.object.isRequired,
  route: PropTypes.object.isRequired
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 32,
    paddingTop: 64
  },
  input: {
    ...gStyle.textSpotifyBold24,
    borderBottomColor: colors.greyInactive,
    borderBottomWidth: 1,
    color: colors.white,
    paddingVertical: 8,
    textAlign: 'center'
  }
});

export default ModalPlaylistEdit;
