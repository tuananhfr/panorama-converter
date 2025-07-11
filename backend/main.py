from flask import Flask, request, jsonify, send_file
from werkzeug.utils import secure_filename
import cv2
import numpy as np
import os
import uuid
import threading
import time
from datetime import datetime
import tempfile
import shutil

app = Flask(__name__)

# Configuration
UPLOAD_FOLDER = 'uploads'
OUTPUT_FOLDER = 'outputs'
MAX_CONTENT_LENGTH = 500 * 1024 * 1024  # 500MB
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'bmp', 'tiff'}

app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

# Ensure directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# Job tracking
jobs = {}
job_lock = threading.Lock()

class PanoramaJob:
    def __init__(self, job_id: str, images: list, mode: str = 'auto'):
        self.job_id = job_id
        self.images = images
        self.mode = mode
        self.status = 'pending'
        self.created_at = datetime.now()
        self.completed_at = None
        self.error_message = None
        self.output_file = None
        self.progress = 0

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def stitch_panorama_opencv(image_paths, mode='auto'):
    """Stitch panorama using OpenCV"""
    try:
        # Load images
        images = []
        for path in image_paths:
            img = cv2.imread(path)
            if img is None:
                raise Exception(f"Cannot load image: {path}")
            
            # Resize large images to prevent memory issues
            height, width = img.shape[:2]
            if width > 2000:
                scale = 2000 / width
                new_width = int(width * scale)
                new_height = int(height * scale)
                img = cv2.resize(img, (new_width, new_height))
            
            images.append(img)
        
        if len(images) < 2:
            raise Exception("Need at least 2 images")
        
        # Create stitcher based on mode
        if mode == 'scans':
            # For scanned documents or ordered images
            stitcher = cv2.Stitcher_create(cv2.Stitcher_SCANS)
        else:
            # Default panorama mode
            stitcher = cv2.Stitcher_create(cv2.Stitcher_PANORAMA)
        
        # Configure stitcher for better results
        stitcher.setPanoConfidenceThresh(0.3)
        
        # Stitch images
        status, panorama = stitcher.stitch(images)
        
        if status == cv2.Stitcher_OK:
            return panorama
        elif status == cv2.Stitcher_ERR_NEED_MORE_IMGS:
            raise Exception("Need more images for stitching")
        elif status == cv2.Stitcher_ERR_HOMOGRAPHY_EST_FAIL:
            raise Exception("Homography estimation failed - try reordering images")
        elif status == cv2.Stitcher_ERR_CAMERA_PARAMS_ADJUST_FAIL:
            raise Exception("Camera parameter adjustment failed")
        else:
            raise Exception(f"Stitching failed with status: {status}")
            
    except Exception as e:
        raise Exception(f"OpenCV stitching error: {str(e)}")

def process_panorama_opencv(job_id: str):
    """Background task to process panorama using OpenCV"""
    with job_lock:
        if job_id not in jobs:
            return
        job = jobs[job_id]
    
    try:
        job.status = 'processing'
        job.progress = 10
        
        # Validate images exist
        valid_images = []
        for img_path in job.images:
            if os.path.exists(img_path):
                valid_images.append(img_path)
        
        if len(valid_images) < 2:
            raise Exception("Not enough valid images")
        
        job.progress = 30
        
        # Sort images by filename for better results
        valid_images.sort()
        
        job.progress = 40
        
        # Stitch panorama
        panorama = stitch_panorama_opencv(valid_images, job.mode)
        
        job.progress = 80
        
        # Save result
        output_filename = f"panorama_{job_id}.jpg"
        output_path = os.path.join(OUTPUT_FOLDER, output_filename)
        
        # Save with high quality
        cv2.imwrite(output_path, panorama, [cv2.IMWRITE_JPEG_QUALITY, 95])
        
        if not os.path.exists(output_path):
            raise Exception("Failed to save output image")
        
        job.output_file = output_path
        job.status = 'completed'
        job.progress = 100
        job.completed_at = datetime.now()
        
    except Exception as e:
        job.status = 'failed'
        job.error_message = str(e)
        job.completed_at = datetime.now()

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'opencv_version': cv2.__version__,
        'stitcher_available': True
    })

