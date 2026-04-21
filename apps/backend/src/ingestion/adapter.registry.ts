import type { IngestionAdapter } from "./adapter.interface.js";
import { ExcelAdapter } from "./adapters/excel.adapter.js";
import { ManualAdapter } from "./adapters/manual.adapter.js";
import { ScraperAdapter } from "./adapters/scraper.adapter.js";

class AdapterRegistry {
  private adapters = new Map<string, IngestionAdapter>();

  register(adapter: IngestionAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  get(name: string): IngestionAdapter | undefined {
    return this.adapters.get(name);
  }

  list(): string[] {
    return Array.from(this.adapters.keys());
  }
}

export const adapterRegistry = new AdapterRegistry();

// Register default adapters
adapterRegistry.register(new ExcelAdapter());
adapterRegistry.register(new ManualAdapter());
adapterRegistry.register(new ScraperAdapter());
