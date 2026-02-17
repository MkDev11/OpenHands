import React, { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ModalBackdrop } from "#/components/shared/modals/modal-backdrop";
import { ModalBody } from "#/components/shared/modals/modal-body";
import { BrandButton } from "#/components/features/settings/brand-button";
import {
  BaseModalTitle,
  BaseModalDescription,
} from "#/components/shared/modals/confirmation-modals/base-modal";
import { I18nKey } from "#/i18n/declaration";
import { Provider } from "#/types/settings";
import { Branch, GitRepository } from "#/types/git";
import { GitRepoDropdown } from "#/components/features/home/git-repo-dropdown/git-repo-dropdown";
import { GitBranchDropdown } from "#/components/features/home/git-branch-dropdown/git-branch-dropdown";

interface OpenRepositoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunch: (repository: GitRepository, branch: Branch) => void;
  defaultProvider?: Provider;
}

export function OpenRepositoryModal({
  isOpen,
  onClose,
  onLaunch,
  defaultProvider = "github",
}: OpenRepositoryModalProps) {
  const { t } = useTranslation();

  const [selectedRepository, setSelectedRepository] =
    useState<GitRepository | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  const handleRepositoryChange = useCallback((repository?: GitRepository) => {
    if (repository) {
      setSelectedRepository(repository);
      setSelectedBranch(null);
    } else {
      setSelectedRepository(null);
      setSelectedBranch(null);
    }
  }, []);

  const handleBranchSelect = useCallback((branch: Branch | null) => {
    setSelectedBranch(branch);
  }, []);

  const handleLaunch = () => {
    if (!selectedRepository || !selectedBranch) return;

    onLaunch(selectedRepository, selectedBranch);
    setSelectedRepository(null);
    setSelectedBranch(null);
    onClose();
  };

  const handleClose = () => {
    setSelectedRepository(null);
    setSelectedBranch(null);
    onClose();
  };

  if (!isOpen) return null;

  const canLaunch = !!selectedRepository && !!selectedBranch;

  return (
    <ModalBackdrop onClose={handleClose}>
      <ModalBody width="medium" className="items-start border border-tertiary">
        <div className="flex flex-col gap-2 w-full">
          <BaseModalTitle title={t(I18nKey.CONVERSATION$OPEN_REPOSITORY)} />
          <BaseModalDescription>
            {t(I18nKey.CONVERSATION$SELECT_OR_INSERT_LINK)}
          </BaseModalDescription>
        </div>

        <GitRepoDropdown
          provider={selectedRepository?.git_provider || defaultProvider}
          value={selectedRepository?.id || null}
          repositoryName={selectedRepository?.full_name || null}
          onChange={handleRepositoryChange}
          placeholder="Search repositories..."
          className="w-full"
        />

        <GitBranchDropdown
          repository={selectedRepository?.full_name || null}
          provider={selectedRepository?.git_provider || defaultProvider}
          selectedBranch={selectedBranch}
          onBranchSelect={handleBranchSelect}
          defaultBranch={selectedRepository?.main_branch || null}
          placeholder="Select branch..."
          disabled={!selectedRepository}
          className="w-full"
        />

        <div
          className="flex flex-col gap-2 w-full"
          onClick={(event) => event.stopPropagation()}
        >
          <BrandButton
            type="button"
            variant="primary"
            onClick={handleLaunch}
            className="w-full"
            isDisabled={!canLaunch}
          >
            {t(I18nKey.BUTTON$LAUNCH)}
          </BrandButton>
          <BrandButton
            type="button"
            variant="secondary"
            onClick={handleClose}
            className="w-full"
          >
            {t(I18nKey.BUTTON$CANCEL)}
          </BrandButton>
        </div>
      </ModalBody>
    </ModalBackdrop>
  );
}
