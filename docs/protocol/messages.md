# ACP Message Reference

---

## Message Type Catalog

### Handshake Messages

#### HANDSHAKE_INIT

Initiates a protocol connection between two peers.

```json
{
  "header": {
    "messageType": "acp:handshake:init",
    "messageId": "hs-init-abc123",
    "source": "agent-alpha",
    "target": "agent-beta",
    "correlationId": "corr-abc123",
    "flags": ["SYNC"],
    "timestamp": 1762579200000,
    "version": "1.0.0"
  },
  "payload": {
    "version": "1.0.0",
    "supportedVersions": ["1.0.0", "1.1.0"],
    "capabilities": ["handshake", "auth", "task_delegation", "streaming"],
    "agentId": "agent-alpha",
    "metadata": {
      "correlationId": "corr-abc123",
      "versionRange": { "min": "1.0.0", "max": "1.1.0" }
    }
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `version` | string | Yes | Current protocol version |
| `supportedVersions` | string[] | Yes | All versions this peer supports |
| `capabilities` | ACPCapability[] | Yes | Supported protocol capabilities |
| `agentId` | string | Yes | Unique agent identifier |
| `metadata` | object | No | Additional context for handshake |

#### HANDSHAKE_ACK

Response to HANDSHAKE_INIT, indicating acceptance or rejection.

```json
{
  "header": {
    "messageType": "acp:handshake:ack",
    "messageId": "hs-ack-def456",
    "source": "agent-beta",
    "target": "agent-alpha",
    "correlationId": "corr-abc123",
    "sessionId": "acp-session-lxz3-k8f2m9",
    "flags": ["SYNC"],
    "timestamp": 1762579200100,
    "version": "1.0.0"
  },
  "payload": {
    "accepted": true,
    "version": "1.0.0",
    "sessionId": "acp-session-lxz3-k8f2m9",
    "serverCapabilities": ["handshake", "auth", "task_delegation", "event_pubsub"]
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `accepted` | boolean | Yes | Whether handshake was accepted |
| `version` | string | Yes | The version selected by the server |
| `sessionId` | string | Yes | Established session identifier |
| `serverCapabilities` | string[] | Yes | Server's supported capabilities |
| `reason` | string | No | Rejection reason if not accepted |

#### HANDSHAKE_NEGOTIATE

Negotiates final version and capabilities after ACK.

```json
{
  "header": {
    "messageType": "acp:handshake:negotiate",
    "messageId": "hs-neg-ghi789",
    "source": "agent-alpha",
    "target": "agent-beta",
    "correlationId": "corr-abc123",
    "sessionId": "acp-session-lxz3-k8f2m9",
    "flags": ["SYNC"],
    "timestamp": 1762579200200,
    "version": "1.0.0"
  },
  "payload": {
    "selectedVersion": "1.0.0",
    "commonCapabilities": ["handshake", "auth", "task_delegation"],
    "sessionId": "acp-session-lxz3-k8f2m9"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `selectedVersion` | string | Yes | Mutually agreed version |
| `commonCapabilities` | string[] | Yes | Intersection of supported capabilities |
| `sessionId` | string | Yes | Session identifier from ACK |

#### HANDSHAKE_COMPLETE

Confirms the handshake is established.

```json
{
  "header": {
    "messageType": "acp:handshake:complete",
    "messageId": "hs-complete-jkl012",
    "source": "agent-beta",
    "target": "agent-alpha",
    "correlationId": "corr-abc123",
    "sessionId": "acp-session-lxz3-k8f2m9",
    "flags": ["SYNC"],
    "timestamp": 1762579200300,
    "version": "1.0.0"
  },
  "payload": {
    "sessionId": "acp-session-lxz3-k8f2m9",
    "establishedAt": 1762579200300,
    "negotiatedVersion": "1.0.0",
    "activeCapabilities": ["handshake", "auth", "task_delegation"]
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `sessionId` | string | Yes | Established session ID |
| `establishedAt` | number | Yes | Unix timestamp of establishment |
| `negotiatedVersion` | string | Yes | Final negotiated version |
| `activeCapabilities` | string[] | Yes | Enabled capabilities for this session |

#### HANDSHAKE_ERROR

Indicates handshake failure.

```json
{
  "header": {
    "messageType": "acp:handshake:error",
    "messageId": "hs-error-mno345",
    "source": "agent-beta",
    "target": "agent-alpha",
    "correlationId": "corr-abc123",
    "flags": ["SYNC"],
    "timestamp": 1762579200400,
    "version": "1.0.0"
  },
  "payload": {
    "code": "VERSION_MISMATCH",
    "message": "No compatible version found",
    "suggestedVersions": ["1.0.0"],
    "retryable": true
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `code` | string | Yes | Error code |
| `message` | string | Yes | Human-readable description |
| `suggestedVersions` | string[] | No | Versions the server suggests trying |
| `retryable` | boolean | Yes | Whether the client should retry |

---

### Messaging Messages

#### MESSAGE_SEND

Transmits a message to one or more agents.

```json
{
  "header": {
    "messageType": "acp:message:send",
    "messageId": "msg-pqr678",
    "source": "agent-alpha",
    "target": "agent-beta",
    "correlationId": "corr-def456",
    "sessionId": "acp-session-lxz3-k8f2m9",
    "flags": ["SYNC", "PRIORITY"],
    "timestamp": 1762579210000,
    "ttl": 30000,
    "priority": 5,
    "version": "1.0.0"
  },
  "payload": {
    "text": "Please analyze this data",
    "data": { "key": "value" },
    "context": { "requestId": "req-789" }
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `text` | string | No | Message text content |
| `data` | any | No | Structured payload |
| `context` | object | No | Execution context |

#### MESSAGE_DELIVER

Delivers a message to a handler (internal routing step).

```json
{
  "header": {
    "messageType": "acp:message:deliver",
    "messageId": "msg-del-stu901",
    "source": "agent-beta",
    "target": "agent-alpha",
    "correlationId": "corr-def456",
    "sessionId": "acp-session-lxz3-k8f2m9",
    "flags": ["SYNC"],
    "timestamp": 1762579210100,
    "version": "1.0.0"
  },
  "payload": {
    "received": true,
    "deliveredAt": 1762579210100
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `received` | boolean | Yes | Whether message was received |
| `deliveredAt` | number | Yes | Timestamp of delivery |

#### MESSAGE_ACK

Acknowledges receipt of a message.

```json
{
  "header": {
    "messageType": "acp:message:ack",
    "messageId": "msg-ack-vwx234",
    "source": "agent-beta",
    "target": "agent-alpha",
    "correlationId": "corr-def456",
    "sessionId": "acp-session-lxz3-k8f2m9",
    "flags": ["ASYNC"],
    "timestamp": 1762579210200,
    "version": "1.0.0"
  },
  "payload": {
    "status": "accepted",
    "queued": true
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `status` | string | Yes | `accepted`, `queued`, `rejected` |
| `queued` | boolean | No | Whether message was queued for processing |

#### MESSAGE_ERROR

Error response for a failed message.

```json
{
  "header": {
    "messageType": "acp:message:error",
    "messageId": "msg-err-yza567",
    "source": "agent-beta",
    "target": "agent-alpha",
    "correlationId": "corr-def456",
    "sessionId": "acp-session-lxz3-k8f2m9",
    "flags": ["ASYNC"],
    "timestamp": 1762579210300,
    "version": "1.0.0"
  },
  "payload": {
    "code": "MESSAGE_TIMEOUT",
    "message": "Message processing exceeded TTL",
    "originalMessageId": "msg-pqr678",
    "retryable": true
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `code` | string | Yes | Error code |
| `message` | string | Yes | Description |
| `originalMessageId` | string | Yes | ID of the failed message |
| `retryable` | boolean | Yes | Whether to retry |

---

### Streaming Messages

#### STREAM_INIT

Initializes a new data stream.

```json
{
  "header": {
    "messageType": "acp:stream:init",
    "messageId": "str-init-bcd890",
    "source": "agent-alpha",
    "target": "agent-beta",
    "sessionId": "acp-session-lxz3-k8f2m9",
    "flags": ["STREAM"],
    "timestamp": 1762579220000,
    "version": "1.0.0"
  },
  "payload": {
    "streamId": "stream-efg123",
    "metadata": {
      "contentType": "text/plain",
      "expectedChunks": 150
    }
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `streamId` | string | Yes | Unique stream identifier |
| `metadata` | object | No | Stream metadata |

#### STREAM_CHUNK

A single chunk of streaming data.

```json
{
  "header": {
    "messageType": "acp:stream:chunk",
    "messageId": "str-chunk-hij456",
    "source": "agent-alpha",
    "target": "agent-beta",
    "sessionId": "acp-session-lxz3-k8f2m9",
    "flags": ["STREAM"],
    "timestamp": 1762579220100,
    "version": "1.0.0"
  },
  "payload": {
    "streamId": "stream-efg123",
    "sequence": 1,
    "data": "Partial response content...",
    "isFinal": false,
    "timestamp": 1762579220100
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `streamId` | string | Yes | Stream identifier |
| `sequence` | number | Yes | Monotonic chunk sequence number |
| `data` | any | Yes | Chunk payload |
| `isFinal` | boolean | Yes | Whether this is the last chunk |
| `timestamp` | number | Yes | Chunk creation time |

#### STREAM_COMPLETE

Indicates a stream has finished successfully.

```json
{
  "header": {
    "messageType": "acp:stream:complete",
    "messageId": "str-complete-klm789",
    "source": "agent-alpha",
    "target": "agent-beta",
    "sessionId": "acp-session-lxz3-k8f2m9",
    "flags": ["STREAM"],
    "timestamp": 1762579220500,
    "version": "1.0.0"
  },
  "payload": {
    "streamId": "stream-efg123",
    "totalChunks": 145,
    "duration": 5000
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `streamId` | string | Yes | Stream identifier |
| `totalChunks` | number | Yes | Total chunks delivered |
| `duration` | number | Yes | Stream duration in ms |

#### STREAM_CANCEL

Cancels an active stream.

```json
{
  "header": {
    "messageType": "acp:stream:cancel",
    "messageId": "str-cancel-nop012",
    "source": "agent-beta",
    "target": "agent-alpha",
    "sessionId": "acp-session-lxz3-k8f2m9",
    "flags": ["STREAM"],
    "timestamp": 1762579220600,
    "version": "1.0.0"
  },
  "payload": {
    "streamId": "stream-efg123",
    "reason": "User cancelled"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `streamId` | string | Yes | Stream identifier |
| `reason` | string | No | Cancellation reason |

#### STREAM_ERROR

Error during streaming.

```json
{
  "header": {
    "messageType": "acp:stream:error",
    "messageId": "str-err-qrs345",
    "source": "agent-alpha",
    "target": "agent-beta",
    "sessionId": "acp-session-lxz3-k8f2m9",
    "flags": ["STREAM"],
    "timestamp": 1762579220700,
    "version": "1.0.0"
  },
  "payload": {
    "streamId": "stream-efg123",
    "code": "STREAM_CANCELLED",
    "message": "Stream cancelled by receiver"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `streamId` | string | Yes | Stream identifier |
| `code` | string | Yes | Error code |
| `message` | string | Yes | Error description |

---

### Routing Messages

#### ROUTE_ANNOUNCE

Announces a routing rule to the mesh.

```json
{
  "header": {
    "messageType": "acp:route:announce",
    "messageId": "route-ann-tuv678",
    "source": "agent-alpha",
    "flags": ["ASYNC"],
    "timestamp": 1762579230000,
    "version": "1.0.0"
  },
  "payload": {
    "ruleId": "rule-alpha-default",
    "matchPattern": "*",
    "targetAgent": "agent-alpha",
    "priority": 0,
    "ttl": 3600000,
    "metadata": { "description": "Default catch-all for agent-alpha" }
  }
}
```

#### ROUTE_QUERY

Queries the mesh for routes matching a pattern.

```json
{
  "header": {
    "messageType": "acp:route:query",
    "messageId": "route-qry-wxy901",
    "source": "agent-beta",
    "flags": ["SYNC"],
    "timestamp": 1762579231000,
    "version": "1.0.0"
  },
  "payload": {
    "matchPattern": "acp:task:*",
    "maxResults": 5
  }
}
```

---

### Control Messages

#### HEARTBEAT

Periodic liveness signal.

```json
{
  "header": {
    "messageType": "acp:heartbeat",
    "messageId": "hb-zab234",
    "source": "agent-alpha",
    "sessionId": "acp-session-lxz3-k8f2m9",
    "flags": ["ASYNC"],
    "timestamp": 1762579240000,
    "version": "1.0.0"
  },
  "payload": {
    "status": "RUNNING",
    "load": 0.45,
    "uptime": 3600000,
    "healthy": true
  }
}
```

#### HEALTH_CHECK

Request or response for health status.

```json
{
  "header": {
    "messageType": "acp:health:check",
    "messageId": "hc-cde567",
    "source": "runtime-manager",
    "target": "agent-alpha",
    "correlationId": "corr-health-001",
    "flags": ["SYNC"],
    "timestamp": 1762579250000,
    "version": "1.0.0"
  },
  "payload": {
    "checks": ["memory", "cpu", "connections"],
    "verbose": true
  }
}
```

#### ERROR

Generic protocol-level error.

```json
{
  "header": {
    "messageType": "acp:error",
    "messageId": "err-ghi890",
    "source": "agent-beta",
    "target": "agent-alpha",
    "correlationId": "corr-def456",
    "sessionId": "acp-session-lxz3-k8f2m9",
    "flags": ["ASYNC"],
    "timestamp": 1762579260000,
    "version": "1.0.0"
  },
  "payload": {
    "code": "TARGET_UNREACHABLE",
    "message": "Agent gamma is not connected",
    "retryable": true
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `code` | string | Yes | Error code from `ACPErrorCode` |
| `message` | string | Yes | Human-readable description |
| `retryable` | boolean | Yes | Whether the operation should be retried |
