import { AsyncLocalStorage } from 'node:async_hooks';
import { AppError } from '../middleware/errorHandler.js';
import {
  ART_FILTERS,
  BORDER_FINISHES,
  CARD_KINDS,
  CARD_STYLES,
  MAGIC_TYPES,
  RARITIES,
  kindHasCombatStats,
  type ArtFilter,
  type BorderFinish,
  type CardInput,
  type CardKind,
  type CardStyle,
  type MagicType,
  type Rarity,
} from '../types/index.js';
import { listCards } from './cardService.js';
import { listEditions, listUniverses } from './catalogService.js';
import { giphyGifUrl, giphyIdFromUrl, giphyStillUrl, originGiphyUrl, slugifySeed } from './cardVisuals.js';

const MIX_TARGETS: Record<Rarity, number> = {
  common: 62,
  uncommon: 22,
  rare: 10,
  epic: 4,
  legendary: 1,
  mythic: 1,
};

export type AiProgressEvent = {
  step: 'start' | 'brief' | 'giphy' | 'filter' | 'cards' | 'wait' | 'done';
  label: string;
  percent: number;
};

type ProgressCtx = {
  emit: (event: AiProgressEvent) => void;
  percent: number;
  drafts?: (items: AiCardDraft[]) => void;
};
const progressStore = new AsyncLocalStorage<ProgressCtx>();

function report(step: AiProgressEvent['step'], label: string, percent?: number) {
  const ctx = progressStore.getStore();
  if (!ctx) return;
  if (typeof percent === 'number') ctx.percent = Math.max(0, Math.min(100, Math.round(percent)));
  ctx.emit({ step, label, percent: ctx.percent });
}

function publishDrafts(items: AiCardDraft[]) {
  progressStore.getStore()?.drafts?.(items);
}

const RARITY_ORDER: Rarity[] = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'];

const RARITY_WORDS: Array<{ rarity: Rarity; re: RegExp }> = [
  { rarity: 'mythic', re: /\bmythiques?\b|\bmythics?\b/i },
  { rarity: 'legendary', re: /\bl[eé]gendaires?\b|\blegendary\b/i },
  { rarity: 'epic', re: /\b[eé]piques?\b|\bepics?\b/i },
  { rarity: 'uncommon', re: /\buncommons?\b|\bpeu[-\s]?communes?\b/i },
  { rarity: 'rare', re: /\brares?\b/i },
  { rarity: 'common', re: /\bcommunes?\b|\bcommons?\b/i },
];

const RARITY_COUNT_PATTERNS: Array<{ rarity: Rarity; source: string }> = [
  { rarity: 'uncommon', source: '(\\d+)\\s*(?:cartes?\\s+)?(?:peu[-\\s]?communes?|uncommons?)' },
  { rarity: 'mythic', source: '(\\d+)\\s*(?:cartes?\\s+)?(?:en\\s+)?(?:mythiques?|mythics?)' },
  { rarity: 'legendary', source: '(\\d+)\\s*(?:cartes?\\s+)?(?:en\\s+)?(?:l[eé]gendaires?|legendaries)' },
  { rarity: 'epic', source: '(\\d+)\\s*(?:cartes?\\s+)?(?:en\\s+)?(?:[eé]piques?|epics?)' },
  { rarity: 'rare', source: '(\\d+)\\s*(?:cartes?\\s+)?(?:en\\s+)?rares?\\b' },
  { rarity: 'common', source: '(\\d+)\\s*(?:cartes?\\s+)?(?:en\\s+)?(?:communes?|commons?)\\b' },
];

type ThemeBrief = {
  instructions: string;
  exclude: string[];
  giphyQueries: string[];
  cast: string[];
};

function parseNumberedRarities(theme: string): Partial<Record<Rarity, number>> {
  const found: Partial<Record<Rarity, number>> = {};
  for (const { rarity, source } of RARITY_COUNT_PATTERNS) {
    const re = new RegExp(source, 'gi');
    let total = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(theme))) total += Number(match[1]);
    if (total > 0) found[rarity] = total;
  }
  return found;
}

function unnumberedAllowed(theme: string): Rarity[] | null {
  const found = RARITY_WORDS.filter(({ re }) => re.test(theme)).map(({ rarity }) => rarity);
  if (!found.length) return null;
  const constraint = /seulement(?:\s+des)?|uniquement(?:\s+des)?|(?:que|uniquement|seulement) des (?:cartes?\s+)?(?:communes?|peu[-\s]?communes?|rares?|[eé]piques?|l[eé]gendaires?|mythiques?)|toutes? (?:les )?cartes|\bonly\b|must be|all (?:cards|of them)/i.test(theme);
  const highOnly = found.every((rarity) => rarity === 'epic' || rarity === 'legendary' || rarity === 'mythic');
  if (constraint || highOnly) return found;
  return null;
}

