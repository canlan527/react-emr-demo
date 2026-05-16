import { renderRichTextDocumentPrintPages } from '../layout/richTextPrintPages';
import type { RichTextDocument } from '../richTypes';

const a4WidthPt = 595.28;
const a4HeightPt = 841.89;

type PdfObject = string | Uint8Array;

function encodeAscii(value: string) {
  return new TextEncoder().encode(value);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function concatBytes(parts: Uint8Array[]) {
  const totalLength = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });

  return result;
}

function createObjectBytes(content: PdfObject) {
  return typeof content === 'string' ? encodeAscii(content) : content;
}

function buildPdf(objects: PdfObject[]) {
  const chunks: Uint8Array[] = [encodeAscii('%PDF-1.4\n')];
  const offsets: number[] = [0];
  let byteOffset = chunks[0].length;

  objects.forEach((object, index) => {
    offsets.push(byteOffset);

    const header = encodeAscii(`${index + 1} 0 obj\n`);
    const body = createObjectBytes(object);
    const footer = encodeAscii('\nendobj\n');
    chunks.push(header, body, footer);
    byteOffset += header.length + body.length + footer.length;
  });

  const xrefOffset = byteOffset;
  const xrefRows = offsets
    .map((offset, index) => (index === 0 ? '0000000000 65535 f \n' : `${String(offset).padStart(10, '0')} 00000 n \n`))
    .join('');
  chunks.push(
    encodeAscii(
      [
        `xref\n0 ${objects.length + 1}\n`,
        xrefRows,
        `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`,
        `startxref\n${xrefOffset}\n%%EOF`,
      ].join(''),
    ),
  );

  return concatBytes(chunks);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('PDF 页图加载失败'));
    image.src = src;
  });
}

async function pageImageToJpeg(pageSrc: string) {
  const image = await loadImage(pageSrc);
  const canvas = window.document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('无法创建 PDF 图片画布');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);

  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.98);
  const jpegBase64 = jpegDataUrl.split(',')[1] ?? '';

  return {
    bytes: base64ToBytes(jpegBase64),
    height: canvas.height,
    width: canvas.width,
  };
}

export async function createRichTextDocumentPdfBlob(document: RichTextDocument) {
  const pages = renderRichTextDocumentPrintPages(document);
  const images = await Promise.all(pages.map((page) => pageImageToJpeg(page.src)));
  const pageObjectIds = images.map((_, index) => 3 + index * 3);
  const objects: PdfObject[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${images.length} >>`,
  ];

  images.forEach((image, index) => {
    const pageObjectId = 3 + index * 3;
    const contentObjectId = pageObjectId + 1;
    const imageObjectId = pageObjectId + 2;
    const imageName = `Im${index + 1}`;
    const content = `q\n${a4WidthPt} 0 0 ${a4HeightPt} 0 0 cm\n/${imageName} Do\nQ`;
    const imageHeader = encodeAscii(
      [
        `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height}`,
        '/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode',
        `/Length ${image.bytes.length} >>\nstream\n`,
      ].join(' '),
    );
    const imageFooter = encodeAscii('\nendstream');

    objects.push(
      [
        '<< /Type /Page',
        '/Parent 2 0 R',
        `/MediaBox [0 0 ${a4WidthPt} ${a4HeightPt}]`,
        `/Resources << /XObject << /${imageName} ${imageObjectId} 0 R >> >>`,
        `/Contents ${contentObjectId} 0 R`,
        '>>',
      ].join(' '),
      `<< /Length ${encodeAscii(content).length} >>\nstream\n${content}\nendstream`,
      concatBytes([imageHeader, image.bytes, imageFooter]),
    );
  });

  return new Blob([buildPdf(objects)], { type: 'application/pdf' });
}
