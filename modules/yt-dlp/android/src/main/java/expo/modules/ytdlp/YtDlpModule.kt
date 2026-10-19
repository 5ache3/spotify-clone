package expo.modules.ytdlp

import android.content.Context
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.io.File

// Runs yt-dlp on the phone (youtubedl-android bundles python, quickjs, ffmpeg).
class YtDlpModule : Module() {
  private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  @Volatile
  private var initialized = false

  // first run unzips python and ffmpeg (a few seconds); later runs are instant
  @Synchronized
  private fun ensureInit() {
    if (initialized) return
    YoutubeDL.getInstance().init(context)
    FFmpeg.getInstance().init(context)
    initialized = true
  }

  // run on a background thread and settle the promise
  private fun background(promise: Promise, block: () -> Any?) {
    scope.launch {
      try {
        promise.resolve(block())
      } catch (e: YoutubeDL.CanceledException) {
        promise.reject("ERR_YTDLP_CANCELED", "Download canceled", e)
      } catch (e: Throwable) {
        promise.reject("ERR_YTDLP", cleanError(e.message), e)
      }
    }
  }

  // yt-dlp stderr -> the useful "ERROR: ..." line
  private fun cleanError(message: String?): String {
    val text = message ?: "yt-dlp failed"
    val error = text.lines().lastOrNull { it.startsWith("ERROR:") }
    return (error ?: text.lines().lastOrNull { it.isNotBlank() } ?: text)
      .removePrefix("ERROR:")
      .trim()
  }

  override fun definition() = ModuleDefinition {
    Name("YtDlp")

    Events("onProgress")

    // yt-dlp version installed on the phone
    Function("version") {
      YoutubeDL.getInstance().version(context)
    }

    AsyncFunction("init") { promise: Promise ->
      background(promise) {
        ensureInit()
        YoutubeDL.getInstance().version(context)
      }
    }

    // "DONE" or "ALREADY_UP_TO_DATE"
    AsyncFunction("update") { promise: Promise ->
      background(promise) {
        ensureInit()
        YoutubeDL.getInstance().updateYoutubeDL(context)?.name
      }
    }

    // raw yt-dlp JSON for "ytsearchN:query"
    AsyncFunction("search") { query: String, limit: Int, promise: Promise ->
      background(promise) {
        ensureInit()
        val request = YoutubeDLRequest("ytsearch$limit:$query")
          .addOption("--flat-playlist")
          .addOption("--dump-single-json")
          .addOption("--no-warnings")
        YoutubeDL.getInstance().execute(request).out
      }
    }

    // best audio as m4a + jpg cover + info json, saved as <outDir>/<fileBase>.*
    AsyncFunction("download") { url: String, outDir: String, fileBase: String, id: String, promise: Promise ->
      background(promise) {
        ensureInit()
        val dir = File(outDir.removePrefix("file://"))
        dir.mkdirs()

        val request = YoutubeDLRequest(url)
          .addOption("-f", "bestaudio[ext=m4a]/bestaudio/best")
          .addOption("-x")
          .addOption("--audio-format", "m4a")
          .addOption("--no-playlist")
          .addOption("--write-thumbnail")
          .addOption("--convert-thumbnails", "jpg")
          .addOption("--write-info-json")
          .addOption("--no-mtime")
          .addOption("--no-warnings")
          .addOption("-o", "${dir.absolutePath}/$fileBase.%(ext)s")

        var lastSent = -1f
        YoutubeDL.getInstance().execute(request, id) { progress, _, line ->
          val converting = line.contains("[ExtractAudio]") || line.contains("[ThumbnailsConvertor]")
          // throttle: whole percents and stage changes only
          if (converting || progress - lastSent >= 1f) {
            lastSent = progress
            sendEvent(
              "onProgress",
              mapOf("id" to id, "progress" to progress / 100f, "converting" to converting)
            )
          }
        }

        val audio = File(dir, "$fileBase.m4a")
        if (!audio.exists()) throw IllegalStateException("yt-dlp finished without an audio file")
        val thumbnail = File(dir, "$fileBase.jpg")
        val infoFile = File(dir, "$fileBase.info.json")
        val info = if (infoFile.exists()) infoFile.readText().also { infoFile.delete() } else "{}"

        mapOf(
          "audioPath" to audio.absolutePath,
          "thumbnailPath" to (if (thumbnail.exists()) thumbnail.absolutePath else null),
          "info" to info
        )
      }
    }

    Function("cancel") { id: String ->
      YoutubeDL.getInstance().destroyProcessById(id)
    }

    OnDestroy {
      scope.cancel()
    }
  }
}
