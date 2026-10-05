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
 * Fixes blank page issues by ensuring proper layout viewport, embedded full Tailwind styles, and font-ready triggers.
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

    // Remove any previous print sandbox iframe
    const oldIframe = document.getElementById('invoice-print-sandbox');
    if (oldIframe && oldIframe.parentNode) {
      oldIframe.parentNode.removeChild(oldIframe);
    }

    // Dynamic Title for browser print dialog and default save name
    const docTitle = orderId ? `فاکتور ${orderId}` : 'فاکتور سفارش';
    const pageSize = paperSize === 'A5' ? 'A5' : 'A4';
    const minPageHeight = pageSize === 'A5' ? '210mm' : '297mm';

    // Create an isolated printable iframe attached inside the visible bounds (opacity: 0.001) so browser layout engine does not cull it
    const iframe = document.createElement('iframe');
    iframe.id = 'invoice-print-sandbox';
    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.width = '100vw';
    iframe.style.height = '100vh';
    iframe.style.border = 'none';
    iframe.style.zIndex = '-99999';
    iframe.style.opacity = '0.001';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    // Collect all existing stylesheets from host document
    const styleSheets = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((node) => node.outerHTML)
      .join('\n');

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
              margin: 0mm;
            }
            /* Neutralize any copied visibility:hidden rules from host @media print */
            *, *::before, *::after {
              box-sizing: border-box !important;
            }
            body, body * {
              visibility: visible !important;
            }
            #printable-invoice, #printable-invoice *,
            .print-root, .print-root *,
            .invoice-document-root, .invoice-document-root *,
            .invoice-page-sheet, .invoice-page-sheet * {
              visibility: visible !important;
              opacity: 1 !important;
            }
            html, body {
              background-color: #ffffff !important;
              background: #ffffff !important;
              color: #0f172a !important;
              font-family: 'Vazirmatn', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
              direction: rtl !important;
              text-align: right !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .print-root, #printable-invoice {
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              display: block !important;
            }
            .invoice-document-root {
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
            }
            .invoice-page-sheet {
              box-sizing: border-box !important;
              width: ${pageSize === 'A5' ? '148mm' : '210mm'} !important;
              min-width: ${pageSize === 'A5' ? '148mm' : '210mm'} !important;
              max-width: ${pageSize === 'A5' ? '148mm' : '210mm'} !important;
              height: ${minPageHeight} !important;
              min-height: ${minPageHeight} !important;
              max-height: ${minPageHeight} !important;
              padding: 10mm 12mm 14mm 12mm !important;
              margin: 0 auto !important;
              box-shadow: none !important;
              border: none !important;
              border-radius: 0 !important;
              page-break-after: always !important;
              break-after: page !important;
              position: relative !important;
              background-color: #ffffff !important;
              color: #0f172a !important;
              overflow: hidden !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
            }
            .invoice-page-sheet:last-of-type {
              page-break-after: auto !important;
              break-after: auto !important;
            }
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
            table.items-table th, table.items-table td {
              border-color: #cbd5e1 !important;
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
            /* Self-contained utility styles ensuring layout even if Tailwind stylesheet is detached */
            .flex { display: flex !important; }
            .flex-col { flex-direction: column !important; }
            .flex-1 { flex: 1 1 0% !important; }
            .flex-row-reverse { flex-direction: row-reverse !important; }
            .items-center { align-items: center !important; }
            .justify-between { justify-content: space-between !important; }
            .justify-center { justify-content: center !important; }
            .grid { display: grid !important; }
            .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; }
            .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
            .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
            .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
            .gap-1 { gap: 0.25rem !important; }
            .gap-1\\.5 { gap: 0.375rem !important; }
            .gap-2 { gap: 0.5rem !important; }
            .gap-2\\.5 { gap: 0.625rem !important; }
            .gap-3 { gap: 0.75rem !important; }
            .gap-4 { gap: 1rem !important; }
            .gap-x-2 { column-gap: 0.5rem !important; }
            .gap-x-2\\.5 { column-gap: 0.625rem !important; }
            .gap-y-1 { row-gap: 0.25rem !important; }
            .gap-y-1\\.5 { row-gap: 0.375rem !important; }
            .w-full { width: 100% !important; }
            .w-8 { width: 2rem !important; }
            .w-12 { width: 3rem !important; }
            .w-16 { width: 4rem !important; }
            .w-20 { width: 5rem !important; }
            .w-24 { width: 6rem !important; }
            .w-28 { width: 7rem !important; }
            .w-32 { width: 8rem !important; }
            .h-12 { height: 3rem !important; }
            .h-16 { height: 4rem !important; }
            .h-20 { height: 5rem !important; }
            .h-24 { height: 6rem !important; }
            .p-1 { padding: 0.25rem !important; }
            .p-1\\.5 { padding: 0.375rem !important; }
            .p-2 { padding: 0.5rem !important; }
            .p-2\\.5 { padding: 0.625rem !important; }
            .p-3 { padding: 0.75rem !important; }
            .p-3\\.5 { padding: 0.875rem !important; }
            .p-4 { padding: 1rem !important; }
            .py-0\\.5 { padding-top: 0.125rem !important; padding-bottom: 0.125rem !important; }
            .py-1 { padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }
            .py-1\\.5 { padding-top: 0.375rem !important; padding-bottom: 0.375rem !important; }
            .py-2 { padding-top: 0.5rem !important; padding-bottom: 0.5rem !important; }
            .px-1 { padding-left: 0.25rem !important; padding-right: 0.25rem !important; }
            .px-1\\.5 { padding-left: 0.375rem !important; padding-right: 0.375rem !important; }
            .px-2 { padding-left: 0.5rem !important; padding-right: 0.5rem !important; }
            .px-2\\.5 { padding-left: 0.625rem !important; padding-right: 0.625rem !important; }
            .px-3 { padding-left: 0.75rem !important; padding-right: 0.75rem !important; }
            .m-0 { margin: 0 !important; }
            .mb-1 { margin-bottom: 0.25rem !important; }
            .mb-1\\.5 { margin-bottom: 0.375rem !important; }
            .mb-2 { margin-bottom: 0.5rem !important; }
            .mb-3 { margin-bottom: 0.75rem !important; }
            .mt-1 { margin-top: 0.25rem !important; }
            .mt-1\\.5 { margin-top: 0.375rem !important; }
            .mt-2 { margin-top: 0.5rem !important; }
            .mt-2\\.5 { margin-top: 0.625rem !important; }
            .mt-3 { margin-top: 0.75rem !important; }
            .border { border-width: 1px !important; border-style: solid !important; border-color: #cbd5e1 !important; }
            .border-2 { border-width: 2px !important; border-style: solid !important; }
            .border-b { border-bottom-width: 1px !important; border-bottom-style: solid !important; }
            .border-b-2 { border-bottom-width: 2px !important; border-bottom-style: solid !important; }
            .border-t { border-top-width: 1px !important; border-top-style: solid !important; }
            .border-t-2 { border-top-width: 2px !important; border-top-style: solid !important; }
            .border-l { border-left-width: 1px !important; border-left-style: solid !important; }
            .border-slate-200 { border-color: #e2e8f0 !important; }
            .border-slate-300 { border-color: #cbd5e1 !important; }
            .border-slate-400 { border-color: #94a3b8 !important; }
            .border-slate-800 { border-color: #1e293b !important; }
            .border-dashed { border-style: dashed !important; }
            .rounded { border-radius: 0.25rem !important; }
            .rounded-md { border-radius: 0.375rem !important; }
            .rounded-lg { border-radius: 0.5rem !important; }
            .rounded-xl { border-radius: 0.75rem !important; }
            .bg-white { background-color: #ffffff !important; }
            .bg-slate-50 { background-color: #f8fafc !important; }
            .bg-slate-50\\/40, .bg-slate-50\\/50 { background-color: #f8fafc !important; }
            .bg-slate-100, .bg-slate-100\\/80, .bg-slate-100\\/90 { background-color: #f1f5f9 !important; }
            .bg-blue-50, .bg-blue-50\\/60 { background-color: #eff6ff !important; }
            .text-slate-950 { color: #020617 !important; }
            .text-slate-900 { color: #0f172a !important; }
            .text-slate-800 { color: #1e293b !important; }
            .text-slate-700 { color: #334155 !important; }
            .text-slate-600 { color: #475569 !important; }
            .text-slate-500 { color: #64748b !important; }
            .text-slate-400 { color: #94a3b8 !important; }
            .text-blue-700 { color: #1d4ed8 !important; }
            .text-blue-900 { color: #1e3a8a !important; }
            .text-blue-950 { color: #172554 !important; }
            .text-emerald-700 { color: #047857 !important; }
            .font-normal { font-weight: 400 !important; }
            .font-medium { font-weight: 500 !important; }
            .font-bold { font-weight: 700 !important; }
            .font-extrabold { font-weight: 800 !important; }
            .font-black { font-weight: 900 !important; }
            .text-center { text-align: center !important; }
            .text-right { text-align: right !important; }
            .text-left { text-align: left !important; }
            .text-\\[9\\.5px\\] { font-size: 9.5px !important; }
            .text-\\[10px\\] { font-size: 10px !important; }
            .text-\\[10\\.5px\\] { font-size: 10.5px !important; }
            .text-\\[11px\\] { font-size: 11px !important; }
            .text-\\[11\\.5px\\] { font-size: 11.5px !important; }
            .text-\\[12px\\] { font-size: 12px !important; }
            .text-\\[12\\.5px\\] { font-size: 12.5px !important; }
            .text-xs { font-size: 0.75rem !important; line-height: 1rem !important; }
            .text-sm { font-size: 0.875rem !important; line-height: 1.25rem !important; }
            .text-base { font-size: 1rem !important; line-height: 1.5rem !important; }
            .text-lg { font-size: 1.125rem !important; line-height: 1.75rem !important; }
            .text-xl { font-size: 1.25rem !important; line-height: 1.75rem !important; }
            .text-2xl { font-size: 1.5rem !important; line-height: 2rem !important; }
            .space-y-1 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.25rem !important; }
            .space-y-1\\.5 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.375rem !important; }
            .space-y-2 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.5rem !important; }
            .divide-y > :not([hidden]) ~ :not([hidden]) { border-top-width: 1px !important; border-top-style: solid !important; border-color: #cbd5e1 !important; }
            .truncate { overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
            .shrink-0 { flex-shrink: 0 !important; }
            .dir-ltr { direction: ltr !important; text-align: left !important; }
          </style>
        </head>
        <body>
          <div id="printable-invoice" class="print-root">
            ${targetElement.innerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();

    // Helper: wait for all images inside iframe document to load
    const waitForImages = (docTarget: Document): Promise<void> => {
      const images = Array.from(docTarget.querySelectorAll('img'));
      if (images.length === 0) return Promise.resolve();
      const promises = images.map((img) => {
        if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
      });
      return Promise.all(promises).then(() => {});
    };

    // Trigger printing once fonts, images, and content are fully ready
    const executePrint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Iframe print error, falling back to window.print():', err);
        window.print();
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 10000);
      }
    };

    const prepareAndPrint = async () => {
      try {
        if (iframe.contentDocument?.fonts?.ready) {
          await iframe.contentDocument.fonts.ready.catch(() => {});
        }
        if (iframe.contentDocument) {
          await waitForImages(iframe.contentDocument);
        }
        // Wait two animation frames for complete style calculation
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        setTimeout(executePrint, 150);
      } catch (err) {
        console.warn('Asset wait error, printing directly:', err);
        setTimeout(executePrint, 300);
      }
    };

    prepareAndPrint();
  } catch (error) {
    console.error('Error during printing:', error);
    window.print();
  }
}
