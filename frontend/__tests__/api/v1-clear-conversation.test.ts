import { describe, expect, it, vi } from "vitest";
import V1ConversationService from "#/api/conversation-service/v1-conversation-service.api";

const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }));
vi.mock("#/api/open-hands-axios", () => ({
  openHands: { post: mockPost },
}));

describe("V1ConversationService.clearConversation", () => {
  it("calls the correct endpoint with the conversation ID", async () => {
    const conversationId = "abc123";
    mockPost.mockResolvedValue({
      data: {
        message: "Conversation history cleared. Runtime state preserved.",
        new_conversation_id: "def456",
        parent_conversation_id: "abc123",
        status: "running",
      },
    });

    const result =
      await V1ConversationService.clearConversation(conversationId);

    expect(mockPost).toHaveBeenCalledWith(
      `/api/v1/app-conversations/${conversationId}/clear`,
    );
    expect(result.new_conversation_id).toBe("def456");
    expect(result.parent_conversation_id).toBe("abc123");
  });

  it("throws when response is missing new_conversation_id", async () => {
    mockPost.mockResolvedValue({
      data: {
        message: "Cleared",
        new_conversation_id: "",
        parent_conversation_id: "abc123",
        status: "running",
      },
    });

    await expect(
      V1ConversationService.clearConversation("abc123"),
    ).rejects.toThrow("Invalid response from server: missing required fields");
  });

  it("throws when response is missing parent_conversation_id", async () => {
    mockPost.mockResolvedValue({
      data: {
        message: "Cleared",
        new_conversation_id: "def456",
        parent_conversation_id: "",
        status: "running",
      },
    });

    await expect(
      V1ConversationService.clearConversation("abc123"),
    ).rejects.toThrow("Invalid response from server: missing required fields");
  });
});
