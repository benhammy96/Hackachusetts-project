/**
 * Server-side access to the same data files the browser uses, so the brief
 * agent's tool results are computed by exactly the same code path as the score
 * card. Cached per process.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { HexIndex, type DataMeta, type HexFile } from "./hexes";
import type { Assumptions } from "./economics";

const DATA_DIR = path.join(process.cwd(), "public", "data");

interface ServerData {
  index: HexIndex;
  meta: DataMeta;
  assumptions: Assumptions;
  briefsCache: Record<string, string>;
}

let cache: Promise<ServerData> | null = null;

async function readJson<T>(name: string): Promise<T> {
  return JSON.parse(await fs.readFile(path.join(DATA_DIR, name), "utf8")) as T;
}

export function getServerData(): Promise<ServerData> {
  if (!cache) {
    cache = (async () => {
      const [file, meta, assumptions] = await Promise.all([
        readJson<HexFile>("hexes.json"),
        readJson<DataMeta>("meta.json"),
        readJson<Assumptions>("assumptions.json"),
      ]);
      let briefsCache: Record<string, string> = {};
      try {
        briefsCache = await readJson<Record<string, string>>("briefs-cache.json");
      } catch {
        briefsCache = {};
      }
      return { index: new HexIndex(file), meta, assumptions, briefsCache };
    })();
  }
  return cache;
}
