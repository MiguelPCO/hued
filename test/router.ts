import { router, useLocalSearchParams } from 'expo-router';

export const routerMock = router as unknown as {
  push: jest.Mock;
  replace: jest.Mock;
  back: jest.Mock;
  canGoBack: jest.Mock;
  dismissAll: jest.Mock;
  canDismiss: jest.Mock;
  navigate: jest.Mock;
};

export const searchParamsMock = useLocalSearchParams as unknown as jest.Mock;

export function resetRouterMocks(): void {
  routerMock.push.mockClear();
  routerMock.replace.mockClear();
  routerMock.back.mockClear();
  routerMock.dismissAll.mockClear();
  routerMock.navigate.mockClear();
  routerMock.canGoBack.mockReset();
  routerMock.canGoBack.mockReturnValue(true);
  routerMock.canDismiss.mockReset();
  routerMock.canDismiss.mockReturnValue(false);
  searchParamsMock.mockReset();
  searchParamsMock.mockReturnValue({});
}