@app.route('/api/stitch', methods=['POST'])
def stitch_panorama():
    """Upload images and start panorama stitching"""
    try:
        # Validate request
        if 'images' not in request.files:
            return jsonify({'error': 'No images uploaded'}), 400
        
        files = request.files.getlist('images')
        if len(files) < 2:
            return jsonify({'error': 'At least 2 images required'}), 400
        
        # Get parameters
        mode = request.form.get('mode', 'auto')  # auto, scans
        if mode not in ['auto', 'scans']:
            return jsonify({'error': 'Invalid mode. Use "auto" or "scans"'}), 400
        
        # Create job
        job_id = str(uuid.uuid4())
        
        # Save uploaded files
        saved_files = []
        job_dir = os.path.join(UPLOAD_FOLDER, job_id)
        os.makedirs(job_dir, exist_ok=True)
        
        for i, file in enumerate(files):
            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                if not filename:
                    filename = f"image_{i:03d}.jpg"
                
                file_path = os.path.join(job_dir, filename)
                file.save(file_path)
                saved_files.append(file_path)
        
        if len(saved_files) < 2:
            return jsonify({'error': 'At least 2 valid images required'}), 400
        
        # Create and start job
        job = PanoramaJob(job_id, saved_files, mode)
        
        with job_lock:
            jobs[job_id] = job
        
        # Start processing in background
        thread = threading.Thread(target=process_panorama_opencv, args=(job_id,))
        thread.daemon = True
        thread.start()
        
        return jsonify({
            'job_id': job_id,
            'status': 'accepted',
            'message': 'Panorama stitching started using OpenCV',
            'images_count': len(saved_files),
            'mode': mode
        }), 202
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/status/<job_id>', methods=['GET'])
def get_job_status(job_id):
    """Get job status"""
    with job_lock:
        if job_id not in jobs:
            return jsonify({'error': 'Job not found'}), 404
        
        job = jobs[job_id]
        
        response = {
            'job_id': job_id,
            'status': job.status,
            'progress': job.progress,
            'created_at': job.created_at.isoformat(),
            'mode': job.mode,
            'images_count': len(job.images)
        }
        
        if job.completed_at:
            response['completed_at'] = job.completed_at.isoformat()
            response['processing_time'] = (job.completed_at - job.created_at).total_seconds()
        
        if job.error_message:
            response['error'] = job.error_message
        
        if job.output_file:
            response['download_url'] = f'/api/download/{job_id}'
            response['file_size'] = os.path.getsize(job.output_file)
        
        return jsonify(response)

@app.route('/api/download/<job_id>', methods=['GET'])
def download_result(job_id):
    """Download panorama result"""
    with job_lock:
        if job_id not in jobs:
            return jsonify({'error': 'Job not found'}), 404
        
        job = jobs[job_id]
        
        if job.status != 'completed' or not job.output_file:
            return jsonify({'error': 'Result not ready'}), 400
        
        if not os.path.exists(job.output_file):
            return jsonify({'error': 'Output file not found'}), 404
        
        return send_file(
            job.output_file,
            as_attachment=True,
            download_name=f'panorama_{job_id}.jpg',
            mimetype='image/jpeg'
        )

if __name__ == '__main__':
    print("OpenCV Panorama Backend API")
    print("===========================")
    print(f"OpenCV Version: {cv2.__version__}")
    print(f"Upload folder: {UPLOAD_FOLDER}")
    print(f"Output folder: {OUTPUT_FOLDER}")
    print(f"Max file size: {MAX_CONTENT_LENGTH / (1024*1024):.0f}MB")
    print()
    
    app.run(debug=True, host='0.0.0.0', port=5000)