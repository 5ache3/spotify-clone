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
import { colors, device, func, gStyle } from '../constants';

// components
import Artwork from '../components/Artwork';
import ScreenHeader from '../components/ScreenHeader';
import TouchIcon from '../components/TouchIcon';

// context
import { ALL_SONGS, LIKED_SONGS, useLibrary } from '../context/LibraryState';

function LibraryRow({ artwork = null, icon, onPress, subtitle, title }) {
  return (
    <TouchableOpacity
      activeOpacity={gStyle.activeOpacity}
      onPress={onPress}
      style={styles.row}
    >
      <Artwork artwork={artwork} icon={icon} size={56} />
      <View style={styles.rowText}>
        <Text ellipsizeMode="tail" numberOfLines={1} style={styles.rowTitle}>
          {title}
        </Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <Feather color={colors.greyInactive} name="chevron-right" size={20} />
    </TouchableOpacity>
  );
}

LibraryRow.propTypes = {
  // required
  icon: PropTypes.string.isRequired,
  onPress: PropTypes.func.isRequired,
  subtitle: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,

  // optional
  artwork: PropTypes.string
};

function Library({ navigation }) {
  const { playlists, songList, songs } = useLibrary();

  const likedCount = songList.filter((s) => s.liked).length;
  const openPlaylist = (playlistId) =>
    navigation.navigate('Playlist', { playlistId });

  const header = (
    <React.Fragment>
      <LibraryRow
        icon="heart"
        onPress={() => openPlaylist(LIKED_SONGS)}
        subtitle={`Playlist · ${func.plural(likedCount, 'song')}`}
        title="Liked Songs"
      />
      <LibraryRow
        icon="download"
        onPress={() => openPlaylist(ALL_SONGS)}
        subtitle={`On this phone · ${func.plural(songList.length, 'song')}`}
        title="Downloaded songs"
      />
      <LibraryRow
        icon="plus"
        onPress={() => navigation.navigate('ModalPlaylistEdit')}
        subtitle="Name it, then add songs"
        title="Create playlist"
      />
      <LibraryRow
        icon="link"
        onPress={() => navigation.navigate('ModalImportSpotify')}
        subtitle="Paste a playlist or album link"
        title="Import from Spotify"
      />
      <LibraryRow
        icon="download-cloud"
        onPress={() => navigation.navigate('StackSearch')}
        subtitle="Search YouTube, paste a link, or import a file"
        title="Add music"
      />
      {playlists.length > 0 && <Text style={styles.heading}>Playlists</Text>}
    </React.Fragment>
  );

  return (
    <View style={gStyle.container}>
      <View style={styles.containerHeader}>
        <ScreenHeader
          right={
            <TouchIcon
              icon={<Feather color={colors.white} name="plus" />}
              onPress={() => navigation.navigate('ModalPlaylistEdit')}
            />
          }
          title="Your Library"
        />
      </View>

      <FlatList
        contentContainerStyle={styles.containerFlatlist}
        data={playlists}
        keyExtractor={({ id }) => id}
        ListHeaderComponent={header}
        renderItem={({ item }) => {
          const cover =
            (item.artwork && item) ||
            item.songIds.map((id) => songs[id]).find((s) => s?.artwork);

          return (
            <LibraryRow
              artwork={cover?.artwork || null}
              icon="music"
              onPress={() => openPlaylist(item.id)}
              subtitle={`Playlist · ${func.plural(
                item.songIds.length,
                'song'
              )}`}
              title={item.name}
            />
          );
        }}
      />
    </View>
  );
}

Library.propTypes = {
  // required
  navigation: PropTypes.object.isRequired
};

const styles = StyleSheet.create({
  containerHeader: {
    position: 'absolute',
    top: 0,
    width: '100%',
    zIndex: 10
  },
  containerFlatlist: {
    paddingBottom: 24,
    paddingTop: device.iPhoneNotch ? 96 : 72
  },
  heading: {
    ...gStyle.textSpotifyBold18,
    color: colors.white,
    marginBottom: 8,
    marginLeft: 16,
    marginTop: 16
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  rowText: {
    flex: 1,
    marginLeft: 12
  },
  rowTitle: {
    ...gStyle.textSpotify16,
    color: colors.white,
    marginBottom: 4
  },
  rowSubtitle: {
    ...gStyle.textSpotify12,
    color: colors.greyInactive
  }
});

export default Library;