function scaleCounts(weights: Partial<Record<Rarity, number>>, n: number): Record<Rarity, number> {
  const result = {} as Record<Rarity, number>;
  const totalW = RARITY_ORDER.reduce((sum, rarity) => sum + Math.max(0, weights[rarity] || 0), 0);
  if (n <= 0 || totalW <= 0) {
    for (const rarity of RARITY_ORDER) result[rarity] = rarity === 'common' ? Math.max(0, n) : 0;
    return result;
  }
  const parts = RARITY_ORDER.map((rarity) => {
    const raw = (Math.max(0, weights[rarity] || 0) / totalW) * n;
    const whole = Math.floor(raw);
    return { rarity, whole, frac: raw - whole };
  });
  let used = parts.reduce((sum, part) => sum + part.whole, 0);
  const byFrac = [...parts].sort((a, b) => b.frac - a.frac);
  for (const part of byFrac) {
    if (used >= n) break;
    part.whole += 1;
    used += 1;
  }
  while (used > n) {
    const part = parts.find((item) => item.whole > 0);
    if (!part) break;
    part.whole -= 1;
    used -= 1;
  }
  for (const part of parts) result[part.rarity] = part.whole;
  return result;
}

function spreadRarities(counts: Record<Rarity, number>, n: number): Rarity[] {
  const specials: Rarity[] = [];
  for (const rarity of RARITY_ORDER) {
    if (rarity === 'common') continue;
    for (let i = 0; i < (counts[rarity] || 0); i += 1) specials.push(rarity);
  }
  const plan: Rarity[] = Array.from({ length: n }, () => 'common');
  if (!specials.length) return plan;
  const step = n / specials.length;
  specials.forEach((rarity, i) => {
    const hint = Math.min(n - 1, Math.floor(i * step + step / 2));
    let slot = hint;
    for (let delta = 0; delta < n; delta += 1) {
      const right = hint + delta;
      const left = hint - delta;
      if (right < n && plan[right] === 'common') { slot = right; break; }
      if (left >= 0 && plan[left] === 'common') { slot = left; break; }
    }
    plan[slot] = rarity;
  });
  return plan;
}

function planRarities(theme: string, count: number): Rarity[] {
  const numbered = parseNumberedRarities(theme);
  const numberedSum = RARITY_ORDER.reduce((sum, rarity) => sum + (numbered[rarity] || 0), 0);
  if (numberedSum > 0) return spreadRarities(scaleCounts(numbered, count), count);
  const allowed = unnumberedAllowed(theme);
  if (allowed?.length) {
    const weights = {} as Partial<Record<Rarity, number>>;
    for (const rarity of allowed) weights[rarity] = 1;
    return spreadRarities(scaleCounts(weights, count), count);
  }
  return spreadRarities(scaleCounts(MIX_TARGETS, count), count);
}

function looksFor(rarity: Rarity): { artFilter: ArtFilter; borderFinish: BorderFinish } {
  if (rarity === 'mythic') return { artFilter: 'holo', borderFinish: 'prism' };
  if (rarity === 'legendary') return { artFilter: 'holo', borderFinish: 'neon' };
  if (rarity === 'epic') return { artFilter: 'holo', borderFinish: 'metallic' };
  if (rarity === 'rare') return { artFilter: 'shiny', borderFinish: 'shiny' };
  return { artFilter: 'none', borderFinish: 'matte' };
}

function applyPlannedRarity(draft: AiCardDraft, rarity: Rarity): AiCardDraft {
  return { ...draft, rarity, ...looksFor(rarity) };
}

function asStringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || '').trim()).filter((item) => item.length >= 2))].slice(0, max);
}

