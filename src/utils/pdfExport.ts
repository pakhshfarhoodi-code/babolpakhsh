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
    // 1. Ensure all images are loaded
    const images = Array.from(element.querySelectorAll('img'));
    await Promise.all(
      images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      })
    );

    // 2. Clone or prepare element for clean canvas snapshot
    const canvas = await html2canvas(element, {
      scale: 2, // High-DPI crisp quality
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: 1024,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
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
    const folderPrefixedName = `فاکتورها_${cleanName}`;
    const pdfBlob = pdf.output('blob');

    // 3. Desktop Native "Save As" Dialog (Chrome, Edge, Windows/Mac)
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: folderPrefixedName,
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
        return true;
      } catch (pickerErr: any) {
        // If user cancelled, return gracefully
        if (pickerErr?.name === 'AbortError') {
          return true;
        }
        // Fallback to other save methods if rejected
      }
    }

    // 4. Mobile Native Share/Save Sheet (Android/iOS Save to Files / Downloads)
    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
      try {
        const pdfFile = new File([pdfBlob], folderPrefixedName, {
          type: 'application/pdf',
        });
        if (navigator.canShare({ files: [pdfFile] })) {
          await navigator.share({
            title: 'فاکتور سفارش پخش فرهودی',
            text: `فاکتور رسمی ${cleanName.replace('.pdf', '')}`,
            files: [pdfFile],
          });
          return true;
        }
      } catch (shareErr: any) {
        if (shareErr?.name === 'AbortError') {
          return true;
        }
        // Fallback to standard blob download
      }
    }

    // 5. Universal Standard Download Fallback
    const blobUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = folderPrefixedName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 1000);

    return true;
  } catch (error) {
    console.error('Error exporting invoice to PDF:', error);
    return false;
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
