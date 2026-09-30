import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Exports a DOM element as a high quality PDF file with native OS save prompt
 * Supports File System Access API (Desktop Save As dialog) and Web Share API (Mobile Save to Files)
 */
export async function exportElementToPdf(
  element: HTMLElement,
  fileName: string = 'factor.pdf'
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

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidth = 210; // A4 standard width in mm
    const pageHeight = 297; // A4 standard height in mm
    const margin = 6; // mm margins
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
              description: 'فایل فاکتور PDF (پخش فرهودی)',
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
            title: 'فاکتور سفارش پخش فرهودی',
            text: `فاکتور رسمی ${cleanName.replace('.pdf', '')}`,
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
 */
export function printInvoiceDocument(element?: HTMLElement | null): void {
  try {
    const targetElement = element || document.getElementById('printable-invoice');
    if (!targetElement) {
      window.print();
      return;
    }

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

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="fa" dir="rtl">
        <head>
          <meta charset="utf-8" />
          <title>چاپ فاکتور رسمی پخش فرهودی</title>
          ${styleSheets}
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm;
            }
            body {
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
            .invoice-paper, #printable-invoice {
              width: 100% !important;
              max-width: none !important;
              box-shadow: none !important;
              border: none !important;
              margin: 0 !important;
              padding: 4mm !important;
              background: #ffffff !important;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            table {
              border-collapse: collapse !important;
              width: 100% !important;
            }
            th, td {
              border-color: #cbd5e1 !important;
            }
          </style>
        </head>
        <body>
          <div class="invoice-paper">
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
