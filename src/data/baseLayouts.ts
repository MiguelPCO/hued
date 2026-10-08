// The 24 base layouts (4 archetypes x 3-8 colors), drawn on the 360x450 design canvas and approved
// as boards in the "Hued arquetipos" design. `rects` are in reading order (top to bottom, then left to
// right), which is also the color order (lightest first). `style` is the look each base comes with and
// `pad` where its label lines sit; both are applied whole whenever the archetype or the palette size
// changes (see baseStyleConfig in cardLayouts.ts).
import type { FontKey } from '@/data/fonts';
import type { CardArchetypeId, LabelAlign, LabelOrder, LabelPosition } from '@/types/palette';

/** [x, y, width, height] */
export type Rect4 = readonly [number, number, number, number];

export interface BaseStyle {
  cornerRadius: number;
  cardOpacity: number;
  fontFamily: FontKey;
  showHex: boolean;
  showName: boolean;
  fontSize: number;
  labelPosition: LabelPosition;
  labelOrder: LabelOrder;
  labelAlign: LabelAlign;
}

export interface LabelPad {
  x: number;
  y: number;
  /** Space between two stacked label lines. */
  lineGap: number;
}

export interface BaseLayoutData {
  rects: Rect4[];
  style: BaseStyle;
  pad: LabelPad;
}

