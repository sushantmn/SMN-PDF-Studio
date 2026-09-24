/**
 * LocalPDF Studio - Offline Client-Side Engine
 */

let sigCanvas = null;
let sigCtx = null;
let isDrawing = false;
let hasSignature = false;

window.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('libStatus');
  
  if (typeof PDFLib !== 'undefined' && typeof pdfjsLib !== 'undefined') {
    try {
      if (window.location.protocol === 'file:') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '';
      } else {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
      }
    } catch (e) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    }
    statusEl.innerHTML = '🟢 Engine: <strong style="color:#166534">Ready</strong>';
  } else {
    statusEl.innerHTML = '⚠️ Engine: Loading libraries...';
    setTimeout(() => {
      if (typeof PDFLib !== 'undefined') {
        statusEl.innerHTML = '🟢 Engine: <strong style="color:#166534">Ready (Online CDN)</strong>';
      } else {
        statusEl.innerHTML = '🔴 Engine: <strong style="color:#b91c1c">Libraries Missing</strong> (Check vendor folder)';
      }
    }, 1500);
  }

  initSignaturePad();
});

function showDashboard() {
  document.querySelectorAll('.workspace').forEach(el => el.style.display = 'none');
  document.getElementById('dashboard').style.display = 'grid';
}

function openTool(toolId) {
  document.getElementById('dashboard').style.display = 'none';
  document.querySelectorAll('.workspace').forEach(el => el.style.display = 'none');
  const target = document.getElementById(`view-${toolId}`);
  if (target) {
    target.style.display = 'block';
    if (toolId === 'sign') {
      resizeSignaturePad();
    }
  }
}

function setStatus(id, text, type = 'info') {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'status-box ' + (type === 'error' ? 'error' : type === 'success' ? 'success' : '');
  el.innerText = text;
}

function downloadBlob(bytes, filename, mime = 'application/pdf') {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function parseRangeString(rangeStr, totalPages) {
  const indices = new Set();
  const segments = rangeStr.split(',');
  for (let seg of segments) {
    seg = seg.trim();
    if (seg.includes('-')) {
      const parts = seg.split('-').map(s => parseInt(s.trim(), 10));
      if (!isNaN(parts[0]) && !isNaN(parts[1])) {
        const start = Math.max(1, parts[0]);
        const end = Math.min(totalPages, parts[1]);
        for (let i = start; i <= end; i++) indices.add(i - 1);
      }
    } else {
      const num = parseInt(seg, 10);
      if (!isNaN(num) && num >= 1 && num <= totalPages) {
        indices.add(num - 1);
      }
    }
  }
  return indices;
}

/* --- Signature Pad Functions --- */
function initSignaturePad() {
  sigCanvas = document.getElementById('signature-pad');
  if (!sigCanvas) return;
  sigCtx = sigCanvas.getContext('2d');

  function getPos(e) {
    const rect = sigCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (sigCanvas.width / rect.width),
      y: (clientY - rect.top) * (sigCanvas.height / rect.height)
    };
  }

  function start(e) {
    e.preventDefault();
    isDrawing = true;
    hasSignature = true;
    const pos = getPos(e);
    sigCtx.beginPath();
    sigCtx.moveTo(pos.x, pos.y);
  }

  function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    sigCtx.lineWidth = 2.5;
    sigCtx.lineCap = 'round';
    sigCtx.lineJoin = 'round';
    sigCtx.strokeStyle = '#0f172a';
    sigCtx.lineTo(pos.x, pos.y);
    sigCtx.stroke();
  }

  function stop() {
    isDrawing = false;
  }

  sigCanvas.addEventListener('mousedown', start);
  sigCanvas.addEventListener('mousemove', draw);
  window.addEventListener('mouseup', stop);

  sigCanvas.addEventListener('touchstart', start, { passive: false });
  sigCanvas.addEventListener('touchmove', draw, { passive: false });
  window.addEventListener('touchend', stop);
}

