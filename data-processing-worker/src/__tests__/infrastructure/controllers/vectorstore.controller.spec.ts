import { VectorStoreController } from "@infrastructure/controllers/vectorstore.controller";
import { MongoDBVectorStoreAdapter } from "@infrastructure/adapters/vectorstores/mongodb.vectorstore";
import { Document } from "@domain/entities/document.entity";
import { mock, MockProxy } from "jest-mock-extended";

describe("VectorStoreController (Phase 7 Integration)", () => {
  let controller: VectorStoreController;
  let vectorStore: MockProxy<MongoDBVectorStoreAdapter>;

  beforeEach(() => {
    vectorStore = mock<MongoDBVectorStoreAdapter>();
    controller = new VectorStoreController(vectorStore);
  });

  describe("search endpoint", () => {
    it("001: searches with valid embedding and returns results", async () => {
      const results = [
        { document: new Document("d1", "content", { source: "s", sourceType: "file" }), score: 0.95 },
        { document: new Document("d2", "other", { source: "s", sourceType: "file" }), score: 0.85 },
      ];
      vectorStore.similaritySearch.mockResolvedValue(results);

      const res = await controller.search({ queryEmbedding: [0.1, 0.2], limit: 2 });

      expect(res.results.length).toBe(2);
      expect(res.count).toBe(2);
      expect(vectorStore.similaritySearch).toHaveBeenCalledWith([0.1, 0.2], 2, undefined);
    });

    it("002: search with default limit of 5", async () => {
      const results = Array.from({ length: 5 }, (_, i) => ({
        document: new Document(`d${i}`, `c${i}`, { source: "s", sourceType: "file" }),
        score: 0.9 - i * 0.05,
      }));
      vectorStore.similaritySearch.mockResolvedValue(results);

      const res = await controller.search({ queryEmbedding: [0.1] });

      expect(vectorStore.similaritySearch).toHaveBeenCalledWith([0.1], 5, undefined);
      expect(res.count).toBe(5);
    });

    it("003: search with metadata filter", async () => {
      vectorStore.similaritySearch.mockResolvedValue([]);

      await controller.search({
        queryEmbedding: [0.1],
        limit: 10,
        filter: { sourceType: "file", mimeType: "pdf" },
      });

      expect(vectorStore.similaritySearch).toHaveBeenCalledWith(
        [0.1],
        10,
        expect.objectContaining({ sourceType: "file" })
      );
    });

    it("004: search throws on missing embedding", async () => {
      await expect(
        controller.search({ queryEmbedding: null as any })
      ).rejects.toThrow("queryEmbedding must be an array");
    });

    it("005: search returns empty results gracefully", async () => {
      vectorStore.similaritySearch.mockResolvedValue([]);

      const res = await controller.search({ queryEmbedding: [0.1] });

      expect(res.count).toBe(0);
      expect(res.results).toEqual([]);
    });
  });

  describe("hybrid-search endpoint", () => {
    it("006: hybrid search combines text and vector results", async () => {
      const results = [
        { document: new Document("d1", "hybrid", { source: "s", sourceType: "file" }), score: 0.92 },
      ];
      vectorStore.hybridSearch.mockResolvedValue(results);

      const res = await controller.hybridSearch({
        queryEmbedding: [0.1],
        queryText: "search query",
        limit: 5,
      });

      expect(res.count).toBe(1);
      expect(vectorStore.hybridSearch).toHaveBeenCalledWith([0.1], "search query", 5, undefined);
    });

    it("007: hybrid search throws on missing embedding", async () => {
      await expect(
        controller.hybridSearch({
          queryEmbedding: null as any,
          queryText: "query",
          limit: 5,
        })
      ).rejects.toThrow();
    });

    it("008: hybrid search throws on missing text", async () => {
      await expect(
        controller.hybridSearch({
          queryEmbedding: [0.1],
          queryText: "",
          limit: 5,
        })
      ).rejects.toThrow();
    });

    it("009: hybrid search with filter", async () => {
      vectorStore.hybridSearch.mockResolvedValue([]);

      await controller.hybridSearch({
        queryEmbedding: [0.1],
        queryText: "query",
        limit: 10,
        filter: { sourceType: "url" },
      });

      expect(vectorStore.hybridSearch).toHaveBeenCalledWith([0.1], "query", 10, expect.any(Object));
    });

    it("010: hybrid search default limit", async () => {
      vectorStore.hybridSearch.mockResolvedValue([]);

      await controller.hybridSearch({
        queryEmbedding: [0.1],
        queryText: "query",
      });

      expect(vectorStore.hybridSearch).toHaveBeenCalledWith([0.1], "query", 5, undefined);
    });
  });

  describe("getDocument endpoint", () => {
    it("011: gets document by ID", async () => {
      const doc = new Document("d1", "content", { source: "s", sourceType: "file" });
      vectorStore.getDocument.mockResolvedValue(doc);

      const res = await controller.getDocument("d1");

      expect(res.document).toBe(doc);
      expect(vectorStore.getDocument).toHaveBeenCalledWith("d1");
    });

    it("012: returns error when document not found", async () => {
      vectorStore.getDocument.mockResolvedValue(null);

      const res = await controller.getDocument("missing");

      expect(res.error).toBe("Document not found");
      expect(res.id).toBe("missing");
    });

    it("013: getDocument with multiple IDs in sequence", async () => {
      const doc1 = new Document("d1", "c1", { source: "s", sourceType: "file" });
      const doc2 = new Document("d2", "c2", { source: "s", sourceType: "file" });

      vectorStore.getDocument.mockResolvedValueOnce(doc1).mockResolvedValueOnce(doc2);

      const res1 = await controller.getDocument("d1");
      const res2 = await controller.getDocument("d2");

      expect(res1.document?.id).toBe("d1");
      expect(res2.document?.id).toBe("d2");
      expect(vectorStore.getDocument).toHaveBeenCalledTimes(2);
    });

    it("014: getDocument concurrent calls", async () => {
      const doc = new Document("d1", "content", { source: "s", sourceType: "file" });
      vectorStore.getDocument.mockResolvedValue(doc);

      await Promise.all([
        controller.getDocument("d1"),
        controller.getDocument("d1"),
        controller.getDocument("d1"),
      ]);

      expect(vectorStore.getDocument).toHaveBeenCalledTimes(3);
    });

    it("015: getDocument with metadata", async () => {
      const doc = new Document("d1", "content", { source: "file.pdf", sourceType: "file" });
      vectorStore.getDocument.mockResolvedValue(doc);

      const res = await controller.getDocument("d1");

      expect(res.document?.metadata).toEqual({ source: "file.pdf", sourceType: "file" });
    });

    it("016: search with high-dimensional vectors", async () => {
      const results = Array.from({ length: 3 }, (_, i) => ({
        document: new Document(`d${i}`, `c${i}`, { source: "s", sourceType: "file" }),
        score: 0.9 - i * 0.1,
      }));
      vectorStore.similaritySearch.mockResolvedValue(results);

      const embed1536 = Array.from({ length: 1536 }, () => Math.random());
      const res = await controller.search({ queryEmbedding: embed1536, limit: 3 });

      expect(res.count).toBe(3);
      expect(vectorStore.similaritySearch).toHaveBeenCalledWith(embed1536, 3, undefined);
    });

    it("017: search performance with repeated calls", async () => {
      vectorStore.similaritySearch.mockResolvedValue([]);

      for (let i = 0; i < 10; i++) {
        await controller.search({ queryEmbedding: [0.1 * i] });
      }

      expect(vectorStore.similaritySearch).toHaveBeenCalledTimes(10);
    });

    it("018: hybrid search with large result set", async () => {
      const results = Array.from({ length: 50 }, (_, i) => ({
        document: new Document(`d${i}`, `c${i}`, { source: "s", sourceType: "file" }),
        score: 0.99 - i * 0.01,
      }));
      vectorStore.hybridSearch.mockResolvedValue(results);

      const res = await controller.hybridSearch({
        queryEmbedding: [0.1],
        queryText: "complex query",
        limit: 50,
      });

      expect(res.count).toBe(50);
    });

    it("019: search with complex metadata filter", async () => {
      vectorStore.similaritySearch.mockResolvedValue([]);

      await controller.search({
        queryEmbedding: [0.1],
        filter: { sourceType: "file", mimeType: "pdf", createdAfter: new Date("2025-01-01") },
      });

      expect(vectorStore.similaritySearch).toHaveBeenCalledWith(
        [0.1],
        5,
        expect.objectContaining({ sourceType: "file" })
      );
    });

    it("020: search error handling", async () => {
      vectorStore.similaritySearch.mockRejectedValue(new Error("search service error"));

      await expect(
        controller.search({ queryEmbedding: [0.1] })
      ).rejects.toThrow("search service error");
    });
  });

  describe("updateDocument endpoint", () => {
    it("021: updates document content", async () => {
      vectorStore.updateDocument.mockResolvedValue(undefined);

      const res = await controller.updateDocument("d1", {
        content: "new content",
      });

      expect(res.message).toBe("Document updated successfully");
      expect(res.id).toBe("d1");
      expect(vectorStore.updateDocument).toHaveBeenCalledWith("d1", expect.objectContaining({ content: "new content" }));
    });

    it("022: update with metadata", async () => {
      vectorStore.updateDocument.mockResolvedValue(undefined);

      await controller.updateDocument("d1", {
        metadata: { source: "updated.pdf", sourceType: "file" },
      });

      expect(vectorStore.updateDocument).toHaveBeenCalled();
    });

    it("023: update both content and metadata", async () => {
      vectorStore.updateDocument.mockResolvedValue(undefined);

      await controller.updateDocument("d1", {
        content: "new",
        metadata: { source: "file2.pdf", sourceType: "file" },
      });

      expect(vectorStore.updateDocument).toHaveBeenCalled();
    });

    it("024: update throws on error", async () => {
      vectorStore.updateDocument.mockRejectedValue(new Error("update failed"));

      await expect(
        controller.updateDocument("d1", { content: "new" })
      ).rejects.toThrow("update failed");
    });

    it("025: update concurrent calls", async () => {
      vectorStore.updateDocument.mockResolvedValue(undefined);

      await Promise.all([
        controller.updateDocument("d1", { content: "new1" }),
        controller.updateDocument("d2", { content: "new2" }),
      ]);

      expect(vectorStore.updateDocument).toHaveBeenCalledTimes(2);
    });
  });

  describe("deleteDocuments endpoint", () => {
    it("026: deletes multiple documents", async () => {
      vectorStore.deleteDocuments.mockResolvedValue(undefined);

      const res = await controller.deleteDocuments({ ids: ["d1", "d2"] });

      expect(res.message).toBe("Documents deleted successfully");
      expect(res.deletedCount).toBe(2);
      expect(vectorStore.deleteDocuments).toHaveBeenCalledWith(["d1", "d2"]);
    });

    it("027: delete empty list", async () => {
      vectorStore.deleteDocuments.mockResolvedValue(undefined);

      const res = await controller.deleteDocuments({ ids: [] });

      expect(res.deletedCount).toBe(0);
    });

    it("028: delete non-existent IDs", async () => {
      vectorStore.deleteDocuments.mockResolvedValue(undefined);

      const res = await controller.deleteDocuments({ ids: ["nonexistent"] });

      expect(res.deletedCount).toBe(1);
    });

    it("029: delete concurrent calls", async () => {
      vectorStore.deleteDocuments.mockResolvedValue(undefined);

      await Promise.all([
        controller.deleteDocuments({ ids: ["d1"] }),
        controller.deleteDocuments({ ids: ["d2"] }),
      ]);

      expect(vectorStore.deleteDocuments).toHaveBeenCalledTimes(2);
    });

    it("030: delete error handling", async () => {
      vectorStore.deleteDocuments.mockRejectedValue(new Error("deletion failed"));

      await expect(
        controller.deleteDocuments({ ids: ["d1"] })
      ).rejects.toThrow("deletion failed");
    });
  });
});
