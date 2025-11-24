import { Component, ComponentId, defineComponent } from '../../../src/core/component.ts';
import { Signal } from '../../../src/reactive/signal.ts';

export type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'rating';

export interface UiStateData {
  search: string;
  filterTag: string;
  sort: SortOption;
}

export class UiStateComponent extends Component {
  static readonly componentId = 'UiState' as ComponentId;
  static readonly componentName = 'UiState';

  private searchSignal: Signal<string>;
  private filterTagSignal: Signal<string>;
  private sortSignal: Signal<SortOption>;

  constructor(data?: Partial<UiStateData>) {
    super();
    this.searchSignal = this.defineReactive('search', data?.search ?? '');
    this.filterTagSignal = this.defineReactive('filterTag', data?.filterTag ?? 'all');
    this.sortSignal = this.defineReactive('sort', data?.sort ?? 'featured');
  }

  get search(): string {
    return this.searchSignal.get();
  }
  set search(value: string) {
    this.searchSignal.set(value);
  }

  get filterTag(): string {
    return this.filterTagSignal.get();
  }
  set filterTag(value: string) {
    this.filterTagSignal.set(value);
  }

  get sort(): SortOption {
    return this.sortSignal.get();
  }
  set sort(value: SortOption) {
    this.sortSignal.set(value);
  }

  clone(): this {
    return new UiStateComponent({
      search: this.searchSignal.peek(),
      filterTag: this.filterTagSignal.peek(),
      sort: this.sortSignal.peek(),
    }) as this;
  }
}

export const UiState = defineComponent('UiState', () => UiStateComponent);
