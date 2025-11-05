# Conversations Revamp - Migration Notes

- New collections:
  - conversations
  - conversationevents
  - messageversions
- Existing `/memory` endpoints remain; they now mirror messages to conversations event log.
- Assistant execution now ensures a conversation and records user/assistant messages.
- Versioned edits supported via `PATCH /conversations/:id/messages/:messageId`.
- Tool calls can be recorded with full telemetry via `POST /conversations/:id/tool-calls`.
- Pause/resume: `POST /conversations/:id/pause` / `.../resume`.
- Multi-agent linkages: parent/child relationships for graph/collective/genius.
- Metrics: Prometheus counters/histograms for events, edits, tool-call duration.

## Backward Compatibility
- `/memory` remains functional; persistence responsibilities moved to ConversationsService.
- Search/list endpoints now backed by conversations.

## Configuration
- Uses existing Mongo connection from AppModule; Mongoose models registered in InfrastructureModule.
