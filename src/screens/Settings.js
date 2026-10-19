import * as React from 'react';
import PropTypes from 'prop-types';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, gStyle } from '../constants';

// components
import SheetHeader from '../components/SheetHeader';
import TouchText from '../components/TouchText';

// context
import { useLibrary } from '../context/LibraryState';

// lib
import {
  canDownloadOnPhone,
  initPhone,
  MODE_PHONE,
  MODE_SERVER,
  phoneDownloaderVersion,
  updatePhoneDownloader
} from '../lib/downloader';
import { fileSize } from '../lib/files';
import {
  checkHealth,
  defaultServerUrl,
  normalizeServerUrl,
  SERVER_PORT
} from '../lib/server';

function Settings({ navigation }) {
  const {
    downloadMode,
    playlists,
    serverUrl,
    setDownloadMode,
    setServerUrl,
    songList
  } = useLibrary();
  const [value, setValue] = React.useState(serverUrl);
  const [checking, setChecking] = React.useState(false);
  const [result, setResult] = React.useState(null);

  // yt-dlp on the phone
  const [phoneVersion, setPhoneVersion] = React.useState(
    phoneDownloaderVersion()
  );
  const [updating, setUpdating] = React.useState(false);
  const [updateResult, setUpdateResult] = React.useState(null);

  React.useEffect(() => {
    if (!canDownloadOnPhone) return;
    initPhone()
      .then(() => setPhoneVersion(phoneDownloaderVersion()))
      .catch((e) => setUpdateResult({ ok: false, text: e.message }));
  }, []);

  const onUpdatePhone = async () => {
    setUpdating(true);
    setUpdateResult(null);
    try {
      const { status, version } = await updatePhoneDownloader();
      setPhoneVersion(version);
      setUpdateResult({
        ok: true,
        text:
          status === 'DONE'
            ? `Updated to ${version}`
            : `Already up to date (${version})`
      });
    } catch (e) {
      setUpdateResult({ ok: false, text: e.message });
    } finally {
      setUpdating(false);
    }
  };

  const modeOption = (mode, title, subtitle) => (
    <TouchableOpacity
      activeOpacity={gStyle.activeOpacity}
      onPress={() => setDownloadMode(mode)}
      style={styles.option}
    >
      <Feather
        color={
          downloadMode === mode ? colors.brandPrimary : colors.greyInactive
        }
        name={downloadMode === mode ? 'check-circle' : 'circle'}
        size={22}
      />
      <View style={styles.optionText}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.text}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );

  const storageMb = React.useMemo(
    () =>
      songList.reduce(
        (sum, s) => sum + fileSize(s.file) + fileSize(s.artwork),
        0
      ) /
      (1024 * 1024),
    [songList]
  );

  const onTest = async (url = value) => {
    const saved = await setServerUrl(url);
    setValue(saved);
    setChecking(true);
    setResult(null);
    try {
      const health = await checkHealth(normalizeServerUrl(saved));
      setResult({ ok: true, text: `Connected · yt-dlp ${health.version}` });
    } catch (e) {
      setResult({ ok: false, text: e.message });
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={gStyle.container}>
      <SheetHeader
        right="Done"
        rightPress={async () => {
          await setServerUrl(value);
          navigation.goBack();
        }}
        title="Settings"
      />

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {canDownloadOnPhone && (
          <React.Fragment>
            <Text style={styles.heading}>Download music with</Text>
            {modeOption(
              MODE_PHONE,
              'This phone',
              'No computer needed. Uses mobile data or Wi-Fi.'
            )}
            {modeOption(
              MODE_SERVER,
              'Computer server',
              'Faster conversion; your computer has to be on.'
            )}

            <Text style={styles.heading}>Downloader on this phone</Text>
            <Text style={styles.text}>
              {`yt-dlp ${
                phoneVersion || '(starting…)'
              } · updates itself daily. If YouTube downloads start failing, update it now.`}
            </Text>
            {updating ? (
              <ActivityIndicator
                color={colors.brandPrimary}
                style={gStyle.mT2}
              />
            ) : (
              <TouchText
                onPress={onUpdatePhone}
                style={styles.btnOutline}
                styleText={styles.btnText}
                text="Update yt-dlp"
              />
            )}
            {updateResult && (
              <Text
                style={[
                  styles.result,
                  updateResult.ok ? styles.ok : styles.fail
                ]}
              >
                {updateResult.text}
              </Text>
            )}
          </React.Fragment>
        )}

        <Text style={styles.heading}>
          {canDownloadOnPhone ? 'Computer server' : 'Download server'}
        </Text>
        <Text style={styles.text}>
          {`${
            canDownloadOnPhone
              ? 'Only used when "Computer server" is selected above. '
              : ''
          }YouTube search and downloads go through a small server running on your computer. Start it with ./server/run.sh, keep your phone on the same Wi-Fi, and enter the address it prints (port ${SERVER_PORT}).`}
        </Text>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onChangeText={setValue}
          onSubmitEditing={() => onTest()}
          placeholder={`http://192.168.1.10:${SERVER_PORT}`}
          placeholderTextColor={colors.greyInactive}
          selectionColor={colors.brandPrimary}
          style={styles.input}
          value={value}
        />

        <View style={gStyle.flexRowCenterAlign}>
          <TouchText
            onPress={() => onTest()}
            style={styles.btn}
            styleText={styles.btnText}
            text="Save & test"
          />
          {defaultServerUrl() ? (
            <TouchText
              onPress={() => onTest(defaultServerUrl())}
              style={styles.btnOutline}
              styleText={styles.btnText}
              text="Use auto-detected"
            />
          ) : null}
        </View>

        {checking && (
          <ActivityIndicator color={colors.brandPrimary} style={gStyle.mT2} />
        )}
        {result && (
          <Text style={[styles.result, result.ok ? styles.ok : styles.fail]}>
            {result.text}
          </Text>
        )}

        <Text style={styles.heading}>Other ways to add music</Text>
        <Text style={styles.text}>
          Paste a direct link to an .mp3/.m4a file in Search to download it
          without the server, or use &quot;Import from phone&quot; to add audio
          files already on this device.
        </Text>

        <Text style={styles.heading}>Storage</Text>
        <Text style={styles.text}>
          {`${songList.length} songs · ${
            playlists.length
          } playlists · ${storageMb.toFixed(1)} MB on this phone`}
        </Text>
      </ScrollView>
    </View>
  );
}

Settings.propTypes = {
  // required
  navigation: PropTypes.object.isRequired
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 48,
    paddingHorizontal: 24
  },
  option: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 8
  },
  optionText: {
    flex: 1,
    marginLeft: 12
  },
  optionTitle: {
    ...gStyle.textSpotify16,
    color: colors.white,
    marginBottom: 2
  },
  heading: {
    ...gStyle.textSpotifyBold18,
    color: colors.white,
    marginBottom: 8,
    marginTop: 24
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
  btn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: 20,
    height: 36,
    marginRight: 12,
    marginTop: 12,
    paddingHorizontal: 20
  },
  btnOutline: {
    borderColor: colors.greyInactive,
    borderRadius: 20,
    borderWidth: 1,
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
  result: {
    ...gStyle.textSpotify14,
    marginTop: 12
  },
  ok: {
    color: colors.brandPrimary
  },
  fail: {
    color: '#ff6b6b'
  }
});

export default Settings;
