import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { I18nKey } from "#/i18n/declaration";
import V1ConversationService from "#/api/conversation-service/v1-conversation-service.api";
import {
  displayErrorToast,
  displaySuccessToast,
} from "#/utils/custom-toast-handlers";

export const useClearConversation = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (variables: { conversationId: string }) =>
      V1ConversationService.clearConversation(variables.conversationId),
    onSuccess: (data) => {
      if (!data.new_conversation_id) {
        displayErrorToast(t(I18nKey.CONVERSATION$CLEAR_NO_NEW_ID));
        return;
      }
      displaySuccessToast(data.message);
      navigate(`/conversations/${data.new_conversation_id}`);
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
