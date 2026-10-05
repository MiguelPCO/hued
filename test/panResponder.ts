import { screen } from '@testing-library/react-native';
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
 *
 * `live(i)` devuelve la config del i-ésimo View que lleva los `panHandlers` en el render
 * ACTUAL: el spy mete la config en `panHandlers.__config`, que viaja con el spread hasta el
 * View. Así un test ejerce el responder que RN realmente usaría, tanto si el componente
 * conserva el primero (`useRef`) como si lo recrea (`useMemo`) o lee refs.
 */
export function capturePanResponders(): {
  configs: PanResponderCallbacks[];
  live: (index?: number) => PanResponderCallbacks;
  restore: () => void;
} {
  const configs: PanResponderCallbacks[] = [];
  const spy = jest.spyOn(PanResponder, 'create').mockImplementation((config) => {
    configs.push(config);
    return { panHandlers: { __config: config } } as unknown as ReturnType<typeof PanResponder.create>;
  });
  const live = (index = 0) => {
    const carriers = screen.UNSAFE_root.findAll((n) => (n.type as unknown) === 'View' && n.props.__config);
    return carriers[index].props.__config as PanResponderCallbacks;
  };
  return { configs, live, restore: () => spy.mockRestore() };
}

export function gesture(dx = 0, dy = 0): PanResponderGestureState {
  return { dx, dy } as PanResponderGestureState;
}

export function touch(locationX: number): GestureResponderEvent {
  return { nativeEvent: { locationX } } as GestureResponderEvent;
}
