import { PokemonType } from "../interfaces/pokemon-item";

type PokemonTypeChartEntry = {
  effectiveAgainst: PokemonType[];
  weakAgainst: PokemonType[];
  resists: PokemonType[];
  immuneTo: PokemonType[];
};

export const pokemonTypeChart: Record<PokemonType, PokemonTypeChartEntry> = {
  normal: {
    effectiveAgainst: [],
    weakAgainst: ["fighting"],
    resists: [],
    immuneTo: ["ghost"]
  },
  fire: {
    effectiveAgainst: ["grass", "ice", "bug", "steel"],
    weakAgainst: ["water", "ground", "rock"],
    resists: ["fire", "grass", "ice", "bug", "steel", "fairy"],
    immuneTo: []
  },
  water: {
    effectiveAgainst: ["fire", "ground", "rock"],
    weakAgainst: ["electric", "grass"],
    resists: ["fire", "water", "ice", "steel"],
    immuneTo: []
  },
  electric: {
    effectiveAgainst: ["water", "flying"],
    weakAgainst: ["ground"],
    resists: ["electric", "flying", "steel"],
    immuneTo: []
  },
  grass: {
    effectiveAgainst: ["water", "ground", "rock"],
    weakAgainst: ["fire", "ice", "poison", "flying", "bug"],
    resists: ["water", "electric", "grass", "ground"],
    immuneTo: []
  },
  ice: {
    effectiveAgainst: ["grass", "ground", "flying", "dragon"],
    weakAgainst: ["fire", "fighting", "rock", "steel"],
    resists: ["ice"],
    immuneTo: []
  },
  fighting: {
    effectiveAgainst: ["normal", "ice", "rock", "dark", "steel"],
    weakAgainst: ["flying", "psychic", "fairy"],
    resists: ["bug", "rock", "dark"],
    immuneTo: []
  },
  poison: {
    effectiveAgainst: ["grass", "fairy"],
    weakAgainst: ["ground", "psychic"],
    resists: ["grass", "fighting", "poison", "bug", "fairy"],
    immuneTo: []
  },
  ground: {
    effectiveAgainst: ["fire", "electric", "poison", "rock", "steel"],
    weakAgainst: ["water", "grass", "ice"],
    resists: ["poison", "rock"],
    immuneTo: ["electric"]
  },
  flying: {
    effectiveAgainst: ["grass", "fighting", "bug"],
    weakAgainst: ["electric", "ice", "rock"],
    resists: ["grass", "fighting", "bug"],
    immuneTo: ["ground"]
  },
  psychic: {
    effectiveAgainst: ["fighting", "poison"],
    weakAgainst: ["bug", "ghost", "dark"],
    resists: ["fighting", "psychic"],
    immuneTo: []
  },
  bug: {
    effectiveAgainst: ["grass", "psychic", "dark"],
    weakAgainst: ["fire", "flying", "rock"],
    resists: ["grass", "fighting", "ground"],
    immuneTo: []
  },
  rock: {
    effectiveAgainst: ["fire", "ice", "flying", "bug"],
    weakAgainst: ["water", "grass", "fighting", "ground", "steel"],
    resists: ["normal", "fire", "poison", "flying"],
    immuneTo: []
  },
  ghost: {
    effectiveAgainst: ["psychic", "ghost"],
    weakAgainst: ["ghost", "dark"],
    resists: ["poison", "bug"],
    immuneTo: ["normal", "fighting"]
  },
  dragon: {
    effectiveAgainst: ["dragon"],
    weakAgainst: ["ice", "dragon", "fairy"],
    resists: ["fire", "water", "electric", "grass"],
    immuneTo: []
  },
  dark: {
    effectiveAgainst: ["psychic", "ghost"],
    weakAgainst: ["fighting", "bug", "fairy"],
    resists: ["ghost", "dark"],
    immuneTo: ["psychic"]
  },
  steel: {
    effectiveAgainst: ["ice", "rock", "fairy"],
    weakAgainst: ["fire", "fighting", "ground"],
    resists: ["normal", "grass", "ice", "flying", "psychic", "bug", "rock", "dragon", "steel", "fairy"],
    immuneTo: ["poison"]
  },
  fairy: {
    effectiveAgainst: ["fighting", "dragon", "dark"],
    weakAgainst: ["poison", "steel"],
    resists: ["fighting", "bug", "dark"],
    immuneTo: ["dragon"]
  }
};

export function getDefensiveTypeMultiplier(
  defenderTypes: PokemonType[] | undefined,
  attackType: PokemonType
): number {
  if (!defenderTypes?.length) {
    return 1;
  }

  let multiplier = 1;

  for (const defenderType of defenderTypes) {
    const defenderChart = pokemonTypeChart[defenderType];

    if (defenderChart.immuneTo.includes(attackType)) {
      return 0.25;
    }

    if (defenderChart.weakAgainst.includes(attackType)) {
      multiplier *= 2;
      continue;
    }

    if (defenderChart.resists.includes(attackType)) {
      multiplier *= 0.5;
    }
  }

  return multiplier;
}
