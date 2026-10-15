CREATE TABLE "TrainingSession" (
 "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "topic" TEXT NOT NULL,
 "mode" TEXT NOT NULL, "grade" INTEGER NOT NULL, "configJson" JSONB NOT NULL,
 "algorithmVersion" TEXT NOT NULL, "dataKind" TEXT NOT NULL DEFAULT 'user',
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "TrainingTurn" (
 "id" TEXT NOT NULL PRIMARY KEY, "sessionId" TEXT NOT NULL, "sequence" INTEGER NOT NULL,
 "questionId" TEXT NOT NULL, "snapshotJson" JSONB NOT NULL, "selectionReason" TEXT NOT NULL,
 "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "TrainingAttempt" (
 "id" TEXT NOT NULL PRIMARY KEY, "turnId" TEXT NOT NULL, "requestId" TEXT NOT NULL,
 "answer" TEXT NOT NULL, "correct" BOOLEAN NOT NULL, "durationMs" INTEGER NOT NULL,
 "levelBefore" INTEGER NOT NULL, "levelAfter" INTEGER NOT NULL,
 "masteryBefore" REAL NOT NULL, "masteryAfter" REAL NOT NULL, "reason" TEXT NOT NULL,
 "evidenceJson" JSONB NOT NULL, "errorTagsJson" JSONB NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY("turnId") REFERENCES "TrainingTurn"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "LearningTask" (
 "id" TEXT NOT NULL PRIMARY KEY, "ownerId" TEXT NOT NULL, "classId" TEXT,
 "questionJson" JSONB NOT NULL, "status" TEXT NOT NULL DEFAULT 'draft', "origin" TEXT NOT NULL,
 "model" TEXT, "version" INTEGER NOT NULL DEFAULT 1, "reviewedAt" DATETIME,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
 FOREIGN KEY("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TrainingSession_userId_topic_createdAt_idx" ON "TrainingSession"("userId","topic","createdAt");
CREATE UNIQUE INDEX "TrainingTurn_sessionId_sequence_key" ON "TrainingTurn"("sessionId","sequence");
CREATE UNIQUE INDEX "TrainingAttempt_turnId_key" ON "TrainingAttempt"("turnId");
CREATE INDEX "LearningTask_ownerId_status_idx" ON "LearningTask"("ownerId","status");
