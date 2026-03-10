import { Injectable } from '@angular/core';
import { PokemonItem } from '../../interfaces/pokemon-item';
import { evolutionChain } from './evolution-chain';
import { PokemonService } from '../pokemon-service/pokemon.service';

@Injectable({
  providedIn: 'root'
})
export class EvolutionService {

  constructor(private pokemonService: PokemonService) {
    this.nationalDexPokemon = this.pokemonService.getAllPokemon();
    this.evolvedPokemonIds = new Set(Object.values(this.evolutionChain).flat());
  }

  evolutionChain = evolutionChain;
  evolvedPokemonIds: Set<number>;
  nationalDexPokemon: PokemonItem[];

  canEvolve(pokemon: PokemonItem): boolean {
    return !!this.evolutionChain[pokemon.pokemonId];
  }

  isBaseEvolution(pokemon: PokemonItem): boolean {
    return this.canEvolve(pokemon) && !this.evolvedPokemonIds.has(pokemon.pokemonId);
  }

  getEvolutions(pokemon: PokemonItem): PokemonItem[] {
    let evolutions: PokemonItem[] = [];
    this.evolutionChain[pokemon.pokemonId].forEach(evolutionId => {
      const evolution = this.pokemonService.getPokemonById(evolutionId);

      if (evolution) {
        evolutions.push(evolution);
      }
    })
    return evolutions;
  }
}
