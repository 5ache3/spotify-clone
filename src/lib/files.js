import { Directory, File, Paths } from 'expo-file-system';

// songs store paths relative to the document directory, because the absolute
// app container path can change between installs/updates on iOS
// /////////////////////////////////////////////////////////////////////////////
const MUSIC_DIR = 'music';
const ARTWORK_DIR = 'artwork';

const ensureDir = (name) => {
  const dir = new Directory(Paths.document, name);
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }

  return dir;
};

export const musicPath = (fileName) => `${MUSIC_DIR}/${fileName}`;
export const artworkPath = (fileName) => `${ARTWORK_DIR}/${fileName}`;

export const fileFor = (relativePath) => new File(Paths.document, relativePath);

export const uriFor = (relativePath) =>
  relativePath ? fileFor(relativePath).uri : null;

export const deleteFile = (relativePath) => {
  if (!relativePath) return;

  try {
    const file = fileFor(relativePath);
    if (file.exists) file.delete();
  } catch (e) {
    // already gone
  }
};

export const fileSize = (relativePath) => {
  try {
    const file = fileFor(relativePath);

    return file.exists ? file.size || 0 : 0;
  } catch (e) {
    return 0;
  }
};

// download a remote file into the music/artwork folder
// /////////////////////////////////////////////////////////////////////////////
export const downloadTo = async (url, relativePath, onProgress) => {
  ensureDir(MUSIC_DIR);
  ensureDir(ARTWORK_DIR);

  const destination = fileFor(relativePath);
  if (destination.exists) destination.delete();

  await File.downloadFileAsync(url, destination, {
    idempotent: true,
    onProgress: ({ bytesWritten, totalBytes }) => {
      if (onProgress && totalBytes > 0) onProgress(bytesWritten / totalBytes);
    }
  });

  return relativePath;
};

// copy a picked local file (document picker cache uri) into the music folder
// /////////////////////////////////////////////////////////////////////////////
export const copyInto = async (sourceUri, relativePath) => {
  ensureDir(MUSIC_DIR);

  const destination = fileFor(relativePath);
  if (destination.exists) destination.delete();

  await new File(sourceUri).copy(destination);

  return relativePath;
};

export const extensionOf = (name, fallback = 'mp3') => {
  const match = /\.([a-z0-9]{2,5})(?:$|\?)/i.exec(name || '');

  return match ? match[1].toLowerCase() : fallback;
};
