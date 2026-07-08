import type { Duration } from "@agent-preflight/types";
import type {
  WorkflowDefinition,
  WorkflowStep,
  GraphNode,
  GraphEdge,
  CriticalPath,
} from "./types.js";
import { CycleDetectedError } from "./errors.js";

export class ExecutionGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge[]> = new Map();
  private reverseEdges: Map<string, GraphEdge[]> = new Map();

  constructor(definition?: WorkflowDefinition) {
    if (definition) {
      this.buildFromWorkflow(definition);
    }
  }

  buildFromWorkflow(definition: WorkflowDefinition): void {
    this.nodes.clear();
    this.edges.clear();
    this.reverseEdges.clear();

    const levels = this.computeLevels(definition);

    for (const step of definition.steps) {
      const node: GraphNode = {
        id: step.id,
        stepId: step.id,
        name: step.name,
        type: step.type,
        agentId: step.agentId,
        level: levels.get(step.id) ?? 0,
        estimatedDuration: step.timeout,
        criticalPath: false,
      };
      this.nodes.set(step.id, node);
    }

    for (const step of definition.steps) {
      for (const dep of step.dependsOn) {
        const edge: GraphEdge = {
          source: dep,
          target: step.id,
          type: "DEPENDENCY",
        };
        this.addEdge(edge);
      }
    }

    this.detectCriticalPath();
  }

  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
  }

  addEdge(edge: GraphEdge): void {
    const sourceEdges = this.edges.get(edge.source) ?? [];
    sourceEdges.push(edge);
    this.edges.set(edge.source, sourceEdges);

    const targetEdges = this.reverseEdges.get(edge.target) ?? [];
    targetEdges.push(edge);
    this.reverseEdges.set(edge.target, targetEdges);
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  getNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  getEdges(): GraphEdge[] {
    const all: GraphEdge[] = [];
    for (const edges of this.edges.values()) {
      all.push(...edges);
    }
    return all;
  }

  topologicalSort(): string[] {
    const visited = new Set<string>();
    const stack: string[] = [];
    const temp = new Set<string>();
    const nodeIds = Array.from(this.nodes.keys());

    const visit = (id: string): void => {
      if (temp.has(id)) {
        throw new CycleDetectedError(Array.from(temp));
      }
      if (visited.has(id)) return;

      temp.add(id);
      const outgoing = this.edges.get(id) ?? [];
      for (const edge of outgoing) {
        if (this.nodes.has(edge.target)) {
          visit(edge.target);
        }
      }
      temp.delete(id);
      visited.add(id);
      stack.push(id);
    };

    for (const id of nodeIds) {
      if (!visited.has(id)) {
        visit(id);
      }
    }

    return stack.reverse();
  }

  detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const parent = new Map<string, string>();

    const dfs = (nodeId: string): void => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const outgoing = this.edges.get(nodeId) ?? [];
      for (const edge of outgoing) {
        const target = edge.target;
        if (!visited.has(target)) {
          parent.set(target, nodeId);
          dfs(target);
        } else if (recStack.has(target)) {
          const cycle: string[] = [target];
          let current = nodeId;
          while (current !== target) {
            cycle.push(current);
            current = parent.get(current) ?? "";
          }
          cycle.push(target);
          cycle.reverse();
          cycles.push(cycle);
        }
      }

      recStack.delete(nodeId);
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }

    return cycles;
  }

  detectParallelism(): string[][] {
    const levels = this.buildLevelMap();
    const parallelGroups: string[][] = [];

    for (const [, levelNodes] of levels) {
      if (levelNodes.length > 1) {
        parallelGroups.push(levelNodes);
      }
    }

    return parallelGroups;
  }

  computeCriticalPath(): CriticalPath {
    return this.detectCriticalPath();
  }

  getDependents(nodeId: string): GraphNode[] {
    const outgoing = this.edges.get(nodeId) ?? [];
    return outgoing
      .map((e) => this.nodes.get(e.target))
      .filter((n): n is GraphNode => n !== undefined);
  }

  getDependencies(nodeId: string): GraphNode[] {
    const incoming = this.reverseEdges.get(nodeId) ?? [];
    return incoming
      .map((e) => this.nodes.get(e.source))
      .filter((n): n is GraphNode => n !== undefined);
  }

  getLeafNodes(): GraphNode[] {
    return Array.from(this.nodes.values()).filter((node) => {
      const outgoing = this.edges.get(node.id) ?? [];
      return outgoing.length === 0;
    });
  }

  getRootNodes(): GraphNode[] {
    return Array.from(this.nodes.values()).filter((node) => {
      const incoming = this.reverseEdges.get(node.id) ?? [];
      return incoming.length === 0;
    });
  }

  getLevel(nodeId: string): number {
    return this.nodes.get(nodeId)?.level ?? 0;
  }

  getNodeCount(): number {
    return this.nodes.size;
  }

  getEdgeCount(): number {
    let count = 0;
    for (const edges of this.edges.values()) {
      count += edges.length;
    }
    return count;
  }

  exportMermaid(): string {
    const lines: string[] = ["graph TD"];

    for (const node of this.nodes.values()) {
      const label = node.name.replace(/[^a-zA-Z0-9\s_-]/g, "").slice(0, 30);
      const shape = node.type === "DECISION" ? `{${label}}` :
        node.type === "PARALLEL" ? `[${label}]` :
        node.type === "CONDITION" ? `{${label}}` :
        node.type === "LOOP" ? `(((${label})))` :
        node.type === "WAIT" ? `>${label}]` :
        `[${label}]`;
      lines.push(`    ${node.id}${shape}`);
    }

    for (const edge of this.getEdges()) {
      const style = edge.type === "CONDITIONAL" ? "-->" :
        edge.type === "FEEDBACK" ? "-.->" :
        "-->";
      const label = edge.label ? `|${edge.label}|` : "";
      lines.push(`    ${edge.source} ${style}|${label}| ${edge.target}`);
    }

    return lines.join("\n");
  }

  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.reverseEdges.clear();
  }

  // ----- private -----

  private detectCriticalPath(): CriticalPath {
    const sorted = this.topologicalSort();
    const earliest: Map<string, number> = new Map();
    const latest: Map<string, number> = new Map();

    for (const id of sorted) {
      const node = this.nodes.get(id)!;
      const incoming = this.reverseEdges.get(id) ?? [];
      let maxPred = 0;
      for (const edge of incoming) {
        const predFinish = (earliest.get(edge.source) ?? 0) +
          (this.nodes.get(edge.source)?.estimatedDuration ?? 0);
        maxPred = Math.max(maxPred, predFinish);
      }
      earliest.set(id, maxPred);
    }

    const totalDuration = Math.max(
      ...Array.from(earliest.values()),
      0,
    ) + Math.max(
      ...Array.from(this.nodes.values()).map((n) => n.estimatedDuration),
    );

    for (let i = sorted.length - 1; i >= 0; i--) {
      const id = sorted[i]!;
      const node = this.nodes.get(id)!;
      const outgoing = this.edges.get(id) ?? [];
      let minSucc = totalDuration;
      if (outgoing.length === 0) {
        minSucc = totalDuration - node.estimatedDuration;
      } else {
        for (const edge of outgoing) {
          const succStart = latest.get(edge.target) ?? totalDuration;
          minSucc = Math.min(minSucc, succStart - node.estimatedDuration);
        }
      }
      latest.set(id, minSucc);
    }

    const slack = new Map<string, Duration>();
    const criticalNodes: GraphNode[] = [];

    for (const id of sorted) {
      const node = this.nodes.get(id)!;
      const es = earliest.get(id) ?? 0;
      const ls = latest.get(id) ?? 0;
      const nodeSlack = ls - es;
      slack.set(id, nodeSlack);
      node.criticalPath = nodeSlack === 0;
      if (nodeSlack === 0) {
        criticalNodes.push(node);
      }
    }

    return {
      nodes: criticalNodes,
      totalDuration,
      slack,
    };
  }

  private computeLevels(definition: WorkflowDefinition): Map<string, number> {
    const levels = new Map<string, number>();
    const visited = new Set<string>();

    const visit = (stepId: string, depth: number): void => {
      if (visited.has(stepId)) return;
      visited.add(stepId);
      levels.set(stepId, depth);

      for (const step of definition.steps) {
        if (step.dependsOn.includes(stepId)) {
          visit(step.id, depth + 1);
        }
      }
    };

    const roots = definition.steps.filter((s) => s.dependsOn.length === 0);
    for (const root of roots) {
      visit(root.id, 0);
    }

    return levels;
  }

  private buildLevelMap(): Map<number, string[]> {
    const levels = new Map<number, string[]>();

    for (const node of this.nodes.values()) {
      const existing = levels.get(node.level) ?? [];
      existing.push(node.id);
      levels.set(node.level, existing);
    }

    return levels;
  }
}
