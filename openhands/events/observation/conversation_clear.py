from dataclasses import dataclass

from openhands.core.schema import ObservationType
from openhands.events.observation.observation import Observation


@dataclass
class ConversationClearedObservation(Observation):
    """Observation emitted when the user runs /clear.

    Replaces the prior conversation with a single event that links to the
    previous content so OH and the user can still access it. Runtime and
    session ID are preserved.
    """

    observation: str = ObservationType.CONVERSATION_CLEARED
