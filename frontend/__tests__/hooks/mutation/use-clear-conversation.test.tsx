import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ConversationService from "#/api/conversation-service/conversation-service.api";
import V1ConversationService from "#/api/conversation-service/v1-conversation-service.api";
import { useClearConversation } from "#/hooks/mutation/use-clear-conversation";

const mockNavigate = vi.fn();

vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ conversationId: "conv-123" }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("#/utils/custom-toast-handlers", () => ({
  displaySuccessToast: vi.fn(),
  displayErrorToast: vi.fn(),
}));

const mockConversation = {
  conversation_id: "conv-123",
  sandbox_id: "sandbox-456",
  title: "Test Conversation",
  selected_repository: null,
  selected_branch: null,
  git_provider: null,
  last_updated_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  status: "RUNNING" as const,
  runtime_status: null,
  url: null,
  session_api_key: null,
  conversation_version: "V1" as const,
};

vi.mock("#/hooks/query/use-active-conversation", () => ({
  useActiveConversation: () => ({
    data: mockConversation,
  }),
}));

function makeStartTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-789",
    created_by_user_id: null,
    status: "READY",
    detail: null,
    app_conversation_id: "new-conv-999",
    sandbox_id: "sandbox-456",
    agent_server_url: "http://agent-server.local",
    request: {
      sandbox_id: null,
      initial_message: null,
      processors: [],
      llm_model: null,
      selected_repository: null,
      selected_branch: null,
      git_provider: null,
      suggested_task: null,
      title: null,
      trigger: null,
      pr_number: [],
      parent_conversation_id: "conv-123",
      agent_type: "default",
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("useClearConversation", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("calls createConversation with parent_conversation_id and navigates on success", async () => {
    const readyTask = makeStartTask();
    const createSpy = vi
      .spyOn(V1ConversationService, "createConversation")
      .mockResolvedValue(readyTask as never);
    const getStartTaskSpy = vi
      .spyOn(V1ConversationService, "getStartTask")
      .mockResolvedValue(readyTask as never);
    vi.spyOn(ConversationService, "deleteUserConversation").mockResolvedValue(
      undefined as never,
    );

    const { result } = renderHook(() => useClearConversation(), { wrapper });

    await result.current.mutateAsync();

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        "conv-123",
        undefined,
      );
      expect(getStartTaskSpy).toHaveBeenCalledWith("task-789");
      expect(mockNavigate).toHaveBeenCalledWith(
        "/conversations/new-conv-999",
      );
    });
  });

  it("polls getStartTask until status is READY", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const workingTask = makeStartTask({
      status: "WORKING",
      app_conversation_id: null,
    });
    const readyTask = makeStartTask({ status: "READY" });

    vi.spyOn(V1ConversationService, "createConversation").mockResolvedValue(
      workingTask as never,
    );
    vi.spyOn(ConversationService, "deleteUserConversation").mockResolvedValue(
      undefined as never,
    );
    const getStartTaskSpy = vi
      .spyOn(V1ConversationService, "getStartTask")
      .mockResolvedValueOnce(workingTask as never)
      .mockResolvedValueOnce(readyTask as never);

    const { result } = renderHook(() => useClearConversation(), { wrapper });

    const mutatePromise = result.current.mutateAsync();

    await vi.advanceTimersByTimeAsync(2000);
    await mutatePromise;

    await waitFor(() => {
      expect(getStartTaskSpy).toHaveBeenCalledTimes(2);
      expect(mockNavigate).toHaveBeenCalledWith(
        "/conversations/new-conv-999",
      );
    });

    vi.useRealTimers();
  });

  it("throws when task status is ERROR", async () => {
    const errorTask = makeStartTask({
      status: "ERROR",
      detail: "Sandbox crashed",
      app_conversation_id: null,
    });

    vi.spyOn(V1ConversationService, "createConversation").mockResolvedValue(
      errorTask as never,
    );
    vi.spyOn(V1ConversationService, "getStartTask").mockResolvedValue(
      errorTask as never,
    );

    const { result } = renderHook(() => useClearConversation(), { wrapper });

    await expect(result.current.mutateAsync()).rejects.toThrow(
      "Sandbox crashed",
    );
  });

  it("invalidates conversation list queries on success", async () => {
    const readyTask = makeStartTask();

    vi.spyOn(V1ConversationService, "createConversation").mockResolvedValue(
      readyTask as never,
    );
    vi.spyOn(V1ConversationService, "getStartTask").mockResolvedValue(
      readyTask as never,
    );
    vi.spyOn(ConversationService, "deleteUserConversation").mockResolvedValue(
      undefined as never,
    );

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useClearConversation(), { wrapper });

    await result.current.mutateAsync();

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["user", "conversations"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["v1-batch-get-app-conversations"],
      });
    });
  });

  it("deletes the old conversation on success", async () => {
    const readyTask = makeStartTask();

    vi.spyOn(V1ConversationService, "createConversation").mockResolvedValue(
      readyTask as never,
    );
    vi.spyOn(V1ConversationService, "getStartTask").mockResolvedValue(
      readyTask as never,
    );
    const deleteSpy = vi
      .spyOn(ConversationService, "deleteUserConversation")
      .mockResolvedValue(undefined as never);

    const { result } = renderHook(() => useClearConversation(), { wrapper });

    await result.current.mutateAsync();

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith("conv-123");
    });
  });

  it("does not fail if deleting the old conversation throws", async () => {
    const readyTask = makeStartTask();

    vi.spyOn(V1ConversationService, "createConversation").mockResolvedValue(
      readyTask as never,
    );
    vi.spyOn(V1ConversationService, "getStartTask").mockResolvedValue(
      readyTask as never,
    );
    vi.spyOn(ConversationService, "deleteUserConversation").mockRejectedValue(
      new Error("delete failed"),
    );

    const { result } = renderHook(() => useClearConversation(), { wrapper });

    // Should not throw even though delete fails
    await result.current.mutateAsync();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        "/conversations/new-conv-999",
      );
    });
  });
});