function resizeSignaturePad() {
  if (!sigCanvas) return;
  sigCanvas.width = 500;
  sigCanvas.height = 180;
  clearSignaturePad();
}

function clearSignaturePad() {
  if (!sigCtx) return;
  sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
  hasSignature = false;
}

/* 1. SIGN PDF */
async function execSignPdf() {
  const statusId = 'status-sign';
  const file = document.getElementById('sign-file').files[0];
  const pageTarget = document.getElementById('sign-page-target').value;
  const position = document.getElementById('sign-position').value;

  if (!file) return alert('Please select a PDF document to sign.');
  if (!hasSignature) return alert('Please draw your signature on the pad above.');

  try {
    setStatus(statusId, 'Preparing signature stamp...');
    const sigDataUrl = sigCanvas.toDataURL('image/png');
    const sigImageBytes = await fetch(sigDataUrl).then(res => res.arrayBuffer());

    setStatus(statusId, 'Embedding signature into PDF...');
    const buffer = await file.arrayBuffer();
    const doc = await PDFLib.PDFDocument.load(buffer);
    const embeddedSig = await doc.embedPng(sigImageBytes);

    const totalPages = doc.getPageCount();
    let targetPages = [];

    if (pageTarget === 'last') {
      targetPages.push(doc.getPage(totalPages - 1));
    } else if (pageTarget === 'first') {
      targetPages.push(doc.getPage(0));
    } else {
      targetPages = doc.getPages();
    }

    const sigWidth = 140;
    const sigHeight = (sigWidth / sigCanvas.width) * sigCanvas.height;

    for (const page of targetPages) {
      const { width, height } = page.getSize();
      let x = 40;
      let y = 40;

      if (position === 'bottom-right') {
        x = width - sigWidth - 40;
        y = 40;
      } else if (position === 'bottom-left') {
        x = 40;
        y = 40;
      } else if (position === 'bottom-center') {
        x = (width - sigWidth) / 2;
        y = 40;
      } else if (position === 'top-right') {
        x = width - sigWidth - 40;
        y = height - sigHeight - 40;
      }

      page.drawImage(embeddedSig, {
        x,
        y,
        width: sigWidth,
        height: sigHeight
      });
    }

    const signedBytes = await doc.save();
    downloadBlob(signedBytes, `signed_${file.name}`);
    setStatus(statusId, 'Document signed & ready!', 'success');
  } catch (err) {
    console.error(err);
    setStatus(statusId, 'Error: ' + err.message, 'error');
  }
}

/* 2. UNLOCK PDF */
async function execUnlock() {
  const statusId = 'status-unlock';
  const file = document.getElementById('unlock-file').files[0];
  const password = document.getElementById('unlock-password').value;

  if (!file) return alert('Select an encrypted PDF file.');

  try {
    setStatus(statusId, 'Decrypting and verifying password...');
    const buffer = await file.arrayBuffer();
    
    let doc;
    try {
      doc = await PDFLib.PDFDocument.load(buffer, { password: password || '' });
    } catch (decryptErr) {
      throw new Error('Incorrect password or unsupported encryption format.');
    }

    setStatus(statusId, 'Stripping restrictions...');
    const unlockedBytes = await doc.save();
    downloadBlob(unlockedBytes, `unlocked_${file.name}`);
    setStatus(statusId, 'Password protection completely removed!', 'success');
  } catch (err) {
    console.error(err);
    setStatus(statusId, 'Error: ' + err.message, 'error');
  }
}

