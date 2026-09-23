import type {
  ArtFilter,
  BorderFinish,
  CardKind,
  CardStyle,
  FrameStyle,
  HolofoilPattern,
  MagicType,
  Rarity,
} from '../types/index.js';

export interface FarFarAwayCardSeed {
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  flavor: string;
  kind: CardKind;
  subtype: string;
  rarity: Rarity;
  style: CardStyle;
  magicType: MagicType;
  frameStyle: FrameStyle;
  holofoilPattern: HolofoilPattern;
  artFilter: ArtFilter;
  borderFinish: BorderFinish;
  foil: boolean;
  animated: boolean;
  power: number | null;
  toughness: number | null;
  artist: string;
  motif: string;
  stillFile?: string;
}

export const FAR_FAR_AWAY_UNIVERSE = {
  slug: 'extremement-loin',
  name: 'Extrêmement Loin',
  tagline: 'Ogres, contes brisés et contrats pailletés',
  description: 'Un royaume de marais, de carrosses oignons et de fées trop zélées, quelque part après le happily ever after.',
  accentColor: '#65a30d',
  backdropColor: '#07120a',
};

export const FAR_FAR_AWAY_EDITION = {
  name: 'Contes du Marais',
  code: 'CDM',
  number: 1,
  description: 'Première édition : créatures du marais, reliques de palais et terrains d’Extrêmement Loin.',
  coverColor: '#14532d',
};

const ARTIST = 'Atelier du Marais';

function looks(rarity: Rarity): Pick<FarFarAwayCardSeed, 'artFilter' | 'borderFinish' | 'foil' | 'holofoilPattern' | 'frameStyle'> {
  const frameStyle: FrameStyle = rarity === 'common'
    ? 'minimal'
    : rarity === 'uncommon'
      ? 'hextech'
      : rarity === 'rare'
        ? 'classic'
        : rarity === 'epic'
          ? 'rune'
          : 'ornate';
  if (rarity === 'mythic') return { artFilter: 'holo', borderFinish: 'prism', foil: true, holofoilPattern: 'prism', frameStyle };
  if (rarity === 'legendary') return { artFilter: 'holo', borderFinish: 'neon', foil: true, holofoilPattern: 'galaxy', frameStyle };
  if (rarity === 'epic') return { artFilter: 'holo', borderFinish: 'metallic', foil: true, holofoilPattern: 'radial', frameStyle };
  if (rarity === 'rare') return { artFilter: 'shiny', borderFinish: 'shiny', foil: false, holofoilPattern: 'linear', frameStyle };
  if (rarity === 'uncommon') return { artFilter: 'swamp', borderFinish: 'swamp', foil: false, holofoilPattern: 'none', frameStyle };
  return { artFilter: 'none', borderFinish: 'matte', foil: false, holofoilPattern: 'none', frameStyle };
}

const RARITY_SHIFT: Record<string, Rarity> = {
  'pain-depices-fuyard': 'uncommon',
  'loup-en-bonnet': 'common',
  'cochon-souffleur': 'common',
  'grenouille-courtisane': 'common',
  'geant-du-pont': 'rare',
  'nain-paillettes': 'common',
  'sorciere-du-pain': 'uncommon',
  'chevalier-oignon': 'uncommon',
  'troll-peager': 'common',
  'arbre-qui-marche': 'uncommon',
  'elementaire-de-boue': 'common',
  'ogrelette': 'uncommon',
  'roi-bombastic': 'rare',
  'reine-de-glace-rose': 'uncommon',
  'chasseur-de-contes': 'common',
  'crapaud-alchimiste': 'common',
  'fee-contremaitre': 'common',
  'dragonnet': 'common',
  'chaton-botte': 'common',
  'bouffon-loin': 'common',
  'ogre-ermite': 'uncommon',
  'nymphe-du-marais': 'uncommon',
  'loup-des-bois-comptes': 'uncommon',
  'sanglier-des-oignons': 'common',
  'chouette-notaire': 'common',
  'golem-de-sucre': 'uncommon',
  'spectre-du-happily': 'rare',
  'cheval-de-carrosse': 'common',
  'dame-de-la-tour': 'uncommon',
  'forgeron-loin': 'common',
  'ogre-des-collines': 'common',
  'fee-rebelle': 'rare',
  'capitaine-felin': 'rare',
  'bebe-dragon': 'common',
  'oignon-magique': 'uncommon',
  'bottes-de-marecage': 'common',
  'contrat-paillete': 'rare',
  'elixir-de-boue': 'common',
  'couronne-bombastic': 'uncommon',
  'bottes-du-gala': 'uncommon',
  'miroir-de-gala': 'rare',
  'cle-de-la-tour': 'common',
  'marais-aux-oignons': 'common',
  'place-du-royaume': 'common',
  'donjon-du-dragon': 'rare',
  'pont-du-peage': 'common',
  'fabrique-de-sucre': 'uncommon',
  'bois-comptes': 'common',
  'mare-aux-vœux': 'common',
  'vœu-en-paillettes': 'uncommon',
  'souffle-du-loup': 'common',
  'decret-minuscule': 'uncommon',
  'happily-contraint': 'rare',
  'malediction-de-la-tour': 'uncommon',
  'paix-du-marais': 'common',
  'quota-des-fees': 'common',
};

