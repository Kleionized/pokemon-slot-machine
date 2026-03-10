import { PokemonType } from "../../../../interfaces/pokemon-item";

export type GymLeaderType = PokemonType | PokemonType[];

export const gymLeaderTypesByGeneration: Record<number, GymLeaderType[]> = {
  1: ["rock", "water", "electric", "grass", "poison", "psychic", "fire", "ground"],
  2: ["flying", "bug", "normal", "ghost", "fighting", "steel", "ice", "dragon"],
  3: ["rock", "fighting", "electric", "fire", "normal", "flying", "psychic", "water"],
  4: ["rock", "grass", "fighting", "water", "ghost", "steel", "ice", "electric"],
  5: [["grass", "fire", "water"], "normal", "bug", "electric", "ground", "flying", "ice", "dragon"],
  6: ["bug", "rock", "fighting", "grass", "electric", "fairy", "psychic", "ice"],
  7: ["normal", "fighting", ["water", "fire", "grass"], "rock", ["electric", "ghost"], "dark", "fairy", "ground"],
  8: ["grass", "water", "fire", ["fighting", "ghost"], "fairy", ["rock", "ice"], "dark", "dragon"]
};