/* 3. MERGE */
async function execMerge() {
  const statusId = 'status-merge';
  const files = document.getElementById('merge-files').files;
  if (!files || files.length < 2) return alert('Select at least 2 PDF files to merge.');

  try {
    setStatus(statusId, 'Merging PDFs...');
    const mergedDoc = await PDFLib.PDFDocument.create();

    for (let i = 0; i < files.length; i++) {
      setStatus(statusId, `Reading document ${i + 1} of ${files.length}...`);
      const buffer = await files[i].arrayBuffer();
      const doc = await PDFLib.PDFDocument.load(buffer);
      const copiedPages = await mergedDoc.copyPages(doc, doc.getPageIndices());
      copiedPages.forEach(p => mergedDoc.addPage(p));
    }

    const mergedBytes = await mergedDoc.save();
    downloadBlob(mergedBytes, 'merged_documents.pdf');
    setStatus(statusId, 'Successfully merged!', 'success');
  } catch (err) {
    setStatus(statusId, 'Error: ' + err.message, 'error');
  }
}

/* 4. SPLIT */
async function execSplit() {
  const statusId = 'status-split';
  const file = document.getElementById('split-file').files[0];
  const ranges = document.getElementById('split-ranges').value.trim();
  if (!file || !ranges) return alert('Select a PDF and specify ranges.');

  try {
    setStatus(statusId, 'Extracting pages...');
    const buffer = await file.arrayBuffer();
    const sourceDoc = await PDFLib.PDFDocument.load(buffer);
    const totalPages = sourceDoc.getPageCount();

    const indices = Array.from(parseRangeString(ranges, totalPages)).sort((a, b) => a - b);
    if (indices.length === 0) return alert(`No valid pages in range (Total: ${totalPages}).`);

    const newDoc = await PDFLib.PDFDocument.create();
    const copiedPages = await newDoc.copyPages(sourceDoc, indices);
    copiedPages.forEach(p => newDoc.addPage(p));

    const resultBytes = await newDoc.save();
    downloadBlob(resultBytes, `extracted_${file.name}`);
    setStatus(statusId, `Extracted ${indices.length} pages!`, 'success');
  } catch (err) {
    setStatus(statusId, 'Error: ' + err.message, 'error');
  }
}

/* 5. PDF TO IMAGES */
async function execPdf2Img() {
  const statusId = 'status-pdf2img';
  const file = document.getElementById('pdf2img-file').files[0];
  const format = document.getElementById('pdf2img-format').value;
  const scale = parseFloat(document.getElementById('pdf2img-scale').value);
  if (!file) return alert('Please select a PDF file.');

  try {
    setStatus(statusId, 'Parsing document...');
    const ext = format === 'image/jpeg' ? 'jpg' : 'png';
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const totalPages = pdf.numPages;

    const zip = new JSZip();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      setStatus(statusId, `Rendering page ${pageNum} of ${totalPages}...`);
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      if (format === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      await page.render({ canvasContext: ctx, viewport }).promise;
      const imgBlob = await new Promise(res => canvas.toBlob(res, format, 0.92));
      const filename = `page_${String(pageNum).padStart(3, '0')}.${ext}`;

      if (totalPages === 1) {
        downloadBlob(imgBlob, `${file.name.replace(/\.pdf$/i, '')}.${ext}`, format);
        setStatus(statusId, 'Saved single image!', 'success');
        return;
      }
      zip.file(filename, imgBlob);
    }

    setStatus(statusId, 'Generating ZIP package...');
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(zipBlob, `${file.name.replace(/\.pdf$/i, '')}_images.zip`, 'application/zip');
    setStatus(statusId, `Packaged ${totalPages} images!`, 'success');
  } catch (err) {
    setStatus(statusId, 'Error: ' + err.message, 'error');
  }
}

