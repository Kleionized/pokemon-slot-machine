import { PokemonItem } from "../interfaces/pokemon-item";
import { nationalDexPokemon } from "../services/pokemon-service/national-dex-pokemon";

export function buildPokemonTooltip(
  pokemon: PokemonItem,
  translate: (key: string) => string
): string {
  const dexPokemon = nationalDexPokemon.find(dexEntry => dexEntry.pokemonId === pokemon.pokemonId);
  const bst = pokemon.bst ?? dexPokemon?.bst ?? "?";
  const types = (pokemon.types ?? dexPokemon?.types)?.map(formatPokemonType).join(" / ") || "Unknown";

  return `${translate(pokemon.text)}\nBST: ${bst}\nType: ${types}`;
}

function formatPokemonType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}
