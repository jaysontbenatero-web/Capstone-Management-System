/**
 * CapstoneX2 Signature Background Remover (Illumination-Normalized)
 * Divides pixel luminance by local paper illumination (24x24 90th-percentile
 * grid) so shadows, gradients, gray/off-white paper, and uneven lighting are
 * completely removed while signature ink strokes remain crisp and opaque.
 */
(function () {
    "use strict";

    function loadImageFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error("Failed to read signature file."));
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error("Invalid image file."));
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    function computeLocalPaperGrid(data, width, height, gridCols, gridRows) {
        const cellW = Math.max(1, Math.ceil(width / gridCols));
        const cellH = Math.max(1, Math.ceil(height / gridRows));
        const grid = new Float32Array(gridCols * gridRows);

        for (let gy = 0; gy < gridRows; gy++) {
            const y0 = gy * cellH;
            const y1 = Math.min(height, y0 + cellH);
            for (let gx = 0; gx < gridCols; gx++) {
                const x0 = gx * cellW;
                const x1 = Math.min(width, x0 + cellW);

                const lums = [];
                const step = Math.max(1, Math.floor(Math.min(x1 - x0, y1 - y0) / 8));
                for (let y = y0; y < y1; y += step) {
                    for (let x = x0; x < x1; x += step) {
                        const idx = (y * width + x) * 4;
                        if (data[idx + 3] > 30) {
                            lums.push(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
                        }
                    }
                }

                if (lums.length === 0) {
                    grid[gy * gridCols + gx] = 255;
                } else {
                    lums.sort((a, b) => a - b);
                    const p90 = lums[Math.min(lums.length - 1, Math.floor(lums.length * 0.90))];
                    grid[gy * gridCols + gx] = p90;
                }
            }
        }
        return { grid, gridCols, gridRows, cellW, cellH };
    }

    function sampleLocalPaperLum(paperGrid, x, y) {
        const { grid, gridCols, gridRows, cellW, cellH } = paperGrid;
        const fx = Math.max(0, Math.min(gridCols - 1, x / cellW - 0.5));
        const fy = Math.max(0, Math.min(gridRows - 1, y / cellH - 0.5));
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const x1 = Math.min(gridCols - 1, x0 + 1);
        const y1 = Math.min(gridRows - 1, y0 + 1);
        const tx = fx - x0;
        const ty = fy - y0;

        const v00 = grid[y0 * gridCols + x0];
        const v10 = grid[y0 * gridCols + x1];
        const v01 = grid[y1 * gridCols + x0];
        const v11 = grid[y1 * gridCols + x1];

        const top = v00 + (v10 - v00) * tx;
        const bot = v01 + (v11 - v01) * tx;
        return top + (bot - top) * ty;
    }

    async function removeSignatureBackground(file) {
        const img = await loadImageFromFile(file);

        const maxDim = 1200;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        if (width > maxDim || height > maxDim) {
            const scale = maxDim / Math.max(width, height);
            width = Math.max(1, Math.round(width * scale));
            height = Math.max(1, Math.round(height * scale));
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Skip only if image is already a clean transparent signature
        let transparentPixels = 0;
        let lightOpaquePixels = 0;
        let opaquePixels = 0;
        for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3];
            if (a < 20) {
                transparentPixels++;
            } else {
                opaquePixels++;
                const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                if (lum > 175) lightOpaquePixels++;
            }
        }
        const totalPixels = width * height;
        const isAlreadyCleanTransparent =
            transparentPixels / totalPixels > 0.45 &&
            (opaquePixels === 0 || lightOpaquePixels / opaquePixels < 0.2);

        if (!isAlreadyCleanTransparent) {
            // Finer 24x24 grid accurately tracks localized shadows across paper
            const paperGrid = computeLocalPaperGrid(data, width, height, 24, 24);

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const i = (y * width + x) * 4;
                    const a = data[i + 3];
                    if (a === 0) continue;

                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                    const saturation = Math.max(r, g, b) - Math.min(r, g, b);
                    const localPaper = Math.max(45, sampleLocalPaperLum(paperGrid, x, y));

                    // Illumination normalization: paper everywhere (even in shadow) maps to ~240-255
                    const normalizedLum = Math.min(255, (lum / localPaper) * 255);

                    const normClear = 198;
                    const normInk = 148;

                    if ((normalizedLum >= normClear && saturation < 85) || (lum > 215 && saturation < 65)) {
                        data[i + 3] = 0;
                    } else if (normalizedLum > normInk && saturation < 85) {
                        const ratio = (normClear - normalizedLum) / (normClear - normInk);
                        data[i + 3] = Math.max(0, Math.min(255, Math.round(ratio * 255)));
                    } else {
                        data[i + 3] = 255;
                    }
                }
            }
            ctx.putImageData(imageData, 0, 0);
        }

        // Auto-crop tightly around remaining signature strokes (with 12px padding)
        let minX = width, minY = height, maxX = -1, maxY = -1;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (data[(y * width + x) * 4 + 3] > 20) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }

        let outCanvas = canvas;
        if (maxX >= minX && maxY >= minY) {
            const pad = 12;
            const sx = Math.max(0, minX - pad);
            const sy = Math.max(0, minY - pad);
            const sw = Math.min(width - sx, maxX - minX + 1 + pad * 2);
            const sh = Math.min(height - sy, maxY - minY + 1 + pad * 2);

            const cropped = document.createElement("canvas");
            cropped.width = sw;
            cropped.height = sh;
            cropped.getContext("2d").drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
            outCanvas = cropped;
        }

        const dataUrl = outCanvas.toDataURL("image/png");
        const blob = await new Promise((resolve) => outCanvas.toBlob(resolve, "image/png"));
        const baseName = String(file.name || "signature").replace(/\.[^.]+$/, "");
        const cleanedFile = new File([blob], `${baseName}-transparent.png`, { type: "image/png" });

        return { file: cleanedFile, dataUrl };
    }

    window.removeSignatureBackground = removeSignatureBackground;
})();
