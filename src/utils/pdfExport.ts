import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Exports a DOM element as a high quality PDF file
 */
export async function exportElementToPdf(
  element: HTMLElement,
  fileName: string = 'factor.pdf'
): Promise<boolean> {
  try {
    // Ensure all images are loaded
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

    // Render DOM node to high-res canvas (scale 2.5 for crisp text)
    const canvas = await html2canvas(element, {
      scale: 2.5,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: element.scrollWidth,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidth = 210; // A4 standard width in mm
    const pageHeight = 297; // A4 standard height in mm
    const margin = 5; // mm margins
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

    // Multi-page handling if invoice is long
    while (heightLeft > 0) {
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
    pdf.save(cleanName);
    return true;
  } catch (error) {
    console.error('Error exporting invoice to PDF:', error);
    return false;
  }
}

/**
 * Triggers paper printing for invoice
 */
export function printInvoiceDocument(): void {
  window.print();
}