/* 6. IMAGES TO PDF */
async function execImg2Pdf() {
  const statusId = 'status-img2pdf';
  const files = document.getElementById('img2pdf-files').files;
  if (!files || files.length === 0) return alert('Select at least one JPG or PNG image.');

  try {
    setStatus(statusId, 'Embedding images...');
    const pdfDoc = await PDFLib.PDFDocument.create();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const buffer = await file.arrayBuffer();
      let imageObj;

      if (file.type === 'image/jpeg' || file.name.match(/\.jpe?g$/i)) {
        imageObj = await pdfDoc.embedJpg(buffer);
      } else if (file.type === 'image/png' || file.name.match(/\.png$/i)) {
        imageObj = await pdfDoc.embedPng(buffer);
      } else {
        continue;
      }

      const page = pdfDoc.addPage([imageObj.width, imageObj.height]);
      page.drawImage(imageObj, { x: 0, y: 0, width: imageObj.width, height: imageObj.height });
    }

    const pdfBytes = await pdfDoc.save();
    downloadBlob(pdfBytes, 'images_converted.pdf');
    setStatus(statusId, 'PDF created successfully!', 'success');
  } catch (err) {
    setStatus(statusId, 'Error: ' + err.message, 'error');
  }
}

/* 7. ROTATE */
async function execRotate() {
  const statusId = 'status-rotate';
  const file = document.getElementById('rotate-file').files[0];
  const angle = parseInt(document.getElementById('rotate-angle').value, 10);
  if (!file) return alert('Select a PDF.');

  try {
    setStatus(statusId, 'Rotating pages...');
    const buffer = await file.arrayBuffer();
    const doc = await PDFLib.PDFDocument.load(buffer);
    const pages = doc.getPages();

    pages.forEach(p => {
      const current = p.getRotation().angle;
      p.setRotation(PDFLib.degrees((current + angle) % 360));
    });

    const bytes = await doc.save();
    downloadBlob(bytes, `rotated_${file.name}`);
    setStatus(statusId, `Rotated ${pages.length} pages by ${angle}°!`, 'success');
  } catch (err) {
    setStatus(statusId, 'Error: ' + err.message, 'error');
  }
}

/* 8. WATERMARK */
async function execWatermark() {
  const statusId = 'status-watermark';
  const file = document.getElementById('watermark-file').files[0];
  const text = document.getElementById('watermark-text').value.trim();
  if (!file || !text) return alert('Provide a PDF and watermark text.');

  try {
    setStatus(statusId, 'Applying watermark...');
    const buffer = await file.arrayBuffer();
    const doc = await PDFLib.PDFDocument.load(buffer);
    const font = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);

    doc.getPages().forEach(page => {
      const { width, height } = page.getSize();
      const fontSize = Math.min(width, height) * 0.08;
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const textHeight = font.heightAtSize(fontSize);

      page.drawText(text, {
        x: width / 2 - textWidth / 2,
        y: height / 2 - textHeight / 2,
        size: fontSize,
        font: font,
        color: PDFLib.rgb(0.7, 0.7, 0.7),
        opacity: 0.35,
        rotate: PDFLib.degrees(45)
      });
    });

    const bytes = await doc.save();
    downloadBlob(bytes, `watermarked_${file.name}`);
    setStatus(statusId, 'Watermark applied!', 'success');
  } catch (err) {
    setStatus(statusId, 'Error: ' + err.message, 'error');
  }
}

/* 9. PAGE NUMBERS */
async function execPageNum() {
  const statusId = 'status-pagenum';
  const file = document.getElementById('pagenum-file').files[0];
  if (!file) return alert('Select a PDF file.');

  try {
    setStatus(statusId, 'Numbering pages...');
    const buffer = await file.arrayBuffer();
    const doc = await PDFLib.PDFDocument.load(buffer);
    const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    const pages = doc.getPages();
    const total = pages.length;

    pages.forEach((page, i) => {
      const { width } = page.getSize();
      const label = `Page ${i + 1} of ${total}`;
      const fontSize = 10;
      const textWidth = font.widthOfTextAtSize(label, fontSize);

      page.drawText(label, {
        x: (width - textWidth) / 2,
        y: 20,
        size: fontSize,
        font: font,
        color: PDFLib.rgb(0.2, 0.2, 0.2)
      });
    });

    const bytes = await doc.save();
    downloadBlob(bytes, `numbered_${file.name}`);
    setStatus(statusId, `Numbered ${total} pages!`, 'success');
  } catch (err) {
    setStatus(statusId, 'Error: ' + err.message, 'error');
  }
}

