import * as React from 'react';
import PropTypes from 'prop-types';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, device, func, gStyle } from '../constants';

// components
import PlaylistItem from '../components/PlaylistItem';
import SongRow from '../components/SongRow';
import TouchText from '../components/TouchText';

// icons
import SvgSearch from '../icons/Svg.Search';

// mock data
import browseAll from '../mockdata/searchBrowseAll.json';
import topGenres from '../mockdata/searchTopGenres.json';

// context
import { ALL_SONGS, useLibrary } from '../context/LibraryState';
import { usePlayer } from '../context/PlayerState';

// lib
import { isSpotifyUrl, isUrl } from '../lib/server';

function ProgressBar({ progress }) {
  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          { width: `${Math.round(progress * 100)}%` }
        ]}
      />
    </View>
  );
}

ProgressBar.propTypes = {
  // required
  progress: PropTypes.number.isRequired
};

// "Search" tab: find music in your library, on YouTube, or add it by link/file
function Search({ navigation, route }) {
  const {
    clearDownload,
    downloadFromLink,
    downloads,
    findBySource,
    importFromDevice,
    downloader,
    songList
  } = useLibrary();
  const { playSongs } = usePlayer();

  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState([]);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState(null);
  const lastSearch = React.useRef('');

  const text = query.trim();
  const textIsUrl = isUrl(text);

  const runSearch = React.useCallback(
    async (value) => {
      const q = value.trim();
      if (!q || isUrl(q) || q === lastSearch.current) return;
      lastSearch.current = q;

      setSearching(true);
      setSearchError(null);
      try {
        const found = await downloader.search(q);
        if (lastSearch.current === q) setResults(found);
      } catch (e) {
        if (lastSearch.current === q) setSearchError(e.message);
      } finally {
        if (lastSearch.current === q) setSearching(false);
      }
    },
    [downloader]
  );

  // search as you type (debounced)
  React.useEffect(() => {
    if (!text || textIsUrl) {
      lastSearch.current = '';
      setResults([]);
      setSearchError(null);
      setSearching(false);

      return undefined;
    }
    const timer = setTimeout(() => runSearch(text), 700);

    return () => clearTimeout(timer);
  }, [runSearch, text, textIsUrl]);

  // opened with a query, e.g. from an album track
  React.useEffect(() => {
    if (route.params?.query) {
      setQuery(route.params.query);
      navigation.setParams({ query: undefined });
    }
  }, [navigation, route.params?.query]);

  const download = async (url, hint = null) => {
    Keyboard.dismiss();
    try {
      const song = await downloadFromLink(url, hint);
      if (song && url === text) setQuery('');
    } catch (e) {
      // shown in the downloads list
    }
  };

  const onImport = async () => {
    try {
      const imported = await importFromDevice();
      if (imported.length > 0) {
        Alert.alert(
          'Imported',
          `${imported.length} song${
            imported.length === 1 ? '' : 's'
          } added to your library.`
        );
      }
    } catch (e) {
      Alert.alert('Import failed', e.message);
    }
  };

  const q = text.toLowerCase();
  const localMatches =
    text && !textIsUrl
      ? songList.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.artist.toLowerCase().includes(q)
        )
      : [];
  const activeDownloads = Object.entries(downloads);

  const renderResult = (item) => {
    const saved = findBySource(item.id);
    const job = downloads[item.id];

    let right = (
      <TouchableOpacity
        hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
        onPress={() => download(item.url, item)}
      >
        <Feather color={colors.white} name="download" size={22} />
      </TouchableOpacity>
    );
    if (saved) {
      right = (
        <Feather color={colors.brandPrimary} name="check-circle" size={22} />
      );
    } else if (job && !job.error) {
      right = (
        <Text style={styles.percent}>
          {`${Math.round((job.progress || 0) * 100)}%`}
        </Text>
      );
    }

    return (
      <TouchableOpacity
        activeOpacity={gStyle.activeOpacity}
        key={item.id}
        onPress={() =>
          saved
            ? playSongs([saved.id], saved.id, { name: 'Search' })
            : download(item.url, item)
        }
        style={styles.result}
      >
        {item.thumbnail ? (
          <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} />
        ) : (
          <View style={styles.thumbnail} />
        )}
        <View style={styles.resultText}>
          <Text
            ellipsizeMode="tail"
            numberOfLines={2}
            style={styles.resultTitle}
          >
            {item.title}
          </Text>
          <Text
            ellipsizeMode="tail"
            numberOfLines={1}
            style={styles.resultInfo}
          >
            {item.duration
              ? `${item.artist} · ${func.formatTime(item.duration)}`
              : item.artist}
          </Text>
        </View>
        <View style={styles.resultRight}>{right}</View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={gStyle.container}>
      <View style={styles.containerSearchBar}>
        <View style={styles.searchBox}>
          <View style={gStyle.mR1}>
            <SvgSearch />
          </View>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            onChangeText={setQuery}
            onSubmitEditing={() => {
              lastSearch.current = '';
              runSearch(text);
            }}
            placeholder="Search songs or paste a YouTube link"
            placeholderTextColor={colors.greyOff}
            returnKeyType="search"
            selectionColor={colors.brandPrimary}
            style={styles.searchInput}
            value={query}
          />
          {query.length > 0 && (
            <TouchableOpacity
              hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
              onPress={() => setQuery('')}
              style={gStyle.mR1}
            >
              <Feather color={colors.blackBg} name="x" size={18} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={gStyle.pB3}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* add music */}
        {textIsUrl && isSpotifyUrl(text) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Import Spotify playlist</Text>
            <Text style={styles.cardText}>
              Creates a playlist and downloads its songs one by one.
            </Text>
            <TouchText
              onPress={() => {
                navigation.navigate('ModalImportSpotify', { url: text });
                setQuery('');
              }}
              style={styles.btn}
              styleText={styles.btnText}
              text="Import"
            />
          </View>
        )}
        {textIsUrl && !isSpotifyUrl(text) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Download from link</Text>
            <Text
              ellipsizeMode="middle"
              numberOfLines={1}
              style={styles.cardText}
            >
              {text}
            </Text>
            <TouchText
              onPress={() => download(text)}
              style={styles.btn}
              styleText={styles.btnText}
              text="Download"
            />
          </View>
        )}
        {!textIsUrl && (
          <View style={styles.containerQuick}>
            <TouchableOpacity
              activeOpacity={gStyle.activeOpacity}
              onPress={onImport}
              style={styles.quick}
            >
              <Feather color={colors.white} name="smartphone" size={18} />
              <Text style={styles.quickText}>Import from phone</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={gStyle.activeOpacity}
              onPress={() => navigation.navigate('ModalImportSpotify')}
              style={styles.quick}
            >
              <Feather color={colors.white} name="link" size={18} />
              <Text style={styles.quickText}>Spotify playlist</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={gStyle.activeOpacity}
              onPress={() => navigation.navigate('Settings')}
              style={styles.quick}
            >
              <Feather color={colors.white} name="settings" size={18} />
              <Text style={styles.quickText}>Settings</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* downloads in progress / failed */}
        {activeDownloads.length > 0 && (
          <View>
            <Text style={styles.sectionHeading}>Downloads</Text>
            {activeDownloads.map(([key, job]) => (
              <View key={key} style={styles.download}>
                <View style={gStyle.flex1}>
                  <Text
                    ellipsizeMode="tail"
                    numberOfLines={1}
                    style={styles.resultTitle}
                  >
                    {job.title}
                  </Text>
                  {job.error ? (
                    <Text numberOfLines={3} style={styles.error}>
                      {job.error}
                    </Text>
                  ) : (
                    <React.Fragment>
                      <Text style={styles.resultInfo}>{job.status}</Text>
                      <ProgressBar progress={job.progress || 0} />
                    </React.Fragment>
                  )}
                </View>
                {job.error ? (
                  <TouchableOpacity
                    hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
                    onPress={() => clearDownload(key)}
                    style={gStyle.mL2}
                  >
                    <Feather color={colors.greyInactive} name="x" size={20} />
                  </TouchableOpacity>
                ) : (
                  <ActivityIndicator
                    color={colors.brandPrimary}
                    style={gStyle.mL2}
                  />
                )}
              </View>
            ))}
          </View>
        )}

        {/* in your library */}
        {localMatches.length > 0 && (
          <View>
            <Text style={styles.sectionHeading}>In your library</Text>
            {localMatches.slice(0, 5).map((song) => (
              <SongRow
                key={song.id}
                onMore={() =>
                  navigation.navigate('ModalSongOptions', { songId: song.id })
                }
                onPress={() =>
                  playSongs(
                    localMatches.map((s) => s.id),
                    song.id,
                    { name: 'Search' }
                  )
                }
                song={song}
              />
            ))}
          </View>
        )}

        {/* youtube */}
        {text && !textIsUrl ? (
          <View>
            <Text style={styles.sectionHeading}>From YouTube</Text>
            {searching && (
              <ActivityIndicator
                color={colors.brandPrimary}
                style={gStyle.mV3}
              />
            )}
            {searchError && (
              <View style={styles.card}>
                <Text style={styles.error}>{searchError}</Text>
                <TouchText
                  onPress={() => navigation.navigate('Settings')}
                  style={styles.btn}
                  styleText={styles.btnText}
                  text="Settings"
                />
              </View>
            )}
            {!searching && results.map(renderResult)}
          </View>
        ) : null}

        {/* browse (empty search) */}
        {!text && (
          <React.Fragment>
            {songList.length > 0 && (
              <TouchableOpacity
                activeOpacity={gStyle.activeOpacity}
                onPress={() =>
                  navigation.navigate('StackLibrary', {
                    initial: false,
                    params: { playlistId: ALL_SONGS },
                    screen: 'Playlist'
                  })
                }
                style={styles.containerQuick}
              >
                <Text style={styles.cardText}>
                  {`${songList.length} songs downloaded · view all`}
                </Text>
              </TouchableOpacity>
            )}
            <Text style={styles.sectionHeading}>Your top genres</Text>
            <View style={styles.containerRow}>
              {topGenres.map((item) => (
                <View key={item.id} style={styles.containerColumn}>
                  <PlaylistItem
                    bgColor={item.color}
                    onPress={() => setQuery(`${item.title} songs`)}
                    title={item.title}
                  />
                </View>
              ))}
            </View>

            <Text style={styles.sectionHeading}>Browse all</Text>
            <View style={styles.containerRow}>
              {browseAll.map((item) => (
                <View key={item.id} style={styles.containerColumn}>
                  <PlaylistItem
                    bgColor={item.color}
                    onPress={() => setQuery(`${item.title} music`)}
                    title={item.title}
                  />
                </View>
              ))}
            </View>
          </React.Fragment>
        )}
      </ScrollView>
    </View>
  );
}

