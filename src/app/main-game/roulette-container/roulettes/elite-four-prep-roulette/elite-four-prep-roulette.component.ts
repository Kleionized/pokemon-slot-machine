import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, TemplateRef, ViewChild } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import {TranslatePipe} from '@ngx-translate/core';
import { EventSource } from '../../../EventSource';
import { ItemItem } from '../../../../interfaces/item-item';
import { ItemsService } from '../../../../services/items-service/items.service';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';

@Component({
  selector: 'app-elite-four-prep-roulette',
  imports: [CommonModule, TranslatePipe],
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

  rerollItem(item: ItemItem): void {
    if (this.rerollsRemaining <= 0) {
      return;
    }

    const rerollPool = this.itemsService.getAllItems().filter(candidate => candidate.name !== item.name);
    const replacement = rerollPool[Math.floor(Math.random() * rerollPool.length)];

    this.trainerService.removeItem(item);
    this.trainerService.addToItems(replacement);
    this.rerollsRemaining--;
  }

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

  ngOnInit(): void {
    this.trainerItems = this.trainerService.getItems();
    this.rerollsRemaining = this.trainerItems.length;
    this.modalService.open(this.pokemartModal, {
      centered: true,
      size: 'lg'
    });
  }
}
