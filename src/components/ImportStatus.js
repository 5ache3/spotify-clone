import * as React from 'react';
import PropTypes from 'prop-types';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, func, gStyle } from '../constants';

// components
import TouchText from './TouchText';

// context
import { useLibrary } from '../context/LibraryState';

const STATUS_LABEL = {
  downloading: 'Downloading…',
  failed: 'Failed',
  pending: 'Waiting'
};

// progress of a spotify import (section "panel"),
// or the songs that aren't downloaded yet (section "list")
function ImportStatus({ playlist, section = 'panel' }) {
  const {
    downloads,
    finishImport,
    importError,
    retryFailed,
    setImportError,
    setImportPaused
  } = useLibrary();
  const { paused, total, tracks, truncated } = playlist.import;

  const done = tracks.filter((t) => t.status === 'done').length;
  const failed = tracks.filter((t) => t.status === 'failed').length;
  const remaining = tracks.filter((t) => t.status !== 'done');
  const active = remaining.some(
    (t) => t.status === 'pending' || t.status === 'downloading'
  );

  if (remaining.length === 0 && !truncated) return null;

  if (section === 'list') {
    if (remaining.length === 0) return null;

    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Not downloaded yet</Text>
        {remaining.slice(0, 300).map((t) => (
          <View key={t.key} style={styles.row}>
            <View style={gStyle.flex1}>
              <Text ellipsizeMode="tail" numberOfLines={1} style={styles.title}>
                {t.title}
              </Text>
              <Text ellipsizeMode="tail" numberOfLines={1} style={styles.info}>
                {t.status === 'failed' && t.error
                  ? `${t.artist} · ${t.error}`
                  : t.artist}
              </Text>
            </View>
            {t.status === 'failed' ? (
              <Feather color="#ff6b6b" name="alert-circle" size={18} />
            ) : (
              <Text
                style={
                  t.status === 'downloading' ? styles.statusActive : styles.info
                }
              >
                {paused && t.status === 'pending'
                  ? 'Paused'
                  : STATUS_LABEL[t.status]}
              </Text>
            )}
          </View>
        ))}
      </View>
    );
  }

  let headline = `Importing from Spotify · ${done} of ${tracks.length}`;
  if (!active) headline = `Imported ${done} of ${tracks.length} songs`;
  else if (paused) headline = `Paused · ${done} of ${tracks.length} downloaded`;

  // progress of the song being downloaded right now
  const current = Object.values(downloads).find((d) => !d.error);
  const progress =
    tracks.length > 0
      ? (done + (active && !paused && current ? current.progress || 0 : 0)) /
        tracks.length
      : 0;

  return (
    <View style={styles.container}>
      <View style={styles.panel}>
        <Text style={styles.headline}>{headline}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        </View>

        {importError && active && (
          <Text style={styles.error}>{`Paused: ${importError}`}</Text>
        )}
        {failed > 0 && (
          <Text style={styles.info}>
            {`${func.plural(failed, 'song')} couldn't be downloaded.`}
          </Text>
        )}
        {truncated && (
          <Text style={styles.info}>
            {`This playlist has ${total} songs; only the first ${tracks.length} could be read.`}
          </Text>
        )}

        <View style={styles.actions}>
          {importError && active && (
            <TouchText
              onPress={() => setImportError(null)}
              style={styles.btn}
              styleText={styles.btnText}
              text="Retry"
            />
          )}
          {active && !importError && (
            <TouchText
              onPress={() => setImportPaused(playlist.id, !paused)}
              style={styles.btn}
              styleText={styles.btnText}
              text={paused ? 'Resume' : 'Pause'}
            />
          )}
          {failed > 0 && (
            <TouchText
              onPress={() => retryFailed(playlist.id)}
              style={styles.btn}
              styleText={styles.btnText}
              text="Retry failed"
            />
          )}
          {remaining.length > 0 && (
            <TouchText
              onPress={() => finishImport(playlist.id)}
              style={styles.btnOutline}
              styleText={styles.btnText}
              text={active ? 'Stop' : 'Dismiss'}
            />
          )}
        </View>
      </View>
    </View>
  );
}

ImportStatus.propTypes = {
  // required
  playlist: PropTypes.shape({
    id: PropTypes.string,
    import: PropTypes.object
  }).isRequired,

  // optional
  section: PropTypes.oneOf(['panel', 'list'])
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8
  },
  panel: {
    backgroundColor: colors.grey,
    borderRadius: 8,
    marginHorizontal: 16,
    padding: 16
  },
  headline: {
    ...gStyle.textSpotifyBold16,
    color: colors.white
  },
  track: {
    backgroundColor: colors.greyOff,
    borderRadius: 2,
    height: 4,
    marginVertical: 10
  },
  fill: {
    backgroundColor: colors.brandPrimary,
    borderRadius: 2,
    height: 4
  },
  error: {
    ...gStyle.textSpotify12,
    color: '#ff6b6b',
    marginBottom: 4
  },
  info: {
    ...gStyle.textSpotify12,
    color: colors.greyInactive
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  btn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: 16,
    height: 32,
    marginRight: 8,
    marginTop: 10,
    paddingHorizontal: 16
  },
  btnOutline: {
    borderColor: colors.greyInactive,
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    marginTop: 10,
    paddingHorizontal: 16
  },
  btnText: {
    ...gStyle.textSpotifyBold12,
    color: colors.white
  },
  heading: {
    ...gStyle.textSpotifyBold16,
    color: colors.white,
    marginLeft: 16,
    marginTop: 24
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    opacity: 0.6,
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  title: {
    ...gStyle.textSpotify14,
    color: colors.white,
    marginBottom: 2
  },
  statusActive: {
    ...gStyle.textSpotifyBold12,
    color: colors.brandPrimary
  }
});

export default ImportStatus;
