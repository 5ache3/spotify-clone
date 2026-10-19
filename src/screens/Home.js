import * as React from 'react';
import PropTypes from 'prop-types';
import {
  Animated,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { colors, device, func, gStyle } from '../constants';

// components
import AlbumsHorizontal from '../components/AlbumsHorizontal';
import Artwork from '../components/Artwork';

// context
import { ALL_SONGS, LIKED_SONGS, useLibrary } from '../context/LibraryState';
import { usePlayer } from '../context/PlayerState';

// mock data
import heavyRotation from '../mockdata/heavyRotation.json';
import jumpBackIn from '../mockdata/jumpBackIn.json';
import recentlyPlayed from '../mockdata/recentlyPlayed.json';

// your playlists + newest downloads, as horizontal cards
function LibraryHorizontal({ data, heading }) {
  return (
    <View style={styles.containerSection}>
      <Text style={styles.heading}>{heading}</Text>
      <FlatList
        contentContainerStyle={styles.containerContent}
        data={data}
        horizontal
        keyExtractor={({ key }) => key}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={gStyle.activeOpacity}
            onPress={item.onPress}
            style={styles.item}
          >
            <Artwork artwork={item.artwork} icon={item.icon} size={148} />
            <Text ellipsizeMode="tail" numberOfLines={1} style={styles.title}>
              {item.title}
            </Text>
            <Text
              ellipsizeMode="tail"
              numberOfLines={1}
              style={styles.subtitle}
            >
              {item.subtitle}
            </Text>
          </TouchableOpacity>
        )}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

LibraryHorizontal.propTypes = {
  // required
  data: PropTypes.array.isRequired,
  heading: PropTypes.string.isRequired
};

function Home({ navigation }) {
  const { playlists, songList, songs } = useLibrary();
  const { playSongs } = usePlayer();

  const openPlaylist = (playlistId) =>
    navigation.navigate('Playlist', { playlistId });

  const playlistCards = [
    songList.some((s) => s.liked) && {
      icon: 'heart',
      key: LIKED_SONGS,
      onPress: () => openPlaylist(LIKED_SONGS),
      subtitle: 'Playlist',
      title: 'Liked Songs'
    },
    ...playlists.map((p) => ({
      artwork:
        p.artwork ||
        p.songIds.map((id) => songs[id]).find((s) => s?.artwork)?.artwork ||
        null,
      key: p.id,
      onPress: () => openPlaylist(p.id),
      subtitle: func.plural(p.songIds.length, 'song'),
      title: p.name
    })),
    {
      icon: 'plus',
      key: 'create',
      onPress: () => navigation.navigate('ModalPlaylistEdit'),
      subtitle: 'New playlist',
      title: 'Create playlist'
    }
  ].filter(Boolean);

  const recentIds = songList.map((s) => s.id);
  const recentCards = songList.slice(0, 12).map((song) => ({
    artwork: song.artwork,
    key: song.id,
    onPress: () => playSongs(recentIds, song.id, { name: 'Recently added' }),
    subtitle: song.artist,
    title: song.title
  }));
  if (songList.length > 12) {
    recentCards.push({
      icon: 'list',
      key: 'all',
      onPress: () => openPlaylist(ALL_SONGS),
      subtitle: func.plural(songList.length, 'song'),
      title: 'See all'
    });
  }

  const scrollY = React.useRef(new Animated.Value(0)).current;

  const opacityIn = scrollY.interpolate({
    inputRange: [0, 128],
    outputRange: [0, 1],
    extrapolate: 'clamp'
  });

  const opacityOut = scrollY.interpolate({
    inputRange: [0, 88],
    outputRange: [1, 0],
    extrapolate: 'clamp'
  });

  return (
    <React.Fragment>
      {device.iPhoneNotch && (
        <Animated.View style={[styles.iPhoneNotch, { opacity: opacityIn }]} />
      )}

      <Animated.View style={[styles.containerHeader, { opacity: opacityOut }]}>
        <TouchableOpacity
          activeOpacity={gStyle.activeOpacity}
          hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
          onPress={() => navigation.navigate('Settings')}
        >
          <FontAwesome color={colors.white} name="cog" size={28} />
        </TouchableOpacity>
      </Animated.View>

      <Animated.ScrollView
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        style={gStyle.container}
      >
        <View style={gStyle.spacer16} />

        <LibraryHorizontal data={playlistCards} heading="Your playlists" />

        {recentCards.length > 0 ? (
          <LibraryHorizontal data={recentCards} heading="Recently added" />
        ) : (
          <TouchableOpacity
            activeOpacity={gStyle.activeOpacity}
            onPress={() => navigation.navigate('StackSearch')}
            style={styles.empty}
          >
            <Text style={styles.heading}>Add your first song</Text>
            <Text style={[styles.subtitle, gStyle.pL2]}>
              Search YouTube, paste a link, or import audio from your phone.
            </Text>
          </TouchableOpacity>
        )}

        <AlbumsHorizontal data={recentlyPlayed} heading="Recently played" />

        <AlbumsHorizontal
          data={heavyRotation}
          heading="Your heavy rotation"
          tagline="The music you've had on repeat this month."
        />

        <AlbumsHorizontal
          data={jumpBackIn}
          heading="Jump back in"
          tagline="Your top listens from the past few months."
        />
      </Animated.ScrollView>
    </React.Fragment>
  );
}

Home.propTypes = {
  // required
  navigation: PropTypes.object.isRequired
};

const styles = StyleSheet.create({
  containerSection: {
    marginBottom: 32,
    width: '100%'
  },
  containerContent: {
    paddingLeft: 16
  },
  heading: {
    ...gStyle.textSpotifyBold18,
    color: colors.white,
    paddingBottom: 12,
    paddingLeft: 16
  },
  item: {
    marginRight: 16,
    width: 148
  },
  title: {
    ...gStyle.textSpotifyBold12,
    color: colors.white,
    marginTop: 6
  },
  subtitle: {
    ...gStyle.textSpotify12,
    color: colors.greyInactive,
    marginTop: 2,
    paddingLeft: 0
  },
  empty: {
    backgroundColor: colors.grey,
    borderRadius: 8,
    marginBottom: 32,
    marginHorizontal: 16,
    paddingBottom: 16,
    paddingRight: 16,
    paddingTop: 16
  },
  iPhoneNotch: {
    backgroundColor: colors.black70,
    height: 44,
    position: 'absolute',
    top: 0,
    width: '100%',
    zIndex: 20
  },
  containerHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: device.iPhoneNotch ? 60 : 36,
    position: 'absolute',
    top: 0,
    width: '100%',
    zIndex: 10
  }
});

export default Home;
