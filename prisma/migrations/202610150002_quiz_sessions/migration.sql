CREATE TABLE "QuizSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "usedAt" DATETIME,
  CONSTRAINT "QuizSession_userId_fkey" FOREIGN KEY("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "QuizSession_materialId_fkey" FOREIGN KEY("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "QuizSession_userId_materialId_idx" ON "QuizSession"("userId","materialId");
