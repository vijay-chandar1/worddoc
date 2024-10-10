import os
import subprocess
from flask import Flask, request, render_template, jsonify, send_from_directory
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = "uploads"
app.config['OUTPUT_FOLDER'] = "outputs"

# Ensure the upload and output folders exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload():
    if 'document' not in request.files:
        return jsonify({"error": "No file uploaded."}), 400

    document = request.files['document']
    filename = secure_filename(document.filename)

    # Ensure the uploaded file is a .docx
    if not filename.endswith('.docx'):
        return jsonify({"error": "Only .docx files are allowed."}), 400

    # Save the uploaded file
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    document.save(file_path)

    # Convert the .docx file to .html using LibreOffice
    output_html = os.path.join(app.config['OUTPUT_FOLDER'], filename.rsplit('.', 1)[0] + '.html')
    convert_command = [
        'libreoffice',
        '--headless',
        '--convert-to', 'html',
        '--outdir', app.config['OUTPUT_FOLDER'],
        file_path
    ]

    try:
        subprocess.run(convert_command, check=True)
        return jsonify({"html_url": f"/outputs/{filename.rsplit('.', 1)[0]}.html"})
    except subprocess.CalledProcessError:
        return jsonify({"error": "Error converting document."}), 500

# Serve the converted HTML file
@app.route('/outputs/<filename>')
def serve_output(filename):
    return send_from_directory(app.config['OUTPUT_FOLDER'], filename)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')