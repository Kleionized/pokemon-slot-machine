import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, TemplateRef, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { gymLeadersByGeneration } from './gym-leaders-by-generation';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { GameStateService } from '../../../../services/game-state-service/game-state.service';
import { GenerationService } from '../../../../services/generation-service/generation.service';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';
import { GenerationItem } from '../../../../interfaces/generation-item';
import { PokemonItem, PokemonType } from '../../../../interfaces/pokemon-item';
import { ItemItem } from '../../../../interfaces/item-item';
import { WheelItem } from '../../../../interfaces/wheel-item';
import { GymLeader } from '../../../../interfaces/gym-leader';
import { interleaveOdds } from '../../../../utils/odd-utils';
import { ModalQueueService } from '../../../../services/modal-queue-service/modal-queue.service';
import { getDefensiveTypeMultiplier } from '../../../../utils/pokemon-type-utils';
import { GymLeaderType, gymLeaderTypesByGeneration } from './gym-leader-types-by-generation';

@Component({
  selector: 'app-gym-battle-roulette',
  imports: [
    CommonModule,
    WheelComponent,
    TranslatePipe
  ],
  templateUrl: './gym-battle-roulette.component.html',
  styleUrl: './gym-battle-roulette.component.css'
})
export class GymBattleRouletteComponent implements OnInit, OnDestroy {

  gymLeadersByGeneration = gymLeadersByGeneration;

  constructor(private modalService: NgbModal,
    private modalQueueService: ModalQueueService,
    private gameStateService: GameStateService,
    private generationService: GenerationService,
    private trainerService: TrainerService,
    private translate: TranslateService
  ) { }

  private gameSubscription: Subscription | null = null;
  private generationSubscription: Subscription | null = null;

  @ViewChild('gymLeaderPresentationModal', { static: true }) gymLeaderPresentationModal!: TemplateRef<any>;
  @ViewChild('itemUsedModal', { static: true }) itemUsedModal!: TemplateRef<any>;

  generation!: GenerationItem;
  trainerTeam!: PokemonItem[];
  trainerItems!: ItemItem[];
  @Input() currentRound!: number;
  @Input() fromLeader!: number;
  @Output() battleResultEvent = new EventEmitter<boolean>();
  @Output() fromLeaderChange = new EventEmitter<number>();

  victoryOdds: WheelItem[] = [
    { text: 'game.main.roulette.gym.yes', fillStyle: 'green', weight: 1 },
    { text: 'game.main.roulette.gym.no', fillStyle: 'crimson', weight: 1 }
  ];

  currentLeader!: GymLeader;
  currentLeaderType: PokemonType = 'normal';
  currentItem!: ItemItem;
  retries = 0;
  private teamSubscription!: Subscription;

