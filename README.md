How to Run
Download and extract LocalPDF-Studio.zip.

Online / First-time mode: Double-click index.html. It checks for local vendor libraries; if missing, it automatically loads from CDN.

Strict Air-Gapped Mode (100% Offline):
Download these 4 JS files once and place them directly in the vendor/ subfolder:

pdf-lib.min.js: [https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js](https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js)

pdf.min.js: [https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js](https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js)

pdf.worker.min.js: [https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js](https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js)

jszip.min.js: [https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js](https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js)

Turn off all network connections. The header indicator will display: 🟢 Engine: Ready (Offline).