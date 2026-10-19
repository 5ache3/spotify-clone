#!/usr/bin/env python3
"""Companion server for the music app.

Searches YouTube and turns a URL into an m4a (AAC) file plus a jpg cover that
the phone downloads. Stdlib HTTP server + the yt_dlp library; needs ffmpeg.
"""
import argparse
import json
import os
import re
import socket
import subprocess
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import yt_dlp
from yt_dlp.version import __version__ as YTDLP_VERSION

import spotify

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOWNLOADS = os.path.join(BASE_DIR, "downloads")
DEFAULT_PORT = 8765

jobs = {}  # job id -> job dict
jobs_lock = threading.Lock()


# ---------------------------------------------------------------- helpers

def strip_topic(name):
    """'Rick Astley - Topic' -> 'Rick Astley'."""
    name = (name or "").strip()
    return name[: -len(" - Topic")].strip() if name.endswith(" - Topic") else name


# "(Official Video)", "[Lyrics]", "(HD)" ... removed from titles we split ourselves
NOISE_RE = re.compile(
    r"\s*[(\[][^)\]]*(official|lyrics?|video|audio|visualizer|hd|4k|remaster(ed)?)[^)\]]*[)\]]",
    re.IGNORECASE,
)


def song_meta(info):
    """Pick title/artist for a yt-dlp info dict."""
    if info.get("track"):
        title = info["track"]
        artist = info.get("artist") or info.get("creator") or strip_topic(
            info.get("uploader") or info.get("channel"))
    else:
        title = info.get("title") or info.get("id") or "Unknown"
        artist = strip_topic(info.get("uploader") or info.get("channel"))
        # "Artist - Song" style titles
        if " - " in title:
            left, right = title.split(" - ", 1)
            if left.strip() and right.strip():
                artist, title = left.strip(), NOISE_RE.sub("", right).strip() or right.strip()
    return title, artist or "Unknown artist"


def ffprobe_duration(path):
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", path],
            capture_output=True, text=True, timeout=15).stdout.strip()
        return int(round(float(out)))
    except Exception:
        return 0


def clean_error(err):
    msg = re.sub(r"\x1b\[[0-9;]*m", "", str(err))
    return re.sub(r"^ERROR:\s*", "", msg).strip() or "Unknown error"


