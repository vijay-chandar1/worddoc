import os
import subprocess
from flask import Flask, request, render_template, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from pdf2docx import Converter

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = "uploads"
app.config['OUTPUT_FOLDER'] = "outputs"

# Ensure the upload and output folders exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)

# Allowed extensions for document upload
ALLOWED_EXTENSIONS = {'docx', 'doc', 'pdf'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload():
    if 'document' not in request.files:
        return jsonify({"error": "No file uploaded."}), 400

    document = request.files['document']
    filename = secure_filename(document.filename)

    # Ensure the uploaded file is allowed
    if not allowed_file(filename):
        return jsonify({"error": f"Only {', '.join(ALLOWED_EXTENSIONS)} files are allowed."}), 400

    # Save the uploaded file
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    document.save(file_path)

    # Convert .doc and .pdf to .docx if needed
    if filename.endswith('.doc') or filename.endswith('.pdf'):
        docx_file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename.rsplit('.', 1)[0] + '.docx')

        try:
            if filename.endswith('.doc'):
                # Convert .doc to .docx using LibreOffice
                convert_command = [
                    'libreoffice',
                    '--headless',
                    '--convert-to', 'docx',
                    '--outdir', app.config['UPLOAD_FOLDER'],
                    file_path
                ]
                subprocess.run(convert_command, check=True)
            elif filename.endswith('.pdf'):
                # Convert PDF to DOCX using pdf2docx with layout preservation for tables
                cv = Converter(file_path)
                cv.convert(docx_file_path, start=0, end=None, layout='exact')  # Preserve layout better
                cv.close()

            # Use the converted .docx file for further processing
            file_path = docx_file_path
        except Exception as e:
            return jsonify({"error": f"Error converting to .docx: {str(e)}"}), 500

    # Now convert the .docx file to .html using LibreOffice or fallback to Pandoc
    output_html = os.path.join(app.config['OUTPUT_FOLDER'], filename.rsplit('.', 1)[0] + '.html')

    try:
        # Try using LibreOffice for conversion
        convert_command = [
            'libreoffice',
            '--headless',
            '--convert-to', 'html',
            '--outdir', app.config['OUTPUT_FOLDER'],
            file_path
        ]
        subprocess.run(convert_command, check=True)
    except subprocess.CalledProcessError:
        # Fallback to Pandoc if LibreOffice fails
        try:
            convert_command = ['pandoc', file_path, '-o', output_html]
            subprocess.run(convert_command, check=True)
        except Exception as e:
            return jsonify({"error": f"Error converting document to HTML: {str(e)}"}), 500

    return jsonify({"html_url": f"/outputs/{filename.rsplit('.', 1)[0]}.html"})

# Serve the converted HTML file
@app.route('/outputs/<filename>')
def serve_output(filename):
    return send_from_directory(app.config['OUTPUT_FOLDER'], filename)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
