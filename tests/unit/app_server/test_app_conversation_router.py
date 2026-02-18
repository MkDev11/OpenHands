"""Unit tests for the app_conversation_router endpoints.

This module tests the batch_get_app_conversations and clear_conversation endpoints,
focusing on UUID string parsing, validation, and error handling.
"""

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException, status

from openhands.app_server.app_conversation.app_conversation_models import (
    AppConversation,
)
from openhands.app_server.app_conversation.app_conversation_router import (
    batch_get_app_conversations,
    clear_conversation,
)
from openhands.app_server.sandbox.sandbox_models import SandboxStatus


def _make_mock_app_conversation(conversation_id=None, user_id='test-user'):
    """Create a mock AppConversation for testing."""
    if conversation_id is None:
        conversation_id = uuid4()
    return AppConversation(
        id=conversation_id,
        created_by_user_id=user_id,
        sandbox_id=str(uuid4()),
        sandbox_status=SandboxStatus.RUNNING,
    )


def _make_mock_service(
    get_conversation_return=None,
    batch_get_return=None,
):
    """Create a mock AppConversationService for testing."""
    service = MagicMock()
    service.get_app_conversation = AsyncMock(return_value=get_conversation_return)
    service.batch_get_app_conversations = AsyncMock(return_value=batch_get_return or [])
    return service


@pytest.mark.asyncio
class TestBatchGetAppConversations:
    """Test suite for batch_get_app_conversations endpoint."""

    async def test_accepts_uuids_with_dashes(self):
        """Test that standard UUIDs with dashes are accepted.

        Arrange: Create UUIDs with dashes and mock service
        Act: Call batch_get_app_conversations
        Assert: Service is called with parsed UUIDs
        """
        # Arrange
        uuid1 = uuid4()
        uuid2 = uuid4()
        ids = [str(uuid1), str(uuid2)]

        mock_conversations = [
            _make_mock_app_conversation(uuid1),
            _make_mock_app_conversation(uuid2),
        ]
        mock_service = _make_mock_service(batch_get_return=mock_conversations)

        # Act
        result = await batch_get_app_conversations(
            ids=ids,
            app_conversation_service=mock_service,
        )

        # Assert
        mock_service.batch_get_app_conversations.assert_called_once()
        call_args = mock_service.batch_get_app_conversations.call_args[0][0]
        assert len(call_args) == 2
        assert call_args[0] == uuid1
        assert call_args[1] == uuid2
        assert result == mock_conversations

    async def test_accepts_uuids_without_dashes(self):
        """Test that UUIDs without dashes are accepted and correctly parsed.

        Arrange: Create UUIDs without dashes
        Act: Call batch_get_app_conversations
        Assert: Service is called with correctly parsed UUIDs
        """
        # Arrange
        uuid1 = uuid4()
        uuid2 = uuid4()
        # Remove dashes from UUID strings
        ids = [str(uuid1).replace('-', ''), str(uuid2).replace('-', '')]

        mock_conversations = [
            _make_mock_app_conversation(uuid1),
            _make_mock_app_conversation(uuid2),
        ]
        mock_service = _make_mock_service(batch_get_return=mock_conversations)

        # Act
        result = await batch_get_app_conversations(
            ids=ids,
            app_conversation_service=mock_service,
        )

        # Assert
        mock_service.batch_get_app_conversations.assert_called_once()
        call_args = mock_service.batch_get_app_conversations.call_args[0][0]
        assert len(call_args) == 2
        assert call_args[0] == uuid1
        assert call_args[1] == uuid2
        assert result == mock_conversations

    async def test_returns_400_for_invalid_uuid_strings(self):
        """Test that invalid UUID strings return 400 Bad Request.

        Arrange: Create list with invalid UUID strings
        Act: Call batch_get_app_conversations
        Assert: HTTPException is raised with 400 status and details about invalid IDs
        """
        # Arrange
        valid_uuid = str(uuid4())
        invalid_ids = ['not-a-uuid', 'also-invalid', '12345']
        ids = [valid_uuid] + invalid_ids

        mock_service = _make_mock_service()

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await batch_get_app_conversations(
                ids=ids,
                app_conversation_service=mock_service,
            )

        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Invalid UUID format' in exc_info.value.detail
        # All invalid IDs should be mentioned in the error
        for invalid_id in invalid_ids:
            assert invalid_id in exc_info.value.detail

    async def test_returns_400_for_too_many_ids(self):
        """Test that requesting too many IDs returns 400 Bad Request.

        Arrange: Create list with 100+ IDs
        Act: Call batch_get_app_conversations
        Assert: HTTPException is raised with 400 status
        """
        # Arrange
        ids = [str(uuid4()) for _ in range(100)]
        mock_service = _make_mock_service()

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await batch_get_app_conversations(
                ids=ids,
                app_conversation_service=mock_service,
            )

        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Too many ids' in exc_info.value.detail

    async def test_returns_empty_list_for_empty_input(self):
        """Test that empty input returns empty list.

        Arrange: Create empty list of IDs
        Act: Call batch_get_app_conversations
        Assert: Empty list is returned
        """
        # Arrange
        mock_service = _make_mock_service(batch_get_return=[])

        # Act
        result = await batch_get_app_conversations(
            ids=[],
            app_conversation_service=mock_service,
        )

        # Assert
        assert result == []
        mock_service.batch_get_app_conversations.assert_called_once_with([])

    async def test_returns_none_for_missing_conversations(self):
        """Test that None is returned for conversations that don't exist.

        Arrange: Request IDs where some don't exist
        Act: Call batch_get_app_conversations
        Assert: Result contains None for missing conversations
        """
        # Arrange
        uuid1 = uuid4()
        uuid2 = uuid4()
        ids = [str(uuid1), str(uuid2)]

        # Only first conversation exists
        mock_service = _make_mock_service(
            batch_get_return=[_make_mock_app_conversation(uuid1), None]
        )

        # Act
        result = await batch_get_app_conversations(
            ids=ids,
            app_conversation_service=mock_service,
        )

        # Assert
        assert len(result) == 2
        assert result[0] is not None
        assert result[0].id == uuid1
        assert result[1] is None


