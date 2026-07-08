import type {
  ACPAgentId,
  ACPCapability,
  ACPCorrelationId,
  ACPHandshakeAckPayload,
  ACPHandshakeCompletePayload,
  ACPHandshakeInitPayload,
  ACPHandshakeNegotiatePayload,
  ACPMessage,
  ACPSessionId,
  ACPVersion,
  ACPVersionRange,
} from './types.js';
import { compareVersions, isValidVersion } from './types.js';
import { ACPErrorCode, HandshakeError } from './errors.js';

export enum HandshakeState {
  INITIATED = 'INITIATED',
  AWAITING_ACK = 'AWAITING_ACK',
  AWAITING_CAPABILITIES = 'AWAITING_CAPABILITIES',
  AWAITING_VERSION = 'AWAITING_VERSION',
  NEGOTIATING = 'NEGOTIATING',
  ESTABLISHED = 'ESTABLISHED',
  FAILED = 'FAILED',
}

export interface HandshakeResult {
  success: boolean;
  state: HandshakeState;
  sessionId?: ACPSessionId;
  negotiatedVersion?: ACPVersion;
  commonCapabilities?: ACPCapability[];
  error?: HandshakeError;
  durationMs: number;
}

export interface HandshakeContext {
  localAgentId: ACPAgentId;
  localVersion: ACPVersion;
  supportedVersions: ACPVersion[];
  localCapabilities: ACPCapability[];
  remoteAgentId?: ACPAgentId;
  correlationId: ACPCorrelationId;
  versionRange: ACPVersionRange;
  timeoutMs: number;
}

export function validateVersion(version: string, supportedVersions: ACPVersion[]): boolean {
  if (!isValidVersion(version)) {
    return false;
  }
  return supportedVersions.includes(version);
}

export function negotiateVersion(
  localVersions: ACPVersion[],
  remoteVersions: ACPVersion[],
): ACPVersion | null {
  const sortedLocal = [...localVersions].sort(compareVersions).reverse();
  const sortedRemote = [...remoteVersions].sort(compareVersions).reverse();

  for (const localVersion of sortedLocal) {
    if (sortedRemote.includes(localVersion)) {
      return localVersion;
    }
  }

  return null;
}

export function negotiateCapabilities(
  localCapabilities: ACPCapability[],
  remoteCapabilities: ACPCapability[],
): ACPCapability[] {
  const remoteSet = new Set<ACPCapability>(remoteCapabilities);
  return localCapabilities.filter((cap) => remoteSet.has(cap));
}

export function createHandshakeInit(
  context: HandshakeContext,
): ACPHandshakeInitPayload {
  return {
    version: context.localVersion,
    supportedVersions: context.supportedVersions,
    capabilities: context.localCapabilities,
    agentId: context.localAgentId,
    metadata: {
      correlationId: context.correlationId,
      versionRange: context.versionRange,
    },
  };
}

export function createHandshakeAck(
  accepted: boolean,
  version: ACPVersion,
  sessionId: ACPSessionId,
  capabilities: ACPCapability[],
  reason?: string,
): ACPHandshakeAckPayload {
  return {
    accepted,
    version,
    sessionId,
    serverCapabilities: capabilities,
    reason,
  };
}

function generateSessionId(): ACPSessionId {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `acp-session-${timestamp}-${random}`;
}

