import * as React from 'react';
import PropTypes from 'prop-types';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { colors, gStyle } from '../constants';

// components
import SheetHeader from '../components/SheetHeader';
import TouchText from '../components/TouchText';

// context
import { useLibrary } from '../context/LibraryState';

// lib
import { isSpotifyUrl } from '../lib/server';

// paste a spotify playlist/album link -> new playlist that fills itself
function ModalImportSpotify({ navigation, route }) {
  const { importSpotify } = useLibrary();
  const [url, setUrl] = React.useState(route.params?.url || '');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const valid = isSpotifyUrl(url);

  const onImport = async () => {
    if (!valid || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await importSpotify(url);
      navigation.goBack();
      navigation.navigate('TabNavigation', {
        params: {
          initial: false,
          params: { playlistId: result.id },
          screen: 'Playlist'
        },
        screen: 'StackLibrary'
      });
      if (result.truncated) {
        Alert.alert(
          'First 100 songs only',
          `"${result.name}" has ${result.total} songs, but without Spotify API keys only the first ${result.count} can be read. See server/README.md to import all of them.`
        );
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={gStyle.container}>
      <SheetHeader
        left="Cancel"
        leftPress={() => navigation.goBack()}
        right={loading ? null : 'Import'}
        rightPress={onImport}
        title="Import from Spotify"
      />

      <View style={styles.container}>
        <Text style={styles.text}>
          In Spotify, open a playlist or album, tap Share → Copy link, and paste
          it here. It has to be public.
        </Text>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={!url}
          keyboardType="url"
          onChangeText={setUrl}
          onSubmitEditing={onImport}
          placeholder="https://open.spotify.com/playlist/..."
          placeholderTextColor={colors.greyInactive}
          returnKeyType="go"
          selectionColor={colors.brandPrimary}
          style={styles.input}
          value={url}
        />
        {url.length > 0 && !valid && (
          <Text style={styles.error}>
            That isn&apos;t a Spotify playlist or album link.
          </Text>
        )}
        {error && <Text style={styles.error}>{error}</Text>}

        {loading ? (
          <ActivityIndicator color={colors.brandPrimary} style={gStyle.mT3} />
        ) : (
          <TouchText
            onPress={onImport}
            style={[styles.btn, !valid && styles.btnDisabled]}
            styleText={styles.btnText}
            text="Import"
          />
        )}

        <Text style={[styles.text, gStyle.mT3]}>
          A new playlist is created right away. Each song is then found on
          YouTube and downloaded one by one, so you can start listening while
          the rest arrive. Keep the download server running on your computer
          until it&apos;s done.
        </Text>
      </View>
    </View>
  );
}

ModalImportSpotify.propTypes = {
  // required
  navigation: PropTypes.object.isRequired,
  route: PropTypes.object.isRequired
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 16
  },
  text: {
    ...gStyle.textSpotify14,
    color: colors.greyInactive,
    lineHeight: 20
  },
  input: {
    ...gStyle.textSpotify16,
    backgroundColor: colors.grey,
    borderRadius: 6,
    color: colors.white,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  error: {
    ...gStyle.textSpotify12,
    color: '#ff6b6b',
    marginTop: 8
  },
  btn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brandPrimary,
    borderRadius: 20,
    height: 40,
    marginTop: 16,
    paddingHorizontal: 28
  },
  btnDisabled: {
    opacity: 0.4
  },
  btnText: {
    ...gStyle.textSpotifyBold12,
    color: colors.white,
    letterSpacing: 1,
    textTransform: 'uppercase'
  }
});

export default ModalImportSpotify;
