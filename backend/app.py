from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import io
from PIL import Image
import tempfile
import os

app = Flask(__name__)
CORS(app)  # Enable CORS for React

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'message': 'Python Flask + OpenCV Backend Ready',
        'opencv_version': cv2.__version__
    })

@app.route('/stitch', methods=['POST'])
def stitch_images():
    try:
        print("Received stitching request...")
        
        # Get uploaded files
        uploaded_files = request.files.getlist('images')
        print(f"Number of uploaded files: {len(uploaded_files)}")
        
        if len(uploaded_files) < 2:
            return jsonify({'error': 'Need at least 2 images'}), 400
        
        # Get settings
        stitch_mode = request.form.get('stitch_mode', 'PANORAMA')
        confidence = float(request.form.get('confidence_threshold', 1.0))
        reg_resol = float(request.form.get('registration_resol', 0.6))
        seam_resol = float(request.form.get('seam_estimation_resol', 0.1))
        comp_resol = float(request.form.get('compositing_resol', -1))
        
        print(f"Settings: mode={stitch_mode}, confidence={confidence}")
        
        # Convert uploaded files to OpenCV images
        images = []
        for i, file in enumerate(uploaded_files):
            print(f"Processing image {i+1}: {file.filename}")
            
            # Read image
            img = Image.open(file.stream)
            img_array = np.array(img)
            
            # Convert RGB to BGR for OpenCV
            if len(img_array.shape) == 3:
                img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
            else:
                img_bgr = img_array
                
            images.append(img_bgr)
            print(f"Image {i+1} shape: {img_bgr.shape}")
        
        print(f"Loaded {len(images)} images for stitching")
        
        # Create OpenCV Stitcher
        if stitch_mode == 'PANORAMA':
            stitcher = cv2.Stitcher_create(cv2.Stitcher_PANORAMA)
        else:
            stitcher = cv2.Stitcher_create(cv2.Stitcher_SCANS)
        
        # Set stitcher parameters
        stitcher.setRegistrationResol(reg_resol)
        stitcher.setSeamEstimationResol(seam_resol)
        stitcher.setPanoConfidenceThresh(confidence)
        
        if comp_resol > 0:
            stitcher.setCompositingResol(comp_resol)
        
        print("Starting OpenCV stitching...")
        
        # Perform stitching
        status, panorama = stitcher.stitch(images)
        
        if status == cv2.Stitcher_OK:
            print("Stitching successful!")
            print(f"Panorama shape: {panorama.shape}")
            
            # Convert result to RGB for web
            result_rgb = cv2.cvtColor(panorama, cv2.COLOR_BGR2RGB)
            result_image = Image.fromarray(result_rgb)
            
            # Save to temporary file
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
            result_image.save(temp_file.name, 'JPEG', quality=95)
            temp_file.close()
            
            print(f"Saved result to: {temp_file.name}")
            
            return send_file(temp_file.name, 
                           mimetype='image/jpeg',
                           as_attachment=False,
                           download_name='panorama.jpg')
        else:
            error_messages = {
                cv2.Stitcher_ERR_NEED_MORE_IMGS: "Need more images",
                cv2.Stitcher_ERR_HOMOGRAPHY_EST_FAIL: "Homography estimation failed",
                cv2.Stitcher_ERR_CAMERA_PARAMS_ADJUST_FAIL: "Camera parameter adjustment failed"
            }
            
            error_msg = error_messages.get(status, f"Unknown error: {status}")
            print(f"Stitching failed: {error_msg}")
            return jsonify({'error': error_msg}), 400
            
    except Exception as e:
        print(f"Error during stitching: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("=" * 50)
    print("Starting Python Flask + OpenCV Backend...")
    print("Backend will run at: http://localhost:5000")
    print("Press Ctrl+C to stop")
    print("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=5000)