export async function performHandshake(
  context: HandshakeContext,
  sendMessage: (message: ACPMessage<ACPHandshakeInitPayload | ACPHandshakeAckPayload | ACPHandshakeNegotiatePayload | ACPHandshakeCompletePayload>) => Promise<void>,
  receiveMessage: (timeoutMs: number) => Promise<ACPMessage<ACPHandshakeAckPayload | ACPHandshakeNegotiatePayload | ACPHandshakeCompletePayload> | null>,
): Promise<HandshakeResult> {
  const startTime = Date.now();
  let state: HandshakeState = HandshakeState.INITIATED;

  function elapsed(): number {
    return Date.now() - startTime;
  }

  try {
    state = HandshakeState.AWAITING_ACK;

    const initPayload = createHandshakeInit(context);
    await sendMessage({
      header: {
        messageType: 'acp:handshake:init' as ACPMessage['header']['messageType'],
        messageId: `hs-init-${context.correlationId}`,
        source: context.localAgentId,
        target: context.remoteAgentId,
        correlationId: context.correlationId,
        flags: ['SYNC'],
        timestamp: Date.now(),
        version: context.localVersion,
      },
      payload: initPayload,
    });

    const remainingTime = context.timeoutMs - elapsed();
    if (remainingTime <= 0) {
      return {
        success: false,
        state: HandshakeState.FAILED,
        error: new HandshakeError({
          message: 'Handshake timed out during INIT phase',
          code: ACPErrorCode.HANDSHAKE_TIMEOUT,
        }),
        durationMs: elapsed(),
      };
    }

    const ackResponse = await receiveMessage(remainingTime);
    if (!ackResponse) {
      return {
        success: false,
        state: HandshakeState.FAILED,
        error: new HandshakeError({
          message: 'No ACK received during handshake',
          code: ACPErrorCode.HANDSHAKE_TIMEOUT,
        }),
        durationMs: elapsed(),
      };
    }

    const ackPayload = ackResponse.payload as ACPHandshakeAckPayload;
    if (!ackPayload.accepted) {
      return {
        success: false,
        state: HandshakeState.FAILED,
        error: new HandshakeError({
          message: ackPayload.reason ?? 'Handshake rejected by remote agent',
          code: ACPErrorCode.HANDSHAKE_FAILED,
        }),
        durationMs: elapsed(),
      };
    }

    const remoteSessionId = ackPayload.sessionId;
    state = HandshakeState.AWAITING_VERSION;

    const negotiatedVersion = negotiateVersion(
      context.supportedVersions,
      [ackPayload.version],
    );

    if (!negotiatedVersion) {
      return {
        success: false,
        state: HandshakeState.FAILED,
        error: new HandshakeError({
          message: `No compatible version found. Local: ${context.supportedVersions.join(', ')}, Remote: ${ackPayload.version}`,
          code: ACPErrorCode.VERSION_MISMATCH,
        }),
        durationMs: elapsed(),
      };
    }

    state = HandshakeState.AWAITING_CAPABILITIES;

    const commonCapabilities = negotiateCapabilities(
      context.localCapabilities,
      ackPayload.serverCapabilities,
    );

    state = HandshakeState.NEGOTIATING;

    const negotiatePayload: ACPHandshakeNegotiatePayload = {
      selectedVersion: negotiatedVersion,
      commonCapabilities,
      sessionId: remoteSessionId,
    };

    await sendMessage({
      header: {
        messageType: 'acp:handshake:negotiate' as ACPMessage['header']['messageType'],
        messageId: `hs-negotiate-${context.correlationId}`,
        source: context.localAgentId,
        target: context.remoteAgentId,
        correlationId: context.correlationId,
        sessionId: remoteSessionId,
        flags: ['SYNC'],
        timestamp: Date.now(),
        version: negotiatedVersion,
      },
      payload: negotiatePayload,
    });

    state = HandshakeState.ESTABLISHED;

    return {
      success: true,
      state: HandshakeState.ESTABLISHED,
      sessionId: remoteSessionId,
      negotiatedVersion,
      commonCapabilities,
      durationMs: elapsed(),
    };
  } catch (error) {
    const handshakeError = error instanceof HandshakeError
      ? error
      : new HandshakeError({
          message: error instanceof Error ? error.message : 'Unknown handshake error',
          code: ACPErrorCode.HANDSHAKE_FAILED,
          cause: error,
        });

    return {
      success: false,
      state: HandshakeState.FAILED,
      error: handshakeError,
      durationMs: elapsed(),
    };
  }
}