function card(draft: {
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  flavor: string;
  kind?: CardKind;
  subtype: string;
  rarity: Rarity;
  magicType: MagicType;
  motif: string;
  stillFile?: string;
  power?: number | null;
  toughness?: number | null;
  style?: CardStyle;
  frameStyle?: FrameStyle;
  artFilter?: ArtFilter;
  borderFinish?: BorderFinish;
}): FarFarAwayCardSeed {
  const kind = draft.kind ?? 'creature';
  const combat = kind === 'creature';
  const rarity = RARITY_SHIFT[draft.slug] ?? draft.rarity;
  const look = looks(rarity);
  return {
    slug: draft.slug,
    name: draft.name,
    subtitle: draft.subtitle,
    description: draft.description,
    flavor: draft.flavor,
    kind,
    subtype: draft.subtype,
    rarity,
    style: draft.style ?? (rarity === 'mythic' ? 'holographic' : 'painterly'),
    magicType: draft.magicType,
    power: combat ? (draft.power ?? 2) : null,
    toughness: combat ? (draft.toughness ?? 2) : null,
    artist: ARTIST,
    motif: draft.motif,
    stillFile: draft.stillFile,
    animated: rarity !== 'common',
    ...look,
    ...(draft.artFilter ? { artFilter: draft.artFilter } : {}),
    ...(draft.borderFinish ? { borderFinish: draft.borderFinish } : {}),
    ...(draft.frameStyle ? { frameStyle: draft.frameStyle } : {}),
  };
}

