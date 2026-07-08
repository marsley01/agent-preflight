import { v4 as uuidv4 } from "uuid";
import type { EvalDataset, EvalItem } from "./types.js";

export interface DatasetSplit {
  train: EvalDataset;
  test: EvalDataset;
  validation: EvalDataset;
}

export class DatasetManager {
  private datasets: Map<string, EvalDataset> = new Map();

  create(name: string, description: string, items: EvalItem[]): EvalDataset {
    const dataset: EvalDataset = {
      id: uuidv4(),
      name,
      description,
      items: [...items],
      version: "1.0.0",
      createdAt: new Date().toISOString(),
      tags: [],
    };

    this.datasets.set(dataset.id, dataset);
    return dataset;
  }

  load(id: string): EvalDataset | undefined {
    return this.datasets.get(id);
  }

  save(dataset: EvalDataset): void {
    this.datasets.set(dataset.id, { ...dataset });
  }

  list(): EvalDataset[] {
    return Array.from(this.datasets.values());
  }

  delete(id: string): boolean {
    return this.datasets.delete(id);
  }

  duplicate(id: string, newName?: string): EvalDataset | undefined {
    const original = this.datasets.get(id);
    if (!original) return undefined;

    const copy: EvalDataset = {
      ...original,
      id: uuidv4(),
      name: newName ?? `${original.name} (copy)`,
      createdAt: new Date().toISOString(),
    };

    this.datasets.set(copy.id, copy);
    return copy;
  }

  split(
    dataset: EvalDataset,
    trainRatio = 0.7,
    testRatio = 0.15,
    validationRatio = 0.15,
  ): DatasetSplit {
    const total = dataset.items.length;
    const trainCount = Math.floor(total * trainRatio);
    const testCount = Math.floor(total * testRatio);

    const shuffled = [...dataset.items].sort(() => Math.random() - 0.5);

    const train = shuffled.slice(0, trainCount);
    const test = shuffled.slice(trainCount, trainCount + testCount);
    const validation = shuffled.slice(trainCount + testCount);

    return {
      train: {
        ...dataset,
        id: `${dataset.id}-train`,
        name: `${dataset.name} (train)`,
        items: train,
      },
      test: {
        ...dataset,
        id: `${dataset.id}-test`,
        name: `${dataset.name} (test)`,
        items: test,
      },
      validation: {
        ...dataset,
        id: `${dataset.id}-val`,
        name: `${dataset.name} (validation)`,
        items: validation,
      },
    };
  }

  augment(dataset: EvalDataset, augmentFn: (item: EvalItem) => EvalItem[]): EvalDataset {
    const augmentedItems: EvalItem[] = [];

    for (const item of dataset.items) {
      augmentedItems.push(item);
      const variants = augmentFn(item);
      augmentedItems.push(...variants);
    }

    return {
      ...dataset,
      id: `${dataset.id}-augmented`,
      name: `${dataset.name} (augmented)`,
      items: augmentedItems,
      version: `${dataset.version ?? "1.0.0"}+augmented`,
    };
  }

  importJSON(jsonString: string): EvalDataset {
    const data = JSON.parse(jsonString) as {
      name?: string;
      description?: string;
      items?: Array<{
        input?: string;
        expectedOutput?: string;
        context?: Record<string, unknown>;
        tags?: string[];
      }>;
    };

    const items: EvalItem[] = (data.items ?? []).map((item) => ({
      input: item.input ?? "",
      expectedOutput: item.expectedOutput ?? "",
      context: item.context ?? {},
      tags: item.tags ?? [],
    }));

    return this.create(
      data.name ?? "imported-dataset",
      data.description ?? "",
      items,
    );
  }

  importCSV(csvString: string): EvalDataset {
    const lines = csvString.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      throw new Error("CSV must have a header and at least one data row");
    }

    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    const inputIdx = headers.indexOf("input");
    const expectedIdx = headers.indexOf("expectedOutput");

    if (inputIdx === -1 || expectedIdx === -1) {
      throw new Error("CSV must have 'input' and 'expectedOutput' columns");
    }

    const items: EvalItem[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      items.push({
        input: cols[inputIdx] ?? "",
        expectedOutput: cols[expectedIdx] ?? "",
        context: {},
        tags: [],
      });
    }

    return this.create("imported-csv", `Imported from CSV (${items.length} items)`, items);
  }

  search(query: string): EvalDataset[] {
    const lower = query.toLowerCase();
    return this.list().filter(
      (d) =>
        d.name.toLowerCase().includes(lower) ||
        d.description.toLowerCase().includes(lower) ||
        d.tags?.some((t) => t.toLowerCase().includes(lower)),
    );
  }
}

interface DatasetSplit {
  train: EvalDataset;
  test: EvalDataset;
  validation: EvalDataset;
}