// Generates a synthetic rrweb replay JSON for local testing.
// Wrapped the way Sentry exports it, so it also exercises normalizeEvents().
import { writeFile } from 'node:fs/promises'

const t0 = Date.now()
const durationSec = Number(process.argv[2] ?? 20)

const text = (id, s) => ({ type: 3, textContent: s, id })
const el = (id, tagName, attributes, childNodes = []) => ({
  type: 2,
  tagName,
  attributes,
  childNodes,
  id,
})

const fullSnapshot = (ts, label) => ({
  type: 2,
  timestamp: ts,
  data: {
    initialOffset: { left: 0, top: 0 },
    node: {
      type: 0,
      id: 1,
      childNodes: [
        { type: 1, name: 'html', publicId: '', systemId: '', id: 2 },
        el(3, 'html', {}, [
          el(4, 'head', {}, []),
          el(5, 'body', { style: 'margin:0;font-family:sans-serif;background:#111;color:#eee' }, [
            el(6, 'div', { style: 'padding:80px;font-size:56px' }, [text(7, label)]),
            el(8, 'div', { id: 'clock', style: 'padding:0 80px;font-size:32px;color:#7dd' }, [
              text(9, '0.0s'),
            ]),
          ]),
        ]),
      ],
    },
  },
})

const events = [
  { type: 4, timestamp: t0, data: { href: 'https://example.test/', width: 1280, height: 720 } },
  fullSnapshot(t0, 'tapelay fixture'),
]

// A text mutation every 500ms so the replay has something to render over time.
for (let i = 1; i <= durationSec * 2; i++) {
  const ts = t0 + i * 500
  events.push({
    type: 3,
    timestamp: ts,
    data: {
      source: 0,
      texts: [{ id: 9, value: `${(i / 2).toFixed(1)}s` }],
      attributes: [],
      removes: [],
      adds: [],
    },
  })
  // A second FullSnapshot midway, so segmented conversion has a real snapshot
  // to slice from rather than always falling back to the first one.
  if (i === durationSec) events.push(fullSnapshot(ts + 1, 'tapelay fixture (2)'))
}

const out = process.argv[3] ?? 'fixture.json'
await writeFile(out, JSON.stringify({ data: { segments: [events] } }))
console.log(`${out}: ${events.length} events, ${durationSec}s`)