export const FAR_FAR_AWAY_CARDS: FarFarAwayCardSeed[] = [
  card({ slug: 'ogre-des-marais', name: 'Ogre des Marais', subtitle: 'Ermite à l’oignon', description: 'Quand il grogne, les lucioles se taisent. Il défend sa hutte de boue comme un palais.', flavor: 'On voulait un héros. On a eu un voisin.', subtype: 'Ogre', rarity: 'legendary', magicType: 'swamp', motif: 'ogre', power: 6, toughness: 7 }),
  card({ slug: 'baudet-des-chemins', name: 'Baudet des Chemins', subtitle: 'Bavard infatigable', description: 'Il parle plus vite qu’il ne galope. Ses récits égarent les chasseurs et amusent les ogres.', flavor: 'Chut. Il respire encore.', subtype: 'Baudet', rarity: 'epic', magicType: 'nature', motif: 'donkey', power: 3, toughness: 4 }),
  card({ slug: 'chat-de-gala', name: 'Chat de Gala', subtitle: 'Escrimeur botté', description: 'Plume, rapière et regard de velours. Un ronronnement, et la garde ouvre les portes.', flavor: 'Même les rois signent trop vite.', subtype: 'Félin', rarity: 'legendary', magicType: 'arcane', motif: 'cat', power: 4, toughness: 3 }),
  card({ slug: 'dragonne-du-donjon', name: 'Dragonne du Donjon', subtitle: 'Garde de la tour', description: 'Elle garde la plus haute fenêtre du Royaume. Ses ailes font tomber les carrosses.', flavor: 'Le vrai trésor, c’est le silence.', subtype: 'Dragon', rarity: 'mythic', magicType: 'fire', motif: 'dragon', power: 8, toughness: 8 }),
  card({ slug: 'pain-depices-fuyard', name: 'Pain d’Épices Fuyard', subtitle: 'Crumble vivant', description: 'Jambe cassée, sucre au cran. Il court encore, semoule derrière lui.', flavor: 'Pas le doigt. Jamais le doigt.', subtype: 'Confiserie', rarity: 'rare', magicType: 'chaos', motif: 'cookie', power: 1, toughness: 1, style: 'comic' }),
  card({ slug: 'princesse-boulet', name: 'Princesse-Boulet', subtitle: 'Héritière du donjon', description: 'Élevée par un dragon, elle combat mieux qu’elle ne curtsy. Le palais n’était pas prêt.', flavor: 'Le vrai sort, c’était le protocole.', subtype: 'Princesse', rarity: 'legendary', magicType: 'holy', motif: 'princess', power: 5, toughness: 5 }),
  card({ slug: 'marraine-des-clauses', name: 'Marraine des Clauses', subtitle: 'Fée notaire', description: 'Chaque vœu a un astérisque. Sa baguette sent le papier timbré et la vanille.', flavor: 'Signez. Souriez. Payez.', subtype: 'Fée', rarity: 'mythic', magicType: 'arcane', motif: 'fairy', power: 4, toughness: 6 }),
  card({ slug: 'loup-en-bonnet', name: 'Loup en Bonnet', subtitle: 'Retraité grognon', description: 'Il a rangé les crocs pour un bonnet de nuit. Il grogne encore après les bûcherons.', flavor: 'Cette fois, c’est lui qui lit l’histoire.', subtype: 'Loup', rarity: 'uncommon', magicType: 'shadow', motif: 'wolf', power: 3, toughness: 3 }),
  card({ slug: 'cochon-macon', name: 'Cochon Maçon', subtitle: 'Brique et mortier', description: 'Premier des trois. Ses murs tiennent même quand le vent a un nom.', flavor: 'La paille, c’était un brouillon.', subtype: 'Cochon', rarity: 'common', magicType: 'none', motif: 'pig', power: 2, toughness: 4 }),
  card({ slug: 'cochon-couvreur', name: 'Cochon Couvreur', subtitle: 'Toit de bois', description: 'Il cloue plus vite que le loup souffle. Presque.', flavor: 'Le bois, c’est déjà mieux.', subtype: 'Cochon', rarity: 'common', magicType: 'nature', motif: 'pig-wood', power: 2, toughness: 3 }),
  card({ slug: 'cochon-souffleur', name: 'Cochon du Fort', subtitle: 'Maître des briques', description: 'Le troisième. Le loup a encore mal aux poumons.', flavor: 'On ne souffle pas un contrat.', subtype: 'Cochon', rarity: 'uncommon', magicType: 'none', motif: 'pig-brick', power: 3, toughness: 5 }),
  card({ slug: 'grenouille-courtisane', name: 'Grenouille Courtisane', subtitle: 'Baiser administratif', description: 'Un baiser la change. Deux baisers la mutent. Trois, elle réclame un trône.', flavor: 'La cour a des goûts discutables.', subtype: 'Grenouille', rarity: 'rare', magicType: 'water', motif: 'frog', power: 2, toughness: 2 }),
  card({ slug: 'geant-du-pont', name: 'Géant du Pont', subtitle: 'Péage vivant', description: 'Il vit sous les planches. Le prix, c’est une chanson ou une oreille.', flavor: 'Le tarif change selon l’humeur.', subtype: 'Géant', rarity: 'epic', magicType: 'swamp', motif: 'giant', power: 7, toughness: 7 }),
  card({ slug: 'nain-paillettes', name: 'Nain de Paillettes', subtitle: 'Mineur de strass', description: 'Il creuse des veines de glitter. Les fées lui rachètent tout au noir.', flavor: 'L’or, c’est ringard.', subtype: 'Nain', rarity: 'uncommon', magicType: 'tech', motif: 'dwarf', power: 2, toughness: 3 }),
  card({ slug: 'sorciere-du-pain', name: 'Sorcière du Four', subtitle: 'Recette interdite', description: 'Son four chante. Les enfants qui s’approchent sentent la cannelle et le piège.', flavor: 'Goûtez. Restez.', subtype: 'Sorcière', rarity: 'rare', magicType: 'shadow', motif: 'witch', power: 4, toughness: 4 }),
  card({ slug: 'chevalier-oignon', name: 'Chevalier d’Oignon', subtitle: 'Ordre lacrymal', description: 'Armure en pétales vernis. Il charge, et tout le monde pleure — d’admiration, dit-il.', flavor: 'Pour le duché, et pour le bouillon.', subtype: 'Chevalier', rarity: 'rare', magicType: 'holy', motif: 'knight', power: 4, toughness: 4 }),
  card({ slug: 'troll-peager', name: 'Troll Péager', subtitle: 'Sous le pont royal', description: 'Il encaisse les péages du carrosse rose. Les pièces tombent dans la vase.', flavor: 'Espèces, ou un ogre.', subtype: 'Troll', rarity: 'uncommon', magicType: 'swamp', motif: 'troll', power: 4, toughness: 5 }),
  card({ slug: 'fee-ouvriere', name: 'Fée Ouvrière', subtitle: 'Syndicat des paillettes', description: 'Elle fabrique les vœux à la chaîne. Pause café : trois secondes.', flavor: 'Le happily est un quota.', subtype: 'Fée', rarity: 'common', magicType: 'arcane', motif: 'fairy-work', power: 1, toughness: 2 }),
  card({ slug: 'rat-tailleur', name: 'Rat Tailleur', subtitle: 'Ciseaux de palais', description: 'Il recoud les robes trop petites pour les rois trop grands.', flavor: 'Mesure deux fois. Mords une fois.', subtype: 'Rat', rarity: 'common', magicType: 'none', motif: 'rat', power: 1, toughness: 1 }),
  card({ slug: 'oiseau-messager', name: 'Oiseau Messager', subtitle: 'Postillon royal', description: 'Il porte les convocations. Parfois il les jette dans le marais, par solidarité.', flavor: 'Ni pluie, ni ogre.', subtype: 'Oiseau', rarity: 'common', magicType: 'nature', motif: 'bird', power: 1, toughness: 1 }),
  card({ slug: 'arbre-qui-marche', name: 'Arbre Qui Marche', subtitle: 'Témoin des bois', description: 'Ses racines votent aux conseils. Il n’aime pas les haches, ni les chansons trop justes.', flavor: 'On se souvient des bûcherons.', subtype: 'Arbre', rarity: 'rare', magicType: 'nature', motif: 'tree', power: 5, toughness: 6 }),
  card({ slug: 'elementaire-de-boue', name: 'Élémentaire de Boue', subtitle: 'Mare animée', description: 'Il prend la forme de ce qui s’enfonce. Les bottes, surtout.', flavor: 'Le marais rend ce qu’on lui prête.', subtype: 'Élémentaire', rarity: 'uncommon', magicType: 'swamp', motif: 'mud', power: 3, toughness: 4 }),
  card({ slug: 'ogrelette', name: 'Ogrelette', subtitle: 'Premier cri du marais', description: 'Petite, déjà têtue. Elle collectionne les lucioles dans un bocal percé.', flavor: 'Le marais a des héritiers.', subtype: 'Ogre', rarity: 'epic', magicType: 'swamp', motif: 'ogre-child', power: 2, toughness: 3 }),
  card({ slug: 'roi-bombastic', name: 'Roi Bombastic', subtitle: 'Minuscule et bruyant', description: 'Couronne trop large, ego encore plus. Il déclare la guerre aux ogres tous les mardis.', flavor: 'La taille n’excuse rien.', subtype: 'Roi', rarity: 'epic', magicType: 'holy', motif: 'king', power: 2, toughness: 2 }),
  card({ slug: 'reine-de-glace-rose', name: 'Reine de Glace Rose', subtitle: 'Trône de gelée', description: 'Elle gèle les bals pour que personne ne danse faux. Les carrosses restent nets.', flavor: 'Souriez. Ne bougez plus.', subtype: 'Reine', rarity: 'rare', magicType: 'water', motif: 'queen', power: 3, toughness: 5 }),
  card({ slug: 'chasseur-de-contes', name: 'Chasseur de Contes', subtitle: 'Permis royal', description: 'Il traque les ogres pour affiches. Il rate souvent, et raconte le contraire.', flavor: 'La prime se mesure en rumeurs.', subtype: 'Chasseur', rarity: 'uncommon', magicType: 'none', motif: 'hunter', power: 3, toughness: 3 }),
  card({ slug: 'mouton-enchante', name: 'Mouton Enchanté', subtitle: 'Laine de vœux', description: 'Sa toison retient les sortilèges. Tondre, c’est désenchanter tout un village.', flavor: 'Bêler n’est pas céder.', subtype: 'Mouton', rarity: 'common', magicType: 'holy', motif: 'sheep', power: 1, toughness: 3 }),
  card({ slug: 'crapaud-alchimiste', name: 'Crapaud Alchimiste', subtitle: 'Mare et mortier', description: 'Il distille la vase en élixirs. Goût : étang. Effet : discutable.', flavor: 'Secouez avant d’être changé.', subtype: 'Crapaud', rarity: 'uncommon', magicType: 'swamp', motif: 'toad', power: 2, toughness: 2 }),
  card({ slug: 'fee-contremaitre', name: 'Fée Contremaître', subtitle: 'Sifflet pailleté', description: 'Elle cadre les fées ouvrières. Les retards se paient en poudre d’étoile.', flavor: 'Le quota, c’est magique.', subtype: 'Fée', rarity: 'uncommon', magicType: 'arcane', motif: 'fairy-boss', power: 2, toughness: 3 }),
  card({ slug: 'dragonnet', name: 'Dragonnet du Donjon', subtitle: 'Cendres d’apprentissage', description: 'Il s’exerce à cramer les rideaux. La dragonne soupire, puis corrige le souffle.', flavor: 'Petit feu, grande tour.', subtype: 'Dragon', rarity: 'rare', magicType: 'fire', motif: 'hatchling', power: 3, toughness: 2 }),
  card({ slug: 'chaton-botte', name: 'Chaton Botté', subtitle: 'Apprenti mousquetaire', description: 'Les bottes sont trop grandes. L’orgueil, pile à la taille.', flavor: 'Miaou, et en garde.', subtype: 'Félin', rarity: 'uncommon', magicType: 'arcane', motif: 'kitten', power: 2, toughness: 1 }),
  card({ slug: 'baudet-poulain', name: 'Baudet Poulain', subtitle: 'Premier braiment', description: 'Il n’a pas encore appris à se taire. Le marais s’en accommode.', flavor: 'Le talent est héréditaire.', subtype: 'Baudet', rarity: 'common', magicType: 'nature', motif: 'foal', power: 1, toughness: 2 }),
  card({ slug: 'garde-royal', name: 'Garde Royal', subtitle: 'Casque trop lourd', description: 'Il salue tout ce qui brille. Les ogres passent souvent pour des buissons.', flavor: 'Qui va là ? Un oignon.', subtype: 'Soldat', rarity: 'common', magicType: 'none', motif: 'guard', power: 2, toughness: 2 }),
  card({ slug: 'bouffon-loin', name: 'Bouffon d’Extrêmement Loin', subtitle: 'Clochettes politiques', description: 'Il dit la vérité en rimes. La cour rit, puis signe des décrets contraires.', flavor: 'Le rire est un bouclier mince.', subtype: 'Bouffon', rarity: 'uncommon', magicType: 'chaos', motif: 'jester', power: 2, toughness: 2, style: 'comic' }),
  card({ slug: 'ogre-ermite', name: 'Ogre Ermite', subtitle: 'Plus loin que loin', description: 'Il a quitté le village pour une hutte encore plus vaseuse. Les visiteurs reçoivent des oignons.', flavor: 'Le bonheur, c’est d’être dérangé moins souvent.', subtype: 'Ogre', rarity: 'rare', magicType: 'swamp', motif: 'hermit', power: 5, toughness: 6 }),
  card({ slug: 'nymphe-du-marais', name: 'Nymphe du Marais', subtitle: 'Chant des roseaux', description: 'Elle tisse les brouillards. Les chasseurs suivent sa voix et perdent leurs bottes.', flavor: 'Approchez. Lentement.', subtype: 'Nymphe', rarity: 'rare', magicType: 'water', motif: 'nymph', power: 3, toughness: 4 }),
  card({ slug: 'loup-des-bois-comptes', name: 'Loup des Bois Comptés', subtitle: 'Meute notariale', description: 'Il compte les moutons enchantés. Un manque, et le village tremble.', flavor: 'Un, deux, trois… dévorés.', subtype: 'Loup', rarity: 'rare', magicType: 'shadow', motif: 'wolf-pack', power: 4, toughness: 3 }),
  card({ slug: 'sanglier-des-oignons', name: 'Sanglier des Oignons', subtitle: 'Défenseur des champs', description: 'Il laboure les parcelles royales la nuit. Le matin, tout sent le bouillon.', flavor: 'Les sillons sont des signatures.', subtype: 'Sanglier', rarity: 'uncommon', magicType: 'nature', motif: 'boar', power: 4, toughness: 4 }),
  card({ slug: 'chouette-notaire', name: 'Chouette Notaire', subtitle: 'Greffe nocturne', description: 'Elle archive les vœux non honorés. Ses hiboux-clercs tamponnent à minuit.', flavor: 'Hou-hou, clause 12.', subtype: 'Chouette', rarity: 'uncommon', magicType: 'arcane', motif: 'owl', power: 2, toughness: 3 }),
  card({ slug: 'golem-de-sucre', name: 'Golem de Sucre', subtitle: 'Garde sucré', description: 'Cuit trop longtemps, il durcit. Les fées le polissent avant les bals.', flavor: 'Ne le laissez pas sous la pluie.', subtype: 'Golem', rarity: 'rare', magicType: 'chaos', motif: 'golem', power: 5, toughness: 5 }),
  card({ slug: 'spectre-du-happily', name: 'Spectre du Happily', subtitle: 'Fin qui revient', description: 'Il hante les châteaux trop parfaits. Un « ils vécurent heureux » trop vite dit l’attire.', flavor: 'Les contes ont des dettes.', subtype: 'Spectre', rarity: 'epic', magicType: 'shadow', motif: 'ghost', power: 4, toughness: 4, artFilter: 'blur' }),
  card({ slug: 'cheval-de-carrosse', name: 'Cheval de Carrosse', subtitle: 'Minuit approche', description: 'Il redevient citrouille si on le parie trop fort. En attendant, il galope or.', flavor: 'Les fers sonnent les clauses.', subtype: 'Cheval', rarity: 'uncommon', magicType: 'holy', motif: 'horse', power: 3, toughness: 3 }),
  card({ slug: 'patre-magique', name: 'Pâtre Magique', subtitle: 'Flûte des collines', description: 'Sa flûte range les moutons et dérange les rois. Les ogres tapent du pied, en rythme.', flavor: 'Un air, et le village suit.', subtype: 'Pâtre', rarity: 'common', magicType: 'nature', motif: 'shepherd', power: 2, toughness: 2 }),
  card({ slug: 'dame-de-la-tour', name: 'Dame de la Tour', subtitle: 'Chevelure-échelle', description: 'Elle a coupé ses nattes pour descendre seule. La tour est devenue un belvédère.', flavor: 'On n’attend plus le prince.', subtype: 'Dame', rarity: 'rare', magicType: 'holy', motif: 'lady', power: 3, toughness: 4 }),
  card({ slug: 'forgeron-loin', name: 'Forgeron d’Extrêmement Loin', subtitle: 'Fers et fables', description: 'Il ferre les carrosses et recuit les armures d’oignon. L’enclume sent le soufre sucré.', flavor: 'Tout se répare, sauf un vœu.', subtype: 'Forgeron', rarity: 'uncommon', magicType: 'fire', motif: 'smith', power: 3, toughness: 4 }),
  card({ slug: 'enfant-pain-depices', name: 'Enfant Pain d’Épices', subtitle: 'Fournée suivante', description: 'Plus petit, plus rapide. Il a appris à ne plus tendre le doigt.', flavor: 'Cuit à point, jamais pris.', subtype: 'Confiserie', rarity: 'common', magicType: 'chaos', motif: 'cookie-kid', power: 1, toughness: 1, style: 'comic' }),
  card({ slug: 'ogre-des-collines', name: 'Ogre des Collines', subtitle: 'Cousin voyageur', description: 'Moins vaseux, plus caillouteux. Il collectionne les panneaux « ogre, danger ».', flavor: 'La famille s’étend plus loin que loin.', subtype: 'Ogre', rarity: 'uncommon', magicType: 'swamp', motif: 'ogre-hill', power: 5, toughness: 5 }),
  card({ slug: 'fee-rebelle', name: 'Fée Rebelle', subtitle: 'Clause rayée', description: 'Elle refuse les quotas. Ses paillettes tombent où elles veulent, souvent sur les ogres.', flavor: 'Le happily, on le négocie.', subtype: 'Fée', rarity: 'epic', magicType: 'chaos', motif: 'rebel', power: 3, toughness: 3 }),
  card({ slug: 'capitaine-felin', name: 'Capitaine des Mousquetaires Félins', subtitle: 'Plume et peloton', description: 'Il commande trois chats bottés et un baudet malgré lui. Les duels finissent en sieste.', flavor: 'Tous pour un, un pour les sardines.', subtype: 'Félin', rarity: 'epic', magicType: 'arcane', motif: 'musketeer', power: 4, toughness: 4 }),
  card({ slug: 'bebe-dragon', name: 'Bébé Dragon', subtitle: 'Œuf fêlé', description: 'À peine né, déjà trop chaud pour le berceau. La tour sent le souffre et le lait.', flavor: 'Dodo. Ou cendres.', subtype: 'Dragon', rarity: 'rare', magicType: 'fire', motif: 'baby-dragon', power: 2, toughness: 2 }),

  card({ slug: 'oignon-magique', name: 'Oignon Magique', subtitle: 'Relique lacrymale', description: 'Coupez-le : tout le palais pleure, même les statues. Les ogres le considèrent comme un bijou.', flavor: 'Le cœur a des couches.', kind: 'object', subtype: 'Relique', rarity: 'rare', magicType: 'nature', motif: 'onion', stillFile: 'ffa-onion.png' }),
  card({ slug: 'bottes-de-marecage', name: 'Bottes de Marécage', subtitle: 'Pointure ogre', description: 'Elles collent à la vase et refusent les tapis royaux. Un pas, et le salon devient un champ.', flavor: 'On n’essuie pas un marais.', kind: 'object', subtype: 'Équipement', rarity: 'uncommon', magicType: 'swamp', motif: 'boots', stillFile: 'ffa-boots.png' }),
  card({ slug: 'contrat-paillete', name: 'Contrat Pailleté', subtitle: 'Petites lignes roses', description: 'Signez : votre voix, votre château, votre soirée. Les clauses brillent pour qu’on ne les lise pas.', flavor: 'Lu et approuvé, dit la baguette.', kind: 'object', subtype: 'Contrat', rarity: 'epic', magicType: 'arcane', motif: 'scroll', stillFile: 'ffa-contract.png' }),
  card({ slug: 'elixir-de-boue', name: 'Élixir de Boue', subtitle: 'Phiole d’étang', description: 'Un gorgée : peau verte, haleine d’oignon, humeur d’ermite. Deux gorgées : hutte offerte.', flavor: 'Secouer le marais avant usage.', kind: 'object', subtype: 'Potion', rarity: 'uncommon', magicType: 'swamp', motif: 'potion', stillFile: 'ffa-potion.png' }),
  card({ slug: 'couronne-bombastic', name: 'Couronne Bombastic', subtitle: 'Trop grande', description: 'Elle glisse sur les oreilles des rois minuscules. Celui qui la porte parle plus fort, pas mieux.', flavor: 'Le pouvoir pèse un oignon.', kind: 'object', subtype: 'Regalia', rarity: 'rare', magicType: 'holy', motif: 'crown', stillFile: 'ffa-crown.png' }),
  card({ slug: 'bottes-du-gala', name: 'Bottes du Gala', subtitle: 'Cuir et panache', description: 'Un félin les a fait faire. Elles tapent le parquet plus fort que les décrets.', flavor: 'En garde, majesté.', kind: 'object', subtype: 'Équipement', rarity: 'rare', magicType: 'arcane', motif: 'hat-boots', stillFile: 'ffa-hat-boots.png' }),
  card({ slug: 'lanterne-de-lucioles', name: 'Lanterne de Lucioles', subtitle: 'Nuit du marais', description: 'Elle attire les perdus vers la hutte. Parfois vers le troll. La lumière ne choisit pas.', flavor: 'Suivez, à vos risques.', kind: 'object', subtype: 'Lanterne', rarity: 'common', magicType: 'nature', motif: 'lantern' }),
  card({ slug: 'miroir-de-gala', name: 'Miroir de Gala', subtitle: 'Qui est le plus ogre', description: 'Il répond trop honnêtement. Les rois le cachent sous un drap rose.', flavor: 'La vérité a une haleine.', kind: 'object', subtype: 'Miroir', rarity: 'epic', magicType: 'arcane', motif: 'mirror', artFilter: 'chrome' }),
  card({ slug: 'sac-doignons', name: 'Sac d’Oignons', subtitle: 'Provisions d’ermite', description: 'Toujours plein. Toujours lourd. Offrir un oignon, c’est déclarer la paix.', flavor: 'L’amitié se pèle.', kind: 'object', subtype: 'Provisions', rarity: 'common', magicType: 'nature', motif: 'bag' }),
  card({ slug: 'cle-de-la-tour', name: 'Clé de la Tour', subtitle: 'Serrure dragonne', description: 'Elle ouvre la plus haute porte, ou la cage. Selon le sens où on la tourne.', flavor: 'Ne la donnez pas à un chat.', kind: 'object', subtype: 'Clé', rarity: 'uncommon', magicType: 'fire', motif: 'key' }),

  card({ slug: 'marais-aux-oignons', name: 'Marais aux Oignons', subtitle: 'Terre natale', description: 'Boue, roseaux, lucioles. Ici, les palais n’ont pas de tapis, et c’est tant mieux.', flavor: 'On rentre toujours les pieds mouillés.', kind: 'land', subtype: 'Marais', rarity: 'rare', magicType: 'swamp', motif: 'swamp', stillFile: 'ffa-swamp.png', frameStyle: 'swamp' }),
  card({ slug: 'place-du-royaume', name: 'Place du Royaume', subtitle: 'Pavés de gala', description: 'On y célèbre trop de mariages. Les statues sourient encore des anciennes clauses.', flavor: 'Fanfare obligatoire.', kind: 'land', subtype: 'Cité', rarity: 'uncommon', magicType: 'holy', motif: 'square', stillFile: 'ffa-square.png' }),
  card({ slug: 'donjon-du-dragon', name: 'Donjon du Dragon', subtitle: 'Falaise de cendres', description: 'La tour fume même les jours de trêve. Une princesse y a appris à frapper plus fort.', flavor: 'Montez. Ne frappez pas.', kind: 'land', subtype: 'Donjon', rarity: 'epic', magicType: 'fire', motif: 'keep', stillFile: 'ffa-keep.png' }),
  card({ slug: 'pont-du-peage', name: 'Pont du Péage', subtitle: 'Planches et troll', description: 'Chaque planche grince un tarif. Les carrosses ralentissent, les ogres passent à gué.', flavor: 'Payez, ou chantez.', kind: 'land', subtype: 'Pont', rarity: 'uncommon', magicType: 'swamp', motif: 'bridge', stillFile: 'ffa-bridge.png' }),
  card({ slug: 'fabrique-de-sucre', name: 'Fabrique de Sucre', subtitle: 'Fours de minuit', description: 'On y cuit des gardiens comestibles. L’odeur attire les fées et les fuyards.', flavor: 'Ne léchez pas les murs.', kind: 'land', subtype: 'Manufacture', rarity: 'rare', magicType: 'chaos', motif: 'mill', stillFile: 'ffa-mill.png' }),
  card({ slug: 'bois-comptes', name: 'Bois Comptés', subtitle: 'Arbres témoins', description: 'Chaque tronc a un visage. Ils votent contre les haches et pour les ogres silencieux.', flavor: 'Marchez doucement. On vous compte.', kind: 'land', subtype: 'Forêt', rarity: 'rare', magicType: 'nature', motif: 'forest', stillFile: 'ffa-forest.png' }),
  card({ slug: 'champs-doignons', name: 'Champs d’Oignons', subtitle: 'Sillons royaux', description: 'Le sanglier y travaille la nuit. Le jour, les hérauts prétendent que c’est un jardin.', flavor: 'La récolte pique les yeux.', kind: 'land', subtype: 'Champs', rarity: 'common', magicType: 'nature', motif: 'fields' }),
  card({ slug: 'mare-aux-vœux', name: 'Mare aux Vœux', subtitle: 'Eau clause', description: 'Jetez une pièce, signez un avenant. Les grenouilles notent tout.', flavor: 'Les reflets ont des avocats.', kind: 'land', subtype: 'Mare', rarity: 'uncommon', magicType: 'water', motif: 'pond' }),

  card({ slug: 'vœu-en-paillettes', name: 'Vœu en Paillettes', subtitle: 'Éphémère rose', description: 'Change un ogre en prince jusqu’à minuit, ou l’inverse. Les paillettes collent trois jours.', flavor: 'Attention aux astérisques.', kind: 'spell', subtype: 'Éphémère', rarity: 'rare', magicType: 'arcane', motif: 'sparkle', artFilter: 'shiny' }),
  card({ slug: 'souffle-du-loup', name: 'Souffle du Loup', subtitle: 'Rituel venteux', description: 'Détruit une maison de paille ou de bois. Les briques rient encore.', flavor: 'Inspirez. Expirez. Fuyez.', kind: 'spell', subtype: 'Rituel', rarity: 'uncommon', magicType: 'chaos', motif: 'wind', artFilter: 'blur' }),
  card({ slug: 'bouillon-doignon', name: 'Bouillon d’Oignon', subtitle: 'Sort de hutte', description: 'Soigne, réchauffe, fait pleurer l’ennemi. Les trois, souvent.', flavor: 'Servi brûlant, sans palais.', kind: 'spell', subtype: 'Rituel', rarity: 'common', magicType: 'swamp', motif: 'steam' }),
  card({ slug: 'decret-minuscule', name: 'Décret Minuscule', subtitle: 'Édit royal', description: 'Réduit la taille de sa cible. Les rois l’utilisent sur tout le monde sauf eux.', flavor: 'Debout, plus bas.', kind: 'spell', subtype: 'Éphémère', rarity: 'rare', magicType: 'holy', motif: 'decree' }),

  card({ slug: 'happily-contraint', name: 'Happily Contraint', subtitle: 'Aura de gala', description: 'Les créatures sourient, dansent, signent. Le marais résiste un peu plus longtemps.', flavor: 'Ils vécurent heureux. Clause 4.', kind: 'enchantment', subtype: 'Aura', rarity: 'epic', magicType: 'arcane', motif: 'aura', artFilter: 'holo', borderFinish: 'prism' }),
  card({ slug: 'malediction-de-la-tour', name: 'Malédiction de la Tour', subtitle: 'Nuit permanente', description: 'Le soleil n’atteint plus les fenêtres. Un dragon s’y sent enfin chez lui.', flavor: 'Dormez. Gardez.', kind: 'enchantment', subtype: 'Malédiction', rarity: 'rare', magicType: 'shadow', motif: 'curse' }),
  card({ slug: 'paix-du-marais', name: 'Paix du Marais', subtitle: 'Trêve vaseuse', description: 'Nul ne chasse tant que la hutte fume. Les lucioles font office de drapeaux blancs.', flavor: 'Entrez. Enlevez les bottes.', kind: 'enchantment', subtype: 'Aura', rarity: 'uncommon', magicType: 'swamp', motif: 'peace' }),
  card({ slug: 'quota-des-fees', name: 'Quota des Fées', subtype: 'Loi magique', subtitle: 'Production de vœux', description: 'Chaque tour, une paillette de plus. Les ouvrières s’épuisent, le palais brille.', flavor: 'Le bonheur a un rendement.', kind: 'enchantment', rarity: 'uncommon', magicType: 'arcane', motif: 'quota' }),

  card({ slug: 'libellule-du-marais', name: 'Libellule du Marais', subtitle: 'Ailes d’étang', description: 'Elle rase les roseaux et indique les sentiers qui ne mangent pas les bottes.', flavor: 'Suivez le bleu, pas la vase.', subtype: 'Insecte', rarity: 'common', magicType: 'nature', motif: 'bird', power: 1, toughness: 1 }),
  card({ slug: 'crapaud-chanteur', name: 'Crapaud Chanteur', subtitle: 'Chœur de mare', description: 'Il entonne dès le crépuscule. Les ogres l’utilisent comme réveil, les rois comme nuisances.', flavor: 'Do, ré, vase.', subtype: 'Crapaud', rarity: 'common', magicType: 'water', motif: 'toad', power: 1, toughness: 2 }),
  card({ slug: 'poule-du-palais', name: 'Poule du Palais', subtitle: 'Œufs de gala', description: 'Elle pond dans les couloirs. Les valets glissent, les chats bottés feignent l’indifférence.', flavor: 'Cot cot, décret.', subtype: 'Poule', rarity: 'common', magicType: 'none', motif: 'bird', power: 1, toughness: 1 }),
  card({ slug: 'souris-d-ecurie', name: 'Souris d’Écurie', subtitle: 'Grain et paille', description: 'Elle vole l’avoine des chevaux de carrosse. À minuit, elle redevient souris. Elle l’était déjà.', flavor: 'Les fers, c’est pour les autres.', subtype: 'Souris', rarity: 'common', magicType: 'none', motif: 'rat', power: 1, toughness: 1 }),
  card({ slug: 'villageois-du-gue', name: 'Villageois du Gué', subtitle: 'Pieds dans l’eau', description: 'Il pêche des rumeurs et des bottes perdues. Les ogres lui achètent les deux.', flavor: 'On se connaît, par le gué.', subtype: 'Villageois', rarity: 'common', magicType: 'none', motif: 'shepherd', power: 1, toughness: 2 }),
  card({ slug: 'cuisiniere-doignons', name: 'Cuisinière d’Oignons', subtitle: 'Bouillon du village', description: 'Son chaudron réconcilie chasseurs et ermites. Trop salé, c’est que l’ogre est passé.', flavor: 'Goûtez avant de juger.', subtype: 'Cuisinière', rarity: 'common', magicType: 'nature', motif: 'witch', power: 1, toughness: 3 }),
  card({ slug: 'pecheur-de-vase', name: 'Pêcheur de Vase', subtitle: 'Filet plein de boue', description: 'Il ramène des poissons, des clés et parfois un contrat pailleté trempé.', flavor: 'La prise du jour sent l’oignon.', subtype: 'Pêcheur', rarity: 'common', magicType: 'water', motif: 'hunter', power: 2, toughness: 2 }),
  card({ slug: 'chevre-des-collines', name: 'Chèvre des Collines', subtitle: 'Laine rêche', description: 'Elle broute les panneaux « ogre, danger ». Les ogres la respectent : elle recrache tout.', flavor: 'Même les trolls cèdent le sentier.', subtype: 'Chèvre', rarity: 'common', magicType: 'nature', motif: 'sheep', power: 2, toughness: 2 }),
  card({ slug: 'luciole-guide', name: 'Luciole-Guide', subtitle: 'Point de lumière', description: 'Une seule suffit à rentrer à la hutte. Deux, c’est déjà une fête. Trois, un piège.', flavor: 'Clignez. Suivez.', subtype: 'Luciole', rarity: 'common', magicType: 'nature', motif: 'lantern', power: 0, toughness: 1 }),
  card({ slug: 'balai-de-fee', name: 'Balai de Fée', subtitle: 'Poussière d’étoile', description: 'Il ramasse les paillettes tombées. Les ouvrières le cachent pour faire une pause.', flavor: 'Le quota aime le sol propre.', kind: 'object', subtype: 'Outil', rarity: 'common', magicType: 'arcane', motif: 'key' }),
  card({ slug: 'seau-de-boue', name: 'Seau de Boue', subtitle: 'Provision de hutte', description: 'Utile pour colmater, cuisiner, ou dissuader un prince trop propre.', flavor: 'Ne pas boire. Sauf ogre.', kind: 'object', subtype: 'Outil', rarity: 'common', magicType: 'swamp', motif: 'potion' }),
  card({ slug: 'panneau-ogre', name: 'Panneau Ogre', subtitle: 'Danger, voisin', description: 'Il indique la hutte. Les chasseurs le prennent pour un défi. Les villageois, pour une adresse.', flavor: 'Vous êtes déjà trop près.', kind: 'object', subtype: 'Panneau', rarity: 'common', magicType: 'none', motif: 'decree' }),
  card({ slug: 'caillou-porte-bonheur', name: 'Caillou Porte-Bonheur', subtitle: 'Galet de gué', description: 'Chaud dans la poche, froid dans la rivière. Les enfants le prêtent aux ogres.', flavor: 'Ça tient dans le poing.', kind: 'object', subtype: 'Grelot', rarity: 'common', magicType: 'none', motif: 'onion' }),
  card({ slug: 'sentier-de-roseaux', name: 'Sentier de Roseaux', subtitle: 'Chemin mouillé', description: 'Il mène à la mare, ou au troll, selon la pluie. Les bottes s’en souviennent.', flavor: 'Marchez où ça craque moins.', kind: 'land', subtype: 'Sentier', rarity: 'common', magicType: 'nature', motif: 'fields' }),
  card({ slug: 'clairiere-humide', name: 'Clairière Humide', subtitle: 'Herbe d’étang', description: 'Les moutons enchantés y paissent. Les loups comptent de loin, les pieds déjà mouillés.', flavor: 'L’herbe chante un peu.', kind: 'land', subtype: 'Clairière', rarity: 'common', magicType: 'nature', motif: 'forest' }),
  card({ slug: 'fumée-de-hutte', name: 'Fumée de Hutte', subtitle: 'Signe de paix', description: 'Quand elle monte droit, on peut frapper. Quand elle penche, l’ogre cuisine — attendez.', flavor: 'On rentre à l’odeur.', kind: 'spell', subtype: 'Éphémère', rarity: 'common', magicType: 'swamp', motif: 'steam' }),
  card({ slug: 'sifflet-de-berger', name: 'Sifflet de Berger', subtitle: 'Appel des collines', description: 'Un coup : les moutons. Deux : les chasseurs. Trois : même le baudet se tait une seconde.', flavor: 'Court, mais ça porte.', kind: 'spell', subtype: 'Éphémère', rarity: 'common', magicType: 'nature', motif: 'wind' }),
  card({ slug: 'accord-du-village', name: 'Accord du Village', subtitle: 'Trêve du soir', description: 'Personne ne chasse tant que la soupe fume. Les affiches d’ogres attendent demain.', flavor: 'On reprend à l’aube.', kind: 'enchantment', subtype: 'Aura', rarity: 'common', magicType: 'holy', motif: 'peace' }),
];

export const FAR_FAR_AWAY_BOOSTER = {
  name: 'Paquet d’Extrêmement Loin',
  description: 'Cinq cartes des Contes du Marais. Le GIF d’une carte s’éveille à 5 exemplaires.',
  cardCount: 5,
  averageRarity: 'uncommon' as Rarity,
  guaranteedRarity: 'uncommon' as Rarity,
  foilChance: 12,
  animatedChance: 6,
};
