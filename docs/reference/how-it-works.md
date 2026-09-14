# How it works

## The pipeline

An rrweb recording is not a video. It is a stream of DOM mutations, so the only way to get pixels is to replay it in a real browser and record the result. That is what [`rrvideo`](https://www.npmjs.com/package/rrvideo) does with Playwright, and it is why conversion takes real time.

```
events → (optional slice) → Chromium replay → WebM/VP8 → ffmpeg → MP4 or GIF
```

## Why the output has to be re-encoded

Playwright's recorder emits **VP8 in a WebM container**, regardless of the file extension you hand it. So a `.mp4` produced by a plain `rrvideo` run is a WebM wearing the wrong name. Chrome plays it, which is why the problem hides for a while; QuickTime, PowerPoint and iOS do not.

Every path here ends in `libx264` with `yuv420p` and `+faststart`, which is the difference between a file your PM can open and one they cannot.

## Long sessions

A one-hour replay in a single Chromium exhausts memory before it finishes. Above the threshold (25 minutes by default) the session is cut into windows, each converted in a **fresh** browser process, so peak memory is bounded by one window rather than the whole session.

Below the threshold, segmenting would be slower than it is worth: every window pays a Chromium cold start. So short sessions take the single-pass path.

## Why clips need trimming

rrweb can only begin replaying from a `FullSnapshot` (`type: 2`), because that is the only event carrying a complete DOM. A window that starts at 15:00 must therefore be sliced from the last snapshot before it, and the rendered clip starts earlier than the window does. The extra head is trimmed off before the pieces are joined.

The obvious way to size that trim is from the event timeline:

```
trimSeconds = (windowStart - snapshotTimestamp) / speed
```

That is wrong by about a second, because it cannot see the lead-in between Chromium starting to record and the replay actually beginning. Since the part you want is always the *tail* of the clip, measuring the rendered file is exact and self-correcting:

```
trimSeconds = actualClipDuration - (windowDuration / speed)
```

## Why segments stay WebM until the end

`ffmpeg -c copy` cannot write VP8 into an MP4 container, and trimming VP8 with `-c copy` only cuts on keyframes, which leaves the prefix behind. So each segment is trimmed and encoded to H.264 in one pass, and the final `concat` is a plain copy.

For accurate trimming, `-ss` goes **after** `-i`, which forces decode-based seeking. Before `-i` it snaps to keyframes.

## GIF

GIF is a 256-colour format. A naive encode destroys UI text, so the clip gets its own palette:

```
fps=N,scale=W:-1:flags=lanczos,split[a][b];
[a]palettegen=stats_mode=diff[p];
[b][p]paletteuse=dither=bayer:bayer_scale=3
```

`stats_mode=diff` weights the palette toward regions that change, which suits a session replay where most of the frame is static.
