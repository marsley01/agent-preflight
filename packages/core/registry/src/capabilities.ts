import type { AgentCapabilities, AgentId } from "@agent-preflight/types";

export interface CapabilityCandidate {
  agentId: AgentId;
  capabilities: AgentCapabilities;
}

export interface CapabilityMatch {
  agentId: AgentId;
  score: number;
  matchedCapabilities: string[];
  missingCapabilities: string[];
}

export class CapabilityMatcher {
  match(
    candidates: CapabilityCandidate[],
    required: string[],
  ): CapabilityMatch[] {
    const results: CapabilityMatch[] = [];

    for (const candidate of candidates) {
      const match = this._scoreMatch(candidate, required);
      if (match.score > 0 || match.matchedCapabilities.length > 0) {
        results.push(match);
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  compare(a: AgentCapabilities, b: AgentCapabilities): {
    compatible: boolean;
    aSuperset: boolean;
    bSuperset: boolean;
    intersection: string[];
    aOnly: string[];
    bOnly: string[];
  } {
    const aCaps = this._flattenCapabilities(a);
    const bCaps = this._flattenCapabilities(b);
    const aSet = new Set(aCaps.map((c) => c.toLowerCase()));
    const bSet = new Set(bCaps.map((c) => c.toLowerCase()));

    const intersection = aCaps.filter((c: string) => bSet.has(c.toLowerCase()));
    const aOnly = aCaps.filter((c: string) => !bSet.has(c.toLowerCase()));
    const bOnly = bCaps.filter((c: string) => !aSet.has(c.toLowerCase()));

    return {
      compatible: intersection.length > 0,
      aSuperset: bOnly.length === 0,
      bSuperset: aOnly.length === 0,
      intersection,
      aOnly,
      bOnly,
    };
  }

  findBestMatch(
    candidates: CapabilityCandidate[],
    required: string[],
  ): CapabilityMatch | undefined {
    const matches = this.match(candidates, required);
    if (matches.length === 0) return undefined;
    return matches[0];
  }

  inferCapabilities(config: {
    modelFamilies?: string[];
    plugins?: string[];
    custom?: string[];
    supportedMessageTypes?: string[];
    functionCalling?: boolean;
    streaming?: boolean;
    memoryLayers?: string[];
  }): string[] {
    const inferred: string[] = [];

    if (config.modelFamilies) {
      inferred.push(...config.modelFamilies.map((f: string) => `model:${f}`));
    }
    if (config.plugins) {
      inferred.push(...config.plugins.map((p: string) => `plugin:${p}`));
    }
    if (config.custom) {
      inferred.push(...config.custom);
    }
    if (config.supportedMessageTypes) {
      inferred.push(...config.supportedMessageTypes.map((t: string) => `message:${t}`));
    }
    if (config.functionCalling) {
      inferred.push("capability:function_calling");
    }
    if (config.streaming) {
      inferred.push("capability:streaming");
    }
    if (config.memoryLayers) {
      inferred.push(...config.memoryLayers.map((l: string) => `memory:${l}`));
    }

    return [...new Set(inferred)];
  }

  checkCompatibility(
    source: AgentCapabilities,
    target: AgentCapabilities,
  ): {
    compatible: boolean;
    missingCapabilities: string[];
    warnings: string[];
  } {
    const comparison = this.compare(source, target);
    const warnings: string[] = [];
    const missing: string[] = [];

    if (!comparison.compatible) {
      warnings.push("No overlapping capabilities between agents");
    }

    if (source.maxContextLength > target.maxContextLength) {
      warnings.push(
        `Source max context (${source.maxContextLength}) exceeds target (${target.maxContextLength})`,
      );
    }

    if (source.functionCalling && !target.functionCalling) {
      missing.push("function_calling");
    }

    if (source.streaming && !target.streaming) {
      missing.push("streaming");
    }

    for (const memLayer of source.memoryLayers) {
      if (!target.memoryLayers.includes(memLayer)) {
        missing.push(`memory_layer:${memLayer}`);
      }
    }

    return {
      compatible: missing.length === 0 && comparison.compatible,
      missingCapabilities: [...missing, ...comparison.bOnly],
      warnings,
    };
  }

  private _scoreMatch(
    candidate: CapabilityCandidate,
    required: string[],
  ): CapabilityMatch {
    const candidateCaps = this._flattenCapabilities(candidate.capabilities);
    const candidateSet = new Set(candidateCaps.map((c) => c.toLowerCase()));

    const matchedCapabilities: string[] = [];
    const missingCapabilities: string[] = [];

    for (const req of required) {
      if (candidateSet.has(req.toLowerCase())) {
        matchedCapabilities.push(req);
      } else {
        missingCapabilities.push(req);
      }
    }

    const totalRequired = required.length || 1;
    const score = Math.round((matchedCapabilities.length / totalRequired) * 100);

    return {
      agentId: candidate.agentId,
      score,
      matchedCapabilities,
      missingCapabilities,
    };
  }

  private _flattenCapabilities(capabilities: AgentCapabilities): string[] {
    const flat: string[] = [
      ...capabilities.modelFamilies,
      ...capabilities.plugins,
      ...capabilities.custom,
      ...capabilities.supportedMessageTypes,
    ];

    if (capabilities.functionCalling) flat.push("function_calling");
    if (capabilities.streaming) flat.push("streaming");
    flat.push(...capabilities.memoryLayers.map((l: string) => `memory_layer:${l}`));

    return flat;
  }
}
