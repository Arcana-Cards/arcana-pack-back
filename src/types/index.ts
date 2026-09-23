export type UserRole = 'admin' | 'collector';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export type CardStyle =
  | 'painterly'
  | 'pixel'
  | 'comic'
  | 'gothic'
  | 'neon'
  | 'stained_glass'
  | 'watercolor'
  | 'holographic';

export type MagicType =
  | 'none'
  | 'arcane'
  | 'nature'
  | 'fire'
  | 'water'
  | 'shadow'
  | 'holy'
  | 'chaos'
  | 'swamp'
  | 'tech';

export type FrameStyle = 'classic' | 'ornate' | 'minimal' | 'rune' | 'hextech' | 'swamp';

export type HolofoilPattern = 'none' | 'linear' | 'radial' | 'galaxy' | 'prism';

export type CardKind = 'creature' | 'object' | 'land' | 'spell' | 'enchantment';

export type ArtFilter = 'none' | 'shiny' | 'blur' | 'holo' | 'chrome' | 'vignette' | 'swamp' | 'neon' | 'pixel';

export type BorderFinish = 'matte' | 'shiny' | 'metallic' | 'neon' | 'prism' | 'swamp';

export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

export const CARD_STYLES: CardStyle[] = [
  'painterly', 'pixel', 'comic', 'gothic', 'neon', 'stained_glass', 'watercolor', 'holographic',
];

export const MAGIC_TYPES: MagicType[] = [
  'none', 'arcane', 'nature', 'fire', 'water', 'shadow', 'holy', 'chaos', 'swamp', 'tech',
];

export const FRAME_STYLES: FrameStyle[] = ['classic', 'ornate', 'minimal', 'rune', 'hextech', 'swamp'];

export const HOLOFOIL_PATTERNS: HolofoilPattern[] = ['none', 'linear', 'radial', 'galaxy', 'prism'];

export const CARD_KINDS: CardKind[] = ['creature', 'object', 'land', 'spell', 'enchantment'];

export const ART_FILTERS: ArtFilter[] = ['none', 'shiny', 'blur', 'holo', 'chrome', 'vignette', 'swamp', 'neon', 'pixel'];

export const BORDER_FINISHES: BorderFinish[] = ['matte', 'shiny', 'metallic', 'neon', 'prism', 'swamp'];

export function kindHasCombatStats(kind: CardKind): boolean {
  return kind === 'creature';
}

export interface AuthTokenPayload {
  userId: number;
  email: string;
  username: string;
  role: UserRole;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export type RarityWeights = Record<Rarity, number>;

export interface UserDto {
  id: number;
  email: string;
  username: string;
  role: UserRole;
  createdAt: string;
  lastLogin: string | null;
  unopenedBoosters?: number;
  collectedCopies?: number;
}

export interface UniverseDto {
  id: number;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  accentColor: string;
  backdropColor: string;
}

export interface EditionDto {
  id: number;
  universeId: number;
  universeName?: string;
  name: string;
  code: string;
  number: number;
  description: string | null;
  releasedAt: string | null;
  coverColor: string;
  cardCount?: number;
}

export interface CardDto {
  id: number;
  universeId: number;
  universeName?: string;
  universeSlug?: string;
  editionId: number;
  editionName?: string;
  editionCode?: string;
  editionNumber?: number;
  collectorNumber: number;
  name: string;
  subtitle: string | null;
  description: string | null;
  flavorText: string | null;
  style: CardStyle;
  magicType: MagicType;
  kind: CardKind;
  subtype: string | null;
  rarity: Rarity;
  foil: boolean;
  animated: boolean;
  borderColor: string;
  backColor: string;
  glowColor: string;
  textColor: string;
  frameStyle: FrameStyle;
  holofoilPattern: HolofoilPattern;
  power: number | null;
  toughness: number | null;
  artist: string | null;
  artSeed: string;
  artUrl: string | null;
  artFilter: ArtFilter;
  borderFinish: BorderFinish;
  artAnimatedUrl: string | null;
  giphyUrl: string | null;
  animatedUnlockCopies: number;
}

export interface CardInput {
  universeId: number;
  editionId: number;
  collectorNumber?: number;
  name: string;
  subtitle?: string | null;
  description?: string | null;
  flavorText?: string | null;
  style?: CardStyle;
  magicType?: MagicType;
  kind?: CardKind;
  subtype?: string | null;
  rarity?: Rarity;
  foil?: boolean;
  animated?: boolean;
  borderColor?: string;
  backColor?: string;
  glowColor?: string;
  textColor?: string;
  frameStyle?: FrameStyle;
  holofoilPattern?: HolofoilPattern;
  power?: number | null;
  toughness?: number | null;
  artist?: string | null;
  artSeed?: string;
  artUrl?: string | null;
  artFilter?: ArtFilter;
  borderFinish?: BorderFinish;
  artAnimatedUrl?: string | null;
  giphyUrl?: string | null;
  animatedUnlockCopies?: number;
}

export interface BoosterTemplateDto {
  id: number;
  name: string;
  presetKey: string | null;
  description: string | null;
  universeId: number | null;
  universeName?: string | null;
  editionId: number | null;
  editionName?: string | null;
  cardCount: number;
  rarityWeights: RarityWeights;
  averageRarity: Rarity;
  guaranteedRarity: Rarity;
  foilChance: number;
  animatedChance: number;
  allowDuplicates: boolean;
  artUrl: string | null;
}

export interface BoosterTemplateInput {
  name: string;
  description?: string | null;
  universeId?: number | null;
  editionId?: number | null;
  cardCount?: number;
  rarityWeights?: Partial<RarityWeights>;
  averageRarity?: Rarity;
  guaranteedRarity?: Rarity;
  foilChance?: number;
  animatedChance?: number;
  allowDuplicates?: boolean;
  artUrl?: string | null;
}

export interface UserBoosterDto {
  id: number;
  templateId: number;
  templateName: string;
  universeName: string | null;
  editionName: string | null;
  cardCount: number;
  averageRarity: Rarity;
  grantedAt: string;
  openedAt: string | null;
  artUrl: string | null;
}

export interface PulledCopyDto {
  id: number;
  serial: string;
  foil: boolean;
  animated: boolean;
  isNew: boolean;
  copies: number;
  dropChance: number;
  card: CardDto;
}

export interface NotebookSummaryDto {
  editionId: number;
  editionName: string;
  editionCode: string;
  editionNumber: number;
  universeName: string;
  universeSlug: string;
  coverColor: string;
  accentColor: string;
  totalSlots: number;
  ownedSlots: number;
  collectedSlots: number;
  copies: number;
  unplaced: number;
}

export interface NotebookSlotDto {
  collectorNumber: number;
  card: CardDto | null;
  owned: boolean;
  placed: boolean;
  copies: number;
  placedCopies: number;
  foilCopies: number;
  animatedCopies: number;
  placedCopyId: number | null;
  placedFoil: boolean;
  placedAnimated: boolean;
}

export interface BinderPocketDto {
  slotIndex: number;
  copy: LooseCopyDto | null;
}

export interface LooseCopyDto {
  id: number;
  serial: string;
  foil: boolean;
  animated: boolean;
  card: CardDto;
}

export interface NotebookDetailDto {
  summary: NotebookSummaryDto;
  slots: NotebookSlotDto[];
  pockets: BinderPocketDto[];
  pile: LooseCopyDto[];
}
