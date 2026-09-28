import type { RowDataPacket } from 'mysql2';
import { AppError } from '../middleware/errorHandler.js';
import pool from '../db/connection.js';
import { listUsers } from './authService.js';
import { listTemplates } from './boosterService.js';

type JiraUser = {
  accountId?: string;
  displayName?: string;
  emailAddress?: string;
};

type JiraStatus = {
  name?: string;
  statusCategory?: { key?: string; name?: string };
};

type JiraIssue = {
  key: string;
  changelog?: {
    histories?: Array<{
      created?: string;
      items?: Array<{ field?: string; from?: string | null; to?: string | null; fromString?: string | null; toString?: string | null }>;
    }>;
  };
  fields?: {
    summary?: string;
    created?: string;
    resolutiondate?: string | null;
    issuetype?: { name?: string };
    priority?: { name?: string };
    status?: JiraStatus;
    assignee?: JiraUser | null;
    [key: string]: unknown;
  };
};

export type JiraSprint = {
  id: number;
  name: string;
  state: string;
  startDate?: string | null;
  endDate?: string | null;
  completeDate?: string | null;
  boardId?: number;
  originBoardId?: number;
};

export type SuggestedPack = {
  templateId: number;
  name: string;
  quantity: number;
  reason: string;
};

export type SprintContributor = {
  personKey: string;
  jiraName: string;
  jiraEmail: string | null;
  userId: number | null;
  username: string | null;
  issuesDone: number;
  issuesInProgress: number;
  issuesTotal: number;
  storyPoints: number;
  storyPointsCommitted: number;
  completionPct: number;
  daysPresent: number;
  daysDefault: number;
  pointsPerDay: number;
  previousPoints: number | null;
  previousDays: number | null;
  previousPerDay: number | null;
  deltaPoints: number | null;
  deltaPerDay: number | null;
  compareBonus: number;
  suggestedCards: number;
  suggestedPacks: SuggestedPack[];
};

export type SprintMetrics = {
  sprint: {
    id: number;
    name: string;
    state: string;
    startDate: string | null;
    endDate: string | null;
    completeDate: string | null;
  };
  points: {
    committed: number;
    completed: number;
    remaining: number;
    added: number;
    startPct: number;
    endPct: number;
  };
  issues: {
    total: number;
    done: number;
    inProgress: number;
    todo: number;
    donePct: number;
    bugs: number;
    stories: number;
    unestimated: number;
    unassigned: number;
  };
  time: {
    elapsedPct: number;
    daysTotal: number;
    workingDays: number;
    daysLeft: number;
    ahead: boolean | null;
  };
};

export type SprintComparison = {
  previous: SprintMetrics['sprint'];
  points: { current: number; previous: number; delta: number };
  committed: { current: number; previous: number; delta: number };
  endPct: { current: number; previous: number; delta: number };
  issuesDone: { current: number; previous: number; delta: number };
  pointsPerDay: { current: number; previous: number; delta: number };
};

function jiraConfig() {
  const baseUrl = (process.env.JIRA_BASE_URL || '').trim().replace(/\/+$/, '');
  const email = (process.env.JIRA_EMAIL || '').trim();
  const token = (process.env.JIRA_API_TOKEN || '').trim();
  return { baseUrl, email, token };
}

export function jiraConfigured(): boolean {
  const { baseUrl, email, token } = jiraConfig();
  return Boolean(baseUrl && email && token);
}

export function jiraStatus() {
  const { baseUrl, email, token } = jiraConfig();
  return {
    configured: jiraConfigured(),
    baseUrl: baseUrl || null,
    email: email || null,
    tokenSet: Boolean(token),
  };
}

export async function jiraStatusDetailed() {
  const base = jiraStatus();
  if (!base.configured) {
    return { ...base, reachable: false, error: null as string | null };
  }
  try {
    await jiraGet<{ displayName?: string }>('/rest/api/3/myself');
    return { ...base, reachable: true, error: null as string | null };
  } catch (error) {
    const message = error instanceof AppError ? error.message : 'Jira inaccessible';
    return { ...base, reachable: false, error: message };
  }
}

