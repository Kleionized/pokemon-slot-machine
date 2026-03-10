import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { GenerationItem } from '../interfaces/generation-item';
import { ItemItem } from '../interfaces/item-item';
import { PokemonItem, PokemonType } from '../interfaces/pokemon-item';
import { WheelItem } from '../interfaces/wheel-item';
import { GameStateService } from '../services/game-state-service/game-state.service';
import { GameState } from '../services/game-state-service/game-state';
import { AudioService } from '../services/audio-service/audio.service';
import { GenerationService } from '../services/generation-service/generation.service';
import { TrainerService } from '../services/trainer-service/trainer.service';
import { GymLeaderType, gymLeaderTypesByGeneration } from '../main-game/roulette-container/roulettes/gym-battle-roulette/gym-leader-types-by-generation';
import { getChampionDifficulty, getEliteDifficulty, getGymBattleSummary, getPowerBattleSummary } from '../utils/battle-odds';

interface ReelItem {
  fillStyle: string;
  spriteUrl: string | null;
  text: string;
  translatedText: string;
  weight: number;
}

type SpriteLikeItem = WheelItem & {
  pokemonId?: number;
  shiny?: boolean;
  sprite?: string | { front_default?: string | null; front_shiny?: string | null; } | null;
};

@Component({
  selector: 'app-wheel',
  imports: [
    CommonModule
  ],
  templateUrl: './wheel.component.html',
  styleUrl: './wheel.component.css'
})
export class WheelComponent implements OnInit, OnChanges, OnDestroy {

  @Input() items: WheelItem[] = [];
  @Input() statusPrimaryLabel?: string;
  @Input() statusPrimaryValue?: string | null;
  @Input() statusSecondaryLabel?: string;
  @Input() statusSecondaryValue?: number | string | null;
  @Output() selectedItemEvent = new EventEmitter<number>();

  resultMessage = '';

  readonly indicators = [
    { num: 3, color: '#39ff14' },
    { num: 2, color: '#ffcc00' },
    { num: 1, color: '#66b2ff' },
    { num: 2, color: '#ffcc00' },
    { num: 3, color: '#39ff14' }
  ];

  spinning = false;

  reelItems: ReelItem[] = [];
  reel2Items: ReelItem[] = [];
  reel3Items: ReelItem[] = [];

  reel1Offset = 0;
  reel2Offset = 0;
  reel3Offset = 0;

  private readonly itemHeight = 100;
  private readonly baseCycleIndex = 2;
  private readonly reelSpeeds = [920, 1080, 1240];

  private animationFrameId: number | null = null;
  private autoStopTimers: Array<ReturnType<typeof setTimeout> | null> = [null, null, null];
  private currentGameState: GameState = 'game-start';
  private currentGeneration: GenerationItem | null = null;
  private currentRound = 0;
  private lastFrameTime = 0;
  private reelSpinStates = [false, false, false];
  private reelDecelerating = [false, false, false];
  private reelDecelStart: number[] = [0, 0, 0];
  private reelDecelFrom: number[] = [0, 0, 0];
  private reelDecelTo: number[] = [0, 0, 0];
  private readonly decelDuration = 400; // ms for smooth stop
  private subscriptions: Subscription[] = [];
  private trainerItems: ItemItem[] = [];
  private trainerTeam: PokemonItem[] = [];
  private winningNumber = -1;

  private derivedPrimaryLabel = 'NEXT GYM';
  private derivedPrimaryValue = '---';
  private derivedSecondaryValue = '--';

  clickAudio!: HTMLAudioElement;

  constructor(
    private audioService: AudioService,
    private gameStateService: GameStateService,
    private generationService: GenerationService,
    private modalService: NgbModal,
    private trainerService: TrainerService,
    private translateService: TranslateService
  ) {
    this.clickAudio = this.audioService.createAudio('./click.mp3');
  }

