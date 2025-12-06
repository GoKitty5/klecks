import { gl } from '../core/gl';
import { FxShader } from '../core/fx-shader';
import { simpleShader } from '../core/simple-shader';
import shaderNoise from '../shaders/shader-noise-tiled.glsl';
import { TFxCanvas } from '../fx-canvas-types';

/**
 * Noise
 * draws noise, completely replaces original image
 */
export type TFilterNoise = (
    this: TFxCanvas,
    seed: number | undefined, // float, any value okay - default 0
    type: number, // 1 value, 2 simplex, 3 cellular
    scale: [number, number], // float, small scale will show repeating patterns
    offset: [number, number], // offset x, y - large offsets will show repeating patterns
    octaves: number, // int 0 - 4
    samples: number, // 1 | 4 | 8 -> super-sampling
    peaks: number, // how often it will ramp *additionally* from 0 to 1
    brightness: number, // range [-1, 1]
    contrast: number, // range [-1, 1]
    isReversed: boolean, // reverse 0-1 range
    colA: { r: number; g: number; b: number } | undefined, // which color at 0, if rgb - default black
    colB: { r: number; g: number; b: number } | undefined, // which color at 1, if rgb - default white
    channels: 'rgb' | 'alpha', // which channel to target
) => TFxCanvas;

export const noise: TFilterNoise = function (
    seed,
    type,
    scale,
    offset,
    octaves,
    samples,
    peaks,
    brightness,
    contrast,
    isReversed,
    colA,
    colB,
    channels,
) {
    gl.noise = gl.noise || new FxShader(null, shaderNoise.replace(/#define.*/, ''), 'noise');
    const shader = gl.noise;

    // Determine safe tile size based on MAX_TEXTURE_SIZE
    const maxTex = (gl.getParameter((gl as any).MAX_TEXTURE_SIZE) as number) || 4096;
    const tileLimit = Math.min(2048, maxTex);

    const fullW = this.width;
    const fullH = this.height;

    // helper to build common uniforms
        // helper to build common uniforms
    // automatic quality reduction for very large canvases to avoid extreme GPU cost
    const maxDim = Math.max(fullW, fullH);
    let adjustedOctaves = octaves;
    let adjustedSamples = samples;
    // heuristics (tweakable): lower detail when size grows
    if (maxDim > 8000) {
        adjustedOctaves = Math.min(octaves, 1);
        adjustedSamples = 1;
    } else if (maxDim > 5000) {
        adjustedOctaves = Math.min(octaves, 2);
        adjustedSamples = Math.min(samples, 4);
    } else if (maxDim > 3000) {
        adjustedOctaves = Math.min(octaves, 3);
        adjustedSamples = Math.min(samples, 4);
    }

const baseUniforms = {
        seed: seed || 0,
        type,
        scale: [scale[0], scale[1]],
        offset,
        octaves: adjustedOctaves,
        samples: adjustedSamples,
        peaks,
        brightness,
        contrast,
        isReversed: isReversed ? 1.0 : 0.0,
        colA: colA ? [colA.r / 255, colA.g / 255, colA.b / 255] : [0, 0, 0],
        colB: colB ? [colB.r / 255, colB.g / 255, colB.b / 255] : [1, 1, 1],
        channels: channels === 'rgb' ? 0 : 1,
    } as any;

    // If canvas fits into a single texture, render normally
    if (fullW <= tileLimit && fullH <= tileLimit) {
        simpleShader.call(this, shader, Object.assign({}, baseUniforms, {
            texSize: [fullW, fullH],
            tileOrigin: [0, 0],
            tileSize: [fullW, fullH],
        }));
        return this;
    }

    // Tiled rendering: render noise into tiles and blit into the main texture
    const spare = this._.spareTexture;
    const main = this._.texture;
    const defaultShader = FxShader.getDefaultShader();

    for (let y = 0; y < fullH; y += tileLimit) {
        for (let x = 0; x < fullW; x += tileLimit) {
            const w = Math.min(tileLimit, fullW - x);
            const h = Math.min(tileLimit, fullH - y);
            // ensure spare texture matches tile size
            spare.ensureFormat(w, h, gl.RGBA, gl.UNSIGNED_BYTE);
            // render noise into spare texture (tile-local)
            spare.drawTo(() => {
                shader.uniforms(Object.assign({}, baseUniforms, {
                    texSize: [w, h],
                    tileOrigin: [x, y],
                    tileSize: [w, h],
                })).drawRect();
            });

            // copy spare tile into main texture at (x,y)
            main.drawTo(() => {
                spare.use(0);
                defaultShader.textures({ texture: 0 }).drawRect(x, y, x + w, y + h);
            });
        }
    }

    return this;

};
