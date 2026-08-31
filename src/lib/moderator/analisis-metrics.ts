export interface StudentAnalytics {
  id: string;
  className: string | null;
  attemptsCount: number;
  solvedAttemptsCount: number;
  distinctSolvedPuzzles: number;
  hintsUsed: number;
  rewardSum: number;
  rewardCount: number;
  timeTakenSec: number;
  completedAllModules: boolean;
  levelChange: "naik" | "tetap" | "turun" | null;
  qValueUpdates: number;
  difficultyAdaptations: number;
}

export interface AnalisisSistemData {
  totalSiswaAktif: number;
  avgSoalDiselesaikan: number;
  tingkatKeberhasilan: number;
  avgHintPerSiswa: number;
  perubahanLevel: { naik: number; tetap: number; turun: number };
  avgReward: number;
  totalPembaruanQValue: number;
  siswaSelesaiSemuaLevel: number;
  avgWaktuMenitPerSiswa: number;
  totalAdaptasiKesulitan: number;
}

export function computeAnalisisMetrics(
  students: StudentAnalytics[],
): AnalisisSistemData {
  const active = students.filter((s) => s.attemptsCount > 0);
  const totalSiswaAktif = active.length;

  const totalSoalSolved = active.reduce(
    (sum, s) => sum + s.distinctSolvedPuzzles,
    0,
  );
  const avgSoalDiselesaikan =
    totalSiswaAktif > 0 ? totalSoalSolved / totalSiswaAktif : 0;

  const totalAttempts = active.reduce((sum, s) => sum + s.attemptsCount, 0);
  const totalSolvedAttempts = active.reduce(
    (sum, s) => sum + s.solvedAttemptsCount,
    0,
  );
  const tingkatKeberhasilan =
    totalAttempts > 0 ? (totalSolvedAttempts / totalAttempts) * 100 : 0;

  const totalHints = active.reduce((sum, s) => sum + s.hintsUsed, 0);
  const avgHintPerSiswa = totalSiswaAktif > 0 ? totalHints / totalSiswaAktif : 0;

  const perubahanLevel = { naik: 0, tetap: 0, turun: 0 };
  for (const s of students) {
    if (s.levelChange === "naik") perubahanLevel.naik += 1;
    else if (s.levelChange === "tetap") perubahanLevel.tetap += 1;
    else if (s.levelChange === "turun") perubahanLevel.turun += 1;
  }

  const rewardSum = active.reduce((sum, s) => sum + s.rewardSum, 0);
  const rewardCount = active.reduce((sum, s) => sum + s.rewardCount, 0);
  const avgReward = rewardCount > 0 ? rewardSum / rewardCount : 0;

  const totalPembaruanQValue = students.reduce(
    (sum, s) => sum + s.qValueUpdates,
    0,
  );

  const siswaSelesaiSemuaLevel = students.filter(
    (s) => s.completedAllModules,
  ).length;

  const totalTimeSec = active.reduce((sum, s) => sum + s.timeTakenSec, 0);
  const avgWaktuMenitPerSiswa =
    totalSiswaAktif > 0 ? totalTimeSec / 60 / totalSiswaAktif : 0;

  const totalAdaptasiKesulitan = students.reduce(
    (sum, s) => sum + s.difficultyAdaptations,
    0,
  );

  return {
    totalSiswaAktif,
    avgSoalDiselesaikan,
    tingkatKeberhasilan,
    avgHintPerSiswa,
    perubahanLevel,
    avgReward,
    totalPembaruanQValue,
    siswaSelesaiSemuaLevel,
    avgWaktuMenitPerSiswa,
    totalAdaptasiKesulitan,
  };
}
