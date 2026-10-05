import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Exports a DOM element as a high quality PDF file with native OS save prompt
 * Supports File System Access API (Desktop Save As dialog) and Web Share API (Mobile Save to Files)
 */
export async function exportElementToPdf(
  element: HTMLElement,
  fileName: string = 'factor.pdf',
  paperSize: 'A4' | 'A5' = 'A4'
): Promise<boolean> {
  try {
    // 1. Ensure all images are loaded (with 1s timeout to prevent hanging)
    const images = Array.from(element.querySelectorAll('img'));
    await Promise.all(
      images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          const timeout = setTimeout(resolve, 800);
          img.onload = () => {
            clearTimeout(timeout);
            resolve(true);
          };
          img.onerror = () => {
            clearTimeout(timeout);
            resolve(false);
          };
        });
      })
    );

    // 2. Clone or prepare element for clean canvas snapshot
    const canvas = await html2canvas(element, {
      scale: 2, // High-DPI crisp quality
      useCORS: true,
      allowTaint: false, // Critical: must be false so toDataURL does NOT throw SecurityError
      backgroundColor: '#ffffff',
      logging: false,
      scrollX: 0,
      scrollY: 0,
      imageTimeout: 1000,
    });

    let imgData: string;
    try {
      imgData = canvas.toDataURL('image/jpeg', 0.95);
    } catch {
      imgData = canvas.toDataURL('image/png');
    }

    const isA5 = paperSize.toLowerCase() === 'a5';
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: isA5 ? 'a5' : 'a4',
      compress: true,
    });

    const pageWidth = isA5 ? 148 : 210; // mm standard width
    const pageHeight = isA5 ? 210 : 297; // mm standard height
    const margin = 10; // 10mm standard margins
    const contentWidth = pageWidth - margin * 2;
    const contentHeight = (canvas.height * contentWidth) / canvas.width;

    let heightLeft = contentHeight;
    let position = margin;

    // First page
    pdf.addImage(
      imgData,
      'JPEG',
      margin,
      position,
      contentWidth,
      contentHeight,
      undefined,
      'FAST'
    );
    heightLeft -= (pageHeight - margin * 2);

    // Multi-page handling if invoice has dozens of rows
    while (heightLeft > 5) {
      position = heightLeft - contentHeight + margin;
      pdf.addPage();
      pdf.addImage(
        imgData,
        'JPEG',
        margin,
        position,
        contentWidth,
        contentHeight,
        undefined,
        'FAST'
      );
      heightLeft -= (pageHeight - margin * 2);
    }

    const cleanName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    const pdfBlob = pdf.output('blob');
    let savedSuccessfully = false;

    const isInsideIframe = typeof window !== 'undefined' && window.self !== window.top;

    // 3. Desktop Native "Save As" Dialog (Chrome, Edge on Windows/Mac outside iframe)
    if (!isInsideIframe && typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: cleanName,
          types: [
            {
              description: 'فایل فاکتور PDF',
              accept: { 'application/pdf': ['.pdf'] },
            },
          ],
        });
        const writableStream = await fileHandle.createWritable();
        await writableStream.write(pdfBlob);
        await writableStream.close();
        savedSuccessfully = true;
      } catch (pickerErr: any) {
        if (pickerErr?.name === 'AbortError') {
          return true;
        }
        console.warn('Native file picker blocked or failed, trying fallback...', pickerErr);
      }
    }

    // 4. Mobile Native Share/Save Sheet (Android/iOS Save to Files / Downloads)
    if (!savedSuccessfully && !isInsideIframe && typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
      try {
        const pdfFile = new File([pdfBlob], cleanName, {
          type: 'application/pdf',
        });
        if (navigator.canShare({ files: [pdfFile] })) {
          await navigator.share({
            title: 'فاکتور سفارش',
            text: cleanName.replace('.pdf', ''),
            files: [pdfFile],
          });
          savedSuccessfully = true;
        }
      } catch (shareErr: any) {
        if (shareErr?.name === 'AbortError') {
          return true;
        }
        console.warn('Navigator share blocked or failed, trying fallback...', shareErr);
      }
    }

    // 5. Universal Standard Download Fallback (Creates genuine browser download prompt)
    if (!savedSuccessfully) {
      const blobUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = cleanName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        URL.revokeObjectURL(blobUrl);
      }, 3000);
      savedSuccessfully = true;
    }

    return true;
  } catch (error) {
    console.warn('Direct PDF canvas generation encountered issue, opening print/save-as-pdf dialog:', error);
    try {
      printInvoiceDocument(element);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Isolated Paper Printing Utility
 * Creates a clean isolated printing sandbox so background app screens and dashboard pages are NOT printed!
 * Uses standard wrapper table (thead/tfoot) to preserve 10mm margins on all pages with @page { margin: 0; }
 */
export function printInvoiceDocument(
  element?: HTMLElement | null,
  orderId?: string,
  paperSize: 'A4' | 'A5' = 'A4'
): void {
  try {
    const targetElement = element || document.getElementById('printable-invoice');
    if (!targetElement) {
      window.print();
      return;
    }

    // Dynamic Title for browser print dialog and default save name
    const docTitle = orderId ? `فاکتور ${orderId}` : 'فاکتور سفارش';

    // Create an isolated hidden iframe for printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    // Collect all existing stylesheets to maintain font & design rendering
    const styleSheets = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((node) => node.outerHTML)
      .join('\n');

    const pageSize = paperSize === 'A5' ? 'A5' : 'A4';

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="fa" dir="rtl">
        <head>
          <meta charset="utf-8" />
          <title>${docTitle}</title>
          ${styleSheets}
          <style>
            @page {
              size: ${pageSize} portrait;
              margin: 0; /* Suppresses browser auto headers and footers (URL, dates) */
            }
            *, *::before, *::after {
              box-sizing: border-box !important;
            }
            html, body {
              background-color: #ffffff !important;
              color: #0f172a !important;
              font-family: 'Vazirmatn', system-ui, -apple-system, sans-serif !important;
              direction: rtl !important;
              text-align: right !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .invoice-page-sheet {
              box-sizing: border-box !important;
              width: 100% !important;
              max-width: 100% !important;
              min-height: ${pageSize === 'A5' ? '210mm' : '297mm'} !important;
              padding: 10mm !important;
              margin: 0 !important;
              box-shadow: none !important;
              border: none !important;
              border-radius: 0 !important;
              page-break-after: always !important;
              break-after: page !important;
              position: relative !important;
              background-color: #ffffff !important;
            }
            .invoice-page-sheet:last-of-type {
              page-break-after: auto !important;
              break-after: auto !important;
            }
            /* Repeat table headers on multi-page invoices */
            table.items-table {
              width: 100% !important;
              border-collapse: collapse !important;
            }
            table.items-table thead {
              display: table-header-group !important;
            }
            table.items-table tr {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
            .break-inside-avoid, .print-avoid-break {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
            .num-fa {
              font-family: 'Vazirmatn', system-ui, sans-serif !important;
              font-variant-numeric: normal !important;
              font-feature-settings: normal !important;
              letter-spacing: 0 !important;
              word-spacing: 0 !important;
            }
          </style>
        </head>
        <body>
          <div class="print-root">
            ${targetElement.innerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();

    // Trigger print once content and fonts are ready
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Iframe print error, falling back to window.print', err);
        window.print();
      } finally {
        // Clean up iframe after a small delay
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 3000);
      }
    }, 400);
  } catch (error) {
    console.error('Error during printing:', error);
    window.print();
  }
}
