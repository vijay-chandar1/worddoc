let editorInstance;

// Initialize CKEditor with event listener to store changes
ClassicEditor
    .create(document.querySelector('#ckeditor'), {
        toolbar: [
            'heading', '|', 'bold', 'italic', '|',
            'bulletedList', 'numberedList', 'blockQuote', '|',
            'insertTable', 'tableColumn', 'tableRow', 'mergeTableCells', '|',
            'undo', 'redo'
        ],
        table: {
            contentToolbar: [
                'tableColumn', 'tableRow', 'mergeTableCells'
            ]
        }
    })
    .then(editor => {
        editorInstance = editor;

        // Set up auto-save to local storage on data change
        editor.model.document.on('change:data', () => {
            const editorContent = editorInstance.getData();
            localStorage.setItem("editorContent", editorContent);
        });

        // Load editor content from local storage if available
        const savedEditorContent = localStorage.getItem("editorContent");
        if (savedEditorContent) {
            editorInstance.setData(savedEditorContent);
        }
    })
    .catch(error => {
        console.error('Error initializing CKEditor:', error);
    });

// Load saved viewer content if available
const viewer = document.getElementById('documentViewer');
const savedViewerContent = localStorage.getItem("viewerContent");
if (savedViewerContent) {
    viewer.srcdoc = savedViewerContent; // Use srcdoc for inline HTML content
}

function exportToPDF() {
    const editorContent = editorInstance.getData();
    const pdf = new jspdf.jsPDF('p', 'mm', 'a4');
    pdf.setFont("NotoSans-Regular", "normal");

    const authorName = document.getElementById("authorName").value;

    // Get the current date and time in IST format
    const currentISTTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    const parser = new DOMParser();
    const doc = parser.parseFromString(editorContent, 'text/html');
    const tables = doc.querySelectorAll('table');

    if (tables.length === 0) {
        alert('No tables found to export.');
        return;
    }

    // First draw the table content without footer
    tables.forEach((table, index) => {
        const body = [];
        const header = [];

        table.querySelectorAll('thead th').forEach(th => {
            header.push(th.innerText);
        });

        table.querySelectorAll('tbody tr').forEach(tr => {
            const row = [];
            tr.querySelectorAll('td').forEach(td => {
                row.push(td.innerText);
            });
            body.push(row);
        });

        pdf.autoTable({
            head: [header],
            body: body,
            startY: index === 0 ? 10 : pdf.autoTable.previous.finalY + 10,
            styles: {
                font: 'NotoSans-Regular',
                lineWidth: 0.1,
                lineColor: [0, 0, 0]
            },
            tableLineWidth: 0.1,
            tableLineColor: [0, 0, 0],
            theme: 'grid',
            columnStyles: {
                0: { cellWidth: 10 }, 
                1: { cellWidth: 10 },  
                2: { cellWidth: 45 },  
                3: { cellWidth: 75 },  
                4: { cellWidth: 20 },  
            }
        });
    });

    // Get total number of pages after content is drawn
    const totalPages = pdf.internal.getNumberOfPages();

    // Add footer with correct page numbers on every page
    for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);  // Go to the specified page
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        // Add timestamp (left)
        pdf.setFontSize(10);
        pdf.text(`Generated: ${currentISTTime}`, 10, pageHeight - 10);

        // Add page number (center)
        pdf.text(`Page ${i}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

        // Add author name (right) if provided
        if (authorName) {
            pdf.text(`Author: ${authorName}`, pageWidth - 40, pageHeight - 10);
        }
    }

    // Finally, save the PDF
    pdf.save('document.pdf');
}

function uploadDocument() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    if (!file) {
        alert("Please select a file.");
        return;
    }

    const formData = new FormData();
    formData.append('document', file);

    document.getElementById('loadingSpinner').style.display = 'block';

    let loadingText = document.getElementById('loadingText');
    const timeouts = [];

    timeouts.push(setTimeout(() => {
        loadingText.textContent = "Opening document... Please wait.";
    }, 10000));
    timeouts.push(setTimeout(() => {
        loadingText.textContent = "Analyzing document... Please wait.";
    }, 20000));
    timeouts.push(setTimeout(() => {
        loadingText.textContent = "Parsing pages... Please wait.";
    }, 30000));

    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert(data.error);
        } else {
            const viewer = document.getElementById('documentViewer');
            viewer.src = data.html_url;

            fetch(data.html_url)
                .then(response => response.text())
                .then(documentHtml => {
                    console.log("Document HTML fetched:", documentHtml);

                    localStorage.setItem("viewerContent", documentHtml);

                    viewer.srcdoc = documentHtml;

                    const parser = new DOMParser();
                    const doc = parser.parseFromString(documentHtml, 'text/html');
                    let tables = Array.from(doc.querySelectorAll('table'));

                    const mergedTables = [];
                    const tableGroups = new Map();

                    tables.forEach((table) => {
                        const rows = Array.from(table.rows);
                        if (rows.length === 0) return;

                        const columnCount = rows[0].cells.length;
                        if (columnCount <= 3) {
                            // Skip tables with 3 or fewer columns
                            return;
                        }

                        const headerRow = rows[0].innerHTML;
                        const key = `${columnCount}_${headerRow}`;

                        if (!tableGroups.has(key)) {
                            tableGroups.set(key, {
                                header: headerRow,
                                rows: []
                            });
                        }

                        rows.forEach((row, rowIndex) => {
                            if (rowIndex !== 0 || row.innerHTML !== headerRow) {
                                const cells = Array.from(row.cells);
                                if (cells[0] && cells[0].textContent.trim() === "") {
                                    // Merge with the previous row if the first cell is empty
                                    const previousRow = tableGroups.get(key).rows[tableGroups.get(key).rows.length - 1];
                                    if (previousRow) {
                                        cells.forEach((cell, cellIndex) => {
                                            if (cellIndex > 0) {
                                                previousRow.cells[cellIndex].innerHTML += `<br>${cell.innerHTML}`;
                                            }
                                        });
                                    }
                                } else {
                                    // Otherwise, add the row as-is
                                    tableGroups.get(key).rows.push(row.cloneNode(true));
                                }
                            }
                        });
                    });

                    tableGroups.forEach((group) => {
                        const mergedTable = document.createElement('table');
                        const thead = document.createElement('thead');
                        thead.innerHTML = `<tr>${group.header}</tr>`;
                        mergedTable.appendChild(thead);

                        const tbody = document.createElement('tbody');
                        group.rows.forEach(row => tbody.appendChild(row));
                        mergedTable.appendChild(tbody);

                        mergedTables.push(mergedTable.outerHTML);
                    });

                    // Combine all merged tables into the editor
                    editorInstance.setData(mergedTables.join("<br><br>"));

                    document.getElementById('loadingSpinner').style.display = 'none';
                    timeouts.forEach(timeout => clearTimeout(timeout));
                })
                .catch(err => {
                    console.error("Error parsing document:", err);
                    alert("Error parsing document content.");
                    document.getElementById('loadingSpinner').style.display = 'none';
                    timeouts.forEach(timeout => clearTimeout(timeout));
                });
        }
    })
    .catch(error => {
        console.error("Error uploading the document:", error);
        alert("Error uploading the document.");
        document.getElementById('loadingSpinner').style.display = 'none';
        timeouts.forEach(timeout => clearTimeout(timeout));
    });
}