  ngOnInit(): void {
    this.trainerTeam = this.trainerService.getTeam();
    this.trainerItems = this.trainerService.getItems();
    this.currentGeneration = this.generationService.getCurrentGeneration();

    this.subscriptions.push(
      this.generationService.getGeneration().subscribe(generation => {
        this.currentGeneration = generation;
        this.updateStatusPanel();
      }),
      this.gameStateService.currentRoundObserver.subscribe(round => {
        this.currentRound = round;
        this.updateStatusPanel();
      }),
      this.gameStateService.currentState.subscribe(state => {
        this.currentGameState = state;
        this.updateStatusPanel();
      }),
      this.trainerService.getTeamObservable().subscribe(team => {
        this.trainerTeam = team;
        this.updateStatusPanel();
      }),
      this.trainerService.getItemsObservable().subscribe(items => {
        this.trainerItems = items;
        this.updateStatusPanel();
      })
    );

    this.buildReels();
    this.updateStatusPanel();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['items']) {
      this.buildReels();
    }

    this.updateStatusPanel();
  }

  ngOnDestroy(): void {
    this.stopAnimation();
    this.clearAutoStopTimers();
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.gameStateService.setWheelSpinning(false);
  }

  startSpin(): void {
    if (this.spinning || this.items.length === 0) {
      return;
    }

    this.stopAnimation();
    this.clearAutoStopTimers();

    this.spinning = true;
    this.resultMessage = '';
    this.reelSpinStates = [true, true, true];
    this.reelDecelerating = [false, false, false];
    this.gameStateService.setWheelSpinning(true);
    this.winningNumber = this.getRandomWeightedIndex();
    this.lastFrameTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));

    this.autoStopTimers[0] = setTimeout(() => this.stopReel(0), 1600);
    this.autoStopTimers[1] = setTimeout(() => this.stopReel(1), 1900);
    this.autoStopTimers[2] = setTimeout(() => this.stopReel(2), 2200);
  }

  stopReel(reelIndex: number): void {
    if (!this.reelSpinStates[reelIndex] || this.winningNumber < 0) {
      return;
    }

    this.clearAutoStopTimer(reelIndex);

    const winningItem = this.items[this.winningNumber];
    const reelItems = this.getReelSet(reelIndex);
    const currentOffset = this.getReelOffset(reelIndex);
    const targetOffset = this.getStopOffset(reelItems, currentOffset, winningItem.text);

    // Start smooth deceleration instead of snapping
    this.reelSpinStates[reelIndex] = false;
    this.reelDecelerating[reelIndex] = true;
    this.reelDecelStart[reelIndex] = performance.now();
    this.reelDecelFrom[reelIndex] = currentOffset;
    this.reelDecelTo[reelIndex] = targetOffset;
    this.audioService.playAudio(this.clickAudio, 0.85);
  }

  get isSpinActive(): boolean {
    return this.reelSpinStates.some(Boolean);
  }

  get displayPrimaryLabel(): string {
    return (this.statusPrimaryLabel ?? this.derivedPrimaryLabel).toUpperCase();
  }

  get displayPrimaryValue(): string {
    return (this.statusPrimaryValue ?? this.derivedPrimaryValue).toUpperCase();
  }

  get displaySecondaryLabel(): string {
    return (this.statusSecondaryLabel ?? 'WIN%').toUpperCase();
  }

  get displaySecondaryValue(): string {
    if (typeof this.statusSecondaryValue === 'number') {
      return `${Math.round(this.statusSecondaryValue)}%`;
    }

    if (typeof this.statusSecondaryValue === 'string') {
      return this.statusSecondaryValue.toUpperCase();
    }

    return this.derivedSecondaryValue.toUpperCase();
  }

  isIndicatorActive(index: number): boolean {
    if (!this.spinning) {
      return false;
    }

    if (index === 0 || index === this.indicators.length - 1) {
      return true;
    }

    return this.reelSpinStates[Math.min(index, 2)];
  }

  isReelSpinning(reelIndex: number): boolean {
    return this.reelSpinStates[reelIndex] || this.reelDecelerating[reelIndex];
  }

  @HostListener('window:keydown.space', ['$event'])
  handleSpacebar(event: Event): void {
    const activeElement = document.activeElement;
    const isInputOrButtonFocused = activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLButtonElement ||
      activeElement?.getAttribute('role') === 'button';

    if (!this.spinning && !this.modalService.hasOpenModals() && !isInputOrButtonFocused) {
      event.preventDefault();
      this.startSpin();
    }
  }

  private animate(currentTime: number): void {
    const deltaSeconds = Math.min((currentTime - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = currentTime;

    // Advance spinning reels
    if (this.reelSpinStates[0]) {
      this.reel1Offset = this.advanceOffset(this.reel1Offset, this.reelSpeeds[0], deltaSeconds);
    }

    if (this.reelSpinStates[1]) {
      this.reel2Offset = this.advanceOffset(this.reel2Offset, this.reelSpeeds[1], deltaSeconds);
    }

    if (this.reelSpinStates[2]) {
      this.reel3Offset = this.advanceOffset(this.reel3Offset, this.reelSpeeds[2], deltaSeconds);
    }

    // Animate decelerating reels with ease-out
    for (let i = 0; i < 3; i++) {
      if (this.reelDecelerating[i]) {
        const elapsed = currentTime - this.reelDecelStart[i];
        const progress = Math.min(elapsed / this.decelDuration, 1);
        // Ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const from = this.reelDecelFrom[i];
        const to = this.reelDecelTo[i];
        const current = from + (to - from) * eased;
        this.setReelOffset(i, current);

        if (progress >= 1) {
          this.reelDecelerating[i] = false;
          this.setReelOffset(i, to);

          // Check if all reels are done
          if (!this.reelSpinStates.some(Boolean) && !this.reelDecelerating.some(Boolean)) {
            this.stopAnimation();
            setTimeout(() => {
              if (this.spinning) {
                this.finishSpin();
              }
            }, 400);
            return;
          }
        }
      }
    }

    const anyActive = this.reelSpinStates.some(Boolean) || this.reelDecelerating.some(Boolean);
    if (anyActive) {
      this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
    }
  }

  private advanceOffset(currentOffset: number, speed: number, deltaSeconds: number): number {
    const nextOffset = currentOffset - (speed * deltaSeconds);
    const cycleHeight = this.getCycleHeight();
    const centerOffset = this.getCenterOffset();
    const minOffset = centerOffset - (cycleHeight * (this.baseCycleIndex + 2));

    if (nextOffset < minOffset) {
      return nextOffset + cycleHeight;
    }

    return nextOffset;
  }

  private finishSpin(): void {
    if (!this.spinning) {
      return;
    }

    this.stopAnimation();
    this.clearAutoStopTimers();
    this.spinning = false;
    this.gameStateService.setWheelSpinning(false);

    // Generate result message and pause 500ms before emitting
    if (this.winningNumber >= 0 && this.winningNumber < this.items.length) {
      this.resultMessage = this.generateResultMessage(this.items[this.winningNumber]);
    }

    setTimeout(() => {
      this.resultMessage = '';
      this.selectedItemEvent.emit(this.winningNumber);
    }, 500);
  }

  private buildReels(): void {
    const translated = this.items.map(item => ({
      text: item.text,
      translatedText: this.translateService.instant(item.text),
      fillStyle: item.fillStyle,
      weight: item.weight,
      spriteUrl: this.resolveSpriteUrl(item)
    }));

    const buildStrip = (baseItems: ReelItem[]): ReelItem[] => {
      const strip: ReelItem[] = [];

      for (let cycle = 0; cycle < 8; cycle++) {
        for (const item of baseItems) {
          strip.push({ ...item });
        }
      }

      return strip;
    };

    const shuffle = (items: ReelItem[]): ReelItem[] => {
      const copy = [...items];

      for (let index = copy.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
      }

      return copy;
    };

    this.reelItems = buildStrip(translated);
    this.reel2Items = buildStrip(shuffle(translated));
    this.reel3Items = buildStrip(shuffle(translated));

    const startOffset = this.getCenterOffset() - (this.getCycleHeight() * this.baseCycleIndex);
    this.reel1Offset = startOffset;
    this.reel2Offset = startOffset;
    this.reel3Offset = startOffset;
  }

  private resolveSpriteUrl(item: WheelItem): string | null {
    const spriteLikeItem = item as SpriteLikeItem;

    if (typeof spriteLikeItem.sprite === 'string' && spriteLikeItem.sprite.trim().length > 0) {
      return spriteLikeItem.sprite;
    }

    if (spriteLikeItem.sprite && typeof spriteLikeItem.sprite === 'object') {
      if (spriteLikeItem.shiny && spriteLikeItem.sprite.front_shiny) {
        return spriteLikeItem.sprite.front_shiny;
      }

      return spriteLikeItem.sprite.front_default ?? spriteLikeItem.sprite.front_shiny ?? null;
    }

    if (typeof spriteLikeItem.pokemonId === 'number') {
      const spriteFolder = spriteLikeItem.shiny ? 'shiny' : 'pokemon';
      return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/${spriteFolder}/${spriteLikeItem.pokemonId}.png`;
    }

    return null;
  }

  private getStopOffset(reelItems: ReelItem[], currentOffset: number, winningText: string): number {
    const centerOffset = this.getCenterOffset();
    const offsets = reelItems
      .map((item, index) => item.text === winningText ? -(index * this.itemHeight) + centerOffset : null)
      .filter((offset): offset is number => offset !== null);

    const forwardCandidate = offsets
      .filter(offset => offset <= currentOffset + (this.itemHeight / 2))
      .sort((left, right) => right - left)[0];

    return forwardCandidate ?? offsets[offsets.length - 1] ?? currentOffset;
  }

  private getReelSet(reelIndex: number): ReelItem[] {
    return reelIndex === 0 ? this.reelItems : reelIndex === 1 ? this.reel2Items : this.reel3Items;
  }

  private getReelOffset(reelIndex: number): number {
    return reelIndex === 0 ? this.reel1Offset : reelIndex === 1 ? this.reel2Offset : this.reel3Offset;
  }

  private setReelOffset(reelIndex: number, offset: number): void {
    if (reelIndex === 0) {
      this.reel1Offset = offset;
    } else if (reelIndex === 1) {
      this.reel2Offset = offset;
    } else {
      this.reel3Offset = offset;
    }
  }

  private getCenterOffset(): number {
    return (this.getReelHeight() / 2) - (this.itemHeight / 2);
  }

  private getCycleHeight(): number {
    return Math.max(1, this.items.length) * this.itemHeight;
  }

  private getReelHeight(): number {
    return window.innerWidth <= 768 ? 240 : 300;
  }

  private stopAnimation(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private clearAutoStopTimer(reelIndex: number): void {
    const timer = this.autoStopTimers[reelIndex];

    if (timer) {
      clearTimeout(timer);
      this.autoStopTimers[reelIndex] = null;
    }
  }

  private clearAutoStopTimers(): void {
    this.autoStopTimers.forEach((_, reelIndex) => this.clearAutoStopTimer(reelIndex));
  }

  private getRandomWeightedIndex(): number {
    const totalWeight = this.items.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;
    let accumulatedWeight = 0;

    for (let index = 0; index < this.items.length; index++) {
      accumulatedWeight += this.items[index].weight;
      if (random < accumulatedWeight) {
        return index;
      }
    }

    return this.items.length - 1;
  }

  private updateStatusPanel(): void {
    const status = this.getProjectedStatus();
    this.derivedPrimaryLabel = status.primaryLabel;
    this.derivedPrimaryValue = status.primaryValue;
    this.derivedSecondaryValue = status.secondaryValue;
  }

  private getProjectedStatus(): { primaryLabel: string; primaryValue: string; secondaryValue: string } {
    if (this.currentGameState === 'game-start' || this.currentGameState === 'character-select') {
      return { primaryLabel: 'NEXT GYM', primaryValue: '---', secondaryValue: '--' };
    }

    if (this.currentGameState === 'champion-battle') {
      return {
        primaryLabel: 'BOSS',
        primaryValue: 'CHAMPION',
        secondaryValue: `${getPowerBattleSummary(
          this.trainerTeam,
          this.trainerItems,
          getChampionDifficulty(this.currentRound)
        ).winPercent}%`
      };
    }

    if (this.currentRound >= 8) {
      return {
        primaryLabel: 'BOSS',
        primaryValue: 'ELITE 4',
        secondaryValue: `${getPowerBattleSummary(
          this.trainerTeam,
          this.trainerItems,
          getEliteDifficulty(this.currentRound)
        ).winPercent}%`
      };
    }

    if (!this.currentGeneration) {
      return { primaryLabel: 'NEXT GYM', primaryValue: '---', secondaryValue: '--' };
    }

    const leaderType = gymLeaderTypesByGeneration[this.currentGeneration.id][this.currentRound];

    if (!leaderType) {
      return { primaryLabel: 'NEXT GYM', primaryValue: '---', secondaryValue: '--' };
    }

    const leaderTypes = Array.isArray(leaderType) ? leaderType : [leaderType];
    const averageWinPercent = Math.round(
      leaderTypes.reduce((sum, type) => {
        return sum + getGymBattleSummary(this.trainerTeam, this.trainerItems, type, this.currentRound).winPercent;
      }, 0) / leaderTypes.length
    );

    return {
      primaryLabel: 'NEXT GYM',
      primaryValue: this.formatGymValue(leaderType),
      secondaryValue: `${averageWinPercent}%`
    };
  }

  private formatGymValue(leaderType: GymLeaderType): string {
    const leaderTypes = Array.isArray(leaderType) ? leaderType : [leaderType];

    if (leaderTypes.length === 1) {
      return leaderTypes[0].toUpperCase();
    }

    return leaderTypes.map(type => this.getTypeAbbreviation(type)).join('/');
  }

  private getTypeAbbreviation(type: PokemonType): string {
    return type.slice(0, 3).toUpperCase();
  }

  private readonly npcNames = [
    'Youngster Joey', 'Lass Jenny', 'Bug Catcher Wade', 'Hiker Marcos',
    'Fisherman Ralph', 'Picnicker Liz', 'Camper Jeff', 'Beauty Nova',
    'Swimmer Luis', 'Sailor Huey', 'Juggler Dalton', 'Psychic Cameron',
    'Bird Keeper Toby', 'Ace Trainer Gwen', 'Cooltrainer Sam',
    'Blackbelt Koichi', 'Gentleman Arthur', 'Scientist Ivan'
  ];

  private getRandomNpcName(): string {
    return this.npcNames[Math.floor(Math.random() * this.npcNames.length)];
  }

  private generateResultMessage(item: WheelItem): string {
    const translated = this.translateService.instant(item.text);

    switch (this.currentGameState) {
      case 'starter-pokemon':
      case 'starter-companion-catch':
      case 'catch-pokemon':
      case 'catch-cave-pokemon':
      case 'go-fishing':
      case 'find-fossil':
      case 'mysterious-egg':
        return `You caught ${translated}!`;

      case 'legendary-encounter':
        return `A wild ${translated} appeared!`;

      case 'catch-legendary':
        if (item.text.includes('.yes')) {
          return 'Gotcha! Legendary captured!';
        }
        return 'Oh no! It broke free...';

      case 'gym-battle':
        if (item.text.includes('.yes')) {
          return `You defeated the Gym Leader!`;
        }
        return 'You lost the battle...';

      case 'elite-four-battle':
        if (item.text.includes('.yes')) {
          return 'Elite Four member defeated!';
        }
        return 'You lost the battle...';

      case 'champion-battle':
        if (item.text.includes('.yes')) {
          return 'You defeated the Champion!';
        }
        return 'You lost the battle...';

      case 'battle-rival':
        if (item.text.includes('.yes')) {
          return 'You defeated your Rival!';
        }
        return 'Your Rival won this time...';

      case 'check-shininess':
        if (item.text.includes('.yes')) {
          return 'It\'s shiny! Lucky!';
        }
        return 'Normal coloring.';

      case 'check-evolution':
        if (item.text.includes('.yes')) {
          return 'Time to evolve!';
        }
        return 'No evolution this time.';

      case 'team-rocket-encounter':
        if (item.text.includes('steal')) {
          return 'Team Rocket stole a Pokemon!';
        }
        if (item.text.includes('defeat')) {
          return 'You defeated Team Rocket!';
        }
        return 'Team Rocket ran away!';

      case 'snorlax-encounter':
        if (item.text.includes('catch')) {
          return 'You caught Snorlax!';
        }
        if (item.text.includes('defeat')) {
          return `Defeated by ${this.getRandomNpcName()}!`;
        }
        return 'You ran away safely!';

      case 'find-item':
        return `You found ${translated}!`;

      case 'trade-pokemon':
        return `Trade for ${translated}!`;

      case 'start-adventure':
      case 'adventure-continues':
      case 'explore-cave':
      case 'elite-four-preparation':
        return translated;

      case 'select-from-pokemon-list':
      case 'select-evolution':
      case 'evolve-pokemon':
        return `Selected ${translated}!`;

      default:
        return translated;
    }
  }
}
