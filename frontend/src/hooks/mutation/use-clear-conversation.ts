import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { I18nKey } from "#/i18n/declaration";
import V1ConversationService from "#/api/conversation-service/v1-conversation-service.api";
import {
  displayErrorToast,
  displaySuccessToast,
} from "#/utils/custom-toast-handlers";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";

export const useClearConversation = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: conversation } = useActiveConversation();

  return useMutation({
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

      return { newConversationId: task.app_conversation_id };
    },
    onSuccess: (data) => {
      displaySuccessToast(t(I18nKey.CONVERSATION$CLEAR_SUCCESS));
      navigate(`/conversations/${data.newConversationId}`);
    },
    onError: (error) => {
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
};
