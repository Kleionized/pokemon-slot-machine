import { ItemItem } from "../interfaces/item-item";
import { PokemonItem, PokemonType } from "../interfaces/pokemon-item";
import { WheelItem } from "../interfaces/wheel-item";
import { getDefensiveTypeMultiplier } from "./pokemon-type-utils";
import { interleaveOdds } from "./odd-utils";

export interface BattleOddsSummary {
  noCount: number;
  winPercent: number;
  yesCount: number;
}

export function getXAttackBonus(team: PokemonItem[], items: ItemItem[]): number {
  if (team.length === 0) {
    return 0;
  }

  let power = 0;
  const xAttacks = items.filter(item => item.name === "x-attack");
  xAttacks.forEach(() => {
    const meanPower = team.reduce((sum, pokemon) => sum + pokemon.power, 0) / team.length;
    power += meanPower;
  });

  return power;
}

export function getGymDifficulty(currentRound: number): number {
  return Math.ceil((currentRound + 1) * 1.25);
}

export function getEliteDifficulty(currentRound: number): number {
  return Math.ceil((currentRound + 1) * 1.75) + 2;
}

export function getChampionDifficulty(currentRound: number): number {
  return Math.ceil((currentRound + 1) * 2.25) + 4;
}

export function getGymBattleSummary(
  team: PokemonItem[],
  items: ItemItem[],
  leaderType: PokemonType
): BattleOddsSummary {
  let yesCount = 1;
  let noCount = 0;

  team.forEach(pokemon => {
    yesCount += pokemon.power;

    const matchupOdds = getGymMatchupOdds(pokemon, leaderType);
    yesCount += Math.ceil(Math.max(0, matchupOdds.yes));
    noCount += Math.ceil(Math.max(0, matchupOdds.no));
  });

  yesCount += Math.ceil(Math.max(0, getXAttackBonus(team, items)));

  return {
    yesCount,
    noCount,
    winPercent: getWinPercent(yesCount, noCount)
  };
}

export function getPowerBattleSummary(
  team: PokemonItem[],
  items: ItemItem[],
  difficulty: number
): BattleOddsSummary {
  const yesCount = 1
    + team.reduce((sum, pokemon) => sum + pokemon.power, 0)
    + Math.ceil(Math.max(0, getXAttackBonus(team, items)));

  const noCount = Math.ceil(Math.max(0, difficulty));

  return {
    yesCount,
    noCount,
    winPercent: getWinPercent(yesCount, noCount)
  };
}

export function buildGymVictoryOdds(
  team: PokemonItem[],
  items: ItemItem[],
  leaderType: PokemonType,
  currentRound: number,
  yesText: string,
  noText: string
): WheelItem[] {
  const yesOdds: WheelItem[] = [{ text: yesText, fillStyle: "green", weight: 1 }];
  const noOdds: WheelItem[] = [];

  team.forEach(pokemon => {
    addOdds(yesOdds, pokemon.power, yesText, "green");

    const matchupOdds = getGymMatchupOdds(pokemon, leaderType);
    addOdds(yesOdds, matchupOdds.yes, yesText, "green");
    addOdds(noOdds, matchupOdds.no, noText, "crimson");
  });

  addOdds(yesOdds, getXAttackBonus(team, items), yesText, "green");
  addOdds(noOdds, getGymDifficulty(currentRound), noText, "crimson");

  return interleaveOdds(yesOdds, noOdds);
}

export function buildPowerVictoryOdds(
  team: PokemonItem[],
  items: ItemItem[],
  difficulty: number,
  yesText: string,
  noText: string
): WheelItem[] {
  const yesOdds: WheelItem[] = [{ text: yesText, fillStyle: "green", weight: 1 }];
  const noOdds: WheelItem[] = [];

  team.forEach(pokemon => {
    addOdds(yesOdds, pokemon.power, yesText, "green");
  });

  addOdds(yesOdds, getXAttackBonus(team, items), yesText, "green");
  addOdds(noOdds, difficulty, noText, "crimson");

  return interleaveOdds(yesOdds, noOdds);
}

function addOdds(odds: WheelItem[], count: number, text: string, fillStyle: string): void {
  const total = Math.max(0, Math.ceil(count));

  for (let index = 0; index < total; index++) {
    odds.push({ text, fillStyle, weight: 1 });
  }
}

function getGymMatchupOdds(pokemon: PokemonItem, leaderType: PokemonType): { yes: number; no: number } {
  const offensiveMultiplier = pokemon.typeEffectiveness?.[leaderType] ?? 1;
  const defensiveMultiplier = getDefensiveTypeMultiplier(pokemon.types, leaderType);

  let yes = 0;
  let no = 0;

  if (offensiveMultiplier > 1) {
    yes += getTypeStages(offensiveMultiplier);
  } else if (offensiveMultiplier < 1) {
    no += getTypeStages(offensiveMultiplier);
  }

  if (defensiveMultiplier < 1) {
    yes += getTypeStages(defensiveMultiplier);
  } else if (defensiveMultiplier > 1) {
    no += getTypeStages(defensiveMultiplier);
  }

  return { yes, no };
}

function getTypeStages(multiplier: number): number {
  if (multiplier === 1) {
    return 0;
  }

  return Math.max(1, Math.round(Math.abs(Math.log2(multiplier))));
}

function getWinPercent(yesCount: number, noCount: number): number {
  const total = yesCount + noCount;

  if (total <= 0) {
    return 0;
  }

  return Math.round((yesCount / total) * 100);
}
