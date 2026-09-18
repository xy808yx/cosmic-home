// Shared round results. Points reward special asteroids; correct answers measure
// learning. Keep those totals separate when awarding stars and campaign mastery.

export const MASTERY_ACCURACY = 80;
// Half of the mode's target keeps the correct-answer floor reachable within a
// one-minute round: 9 multiplication, 7 division, or 8 mixed answers.
export const MASTERY_SCORE_RATIO = 0.5;

// Mastery requires enough correct answers as well as accuracy. The legacy
// parameter name is retained for callers that import this through GameData.
export function isRoundMastered({ isBoss, bossWin, score, accuracy, scoreThreshold }) {
  if (isBoss) return !!bossWin;
  return accuracy >= MASTERY_ACCURACY &&
    score >= Math.ceil(scoreThreshold * MASTERY_SCORE_RATIO);
}

// Practice stars remain a points reward. Bonus points can help earn stars, but
// cannot improve accuracy or satisfy the separate correct-answer mastery gate.
export function calculateStars(score, accuracy, scoreThreshold) {
  if (score === 0) return 0;
  const meetsAccuracy = accuracy >= 85;
  if (score >= scoreThreshold && meetsAccuracy) return 3;
  if (score >= Math.ceil(scoreThreshold * 0.7) || meetsAccuracy) return 2;
  return 1;
}

export function getRoundAccuracy(correctAnswers, attempts) {
  return attempts > 0 ? Math.round((correctAnswers / attempts) * 100) : 0;
}

export function calculateRoundResult({
  score,
  correctAnswers,
  attempts,
  scoreThreshold,
  isBoss = false,
  bossWin = false,
  bossStars = 0
}) {
  const accuracy = getRoundAccuracy(correctAnswers, attempts);
  const stars = isBoss
    ? (bossWin ? bossStars : 0)
    : calculateStars(score, accuracy, scoreThreshold);
  const mastered = isRoundMastered({
    isBoss, bossWin, score: correctAnswers, accuracy, scoreThreshold
  });
  return { accuracy, stars, mastered };
}
