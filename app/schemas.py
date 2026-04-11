from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class AuthPayload(BaseModel):
    username: str = Field(min_length=2, max_length=32)
    password: str = Field(min_length=6, max_length=128)


class BackupPayload(BaseModel):
    xc_version: int = 2
    exportTime: Optional[str] = None
    baseUpdatedAt: Optional[str] = None
    forceOverwrite: bool = False
    errors: list[dict[str, Any]] = Field(default_factory=list)
    revealed: list[str] = Field(default_factory=list)
    expTypes: list[str] = Field(default_factory=list)
    expMain: list[str] = Field(default_factory=list)
    expMainSub: list[str] = Field(default_factory=list)
    expMainSub2: list[str] = Field(default_factory=list)
    notesByType: dict[str, Any] = Field(default_factory=dict)
    noteImages: dict[str, Any] = Field(default_factory=dict)
    typeRules: Any = None
    dirTree: Any = None
    globalNote: str = ""
    knowledgeTree: Any = None
    knowledgeNotes: dict[str, Any] = Field(default_factory=dict)
    knowledgeExpanded: list[str] = Field(default_factory=list)
    todayDate: str = ""
    todayDone: int = 0
    history: list[Any] = Field(default_factory=list)


class OriginStatusPayload(BaseModel):
    localChangedAt: Optional[str] = None
    lastLoadedAt: Optional[str] = None
    lastSavedAt: Optional[str] = None
    lastBackupUpdatedAt: Optional[str] = None


class LocalBackupCreatePayload(BaseModel):
    kind: str = Field(default="manual", max_length=32)
    label: str = Field(default="", max_length=80)
    skipRecentHours: int = Field(default=0, ge=0, le=720)


class LocalBackupRestorePayload(BaseModel):
    backupId: str = Field(min_length=8, max_length=120)
    createSafetyBackup: bool = False


class CodexThreadCreatePayload(BaseModel):
    title: str = Field(default="", max_length=80)


class CodexMessageCreatePayload(BaseModel):
    content: str = Field(min_length=1, max_length=8000)
    context: dict[str, Any] = Field(default_factory=dict)


class AnalyzeEntryPayload(BaseModel):
    type: str = ""
    subtype: str = ""
    subSubtype: str = ""
    question: str = ""
    options: str = ""
    answer: str = ""
    myAnswer: str = ""
    rootReason: str = ""
    errorReason: str = ""
    analysis: str = ""
    availableSubtypes: list[str] = Field(default_factory=list)
    availableSubSubtypes: list[str] = Field(default_factory=list)


class SyncPushPayload(BaseModel):
    ops: list[dict[str, Any]] = Field(default_factory=list)


class EvaluateAnswerPayload(BaseModel):
    question: str = ""
    options: str = ""
    correctAnswer: str = ""
    myAnswer: str = ""
    originalErrorReason: str = ""
    rootReason: str = ""


class GenerateQuestionPayload(BaseModel):
    nodeTitle: str = ""
    nodeSummary: str = ""
    referenceError: dict[str, Any] = Field(default_factory=dict)
    count: int = Field(default=1, ge=1, le=5)


class PracticeLogPayload(BaseModel):
    date: str
    mode: str
    weaknessTag: str = ""
    total: int = Field(ge=0)
    correct: int = Field(ge=0)
    errorIds: list[str] = Field(default_factory=list)


class ChatPayload(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[dict[str, str]] = Field(default_factory=list)


class ModuleSummaryPayload(BaseModel):
    type: str = ""
    subtype: str = ""
    rootReason: str = ""
    status: str = ""
    masteryLevel: str = ""
    dateFrom: str = ""
    dateTo: str = ""
    limit: int = Field(default=80, ge=10, le=200)


class DistillPayload(BaseModel):
    nodeTitle: str = ""
    nodeContent: str = ""
    error: dict[str, Any] = Field(default_factory=dict)


class SynthesizeNodePayload(BaseModel):
    nodeTitle: str = ""
    nodeContent: str = ""
    linkedErrors: list[dict[str, Any]] = Field(default_factory=list)


class DiscoverPatternsPayload(BaseModel):
    errors: list[dict[str, Any]] = Field(default_factory=list)


class SuggestRestructurePayload(BaseModel):
    tree: Any = None
    notes: dict[str, Any] = Field(default_factory=dict)



class PracticeAttemptItemPayload(BaseModel):
    id: str = ""
    createdAt: str = ""
    updatedAt: str = ""
    sessionMode: str = ""
    source: str = ""
    questionId: str = ""
    errorId: str = ""
    type: str = ""
    subtype: str = ""
    subSubtype: str = ""
    questionText: str = ""
    myAnswer: str = ""
    correctAnswer: str = ""
    result: str = ""
    durationSec: int = Field(default=0, ge=0)
    statusTag: str = ""
    confidence: int = Field(default=0, ge=0, le=5)
    solvingNote: str = ""
    scratchData: dict[str, Any] = Field(default_factory=dict)
    noteNodeId: str = ""
    meta: dict[str, Any] = Field(default_factory=dict)


class PracticeAttemptsBatchPayload(BaseModel):
    items: list[PracticeAttemptItemPayload] = Field(default_factory=list)
