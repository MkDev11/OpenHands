import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { I18nKey } from "#/i18n/declaration";
import ConversationService from "#/api/conversation-service/conversation-service.api";
import V1ConversationService from "#/api/conversation-service/v1-conversation-service.api";
import {
  displayErrorToast,
  displaySuccessToast,
  TOAST_OPTIONS,
} from "#/utils/custom-toast-handlers";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";

export const useClearConversation = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: conversation } = useActiveConversation();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!conversation?.conversation_id || !conversation.sandbox_id) {
        throw new Error("No active conversation or sandbox");
      }

      // Start a new conversation using the existing sandbox
      // This preserves the runtime state while starting fresh
      const startTask = await V1ConversationService.createConversation(
        undefined, // selectedRepository
        undefined, // git_provider
        undefined, // initialUserMsg
        undefined, // selected_branch
        undefined, // conversationInstructions
        undefined, // suggestedTask
        undefined, // trigger
        conversation.conversation_id, // parent_conversation_id - inherits from current conversation
        undefined, // agent_type
      );

      // Poll for the task to complete and get the new conversation ID
      let task = await V1ConversationService.getStartTask(startTask.id);
      const maxAttempts = 60; // 60 seconds timeout
      let attempts = 0;

      /* eslint-disable no-await-in-loop */
      while (
        task &&
        !["READY", "ERROR"].includes(task.status) &&
        attempts < maxAttempts
      ) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => {
          setTimeout(resolve, 1000);
        });
        task = await V1ConversationService.getStartTask(startTask.id);
        attempts += 1;
      }

      if (!task || task.status !== "READY" || !task.app_conversation_id) {
        throw new Error(
          task?.detail || "Failed to create new conversation in sandbox",
        );
      }

      return {
        newConversationId: task.app_conversation_id,
        oldConversationId: conversation.conversation_id,
      };
    },
    onMutate: () => {
      toast.loading(t(I18nKey.CONVERSATION$CLEARING), {
        ...TOAST_OPTIONS,
        id: "clear-conversation",
      });
    },
    onSuccess: (data) => {
      toast.dismiss("clear-conversation");
      displaySuccessToast(t(I18nKey.CONVERSATION$CLEAR_SUCCESS));
      navigate(`/conversations/${data.newConversationId}`);

      // Delete the old conversation and refresh the sidebar in the background
      ConversationService.deleteUserConversation(data.oldConversationId)
        .catch(() => {}) // Best-effort deletion
        .finally(() => {
          queryClient.invalidateQueries({
            queryKey: ["user", "conversations"],
          });
          queryClient.invalidateQueries({
            queryKey: ["v1-batch-get-app-conversations"],
          });
        });
    },
    onError: (error) => {
      toast.dismiss("clear-conversation");
      let clearError = t(I18nKey.CONVERSATION$CLEAR_UNKNOWN_ERROR);
      if (error instanceof Error) {
        clearError = error.message;
      } else if (typeof error === "string") {
        clearError = error;
      }
      displayErrorToast(
        t(I18nKey.CONVERSATION$CLEAR_FAILED, { error: clearError }),
      );
    },
  });

  return mutation;
};
