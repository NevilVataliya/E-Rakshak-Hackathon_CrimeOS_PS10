// Type declarations for @xyflow/react v12.11.2
// The published package has broken type definitions - the dist/esm/additional-components/index.d.ts
// re-exports from '../../src/additional-components/...' paths that don't exist in the published package.
// This file augments the module with the missing component types.

import type { ReactNode, CSSProperties, MouseEvent } from 'react';
import type { ViewportHelperFunctionOptions, FitBoundsOptions, ControlPosition } from '@xyflow/react';

declare module '@xyflow/react' {
    export type Edge<EdgeData extends Record<string, unknown> = Record<string, unknown>> = {
        id: string;
        type?: string;
        source: string;
        target: string;
        sourceHandle?: string | null;
        targetHandle?: string | null;
        label?: ReactNode;
        animated?: boolean;
        hidden?: boolean;
        deletable?: boolean;
        selectable?: boolean;
        selected?: boolean;
        focusable?: boolean;
        style?: CSSProperties;
        className?: string;
        data?: EdgeData;
        markerStart?: string | { type: string; color?: string };
        markerEnd?: string | { type: string; color?: string };
        zIndex?: number;
        ariaLabel?: string;
        interactionWidth?: number;
        pathOptions?: unknown;
        labelStyle?: CSSProperties;
        labelShowBg?: boolean;
        labelBgStyle?: CSSProperties;
        labelBgPadding?: [number, number];
        labelBgBorderRadius?: number;
    };

    export enum BackgroundVariant {
        Lines = 'lines',
        Dots = 'dots',
        Cross = 'cross',
    }

    export type BackgroundProps = {
        id?: string;
        variant?: BackgroundVariant;
        gap?: number | [number, number];
        size?: number;
        lineWidth?: number;
        offset?: number;
        color?: string;
        bgColor?: string;
        style?: CSSProperties;
        className?: string;
        patternClassName?: string;
    };

    export const Background: import('react').MemoExoticComponent<(props: BackgroundProps) => import('react/jsx-runtime').JSX.Element>;

    export type ControlButtonProps = {
        className?: string;
        children?: ReactNode;
        onClick?: (event: MouseEvent) => void;
        title?: string;
        'aria-label'?: string;
        disabled?: boolean;
    };

    export const ControlButton: import('react').ForwardRefExoticComponent<ControlButtonProps & import('react').RefAttributes<HTMLButtonElement>>;

    export type ControlProps = {
        style?: CSSProperties;
        showZoom?: boolean;
        showFitView?: boolean;
        showInteractive?: boolean;
        fitViewOptions?: ViewportHelperFunctionOptions & FitBoundsOptions;
        onZoomIn?: () => void;
        onZoomOut?: () => void;
        onFitView?: () => void;
        onInteractiveChange?: (isInteractive: boolean) => void;
        className?: string;
        children?: ReactNode;
        position?: ControlPosition;
        orientation?: 'horizontal' | 'vertical';
        'aria-label'?: string;
    };

    export const Controls: import('react').MemoExoticComponent<(props: ControlProps) => import('react/jsx-runtime').JSX.Element>;
}