export const BASE_LAYOUTS: Record<CardArchetypeId, Record<number, BaseLayoutData>> = {
  pila: {
    3: {
      rects: [
        [218, 52, 102, 76],
        [41, 187, 102, 76],
        [218, 322, 102, 76],
      ],
      style: {
        cornerRadius: 16,
        cardOpacity: 100,
        fontFamily: 'sans',
        showHex: true,
        showName: true,
        fontSize: 10,
        labelPosition: 'split',
        labelOrder: 'name-first',
        labelAlign: 'left',
      },
      pad: { x: 14, y: 12, lineGap: 4 },
    },
    4: {
      rects: [
        [218, 52, 102, 70],
        [41, 144, 102, 70],
        [218, 236, 102, 70],
        [41, 328, 102, 70],
      ],
      style: {
        cornerRadius: 16,
        cardOpacity: 100,
        fontFamily: 'sans',
        showHex: true,
        showName: true,
        fontSize: 10,
        labelPosition: 'split',
        labelOrder: 'name-first',
        labelAlign: 'left',
      },
      pad: { x: 14, y: 12, lineGap: 4 },
    },
    5: {
      rects: [
        [60, 48, 240, 63],
        [60, 121, 240, 63],
        [60, 194, 240, 63],
        [60, 267, 240, 63],
        [60, 340, 240, 63],
      ],
      style: {
        cornerRadius: 16,
        cardOpacity: 100,
        fontFamily: 'sans',
        showHex: true,
        showName: true,
        fontSize: 10,
        labelPosition: 'split',
        labelOrder: 'name-first',
        labelAlign: 'left',
      },
      pad: { x: 20, y: 13, lineGap: 4 },
    },
    6: {
      rects: [
        [60, 44, 240, 52],
        [60, 106, 240, 52],
        [60, 168, 240, 52],
        [60, 230, 240, 52],
        [60, 292, 240, 52],
        [60, 354, 240, 52],
      ],
      style: {
        cornerRadius: 16,
        cardOpacity: 100,
        fontFamily: 'sans',
        showHex: true,
        showName: true,
        fontSize: 10,
        labelPosition: 'split',
        labelOrder: 'name-first',
        labelAlign: 'left',
      },
      pad: { x: 20, y: 12, lineGap: 4 },
    },
    7: {
      rects: [
        [25, 60, 90, 96],
        [135, 60, 90, 150],
        [245, 60, 90, 140],
        [25, 166, 90, 128],
        [245, 210, 90, 180],
        [135, 220, 90, 170],
        [25, 304, 90, 86],
      ],
      style: {
        cornerRadius: 0,
        cardOpacity: 100,
        fontFamily: 'sans',
        showHex: true,
        showName: true,
        fontSize: 10,
        labelPosition: 'top',
        labelOrder: 'hex-first',
        labelAlign: 'left',
      },
      pad: { x: 8, y: 8, lineGap: 1 },
    },
    8: {
      rects: [
        [25, 60, 90, 96],
        [135, 60, 90, 126],
        [245, 60, 90, 84],
        [245, 154, 90, 108],
        [25, 166, 90, 128],
        [135, 196, 90, 194],
        [245, 272, 90, 118],
        [25, 304, 90, 86],
      ],
      style: {
        cornerRadius: 0,
        cardOpacity: 100,
        fontFamily: 'sans',
        showHex: true,
        showName: true,
        fontSize: 10,
        labelPosition: 'top',
        labelOrder: 'hex-first',
        labelAlign: 'left',
      },
      pad: { x: 8, y: 8, lineGap: 1 },
    },
  },
  mosaico: {
    3: {
      rects: [
        [100, 30, 160, 90],
        [100, 180, 160, 90],
        [100, 330, 160, 90],
      ],
      style: {
        cornerRadius: 0,
        cardOpacity: 100,
        fontFamily: 'sans',
        showHex: true,
        showName: true,
        fontSize: 10,
        labelPosition: 'split',
        labelOrder: 'name-first',
        labelAlign: 'left',
      },
      pad: { x: 14, y: 14, lineGap: 4 },
    },
    4: {
      rects: [
        [73, 88, 100, 130],
        [187, 88, 100, 130],
        [73, 232, 100, 130],
        [187, 232, 100, 130],
      ],
      style: {
        cornerRadius: 12,
        cardOpacity: 100,
        fontFamily: 'sans',
        showHex: true,
        showName: true,
        fontSize: 10,
        labelPosition: 'bottom',
        labelOrder: 'hex-first',
        labelAlign: 'left',
      },
      pad: { x: 10, y: 20, lineGap: 4 },
    },
    5: {
      rects: [
        [46, 118, 80, 100],
        [140, 118, 80, 100],
        [234, 118, 80, 100],
        [93, 232, 80, 100],
        [187, 232, 80, 100],
      ],
      style: {
        cornerRadius: 16,
        cardOpacity: 100,
        fontFamily: 'sans',
        showHex: true,
        showName: true,
        fontSize: 10,
        labelPosition: 'bottom',
        labelOrder: 'hex-first',
        labelAlign: 'left',
      },
      pad: { x: 10, y: 20, lineGap: 4 },
    },
    6: {
      rects: [
        [46, 118, 80, 100],
        [140, 118, 80, 100],
        [234, 118, 80, 100],
        [46, 232, 80, 100],
        [140, 232, 80, 100],
        [234, 232, 80, 100],
      ],
      style: {
        cornerRadius: 16,
        cardOpacity: 100,
        fontFamily: 'sans',
        showHex: true,
        showName: true,
        fontSize: 10,
        labelPosition: 'bottom',
        labelOrder: 'hex-first',
        labelAlign: 'left',
      },
      pad: { x: 10, y: 20, lineGap: 4 },
    },
    7: {
      rects: [
        [34, 127, 64, 92],
        [110, 127, 64, 92],
        [186, 127, 64, 92],
        [262, 127, 64, 92],
        [72, 231, 64, 92],
        [148, 231, 64, 92],
        [224, 231, 64, 92],
      ],
      style: {
        cornerRadius: 16,
        cardOpacity: 100,
        fontFamily: 'sans',
        showHex: true,
        showName: true,
        fontSize: 10,
        labelPosition: 'bottom',
        labelOrder: 'hex-first',
        labelAlign: 'left',
      },
      pad: { x: 8, y: 14, lineGap: 4 },
    },
    8: {
      rects: [
        [42, 51, 120, 60],
        [198, 51, 120, 60],
        [42, 147, 120, 60],
        [198, 147, 120, 60],
        [42, 243, 120, 60],
        [198, 243, 120, 60],
        [42, 339, 120, 60],
        [198, 339, 120, 60],
      ],
      style: {
        cornerRadius: 12,
        cardOpacity: 100,
        fontFamily: 'poppins',
        showHex: true,
        showName: false,
        fontSize: 10,
        labelPosition: 'top',
        labelOrder: 'hex-first',
        labelAlign: 'left',
      },
      pad: { x: 12, y: 10, lineGap: 4 },
    },
  },
  escalonado: {
    3: {
      rects: [
        [72, 170, 60, 110],
        [150, 170, 60, 110],
        [228, 170, 60, 110],
      ],
      style: {
        cornerRadius: 0,
        cardOpacity: 100,
        fontFamily: 'sans',
        showHex: true,
        showName: true,
        fontSize: 10,
        labelPosition: 'bottom',
        labelOrder: 'hex-first',
        labelAlign: 'center',
      },
      pad: { x: 10, y: 10, lineGap: 5 },
    },
    4: {
      rects: [
        [12, 14, 90, 110],
        [258, 14, 90, 110],
        [12, 326, 90, 110],
        [258, 326, 90, 110],
      ],
      style: {
        cornerRadius: 16,
        cardOpacity: 100,
        fontFamily: 'sans',
        showHex: true,
        showName: true,
        fontSize: 10,
        labelPosition: 'bottom',
        labelOrder: 'name-first',
        labelAlign: 'center',
      },
      pad: { x: 10, y: 10, lineGap: 9 },
    },
    5: {
      rects: [
        [12, 14, 90, 110],
        [258, 14, 90, 110],
        [135, 170, 90, 110],
        [12, 326, 90, 110],
        [258, 326, 90, 110],
      ],
      style: {
        cornerRadius: 16,
        cardOpacity: 100,
        fontFamily: 'sans',
        showHex: true,
        showName: true,
        fontSize: 10,
        labelPosition: 'bottom',
        labelOrder: 'name-first',
        labelAlign: 'center',
      },
      pad: { x: 10, y: 10, lineGap: 9 },
    },
    6: {
      rects: [
        [20, 40, 100, 80],
        [240, 40, 100, 80],
        [130, 110, 100, 80],
        [20, 260, 100, 80],
        [240, 260, 100, 80],
        [130, 330, 100, 80],
      ],
      style: {
        cornerRadius: 16,
        cardOpacity: 100,
        fontFamily: 'sans',
        showHex: true,
        showName: true,
        fontSize: 10,
        labelPosition: 'top',
        labelOrder: 'name-first',
        labelAlign: 'left',
      },
      pad: { x: 8, y: 10, lineGap: 8 },
    },
    7: {
      rects: [
        [8, 44, 80, 72],
        [184, 44, 80, 72],
        [96, 113, 80, 72],
        [272, 113, 80, 72],
        [52, 265, 80, 72],
        [228, 265, 80, 72],
        [140, 334, 80, 72],
      ],
      style: {
        cornerRadius: 16,
        cardOpacity: 100,
        fontFamily: 'sans',
        showHex: true,
        showName: true,
        fontSize: 10,
        labelPosition: 'top',
        labelOrder: 'name-first',
        labelAlign: 'left',
      },
      pad: { x: 8, y: 10, lineGap: 8 },
    },
    8: {
      rects: [
        [8, 44, 80, 72],
        [184, 44, 80, 72],
        [96, 113, 80, 72],
        [272, 113, 80, 72],
        [8, 265, 80, 72],
        [184, 265, 80, 72],
        [96, 334, 80, 72],
        [272, 334, 80, 72],
      ],
      style: {
        cornerRadius: 16,
        cardOpacity: 100,
        fontFamily: 'sans',
        showHex: true,
        showName: true,
        fontSize: 10,
        labelPosition: 'top',
        labelOrder: 'name-first',
        labelAlign: 'left',
      },
      pad: { x: 8, y: 10, lineGap: 8 },
    },
  },
  columnas: {
    3: {
      rects: [
        [32, 111, 130, 96],
        [198, 111, 130, 96],
        [115, 243, 130, 96],
      ],
      style: {
        cornerRadius: 16,
        cardOpacity: 100,
        fontFamily: 'sans',
        showHex: true,
        showName: true,
        fontSize: 10,
        labelPosition: 'split',
        labelOrder: 'name-first',
        labelAlign: 'left',
      },
      pad: { x: 12, y: 11, lineGap: 4 },
    },
    4: {
      rects: [
        [32, 111, 130, 96],
        [198, 111, 130, 96],
        [32, 243, 130, 96],
        [198, 243, 130, 96],
      ],
      style: {
        cornerRadius: 16,
        cardOpacity: 100,
        fontFamily: 'sans',
        showHex: true,
        showName: true,
        fontSize: 10,
        labelPosition: 'split',
        labelOrder: 'name-first',
        labelAlign: 'left',
      },
      pad: { x: 12, y: 11, lineGap: 4 },
    },
    5: {
      rects: [
        [48, 133, 80, 86],
        [140, 133, 80, 86],
        [232, 133, 80, 86],
        [94, 231, 80, 86],
        [186, 231, 80, 86],
      ],
      style: {
        cornerRadius: 16,
        cardOpacity: 65,
        fontFamily: 'sans',
        showHex: true,
        showName: true,
        fontSize: 10,
        labelPosition: 'split',
        labelOrder: 'hex-first',
        labelAlign: 'diagonal',
      },
      pad: { x: 6, y: 10, lineGap: 4 },
    },
    6: {
      rects: [
        [48, 84, 80, 86],
        [140, 84, 80, 86],
        [232, 84, 80, 86],
        [94, 182, 80, 86],
        [186, 182, 80, 86],
        [140, 280, 80, 86],
      ],
      style: {
        cornerRadius: 16,
        cardOpacity: 65,
        fontFamily: 'sans',
        showHex: true,
        showName: true,
        fontSize: 10,
        labelPosition: 'split',
        labelOrder: 'hex-first',
        labelAlign: 'diagonal',
      },
      pad: { x: 6, y: 10, lineGap: 4 },
    },
    7: {
      rects: [
        [66, 60, 60, 60],
        [234, 105, 60, 60],
        [66, 150, 60, 60],
        [234, 195, 60, 60],
        [66, 240, 60, 60],
        [234, 285, 60, 60],
        [66, 330, 60, 60],
      ],
      style: {
        cornerRadius: 40,
        cardOpacity: 100,
        fontFamily: 'sans',
        showHex: false,
        showName: true,
        fontSize: 10,
        labelPosition: 'center',
        labelOrder: 'name-first',
        labelAlign: 'center',
      },
      pad: { x: 10, y: 10, lineGap: 4 },
    },
    8: {
      rects: [
        [66, 60, 60, 60],
        [234, 60, 60, 60],
        [66, 150, 60, 60],
        [234, 150, 60, 60],
        [66, 240, 60, 60],
        [234, 240, 60, 60],
        [66, 330, 60, 60],
        [234, 330, 60, 60],
      ],
      style: {
        cornerRadius: 40,
        cardOpacity: 100,
        fontFamily: 'sans',
        showHex: false,
        showName: true,
        fontSize: 10,
        labelPosition: 'center',
        labelOrder: 'name-first',
        labelAlign: 'center',
      },
      pad: { x: 10, y: 10, lineGap: 4 },
    },
  },
};