async function jiraGet<T>(path: string): Promise<T> {
  const { baseUrl, email, token } = jiraConfig();
  if (!baseUrl || !email || !token) {
    throw new AppError('Jira n’est pas configuré (JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN)', 503);
  }
  const res = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`,
      Accept: 'application/json',
    },
  });
  if (res.status === 401 || res.status === 403) {
    throw new AppError('Jira a refusé la clé. Vérifie JIRA_EMAIL / JIRA_API_TOKEN / JIRA_BASE_URL.', 502);
  }
  if (!res.ok) {
    throw new AppError(`Jira ${res.status} sur ${path}`, 502);
  }
  return res.json() as Promise<T>;
}

type JiraPage<T> = {
  values?: T[];
  isLast?: boolean;
  maxResults?: number;
  total?: number;
};

async function jiraAgileValues<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  let startAt = 0;
  const joiner = path.includes('?') ? '&' : '?';
  for (;;) {
    const json = await jiraGet<JiraPage<T>>(`${path}${joiner}startAt=${startAt}&maxResults=50`);
    const page = json.values ?? [];
    items.push(...page);
    startAt += json.maxResults || 50;
    if (json.isLast || !page.length) break;
    if (json.total != null && startAt >= json.total) break;
  }
  return items;
}

function sprintNumber(name: string | undefined): number {
  const match = String(name || '').match(/(\d+)\s*$/);
  return match ? Number(match[1]) : 0;
}

let storyPointsField: string | null | undefined;

async function storyPointsFieldId(): Promise<string | null> {
  if (process.env.JIRA_STORY_POINTS_FIELD) return process.env.JIRA_STORY_POINTS_FIELD;
  if (storyPointsField !== undefined) return storyPointsField;
  const fields = await jiraGet<Array<{ id: string; name?: string }>>('/rest/api/3/field');
  const match = fields.find((field) => /story\s*points?/i.test(field.name || ''));
  storyPointsField = match?.id ?? null;
  return storyPointsField;
}

function issuePoints(issue: JiraIssue, fieldId: string | null): number {
  if (!fieldId) return 0;
  const raw = issue.fields?.[fieldId];
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export async function listJiraBoards(): Promise<Array<{ id: number; name: string; type: string }>> {
  const boards = await jiraAgileValues<{ id: number; name: string; type: string }>('/rest/agile/1.0/board');
  return boards.map((board) => ({
    id: board.id,
    name: board.name,
    type: board.type,
  }));
}

export async function listJiraSprints(boardId?: number): Promise<JiraSprint[]> {
  const boards = boardId
    ? [{ id: boardId, name: '', type: '' }]
    : await listJiraBoards();
  const preferred = process.env.JIRA_BOARD_ID ? Number(process.env.JIRA_BOARD_ID) : NaN;
  const ordered = [...boards].sort((a, b) => {
    if (a.id === preferred) return -1;
    if (b.id === preferred) return 1;
    return 0;
  });
  const sprints: JiraSprint[] = [];
  for (const board of ordered) {
    const page = await jiraAgileValues<JiraSprint>(
      `/rest/agile/1.0/board/${board.id}/sprint?state=active,closed`,
    );
    for (const sprint of page) {
      sprints.push({ ...sprint, boardId: board.id });
    }
  }
  const seen = new Set<number>();
  return sprints
    .filter((sprint) => {
      if (seen.has(sprint.id)) return false;
      seen.add(sprint.id);
      return true;
    })
    .sort((a, b) => {
      const ae = a.state === 'active' ? 0 : 1;
      const be = b.state === 'active' ? 0 : 1;
      if (ae !== be) return ae - be;
      const byDate = String(b.endDate || b.completeDate || '').localeCompare(String(a.endDate || a.completeDate || ''));
      if (byDate) return byDate;
      return sprintNumber(b.name) - sprintNumber(a.name);
    });
}

async function getJiraSprint(sprintId: number): Promise<JiraSprint> {
  return jiraGet<JiraSprint>(`/rest/agile/1.0/sprint/${sprintId}`);
}

function statusBucket(issue: JiraIssue): 'done' | 'progress' | 'todo' {
  const key = (issue.fields?.status?.statusCategory?.key || '').toLowerCase();
  if (key === 'done') return 'done';
  if (key === 'indeterminate') return 'progress';
  return 'todo';
}

function issueTypeName(issue: JiraIssue): string {
  return (issue.fields?.issuetype?.name || '').toLowerCase();
}

function isBug(issue: JiraIssue): boolean {
  return /bug|anomaly|anomalie|defect/.test(issueTypeName(issue));
}

function isStory(issue: JiraIssue): boolean {
  return /story|user story|recit|récit|feature/.test(issueTypeName(issue));
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 86_400_000;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function weekdaysInclusive(start: Date, end: Date): number {
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  if (last < cursor) return 1;
  let days = 0;
  while (cursor <= last) {
    const weekday = cursor.getDay();
    if (weekday !== 0 && weekday !== 6) days += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return Math.max(1, days);
}

function workingDaysFor(sprint: JiraSprint): number {
  if (!sprint.startDate || !sprint.endDate) return 5;
  return weekdaysInclusive(new Date(sprint.startDate), new Date(sprint.endDate));
}

function personKey(email: string | null | undefined, name: string): string {
  return (email || name).trim().toLowerCase();
}

type SprintGroup = {
  key: string;
  jiraName: string;
  jiraEmail: string | null;
  issuesDone: number;
  issuesInProgress: number;
  issuesTotal: number;
  storyPoints: number;
  storyPointsCommitted: number;
};

function tallySprint(sprint: JiraSprint, issues: JiraIssue[], fieldId: string | null) {
  const groups = new Map<string, SprintGroup>();
  let committed = 0;
  let completed = 0;
  let remaining = 0;
  let added = 0;
  let doneCount = 0;
  let progressCount = 0;
  let todoCount = 0;
  let bugs = 0;
  let stories = 0;
  let unestimated = 0;
  let unassigned = 0;

  for (const issue of issues) {
    const points = issuePoints(issue, fieldId);
    const bucket = statusBucket(issue);
    const assignee = issue.fields?.assignee;
    committed += points;
    if (bucket === 'done') {
      completed += points;
      doneCount += 1;
    } else {
      remaining += points;
      if (bucket === 'progress') progressCount += 1;
      else todoCount += 1;
    }
    if (wasAddedMidSprint(issue, sprint)) added += points;
    if (isBug(issue)) bugs += 1;
    if (isStory(issue)) stories += 1;
    if (!points) unestimated += 1;
    if (!assignee) unassigned += 1;

    const key = personKey(assignee?.emailAddress, assignee?.displayName || assignee?.accountId || 'unassigned');
    const current = groups.get(key) ?? {
      key,
      jiraName: assignee?.displayName || 'Non assigné',
      jiraEmail: assignee?.emailAddress || null,
      issuesDone: 0,
      issuesInProgress: 0,
      issuesTotal: 0,
      storyPoints: 0,
      storyPointsCommitted: 0,
    };
    current.issuesTotal += 1;
    current.storyPointsCommitted += points;
    if (bucket === 'done') {
      current.issuesDone += 1;
      current.storyPoints += points;
    } else if (bucket === 'progress') {
      current.issuesInProgress += 1;
    }
    groups.set(key, current);
  }

  const start = sprint.startDate ? new Date(sprint.startDate) : null;
  const plannedEnd = sprint.endDate ? new Date(sprint.endDate) : null;
  const now = sprint.completeDate ? new Date(sprint.completeDate) : new Date();
  const daysTotal = start && plannedEnd ? Math.max(0.1, daysBetween(start, plannedEnd)) : 0;
  const elapsedRaw = start && daysTotal ? daysBetween(start, now) / daysTotal : (sprint.state === 'closed' ? 1 : 0);
  const elapsedPct = Math.max(0, Math.min(100, Math.round(elapsedRaw * 100)));
  const endPct = pct(completed, committed);
  const daysLeft = plannedEnd ? Math.max(0, round1(daysBetween(now, plannedEnd))) : 0;
  const workingDays = workingDaysFor(sprint);

  const metrics: SprintMetrics = {
    sprint: {
      id: sprint.id,
      name: sprint.name,
      state: sprint.state,
      startDate: sprint.startDate || null,
      endDate: sprint.endDate || null,
      completeDate: sprint.completeDate || null,
    },
    points: {
      committed,
      completed,
      remaining,
      added,
      startPct: 0,
      endPct,
    },
    issues: {
      total: issues.length,
      done: doneCount,
      inProgress: progressCount,
      todo: todoCount,
      donePct: pct(doneCount, issues.length),
      bugs,
      stories,
      unestimated,
      unassigned,
    },
    time: {
      elapsedPct,
      daysTotal: round1(daysTotal),
      workingDays,
      daysLeft: sprint.state === 'closed' ? 0 : daysLeft,
      ahead: committed > 0 ? endPct >= elapsedPct : null,
    },
  };

  return { groups, metrics };
}

async function loadAttendance(sprintId: number): Promise<Map<string, number>> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT person_key, days FROM sprint_attendance WHERE jira_sprint_id = ?',
    [sprintId],
  );
  return new Map(rows.map((row) => [String(row.person_key).toLowerCase(), Number(row.days)]));
}

export async function saveSprintAttendance(sprintId: number, days: Record<string, unknown>) {
  for (const [key, raw] of Object.entries(days)) {
    const person = key.trim().toLowerCase();
    const value = Number(raw);
    if (!person || !Number.isFinite(value) || value < 0 || value > 31) continue;
    await pool.execute(
      `INSERT INTO sprint_attendance (jira_sprint_id, person_key, days)
       VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE days = VALUES(days)`,
      [sprintId, person, round1(value)],
    );
  }
}

async function previousSprintOnBoard(sprint: JiraSprint): Promise<JiraSprint | null> {
  const boardId = sprint.originBoardId || sprint.boardId;
  const all = await listJiraSprints(boardId);
  const index = all.findIndex((item) => item.id === sprint.id);
  if (index >= 0) return all[index + 1] ?? null;
  const start = sprint.startDate || sprint.endDate || '';
  return all.find((item) => String(item.endDate || item.startDate || '') < start) ?? null;
}

function joinedSprintAt(issue: JiraIssue, sprint: JiraSprint): Date | null {
  const histories = issue.changelog?.histories ?? [];
  for (const history of histories) {
    for (const item of history.items ?? []) {
      if ((item.field || '').toLowerCase() !== 'sprint') continue;
      const to = `${item.to || ''} ${item.toString || ''}`;
      const from = `${item.from || ''} ${item.fromString || ''}`;
      const nowIn = to.includes(String(sprint.id)) || (sprint.name ? to.includes(sprint.name) : false);
      const wasIn = from.includes(String(sprint.id)) || (sprint.name ? from.includes(sprint.name) : false);
      if (nowIn && !wasIn && history.created) return new Date(history.created);
    }
  }
  return issue.fields?.created ? new Date(issue.fields.created) : null;
}

function wasAddedMidSprint(issue: JiraIssue, sprint: JiraSprint): boolean {
  if (!sprint.startDate) return false;
  const start = new Date(sprint.startDate);
  const joined = joinedSprintAt(issue, sprint);
  if (joined) return joined.getTime() > start.getTime() + 3_600_000;
  const created = issue.fields?.created ? new Date(issue.fields.created) : null;
  return Boolean(created && created.getTime() > start.getTime());
}

async function sprintIssues(sprintId: number, withChangelog = true): Promise<JiraIssue[]> {
  const fieldId = await storyPointsFieldId();
  const fields = ['summary', 'status', 'assignee', 'issuetype', 'priority', 'created', 'resolutiondate', fieldId]
    .filter(Boolean)
    .join(',');
  const expand = withChangelog ? '&expand=changelog' : '';
  const issues: JiraIssue[] = [];
  let startAt = 0;
  for (let i = 0; i < 20; i += 1) {
    const json = await jiraGet<{ issues?: JiraIssue[]; startAt: number; maxResults: number; total: number }>(
      `/rest/agile/1.0/sprint/${sprintId}/issue?startAt=${startAt}&maxResults=50${expand}&fields=${encodeURIComponent(fields)}`,
    );
    issues.push(...(json.issues ?? []));
    startAt += json.maxResults || 50;
    if (!json.issues?.length || startAt >= (json.total || 0)) break;
  }
  return issues;
}

function suggestPacks(points: number, issuesDone: number, templates: Awaited<ReturnType<typeof listTemplates>>): {
  cards: number;
  packs: SuggestedPack[];
} {
  const cards = points > 0 ? Math.max(0, Math.round(points)) : issuesDone;
  const byKey = Object.fromEntries(templates.filter((pack) => pack.presetKey).map((pack) => [pack.presetKey, pack]));
  const standard = byKey.standard;
  const packs: SuggestedPack[] = [];
  if (standard && cards > 0) {
    const quantity = Math.max(1, Math.ceil(cards / standard.cardCount));
    packs.push({
      templateId: standard.id,
      name: standard.name,
      quantity,
      reason: `${cards} carte${cards > 1 ? 's' : ''} → ${quantity}×${standard.cardCount}`,
    });
  }
  const bonuses: Array<{ key: string; min: number; label: string }> = [
    { key: 'rare', min: 8, label: '≥ 8 pts' },
    { key: 'premium', min: 13, label: '≥ 13 pts' },
    { key: 'epique', min: 21, label: '≥ 21 pts' },
  ];
  for (const bonus of bonuses) {
    const pack = byKey[bonus.key];
    if (pack && cards >= bonus.min) {
      packs.push({
        templateId: pack.id,
        name: pack.name,
        quantity: 1,
        reason: bonus.label,
      });
    }
  }
  return { cards, packs };
}

function matchUser(
  assignee: JiraUser | null | undefined,
  users: Awaited<ReturnType<typeof listUsers>>,
) {
  if (!assignee) return null;
  const email = assignee.emailAddress?.trim().toLowerCase();
  if (email) {
    const byEmail = users.find((user) => user.email.toLowerCase() === email);
    if (byEmail) return byEmail;
  }
  const name = (assignee.displayName || '').trim().toLowerCase();
  if (!name) return null;
  return users.find((user) => user.username.toLowerCase() === name
    || user.username.toLowerCase().includes(name)
    || name.includes(user.username.toLowerCase())) ?? null;
}

export async function sprintRewardGuide(sprintId: number) {
  const [sprint, issues, users, templates, attendance] = await Promise.all([
    getJiraSprint(sprintId),
    sprintIssues(sprintId),
    listUsers(),
    listTemplates(),
    loadAttendance(sprintId),
  ]);
  const fieldId = await storyPointsFieldId();
  const current = tallySprint(sprint, issues, fieldId);
  const workingDays = current.metrics.time.workingDays;

  let previous: ReturnType<typeof tallySprint> | null = null;
  let previousAttendance = new Map<string, number>();
  const older = await previousSprintOnBoard(sprint);
  if (older) {
    const [prevIssues, prevDays] = await Promise.all([
      sprintIssues(older.id, false),
      loadAttendance(older.id),
    ]);
    previous = tallySprint(older, prevIssues, fieldId);
    previousAttendance = prevDays;
  }

  const prevByKey = new Map<string, SprintGroup>();
  if (previous) {
    for (const row of previous.groups.values()) prevByKey.set(row.key, row);
  }

  const contributors: SprintContributor[] = [...current.groups.values()]
    .filter((row) => row.jiraName !== 'Non assigné' || row.issuesDone > 0)
    .map((row) => {
      const user = matchUser({ displayName: row.jiraName, emailAddress: row.jiraEmail || undefined }, users);
      const daysDefault = user?.sprintDays ?? workingDays;
      const daysPresent = attendance.get(row.key) ?? daysDefault;
      const safeDays = Math.max(0.5, daysPresent);
      const pointsPerDay = row.storyPoints / safeDays;
      const prevRow = prevByKey.get(row.key) ?? null;
      const previousDays = prevRow
        ? previousAttendance.get(row.key) ?? user?.sprintDays ?? previous?.metrics.time.workingDays ?? workingDays
        : null;
      const previousPoints = prevRow ? prevRow.storyPoints : null;
      const previousPerDay = prevRow && previousDays != null ? prevRow.storyPoints / Math.max(0.5, previousDays) : null;
      const deltaPoints = previousPoints == null ? null : round1(row.storyPoints - previousPoints);
      const deltaPerDay = previousPerDay == null ? null : round1(pointsPerDay - previousPerDay);
      const compareBonus = previousPerDay == null ? 0 : Math.max(0, Math.round((pointsPerDay - previousPerDay) * safeDays));
      const suggestion = suggestPacks(row.storyPoints + compareBonus, row.issuesDone, templates);
      return {
        personKey: row.key,
        jiraName: row.jiraName,
        jiraEmail: row.jiraEmail,
        userId: user?.id ?? null,
        username: user?.username ?? null,
        issuesDone: row.issuesDone,
        issuesInProgress: row.issuesInProgress,
        issuesTotal: row.issuesTotal,
        storyPoints: row.storyPoints,
        storyPointsCommitted: row.storyPointsCommitted,
        completionPct: pct(row.storyPoints, row.storyPointsCommitted),
        daysPresent: round1(daysPresent),
        daysDefault: round1(daysDefault),
        pointsPerDay: round1(pointsPerDay),
        previousPoints,
        previousDays: previousDays == null ? null : round1(previousDays),
        previousPerDay: previousPerDay == null ? null : round1(previousPerDay),
        deltaPoints,
        deltaPerDay,
        compareBonus,
        suggestedCards: suggestion.cards,
        suggestedPacks: suggestion.packs,
      };
    })
    .sort((a, b) => b.suggestedCards - a.suggestedCards || b.storyPoints - a.storyPoints || b.issuesDone - a.issuesDone);

  const totals = contributors.reduce(
    (acc, row) => {
      acc.storyPoints += row.storyPoints;
      acc.issuesDone += row.issuesDone;
      acc.suggestedCards += row.suggestedCards;
      acc.suggestedBoosters += row.suggestedPacks.reduce((sum, pack) => sum + pack.quantity, 0);
      acc.matched += row.userId ? 1 : 0;
      return acc;
    },
    { storyPoints: 0, issuesDone: 0, suggestedCards: 0, suggestedBoosters: 0, matched: 0 },
  );

  const currentPerDay = workingDays > 0 ? current.metrics.points.completed / workingDays : 0;
  const previousPerDay = previous && previous.metrics.time.workingDays > 0
    ? previous.metrics.points.completed / previous.metrics.time.workingDays
    : 0;
  const comparison: SprintComparison | null = previous
    ? {
      previous: previous.metrics.sprint,
      points: {
        current: current.metrics.points.completed,
        previous: previous.metrics.points.completed,
        delta: round1(current.metrics.points.completed - previous.metrics.points.completed),
      },
      committed: {
        current: current.metrics.points.committed,
        previous: previous.metrics.points.committed,
        delta: round1(current.metrics.points.committed - previous.metrics.points.committed),
      },
      endPct: {
        current: current.metrics.points.endPct,
        previous: previous.metrics.points.endPct,
        delta: current.metrics.points.endPct - previous.metrics.points.endPct,
      },
      issuesDone: {
        current: current.metrics.issues.done,
        previous: previous.metrics.issues.done,
        delta: current.metrics.issues.done - previous.metrics.issues.done,
      },
      pointsPerDay: {
        current: round1(currentPerDay),
        previous: round1(previousPerDay),
        delta: round1(currentPerDay - previousPerDay),
      },
    }
    : null;

  return {
    storyPointsField: fieldId,
    totals,
    metrics: current.metrics,
    comparison,
    contributors,
  };
}
