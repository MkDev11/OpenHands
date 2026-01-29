import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { ModalBackdrop } from "#/components/shared/modals/modal-backdrop";
import { ModalBody } from "#/components/shared/modals/modal-body";
import { ModalButton } from "#/components/shared/buttons/modal-button";
import { I18nKey } from "#/i18n/declaration";
import { Provider } from "#/types/settings";
import { GitRepoDropdown } from "#/components/features/home/git-repo-dropdown/git-repo-dropdown";
import { useUpdateConversationRepository } from "#/hooks/mutation/use-update-conversation-repository";

interface ChangeRepositoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRepository?: string | null;
  currentBranch?: string | null;
  currentProvider?: Provider | null;
}

interface SelectedRepo {
  full_name: string;
  main_branch?: string;
  git_provider: Provider;
}

export function ChangeRepositoryModal({
  isOpen,
  onClose,
  currentRepository,
  currentBranch,
  currentProvider,
}: ChangeRepositoryModalProps) {
  const { t } = useTranslation();
  const { conversationId } = useParams<{ conversationId: string }>();
  const { mutate: updateRepository, isPending } =
    useUpdateConversationRepository();

  const [selectedRepository, setSelectedRepository] =
    useState<SelectedRepo | null>(null);

  const defaultProvider: Provider = currentProvider || "github";

  const handleRepositoryChange = (repository?: {
    full_name: string;
    main_branch?: string;
    git_provider: Provider;
  }) => {
    if (repository) {
      setSelectedRepository(repository);
    } else {
      setSelectedRepository(null);
    }
  };

  const handleSubmit = () => {
    if (!conversationId) return;

    updateRepository(
      {
        conversationId,
        repository: selectedRepository?.full_name || null,
        branch: selectedRepository?.main_branch || null,
        gitProvider: selectedRepository?.git_provider || defaultProvider,
      },
      {
        onSuccess: () => {
          onClose();
        },
      },
    );
  };

  const handleRemoveRepository = () => {
    if (!conversationId) return;

    updateRepository(
      {
        conversationId,
        repository: null,
        branch: null,
        gitProvider: null,
      },
      {
        onSuccess: () => {
          onClose();
        },
      },
    );
  };

  if (!isOpen) return null;

  const hasRepository = !!currentRepository;
  const title = hasRepository
    ? t(I18nKey.CONVERSATION$CHANGE_REPOSITORY)
    : t(I18nKey.CONVERSATION$ATTACH_REPOSITORY);

  return (
    <ModalBackdrop onClose={onClose}>
      <ModalBody width="medium">
        <div className="flex flex-col gap-4 w-full">
          <h2 className="text-xl font-semibold text-white">{title}</h2>

          {hasRepository && (
            <div className="text-sm text-[#A3A3A3]">
              {`${currentRepository}${currentBranch ? ` (${currentBranch})` : ""}`}
            </div>
          )}

          <GitRepoDropdown
            provider={defaultProvider}
            value={selectedRepository?.full_name}
            onChange={handleRepositoryChange}
            placeholder="Search repositories..."
          />

          <div className="flex flex-col gap-2 w-full mt-4">
            <ModalButton
              onClick={handleSubmit}
              text={
                selectedRepository
                  ? `Select ${selectedRepository.full_name}`
                  : "Select Repository"
              }
              className="bg-[#4465DB] text-white"
              disabled={!selectedRepository || isPending}
            />
            {hasRepository && (
              <ModalButton
                onClick={handleRemoveRepository}
                text="Remove Repository"
                className="bg-transparent text-[#F87171] border border-[#F87171]"
                disabled={isPending}
              />
            )}
            <ModalButton
              onClick={onClose}
              text={t(I18nKey.BUTTON$CANCEL)}
              className="bg-transparent text-white border border-[#525252]"
              disabled={isPending}
            />
          </div>
        </div>
      </ModalBody>
    </ModalBackdrop>
  );
}