def _make_mock_user_context(user_id='test-user'):
    """Create a mock UserContext for testing."""
    context = MagicMock()
    context.get_user_id = AsyncMock(return_value=user_id)
    return context


def _make_mock_request():
    """Create a mock FastAPI Request for testing."""
    request = MagicMock()
    request.state = MagicMock()
    return request


def _make_mock_db_session():
    """Create a mock AsyncSession for testing."""
    session = MagicMock()
    session.close = AsyncMock()
    return session


def _make_mock_httpx_client():
    """Create a mock httpx.AsyncClient for testing."""
    client = MagicMock()
    client.aclose = AsyncMock()
    return client


def _make_mock_start_task(task_id=None, status_value='WORKING'):
    """Create a mock AppConversationStartTask for testing."""
    from openhands.app_server.app_conversation.app_conversation_models import (
        AppConversationStartTaskStatus,
    )

    task = MagicMock()
    task.id = task_id or uuid4()
    task.app_conversation_id = task_id or task.id
    task.status = AppConversationStartTaskStatus(status_value)
    return task


@pytest.mark.asyncio
class TestClearConversation:
    """Test suite for clear_conversation endpoint (Option 4 implementation)."""

    async def test_creates_new_conversation_in_same_runtime(self):
        """Test that clearing creates a new conversation with parent link.

        Arrange: Create mock service with existing conversation
        Act: Call clear_conversation
        Assert: Returns new_conversation_id and parent_conversation_id
        """
        user_id = 'test-user'
        conversation_id = uuid4()
        new_task_id = uuid4()

        mock_conversation = _make_mock_app_conversation(conversation_id, user_id)
        mock_service = _make_mock_service(get_conversation_return=mock_conversation)
        mock_start_task = _make_mock_start_task(new_task_id)

        async def mock_start_generator(request):
            yield mock_start_task

        mock_service.start_app_conversation = mock_start_generator
        mock_user_context = _make_mock_user_context(user_id)
        mock_request = _make_mock_request()
        mock_db_session = _make_mock_db_session()
        mock_httpx_client = _make_mock_httpx_client()

        result = await clear_conversation(
            request=mock_request,
            conversation_id=conversation_id,
            user_context=mock_user_context,
            db_session=mock_db_session,
            httpx_client=mock_httpx_client,
            app_conversation_service=mock_service,
        )

        assert (
            result.message == 'Conversation history cleared. Runtime state preserved.'
        )
        assert result.new_conversation_id == new_task_id.hex
        assert result.parent_conversation_id == conversation_id.hex
        assert result.status == 'WORKING'

    async def test_returns_404_for_nonexistent_conversation(self):
        """Test that clearing a nonexistent conversation raises 404."""
        conversation_id = uuid4()
        mock_service = _make_mock_service(get_conversation_return=None)
        mock_user_context = _make_mock_user_context()
        mock_request = _make_mock_request()
        mock_db_session = _make_mock_db_session()
        mock_httpx_client = _make_mock_httpx_client()

        with pytest.raises(HTTPException) as exc_info:
            await clear_conversation(
                request=mock_request,
                conversation_id=conversation_id,
                user_context=mock_user_context,
                db_session=mock_db_session,
                httpx_client=mock_httpx_client,
                app_conversation_service=mock_service,
            )

        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
        assert 'not found' in exc_info.value.detail

    async def test_returns_500_on_service_error(self):
        """Test that service errors raise 500 and cleanup resources."""
        user_id = 'test-user'
        conversation_id = uuid4()
        mock_conversation = _make_mock_app_conversation(conversation_id, user_id)
        mock_service = _make_mock_service(get_conversation_return=mock_conversation)

        async def mock_failing_generator(request):
            raise Exception('Sandbox connection failed')
            yield  # pragma: no cover

        mock_service.start_app_conversation = mock_failing_generator
        mock_user_context = _make_mock_user_context(user_id)
        mock_request = _make_mock_request()
        mock_db_session = _make_mock_db_session()
        mock_httpx_client = _make_mock_httpx_client()

        with pytest.raises(HTTPException) as exc_info:
            await clear_conversation(
                request=mock_request,
                conversation_id=conversation_id,
                user_context=mock_user_context,
                db_session=mock_db_session,
                httpx_client=mock_httpx_client,
                app_conversation_service=mock_service,
            )

        assert exc_info.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert 'Failed to clear conversation' in exc_info.value.detail
        mock_db_session.close.assert_called_once()
        mock_httpx_client.aclose.assert_called_once()

    async def test_returns_500_when_no_task_yielded(self):
        """Test that an empty generator (no tasks) raises 500."""
        user_id = 'test-user'
        conversation_id = uuid4()
        mock_conversation = _make_mock_app_conversation(conversation_id, user_id)
        mock_service = _make_mock_service(get_conversation_return=mock_conversation)

        async def mock_empty_generator(request):
            return
            yield  # pragma: no cover

        mock_service.start_app_conversation = mock_empty_generator
        mock_user_context = _make_mock_user_context(user_id)
        mock_request = _make_mock_request()
        mock_db_session = _make_mock_db_session()
        mock_httpx_client = _make_mock_httpx_client()

        with pytest.raises(HTTPException) as exc_info:
            await clear_conversation(
                request=mock_request,
                conversation_id=conversation_id,
                user_context=mock_user_context,
                db_session=mock_db_session,
                httpx_client=mock_httpx_client,
                app_conversation_service=mock_service,
            )

        assert exc_info.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert 'no task returned' in exc_info.value.detail

    async def test_inherits_parent_configuration(self):
        """Test that start request includes parent_conversation_id for inheritance."""
        user_id = 'test-user'
        conversation_id = uuid4()
        new_task_id = uuid4()

        mock_conversation = _make_mock_app_conversation(conversation_id, user_id)
        mock_service = _make_mock_service(get_conversation_return=mock_conversation)
        mock_start_task = _make_mock_start_task(new_task_id)

        captured_request = None

        async def mock_start_generator(request):
            nonlocal captured_request
            captured_request = request
            yield mock_start_task

        mock_service.start_app_conversation = mock_start_generator
        mock_user_context = _make_mock_user_context(user_id)
        mock_request = _make_mock_request()
        mock_db_session = _make_mock_db_session()
        mock_httpx_client = _make_mock_httpx_client()

        await clear_conversation(
            request=mock_request,
            conversation_id=conversation_id,
            user_context=mock_user_context,
            db_session=mock_db_session,
            httpx_client=mock_httpx_client,
            app_conversation_service=mock_service,
        )

        assert captured_request is not None
        assert captured_request.parent_conversation_id == conversation_id
