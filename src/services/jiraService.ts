import { AppError } from '../middleware/errorHandler.js';
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
};

export type SuggestedPack = {
  templateId: number;
  name: string;
  quantity: number;
  reason: string;
};

export type SprintContributor = {
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
    daysLeft: number;
    ahead: boolean | null;
  };
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
  const json = await jiraGet<{ values?: Array<{ id: number; name: string; type: string }> }>(
    '/rest/agile/1.0/board?maxResults=50',
  );
  return (json.values ?? []).map((board) => ({
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
  for (const board of ordered.slice(0, 8)) {
    const json = await jiraGet<{ values?: JiraSprint[] }>(
      `/rest/agile/1.0/board/${board.id}/sprint?state=active,closed&maxResults=20`,
    );
    for (const sprint of json.values ?? []) {
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
      return String(b.endDate || b.completeDate || '').localeCompare(String(a.endDate || a.completeDate || ''));
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

async function sprintIssues(sprintId: number): Promise<JiraIssue[]> {
  const fieldId = await storyPointsFieldId();
  const fields = ['summary', 'status', 'assignee', 'issuetype', 'priority', 'created', 'resolutiondate', fieldId]
    .filter(Boolean)
    .join(',');
  const issues: JiraIssue[] = [];
  let startAt = 0;
  for (let i = 0; i < 20; i += 1) {
    const json = await jiraGet<{ issues?: JiraIssue[]; startAt: number; maxResults: number; total: number }>(
      `/rest/agile/1.0/sprint/${sprintId}/issue?startAt=${startAt}&maxResults=50&expand=changelog&fields=${encodeURIComponent(fields)}`,
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
  const cards = points > 0 ? Math.round(points) : issuesDone;
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
    if (pack && points >= bonus.min) {
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
  const [sprint, issues, users, templates] = await Promise.all([
    getJiraSprint(sprintId),
    sprintIssues(sprintId),
    listUsers(),
    listTemplates(),
  ]);
  const fieldId = await storyPointsFieldId();
  const groups = new Map<string, {
    jiraName: string;
    jiraEmail: string | null;
    issuesDone: number;
    issuesInProgress: number;
    issuesTotal: number;
    storyPoints: number;
    storyPointsCommitted: number;
  }>();

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

    const key = assignee?.accountId || assignee?.emailAddress || assignee?.displayName || 'unassigned';
    const current = groups.get(key) ?? {
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

  const contributors: SprintContributor[] = [...groups.values()]
    .filter((row) => row.jiraName !== 'Non assigné' || row.issuesDone > 0)
    .map((row) => {
      const user = matchUser({ displayName: row.jiraName, emailAddress: row.jiraEmail || undefined }, users);
      const suggestion = suggestPacks(row.storyPoints, row.issuesDone, templates);
      return {
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
        suggestedCards: suggestion.cards,
        suggestedPacks: suggestion.packs,
      };
    })
    .sort((a, b) => b.storyPoints - a.storyPoints || b.issuesDone - a.issuesDone);

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

  const start = sprint.startDate ? new Date(sprint.startDate) : null;
  const plannedEnd = sprint.endDate ? new Date(sprint.endDate) : null;
  const now = sprint.completeDate ? new Date(sprint.completeDate) : new Date();
  const daysTotal = start && plannedEnd ? Math.max(0.1, daysBetween(start, plannedEnd)) : 0;
  const elapsedRaw = start && daysTotal ? daysBetween(start, now) / daysTotal : (sprint.state === 'closed' ? 1 : 0);
  const elapsedPct = Math.max(0, Math.min(100, Math.round(elapsedRaw * 100)));
  const endPct = pct(completed, committed);
  const daysLeft = plannedEnd ? Math.max(0, Math.round(daysBetween(now, plannedEnd) * 10) / 10) : 0;

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
      daysTotal: Math.round(daysTotal * 10) / 10,
      daysLeft: sprint.state === 'closed' ? 0 : daysLeft,
      ahead: committed > 0 ? endPct >= elapsedPct : null,
    },
  };

  return {
    storyPointsField: fieldId,
    totals,
    metrics,
    contributors,
  };
}
