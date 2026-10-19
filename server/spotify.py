"""Read the track list of a public Spotify playlist or album.

Without credentials this parses Spotify's public embed page (no login needed),
which lists at most 100 tracks. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET
(free app at https://developer.spotify.com/dashboard) to use the Web API
instead, which returns every track.
"""
import base64
import json
import os
import re
import time
import urllib.parse
import urllib.request

# a bare UA gets the server-rendered page, which includes the song count meta tag
UA = "Mozilla/5.0"
URL_RE = re.compile(
    r"(?:open\.spotify\.com/(?:intl-[a-z-]+/)?|spotify:)(playlist|album)[/:]([A-Za-z0-9]{22})")

_token = {"value": None, "expires": 0}


class SpotifyError(Exception):
    pass


def parse_url(url):
    """'https://open.spotify.com/playlist/<id>?si=..' -> ('playlist', '<id>')."""
    m = URL_RE.search(url or "")
    if not m:
        raise SpotifyError("That doesn't look like a Spotify playlist or album link")
    return m.group(1), m.group(2)


def _get(url, headers=None):
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read().decode("utf-8")


def _track(title, artists, duration_ms, spotify_id):
    return {
        "spotifyId": spotify_id,
        "title": (title or "").strip(),
        "artist": (artists or "").replace(" ", " ").strip(),
        "duration": round((duration_ms or 0) / 1000) or None,
    }


# ---------------------------------------------------------------- embed page

def _from_embed(kind, sid):
    try:
        html = _get(f"https://open.spotify.com/embed/{kind}/{sid}")
    except urllib.error.HTTPError as e:
        raise SpotifyError(
            "Spotify couldn't find that playlist. Is it public?" if e.code == 404
            else f"Spotify returned HTTP {e.code}")
    m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
                  html, re.S)
    if not m:
        raise SpotifyError("Couldn't read the Spotify page (its format may have changed)")
    try:
        entity = json.loads(m.group(1))["props"]["pageProps"]["state"]["data"]["entity"]
    except (KeyError, TypeError, ValueError):
        raise SpotifyError("Couldn't read the Spotify page (its format may have changed)")

    tracks = [
        _track(t.get("title"), t.get("subtitle"), t.get("duration"),
               (t.get("uri") or "").split(":")[-1])
        for t in entity.get("trackList") or []
        if t.get("title") and t.get("entityType", "track") == "track"
    ]
    sources = (entity.get("coverArt") or {}).get("sources") or []
    cover = max(sources, key=lambda s: s.get("width") or 0).get("url") if sources else None

    # the embed stops at 100 tracks; the full page says how many there are
    total = len(tracks)
    try:
        page = _get(f"https://open.spotify.com/{kind}/{sid}")
        count = re.search(r'<meta name="music:song_count" content="(\d+)"', page)
        if count:
            total = max(total, int(count.group(1)))
    except Exception:
        pass

    return {
        "id": sid,
        "kind": kind,
        "name": entity.get("name") or entity.get("title") or "Spotify import",
        "owner": entity.get("subtitle") or "",
        "cover": cover,
        "total": total,
        "truncated": total > len(tracks),
        "tracks": tracks,
    }


# ---------------------------------------------------------------- web api

def _api_token():
    cid = os.environ.get("SPOTIFY_CLIENT_ID")
    secret = os.environ.get("SPOTIFY_CLIENT_SECRET")
    if not (cid and secret):
        return None
    if _token["value"] and _token["expires"] > time.time() + 60:
        return _token["value"]
    auth = base64.b64encode(f"{cid}:{secret}".encode()).decode()
    req = urllib.request.Request(
        "https://accounts.spotify.com/api/token",
        data=b"grant_type=client_credentials",
        headers={"Authorization": f"Basic {auth}",
                 "Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read())
    _token.update(value=data["access_token"], expires=time.time() + data["expires_in"])
    return _token["value"]


def _from_api(kind, sid, token):
    auth = {"Authorization": f"Bearer {token}"}
    meta = json.loads(_get(f"https://api.spotify.com/v1/{kind}s/{sid}", auth))
    url = (f"https://api.spotify.com/v1/{kind}s/{sid}/tracks?limit=100"
           if kind == "album" else
           f"https://api.spotify.com/v1/playlists/{sid}/tracks?limit=100"
           "&fields=next,items(track(id,name,duration_ms,type,artists(name)))")
    tracks = []
    while url:
        page = json.loads(_get(url, auth))
        for item in page.get("items") or []:
            t = item.get("track", item) if kind == "playlist" else item
            if not t or t.get("type", "track") != "track" or not t.get("name"):
                continue
            artists = ", ".join(a["name"] for a in t.get("artists") or [])
            tracks.append(_track(t["name"], artists, t.get("duration_ms"), t.get("id")))
        url = page.get("next")
    images = meta.get("images") or []
    owner = (meta.get("owner") or {}).get("display_name") or ", ".join(
        a["name"] for a in meta.get("artists") or [])
    return {
        "id": sid,
        "kind": kind,
        "name": meta.get("name") or "Spotify import",
        "owner": owner,
        "cover": images[0]["url"] if images else None,
        "total": len(tracks),
        "truncated": False,
        "tracks": tracks,
    }


def fetch(url):
    kind, sid = parse_url(url)
    token = None
    try:
        token = _api_token()
    except Exception:
        token = None  # bad credentials: fall back to the embed page
    if token:
        try:
            return _from_api(kind, sid, token)
        except Exception:
            pass  # e.g. Spotify-owned playlists the API refuses: try the embed
    return _from_embed(kind, sid)
