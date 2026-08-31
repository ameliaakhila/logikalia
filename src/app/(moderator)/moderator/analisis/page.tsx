import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Header } from "@/components/layout/Header";
import { AnalisisClient } from "@/components/moderator/AnalisisClient";
import type { SkillBin } from "@/lib/rl/types";
import type { StudentAnalytics } from "@/lib/moderator/analisis-metrics";

const SOAL_PER_MODULE = 3;
const SKILL_RANK: Record<SkillBin, number> = { low: 0, medium: 1, high: 2 };

// Supabase/PostgREST caps a single select() at 1000 rows by default, so
// tables like `attempts`/`rl_events` that can grow past that need paging
// through with .range() or metrics silently undercount.
const PAGE_SIZE = 1000;

async function fetchAllRows<T>(
  queryPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await queryPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

export interface AnalisisClass {
  id: string;
  name: string;
}

export default async function ModeratorAnalisisPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const admin = createAdminClient();

  const [
    { data: profileRows },
    { data: classRows },
    { data: moduleRows },
    { data: puzzleRows },
  ] = await Promise.all([
    admin.from("profiles").select("id, role, class_name"),
    admin.from("classes").select("id, name").order("name"),
    admin.from("modules").select("id, name"),
    admin.from("puzzles").select("id, module_id"),
  ]);

  const students = (profileRows ?? []).filter(
    (p) => (p.role ?? "siswa") === "siswa",
  );
  const classNameById = new Map<string, string | null>(
    students.map((s) => [s.id as string, (s.class_name as string | null) ?? null]),
  );
  const studentIds = new Set(classNameById.keys());

  const classes: AnalisisClass[] = (classRows ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
  }));

  const puzzleModuleMap = new Map<string, string>(
    (puzzleRows ?? []).map((p) => [p.id as string, p.module_id as string]),
  );
  const moduleIds = (moduleRows ?? []).map((m) => m.id as string);

  const attemptRows = await fetchAllRows<{
    user_id: string;
    puzzle_id: string;
    solved: boolean;
    hints_used: number | null;
    time_taken_sec: number | null;
    reward: number | null;
  }>((from, to) =>
    admin
      .from("attempts")
      .select("user_id, puzzle_id, solved, hints_used, time_taken_sec, reward")
      .range(from, to),
  );
  const attempts = attemptRows.filter((a) => studentIds.has(a.user_id));

  const rlEventRows = await fetchAllRows<{
    user_id: string;
    module_id: string;
    state_before: { skill_bin?: SkillBin } | null;
    state_after: { skill_bin?: SkillBin } | null;
    action_taken: number;
    created_at: string;
  }>((from, to) =>
    admin
      .from("rl_events")
      .select(
        "user_id, module_id, state_before, state_after, action_taken, created_at",
      )
      .order("created_at", { ascending: true })
      .range(from, to),
  );
  const rlEvents = rlEventRows.filter((e) => studentIds.has(e.user_id));

  const attemptsByUser = new Map<string, typeof attempts>();
  for (const a of attempts) {
    if (!attemptsByUser.has(a.user_id)) attemptsByUser.set(a.user_id, []);
    attemptsByUser.get(a.user_id)!.push(a);
  }

  const rlEventsByUser = new Map<string, typeof rlEvents>();
  for (const e of rlEvents) {
    if (!rlEventsByUser.has(e.user_id)) rlEventsByUser.set(e.user_id, []);
    rlEventsByUser.get(e.user_id)!.push(e);
  }

  const studentAnalytics: StudentAnalytics[] = Array.from(
    studentIds,
    (userId): StudentAnalytics => {
      const userAttempts = attemptsByUser.get(userId) ?? [];
      const userEvents = rlEventsByUser.get(userId) ?? [];

      const solvedPuzzles = new Set<string>();
      const puzzlesByModule = new Map<string, Set<string>>();
      let solvedAttemptsCount = 0;
      let hintsUsed = 0;
      let rewardSum = 0;
      let rewardCount = 0;
      let timeTakenSec = 0;

      for (const a of userAttempts) {
        if (a.solved) {
          solvedAttemptsCount += 1;
          solvedPuzzles.add(a.puzzle_id);
        }
        hintsUsed += a.hints_used ?? 0;
        timeTakenSec += a.time_taken_sec ?? 0;
        if (a.reward !== null) {
          rewardSum += a.reward;
          rewardCount += 1;
        }
        const moduleId = puzzleModuleMap.get(a.puzzle_id);
        if (moduleId) {
          if (!puzzlesByModule.has(moduleId))
            puzzlesByModule.set(moduleId, new Set());
          puzzlesByModule.get(moduleId)!.add(a.puzzle_id);
        }
      }

      const completedAllModules =
        moduleIds.length > 0 &&
        moduleIds.every(
          (moduleId) =>
            (puzzlesByModule.get(moduleId)?.size ?? 0) >= SOAL_PER_MODULE,
        );

      let levelChange: StudentAnalytics["levelChange"] = null;
      if (userEvents.length > 0) {
        const first = userEvents[0];
        const last = userEvents[userEvents.length - 1];
        const awalBin = first.state_before?.skill_bin;
        const akhirBin =
          last.state_after?.skill_bin ?? last.state_before?.skill_bin;
        if (awalBin && akhirBin) {
          const rankAwal = SKILL_RANK[awalBin];
          const rankAkhir = SKILL_RANK[akhirBin];
          levelChange =
            rankAkhir > rankAwal
              ? "naik"
              : rankAkhir < rankAwal
                ? "turun"
                : "tetap";
        }
      }

      const eventsByModule = new Map<string, typeof userEvents>();
      for (const e of userEvents) {
        if (!eventsByModule.has(e.module_id))
          eventsByModule.set(e.module_id, []);
        eventsByModule.get(e.module_id)!.push(e);
      }
      let difficultyAdaptations = 0;
      for (const group of eventsByModule.values()) {
        for (let i = 1; i < group.length; i++) {
          if (group[i].action_taken !== group[i - 1].action_taken) {
            difficultyAdaptations += 1;
          }
        }
      }

      return {
        id: userId,
        className: classNameById.get(userId) ?? null,
        attemptsCount: userAttempts.length,
        solvedAttemptsCount,
        distinctSolvedPuzzles: solvedPuzzles.size,
        hintsUsed,
        rewardSum,
        rewardCount,
        timeTakenSec,
        completedAllModules,
        levelChange,
        qValueUpdates: userEvents.length,
        difficultyAdaptations,
      };
    },
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        user={{
          id: user.id,
          email: user.email,
          display_name: currentProfile?.display_name,
          username: currentProfile?.username,
          avatar_seed: currentProfile?.avatar_seed,
          role: currentProfile?.role,
        }}
      />
      <AnalisisClient students={studentAnalytics} classes={classes} />
    </div>
  );
}
