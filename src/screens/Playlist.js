import * as React from 'react';
import PropTypes from 'prop-types';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { colors, device, func, gStyle } from '../constants';

// components
import Artwork from '../components/Artwork';
import ImportStatus from '../components/ImportStatus';
import LinearGradient from '../components/LinearGradient';
import SongRow from '../components/SongRow';
import TouchIcon from '../components/TouchIcon';
import TouchText from '../components/TouchText';

// context
import { LIKED_SONGS, useLibrary } from '../context/LibraryState';
import { usePlayer, usePlayerStatus } from '../context/PlayerState';

function Playlist({ navigation, route }) {
  const { playlistId } = route.params;
  const { deletePlaylist, getPlaylist } = useLibrary();
  const { currentSong, playSongs, togglePlay, sourceName } = usePlayer();
  const { playing } = usePlayerStatus();

  const playlist = getPlaylist(playlistId);

  if (!playlist) {
    return (
      <View style={[gStyle.container, gStyle.flexCenter]}>
        <Text style={styles.info}>This playlist was deleted.</Text>
      </View>
    );
  }

  const ids = playlist.songs.map((s) => s.id);
  const totalSeconds = playlist.songs.reduce(
    (sum, s) => sum + (s.duration || 0),
    0
  );
  const cover =
    playlist.artwork || playlist.songs.find((s) => s.artwork)?.artwork || null;
  const isThisPlaying =
    playing && sourceName === playlist.name && ids.includes(currentSong?.id);

  const onPlay = () => {
    if (isThisPlaying) {
      togglePlay();
    } else {
      playSongs(ids, null, { name: playlist.name, shuffle: false });
    }
  };

  const onMoreOptions = () => {
    Alert.alert(playlist.name, null, [
      {
        onPress: () =>
          navigation.navigate('ModalPlaylistEdit', { playlistId: playlist.id }),
        text: 'Rename'
      },
      {
        onPress: () =>
          Alert.alert(
            'Delete playlist?',
            `"${playlist.name}" will be removed. Songs stay downloaded.`,
            [
              { style: 'cancel', text: 'Cancel' },
              {
                onPress: () => {
                  navigation.goBack();
                  deletePlaylist(playlist.id);
                },
                style: 'destructive',
                text: 'Delete'
              }
            ]
          ),
        style: 'destructive',
        text: 'Delete'
      },
      { style: 'cancel', text: 'Cancel' }
    ]);
  };

  const header = (
    <View>
      <View style={styles.containerLinear}>
        <LinearGradient fill={colors.greyOff} height={360} />
      </View>
      <View style={styles.containerTop}>
        <Artwork
          artwork={cover}
          icon={playlistId === LIKED_SONGS ? 'heart' : 'music'}
          size={180}
          style={styles.cover}
        />
        <Text ellipsizeMode="tail" numberOfLines={2} style={styles.title}>
          {playlist.name}
        </Text>
        <Text style={styles.info}>
          {`${func.plural(playlist.songs.length, 'song')}${
            totalSeconds ? ` · ${Math.round(totalSeconds / 60)} min` : ''
          }`}
        </Text>
      </View>

      <View style={styles.containerActions}>
        <Text style={styles.info}>{playlist.virtual ? '' : 'Playlist'}</Text>
        <View style={gStyle.flexRowCenterAlign}>
          <TouchIcon
            icon={<Feather color={colors.greyLight} name="shuffle" />}
            onPress={() =>
              playSongs(ids, null, { name: playlist.name, shuffle: true })
            }
            style={gStyle.mR3}
          />
          <TouchIcon
            icon={
              <FontAwesome
                color={colors.brandPrimary}
                name={isThisPlaying ? 'pause-circle' : 'play-circle'}
              />
            }
            iconSize={56}
            onPress={onPlay}
          />
        </View>
      </View>

      {!playlist.virtual && (
        <TouchText
          onPress={() =>
            navigation.navigate('ModalAddSongs', { playlistId: playlist.id })
          }
          style={styles.btnAdd}
          styleText={styles.btnAddText}
          text="Add songs"
        />
      )}

      {playlist.import && <ImportStatus playlist={playlist} />}
    </View>
  );

  const empty = (
    <View style={styles.containerEmpty}>
      <Text style={styles.info}>
        {playlist.virtual
          ? 'Nothing here yet.'
          : 'Add songs from your downloads to this playlist.'}
      </Text>
      <TouchText
        onPress={() => navigation.navigate('StackSearch')}
        style={styles.btnFind}
        styleText={styles.btnAddText}
        text="Find music"
      />
    </View>
  );

  return (
    <View style={gStyle.container}>
      <View style={styles.containerHeader}>
        <TouchIcon
          icon={<Feather color={colors.white} name="chevron-left" />}
          onPress={() => navigation.goBack(null)}
        />
        {!playlist.virtual && (
          <TouchIcon
            icon={<Feather color={colors.white} name="more-horizontal" />}
            onPress={onMoreOptions}
          />
        )}
      </View>

      <FlatList
        contentContainerStyle={gStyle.pB3}
        data={playlist.songs}
        keyExtractor={({ id }) => id}
        ListEmptyComponent={playlist.import ? null : empty}
        ListFooterComponent={
          <React.Fragment>
            {playlist.import && (
              <ImportStatus playlist={playlist} section="list" />
            )}
            {totalSeconds > 0 && (
              <Text style={[styles.info, gStyle.mT2]}>
                {`Total ${func.formatTime(totalSeconds)}`}
              </Text>
            )}
          </React.Fragment>
        }
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <SongRow
            active={currentSong?.id === item.id}
            onMore={(song) =>
              navigation.navigate('ModalSongOptions', {
                playlistId: playlist.virtual ? null : playlist.id,
                songId: song.id
              })
            }
            onPress={(song) => playSongs(ids, song.id, { name: playlist.name })}
            song={item}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

Playlist.propTypes = {
  // required
  navigation: PropTypes.object.isRequired,
  route: PropTypes.object.isRequired
};

const styles = StyleSheet.create({
  containerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    paddingHorizontal: 16,
    paddingTop: device.iPhoneNotch ? 56 : 32,
    position: 'absolute',
    right: 0,
    zIndex: 10
  },
  containerLinear: {
    position: 'absolute',
    top: 0,
    width: '100%'
  },
  containerTop: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: device.iPhoneNotch ? 96 : 72
  },
  cover: {
    marginBottom: 16
  },
  title: {
    ...gStyle.textSpotifyBold24,
    color: colors.white,
    marginBottom: 6,
    textAlign: 'center'
  },
  info: {
    ...gStyle.textSpotify12,
    color: colors.greyInactive,
    textAlign: 'center'
  },
  containerActions: {
    ...gStyle.flexRowSpace,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  btnAdd: {
    alignSelf: 'center',
    borderColor: colors.greyInactive,
    borderRadius: 20,
    borderWidth: 1,
    height: 36,
    marginBottom: 8,
    paddingHorizontal: 20
  },
  btnAddText: {
    ...gStyle.textSpotifyBold12,
    color: colors.white,
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  containerEmpty: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 24
  },
  btnFind: {
    backgroundColor: colors.brandPrimary,
    borderRadius: 20,
    height: 40,
    marginTop: 16,
    paddingHorizontal: 24
  }
});

export default Playlist;
