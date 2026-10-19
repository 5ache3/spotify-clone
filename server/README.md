# Music companion server

A small local HTTP server the phone app talks to. It searches YouTube and turns a
YouTube (or any yt-dlp supported) URL into an m4a (AAC) audio file plus cover art,
which the app then downloads to the device. Built on Python's stdlib HTTP server
and the [yt-dlp](https://github.com/yt-dlp/yt-dlp) library; requires `ffmpeg`.

## Run

From the project root:

```sh
./server/run.sh            # port 8765 by default
./server/run.sh --port 9000   # or PORT=9000 ./server/run.sh
```

`run.sh` creates `server/.venv` if missing, installs `requirements.txt`, and starts
`server.py`. On startup it prints URLs like `http://192.168.1.23:8765`.

- The phone and this computer must be on the **same Wi-Fi network** (and the
  computer's firewall must allow the port).
- Paste the printed URL into the app's **Settings** screen.
- Downloaded files are cached in `server/downloads/`.

## Spotify playlists

The app can import a public Spotify playlist or album: the server reads its
track list, and the app finds each song on YouTube and downloads it into a new
playlist, one at a time.

Without setup, only the **first 100 tracks** can be read (from Spotify's public
embed page). To import longer playlists, create a free app at
<https://developer.spotify.com/dashboard> and start the server with its keys:

```sh
SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=yyy ./server/run.sh
```

Some Spotify-made playlists (e.g. "Today's Top Hits") aren't available through
the API; for those the server falls back to the first 100 tracks.

## Keep yt-dlp updated

YouTube changes often and old yt-dlp versions stop working. If search or
downloads start failing, update it:

```sh
server/.venv/bin/pip install -U yt-dlp
```

## API

- `GET /api/health`
- `GET /api/search?q=...&limit=15`
- `POST /api/jobs` `{"url": "..."}` -> `{"id": "..."}`
- `GET /api/jobs/<id>` (status, progress, song)
- `GET /api/jobs/<id>/audio` (audio/mp4, supports Range)
- `GET /api/jobs/<id>/artwork` (image/jpeg)
- `GET /api/spotify?url=<playlist or album link>` (name, cover, total, tracks)
- `GET /api/match?title=&artist=&duration=` (best YouTube result or null)

Only download content you have the right to download.