def lan_ips():
    """Best-effort list of this machine's LAN IPv4 addresses."""
    ips = []
    try:  # UDP "connect" sends nothing but picks the outgoing interface
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ips.append(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if not ip.startswith("127.") and ip not in ips:
                ips.append(ip)
    except OSError:
        pass
    return ips


# ---------------------------------------------------------------- search

def search(query, limit):
    opts = {"quiet": True, "no_warnings": True, "no_color": True,
            "extract_flat": "in_playlist", "skip_download": True}
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(f"ytsearch{limit}:{query}", download=False)
    results = []
    for e in info.get("entries") or []:
        vid = e.get("id")
        if not vid:
            continue
        thumbs = e.get("thumbnails") or []
        thumb = e.get("thumbnail") or (thumbs[-1].get("url") if thumbs else None)
        dur = e.get("duration")
        results.append({
            "id": vid,
            "url": f"https://www.youtube.com/watch?v={vid}",
            "title": e.get("title") or vid,
            "artist": strip_topic(e.get("channel") or e.get("uploader")),
            "duration": int(dur) if dur else None,
            "thumbnail": thumb or f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
        })
    return results


# words that mean "not the studio recording", unless the real title has them too
ALT_VERSION_WORDS = ["live", "cover", "karaoke", "instrumental", "remix", "sped up",
                     "slowed", "8d", "reverb", "nightcore", "1 hour", "acapella",
                     "reaction", "tutorial", "lesson", "mashup", "extended"]


def norm(text):
    return re.sub(r"[^a-z0-9 ]+", " ", (text or "").lower()).strip()


def match(title, artist, duration):
    """Best YouTube result for a known track (e.g. from Spotify), or None."""
    main_artist = (artist or "").split(",")[0].strip()
    results = search(f"{main_artist} - {title}", 8)
    want_title, want_artist = norm(title), norm(main_artist)
    # "Song (feat. X) - Remastered 2011" -> "song"
    core_title = norm(re.split(r"\s[-(\[]", title or "")[0]) or want_title

    best, best_score = None, None
    for rank, r in enumerate(results):
        got_title, got_artist = norm(r["title"]), norm(r["artist"])
        score = -rank * 2
        if core_title and core_title in got_title:
            score += 20
        if want_artist and (want_artist in got_title or want_artist in got_artist):
            score += 12
        # the artist's own channel / auto-generated "Topic" upload, or official audio
        if want_artist and (got_artist == want_artist or got_artist.endswith("vevo")):
            score += 10
        if "official audio" in got_title or "audio" in got_title.split():
            score += 4
        if "lyric" in got_title and "lyric" not in want_title:
            score -= 3
        if duration and r["duration"]:
            diff = abs(r["duration"] - duration)
            score += 12 if diff <= 3 else -min(diff, 90) / 2
        elif not r["duration"]:
            score -= 10  # live streams / unknown
        for word in ALT_VERSION_WORDS:
            if re.search(rf"\b{word}\b", got_title) and not re.search(rf"\b{word}\b", want_title):
                score -= 25
        if best_score is None or score > best_score:
            best, best_score = r, score
    # nothing even resembling the song
    if best is None or best_score < 0:
        return None
    return best


# ---------------------------------------------------------------- jobs

def update_job(job_id, **fields):
    with jobs_lock:
        jobs[job_id].update(fields)


def run_job(job_id, url):
    """Background worker: extract info, download + convert, fill in the song."""
    def on_progress(d):
        if d["status"] == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate")
            frac = (d.get("downloaded_bytes") or 0) / total if total else 0.0
            update_job(job_id, status="downloading", progress=round(min(frac, 1.0) * 0.9, 3))
        elif d["status"] == "finished":
            update_job(job_id, status="converting", progress=0.9)

    def on_postprocess(d):
        # ignore the thumbnail converter, which runs before the download
        if d["status"] == "started" and d.get("postprocessor") == "ExtractAudio":
            update_job(job_id, status="converting", progress=0.9)

    opts = {
        "quiet": True, "no_warnings": True, "no_color": True, "noplaylist": True,
        "format": "bestaudio[ext=m4a]/bestaudio/best",
        "outtmpl": os.path.join(DOWNLOADS, "%(id)s.%(ext)s"),
        "writethumbnail": True,
        "progress_hooks": [on_progress],
        "postprocessor_hooks": [on_postprocess],
        "postprocessors": [
            {"key": "FFmpegExtractAudio", "preferredcodec": "m4a"},
            {"key": "FFmpegThumbnailsConvertor", "format": "jpg", "when": "before_dl"},
        ],
    }
    try:
        update_job(job_id, status="downloading")
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if info.get("_type") == "playlist":  # e.g. a bare playlist URL
                entries = [e for e in info.get("entries") or [] if e]
                if not entries:
                    raise ValueError("No playable video found at that URL")
                info = entries[0]
            vid = info["id"]
            audio = os.path.join(DOWNLOADS, f"{vid}.m4a")
            if not os.path.exists(audio):  # cache hit skips the download
                ydl.process_ie_result(info, download=True)
        if not os.path.exists(audio):
            raise RuntimeError("Download finished but no audio file was produced")

        art = os.path.join(DOWNLOADS, f"{vid}.jpg")
        title, artist = song_meta(info)
        dur = info.get("duration")
        song = {
            "sourceId": vid,
            "title": title,
            "artist": artist,
            "duration": int(dur) if dur else ffprobe_duration(audio),
            "thumbnail": info.get("thumbnail"),
            "audioPath": f"/api/jobs/{job_id}/audio",
            "artworkPath": f"/api/jobs/{job_id}/artwork" if os.path.exists(art) else None,
        }
        update_job(job_id, status="done", progress=1.0, song=song,
                   _audio=audio, _art=art if os.path.exists(art) else None)
    except Exception as e:  # yt-dlp DownloadError and anything else
        update_job(job_id, status="error", error=clean_error(e))


def create_job(url):
    job_id = uuid.uuid4().hex[:12]
    with jobs_lock:
        jobs[job_id] = {"id": job_id, "status": "queued", "progress": 0.0,
                        "error": None, "song": None, "_audio": None, "_art": None}
    threading.Thread(target=run_job, args=(job_id, url), daemon=True).start()
    return job_id


def public_job(job):
    return {k: v for k, v in job.items() if not k.startswith("_")}


# ---------------------------------------------------------------- HTTP

JOB_RE = re.compile(r"^/api/jobs/([0-9a-f]+)(/audio|/artwork)?/?$")


class Handler(BaseHTTPRequestHandler):
    server_version = "MusicCompanion/1.0"

    def log_message(self, fmt, *args):
        print(f"[{self.address_string()}] {fmt % args}", flush=True)

    def send_json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def error(self, status, message):
        self.send_json(status, {"error": message})

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Range")
        self.send_header("Access-Control-Max-Age", "86400")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path, qs = parsed.path, parse_qs(parsed.query)
        try:
            if path in ("/api/health", "/api/health/"):
                return self.send_json(200, {"ok": True, "version": YTDLP_VERSION})
            if path in ("/api/search", "/api/search/"):
                q = (qs.get("q") or [""])[0].strip()
                if not q:
                    return self.error(400, "Missing query parameter 'q'")
                try:
                    limit = max(1, min(int((qs.get("limit") or ["15"])[0]), 30))
                except ValueError:
                    return self.error(400, "'limit' must be an integer")
                try:
                    return self.send_json(200, {"results": search(q, limit)})
                except Exception as e:
                    return self.error(502, f"Search failed: {clean_error(e)}")
            if path.rstrip("/") == "/api/spotify":
                url = (qs.get("url") or [""])[0].strip()
                if not url:
                    return self.error(400, "Missing query parameter 'url'")
                try:
                    return self.send_json(200, spotify.fetch(url))
                except spotify.SpotifyError as e:
                    return self.error(400, str(e))
                except Exception as e:
                    return self.error(502, f"Couldn't load from Spotify: {clean_error(e)}")
            if path.rstrip("/") == "/api/match":
                title = (qs.get("title") or [""])[0].strip()
                artist = (qs.get("artist") or [""])[0].strip()
                if not title:
                    return self.error(400, "Missing query parameter 'title'")
                try:
                    duration = int(float((qs.get("duration") or ["0"])[0])) or None
                except ValueError:
                    duration = None
                try:
                    return self.send_json(200, {"result": match(title, artist, duration)})
                except Exception as e:
                    return self.error(502, f"Search failed: {clean_error(e)}")
            m = JOB_RE.match(path)
            if m:
                with jobs_lock:
                    job = dict(jobs[m.group(1)]) if m.group(1) in jobs else None
                if job is None:
                    return self.error(404, "Job not found")
                if not m.group(2):
                    return self.send_json(200, public_job(job))
                if job["status"] != "done":
                    return self.error(409, f"Job is not done (status: {job['status']})")
                if m.group(2) == "/audio":
                    return self.send_file(job["_audio"], "audio/mp4")
                if not job["_art"]:
                    return self.error(404, "No artwork for this job")
                return self.send_file(job["_art"], "image/jpeg")
            self.error(404, "Not found")
        except (BrokenPipeError, ConnectionResetError):
            pass  # client went away mid-response

    def do_POST(self):
        if urlparse(self.path).path.rstrip("/") != "/api/jobs":
            return self.error(404, "Not found")
        try:
            length = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            return self.error(400, "Body must be JSON")
        url = body.get("url") if isinstance(body, dict) else None
        if not isinstance(url, str) or not url.strip():
            return self.error(400, "Missing 'url' in body")
        self.send_json(202, {"id": create_job(url.strip())})

    def send_file(self, path, ctype):
        """Serve a file, honouring a single 'Range: bytes=a-b' header."""
        if not path or not os.path.exists(path):
            return self.error(404, "File no longer exists")
        size = os.path.getsize(path)
        start, end, status = 0, size - 1, 200
        rng = self.headers.get("Range")
        if rng:
            m = re.match(r"^bytes=(\d*)-(\d*)$", rng.strip())
            if not m or (not m.group(1) and not m.group(2)):
                return self.range_error(size)
            if m.group(1):
                start = int(m.group(1))
                end = min(int(m.group(2)), size - 1) if m.group(2) else size - 1
            else:  # suffix range: last N bytes
                start = max(0, size - int(m.group(2)))
            if start >= size or start > end:
                return self.range_error(size)
            status = 206
        length = end - start + 1
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(length))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Access-Control-Allow-Origin", "*")
        if status == 206:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        with open(path, "rb") as f:
            f.seek(start)
            remaining = length
            while remaining > 0:
                chunk = f.read(min(64 * 1024, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)

    def range_error(self, size):
        self.send_response(416)
        self.send_header("Content-Range", f"bytes */{size}")
        self.send_header("Content-Type", "application/json")
        body = json.dumps({"error": "Invalid range"}).encode()
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)


def main():
    parser = argparse.ArgumentParser(description="Music app companion server")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", DEFAULT_PORT)))
    args = parser.parse_args()
    os.makedirs(DOWNLOADS, exist_ok=True)

    httpd = ThreadingHTTPServer(("0.0.0.0", args.port), Handler)
    httpd.daemon_threads = True
    print(f"Music companion server (yt-dlp {YTDLP_VERSION}) listening on port {args.port}")
    ips = lan_ips()
    if ips:
        print("Paste one of these into the app's Settings:")
        for ip in ips:
            print(f"  http://{ip}:{args.port}")
    else:
        print(f"Could not detect a LAN IP; use this computer's IP with port {args.port}")
    print(f"  (local: http://127.0.0.1:{args.port})", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
