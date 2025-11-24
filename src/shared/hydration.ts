/**
 * Hydration system for transitioning from SSR to client-side rendering
 */

import { World } from '../core/world.js';
import { EntityId } from '../core/entity.js';
import { Serializer, WorldSnapshot } from './serialization.js';
import { ComponentId } from '../core/component.js';

export interface HydrationMarker {
  entityId: EntityId;
  componentId?: ComponentId;
  attributes: Record<string, string>;
}

export interface HydrationData {
  snapshot: WorldSnapshot;
  markers: HydrationMarker[];
}

export const HYDRATION_ATTR = 'data-wecs-entity';
export const HYDRATION_COMPONENT_ATTR = 'data-wecs-component';

export class HydrationManager {
  private serializer = new Serializer();
  private entityToElement = new Map<EntityId, Element>();
  private elementToEntity = new Map<Element, EntityId>();

  addMarkerToElement(element: Element, entityId: EntityId, componentId?: ComponentId): void {
    element.setAttribute(HYDRATION_ATTR, String(entityId));
    if (componentId) {
      element.setAttribute(HYDRATION_COMPONENT_ATTR, componentId);
    }

    this.entityToElement.set(entityId, element);
    this.elementToEntity.set(element, entityId);
  }

  getEntityFromElement(element: Element): EntityId | null {
    const entityIdStr = element.getAttribute(HYDRATION_ATTR);
    if (!entityIdStr) {
      return null;
    }
    return Number(entityIdStr) as EntityId;
  }

  getElementFromEntity(entityId: EntityId): Element | undefined {
    return this.entityToElement.get(entityId);
  }

  collectMarkers(root: Element): HydrationMarker[] {
    const markers: HydrationMarker[] = [];
    const elements = root.querySelectorAll(`[${HYDRATION_ATTR}]`);

    for (const element of Array.from(elements)) {
      const entityIdStr = element.getAttribute(HYDRATION_ATTR);
      const componentId = element.getAttribute(HYDRATION_COMPONENT_ATTR);

      if (!entityIdStr) {
        continue;
      }

      const entityId = Number(entityIdStr) as EntityId;
      const attributes: Record<string, string> = {};

      for (const attr of Array.from(element.attributes)) {
        if (attr.name !== HYDRATION_ATTR && attr.name !== HYDRATION_COMPONENT_ATTR) {
          attributes[attr.name] = attr.value;
        }
      }

      markers.push({
        entityId,
        componentId: componentId as ComponentId | undefined,
        attributes,
      });
    }

    return markers;
  }

  createHydrationData(world: World, root?: Element): HydrationData {
    const snapshot = this.serializer.createSnapshot(world);
    const markers = root ? this.collectMarkers(root) : [];

    return {
      snapshot,
      markers,
    };
  }

  embedHydrationData(hydrationData: HydrationData): string {
    return `<script type="application/json" id="wecs-hydration-data">${JSON.stringify(hydrationData)}</script>`;
  }

  extractHydrationData(): HydrationData | null {
    if (typeof document === 'undefined') {
      return null;
    }

    const script = document.getElementById('wecs-hydration-data');
    if (!script || !script.textContent) {
      return null;
    }

    try {
      return JSON.parse(script.textContent) as HydrationData;
    } catch (error) {
      console.error('Failed to parse hydration data', error);
      return null;
    }
  }

  hydrate(world: World, root: Element): boolean {
    const hydrationData = this.extractHydrationData();
    if (!hydrationData) {
      console.warn('No hydration data found');
      return false;
    }

    this.serializer.restoreSnapshot(world, hydrationData.snapshot);

    for (const marker of hydrationData.markers) {
      const selector = `[${HYDRATION_ATTR}="${marker.entityId}"]`;
      const element = root.querySelector(selector);

      if (element) {
        this.entityToElement.set(marker.entityId, element);
        this.elementToEntity.set(element, marker.entityId);
      }
    }

    const script = document.getElementById('wecs-hydration-data');
    if (script) {
      script.remove();
    }

    return true;
  }

  clearMarkers(root: Element): void {
    const elements = root.querySelectorAll(`[${HYDRATION_ATTR}]`);
    for (const element of Array.from(elements)) {
      element.removeAttribute(HYDRATION_ATTR);
      element.removeAttribute(HYDRATION_COMPONENT_ATTR);
    }
  }

  clear(): void {
    this.entityToElement.clear();
    this.elementToEntity.clear();
  }
}

export function createHydrationManager(): HydrationManager {
  return new HydrationManager();
}

export interface HydrateOptions {
  root?: Element;
  clearMarkers?: boolean;
  onHydrated?: (world: World) => void;
  onError?: (error: Error) => void;
}

export async function hydrateWorld(world: World, options: HydrateOptions = {}): Promise<boolean> {
  const hydrationManager = createHydrationManager();
  const root = options.root ?? (typeof document !== 'undefined' ? document.body : null);

  if (!root) {
    const error = new Error('No root element provided and document is not available');
    if (options.onError) {
      options.onError(error);
    }
    return false;
  }

  try {
    const success = hydrationManager.hydrate(world, root);

    if (success) {
      if (options.clearMarkers) {
        hydrationManager.clearMarkers(root);
      }

      if (options.onHydrated) {
        options.onHydrated(world);
      }
    }

    return success;
  } catch (error) {
    if (options.onError) {
      options.onError(error as Error);
    }
    return false;
  }
}
