import { PanResponder } from 'react-native';
import type {
  GestureResponderEvent,
  PanResponderCallbacks,
  PanResponderGestureState,
} from 'react-native';

/**
 * Sustituye `PanResponder.create` para guardar la config de cada responder y
 * poder invocar sus handlers (`onPanResponderGrant`, `…Move`, `…Release`) con
 * eventos sintéticos. El responder real exige historial de toques de RN.
 * Los componentes llaman a `create` en cada render: `configs[0]` es la del primer render.
 */
export function capturePanResponders(): { configs: PanResponderCallbacks[]; restore: () => void } {
  const configs: PanResponderCallbacks[] = [];
  const spy = jest.spyOn(PanResponder, 'create').mockImplementation((config) => {
    configs.push(config);
    return { panHandlers: {} } as ReturnType<typeof PanResponder.create>;
  });
  return { configs, restore: () => spy.mockRestore() };
}

export function gesture(dx = 0, dy = 0): PanResponderGestureState {
  return { dx, dy } as PanResponderGestureState;
}

export function touch(locationX: number): GestureResponderEvent {
  return { nativeEvent: { locationX } } as GestureResponderEvent;
}
