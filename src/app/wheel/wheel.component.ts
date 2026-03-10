import { Component, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { WheelItem } from '../interfaces/wheel-item';
import { DarkModeService } from '../services/dark-mode-service/dark-mode.service';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { GameStateService } from '../services/game-state-service/game-state.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AudioService } from '../services/audio-service/audio.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

interface ReelItem {
  text: string;
  translatedText: string;
  fillStyle: string;
  weight: number;
}

@Component({
  selector: 'app-wheel',
  imports: [
    CommonModule,
    TranslatePipe
  ],
  templateUrl: './wheel.component.html',
  styleUrl: './wheel.component.css'
})
export class WheelComponent implements OnChanges {

  @Input() items: WheelItem[] = [];
  @Output() selectedItemEvent = new EventEmitter<number>();
  spinning = false;
  darkMode!: Observable<boolean>;

  reelItems: ReelItem[] = [];
  reel2Items: ReelItem[] = [];
  reel3Items: ReelItem[] = [];

  reel1Offset = 0;
  reel2Offset = 0;
  reel3Offset = 0;

  currentSegment: string = '-';
  clickAudio!: HTMLAudioElement;
  private itemHeight = 90;
  private winningNumber!: number;
  private startTime = 0;
  private reel1Duration = 0;
  private reel2Duration = 0;
  private reel3Duration = 0;
  private reel1FinalOffset = 0;
  private reel2FinalOffset = 0;
  private reel3FinalOffset = 0;
  private lastClickedSegment = -1;
  private resultEmitted = false;

  constructor(
    private darkModeService: DarkModeService,
    private gameStateService: GameStateService,
    private translateService: TranslateService,
    private audioService: AudioService,
    private modalService: NgbModal
  ) {
    this.clickAudio = this.audioService.createAudio('./click.mp3');
    this.darkMode = this.darkModeService.darkMode$;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['items']) {
      this.translateService.get('wheel.spin').subscribe(() => {
        this.buildReels();
      });
    }
  }

  private buildReels(): void {
    const translated: ReelItem[] = this.items.map(item => ({
      text: item.text,
      translatedText: this.translateService.instant(item.text),
      fillStyle: item.fillStyle,
      weight: item.weight
    }));

    // Build reel strips: repeat items enough times for smooth spinning
    // Each reel needs enough items to scroll through several full cycles
    const minCycles = 4;
    const buildStrip = (baseItems: ReelItem[]): ReelItem[] => {
      const strip: ReelItem[] = [];
      for (let c = 0; c < minCycles + 2; c++) {
        for (const item of baseItems) {
          strip.push({ ...item });
        }
      }
      return strip;
    };

    // Shuffle for reel variety (reels 2 and 3 get different orderings)
    const shuffle = (arr: ReelItem[]): ReelItem[] => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    this.reelItems = buildStrip(translated);
    this.reel2Items = buildStrip(shuffle(translated));
    this.reel3Items = buildStrip(shuffle(translated));

    // Position reels so the first item is centered in the window
    const windowCenter = this.getWindowHeight() / 2 - this.itemHeight / 2;
    this.reel1Offset = -0 + windowCenter;
    this.reel2Offset = -0 + windowCenter;
    this.reel3Offset = -0 + windowCenter;
  }

  private getWindowHeight(): number {
    return window.innerWidth <= 768 ? 225 : 270;
  }

  spinWheel(): void {
    if (this.spinning) {
      return;
    }

    this.spinning = true;
    this.resultEmitted = false;
    this.gameStateService.setWheelSpinning(this.spinning);
    this.lastClickedSegment = -1;

    // Select winning item using weighted random
    this.winningNumber = this.getRandomWeightedIndex();
    const winningItem = this.items[this.winningNumber];

    // Calculate target positions - each reel stops on the winning item
    const windowCenter = this.getWindowHeight() / 2 - this.itemHeight / 2;
    const itemCount = this.items.length;

    // Find winning item position in each reel strip
    const findWinningPos = (reelItems: ReelItem[], targetCycle: number): number => {
      let count = 0;
      for (let i = 0; i < reelItems.length; i++) {
        if (reelItems[i].text === winningItem.text) {
          count++;
          if (count === targetCycle) {
            return i;
          }
        }
      }
      return 0;
    };

    // Target the 3rd occurrence of winning item (ensures enough scrolling)
    const targetCycle = 3;
    const r1WinIdx = findWinningPos(this.reelItems, targetCycle);
    const r2WinIdx = findWinningPos(this.reel2Items, targetCycle);
    const r3WinIdx = findWinningPos(this.reel3Items, targetCycle);

    this.reel1FinalOffset = -(r1WinIdx * this.itemHeight) + windowCenter;
    this.reel2FinalOffset = -(r2WinIdx * this.itemHeight) + windowCenter;
    this.reel3FinalOffset = -(r3WinIdx * this.itemHeight) + windowCenter;

    // Staggered stop times - fixed pace for consistency
    this.reel1Duration = 1500;
    this.reel2Duration = 2200;
    this.reel3Duration = 3000;

    this.startTime = performance.now();
    requestAnimationFrame(this.animate.bind(this));
  }

  private animate(currentTime: number): void {
    const elapsed = currentTime - this.startTime;

    // Animate each reel independently
    this.reel1Offset = this.animateReel(elapsed, this.reel1Duration, this.reel1FinalOffset, this.reelItems.length);
    this.reel2Offset = this.animateReel(elapsed, this.reel2Duration, this.reel2FinalOffset, this.reel2Items.length);
    this.reel3Offset = this.animateReel(elapsed, this.reel3Duration, this.reel3FinalOffset, this.reel3Items.length);

    // Click sound on segment change
    const currentIdx = Math.round(-this.reel1Offset / this.itemHeight);
    if (currentIdx !== this.lastClickedSegment && elapsed < this.reel3Duration) {
      this.lastClickedSegment = currentIdx;
      this.audioService.playAudio(this.clickAudio, 1.0);
    }

    // Update display segment based on last reel
    if (elapsed >= this.reel3Duration) {
      this.currentSegment = this.items[this.winningNumber].text;
    } else if (elapsed >= this.reel1Duration) {
      this.currentSegment = this.items[this.winningNumber].text;
    }

    if (elapsed < this.reel3Duration) {
      requestAnimationFrame(this.animate.bind(this));
    } else if (!this.resultEmitted) {
      this.resultEmitted = true;
      // Wait 500ms after reels stop before emitting result
      setTimeout(() => {
        this.spinning = false;
        this.gameStateService.setWheelSpinning(false);
        this.selectedItemEvent.emit(this.winningNumber);
      }, 500);
    }
  }

  private animateReel(elapsed: number, duration: number, finalOffset: number, totalItems: number): number {
    const windowCenter = this.getWindowHeight() / 2 - this.itemHeight / 2;
    const startOffset = windowCenter;

    if (elapsed >= duration) {
      return finalOffset;
    }

    const progress = elapsed / duration;
    // Ease out cubic for smooth deceleration
    const easedProgress = 1 - Math.pow(1 - progress, 3);

    const totalDistance = startOffset - finalOffset;
    return startOffset - (totalDistance * easedProgress);
  }

  getRandomWeightedIndex(): number {
    const totalWeight = this.items.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;
    let accumulatedWeight = 0;

    for (let i = 0; i < this.items.length; i++) {
      accumulatedWeight += this.items[i].weight;
      if (random < accumulatedWeight) {
        return i;
      }
    }
    return this.items.length - 1;
  }

  @HostListener('window:keydown.space', ['$event'])
  handleSpacebar(event: Event): void {
    const activeElement = document.activeElement;
    const isInputOrButtonFocused = activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLButtonElement ||
      activeElement?.getAttribute('role') === 'button';

    if (!this.spinning && !this.modalService.hasOpenModals() && !isInputOrButtonFocused) {
      event.preventDefault();
      this.spinWheel();
    }
  }
}
