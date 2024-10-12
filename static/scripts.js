// Initialize Quill editor with more features, including table and tooltip descriptions
const quill = new Quill('#quillEditor', {
    theme: 'snow',
    modules: {
        toolbar: {
            container: [
                [{ 'header': [1, 2, false] }],
                ['bold', 'italic', 'underline', 'strike'], // Add 'strike'
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'align': [] }],
                ['link', 'image', 'video'], // Add video
                [{ 'table': true }], // Table module
                ['clean'] // Remove formatting
            ],
            handlers: {
                table: function() {
                    this.quill.insertEmbed(this.quill.getSelection().index, 'table', 'insertTable');
                }
            }
        }
    }
});

// Add tooltips on hover
document.querySelectorAll('.ql-toolbar button').forEach(button => {
    const format = button.classList[0].replace('ql-', '');
    button.title = format.charAt(0).toUpperCase() + format.slice(1); // Tooltip from format
});

function uploadDocument() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    if (!file) {
        alert("Please select a file.");
        return;
    }

    const formData = new FormData();
    formData.append('document', file);

    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert(data.error);
        } else {
            document.getElementById('documentViewer').src = data.html_url;
        }
    })
    .catch(error => {
        console.error("Error uploading the document:", error);
        alert("Error uploading the document.");
    });
}