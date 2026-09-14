/**
 * The source dictionary. Every other locale is typed against this shape, so a
 * missing or renamed key is a compile error rather than a blank label.
 * Interpolation is done with functions to keep argument order checked too.
 */
export const en = {
  code: 'en',
  label: 'English',

  app: {
    tagline:
      'Turn a Sentry session replay into an MP4 or GIF you can attach to a ticket. Everything runs on this machine and the replay is never uploaded anywhere.',
    tabSentry: 'From Sentry',
    tabFile: 'JSON file',
  },

  nav: {
    convert: 'Convert',
    exports: 'Exports',
  },

  exports: {
    title: 'Exports',
    description: (dir: string) => `Finished conversions are kept in ${dir}. Nothing here has left this machine.`,
    empty: 'Nothing has been exported yet.',
    emptyHint: 'Convert a replay and it will show up here.',
    download: 'Download',
    delete: 'Delete',
    deleting: 'Deleting…',
    range: (from: string, to: string) => `${from}–${to}`,
    wholeSession: 'whole session',
    speed: (n: number) => `${n}x`,
    fromFile: 'from a file',
    fromSentry: 'from Sentry',
    refresh: 'Refresh',
  },

  connect: {
    title: 'Connect to Sentry',
    description:
      'Create a token under Settings → Account → User Auth Tokens with the project:read scope. It is kept only in this server process’s memory, never written to disk and never sent to the browser.',
    host: 'Sentry host',
    token: 'Auth token',
    submit: 'Connect',
    busy: 'Connecting…',
    remember: 'Remember this token on this machine',
    rememberHint: 'Saved to ~/.tapelay/config.json with owner-only permissions, the same way sentry-cli and gh keep theirs.',
    sourceEnv: 'Using the token from SENTRY_AUTH_TOKEN.',
    sourceSaved: 'Using the token saved on this machine.',
    sourceCli: 'Using the token from ~/.sentryclirc, so there was nothing to set up.',
    signIn: 'Sign in with Sentry',
    signInHint: 'Approve the code in Sentry and this page connects itself. No token to create or paste.',
    signInBusy: 'Starting…',
    codeTitle: 'Enter this code in Sentry',
    codeHint: 'The tab should already be open. If it is not, open Sentry and enter the code.',
    openSentry: 'Open Sentry',
    waiting: 'Waiting for approval in Sentry…',
    cancel: 'Cancel',
    useToken: 'Paste a token instead',
    hideToken: 'Back to sign in',
    sourceOauth: 'Signed in to Sentry on this machine.',
    forget: 'Forget saved token',
    noOrgs: 'This token cannot see any organization.',
  },

  browse: {
    title: 'Pick a replay',
    description: 'Replays with errors attached are usually the ones that end up in a ticket.',
    org: 'Organization',
    project: 'Project',
    allProjects: 'All projects',
    period: 'Period',
    period24h: 'Last 24 hours',
    period7d: 'Last 7 days',
    period14d: 'Last 14 days',
    period90d: 'Last 90 days',
    search: 'Search (Sentry query syntax)',
    searchPlaceholder: 'user.email:someone@example.com',
    errorsOnly: 'With errors only',
    refresh: 'Refresh',
    disconnect: 'Disconnect',
    loading: 'Loading…',
    empty: 'No replays match these filters.',
    unknownTime: 'unknown time',
    noUrl: '(no URL)',
    errors: (n: number) => `${n} error${n === 1 ? '' : 's'}`,
  },

  clip: {
    title: 'Range and format',
    summary: (url: string, id: string, length: string, errors: string) =>
      `${url} · ${id}… · ${length} long · ${errors}`,
    start: 'Start (m:ss)',
    end: 'End (m:ss)',
    last30: 'Last 30s',
    last1m: 'Last 1 min',
    whole: 'Whole session',
    format: 'Format',
    speed: 'Speed',
    speedReal: '1x (real time)',
    resolution: 'Resolution',
    convert: 'Convert',
    busy: 'Converting…',
    gifHint: (max: number) => `A GIF can be at most ${max} seconds.`,
    mp4Hint: 'MP4 is encoded as H.264, so it opens anywhere.',
    badTime: 'Times look like 90 or 1:30.',
    reversed: 'End must be later than start.',
    gifTooLong: (max: number, actual: number) =>
      `A GIF can be at most ${max} seconds. This range is ${actual}s.`,
  },

  file: {
    title: 'Convert an rrweb JSON',
    description: 'Already have a replay exported as JSON? Drop it here.',
    speed: 'Speed',
    speedReal: '1x (real time, slowest)',
    speedRecommended: '4x (recommended)',
    resolution: 'Resolution',
    drop: 'Drop a JSON file, or click to choose',
    dropHint: 'The result downloads automatically when it is done.',
  },

  job: {
    preparing: 'Preparing…',
    size: (w: number, h: number, seconds: string) => `${w}×${h} · about ${seconds}s`,
    progress: (percent: string, seconds: string) => `Converting ${percent}% · ${seconds}s elapsed`,
    segment: (index: number, total: number) => ` · segment ${index}/${total}`,
    done: (seconds: string) => `Done · took ${seconds}s`,
    download: 'Download',
    lostConnection: 'Lost the connection to the conversion job.',
  },
}

export type Dict = typeof en
