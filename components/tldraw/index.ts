/**
 * tldraw-based Permaculture Canvas
 *
 * This is a modern, high-performance canvas implementation using tldraw,
 * replacing the legacy SVG-based canvas with professional-grade functionality.
 *
 * @see https://tldraw.dev
 *
 * Nothing imports this barrel (callers import the editor module directly), so
 * every export here must be kept in sync by hand -- a new export pointing at a
 * deleted module breaks the build even with zero users.
 */

export { CanvasErrorBoundary } from './canvas-error-boundary'
export { permacultureShapes, BedShapeUtil, PlantShapeUtil } from './shapes'
export { permacultureTools } from './tools'
export { dataAdapter, DataAdapter } from './data-adapter'
export type { BedShape } from './shapes/bed-shape'
export type { PlantShape } from './shapes/plant-shape'
