declare module "word-extractor" {
  import type { Buffer } from "node:buffer";

  interface ExtractedDocument {
    getBody(options?: { filterUnicode?: boolean }): string;
  }

  class WordExtractor {
    extract(source: Buffer | string): Promise<ExtractedDocument>;
  }

  export = WordExtractor;
}