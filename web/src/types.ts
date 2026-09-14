/**
 * Re-exported from the repository root so the UI and the server cannot drift.
 * Edit ../../protocol.d.ts, not this file.
 */
export type {
  ConnectResponse,
  DevicePollResponse,
  DeviceStartResponse,
  ErrorResponse,
  ExportRecord,
  ExportsResponse,
  FileJobResponse,
  Format,
  JobEvent,
  Org,
  Project,
  ProjectsResponse,
  Replay,
  ReplaysResponse,
  SentryJobRequest,
  SentryJobResponse,
  StatusResponse,
  TokenSource,
} from '../../protocol'

export interface JobResult {
  downloadUrl: string
  size: number
  wallMs: number
}
