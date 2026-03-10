import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { Subscription } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { GenerationItem } from '../../../../interfaces/generation-item';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { EvolutionService } from '../../../../services/evolution-service/evolution.service';
import { GenerationService } from '../../../../services/generation-service/generation.service';
import { PokemonService } from '../../../../services/pokemon-service/pokemon.service';
import { pokemonByGeneration } from '../pokemon-from-generation-roulette/pokemon-by-generation';

@Component({
  selector: 'app-starter-companion-roulette',
  imports: [WheelComponent, TranslatePipe],
  templateUrl: './starter-companion-roulette.component.html',
  styleUrl: './starter-companion-roulette.component.css'
})
export class StarterCompanionRouletteComponent implements OnInit, OnDestroy {

  constructor(
    private evolutionService: EvolutionService,
    private generationService: GenerationService,
    private pokemonService: PokemonService
  ) { }

  generation!: GenerationItem;
  starterCompanionPool: PokemonItem[] = [];
  @Output() selectedPokemonEvent = new EventEmitter<PokemonItem>();

  private generationSubscription: Subscription | null = null;

  ngOnInit(): void {
    this.generationSubscription = this.generationService.getGeneration().subscribe(gen => {
      this.generation = gen;
      this.starterCompanionPool = this.getStarterCompanionPool(gen.id);
    });
  }

  ngOnDestroy(): void {
    this.generationSubscription?.unsubscribe();
  }

  onItemSelected(index: number): void {
    const selectedPokemon = this.starterCompanionPool[index];
    this.selectedPokemonEvent.emit(selectedPokemon);
  }

  private getStarterCompanionPool(generationId: number): PokemonItem[] {
    return pokemonByGeneration[generationId]
      .map(pokemon => this.pokemonService.getPokemonById(pokemon.pokemonId))
      .filter((pokemon): pokemon is PokemonItem =>
        !!pokemon
        && typeof pokemon.bst === 'number'
        && pokemon.bst < 400
        && this.evolutionService.isBaseEvolution(pokemon)
      );
  }
}