  ngOnInit(): void {
    this.generationSubscription = this.generationService.getGeneration().subscribe(gen => {
      this.generation = gen;
    });

    this.trainerItems = this.trainerService.getItems();

    this.teamSubscription = this.trainerService.getTeamObservable().subscribe(team => {
      this.trainerTeam = team;
      this.calcVictoryOdds();
    });

    this.gameSubscription = this.gameStateService.currentState.subscribe(state => {
      if (state === 'gym-battle') {
        this.getCurrentLeader();
        this.calcVictoryOdds();

        this.modalQueueService.open(this.gymLeaderPresentationModal, {
          centered: true,
          size: 'lg'
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.gameSubscription?.unsubscribe();
    this.generationSubscription?.unsubscribe();
    this.teamSubscription?.unsubscribe();
  }

  closeModal(): void {
    this.modalService.dismissAll();
  }

  onItemSelected(index: number): void {
    this.retries--;
    if (this.victoryOdds[index].text === 'game.main.roulette.gym.yes') {
      this.battleResultEvent.emit(true);
    } else {
      if (this.retries <= 0) {
        const potion = this.hasPotions();
        if (potion) {
          this.usePotion(potion);
        } else {
          this.battleResultEvent.emit(false);
        }
      }
    }
  }

  private calcVictoryOdds(): void {
    const yesOdds: WheelItem[] = [];
    const noOdds: WheelItem[] = [];

    yesOdds.push({ text: "game.main.roulette.gym.yes", fillStyle: "green", weight: 1 });

    this.trainerTeam.forEach(pokemon => {
      for (let i = 0; i < pokemon.power; i++) {
        yesOdds.push({ text: "game.main.roulette.gym.yes", fillStyle: "green", weight: 1 });
      }

      const matchupOdds = this.getMatchupOdds(pokemon);
      this.addOdds(yesOdds, matchupOdds.yes, "game.main.roulette.gym.yes", "green");
      this.addOdds(noOdds, matchupOdds.no, "game.main.roulette.gym.no", "crimson");
    });

    this.addOdds(yesOdds, this.plusModifiers(), "game.main.roulette.gym.yes", "green");

    this.addOdds(noOdds, this.getGymDifficulty(), "game.main.roulette.gym.no", "crimson");

    this.victoryOdds = interleaveOdds(yesOdds, noOdds);
  }

  private plusModifiers(): number {
    let power = 0;
    const xAttacks = this.trainerItems.filter(item => item.name === 'x-attack');
    xAttacks.forEach(() => {
      const meanPower = this.trainerTeam.reduce((sum, pokemon) => sum + pokemon.power, 0) / this.trainerTeam.length;
      power += meanPower;
    });

    return power;
  }

  private addOdds(odds: WheelItem[], count: number, text: string, fillStyle: string): void {
    const total = Math.max(0, Math.ceil(count));

    for (let index = 0; index < total; index++) {
      odds.push({ text, fillStyle, weight: 1 });
    }
  }

  private getGymDifficulty(): number {
    return Math.ceil((this.currentRound + 1) * 1.25);
  }

  private getMatchupOdds(pokemon: PokemonItem): { yes: number; no: number } {
    const offensiveMultiplier = pokemon.typeEffectiveness?.[this.currentLeaderType] ?? 1;
    const defensiveMultiplier = getDefensiveTypeMultiplier(pokemon.types, this.currentLeaderType);

    let yes = 0;
    let no = 0;

    if (offensiveMultiplier > 1) {
      yes += this.getTypeStages(offensiveMultiplier);
    } else if (offensiveMultiplier < 1) {
      no += this.getTypeStages(offensiveMultiplier);
    }

    if (defensiveMultiplier < 1) {
      yes += this.getTypeStages(defensiveMultiplier);
    } else if (defensiveMultiplier > 1) {
      no += this.getTypeStages(defensiveMultiplier);
    }

    return { yes, no };
  }

  private getTypeStages(multiplier: number): number {
    if (multiplier === 1) {
      return 0;
    }

    return Math.max(1, Math.round(Math.abs(Math.log2(multiplier))));
  }

  private getCurrentLeader(): void {

    this.currentLeader = this.gymLeadersByGeneration[this.generation.id][this.currentRound];
    this.currentLeaderType = this.resolveLeaderType();

    if ((this.generation.id === 5 && (this.currentRound === 0 || this.currentRound === 7))
      || (this.generation.id === 7 && (this.currentRound === 2 || this.currentRound === 4))
      || (this.generation.id === 8 && (this.currentRound === 3 || this.currentRound === 5))) {

      this.translate.get(this.currentLeader.name).subscribe(translated => {
        const leaderNames = translated.split('/');
        const leaderSprites = Array.isArray(this.currentLeader.sprite) ? this.currentLeader.sprite : [this.currentLeader.sprite];
        const leaderQuotes = Array.isArray(this.currentLeader.quotes) ? this.currentLeader.quotes : this.currentLeader.quotes;
        const randomIndex = Math.floor(Math.random() * leaderNames.length);

        this.fromLeaderChange.emit(randomIndex);
        this.currentLeaderType = this.resolveLeaderType(randomIndex);

        this.currentLeader = {
          name: leaderNames[randomIndex],
          sprite: leaderSprites[randomIndex],
          quotes: [Array.isArray(leaderQuotes) ? leaderQuotes[randomIndex] : leaderQuotes]
        } as GymLeader;

        this.calcVictoryOdds();
      });
    }
  }

  private resolveLeaderType(randomIndex: number = this.fromLeader): PokemonType {
    const leaderType = gymLeaderTypesByGeneration[this.generation.id][this.currentRound] as GymLeaderType;

    if (Array.isArray(leaderType)) {
      return leaderType[randomIndex] ?? leaderType[0];
    }

    return leaderType;
  }

  private hasPotions(): ItemItem | undefined {
    const potionItem = this.trainerItems.find(item =>
      item.name === 'potion' || item.name === 'super-potion' || item.name === 'hyper-potion'
    );
    return potionItem;
  }

  private usePotion(potion: ItemItem): void {
    const index = this.trainerItems.indexOf(potion);
    this.currentItem = potion;
    if (index !== -1) {
      this.trainerItems.splice(index, 1);
      this.trainerService.removeItem(potion);
    }

    switch (potion.name) {
      case 'potion':
        this.retries = 1;
        break;
      case 'super-potion':
        this.retries = 2;
        break;
      case 'hyper-potion':
        this.retries = 3;
        break;
    }

    this.modalQueueService.open(this.itemUsedModal, {
      centered: true,
      size: 'md'
    });
  }
}
