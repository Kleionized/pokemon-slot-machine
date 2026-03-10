import { WheelItem } from "./wheel-item";

export type PokemonType =
  | "normal"
  | "fire"
  | "water"
  | "electric"
  | "grass"
  | "ice"
  | "fighting"
  | "poison"
  | "ground"
  | "flying"
  | "psychic"
  | "bug"
  | "rock"
  | "ghost"
  | "dragon"
  | "dark"
  | "steel"
  | "fairy";

export type PokemonTypeMatchupMap = Partial<Record<PokemonType, number>>;

export interface PokemonItem extends WheelItem {
  pokemonId: number;
  sprite: {
    front_default: string;
    front_shiny: string;
  } | null;
  shiny: boolean;
  bst?: number;
  types?: PokemonType[];
  typeEffectiveness?: Record<string, number>;
  typeResistances?: PokemonTypeMatchupMap;
  power: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 12;
}
