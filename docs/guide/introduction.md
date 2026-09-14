# Introduction

`tapelay` turns a [rrweb](https://rrweb.io) session recording into a video file. In practice that means a Sentry session replay, because that is where most people run into the problem.

## The problem

Sentry states plainly that [a replay cannot be downloaded](https://sentry.zendesk.com/hc/en-us/articles/26473694604443-Can-I-Download-a-Session-Replay): it is not a video, it is a DOM reconstruction, and it only plays inside the Sentry UI. The request to export replays as video was [opened in 2023 and closed as not planned](https://github.com/getsentry/sentry/issues/44919). The reason people kept asking is right there in the thread: they want to attach a replay to a Jira, Asana or Linear ticket.

PostHog is in a similar place. Clip export shipped, but [exporting a whole session as MP4](https://github.com/PostHog/posthog/issues/38807) is still open, and the workaround people describe is starting a screen recorder and waiting.

That leaves a gap. Sentry seats cost money, so the people who most need to see the bug — a PM, a designer, QA, a customer — usually cannot open the link you would send them.

## What this does about it

You give it a replay URL. It pulls the recording through the Sentry API, replays it in a headless Chromium, and writes a video file next to you. No upload, no screen recorder, no Sentry seat for whoever you hand it to.

## What it is built on

[`rrvideo`](https://www.npmjs.com/package/rrvideo) does the actual rendering, and this sits on top of it to cover three things it does not:

1. **Input normalization.** `rrvideo` wants a bare rrweb event array. Sentry and PostHog hand you a wrapper object, sometimes split across segment files.
2. **Long sessions.** A one-hour replay in a single Chromium runs out of memory. This splits the session into windows and stitches the pieces.
3. **A file that opens.** Playwright's recorder emits VP8 in a WebM container no matter what you name the output, so a `.mp4` from a plain `rrvideo` run will not open in QuickTime or PowerPoint.

## Requirements

- Node 18 or newer
- Chromium, which Playwright downloads on first install
- ffmpeg and ffprobe on `PATH`

See [Quick Start](/guide/quick-start).