Search.propTypes = {
  // required
  navigation: PropTypes.object.isRequired,
  route: PropTypes.object.isRequired
};

const styles = StyleSheet.create({
  containerSearchBar: {
    ...gStyle.pH3,
    backgroundColor: colors.blackBg,
    paddingBottom: 16,
    paddingTop: device.iPhoneNotch ? 64 : 40
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 6,
    flexDirection: 'row',
    paddingLeft: 16
  },
  searchInput: {
    ...gStyle.textSpotify16,
    color: colors.blackBg,
    flex: 1,
    paddingVertical: 14
  },
  containerQuick: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 4
  },
  quick: {
    alignItems: 'center',
    backgroundColor: colors.grey,
    borderRadius: 20,
    flexDirection: 'row',
    marginRight: 8,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  quickText: {
    ...gStyle.textSpotifyBold12,
    color: colors.white,
    marginLeft: 8
  },
  card: {
    backgroundColor: colors.grey,
    borderRadius: 8,
    marginHorizontal: 24,
    marginVertical: 8,
    padding: 16
  },
  cardTitle: {
    ...gStyle.textSpotifyBold16,
    color: colors.white,
    marginBottom: 4
  },
  cardText: {
    ...gStyle.textSpotify12,
    color: colors.greyInactive
  },
  btn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brandPrimary,
    borderRadius: 20,
    height: 36,
    marginTop: 12,
    paddingHorizontal: 20
  },
  btnText: {
    ...gStyle.textSpotifyBold12,
    color: colors.white,
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  error: {
    ...gStyle.textSpotify12,
    color: '#ff6b6b'
  },
  sectionHeading: {
    ...gStyle.textSpotifyBold18,
    color: colors.white,
    marginBottom: 12,
    marginLeft: 24,
    marginTop: 20
  },
  download: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 8
  },
  progressTrack: {
    backgroundColor: colors.greyOff,
    borderRadius: 2,
    height: 4,
    marginTop: 6
  },
  progressFill: {
    backgroundColor: colors.brandPrimary,
    borderRadius: 2,
    height: 4
  },
  result: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  thumbnail: {
    backgroundColor: colors.greyOff,
    borderRadius: 4,
    height: 54,
    width: 96
  },
  resultText: {
    flex: 1,
    marginLeft: 12
  },
  resultTitle: {
    ...gStyle.textSpotify14,
    color: colors.white,
    marginBottom: 4
  },
  resultInfo: {
    ...gStyle.textSpotify12,
    color: colors.greyInactive
  },
  resultRight: {
    alignItems: 'flex-end',
    marginLeft: 12,
    width: 40
  },
  percent: {
    ...gStyle.textSpotifyBold12,
    color: colors.brandPrimary
  },
  containerRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: 24
  },
  containerColumn: {
    width: '50%'
  }
});

export default Search;