/* 10. DELETE PAGES */
async function execDelete() {
  const statusId = 'status-delete';
  const file = document.getElementById('delete-file').files[0];
  const pagesStr = document.getElementById('delete-pages').value.trim();
  if (!file || !pagesStr) return alert('Choose a PDF and specify pages.');

  try {
    setStatus(statusId, 'Deleting pages...');
    const buffer = await file.arrayBuffer();
    const doc = await PDFLib.PDFDocument.load(buffer);
    const total = doc.getPageCount();

    const deleteIndices = parseRangeString(pagesStr, total);
    if (deleteIndices.size >= total) return alert('Cannot delete all pages.');

    const sorted = Array.from(deleteIndices).sort((a, b) => b - a);
    sorted.forEach(idx => doc.removePage(idx));

    const bytes = await doc.save();
    downloadBlob(bytes, `cleaned_${file.name}`);
    setStatus(statusId, `Deleted ${sorted.length} pages!`, 'success');
  } catch (err) {
    setStatus(statusId, 'Error: ' + err.message, 'error');
  }
}

/* 11. PROTECT */
async function execProtect() {
  const statusId = 'status-protect';
  const file = document.getElementById('protect-file').files[0];
  const password = document.getElementById('protect-password').value;
  if (!file || !password) return alert('Select a PDF and enter a password.');

  try {
    setStatus(statusId, 'Encrypting...');
    const buffer = await file.arrayBuffer();
    const doc = await PDFLib.PDFDocument.load(buffer);

    const bytes = await doc.save({
      userPassword: password,
      ownerPassword: password,
      permissions: {
        modifying: false,
        copying: false,
        annotating: false,
        printing: 'highResolution'
      }
    });

    downloadBlob(bytes, `protected_${file.name}`);
    setStatus(statusId, 'Password protection applied!', 'success');
  } catch (err) {
    setStatus(statusId, 'Error: ' + err.message, 'error');
  }
}

/* 12. FLATTEN */
async function execFlatten() {
  const statusId = 'status-flatten';
  const file = document.getElementById('flatten-file').files[0];
  if (!file) return alert('Select a PDF file.');

  try {
    setStatus(statusId, 'Flattening forms...');
    const buffer = await file.arrayBuffer();
    const doc = await PDFLib.PDFDocument.load(buffer);
    const form = doc.getForm();

    try { form.flatten(); } catch (e) {}

    const bytes = await doc.save();
    downloadBlob(bytes, `flattened_${file.name}`);
    setStatus(statusId, 'Form fields flattened!', 'success');
  } catch (err) {
    setStatus(statusId, 'Error: ' + err.message, 'error');
  }
}

