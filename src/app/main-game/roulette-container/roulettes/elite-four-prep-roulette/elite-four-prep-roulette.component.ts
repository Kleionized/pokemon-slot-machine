import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, TemplateRef, ViewChild } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import {TranslatePipe} from '@ngx-translate/core';
import { EventSource } from '../../../EventSource';
import { ItemItem } from '../../../../interfaces/item-item';
import { WheelItem } from '../../../../interfaces/wheel-item';
import { ItemsService } from '../../../../services/items-service/items.service';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';
import { WheelComponent } from '../../../../wheel/wheel.component';

@Component({
  selector: 'app-elite-four-prep-roulette',
  imports: [CommonModule, TranslatePipe, WheelComponent],
  templateUrl: './elite-four-prep-roulette.component.html',
  styleUrl: './elite-four-prep-roulette.component.css'
})
export class EliteFourPrepRouletteComponent implements OnInit {

  constructor(
    private itemsService: ItemsService,
    private modalService: NgbModal,
    private trainerService: TrainerService
  ) { }

  @ViewChild('pokemartModal', { static: true }) pokemartModal!: TemplateRef<any>;

  @Input() respinReason!: string;
  @Output() catchPokemonEvent = new EventEmitter<void>();
  @Output() battleTrainerEvent = new EventEmitter<EventSource>();
  @Output() buyPotionsEvent = new EventEmitter<void>();
  @Output() catchTwoPokemonEvent = new EventEmitter<void>();
  @Output() legendaryEncounterEvent = new EventEmitter<void>();
  @Output() findItemEvent = new EventEmitter<void>();
  @Output() doNothingEvent = new EventEmitter<void>();
  @Output() teamRocketEncounterEvent = new EventEmitter<void>();

  trainerItems: ItemItem[] = [];
  rerollsRemaining = 0;
  rerollWheelItems: WheelItem[] = [];
  private allItems: ItemItem[] = [];

  leavePokemart(): void {
    this.closeModal();
    this.doNothingEvent.emit();
  }

  hasFinishedRerolls(): boolean {
    return this.trainerItems.length === 0 || this.rerollsRemaining <= 0;
  }

  closeModal(): void {
    this.modalService.dismissAll();
  }

  get hasItemsToReroll(): boolean {
    return this.trainerItems.length > 0;
  }

  onRerollSpinResult(index: number): void {
    if (this.rerollsRemaining <= 0 || this.trainerItems.length === 0) {
      return;
    }

    // Pick a random item from the trainer's bag to replace
    const itemToReplace = this.trainerItems[Math.floor(Math.random() * this.trainerItems.length)];

    // The wheel selected a new item from the pool
    const selectedItem = this.allItems[index];

    this.trainerService.removeItem(itemToReplace);
    this.trainerService.addToItems(selectedItem);
    this.rerollsRemaining--;

    // Refresh items list
    this.trainerItems = this.trainerService.getItems();
    this.buildRerollWheel();
  }

  private buildRerollWheel(): void {
    this.allItems = this.itemsService.getAllItems();
    const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
    this.rerollWheelItems = this.allItems.map((item, i) => ({
      text: item.text,
      fillStyle: colors[i % colors.length],
      weight: 1
    }));
  }

  ngOnInit(): void {
    this.trainerItems = this.trainerService.getItems();
    this.rerollsRemaining = this.trainerItems.length;
    this.buildRerollWheel();
    this.modalService.open(this.pokemartModal, {
      centered: true,
      size: 'lg'
    });
  }
}
