import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { GitControlBarRepoButton } from "./git-control-bar-repo-button";
import { GitControlBarBranchButton } from "./git-control-bar-branch-button";
import { GitControlBarPullButton } from "./git-control-bar-pull-button";
import { GitControlBarPushButton } from "./git-control-bar-push-button";
import { GitControlBarPrButton } from "./git-control-bar-pr-button";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { useTaskPolling } from "#/hooks/query/use-task-polling";
import { useUnifiedWebSocketStatus } from "#/hooks/use-unified-websocket-status";
import { useSendMessage } from "#/hooks/use-send-message";
import { useUpdateConversationRepository } from "#/hooks/mutation/use-update-conversation-repository";
import { Provider } from "#/types/settings";
import { Branch, GitRepository } from "#/types/git";
import { I18nKey } from "#/i18n/declaration";
import { GitControlBarTooltipWrapper } from "./git-control-bar-tooltip-wrapper";
import { OpenRepositoryModal } from "./open-repository-modal";
import { displayErrorToast } from "#/utils/custom-toast-handlers";

interface GitControlBarProps {
  onSuggestionsClick: (value: string) => void;
}

export function GitControlBar({ onSuggestionsClick }: GitControlBarProps) {
  const { t } = useTranslation();
  const { conversationId } = useParams<{ conversationId: string }>();
  const [isOpenRepoModalOpen, setIsOpenRepoModalOpen] = useState(false);

  const { data: conversation } = useActiveConversation();
  const { repositoryInfo } = useTaskPolling();
  const webSocketStatus = useUnifiedWebSocketStatus();
  const { send } = useSendMessage();
  const { mutate: updateRepository } = useUpdateConversationRepository();

  // Priority: conversation data > task data
  // This ensures we show repository info immediately from task, then transition to conversation data
  const selectedRepository =
    conversation?.selected_repository || repositoryInfo?.selectedRepository;
  const gitProvider = (conversation?.git_provider ||
    repositoryInfo?.gitProvider) as Provider;
  const selectedBranch =
    conversation?.selected_branch || repositoryInfo?.selectedBranch;

  const hasRepository = !!selectedRepository;

  // Enable buttons only when conversation exists and WS is connected
  const isConversationReady = !!conversation && webSocketStatus === "CONNECTED";

  const handleLaunchRepository = (
    repository: GitRepository,
    branch: Branch,
  ) => {
    if (!conversationId) return;

    // Note: We update repository metadata first, then send clone command.
    // The clone command is sent to the agent via WebSocket (fire-and-forget).
    // If cloning fails, the agent will report the error in the chat,
    // and the user can retry or change the repository.
    // This is a trade-off: immediate UI feedback vs. strict atomicity.
    updateRepository(
      {
        conversationId,
        repository: repository.full_name,
        branch: branch.name,
        gitProvider: repository.git_provider,
      },
      {
        onSuccess: () => {
          // Check WebSocket status before sending clone command
          if (webSocketStatus !== "CONNECTED") {
            displayErrorToast(
              t(I18nKey.CONVERSATION$CLONE_COMMAND_FAILED_DISCONNECTED),
            );
            return;
          }

          // Send clone command to agent after metadata is updated
          const clonePrompt = `Clone ${repository.full_name} and checkout branch ${branch.name}.`;
          send({
            action: "message",
            args: {
              content: clonePrompt,
              timestamp: new Date().toISOString(),
            },
          });
        },
      },
    );
  };

  return (
    <div className="flex flex-row items-center">
      <div className="flex flex-row gap-2.5 items-center overflow-x-auto flex-wrap md:flex-nowrap relative scrollbar-hide">
        {hasRepository ? (
          <GitControlBarRepoButton
            selectedRepository={selectedRepository}
            gitProvider={gitProvider}
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsOpenRepoModalOpen(true)}
            disabled={!isConversationReady}
            className={`px-2 py-1 text-xs border rounded-full transition-colors ${
              isConversationReady
                ? "text-[#A3A3A3] hover:text-white border-[#525252] hover:border-[#454545]"
                : "text-[#6B6B6B] border-[#3D3D3D] cursor-not-allowed"
            }`}
            title={
              isConversationReady
                ? t(I18nKey.CONVERSATION$NO_REPO_CONNECTED)
                : t(I18nKey.CHAT_INTERFACE$CONNECTING)
            }
          >
            {t(I18nKey.CONVERSATION$NO_REPO_CONNECTED)}
          </button>
        )}

        <GitControlBarTooltipWrapper
          tooltipMessage={t(I18nKey.COMMON$GIT_TOOLS_DISABLED_CONTENT)}
          testId="git-control-bar-branch-button-tooltip"
          shouldShowTooltip={!hasRepository}
        >
          <GitControlBarBranchButton
            selectedBranch={selectedBranch}
            selectedRepository={selectedRepository}
            gitProvider={gitProvider}
          />
        </GitControlBarTooltipWrapper>

        {hasRepository ? (
          <>
            <GitControlBarTooltipWrapper
              tooltipMessage={t(I18nKey.COMMON$GIT_TOOLS_DISABLED_CONTENT)}
              testId="git-control-bar-pull-button-tooltip"
              shouldShowTooltip={!hasRepository}
            >
              <GitControlBarPullButton
                onSuggestionsClick={onSuggestionsClick}
                isConversationReady={isConversationReady}
              />
            </GitControlBarTooltipWrapper>

            <GitControlBarTooltipWrapper
              tooltipMessage={t(I18nKey.COMMON$GIT_TOOLS_DISABLED_CONTENT)}
              testId="git-control-bar-push-button-tooltip"
              shouldShowTooltip={!hasRepository}
            >
              <GitControlBarPushButton
                onSuggestionsClick={onSuggestionsClick}
                hasRepository={hasRepository}
                currentGitProvider={gitProvider}
                isConversationReady={isConversationReady}
              />
            </GitControlBarTooltipWrapper>

            <GitControlBarTooltipWrapper
              tooltipMessage={t(I18nKey.COMMON$GIT_TOOLS_DISABLED_CONTENT)}
              testId="git-control-bar-pr-button-tooltip"
              shouldShowTooltip={!hasRepository}
            >
              <GitControlBarPrButton
                onSuggestionsClick={onSuggestionsClick}
                hasRepository={hasRepository}
                currentGitProvider={gitProvider}
                isConversationReady={isConversationReady}
              />
            </GitControlBarTooltipWrapper>
          </>
        ) : null}
      </div>

      <OpenRepositoryModal
        isOpen={isOpenRepoModalOpen}
        onClose={() => setIsOpenRepoModalOpen(false)}
        onLaunch={handleLaunchRepository}
        defaultProvider={gitProvider}
      />
    </div>
  );
}
