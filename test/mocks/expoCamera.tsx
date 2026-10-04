import { createElement, forwardRef, useImperativeHandle } from 'react';
import type { ReactNode } from 'react';

export const takePictureAsync = jest.fn();
export const useCameraPermissions = jest.fn();

export const CameraView = forwardRef<unknown, { children?: ReactNode }>(function CameraViewMock(
  props,
  ref
) {
  useImperativeHandle(ref, () => ({ takePictureAsync }));
  return createElement('ExpoCameraView', props as object, props.children);
});

export const expoCameraMock = { CameraView, useCameraPermissions };
