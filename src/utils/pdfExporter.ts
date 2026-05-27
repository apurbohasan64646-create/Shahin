import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// Local cache for parsed color conversions to ensure peak performance (O(1) after first lookup)
const colorCache = new Map<string, string>();

/**
 * Converts modern CSS colors (oklch, oklab) into legacy standard sRGB rgb/rgba format.
 * This utilizes an offscreen canvas in the browser (which native supports oklch/oklab) 
 * to parse and output compatible sRGB equivalents for html2canvas to safely parse.
 */
function convertOklchToRgb(colorStr: string): string {
  if (!colorStr) return colorStr;
  const cleanColor = colorStr.trim();
  if (!cleanColor.includes("oklch") && !cleanColor.includes("oklab")) {
    return colorStr;
  }

  if (colorCache.has(cleanColor)) {
    return colorCache.get(cleanColor)!;
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = cleanColor;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      const rgbStr = a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
      colorCache.set(cleanColor, rgbStr);
      return rgbStr;
    }
  } catch (err) {
    console.error("Failed to parse color using canvas utility:", cleanColor, err);
  }

  // Pure fallback logic in case canvas drawing is unavailable or errors
  if (cleanColor.includes("oklch") || cleanColor.includes("oklab")) {
    const lower = cleanColor.toLowerCase();
    if (lower.includes("0.99") || lower.includes("1 ")) return "rgb(255, 255, 255)";
    if (lower.includes("0.0") || lower.includes("0 ")) return "rgb(0, 0, 0)";
    return "rgb(100, 116, 139)"; // Slate
  }

  return cleanColor;
}

/**
 * Patches getComputedStyle in a given window context to automatically intercept
 * and replace modern oklch/oklab colors with legacy sRGB formats.
 */
function patchGetComputedStyle(win: any) {
  if (!win) return null;
  const originalGetComputedStyle = win.getComputedStyle;

  win.getComputedStyle = function (elt: any, pseudoElt: any) {
    const style = originalGetComputedStyle.call(this, elt, pseudoElt);
    if (!style) return style;

    return new Proxy(style, {
      get(target, prop, receiver) {
        const val = Reflect.get(target, prop, receiver);

        if (typeof val === "function") {
          if (prop === "getPropertyValue") {
            return function (propertyName: string) {
              const baseVal = target.getPropertyValue(propertyName);
              if (typeof baseVal === "string" && (baseVal.includes("oklch") || baseVal.includes("oklab"))) {
                return convertOklchToRgb(baseVal);
              }
              return baseVal;
            };
          }
          return val.bind(target);
        }

        if (typeof val === "string") {
          if (val.includes("oklch") || val.includes("oklab")) {
            return convertOklchToRgb(val);
          }
        }

        return val;
      }
    });
  };

  return originalGetComputedStyle;
}

/**
 * Captures an HTML element representing an A4 document and exports it as a high-fidelity PDF.
 * This helper bypasses iframe restrictions and excludes browser print header/footers.
 * 
 * @param elementId The id of the DOM element to export (e.g., 'medical-report-sheet')
 * @param filename The downloaded file name
 * @param onProgress Callback trigger for load indicators
 */
export async function downloadReportAsPDF(
  elementId: string,
  filename: string = "medical_report.pdf",
  onProgress?: (active: boolean) => void
) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`PDF Exporter: Element with ID "${elementId}" not found.`);
    return false;
  }

  if (onProgress) onProgress(true);

  // Buffer original styles to draw seamlessly
  const originalBoxShadow = element.style.boxShadow;
  const originalBorder = element.style.border;
  const originalFilter = element.style.filter;
  
  // Set clean layout for screenshot
  element.style.boxShadow = "none";
  element.style.border = "none";
  element.style.filter = "none";

  // Patch parent window getComputedStyle
  const originalParentCS = window.getComputedStyle;
  const restoreParent = patchGetComputedStyle(window);

  try {
    // Render HTML component onto visual Canvas
    const canvas = await html2canvas(element, {
      scale: 3.5, // Ultra sharp image quality for micro fonts and signatures
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: 794, // Lock context viewport standard width equivalent to A4 scale
      windowHeight: 1123,
      onclone: (clonedDoc) => {
        // Also patch the cloned window inside the iframe used by html2canvas
        if (clonedDoc.defaultView) {
          patchGetComputedStyle(clonedDoc.defaultView);
        }

        // Clean any raw stylesheet text of oklch / oklab functions
        try {
          const styleSheets = clonedDoc.querySelectorAll("style");
          styleSheets.forEach(styleTag => {
            let css = styleTag.innerHTML;
            if (css.includes("oklch") || css.includes("oklab")) {
              css = css.replace(/oklch\s*\([^)]+\)/g, (match) => {
                return convertOklchToRgb(match);
              });
              css = css.replace(/oklab\s*\([^)]+\)/g, (match) => {
                return convertOklchToRgb(match);
              });
              styleTag.innerHTML = css;
            }
          });
        } catch (e) {
          console.warn("Failed to sanitize cloned stylesheets direct text:", e);
        }
      }
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.98);

    // Initialise PDF with physical millimeters
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pdfWidth = pdf.internal.pageSize.getWidth(); // Should be exactly 210mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // Should be exactly 297mm

    // Draw the entire visual canvas onto the bounds of the A4 page
    pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight, undefined, "FAST");

    // File saver execution
    pdf.save(filename);
    
    return true;
  } catch (err) {
    console.error("PDF download failed in canvas engine:", err);
    return false;
  } finally {
    // Restore parent window's getComputedStyle
    if (restoreParent) {
      window.getComputedStyle = originalParentCS;
    }

    // Restore visual layout styles in view
    element.style.boxShadow = originalBoxShadow;
    element.style.border = originalBorder;
    
    // Do not restore the blur filter if it was active, to prevent the sheet from being stuck as blurred after downloading
    if (originalFilter && originalFilter !== "none" && !originalFilter.includes("blur")) {
      element.style.filter = originalFilter;
    } else {
      element.style.filter = "none";
    }
    
    if (onProgress) onProgress(false);
  }
}