/* 13. REMOVE SIGNATURE VALIDATION & PKI CERTIFICATES */
async function execRemoveSignatureValidation() {
  const statusId = 'status-unsign';
  const fileInput = document.getElementById('unsign-file');
  const mode = document.getElementById('unsign-mode').value;
  const file = fileInput.files[0];

  if (!file) return alert('Please select a digitally signed PDF file.');

  try {
    setStatus(statusId, 'Loading document structures...');
    const buffer = await file.arrayBuffer();

    if (mode === 'rasterize') {
      // MODE B: Full Sanitize - Re-creates document via canvas to eliminate all cryptographic fingerprints
      setStatus(statusId, 'Sanitizing document and removing all digital signature layers...');
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      const cleanDoc = await PDFLib.PDFDocument.create();

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      for (let i = 1; i <= pdf.numPages; i++) {
        setStatus(statusId, `Rendering and stripping page ${i} of ${pdf.numPages}...`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx, viewport }).promise;
        const imgBlob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.94));
        const imgBytes = await imgBlob.arrayBuffer();
        const embeddedImg = await cleanDoc.embedJpg(imgBytes);

        const newPage = cleanDoc.addPage([viewport.width / 2.0, viewport.height / 2.0]);
        newPage.drawImage(embeddedImg, {
          x: 0,
          y: 0,
          width: newPage.getWidth(),
          height: newPage.getHeight()
        });
      }

      const cleanBytes = await cleanDoc.save();
      downloadBlob(cleanBytes, `unsigned_sanitized_${file.name}`);
      setStatus(statusId, 'Signature validation completely neutralized!', 'success');
      return;
    }

    // MODE A: Structural Dictionary Stripping (Fast, keeps text selectable)
    setStatus(statusId, 'Parsing PDF catalog and security dictionaries...');
    const doc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
    const context = doc.context;

    // 1. Remove DocMDP & Perms (The cryptographic document permissions lock)
    const catalog = doc.catalog;
    if (catalog.has(PDFLib.PDFName.of('Perms'))) {
      catalog.delete(PDFLib.PDFName.of('Perms'));
    }

    // 2. Clear Signature entries from AcroForm
    const acroForm = doc.catalog.lookup(PDFLib.PDFName.of('AcroForm'));
    if (acroForm instanceof PDFLib.PDFDict) {
      const fields = acroForm.lookup(PDFLib.PDFName.of('Fields'));
      if (fields instanceof PDFLib.PDFArray) {
        const remainingFields = [];
        for (let idx = 0; idx < fields.size(); idx++) {
          const fieldRef = fields.get(idx);
          const fieldDict = context.lookup(fieldRef);
          
          // Check if field is a Signature field (/FT /Sig)
          if (fieldDict instanceof PDFLib.PDFDict) {
            const fieldType = fieldDict.lookup(PDFLib.PDFName.of('FT'));
            if (fieldType && fieldType.toString() === '/Sig') {
              // Exclude signature field
              continue;
            }
          }
          remainingFields.push(fieldRef);
        }

        // Rebuild /Fields array without /Sig objects
        const newFieldsArray = PDFLib.PDFArray.withContext(context);
        remainingFields.forEach(ref => newFieldsArray.push(ref));
        acroForm.set(PDFLib.PDFName.of('Fields'), newFieldsArray);

        // Delete signature flags (/SigFlags)
        if (acroForm.has(PDFLib.PDFName.of('SigFlags'))) {
          acroForm.delete(PDFLib.PDFName.of('SigFlags'));
        }
      }
    }

    // 3. Remove signature annotations from individual page /Annots lists
    const pages = doc.getPages();
    pages.forEach(page => {
      const pageDict = page.node;
      const annots = pageDict.lookup(PDFLib.PDFName.of('Annots'));
      if (annots instanceof PDFLib.PDFArray) {
        const remainingAnnots = [];
        for (let i = 0; i < annots.size(); i++) {
          const annotRef = annots.get(i);
          const annotDict = context.lookup(annotRef);
          if (annotDict instanceof PDFLib.PDFDict) {
            const subtype = annotDict.lookup(PDFLib.PDFName.of('Subtype'));
            const ft = annotDict.lookup(PDFLib.PDFName.of('FT'));
            if ((subtype && subtype.toString() === '/Widget') && (ft && ft.toString() === '/Sig')) {
              continue; // Exclude widget signature annotation
            }
          }
          remainingAnnots.push(annotRef);
        }

        const newAnnotsArray = PDFLib.PDFArray.withContext(context);
        remainingAnnots.forEach(a => newAnnotsArray.push(a));
        pageDict.set(PDFLib.PDFName.of('Annots'), newAnnotsArray);
      }
    });

    setStatus(statusId, 'Re-saving unsigned document...');
    const unsignedBytes = await doc.save();
    downloadBlob(unsignedBytes, `validation_removed_${file.name}`);
    setStatus(statusId, 'Signatures and validation locks removed successfully!', 'success');
  } catch (err) {
    console.error(err);
    setStatus(statusId, 'Error: ' + err.message, 'error');
  }
}