function guessExclude(theme: string): string[] {
  const found: string[] = [];
  const re = /(?:pas(?:\s+de)?|sans)\s+(?!exclusivement|seulement|uniquement|que\s+(?:du|de|des|le|la|un|une)\b)(.+?)(?=\s+(?:et|ou)\s+(?:pas|sans)|[.,;]|$)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(theme))) {
    const text = match[1].replace(/\b(l['’]|le|la|les|un|une|des)\s*/gi, '').trim();
    if (/exclusivement|seulement|uniquement|varie/.test(text)) continue;
    if (text.length >= 2 && text.length <= 40) found.push(text);
  }
  return [...new Set(found)];
}

function dropCastFromExclude(exclude: string[], cast: string[]): string[] {
  if (!cast.length) return exclude.filter((item) => !/exclusivement|seulement|uniquement|varie/.test(item));
  return exclude.filter((item) => {
    const n = item.toLowerCase();
    if (/exclusivement|seulement|uniquement|varie/.test(n)) return false;
    return !cast.some((name) => {
      const c = name.toLowerCase();
      return n.includes(c) || c.includes(n);
    });
  });
}

function fallbackQueries(theme: string, universeName: string): string[] {
  const cleaned = theme
    .replace(/\d+/g, ' ')
    .replace(/je veux|donc|dans les|cartes?|communes?|peu[-\s]?communes?|rares?|[eé]piques?|l[eé]gendaires?|mythiques?|uniquement|seulement/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return [...new Set([
    cleaned.slice(0, 60),
    `${cleaned} ${universeName}`.slice(0, 60),
  ].filter((query) => query.trim().length >= 3))];
}

async function interpretBrief(theme: string, universeName: string, count: number): Promise<ThemeBrief> {
  const guessedExclude = guessExclude(theme);
  const fallback = fallbackQueries(theme, universeName);
  try {
    const json = await chatJson(
      `Tu prépares une génération de cartes TCG. Lis la demande du créateur et extrais un JSON fidèle.
Univers (catalogue) : ${universeName}
Nombre de cartes : ${count}
Demande : ${theme}

Réponds { "instructions": string, "cast": string[], "exclude": string[], "giphyQueries": string[] }.
- instructions : consigne de game design en français, 1 à 4 phrases, fidèle au texte du créateur. Sans les comptes de rareté.
- cast : personnages / sujets AUTORISÉS cités nommément, PLUS d’autres du même thème si « ... » ou s’il n’y a pas assez de noms pour ${count} cartes distinctes. Ex. « pirates, sorcière, golem » → ["pirate","witch","golem"].
- exclude : seulement les interdits EXPLICITES (« pas X », « sans Y »).
  Si la demande dit « personnages secondaires de X uniquement », X (le protagoniste) va dans exclude.
  « pas exclusivement / pas seulement / varie / répartition équilibrée » NE veut PAS dire d’exclure le sujet : il a le droit d’être là, plusieurs fois si les GIFs le montrent.
  Ne mets JAMAIS un perso du cast dans exclude.
- giphyQueries : UNE recherche Giphy en ANGLAIS par perso/sujet du cast (6 à 12 max) pour couvrir la liste, sans quota par perso sur les cartes.
  Ex. pirate + sorcière + dragon → "pirate ship captain", "witch broom cauldron", "dragon fire castle".
  PAS de nombres, PAS de rareté. N’ajoute pas de sujets hors consigne.
  Si un sujet est exclu, n’en fais pas une query à lui tout seul.`,
      { temperature: 0.2 },
    );
    const instructions = clip(json.instructions, 800) || theme;
    const cast = asStringList(json.cast, 16);
    const exclude = dropCastFromExclude(
      [...new Set([...guessedExclude, ...asStringList(json.exclude, 12)])],
      cast,
    );
    const giphyQueries = asStringList(json.giphyQueries, 16);
    return {
      instructions,
      exclude,
      giphyQueries: giphyQueries.length ? giphyQueries : fallback,
      cast,
    };
  } catch {
    return {
      instructions: theme,
      exclude: dropCastFromExclude(guessedExclude, []),
      giphyQueries: fallback,
      cast: [],
    };
  }
}

export type AiCardDraft = {
  name: string;
  subtitle: string | null;
  description: string | null;
  flavorText: string | null;
  kind: CardKind;
  subtype: string | null;
  rarity: Rarity;
  magicType: MagicType;
  style: CardStyle;
  artFilter: ArtFilter;
  borderFinish: BorderFinish;
  power: number | null;
  toughness: number | null;
  artist: string | null;
  artUrl: string | null;
  artAnimatedUrl: string | null;
  giphyUrl: string | null;
  artSeed: string;
  giphyTitle: string | null;
};

type GifMeta = {
  id: string;
  title: string;
  gif: string;
  still: string;
};

function skeletonDraft(gif: GifMeta, rarity: Rarity): AiCardDraft {
  return applyPlannedRarity({
    name: '',
    subtitle: null,
    description: null,
    flavorText: null,
    kind: 'creature',
    subtype: null,
    rarity,
    magicType: 'none',
    style: 'painterly',
    artFilter: 'none',
    borderFinish: 'matte',
    power: null,
    toughness: null,
    artist: null,
    artUrl: gif.still,
    artAnimatedUrl: gif.gif,
    giphyUrl: gif.gif,
    artSeed: slugifySeed(gif.id),
    giphyTitle: gif.title || null,
  }, rarity);
}

export function aiStatus() {
  return {
    openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
    giphy: Boolean(process.env.GIPHY_API_KEY?.trim()),
  };
}

function openaiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new AppError('Clé OpenAI manquante. Ajoute OPENAI_API_KEY dans .env', 503);
  return key;
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback;
}

function clip(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

function unwrapQuotes(value: string | null): string | null {
  if (!value) return null;
  let text = value.trim().replace(/^=\s*/, '');
  for (let i = 0; i < 3; i += 1) {
    const next = text.replace(/^[«‹“"']+\s*/, '').replace(/\s*[»›”"']+$/, '').trim();
    if (next === text) break;
    text = next;
  }
  return text || null;
}

function asInt(value: unknown, min: number, max: number): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function parseUrls(raw: unknown): string[] {
  const text = Array.isArray(raw) ? raw.join('\n') : String(raw || '');
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const line of text.split(/[\s,;]+/)) {
    const id = giphyIdFromUrl(line);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    urls.push(line.trim());
  }
  return urls;
}

async function giphyMeta(url: string): Promise<GifMeta> {
  const id = giphyIdFromUrl(url);
  if (!id) throw new AppError(`Lien Giphy invalide : ${url.slice(0, 80)}`, 400);
  const gif = giphyGifUrl(id);
  const still = giphyStillUrl(id);
  let title = '';
  try {
    const res = await fetch(`https://giphy.com/services/oembed?url=${encodeURIComponent(`https://giphy.com/gifs/${id}`)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const body = await res.json() as { title?: string };
      title = String(body.title || '').replace(/\s+GIF.*$/i, '').trim();
    }
  } catch {
    /* title is optional */
  }
  return { id, title, gif, still };
}

function gifFromHit(item: { id: string; title?: string }): GifMeta {
  return {
    id: item.id,
    title: String(item.title || '').replace(/\s+GIF.*$/i, '').trim(),
    gif: giphyGifUrl(item.id),
    still: giphyStillUrl(item.id),
  };
}

function usedGifIds(cards: Array<{ artUrl?: string | null; artAnimatedUrl?: string | null; giphyUrl?: string | null }>): Set<string> {
  const used = new Set<string>();
  for (const card of cards) {
    for (const url of [card.giphyUrl, card.artAnimatedUrl, card.artUrl]) {
      const id = giphyIdFromUrl(url);
      if (id) used.add(id);
    }
  }
  return used;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class OpenAiCallError extends AppError {
  retryable: boolean;
  retryAfterMs: number;

  constructor(message: string, retryable = false, retryAfterMs = 0) {
    super(message, 502);
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
  }
}

const BILLING_CODES = new Set([
  'insufficient_quota',
  'credit_balance_exhausted',
  'organization_spend_limit_exceeded',
  'project_spend_limit_exceeded',
  'organization_usage_limit_exceeded',
]);

function retryWaitMs(header: string | null, message: string): number {
  const fromMsg = message.match(/try again in ([\d.]+)\s*(ms|s)\b/i);
  if (fromMsg) {
    const n = Number(fromMsg[1]);
    const ms = fromMsg[2].toLowerCase() === 'ms' ? n : n * 1000;
    if (Number.isFinite(ms) && ms >= 0) return Math.min(60_000, Math.ceil(ms) + 150);
  }
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(60_000, Math.ceil(seconds * 1000) + 150);
    const at = Date.parse(header);
    if (Number.isFinite(at)) return Math.min(60_000, Math.max(0, at - Date.now() + 150));
  }
  return 1_200;
}

function openaiFailure(status: number, raw: string, retryAfterHeader: string | null): OpenAiCallError {
  let code = '';
  let type = '';
  let message = '';
  try {
    const body = JSON.parse(raw) as { error?: { code?: string; type?: string; message?: string } };
    code = String(body.error?.code || '');
    type = String(body.error?.type || '');
    message = String(body.error?.message || '');
  } catch {
    /* ignore parse errors */
  }
  console.warn('[openai]', { status, code: code || type || 'unknown', hint: message.slice(0, 180) });
  if (status === 401) return new OpenAiCallError('Clé OpenAI refusée. Vérifie OPENAI_API_KEY.');
  if (BILLING_CODES.has(code) || type === 'insufficient_quota') {
    if (code === 'project_spend_limit_exceeded') {
      return new OpenAiCallError('Plafond de dépense du projet OpenAI atteint — ce n’est pas le solde. Augmente-le dans platform.openai.com → Project → Limits.');
    }
    if (code === 'organization_spend_limit_exceeded' || code === 'organization_usage_limit_exceeded') {
      return new OpenAiCallError('Plafond d’usage OpenAI de l’organisation atteint — ce n’est pas le solde. Augmente la limite mensuelle dans platform.openai.com → Settings → Limits.');
    }
    return new OpenAiCallError('Crédit API OpenAI insuffisant (platform.openai.com → Billing). Un abonnement ChatGPT ne paie pas l’API.');
  }
  if (status === 429) {
    return new OpenAiCallError(
      'OpenAI a ralenti les requêtes (limite de débit, pas le solde).',
      true,
      retryWaitMs(retryAfterHeader, message),
    );
  }
  return new OpenAiCallError('OpenAI n’a pas pu générer les cartes.');
}

async function chatJson(
  prompt: string,
  options: { images?: string[]; temperature?: number } = {},
): Promise<Record<string, unknown>> {
  const images = options.images || [];
  const temperature = options.temperature ?? 0.7;
  try {
    return await requestJson(prompt, images, temperature);
  } catch (error) {
    if (!images.length) throw error;
    if (error instanceof OpenAiCallError) throw error;
    const alts = images.map((url) => url.replace(/giphy_s\.gif$/i, '200_s.gif'));
    if (alts.every((url, i) => url === images[i])) throw error;
    return requestJson(prompt, alts, temperature);
  }
}

let lastOpenAiAt = 0;
const OPENAI_MIN_GAP_MS = 1_200;
const OPENAI_RETRY_BUDGET_MS = 180_000;

async function requestJson(prompt: string, images: string[], temperature: number): Promise<Record<string, unknown>> {
  const content: Array<Record<string, unknown>> = [{ type: 'text', text: prompt }];
  images.slice(0, 6).forEach((url, index) => {
    content.push({ type: 'text', text: `Image ${index + 1} :` });
    content.push({ type: 'image_url', image_url: { url } });
  });
  const payload = JSON.stringify({
    model: 'gpt-4o-mini',
    temperature,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'Tu es un game designer TCG francophone. Tu réponds uniquement en JSON valide, sans markdown.',
      },
      { role: 'user', content },
    ],
  });
  const deadline = Date.now() + OPENAI_RETRY_BUDGET_MS;
  let lastError: OpenAiCallError | null = null;
  let skipGap = false;
  while (Date.now() < deadline) {
    if (!skipGap) {
      const gap = OPENAI_MIN_GAP_MS - (Date.now() - lastOpenAiAt);
      if (gap > 0) await sleep(gap);
    }
    skipGap = false;
    lastOpenAiAt = Date.now();
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey()}`,
        'Content-Type': 'application/json',
      },
      body: payload,
    });
    const raw = await res.text();
    if (!res.ok) {
      lastError = openaiFailure(res.status, raw, res.headers.get('retry-after'));
      if (!lastError.retryable) throw lastError;
      const wait = lastError.retryAfterMs;
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const waitMs = Math.min(wait, remaining);
      const label = `Limite de tokens OpenAI — attente ${(waitMs / 1000).toFixed(1)}s`;
      console.warn(`[openai] TPM, attente ${waitMs}ms puis reprise du même appel`);
      report('wait', label);
      await sleep(waitMs);
      skipGap = true;
      continue;
    }
    let parsed: { choices?: Array<{ message?: { content?: string } }> };
    try {
      parsed = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string } }> };
    } catch {
      throw new AppError('Réponse OpenAI illisible', 502);
    }
    const text = parsed.choices?.[0]?.message?.content || '';
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new AppError('L’IA n’a pas renvoyé un JSON exploitable', 502);
    }
  }
  throw new AppError('OpenAI reste saturé après plusieurs minutes d’attente. Relance : le thème est encore dans le formulaire.', 502);
}

function normalizeDraft(raw: Record<string, unknown>, gif?: GifMeta): AiCardDraft {
  const kind = pickEnum(raw.kind, CARD_KINDS, 'creature');
  const rarity = pickEnum(raw.rarity, RARITIES, 'common');
  const hasStats = kindHasCombatStats(kind);
  const name = clip(raw.name, 120) || gif?.title || 'Carte sans nom';
  return {
    name,
    subtitle: clip(raw.subtitle, 120),
    description: clip(raw.description, 800),
    flavorText: unwrapQuotes(clip(raw.flavorText, 500)),
    kind,
    subtype: clip(raw.subtype, 80),
    rarity,
    magicType: pickEnum(raw.magicType, MAGIC_TYPES, 'none'),
    style: pickEnum(raw.style, CARD_STYLES, 'painterly'),
    artFilter: pickEnum(raw.artFilter, ART_FILTERS, 'none'),
    borderFinish: pickEnum(raw.borderFinish, BORDER_FINISHES, 'matte'),
    power: hasStats ? asInt(raw.power, 0, 20) : null,
    toughness: hasStats ? asInt(raw.toughness, 0, 20) : null,
    artist: clip(raw.artist, 80) || 'Atelier Anacra',
    artUrl: gif?.still || null,
    artAnimatedUrl: gif?.gif || null,
    giphyUrl: gif?.gif || originGiphyUrl(typeof raw.giphyUrl === 'string' ? raw.giphyUrl : null),
    artSeed: slugifySeed(name),
    giphyTitle: gif?.title || clip(raw.giphyTitle, 160),
  };
}

function cardSchemaHint() {
  return `Champs par carte :
name (français, collé à la scène vue, PAS le titre Giphy),
subtitle (accroche de la scène, pas un titre anglais Giphy),
description (2-3 phrases de règles TCG — jamais « un gif de… », jamais raconter le fichier),
flavorText (citation courte collée à la scène, SANS guillemets — la carte les ajoute),
kind (${CARD_KINDS.join('|')}), subtype,
rarity (${RARITIES.join('|')} — déjà imposée par carte, recopie-la),
magicType (${MAGIC_TYPES.join('|')}),
style (${CARD_STYLES.join('|')}),
artFilter (${ART_FILTERS.join('|')}),
borderFinish (${BORDER_FINISHES.join('|')}),
power et toughness (entiers, seulement si kind=creature, sinon null),
artist.
L’IMAGE dit qui est sur CETTE carte. Le titre Giphy est souvent faux.
Si l’image a été collée par le créateur, décris ce qui est vu — même si ça recoupe un sujet exclu.
Sinon, respecte les exclusions : ne nomme pas un personnage interdit.
Ne copie pas de marques trop collées : transforme en personnage / objet / lieu de l’univers.`;
}

async function gatherThemeGifs(queries: string[], want: number, used: Set<string>): Promise<GifMeta[]> {
  const list = queries.filter((query) => query.trim().length >= 2);
  if (!list.length || want <= 0) return [];
  const cache = new Map<string, GifMeta[]>();
  const cursor = new Map<string, number>();
  const picked: GifMeta[] = [];
  const cap = Math.max(2, Math.ceil(want / list.length));

  const load = async (query: string): Promise<GifMeta[]> => {
    const hit = cache.get(query);
    if (hit) return hit;
    report('giphy', `Recherche Giphy : « ${query.slice(0, 42)} »…`);
    let batch: GifMeta[] = [];
    try {
      batch = await searchGiphyGifs(query, 50);
    } catch {
      batch = [];
    }
    cache.set(query, batch);
    return batch;
  };

  const take = async (query: string, max: number) => {
    const batch = await load(query);
    let i = cursor.get(query) || 0;
    let added = 0;
    while (i < batch.length && added < max && picked.length < want) {
      const gif = batch[i];
      i += 1;
      if (used.has(gif.id)) continue;
      used.add(gif.id);
      picked.push(gif);
      added += 1;
    }
    cursor.set(query, i);
  };

  for (const query of list) {
    if (picked.length >= want) break;
    await take(query, cap);
  }
  for (const query of list) {
    if (picked.length >= want) break;
    await take(query, want - picked.length);
  }
  return picked;
}

async function rejectExcludedGifs(
  gifs: GifMeta[],
  exclude: string[],
  need: number,
  onKeep?: (kept: GifMeta[]) => void,
): Promise<GifMeta[]> {
  if (!gifs.length) return [];
  if (!exclude.length) {
    const picked = gifs.slice(0, need);
    onKeep?.(picked);
    return picked;
  }
  const kept: GifMeta[] = [];
  const batchSize = 6;
  for (let start = 0; start < gifs.length && kept.length < need; start += batchSize) {
    const chunk = gifs.slice(start, start + batchSize);
    report('filter', `Tri des GIFs (${kept.length}/${need} gardés)…`);
    let flags: unknown[] = [];
    try {
      const json = await chatJson(
        `Le créateur interdit ces sujets comme personnage PRINCIPAL de l’image : ${exclude.join(', ')}.
Identifie visuellement chaque interdit (apparence, pas seulement le nom écrit).
Ne jette une image QUE si le sujet principal EST clairement l’un des interdits.
Les autres personnages du même univers / de la même scène restent autorisés, sauf s’ils sont listés.
Réponds { "keep": [true/false, ...] } — un booléen par image, dans l’ordre. true = on garde. false = on jette.
Il faut exactement ${chunk.length} booléens.`,
        { images: chunk.map((gif) => gif.still), temperature: 0 },
      );
      flags = Array.isArray(json.keep) ? json.keep : [];
    } catch (error) {
      if (error instanceof OpenAiCallError) throw error;
      flags = chunk.map(() => true);
    }
    chunk.forEach((gif, i) => {
      if (flags[i] !== false) kept.push(gif);
    });
    onKeep?.(kept.slice(0, need));
  }
  return kept.slice(0, need);
}

function matchGifsPrompt(gifs: GifMeta[], rarities: Rarity[]): string {
  return `Les images suivent, numérotées. Une carte par image, MÊME INDEX.
Rareté imposée (recopie dans rarity, ne change pas) :
${gifs.map((_, i) => `${i + 1}. ${rarities[i] || 'common'}`).join('\n')}
Pour chaque image : décris d’abord qui et quoi tu vois, puis invente la carte à partir de ÇA — si ça respecte la consigne.
Titres Giphy (indices seulement, souvent trompeurs) :
${gifs.map((gif, i) => `${i + 1}. « ${gif.title || 'sans titre'} »`).join('\n')}`;
}

async function universeContext(universeId: number, editionId: number) {
  const [universes, editions, cards] = await Promise.all([
    listUniverses(),
    listEditions(universeId),
    listCards({ universeId, editionId }),
  ]);
  const universe = universes.find((item) => item.id === universeId);
  const edition = editions.find((item) => item.id === editionId);
  if (!universe) throw new AppError('Univers introuvable', 404);
  if (!edition) throw new AppError('Édition introuvable', 404);
  return { universe, edition, cards };
}

export function draftToInput(draft: AiCardDraft, universeId: number, editionId: number): CardInput {
  return {
    universeId,
    editionId,
    collectorNumber: 0,
    name: draft.name,
    subtitle: draft.subtitle,
    description: draft.description,
    flavorText: draft.flavorText,
    style: draft.style,
    magicType: draft.magicType,
    kind: draft.kind,
    subtype: draft.subtype,
    rarity: draft.rarity,
    foil: false,
    animated: false,
    frameStyle: 'classic',
    holofoilPattern: 'none',
    power: draft.power,
    toughness: draft.toughness,
    artist: draft.artist,
    artSeed: draft.artSeed,
    artUrl: draft.artUrl,
    artFilter: draft.artFilter,
    borderFinish: draft.borderFinish,
    artAnimatedUrl: draft.artAnimatedUrl,
    giphyUrl: draft.giphyUrl,
    animatedUnlockCopies: 5,
  };
}

export async function draftFromGif(body: {
  url: string;
  universeId: number;
  editionId: number;
}): Promise<AiCardDraft> {
  const gif = await giphyMeta(body.url);
  const { universe, edition, cards } = await universeContext(Number(body.universeId), Number(body.editionId));
  const taken = cards.map((card) => card.name).join(', ') || 'aucune';
  const json = await chatJson(
    `Invente une carte TCG pour l’univers « ${universe.name} » (édition « ${edition.name} »).
Regarde l’image. Le nom, le sous-titre et les textes doivent coller à la scène visible.
Titre Giphy (indice seulement, souvent faux) : « ${gif.title || 'sans titre'} ».
Noms déjà pris : ${taken}.
Mix visé : ${JSON.stringify(MIX_TARGETS)}.
${cardSchemaHint()}
Réponds { "card": { ... } }.`,
    { images: [gif.still], temperature: 0.55 },
  );
  const raw = (json.card && typeof json.card === 'object' ? json.card : json) as Record<string, unknown>;
  return normalizeDraft(raw, gif);
}

export async function draftsFromTheme(body: {
  theme: string;
  universeId: number;
  editionId: number;
  count?: number;
  urls?: unknown;
  onProgress?: (event: AiProgressEvent) => void;
  onDrafts?: (drafts: AiCardDraft[]) => void;
}): Promise<AiCardDraft[]> {
  const run = async () => {
    report('start', 'Préparation de la génération…', 3);
    const theme = String(body.theme || '').trim();
    if (theme.length < 3) throw new AppError('Décris le thème (au moins 3 caractères)', 400);
    const count = Math.max(4, Math.min(24, Number(body.count) || 12));
    report('brief', 'Lecture de ta consigne…', 8);
    const { universe, edition, cards } = await universeContext(Number(body.universeId), Number(body.editionId));
    const catalog = await listCards({});
    const taken = cards.map((card) => card.name);
    const used = usedGifIds(catalog);
    const brief = await interpretBrief(theme, universe.name, count);
    report('brief', 'Consigne comprise', 18);
    const pasted: GifMeta[] = [];
    for (const url of parseUrls(body.urls)) {
      const gif = await giphyMeta(url);
      used.add(gif.id);
      pasted.push(gif);
    }
    let live: AiCardDraft[] = [];
    let gifs: GifMeta[] = [];
    if (pasted.length >= count) {
      gifs = pasted.slice(0, count);
      report('giphy', `${gifs.length} GIFs collés — aucun autre n’est cherché`, 32);
      live = gifs.map((gif) => skeletonDraft(gif, 'common'));
      publishDrafts(live);
    } else {
      const need = count - pasted.length;
      report(
        'giphy',
        pasted.length
          ? `${pasted.length} GIFs collés, recherche des ${need} manquants…`
          : 'Recherche des GIFs Giphy…',
        22,
      );
      const poolNeed = Math.max(need * 2, need + 6);
      let pool = await gatherThemeGifs(brief.giphyQueries, poolNeed, used);
      report('giphy', `${pool.length + pasted.length} GIFs trouvés`, 32);
      report('filter', 'Écart des GIFs qui ne collent pas à la consigne…', 36);
      let extra = await rejectExcludedGifs(pool, brief.exclude, need, (kept) => {
        live = [...pasted, ...kept].map((gif) => skeletonDraft(gif, 'common'));
        publishDrafts(live);
      });
      for (let round = 0; round < 3 && extra.length < need; round += 1) {
        report('giphy', `Pas assez de GIFs (${pasted.length + extra.length}/${count}) — recherche encore…`, 34);
        pool = await gatherThemeGifs(brief.giphyQueries, Math.max(12, (need - extra.length) * 3), used);
        if (!pool.length) break;
        const more = await rejectExcludedGifs(pool, brief.exclude, need - extra.length, (kept) => {
          live = [...pasted, ...extra, ...kept].map((gif) => skeletonDraft(gif, 'common'));
          publishDrafts(live);
        });
        if (!more.length) break;
        extra = [...extra, ...more];
      }
      gifs = [...pasted, ...extra].slice(0, count);
    }
    if (!gifs.length) {
      throw new AppError('Aucun GIF ne respecte la consigne (sujets exclus ou déjà utilisés). Affine le thème ou colle des liens autorisés.', 502);
    }
    if (pasted.length >= count) {
      report('giphy', `${gifs.length} GIFs collés retenus`, 48);
    } else {
      report('filter', `${gifs.length} GIF${gifs.length > 1 ? 's' : ''} retenu${gifs.length > 1 ? 's' : ''}`, 48);
    }
    const rarityPlan = planRarities(theme, gifs.length);
    live = gifs.map((gif, i) => skeletonDraft(gif, rarityPlan[i] || 'common'));
    publishDrafts(live);
    const rows: unknown[] = [];
    const batchSize = 6;
    for (let start = 0; start < gifs.length; start += batchSize) {
      if (start > 0) await sleep(800);
      const chunk = gifs.slice(start, start + batchSize);
      const chunkRarities = rarityPlan.slice(start, start + batchSize);
      const from = start + 1;
      const to = start + chunk.length;
      const percent = 50 + Math.round((start / gifs.length) * 45);
      report('cards', `Rédaction des cartes ${from}–${to} / ${gifs.length}…`, percent);
      const json = await chatJson(
        `Crée ${chunk.length} cartes TCG cohérentes. La consigne du créateur PRIME sur tout le reste.
Univers : ${universe.name}.
Édition : ${edition.name}.
Consigne OBLIGATOIRE :
${brief.instructions}
Sujets interdits : ${brief.exclude.join(', ') || 'aucun'}.
${pasted.length ? 'Les GIFs collés par le créateur sont la source : décris l’image telle quelle, n’en cherche pas une autre.' : ''}
Si la consigne demande de varier, fais-le ; s’il y a plusieurs images du même perso, plusieurs cartes de ce perso sont autorisées.
Noms déjà pris (à éviter) : ${[...taken, ...rows.map((row) => (row as { name?: string }).name).filter(Boolean)].join(', ') || 'aucun'}.
${matchGifsPrompt(chunk, chunkRarities)}
${cardSchemaHint()}
Réponds { "cards": [ ... ${chunk.length} objets, dans l’ordre des images ] }.`,
        { images: chunk.map((gif) => gif.still), temperature: 0.45 },
      );
      const batch = Array.isArray(json.cards) ? json.cards : [];
      if (!batch.length) throw new AppError('L’IA n’a renvoyé aucune carte', 502);
      rows.push(...batch);
      chunk.forEach((gif, offset) => {
        const raw = (batch[offset] && typeof batch[offset] === 'object' ? batch[offset] : {}) as Record<string, unknown>;
        live[start + offset] = applyPlannedRarity(normalizeDraft(raw, gif), rarityPlan[start + offset] || 'common');
      });
      publishDrafts([...live]);
    }
    report('done', 'Cartes prêtes', 100);
    return live;
  };
  if (!body.onProgress && !body.onDrafts) return run();
  return progressStore.run({
    emit: body.onProgress || (() => undefined),
    percent: 0,
    drafts: body.onDrafts,
  }, run);
}

export async function searchGiphyGifs(query: string, limit = 16): Promise<GifMeta[]> {
  const key = process.env.GIPHY_API_KEY?.trim();
  if (!key) throw new AppError('Ajoute GIPHY_API_KEY dans .env pour chercher des GIFs', 503);
  const q = query.trim();
  if (q.length < 2) throw new AppError('Recherche trop courte', 400);
  const res = await fetch(
    `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&limit=${Math.max(1, Math.min(50, limit))}&rating=pg-13&lang=en`,
    { signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) throw new AppError('Recherche Giphy impossible', 502);
  const body = await res.json() as { data?: Array<{ id: string; title?: string }> };
  return (body.data || []).filter((item) => item.id).map(gifFromHit);
}
