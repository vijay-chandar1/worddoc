let editorInstance;

// Initialize CKEditor
ClassicEditor
    .create(document.querySelector('#ckeditor'), {
        toolbar: [
            'heading', '|', 'bold', 'italic', 'underline', 'strikethrough', '|',
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
    })
    .catch(error => {
        console.error('Error initializing CKEditor:', error);
    });

function exportToPDF() {
    // Get CKEditor content as HTML
    const editorContent = editorInstance.getData();

    // Initialize jsPDF
    const pdf = new jspdf.jsPDF('p', 'mm', 'a4');

    // Parse the HTML and extract tables
    const parser = new DOMParser();
    const doc = parser.parseFromString(editorContent, 'text/html');

    // Extract tables from the content
    const tables = doc.querySelectorAll('table');
    if (tables.length === 0) {
        alert('No tables found to export.');
        return;
    }

    tables.forEach((table, index) => {
        const body = [];
        const header = [];

        // Extract headers
        table.querySelectorAll('thead th').forEach(th => {
            header.push(th.innerText);
        });

        // Extract rows
        table.querySelectorAll('tbody tr').forEach(tr => {
            const row = [];
            tr.querySelectorAll('td').forEach(td => {
                row.push(td.innerText);
            });
            body.push(row);
        });

        // Add table to PDF using autoTable with cell borders
        pdf.autoTable({
            head: [header],
            body: body,
            startY: index === 0 ? 10 : pdf.autoTable.previous.finalY + 10, // Start after previous table
            styles: {
                lineWidth: 0.1,      // Border line width
                lineColor: [0, 0, 0] // Border color (black)
            },
            tableLineWidth: 0.1,   // Border around the table
            tableLineColor: [0, 0, 0], // Border color around the table
            theme: 'grid'          // Ensures that the table has full grid lines
        });
    });

    // Save the PDF after adding tables
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

    // Show the loading spinner
    document.getElementById('loadingSpinner').style.display = 'block';

    // Initialize timeout handlers for changing messages
    let loadingText = document.getElementById('loadingText');
    const timeouts = [];

    // First message after 10 seconds
    timeouts.push(setTimeout(() => {
        loadingText.textContent = "Opening document... Please wait.";
    }, 10000));

    // Second message after 20 seconds
    timeouts.push(setTimeout(() => {
        loadingText.textContent = "Analyzing document... Please wait.";
    }, 20000));

    // Third message after 30 seconds
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
            // Set the document viewer's source to display the uploaded document
            const viewer = document.getElementById('documentViewer');
            viewer.src = data.html_url;

            // Fetch the document as HTML content
            fetch(data.html_url)
                .then(response => response.text())
                .then(documentHtml => {
                    console.log("Document HTML fetched:", documentHtml);

                    // Parse the HTML to extract text from specific elements
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(documentHtml, 'text/html');
                    
                    // Adjusted logic for parsing author:
                    const headerDiv = doc.querySelector('div[title="header"]') || doc.querySelector('p[align="left"]');
                    let authorName = "Unknown Author";

                    if (headerDiv) {
                        const headerFonts = headerDiv.querySelectorAll('font, span, br');
                        if (headerFonts.length >= 2) {
                            if (headerFonts[1].textContent.trim()) {
                                authorName = headerFonts[1].textContent.trim(); // Second font likely contains the author
                            }
                        }
                    }
                    console.log("Author name:", authorName);

                    // Extract the timestamp from the footer div
                    const footerDiv = doc.querySelector('div[title="footer"], p[align="right"]');
                    let logTimestamp = "No timestamp";

                    if (footerDiv) {
                        const timestampElement = footerDiv.querySelector('b');
                        if (timestampElement) {
                            logTimestamp = timestampElement.innerText.trim(); // Assign the timestamp
                        }
                    }
                    console.log("Log Timestamp:", logTimestamp);

                    // Create a table with the parsed data
                    const tableHtml = 
                        `<table>
                            <thead>
                                <tr>
                                    <th>Sr.</th>
                                    <th>V.T</th>
                                    <th>Granth</th>
                                    <th>ShastraPath</th>
                                    <th>Pub. Rem</th>
                                    <th>In. Rem</th>
                                    <th>Author</th>
                                    <th>Log Timestamp</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>1</td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td>${authorName}</td>
                                    <td>${logTimestamp}</td>
                                </tr>
                            </tbody>
                        </table>`;

                    // Add the table content to CKEditor
                    editorInstance.setData(tableHtml);
                    
                    // Hide the loading spinner once processing is done
                    document.getElementById('loadingSpinner').style.display = 'none';

                    // Clear all pending timeouts once the process is complete
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