import { supabaseAdmin } from "@/integrations/supabase/client.server";

type MegaProfession = "pcm" | "pcb";

type MegaTestRow = {
  id: string;
  profession: MegaProfession;
  scheduled_start: string;
};

export type MegaParticipantSummary = {
  participants: number;
  streamParticipants: number;
  byProfession: Record<MegaProfession, number>;
  testIds: string[];
  scheduledStart: string | null;
  updatedAt: string;
};

function aroundTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    from: new Date(date.getTime() - 60_000).toISOString(),
    to: new Date(date.getTime() + 60_000).toISOString(),
  };
}

async function getSiblingTests(scheduledStart: string): Promise<MegaTestRow[]> {
  const window = aroundTimestamp(scheduledStart);
  let query = supabaseAdmin
    .from("mega_tests")
    .select("id, profession, scheduled_start")
    .order("profession", { ascending: true });

  query = window
    ? query.gte("scheduled_start", window.from).lte("scheduled_start", window.to)
    : query.eq("scheduled_start", scheduledStart);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as MegaTestRow[];
}

async function getNextVisibleTests(): Promise<MegaTestRow[]> {
  const now = new Date().toISOString();
  const { data: next, error: nextError } = await supabaseAdmin
    .from("mega_tests")
    .select("scheduled_start")
    .gte("scheduled_end", now)
    .order("scheduled_start", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextError) throw nextError;
  if (!next?.scheduled_start) return [];
  return getSiblingTests(next.scheduled_start as string);
}

export async function getMegaParticipantSummary({
  megaTestId,
  scheduledStart,
}: {
  megaTestId?: string | null;
  scheduledStart?: string | null;
} = {}): Promise<MegaParticipantSummary> {
  let currentTestId = megaTestId ?? null;
  let resolvedScheduledStart = scheduledStart ?? null;

  if (currentTestId && !resolvedScheduledStart) {
    const { data: test, error } = await supabaseAdmin
      .from("mega_tests")
      .select("id, scheduled_start")
      .eq("id", currentTestId)
      .maybeSingle();

    if (error) throw error;
    resolvedScheduledStart = (test?.scheduled_start as string | undefined) ?? null;
  }

  const tests = resolvedScheduledStart
    ? await getSiblingTests(resolvedScheduledStart)
    : await getNextVisibleTests();

  const testIds = tests.map((test) => test.id);
  const byProfession: Record<MegaProfession, number> = { pcm: 0, pcb: 0 };

  if (testIds.length === 0) {
    return {
      participants: 0,
      streamParticipants: 0,
      byProfession,
      testIds: [],
      scheduledStart: resolvedScheduledStart,
      updatedAt: new Date().toISOString(),
    };
  }

  const { data: entries, error: entriesError } = await supabaseAdmin
    .from("mega_test_entries")
    .select("mega_test_id, user_id")
    .in("mega_test_id", testIds)
    .eq("paid", true);

  if (entriesError) throw entriesError;

  const testProfession = new Map<string, MegaProfession>();
  for (const test of tests) testProfession.set(test.id, test.profession);

  const uniqueUsers = new Set<string>();
  const byTest = new Map<string, number>();

  for (const entry of entries ?? []) {
    const testId = entry.mega_test_id as string | null;
    const userId = entry.user_id as string | null;
    if (!testId || !userId) continue;

    uniqueUsers.add(userId);
    byTest.set(testId, (byTest.get(testId) ?? 0) + 1);

    const profession = testProfession.get(testId);
    if (profession) byProfession[profession] += 1;
  }

  if (!currentTestId && tests[0]) currentTestId = tests[0].id;

  return {
    participants: uniqueUsers.size,
    streamParticipants: currentTestId ? byTest.get(currentTestId) ?? 0 : 0,
    byProfession,
    testIds,
    scheduledStart: resolvedScheduledStart ?? tests[0]?.scheduled_start ?? null,
    updatedAt: new Date().toISOString(),
  };
}
